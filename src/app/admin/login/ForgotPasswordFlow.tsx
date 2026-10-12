"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Button, Input } from "@/components/ffn";
import { OtpInput } from "@/components/auth/OtpInput";
import { isCompleteCode, secondsLeft } from "@/components/auth/otp";
import { verifyPasswordResetCode } from "@/lib/admin/passwordReset";
import { requestAdminPasswordReset } from "@/lib/admin/team";

/** How long the resend button waits. The server refuses a repeat inside a shorter window, so this never trips it. */
export const RESEND_COOLDOWN_MS = 30_000;

// Forgot password, in two steps: ask for a code by email, then type the 6
// digit code. Checking the code signs the person in, and the next screen
// (/admin/set-password) is where the new password is chosen.
export function ForgotPasswordFlow({
  email,
  onEmailChange,
  onBack,
}: {
  email: string;
  onEmailChange: (next: string) => void;
  onBack: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendReadyAt, setResendReadyAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Tick once a second, only while a cooldown is running.
  useEffect(() => {
    if (secondsLeft(resendReadyAt, Date.now()) === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resendReadyAt]);

  const cooldown = secondsLeft(resendReadyAt, now);

  async function requestCode(): Promise<boolean> {
    setSending(true);
    setError(null);
    const result = await requestAdminPasswordReset(email);
    setSending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not send a code. Try again.");
      return false;
    }
    const at = Date.now();
    setNow(at);
    setResendReadyAt(at + RESEND_COOLDOWN_MS);
    return true;
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (await requestCode()) {
      setCode("");
      setStep("code");
    }
  }

  async function handleResend() {
    setNotice(null);
    if (await requestCode()) {
      setCode("");
      setNotice("A new code is on its way. Older codes no longer work.");
    }
  }

  async function verify(value: string) {
    if (!isCompleteCode(value) || verifying) return;
    setVerifying(true);
    setError(null);
    setNotice(null);
    const result = await verifyPasswordResetCode(email, value);
    if (!result.ok) {
      setVerifying(false);
      setCode("");
      setError("That code is wrong or has expired. Check it, or send a new code.");
      return;
    }
    router.push("/admin/set-password");
    router.refresh();
  }

  if (step === "email") {
    return (
      <>
        <div className="flex w-full flex-col" style={{ gap: "var(--space-2)" }}>
          <h1 className="h1">Reset your password</h1>
          <p className="body" style={{ color: "var(--ink-muted)" }}>
            Enter your email and we will send you a 6 digit code.
          </p>
        </div>
        <form className="flex w-full flex-col" style={{ gap: "var(--space-4)" }} onSubmit={handleSend}>
          <Input
            type="email"
            required
            size="lg"
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
          />
          <Button type="submit" size="lg" block loading={sending}>
            Send code
          </Button>
          {error && (
            <Alert tone="danger" title="Not sent">
              {error}
            </Alert>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            Back to sign-in
          </Button>
        </form>
      </>
    );
  }

  return (
    <>
      <div className="flex w-full flex-col" style={{ gap: "var(--space-2)" }}>
        <h1 className="h1">Enter your code</h1>
        <p className="body" style={{ color: "var(--ink-muted)" }}>
          If {email} has an admin account, a 6 digit code is on its way. It can take a minute to arrive.
        </p>
      </div>

      <form
        className="flex w-full flex-col"
        style={{ gap: "var(--space-4)" }}
        onSubmit={(e) => {
          e.preventDefault();
          void verify(code);
        }}
      >
        <OtpInput value={code} onChange={setCode} onComplete={(c) => void verify(c)} disabled={verifying} invalid={Boolean(error)} autoFocus />
        <Button type="submit" size="lg" block loading={verifying} disabled={!isCompleteCode(code)}>
          Verify code
        </Button>

        <div aria-live="polite" className="flex flex-col" style={{ gap: "var(--space-3)" }}>
          {error && (
            <Alert tone="danger" title="Code not accepted">
              {error}
            </Alert>
          )}
          {notice && !error && (
            <Alert tone="success" title="Code sent">
              {notice}
            </Alert>
          )}
        </div>

        <Button type="button" variant="secondary" size="md" block loading={sending} disabled={cooldown > 0 || verifying} onClick={() => void handleResend()}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={verifying}
          onClick={() => {
            setStep("email");
            setCode("");
            setError(null);
            setNotice(null);
          }}
        >
          Use a different email
        </Button>
      </form>
    </>
  );
}
