import { describe, expect, it } from "vitest";
import {
  ESCALATION_MAX_MINUTES,
  fromMinutes,
  isValidTime,
  parseEscalationDelay,
  toMinutes,
  validatePolicyUrl,
} from "./appSettings";

describe("escalation delay", () => {
  it("turns a number and a unit into minutes", () => {
    expect(toMinutes(30, "minutes")).toBe(30);
    expect(toMinutes(4, "hours")).toBe(240);
    expect(toMinutes(2, "days")).toBe(2880);
    expect(toMinutes(1.5, "hours")).toBe(90);
  });

  it("shows stored minutes in the largest unit that divides evenly", () => {
    expect(fromMinutes(null)).toEqual({ value: "", unit: "hours" });
    expect(fromMinutes(2880)).toEqual({ value: "2", unit: "days" });
    expect(fromMinutes(240)).toEqual({ value: "4", unit: "hours" });
    expect(fromMinutes(90)).toEqual({ value: "90", unit: "minutes" });
  });

  it("reads an empty box as off", () => {
    expect(parseEscalationDelay("", "hours")).toEqual({ minutes: null });
    expect(parseEscalationDelay("   ", "days")).toEqual({ minutes: null });
  });

  it("accepts a delay within what the database allows", () => {
    expect(parseEscalationDelay("4", "hours")).toEqual({ minutes: 240 });
    expect(parseEscalationDelay("5", "minutes")).toEqual({ minutes: 5 });
    expect(parseEscalationDelay("30", "days")).toEqual({ minutes: ESCALATION_MAX_MINUTES });
  });

  it("explains what is wrong with one that is not", () => {
    expect(parseEscalationDelay("abc", "hours").error).toMatch(/number/);
    expect(parseEscalationDelay("0", "hours").error).toMatch(/greater than zero/);
    expect(parseEscalationDelay("-2", "hours").error).toMatch(/greater than zero/);
    expect(parseEscalationDelay("3", "minutes").error).toMatch(/at least 5 minutes/);
    expect(parseEscalationDelay("31", "days").error).toMatch(/30 days or less/);
  });
});

describe("other settings", () => {
  it("checks a time as HH:MM", () => {
    expect(isValidTime("19:00")).toBe(true);
    expect(isValidTime("00:00")).toBe(true);
    for (const bad of ["", "7:00", "24:00", "19:60", "19:00:00"]) expect(isValidTime(bad)).toBe(false);
  });

  it("accepts an empty policy link or an https one", () => {
    expect(validatePolicyUrl("")).toBeNull();
    expect(validatePolicyUrl("https://ffn.example/privacy")).toBeNull();
    expect(validatePolicyUrl("http://ffn.example/privacy")).toMatch(/https/);
    expect(validatePolicyUrl("not a link")).toMatch(/full link/);
    expect(validatePolicyUrl("javascript:alert(1)")).toMatch(/https/);
  });
});
