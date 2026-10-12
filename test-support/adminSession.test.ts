import { beforeEach, describe, expect, it, vi } from "vitest";

const updateUserById = vi.fn();
const createUser = vi.fn();
let existingProfile: { id: string } | null = null;

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: existingProfile }) }) }) }),
    auth: { admin: { updateUserById, createUser } },
  }),
}));

import { ensureTestUser, isDisposableTestEmail, TEST_ADMIN_EMAIL } from "./adminSession";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  updateUserById.mockReset().mockResolvedValue({ error: null });
  createUser.mockReset().mockResolvedValue({ data: { user: { id: "new-id" } }, error: null });
  existingProfile = null;
});

describe("isDisposableTestEmail", () => {
  it("accepts example.com and addresses with e2e in the name", () => {
    for (const email of ["e2e-admin@example.com", "password-reset-e2e-1@example.com", "someone@example.com", "E2E-Admin@Company.com", "ci-e2e@foundersfirstnetwork.com"]) {
      expect(isDisposableTestEmail(email)).toBe(true);
    }
  });

  it("refuses an address that could be a person's own login", () => {
    for (const email of ["devidinymisha05@gmail.com", "ananya@foundersfirstnetwork.com", "poditivity.company@gmail.com", "x@notexample.com", ""]) {
      expect(isDisposableTestEmail(email)).toBe(false);
    }
  });

  it("makes the default test admin disposable", () => {
    expect(isDisposableTestEmail(TEST_ADMIN_EMAIL)).toBe(true);
  });
});

describe("ensureTestUser", () => {
  it("never resets the password of an existing account that is not a test account", async () => {
    existingProfile = { id: "real-person" };
    await expect(ensureTestUser("devidinymisha05@gmail.com", "ci-password")).rejects.toThrow(/Refusing to reset the password/);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("resets an existing disposable account", async () => {
    existingProfile = { id: "test-id" };
    expect(await ensureTestUser("e2e-admin@example.com", "ci-password")).toBe("test-id");
    expect(updateUserById).toHaveBeenCalledWith("test-id", { password: "ci-password", email_confirm: true, ban_duration: "none" });
  });

  it("creates a new account when there is none", async () => {
    expect(await ensureTestUser("e2e-admin@example.com", "ci-password")).toBe("new-id");
    expect(createUser).toHaveBeenCalled();
    expect(updateUserById).not.toHaveBeenCalled();
  });
});
