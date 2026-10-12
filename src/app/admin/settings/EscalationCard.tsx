"use client";

import { useState } from "react";
import { Alert, Button, Card, Input, Select } from "@/components/ffn";
import { DELAY_UNITS, ESCALATION_MIN_MINUTES, fromMinutes, parseEscalationDelay, type DelayUnit } from "@/lib/admin/appSettings";
import { updateAppSettings } from "@/lib/admin/appSettingsApi";

export function EscalationCard({ initialMinutes }: { initialMinutes: number | null }) {
  const start = fromMinutes(initialMinutes);
  const [value, setValue] = useState(start.value);
  const [unit, setUnit] = useState<DelayUnit>(start.unit);
  const [saved, setSaved] = useState<number | null>(initialMinutes);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseEscalationDelay(value, unit);
  const dirty = !parsed.error && parsed.minutes !== saved;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (parsed.error) return;
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      await updateAppSettings({ escalation_minutes: parsed.minutes });
      setSaved(parsed.minutes);
      setJustSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Lead escalation"
      subtitle="Tell the team when a lead has waited this long without being sent a personalised hub."
    >
      <form className="flex flex-col" style={{ gap: "var(--space-5)" }} onSubmit={save} noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-2 items-start" style={{ gap: "var(--space-6)" }}>
          <div className="grid grid-cols-2 items-start" style={{ gap: "var(--space-3)" }}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              label="Alert after"
              placeholder="Off"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setJustSaved(false);
              }}
              error={value.trim() ? parsed.error : null}
            />
            <Select
              label="Unit"
              value={unit}
              options={DELAY_UNITS.map((u) => ({ value: u.value, label: u.label }))}
              onChange={(e) => {
                setUnit(e.target.value as DelayUnit);
                setJustSaved(false);
              }}
            />
          </div>
          <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
            {saved === null
              ? "Escalation is off. Enter a time to switch it on."
              : "Escalation is on. Clear the time and save to switch it off."}{" "}
            The shortest time is {ESCALATION_MIN_MINUTES} minutes. Only leads that arrive after you save are counted, and each
            lead is raised once, in Google Chat and by email to the team.
          </p>
        </div>

        {error && (
          <Alert tone="danger" title="Not saved">
            {error}
          </Alert>
        )}

        <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
          <Button type="submit" loading={saving} disabled={!dirty}>
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
