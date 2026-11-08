"use client";

import { useState, type ChangeEvent } from "react";
import { Image as ImageIcon, Upload } from "lucide-react";
import { uploadImage } from "@/lib/uploads";
import type { ImageVariant } from "@/lib/image-optimizer";
import { imageVariantHint } from "@/lib/image-optimizer";
import { friendlyError, isHttpUrl, validateImageFile } from "@/lib/utils";
import { Alert, Spinner } from "@/components/ui";

function sizeLabel(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`; }

/** All selected local images are compressed before upload. An external link is used as-is. */
export default function ImageUploadField({ label, value, onChange, folder, hint, variant = "standard" }: {
  label: string; value: string; onChange: (url: string) => void; folder: string;
  hint?: string; variant?: ImageVariant;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [optimizedInfo, setOptimizedInfo] = useState<string | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) { setError(problem); return; }
    setError(null); setOptimizedInfo(null); setUploading(true);
    try {
      const result = await uploadImage(file, folder, variant);
      onChange(result.url);
      const saved = Math.max(0, Math.round((1 - result.bytes / result.originalBytes) * 100));
      setOptimizedInfo(`${result.width} × ${result.height}px WebP · ${sizeLabel(file.size)} → ${sizeLabel(result.bytes)}${saved > 2 ? ` · ${saved}% smaller` : ""}`);
    } catch (err) { setError(friendlyError(err)); }
    finally { setUploading(false); }
  }

  function handleUrl(v: string) {
    onChange(v);
    setOptimizedInfo(null);
    setUrlError(v && !isHttpUrl(v) ? "Please enter a full https:// link." : null);
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-start gap-3">
        {value && !urlError ? <img src={value} alt="" className={`shrink-0 rounded-xl border border-line bg-white object-cover ${variant === "cover" ? "aspect-video w-28" : "h-16 w-16"}`} /> : <span className={`grid shrink-0 place-items-center rounded-xl bg-sage text-forest/60 ${variant === "cover" ? "aspect-video w-28" : "h-16 w-16"}`}><ImageIcon size={22} aria-hidden /></span>}
        <div className="min-w-0 flex-1 space-y-2">
          <label className="btn-outline !px-3 !py-2 text-sm cursor-pointer">
            {uploading ? <><Spinner /> Compressing & uploading…</> : <><Upload size={15} aria-hidden /> Upload & auto-compress</>}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={handleFile} disabled={uploading} />
          </label>
          <input value={value} onChange={e => handleUrl(e.target.value)} placeholder="…or paste an image link (used as provided)" className="input !py-2 text-sm" aria-label={`${label} URL`} />
          <p className="text-xs text-muted">{hint || imageVariantHint(variant)} Uploads are automatically re-encoded, resized and stripped of EXIF metadata before storage. Pasted external links remain hosted by their original provider.</p>
          {optimizedInfo && <p role="status" className="text-xs font-bold text-[#1F5C3D]">Optimized: {optimizedInfo}</p>}
          {error && <Alert kind="error">{error}</Alert>}
          {urlError && <p className="text-xs font-bold text-danger">{urlError}</p>}
        </div>
      </div>
    </div>
  );
}
