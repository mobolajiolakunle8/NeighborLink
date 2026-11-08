// Server-side read of the public site settings via the Firestore REST API.
// Used only for <title>/<meta> tags so that SEO edits made in the admin dashboard
// appear in search results. Reads are allowed by the public read rule on siteSettings,
// so no credentials are needed and nothing private is exposed.
import type { SiteSettings } from "./types";
import webConfig from "@/config/firebase.web.json";

type FsValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  mapValue?: { fields?: Record<string, FsValue> };
  arrayValue?: { values?: FsValue[] };
};

function fromValue(v: FsValue): unknown {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.mapValue) return fromFields(v.mapValue.fields ?? {});
  if (v.arrayValue) return (v.arrayValue.values ?? []).map(fromValue);
  return null;
}

function fromFields(fields: Record<string, FsValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fromValue(v)]));
}

export async function fetchPublicSettings(): Promise<Partial<SiteSettings> | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || webConfig.projectId;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || webConfig.apiKey;
  if (!projectId || !apiKey) return null;
  try {
    const url =
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/siteSettings/main` +
      `?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { fields?: Record<string, FsValue> };
    return json.fields ? (fromFields(json.fields) as Partial<SiteSettings>) : null;
  } catch {
    return null;
  }
}
