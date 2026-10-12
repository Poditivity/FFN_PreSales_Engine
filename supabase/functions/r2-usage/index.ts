// r2-usage — staff-only. Adds up the size of every object in the R2 bucket for
// the Settings page, over the same S3-compatible API the uploads use (it needs
// the same API token: Object Read & Write covers listing).
//
// Listing is paged at 1,000 objects, so the total is kept in app_settings and
// reused for ten minutes. A caller can ask for a fresh count with
// { "refresh": true }. A bucket past MAX_PAGES pages is reported as a lower
// bound (`truncated: true`) rather than left to time out.
//
// Secrets: R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
// R2_PUBLIC_BASE_URL (same as r2-presign), and optionally R2_STORAGE_LIMIT_GB.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireStaff } from "../_shared/adminAuth.ts";
import { parseListPage, presignListUrl } from "../_shared/r2Objects.ts";
import type { R2Config } from "../_shared/r2Presign.ts";

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

const REQUIRED = ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const;
const CACHE_SECONDS = 10 * 60;
const MAX_PAGES = 200;

function limitGb(): number | null {
  const n = Number(Deno.env.get("R2_STORAGE_LIMIT_GB"));
  return Number.isFinite(n) && n > 0 ? n : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const caller = await requireStaff(req, admin);
  if (!caller.ok) return json({ error: "Staff authentication required" }, 401);

  const missing = REQUIRED.filter((name) => !Deno.env.get(name));
  if (missing.length > 0) return json({ error: "Cloudflare R2 is not connected yet.", code: "not_configured", missing }, 503);

  let refresh = false;
  try {
    refresh = (await req.json())?.refresh === true;
  } catch {
    // no body is fine
  }

  const { data: cached } = await admin
    .from("app_settings")
    .select("r2_used_bytes, r2_object_count, r2_checked_at, r2_truncated")
    .eq("id", true)
    .maybeSingle();

  const age = cached?.r2_checked_at ? (Date.now() - new Date(cached.r2_checked_at).getTime()) / 1000 : Infinity;
  if (!refresh && cached?.r2_used_bytes != null && age < CACHE_SECONDS) {
    return json({
      usedBytes: Number(cached.r2_used_bytes),
      objects: Number(cached.r2_object_count ?? 0),
      checkedAt: cached.r2_checked_at,
      truncated: !!cached.r2_truncated,
      limitGb: limitGb(),
      cached: true,
    });
  }

  const config: R2Config = {
    accountId: Deno.env.get("R2_ACCOUNT_ID")!,
    bucket: Deno.env.get("R2_BUCKET")!,
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
    publicBaseUrl: Deno.env.get("R2_PUBLIC_BASE_URL") ?? "https://example.invalid",
  };

  let bytes = 0;
  let objects = 0;
  let token: string | null = null;
  let truncated = false;
  try {
    for (let page = 0; ; page++) {
      if (page >= MAX_PAGES) {
        truncated = true;
        break;
      }
      const res = await fetch(await presignListUrl(config, token));
      if (!res.ok) {
        return json({ error: `Cloudflare refused the request (${res.status}). Check the R2 API token.`, code: "r2_error" }, 502);
      }
      const parsed = parseListPage(await res.text());
      bytes += parsed.bytes;
      objects += parsed.objects;
      token = parsed.nextToken;
      if (!token) break;
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not read the bucket.", code: "r2_error" }, 502);
  }

  const checkedAt = new Date().toISOString();
  await admin
    .from("app_settings")
    .update({ r2_used_bytes: bytes, r2_object_count: objects, r2_checked_at: checkedAt, r2_truncated: truncated })
    .eq("id", true);

  return json({ usedBytes: bytes, objects, checkedAt, truncated, limitGb: limitGb(), cached: false });
});
