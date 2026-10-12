import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Program, Track } from "@/lib/content/types";
import { ProgramsManager } from "./ProgramsManager";

export default async function ProgramsPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: programs, error }, { data: tracks }] = await Promise.all([
    supabase.from("programs").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true }),
    supabase.from("tracks").select("*").order("sort_order", { ascending: true }),
  ]);

  return (
    <div>
      {error && (
        <p className="body-sm" style={{ color: "var(--danger)", marginBottom: "var(--space-4)" }}>
          {error.message}
        </p>
      )}
      <ProgramsManager initialPrograms={(programs ?? []) as Program[]} tracks={(tracks ?? []) as Track[]} />
    </div>
  );
}
