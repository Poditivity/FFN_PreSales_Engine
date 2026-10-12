import { describe, expect, it } from "vitest";
import { loadSubmissions } from "./submissionsData";

function fakeSupabase() {
  const calls: Record<string, unknown[]> = {};
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "range", "or", "in"]) {
    chain[m] = (...args: unknown[]) => {
      (calls[m] ??= []).push(args);
      return chain;
    };
  }
  chain.returns = () => Promise.resolve({ data: [], error: null, count: 0 });
  return { supabase: { from: () => chain } as never, calls };
}

describe("loadSubmissions status filter", () => {
  it("treats New as no status stored, as well as an explicit new", async () => {
    const { supabase, calls } = fakeSupabase();
    await loadSubmissions(supabase, { formId: null, status: "new" });
    expect(calls.or).toEqual([["status.is.null,status.eq.new"]]);
    expect(calls.eq).toEqual([["completed", true]]);
  });

  it("matches other statuses exactly", async () => {
    const { supabase, calls } = fakeSupabase();
    await loadSubmissions(supabase, { formId: null, status: "shortlisted" });
    expect(calls.or).toBeUndefined();
    expect(calls.eq).toContainEqual(["status", "shortlisted"]);
  });
});
