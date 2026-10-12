import { describe, expect, it, vi } from "vitest";

describe("getServerEnv", () => {
  it("parses valid env vars", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    const { getServerEnv } = await import("./env");
    const env = getServerEnv();

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
  });

  it("throws when required env vars are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const { getServerEnv } = await import("./env");

    expect(() => getServerEnv()).toThrow();
  });
});
