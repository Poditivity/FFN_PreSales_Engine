import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const requestReset = vi.fn();
vi.mock("@/lib/admin/team", () => ({ requestAdminPasswordReset: (...a: unknown[]) => requestReset(...a) }));

const verifyCode = vi.fn();
vi.mock("@/lib/admin/passwordReset", () => ({ verifyPasswordResetCode: (...a: unknown[]) => verifyCode(...a) }));

import { ForgotPasswordFlow, RESEND_COOLDOWN_MS } from "./ForgotPasswordFlow";

function setup(email = "admin@example.com") {
  const onBack = vi.fn();
  render(<ForgotPasswordFlow email={email} onEmailChange={() => {}} onBack={onBack} />);
  return { onBack };
}

const box = (i: number) => screen.getByTestId(`otp-${i}`) as HTMLInputElement;
const enter = (code: string) => fireEvent.paste(box(0), { clipboardData: { getData: () => code } });

async function toCodeStep() {
  fireEvent.click(screen.getByRole("button", { name: "Send code" }));
  await screen.findByText("Enter your code");
}

describe("ForgotPasswordFlow", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    requestReset.mockReset().mockResolvedValue({ ok: true });
    verifyCode.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("asks for an email, says a 6 digit code will be sent, and never mentions a link", () => {
    setup();
    expect(screen.getByText(/6 digit code/)).toBeInTheDocument();
    expect(screen.queryByText(/link/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Send code" })).toBeInTheDocument();
  });

  it("requests the code, then shows six boxes", async () => {
    setup();
    await toCodeStep();
    expect(requestReset).toHaveBeenCalledWith("admin@example.com");
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
  });

  it("stays on the email step and shows the error when the code cannot be requested", async () => {
    requestReset.mockResolvedValue({ ok: false, error: "Network down" });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText("Network down")).toBeInTheDocument();
    expect(screen.queryByText("Enter your code")).toBeNull();
  });

  it("verifies the code as a recovery code as soon as the sixth digit is in, then goes to set-password", async () => {
    verifyCode.mockResolvedValue({ ok: true });
    setup();
    await toCodeStep();
    enter("493027");
    await waitFor(() => expect(verifyCode).toHaveBeenCalledWith("admin@example.com", "493027"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/set-password"));
    expect(refresh).toHaveBeenCalled();
  });

  it("does not verify a partial code", async () => {
    setup();
    await toCodeStep();
    enter("4930");
    expect(verifyCode).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Verify code" })).toBeDisabled();
  });

  it("shows a clear error and clears the boxes for a wrong or expired code", async () => {
    verifyCode.mockResolvedValue({ ok: false, error: "Token has expired or is invalid" });
    setup();
    await toCodeStep();
    enter("111111");
    expect(await screen.findByText(/wrong or has expired/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(Array.from({ length: 6 }, (_, i) => box(i).value).join("")).toBe("");
  });

  it("holds the resend button for the cooldown, then sends a fresh code and clears the boxes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
    await toCodeStep();
    const resend = () => screen.getByRole("button", { name: /Resend code/ });
    expect(resend()).toBeDisabled();
    expect(resend()).toHaveTextContent(/in 30s/);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_COOLDOWN_MS + 1000);
    });
    expect(resend()).toBeEnabled();
    expect(resend()).toHaveTextContent("Resend code");

    enter("4930");
    fireEvent.click(resend());
    await screen.findByText(/new code is on its way/i);
    expect(requestReset).toHaveBeenCalledTimes(2);
    expect(box(0).value).toBe("");
    expect(resend()).toBeDisabled();
  });

  it("lets you go back to change the email", async () => {
    setup();
    await toCodeStep();
    fireEvent.click(screen.getByRole("button", { name: "Use a different email" }));
    expect(screen.getByRole("button", { name: "Send code" })).toBeInTheDocument();
  });

  it("goes back to sign-in from the first step", () => {
    const { onBack } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Back to sign-in" }));
    expect(onBack).toHaveBeenCalled();
  });
});
