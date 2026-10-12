// Phone normalization for WhatsApp delivery. Pure TypeScript (no Deno or
// esm.sh imports) so it runs in both the edge runtime and Vitest.
//
// WhatsApp's `to` field wants the full international number: country code
// plus subscriber number, digits only. Numbers already carrying a country
// code ("+44 7911 123456", "0044 7911 123456") are accepted as-is. A bare
// national number ("07911 123456", "98765 43210") is ambiguous — it is only
// accepted when WHATSAPP_DEFAULT_COUNTRY_CODE is configured, and otherwise
// rejected rather than guessed. No country is assumed.

export type PhoneRejection = "missing" | "invalid" | "missing_country_code";

export type NormalizedPhone =
  | { ok: true; digits: string; e164: string }
  | { ok: false; reason: PhoneRejection };

// E.164 caps a full number at 15 digits; the shortest real international
// numbers (country code + subscriber) are 8.
const MIN_DIGITS = 8;
const MAX_DIGITS = 15;

export function normalizePhone(raw: unknown, defaultCountryCode?: string | null): NormalizedPhone {
  const input = String(raw ?? "").trim();
  if (!input) return { ok: false, reason: "missing" };
  if (/[a-z]/i.test(input)) return { ok: false, reason: "invalid" };

  const compact = input.replace(/[\s().\-/]/g, "");
  let digits: string;

  if (compact.startsWith("+")) {
    digits = compact.slice(1);
  } else if (compact.startsWith("00")) {
    digits = compact.slice(2);
  } else {
    if (!/^\d+$/.test(compact)) return { ok: false, reason: "invalid" };
    const cc = (defaultCountryCode ?? "").replace(/\D/g, "");
    if (!cc) return { ok: false, reason: "missing_country_code" };
    const national = compact.replace(/^0+/, "");
    // "919876543210" typed without the "+" already carries the default
    // country code — national significant numbers rarely exceed 10 digits,
    // so 11+ digits starting with the code is taken as already international.
    digits = national.startsWith(cc) && national.length >= 11 ? national : `${cc}${national}`;
  }

  if (!/^\d+$/.test(digits) || digits.startsWith("0")) return { ok: false, reason: "invalid" };
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return { ok: false, reason: "invalid" };
  return { ok: true, digits, e164: `+${digits}` };
}

/** Enough of a number to tell deliveries apart in logs without storing it. */
export function maskPhone(digits: string): string {
  if (digits.length <= 6) return "+" + "*".repeat(digits.length);
  return `+${digits.slice(0, 2)}${"*".repeat(digits.length - 6)}${digits.slice(-4)}`;
}
