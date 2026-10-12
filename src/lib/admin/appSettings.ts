import type { SupabaseClient } from "@supabase/supabase-js";

// Workspace settings the team edits on the Settings page (one app_settings row).
// The escalation job, the digests and the public form read the same row.

export interface AppSettings {
  escalation_minutes: number | null;
  daily_digest_enabled: boolean;
  daily_digest_time: string;
  weekly_digest_enabled: boolean;
  /** 0 = Sunday ... 6 = Saturday. */
  weekly_digest_day: number;
  weekly_digest_time: string;
  privacy_policy_url: string | null;
  privacy_policy_text: string | null;
  r2_used_bytes: number | null;
  r2_object_count: number | null;
  r2_checked_at: string | null;
  r2_truncated: boolean;
}

export const APP_SETTINGS_COLUMNS =
  "escalation_minutes, daily_digest_enabled, daily_digest_time, weekly_digest_enabled, weekly_digest_day, weekly_digest_time, privacy_policy_url, privacy_policy_text, r2_used_bytes, r2_object_count, r2_checked_at, r2_truncated";

/** null when the table is not there yet (the migration has not been applied). */
export async function loadAppSettings(supabase: SupabaseClient): Promise<AppSettings | null> {
  const { data, error } = await supabase.from("app_settings").select(APP_SETTINGS_COLUMNS).eq("id", true).maybeSingle();
  if (error || !data) return null;
  return data as unknown as AppSettings;
}

export type AppSettingsPatch = Partial<
  Pick<
    AppSettings,
    | "escalation_minutes"
    | "daily_digest_enabled"
    | "daily_digest_time"
    | "weekly_digest_enabled"
    | "weekly_digest_day"
    | "weekly_digest_time"
    | "privacy_policy_url"
    | "privacy_policy_text"
  >
>;

// ---------------------------------------------------------------- escalation

export type DelayUnit = "minutes" | "hours" | "days";

export const DELAY_UNITS: { value: DelayUnit; label: string; minutes: number }[] = [
  { value: "minutes", label: "Minutes", minutes: 1 },
  { value: "hours", label: "Hours", minutes: 60 },
  { value: "days", label: "Days", minutes: 1440 },
];

/** The shortest and longest delay the database accepts (app_settings.escalation_minutes). */
export const ESCALATION_MIN_MINUTES = 5;
export const ESCALATION_MAX_MINUTES = 43200;

export function toMinutes(value: number, unit: DelayUnit): number {
  return Math.round(value * (DELAY_UNITS.find((u) => u.value === unit)?.minutes ?? 1));
}

/** 120 -> { value: 2, unit: "hours" }. Picks the largest unit that divides evenly. */
export function fromMinutes(minutes: number | null): { value: string; unit: DelayUnit } {
  if (!minutes) return { value: "", unit: "hours" };
  if (minutes % 1440 === 0) return { value: String(minutes / 1440), unit: "days" };
  if (minutes % 60 === 0) return { value: String(minutes / 60), unit: "hours" };
  return { value: String(minutes), unit: "minutes" };
}

/**
 * Reads the delay the team typed. Empty means escalation is off. Returns the
 * minutes to store (null for off) or the sentence to show.
 */
export function parseEscalationDelay(raw: string, unit: DelayUnit): { minutes: number | null; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { minutes: null };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return { minutes: null, error: "Enter a number greater than zero." };
  const minutes = toMinutes(n, unit);
  if (minutes < ESCALATION_MIN_MINUTES) return { minutes: null, error: `Use at least ${ESCALATION_MIN_MINUTES} minutes.` };
  if (minutes > ESCALATION_MAX_MINUTES) return { minutes: null, error: "Use 30 days or less." };
  return { minutes };
}

// -------------------------------------------------------------------- digests

export const WEEKDAYS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
];

export const isValidTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

// -------------------------------------------------------------- privacy, files

/** The sentence to show when a privacy policy link is not usable, or null when it is (or is empty). */
export function validatePolicyUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).protocol === "https:" ? null : "Use a link that starts with https://.";
  } catch {
    return "Enter a full link, for example https://foundersfirstnetwork.com/privacy.";
  }
}

export const PRIVACY_TEXT_MAX = 4000;

