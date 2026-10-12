// The password reset code email, and the rules around it. Pure TypeScript with
// no Deno imports so the admin-password-reset function and the Vitest suite run
// the same code.
//
// The code itself is created by Supabase Auth (auth.admin.generateLink returns
// it as email_otp) and is checked by Supabase Auth (verifyOtp, type "recovery").
// Nothing here stores or logs it.

export const OTP_LENGTH = 6;

/** How soon the same address can be sent another code. The sign-in screen waits longer, so a normal resend never hits this. */
export const RESET_MIN_INTERVAL_SECONDS = 20;

/** The Supabase project has to be set to 6 digit codes. Anything else is refused rather than emailed. */
export function isSixDigitCode(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}

/** The oldest send that still counts as "just sent". */
export function throttleCutoff(now: Date): string {
  return new Date(now.getTime() - RESET_MIN_INTERVAL_SECONDS * 1000).toISOString();
}

// The subject never carries the code: subjects are written to email_send_log.
export const RESET_SUBJECT = "Your FFN password reset code";

// Emails cannot use the app's CSS variables, so these are the brand values the
// other FFN emails already use (see hub-send and send-submission-email).
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

export function buildResetOtpEmail(code: string): { subject: string; html: string; text: string } {
  if (!isSixDigitCode(code)) throw new Error("The reset code must be exactly 6 digits");

  const html = shell(`
    <p style="margin:0 0 4px;font-size:11px;color:#616978;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Password reset</p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#0a0c12;line-height:1.25;">Your reset code</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#4e5566;line-height:1.65;">
      Enter this code on the sign-in page to set a new password.
    </p>
    <p style="margin:0 0 24px;padding:16px 0;text-align:center;background:#f6f7f9;border-radius:10px;font-family:'IBM Plex Mono',Consolas,'Courier New',monospace;font-size:32px;font-weight:600;letter-spacing:0.4em;color:#0a0c12;">
      ${code}
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#616978;line-height:1.5;">
      The code works once and expires soon. If it stops working, ask for a new one.
    </p>
    <p style="margin:0;font-size:13px;color:#616978;line-height:1.5;">
      If you did not ask for this, ignore this email. Your password stays the same.
    </p>
  `);

  const text = [
    "Your FFN password reset code",
    "",
    `Code: ${code}`,
    "",
    "Enter this code on the sign-in page to set a new password.",
    "The code works once and expires soon. If it stops working, ask for a new one.",
    "If you did not ask for this, ignore this email. Your password stays the same.",
  ].join("\n");

  return { subject: RESET_SUBJECT, html, text };
}
