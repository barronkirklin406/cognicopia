import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { C, F, seedFixtures, U } from "./fixtures";
import { as, createDb, service, user } from "./harness";

/**
 * The version a hand edit starts from. The database moves updated_at on every update, from its own clock,
 * so an edit made from an older copy finds nothing to update (the application turns that into a 409).
 */

let db: PGlite;
beforeAll(async () => {
  db = await createDb();
  await seedFixtures(db);
});
afterAll(async () => {
  await db.close();
});

const alice = user(U.alice);
const bob = user(U.bob);
const read = "select updated_at::text from public.activity_calendars where id = $1";
const conditional = "update public.activity_calendars set generated_data = $3::jsonb where facility_id = $1 and month_year = '2026-10' and updated_at = $2::timestamptz";
const data = (note: string) => JSON.stringify({ schema_version: 1, month: "2026-10", groups: [], slots: [], note });

describe("calendar updated_at", () => {
  it("is set when the month is first saved", async () => {
    await as(db, alice, async (s) => {
      expect(await s.value<string>(read, [C.a])).toMatch(/^\d{4}-\d{2}-\d{2} /);
    });
  });

  it("moves on with every update, even two in one transaction", async () => {
    await as(db, alice, async (s) => {
      const before = await s.value<string>(read, [C.a]);
      await s.run("update public.activity_calendars set generated_data = $2::jsonb where id = $1", [C.a, data("one")]);
      const first = await s.value<string>(read, [C.a]);
      await s.run("update public.activity_calendars set generated_data = $2::jsonb where id = $1", [C.a, data("two")]);
      const second = await s.value<string>(read, [C.a]);
      expect(first > before).toBe(true);
      expect(second > first).toBe(true);
    });
  });

  it("is not something a client can choose: the database's own clock wins", async () => {
    await as(db, alice, async (s) => {
      await s.run("update public.activity_calendars set updated_at = '2000-01-01T00:00:00Z' where id = $1", [C.a]);
      expect((await s.value<string>(read, [C.a])).startsWith("2000-")).toBe(false);
    });
  });

  it("refuses a save made from an out-of-date copy: the second editor updates nothing", async () => {
    await as(db, alice, async (s) => {
      const copy = await s.value<string>(read, [C.a]); // both editors open the month at this version
      const first = await s.run(conditional, [F.a, copy, data("first editor")]);
      expect(first.affected).toBe(1);

      await s.become(bob);
      const second = await s.run(conditional, [F.a, copy, data("second editor")]);
      expect(second.affected).toBe(0);

      await s.become(service);
      expect(await s.value<boolean>("select generated_data = $2::jsonb from public.activity_calendars where id = $1", [C.a, data("first editor")])).toBe(true);
    });
  });

  it("lets the second editor save once they start from the new version", async () => {
    await as(db, alice, async (s) => {
      await s.run("update public.activity_calendars set generated_data = $2::jsonb where id = $1", [C.a, data("first editor")]);
      const fresh = await s.value<string>(read, [C.a]);
      await s.become(bob);
      expect((await s.run(conditional, [F.a, fresh, data("second editor")])).affected).toBe(1);
    });
  });

  it("does not let a signed-in user call the trigger function", async () => {
    await as(db, alice, async (s) => {
      const failure = await s.fails("select private.set_updated_at()");
      expect(failure).not.toBeNull();
    });
  });
});
