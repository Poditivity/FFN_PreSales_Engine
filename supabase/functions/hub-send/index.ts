// hub-send — staff-only. Sends the single hub-ready notification email
// (Phase 5's full Email Engine is explicitly out of scope for this phase)
// through the shared mail infra (_shared/email.ts, same as every other
// FFN email), then flips a still-draft hub to 'sent'.
//
// The wording is an editable template (system_key "hub_ready", see
// ../_shared/systemTemplates.ts); this file only supplies the branded shell
// around it, built from FFN's own design tokens.
//
// Identity (name/email) resolution lives in ../_shared/hubIdentity.ts,
// shared with hub-hydrate — the same "one shared file" shape as
// ../_shared/email.ts, not two independently drifting copies.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveHubIdentity } from "../_shared/hubIdentity.ts";
import { notify } from "../_shared/notify.ts";
import { loadSystemTemplate, renderSystemEmail } from "../_shared/systemEmail.ts";

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

async function requireStaff(req: Request, admin: SupabaseClient): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const {
    data: { user },
  } = await admin.auth.getUser(token);
  if (!user) return false;
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return !!profile && (profile.role === "staff" || profile.role === "admin");
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  if (!(await requireStaff(req, admin))) return json({ error: "Staff authentication required" }, 401);

  let hubId = "";
  try {
    const body = await req.json();
    hubId = String(body.hubId ?? "");
    if (!hubId) throw new Error("hubId is required");
  } catch (e: unknown) {
    return json({ error: (e as Error).message }, 400);
  }

  const { data: hub, error: hubError } = await admin.from("hubs").select("*").eq("id", hubId).maybeSingle();
  if (hubError || !hub) return json({ error: "Hub not found" }, 404);

  const { data: track } = await admin.from("tracks").select("id, name").eq("id", hub.track_id).maybeSingle();

  const identity = await resolveHubIdentity(hub);
  if (!identity.email) return json({ error: "This applicant has no email address on file" }, 422);

  const { data: settings } = await admin.from("hub_settings").select("booking_url").eq("id", true).maybeSingle();

  // No SITE_URL secret to configure: the staff browser calling this function
  // already carries the real site origin in its request, so use that —
  // falls back to an explicit SITE_URL secret for any non-browser caller.
  const siteUrl = Deno.env.get("SITE_URL") || req.headers.get("origin") || "";
  const hubUrl = `${siteUrl}/hub/${hub.token}`;
  const trackName = track?.name ?? "your";
  // The hub-ready email is the "hub_ready" system template, which staff edit under
  // Messaging. Without a stored row the built-in default is sent.
  const { subject, html: inner } = renderSystemEmail("hub_ready", await loadSystemTemplate(admin, "hub_ready"), {
    name: identity.name,
    vars: { track: trackName, hub_link: hubUrl, booking_link: settings?.booking_url ?? "" },
  });
  const html = shell(inner);

  // WhatsApp (to the lead's phone answer, or a standalone hub's
  // applicant_whatsapp) goes out alongside the email; only the email outcome
  // decides this response, exactly as before.
  const { email: result, whatsapp } = await notify({
    type: "HUB_READY",
    recipient: { email: identity.email, phone: identity.phone, ref: hub.id },
    source: "hub-send",
    email: { subject, html },
    data: { name: identity.name, trackName: track?.name ?? "", hubUrl },
  });
  if (!result.ok) return json({ error: result.error ?? "Send failed" }, 502);

  // Only flip a still-draft hub — resending an already-sent/opened hub must
  // never regress its status (same guard shape as the opened-status check
  // in hub-hydrate).
  await admin.from("hubs").update({ status: "sent" }).eq("id", hub.id).eq("status", "draft");

  return json({ ok: true, whatsapp: whatsapp.status });
});
