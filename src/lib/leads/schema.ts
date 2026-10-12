import { z } from "zod";
import { STAGES, type StageId } from "@/components/ffn";

// All eight stages: the five on the path, then the three that sit off it.
// Mirrors the lead_stage enum (dormant and lost were added in
// 20260929120000_lead_exit_stages.sql, nurture in 20261011090000_nurture_stage.sql).
export const leadStageSchema = z.enum(["lead", "mql", "sql", "customer", "advocate", "nurture", "dormant", "lost"]);
export type LeadStage = z.infer<typeof leadStageSchema>;

export interface LeadStageDef {
  id: LeadStage;
  label: string;
  tone: string;
  hint: string;
}

// Labels, tones and hints are looked up from the canonical STAGES list rather
// than re-typed, so a stage renamed once is renamed everywhere.
function defsFor(ids: readonly LeadStage[]): LeadStageDef[] {
  return ids.map((id) => {
    const def = STAGES.find((s) => s.id === (id as StageId))!;
    return { id, label: def.label, tone: def.tone, hint: def.hint };
  });
}

/** Lead to advocate: the ordered path a lead moves along. */
export const PIPELINE_STAGES = defsFor(["lead", "mql", "sql", "customer", "advocate"]);

/**
 * Nurture, dormant and lost: where a lead goes when it is not moving along the
 * path. Nurture is a lead that is not ready yet and is kept warm; dormant has
 * gone quiet; lost is closed. Never a step in a stepper or funnel.
 */
export const OFF_PATH_STAGES = defsFor(["nurture", "dormant", "lost"]);

/** Every stage a lead can be in, path first, then off the path. Any lead can be moved to any of these. */
export const ALL_LEAD_STAGES = [...PIPELINE_STAGES, ...OFF_PATH_STAGES];

export const leadSchema = z.object({
  id: z.string().uuid(),
  form_submission_id: z.string().uuid(),
  stage: leadStageSchema,
  owner_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Lead = z.infer<typeof leadSchema>;

export const leadStageHistorySchema = z.object({
  id: z.string().uuid(),
  lead_id: z.string().uuid(),
  from_stage: leadStageSchema.nullable(),
  to_stage: leadStageSchema,
  changed_by: z.string().uuid().nullable(),
  changed_at: z.string(),
});
export type LeadStageHistory = z.infer<typeof leadStageHistorySchema>;

// A lead as shown on the board/list: the joined submission + form give us
// the answers (for identity resolution) and the program name, without
// duplicating either onto the leads table itself.
export interface LeadWithSubmission extends Lead {
  form_submissions: {
    id: string;
    data: Record<string, unknown>;
    created_at: string;
    forms: {
      id: string;
      title: string;
      slug: string;
      schema: unknown;
    };
  };
}
