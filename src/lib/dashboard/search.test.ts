import { describe, expect, it } from "vitest";
import { funnelRows } from "@/components/ffn/FunnelChart";
import { searchEntries, type SearchEntry } from "./queries";

const entry = (title: string, subtitle = "", kind: SearchEntry["kind"] = "lead"): SearchEntry => ({
  kind,
  id: title,
  title,
  subtitle,
  href: `/x/${title}`,
});

describe("command palette search", () => {
  const entries = [
    entry("Priya Shah", "priya@kitely.io · Validation Lab"),
    entry("Ananya Rao", "ananya@loopstack.in · Startup Lab"),
    entry("Ravi Anand", "ravi@x.co · Validation Lab"),
    entry("FFN Registration", "Form · active", "form"),
  ];

  it("ranks a name that starts with the query above one that only contains it", () => {
    expect(searchEntries(entries, "an").map((e) => e.title)).toEqual(["Ananya Rao", "Ravi Anand"]);
  });

  it("falls back to the email and program line", () => {
    expect(searchEntries(entries, "kitely").map((e) => e.title)).toEqual(["Priya Shah"]);
    expect(searchEntries(entries, "validation lab").map((e) => e.title)).toEqual(["Priya Shah", "Ravi Anand"]);
  });

  it("returns nothing for an empty query and respects the limit", () => {
    expect(searchEntries(entries, "   ")).toEqual([]);
    expect(searchEntries(entries, "a", 2)).toHaveLength(2);
  });
});

describe("funnel rows", () => {
  it("sizes every bar against the first stage and prints the drop from the one above", () => {
    const rows = funnelRows([
      { name: "Lead", value: 200 },
      { name: "MQL", value: 50 },
      { name: "SQL", value: 0 },
      { name: "Customer", value: 0 },
    ]);
    expect(rows.map((r) => r.pct)).toEqual([100, 25, 0, 0]);
    expect(rows.map((r) => r.drop)).toEqual([null, 75, 100, null]);
  });
});
