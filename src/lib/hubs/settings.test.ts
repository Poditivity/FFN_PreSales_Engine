import { describe, expect, it } from "vitest";
import { validateBookingUrl } from "./settings";

describe("validateBookingUrl", () => {
  it("accepts an empty link, and an http or https one", () => {
    expect(validateBookingUrl("")).toBeNull();
    expect(validateBookingUrl("  ")).toBeNull();
    expect(validateBookingUrl("https://cal.com/ffn/intro")).toBeNull();
    expect(validateBookingUrl(" http://cal.com/ffn ")).toBeNull();
  });

  it("refuses anything else, with a sentence to show", () => {
    expect(validateBookingUrl("cal.com/ffn")).toMatch(/full link/);
    expect(validateBookingUrl("javascript:alert(1)")).toMatch(/https/);
    expect(validateBookingUrl("mailto:a@b.com")).toMatch(/https/);
  });
});
