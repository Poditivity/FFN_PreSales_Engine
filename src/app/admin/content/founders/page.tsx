import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Founder, Track } from "@/lib/content/types";
import { FoundersManager } from "./FoundersManager";

export default async function FoundersPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: founders, error }, { data: tracks }] = await Promise.all([
    supabase.from("founders").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true }),
    supabase.from("tracks").select("*").order("sort_order", { ascending: true }),
  ]);

  return (
    <div>
      {error && (
        <p className="body-sm" style={{ color: "var(--danger)", marginBottom: "var(--space-4)" }}>
          {error.message}
        </p>
      )}
      <FoundersManager initialFounders={(founders ?? []) as Founder[]} tracks={(tracks ?? []) as Track[]} />
    </div>
  );
}
