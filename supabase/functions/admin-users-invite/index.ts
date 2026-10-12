// admin-users-invite — super-admin-only. Invites a new staff/admin member by
// email, or (if a profile with that email already exists) just retargets
// their role. The invite also carries whether the person is a super admin and
// whether they receive notifications, so a new member starts configured. Sends
// its own branded email through the shared mail infra (_shared/email.ts, same as hub-send) rather than relying on Supabase's own
// Auth email templates — those are configured for the existing magic-link
// flow's token_hash link shape, and invite/recovery would need their own
// dashboard template work this function sidesteps entirely by generating the
// link itself and emailing it directly.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireSuperAdmin } from "../_shared/adminAuth.ts";
import { notify } from "../_shared/notify.ts";

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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function shell(inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:'Segoe UI',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
  <tr><td align="center">
    <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(10,12,18,0.09);" cellpadding="0" cellspacing="0">
      <tr><td style="background:#0a0c12;padding:20px 28px;">
        <span style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8098ff;font-weight:600;font-family:'Segoe UI',Arial,sans-serif;">Founders First Network</span>
      </td></tr>
      <tr><td style="padding:32px 28px 28px;">${inner}</td></tr>
      <tr><td style="padding:14px 28px;background:#f6f7f9;border-top:1px solid #e3e6ec;">
        <p style="margin:0;font-size:11px;color:#616978;text-align:center;">Founders First Network</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// Same rule as isValidEmail in src/lib/forms/formLogic.ts.
const EMAIL_RE = /^[^\s@.]+(\.[^\s@.]+)*@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;

function inviteEmailHtml(actionLink: string, role: string, name: string | null): string {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return shell(`
    <p style="margin:0 0 4px;font-size:11px;color:#616978;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">You've been invited</p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#0a0c12;line-height:1.25;">${greeting}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#4e5566;line-height:1.65;">
      You've been added to the FFN admin team as <strong style="color:#0a0c12;">${escapeHtml(role)}</strong>. Set your password to finish setting up your account.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td style="background:#0a0c12;border-radius:10px;">
        <a href="${escapeHtml(actionLink)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Set your password</a>
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:#616978;line-height:1.5;">&mdash; The Founders First Network Team</p>
  `);
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

  let email = "";
  let role = "";
  let name: string | null = null;
  let superAdmin = false;
  let notifications: boolean | undefined;
  try {
    const body = await req.json();
    email = String(body.email ?? "").trim().toLowerCase();
    role = String(body.role ?? "");
    name = body.name ? String(body.name).trim() || null : null;
    if (body.superAdmin !== undefined) superAdmin = body.superAdmin === true;
    if (typeof body.notifications === "boolean") notifications = body.notifications;
    if (!email) throw new Error("email is required");
    if (!EMAIL_RE.test(email)) throw new Error("Enter a valid email address");
    if (role !== "staff" && role !== "admin") throw new Error("role must be 'staff' or 'admin'");
    if (superAdmin && role !== "admin") throw new Error("A super admin must have the admin role");
  } catch (e: unknown) {
    return json({ error: (e as Error).message }, 400);
  }

  const { data: existing } = await admin.from("profiles").select("id, role, full_name").eq("email", email).maybeSingle();

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (existing.role !== role) patch.role = role;
    if (name && !existing.full_name) patch.full_name = name;
    // Only ever grant here. Taking super admin away goes through
    // admin-users-update, which guards the last active super admin.
    if (superAdmin) patch.is_super_admin = true;
    // Notifications are left as they are: inviting someone who already has an
    // account must not quietly change what they are emailed.
    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await admin.from("profiles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", existing.id);
      if (updateError) return json({ error: updateError.message }, 500);
    }
    return json({ ok: true, alreadyExisted: true });
  }

  const siteUrl = Deno.env.get("SITE_URL") || req.headers.get("origin") || "";
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "invite", email });
  if (linkError || !linkData?.properties?.hashed_token || !linkData.user) {
    return json({ error: linkError?.message ?? "Could not create an invite for this email" }, 500);
  }

  const { error: roleError } = await admin
    .from("profiles")
    .update({
      role,
      full_name: name,
      is_super_admin: superAdmin,
      receive_notifications: notifications ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", linkData.user.id);
  if (roleError) return json({ error: roleError.message }, 500);

  const actionLink = `${siteUrl}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=invite&next=/admin/set-password`;
  // ADMIN_INVITE is email-only in the notification registry: the link grants
  // an account, so it only ever goes to the address being invited.
  const { email: result } = await notify({
    type: "ADMIN_INVITE",
    recipient: { email, ref: linkData.user.id },
    source: "admin-users-invite",
    email: { subject: "You're invited to the FFN admin team", html: inviteEmailHtml(actionLink, superAdmin ? "super admin" : role, name) },
    data: {},
  });
  if (!result.ok) return json({ error: result.error ?? "Invite created but the email failed to send" }, 502);

  return json({ ok: true });
});
