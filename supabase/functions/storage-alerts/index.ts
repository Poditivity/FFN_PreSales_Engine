// storage-alerts — scheduled (pg_cron, once a day). Emails the super admins when
// the Supabase database passes 0.4 GB or the Cloudflare R2 bucket passes 9 GB:
// one email a day for three days, then nothing until usage has dropped back under
// the line and climbed over it again. Rules live in ../_shared/storageAlerts.ts.
//
// Secrets: the R2 ones the r2-usage function uses (when they are missing, R2 is
// skipped and the database is still checked), SITE_URL (optional; for the link),
// plus the mail secrets.
// Scheduled caller: pg_cron, with the database's cron token (see _shared/cronAuth.ts).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isServiceCall } from "../_shared/cronAuth.ts";
import { sendEmail } from "../_shared/email.ts";
import { parseListPage, presignListUrl } from "../_shared/r2Objects.ts";
import type { R2Config } from "../_shared/r2Presign.ts";
import { buildStorageAlert, decideAlert, istDate, STORAGE_LIMITS, type StorageKind } from "../_shared/storageAlerts.ts";

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

const BYTES_PER_GB = 1024 ** 3;
const MAX_PAGES = 200;
const R2_SECRETS = ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const;

function isActive(bannedUntil: string | null | undefined): boolean {
  return !bannedUntil || new Date(bannedUntil).getTime() <= Date.now();
}

/** Every active super admin, once each. */
async function loadSuperAdmins(admin: SupabaseClient): Promise<{ email: string; ref: string }[]> {
  const { data } = await admin.from("profiles").select("id, email").eq("is_super_admin", true);
  const out: { email: string; ref: string }[] = [];
  for (const row of (data ?? []) as { id: string; email: string | null }[]) {
    const email = (row.email ?? "").trim();
    if (!email || out.some((r) => r.email.toLowerCase() === email.toLowerCase())) continue;
    const { data: authUser } = await admin.auth.admin.getUserById(row.id);
    if (isActive(authUser?.user?.banned_until)) out.push({ email, ref: row.id });
  }
  return out;
}

async function databaseGb(admin: SupabaseClient): Promise<number | null> {
  const { data, error } = await admin.rpc("database_size_bytes");
  if (error || data == null) {
    console.error("[storage-alerts] database size:", error?.message);
    return null;
  }
  return Number(data) / BYTES_PER_GB;
}

async function r2Gb(): Promise<number | null> {
  if (R2_SECRETS.some((name) => !Deno.env.get(name))) return null;
  const config: R2Config = {
    accountId: Deno.env.get("R2_ACCOUNT_ID")!,
    bucket: Deno.env.get("R2_BUCKET")!,
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
    publicBaseUrl: Deno.env.get("R2_PUBLIC_BASE_URL") ?? "https://example.invalid",
  };
  let bytes = 0;
  let token: string | null = null;
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await fetch(await presignListUrl(config, token));
      if (!res.ok) {
        console.error(`[storage-alerts] r2 list refused (${res.status})`);
        return null;
      }
      const parsed = parseListPage(await res.text());
      bytes += parsed.bytes;
      token = parsed.nextToken;
      if (!token) break;
    }
  } catch (e) {
    console.error("[storage-alerts] r2:", e instanceof Error ? e.message : e);
    return null;
  }
  return bytes / BYTES_PER_GB;
}

async function handle(admin: SupabaseClient, kind: StorageKind, usedGb: number, today: string, siteUrl: string) {
  const { warnAtGb } = STORAGE_LIMITS[kind];
  const { data: row } = await admin.from("storage_alert_state").select("days_sent, last_sent_on").eq("kind", kind).maybeSingle();
  const state = { daysSent: row?.days_sent ?? 0, lastSentOn: (row?.last_sent_on as string | null) ?? null };

  const decision = decideAlert(usedGb, warnAtGb, state, today);
  if (decision === "reset") {
    await admin.from("storage_alert_state").update({ days_sent: 0, last_sent_on: null, updated_at: new Date().toISOString() }).eq("kind", kind);
    return "reset";
  }
  if (decision === "skip") return "skip";

  // Claim today so two overlapping runs cannot both send. Only one update matches.
  const { data: claimed } = await admin
    .from("storage_alert_state")
    .update({ days_sent: state.daysSent + 1, last_sent_on: today, updated_at: new Date().toISOString() })
    .eq("kind", kind)
    .eq("days_sent", state.daysSent)
    .select("days_sent");
  if (!claimed || claimed.length === 0) return "skip";

  const recipients = await loadSuperAdmins(admin);
  const alert = buildStorageAlert(kind, usedGb, state.daysSent + 1, siteUrl);
  let delivered = 0;
  for (const recipient of recipients) {
    const result = await sendEmail(recipient.email, alert.subject, alert.html, undefined, "storage-alerts");
    if (result.ok) delivered += 1;
    else console.error("[storage-alerts] email:", result.error);
  }

  // Nobody got it, so do not use up one of the three days.
  if (delivered === 0) {
    await admin
      .from("storage_alert_state")
      .update({ days_sent: state.daysSent, last_sent_on: state.lastSentOn, updated_at: new Date().toISOString() })
      .eq("kind", kind);
    return "failed";
  }
  return `sent:${delivered}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (!(await isServiceCall(req, admin))) return json({ error: "Not allowed" }, 401);

  const today = istDate(new Date());
  const siteUrl = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");
  const result: Record<string, string> = {};

  const readings: [StorageKind, number | null][] = [
    ["database", await databaseGb(admin)],
    ["r2", await r2Gb()],
  ];
  for (const [kind, usedGb] of readings) {
    result[kind] = usedGb === null ? "unavailable" : await handle(admin, kind, usedGb, today, siteUrl);
  }
  return json({ ok: true, result });
});
