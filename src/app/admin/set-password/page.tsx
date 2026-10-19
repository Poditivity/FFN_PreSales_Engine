"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Button, Input } from "@/components/ffn";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

// Where a new password is chosen. Two ways in, both with a real session already
// in place, just no password on it yet (invite) or an old one to replace:
//   - password reset: the 6 digit code is checked on the sign-in screen
//     (verifyOtp), which signs the person in, then sends them here;
//   - invite: /auth/confirm verifies the emailed link's token_hash server-side
//     and redirects here.
export default function SetPasswordPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/admin/login");
        return;
      }
      setCheckingSession(false);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setStatus("error");
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setStatus("error");
      setError("Passwords don't match.");
      return;
    }
    setStatus("saving");
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  if (checkingSession) return null;

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center"
      style={{ background: "var(--surface-page)", padding: "var(--space-6)" }}
    >
      <div className="flex w-full flex-col items-center" style={{ maxWidth: 360, gap: "var(--space-8)" }}>
        <Image src="/logos/ffn-lockup-on-light.png" alt="Founders First Network" width={140} height={140} priority />

        <div className="flex w-full flex-col" style={{ gap: "var(--space-2)" }}>
          <h1 className="h1">Set your password</h1>
          <p className="body" style={{ color: "var(--ink-muted)" }}>
            You&apos;ll use this to sign in from now on.
          </p>
        </div>

        <form className="flex w-full flex-col" style={{ gap: "var(--space-4)" }} onSubmit={handleSubmit}>
          <Input
            type="password"
            required
            size="lg"
            label="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            type="password"
            required
            size="lg"
            label="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button type="submit" size="lg" block loading={status === "saving"}>
            Save password
          </Button>
          {error && (
            <Alert tone="danger" title="Not saved">
              {error}
            </Alert>
          )}
        </form>
      </div>
    </main>
  );
}
