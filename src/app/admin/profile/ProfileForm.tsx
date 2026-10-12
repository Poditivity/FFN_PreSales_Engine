"use client";

import { useState } from "react";
import { Alert, Badge, Button, Input } from "@/components/ffn";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Loose shape check only — the server normalizes the number for WhatsApp
// and skips it (never fails a notification) if it still cannot be used.
const PHONE_SHAPE = /^\+?[\d\s().-]{8,20}$/;

export function ProfileForm({
  email,
  fullName,
  phone: initialPhone,
  role,
  isSuperAdmin,
}: {
  email: string;
  fullName: string | null;
  phone: string | null;
  role: string;
  isSuperAdmin: boolean;
}) {
  const [name, setName] = useState(fullName ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const phoneInvalid = phone.trim() !== "" && !PHONE_SHAPE.test(phone.trim());

  async function save() {
    if (phoneInvalid) return;
    setStatus("saving");
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ full_name: name.trim() || null, phone: phone.trim() || null })
      .eq("id", user.id);
    if (updateError) {
      setStatus("error");
      setError(updateError.message);
      return;
    }
    setStatus("saved");
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      <div className="flex items-center flex-wrap" style={{ gap: "var(--space-2)" }}>
        <Badge tone="neutral">{capitalize(role)}</Badge>
        {isSuperAdmin && <Badge tone="brand">Super admin</Badge>}
      </div>

      <Input label="Email" value={email} disabled />
      <Input
        label="Full name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setStatus("idle");
        }}
      />
      <Input
        label="WhatsApp number"
        type="tel"
        placeholder="+91 98765 43210"
        error={phoneInvalid ? "Enter a phone number with its country code, for example +44 7911 123456." : undefined}
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value);
          setStatus("idle");
        }}
      />

      {status === "saved" && (
        <Alert tone="success" title="Saved">
          Your profile has been updated.
        </Alert>
      )}
      {error && (
        <Alert tone="danger" title="Not saved">
          {error}
        </Alert>
      )}

      <div>
        <Button onClick={save} loading={status === "saving"} disabled={phoneInvalid}>
          Save
        </Button>
      </div>
    </div>
  );
}
