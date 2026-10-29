import { z } from "zod";

// The Proof Layer's 15 blocks. The original 5 (founders..faqs) are
// unchanged Phase 3 content-list blocks. The 10 added for the Proof Layer
// expansion are either:
//   * singleton blocks (see SINGLETON_BLOCK_TYPES below) — backed by the
//     single global ffn_profile row, the per-hub Lead Context fields, or
//     hub_settings' CTA fields, not a filterable list;
//   * "programs" — a real content-list block, same shape as founders/etc.;
//   * "links" — a repeatable admin-defined {label, url}[] list (see
//     hubModuleLinkSchema), not a picker over an existing content type.
export const BLOCK_TYPES = [
  "welcome",
  "about",
  "who_for",
  "helps_with",
  "how_supports",
  "programs",
  "founders",
  "case_studies",
  "testimonials",
  "mentors",
  "credibility",
  "links",
  "faqs",
  "cta",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_LABELS: Record<BlockType, string> = {
  welcome: "Welcome",
  about: "About FFN",
  who_for: "Who FFN is for",
  helps_with: "What FFN helps with",
  how_supports: "How FFN supports founders",
  programs: "Programs",
  founders: "Founders",
  case_studies: "Case studies",
  testimonials: "Testimonials",
  mentors: "Mentors",
  credibility: "FFN credibility",
  links: "Relevant links",
  faqs: "FAQs",
  cta: "Next step",
};

// What the hub page shows for a block when its module leaves Title and
// Subtitle blank. These mirror the fallbacks in src/app/hub/[token]/blocks.tsx
// and HubRenderer.tsx; they exist so the template editor can show staff the
// default instead of an empty box. `subtitle` is "" when the default is none.
// `dynamic` marks a default that is worked out per hub (the applicant's name, the
// About FFN one-liner), which cannot be put in a box as text, so it is only described.
export const BLOCK_DEFAULTS: Record<BlockType, { title: string; subtitle: string; dynamic?: { title?: boolean; subtitle?: boolean } }> = {
  welcome: { title: "Welcome, {applicant name}", subtitle: "A closer look at Founders First Network, put together for you.", dynamic: { title: true } },
  about: { title: "About Founders First Network", subtitle: "The one-liner from the About FFN profile", dynamic: { subtitle: true } },
  who_for: { title: "Who FFN is for", subtitle: "" },
  helps_with: { title: "What FFN helps with", subtitle: "" },
  how_supports: { title: "How FFN supports founders", subtitle: "" },
  programs: { title: "Programs", subtitle: "" },
  founders: { title: "Founders", subtitle: "Open a profile to read the whole story." },
  case_studies: { title: "Case studies", subtitle: "Read each one here, without leaving the page." },
  testimonials: { title: "Testimonials", subtitle: "" },
  mentors: { title: "Mentors", subtitle: "" },
  credibility: { title: "FFN credibility", subtitle: "" },
  links: { title: "Relevant links", subtitle: "" },
  faqs: { title: "FAQs", subtitle: "" },
  cta: { title: "Talk with us", subtitle: "" },
};

// Blocks with no filterable item list behind them — driven by a single
// global data source (ffn_profile, the hub's own Lead Context fields, or
// hub_settings' CTA fields) instead of a picker over rows in a table. Their
// ModuleComposer UI only ever needs enabled + title/subtitle (Selection/
// Hand-picked/Featured-only/Limit are meaningless without a list), and
// hub-hydrate omits them from the response entirely when the singleton has
// no non-empty field to show — same "hide if empty" rule already used for
// content-list blocks with zero eligible items.
export const SINGLETON_BLOCK_TYPES = [
  "welcome",
  "about",
  "who_for",
  "helps_with",
  "how_supports",
  "credibility",
  "cta",
] as const satisfies readonly BlockType[];
export type SingletonBlockType = (typeof SINGLETON_BLOCK_TYPES)[number];

export function isSingletonBlockType(type: BlockType): type is SingletonBlockType {
  return (SINGLETON_BLOCK_TYPES as readonly BlockType[]).includes(type);
}

// One link in the "links" block's admin-defined list — fully repeatable,
// no hardcoded "website/case study/testimonial" slots.
export const hubModuleLinkSchema = z.object({
  label: z.string(),
  url: z.string(),
});
export type HubModuleLink = z.infer<typeof hubModuleLinkSchema>;

// One block's configuration within a module list. "manual" mode is the
// hand-picked mode: `ids` is the explicit, ordered set of items to show,
// and — matching the source's ax-hub exactly — featured_only/limit and
// each item's own `audience` are never applied on top of it; the ticked
// ids alone decide membership and order. "auto" mode applies the item's
// own audience (Phase 3), then featured_only, then limit, in that order.
// `ids`/`mode`/`featured_only`/`limit` are only meaningful for the
// content-list block types (founders, case_studies, testimonials, mentors,
// programs); `links` is only meaningful for the "links" block type; both
// are carried on every module for schema simplicity, same as the rest.
//
// Beyond the fixed blocks above, a module can also be a "custom" section (a
// heading, a rich text body, an optional image and button, written in the
// template) or a "collection" section (a list of items from one of the content
// database's collections). Unlike the fixed blocks, these can be added any
// number of times, so each one carries its own `id`, which is also the id of
// its section on the hub page and in the engagement log.
export const REPEATABLE_BLOCK_TYPES = ["custom", "collection"] as const;
export type RepeatableBlockType = (typeof REPEATABLE_BLOCK_TYPES)[number];
export type ModuleType = BlockType | RepeatableBlockType;

export const hubModuleSchema = z.object({
  type: z.enum([...BLOCK_TYPES, ...REPEATABLE_BLOCK_TYPES]),
  // Set on custom and collection modules only; the fixed blocks are identified by type.
  id: z.string().optional(),
  // Custom section: rich text (the email editor's subset of HTML), an optional
  // image and an optional button.
  body: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  button_label: z.string().nullable().optional(),
  button_url: z.string().nullable().optional(),
  // Collection section: which collection to list. Selection works as it does for
  // the content blocks (automatic or hand-picked, featured only, limit).
  collection_id: z.string().nullable().optional(),
  enabled: z.boolean(),
  // Custom heading text for this block on the public hub page — purely
  // cosmetic, falls back to BLOCK_LABELS/a default subtitle when unset.
  title: z.string().nullable(),
  subtitle: z.string().nullable(),
  mode: z.enum(["auto", "manual"]),
  ids: z.array(z.string()),
  featured_only: z.boolean(),
  limit: z.number().nullable(),
  links: z.array(hubModuleLinkSchema),
});
export type HubModule = z.infer<typeof hubModuleSchema>;

export function defaultModule(type: BlockType): HubModule {
  return {
    type,
    enabled: true,
    title: null,
    subtitle: null,
    mode: "auto",
    ids: [],
    featured_only: false,
    limit: null,
    links: [],
  };
}

/** True for the modules that can be added more than once: custom and collection sections. */
export function isRepeatableModule(mod: Pick<HubModule, "type">): boolean {
  return (REPEATABLE_BLOCK_TYPES as readonly string[]).includes(mod.type);
}

/** What identifies a module in a list: its own id, or its type for a fixed block. */
export function moduleKey(mod: Pick<HubModule, "type" | "id">): string {
  return mod.id ?? mod.type;
}

/** The id for a new custom or collection section, readable in the engagement log: "custom-our-story-k3f9". */
export function newSectionId(type: RepeatableBlockType, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/, "");
  const random = Math.random().toString(36).slice(2, 6).padEnd(4, "0");
  return `${type}-${slug ? `${slug}-` : ""}${random}`;
}

export function newRepeatableModule(type: RepeatableBlockType, name: string): HubModule {
  return {
    ...defaultModule("faqs"),
    type,
    id: newSectionId(type, name),
    title: name.trim() || null,
    body: type === "custom" ? "" : null,
    collection_id: null,
  };
}

/** A readable name for a section id in the engagement log: a fixed block's label, or the name a custom section was given. */
export function sectionLabel(section: string): string {
  if (section in BLOCK_LABELS) return BLOCK_LABELS[section as BlockType];
  const match = /^(custom|collection)-(.*?)-?[a-z0-9]{4}$/.exec(section);
  if (match) {
    const words = match[2].replace(/-/g, " ").trim();
    if (words) return words.charAt(0).toUpperCase() + words.slice(1);
    return match[1] === "custom" ? "Custom section" : "Collection";
  }
  return section;
}

export const hubTemplateSchema = z.object({
  id: z.string().uuid(),
  track_id: z.string().uuid(),
  name: z.string().min(1),
  modules: z.array(hubModuleSchema),
  // Whether the public hub page shows its navigation bar. On unless staff turn it off.
  show_navbar: z.boolean().default(true),
  created_at: z.string(),
  updated_at: z.string(),
});
export type HubTemplate = z.infer<typeof hubTemplateSchema>;

export const hubStatusSchema = z.enum(["draft", "sent", "opened"]);
export type HubStatus = z.infer<typeof hubStatusSchema>;

// `modules` is deliberately nullable and un-defaulted in the DB — null means
// "inherit the template's module list", a non-null array (including an
// explicit empty array) means "this hub customized it". See resolveModules
// in ./modules.ts, the one place that distinction is interpreted.
export const hubSchema = z.object({
  id: z.string().uuid(),
  token: z.string(),
  // Nullable: a hub usually traces back to a real lead, but staff can also
  // create one for a prospect who never applied (a cold contact, a
  // referral) — see applicant_name/email/whatsapp below, only ever read
  // when lead_id is null. See the migration header for the full rationale.
  lead_id: z.string().uuid().nullable(),
  track_id: z.string().uuid(),
  template_id: z.string().uuid().nullable(),
  status: hubStatusSchema,
  modules: z.array(hubModuleSchema).nullable(),
  open_count: z.number(),
  first_opened_at: z.string().nullable(),
  last_opened_at: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  // Lead Context — optional, staff-entered per hub (a hub's lead isn't
  // necessarily an existing Founder record, so this isn't derived from
  // Phase 3 content). Lead name/source are never duplicated here: name
  // already lives on leads, and source is derived from the originating
  // form at render time.
  startup_name: z.string().nullable(),
  founder_stage: z.string().nullable(),
  current_context: z.string().nullable(),
  // The hub's own identity, for when there is no lead to derive it from.
  // Always null when lead_id is set — never a second copy of a lead's name.
  applicant_name: z.string().nullable(),
  applicant_email: z.string().nullable(),
  applicant_whatsapp: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Hub = z.infer<typeof hubSchema>;
