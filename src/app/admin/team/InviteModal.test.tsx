import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const inviteAdminTeamMember = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ auth: { getUser: () => Promise.resolve({ data: { user: { id: "me" } } }) } }),
}));
vi.mock("@/lib/admin/team", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/team")>()),
  listAdminTeam: () => Promise.resolve({ ok: true, members: [] }),
  inviteAdminTeamMember: (...a: unknown[]) => inviteAdminTeamMember(...a),
}));

import { TeamManager } from "./TeamManager";

async function openInvite() {
  render(<TeamManager />);
  fireEvent.click(await screen.findByRole("button", { name: "Invite team member" }));
}

beforeEach(() => {
  inviteAdminTeamMember.mockReset().mockResolvedValue({ ok: true });
});

describe("Invite team member", () => {
  it("asks for a role, Admin or Super admin, and whether they get notifications", async () => {
    await openInvite();
    const role = screen.getByLabelText("Role");
    expect([...role.querySelectorAll("option")].map((o) => o.textContent)).toEqual(["Admin", "Super admin"]);
    expect(role).toHaveValue("admin");
    const notifications = screen.getByLabelText("Notifications");
    expect([...notifications.querySelectorAll("option")].map((o) => o.textContent)).toEqual(["Yes", "No"]);
    expect(notifications).toHaveValue("yes");
  });

  it("says what a super admin can do when that role is picked", async () => {
    await openInvite();
    expect(screen.getByText(/Cannot manage the team/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "super_admin" } });
    expect(screen.getByText(/invite, promote or deactivate other team members/)).toBeInTheDocument();
  });

  it("sends the chosen role and notifications setting", async () => {
    await openInvite();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "super_admin" } });
    fireEvent.change(screen.getByLabelText("Notifications"), { target: { value: "no" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
    await waitFor(() =>
      expect(inviteAdminTeamMember).toHaveBeenCalledWith({ email: "ada@example.com", name: "Ada", role: "super_admin", notifications: false }),
    );
  });

  it("does not send an invite for an email that is not valid, and says so", async () => {
    await openInvite();
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "ada@example" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(inviteAdminTeamMember).not.toHaveBeenCalled();
  });

  it("asks for an email when it is empty", async () => {
    await openInvite();
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
    expect(await screen.findByText("Enter an email address.")).toBeInTheDocument();
    expect(inviteAdminTeamMember).not.toHaveBeenCalled();
  });

  it("shows the server's reason when the invite fails", async () => {
    inviteAdminTeamMember.mockResolvedValue({ ok: false, error: "Super admin authentication required" });
    await openInvite();
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
    expect(await screen.findByText("Super admin authentication required")).toBeInTheDocument();
  });
});
