// Storage warnings for the super admins, kept pure so the storage-alerts edge
// function and the Vitest suite run exactly the same rules.
//
// A warning goes out once a day while usage stays over its threshold, for at most
// ALERT_DAYS days in a row. When usage falls back under the threshold the count
// starts again, so a later climb is announced afresh.

import { escapeHtml, shell } from "./emailShell.ts";

export type StorageKind = "database" | "r2";

/** The free-plan allowance, and the point at which the team is warned. */
export const STORAGE_LIMITS: Record<StorageKind, { label: string; limitGb: number; warnAtGb: number }> = {
  database: { label: "Supabase database", limitGb: 0.5, warnAtGb: 0.4 },
  r2: { label: "Cloudflare R2 storage", limitGb: 10, warnAtGb: 9 },
};

export const ALERT_DAYS = 3;

export interface AlertState {
  daysSent: number;
  /** IST calendar date (YYYY-MM-DD) of the last warning, or null. */
  lastSentOn: string | null;
}

export type AlertDecision = "reset" | "send" | "skip";

/** The IST calendar date, so "a day" matches the team's day rather than UTC's. */
export function istDate(now: Date): string {
  return new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function decideAlert(usedGb: number, warnAtGb: number, state: AlertState, today: string): AlertDecision {
  if (usedGb <= warnAtGb) return state.daysSent > 0 || state.lastSentOn !== null ? "reset" : "skip";
  if (state.daysSent >= ALERT_DAYS) return "skip";
  if (state.lastSentOn === today) return "skip";
  return "send";
}

export function formatGbText(gb: number): string {
  return `${gb.toFixed(gb < 0.1 ? 3 : 2)} GB`;
}

export interface StorageAlert {
  subject: string;
  html: string;
}

export function buildStorageAlert(kind: StorageKind, usedGb: number, dayNumber: number, siteUrl: string): StorageAlert {
  const { label, limitGb } = STORAGE_LIMITS[kind];
  const share = Math.round((usedGb / limitGb) * 100);
  const over = usedGb >= limitGb;
  const subject = `${label} is ${over ? "full" : `${share}% used`} (${formatGbText(usedGb)} of ${formatGbText(limitGb)})`;
  const advice =
    kind === "database"
      ? "Clear out data you no longer need (old logs and test submissions are the usual cause), or move the project to a paid Supabase plan before the free limit is reached."
      : "Delete files you no longer need from the bucket, or move to a paid Cloudflare R2 plan before the free allowance is used up.";
  const link = siteUrl
    ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(siteUrl)}/admin/settings" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;background:#0a0c12;border-radius:10px;">Open Settings</a></p>`
    : "";
  const html = shell(`
    <h1 style="margin:0 0 12px;font-size:20px;line-height:28px;color:#0a0c12;font-weight:700;">${escapeHtml(label)} is nearly full</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#2c3340;">
      The application is using <strong>${escapeHtml(formatGbText(usedGb))}</strong> of the free
      <strong>${escapeHtml(formatGbText(limitGb))}</strong> (${share}%).
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#2c3340;">${escapeHtml(advice)}</p>
    <p style="margin:0;font-size:13px;line-height:20px;color:#616978;">
      This is warning ${dayNumber} of ${ALERT_DAYS}. One goes out each day while usage stays above the warning level.
    </p>${link}`);
  return { subject, html };
}
