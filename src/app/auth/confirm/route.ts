import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

// Handles the magic-link callback via token_hash + type (PKCE-style,
// server-verified) rather than Supabase's default hosted /auth/v1/verify
// redirect, which hands back the session as a URL hash fragment. A hash
// fragment only gets processed by client-side JS, but proxy.ts checks for
// a session cookie on the server before any client JS runs — so with the
// default flow, the very first request to /admin/forms always looks
// signed-out and bounces back to /admin/login. Verifying token_hash here,
// server-side, sets the session cookie before the redirect ever happens.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/admin/forms";

  if (token_hash && type) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          },
        },
      },
    );

    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      // `next` echoes whatever emailRedirectTo was passed at sign-in time
      // (via the email template's {{ .RedirectTo }}), which is already a
      // full URL — only prefix the origin if it turns out to be relative.
      const destination = next.startsWith("http") ? next : `${origin}${next}`;
      return NextResponse.redirect(destination);
    }
  }

  return NextResponse.redirect(`${origin}/admin/login?error=invalid_link`);
}
