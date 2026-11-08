"use client";
import dynamic from "next/dynamic";
import type { MapPoint } from "./GoogleMap";
export type { MapPoint } from "./GoogleMap";
export { GOOGLE_MAPS_CONFIGURED } from "./GoogleMap";
const GoogleMap = dynamic(() => import("./GoogleMap"), { ssr: false, loading: () => <div className="grid h-[380px] place-items-center rounded-2xl border border-line bg-sage text-sm font-bold text-muted">Loading Google Map…</div> });
export default function MapPanel(props: { points: MapPoint[]; height?: number; editable?: boolean; onPick?: (lat: number, lng: number) => void; label?: string }) { return <GoogleMap {...props} />; }
