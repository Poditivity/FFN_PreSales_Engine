// Form file uploads and bucket usage, built on the signing in ./r2Presign.ts.
// Kept in its own file because the Next app imports r2Presign.ts directly, and
// the Deno-style ".ts" import below is not something the app's type check takes.
// The form-upload-presign and r2-usage edge functions and Vitest import this one.

import { IMAGE_CACHE_CONTROL, presignUrl, publicUrlFor, UPLOAD_URL_TTL_SECONDS, type PresignedUpload, type R2Config } from "./r2Presign.ts";
import { buildFormFileKey, checkFormFile, type FileFieldConfig } from "./uploadRules.ts";

export interface FormFileUploadRequest {
  formId: string;
  contentType: string;
  size: number;
  /** The rules for this field, already clamped to the workspace limit. */
  fileConfig: FileFieldConfig;
}

/** A presigned PUT for one file on a form. Throws the sentence to show when the file is not acceptable. */
export async function createFormFileUpload(
  config: R2Config,
  req: FormFileUploadRequest,
  options: { id?: string; now?: Date } = {},
): Promise<PresignedUpload> {
  const problem = checkFormFile(req.fileConfig, req);
  if (problem) throw new Error(problem);

  const key = buildFormFileKey(req.formId, req.contentType, options.id ?? crypto.randomUUID(), req.fileConfig);
  const headers = { "Content-Type": req.contentType, "Cache-Control": IMAGE_CACHE_CONTROL };
  const uploadUrl = await presignUrl({
    method: "PUT",
    host: `${config.accountId}.r2.cloudflarestorage.com`,
    path: `/${config.bucket}/${key}`,
    region: "auto",
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    expiresIn: UPLOAD_URL_TTL_SECONDS,
    now: options.now ?? new Date(),
    headers,
  });
  return { uploadUrl, headers, key, publicUrl: publicUrlFor(config.publicBaseUrl, key), expiresIn: UPLOAD_URL_TTL_SECONDS };
}

// ---------------------------------------------------------------------------
// Bucket usage: ListObjectsV2, summed
// ---------------------------------------------------------------------------

export interface ListPage {
  bytes: number;
  objects: number;
  nextToken: string | null;
}

/** Reads one ListObjectsV2 reply. Only the sizes and the continuation token matter here. */
export function parseListPage(xml: string): ListPage {
  let bytes = 0;
  let objects = 0;
  for (const match of xml.matchAll(/<Contents>[\s\S]*?<Size>(\d+)<\/Size>[\s\S]*?<\/Contents>/g)) {
    bytes += Number(match[1]);
    objects += 1;
  }
  const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
  const token = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? null;
  return { bytes, objects, nextToken: truncated && token ? decodeXml(token) : null };
}

function decodeXml(value: string): string {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

export async function presignListUrl(config: R2Config, token: string | null, now: Date = new Date()): Promise<string> {
  const query: Record<string, string> = { "list-type": "2", "max-keys": "1000" };
  if (token) query["continuation-token"] = token;
  return presignUrl({
    method: "GET",
    host: `${config.accountId}.r2.cloudflarestorage.com`,
    path: `/${config.bucket}`,
    region: "auto",
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    expiresIn: 60,
    now,
    query,
  });
}
