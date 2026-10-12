import { describe, expect, it } from "vitest";
import { ALERT_DAYS, buildStorageAlert, decideAlert, istDate, STORAGE_LIMITS } from "./storageAlerts";

const fresh = { daysSent: 0, lastSentOn: null };

describe("istDate", () => {
  it("uses the IST calendar day, not UTC's", () => {
    expect(istDate(new Date("2026-10-11T20:00:00Z"))).toBe("2026-10-12");
    expect(istDate(new Date("2026-10-11T04:00:00Z"))).toBe("2026-10-11");
  });
});

describe("thresholds", () => {
  it("warns at 0.4 GB of the database and 9 GB of R2", () => {
    expect(STORAGE_LIMITS.database.warnAtGb).toBe(0.4);
    expect(STORAGE_LIMITS.r2.warnAtGb).toBe(9);
  });
});

describe("decideAlert", () => {
  it("stays quiet at or under the threshold", () => {
    expect(decideAlert(0.4, 0.4, fresh, "2026-10-11")).toBe("skip");
    expect(decideAlert(0.1, 0.4, fresh, "2026-10-11")).toBe("skip");
  });

  it("sends on the first day over the threshold", () => {
    expect(decideAlert(0.41, 0.4, fresh, "2026-10-11")).toBe("send");
  });

  it("sends only once on a given day", () => {
    expect(decideAlert(0.45, 0.4, { daysSent: 1, lastSentOn: "2026-10-11" }, "2026-10-11")).toBe("skip");
  });

  it("sends on each of the next days, up to three", () => {
    expect(decideAlert(0.45, 0.4, { daysSent: 1, lastSentOn: "2026-10-11" }, "2026-10-12")).toBe("send");
    expect(decideAlert(0.45, 0.4, { daysSent: 2, lastSentOn: "2026-10-12" }, "2026-10-13")).toBe("send");
    expect(decideAlert(0.45, 0.4, { daysSent: ALERT_DAYS, lastSentOn: "2026-10-13" }, "2026-10-14")).toBe("skip");
  });

  it("starts again after usage has dropped back under the line", () => {
    const done = { daysSent: 3, lastSentOn: "2026-10-13" };
    expect(decideAlert(0.3, 0.4, done, "2026-10-20")).toBe("reset");
    expect(decideAlert(0.5, 0.4, fresh, "2026-10-25")).toBe("send");
  });
});

describe("buildStorageAlert", () => {
  it("names the service, the usage against the free limit and the warning number", () => {
    const mail = buildStorageAlert("database", 0.42, 2, "https://app.example.com");
    expect(mail.subject).toBe("Supabase database is 84% used (0.42 GB of 0.50 GB)");
    expect(mail.html).toContain("warning 2 of 3");
    expect(mail.html).toContain("https://app.example.com/admin/settings");
  });

  it("describes R2 and omits the link when there is no site address", () => {
    const mail = buildStorageAlert("r2", 9.3, 1, "");
    expect(mail.subject).toBe("Cloudflare R2 storage is 93% used (9.30 GB of 10.00 GB)");
    expect(mail.html).not.toContain("Open Settings");
  });
});
