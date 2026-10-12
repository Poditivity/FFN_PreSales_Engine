import { describe, expect, it } from "vitest";
import { callsWord, describeCalls, istToIso, summarizeCalls } from "./calls";
import { PIPELINE_STAGES } from "./schema";

describe("summarizeCalls", () => {
  it("returns zeroes for no calls", () => {
    expect(summarizeCalls([])).toEqual({ total: 0, connected: 0, byStage: {}, lastCalledAt: null, nextFollowUpOn: null });
  });

  it("counts per stage, connected calls, the latest call and the furthest follow-up", () => {
    const summary = summarizeCalls([
      { stage: "mql", outcome: "no_answer", called_at: "2026-09-01T05:00:00.000Z", follow_up_on: "2026-09-03" },
      { stage: "mql", outcome: "connected", called_at: "2026-09-02T05:00:00.000Z", follow_up_on: null },
      { stage: "sql", outcome: "connected", called_at: "2026-09-05T05:00:00.000Z", follow_up_on: "2026-09-09" },
    ]);
    expect(summary.total).toBe(3);
    expect(summary.connected).toBe(2);
    expect(summary.byStage).toEqual({ mql: 2, sql: 1 });
    expect(summary.lastCalledAt).toBe("2026-09-05T05:00:00.000Z");
    expect(summary.nextFollowUpOn).toBe("2026-09-09");
  });
});

describe("describeCalls", () => {
  it("lists stages in pipeline order and skips stages with no calls", () => {
    expect(describeCalls({ sql: 1, mql: 2 }, PIPELINE_STAGES)).toBe("2 at MQL, 1 at SQL");
    expect(describeCalls({}, PIPELINE_STAGES)).toBe("");
  });
});

describe("callsWord", () => {
  it("pluralises", () => {
    expect(callsWord(1)).toBe("1 call");
    expect(callsWord(0)).toBe("0 calls");
    expect(callsWord(4)).toBe("4 calls");
  });
});

describe("istToIso", () => {
  it("reads the form's date and time as IST", () => {
    expect(istToIso("2026-09-21", "01:30")).toBe("2026-09-20T20:00:00.000Z");
  });
});
