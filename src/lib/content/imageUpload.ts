import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { IMAGE_MAX_BYTES, IMAGE_TYPES, type UploadFolder } from "../../../supabase/functions/_shared/r2Presign";

export { IMAGE_MAX_BYTES, IMAGE_TYPES };
export type { UploadFolder };

/** What the file picker offers. Kept in step with the types the edge function accepts. */
export const IMAGE_ACCEPT = Object.keys(IMAGE_TYPES).join(",");

/** Whether a file is one the bucket accepts, and if not, the sentence to show. */
export function checkImageFile(file: { type: string; size: number }): string | null {
  if (!(file.type in IMAGE_TYPES)) return "Choose a JPEG, PNG, WebP or GIF image.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > IMAGE_MAX_BYTES) return "That image is over 5 MB. Make it smaller and try again.";
  return null;
}

interface PresignResponse {
  uploadUrl: string;
  headers: Record<string, string>;
  publicUrl: string;
}

export const NOT_CONFIGURED_MESSAGE = "Uploads are not set up yet. Paste a link to the image instead.";

async function requestUpload(folder: UploadFolder, file: File): Promise<PresignResponse> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.functions.invoke("r2-presign", {
    body: { folder, contentType: file.type, size: file.size },
  });

  if (error) {
    // supabase-js hides the JSON body of a non-2xx reply inside error.context.
    const context = (error as { context?: Response }).context;
    const body = context && typeof context.json === "function" ? await context.json().catch(() => null) : null;
    if (body?.code === "not_configured") throw new Error(NOT_CONFIGURED_MESSAGE);
    throw new Error(body?.error ?? "Could not start the upload. Try again.");
  }
  if (!data?.uploadUrl || !data?.publicUrl) throw new Error("Could not start the upload. Try again.");
  return data as PresignResponse;
}

/**
 * Uploads an image straight to R2 and returns the public URL to store on the
 * record. The file goes browser to bucket on a short-lived presigned URL; it
 * never passes through this app or Supabase.
 */
export async function uploadImage(folder: UploadFolder, file: File): Promise<string> {
  const problem = checkImageFile(file);
  if (problem) throw new Error(problem);

  const upload = await requestUpload(folder, file);

  let res: Response;
  try {
    res = await fetch(upload.uploadUrl, { method: "PUT", headers: upload.headers, body: file });
  } catch {
    // A network failure, or a bucket CORS rule that does not allow this origin.
    throw new Error("The upload did not finish. Check your connection and try again.");
  }
  if (!res.ok) throw new Error(`The upload was refused (${res.status}). Try again.`);

  return upload.publicUrl;
}
