// form-upload-presign — called from the public form. Hands the browser a
// short-lived presigned PUT URL for Cloudflare R2, so an applicant's file goes
// straight from their browser to the bucket and never through this project.
//
// This is the public counterpart to r2-presign (staff only), so it trusts
// nothing in the request except which form and which question it is about:
//   * the form must exist and be active (staff may also test a draft);
//   * the question must be a file question on that form, and the types and the
//     size are the ones the team set on it, held to the hard limits in
//     ../_shared/uploadRules.ts;
//   * the object key is chosen here, never by the caller;
//   * a session and a form can only start so many uploads an hour.
//
// Secrets (Supabase Function secrets): R2_ACCOUNT_ID, R2_BUCKET,
// R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_BASE_URL (same as r2-presign).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireStaff } from "../_shared/adminAuth.ts";
import { createFormFileUpload } from "../_shared/r2Objects.ts";
import type { R2Config } from "../_shared/r2Presign.ts";
import { checkFormFile, findSchemaField, normalizeFileConfig } from "../_shared/uploadRules.ts";

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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Uploads one session may start in an hour, and uploads one form may receive in an hour. */
const SESSION_HOURLY_LIMIT = 10;
const FORM_HOURLY_LIMIT = 300;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { formId?: unknown; fieldId?: unknown; sessionId?: unknown; contentType?: unknown; size?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Send a JSON body." }, 400);
  }

  const formId = String(body.formId ?? "");
  const fieldId = String(body.fieldId ?? "");
  const sessionId = String(body.sessionId ?? "").slice(0, 100);
  const contentType = String(body.contentType ?? "");
  const size = Number(body.size);
  if (!UUID.test(formId) || !fieldId || !sessionId) return json({ error: "Missing form or question.", code: "invalid_request" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: form } = await admin.from("forms").select("id, status, schema").eq("id", formId).maybeSingle();
  if (!form) return json({ error: "This form was not found.", code: "not_found" }, 404);

  const staff = (await requireStaff(req, admin)).ok;
  if (form.status !== "active" && !staff) return json({ error: "This form is not accepting uploads.", code: "closed" }, 403);

  const field = findSchemaField(form.schema, fieldId);
  if (!field || field.type !== "file") return json({ error: "That question does not take a file.", code: "invalid_request" }, 400);

  const fileConfig = normalizeFileConfig(field.fileConfig);

  const problem = checkFormFile(fileConfig, { contentType, size });
  if (problem) return json({ error: problem, code: "invalid_request" }, 400);

  // Names only, never values.
  const missing = REQUIRED.filter((name) => !Deno.env.get(name));
  if (missing.length > 0) {
    return json({ error: "Uploads are not set up yet.", code: "not_configured", missing }, 503);
  }

  if (!staff) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [{ count: sessionCount }, { count: formCount }] = await Promise.all([
      admin.from("form_upload_log").select("id", { count: "exact", head: true }).eq("session_id", sessionId).gte("created_at", since),
      admin.from("form_upload_log").select("id", { count: "exact", head: true }).eq("form_id", formId).gte("created_at", since),
    ]);
    if ((sessionCount ?? 0) >= SESSION_HOURLY_LIMIT || (formCount ?? 0) >= FORM_HOURLY_LIMIT) {
      return json({ error: "Too many uploads. Try again in a little while.", code: "rate_limited" }, 429);
    }
  }

  const config: R2Config = {
    accountId: Deno.env.get("R2_ACCOUNT_ID")!,
    bucket: Deno.env.get("R2_BUCKET")!,
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
    publicBaseUrl: Deno.env.get("R2_PUBLIC_BASE_URL")!,
  };

  try {
    const upload = await createFormFileUpload(config, { formId, contentType, size, fileConfig });
    await admin.from("form_upload_log").insert({
      form_id: formId,
      field_id: fieldId,
      session_id: sessionId,
      object_key: upload.key,
      content_type: contentType,
      size_bytes: Math.round(size),
    });
    return json({ uploadUrl: upload.uploadUrl, headers: upload.headers, publicUrl: upload.publicUrl, expiresIn: upload.expiresIn });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not prepare the upload.", code: "presign_failed" }, 500);
  }
});
