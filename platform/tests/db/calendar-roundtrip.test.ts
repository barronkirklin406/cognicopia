import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_GROUPS, MAX_SLOTS, type CalendarData, emptyCalendar, parseCalendarData } from "@/lib/domain/calendar";
import { F, seedFixtures, U } from "./fixtures";
import { as, createDb, user } from "./harness";

/**
 * What the application accepts, the database accepts. A calendar that passes
 * parseCalendarData() must never be refused by the table's own constraints
 * (resident-key guard, size, depth): that would be an error the user cannot fix.
 */

let db: PGlite;
beforeAll(async () => {
  db = await createDb();
  await seedFixtures(db);
});
afterAll(async () => {
  await db.close();
});

const insert = "insert into public.activity_calendars (facility_id, month_year, generated_data) values ($1, $2, $3::jsonb)";
const CONTENT = "5eed0000-0000-4000-8000-000000000001";

/** The largest calendar the schema allows: every list full, every string at its longest. */
function largest(month: string): CalendarData {
  const id = (prefix: string, n: number) => `${prefix}${n}`.padEnd(40, "x").slice(0, 40);
  return {
    schema_version: 1,
    month,
    groups: Array.from({ length: MAX_GROUPS }, (_, i) => ({ id: id("g", i), name: "n".repeat(60), wing: "w".repeat(60), acuity: 4 as const, size: 60 })),
    slots: Array.from({ length: MAX_SLOTS }, (_, i) => ({
      id: id("s", i),
      date: `${month}-${String(1 + (i % 28)).padStart(2, "0")}`,
      time: `${String(6 + (i % 15)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
      group_id: id("g", i % MAX_GROUPS),
      content_item_id: CONTENT,
      locked: true,
      note: "m".repeat(140),
    })),
    generator: { name: "g".repeat(60), version: "v".repeat(20), seed: "s".repeat(60) },
  };
}

describe("a calendar the application accepts is a calendar the database accepts", () => {
  it("an empty calendar", async () => {
    const parsed = parseCalendarData("2026-10", emptyCalendar("2026-10"));
    expect(parsed.ok).toBe(true);
    await as(db, user(U.alice), async (s) => {
      expect((await s.run(insert, [F.a, "2026-11", JSON.stringify(emptyCalendar("2026-10"))])).affected).toBe(1);
    });
  });

  it("the largest calendar the schema allows fits the 1 MiB limit", async () => {
    const calendar = largest("2026-10");
    const parsed = parseCalendarData("2026-10", calendar);
    expect(parsed.ok, parsed.ok ? "" : JSON.stringify(parsed.issues.slice(0, 3))).toBe(true);

    await as(db, user(U.alice), async (s) => {
      const failure = await s.fails(insert, [F.a, "2026-11", JSON.stringify(calendar)]);
      expect(failure, failure ? `${failure.constraint}: ${failure.message}` : "").toBeNull();
      const size = await s.value<number>("select octet_length(generated_data::text) from public.activity_calendars where month_year = '2026-11'");
      // Close to the limit, never over it: this is the headroom the schema is sized for.
      expect(size).toBeLessThan(1048576);
      expect(size).toBeGreaterThan(800000);
    });
  });

  it("one more session than the schema allows is refused by the application first", () => {
    const calendar = largest("2026-10");
    calendar.slots.push({ ...calendar.slots[0]!, id: "one-too-many" });
    expect(parseCalendarData("2026-10", calendar).ok).toBe(false);
  });
});
