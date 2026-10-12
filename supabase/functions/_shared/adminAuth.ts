// Shared by every admin-users-* function: resolves the caller from their
// bearer token and checks their profile role/is_super_admin flag. Staff/admin
// functions (hub-send, lead-email-send, ...) each inline an equivalent
// requireStaff check — this file exists because the new functions need the
// stricter super-admin tier too, and three copies of both checks would drift.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface CallerCheck {
  ok: boolean;
  userId?: string;
}

async function resolveCaller(req: Request, admin: SupabaseClient): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const {
    data: { user },
  } = await admin.auth.getUser(token);
  return user ? { userId: user.id } : null;
}

export async function requireStaff(req: Request, admin: SupabaseClient): Promise<CallerCheck> {
  const caller = await resolveCaller(req, admin);
  if (!caller) return { ok: false };
  const { data: profile } = await admin.from("profiles").select("role").eq("id", caller.userId).maybeSingle();
  const ok = !!profile && (profile.role === "staff" || profile.role === "admin");
  return { ok, userId: caller.userId };
}

export async function requireSuperAdmin(req: Request, admin: SupabaseClient): Promise<CallerCheck> {
  const caller = await resolveCaller(req, admin);
  if (!caller) return { ok: false };
  const { data: profile } = await admin.from("profiles").select("is_super_admin").eq("id", caller.userId).maybeSingle();
  return { ok: !!profile?.is_super_admin, userId: caller.userId };
}
