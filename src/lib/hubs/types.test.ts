import { describe, expect, it } from "vitest";
import {
  defaultModule,
  hubModuleSchema,
  isRepeatableModule,
  moduleKey,
  newRepeatableModule,
  newSectionId,
  sectionLabel,
} from "./types";

describe("hub modules", () => {
  it("still reads a module saved before custom sections existed", () => {
    const old = { ...defaultModule("founders") };
    expect(hubModuleSchema.safeParse(old).success).toBe(true);
  });

  it("reads a custom and a collection section", () => {
    const custom = { ...newRepeatableModule("custom", "Our story"), body: "<p>Hello</p>", image_url: "https://x.test/a.png" };
    const collection = { ...newRepeatableModule("collection", "Events"), collection_id: "abc" };
    expect(hubModuleSchema.safeParse(custom).success).toBe(true);
    expect(hubModuleSchema.safeParse(collection).success).toBe(true);
    expect(hubModuleSchema.safeParse({ ...custom, type: "something_else" }).success).toBe(false);
  });

  it("identifies fixed blocks by type and added sections by id", () => {
    const custom = newRepeatableModule("custom", "Our story");
    expect(moduleKey(defaultModule("faqs"))).toBe("faqs");
    expect(moduleKey(custom)).toBe(custom.id);
    expect(isRepeatableModule(custom)).toBe(true);
    expect(isRepeatableModule(defaultModule("faqs"))).toBe(false);
  });

  it("gives each new section a distinct, readable id", () => {
    const a = newSectionId("custom", "Our story!");
    const b = newSectionId("custom", "Our story!");
    expect(a).toMatch(/^custom-our-story-[a-z0-9]{4}$/);
    expect(a).not.toBe(b);
    expect(newSectionId("collection", "???")).toMatch(/^collection-[a-z0-9]{4}$/);
  });

  it("turns a section id back into a name for the engagement log", () => {
    expect(sectionLabel("founders")).toBe("Founders");
    expect(sectionLabel("custom-our-story-k3f9")).toBe("Our story");
    expect(sectionLabel("collection-k3f9")).toBe("Collection");
    expect(sectionLabel("custom-k3f9")).toBe("Custom section");
    expect(sectionLabel("unknown")).toBe("unknown");
  });
});
