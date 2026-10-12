// _shared/email.ts — shared by every mail-sending edge function.
//
// All brand/config constants come from env vars (Supabase Edge Function
// secrets), never from source code:
//   FROM_ADDRESS    = Deno.env.get('FROM_ADDRESS')    ?? ''   // e.g. no-reply@foundersfirst.network
//   FROM_NAME       = Deno.env.get('FROM_NAME')       ?? ''   // e.g. Founders First Network
//   SENDING_DOMAIN  = Deno.env.get('SENDING_DOMAIN')  ?? ''   // e.g. foundersfirst.network
//   ZEPTOMAIL_TOKEN = Deno.env.get('ZEPTOMAIL_TOKEN') ?? ''
//   ZEPTOMAIL_HOST  = Deno.env.get('ZEPTOMAIL_HOST')  ?? 'api.zeptomail.in'
//   REPLY_TO_ADDRESS = Deno.env.get('REPLY_TO_ADDRESS') ?? ''  // e.g. team@foundersfirst.network
//
// Inbox placement: every message goes out with a plain-text part next to the
// HTML, without open-tracking pixels or click-tracking redirects, and with a
// reply-to a person reads when REPLY_TO_ADDRESS is set. Mail that is HTML-only,
// tracked and unanswerable is what Gmail files as bulk (Promotions or spam).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emailDocumentToText } from "./messageText.ts";
import { isReservedTestAddress } from "./testAddresses.ts";

// ZeptoMail dashboards display the token pre-fixed with "Zoho-enczapikey ",
// which people often copy verbatim into the secret value. Strip it here so
// the Authorization header below is never accidentally doubled.
const ZEPTOMAIL_TOKEN = (Deno.env.get("ZEPTOMAIL_TOKEN") ?? "")
  .trim()
  .replace(/^Zoho-enczapikey\s+/i, "");
const ZEPTOMAIL_HOST = Deno.env.get("ZEPTOMAIL_HOST") ?? "api.zeptomail.in";
const FROM_ADDRESS = Deno.env.get("FROM_ADDRESS") ?? "";
const FROM_NAME = Deno.env.get("FROM_NAME") ?? "";
const SENDING_DOMAIN = Deno.env.get("SENDING_DOMAIN") ?? "";
const REPLY_TO_ADDRESS = (Deno.env.get("REPLY_TO_ADDRESS") ?? "").trim();

/** The one mail provider. Kept as a value so the send log records where each message went. */
const PROVIDER = "zeptomail";
/** Logged in place of the provider when every recipient was a reserved test address. */
const SUPPRESSED = "suppressed";
export interface EmailAttachment {
  filename: string;
  contentBase64: string;
  mimeType?: string;
}
export interface SendEmailResult {
  ok: boolean;
  error?: string;
  provider?: typeof PROVIDER | typeof SUPPRESSED;
}
export interface SendOptions {
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  text?: string;
}

// fromEmail overrides are validated against SENDING_DOMAIN — the DMARC check
// will reject mail from any other domain regardless of what we claim.
function resolveFrom(
  opts?: SendOptions,
): { address: string; name: string } {
  const addr = String(opts?.fromEmail ?? "").trim().toLowerCase();
  const ok = /^[^@\s]+@[^@\s]+$/.test(addr) &&
    addr.endsWith(`@${SENDING_DOMAIN}`);
  const address = ok ? addr : FROM_ADDRESS;
  const name = String(opts?.fromName ?? "").trim() || FROM_NAME;
  return { address, name };
}

function resolveReplyTo(opts?: SendOptions): string | null {
  for (const candidate of [opts?.replyTo, REPLY_TO_ADDRESS]) {
    const rt = String(candidate ?? "").trim();
    if (/^[^@\s]+@[^@\s]+$/.test(rt)) return rt;
  }
  return null;
}

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function sendViaZeptoMail(
  recipients: string[],
  subject: string,
  html: string,
  attachments?: EmailAttachment[],
  opts?: SendOptions,
): Promise<SendEmailResult> {
  if (!ZEPTOMAIL_TOKEN) {
    return { ok: false, error: "ZEPTOMAIL_TOKEN not configured" };
  }
  const from = resolveFrom(opts);
  const replyTo = resolveReplyTo(opts);
  const payload: Record<string, unknown> = {
    from: { address: from.address, name: from.name },
    to: recipients.map((address) => ({ email_address: { address } })),
    subject,
    htmlbody: html,
    textbody: opts?.text || emailDocumentToText(html),
    // Tracking pixels and rewritten links are bulk-mail signals; these
    // override whatever the ZeptoMail mail agent is set to.
    track_opens: false,
    track_clicks: false,
  };
  if (replyTo) payload.reply_to = [{ address: replyTo }];
  if (attachments?.length) {
    payload.attachments = attachments.map((a) => ({
      content: a.contentBase64,
      mime_type: a.mimeType ?? "application/octet-stream",
      name: a.filename,
    }));
  }
  try {
    const res = await fetch(`https://${ZEPTOMAIL_HOST}/v1.1/email`, {
      method: "POST",
      headers: {
        Authorization: `Zoho-enczapikey ${ZEPTOMAIL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const raw = await res.text();
    const j = (() => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })();
    if (!res.ok) {
      return {
        ok: false,
        error: `ZeptoMail ${res.status}: ${j?.message ?? raw.slice(0, 500)}`,
      };
    }
    return { ok: true, provider: PROVIDER };
  } catch (e) {
    return { ok: false, error: `ZeptoMail: ${(e as Error).message}` };
  }
}

async function logSend(
  recipients: string[],
  subject: string,
  result: SendEmailResult,
  source?: string,
): Promise<void> {
  try {
    await admin().from("email_send_log").insert({
      to_emails: recipients,
      subject: (subject ?? "").slice(0, 500),
      status: result.ok ? "sent" : "failed",
      provider: result.provider ?? null,
      error: result.error ? result.error.slice(0, 1000) : null,
      source: source ?? null,
    });
  } catch {
    // logging is best-effort — must never block the send
  }
}

// The main public export. Used by every edge function that sends mail.
export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  attachments?: EmailAttachment[],
  source?: string,
  opts?: SendOptions,
): Promise<SendEmailResult> {
  const all = (Array.isArray(to) ? to : [to])
    .map((x) => String(x ?? "").trim()).filter(Boolean);
  if (all.length === 0) return { ok: false, error: "No recipient email" };

  // Test addresses are dropped, never sent: they can only bounce. A send that
  // was only ever for test addresses succeeds, so the flows (and the e2e
  // suite) behave as before, and the log says it was not delivered.
  const recipients = all.filter((address) => !isReservedTestAddress(address));
  if (recipients.length === 0) {
    const result: SendEmailResult = { ok: true, provider: SUPPRESSED };
    await logSend(all, subject, { ...result, error: "Not sent: reserved test address" }, source);
    return result;
  }

  const result = await sendViaZeptoMail(recipients, subject, html, attachments, opts);

  await logSend(recipients, subject, result, source);
  return result;
}
