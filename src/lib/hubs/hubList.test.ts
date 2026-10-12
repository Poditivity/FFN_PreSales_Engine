import { describe, expect, it } from "vitest";
import { byRecentOpen, matchesHubSearch, sortHubRows, type HubListRow } from "./hubList";

function row(overrides: Partial<HubListRow>): HubListRow {
  return {
    id: "id",
    token: "token",
    status: "draft",
    open_count: 0,
    last_opened_at: null,
    first_opened_at: null,
    updated_at: "2026-01-01T00:00:00Z",
    lead_id: "lead",
    applicant_name: "",
    applicant_email: "",
    applicant_whatsapp: "",
    track_name: "Founder",
    ...overrides,
  };
}

describe("byRecentOpen", () => {
  it("puts opened hubs before unopened ones", () => {
    const opened = row({ id: "opened", open_count: 1, last_opened_at: "2026-01-01T00:00:00Z" });
    const unopened = row({ id: "unopened", open_count: 0 });
    expect([unopened, opened].sort(byRecentOpen).map((r) => r.id)).toEqual(["opened", "unopened"]);
  });

  it("orders two opened hubs by most-recently-opened first", () => {
    const older = row({ id: "older", open_count: 2, last_opened_at: "2026-01-01T00:00:00Z" });
    const newer = row({ id: "newer", open_count: 5, last_opened_at: "2026-02-01T00:00:00Z" });
    expect([older, newer].sort(byRecentOpen).map((r) => r.id)).toEqual(["newer", "older"]);
  });

  it("falls back to first_opened_at when last_opened_at is missing", () => {
    const a = row({ id: "a", open_count: 1, last_opened_at: null, first_opened_at: "2026-01-01T00:00:00Z" });
    const b = row({ id: "b", open_count: 1, last_opened_at: null, first_opened_at: "2026-03-01T00:00:00Z" });
    expect([a, b].sort(byRecentOpen).map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("leaves two unopened hubs in their incoming order (stable sort)", () => {
    const a = row({ id: "a", open_count: 0 });
    const b = row({ id: "b", open_count: 0 });
    expect([a, b].sort(byRecentOpen).map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("matchesHubSearch", () => {
  const applicant = row({ applicant_name: "Ada Lovelace", applicant_email: "ada@example.com" });

  it("matches a substring of the applicant's name, case-insensitively", () => {
    expect(matchesHubSearch(applicant, "lovelace")).toBe(true);
  });

  it("matches a substring of the applicant's email", () => {
    expect(matchesHubSearch(applicant, "EXAMPLE")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(matchesHubSearch(applicant, "grace hopper")).toBe(false);
  });

  it("matches everything for a blank query", () => {
    expect(matchesHubSearch(applicant, "   ")).toBe(true);
  });
});

describe("sortHubRows", () => {
  it("newest keeps the array's incoming order untouched", () => {
    const rows = [row({ id: "a" }), row({ id: "b" })];
    expect(sortHubRows(rows, "newest")).toBe(rows);
  });

  it("opens sorts by byRecentOpen without mutating the original array", () => {
    const unopened = row({ id: "unopened", open_count: 0 });
    const opened = row({ id: "opened", open_count: 1, last_opened_at: "2026-01-01T00:00:00Z" });
    const rows = [unopened, opened];
    const sorted = sortHubRows(rows, "opens");
    expect(sorted.map((r) => r.id)).toEqual(["opened", "unopened"]);
    expect(rows.map((r) => r.id)).toEqual(["unopened", "opened"]);
  });
});
