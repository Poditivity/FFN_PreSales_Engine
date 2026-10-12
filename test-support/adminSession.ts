// Shared by the Phase 2 leads-pipeline Vitest integration test (mintSession
// et al. below) and the Playwright e2e suite (loginAsAdmin/loginAsUser,
// further down): mints a real Supabase session for a given email without an
// actual email round-trip.
//
// mintSession still uses the service-role `auth.admin.generateLink` +
// `verifyOtp` (magiclink) pattern — that's a backend RLS-testing shortcut,
// unrelated to and unaffected by the admin login *page* now using
// email/password (Supabase Auth itself still supports minting an OTP
// session directly via the API regardless of what the UI offers). The
// Playwright helpers below instead drive the real password-based login
// form, since those tests are exercising the actual product UI.
//
// Requires SUPABASE_SERVICE_ROLE_KEY, which is not needed anywhere else in
// this repo's test suite — only these DB/RLS-level tests and e2e login mint
// a session/account directly instead of going through email delivery.
import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

export interface MintedSession {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — this test needs it to run.`);
  return value;
}

/**
 * Generates a login link for `email` via the service role and returns just
 * its token_hash — creating the user first if they don't exist yet (a
 * fresh email gets `handle_new_user`'s default profile, role 'founder',
 * i.e. not admin/staff). Hand this to the app's own /auth/confirm route
 * (?token_hash=...&type=email) to get a real, correctly-set session cookie
 * in a browser — that route already does the verifyOtp call server-side.
 */
export async function generateLoginTokenHash(email: string): Promise<string> {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.hashed_token) {
    throw new Error(`Could not generate a login link for ${email}: ${error?.message ?? "no hashed_token returned"}`);
  }
  return data.properties.hashed_token;
}

/**
 * Mints a real session for `email` directly via supabase-js (no browser) —
 * verifies the same token_hash generateLoginTokenHash() produces, using the
 * anon client, exactly like the app's /auth/confirm route does.
 */
export async function mintSession(email: string): Promise<MintedSession> {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const tokenHash = await generateLoginTokenHash(email);

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });
  if (verifyError || !verified.session || !verified.user) {
    throw new Error(`Could not verify the generated login link for ${email}: ${verifyError?.message}`);
  }

  return {
    accessToken: verified.session.access_token,
    refreshToken: verified.session.refresh_token,
    userId: verified.user.id,
  };
}

/** A supabase-js client authenticated as the given minted session — RLS applies as that real user. */
export function createSessionClient(session: MintedSession) {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session.accessToken}` } },
  });
}

/** A supabase-js client with the service role key — bypasses RLS entirely, for test setup/assertions. */
export function createServiceRoleClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * The account the e2e suite signs in as. A dedicated, disposable address that
 * the suite creates and resets on every run, so it must never be a real
 * person's login. Override with ADMIN_TEST_EMAIL, which must also be disposable.
 */
export const TEST_ADMIN_EMAIL = process.env.ADMIN_TEST_EMAIL ?? "e2e-admin@example.com";

/** An address the suite may freely create and reset: example.com, or one with "e2e" in its name. */
export function isDisposableTestEmail(email: string): boolean {
  const [local = "", domain = ""] = email.toLowerCase().split("@");
  return domain === "example.com" || /e2e/.test(local);
}

// --- Password-auth Playwright helpers -------------------------------------
//
// Ensures `email` exists as a real Supabase Auth user with a known password
// (creating it via the Admin API if it's never signed up before, or resetting
// its password + clearing any ban otherwise), independent of role — role is
// a separate step via setTestUserRole, since not every caller wants the same
// role (admin-team.spec.ts needs both a super admin and a plain staff
// account). Returns the user's id.
export async function ensureTestUser(email: string, password: string): Promise<string> {
  const admin = createServiceRoleClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();

  if (profile?.id) {
    // This overwrites the account's password. These tests run against the real
    // project, so it must never be done to a person's own login: that is how a
    // staff member's password was reset by a CI run. Only accounts that are
    // plainly disposable are touched.
    if (!isDisposableTestEmail(email)) {
      throw new Error(
        `Refusing to reset the password of ${email}: it is not a disposable test account. ` +
          `Point ADMIN_TEST_EMAIL at a dedicated address such as ${TEST_ADMIN_EMAIL}.`,
      );
    }
    const { error } = await admin.auth.admin.updateUserById(profile.id, {
      password,
      email_confirm: true,
      ban_duration: "none",
    });
    if (error) throw new Error(`Could not reset password for ${email}: ${error.message}`);
    return profile.id;
  }

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Could not create test user ${email}: ${error?.message ?? "no user returned"}`);
  return data.user.id;
}

/** Sets a test user's role/super-admin flag directly (service role bypasses the profiles privilege-column guard). */
export async function setTestUserRole(userId: string, role: "founder" | "staff" | "admin", isSuperAdmin = false): Promise<void> {
  const admin = createServiceRoleClient();
  const { error } = await admin.from("profiles").update({ role, is_super_admin: isSuperAdmin }).eq("id", userId);
  if (error) throw new Error(`Could not set role for ${userId}: ${error.message}`);
}

/** Drives the real /admin/login form as an already-provisioned user. Assumes ensureTestUser has already run for this email. */
export async function loginAsUser(page: Page, email: string, password: string, next = "/admin/forms"): Promise<void> {
  await page.goto(`/admin/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password\s*\*?$/).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === next, { timeout: 15_000 });
}

/**
 * The one-call replacement for the old generateLoginTokenHash + /auth/confirm
 * navigation: provisions `email` as a super admin with a known password (from
 * ADMIN_TEST_PASSWORD) and drives the real login form. Used by every e2e spec
 * that just needs "a logged-in admin" rather than testing a specific role.
 */
export async function loginAsAdmin(page: Page, email: string, next = "/admin/forms"): Promise<void> {
  const password = requireEnv("ADMIN_TEST_PASSWORD");
  const userId = await ensureTestUser(email, password);
  await setTestUserRole(userId, "admin", true);
  // The test admin is not a person, so it must not be sent submission emails or summaries.
  await createServiceRoleClient().from("profiles").update({ receive_notifications: false }).eq("id", userId);
  await loginAsUser(page, email, password, next);
}
