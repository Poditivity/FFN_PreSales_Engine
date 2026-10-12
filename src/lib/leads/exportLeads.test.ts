import { describe, expect, it } from "vitest";
import { makeField } from "@/lib/forms/formLogic";
import { computeSubmissionInsights } from "@/lib/forms/insights";
import { EMPTY_SOURCE } from "@/lib/forms/submissionAnalysis";
import {
  buildLeadsCsv,
  buildLeadsWorkbook,
  callsSheet,
  historySheet,
  leadsSheet,
  stageJourney,
  stageSince,
  summarySheet,
  type LeadExportRecord,
} from "./exportLeads";

const name = { ...makeField("text"), id: "n", label: "Full name" };
const email = { ...makeField("email"), id: "e", label: "Email" };

function record(over: Partial<LeadExportRecord> = {}): LeadExportRecord {
  const answers = { n: "Ananya Rao", e: "ananya@example.com" };
  const fields = [name, email];
  return {
    id: "lead-1",
    stage: "mql",
    createdAt: "2026-09-01T04:00:00.000Z",
    updatedAt: "2026-09-03T04:00:00.000Z",
    ownerEmail: "",
    formTitle: "Validation Lab",
    submissionStatus: "new",
    rating: null,
    adminNotes: "",
    sessionId: "s1",
    answers,
    fields,
    identity: { name: "Ananya Rao", email: "ananya@example.com", phone: "", linkedin: "" },
    insights: computeSubmissionInsights({ fields, data: answers, fieldTimings: {}, keystrokeCounts: {}, timeOnFormSeconds: 90 }),
    flags: [],
    source: EMPTY_SOURCE,
    history: [
      { from: null, to: "lead", changedAt: "2026-09-01T04:00:00.000Z", changedBy: "System" },
      { from: "lead", to: "mql", changedAt: "2026-09-03T04:00:00.000Z", changedBy: "a@ffn.in" },
    ],
    calls: [],
    ...over,
  };
}

describe("lead export", () => {
  it("finds when a lead entered its current stage", () => {
    expect(stageSince(record())).toBe("2026-09-03T04:00:00.000Z");
    expect(stageSince(record({ history: [] }))).toBe("2026-09-01T04:00:00.000Z");
  });

  it("describes the journey through the stages", () => {
    expect(stageJourney(record())).toBe("Lead → MQL");
    expect(stageJourney(record({ history: [] }))).toBe("MQL");
  });

  it("puts identity, stage and every answer on the leads sheet", () => {
    const now = new Date("2026-09-10T04:00:00.000Z").getTime();
    const sheet = leadsSheet([record()], now);
    const header = sheet.columns.map((c) => c.header);
    const row = sheet.rows[0];
    expect(row[header.indexOf("Name")]).toBe("Ananya Rao");
    expect(row[header.indexOf("Stage")]).toBe("MQL");
    expect(row[header.indexOf("Days in stage")]).toBe(7);
    expect(row[header.indexOf("Owner")]).toBe("Unassigned");
    expect(header).toContain("Full name");
    expect(row[header.indexOf("Email", header.indexOf("Lead ID"))]).toBe("ananya@example.com");
  });

  it("lists one history row per stage change, newest first", () => {
    const rows = historySheet([record()]).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0][4]).toBe("MQL");
    expect(rows[1][3]).toBe("Created");
  });

  it("counts calls per lead and per stage on the leads sheet", () => {
    const calls: LeadExportRecord["calls"] = [
      { stage: "mql", outcome: "no_answer", calledAt: "2026-09-02T05:00:00.000Z", calledBy: "a@ffn.in", notes: "", followUpOn: null },
      { stage: "mql", outcome: "connected", calledAt: "2026-09-04T05:00:00.000Z", calledBy: "a@ffn.in", notes: "Keen", followUpOn: "2026-09-08" },
      { stage: "lead", outcome: "connected", calledAt: "2026-09-01T09:00:00.000Z", calledBy: "b@ffn.in", notes: "", followUpOn: null },
    ];
    const sheet = leadsSheet([record({ calls }), record({ id: "2" })]);
    const header = sheet.columns.map((c) => c.header);
    const [called, uncalled] = sheet.rows;
    expect(called[header.indexOf("Total calls")]).toBe(3);
    expect(called[header.indexOf("Connected calls")]).toBe(2);
    expect(called[header.indexOf("Calls at MQL")]).toBe(2);
    expect(called[header.indexOf("Calls at Lead")]).toBe(1);
    expect(called[header.indexOf("Calls at SQL")]).toBe(0);
    expect(called[header.indexOf("Last call (IST)")]).toBe("2026-09-04 10:30");
    expect(called[header.indexOf("Next follow-up")]).toBe("2026-09-08");
    expect(uncalled[header.indexOf("Total calls")]).toBe(0);
    expect(uncalled[header.indexOf("Last call (IST)")]).toBe("");
  });

  it("lists one calls row per call, newest first, with the stage at the time", () => {
    const calls: LeadExportRecord["calls"] = [
      { stage: "lead", outcome: "voicemail", calledAt: "2026-09-01T09:00:00.000Z", calledBy: "b@ffn.in", notes: "", followUpOn: null },
      { stage: "mql", outcome: "connected", calledAt: "2026-09-04T05:00:00.000Z", calledBy: "a@ffn.in", notes: "Keen", followUpOn: null },
    ];
    const rows = callsSheet([record({ calls })]).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0][5]).toBe("MQL");
    expect(rows[0][6]).toBe("MQL");
    expect(rows[0][7]).toBe("Connected");
    expect(rows[1][5]).toBe("Lead");
    expect(rows[1][6]).toBe("MQL");
  });

  it("counts leads by stage on the summary sheet", () => {
    const rows = summarySheet([record(), record({ id: "2", stage: "lost" })], "All leads").rows;
    const mql = rows.find((r) => r[0] === "MQL");
    expect(mql?.[2]).toBe(1);
  });

  it("builds a workbook and a csv", async () => {
    expect(buildLeadsWorkbook([record()]).size).toBeGreaterThan(500);
    const csv = buildLeadsCsv([record()]);
    expect(csv.split("\r\n")).toHaveLength(2);
    expect(csv).toContain("Ananya Rao");
  });
});
