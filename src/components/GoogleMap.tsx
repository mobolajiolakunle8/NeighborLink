"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { ExternalLink, MapPin } from "lucide-react";

export const IBADAN_CENTER = { lat: 7.3775, lng: 3.947 };
export type MapPoint = { id: string; lat: number; lng: number; title: string; subtitle?: string; href?: string };
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

export default function GoogleMap({ points, height = 380, editable = false, onPick, label = "Business locations in Ibadan" }: {
  points: MapPoint[]; height?: number; editable?: boolean; onPick?: (lat: number, lng: number) => void; label?: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const onPickRef = useRef(onPick); onPickRef.current = onPick;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pointKey = useMemo(() => points.map(p => `${p.id}:${p.lat}:${p.lng}:${p.title}:${p.subtitle ?? ""}:${p.href ?? ""}`).join("|"), [points]);

  useEffect(() => {
    let cancelled = false;
    let clickListener: google.maps.MapsEventListener | undefined;
    let observer: ResizeObserver | undefined;
    let map: google.maps.Map | null = null;
    if (!API_KEY) { setError("Google Maps is not available yet."); return; }
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
      setReady(true);
    }).catch(() => { if (!cancelled) setError("Google Maps could not load. Check that its API key and billing are enabled for this domain."); });
    return () => {
      cancelled = true;
      clickListener?.remove(); observer?.disconnect();
      markersRef.current.forEach(marker => { marker.map = null; });
      markersRef.current = []; mapRef.current = null; setReady(false);
    };
  }, [editable]);

  useEffect(() => {
    const map = mapRef.current as (google.maps.Map & { __neighbourMarker?: typeof google.maps.marker.AdvancedMarkerElement }) | null;
    if (!ready || !map?.__neighbourMarker) return;
    markersRef.current.forEach(marker => { marker.map = null; }); markersRef.current = [];
    const valid = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180);
    const bounds = new google.maps.LatLngBounds();
    for (const point of valid) {
      const pin = document.createElement("span"); pin.className = "google-map-pin"; pin.setAttribute("aria-hidden", "true");
      const marker = new map.__neighbourMarker({ map, position: { lat: point.lat, lng: point.lng }, title: point.title, content: pin, gmpClickable: true, gmpDraggable: editable });
      marker.addEventListener("gmp-click", () => {
        const content = document.createElement("div");
        const title = document.createElement("strong"); title.textContent = point.title; content.appendChild(title);
        if (point.subtitle) { const subtitle = document.createElement("p"); subtitle.textContent = point.subtitle; content.appendChild(subtitle); }
        if (point.href && /^\/business\/[A-Za-z0-9_-]+$/.test(point.href)) { const link = document.createElement("a"); link.href = point.href; link.textContent = "View business"; content.appendChild(link); }
        new google.maps.InfoWindow({ content }).open({ map, anchor: marker });
      });
      if (editable) marker.addListener("dragend", () => {
        const pos = marker.position;
        if (!pos) return;
        const lat = typeof pos.lat === "function" ? pos.lat() : pos.lat;
        const lng = typeof pos.lng === "function" ? pos.lng() : pos.lng;
        onPickRef.current?.(Number(Number(lat).toFixed(6)), Number(Number(lng).toFixed(6)));
      });
      markersRef.current.push(marker); bounds.extend({ lat: point.lat, lng: point.lng });
    }
    if (valid.length === 1) { map.setCenter({ lat: valid[0].lat, lng: valid[0].lng }); map.setZoom(16); }
    else if (valid.length > 1) map.fitBounds(bounds, 48);
    else { map.setCenter(IBADAN_CENTER); map.setZoom(12); }
  }, [ready, pointKey, editable]);

  const first = points.find(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const external = first
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${first.lat},${first.lng}`)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Ibadan, Nigeria")}`;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-sage">
      {error ? (
        <div style={{ minHeight: height }} className="flex flex-col items-center justify-center gap-3 p-6 text-center">
          <MapPin size={30} className="text-bronze" aria-hidden />
          <p className="text-sm font-bold text-forest">{editable ? "Choose your business location" : "View this area in Google Maps"}</p>
          <p className="max-w-md text-xs text-muted">{editable ? "Enter coordinates or open Google Maps, find your business, then enter its latitude and longitude." : "Open the saved business location in Google Maps."}</p>
          <a href={external} target="_blank" rel="noopener noreferrer" className="btn-outline !py-2 !text-xs"><ExternalLink size={14} />Open Google Maps</a>
        </div>
      ) : (
        <><div ref={element} style={{ height, width: "100%" }} role="region" aria-label={label} />{!ready && <div className="pointer-events-none relative -mt-12 grid place-items-center text-xs font-bold text-muted">Loading Google Map…</div>}</>
      )}
      <ul className="sr-only" aria-label="Mapped business locations">{points.map(p => <li key={p.id}>{p.title}{p.subtitle ? `, ${p.subtitle}` : ""}{p.href && <a href={p.href}>View business</a>}</li>)}</ul>
    </div>
  );
}
