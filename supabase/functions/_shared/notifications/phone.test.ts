import { describe, expect, it } from "vitest";
import { maskPhone, normalizePhone } from "./phone.ts";

describe("normalizePhone", () => {
  it("accepts international numbers from any country, stripping formatting", () => {
    expect(normalizePhone("+44 7911 123456")).toEqual({ ok: true, digits: "447911123456", e164: "+447911123456" });
    expect(normalizePhone("+1 (415) 555-0132")).toMatchObject({ ok: true, digits: "14155550132" });
    expect(normalizePhone("+91 98765-43210")).toMatchObject({ ok: true, digits: "919876543210" });
    expect(normalizePhone("+971.50.123.4567")).toMatchObject({ ok: true, digits: "971501234567" });
  });

  it("treats a 00 prefix as the international prefix", () => {
    expect(normalizePhone("0049 151 23456789")).toMatchObject({ ok: true, digits: "4915123456789" });
  });

  it("reports missing numbers separately from invalid ones", () => {
    expect(normalizePhone("")).toEqual({ ok: false, reason: "missing" });
    expect(normalizePhone(null)).toEqual({ ok: false, reason: "missing" });
    expect(normalizePhone("   ")).toEqual({ ok: false, reason: "missing" });
  });

  it("rejects values that are not phone numbers", () => {
    expect(normalizePhone("call me")).toEqual({ ok: false, reason: "invalid" });
    expect(normalizePhone("+44 79x1 123456")).toEqual({ ok: false, reason: "invalid" });
    expect(normalizePhone("+123")).toEqual({ ok: false, reason: "invalid" });
    expect(normalizePhone("+1234567890123456")).toEqual({ ok: false, reason: "invalid" });
    expect(normalizePhone("+0 7911 123456")).toEqual({ ok: false, reason: "invalid" });
    expect(normalizePhone("44+7911123456")).toEqual({ ok: false, reason: "invalid" });
  });

  it("does not guess a country for a national number when no default is configured", () => {
    expect(normalizePhone("9876543210")).toEqual({ ok: false, reason: "missing_country_code" });
    expect(normalizePhone("07911 123456", null)).toEqual({ ok: false, reason: "missing_country_code" });
  });

  it("applies the configured default country code, dropping the trunk zero", () => {
    expect(normalizePhone("98765 43210", "91")).toMatchObject({ ok: true, digits: "919876543210" });
    expect(normalizePhone("07911 123456", "44")).toMatchObject({ ok: true, digits: "447911123456" });
    expect(normalizePhone("(415) 555-0132", "1")).toMatchObject({ ok: true, digits: "14155550132" });
  });

  it("recognises a number that already carries the default code without a +", () => {
    expect(normalizePhone("919876543210", "91")).toMatchObject({ ok: true, digits: "919876543210" });
  });

  it("an explicit country code wins over the configured default", () => {
    expect(normalizePhone("+44 7911 123456", "91")).toMatchObject({ ok: true, digits: "447911123456" });
  });
});

describe("maskPhone", () => {
  it("keeps only the country prefix and last four digits", () => {
    expect(maskPhone("919876543210")).toBe("+91******3210");
    expect(maskPhone("447911123456")).toBe("+44******3456");
  });
});
