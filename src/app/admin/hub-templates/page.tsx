import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Track } from "@/lib/content/types";
import type { HubSettings } from "@/lib/hubs/settings";
import type { HubTemplate } from "@/lib/hubs/types";
import { HubTemplatesManager } from "./HubTemplatesManager";

export default async function HubTemplatesPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: templates, error }, { data: tracks }, { data: settings }] = await Promise.all([
    supabase.from("hub_templates").select("*").order("name", { ascending: true }),
    supabase.from("tracks").select("*").order("sort_order", { ascending: true }),
    supabase.from("hub_settings").select("booking_url, cta_text").eq("id", true).maybeSingle(),
  ]);

  return (
    <div>
      <h1 className="h1" style={{ marginBottom: "var(--space-2)" }}>
        Hub templates
      </h1>
      <p className="body-sm" style={{ color: "var(--ink-muted)", marginBottom: "var(--space-6)" }}>
        Each track can have one or more templates — a default set of content modules a new hub for that track starts
        from. A hub can always customize its own modules after creation.
      </p>
      {error && (
        <p className="body-sm" style={{ color: "var(--danger)", marginBottom: "var(--space-4)" }}>
          {error.message}
        </p>
      )}
      <HubTemplatesManager
        initialTemplates={(templates ?? []) as HubTemplate[]}
        tracks={(tracks ?? []) as Track[]}
        initialSettings={{
          booking_url: settings?.booking_url ?? null,
          cta_text: settings?.cta_text ?? null,
        } satisfies HubSettings}
      />
    </div>
  );
}
