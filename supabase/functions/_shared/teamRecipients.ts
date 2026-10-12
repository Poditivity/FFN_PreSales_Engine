// Who the team alerts go to: the same people who are told about new
// submissions. Admin profiles that have not been switched off on the Team page
// (profiles.receive_notifications), plus every active address on the
// notification_emails list, de-duplicated.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface TeamRecipient {
  email: string;
  ref: string | null;
}

export async function loadTeamRecipients(admin: SupabaseClient): Promise<TeamRecipient[]> {
  const [{ data: profiles }, { data: extra }] = await Promise.all([
    admin.from("profiles").select("id, email").eq("role", "admin").eq("receive_notifications", true),
    admin.from("notification_emails").select("email").eq("active", true),
  ]);

  const out: TeamRecipient[] = [];
  const add = (email: unknown, ref: unknown) => {
    const address = String(email ?? "").trim();
    if (!address || out.some((r) => r.email.toLowerCase() === address.toLowerCase())) return;
    out.push({ email: address, ref: ref ? String(ref) : null });
  };
  for (const p of (profiles ?? []) as Record<string, unknown>[]) add(p.email, p.id);
  for (const n of (extra ?? []) as Record<string, unknown>[]) add(n.email, null);
  return out;
}
