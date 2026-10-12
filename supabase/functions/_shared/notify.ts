// notify() — the one entry point every edge function uses to deliver a
// notification. Wires the pure dispatcher (./notifications/dispatch.ts) to
// the edge runtime: the existing sendEmail (unchanged), WhatsApp config from
// Supabase Function secrets, fetch, and the whatsapp_send_log table.
//
// Email behaves exactly as it did when flows called sendEmail directly;
// WhatsApp is attempted alongside it and its outcome never changes a flow's
// response or business effect.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "./email.ts";
import {
  createEmailChannel,
  createWhatsAppChannel,
  type DispatchResult,
  dispatchNotification,
  type Notification,
  type WhatsAppLogEntry,
} from "./notifications/dispatch.ts";
import type { NotificationType } from "./notifications/templates.ts";
import { readWhatsAppConfig } from "./notifications/whatsapp.ts";

export type { DispatchResult, Notification } from "./notifications/dispatch.ts";
export { resolveSubmissionContact } from "./notifications/recipients.ts";

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

let warnedUnconfigured = false;

// Entries carry only a masked number, an internal ref and Meta's error
// details — the access token never reaches this function.
async function logWhatsApp(entry: WhatsAppLogEntry): Promise<void> {
  if (entry.reason === "WhatsApp is not configured") {
    if (!warnedUnconfigured) {
      warnedUnconfigured = true;
      console.warn("[whatsapp] WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set — WhatsApp notifications are skipped");
    }
    return;
  }

  const line = JSON.stringify(entry);
  if (entry.status === "failed") console.error("[whatsapp]", line);
  else console.log("[whatsapp]", line);

  if (!entry.toMasked) return;
  try {
    await admin().from("whatsapp_send_log").insert({
      notification_type: entry.notificationType,
      template_name: entry.templateName,
      recipient_ref: entry.recipientRef,
      to_phone_masked: entry.toMasked,
      status: entry.status,
      reason: entry.reason ?? null,
      http_status: entry.httpStatus ?? null,
      error_code: entry.errorCode != null ? String(entry.errorCode) : null,
      error_category: entry.errorCategory ?? null,
      error_message: entry.errorMessage ? entry.errorMessage.slice(0, 1000) : null,
      wa_message_id: entry.messageId ?? null,
      source: entry.source,
    });
  } catch {
    // logging is best-effort — must never block delivery
  }
}

export function notify<T extends NotificationType>(notification: Notification<T>): Promise<DispatchResult> {
  const channels = [
    createEmailChannel(sendEmail),
    createWhatsAppChannel({ config: readWhatsAppConfig((key) => Deno.env.get(key)), log: logWhatsApp }),
  ];
  return dispatchNotification(channels, notification);
}
