// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addDays, dueDigests, istMidnight, istNow, movedLater, parseTime, shortDate, weekRangeLabel, type DigestSettings } from "./schedule";

const settings: DigestSettings = {
  daily_digest_enabled: true,
  daily_digest_time: "19:00",
  weekly_digest_enabled: true,
  weekly_digest_day: 1,
  weekly_digest_time: "09:00",
};

// IST is UTC+05:30. 13:30 UTC is 19:00 IST.
const at = (iso: string) => new Date(iso);

describe("IST clock", () => {
  it("reads the date, minutes and weekday in IST", () => {
    // 2026-10-01 is a Thursday. 20:00 UTC is 01:30 IST the next day.
    expect(istNow(at("2026-10-01T10:00:00Z"))).toEqual({ date: "2026-10-01", minutes: 15 * 60 + 30, weekday: 4 });
    expect(istNow(at("2026-10-01T20:00:00Z"))).toEqual({ date: "2026-10-02", minutes: 90, weekday: 5 });
  });

  it("finds midnight IST and counts days", () => {
    expect(istMidnight("2026-10-01").toISOString()).toBe("2026-09-30T18:30:00.000Z");
    expect(addDays("2026-10-01", -7)).toBe("2026-09-24");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("parses HH:MM and nothing else", () => {
    expect(parseTime("19:30")).toBe(1170);
    expect(parseTime("00:00")).toBe(0);
    for (const bad of ["24:00", "9:00", "19:60", "", "19-00"]) expect(parseTime(bad)).toBeNull();
  });
});

describe("dueDigests", () => {
  it("sends nothing before the daily time", () => {
    expect(dueDigests(at("2026-10-01T13:00:00Z"), settings)).toEqual([]);
  });

  it("makes the daily digest due from its time, covering midnight IST to now", () => {
    const now = at("2026-10-01T13:35:00Z");
    const [daily, ...rest] = dueDigests(now, settings);
    expect(rest).toEqual([]);
    expect(daily.kind).toBe("daily");
    expect(daily.periodStart).toBe("2026-10-01");
    expect(daily.from.toISOString()).toBe("2026-09-30T18:30:00.000Z");
    expect(daily.to).toBe(now);
  });

  it("keeps the daily digest due for the rest of the IST day, then moves to the next day", () => {
    expect(dueDigests(at("2026-10-01T18:00:00Z"), settings)[0].periodStart).toBe("2026-10-01");
    expect(dueDigests(at("2026-10-01T18:40:00Z"), settings)).toEqual([]);
  });

  it("makes the weekly digest due on its day, covering the seven days before and the seven before those", () => {
    // 2026-10-05 is a Monday. 04:00 UTC is 09:30 IST.
    const due = dueDigests(at("2026-10-05T04:00:00Z"), { ...settings, daily_digest_enabled: false });
    expect(due).toHaveLength(1);
    const weekly = due[0];
    expect(weekly.kind).toBe("weekly");
    expect(weekly.periodStart).toBe("2026-10-05");
    expect(weekly.from.toISOString()).toBe(istMidnight("2026-09-28").toISOString());
    expect(weekly.to.toISOString()).toBe(istMidnight("2026-10-05").toISOString());
    expect(weekly.previousFrom?.toISOString()).toBe(istMidnight("2026-09-21").toISOString());
    expect(weekly.previousTo?.toISOString()).toBe(weekly.from.toISOString());
  });

  it("does not send the weekly digest on another day or before its time", () => {
    expect(dueDigests(at("2026-10-06T04:00:00Z"), { ...settings, daily_digest_enabled: false })).toEqual([]);
    expect(dueDigests(at("2026-10-05T02:00:00Z"), { ...settings, daily_digest_enabled: false })).toEqual([]);
  });

  it("honours the switches and ignores an invalid time", () => {
    const now = at("2026-10-05T14:00:00Z");
    expect(dueDigests(now, { ...settings, daily_digest_enabled: false, weekly_digest_enabled: false })).toEqual([]);
    expect(dueDigests(now, { ...settings, daily_digest_time: "nope", weekly_digest_enabled: false })).toEqual([]);
  });

  it("can make both due at once", () => {
    expect(dueDigests(at("2026-10-05T14:00:00Z"), settings).map((d) => d.kind)).toEqual(["daily", "weekly"]);
  });
});

describe("labels", () => {
  it("writes a short date and a week range", () => {
    expect(shortDate("2026-10-01")).toBe("Thu 1 Oct");
    expect(weekRangeLabel(istMidnight("2026-09-28"), istMidnight("2026-10-05"))).toBe("Mon 28 Sep to Sun 4 Oct");
  });
});

describe("movedLater", () => {
  it("resends only when the time was moved later than the one it was sent for", () => {
    expect(movedLater("21:25", "22:30")).toBe(true);
    expect(movedLater("22:30", "22:30")).toBe(false);
    expect(movedLater("22:30", "21:25")).toBe(false);
  });

  it("never resends from a missing or invalid time", () => {
    expect(movedLater(null, "22:30")).toBe(false);
    expect(movedLater("21:25", "")).toBe(false);
  });

  it("records the time each digest was due at", () => {
    const [daily] = dueDigests(at("2026-10-01T13:35:00Z"), settings);
    expect(daily.scheduledTime).toBe("19:00");
  });
});
