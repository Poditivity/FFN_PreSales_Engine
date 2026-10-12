"use client";

import { useState } from "react";
import { Alert, Button, Card, Checkbox, Input, Select } from "@/components/ffn";
import { isValidTime, WEEKDAYS, type AppSettings } from "@/lib/admin/appSettings";
import { updateAppSettings } from "@/lib/admin/appSettingsApi";

type Values = Pick<
  AppSettings,
  "daily_digest_enabled" | "daily_digest_time" | "weekly_digest_enabled" | "weekly_digest_day" | "weekly_digest_time"
>;

export function DigestCard({ initial }: { initial: Values }) {
  const [values, setValues] = useState<Values>(initial);
  const [saved, setSaved] = useState<Values>(initial);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setJustSaved(false);
  };

  const dailyError = values.daily_digest_enabled && !isValidTime(values.daily_digest_time) ? "Enter a time, for example 19:00." : null;
  const weeklyError = values.weekly_digest_enabled && !isValidTime(values.weekly_digest_time) ? "Enter a time, for example 09:00." : null;
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (dailyError || weeklyError) return;
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      await updateAppSettings(values);
      setSaved(values);
      setJustSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Daily and weekly summaries"
      subtitle="Sent to the team in Google Chat and by email. Times are in IST."
    >
      <form className="flex flex-col" style={{ gap: "var(--space-5)" }} onSubmit={save} noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-2" style={{ columnGap: "var(--space-6)", rowGap: "var(--space-5)" }}>
          {/* On wide screens each panel spans three shared rows, so the two
              checkboxes, the two sets of fields and the notes line up. */}
          <div className="flex flex-col lg:row-span-3 lg:grid lg:grid-rows-subgrid" style={{ gap: "var(--space-4)" }}>
            <Checkbox
              label="Send a daily summary"
              hint="Leads received, applicant hubs sent and calls made, counted from midnight."
              checked={values.daily_digest_enabled}
              onChange={(e) => set("daily_digest_enabled", e.target.checked)}
            />
            <div className="grid grid-cols-2 items-start" style={{ gap: "var(--space-3)" }}>
              <Input
                type="time"
                label="Daily time"
                value={values.daily_digest_time}
                disabled={!values.daily_digest_enabled}
                onChange={(e) => set("daily_digest_time", e.target.value)}
                error={dailyError}
              />
            </div>
          </div>

          <div
            className="flex flex-col border-t pt-5 lg:row-span-3 lg:grid lg:grid-rows-subgrid lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6"
            style={{ gap: "var(--space-4)", borderColor: "var(--border)" }}
          >
            <Checkbox
              label="Send a weekly summary"
              hint="The full week with trends: every stage, hubs, hub open rate, calls and what needs attention."
              checked={values.weekly_digest_enabled}
              onChange={(e) => set("weekly_digest_enabled", e.target.checked)}
            />
            <div className="grid grid-cols-2 items-start" style={{ gap: "var(--space-3)" }}>
              <Select
                label="Weekly day"
                value={String(values.weekly_digest_day)}
                disabled={!values.weekly_digest_enabled}
                options={WEEKDAYS}
                onChange={(e) => set("weekly_digest_day", Number(e.target.value))}
              />
              <Input
                type="time"
                label="Weekly time"
                value={values.weekly_digest_time}
                disabled={!values.weekly_digest_enabled}
                onChange={(e) => set("weekly_digest_time", e.target.value)}
                error={weeklyError}
              />
            </div>
            <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
              It covers the seven days before the day it is sent, set against the seven before those.
            </p>
          </div>
        </div>

        {error && (
          <Alert tone="danger" title="Not saved">
            {error}
          </Alert>
        )}

        <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
          <Button type="submit" loading={saving} disabled={!dirty || Boolean(dailyError || weeklyError)}>
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
