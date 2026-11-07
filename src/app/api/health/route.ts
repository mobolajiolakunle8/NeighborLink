import { NextResponse } from "next/server";
import { isFirebaseConfigured } from "@/lib/firebase";

export const dynamic = "force-dynamic";

/** Liveness probe. Reports whether Firebase configuration is present; it never exposes secrets. */
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "NeighbourLink",
    firebaseConfigured: isFirebaseConfigured,
    timestamp: new Date().toISOString(),
  });
}
