"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";

export const IBADAN_CENTER: [number, number] = [7.3775, 3.947];
export type MapPoint = { id: string; lat: number; lng: number; title: string; subtitle?: string; href?: string };
type Props = {
  points: MapPoint[];
  height?: number;
  editable?: boolean;
  onPick?: (lat: number, lng: number) => void;
  label?: string;
};

/** Real OpenStreetMap tiles + saved business coordinates. No invented business pins. */
export default function LeafletMap({ points, height = 380, editable = false, onPick, label = "Business locations in Ibadan" }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const api = useRef<typeof Leaflet | null>(null);
  const pick = useRef(onPick); pick.current = onPick;
  const latestPoints = useRef(points); latestPoints.current = points;
  const [ready, setReady] = useState(false);
  const [tileError, setTileError] = useState(false);
  const pointKey = points.map(p => `${p.id}:${p.lat}:${p.lng}:${p.title}:${p.subtitle ?? ""}:${p.href ?? ""}`).join("|");

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    let instance: Leaflet.Map | undefined;
    void import("leaflet").then(L => {
      if (cancelled || !element.current) return;
      api.current = L;
      instance = L.map(element.current, { scrollWheelZoom: false, zoomControl: true }).setView(IBADAN_CENTER, 12);
      map.current = instance;
      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
      });
      let failures = 0;
      tiles.on("tileerror", () => { failures++; if (failures >= 4 && !cancelled) setTileError(true); });
      tiles.on("load", () => { failures = 0; if (!cancelled) setTileError(false); });
      tiles.addTo(instance);
      layer.current = L.layerGroup().addTo(instance);
      instance.on("click", (event: Leaflet.LeafletMouseEvent) => pick.current?.(Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6))));
      observer = new ResizeObserver(() => instance?.invalidateSize());
      observer.observe(element.current);
      setReady(true);
    }).catch(() => { if (!cancelled) setTileError(true); });
    return () => { cancelled = true; observer?.disconnect(); instance?.remove(); map.current = null; layer.current = null; setReady(false); };
  }, []);

  useEffect(() => {
    const L = api.current, instance = map.current, group = layer.current;
    if (!ready || !L || !instance || !group) return;
    group.clearLayers();
    const valid = latestPoints.current.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180);
    const icon = L.divIcon({
      className: "nl-map-pin",
      html: '<svg width="32" height="40" viewBox="0 0 32 40" aria-hidden="true"><path d="M16 1C7.7 1 1 7.7 1 16c0 10.5 15 23 15 23s15-12.5 15-23C31 7.7 24.3 1 16 1Z" fill="#172D2A" stroke="#F8F8F5" stroke-width="2"/><circle cx="16" cy="16" r="6" fill="#D5A85C"/></svg>',
      iconSize: [32, 40], iconAnchor: [16, 39], popupAnchor: [0, -34],
    });
    for (const point of valid) {
      const marker = L.marker([point.lat, point.lng], { icon, title: point.title, alt: point.title, keyboard: true });
      // Build popup with textContent, never interpolate listing text into HTML.
      const popup = document.createElement("div");
      popup.className = "nl-map-popup";
      const title = document.createElement("strong"); title.textContent = point.title; popup.appendChild(title);
      if (point.subtitle) { const sub = document.createElement("p"); sub.textContent = point.subtitle; popup.appendChild(sub); }
      if (point.href && /^\/business\/[A-Za-z0-9_-]+$/.test(point.href)) {
        const link = document.createElement("a"); link.href = point.href; link.textContent = "View business →"; popup.appendChild(link);
      }
      marker.bindPopup(popup).addTo(group);
    }
    if (valid.length === 1) instance.setView([valid[0].lat, valid[0].lng], 16);
    else if (valid.length > 1) instance.fitBounds(L.latLngBounds(valid.map(p => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 15 });
    else instance.setView(IBADAN_CENTER, 12);
  }, [ready, pointKey]);

  const first = points[0];
  const external = first ? `https://www.openstreetmap.org/?mlat=${first.lat}&mlon=${first.lng}#map=16/${first.lat}/${first.lng}` : "https://www.openstreetmap.org/search?query=Ibadan%2C%20Nigeria";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-sage">
      <div ref={element} style={{ height, width: "100%" }} role="region" aria-label={label} />
      {!ready && !tileError && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-sage text-sm font-bold text-muted">Loading map…</div>}
      {tileError && <div className="absolute bottom-8 left-3 right-3 rounded-xl border border-line bg-white p-3 text-xs shadow"><p className="font-bold">Map tiles are unavailable right now.</p><a className="mt-1 inline-block underline" href={external} target="_blank" rel="noopener noreferrer">Open the location on OpenStreetMap</a></div>}
      <ul className="sr-only" aria-label="Mapped business locations">{points.map(p => <li key={p.id}>{p.title}{p.subtitle ? `, ${p.subtitle}` : ""}{p.href && <a href={p.href}>View business</a>}</li>)}</ul>
    </div>
  );
}
