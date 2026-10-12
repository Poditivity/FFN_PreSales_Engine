// Channel-agnostic notification dispatch. A flow builds one Notification
// (type + recipient + per-channel content) and hands it to
// dispatchNotification; each registered channel decides for itself whether
// it applies, and every channel is attempted independently — one channel
// throwing or failing never stops another, and dispatch itself never throws.
//
// Pure TypeScript: channels receive their I/O (email sender, fetch, logger)
// by injection. The edge-runtime wiring lives in ../notify.ts.

import { maskPhone, normalizePhone } from "./phone.ts";
import { type NotificationDataMap, type NotificationType, whatsappTemplateFor } from "./templates.ts";
import { sanitizeTemplateParam, sendWhatsAppTemplate, type WhatsAppConfig, type WhatsAppErrorCategory } from "./whatsapp.ts";

export type ChannelName = "email" | "whatsapp";
export type ChannelStatus = "sent" | "failed" | "skipped";

export interface ChannelOutcome {
  channel: ChannelName;
  status: ChannelStatus;
  ok: boolean;
  /** Failure message, or why the channel was skipped. */
  error?: string;
  provider?: string;
  messageId?: string;
}

export interface NotificationRecipient {
  email?: string | null;
  phone?: string | null;
  /** Internal id (profile, lead, hub, submission) for logs — never PII. */
  ref?: string | null;
}

export interface Notification<T extends NotificationType = NotificationType> {
  type: T;
  recipient: NotificationRecipient;
  /** Same `source` label the email log has always used for this flow. */
  source: string;
  email?: { subject: string; html: string };
  data: NotificationDataMap[T];
  /** Restrict delivery to these channels (default: every channel). */
  channels?: ChannelName[];
}

export interface NotificationChannel {
  readonly name: ChannelName;
  send(notification: Notification): Promise<ChannelOutcome>;
}

export interface DispatchResult {
  email: ChannelOutcome;
  whatsapp: ChannelOutcome;
}

const skipped = (channel: ChannelName, error: string): ChannelOutcome => ({ channel, status: "skipped", ok: false, error });

export async function dispatchNotification<T extends NotificationType>(
  channels: NotificationChannel[],
  notification: Notification<T>,
): Promise<DispatchResult> {
  const active = channels.filter((c) => !notification.channels || notification.channels.includes(c.name));
  const settled = await Promise.allSettled(active.map((c) => c.send(notification as Notification)));

  const outcomes = new Map<ChannelName, ChannelOutcome>();
  settled.forEach((result, i) => {
    const name = active[i].name;
    outcomes.set(
      name,
      result.status === "fulfilled"
        ? result.value
        : { channel: name, status: "failed", ok: false, error: `Channel error: ${(result.reason as Error)?.message ?? String(result.reason)}` },
    );
  });

  return {
    email: outcomes.get("email") ?? skipped("email", "Channel not requested"),
    whatsapp: outcomes.get("whatsapp") ?? skipped("whatsapp", "Channel not requested"),
  };
}

// ---------------------------------------------------------------- email

export interface EmailSendResult {
  ok: boolean;
  error?: string;
  provider?: string;
}

export type EmailSender = (
  to: string,
  subject: string,
  html: string,
  attachments: undefined,
  source: string,
) => Promise<EmailSendResult>;

/** Wraps the existing sendEmail unchanged — same arguments every flow passed before. */
export function createEmailChannel(sendEmail: EmailSender): NotificationChannel {
  return {
    name: "email",
    async send(n) {
      const to = (n.recipient.email ?? "").trim();
      if (!n.email) return skipped("email", "No email content for this notification");
      if (!to) return skipped("email", "Recipient has no email address");
      const result = await sendEmail(to, n.email.subject, n.email.html, undefined, n.source);
      return {
        channel: "email",
        status: result.ok ? "sent" : "failed",
        ok: result.ok,
        error: result.ok ? undefined : (result.error ?? "Send failed"),
        provider: result.provider,
      };
    },
  };
}

// ------------------------------------------------------------- whatsapp

export interface WhatsAppLogEntry {
  notificationType: NotificationType;
  source: string;
  templateName: string | null;
  recipientRef: string | null;
  /** Masked number, present whenever the recipient had one. */
  toMasked: string | null;
  status: ChannelStatus;
  reason?: string;
  httpStatus?: number;
  errorCode?: number;
  errorCategory?: WhatsAppErrorCategory;
  errorMessage?: string;
  messageId?: string;
}

export interface WhatsAppChannelDeps {
  config: WhatsAppConfig | null;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  log?: (entry: WhatsAppLogEntry) => void | Promise<void>;
}

const PHONE_REJECTION_MESSAGE = {
  missing: "Recipient has no phone number",
  invalid: "Recipient phone number is invalid",
  missing_country_code: "Recipient phone number has no country code and WHATSAPP_DEFAULT_COUNTRY_CODE is not set",
} as const;

export function createWhatsAppChannel(deps: WhatsAppChannelDeps): NotificationChannel {
  const log = async (entry: WhatsAppLogEntry) => {
    try {
      await deps.log?.(entry);
    } catch {
      // logging is best-effort — never let it turn into a delivery failure
    }
  };

  return {
    name: "whatsapp",
    async send(n) {
      const spec = whatsappTemplateFor(n.type);
      const base = {
        notificationType: n.type,
        source: n.source,
        templateName: spec?.name ?? null,
        recipientRef: n.recipient.ref ?? null,
      };

      if (!spec) return skipped("whatsapp", "WhatsApp is not enabled for this notification type");
      if (!deps.config) {
        await log({ ...base, toMasked: null, status: "skipped", reason: "WhatsApp is not configured" });
        return skipped("whatsapp", "WhatsApp is not configured");
      }

      const phone = normalizePhone(n.recipient.phone, deps.config.defaultCountryCode);
      if (!phone.ok) {
        const reason = PHONE_REJECTION_MESSAGE[phone.reason];
        // A missing number is the common case (most contacts have none) —
        // only a present-but-unusable number is worth recording.
        await log({ ...base, toMasked: phone.reason === "missing" ? null : "(unparseable)", status: "skipped", reason });
        return skipped("whatsapp", reason);
      }

      const params = spec.params(n.data as never).map(sanitizeTemplateParam);
      const result = await sendWhatsAppTemplate({
        config: deps.config,
        to: phone.digits,
        templateName: spec.name,
        params,
        fetchImpl: deps.fetchImpl,
        sleep: deps.sleep,
      });

      await log({
        ...base,
        toMasked: maskPhone(phone.digits),
        status: result.ok ? "sent" : "failed",
        httpStatus: result.httpStatus,
        errorCode: result.errorCode,
        errorCategory: result.errorCategory,
        errorMessage: result.errorMessage,
        messageId: result.messageId,
      });

      return result.ok
        ? { channel: "whatsapp", status: "sent", ok: true, provider: "meta_cloud_api", messageId: result.messageId }
        : { channel: "whatsapp", status: "failed", ok: false, provider: "meta_cloud_api", error: result.errorMessage ?? "Send failed" };
    },
  };
}
