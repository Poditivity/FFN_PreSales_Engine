import { isVisibleToTrack } from "@/lib/content/audience";
import type { HubModule } from "./types";

/**
 * Module inheritance rule (verified against the source's ax_hubs.modules —
 * see the migration header): `hubModules` is null when a hub was created
 * without ever customizing its module list, meaning "use the template's
 * modules as of hydration time." A non-null array — including an explicit
 * empty array, which means "customized to show nothing" — always wins over
 * the template, regardless of what the template contains.
 */
export function resolveModules(hubModules: HubModule[] | null, templateModules: HubModule[]): HubModule[] {
  return hubModules !== null ? hubModules : templateModules;
}

export interface HydratableItem {
  id: string;
  audience: string[];
  featured: boolean;
}

/**
 * Resolves which items of one block are eligible to render, given that
 * block's module config and the hub's track.
 *
 * Hand-picked ("manual") mode is an explicit, ordered list: every ticked id
 * shows, in ticked order. Matching the source's ax-hub exactly, this
 * bypasses BOTH featured_only/limit AND each item's own audience — ticked
 * ids alone decide membership, nothing is filtered back out.
 *
 * Automatic mode applies audience first (Phase 3's isVisibleToTrack — an
 * item with empty/missing audience is visible to every track), then
 * featured_only, then limit, in that order.
 */
export function resolveEligibleItems<T extends HydratableItem>(
  items: T[],
  module: HubModule,
  trackId: string,
): T[] {
  if (module.mode === "manual") {
    const order = new Map(module.ids.map((id, i) => [id, i]));
    return items
      .filter((item) => order.has(item.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  let eligible = items.filter((item) => isVisibleToTrack(item.audience, trackId));
  if (module.featured_only) eligible = eligible.filter((item) => item.featured);
  if (module.limit != null) eligible = eligible.slice(0, module.limit);
  return eligible;
}

/**
 * True if at least one field has real content — a non-empty (after
 * trimming) string, a non-empty array, or any other non-nullish value.
 * Decides whether a singleton block (welcome, about, who_for, helps_with,
 * how_supports, credibility, cta — see
 * SINGLETON_BLOCK_TYPES in ./types) belongs in hub-hydrate's response at
 * all: with no item list to filter client-side the way the five original
 * content-list blocks do (blocks.tsx returns null for an empty items
 * array), the server applies the same "hide if empty" rule up front
 * instead. Mirrored in supabase/functions/hub-hydrate/index.ts, which can't
 * import this file — keep the two in sync if either changes.
 */
export function hasContent(fields: Record<string, unknown>): boolean {
  return Object.values(fields).some((v) => {
    if (v == null) return false;
    if (typeof v === "string") return v.trim() !== "";
    if (Array.isArray(v)) return v.length > 0;
    return true;
  });
}
