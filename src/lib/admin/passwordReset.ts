import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ActionResult } from "@/lib/admin/team";

/**
 * Checks the 6 digit code from the reset email with Supabase Auth. On success
 * the browser client holds a real session, which is what lets the next screen
 * set a new password.
 */
export async function verifyPasswordResetCode(email: string, code: string): Promise<ActionResult> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: "recovery" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
