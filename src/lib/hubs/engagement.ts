import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { sectionLabel } from "./types";

// Detailed engagement, ported from build-fellowship's ax-hub tracking:
// which sections were viewed, how long each held the visitor's attention,
// and which buttons they clicked — on top of the open_count/last_opened_at
// counters hub-hydrate already kept. hub_events already had the right shape
// (Phase 4) but nothing wrote section_view/heartbeat/cta_click rows into it
// and nothing read it back for display; this fills both gaps.

export interface HubEvent {
  id?: string;
  session_id?: string;
  type: string;
  target_type: string | null;
  target_id: string | null;
  created_at: string;
  /** What the event carried, such as a case study reader's page and time. Absent on older rows. */
  meta?: Record<string, unknown> | null;
}

// One heartbeat = 15s of a section holding the center of the viewport while
// the tab is visible (see useSectionEngagement in ./tracker.ts) — same
// interval the source's tracker used, so a heartbeat count converts to
// dwell time by simple multiplication.
export const HEARTBEAT_SECONDS = 15;

export interface SectionTime {
  section: string;
  seconds: number;
}

export function computeSectionTimes(events: HubEvent[]): SectionTime[] {
  const seconds = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "heartbeat" || !e.target_id) continue;
    seconds.set(e.target_id, (seconds.get(e.target_id) ?? 0) + HEARTBEAT_SECONDS);
  }
  return [...seconds.entries()]
    .map(([section, secs]) => ({ section, seconds: secs }))
    .sort((a, b) => b.seconds - a.seconds);
}

export interface ClickCount {
  type: string;
  target_id: string;
  count: number;
}

export function computeClickCounts(events: HubEvent[]): ClickCount[] {
  const counts = new Map<string, ClickCount>();
  for (const e of events) {
    if ((e.type !== "cta_click" && e.type !== "call_click") || !e.target_id) continue;
    const key = `${e.type}:${e.target_id}`;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { type: e.type, target_id: e.target_id, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

export interface ItemView {
  target_type: string;
  count: number;
}

// Item-level views (a founder card, a case study, a FAQ toggled open — see
// onItemView in HubRenderer.tsx) grouped by content type, for a quick "what
// did they look at" line above the section/click detail. Per-item ids
// aren't shown here — HubEngagementSummary already exposes the (type, id)
// pairs for the lead-detail compose view; this is the coarser hub-detail
// summary.
export function computeItemViews(events: HubEvent[]): ItemView[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "view" || !e.target_type) continue;
    counts.set(e.target_type, (counts.get(e.target_type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([target_type, count]) => ({ target_type, count }))
    .sort((a, b) => b.count - a.count);
}

// ---- Case study reading --------------------------------------------------
// The hub reads a case study PDF itself and reports each sitting as it goes:
// pdf_open when it is on screen, pdf_progress every ten seconds and when it is
// closed, pdf_complete when the last page is reached. A progress report is the
// running total for that sitting, so the latest one is the truth for it, and
// sittings are added together per case study.

export interface CaseStudyReading {
  id: string;
  /** How many separate times it was opened. */
  opens: number;
  /** Time with the reader open and the tab in view, all sittings added together. */
  seconds: number;
  /** The most distinct pages read in any one sitting. Zero for a Drive file, which cannot be measured by page. */
  pagesRead: number;
  /** The furthest page reached. */
  furthestPage: number;
  /** Pages in the document, when the hub could read it. */
  pages: number | null;
  reachedEnd: boolean;
  source: "pdf" | "drive" | null;
}

const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

interface Sitting {
  id: string;
  seconds: number;
  pagesRead: number;
  furthestPage: number;
  pages: number | null;
  reachedEnd: boolean;
  source: "pdf" | "drive" | null;
}

function sittings(events: HubEvent[]): Sitting[] {
  const byKey = new Map<string, Sitting>();
  for (const e of events) {
    if (e.target_type !== "case_studies" || !e.target_id) continue;
    if (e.type !== "pdf_open" && e.type !== "pdf_progress" && e.type !== "pdf_complete") continue;
    const openId = typeof e.meta?.open_id === "string" ? e.meta.open_id : "";
    if (!openId) continue;
    const key = `${e.session_id ?? ""}:${openId}`;
    const sitting =
      byKey.get(key) ?? { id: e.target_id, seconds: 0, pagesRead: 0, furthestPage: 0, pages: null, reachedEnd: false, source: null };
    const meta = e.meta ?? {};
    if (meta.source === "pdf" || meta.source === "drive") sitting.source = meta.source;
    if (num(meta.pages) > 0) sitting.pages = num(meta.pages);
    if (e.type === "pdf_progress") {
      sitting.seconds = Math.max(sitting.seconds, num(meta.seconds));
      sitting.pagesRead = Math.max(sitting.pagesRead, num(meta.pages_seen));
      sitting.furthestPage = Math.max(sitting.furthestPage, num(meta.max_page));
    }
    if (e.type === "pdf_complete") sitting.reachedEnd = true;
    byKey.set(key, sitting);
  }
  return [...byKey.values()];
}

export function computeReading(events: HubEvent[]): CaseStudyReading[] {
  const byCase = new Map<string, CaseStudyReading>();
  for (const s of sittings(events)) {
    const row =
      byCase.get(s.id) ?? { id: s.id, opens: 0, seconds: 0, pagesRead: 0, furthestPage: 0, pages: null, reachedEnd: false, source: s.source };
    row.opens += 1;
    row.seconds += s.seconds;
    row.pagesRead = Math.max(row.pagesRead, s.pagesRead);
    row.furthestPage = Math.max(row.furthestPage, s.furthestPage);
    row.pages = Math.max(row.pages ?? 0, s.pages ?? 0) || null;
    row.reachedEnd = row.reachedEnd || s.reachedEnd;
    row.source = row.source ?? s.source;
    byCase.set(s.id, row);
  }
  return [...byCase.values()].sort((a, b) => b.seconds - a.seconds);
}

/** One plain sentence for a case study's reading, in the same voice as the rest of the summary. */
export function readingSentence(reading: CaseStudyReading, title: string | undefined): string {
  const name = title ? `"${title}"` : "a case study";
  const time = reading.seconds >= 5 ? ` for ${formatDuration(reading.seconds)}` : "";
  if (reading.source === "drive") return `Opened ${name} in Google Drive${time}.`;
  if (reading.pagesRead === 0) return `Opened ${name}${time}.`;
  const where = reading.pages ? `${reading.furthestPage} of ${reading.pages}` : `${reading.furthestPage}`;
  const end = reading.reachedEnd ? " and reached the end" : `, as far as page ${where}`;
  return `Read ${name}${time}${end}.`;
}

export function totalEngagedSeconds(events: HubEvent[]): number {
  return events.filter((e) => e.type === "heartbeat").length * HEARTBEAT_SECONDS;
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

const CLICK_LABELS: Record<string, string> = {
  email: "Emailed the contact",
  call: "Clicked Book a call",
  booking: "Clicked the booking link",
};

function clickLabel(click: ClickCount): string {
  if (click.type === "call_click") return "Clicked Book a call";
  return CLICK_LABELS[click.target_id] ?? `Clicked "${click.target_id}"`;
}

// The summary line reads "<label> 3 times.", so it takes the same label.
const clickSentence = clickLabel;

export async function getHubEvents(hubId: string): Promise<HubEvent[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("hub_events")
    .select("id, session_id, type, target_type, target_id, created_at, meta")
    .eq("hub_id", hubId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as HubEvent[];
}

// ---- Hub detail page: interest summary and visit timeline ----------------
// Ported from build-fellowship's computeInterest / computeTimeline, mapped onto
// this product's event vocabulary (hub_view, view, cta_click, call_click).

const ITEM_NOUN: Record<string, [string, string]> = {
  founders: ["founder", "founders"],
  case_studies: ["case study", "case studies"],
  testimonials: ["testimonial", "testimonials"],
  mentors: ["mentor", "mentors"],
  programs: ["program", "programs"],
  faqs: ["FAQ", "FAQs"],
  collection: ["collection item", "collection items"],
};

// The verb build-fellowship uses for each kind of content, so the summary reads the same.
const ITEM_VERB: Record<string, string> = {
  founders: "Viewed",
  case_studies: "Saw",
  testimonials: "Read",
  mentors: "Viewed",
  programs: "Looked at",
  faqs: "Opened",
  collection: "Looked at",
};

const plural = (n: number, [one, many]: [string, string]) => `${n} ${n === 1 ? one : many}`;
const times = (n: number) => `${n} time${n === 1 ? "" : "s"}`;

export interface Interest {
  sentences: string[];
  sections: SectionTime[];
}


/** The plain-English read shown above the numbers: what this applicant looked at and did. */
export function computeInterest(events: HubEvent[], names: ItemNames = {}): Interest {
  const sections = computeSectionTimes(events);
  if (events.length === 0) return { sentences: ["Not opened yet."], sections };

  const sentences: string[] = [];
  const totalSeconds = totalEngagedSeconds(events);
  if (totalSeconds >= 5) sentences.push(`Spent about ${formatDuration(totalSeconds)} on the page.`);
  if (sections.length > 0) {
    const [first, second] = sections;
    sentences.push(
      `Most time on ${sectionLabel(first.section)}${second ? ` and ${sectionLabel(second.section)}` : ""}.`,
    );
  }
  for (const view of computeItemViews(events)) {
    const noun = ITEM_NOUN[view.target_type];
    if (noun) sentences.push(`${ITEM_VERB[view.target_type]} ${plural(view.count, noun)}.`);
  }
  for (const reading of computeReading(events).slice(0, 4)) {
    sentences.push(readingSentence(reading, names.case_studies?.[reading.id]));
  }
  for (const click of computeClickCounts(events).slice(0, 4)) {
    sentences.push(`${clickSentence(click)} ${times(click.count)}.`);
  }
  if (sentences.length === 0) sentences.push("Opened the page but has not engaged much yet.");
  return { sentences, sections };
}

export type TimelineIcon = "open" | "call" | "link" | "cta" | "founders" | "case_studies" | "testimonials" | "mentors" | "programs" | "faqs" | "dot";

export interface TimelineItem {
  id: string;
  time: string;
  icon: TimelineIcon;
  text: string;
}

export interface TimelineVisit {
  sessionId: string;
  start: string;
  end: string;
  spanSeconds: number;
  items: TimelineItem[];
}

/** id to display name, per content type, so a "view" event reads as a person or title. */
export type ItemNames = Partial<Record<string, Record<string, string>>>;

const TIMELINE_TYPES = new Set(["hub_view", "view", "cta_click", "call_click", "pdf_progress"]);

const SINGULAR: Record<string, string> = Object.fromEntries(Object.entries(ITEM_NOUN).map(([k, v]) => [k, v[0]]));

function labelFor(e: HubEvent, names: ItemNames): { icon: TimelineIcon; text: string } {
  switch (e.type) {
    case "hub_view":
      return { icon: "open", text: "Opened the hub" };
    case "pdf_progress": {
      const title = e.target_id ? names.case_studies?.[e.target_id] : undefined;
      const sitting = sittings([e])[0];
      const reading: CaseStudyReading = {
        id: e.target_id ?? "",
        opens: 1,
        seconds: sitting?.seconds ?? 0,
        pagesRead: sitting?.pagesRead ?? 0,
        furthestPage: sitting?.furthestPage ?? 0,
        pages: sitting?.pages ?? null,
        reachedEnd: false,
        source: sitting?.source ?? null,
      };
      return { icon: "case_studies", text: readingSentence(reading, title).replace(/\.$/, "") };
    }
    case "call_click":
      return { icon: "call", text: "Clicked Book a call" };
    case "cta_click": {
      if (e.target_type === "links") return { icon: "link", text: e.target_id ? `Clicked link: ${e.target_id}` : "Clicked a link" };
      return { icon: "cta", text: e.target_id ? clickLabel({ type: e.type, target_id: e.target_id, count: 1 }) : "Clicked a button" };
    }
    default: {
      const type = e.target_type ?? "";
      const noun = SINGULAR[type] ?? "item";
      const name = e.target_id ? names[type]?.[e.target_id] : undefined;
      const icon = (type in ITEM_NOUN ? type : "dot") as TimelineIcon;
      const verb = type === "faqs" ? "Opened" : "Viewed";
      return { icon, text: name ? `${verb} ${noun}: ${name}` : `${verb} a ${noun}` };
    }
  }
}

/** Visits (one browser session each), newest first, each with its ordered, labeled events. */
export function computeTimeline(events: HubEvent[], names: ItemNames = {}): TimelineVisit[] {
  const groups = new Map<string, HubEvent[]>();
  // A reader reports every ten seconds, so only the last report of each sitting
  // belongs on the timeline. It is the one that says how far the reader got.
  const lastReport = new Map<string, HubEvent>();
  for (const e of events) {
    if (e.type !== "pdf_progress") continue;
    const openId = typeof e.meta?.open_id === "string" ? e.meta.open_id : "";
    const key = `${e.session_id ?? ""}:${openId}:${e.target_id ?? ""}`;
    const previous = lastReport.get(key);
    if (!previous || new Date(e.created_at) >= new Date(previous.created_at)) lastReport.set(key, e);
  }
  const keptReports = new Set(lastReport.values());
  events.forEach((e, i) => {
    if (!TIMELINE_TYPES.has(e.type)) return;
    if (e.type === "pdf_progress" && !keptReports.has(e)) return;
    const key = e.session_id || `no-session-${e.id ?? i}`;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  });

  const visits: TimelineVisit[] = [];
  for (const [sessionId, list] of groups) {
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const first = list[0];
    const last = list[list.length - 1];
    visits.push({
      sessionId,
      start: first.created_at,
      end: last.created_at,
      spanSeconds: (new Date(last.created_at).getTime() - new Date(first.created_at).getTime()) / 1000,
      items: list.map((e, i) => ({ id: e.id ?? `${sessionId}-${i}`, time: e.created_at, ...labelFor(e, names) })),
    });
  }
  return visits.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
}
