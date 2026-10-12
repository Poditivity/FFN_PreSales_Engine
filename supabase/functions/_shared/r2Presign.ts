// Presigned PUT URLs for Cloudflare R2's S3-compatible API (AWS Signature
// Version 4, query-string signing). Pure TypeScript on Web Crypto with no Deno
// or Node imports, so the r2-presign edge function and the Vitest suite run
// exactly the same code.
//
// Object keys are decided here, never by the caller: a caller picks one of a
// fixed set of folders and a content type, and the key is folder/uuid.ext. A
// file name from the browser never reaches the bucket, so there is nothing to
// traverse, overwrite or collide with. Form uploads and bucket listing, which build
// on this file, are in ./r2Objects.ts.

export const UPLOAD_FOLDERS = [
  "founders/photos",
  "founders/logos",
  "mentors/photos",
  "collections/images",
  "hubs/sections",
] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Every object is keyed by a fresh uuid, so a cached copy can never go stale. */
export const IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export interface UploadRequest {
  folder: string;
  contentType: string;
  size: number;
}

/** The sentence to show when a request is not acceptable, or null when it is. */
export function validateUploadRequest(req: Partial<UploadRequest>): string | null {
  if (!req.folder || !(UPLOAD_FOLDERS as readonly string[]).includes(req.folder)) return "Unknown upload folder.";
  if (!req.contentType || !(req.contentType in IMAGE_TYPES)) return "Choose a JPEG, PNG, WebP or GIF image.";
  if (typeof req.size !== "number" || !Number.isFinite(req.size) || req.size <= 0) return "That file is empty.";
  if (req.size > IMAGE_MAX_BYTES) return "That image is over 5 MB. Make it smaller and try again.";
  return null;
}

export function buildObjectKey(folder: UploadFolder, contentType: string, id: string): string {
  const ext = IMAGE_TYPES[contentType];
  if (!ext) throw new Error(`Unsupported content type: ${contentType}`);
  return `${folder}/${id}.${ext}`;
}

/**
 * The URL a browser loads the object from. `base` is the bucket's public
 * address: a custom domain, or the r2.dev address if that is what is enabled.
 * Storing this, and never the bare key, means nothing has to translate a key
 * later.
 */
export function publicUrlFor(base: string, key: string): string {
  const url = new URL(base);
  if (url.protocol !== "https:") throw new Error("R2_PUBLIC_BASE_URL must start with https://");
  const trimmed = url.href.replace(/\/+$/, "");
  return `${trimmed}/${key.split("/").map(encodeRfc3986).join("/")}`;
}

// ---------------------------------------------------------------------------
// SigV4
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(message: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(message)));
}

async function hmac(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message)));
}

export interface PresignInput {
  method: "GET" | "PUT";
  host: string;
  /** Absolute path, starting with "/". Each segment is encoded here. */
  path: string;
  region: string;
  service?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Seconds, 1 to 604800. */
  expiresIn: number;
  now: Date;
  /** Headers the caller must send unchanged. They are part of the signature. */
  headers?: Record<string, string>;
  /** Extra query parameters, for example a bucket listing's `list-type`. They are signed. */
  query?: Record<string, string>;
}

/** Returns the full presigned URL. Pure: the same input always gives the same URL. */
export async function presignUrl(input: PresignInput): Promise<string> {
  const { method, host, region, accessKeyId, secretAccessKey, expiresIn, now } = input;
  const service = input.service ?? "s3";
  if (!(expiresIn >= 1 && expiresIn <= 604800)) throw new Error("expiresIn must be between 1 and 604800 seconds");

  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;

  const headers: Record<string, string> = { host };
  for (const [name, value] of Object.entries(input.headers ?? {})) headers[name.toLowerCase()] = value.trim();
  const signedNames = Object.keys(headers).sort();
  const signedHeaders = signedNames.join(";");

  const query: Record<string, string> = {
    ...(input.query ?? {}),
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(query[k])}`)
    .join("&");

  const canonicalUri = input.path
    .split("/")
    .map((segment) => encodeRfc3986(segment))
    .join("/");
  const canonicalHeaders = signedNames.map((n) => `${n}:${headers[n]}\n`).join("");
  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");

  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonicalRequest)].join("\n");

  let key = await hmac(encoder.encode(`AWS4${secretAccessKey}`), dateStamp);
  key = await hmac(key, region);
  key = await hmac(key, service);
  key = await hmac(key, "aws4_request");
  const signature = toHex(await hmac(key, stringToSign));

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export interface R2Config {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
}

export interface PresignedUpload {
  uploadUrl: string;
  /** Headers the browser must send with the PUT, exactly as given. */
  headers: Record<string, string>;
  key: string;
  publicUrl: string;
  expiresIn: number;
}

export const UPLOAD_URL_TTL_SECONDS = 300;

export async function createImageUpload(
  config: R2Config,
  req: UploadRequest,
  options: { id?: string; now?: Date } = {},
): Promise<PresignedUpload> {
  const problem = validateUploadRequest(req);
  if (problem) throw new Error(problem);

  const key = buildObjectKey(req.folder as UploadFolder, req.contentType, options.id ?? crypto.randomUUID());
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
