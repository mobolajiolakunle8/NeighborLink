// Every picked image is oriented, resized/cropped and recompressed before Storage upload.
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getStorageClient } from "./firebase";
import { optimizeImage, type ImageVariant } from "./image-optimizer";

export interface UploadedImage { url: string; width: number; height: number; originalBytes: number; bytes: number; type: string }

export async function uploadImage(file: File, folder: string, variant: ImageVariant = "standard"): Promise<UploadedImage> {
  const optimized = await optimizeImage(file, variant);
  const safeName = optimized.file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60);
  const path = `${folder}/${Date.now()}-${safeName}`;
  const fileRef = ref(getStorageClient(), path);
  await uploadBytes(fileRef, optimized.file, { contentType: optimized.type, cacheControl: "public,max-age=31536000,immutable" });
  return { url: await getDownloadURL(fileRef), width: optimized.width, height: optimized.height, originalBytes: optimized.originalBytes, bytes: optimized.bytes, type: optimized.type };
}
