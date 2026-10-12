import { describe, expect, it } from "vitest";
import { resolveSubmissionContact } from "./recipients.ts";

const fields = [
  { id: "q1", label: "Full name", type: "text" },
  { id: "q2", label: "Email address", type: "email" },
  { id: "q3", label: "Mobile", type: "phone" },
];

describe("resolveSubmissionContact", () => {
  it("reads name, email and a phone-type answer", () => {
    expect(resolveSubmissionContact({ q1: "Ada", q2: "ada@example.com", q3: "+44 7911 123456" }, fields)).toEqual({
      name: "Ada",
      email: "ada@example.com",
      phone: "+44 7911 123456",
    });
  });

  it("falls back to a field labelled like a phone or WhatsApp number", () => {
    const labelled = [{ id: "w", label: "WhatsApp number", type: "text" }];
    expect(resolveSubmissionContact({ w: "+91 98765 43210" }, labelled).phone).toBe("+91 98765 43210");
  });

  it("skips an empty phone-type answer in favour of a labelled one", () => {
    const both = [
      { id: "p", label: "Phone", type: "phone" },
      { id: "c", label: "Contact number", type: "text" },
    ];
    expect(resolveSubmissionContact({ p: "", c: "+1 415 555 0132" }, both).phone).toBe("+1 415 555 0132");
  });

  it("returns an empty phone when the form never asked for one", () => {
    expect(resolveSubmissionContact({ q1: "Ada", q2: "ada@example.com" }, fields.slice(0, 2)).phone).toBe("");
  });
});
