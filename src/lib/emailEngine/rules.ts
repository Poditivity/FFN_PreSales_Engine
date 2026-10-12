import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { LeadStage } from "@/lib/leads/schema";
import type { StageEmailRule } from "./types";

export async function listStageEmailRules(): Promise<StageEmailRule[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("stage_email_rules").select("*");
  if (error) throw error;
  return (data ?? []) as StageEmailRule[];
}

export interface StageEmailRuleInput {
  stage: LeadStage;
  template_id: string;
  enabled: boolean;
}

/** One rule per stage — creates it the first time a template is picked for that stage, updates it after. */
export async function upsertStageEmailRule(input: StageEmailRuleInput): Promise<StageEmailRule> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("stage_email_rules")
    .upsert(input, { onConflict: "stage" })
    .select()
    .single();
  if (error) throw error;
  return data as StageEmailRule;
}

/** Clears a stage's rule entirely — after this, nothing auto-sends for that stage (same as it never having had one). */
export async function deleteStageEmailRule(stage: LeadStage): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("stage_email_rules").delete().eq("stage", stage);
  if (error) throw error;
}
