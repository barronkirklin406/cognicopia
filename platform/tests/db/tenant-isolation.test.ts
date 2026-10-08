import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { C, EMPTY_CALENDAR, F, K, seedFixtures, U } from "./fixtures";
import { anon, as, createDb, service, user } from "./harness";

/**
 * Row level security: who can see and change which rows.
 * Every test runs as a particular signed-in user, in a transaction that is
 * rolled back. Alice and Bob belong to facility A; Carol and Dave to facility B.
 */

let db: PGlite;
const alice = user(U.alice);
const bob = user(U.bob);
const carol = user(U.carol);
const erin = user(U.erin);

beforeAll(async () => {
  db = await createDb();
  await seedFixtures(db);
});
afterAll(async () => {
  await db.close();
});

const ids = (rows: Record<string, unknown>[], key = "id") => rows.map((r) => r[key]).sort();
const noTables = ["facilities", "facility_users", "content_items", "activity_calendars"];

describe("signed-out visitors", () => {
  it.each(noTables)("cannot read %s", async (table) => {
    await as(db, anon, async (s) => {
      expect((await s.fails(`select * from public.${table}`))?.code).toBe("42501");
    });
  });

  it.each(noTables)("cannot write %s", async (table) => {
    await as(db, anon, async (s) => {
      expect((await s.fails(`delete from public.${table}`))?.code).toBe("42501");
    });
  });

  it("cannot create a facility", async () => {
    await as(db, anon, async (s) => {
      expect((await s.fails("select public.create_facility('Anywhere')"))?.code).toBe("42501");
    });
  });

  it("cannot call the internal helpers", async () => {
    await as(db, anon, async (s) => {
      expect((await s.fails("select private.current_facility_id()"))?.code).toBe("42501");
    });
  });
});

describe("a signed-in user who belongs to no facility", () => {
  it("sees no tenant data and no content", async () => {
    await as(db, erin, async (s) => {
      for (const table of noTables) {
        expect(await s.rows(`select * from public.${table}`), table).toEqual([]);
      }
    });
  });

  it("cannot write a calendar", async () => {
    await as(db, erin, async (s) => {
      const failure = await s.fails(
        "insert into public.activity_calendars (facility_id, month_year, generated_data) values ($1, '2026-11', $2::jsonb)",
        [F.a, EMPTY_CALENDAR],
      );
      expect(failure?.code).toBe("42501");
    });
  });
});

describe("reading", () => {
  it("a staff member sees only their own facility", async () => {
    await as(db, bob, async (s) => {
      expect(ids(await s.rows("select id from public.facilities"))).toEqual([F.a]);
    });
    await as(db, user(U.dave), async (s) => {
      expect(ids(await s.rows("select id from public.facilities"))).toEqual([F.b]);
    });
  });

  it("an admin sees only their own facility", async () => {
    await as(db, alice, async (s) => {
      expect(ids(await s.rows("select id from public.facilities"))).toEqual([F.a]);
      expect(await s.rows("select id from public.facilities where id = $1", [F.b])).toEqual([]);
    });
  });

  it("members see their own team, never another facility's", async () => {
    await as(db, bob, async (s) => {
      expect(ids(await s.rows("select id from public.facility_users"))).toEqual([U.alice, U.bob].sort());
      expect(await s.rows("select id from public.facility_users where facility_id = $1", [F.b])).toEqual([]);
    });
  });

  it("members see their own calendars, never another facility's", async () => {
    await as(db, bob, async (s) => {
      expect(ids(await s.rows("select id from public.activity_calendars"))).toEqual([C.a]);
      expect(await s.rows("select id from public.activity_calendars where id = $1", [C.b])).toEqual([]);
    });
    await as(db, carol, async (s) => {
      expect(ids(await s.rows("select id from public.activity_calendars"))).toEqual([C.b]);
    });
  });

  it("every member of any facility can read the whole content library", async () => {
    for (const who of [alice, bob, carol, user(U.dave)]) {
      await as(db, who, async (s) => {
        expect(ids(await s.rows("select id from public.content_items"))).toEqual([K.early, K.universal, K.late].sort());
      });
    }
  });

  it("the facility row is readable, including its billing status", async () => {
    await as(db, bob, async (s) => {
      const [row] = await s.rows<{ facility_name: string; subscription_status: string }>(
        "select facility_name, subscription_status from public.facilities",
      );
      expect(row).toEqual({ facility_name: "Maple Court", subscription_status: "active" });
    });
  });
});

describe("calendars: staff and admins of a facility may write theirs", () => {
  const insertSql =
    "insert into public.activity_calendars (facility_id, month_year, generated_data) values ($1, $2, $3::jsonb)";

  it.each([
    ["a staff member", bob],
    ["an admin", alice],
  ])("%s can add a calendar for their own facility", async (_label, who) => {
    await as(db, who, async (s) => {
      const out = await s.run(insertSql, [F.a, "2026-11", EMPTY_CALENDAR]);
      expect(out.affected).toBe(1);
    });
  });

  it("cannot add a calendar for another facility", async () => {
    await as(db, bob, async (s) => {
      const failure = await s.fails(insertSql, [F.b, "2026-11", EMPTY_CALENDAR]);
      expect(failure?.code).toBe("42501");
      expect(failure?.message).toMatch(/row-level security/i);
    });
  });

  it("can change their own calendar", async () => {
    await as(db, bob, async (s) => {
      const out = await s.run(
        "update public.activity_calendars set generated_data = $2::jsonb where id = $1",
        [C.a, JSON.stringify({ schema_version: 1, month: "2026-10", groups: [], slots: [], note: "changed" })],
      );
      expect(out.affected).toBe(1);
    });
  });

  it("cannot change another facility's calendar: the row is simply not there for them", async () => {
    await as(db, bob, async (s) => {
      const out = await s.run("update public.activity_calendars set generated_data = '{}'::jsonb where id = $1", [C.b]);
      expect(out.affected).toBe(0);
      // ...and nothing changed: look again as the server.
      await s.become(service);
      expect(
        await s.value("select generated_data = $2::jsonb from public.activity_calendars where id = $1", [C.b, EMPTY_CALENDAR]),
      ).toBe(true);
    });
  });

  it("cannot move a calendar into another facility", async () => {
    await as(db, bob, async (s) => {
      const failure = await s.fails("update public.activity_calendars set facility_id = $1 where id = $2", [F.b, C.a]);
      expect(failure?.code).toBe("42501");
    });
  });

  it("cannot delete another facility's calendar; can delete their own", async () => {
    await as(db, bob, async (s) => {
      expect((await s.run("delete from public.activity_calendars where id = $1", [C.b])).affected).toBe(0);
      expect((await s.run("delete from public.activity_calendars where id = $1", [C.a])).affected).toBe(1);
    });
  });

  it("an upsert for the same month replaces the calendar", async () => {
    await as(db, bob, async (s) => {
      const out = await s.run(
        `${insertSql} on conflict (facility_id, month_year) do update set generated_data = excluded.generated_data`,
        [F.a, "2026-10", JSON.stringify({ schema_version: 1, month: "2026-10", groups: [], slots: [], note: "v2" })],
      );
      expect(out.affected).toBe(1);
      expect(await s.value("select count(*)::int from public.activity_calendars")).toBe(1);
      expect(await s.value("select generated_data ->> 'note' from public.activity_calendars")).toBe("v2");
    });
  });

  it("an upsert cannot be aimed at another facility's month", async () => {
    await as(db, bob, async (s) => {
      const failure = await s.fails(
        `${insertSql} on conflict (facility_id, month_year) do update set generated_data = excluded.generated_data`,
        [F.b, "2026-10", EMPTY_CALENDAR],
      );
      expect(failure?.code).toBe("42501");
    });
  });

  it("a facility can have only one calendar per month", async () => {
    await as(db, bob, async (s) => {
      const failure = await s.fails(insertSql, [F.a, "2026-10", EMPTY_CALENDAR]);
      expect(failure?.code).toBe("23505");
    });
  });
});

describe("content is read-only for facilities", () => {
  it.each([
    ["insert", "insert into public.content_items (title, category, dementia_stage, content_payload) values ('x', 'word', 'early', '{}')"],
    ["update", "update public.content_items set title = 'changed'"],
    ["delete", "delete from public.content_items"],
  ])("an admin cannot %s", async (_op, sql) => {
    await as(db, alice, async (s) => {
      expect((await s.fails(sql))?.code).toBe("42501");
    });
  });

  it("the service role can load content", async () => {
    await as(db, service, async (s) => {
      const out = await s.run(
        "insert into public.content_items (title, category, dementia_stage, content_payload) values ('New', 'music', 'middle', '{\"schema_version\":1,\"summary\":\"s\"}')",
      );
      expect(out.affected).toBe(1);
    });
  });
});

describe("the service role", () => {
  it("sees every facility's data", async () => {
    await as(db, service, async (s) => {
      expect(await s.value("select count(*)::int from public.facilities")).toBe(2);
      expect(await s.value("select count(*)::int from public.activity_calendars")).toBe(2);
    });
  });

  it("writes billing columns", async () => {
    await as(db, service, async (s) => {
      const out = await s.run("update public.facilities set subscription_status = 'past_due' where stripe_customer_id = 'cus_maple1'");
      expect(out.affected).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------
// Statements with no WHERE. A policy's USING clause is the only thing standing
// between a bare "delete from t" or "update t set ..." and every tenant's rows,
// so each one is run bare, and the other facility's rows are checked afterwards.
// ---------------------------------------------------------------------

describe("a statement with no WHERE reaches only the caller's own facility", () => {
  const rowsOf = (s: import("./harness").Session, table: string, facility: string) =>
    s.value<number>(`select count(*)::int from public.${table} where facility_id = $1`, [facility]);

  it("delete from activity_calendars", async () => {
    await as(db, bob, async (s) => {
      expect((await s.run("delete from public.activity_calendars")).affected).toBe(1);
      await s.become(service);
      expect(await rowsOf(s, "activity_calendars", F.a)).toBe(0);
      expect(await rowsOf(s, "activity_calendars", F.b)).toBe(1);
    });
  });

  it("update activity_calendars", async () => {
    await as(db, bob, async (s) => {
      const changed = JSON.stringify({ schema_version: 1, month: "2026-10", groups: [], slots: [], note: "changed" });
      expect((await s.run("update public.activity_calendars set generated_data = $1::jsonb", [changed])).affected).toBe(1);
      await s.become(service);
      expect(await s.value("select generated_data ->> 'note' from public.activity_calendars where facility_id = $1", [F.b])).toBeNull();
    });
  });

  it("update facilities, by an admin", async () => {
    await as(db, alice, async (s) => {
      expect((await s.run("update public.facilities set facility_name = 'Renamed'")).affected).toBe(1);
      await s.become(service);
      expect(await s.value("select facility_name from public.facilities where id = $1", [F.b])).toBe("Birch Manor");
    });
  });

  it("update facility_users, by an admin", async () => {
    await as(db, alice, async (s) => {
      expect((await s.run("update public.facility_users set role = 'admin'")).affected).toBe(2); // alice and bob only
      await s.become(service);
      expect(await s.value("select role::text from public.facility_users where id = $1", [U.dave])).toBe("staff");
    });
  });

  it("delete from facility_users, by an admin: only their own facility's people can go", async () => {
    await as(db, alice, async (s) => {
      expect((await s.run("delete from public.facility_users where role = 'staff'")).affected).toBe(1); // Bob, not Dave
      await s.become(service);
      expect(await rowsOf(s, "facility_users", F.b)).toBe(2);
      expect(await rowsOf(s, "facility_users", F.a)).toBe(1);
    });
  });

  it("delete from facility_users with nothing to narrow it: the last admin cannot go, so the database refuses all of it", async () => {
    await as(db, alice, async (s) => {
      expect((await s.fails("delete from public.facility_users"))?.code).toBe("CG001");
      await s.become(service);
      expect(await rowsOf(s, "facility_users", F.a)).toBe(2);
      expect(await rowsOf(s, "facility_users", F.b)).toBe(2);
    });
  });

  it("delete from facility_invites, by an admin", async () => {
    await as(db, alice, async (s) => {
      await s.run("select public.create_facility_invite('a@example.com')");
      await s.become(carol);
      await s.run("select public.create_facility_invite('b@example.com')");
      await s.become(alice);
      expect((await s.run("delete from public.facility_invites")).affected).toBe(1);
      await s.become(service);
      expect(await rowsOf(s, "facility_invites", F.b)).toBe(1);
    });
  });
});
