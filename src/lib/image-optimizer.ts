import { validateImageFile } from "./utils";

export type ImageVariant = "cover" | "square" | "standard";
export type OptimizedImage = { file: File; width: number; height: number; originalBytes: number; bytes: number; type: string };
const MAX_FINAL_BYTES = 1_500_000;
const QUALITY_STEPS = [0.84, 0.76, 0.68, 0.60];

function decode(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") return createImageBitmap(file, { imageOrientation: "from-image" });
  return new Promise((resolve, reject) => {
    const image = new Image(); const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); createImageBitmap(image).then(resolve, reject); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This image could not be opened.")); };
    image.src = url;
  });
}
function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("This browser couldn't compress the selected image.")), type, quality));
}

/**
 * Orients, crops/resizes and recompresses an image before it reaches Firebase Storage.
 * Cover mode is centre-cropped to the documented 16:9 1600×900 ratio. Animated images
 * become a single representative still frame. EXIF metadata is stripped by canvas.
 */
export async function optimizeImage(file: File, variant: ImageVariant = "standard"): Promise<OptimizedImage> {
  const invalid = validateImageFile(file);
  if (invalid) throw new Error(invalid);
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await decode(file);
    const sw = bitmap.width, sh = bitmap.height;
    if (!sw || !sh) throw new Error("This image has invalid dimensions.");
    if (sw * sh > 60_000_000) throw new Error("This image is too large to safely process. Please resize it below 60 megapixels first.");
    const targetW = variant === "cover" ? 1600 : variant === "square" ? 1024 : 1600;
    const targetH = variant === "cover" ? 900 : variant === "square" ? 1024 : 1600;
    let sx = 0, sy = 0, cropW = sw, cropH = sh;
    if (variant === "cover" || variant === "square") {
      const targetRatio = targetW / targetH, sourceRatio = sw / sh;
      if (sourceRatio > targetRatio) { cropW = sh * targetRatio; sx = (sw - cropW) / 2; }
      else { cropH = sw / targetRatio; sy = (sh - cropH) / 2; }
    }
    const scale = Math.min(1, targetW / cropW, targetH / cropH);
    let width = Math.max(1, Math.round(cropW * scale));
    let height = Math.max(1, Math.round(cropH * scale));
    let canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    let ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Image compression is unavailable in this browser.");
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, sx, sy, cropW, cropH, 0, 0, width, height);

    let blob: Blob | null = null;
    let webp = true;
    for (let pass = 0; pass < 5; pass++) {
      for (const quality of QUALITY_STEPS) {
        blob = await encode(canvas, webp ? "image/webp" : "image/jpeg", quality);
        if (webp && blob.type !== "image/webp") { webp = false; blob = null; break; }
        if (blob.size <= MAX_FINAL_BYTES) break;
      }
      if (blob && blob.size <= MAX_FINAL_BYTES) break;
      if (Math.max(width, height) <= 640) break;
      const nextWidth = Math.max(640, Math.round(width * 0.8));
      const nextHeight = Math.max(1, Math.round(height * (nextWidth / width)));
      const smaller = document.createElement("canvas"); smaller.width = nextWidth; smaller.height = nextHeight;
      const smallerContext = smaller.getContext("2d", { alpha: true });
      if (!smallerContext) throw new Error("Image compression is unavailable in this browser.");
      if (!webp) { smallerContext.fillStyle = "#fff"; smallerContext.fillRect(0, 0, nextWidth, nextHeight); }
      smallerContext.imageSmoothingEnabled = true; smallerContext.imageSmoothingQuality = "high";
      smallerContext.drawImage(canvas, 0, 0, width, height, 0, 0, nextWidth, nextHeight);
      canvas = smaller; width = nextWidth; height = nextHeight;
    }
    if (!blob) throw new Error("This browser couldn’t encode the image. Please try a JPEG or WEBP file.");
    if (blob.size > MAX_FINAL_BYTES) throw new Error("This image is unusually detailed. Please choose a smaller image.");
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const base = file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48) || "image";
    const output = new File([blob], `${base}.${ext}`, { type: blob.type, lastModified: Date.now() });
    return { file: output, width, height, originalBytes: file.size, bytes: output.size, type: output.type };
  } finally { bitmap?.close(); }
}

export function imageVariantHint(variant: ImageVariant) {
  if (variant === "cover") return "Business cover: recommended 1600 × 900 px (16:9). We centre-crop to this shape and compress to WebP ≤ 1.5 MB before uploading.";
  if (variant === "square") return "Recommended square photo. Automatically resized to a maximum of 1024 × 1024 px and compressed to WebP ≤ 1.5 MB.";
  return "Automatically oriented, resized to a maximum 1600 px on its longest edge, and compressed to WebP ≤ 1.5 MB.";
}
