import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { readFunctionError } from "@/lib/supabase/functionError";
import {
  checkFormFile,
  resolveContentType,
  type FileFieldConfig,
} from "../../../supabase/functions/_shared/uploadRules";

export interface FormFileUpload {
  formId: string;
  fieldId: string;
  /** The applicant's form session, so the server can limit uploads per session. */
  sessionId: string;
  file: File;
  config: FileFieldConfig;
}

interface PresignResponse {
  uploadUrl: string;
  headers: Record<string, string>;
  publicUrl: string;
}

const MESSAGES: Record<string, string> = {
  not_configured: "File uploads are not set up yet. Tell the team, or email your file to them instead.",
  rate_limited: "Too many uploads. Try again in a little while.",
  closed: "This form is not accepting uploads.",
};

/**
 * Uploads one file for a form's file question straight to R2 and returns the
 * public URL to keep as the answer. The file goes browser to bucket on a
 * short-lived presigned URL; it never passes through this app or Supabase.
 * The file is checked here for a quick answer and again by the server, which is
 * the check that counts.
 */
export async function uploadFormFile({ formId, fieldId, sessionId, file, config }: FormFileUpload): Promise<string> {
  const contentType = resolveContentType(file);
  const problem = checkFormFile(config, { contentType, size: file.size });
  if (problem) throw new Error(problem);

  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.functions.invoke("form-upload-presign", {
    body: { formId, fieldId, sessionId, contentType, size: file.size },
  });
  if (error) {
    const { message, code } = await readFunctionError(error);
    throw new Error((code && MESSAGES[code]) || message || "Could not start the upload. Try again.");
  }
  const upload = data as PresignResponse | null;
  if (!upload?.uploadUrl || !upload?.publicUrl) throw new Error("Could not start the upload. Try again.");

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
