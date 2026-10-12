import { describe, expect, it } from "vitest";
import { hasContent, resolveEligibleItems, resolveModules } from "./modules";
import { defaultModule, type HubModule } from "./types";

describe("resolveModules — null-vs-array inheritance", () => {
  const templateModules: HubModule[] = [defaultModule("founders"), defaultModule("testimonials")];

  it("inherits the template's modules when the hub's modules is null", () => {
    expect(resolveModules(null, templateModules)).toBe(templateModules);
  });

  it("uses the hub's own modules when explicitly set, even if it differs from the template", () => {
    const hubModules: HubModule[] = [defaultModule("mentors")];
    expect(resolveModules(hubModules, templateModules)).toBe(hubModules);
  });

  it("treats an explicit empty array as a real override, not as inherit", () => {
    expect(resolveModules([], templateModules)).toEqual([]);
  });
});

describe("resolveEligibleItems — automatic mode: audience filtering at hydration", () => {
  const trackId = "track-founders";
  const items = [
    { id: "a", audience: [] as string[], featured: false },
    { id: "b", audience: [trackId], featured: true },
    { id: "c", audience: ["track-students"], featured: true },
  ];

  it("includes items with empty audience (visible to everyone)", () => {
    const blockModule: HubModule = { ...defaultModule("founders") };
    const result = resolveEligibleItems(items, blockModule, trackId);
    expect(result.map((i) => i.id)).toContain("a");
  });

  it("includes items whose audience explicitly contains the hub's track", () => {
    const blockModule: HubModule = { ...defaultModule("founders") };
    const result = resolveEligibleItems(items, blockModule, trackId);
    expect(result.map((i) => i.id)).toContain("b");
  });

  it("excludes items whose audience is non-empty and doesn't include the hub's track", () => {
    const blockModule: HubModule = { ...defaultModule("founders") };
    const result = resolveEligibleItems(items, blockModule, trackId);
    expect(result.map((i) => i.id)).not.toContain("c");
  });

  it("applies featured_only after audience filtering", () => {
    const blockModule: HubModule = { ...defaultModule("founders"), featured_only: true };
    const result = resolveEligibleItems(items, blockModule, trackId);
    expect(result.map((i) => i.id)).toEqual(["b"]);
  });

  it("applies limit after audience/featured filtering", () => {
    const blockModule: HubModule = { ...defaultModule("founders"), limit: 1 };
    const result = resolveEligibleItems(items, blockModule, trackId);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });
});

describe("resolveEligibleItems — hand-picked mode ignores limit/featured/audience", () => {
  const trackId = "track-founders";
  const items = [
    { id: "a", audience: ["track-students"], featured: false }, // wrong track, not featured
    { id: "b", audience: [] as string[], featured: false },
    { id: "c", audience: [trackId], featured: true },
  ];

  it("returns exactly the ticked ids, even ones that would fail audience filtering", () => {
    const blockModule: HubModule = { ...defaultModule("founders"), mode: "manual", ids: ["a", "c"] };
    const result = resolveEligibleItems(items, blockModule, trackId);
    expect(result.map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("ignores featured_only entirely in manual mode", () => {
    const blockModule: HubModule = {
      ...defaultModule("founders"),
      mode: "manual",
      ids: ["a", "b"],
      featured_only: true,
    };
    const result = resolveEligibleItems(items, blockModule, trackId);
    expect(result.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("ignores limit entirely in manual mode", () => {
    const blockModule: HubModule = {
      ...defaultModule("founders"),
      mode: "manual",
      ids: ["a", "b", "c"],
      limit: 1,
    };
    const result = resolveEligibleItems(items, blockModule, trackId);
    expect(result).toHaveLength(3);
  });

  it("orders results by ticked order, not by input order", () => {
    const blockModule: HubModule = { ...defaultModule("founders"), mode: "manual", ids: ["c", "a"] };
    const result = resolveEligibleItems(items, blockModule, trackId);
    expect(result.map((i) => i.id)).toEqual(["c", "a"]);
  });

  it("drops ticked ids that no longer exist in the item list", () => {
    const blockModule: HubModule = { ...defaultModule("founders"), mode: "manual", ids: ["a", "does-not-exist"] };
    const result = resolveEligibleItems(items, blockModule, trackId);
    expect(result.map((i) => i.id)).toEqual(["a"]);
  });
});

describe("hasContent — singleton block hide-if-empty rule", () => {
  it("is false when every field is null or undefined", () => {
    expect(hasContent({ a: null, b: undefined })).toBe(false);
  });

  it("is false when every string field is empty or whitespace-only", () => {
    expect(hasContent({ a: "", b: "   " })).toBe(false);
  });

  it("is false when every array field is empty", () => {
    expect(hasContent({ a: [], b: [] })).toBe(false);
  });

  it("is true when at least one string field has real content", () => {
    expect(hasContent({ a: null, b: "  hello  " })).toBe(true);
  });

  it("is true when at least one array field is non-empty", () => {
    expect(hasContent({ a: [], b: ["idea validation"] })).toBe(true);
  });

  it("treats a mix of empty and non-empty fields as content", () => {
    expect(hasContent({ name: null, stage: "", context: "Pre-seed, raising a round" })).toBe(true);
  });
});
