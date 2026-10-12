"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Alert, Button, Input } from "@/components/ffn";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ForgotPasswordFlow } from "./ForgotPasswordFlow";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/admin";
  const linkError = searchParams.get("error");

  const [mode, setMode] = useState<"sign-in" | "forgot">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center"
      style={{ background: "var(--surface-page)", padding: "var(--space-6)" }}
    >
      <div className="flex w-full flex-col items-center" style={{ maxWidth: 360, gap: "var(--space-8)" }}>
        <Image src="/logos/ffn-lockup-on-light.png" alt="Founders First Network" width={140} height={140} priority />

        {linkError && mode === "sign-in" && (
          <Alert tone="danger" title="Link expired">
            That sign-in link is no longer valid. Sign in below instead.
          </Alert>
        )}

        {mode === "forgot" ? (
          <ForgotPasswordFlow
            email={email}
            onEmailChange={setEmail}
            onBack={() => {
              setMode("sign-in");
              setStatus("idle");
              setError(null);
            }}
          />
        ) : (
          <>
            <div className="flex w-full flex-col" style={{ gap: "var(--space-2)" }}>
              <h1 className="h1">Staff sign-in</h1>
              <p className="body" style={{ color: "var(--ink-muted)" }}>
                Sign in with your email and password.
              </p>
            </div>
            <form className="flex w-full flex-col" style={{ gap: "var(--space-4)" }} onSubmit={handleSignIn}>
              <Input
                type="email"
                required
                size="lg"
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="password"
                required
                size="lg"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" size="lg" block loading={status === "loading"}>
                Sign in
              </Button>
              {error && (
                <Alert tone="danger" title="Sign-in failed">
                  {error}
                </Alert>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={() => { setMode("forgot"); setStatus("idle"); setError(null); }}>
                Forgot password?
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
