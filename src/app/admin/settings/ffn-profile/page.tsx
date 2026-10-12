import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { FfnProfile } from "@/lib/hubs/ffnProfile";
import { FfnProfileEditor } from "./FfnProfileEditor";

export default async function FfnProfileSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: profile, error } = await supabase.from("ffn_profile").select("*").eq("id", true).maybeSingle();

  return (
    <div>
      <h1 className="h1">About FFN</h1>
      <p className="body" style={{ color: "var(--ink-muted)", marginTop: "var(--space-1)", maxWidth: "var(--prose-max)" }}>
        One profile of Founders First Network, used to fill the About, Who it is for, and proof blocks on every hub.
        Everything here is optional. A hub skips any block that has nothing to show.
      </p>
      {error && (
        <p className="body-sm" style={{ color: "var(--danger)", marginTop: "var(--space-4)" }}>
          {error.message}
        </p>
      )}
      <div style={{ marginTop: "var(--space-6)" }}>
        <FfnProfileEditor initialProfile={profile as FfnProfile | null} />
      </div>
    </div>
  );
}
