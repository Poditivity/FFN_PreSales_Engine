import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { HubModule, HubStatus, ModuleType } from "./types";

export interface HubFounderItem {
  id: string;
  name: string;
  photo_url: string | null;
  startup_name: string | null;
  starting_problem: string | null;
  journey: string | null;
  outcome: string | null;
  co_founders: { id: string; name: string }[];
  // The rest of the story, shown when an applicant opens a founder. All of it is
  // optional, and the drawer skips whatever is empty. An older hub-hydrate that
  // has not been redeployed simply does not send these.
  startup_logo_url?: string | null;
  website_url?: string | null;
  linkedin_url?: string | null;
  starting_stage?: string | null;
  current_stage?: string | null;
  industry?: string | null;
  ffn_support?: string | null;
  key_change?: string | null;
  milestones?: string | null;
  professional_experience?: string | null;
}

export interface HubCaseStudyItem {
  id: string;
  title: string;
  case_study_link: string | null;
  founders: { id: string; name: string }[];
}

export interface HubTestimonialItem {
  id: string;
  testimonial_quote: string | null;
  video_link: string | null;
  // startup_name and is_co_founder come from hub-hydrate. An older deployment
  // does not send them, so the page falls back to the founders block.
  founder: { id: string; name: string; startup_name?: string | null; startup_logo_url?: string | null; is_co_founder?: boolean } | null;
}

export interface HubMentorItem {
  id: string;
  name: string;
  photo_url: string | null;
  role: string | null;
  expertise: string | null;
  // Optional for the same reason as the founder fields: an older hub-hydrate
  // does not send them.
  relevant_experience?: string | null;
  linkedin_url?: string | null;
}

export interface HubFaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface HubProgramItem {
  id: string;
  name: string;
  description: string | null;
  stages: string[];
  problems_addressed: string[];
}

/** One item of a collection section. */
export interface HubCollectionItem {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
}

export interface HubModuleLinkItem {
  label: string;
  url: string;
}

// Singleton block payloads — present in hub-hydrate's blocks[] only when
// they have at least one non-empty field (server-side "hide if empty",
// see hasContent in ./modules.ts). Every field is independently optional:
// a block can render with just one of its fields filled in.
export interface HubWelcomePayload {
  lead_name: string | null;
  startup_name: string | null;
  founder_stage: string | null;
  current_context: string | null;
}

export interface HubAboutPayload {
  one_liner: string | null;
  helps_founders_do: string | null;
  approach: string | null;
  differentiator: string | null;
  website_url: string | null;
}

export interface HubWhoForPayload {
  founder_stages_supported: string[];
  startup_stages_supported: string[];
  founder_types: string[];
  industries: string[];
}

export interface HubHelpsWithPayload {
  problems_addressed: string[];
}

export interface HubHowSupportsPayload {
  support_formats: string[];
}

export interface HubCredibilityPayload {
  founders_stat: string | null;
  programs_stat: string | null;
  events_stat: string | null;
  partnerships_stat: string | null;
}

export interface HubCtaPayload {
  cta_text: string | null;
  booking_url: string | null;
}

export interface HubBlockPayload
  extends Partial<HubWelcomePayload>,
    Partial<HubAboutPayload>,
    Partial<HubWhoForPayload>,
    Partial<HubHelpsWithPayload>,
    Partial<HubHowSupportsPayload>,
    Partial<HubCredibilityPayload>,
    Partial<HubCtaPayload> {
  type: ModuleType;
  // Custom and collection sections can appear more than once, so each carries the
  // id of its module, which is also the id of its section on the page.
  key?: string;
  title?: string | null;
  subtitle?: string | null;
  // Custom section.
  body?: string | null;
  image_url?: string | null;
  button_label?: string | null;
  button_url?: string | null;
  // Collection section.
  items?: HubCollectionItem[];
  founders?: HubFounderItem[];
  case_studies?: HubCaseStudyItem[];
  testimonials?: HubTestimonialItem[];
  mentors?: HubMentorItem[];
  programs?: HubProgramItem[];
  faqs?: HubFaqItem[];
  links?: HubModuleLinkItem[];
}

export interface HubInfoPayload {
  track: { id: string; name: string };
  status: HubStatus;
  open_count: number;
  blocks: HubBlockPayload[];
}

export async function fetchHubInfo(token: string, preview: boolean): Promise<HubInfoPayload> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.functions.invoke("hub-hydrate", {
    body: { action: "info", token, preview },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as HubInfoPayload;
}

/** What the create-hub dialog is about to make, previewed before anything is saved. */
export interface HubDraft {
  lead_id: string | null;
  track_id: string;
  template_id: string | null;
  modules: HubModule[] | null;
  startup_name: string | null;
  founder_stage: string | null;
  current_context: string | null;
  applicant_name: string | null;
  applicant_email: string | null;
  applicant_whatsapp: string | null;
}

// A preview opens in a new tab, which does not share sessionStorage, so the
// draft travels in localStorage under a one-off key. Entries are small and
// cleared when they are old or when the preview has read them for the last time.
const DRAFT_PREFIX = "ffn_hub_draft_";
const DRAFT_MAX_AGE_MS = 60 * 60 * 1000;

/** Stores a draft for the preview tab and returns the key to put in its URL. */
export function stashHubDraft(draft: HubDraft): string | null {
  try {
    const now = Date.now();
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (!k?.startsWith(DRAFT_PREFIX)) continue;
      const at = Number(JSON.parse(window.localStorage.getItem(k) ?? "{}").at ?? 0);
      if (now - at > DRAFT_MAX_AGE_MS) window.localStorage.removeItem(k);
    }
    const key = crypto.randomUUID();
    window.localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify({ at: now, draft }));
    return key;
  } catch {
    return null;
  }
}

export function readHubDraft(key: string): HubDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_PREFIX + key);
    return raw ? (JSON.parse(raw).draft as HubDraft) : null;
  } catch {
    return null;
  }
}

/** The path the preview tab opens. "draft" is not a real token; the page reads the draft instead. */
export function hubDraftPreviewPath(key: string): string {
  return `/hub/draft?preview=1&draft=${encodeURIComponent(key)}`;
}

export async function fetchHubDraftInfo(draft: HubDraft): Promise<HubInfoPayload> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.functions.invoke("hub-hydrate", { body: { action: "draft", draft } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as HubInfoPayload;
}

export interface HubEngagementEvent {
  type: string;
  target_type?: string | null;
  target_id?: string | null;
  meta?: Record<string, unknown> | null;
}

export async function sendHubEvents(
  token: string,
  sessionId: string,
  events: HubEngagementEvent[],
  preview: boolean,
): Promise<void> {
  if (preview || events.length === 0) return;
  const supabase = createBrowserSupabaseClient();
  await supabase.functions
    .invoke("hub-hydrate", { body: { action: "track", token, session_id: sessionId, events, preview } })
    .catch(() => {
      // engagement tracking is best-effort — never surface a failure to the visitor
    });
}
