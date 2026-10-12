// send-mail — thin HTTP wrapper around the shared mail core (_shared/email.ts).
// Used both as a real send path for future modules and as the Phase 0
// verification endpoint: it reads the recipient/subject/html from the
// request body rather than hardcoding a test address.
//
// Staff-only. It sends any subject and body to any address from the FFN
// domain, so an open endpoint would let anyone holding the public anon key
// send spam as FFN and ruin the domain's standing with every inbox provider.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireStaff } from "../_shared/adminAuth.ts";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  if (!(await requireStaff(req, admin)).ok) {
    return new Response(JSON.stringify({ ok: false, error: "Staff authentication required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: {
    to?: string | string[];
    subject?: string;
    html?: string;
    text?: string;
    source?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { to, subject, html, text, source } = body;
  if (!to) {
    return new Response(JSON.stringify({ ok: false, error: "\"to\" is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = await sendEmail(
    to,
    subject ?? "Founders First Network — test send",
    html ?? "<p>This is a test send from the FFN Presales Engine mail infrastructure.</p>",
    undefined,
    source ?? "send-mail-manual-test",
    text ? { text } : undefined,
  );

  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 502,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
