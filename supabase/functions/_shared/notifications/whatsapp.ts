// WhatsApp Business Cloud API client (official Meta Graph API only). Pure
// TypeScript — config and fetch are injected, so the edge runtime and Vitest
// share the exact same code path.
//
// Secrets (Supabase Edge Function secrets, never exposed to the browser):
//   WHATSAPP_ACCESS_TOKEN          System user access token with whatsapp_business_messaging
//   WHATSAPP_PHONE_NUMBER_ID       The sending business phone number's ID (not the number itself)
//   WHATSAPP_API_VERSION           Graph API version, default v25.0
//   WHATSAPP_TEMPLATE_LANGUAGE     Language code the templates were approved in, default "en"
//   WHATSAPP_DEFAULT_COUNTRY_CODE  Optional, e.g. "91" — only used for numbers stored without one

import type { TemplateParam } from "./templates.ts";

export const GRAPH_API_BASE = "https://graph.facebook.com";
export const DEFAULT_API_VERSION = "v25.0";
const REQUEST_TIMEOUT_MS = 10_000;

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
  languageCode: string;
  defaultCountryCode: string | null;
}

/** Null when the channel isn't configured — callers skip WhatsApp rather than fail. */
export function readWhatsAppConfig(getEnv: (key: string) => string | undefined): WhatsAppConfig | null {
  const accessToken = (getEnv("WHATSAPP_ACCESS_TOKEN") ?? "").trim();
  const phoneNumberId = (getEnv("WHATSAPP_PHONE_NUMBER_ID") ?? "").trim();
  if (!accessToken || !phoneNumberId) return null;
  const version = (getEnv("WHATSAPP_API_VERSION") ?? "").trim();
  return {
    accessToken,
    phoneNumberId,
    apiVersion: version ? (version.startsWith("v") ? version : `v${version}`) : DEFAULT_API_VERSION,
    languageCode: (getEnv("WHATSAPP_TEMPLATE_LANGUAGE") ?? "").trim() || "en",
    defaultCountryCode: (getEnv("WHATSAPP_DEFAULT_COUNTRY_CODE") ?? "").replace(/\D/g, "") || null,
  };
}

// Template text parameters may not contain newlines, tabs or runs of more
// than four spaces (Meta error 132018), and may not be empty.
const MAX_PARAM_LENGTH = 300;

export function sanitizeTemplateParam(param: TemplateParam): string {
  const clean = (v: unknown) =>
    String(v ?? "")
      .replace(/[\r\n\t]+/g, " ")
      .replace(/ {2,}/g, " ")
      .trim();
  let text = clean(param.value) || clean(param.fallback);
  if (text.length > MAX_PARAM_LENGTH) text = `${text.slice(0, MAX_PARAM_LENGTH - 1).trimEnd()}…`;
  return text;
}

export function buildTemplatePayload(to: string, templateName: string, languageCode: string, params: string[]) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: params.length > 0 ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] : [],
    },
  };
}

export type WhatsAppErrorCategory =
  | "auth"
  | "template"
  | "invalid_parameter"
  | "recipient_unavailable"
  | "rate_limited"
  | "transient"
  | "unknown";

// Meta Cloud API error codes: developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes
export function classifyWhatsAppError(code: number | null, httpStatus: number | null): WhatsAppErrorCategory {
  if (code === 190 || code === 10 || code === 200 || httpStatus === 401) return "auth";
  if (code === 132000 || code === 132001 || code === 132005 || code === 132007 || code === 132012 || code === 132015 || code === 132016)
    return "template";
  if (code === 132018 || code === 100 || code === 131008 || code === 131009) return "invalid_parameter";
  if (code === 131026 || code === 131030 || code === 131045 || code === 131050) return "recipient_unavailable";
  if (code === 130429 || code === 131048 || code === 131056 || code === 4 || code === 80007 || httpStatus === 429) return "rate_limited";
  if (code === 1 || code === 2 || code === 131000 || code === 131016 || (httpStatus !== null && httpStatus >= 500)) return "transient";
  return "unknown";
}

const RETRIABLE: WhatsAppErrorCategory[] = ["transient", "rate_limited"];

export interface WhatsAppSendResult {
  ok: boolean;
  messageId?: string;
  httpStatus?: number;
  errorCode?: number;
  errorCategory?: WhatsAppErrorCategory;
  errorMessage?: string;
  attempts: number;
}

interface GraphErrorBody {
  error?: { message?: string; code?: number; error_subcode?: number; error_data?: { details?: string } };
  messages?: { id?: string }[];
}

export interface SendTemplateOptions {
  config: WhatsAppConfig;
  to: string;
  templateName: string;
  params: string[];
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function timeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined;
}

/**
 * Sends one approved template message. Never throws: network errors and
 * Meta errors both come back as `ok: false` with enough detail to log.
 * Transient and rate-limit failures are retried (default 2 attempts total).
 */
export async function sendWhatsAppTemplate(opts: SendTemplateOptions): Promise<WhatsAppSendResult> {
  const { config, to, templateName, params } = opts;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 2);
  const url = `${GRAPH_API_BASE}/${config.apiVersion}/${encodeURIComponent(config.phoneNumberId)}/messages`;
  const body = JSON.stringify(buildTemplatePayload(to, templateName, config.languageCode, params));

  let last: WhatsAppSendResult = { ok: false, attempts: 0, errorMessage: "Not attempted" };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) await sleep(500 * (attempt - 1));
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
        body,
        signal: timeoutSignal(),
      });
      const json = (await res.json().catch(() => ({}))) as GraphErrorBody;
      const messageId = json.messages?.[0]?.id;
      if (res.ok && messageId) return { ok: true, messageId, httpStatus: res.status, attempts: attempt };

      const code = typeof json.error?.code === "number" ? json.error.code : null;
      const category = classifyWhatsAppError(code, res.status);
      const detail = json.error?.error_data?.details;
      last = {
        ok: false,
        httpStatus: res.status,
        errorCode: code ?? undefined,
        errorCategory: category,
        errorMessage: [json.error?.message ?? `HTTP ${res.status}`, detail].filter(Boolean).join(" — "),
        attempts: attempt,
      };
      if (!RETRIABLE.includes(category)) return last;
    } catch (e) {
      last = { ok: false, errorCategory: "transient", errorMessage: `Network error: ${(e as Error).message}`, attempts: attempt };
    }
  }
  return last;
}
