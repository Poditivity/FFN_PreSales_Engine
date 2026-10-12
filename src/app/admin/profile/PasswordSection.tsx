"use client";

import { useState } from "react";
import { Alert, Button, Card, Input } from "@/components/ffn";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { MIN_PASSWORD_LENGTH, ResetWithCode } from "./ResetWithCode";

export { MIN_PASSWORD_LENGTH };

/** The first problem with a new password, or null when it can be saved. */
export function passwordProblem(current: string, next: string, confirm: string): string | null {
  if (!current) return "Enter your current password.";
  if (next.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (next === current) return "Choose a password you are not using now.";
  if (next !== confirm) return "The new passwords do not match.";
  return null;
}

/**
 * Two ways to a new password from the profile page. Signed in and knowing the
 * old one: change it here. Not knowing it: email a 6 digit code to the account's
 * address, type it, then choose a new password (see ResetWithCode).
 */
export function PasswordSection({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [changing, setChanging] = useState<"idle" | "saving" | "saved">("idle");
  const [changeError, setChangeError] = useState<string | null>(null);

  async function change(e: React.FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(current, next, confirm);
    if (problem) {
      setChangeError(problem);
      setChanging("idle");
      return;
    }
    setChanging("saving");
    setChangeError(null);
    const supabase = createBrowserSupabaseClient();
    // Signing in again proves the person at the keyboard knows the current password.
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: current });
    if (verifyError) {
      setChanging("idle");
      setChangeError("Your current password is not correct.");
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    if (updateError) {
      setChanging("idle");
      setChangeError(updateError.message);
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setChanging("saved");
  }

  return (
    <Card title="Password" subtitle="Change it here, or get a code by email if you have forgotten it.">
      <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
        <form className="flex flex-col" style={{ gap: "var(--space-3)" }} onSubmit={change} noValidate>
          <Input
            type="password"
            autoComplete="current-password"
            label="Current password"
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value);
              setChanging("idle");
            }}
          />
          <Input
            type="password"
            autoComplete="new-password"
            label="New password"
            hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
            value={next}
            onChange={(e) => {
              setNext(e.target.value);
              setChanging("idle");
            }}
          />
          <Input
            type="password"
            autoComplete="new-password"
            label="Confirm new password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setChanging("idle");
            }}
          />
          {changeError && (
            <Alert tone="danger" title="Password not changed">
              {changeError}
            </Alert>
          )}
          {changing === "saved" && (
            <Alert tone="success" title="Password changed">
              Use the new password the next time you sign in.
            </Alert>
          )}
          <div>
            <Button type="submit" loading={changing === "saving"}>
              Change password
            </Button>
          </div>
        </form>

        <ResetWithCode email={email} />
      </div>
    </Card>
  );
}
