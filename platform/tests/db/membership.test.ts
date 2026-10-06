import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EMPTY_CALENDAR, F, seedFixtures, U } from "./fixtures";
import { as, createDb, owner, service, user } from "./harness";

/**
 * Facilities and their teams: what an admin may change, what no tenant may
 * change, the rule that a facility always keeps an admin, how a facility is
 * created, and what deleting things does.
 */

let db: PGlite;
const alice = user(U.alice); // admin, facility A
const bob = user(U.bob); // staff, facility A
const carol = user(U.carol); // admin, facility B
const erin = user(U.erin); // no facility yet

beforeAll(async () => {
  db = await createDb();
  await seedFixtures(db);
});
afterAll(async () => {
  await db.close();
});

describe("the facility record", () => {
  it("an admin can rename their facility", async () => {
    await as(db, alice, async (s) => {
      const out = await s.run("update public.facilities set facility_name = 'Maple Court North' where id = $1", [F.a]);
      expect(out.affected).toBe(1);
      expect(await s.value("select facility_name from public.facilities")).toBe("Maple Court North");
    });
  });

  it("a staff member cannot: their update matches no row", async () => {
    await as(db, bob, async (s) => {
      const out = await s.run("update public.facilities set facility_name = 'Hijacked' where id = $1", [F.a]);
      expect(out.affected).toBe(0);
      expect(await s.value("select facility_name from public.facilities")).toBe("Maple Court");
    });
  });

  it("an admin cannot rename another facility", async () => {
    await as(db, alice, async (s) => {
      const out = await s.run("update public.facilities set facility_name = 'Hijacked' where id = $1", [F.b]);
      expect(out.affected).toBe(0);
    });
  });

  it("an admin cannot hand their facility to another by changing its id", async () => {
    await as(db, alice, async (s) => {
      const failure = await s.fails("update public.facilities set id = gen_random_uuid() where id = $1", [F.a]);
      expect(failure?.code).toBe("42501");
    });
  });

  it.each([
    ["subscription_status", "update public.facilities set subscription_status = 'active'"],
    ["stripe_customer_id", "update public.facilities set stripe_customer_id = 'cus_stolen'"],
    ["created_at", "update public.facilities set created_at = now()"],
  ])("not even an admin can change %s (billing belongs to the server)", async (_column, sql) => {
    await as(db, alice, async (s) => {
      expect((await s.fails(sql))?.code).toBe("42501");
    });
  });

  it("an admin cannot blank the name", async () => {
    await as(db, alice, async (s) => {
      const failure = await s.fails("update public.facilities set facility_name = '   ' where id = $1", [F.a]);
      expect(failure?.code).toBe("23514");
    });
  });

  it("nobody can create or delete a facility directly", async () => {
    for (const who of [alice, bob, erin]) {
      await as(db, who, async (s) => {
        expect((await s.fails("insert into public.facilities (facility_name) values ('Mine')"))?.code).toBe("42501");
        expect((await s.fails("delete from public.facilities"))?.code).toBe("42501");
      });
    }
  });
});

describe("the team", () => {
  it("an admin can make a staff member an admin, and back", async () => {
    await as(db, alice, async (s) => {
      expect((await s.run("update public.facility_users set role = 'admin' where id = $1", [U.bob])).affected).toBe(1);
      expect(await s.value("select role::text from public.facility_users where id = $1", [U.bob])).toBe("admin");
      expect((await s.run("update public.facility_users set role = 'staff' where id = $1", [U.bob])).affected).toBe(1);
    });
  });

  it("a staff member cannot change anyone's role, including their own", async () => {
    await as(db, bob, async (s) => {
      expect((await s.run("update public.facility_users set role = 'admin' where id = $1", [U.bob])).affected).toBe(0);
      expect((await s.run("update public.facility_users set role = 'staff' where id = $1", [U.alice])).affected).toBe(0);
      await s.become(owner);
      expect(await s.value("select role::text from public.facility_users where id = $1", [U.bob])).toBe("staff");
    });
  });

  it("an admin cannot change another facility's team", async () => {
    await as(db, alice, async (s) => {
      expect((await s.run("update public.facility_users set role = 'admin' where id = $1", [U.dave])).affected).toBe(0);
      expect((await s.run("delete from public.facility_users where id = $1", [U.dave])).affected).toBe(0);
    });
  });

  it.each([
    ["facility_id", "update public.facility_users set facility_id = $2 where id = $1"],
    ["email", "update public.facility_users set email = $2 where id = $1"],
    ["id", "update public.facility_users set id = $2 where id = $1"],
  ])("not even an admin can change a member's %s", async (column, sql) => {
    await as(db, alice, async (s) => {
      const value = column === "email" ? "someone.else@maple.example" : F.b;
      expect((await s.fails(sql, [U.bob, value]))?.code).toBe("42501");
    });
  });

  it("an admin can remove a staff member; a staff member cannot remove anyone", async () => {
    await as(db, alice, async (s) => {
      expect((await s.run("delete from public.facility_users where id = $1", [U.bob])).affected).toBe(1);
    });
    await as(db, bob, async (s) => {
      expect((await s.run("delete from public.facility_users where id = $1", [U.alice])).affected).toBe(0);
    });
  });

  it("nobody can add a member directly: invitations go through the server", async () => {
    for (const who of [alice, bob, erin]) {
      await as(db, who, async (s) => {
        const failure = await s.fails(
          "insert into public.facility_users (id, facility_id, email, role) values ($1, $2, 'erin@cedar.example', 'admin')",
          [U.erin, F.a],
        );
        expect(failure?.code).toBe("42501");
      });
    }
  });

  it("a member's email is stored in one normal form", async () => {
    await as(db, owner, async (s) => {
      const failure = await s.fails(
        "insert into public.facility_users (id, facility_id, email) values ($1, $2, 'Erin@Cedar.example')",
        [U.erin, F.a],
      );
      expect(failure?.constraint).toBe("facility_users_email_format");
    });
  });

  it("a new member is staff unless made an admin", async () => {
    await as(db, service, async (s) => {
      await s.run("insert into public.facility_users (id, facility_id, email) values ($1, $2, 'erin@cedar.example')", [U.erin, F.a]);
      expect(await s.value("select role::text from public.facility_users where id = $1", [U.erin])).toBe("staff");
    });
  });
});

describe("a facility always keeps an admin", () => {
  it("the only admin cannot demote themselves", async () => {
    await as(db, alice, async (s) => {
      const failure = await s.fails("update public.facility_users set role = 'staff' where id = $1", [U.alice]);
      expect(failure?.code).toBe("CG001");
      expect(failure?.message).toMatch(/at least one admin/i);
    });
  });

  it("the only admin cannot leave", async () => {
    await as(db, alice, async (s) => {
      expect((await s.fails("delete from public.facility_users where id = $1", [U.alice]))?.code).toBe("CG001");
    });
  });

  it("even the server cannot strip a facility of its last admin", async () => {
    await as(db, service, async (s) => {
      expect((await s.fails("delete from public.facility_users where id = $1", [U.alice]))?.code).toBe("CG001");
      expect((await s.fails("update public.facility_users set facility_id = $2 where id = $1", [U.alice, F.b]))?.code).toBe("CG001");
    });
  });

  it("with a second admin, one may step down, and then the other is the last", async () => {
    await as(db, alice, async (s) => {
      await s.run("update public.facility_users set role = 'admin' where id = $1", [U.bob]);
      // Alice may now step down...
      expect((await s.run("update public.facility_users set role = 'staff' where id = $1", [U.alice])).affected).toBe(1);
      // ...but then Bob is the last admin.
      await s.become(bob);
      expect((await s.fails("update public.facility_users set role = 'staff' where id = $1", [U.bob]))?.code).toBe("CG001");
      expect((await s.fails("delete from public.facility_users where id = $1", [U.bob]))?.code).toBe("CG001");
    });
  });

  it("a staff member leaving is never a problem", async () => {
    await as(db, service, async (s) => {
      expect((await s.run("delete from public.facility_users where id = $1", [U.bob])).affected).toBe(1);
    });
  });
});

describe("deleting", () => {
  it("deleting a facility removes its team and calendars, even though it has a last admin", async () => {
    await as(db, service, async (s) => {
      expect((await s.run("delete from public.facilities where id = $1", [F.a])).affected).toBe(1);
      expect(await s.value("select count(*)::int from public.facility_users where facility_id = $1", [F.a])).toBe(0);
      expect(await s.value("select count(*)::int from public.activity_calendars where facility_id = $1", [F.a])).toBe(0);
      // The other facility is untouched.
      expect(await s.value("select count(*)::int from public.facility_users where facility_id = $1", [F.b])).toBe(2);
    });
  });

  it("deleting a staff member's account removes their membership", async () => {
    await as(db, owner, async (s) => {
      await s.run("delete from auth.users where id = $1", [U.bob]);
      expect(await s.value("select count(*)::int from public.facility_users where id = $1", [U.bob])).toBe(0);
    });
  });

  it("deleting the last admin's account is refused until the facility has another admin", async () => {
    await as(db, owner, async (s) => {
      expect((await s.fails("delete from auth.users where id = $1", [U.alice]))?.code).toBe("CG001");
      await s.run("update public.facility_users set role = 'admin' where id = $1", [U.bob]);
      await s.run("delete from auth.users where id = $1", [U.alice]);
      expect(await s.value("select count(*)::int from public.facility_users where id = $1", [U.alice])).toBe(0);
    });
  });
});

describe("a changed sign-in email", () => {
  it("is copied to the membership, in normal form", async () => {
    await as(db, owner, async (s) => {
      await s.run("update auth.users set email = 'Alice.Renamed@Maple.example' where id = $1", [U.alice]);
      expect(await s.value("select email from public.facility_users where id = $1", [U.alice])).toBe("alice.renamed@maple.example");
    });
  });

  it("leaves other people alone", async () => {
    await as(db, owner, async (s) => {
      await s.run("update auth.users set email = 'alice2@maple.example' where id = $1", [U.alice]);
      expect(await s.value("select email from public.facility_users where id = $1", [U.bob])).toBe("bob@maple.example");
    });
  });
});

describe("create_facility()", () => {
  it("makes the caller the admin of a new facility, with the name trimmed and the email from their account", async () => {
    await as(db, erin, async (s) => {
      const id = await s.value<string>("select public.create_facility('  Cedar House  ')");
      expect(id).toMatch(/^[0-9a-f-]{36}$/);

      const [membership] = await s.rows<{ facility_id: string; email: string; role: string }>(
        "select facility_id, email, role::text as role from public.facility_users where id = $1",
        [U.erin],
      );
      expect(membership).toEqual({ facility_id: id, email: "erin@cedar.example", role: "admin" });

      const [facility] = await s.rows<{ facility_name: string; subscription_status: string; stripe_customer_id: string | null }>(
        "select facility_name, subscription_status::text as subscription_status, stripe_customer_id from public.facilities",
      );
      expect(facility).toEqual({ facility_name: "Cedar House", subscription_status: "trialing", stripe_customer_id: null });
    });
  });

  it("the new admin can immediately use their facility, and still sees no one else's", async () => {
    await as(db, erin, async (s) => {
      const id = await s.value<string>("select public.create_facility('Cedar House')");
      const out = await s.run(
        "insert into public.activity_calendars (facility_id, month_year, generated_data) values ($1, '2026-10', $2::jsonb)",
        [id, EMPTY_CALENDAR],
      );
      expect(out.affected).toBe(1);
      expect(await s.value("select count(*)::int from public.facilities")).toBe(1);
      expect(await s.value("select count(*)::int from public.activity_calendars")).toBe(1);
      expect(await s.value("select count(*)::int from public.content_items")).toBe(3); // and the library is open to them
    });
  });

  it("refuses a second facility for the same account", async () => {
    await as(db, erin, async (s) => {
      await s.run("select public.create_facility('Cedar House')");
      expect((await s.fails("select public.create_facility('Another')"))?.code).toBe("CG002");
    });
  });

  it("refuses an account that already belongs to a facility", async () => {
    for (const who of [alice, bob]) {
      await as(db, who, async (s) => {
        expect((await s.fails("select public.create_facility('Mine')"))?.code).toBe("CG002");
      });
    }
  });

  it("refuses an unconfirmed email address", async () => {
    await as(db, user(U.frank), async (s) => {
      expect((await s.fails("select public.create_facility('Elm Grove')"))?.code).toBe("CG003");
    });
  });

  it("refuses an anonymous sign-in, which has no email", async () => {
    await as(db, user(U.gina), async (s) => {
      expect((await s.fails("select public.create_facility('Anonymous')"))?.code).toBe("CG003");
    });
  });

  it("refuses an account that does not exist", async () => {
    await as(db, user("00000000-0000-4000-8000-0000000000ff"), async (s) => {
      expect((await s.fails("select public.create_facility('Ghost')"))?.code).toBe("CG003");
    });
  });

  it.each([
    ["blank", "   "],
    ["empty", ""],
    ["too long", "x".repeat(121)],
  ])("refuses a %s name", async (_label, name) => {
    await as(db, erin, async (s) => {
      expect((await s.fails("select public.create_facility($1)", [name]))?.code).toBe("22023");
    });
  });

  it("refuses a missing name", async () => {
    await as(db, erin, async (s) => {
      expect((await s.fails("select public.create_facility(null)"))?.code).toBe("22023");
    });
  });

  it("is atomic: a refused call leaves nothing behind", async () => {
    await as(db, erin, async (s) => {
      await s.fails("select public.create_facility('   ')");
      await s.become(owner);
      expect(await s.value("select count(*)::int from public.facilities")).toBe(2);
    });
  });

});

describe("the helpers behind the policies", () => {
  it("tell a signed-in user their own facility and role, and nothing about anyone else's", async () => {
    await as(db, bob, async (s) => {
      expect(await s.value("select private.current_facility_id()")).toBe(F.a);
      expect(await s.value("select private.current_facility_role()::text")).toBe("staff");
    });
    await as(db, carol, async (s) => {
      expect(await s.value("select private.current_facility_id()")).toBe(F.b);
      expect(await s.value("select private.current_facility_role()::text")).toBe("admin");
    });
    await as(db, erin, async (s) => {
      expect(await s.value("select private.current_facility_id()")).toBeNull();
    });
  });
});
