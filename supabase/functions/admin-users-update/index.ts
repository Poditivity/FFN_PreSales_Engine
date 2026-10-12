// admin-users-update — super-admin-only. Changes a team member's role,
// super-admin flag, or active status, or permanently deletes their account.
// Two guards prevent locking every super admin out of their own
// team-management page: a super admin can't deactivate (or delete)
// themselves, and the last active super admin can't be deactivated, demoted,
// or deleted by anyone. Deletion additionally requires the account already
// be deactivated — a deliberate two-step "pause, then confirm" path for an
// action with no undo (auth.users cascades to profiles on delete).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireSuperAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Supabase's Admin API models a permanent ban as a very long, not infinite,
// duration — this is the value its own dashboard uses for "ban forever".
const PERMANENT_BAN_DURATION = "876000h";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isActive(bannedUntil: string | null | undefined): boolean {
  return !bannedUntil || new Date(bannedUntil).getTime() <= Date.now();
}

// True if `excludeId` is the only active super admin left (or there are
// none), i.e. removing/deactivating them would leave zero.
async function isLastActiveSuperAdmin(admin: SupabaseClient, excludeId: string): Promise<boolean> {
  const { data: superAdmins } = await admin.from("profiles").select("id").eq("is_super_admin", true).neq("id", excludeId);
  for (const row of superAdmins ?? []) {
    const { data: authUser } = await admin.auth.admin.getUserById(row.id);
    if (isActive(authUser?.user?.banned_until)) return false;
  }
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const caller = await requireSuperAdmin(req, admin);
  if (!caller.ok) return json({ error: "Super admin authentication required" }, 401);

  let id = "";
  let action = "";
  let role: string | undefined;
  let superAdmin: boolean | undefined;
  let notifications: boolean | undefined;
  try {
    const body = await req.json();
    id = String(body.id ?? "");
    action = String(body.action ?? "");
    role = body.role !== undefined ? String(body.role) : undefined;
    superAdmin = typeof body.superAdmin === "boolean" ? body.superAdmin : undefined;
    notifications = typeof body.notifications === "boolean" ? body.notifications : undefined;
    if (!id) throw new Error("id is required");
    if (!["set_role", "deactivate", "reactivate", "set_super_admin", "set_notifications", "delete"].includes(action)) {
      throw new Error("action must be one of set_role, deactivate, reactivate, set_super_admin, set_notifications, delete");
    }
  } catch (e: unknown) {
    return json({ error: (e as Error).message }, 400);
  }

  const { data: target } = await admin.from("profiles").select("id, is_super_admin").eq("id", id).maybeSingle();
  if (!target) return json({ error: "Team member not found" }, 404);

  if (action === "deactivate") {
    if (id === caller.userId) return json({ error: "You can't deactivate your own account" }, 422);
    if (target.is_super_admin && (await isLastActiveSuperAdmin(admin, id))) {
      return json({ error: "At least one active super admin is required" }, 422);
    }
    const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: PERMANENT_BAN_DURATION });
    if (error) return json({ error: error.message }, 500);
    // A deactivated person must stop getting team email. Reactivating leaves it
    // off; a super admin switches it back on if they want it.
    const { error: notifyError } = await admin
      .from("profiles")
      .update({ receive_notifications: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (notifyError) return json({ error: notifyError.message }, 500);
    return json({ ok: true });
  }

  if (action === "reactivate") {
    const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: "none" });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  if (action === "delete") {
    if (id === caller.userId) return json({ error: "You can't delete your own account" }, 422);
    const { data: targetAuthUser } = await admin.auth.admin.getUserById(id);
    if (isActive(targetAuthUser?.user?.banned_until)) {
      return json({ error: "Deactivate this account before deleting it" }, 422);
    }
    if (target.is_super_admin && (await isLastActiveSuperAdmin(admin, id))) {
      return json({ error: "At least one active super admin is required" }, 422);
    }
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  if (action === "set_role") {
    if (role !== "staff" && role !== "admin") return json({ error: "role must be 'staff' or 'admin'" }, 400);
    const { error } = await admin.from("profiles").update({ role, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  if (action === "set_notifications") {
    if (notifications === undefined) return json({ error: "notifications (boolean) is required" }, 400);
    const { error } = await admin
      .from("profiles")
      .update({ receive_notifications: notifications, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  // set_super_admin
  if (superAdmin === undefined) return json({ error: "superAdmin (boolean) is required" }, 400);
  if (!superAdmin && target.is_super_admin && (await isLastActiveSuperAdmin(admin, id))) {
    return json({ error: "At least one active super admin is required" }, 422);
  }
  const { error } = await admin.from("profiles").update({ is_super_admin: superAdmin, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
