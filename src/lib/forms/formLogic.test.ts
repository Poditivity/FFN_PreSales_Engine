import { describe, expect, it } from "vitest";
import { fileConfigOf, isEmailField, isValidEmail, makeField, validateField } from "./formLogic";

describe("email validation", () => {
  it("accepts ordinary addresses", () => {
    for (const e of ["a@b.co", "first.last@example.com", "x+tag@sub.example.in", " a@b.com "]) {
      expect(isValidEmail(e)).toBe(true);
    }
  });

  it("rejects malformed addresses", () => {
    for (const e of ["", "abc", "a@b", "a@b.", "a b@c.com", "a@@b.com", "a..b@c.com", ".a@b.com", "a@b.c"]) {
      expect(isValidEmail(e)).toBe(false);
    }
  });

  it("treats a text field labelled Email as an email field", () => {
    const f = { ...makeField("text"), label: "Your Email" };
    expect(isEmailField(f)).toBe(true);
    expect(validateField(f, "nope")).toBe("Enter a valid email address");
    expect(validateField(f, "me@site.com")).toBeNull();
  });

  it("does not flag unrelated text fields", () => {
    expect(isEmailField({ ...makeField("text"), label: "Startup name" })).toBe(false);
  });

  it("still allows an empty optional email", () => {
    expect(validateField(makeField("email"), "")).toBeNull();
  });
});

describe("file question", () => {
  it("starts with the default limits, and its own copy of the category list", () => {
    const a = makeField("file");
    const b = makeField("file");
    expect(a.fileConfig).toEqual({ categories: ["images", "pdf"], maxMb: 5 });
    a.fileConfig!.categories.push("word");
    expect(b.fileConfig!.categories).toEqual(["images", "pdf"]);
    expect(makeField("text").fileConfig).toBeUndefined();
  });

  it("is required only when the team says so", () => {
    expect(validateField(makeField("file"), "")).toBeNull();
    expect(validateField({ ...makeField("file"), required: true }, "")).toBe("This field is required");
    expect(validateField({ ...makeField("file"), required: true }, undefined)).toBe("This field is required");
  });

  it("only takes an https link as the uploaded file", () => {
    const f = makeField("file");
    expect(validateField(f, "https://files.example.com/forms/x/y.pdf")).toBeNull();
    expect(validateField(f, "javascript:alert(1)")).toBe("Upload a file");
    expect(validateField(f, "http://files.example.com/a.pdf")).toBe("Upload a file");
  });

  it("corrects a stored config that is out of range", () => {
    const f = { ...makeField("file"), fileConfig: { categories: ["pdf" as const], maxMb: 99 } };
    expect(fileConfigOf(f).maxMb).toBe(10);
    expect(fileConfigOf(f, 3).maxMb).toBe(3);
    expect(fileConfigOf({ fileConfig: undefined })).toEqual({ categories: ["images", "pdf"], maxMb: 5 });
  });
});
