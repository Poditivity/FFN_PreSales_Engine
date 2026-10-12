import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanUpE2eData, e2eName, E2E_PREFIX, ensureSmokeForm, removeSmokeForm, SMOKE_FORM_SCHEMA, SMOKE_FORM_SLUG } from "./e2eData";

type Row = Record<string, unknown>;

// A tiny in-memory stand-in for the supabase-js query builder: just the calls
// cleanUpE2eData makes (select / delete / like / in / eq / maybeSingle).
function fakeDb(tables: Record<string, Row[]>) {
  const deletedUsers: string[] = [];
  const value = (row: Row, column: string): unknown => {
    const [col, key] = column.split("->>");
    const v = row[col];
    return key ? (v as Row | undefined)?.[key] : v;
  };
  const from = (table: string) => {
    const filters: Array<(r: Row) => boolean> = [];
    let isDelete = false;
    let inserted: Row | null = null;
    const run = () => {
      if (inserted) {
        tables[table] = [...(tables[table] ?? []), inserted];
        return { data: [inserted], error: null };
      }
      const rows = tables[table] ?? [];
      const hit = rows.filter((r) => filters.every((f) => f(r)));
      if (isDelete) tables[table] = rows.filter((r) => !hit.includes(r));
      return { data: hit, error: null };
    };
    const builder = {
      select: () => builder,
      insert: (row: Row) => {
        inserted = { id: `generated-${(tables[table] ?? []).length + 1}`, ...row };
        return builder;
      },
      single: () => Promise.resolve({ data: run().data[0] ?? null, error: null }),
      delete: () => {
        isDelete = true;
        return builder;
      },
      like: (column: string, pattern: string) => {
        const re = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`);
        filters.push((r) => typeof value(r, column) === "string" && re.test(value(r, column) as string));
        return builder;
      },
      in: (column: string, values: unknown[]) => {
        filters.push((r) => values.includes(value(r, column)));
        return builder;
      },
      eq: (column: string, v: unknown) => {
        filters.push((r) => value(r, column) === v);
        return builder;
      },
      maybeSingle: () => Promise.resolve({ data: run().data[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(run()).then(resolve),
    };
    return builder;
  };
  const db = {
    from,
    auth: {
      admin: {
        deleteUser: (id: string) => {
          deletedUsers.push(id);
          tables.profiles = (tables.profiles ?? []).filter((p) => p.id !== id); // profiles cascade from auth.users
          return Promise.resolve({ error: null });
        },
      },
    },
  };
  return { db: db as unknown as SupabaseClient, tables, deletedUsers };
}

const ids = (rows: Row[]) => rows.map((r) => r.id);

describe("e2eName", () => {
  it("prefixes with the marker the cleanup looks for", () => {
    expect(e2eName("Applicant Hub Create")).toBe("E2E Applicant Hub Create");
    expect(e2eName("x").startsWith(E2E_PREFIX)).toBe(true);
  });
});

describe("cleanUpE2eData", () => {
  let tables: Record<string, Row[]>;

  beforeEach(() => {
    tables = {
      tracks: [
        { id: "t-e2e", name: "E2E Track Hub Create" },
        { id: "t-idea", name: "Idea Stage" },
      ],
      hubs: [
        { id: "h-on-e2e-track", track_id: "t-e2e", applicant_name: null },
        { id: "h-standalone-e2e", track_id: "t-idea", applicant_name: "E2E Applicant Standalone Hubs List" },
        { id: "h-real", track_id: "t-idea", applicant_name: "EduPoX" },
      ],
      forms: [{ id: "f-smoke", slug: "e2e-smoke-test" }],
      form_submissions: [
        { id: "s-e2e", form_id: "f-smoke", data: { name: "E2E Applicant Lead Pipeline" } },
        { id: "s-other-person", form_id: "f-smoke", data: { name: "Someone Else" } },
      ],
      analytics_events: [
        { id: "a-smoke", form_slug: "e2e-smoke-test" },
        { id: "a-real", form_slug: "apply" },
      ],
      founders: [
        { id: "f-e2e", name: "E2E Founder Upload" },
        { id: "f-real", name: "Nymisha" },
      ],
      mentors: [
        { id: "m-e2e", name: "E2E Mentor Upload" },
        { id: "m-real", name: "Praveen Dorna" },
      ],
      case_studies: [
        { id: "c-e2e", title: "E2E Case Study Zero to Revenue" },
        { id: "c-real", title: "Case Study Test" },
      ],
      email_templates: [
        { id: "e-e2e", name: "E2E Template Stage Auto" },
        { id: "e-real", name: "Test" },
      ],
      profiles: [
        { id: "u-e2e-admin", email: "e2e-admin@example.com" },
        { id: "u-invitee", email: "admin-team-e2e-invitee-1@example.com" },
        { id: "u-rls", email: "leads-rls-nonadmin-test@example.com" },
        { id: "u-real-1", email: "devidinymisha05@gmail.com" },
        { id: "u-real-2", email: "priyaallam24@gmail.com" },
      ],
    };
  });

  it("removes everything the suite created and nothing else", async () => {
    const { db, tables: after, deletedUsers } = fakeDb(tables);
    await cleanUpE2eData(db);

    expect(ids(after.tracks)).toEqual(["t-idea"]);
    expect(ids(after.hubs)).toEqual(["h-real"]);
    expect(ids(after.form_submissions)).toEqual(["s-other-person"]);
    expect(ids(after.analytics_events)).toEqual(["a-real"]);
    expect(ids(after.founders)).toEqual(["f-real"]);
    expect(ids(after.mentors)).toEqual(["m-real"]);
    expect(ids(after.case_studies)).toEqual(["c-real"]);
    expect(ids(after.email_templates)).toEqual(["e-real"]);
    expect(after.forms).toHaveLength(1); // the smoke-test fixture form itself stays
    expect(deletedUsers.sort()).toEqual(["u-e2e-admin", "u-invitee", "u-rls"]);
  });

  it("is a no-op the second time", async () => {
    const { db, tables: after, deletedUsers } = fakeDb(tables);
    await cleanUpE2eData(db);
    deletedUsers.length = 0;
    const snapshot = JSON.stringify(after);
    await cleanUpE2eData(db);
    expect(JSON.stringify(after)).toBe(snapshot);
    expect(deletedUsers).toEqual([]);
  });
});

describe("the smoke-test form", () => {
  it("is created when missing, reused when present, and removed on request", async () => {
    const { db, tables } = fakeDb({ forms: [] });

    const id = await ensureSmokeForm(db);
    expect(tables.forms).toHaveLength(1);
    expect(tables.forms[0]).toMatchObject({ slug: SMOKE_FORM_SLUG, status: "active", title: "E2E Smoke Test Form", schema: SMOKE_FORM_SCHEMA });

    expect(await ensureSmokeForm(db)).toBe(id);
    expect(tables.forms).toHaveLength(1);

    await removeSmokeForm(db);
    expect(tables.forms).toHaveLength(0);
  });

  it("asks name, email and why, in that order, so the specs can type into the three fields", () => {
    const ids = SMOKE_FORM_SCHEMA.nodes.filter((n) => n.type === "question").map((n) => n.id);
    expect(ids).toEqual(["name", "email", "why"]);
    expect(SMOKE_FORM_SCHEMA.edges.map((e) => `${e.source}>${e.target}`)).toEqual(["start>name", "name>email", "email>why", "why>end1"]);
  });
});
