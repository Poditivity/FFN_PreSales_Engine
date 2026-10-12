import { describe, expect, it } from "vitest";
import {
  CONSENT_KEY,
  consentRecord,
  DEFAULT_PRIVACY_NOTICE,
  DEFAULT_PUBLIC_SETTINGS,
  isAnswerKey,
  normalizePublicSettings,
} from "./consent";

describe("normalizePublicSettings", () => {
  it("uses the standard notice and limit when the team has set nothing, or the read failed", () => {
    expect(normalizePublicSettings(null)).toEqual(DEFAULT_PUBLIC_SETTINGS);
    expect(normalizePublicSettings([])).toEqual(DEFAULT_PUBLIC_SETTINGS);
    expect(normalizePublicSettings({ privacy_policy_text: "   ", privacy_policy_url: "" })).toEqual(DEFAULT_PUBLIC_SETTINGS);
    expect(DEFAULT_PUBLIC_SETTINGS.privacyText).toBe(DEFAULT_PRIVACY_NOTICE);
  });

  it("uses what the team set, reading the first row of an RPC reply", () => {
    expect(
      normalizePublicSettings([{ privacy_policy_text: " We keep your details. ", privacy_policy_url: "https://ffn.example/privacy" }]),
    ).toEqual({ privacyText: "We keep your details.", privacyUrl: "https://ffn.example/privacy" });
  });

  it("only ever offers an https policy link", () => {
    for (const url of ["javascript:alert(1)", "http://ffn.example/privacy", "ftp://x", "ffn.example/privacy"]) {
      expect(normalizePublicSettings({ privacy_policy_url: url }).privacyUrl).toBeNull();
    }
  });
});

describe("consent record", () => {
  it("records that it was accepted, when, and which policy link was shown", () => {
    const settings = normalizePublicSettings({ privacy_policy_url: "https://ffn.example/privacy" });
    expect(consentRecord(settings, new Date("2026-10-01T10:00:00Z"))).toEqual({
      accepted: true,
      at: "2026-10-01T10:00:00.000Z",
      policy_url: "https://ffn.example/privacy",
    });
  });

  it("is stored under a key no question id can have", () => {
    expect(isAnswerKey(CONSENT_KEY)).toBe(false);
    expect(isAnswerKey("field_1a2b3c4d")).toBe(true);
    // Question ids are made as field_<8 hex>, so none starts with two underscores.
    expect(CONSENT_KEY.startsWith("__")).toBe(true);
  });
});
