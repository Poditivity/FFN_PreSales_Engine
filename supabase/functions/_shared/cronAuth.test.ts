import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isServiceCall } from "./cronAuth";

const KEY = "service-role-key-value";

function request(headers: Record<string, string>) {
  return new Request("https://example.test/fn", { method: "POST", headers });
}

function adminReturning(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { admin: { rpc } as never, rpc };
}

describe("isServiceCall", () => {
  beforeEach(() => {
    (globalThis as { Deno?: unknown }).Deno = { env: { get: (name: string) => (name === "SUPABASE_SERVICE_ROLE_KEY" ? KEY : undefined) } };
  });
  afterEach(() => {
    delete (globalThis as { Deno?: unknown }).Deno;
  });

  it("accepts the service role key as the bearer token", async () => {
    const { admin, rpc } = adminReturning({ data: false, error: null });
    expect(await isServiceCall(request({ Authorization: `Bearer ${KEY}` }), admin)).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("accepts the database's cron token when the database vouches for it", async () => {
    const { admin, rpc } = adminReturning({ data: true, error: null });
    const ok = await isServiceCall(request({ Authorization: "Bearer some.other.jwt", "x-cron-token": "abc" }), admin);
    expect(ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("cron_token_ok", { p_token: "abc" });
  });

  it("refuses a token the database does not recognise, or an error", async () => {
    expect(await isServiceCall(request({ "x-cron-token": "nope" }), adminReturning({ data: false, error: null }).admin)).toBe(false);
    expect(await isServiceCall(request({ "x-cron-token": "nope" }), adminReturning({ data: true, error: { message: "boom" } }).admin)).toBe(false);
  });

  it("refuses a call with neither", async () => {
    const { admin, rpc } = adminReturning({ data: true, error: null });
    expect(await isServiceCall(request({ Authorization: "Bearer wrong" }), admin)).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
