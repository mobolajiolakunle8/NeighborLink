"use client";

import { useState, type ChangeEvent } from "react";
import { Image as ImageIcon, Upload } from "lucide-react";
import { uploadImage } from "@/lib/uploads";
import { friendlyError, isHttpUrl, validateImageFile } from "@/lib/utils";
import { Alert } from "@/components/ui";

/**
 * Image input that uploads to Cloud Storage after validating type and size.
 * An external https URL can also be pasted instead.
 */
export default function ImageUploadField({
  label,
  value,
  onChange,
  folder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  folder: string;
  hint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      onChange(await uploadImage(file, folder));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setUploading(false);
    }
  }

  function handleUrl(v: string) {
    onChange(v);
    setUrlError(v && !isHttpUrl(v) ? "Please enter a full https:// link." : null);
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-start gap-3">
        {value && !urlError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-16 w-16 shrink-0 rounded-xl border border-line object-cover" />
        ) : (
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-sage text-forest/60">
            <ImageIcon size={22} aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <label className="btn-outline !px-3 !py-2 text-sm cursor-pointer">
            <Upload size={15} aria-hidden />
            {uploading ? "Uploading…" : "Upload image"}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={handleFile} disabled={uploading} />
          </label>
          <input
            value={value}
            onChange={(e) => handleUrl(e.target.value)}
            placeholder="…or paste an image link (https://)"
            className="input !py-2 text-sm"
            aria-label={`${label} link`}
          />
          {hint && <p className="text-xs text-muted">{hint}</p>}
          {error && <Alert kind="error">{error}</Alert>}
          {urlError && <p className="text-xs font-bold text-danger">{urlError}</p>}
        </div>
      </div>
    </div>
  );
}
