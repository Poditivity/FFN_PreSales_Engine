// The scheduled functions (escalation-check, digest-dispatch) are called by
// pg_cron. A call is accepted when it carries either the project's service role
// key as the bearer token, or the random token the database keeps in Vault in the
// x-cron-token header (checked by cron_token_ok, which only the service role can
// run). Anyone else is refused, so the public cannot trigger a send.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function isServiceCall(req: Request, admin: SupabaseClient): Promise<boolean> {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (key.length > 0 && bearer === key) return true;

  const cronToken = (req.headers.get("x-cron-token") ?? "").trim();
  if (!cronToken) return false;
  const { data, error } = await admin.rpc("cron_token_ok", { p_token: cronToken });
  return !error && data === true;
}
