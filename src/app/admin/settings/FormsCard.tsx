"use client";

import { useState } from "react";
import { Alert, Button, Card, Input, Textarea } from "@/components/ffn";
import { PRIVACY_TEXT_MAX, validatePolicyUrl, type AppSettings } from "@/lib/admin/appSettings";
import { updateAppSettings } from "@/lib/admin/appSettingsApi";

type Values = { url: string; text: string };

export function FormsCard({ initial }: { initial: Pick<AppSettings, "privacy_policy_url" | "privacy_policy_text"> }) {
  const start: Values = {
    url: initial.privacy_policy_url ?? "",
    text: initial.privacy_policy_text ?? "",
  };
  const [values, setValues] = useState<Values>(start);
  const [saved, setSaved] = useState<Values>(start);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setJustSaved(false);
  };

  const urlError = validatePolicyUrl(values.url);
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (urlError) return;
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      await updateAppSettings({
        privacy_policy_url: values.url.trim() || null,
        privacy_policy_text: values.text.trim() || null,
      });
      const next = { url: values.url.trim(), text: values.text.trim() };
      setValues(next);
      setSaved(next);
      setJustSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Forms"
      subtitle="The privacy consent every form asks for before it is submitted."
    >
      <form className="flex flex-col" style={{ gap: "var(--space-5)" }} onSubmit={save} noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-2 items-start" style={{ gap: "var(--space-6)" }}>
          <Textarea
            label="Privacy notice"
            rows={4}
            maxLength={PRIVACY_TEXT_MAX}
            value={values.text}
            onChange={set("text")}
            hint="Shown in the consent box at the end of every form. Leave blank to use the standard notice."
          />
          <Input
            type="url"
            label="Privacy policy link"
            placeholder="https://foundersfirstnetwork.com/privacy"
            value={values.url}
            onChange={set("url")}
            error={urlError}
            hint="Optional. Opens the full policy in a new tab from the consent box."
          />
        </div>
        {error && (
          <Alert tone="danger" title="Not saved">
            {error}
          </Alert>
        )}

        <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
          <Button type="submit" loading={saving} disabled={!dirty || Boolean(urlError)}>
            Save
          </Button>
          <span className="body-sm" style={{ color: "var(--ink-muted)" }} aria-live="polite">
            {justSaved && !dirty ? "Saved." : ""}
          </span>
        </div>
      </form>
    </Card>
  );
}
