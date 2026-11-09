"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { ExternalLink, MapPin } from "lucide-react";
import OpenStreetMap from "./OpenStreetMap";
import { groupMapPoints, type MapPoint } from "./map-types";

export const IBADAN_CENTER = { lat: 7.3775, lng: 3.947 };
export type { MapPoint } from "./map-types";
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
export const GOOGLE_MAPS_CONFIGURED = Boolean(API_KEY);
let configured = false;
let libraries: Promise<[google.maps.MapsLibrary, google.maps.MarkerLibrary]> | null = null;

function loadLibraries() {
  if (!libraries) {
    if (!configured) {
      setOptions({ key: API_KEY, v: "weekly", language: "en", region: "NG", authReferrerPolicy: "origin" });
      configured = true;
    }
    libraries = Promise.all([
      importLibrary("maps") as Promise<google.maps.MapsLibrary>,
      importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
    ]);
  }
  return libraries;
}

type Props = {
  points: MapPoint[];
  height?: number;
  editable?: boolean;
  onPick?: (lat: number, lng: number) => void;
  label?: string;
  selectedId?: string;
  onSelect?: (id: string) => void;
};

export default function GoogleMap({ points, height = 380, editable = false, onPick, label = "Business locations in Ibadan", selectedId, onSelect }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef(new globalThis.Map<string, google.maps.marker.AdvancedMarkerElement>());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const onPickRef = useRef(onPick); onPickRef.current = onPick;
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect;
  const [ready, setReady] = useState(false);
  const [useFallback, setUseFallback] = useState(!API_KEY);
  const pointKey = useMemo(() => points.map(p => `${p.id}:${p.lat}:${p.lng}:${p.title}:${p.subtitle ?? ""}:${p.href ?? ""}`).join("|"), [points]);

  useEffect(() => {
    if (!API_KEY) { setUseFallback(true); return; }
    let cancelled = false;
    let clickListener: google.maps.MapsEventListener | undefined;
    let observer: ResizeObserver | undefined;
    let map: google.maps.Map | null = null;
    let readyTimer: number | undefined;
    const authWindow = window as Window & { gm_authFailure?: () => void };
    const previousAuthFailure = authWindow.gm_authFailure;
    authWindow.gm_authFailure = () => { previousAuthFailure?.(); if (!cancelled) setUseFallback(true); };
    readyTimer = window.setTimeout(() => { if (!cancelled) setUseFallback(true); }, 15000);

    void loadLibraries().then(([maps, markerLibrary]) => {
      if (cancelled || !element.current) return;
      map = new maps.Map(element.current, {
        center: IBADAN_CENTER,
        zoom: 12,
        mapId: MAP_ID,
        gestureHandling: "cooperative",
        clickableIcons: false,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
      });
      mapRef.current = map;
      (map as google.maps.Map & { __neighbourMarker?: typeof markerLibrary.AdvancedMarkerElement }).__neighbourMarker = markerLibrary.AdvancedMarkerElement;
      clickListener = map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (editable && e.latLng) onPickRef.current?.(Number(e.latLng.lat().toFixed(6)), Number(e.latLng.lng().toFixed(6)));
      });
      observer = new ResizeObserver(() => { if (map) google.maps.event.trigger(map, "resize"); });
      observer.observe(element.current);
      if (readyTimer) window.clearTimeout(readyTimer);
      setReady(true);
    }).catch(() => { if (!cancelled) setUseFallback(true); });

    return () => {
      cancelled = true;
      if (readyTimer) window.clearTimeout(readyTimer);
      authWindow.gm_authFailure = previousAuthFailure;
      clickListener?.remove();
      observer?.disconnect();
      infoWindowRef.current?.close();
      markersRef.current.forEach(marker => { marker.map = null; });
      markersRef.current.clear();
      mapRef.current = null;
      setReady(false);
    };
  }, [editable]);

  useEffect(() => {
    const map = mapRef.current as (google.maps.Map & { __neighbourMarker?: typeof google.maps.marker.AdvancedMarkerElement }) | null;
    if (!ready || !map?.__neighbourMarker) return;
    markersRef.current.forEach(marker => { marker.map = null; });
    markersRef.current.clear();
    infoWindowRef.current?.close();

    const groups = groupMapPoints(points);
    const showLabels = groups.length <= 30;
    const bounds = new google.maps.LatLngBounds();

    for (const group of groups) {
      const first = group.points[0];
      const content = document.createElement("div");
      content.className = "google-map-marker";
      const pin = document.createElement("span");
      pin.className = "google-map-pin";
      content.appendChild(pin);
      if (group.points.length > 1) {
        const count = document.createElement("span");
        count.className = "google-map-count";
        count.textContent = String(group.points.length);
        content.appendChild(count);
      } else if (showLabels) {
        const labelEl = document.createElement("span");
        labelEl.className = "google-map-label";
        labelEl.textContent = first.title;
        content.appendChild(labelEl);
      }

      const marker = new map.__neighbourMarker({
        map,
        position: { lat: group.lat, lng: group.lng },
        title: group.points.length > 1 ? `${first.title} and ${group.points.length - 1} more at this location` : first.title,
        content,
        gmpClickable: true,
        gmpDraggable: editable,
      });

      marker.addEventListener("gmp-click", () => {
        onSelectRef.current?.(first.id);
        const popup = document.createElement("div");
        popup.className = "google-map-popup";
        for (const point of group.points) {
          const item = document.createElement("div");
          item.className = "google-map-popup-item";
          const title = document.createElement("strong"); title.textContent = point.title; item.appendChild(title);
          if (point.subtitle) { const subtitle = document.createElement("p"); subtitle.textContent = point.subtitle; item.appendChild(subtitle); }
          const coords = document.createElement("small"); coords.textContent = `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`; item.appendChild(coords);
          if (point.href && /^\/business\/[A-Za-z0-9_-]+$/.test(point.href)) {
            const link = document.createElement("a"); link.href = point.href; link.textContent = "View business"; item.appendChild(link);
          }
          popup.appendChild(item);
        }
        infoWindowRef.current?.close();
        infoWindowRef.current = new google.maps.InfoWindow({ content: popup });
        infoWindowRef.current.open({ map, anchor: marker });
      });

      if (editable) marker.addListener("dragend", () => {
        const pos = marker.position;
        if (!pos) return;
        const lat = typeof pos.lat === "function" ? pos.lat() : pos.lat;
        const lng = typeof pos.lng === "function" ? pos.lng() : pos.lng;
        onPickRef.current?.(Number(Number(lat).toFixed(6)), Number(Number(lng).toFixed(6)));
      });

      markersRef.current.set(group.key, marker);
      bounds.extend({ lat: group.lat, lng: group.lng });
    }

    if (groups.length === 1) { map.setCenter({ lat: groups[0].lat, lng: groups[0].lng }); map.setZoom(16); }
    else if (groups.length > 1) map.fitBounds(bounds, 48);
    else { map.setCenter(IBADAN_CENTER); map.setZoom(12); }

    if (selectedId) {
      const selectedGroup = groups.find(g => g.points.some(p => p.id === selectedId));
      const marker = selectedGroup ? markersRef.current.get(selectedGroup.key) : undefined;
      if (selectedGroup && marker) {
        map.setCenter({ lat: selectedGroup.lat, lng: selectedGroup.lng });
        map.setZoom(Math.max(map.getZoom() ?? 12, 16));
        window.setTimeout(() => marker.dispatchEvent(new Event("gmp-click")), 80);
      }
    }
  }, [ready, pointKey, editable, selectedId, points]);

  if (useFallback) {
    return <OpenStreetMap points={points} height={height} editable={editable} onPick={onPick} label={label} selectedId={selectedId} onSelect={onSelect} />;
  }

  const first = points.find(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const external = first
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${first.lat},${first.lng}`)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Ibadan, Nigeria")}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-sage">
      <div ref={element} style={{ height, width: "100%" }} role="region" aria-label={label} />
      {!ready && (
        <div style={{ minHeight: height }} className="flex flex-col items-center justify-center gap-3 p-6 text-center">
          <MapPin size={30} className="text-bronze" aria-hidden />
          <p className="text-sm font-bold text-forest">Loading Google Map…</p>
          <a href={external} target="_blank" rel="noopener noreferrer" className="btn-outline !py-2 !text-xs"><ExternalLink size={14} />Open in Google Maps</a>
        </div>
      )}
      <ul className="sr-only" aria-label="Mapped business locations">
        {points.map(p => <li key={p.id}>{p.title} at {p.lat.toFixed(6)}, {p.lng.toFixed(6)}{p.href && <a href={p.href}>View business</a>}</li>)}
      </ul>
    </div>
  );
}
