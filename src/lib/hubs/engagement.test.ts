import { describe, expect, it } from "vitest";
import {
  computeClickCounts,
  computeReading,
  readingSentence,
  computeItemViews,
  computeSectionTimes,
  computeInterest,
  computeTimeline,
  formatDuration,
  HEARTBEAT_SECONDS,
  totalEngagedSeconds,
  type HubEvent,
} from "./engagement";

function event(overrides: Partial<HubEvent>): HubEvent {
  return { type: "view", target_type: null, target_id: null, created_at: "2026-01-01T00:00:00Z", ...overrides };
}

describe("computeSectionTimes", () => {
  it("converts heartbeat counts into seconds per section, sorted by most time first", () => {
    const events = [
      event({ type: "heartbeat", target_id: "founders" }),
      event({ type: "heartbeat", target_id: "founders" }),
      event({ type: "heartbeat", target_id: "cta" }),
    ];
    expect(computeSectionTimes(events)).toEqual([
      { section: "founders", seconds: 2 * HEARTBEAT_SECONDS },
      { section: "cta", seconds: HEARTBEAT_SECONDS },
    ]);
  });

  it("ignores non-heartbeat events and heartbeats with no target_id", () => {
    const events = [event({ type: "view", target_id: "founders" }), event({ type: "heartbeat", target_id: null })];
    expect(computeSectionTimes(events)).toEqual([]);
  });
});

describe("computeClickCounts", () => {
  it("counts cta_click and call_click events separately by (type, target_id)", () => {
    const events = [
      event({ type: "cta_click", target_id: "booking" }),
      event({ type: "cta_click", target_id: "booking" }),
      event({ type: "call_click", target_id: "call" }),
    ];
    expect(computeClickCounts(events)).toEqual([
      { type: "cta_click", target_id: "booking", count: 2 },
      { type: "call_click", target_id: "call", count: 1 },
    ]);
  });

  it("ignores view/heartbeat events", () => {
    const events = [event({ type: "view", target_id: "founders" }), event({ type: "heartbeat", target_id: "founders" })];
    expect(computeClickCounts(events)).toEqual([]);
  });
});

describe("computeItemViews", () => {
  it("counts view events grouped by target_type, sorted by most-viewed first", () => {
    const events = [
      event({ type: "view", target_type: "founders", target_id: "f1" }),
      event({ type: "view", target_type: "founders", target_id: "f2" }),
      event({ type: "view", target_type: "case_studies", target_id: "cs1" }),
    ];
    expect(computeItemViews(events)).toEqual([
      { target_type: "founders", count: 2 },
      { target_type: "case_studies", count: 1 },
    ]);
  });

  it("ignores non-view events", () => {
    expect(computeItemViews([event({ type: "hub_view", target_type: null })])).toEqual([]);
  });
});

describe("totalEngagedSeconds / formatDuration", () => {
  it("sums all heartbeats regardless of section", () => {
    const events = [event({ type: "heartbeat", target_id: "a" }), event({ type: "heartbeat", target_id: "b" })];
    expect(totalEngagedSeconds(events)).toBe(2 * HEARTBEAT_SECONDS);
  });

  it("formats sub-minute durations in seconds and longer ones rounded to minutes", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(90)).toBe("2m");
  });
});

describe("computeInterest", () => {
  it("says so when nobody has opened the hub", () => {
    expect(computeInterest([]).sentences).toEqual(["Not opened yet."]);
  });

  it("reads like build-fellowship: time, top two sections, content looked at, clicks", () => {
    const events = [
      event({ type: "heartbeat", target_id: "founders" }),
      event({ type: "heartbeat", target_id: "founders" }),
      event({ type: "heartbeat", target_id: "cta" }),
      event({ type: "view", target_type: "founders", target_id: "f1" }),
      event({ type: "view", target_type: "founders", target_id: "f2" }),
      event({ type: "view", target_type: "testimonials", target_id: "t1" }),
      event({ type: "view", target_type: "case_studies", target_id: "c1" }),
      event({ type: "view", target_type: "faqs", target_id: "q1" }),
      event({ type: "cta_click", target_id: "booking" }),
      event({ type: "call_click", target_id: "call" }),
      event({ type: "call_click", target_id: "call" }),
    ];
    const { sentences, sections } = computeInterest(events);
    expect(sentences).toEqual([
      "Spent about 45s on the page.",
      "Most time on Founders and Next step.",
      "Viewed 2 founders.",
      "Read 1 testimonial.",
      "Saw 1 case study.",
      "Opened 1 FAQ.",
      "Clicked Book a call 2 times.",
      "Clicked the booking link 1 time.",
    ]);
    expect(sections.map((s) => s.section)).toEqual(["founders", "cta"]);
  });

  it("names one section alone, and falls back when there was no engagement", () => {
    expect(computeInterest([event({ type: "heartbeat", target_id: "welcome" })]).sentences).toContain("Most time on Welcome.");
    expect(computeInterest([event({ type: "hub_view" })]).sentences).toEqual([
      "Opened the page but has not engaged much yet.",
    ]);
  });
});

describe("computeTimeline", () => {
  const names = { founders: { f1: "Ananya Rao" }, case_studies: { c1: "Zero to one" } };

  it("groups events into visits by session, newest visit first, in time order within a visit", () => {
    const visits = computeTimeline(
      [
        event({ id: "1", session_id: "old", type: "hub_view", created_at: "2026-01-01T10:00:00Z" }),
        event({ id: "2", session_id: "new", type: "hub_view", created_at: "2026-01-02T09:00:00Z" }),
        event({ id: "4", session_id: "new", type: "call_click", target_type: "cta", target_id: "call", created_at: "2026-01-02T09:02:00Z" }),
        event({ id: "3", session_id: "new", type: "view", target_type: "founders", target_id: "f1", created_at: "2026-01-02T09:01:00Z" }),
      ],
      names,
    );
    expect(visits.map((v) => v.sessionId)).toEqual(["new", "old"]);
    expect(visits[0].items.map((i) => i.text)).toEqual(["Opened the hub", "Viewed founder: Ananya Rao", "Clicked Book a call"]);
    expect(visits[0].spanSeconds).toBe(120);
  });

  it("leaves out dwell events and labels unknown items plainly", () => {
    const visits = computeTimeline([
      event({ session_id: "s", type: "section_view", target_id: "cta" }),
      event({ session_id: "s", type: "heartbeat", target_id: "cta" }),
      event({ session_id: "s", type: "view", target_type: "case_studies", target_id: "gone" }),
      event({ session_id: "s", type: "cta_click", target_type: "links", target_id: "Our site" }),
      event({ session_id: "s", type: "cta_click", target_type: "cta", target_id: "booking" }),
    ]);
    expect(visits[0].items.map((i) => i.text)).toEqual([
      "Viewed a case study",
      "Clicked link: Our site",
      "Clicked the booking link",
    ]);
  });
});


describe("case study reading", () => {
  const at = (n: number) => `2026-01-01T00:00:${String(n).padStart(2, "0")}Z`;
  const reader = (type: string, openId: string, meta: Record<string, unknown>, n = 0, session = "s1") =>
    event({ type, target_type: "case_studies", target_id: "c1", session_id: session, created_at: at(n), meta: { open_id: openId, ...meta } });

  it("takes the latest report of a sitting, not the sum of every report", () => {
    const events = [
      reader("pdf_open", "a", { source: "pdf", pages: 12 }, 1),
      reader("pdf_progress", "a", { source: "pdf", seconds: 10, pages_seen: 2, max_page: 2, pages: 12 }, 11),
      reader("pdf_progress", "a", { source: "pdf", seconds: 25, pages_seen: 5, max_page: 6, pages: 12 }, 26),
    ];
    expect(computeReading(events)).toEqual([
      { id: "c1", opens: 1, seconds: 25, pagesRead: 5, furthestPage: 6, pages: 12, reachedEnd: false, source: "pdf" },
    ]);
  });

  it("adds separate sittings together and keeps the deepest page reached", () => {
    const events = [
      reader("pdf_progress", "a", { source: "pdf", seconds: 20, pages_seen: 3, max_page: 3, pages: 8 }, 1),
      reader("pdf_progress", "b", { source: "pdf", seconds: 40, pages_seen: 8, max_page: 8, pages: 8 }, 2, "s2"),
      reader("pdf_complete", "b", { pages: 8 }, 3, "s2"),
    ];
    const [row] = computeReading(events);
    expect(row).toMatchObject({ opens: 2, seconds: 60, pagesRead: 8, furthestPage: 8, reachedEnd: true });
  });

  it("ignores reader events with no sitting id and events for other content", () => {
    const events = [
      event({ type: "pdf_progress", target_type: "case_studies", target_id: "c1", meta: { seconds: 9 } }),
      event({ type: "pdf_progress", target_type: "founders", target_id: "f1", meta: { open_id: "x", seconds: 9 } }),
    ];
    expect(computeReading(events)).toEqual([]);
  });

  it("says it in plain words", () => {
    const base = { id: "c1", opens: 1, pagesRead: 5, furthestPage: 6, pages: 12, reachedEnd: false, source: "pdf" as const };
    expect(readingSentence({ ...base, seconds: 125 }, "Orbitpath")).toBe('Read "Orbitpath" for 2m, as far as page 6 of 12.');
    expect(readingSentence({ ...base, seconds: 90, reachedEnd: true }, "Orbitpath")).toBe('Read "Orbitpath" for 2m and reached the end.');
    expect(readingSentence({ ...base, seconds: 40, pagesRead: 0, source: "drive" }, undefined)).toBe("Opened a case study in Google Drive for 40s.");
    expect(readingSentence({ ...base, seconds: 2, pagesRead: 0 }, "Orbitpath")).toBe('Opened "Orbitpath".');
  });

  it("adds a sentence to the interest summary and one line per sitting to the timeline", () => {
    const events = [
      event({ type: "hub_view", session_id: "s1", created_at: at(0) }),
      reader("pdf_progress", "a", { source: "pdf", seconds: 10, pages_seen: 2, max_page: 2, pages: 12 }, 11),
      reader("pdf_progress", "a", { source: "pdf", seconds: 25, pages_seen: 5, max_page: 6, pages: 12 }, 26),
    ];
    const names = { case_studies: { c1: "Orbitpath" } };
    expect(computeInterest(events, names).sentences).toContain('Read "Orbitpath" for 25s, as far as page 6 of 12.');
    const [visit] = computeTimeline(events, names);
    const reading = visit.items.filter((i) => i.icon === "case_studies");
    expect(reading).toHaveLength(1);
    expect(reading[0].text).toBe('Read "Orbitpath" for 25s, as far as page 6 of 12');
  });
});
