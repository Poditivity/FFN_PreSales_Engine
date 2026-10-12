import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CaseStudy, Track } from "@/lib/content/types";
import { CaseStudiesManager } from "./CaseStudiesManager";

const CASE_STUDY_SELECT = "*, case_study_founders(founder_id, sort_order, founders(id, name))";

export default async function CaseStudiesPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: caseStudies, error }, { data: founders }, { data: tracks }] = await Promise.all([
    supabase.from("case_studies").select(CASE_STUDY_SELECT).order("sort_order", { ascending: true }),
    supabase.from("founders").select("id, name, startup_name").order("name", { ascending: true }),
    supabase.from("tracks").select("*").order("sort_order", { ascending: true }),
  ]);

  return (
    <div>
      {error && (
        <p className="body-sm" style={{ color: "var(--danger)", marginBottom: "var(--space-4)" }}>
          {error.message}
        </p>
      )}
      <CaseStudiesManager
        initialCaseStudies={(caseStudies ?? []) as unknown as CaseStudy[]}
        founders={(founders ?? []) as { id: string; name: string; startup_name: string | null }[]}
        tracks={(tracks ?? []) as Track[]}
      />
    </div>
  );
}
