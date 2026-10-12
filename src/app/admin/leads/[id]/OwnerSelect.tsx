"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Select } from "@/components/ffn";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export interface OwnerChoice {
  id: string;
  label: string;
}

/**
 * Who on the team looks after this lead. Saves as soon as it changes, the same as
 * a stage move. "Unassigned" clears it.
 */
export function OwnerSelect({ leadId, ownerId, team }: { leadId: string; ownerId: string | null; team: OwnerChoice[] }) {
  const router = useRouter();
  const [value, setValue] = useState(ownerId ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setState("saving");
    setError(null);
    const { error: updateError } = await createBrowserSupabaseClient()
      .from("leads")
      .update({ owner_id: next || null })
      .eq("id", leadId);
    if (updateError) {
      setValue(previous);
      setState("failed");
      setError(updateError.message);
      return;
    }
    setState("saved");
    router.refresh();
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-1)" }}>
      <Select
        size="sm"
        aria-label="Owner"
        value={value}
        disabled={state === "saving"}
        options={[{ value: "", label: "Unassigned" }, ...team.map((m) => ({ value: m.id, label: m.label }))]}
        onChange={(e) => change(e.target.value)}
      />
      <span role="status" aria-live="polite" className="caption" style={{ color: state === "failed" ? "var(--danger)" : "var(--success)" }}>
        {state === "saved" ? "Owner saved." : state === "failed" ? `Could not save the owner: ${error}` : ""}
      </span>
    </div>
  );
}
