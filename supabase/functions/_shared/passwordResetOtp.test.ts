// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildResetOtpEmail, isSixDigitCode, RESET_MIN_INTERVAL_SECONDS, RESET_SUBJECT, throttleCutoff } from "./passwordResetOtp";

describe("isSixDigitCode", () => {
  it("accepts exactly six digits, leading zeros included", () => {
    expect(isSixDigitCode("123456")).toBe(true);
    expect(isSixDigitCode("000123")).toBe(true);
  });

  it("refuses any other length or characters, so a project set to 8 digits never emails a code", () => {
    for (const bad of ["12345", "1234567", "12345678", "12a456", "123 456", "", undefined, null, 123456]) {
      expect(isSixDigitCode(bad)).toBe(false);
    }
  });
});

describe("buildResetOtpEmail", () => {
  it("puts the code in the html and the plain text body", () => {
    const email = buildResetOtpEmail("493027");
    expect(email.html).toContain("493027");
    expect(email.text).toContain("Code: 493027");
  });

  it("keeps the code out of the subject, which is written to email_send_log", () => {
    const email = buildResetOtpEmail("493027");
    expect(email.subject).toBe(RESET_SUBJECT);
    expect(email.subject).not.toMatch(/\d{6}/);
  });

  it("contains no reset link, since the flow is code only", () => {
    const { html, text } = buildResetOtpEmail("493027");
    expect(html).not.toMatch(/<a\s/i);
    expect(html + text).not.toMatch(/https?:\/\//i);
    expect(html + text).not.toContain("token_hash");
  });

  it("follows the FFN voice: no contractions and no em dashes", () => {
    const { html, text } = buildResetOtpEmail("493027");
    const words = (html.replace(/<[^>]+>/g, " ") + " " + text).replace(/&[a-z]+;/g, " ");
    expect(words).not.toMatch(/\b\w+'(t|s|re|ll|ve|d)\b/i);
    expect(words + html).not.toMatch(/—|&mdash;/);
  });

  it("refuses to build an email for anything but a six digit code", () => {
    expect(() => buildResetOtpEmail("12345")).toThrow(/6 digits/);
    expect(() => buildResetOtpEmail("12345678")).toThrow(/6 digits/);
  });
});

describe("throttleCutoff", () => {
  it("is the moment a repeat send stops counting as too soon", () => {
    const now = new Date("2026-09-30T10:00:30.000Z");
    expect(throttleCutoff(now)).toBe(new Date(now.getTime() - RESET_MIN_INTERVAL_SECONDS * 1000).toISOString());
  });
});
