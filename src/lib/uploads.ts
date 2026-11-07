// Validated image uploads to Cloud Storage. Validation runs here for fast feedback,
// and storage.rules enforce the same type and size limits on the server.
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getStorageClient } from "./firebase";
import { validateImageFile } from "./utils";

/**
 * Uploads an image into `folder` (for example "businesses/{uid}" or "site") and
 * returns its public download URL.
 */
export async function uploadImage(file: File, folder: string): Promise<string> {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);

  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60);
  const path = `${folder}/${Date.now()}-${safeName}`;
  const fileRef = ref(getStorageClient(), path);
  await uploadBytes(fileRef, file, { contentType: file.type, cacheControl: "public,max-age=3600" });
  return getDownloadURL(fileRef);
}
