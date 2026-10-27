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

  it("reads the name from a Name-type question whatever its label", () => {
    const named = [{ id: "n", label: "Applicant", type: "name" }];
    expect(resolveSubmissionContact({ n: "Asha Rao" }, named).name).toBe("Asha Rao");
  });

  it("does not take a startup's name for the person's, whichever comes first", () => {
    const form = [
      { id: "s", label: "Startup name", type: "text" },
      { id: "n", label: "Your name", type: "text" },
    ];
    expect(resolveSubmissionContact({ s: "Acme Labs", n: "Asha Rao" }, form).name).toBe("Asha Rao");
  });

  it("prefers a Name-type question over a text question labelled like a name", () => {
    const form = [
      { id: "t", label: "Preferred name", type: "text" },
      { id: "n", label: "Applicant", type: "name" },
    ];
    expect(resolveSubmissionContact({ t: "Ash", n: "Asha Rao" }, form).name).toBe("Asha Rao");
  });

  it("leaves the name empty rather than using a company name", () => {
    const form = [{ id: "c", label: "Company name", type: "text" }];
    expect(resolveSubmissionContact({ c: "Acme Labs" }, form).name).toBe("");
  });

  it("skips an unanswered name question", () => {
    const form = [
      { id: "a", label: "Full name", type: "text" },
      { id: "b", label: "Your name", type: "text" },
    ];
    expect(resolveSubmissionContact({ a: "", b: "Asha Rao" }, form).name).toBe("Asha Rao");
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
