import { describe, expect, it } from "vitest";
import { saveGeneratedCalendarFlow } from "@/lib/calendar/flows";
import type { Db } from "@/lib/data/db";
import { CalendarDataSchema } from "@/lib/domain/calendar";
import { generateCalendar, toGeneratorItem } from "@/lib/domain/calendar-generator";
import { seedLibrary } from "../helpers/library";

/** What the generator's Save button does, against a recording stand-in for the signed-in user's database client. */

const FACILITY = "f0000000-0000-4000-8000-000000000001";
const library = seedLibrary();

type Fail = { code?: string; message?: string } | null;

function fakeDb(options: { items?: unknown[]; readError?: Fail; saveError?: Fail } = {}) {
  const calls: [string, unknown[]][] = [];
  const saved: unknown[] = [];
  const db = {
    from: (table: string) => {
      calls.push(["from", [table]]);
      const chain: Record<string, unknown> = new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === "then") {
              return (resolve: (v: unknown) => void) =>
                resolve(table === "content_items" ? { data: options.readError ? null : (options.items ?? library), error: options.readError ?? null } : { data: null, error: null });
            }
            return (...args: unknown[]) => {
              calls.push([prop, args]);
              if (prop === "upsert") saved.push(args[0]);
              if (prop === "single") {
                const input = saved.at(-1) as { facility_id: string; month_year: string; generated_data: unknown };
                return Promise.resolve(options.saveError ? { data: null, error: options.saveError } : { data: { id: "c1", created_at: "2026-10-01T00:00:00Z", ...input }, error: null });
              }
              return chain;
            };
          },
        },
      );
      return chain;
    },
  } as unknown as Db;
  return { db, calls, saved };
}

const plan = { month: "2026-11", theme: "aviation", stages: ["early", "middle", "late"], perDay: "3", seed: "abc123" };

describe("saveGeneratedCalendarFlow", () => {
  it("reads the library, makes the month itself, saves it for the facility, and goes to the calendar", async () => {
    const { db, saved, calls } = fakeDb();
    const result = await saveGeneratedCalendarFlow(db, FACILITY, plan);
    expect(result).toEqual({ to: "/calendar?month=2026-11&notice=saved" });

    expect(saved).toHaveLength(1);
    const row = saved[0] as { facility_id: string; month_year: string; generated_data: unknown };
    expect([row.facility_id, row.month_year]).toEqual([FACILITY, "2026-11"]);
    expect(CalendarDataSchema.safeParse(row.generated_data).success).toBe(true);
    expect(calls).toContainEqual(["upsert", [row, { onConflict: "facility_id,month_year" }]]);
  });

  it("stores exactly what the planner makes for that plan: the browser's preview and the saved month agree", async () => {
    const { db, saved } = fakeDb();
    await saveGeneratedCalendarFlow(db, FACILITY, plan);
    const expected = generateCalendar({ month: "2026-11", theme: "aviation", stages: ["early", "middle", "late"], perDay: 3, seed: "abc123" }, library.map(toGeneratorItem));
    expect(expected.ok).toBe(true);
    expect((saved[0] as { generated_data: unknown }).generated_data).toEqual(expected.ok ? expected.data : null);
  });

  it("reads the whole library, up to the limit of a thousand", async () => {
    const { db, calls } = fakeDb();
    await saveGeneratedCalendarFlow(db, FACILITY, plan);
    expect(calls).toContainEqual(["limit", [1000]]);
  });

  it("only ever uses library ids that exist", async () => {
    const { db, saved } = fakeDb();
    await saveGeneratedCalendarFlow(db, FACILITY, plan);
    const ids = new Set(library.map((item) => item.id));
    for (const slot of (saved[0] as { generated_data: { slots: { content_item_id: string }[] } }).generated_data.slots) expect(ids.has(slot.content_item_id)).toBe(true);
  });

  it("takes the sessions a day from a form (text) or from data (a number)", async () => {
    for (const perDay of ["2", 2]) {
      const { db, saved } = fakeDb();
      expect(await saveGeneratedCalendarFlow(db, FACILITY, { ...plan, perDay, stages: ["early"] })).toHaveProperty("to");
      expect((saved[0] as { generated_data: { slots: unknown[] } }).generated_data.slots).toHaveLength(30 * 2);
    }
  });

  it.each([
    ["a month that is not a month", { month: "2026-13" }, "month"],
    ["a theme that does not exist", { theme: "pirates" }, "theme"],
    ["no stage", { stages: [] }, "stages"],
    ["a stage that does not exist", { stages: ["severe"] }, "stages"],
    ["four sessions a day", { perDay: "4" }, "perDay"],
    ["a seed with odd characters", { seed: "<script>" }, "seed"],
    ["no seed", { seed: undefined }, "seed"],
  ])("refuses %s, names the field and touches nothing", async (_name, change, field) => {
    const { db, calls } = fakeDb();
    const result = await saveGeneratedCalendarFlow(db, FACILITY, { ...plan, ...change });
    expect(result).toMatchObject({ state: { error: "Check the choices and try again." } });
    expect("state" in result && Object.keys(result.state.fieldErrors ?? {})).toContain(field);
    expect(calls).toEqual([]);
  });

  it("says so when the library is empty, and saves nothing", async () => {
    const { db, saved } = fakeDb({ items: [] });
    const result = await saveGeneratedCalendarFlow(db, FACILITY, plan);
    expect(result).toEqual({ state: { error: "The activity library is empty, so there is nothing to plan from." } });
    expect(saved).toEqual([]);
  });

  it("reports a lapsed subscription's refusal in words, not codes", async () => {
    const { db, saved } = fakeDb({ readError: { code: "42501", message: "permission denied for table content_items" } });
    const result = await saveGeneratedCalendarFlow(db, FACILITY, plan);
    expect(result).toMatchObject({ state: { error: expect.any(String) } });
    expect(JSON.stringify(result)).not.toMatch(/42501|content_items|permission denied/);
    expect(saved).toEqual([]);
  });

  it("reports a refused save without showing anything technical", async () => {
    const { db } = fakeDb({ saveError: { code: "42501", message: 'new row violates row-level security policy for table "activity_calendars"' } });
    const result = await saveGeneratedCalendarFlow(db, FACILITY, plan);
    expect(result).toMatchObject({ state: { error: expect.any(String) } });
    expect(JSON.stringify(result)).not.toMatch(/row-level|activity_calendars|42501/);
  });

  it("does not show an unexpected failure", async () => {
    const db = {
      from: () => {
        throw new Error("secret connection string postgres://user:pw@host");
      },
    } as unknown as Db;
    const result = await saveGeneratedCalendarFlow(db, FACILITY, plan);
    expect(result).toEqual({ state: { error: "Something went wrong. Please try again." } });
  });
});
