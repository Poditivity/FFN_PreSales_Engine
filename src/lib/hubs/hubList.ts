import type { Hub } from "./types";

// One row of the admin-wide Hubs list: a hub plus the applicant identity and
// track name resolved from its lead — hubs don't duplicate either, so the
// server page resolves them once and hands over plain rows.
export interface HubListRow {
  id: string;
  token: string;
  status: Hub["status"];
  open_count: number;
  last_opened_at: string | null;
  first_opened_at: string | null;
  updated_at: string;
  // null for a standalone hub — one created for someone who isn't a lead
  // (see resolveHubIdentity in ./identity, which is what fills
  // applicant_name/email/whatsapp below in that case).
  lead_id: string | null;
  applicant_name: string;
  applicant_email: string;
  applicant_whatsapp: string;
  track_name: string;
}

// "Recent opens" is the default so an applicant who just read their page is
// at the top instead of buried wherever their hub was created. "Newest
// first" is creation order, for when that's actually what's wanted.
export const HUB_SORTS = [
  { value: "opens", label: "Recent opens" },
  { value: "newest", label: "Newest first" },
] as const;
export type HubSort = (typeof HUB_SORTS)[number]["value"];

function openedAtMs(row: Pick<HubListRow, "last_opened_at" | "first_opened_at">): number {
  const t = row.last_opened_at || row.first_opened_at;
  const n = t ? new Date(t).getTime() : 0;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Opened hubs first, most recently opened at the very top. Everything
 * unopened keeps the order it arrived in — Array.sort is stable, so
 * returning 0 for two unopened rows leaves them exactly as they were
 * (callers pass rows already newest-created-first).
 */
export function byRecentOpen(a: HubListRow, b: HubListRow): number {
  const aOpen = a.open_count > 0;
  const bOpen = b.open_count > 0;
  if (aOpen !== bOpen) return aOpen ? -1 : 1;
  if (!aOpen) return 0;
  return openedAtMs(b) - openedAtMs(a);
}

/** Case-insensitive substring match against the applicant's name or email. */
export function matchesHubSearch(row: Pick<HubListRow, "applicant_name" | "applicant_email">, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.applicant_name, row.applicant_email].some((v) => v.toLowerCase().includes(q));
}

export function sortHubRows(rows: HubListRow[], sort: HubSort): HubListRow[] {
  return sort === "opens" ? [...rows].sort(byRecentOpen) : rows;
}
