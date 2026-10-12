// Every content type's `audience` column is uuid[] referencing tracks(id).
// Empty or null means visible to every track — never a required selection.
// This is the one place that rule is expressed, so Phase 4's hydration logic
// (and anything else that filters content by track) reads it from here
// rather than re-deriving it.

/** True when `audience` is empty/null (visible to everyone) or contains `trackId`. */
export function isVisibleToTrack(audience: string[] | null | undefined, trackId: string): boolean {
  if (!audience || audience.length === 0) return true;
  return audience.includes(trackId);
}

/** Filters a list of content rows down to what's visible for a given track (or everyone, if trackId is null). */
export function filterByTrack<T extends { audience: string[] | null }>(
  rows: T[],
  trackId: string | null,
): T[] {
  if (!trackId) return rows;
  return rows.filter((row) => isVisibleToTrack(row.audience, trackId));
}
