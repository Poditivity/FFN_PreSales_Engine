import { createBrowserSupabaseClient } from "@/lib/supabase/client";

// A case study is a PDF. Where that PDF lives decides how the hub can show it:
//   - "pdf":   a direct PDF file, which includes every upload to the case-studies
//              bucket. The hub renders it itself, so it can track pages read.
//   - "drive": a Google Drive file link. Drive will not let another site read the
//              file, so the hub embeds Drive's own viewer and can track time only.
//   - "other": anything else. Not accepted for a new case study.
export type CaseStudySource = "pdf" | "drive" | "other";

export const CASE_STUDY_BUCKET = "case-studies";
export const CASE_STUDY_MAX_BYTES = 25 * 1024 * 1024;

const DRIVE_FILE = /^https:\/\/drive\.google\.com\/file\/d\/([\w-]+)/i;

function parse(url: string | null | undefined): URL | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed : null;
  } catch {
    return null;
  }
}

export function caseStudySource(url: string | null | undefined): CaseStudySource | null {
  const parsed = parse(url);
  if (!parsed) return null;
  if (DRIVE_FILE.test(parsed.href)) return "drive";
  if (parsed.pathname.toLowerCase().endsWith(".pdf")) return "pdf";
  return "other";
}

/** Google Drive's own viewer for a file link, which is the only form Drive lets a page embed. */
export function driveEmbedUrl(url: string): string | null {
  const id = DRIVE_FILE.exec(url.trim())?.[1];
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}

/** The file name a person would recognise, taken from the end of the link. */
export function pdfFileName(url: string | null | undefined): string | null {
  const parsed = parse(url);
  if (!parsed) return null;
  if (DRIVE_FILE.test(parsed.href)) return "PDF on Google Drive";
  const last = decodeURIComponent(parsed.pathname.split("/").pop() ?? "");
  return last || null;
}

/** Whether a file is one this bucket accepts, and if not, the sentence to show. */
export function checkPdfFile(file: { type: string; name: string; size: number }): string | null {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "Choose a PDF file.";
  if (file.size > CASE_STUDY_MAX_BYTES) return "That file is over 25 MB. Compress it and try again.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

/** Uploads a PDF and returns the public link the hub reads it from. */
export async function uploadCaseStudyPdf(file: File): Promise<string> {
  const problem = checkPdfFile(file);
  if (problem) throw new Error(problem);
  const supabase = createBrowserSupabaseClient();
  const path = `${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage
    .from(CASE_STUDY_BUCKET)
    .upload(path, file, { contentType: "application/pdf", cacheControl: "31536000", upsert: false });
  if (error) throw error;
  return supabase.storage.from(CASE_STUDY_BUCKET).getPublicUrl(path).data.publicUrl;
}
