import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ffn";
import { TeamManager } from "./TeamManager";

// Any staff/admin can view this page (read-only) — only super admins get the
// invite/role/deactivate/delete controls. A founder (or signed-out visitor,
// though proxy.ts already bounces those) gets neither. The underlying
// admin-users-* edge functions enforce the same split server-side — this is
// a UI-level gate, not the only one.
export default async function TeamPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role, is_super_admin").eq("id", user.id).maybeSingle()
    : { data: null };

  const isAdmin = profile?.role === "staff" || profile?.role === "admin";
  const isSuperAdmin = !!profile?.is_super_admin;

  if (!isAdmin) {
    return (
      <div>
        <h1 className="h1">Team</h1>
        <div style={{ marginTop: "var(--space-6)" }}>
          <Alert tone="danger" title="Admin access required">
            Only staff and admins can view the team.
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="h1">Team</h1>
      <p className="body-sm" style={{ color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
        {isSuperAdmin
          ? "Invite admins, grant or revoke super admin, and deactivate accounts."
          : "Everyone with admin access to FFN Presales Engine."}
      </p>
      <div style={{ marginTop: "var(--space-6)" }}>
        <TeamManager readOnly={!isSuperAdmin} />
      </div>
    </div>
  );
}
