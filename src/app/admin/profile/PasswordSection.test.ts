import { describe, expect, it } from "vitest";
import { passwordProblem } from "./PasswordSection";

describe("passwordProblem", () => {
  it("asks for the current password first", () => {
    expect(passwordProblem("", "longenough1", "longenough1")).toMatch(/current/i);
  });
  it("rejects short, unchanged and mismatched passwords", () => {
    expect(passwordProblem("old-pass-1", "short", "short")).toMatch(/at least 8/i);
    expect(passwordProblem("same-pass-1", "same-pass-1", "same-pass-1")).toMatch(/not using now/i);
    expect(passwordProblem("old-pass-1", "new-pass-22", "new-pass-23")).toMatch(/do not match/i);
  });
  it("accepts a valid change", () => {
    expect(passwordProblem("old-pass-1", "new-pass-22", "new-pass-22")).toBeNull();
  });
});
