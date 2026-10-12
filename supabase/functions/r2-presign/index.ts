// r2-presign — staff-only. Hands the browser a short-lived presigned PUT URL
// for Cloudflare R2, so an image goes straight from the browser to the bucket
// and never through this project. The response also carries the public URL the
// image will be served from; that is the value the admin stores on the record.
//
// Secrets (Supabase Function secrets, never NEXT_PUBLIC_):
//   R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
//   R2_PUBLIC_BASE_URL   the bucket's public address: custom domain or r2.dev
//
// All signing and validation lives in ../_shared/r2Presign.ts, which is what the
// Vitest suite exercises.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireStaff } from "../_shared/adminAuth.ts";
import { createImageUpload, validateUploadRequest, type R2Config } from "../_shared/r2Presign.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const REQUIRED = ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_BASE_URL"] as const;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const caller = await requireStaff(req, admin);
  if (!caller.ok) return json({ error: "Staff authentication required" }, 401);

  // Names only, never values.
  const missing = REQUIRED.filter((name) => !Deno.env.get(name));
  if (missing.length > 0) {
    return json({ error: "Uploads are not set up yet.", code: "not_configured", missing }, 503);
  }

  let body: { folder?: string; contentType?: string; size?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Send a JSON body." }, 400);
  }

  const problem = validateUploadRequest(body);
  if (problem) return json({ error: problem, code: "invalid_request" }, 400);

  const config: R2Config = {
    accountId: Deno.env.get("R2_ACCOUNT_ID")!,
    bucket: Deno.env.get("R2_BUCKET")!,
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
    publicBaseUrl: Deno.env.get("R2_PUBLIC_BASE_URL")!,
  };

  try {
    const upload = await createImageUpload(config, { folder: body.folder!, contentType: body.contentType!, size: body.size! });
    return json(upload);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not prepare the upload.", code: "presign_failed" }, 500);
  }
});
