// admin-users-list — any staff/admin can view (read-only team directory);
// only admin-users-invite/admin-users-update require super admin to change
// anything. Lists staff/admin profiles with their live Auth status (banned,
// last sign-in, email confirmed). Deliberately excludes founder-role
// profiles: this is a team-management view, not a full user directory, and
// scoping to staff/admin keeps getUserById calls (one per row — this team
// is small, unlike the founder base) bounded.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireStaff } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const caller = await requireStaff(req, admin);
  if (!caller.ok) return json({ error: "Staff authentication required" }, 401);

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, email, full_name, role, is_super_admin, receive_notifications, created_at")
    .in("role", ["staff", "admin"])
    .order("created_at", { ascending: true });
  if (error) return json({ error: error.message }, 500);

  const members = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data: authUser } = await admin.auth.admin.getUserById(p.id);
      const bannedUntil = authUser?.user?.banned_until ?? null;
      const active = !bannedUntil || new Date(bannedUntil).getTime() <= Date.now();
      return {
        id: p.id,
        email: p.email,
        fullName: p.full_name,
        role: p.role,
        isSuperAdmin: p.is_super_admin,
        receiveNotifications: p.receive_notifications !== false,
        createdAt: p.created_at,
        lastSignInAt: authUser?.user?.last_sign_in_at ?? null,
        emailConfirmedAt: authUser?.user?.email_confirmed_at ?? null,
        active,
      };
    }),
  );

  return json({ members });
});
