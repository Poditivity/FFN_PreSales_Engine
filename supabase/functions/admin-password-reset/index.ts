// admin-password-reset — public (no auth required, that's the point: this is
// how a staff/admin who's locked out gets back in). Emails a 6 digit one-time
// code, not a link: the person types it on the sign-in screen, which checks it
// with Supabase Auth (verifyOtp, type "recovery") and only then lets them set a
// new password.
//
// Always responds with the same generic success regardless of whether the email
// matches anything, so the endpoint can't be used to enumerate admin accounts.
// The code comes from auth.admin.generateLink (email_otp), so there is no
// dependency on Supabase's own Recovery email template, and it is sent through
// ZeptoMail only (no fallback to another provider). It is never logged.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email.ts";
import { buildResetOtpEmail, isSixDigitCode, throttleCutoff } from "../_shared/passwordResetOtp.ts";

const SOURCE = "admin-password-reset";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GENERIC_RESPONSE = { ok: true, message: "If that email has an admin account, a code is on its way." };

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

  let email = "";
  try {
    const body = await req.json();
    email = String(body.email ?? "").trim().toLowerCase();
    if (!email) throw new Error("email is required");
  } catch (e: unknown) {
    return json({ error: (e as Error).message }, 400);
  }

  const { data: profile } = await admin.from("profiles").select("id, role").eq("email", email).maybeSingle();
  if (!profile || (profile.role !== "staff" && profile.role !== "admin")) {
    // Same response as the success path below — existence of the account
    // must not be observable from the outside.
    return json(GENERIC_RESPONSE);
  }

  // Stops a resend button (or a script) from filling someone's inbox. Answers
  // with the same generic reply, so it reveals nothing either.
  const { count: recent } = await admin
    .from("email_send_log")
    .select("id", { count: "exact", head: true })
    .eq("source", SOURCE)
    .contains("to_emails", [email])
    .gte("created_at", throttleCutoff(new Date()));
  if ((recent ?? 0) > 0) return json(GENERIC_RESPONSE);

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "recovery", email });
  const code = linkData?.properties?.email_otp;
  if (linkError || !isSixDigitCode(code)) {
    // Either Auth failed or the project is set to a code length other than 6.
    // Say why in the function logs (never the code), and keep the reply generic.
    console.error(`[${SOURCE}] no usable 6 digit code`, linkError?.message ?? `length ${String(code ?? "").length}`);
    return json(GENERIC_RESPONSE);
  }

  const { subject, html, text } = buildResetOtpEmail(code);
  const result = await sendEmail([email], subject, html, undefined, SOURCE, { text });
  if (!result.ok) console.error(`[${SOURCE}] ZeptoMail send failed`, result.error);

  return json(GENERIC_RESPONSE);
});
