import { afterEach, describe, expect, it, vi } from "vitest";
import { bytesToGb, formatGb, loadEmailUsage, loadSupabaseUsage, percent, readPositiveNumber } from "./usage";

describe("usage helpers", () => {
  it("converts bytes to binary gigabytes", () => {
    expect(bytesToGb(1024 ** 3)).toBe(1);
    expect(bytesToGb(512 * 1024 ** 2)).toBe(0.5);
  });

  it("shows a small total with three decimals so it does not read as zero", () => {
    expect(formatGb(0)).toBe("0.000 GB");
    expect(formatGb(0.0042)).toBe("0.004 GB");
    expect(formatGb(0.5)).toBe("0.50 GB");
    expect(formatGb(12.345)).toBe("12.35 GB");
  });

  it("returns null for a percentage of nothing", () => {
    expect(percent(0, 0)).toBeNull();
    expect(percent(1, 4)).toBe(25);
  });

  it("accepts only positive numbers from configuration", () => {
    expect(readPositiveNumber("3000")).toBe(3000);
    expect(readPositiveNumber("0")).toBeNull();
    expect(readPositiveNumber("abc")).toBeNull();
    expect(readPositiveNumber(undefined)).toBeNull();
    expect(readPositiveNumber("")).toBeNull();
  });
});

function fakeSupabase(counts: Record<string, number>) {
  return {
    from: () => {
      const filters: Record<string, string> = {};
      const chain = {
        select: () => chain,
        eq: (col: string, val: string) => {
          filters[col] = val;
          return chain;
        },
        gte: () => Promise.resolve({ count: counts[`${filters.provider}:${filters.status}`] ?? 0 }),
      };
      return chain;
    },
  } as never;
}

describe("loadEmailUsage", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("derives the delivery rate from the send log", async () => {
    const usage = await loadEmailUsage(
      fakeSupabase({ "zeptomail:sent": 80, "zeptomail:failed": 20 }),
    );
    expect(usage.sent).toBe(80);
    expect(usage.failed).toBe(20);
    expect(usage.deliveryPercent).toBe(80);
    expect(usage.usedThisMonth).toBe(80);
  });

  it("reports no rate when nothing has been sent", async () => {
    const usage = await loadEmailUsage(fakeSupabase({}));
    expect(usage.deliveryPercent).toBeNull();
  });
});

describe("loadSupabaseUsage limits", () => {
  afterEach(() => vi.unstubAllEnvs());
  const rpc = { rpc: () => ({ single: async () => ({ data: { database_bytes: 1024 ** 3 / 4, storage_bytes: 0 }, error: null }) }) } as never;

  it("defaults to the Supabase free plan", async () => {
    vi.stubEnv("SUPABASE_DATABASE_LIMIT_GB", "");
    vi.stubEnv("SUPABASE_STORAGE_LIMIT_GB", "");
    const usage = await loadSupabaseUsage(rpc);
    expect(usage?.databaseLimitGb).toBe(0.5);
    expect(usage?.storageLimitGb).toBe(1);
  });

  it("lets an environment value override the free plan", async () => {
    vi.stubEnv("SUPABASE_DATABASE_LIMIT_GB", "8");
    expect((await loadSupabaseUsage(rpc))?.databaseLimitGb).toBe(8);
  });
});
