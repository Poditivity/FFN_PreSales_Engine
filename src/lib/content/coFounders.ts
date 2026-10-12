// Pure helpers for the founder_co_founders self-referential many-to-many.
// The DB stores one row per pair in canonical order (a < b) and exposes a
// symmetric read via the founder_co_founder_links view (see the Phase 3
// migration); these helpers mirror that same symmetry at the JS layer for
// anywhere the raw pair rows are fetched directly instead of through the view.

export interface CoFounderPair {
  founder_id_a: string;
  founder_id_b: string;
}

/** Canonical (a, b) ordering — the same rule the DB's check constraint enforces. */
export function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/**
 * Builds a symmetric adjacency list from raw (a, b) pair rows: linking A to B
 * surfaces on both A's and B's entry, regardless of which side of the stored
 * pair each one was on.
 */
export function buildCoFounderAdjacency(pairs: CoFounderPair[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  const add = (from: string, to: string) => {
    const existing = adjacency.get(from);
    if (existing) existing.push(to);
    else adjacency.set(from, [to]);
  };
  for (const { founder_id_a, founder_id_b } of pairs) {
    add(founder_id_a, founder_id_b);
    add(founder_id_b, founder_id_a);
  }
  return adjacency;
}

/** Co-founder ids for one founder, from a raw pair list — symmetric regardless of storage side. */
export function coFoundersOf(founderId: string, pairs: CoFounderPair[]): string[] {
  return buildCoFounderAdjacency(pairs).get(founderId) ?? [];
}
