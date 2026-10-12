import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Faq, Track } from "@/lib/content/types";
import { FaqsManager } from "./FaqsManager";

export default async function FaqsPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: faqs, error }, { data: tracks }] = await Promise.all([
    supabase.from("faqs").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false }),
    supabase.from("tracks").select("*").order("sort_order", { ascending: true }),
  ]);

  return (
    <div>
      {error && (
        <p className="body-sm" style={{ color: "var(--danger)", marginBottom: "var(--space-4)" }}>
          {error.message}
        </p>
      )}
      <FaqsManager initialFaqs={(faqs ?? []) as Faq[]} tracks={(tracks ?? []) as Track[]} />
    </div>
  );
}
