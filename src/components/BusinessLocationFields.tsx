"use client";

import { useMemo, useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import MapPanel from "./MapPanel";
import { Alert, Field, Spinner } from "./ui";

export function validCoordinatePair(lat: string, lng: string): boolean {
  if (!lat.trim() && !lng.trim()) return true;
  if (!lat.trim() || !lng.trim()) return false;
  const a = Number(lat), b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180;
}

export default function BusinessLocationFields({ latitude, longitude, onChange }: { latitude: string; longitude: string; onChange: (lat: string, lng: string) => void }) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = validCoordinatePair(latitude, longitude);
  const points = useMemo(() => valid && latitude.trim() && longitude.trim() ? [{ id: "business-pin", lat: Number(latitude), lng: Number(longitude), title: "Your business location" }] : [], [latitude, longitude, valid]);

  function useCurrentLocation() {
    if (!navigator.geolocation) { setError("This browser does not support location lookup. Click the map to place your pin instead."); return; }
    setLocating(true); setError(null);
    navigator.geolocation.getCurrentPosition(position => {
      onChange(position.coords.latitude.toFixed(6), position.coords.longitude.toFixed(6));
      setLocating(false);
    }, err => {
      setError(err.code === 1 ? "Location permission was denied. You can still click the map or enter coordinates manually." : "We couldn't get your location. Click the map to place the pin instead.");
      setLocating(false);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  return (
    <fieldset className="sm:col-span-2 space-y-3 rounded-2xl border border-line bg-sage/30 p-4">
      <legend className="px-1 text-sm font-extrabold">Business location on the map</legend>
      <p className="text-xs leading-relaxed text-muted">Place the pin at your shop or office. Click the map, enter coordinates, or use your current location while you are at the business. The pin is published only when you save the listing.</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Field label="Latitude"><input className="input" inputMode="decimal" value={latitude} onChange={e => onChange(e.target.value, longitude)} placeholder="e.g. 7.377500" aria-invalid={!valid} /></Field>
        <Field label="Longitude"><input className="input" inputMode="decimal" value={longitude} onChange={e => onChange(latitude, e.target.value)} placeholder="e.g. 3.947000" aria-invalid={!valid} /></Field>
        <button type="button" disabled={locating} onClick={useCurrentLocation} className="btn-outline self-end !py-3 !text-xs">{locating ? <Spinner /> : <LocateFixed size={15} />} Use my location</button>
      </div>
      {!valid && <Alert kind="error">Enter both latitude (-90 to 90) and longitude (-180 to 180), or leave both empty.</Alert>}
      {error && <Alert kind="warning">{error}</Alert>}
      <MapPanel points={points} height={260} editable onPick={(lat, lng) => onChange(String(lat), String(lng))} label="Choose your business location" />
      <p className="flex items-center gap-1.5 text-xs font-bold text-muted"><MapPin size={13} />{points.length ? "Pin set. Save the listing to publish this location." : "No pin yet — this business will not appear on the location map."}</p>
    </fieldset>
  );
}
