import { describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({ functions: { invoke } }) }));

import { inviteAdminTeamMember, setAdminTeamMemberSuperAdmin, validateInvite } from "./team";

describe("validateInvite", () => {
  it("asks for an address, and a valid one", () => {
    expect(validateInvite({ email: "" }).email).toBe("Enter an email address.");
    expect(validateInvite({ email: "   " }).email).toBe("Enter an email address.");
    expect(validateInvite({ email: "ada@" }).email).toBe("Enter a valid email address.");
    expect(validateInvite({ email: "a b@c.com" }).email).toBe("Enter a valid email address.");
    expect(validateInvite({ email: " ada@example.com " }).email).toBeNull();
  });
});

describe("inviteAdminTeamMember", () => {
  it("does not call the server with an invalid address", async () => {
    invoke.mockReset();
    expect(await inviteAdminTeamMember({ email: "nope", role: "admin", notifications: true })).toEqual({
      ok: false,
      error: "Enter a valid email address.",
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("sends an admin invite with notifications on", async () => {
    invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
    expect(await inviteAdminTeamMember({ email: " ada@example.com ", name: " Ada ", role: "admin", notifications: true })).toEqual({ ok: true, alreadyExisted: false });
    expect(invoke).toHaveBeenCalledWith("admin-users-invite", {
      body: { email: "ada@example.com", name: "Ada", role: "admin", superAdmin: false, notifications: true },
    });
  });

  it("sends a super admin as an admin with the super admin flag, and notifications off", async () => {
    invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
    await inviteAdminTeamMember({ email: "ada@example.com", role: "super_admin", notifications: false });
    expect(invoke.mock.calls[0][1].body).toMatchObject({ role: "admin", superAdmin: true, notifications: false, name: undefined });
  });

  it("passes the server's error back", async () => {
    invoke.mockReset().mockResolvedValue({ data: { error: "Super admin authentication required" }, error: null });
    expect(await inviteAdminTeamMember({ email: "ada@example.com", role: "admin", notifications: true })).toEqual({
      ok: false,
      error: "Super admin authentication required",
    });
  });

  it("reports when the email already had an account, so nothing was sent", async () => {
    invoke.mockReset().mockResolvedValue({ data: { ok: true, alreadyExisted: true }, error: null });
    expect(await inviteAdminTeamMember({ email: "ada@example.com", role: "admin", notifications: true })).toEqual({
      ok: true,
      alreadyExisted: true,
    });
  });

  it("shows the function's own sentence instead of the generic non-2xx text", async () => {
    const context = { json: async () => ({ error: "At least one active super admin is required" }) };
    invoke.mockReset().mockResolvedValue({ data: null, error: { message: "Edge Function returned a non-2xx status code", context } });
    expect(await setAdminTeamMemberSuperAdmin("u1", false)).toEqual({
      ok: false,
      error: "At least one active super admin is required",
    });
  });
});
