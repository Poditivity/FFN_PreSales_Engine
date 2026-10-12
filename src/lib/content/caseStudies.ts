import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { CaseStudy } from "./types";

const CASE_STUDY_SELECT = "*, case_study_founders(founder_id, sort_order, founders(id, name))";

function withOrderedFounders(row: CaseStudy): CaseStudy {
  const founders = [...(row.case_study_founders ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  return { ...row, case_study_founders: founders };
}

export async function listCaseStudies(): Promise<CaseStudy[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("case_studies")
    .select(CASE_STUDY_SELECT)
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as CaseStudy[]).map(withOrderedFounders);
}

export type CaseStudyInput = Pick<
  CaseStudy,
  "title" | "case_study_link" | "audience" | "featured" | "visibility" | "sort_order"
>;

export async function createCaseStudy(input: CaseStudyInput): Promise<CaseStudy> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("case_studies").insert(input).select(CASE_STUDY_SELECT).single();
  if (error) throw error;
  return withOrderedFounders(data as unknown as CaseStudy);
}

export async function updateCaseStudy(id: string, input: CaseStudyInput): Promise<CaseStudy> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("case_studies")
    .update(input)
    .eq("id", id)
    .select(CASE_STUDY_SELECT)
    .single();
  if (error) throw error;
  return withOrderedFounders(data as unknown as CaseStudy);
}

export async function deleteCaseStudy(id: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("case_studies").delete().eq("id", id);
  if (error) throw error;
}

/** Replaces a case study's founder set. `founderIds` is the ordered list to persist. */
export async function setCaseStudyFounders(caseStudyId: string, founderIds: string[]): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error: deleteError } = await supabase
    .from("case_study_founders")
    .delete()
    .eq("case_study_id", caseStudyId);
  if (deleteError) throw deleteError;

  const rows = [...new Set(founderIds.filter(Boolean))].map((founder_id, i) => ({
    case_study_id: caseStudyId,
    founder_id,
    sort_order: i,
  }));
  if (rows.length === 0) return;

  const { error: insertError } = await supabase.from("case_study_founders").insert(rows);
  if (insertError) throw insertError;
}
