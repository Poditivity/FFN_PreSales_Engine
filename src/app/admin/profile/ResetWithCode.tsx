"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Input } from "@/components/ffn";
import { OtpInput } from "@/components/auth/OtpInput";
import { isCompleteCode, secondsLeft } from "@/components/auth/otp";
import { verifyPasswordResetCode } from "@/lib/admin/passwordReset";
import { requestAdminPasswordReset } from "@/lib/admin/team";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export const MIN_PASSWORD_LENGTH = 8;
/** How long the resend button waits. The server refuses a repeat inside a shorter window. */
export const RESEND_COOLDOWN_MS = 30_000;

/** The first problem with a new password chosen after a code, or null when it can be saved. */
export function newPasswordProblem(next: string, confirm: string): string | null {
  if (next.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (next !== confirm) return "The new passwords do not match.";
  return null;
}

type Step = "start" | "code" | "password" | "done";

/**
 * Forgot your password, from the profile page: email a 6 digit code to the
 * account's address, type it here, then choose a new password. The code is
 * checked with Supabase Auth, which is what allows the password to change
 * without the old one. Same code the sign-in page sends.
 */
export function ResetWithCode({ email }: { email: string }) {
  const [step, setStep] = useState<Step>("start");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
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

  async function sendCode() {
    if (await requestCode()) {
      setCode("");
      setStep("code");
    }
  }

  async function resend() {
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
    setVerifying(false);
    if (!result.ok) {
      setCode("");
      setError("That code is wrong or has expired. Check it, or send a new code.");
      return;
    }
    setStep("password");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const problem = newPasswordProblem(next, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    const { error: updateError } = await createBrowserSupabaseClient().auth.updateUser({ password: next });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNext("");
    setConfirm("");
    setStep("done");
  }

  function startOver() {
    setStep("start");
    setCode("");
    setNext("");
    setConfirm("");
    setError(null);
    setNotice(null);
  }

  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--space-4)" }}>
      <p className="label">Forgot your password?</p>

      {step === "start" && (
        <>
          <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-1) 0 var(--space-3)" }}>
            We send a 6 digit code to <strong style={{ color: "var(--ink)" }}>{email}</strong>. It takes about a minute to arrive.
          </p>
          <Button variant="secondary" onClick={() => void sendCode()} loading={sending}>
            Email me a code
          </Button>
        </>
      )}

      {step === "code" && (
        <form
          className="flex flex-col"
          style={{ gap: "var(--space-3)", marginTop: "var(--space-1)" }}
          onSubmit={(e) => {
            e.preventDefault();
            void verify(code);
          }}
        >
          <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
            Enter the 6 digit code we sent to <strong style={{ color: "var(--ink)" }}>{email}</strong>.
          </p>
          <OtpInput value={code} onChange={setCode} onComplete={(c) => void verify(c)} disabled={verifying} invalid={Boolean(error)} autoFocus />
          <div className="flex items-center flex-wrap" style={{ gap: "var(--space-2)" }}>
            <Button type="submit" loading={verifying} disabled={!isCompleteCode(code)}>
              Verify code
            </Button>
            <Button type="button" variant="secondary" loading={sending} disabled={cooldown > 0 || verifying} onClick={() => void resend()}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={verifying} onClick={startOver}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {step === "password" && (
        <form className="flex flex-col" style={{ gap: "var(--space-3)", marginTop: "var(--space-1)" }} onSubmit={save} noValidate>
          <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
            Code accepted. Choose a new password.
          </p>
          <Input
            type="password"
            autoComplete="new-password"
            label="New password"
            hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
            value={next}
            onChange={(e) => {
              setNext(e.target.value);
              setError(null);
            }}
          />
          <Input
            type="password"
            autoComplete="new-password"
            label="Confirm new password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setError(null);
            }}
          />
          <div>
            <Button type="submit" loading={saving}>
              Set new password
            </Button>
          </div>
        </form>
      )}

      {step === "done" && (
        <div style={{ marginTop: "var(--space-2)" }}>
          <Alert tone="success" title="Password changed">
            Use the new password the next time you sign in.
          </Alert>
        </div>
      )}

      <div aria-live="polite" className="flex flex-col" style={{ gap: "var(--space-3)", marginTop: error || notice ? "var(--space-3)" : 0 }}>
        {error && (
          <Alert tone="danger" title={step === "code" ? "Code not accepted" : step === "password" ? "Password not changed" : "Not sent"}>
            {error}
          </Alert>
        )}
        {notice && !error && (
          <Alert tone="success" title="Code sent">
            {notice}
          </Alert>
        )}
      </div>
    </div>
  );
}
