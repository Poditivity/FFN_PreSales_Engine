// digest-dispatch — scheduled (pg_cron, every 5 minutes). Sends the daily and
// weekly digests to Google Chat and by email once their time on the Settings page
// has passed, and records each in digest_log so a period is sent once.
//
//   Daily   today so far (midnight IST to now): leads received, applicant hubs
//           sent, calls made by outcome.
//   Weekly  the seven complete days before today, set against the seven before:
//           leads received, moves into every stage, hubs sent, hub open rate,
//           calls by outcome, and the Attention needed counts, with the
//           direction of each.
//
// Secrets: GOOGLE_CHAT_WEBHOOK_URL (optional; email still goes out without it),
// SITE_URL (optional; used for the dashboard link), plus the mail secrets.
// Scheduled caller: pg_cron, with the database's cron token (see _shared/cronAuth.ts).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isServiceCall } from "../_shared/cronAuth.ts";
import {
  buildDailyDigest,
  buildWeeklyDigest,
  type Digest,
  normalizeAttention,
  normalizeMetrics,
} from "../_shared/digest.ts";
import { postToGoogleChat } from "../_shared/googleChat.ts";
import { notify } from "../_shared/notify.ts";
import { type DigestSettings, dueDigests, type DueDigest, istNow, movedLater, shortDate, weekRangeLabel } from "../_shared/schedule.ts";
import { loadTeamRecipients } from "../_shared/teamRecipients.ts";

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

/**
 * A failed digest is retried on later runs, up to this many attempts, ten minutes
 * apart. A run that died mid-send leaves its row "sending"; after fifteen minutes
 * that counts as failed.
 */
const MAX_ATTEMPTS = 3;
const RETRY_AFTER_MS = 10 * 60 * 1000;
const STUCK_AFTER_MS = 15 * 60 * 1000;

type Claim = { attempts: number } | null;

/**
 * Claims a period so two runs cannot both send it. Null means it is sent, in
 * flight, or out of attempts. A period already sent is claimed again when the time
 * on Settings has been moved later than the time it went out for.
 */
async function claim(admin: SupabaseClient, due: DueDigest): Promise<Claim> {
  const { data: inserted } = await admin
    .from("digest_log")
    .upsert({ kind: due.kind, period_start: due.periodStart, scheduled_time: due.scheduledTime }, { onConflict: "kind,period_start", ignoreDuplicates: true })
    .select("attempts");
  if (inserted && inserted.length > 0) return { attempts: 1 };

  const { data: row } = await admin
    .from("digest_log")
    .select("status, attempts, updated_at, scheduled_time")
    .eq("kind", due.kind)
    .eq("period_start", due.periodStart)
    .maybeSingle();
  if (!row) return null;

  if (row.status === "sent") {
    if (!movedLater(row.scheduled_time, due.scheduledTime)) return null;
    // Only one of two racing runs wins this update.
    const { data: rearmed } = await admin
      .from("digest_log")
      .update({ status: "sending", attempts: 1, scheduled_time: due.scheduledTime })
      .eq("kind", due.kind)
      .eq("period_start", due.periodStart)
      .eq("status", "sent")
      .eq("scheduled_time", row.scheduled_time)
      .select("attempts");
    return rearmed && rearmed.length > 0 ? { attempts: 1 } : null;
  }
  if (row.attempts >= MAX_ATTEMPTS) return null;
  const idleMs = Date.now() - new Date(row.updated_at).getTime();
  if (idleMs < (row.status === "failed" ? RETRY_AFTER_MS : STUCK_AFTER_MS)) return null;

  // Only one of two racing runs wins this update.
  const { data: reclaimed } = await admin
    .from("digest_log")
    .update({ status: "sending", attempts: row.attempts + 1 })
    .eq("kind", due.kind)
    .eq("period_start", due.periodStart)
    .eq("status", row.status)
    .eq("attempts", row.attempts)
    .select("attempts");
  return reclaimed && reclaimed.length > 0 ? { attempts: row.attempts + 1 } : null;
}

async function deliver(admin: SupabaseClient, digest: Digest, type: "ADMIN_DAILY_DIGEST" | "ADMIN_WEEKLY_DIGEST", source: string) {
  const chat = await postToGoogleChat(Deno.env.get("GOOGLE_CHAT_WEBHOOK_URL"), digest.chatText);
  if (chat.status === "failed") console.error(`[${source}] google chat:`, chat.error);

  const recipients = await loadTeamRecipients(admin);
  let emailsSent = 0;
  for (const recipient of recipients) {
    const { email } = await notify({
      type,
      recipient,
      source,
      email: { subject: digest.subject, html: digest.html },
      data: {},
    });
    if (email.ok) emailsSent += 1;
    else console.error(`[${source}] email:`, email.error);
  }
  return { chat, emailsSent, recipients: recipients.length };
}

async function metricsFor(admin: SupabaseClient, from: Date, to: Date) {
  const { data, error } = await admin.rpc("digest_metrics", { p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) throw new Error(error.message);
  return normalizeMetrics(data);
}

async function sendOne(admin: SupabaseClient, due: DueDigest, siteUrl: string) {
  let digest: Digest;
  let attention: Record<string, number> | null = null;

  if (due.kind === "daily") {
    const metrics = await metricsFor(admin, due.from, due.to);
    const ist = istNow(due.to);
    const hh = String(Math.floor(ist.minutes / 60)).padStart(2, "0");
    const mm = String(ist.minutes % 60).padStart(2, "0");
    digest = buildDailyDigest({ dateLabel: shortDate(due.periodStart), untilLabel: `${hh}:${mm} IST`, metrics, siteUrl });
  } else {
    const [current, previous, attentionRaw, { data: last }] = await Promise.all([
      metricsFor(admin, due.from, due.to),
      metricsFor(admin, due.previousFrom!, due.previousTo!),
      admin.rpc("digest_attention"),
      admin
        .from("digest_log")
        .select("attention")
        .eq("kind", "weekly")
        .eq("status", "sent")
        .lt("period_start", due.periodStart)
        .order("period_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (attentionRaw.error) throw new Error(attentionRaw.error.message);
    const now = normalizeAttention(attentionRaw.data);
    attention = now;
    digest = buildWeeklyDigest({
      rangeLabel: weekRangeLabel(due.from, due.to),
      current,
      previous,
      attention: now,
      previousAttention: last?.attention ? normalizeAttention(last.attention) : null,
      siteUrl,
    });
  }

  const source = due.kind === "daily" ? "digest-daily" : "digest-weekly";
  const result = await deliver(admin, digest, due.kind === "daily" ? "ADMIN_DAILY_DIGEST" : "ADMIN_WEEKLY_DIGEST", source);
  return { ...result, attention };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (!(await isServiceCall(req, admin))) return json({ error: "Not allowed" }, 401);

  const { data: settings } = await admin
    .from("app_settings")
    .select("daily_digest_enabled, daily_digest_time, weekly_digest_enabled, weekly_digest_day, weekly_digest_time")
    .eq("id", true)
    .maybeSingle();
  if (!settings) return json({ ok: true, skipped: "No settings row" });

  const siteUrl = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");
  const sent: string[] = [];
  const failed: string[] = [];

  for (const due of dueDigests(new Date(), settings as DigestSettings)) {
    const claimed = await claim(admin, due);
    if (!claimed) continue;

    try {
      const result = await sendOne(admin, due, siteUrl);
      const ok = result.chat.ok || result.emailsSent > 0;
      await admin
        .from("digest_log")
        .update({
          status: ok ? "sent" : "failed",
          chat_status: result.chat.status,
          emails_sent: result.emailsSent,
          attention: result.attention,
        })
        .eq("kind", due.kind)
        .eq("period_start", due.periodStart);
      (ok ? sent : failed).push(`${due.kind}:${due.periodStart}`);
    } catch (e) {
      console.error(`[digest-dispatch] ${due.kind}:`, e instanceof Error ? e.message : e);
      await admin.from("digest_log").update({ status: "failed" }).eq("kind", due.kind).eq("period_start", due.periodStart);
      failed.push(`${due.kind}:${due.periodStart}`);
    }
  }

  return json({ ok: failed.length === 0, sent, failed });
});
