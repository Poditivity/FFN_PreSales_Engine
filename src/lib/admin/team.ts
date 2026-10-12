import { isValidEmail } from "@/lib/forms/formLogic";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { readFunctionError } from "@/lib/supabase/functionError";

export type AdminRole = "staff" | "admin";

export interface AdminTeamMember {
  id: string;
  email: string;
  fullName: string | null;
  role: AdminRole;
  isSuperAdmin: boolean;
  /** Whether this person is emailed about new submissions. Set by a super admin. */
  receiveNotifications: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  active: boolean;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Invite only: the email already had an account, so nothing was sent. */
  alreadyExisted?: boolean;
}

/** The sentence the function chose, rather than supabase-js's generic "non-2xx status code". */
async function messageFrom(error: { message: string }): Promise<string> {
  const { message } = await readFunctionError(error);
  return message ?? error.message;
}

export async function listAdminTeam(): Promise<{ members: AdminTeamMember[] } & ActionResult> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.functions.invoke("admin-users-list");
  if (error) return { ok: false, error: await messageFrom(error), members: [] };
  if (data?.error) return { ok: false, error: data.error, members: [] };
  // An older admin-users-list does not send the flag; everyone was notified then.
  const members = ((data.members ?? []) as AdminTeamMember[]).map((m) => ({ ...m, receiveNotifications: m.receiveNotifications !== false }));
  return { ok: true, members };
}

export type InviteRole = "admin" | "super_admin";

export interface InviteInput {
  email: string;
  name?: string;
  /** Admin or Super admin. A super admin is an admin who can also manage the team. */
  role: InviteRole;
  /** Whether the new member is told about new submissions, escalations and summaries. */
  notifications: boolean;
}

/** The sentence to show when an invite is not ready to send, or null when it is. */
export function validateInvite(input: Pick<InviteInput, "email">): { email: string | null } {
  const email = input.email.trim();
  if (!email) return { email: "Enter an email address." };
  if (!isValidEmail(email)) return { email: "Enter a valid email address." };
  return { email: null };
}

export async function inviteAdminTeamMember(input: InviteInput): Promise<ActionResult> {
  const problem = validateInvite(input).email;
  if (problem) return { ok: false, error: problem };
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.functions.invoke("admin-users-invite", {
    body: {
      email: input.email.trim(),
      name: input.name?.trim() || undefined,
      role: "admin" satisfies AdminRole,
      superAdmin: input.role === "super_admin",
      notifications: input.notifications,
    },
  });
  if (error) return { ok: false, error: await messageFrom(error) };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true, alreadyExisted: data?.alreadyExisted === true };
}

export async function setAdminTeamMemberSuperAdmin(id: string, superAdmin: boolean): Promise<ActionResult> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.functions.invoke("admin-users-update", { body: { id, action: "set_super_admin", superAdmin } });
  if (error) return { ok: false, error: await messageFrom(error) };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true };
}

export async function setAdminTeamMemberNotifications(id: string, notifications: boolean): Promise<ActionResult> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.functions.invoke("admin-users-update", {
    body: { id, action: "set_notifications", notifications },
  });
  if (error) return { ok: false, error: await messageFrom(error) };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true };
}

export async function setAdminTeamMemberActive(id: string, active: boolean): Promise<ActionResult> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.functions.invoke("admin-users-update", {
    body: { id, action: active ? "reactivate" : "deactivate" },
  });
  if (error) return { ok: false, error: await messageFrom(error) };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true };
}

export async function deleteAdminTeamMember(id: string): Promise<ActionResult> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.functions.invoke("admin-users-update", { body: { id, action: "delete" } });
  if (error) return { ok: false, error: await messageFrom(error) };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true };
}

export async function requestAdminPasswordReset(email: string): Promise<ActionResult> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.functions.invoke("admin-password-reset", { body: { email } });
  if (error) return { ok: false, error: await messageFrom(error) };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true };
}
