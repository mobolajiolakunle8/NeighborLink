"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { groupMapPoints, type MapPoint } from "./map-types";

const IBADAN_CENTER: [number, number] = [7.3775, 3.947];

type Props = {
  points: MapPoint[];
  height?: number;
  editable?: boolean;
  onPick?: (lat: number, lng: number) => void;
  label?: string;
  selectedId?: string;
  onSelect?: (id: string) => void;
};

function valid(point: MapPoint) {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}

export default function OpenStreetMap({ points, height = 380, editable = false, onPick, label = "Business locations in Ibadan", selectedId, onSelect }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const markerRefs = useRef(new globalThis.Map<string, Leaflet.Marker>());
  const pickRef = useRef(onPick); pickRef.current = onPick;
  const selectRef = useRef(onSelect); selectRef.current = onSelect;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const pointsKey = useMemo(() => points.map(p => `${p.id}:${p.lat}:${p.lng}:${p.title}:${p.subtitle ?? ""}:${p.href ?? ""}`).join("|"), [points]);

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    let map: Leaflet.Map | undefined;
    void import("leaflet").then(L => {
      if (cancelled || !element.current) return;
      leafletRef.current = L;
      map = L.map(element.current, { scrollWheelZoom: false, zoomControl: true }).setView(IBADAN_CENTER, 12);
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      map.on("click", (event: Leaflet.LeafletMouseEvent) => {
        if (editable) pickRef.current?.(Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6)));
      });
      observer = new ResizeObserver(() => map?.invalidateSize());
      observer.observe(element.current);
      setReady(true);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      observer?.disconnect();
      markerRefs.current.clear();
      map?.remove();
      mapRef.current = null;
      layerRef.current = null;
      setReady(false);
    };
  }, [editable]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;
    layer.clearLayers();
    markerRefs.current.clear();
    const groups = groupMapPoints(points.filter(valid));
    const showLabels = groups.length <= 30;

    for (const group of groups) {
      const first = group.points[0];
      const labelText = group.points.length > 1 ? `${first.title} +${group.points.length - 1}` : first.title;
      const iconElement = document.createElement("div");
      iconElement.className = "leaflet-business-marker";
      const pin = document.createElement("span");
      pin.className = "leaflet-business-pin";
      iconElement.appendChild(pin);
      if (group.points.length > 1) {
        const count = document.createElement("span");
        count.className = "leaflet-business-count";
        count.textContent = String(group.points.length);
        iconElement.appendChild(count);
      }
      const marker = L.marker([group.lat, group.lng], {
        title: labelText,
        alt: labelText,
        keyboard: true,
        draggable: editable,
        icon: L.divIcon({ className: "leaflet-business-icon", html: iconElement, iconSize: [30, 38], iconAnchor: [15, 36], popupAnchor: [0, -34] }),
      });
      if (showLabels) {
        marker.bindTooltip(labelText, { permanent: true, direction: "top", offset: [0, -38], className: "business-map-label", opacity: 1 });
      }
      const popup = document.createElement("div");
      popup.className = "business-map-popup";
      for (const point of group.points) {
        const item = document.createElement("div");
        item.className = "business-map-popup-item";
        const title = document.createElement("strong"); title.textContent = point.title; item.appendChild(title);
        if (point.subtitle) { const subtitle = document.createElement("p"); subtitle.textContent = point.subtitle; item.appendChild(subtitle); }
        const coords = document.createElement("small"); coords.textContent = `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`; item.appendChild(coords);
        if (point.href && /^\/business\/[A-Za-z0-9_-]+$/.test(point.href)) {
          const link = document.createElement("a"); link.href = point.href; link.textContent = "View business"; item.appendChild(link);
        }
        popup.appendChild(item);
      }
      marker.bindPopup(popup);
      marker.on("click", () => selectRef.current?.(first.id));
      if (editable) marker.on("dragend", () => {
        const pos = marker.getLatLng();
        pickRef.current?.(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
      });
      marker.addTo(layer);
      markerRefs.current.set(group.key, marker);
    }

    if (groups.length === 1) map.setView([groups[0].lat, groups[0].lng], 16);
    else if (groups.length > 1) map.fitBounds(L.latLngBounds(groups.map(g => [g.lat, g.lng] as [number, number])), { padding: [42, 42], maxZoom: 15 });
    else map.setView(IBADAN_CENTER, 12);

    if (selectedId) {
      const selectedGroup = groups.find(g => g.points.some(p => p.id === selectedId));
      const marker = selectedGroup ? markerRefs.current.get(selectedGroup.key) : undefined;
      if (selectedGroup && marker) {
        map.setView([selectedGroup.lat, selectedGroup.lng], Math.max(map.getZoom(), 16));
        window.setTimeout(() => marker.openPopup(), 80);
      }
    }
  }, [ready, pointsKey, editable, selectedId, points]);

  const first = points.find(valid);
  const googleUrl = first
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${first.lat},${first.lng}`)}`
    : "https://www.google.com/maps/search/?api=1&query=Ibadan%2C%20Nigeria";

  if (failed) {
    return (
      <div style={{ minHeight: height }} className="flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-bold text-forest">The map could not load.</p>
        <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="btn-outline !py-2 !text-xs">Open location in Google Maps</a>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={element} style={{ height, width: "100%" }} role="region" aria-label={label} />
      {!ready && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-sage text-xs font-bold text-muted">Loading map…</div>}
      <ul className="sr-only" aria-label="Mapped business locations">
        {points.filter(valid).map(p => <li key={p.id}>{p.title} at {p.lat.toFixed(6)}, {p.lng.toFixed(6)}{p.href && <a href={p.href}>View business</a>}</li>)}
      </ul>
    </div>
  );
}
