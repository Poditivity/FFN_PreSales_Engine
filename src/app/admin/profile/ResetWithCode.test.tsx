import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestReset = vi.fn();
vi.mock("@/lib/admin/team", () => ({ requestAdminPasswordReset: (...a: unknown[]) => requestReset(...a) }));

const verifyCode = vi.fn();
vi.mock("@/lib/admin/passwordReset", () => ({ verifyPasswordResetCode: (...a: unknown[]) => verifyCode(...a) }));

const updateUser = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({ auth: { updateUser: (...a: unknown[]) => updateUser(...a) } }) }));

import { newPasswordProblem, ResetWithCode } from "./ResetWithCode";

const EMAIL = "admin@example.com";
const box = (i: number) => screen.getByTestId(`otp-${i}`) as HTMLInputElement;
const enter = (code: string) => fireEvent.paste(box(0), { clipboardData: { getData: () => code } });

async function toCodeStep() {
  fireEvent.click(screen.getByRole("button", { name: "Email me a code" }));
  await screen.findByText(/Enter the 6 digit code/);
}

async function toPasswordStep() {
  verifyCode.mockResolvedValue({ ok: true });
  await toCodeStep();
  enter("493027");
  await screen.findByText("Code accepted. Choose a new password.");
}

describe("newPasswordProblem", () => {
  it("rejects short and mismatched passwords", () => {
    expect(newPasswordProblem("short", "short")).toMatch(/at least 8/i);
    expect(newPasswordProblem("long-enough-1", "long-enough-2")).toMatch(/do not match/i);
    expect(newPasswordProblem("long-enough-1", "long-enough-1")).toBeNull();
  });
});

describe("ResetWithCode", () => {
  beforeEach(() => {
    requestReset.mockReset().mockResolvedValue({ ok: true });
    verifyCode.mockReset();
    updateUser.mockReset().mockResolvedValue({ error: null });
  });

  it("offers a code, not a link", () => {
    render(<ResetWithCode email={EMAIL} />);
    expect(screen.getByText(/6 digit code/)).toBeInTheDocument();
    expect(screen.queryByText(/link/i)).toBeNull();
  });

  it("emails the code, then shows six boxes", async () => {
    render(<ResetWithCode email={EMAIL} />);
    await toCodeStep();
    expect(requestReset).toHaveBeenCalledWith(EMAIL);
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
  });

  it("stays on the first step and shows the error when the code cannot be sent", async () => {
    requestReset.mockResolvedValue({ ok: false, error: "Network down" });
    render(<ResetWithCode email={EMAIL} />);
    fireEvent.click(screen.getByRole("button", { name: "Email me a code" }));
    expect(await screen.findByText("Network down")).toBeInTheDocument();
    expect(screen.queryByText(/Enter the 6 digit code/)).toBeNull();
  });

  it("clears the boxes and says why when the code is wrong", async () => {
    verifyCode.mockResolvedValue({ ok: false, error: "Token has expired or is invalid" });
    render(<ResetWithCode email={EMAIL} />);
    await toCodeStep();
    enter("111111");
    expect(await screen.findByText(/wrong or has expired/i)).toBeInTheDocument();
    expect(Array.from({ length: 6 }, (_, i) => box(i).value).join("")).toBe("");
    expect(screen.queryByLabelText("New password")).toBeNull();
  });

  it("checks the code, then asks for the new password and saves it", async () => {
    render(<ResetWithCode email={EMAIL} />);
    await toPasswordStep();
    expect(verifyCode).toHaveBeenCalledWith(EMAIL, "493027");

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "brand-new-pass-1" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "brand-new-pass-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: "brand-new-pass-1" }));
    expect(await screen.findByText("Password changed")).toBeInTheDocument();
  });

  it("does not save a password that is too short or does not match", async () => {
    render(<ResetWithCode email={EMAIL} />);
    await toPasswordStep();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
    expect(await screen.findByText("Use at least 8 characters.")).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("shows the reason when Supabase refuses the new password", async () => {
    updateUser.mockResolvedValue({ error: { message: "New password should be different from the old password." } });
    render(<ResetWithCode email={EMAIL} />);
    await toPasswordStep();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "brand-new-pass-1" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "brand-new-pass-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
    expect(await screen.findByText(/should be different/)).toBeInTheDocument();
    expect(screen.queryByText("Password changed")).toBeNull();
  });
});
