import { describe, expect, it, vi } from "vitest";
import {
  createEmailChannel,
  createWhatsAppChannel,
  dispatchNotification,
  type EmailSender,
  type Notification,
  type NotificationChannel,
  type WhatsAppLogEntry,
} from "./dispatch.ts";
import type { WhatsAppConfig } from "./whatsapp.ts";

const config: WhatsAppConfig = {
  accessToken: "test-secret-token",
  phoneNumberId: "1234567890",
  apiVersion: "v25.0",
  languageCode: "en",
  defaultCountryCode: null,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const okEmail: EmailSender = vi.fn(async () => ({ ok: true, provider: "zeptomail" }));
const okWhatsAppFetch = () => vi.fn().mockResolvedValue(jsonResponse(200, { messages: [{ id: "wamid.OK" }] }));

const hubReady: Notification<"HUB_READY"> = {
  type: "HUB_READY",
  recipient: { email: "ada@example.com", phone: "+44 7911 123456", ref: "hub-1" },
  source: "hub-send",
  email: { subject: "Ada, your Build hub is ready", html: "<p>hi</p>" },
  data: { name: "Ada", trackName: "Build", hubUrl: "https://ffn.example/hub/abc" },
};

function channels(opts: { sendEmail?: EmailSender; fetchImpl?: typeof fetch; config?: WhatsAppConfig | null; log?: (e: WhatsAppLogEntry) => void }) {
  return [
    createEmailChannel(opts.sendEmail ?? okEmail),
    createWhatsAppChannel({
      config: opts.config === undefined ? config : opts.config,
      fetchImpl: opts.fetchImpl ?? okWhatsAppFetch(),
      sleep: () => Promise.resolve(),
      log: opts.log,
    }),
  ];
}

describe("dispatchNotification — email + WhatsApp", () => {
  it("delivers the same notification on both channels", async () => {
    const sendEmail = vi.fn(async () => ({ ok: true, provider: "zeptomail" }));
    const fetchImpl = okWhatsAppFetch();
    const result = await dispatchNotification(channels({ sendEmail, fetchImpl }), hubReady);

    expect(result.email).toMatchObject({ status: "sent", ok: true, provider: "zeptomail" });
    expect(result.whatsapp).toMatchObject({ status: "sent", ok: true, messageId: "wamid.OK" });
    // Email is called with exactly the arguments flows passed to sendEmail before.
    expect(sendEmail).toHaveBeenCalledWith("ada@example.com", "Ada, your Build hub is ready", "<p>hi</p>", undefined, "hub-send");
    const payload = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(payload.to).toBe("447911123456");
    expect(payload.template.name).toBe("ffn_hub_ready");
  });

  it("builds WhatsApp template parameters from the notification data, in template order", async () => {
    const fetchImpl = okWhatsAppFetch();
    await dispatchNotification(channels({ fetchImpl }), {
      type: "LEAD_MANUAL_MESSAGE",
      recipient: { email: "a@b.co", phone: "+14155550132" },
      source: "lead-email-send",
      email: { subject: "Next steps", html: "<p/>" },
      data: { name: "", program: "Build Fellowship", subject: "Next steps\nfor you" },
    });
    const params = JSON.parse(fetchImpl.mock.calls[0][1].body).template.components[0].parameters.map((p: { text: string }) => p.text);
    expect(params).toEqual(["there", "Build Fellowship", "Next steps for you"]);
  });

  it("still sends the email when WhatsApp fails, and reports the WhatsApp failure", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, { error: { message: "Message undeliverable", code: 131026 } }));
    const log = vi.fn();
    const result = await dispatchNotification(channels({ fetchImpl, log }), hubReady);

    expect(result.email.ok).toBe(true);
    expect(result.whatsapp).toMatchObject({ status: "failed", ok: false });
    expect(result.whatsapp.error).toContain("undeliverable");
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", errorCode: 131026, errorCategory: "recipient_unavailable", httpStatus: 400, notificationType: "HUB_READY", recipientRef: "hub-1" }),
    );
  });

  it("still attempts WhatsApp when the email fails", async () => {
    const sendEmail = vi.fn(async () => ({ ok: false, error: "zeptomail failed" }));
    const fetchImpl = okWhatsAppFetch();
    const result = await dispatchNotification(channels({ sendEmail, fetchImpl }), hubReady);

    expect(result.email).toMatchObject({ status: "failed", ok: false, error: "zeptomail failed" });
    expect(result.whatsapp.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("isolates a channel that throws", async () => {
    const throwingEmail: EmailSender = vi.fn(async () => {
      throw new Error("provider settings lookup crashed");
    });
    const result = await dispatchNotification(channels({ sendEmail: throwingEmail }), hubReady);
    expect(result.email).toMatchObject({ status: "failed", ok: false });
    expect(result.email.error).toContain("provider settings lookup crashed");
    expect(result.whatsapp.ok).toBe(true);
  });

  it("skips WhatsApp when it is not configured, without calling Meta", async () => {
    const fetchImpl = okWhatsAppFetch();
    const result = await dispatchNotification(channels({ config: null, fetchImpl }), hubReady);
    expect(result.email.ok).toBe(true);
    expect(result.whatsapp).toMatchObject({ status: "skipped", error: "WhatsApp is not configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("skips WhatsApp for a recipient with no phone number", async () => {
    const fetchImpl = okWhatsAppFetch();
    const result = await dispatchNotification(channels({ fetchImpl }), { ...hubReady, recipient: { email: "ada@example.com" } });
    expect(result.email.ok).toBe(true);
    expect(result.whatsapp).toMatchObject({ status: "skipped", error: "Recipient has no phone number" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("skips and logs an invalid phone number instead of failing", async () => {
    const fetchImpl = okWhatsAppFetch();
    const log = vi.fn();
    const result = await dispatchNotification(channels({ fetchImpl, log }), { ...hubReady, recipient: { email: "ada@example.com", phone: "not a number" } });
    expect(result.whatsapp).toMatchObject({ status: "skipped", error: "Recipient phone number is invalid" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ status: "skipped", reason: "Recipient phone number is invalid" }));
  });

  it("skips a national number with no country code unless a default is configured", async () => {
    const national = { ...hubReady, recipient: { email: "ada@example.com", phone: "98765 43210" } };
    const unconfigured = await dispatchNotification(channels({}), national);
    expect(unconfigured.whatsapp.status).toBe("skipped");
    expect(unconfigured.whatsapp.error).toContain("country code");

    const fetchImpl = okWhatsAppFetch();
    const configured = await dispatchNotification(channels({ fetchImpl, config: { ...config, defaultCountryCode: "91" } }), national);
    expect(configured.whatsapp.ok).toBe(true);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).to).toBe("919876543210");
  });

  it("keeps email-only notification types off WhatsApp even when a phone is present", async () => {
    const fetchImpl = okWhatsAppFetch();
    const result = await dispatchNotification(channels({ fetchImpl }), {
      type: "ADMIN_PASSWORD_RESET",
      recipient: { email: "admin@example.com", phone: "+447911123456" },
      source: "admin-password-reset",
      email: { subject: "Reset", html: "<a>reset</a>" },
      data: {},
    });
    expect(result.email.ok).toBe(true);
    expect(result.whatsapp.status).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("honours a channel restriction", async () => {
    const fetchImpl = okWhatsAppFetch();
    const result = await dispatchNotification(channels({ fetchImpl }), { ...hubReady, channels: ["email"] });
    expect(result.email.ok).toBe(true);
    expect(result.whatsapp).toMatchObject({ status: "skipped", error: "Channel not requested" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends WhatsApp alone when the recipient has no email address", async () => {
    const sendEmail = vi.fn(okEmail);
    const result = await dispatchNotification(channels({ sendEmail }), { ...hubReady, recipient: { phone: "+447911123456" } });
    expect(result.email).toMatchObject({ status: "skipped", error: "Recipient has no email address" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(result.whatsapp.ok).toBe(true);
  });

  it("never lets a failing logger turn into a delivery failure", async () => {
    const log = vi.fn(() => {
      throw new Error("log table missing");
    });
    const result = await dispatchNotification(channels({ log }), hubReady);
    expect(result.whatsapp.ok).toBe(true);
  });

  it("logs a masked number and never the access token", async () => {
    const entries: WhatsAppLogEntry[] = [];
    await dispatchNotification(channels({ log: (e) => void entries.push(e) }), hubReady);
    expect(entries[0].toMasked).toBe("+44******3456");
    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain(config.accessToken);
    expect(serialized).not.toContain("7911123456");
  });

  it("supports additional channels without changing flows", async () => {
    const sms: NotificationChannel = { name: "email", send: vi.fn(async () => ({ channel: "email" as const, status: "sent" as const, ok: true })) };
    const result = await dispatchNotification([sms], hubReady);
    expect(sms.send).toHaveBeenCalledWith(hubReady);
    expect(result.email.ok).toBe(true);
    expect(result.whatsapp.status).toBe("skipped");
  });
});

describe("business flow resilience", () => {
  // Mirrors how every edge function uses notify(): the business effect
  // happens first, then the notification, and only the email outcome may
  // shape the response.
  async function registerAndNotify(chs: NotificationChannel[]) {
    const created = { id: "hub-1", status: "sent" };
    const delivery = await dispatchNotification(chs, hubReady);
    return { created, emailOk: delivery.email.ok, whatsapp: delivery.whatsapp.status };
  }

  it("completes the operation when WhatsApp fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, { error: { message: "Internal error", code: 1 } }));
    const outcome = await registerAndNotify(channels({ fetchImpl }));
    expect(outcome).toEqual({ created: { id: "hub-1", status: "sent" }, emailOk: true, whatsapp: "failed" });
  });

  it("completes the operation when WhatsApp's network call throws", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    await expect(registerAndNotify(channels({ fetchImpl }))).resolves.toMatchObject({ emailOk: true, whatsapp: "failed" });
  });
});
