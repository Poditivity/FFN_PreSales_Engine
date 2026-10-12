import { describe, expect, it, vi } from "vitest";
import { WHATSAPP_TEMPLATES } from "./templates.ts";
import {
  buildTemplatePayload,
  classifyWhatsAppError,
  readWhatsAppConfig,
  sanitizeTemplateParam,
  sendWhatsAppTemplate,
  type WhatsAppConfig,
} from "./whatsapp.ts";

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

const noSleep = () => Promise.resolve();

describe("readWhatsAppConfig", () => {
  it("returns null when the access token or phone number ID is missing", () => {
    expect(readWhatsAppConfig(() => undefined)).toBeNull();
    expect(readWhatsAppConfig((k) => (k === "WHATSAPP_ACCESS_TOKEN" ? "t" : undefined))).toBeNull();
    expect(readWhatsAppConfig((k) => (k === "WHATSAPP_PHONE_NUMBER_ID" ? "1" : undefined))).toBeNull();
    // An unset CI/Supabase secret often arrives as an empty string.
    expect(readWhatsAppConfig(() => "  ")).toBeNull();
  });

  it("fills defaults and normalizes optional settings", () => {
    const env: Record<string, string> = {
      WHATSAPP_ACCESS_TOKEN: "t",
      WHATSAPP_PHONE_NUMBER_ID: "1",
      WHATSAPP_API_VERSION: "26.0",
      WHATSAPP_DEFAULT_COUNTRY_CODE: "+91",
    };
    expect(readWhatsAppConfig((k) => env[k])).toEqual({
      accessToken: "t",
      phoneNumberId: "1",
      apiVersion: "v26.0",
      languageCode: "en",
      defaultCountryCode: "91",
    });
    expect(readWhatsAppConfig((k) => ({ WHATSAPP_ACCESS_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1" })[k])?.apiVersion).toBe("v25.0");
  });
});

describe("sanitizeTemplateParam", () => {
  it("removes newlines, tabs and runs of spaces that Meta rejects", () => {
    expect(sanitizeTemplateParam({ value: "Line one\n\nLine\ttwo    end", fallback: "x" })).toBe("Line one Line two end");
  });

  it("uses the fallback for empty values, since WhatsApp rejects empty parameters", () => {
    expect(sanitizeTemplateParam({ value: "", fallback: "there" })).toBe("there");
    expect(sanitizeTemplateParam({ value: "  \n ", fallback: "there" })).toBe("there");
    expect(sanitizeTemplateParam({ value: null, fallback: "there" })).toBe("there");
  });

  it("truncates overlong values", () => {
    const out = sanitizeTemplateParam({ value: "a".repeat(1000), fallback: "x" });
    expect(out.length).toBe(300);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("template registry", () => {
  it("defines exactly as many params as each template body has placeholders", () => {
    const sample = { name: "Ada", formTitle: "F", submitter: "S", trackName: "T", hubUrl: "u", program: "P", subject: "S" };
    for (const [type, spec] of Object.entries(WHATSAPP_TEMPLATES)) {
      if (!spec) continue;
      const placeholders = new Set(spec.body.match(/\{\{\d+\}\}/g));
      expect(spec.params(sample as never).length, type).toBe(placeholders.size);
      expect(spec.name, type).toMatch(/^[a-z0-9_]+$/);
      // Meta rejects templates that open or close with a placeholder.
      expect(spec.body.trim().startsWith("{{"), type).toBe(false);
      expect(spec.body.trim().endsWith("}}"), type).toBe(false);
    }
  });

  it("keeps credential-bearing auth links off WhatsApp", () => {
    expect(WHATSAPP_TEMPLATES.ADMIN_INVITE).toBeNull();
    expect(WHATSAPP_TEMPLATES.ADMIN_PASSWORD_RESET).toBeNull();
  });
});

describe("buildTemplatePayload", () => {
  it("matches the Cloud API template message shape with ordered body parameters", () => {
    expect(buildTemplatePayload("447911123456", "ffn_hub_ready", "en", ["Ada", "Build", "https://x/hub/1"])).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "447911123456",
      type: "template",
      template: {
        name: "ffn_hub_ready",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Ada" },
              { type: "text", text: "Build" },
              { type: "text", text: "https://x/hub/1" },
            ],
          },
        ],
      },
    });
  });
});

describe("sendWhatsAppTemplate", () => {
  it("posts to the phone number's messages endpoint with a bearer token and returns the message id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, { messaging_product: "whatsapp", contacts: [{ wa_id: "447911123456" }], messages: [{ id: "wamid.ABC" }] }),
    );
    const result = await sendWhatsAppTemplate({ config, to: "447911123456", templateName: "ffn_hub_ready", params: ["Ada"], fetchImpl });

    expect(result).toEqual({ ok: true, messageId: "wamid.ABC", httpStatus: 200, attempts: 1 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v25.0/1234567890/messages");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-secret-token");
    expect(JSON.parse(init.body).template.name).toBe("ffn_hub_ready");
  });

  it("reports Meta's error code and message and does not retry a permanent failure", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(404, {
        error: { message: "(#132001) Template name does not exist in the translation", code: 132001, error_data: { details: "template name (ffn_x) does not exist in en" } },
      }),
    );
    const result = await sendWhatsAppTemplate({ config, to: "447911123456", templateName: "ffn_x", params: [], fetchImpl, sleep: noSleep });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.httpStatus).toBe(404);
    expect(result.errorCode).toBe(132001);
    expect(result.errorCategory).toBe("template");
    expect(result.errorMessage).toContain("does not exist");
  });

  it("classifies a recipient who cannot receive WhatsApp without retrying", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, { error: { message: "Message undeliverable", code: 131026 } }));
    const result = await sendWhatsAppTemplate({ config, to: "447911123456", templateName: "t", params: [], fetchImpl, sleep: noSleep });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.errorCategory).toBe("recipient_unavailable");
  });

  it("retries a transient server error once, then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { error: { message: "Service temporarily unavailable", code: 131016 } }))
      .mockResolvedValueOnce(jsonResponse(200, { messages: [{ id: "wamid.RETRY" }] }));
    const sleep = vi.fn(noSleep);
    const result = await sendWhatsAppTemplate({ config, to: "447911123456", templateName: "t", params: [], fetchImpl, sleep });
    expect(result).toMatchObject({ ok: true, messageId: "wamid.RETRY", attempts: 2 });
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("gives up after the last attempt on repeated rate limiting", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(429, { error: { message: "Rate limit hit", code: 130429 } }));
    const result = await sendWhatsAppTemplate({ config, to: "447911123456", templateName: "t", params: [], fetchImpl, sleep: noSleep });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ ok: false, errorCategory: "rate_limited", attempts: 2 });
  });

  it("turns a network error into a failure result instead of throwing", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("connection reset"));
    const result = await sendWhatsAppTemplate({ config, to: "447911123456", templateName: "t", params: [], fetchImpl, sleep: noSleep, maxAttempts: 1 });
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain("connection reset");
  });

  it("never echoes the access token in a failure result", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Invalid OAuth access token", code: 190 } }));
    const result = await sendWhatsAppTemplate({ config, to: "447911123456", templateName: "t", params: [], fetchImpl, sleep: noSleep });
    expect(result.errorCategory).toBe("auth");
    expect(JSON.stringify(result)).not.toContain(config.accessToken);
  });
});

describe("classifyWhatsAppError", () => {
  it("falls back to HTTP status when Meta sends no code", () => {
    expect(classifyWhatsAppError(null, 500)).toBe("transient");
    expect(classifyWhatsAppError(null, 429)).toBe("rate_limited");
    expect(classifyWhatsAppError(null, 400)).toBe("unknown");
  });
});
