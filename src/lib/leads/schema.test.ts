import { describe, expect, it } from "vitest";
import { STAGES } from "@/components/ffn";
import { ALL_LEAD_STAGES, OFF_PATH_STAGES, leadStageSchema, PIPELINE_STAGES } from "./schema";

describe("lead stages", () => {
  it("has the five path stages and the two exits, in the design system's order", () => {
    expect(PIPELINE_STAGES.map((s) => s.id)).toEqual(["lead", "mql", "sql", "customer", "advocate"]);
    expect(OFF_PATH_STAGES.map((s) => s.id)).toEqual(["nurture", "dormant", "lost"]);
    expect(ALL_LEAD_STAGES.map((s) => s.id)).toEqual(STAGES.map((s) => s.id));
  });

  it("accepts every stage a lead can be moved to", () => {
    for (const stage of ALL_LEAD_STAGES) expect(leadStageSchema.safeParse(stage.id).success).toBe(true);
    expect(leadStageSchema.safeParse("archived").success).toBe(false);
  });

  it("takes labels and hints from the design system list, never a second copy", () => {
    for (const def of ALL_LEAD_STAGES) {
      const canonical = STAGES.find((s) => s.id === def.id)!;
      expect(def.label).toBe(canonical.label);
      expect(def.hint).toBe(canonical.hint);
    }
  });
});
