import { describe, expect, it } from "vitest";
import { getCalendar, getCalendarsForMonths, saveCalendar } from "@/lib/data/calendars";
import { contentByIds, listContent } from "@/lib/data/content";
import type { Db } from "@/lib/data/db";
import { DataError } from "@/lib/data/errors";
import { createFacility, getFacility, getMembership } from "@/lib/data/facilities";
import { emptyCalendar } from "@/lib/domain/calendar";

/**
 * The data functions, against a recording stand-in for the Supabase client.
 * These check what is asked of the database and how a failure is reported. What
 * the database does with it (row level security, constraints) is tested in
 * tests/db against a real Postgres.
 */

type Result = { data?: unknown; error?: { code?: string; message?: string } | null };

function fakeDb(result: Result) {
  const calls: [string, unknown[]][] = [];
  const settled = { data: null, error: null, ...result };
  const chain: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "then") return (resolve: (v: unknown) => void) => resolve(settled); // `await query`
        return (...args: unknown[]) => {
          calls.push([prop, args]);
          return prop === "maybeSingle" || prop === "single" ? Promise.resolve(settled) : chain;
        };
      },
    },
  );
  const db = {
    from: (table: string) => {
      calls.push(["from", [table]]);
      return chain;
    },
    rpc: (name: string, args: unknown) => {
      calls.push(["rpc", [name, args]]);
      return Promise.resolve(settled);
    },
  } as unknown as Db;
  return { db, calls };
}

const names = (calls: [string, unknown[]][]) => calls.map(([name]) => name);
const rejects = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(DataError);
    return error as DataError;
  }
  throw new Error("expected a DataError");
};

describe("facilities", () => {
  it("createFacility calls the create_facility function and returns the id", async () => {
    const { db, calls } = fakeDb({ data: "11111111-1111-4111-8111-111111111111" });
    expect(await createFacility(db, "Maple Court")).toBe("11111111-1111-4111-8111-111111111111");
    expect(calls).toEqual([["rpc", ["create_facility", { p_facility_name: "Maple Court" }]]]);
  });

  it("createFacility reports a database refusal as a DataError", async () => {
    const { db } = fakeDb({ error: { code: "CG002", message: "This account already belongs to a facility." } });
    const error = await rejects(createFacility(db, "Maple Court"));
    expect([error.status, error.code]).toEqual([409, "already_member"]);
  });

  it("getMembership asks for one row by the user's id", async () => {
    const { db, calls } = fakeDb({ data: { id: "u1", facility_id: "f1", role: "admin" } });
    expect(await getMembership(db, "u1")).toEqual({ id: "u1", facility_id: "f1", role: "admin" });
    expect(calls).toContainEqual(["from", ["facility_users"]]);
    expect(calls).toContainEqual(["eq", ["id", "u1"]]);
  });

  it("getMembership is null for someone with no facility", async () => {
    expect(await getMembership(fakeDb({ data: null }).db, "u1")).toBeNull();
  });

  it("getFacility returns what row level security lets the caller see", async () => {
    const { db, calls } = fakeDb({ data: { id: "f1", facility_name: "Maple Court" } });
    expect(await getFacility(db)).toEqual({ id: "f1", facility_name: "Maple Court" });
    expect(names(calls)).toEqual(["from", "select", "maybeSingle"]);
  });
});

describe("calendars", () => {
  const row = (data: unknown) => ({ id: "c1", facility_id: "f1", month_year: "2026-10", created_at: "2026-10-01T00:00:00Z", generated_data: data });

  it("getCalendar looks up by month, and returns the data checked against the schema", async () => {
    const { db, calls } = fakeDb({ data: row(emptyCalendar("2026-10")) });
    const calendar = await getCalendar(db, "2026-10");
    expect(calendar?.generated_data).toEqual(emptyCalendar("2026-10"));
    expect(calls).toContainEqual(["from", ["activity_calendars"]]);
    expect(calls).toContainEqual(["eq", ["month_year", "2026-10"]]);
  });

  it("getCalendar is null when there is none", async () => {
    expect(await getCalendar(fakeDb({ data: null }).db, "2026-10")).toBeNull();
  });

  it("getCalendar refuses stored data that no longer fits the schema, without echoing it", async () => {
    const { db } = fakeDb({ data: row({ schema_version: 1, month: "2026-10", note: "Margaret takes medication", groups: [], slots: [] }) });
    const error = await rejects(getCalendar(db, "2026-10"));
    expect([error.status, error.code]).toEqual([500, "stored_data_invalid"]);
    expect(error.message).not.toMatch(/Margaret/);
  });

  it("getCalendarsForMonths asks once for the distinct months, and returns the calendars by month", async () => {
    const { db, calls } = fakeDb({ data: [row(emptyCalendar("2026-10")), { ...row(emptyCalendar("2026-11")), id: "c2", month_year: "2026-11" }] });
    const found = await getCalendarsForMonths(db, ["2026-10", "2026-11", "2026-10", "2026-12"]);
    expect([...found.keys()]).toEqual(["2026-10", "2026-11"]);
    expect(calls).toContainEqual(["in", ["month_year", ["2026-10", "2026-11", "2026-12"]]]);
    expect(calls.filter(([name]) => name === "from")).toHaveLength(1);
  });

  it("getCalendarsForMonths asks nothing for no months", async () => {
    const { db, calls } = fakeDb({ data: [] });
    expect((await getCalendarsForMonths(db, [])).size).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it("getCalendarsForMonths refuses stored data that no longer fits the schema", async () => {
    const { db } = fakeDb({ data: [row({ schema_version: 1, month: "2026-10", groups: [], slots: [], extra: 1 })] });
    expect((await rejects(getCalendarsForMonths(db, ["2026-10"]))).code).toBe("stored_data_invalid");
  });

  it("saveCalendar upserts on the facility and month, and returns the saved calendar", async () => {
    const input = { facility_id: "f1", month_year: "2026-10", generated_data: emptyCalendar("2026-10") };
    const { db, calls } = fakeDb({ data: row(emptyCalendar("2026-10")) });
    const saved = await saveCalendar(db, input);
    expect(saved.month_year).toBe("2026-10");
    expect(calls).toContainEqual(["upsert", [input, { onConflict: "facility_id,month_year" }]]);
  });

  it("saveCalendar reports the database's resident-key refusal as a 422 that names no field's content", async () => {
    const { db } = fakeDb({
      error: { code: "23514", message: 'new row violates check constraint "activity_calendars_generated_data_no_phi_keys"' },
    });
    const error = await rejects(saveCalendar(db, { facility_id: "f1", month_year: "2026-10", generated_data: emptyCalendar("2026-10") }));
    expect([error.status, error.code]).toEqual([422, "phi_keys"]);
  });
});

describe("content", () => {
  const item = (stage: string) => ({
    id: "k1", title: "Chair yoga", category: "movement", dementia_stage: stage, created_at: "2026-10-01T00:00:00Z",
    content_payload: { schema_version: 1, summary: "Gentle stretches." },
  });

  it("lists the library ordered by category and title", async () => {
    const { db, calls } = fakeDb({ data: [item("universal")] });
    const items = await listContent(db);
    expect(items).toHaveLength(1);
    expect(calls.filter(([name]) => name === "order")).toEqual([
      ["order", ["category", { ascending: true }]],
      ["order", ["title", { ascending: true }]],
    ]);
  });

  it("a stage also asks for the universal items", async () => {
    const { db, calls } = fakeDb({ data: [] });
    await listContent(db, { stage: "early" });
    expect(calls).toContainEqual(["in", ["dementia_stage", ["early", "universal"]]]);
  });

  it("filters by category", async () => {
    const { db, calls } = fakeDb({ data: [] });
    await listContent(db, { category: "music" });
    expect(calls).toContainEqual(["eq", ["category", "music"]]);
  });

  it.each([
    [undefined, 100],
    [5, 5],
    [0, 1],
    [-3, 1],
    [999, 999],
    [5000, 1000],
  ])("a limit of %s asks for %i", async (asked, sent) => {
    const { db, calls } = fakeDb({ data: [] });
    await listContent(db, { limit: asked });
    expect(calls).toContainEqual(["limit", [sent]]);
  });

  it("contentByIds asks once for the distinct ids, and returns the items by id", async () => {
    const { db, calls } = fakeDb({ data: [item("early")] });
    const found = await contentByIds(db, ["k1", "k1", "k2"]);
    expect([...found.keys()]).toEqual(["k1"]);
    expect(found.get("k1")?.title).toBe("Chair yoga");
    expect(calls).toContainEqual(["in", ["id", ["k1", "k2"]]]);
  });

  it("contentByIds asks nothing for no ids", async () => {
    const { db, calls } = fakeDb({ data: [] });
    expect((await contentByIds(db, [])).size).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it("fails loudly on a library item with a bad payload: that is our bug, not the caller's", async () => {
    const bad = { ...item("early"), content_payload: { schema_version: 1 } };
    const error = await rejects(listContent(fakeDb({ data: [bad] }).db));
    expect([error.status, error.code]).toEqual([500, "stored_data_invalid"]);
  });

  it("reports a database refusal", async () => {
    const error = await rejects(listContent(fakeDb({ error: { code: "42501", message: "permission denied" } }).db));
    expect(error.status).toBe(403);
  });
});
