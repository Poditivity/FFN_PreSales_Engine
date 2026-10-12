import { describe, expect, it } from "vitest";
import { renderTemplate, resolveStageEmailRule, type StageEmailRuleLike } from "./personalization";

describe("renderTemplate — token substitution", () => {
  it("replaces a single known token", () => {
    expect(renderTemplate("Hi {{lead_name}}!", { lead_name: "Priya" })).toBe("Hi Priya!");
  });

  it("replaces multiple distinct tokens", () => {
    expect(renderTemplate("Hi {{lead_name}}, welcome to {{program}}.", { lead_name: "Priya", program: "Founder Track" })).toBe(
      "Hi Priya, welcome to Founder Track.",
    );
  });

  it("replaces every occurrence of a repeated token", () => {
    expect(renderTemplate("{{lead_name}} {{lead_name}}", { lead_name: "Priya" })).toBe("Priya Priya");
  });

  it("leaves an unmapped token visible rather than blanking it", () => {
    expect(renderTemplate("Hi {{lead_name}}, re: {{unknown_token}}", { lead_name: "Priya" })).toBe(
      "Hi Priya, re: {{unknown_token}}",
    );
  });

  it("renders a null token value as an empty string", () => {
    expect(renderTemplate("Program: {{program}}", { program: null })).toBe("Program: ");
  });

  it("passes through a template with no tokens at all", () => {
    expect(renderTemplate("No placeholders here.", { lead_name: "Priya" })).toBe("No placeholders here.");
  });

  it("tolerates whitespace inside the braces", () => {
    expect(renderTemplate("Hi {{ lead_name }}!", { lead_name: "Priya" })).toBe("Hi Priya!");
  });
});

describe("resolveStageEmailRule — stage -> rule -> template matching", () => {
  const rules: StageEmailRuleLike[] = [
    { stage: "mql", template_id: "t-mql", enabled: true },
    { stage: "sql", template_id: "t-sql", enabled: false },
  ];

  it("returns the enabled rule for a stage that has one", () => {
    expect(resolveStageEmailRule(rules, "mql")?.template_id).toBe("t-mql");
  });

  it("returns null for a stage whose rule exists but is disabled", () => {
    expect(resolveStageEmailRule(rules, "sql")).toBeNull();
  });

  it("returns null for a stage with no rule row at all — confirming nothing sends", () => {
    expect(resolveStageEmailRule(rules, "lead")).toBeNull();
    expect(resolveStageEmailRule(rules, "customer")).toBeNull();
    expect(resolveStageEmailRule(rules, "advocate")).toBeNull();
  });

  it("returns null against a completely empty rule set", () => {
    expect(resolveStageEmailRule([], "mql")).toBeNull();
  });
});
