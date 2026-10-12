"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Alert, Button, EmptyState, Input } from "@/components/ffn";
import { isValidEmail } from "@/lib/forms/formLogic";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface NotificationEmail {
  id: string;
  email: string;
  name: string | null;
  active: boolean;
}

export function NotificationEmails({ recipients }: { recipients: NotificationEmail[] }) {
  const [rows, setRows] = useState(recipients);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  async function addRecipient(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidEmail(email)) {
      setEmailError("Enter a valid email address");
      return;
    }
    setSaving(true);
    const supabase = createBrowserSupabaseClient();
    const { data, error: insertError } = await supabase
      .from("notification_emails")
      .insert({ email: email.trim(), name: name.trim() || null })
      .select()
      .single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setRows((prev) => [...prev, data]);
    setEmail("");
    setName("");
  }

  async function remove(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    const supabase = createBrowserSupabaseClient();
    await supabase.from("notification_emails").delete().eq("id", id);
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      <form className="flex items-end flex-wrap" style={{ gap: "var(--space-3)" }} onSubmit={addRecipient} noValidate>
        <Input
          size="sm"
          type="email"
          required
          label="Email"
          placeholder="ops@foundersfirst.network"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(null);
          }}
          error={emailError}
        />
        <Input size="sm" label="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" size="sm" loading={saving}>
          Add recipient
        </Button>
      </form>

      {error && (
        <Alert tone="danger" title="Could not add recipient">
          {error}
        </Alert>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No extra recipients">Admin profiles are still notified of every submission.</EmptyState>
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", background: "var(--surface)" }}>
          {rows.map((r, i) => (
            <div
              key={r.id}
              className="flex items-center justify-between"
              style={{ padding: "var(--space-3) var(--space-4)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
            >
              <div>
                <p className="body-medium">{r.name || r.email}</p>
                {r.name && (
                  <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
                    {r.email}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" aria-label="Remove" onClick={() => remove(r.id)}>
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
