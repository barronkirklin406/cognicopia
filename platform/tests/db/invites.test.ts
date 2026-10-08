import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { F, seedFixtures, U } from "./fixtures";
import { anon, as, createDb, owner, service, user, type Session } from "./harness";

/**
 * Invitations to join a facility (migration 5): who can make one, what is
 * stored, who can use one, and what happens when it is used twice, late, or by
 * the wrong person.
 */

let db: PGlite;

beforeAll(async () => {
  db = await createDb();
  await seedFixtures(db);
});
afterAll(async () => {
  await db.close();
});

const alice = user(U.alice); // admin, facility A
const bob = user(U.bob); // staff, facility A
const carol = user(U.carol); // admin, facility B
const dave = user(U.dave); // staff, facility B
const erin = user(U.erin); // confirmed email erin@cedar.example, no facility
const frank = user(U.frank); // unconfirmed email
const gina = user(U.gina); // anonymous sign-in, no email
const hank = user(U.hank); // confirmed email hank@oak.example, no facility

const invite = (s: Session, email: string | null = null, role: string | null = null) =>
  s.value<string>("select public.create_facility_invite($1, coalesce($2, 'staff')::public.facility_role)", [email, role]);
const accept = (s: Session, token: string | null) => s.value<string>("select public.accept_facility_invite($1)", [token]);
const preview = (s: Session, token: string | null) =>
  s.rows<{ facility_name: string; role: string; email_locked: boolean; email_matches: boolean }>(
    "select * from public.preview_facility_invite($1)",
    [token],
  );
const members = (s: Session) =>
  s.rows<{ id: string; facility_id: string; email: string; role: string }>(
    "select id, facility_id, email, role::text as role from public.facility_users order by email",
  );

/** Make the most recent invitation expire an hour ago, as the server could. */
async function expire(s: Session, as_: typeof alice) {
  await s.become(owner);
  await s.run("update public.facility_invites set created_at = now() - interval '8 days', expires_at = now() - interval '1 hour'");
  await s.become(as_);
}

// ---------------------------------------------------------------------
// Making an invitation
// ---------------------------------------------------------------------

describe("create_facility_invite()", () => {
  it("gives an admin a long random secret, and stores only its SHA-256", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s);
      expect(token).toMatch(/^[0-9a-f]{64}$/);

      await s.become(owner);
      const [row] = await s.rows<{ token_hash: string; facility_id: string; email: string | null; role: string; created_by: string; accepted_at: string | null }>(
        "select token_hash, facility_id, email, role::text as role, created_by, accepted_at::text from public.facility_invites",
      );
      expect(row?.token_hash).toBe(await s.value("select encode(sha256(convert_to($1, 'UTF8')), 'hex')", [token]));
      expect(row).toMatchObject({ facility_id: F.a, email: null, role: "staff", created_by: U.alice, accepted_at: null });

      // The secret itself is nowhere in the table.
      expect(await s.value("select count(*)::int from public.facility_invites where to_jsonb(facility_invites)::text like '%' || $1 || '%'", [token])).toBe(0);
    });
  });

  it("lasts seven days", async () => {
    await as(db, alice, async (s) => {
      await invite(s);
      await s.become(owner);
      const days = await s.value<number>("select extract(epoch from (expires_at - created_at)) / 86400 from public.facility_invites");
      expect(days).toBeCloseTo(7, 3);
    });
  });

  it("every secret is different", async () => {
    await as(db, alice, async (s) => {
      const tokens = new Set([await invite(s), await invite(s), await invite(s), await invite(s)]);
      expect(tokens.size).toBe(4);
    });
  });

  it("can be tied to an email address, which is stored trimmed and in lower case", async () => {
    await as(db, alice, async (s) => {
      await invite(s, "  New.Person@Example.COM ");
      expect(await s.value("select email from public.facility_invites")).toBe("new.person@example.com");
    });
  });

  it("can offer the admin role", async () => {
    await as(db, alice, async (s) => {
      await invite(s, null, "admin");
      expect(await s.value("select role::text from public.facility_invites")).toBe("admin");
    });
  });

  it.each([
    ["a member of staff", bob],
    ["someone who belongs to no facility", erin],
    ["the other facility's staff", dave],
  ])("refuses %s with 42501", async (_label, who) => {
    await as(db, who, async (s) => {
      expect((await s.fails("select public.create_facility_invite()"))?.code).toBe("42501");
      await s.become(owner);
      expect(await s.value("select count(*)::int from public.facility_invites")).toBe(0);
    });
  });

  it("refuses a signed-out visitor, who has no right to call it", async () => {
    await as(db, anon, async (s) => {
      expect((await s.fails("select public.create_facility_invite()"))?.code).toBe("42501");
    });
  });

  it("refuses a caller who is not signed in at all (28000)", async () => {
    await as(db, service, async (s) => {
      expect((await s.fails("select public.create_facility_invite()"))?.code).toBe("28000");
    });
  });

  it.each(["not-an-email", "two@@x.example", "spa ce@x.example", "@x.example", "a@", `${"a".repeat(250)}@x.example`])(
    "refuses the email %j with 22023",
    async (email) => {
      await as(db, alice, async (s) => {
        expect((await s.fails("select public.create_facility_invite($1)", [email]))?.code).toBe("22023");
      });
    },
  );

  it("treats a blank email as none", async () => {
    await as(db, alice, async (s) => {
      await invite(s, "   ");
      expect(await s.value("select email from public.facility_invites")).toBeNull();
    });
  });

  it("refuses to invite someone who is already on the team (CG002)", async () => {
    await as(db, alice, async (s) => {
      expect((await s.fails("select public.create_facility_invite('Bob@Maple.example')"))?.code).toBe("CG002");
    });
  });

  it("a new invitation for an email replaces the open one: 'send again' is 'create again'", async () => {
    await as(db, alice, async (s) => {
      const first = await invite(s, "new@example.com");
      const second = await invite(s, "new@example.com");
      expect(second).not.toBe(first);
      expect(await s.value("select count(*)::int from public.facility_invites")).toBe(1);

      await s.become(erin);
      expect((await s.fails("select public.accept_facility_invite($1)", [first]))?.code).toBe("CG004"); // the old link is dead
    });
  });

  it("keeps invitations for different emails apart", async () => {
    await as(db, alice, async (s) => {
      await invite(s, "one@example.com");
      await invite(s, "two@example.com");
      await invite(s, null);
      await invite(s, null);
      expect(await s.value("select count(*)::int from public.facility_invites")).toBe(4);
    });
  });

  it("allows 50 open invitations and refuses the 51st (54000); used and expired ones do not count", async () => {
    await as(db, alice, async (s) => {
      for (let i = 0; i < 50; i++) await invite(s);
      expect((await s.fails("select public.create_facility_invite()"))?.code).toBe("54000");

      // One expires: there is room again.
      await s.become(owner);
      await s.run("update public.facility_invites set created_at = now() - interval '8 days', expires_at = now() - interval '1 hour' where id = (select id from public.facility_invites limit 1)");
      await s.become(alice);
      expect(await invite(s)).toMatch(/^[0-9a-f]{64}$/);
      expect((await s.fails("select public.create_facility_invite()"))?.code).toBe("54000");
    });
  });

  it("the limit is per facility", async () => {
    await as(db, alice, async (s) => {
      for (let i = 0; i < 50; i++) await invite(s);
      await s.become(carol);
      expect(await invite(s)).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  it("works for a lapsed facility too: the team can still be managed", async () => {
    await as(db, alice, async (s) => {
      await s.become(service);
      await s.run("update public.facilities set subscription_status = 'canceled' where id = $1", [F.a]);
      await s.become(alice);
      expect(await invite(s)).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});

// ---------------------------------------------------------------------
// Who can see and cancel invitations
// ---------------------------------------------------------------------

describe("reading and cancelling invitations", () => {
  it("an admin sees their own facility's invitations, and never another's", async () => {
    await as(db, alice, async (s) => {
      await invite(s, "a1@example.com");
      await invite(s, "a2@example.com");
      await s.become(carol);
      await invite(s, "b1@example.com");

      await s.become(alice);
      expect((await s.rows<{ email: string }>("select email from public.facility_invites order by email")).map((r) => r.email)).toEqual(["a1@example.com", "a2@example.com"]);
      await s.become(carol);
      expect((await s.rows<{ email: string }>("select email from public.facility_invites")).map((r) => r.email)).toEqual(["b1@example.com"]);
    });
  });

  it("staff see none, and neither does someone with no facility", async () => {
    await as(db, alice, async (s) => {
      await invite(s);
      for (const who of [bob, erin, dave]) {
        await s.become(who);
        expect(await s.value("select count(*)::int from public.facility_invites"), JSON.stringify(who)).toBe(0);
      }
    });
  });

  it("nobody signed in can read the hash of a secret: the column is not granted", async () => {
    await as(db, alice, async (s) => {
      await invite(s);
      expect((await s.fails("select token_hash from public.facility_invites"))?.code).toBe("42501");
      expect((await s.fails("select * from public.facility_invites"))?.code).toBe("42501");
      // Every other column is readable.
      expect(
        await s.value("select count(*)::int from (select id, facility_id, email, role, created_by, created_at, expires_at, accepted_at, accepted_by from public.facility_invites) t"),
      ).toBe(1);
    });
  });

  it("a signed-out visitor can read nothing", async () => {
    await as(db, anon, async (s) => {
      expect((await s.fails("select id from public.facility_invites"))?.code).toBe("42501");
    });
  });

  it("an admin can cancel an open invitation, and the link stops working", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s, "gone@example.com");
      expect((await s.run("delete from public.facility_invites")).affected).toBe(1);
      await s.become(erin);
      expect((await s.fails("select public.accept_facility_invite($1)", [token]))?.code).toBe("CG004");
    });
  });

  it("staff, and the other facility's admin, cannot cancel it", async () => {
    await as(db, alice, async (s) => {
      await invite(s);
      for (const who of [bob, carol, erin]) {
        await s.become(who);
        expect((await s.run("delete from public.facility_invites")).affected, JSON.stringify(who)).toBe(0);
      }
      await s.become(owner);
      expect(await s.value("select count(*)::int from public.facility_invites")).toBe(1);
    });
  });

  it("a used invitation cannot be cancelled: it stays as the record of who joined", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s);
      await s.become(erin);
      await accept(s, token);
      await s.become(alice);
      expect((await s.run("delete from public.facility_invites")).affected).toBe(0);
      expect(await s.value("select count(*)::int from public.facility_invites where accepted_at is not null")).toBe(1);
    });
  });

  it("nobody signed in can write to the table directly", async () => {
    for (const who of [alice, bob, erin, anon]) {
      await as(db, who, async (s) => {
        expect(
          (await s.fails(
            "insert into public.facility_invites (facility_id, token_hash, expires_at) values ($1, repeat('a', 64), now() + interval '1 day')",
            [F.a],
          ))?.code,
          JSON.stringify(who),
        ).toBe("42501");
        expect((await s.fails("update public.facility_invites set role = 'admin'"))?.code, JSON.stringify(who)).toBe("42501");
      });
    }
  });

  it("is removed with its facility", async () => {
    await as(db, alice, async (s) => {
      await invite(s);
      await s.become(owner);
      await s.run("delete from public.facilities where id = $1", [F.a]);
      expect(await s.value("select count(*)::int from public.facility_invites")).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------
// Constraints
// ---------------------------------------------------------------------

describe("constraints: facility_invites", () => {
  const insert = (hash: string, email: string | null, expires = "now() + interval '1 day'"): [string, unknown[]] => [
    `insert into public.facility_invites (facility_id, token_hash, email, expires_at) values ($1, $2, $3, ${expires})`,
    [F.a, hash, email],
  ];
  const HASH = "a".repeat(64);

  it.each(["", "abc", "A".repeat(64), "g".repeat(64), "a".repeat(63), "a".repeat(65)])("refuses the hash %j", async (hash) => {
    await as(db, owner, async (s) => {
      expect((await s.fails(...insert(hash, null)))?.constraint).toBe("facility_invites_token_hash_format");
    });
  });

  it("refuses two invitations with one hash", async () => {
    await as(db, owner, async (s) => {
      await s.run(...insert(HASH, null));
      expect((await s.fails(...insert(HASH, null)))?.constraint).toBe("facility_invites_token_hash_key");
    });
  });

  it.each(["Mixed@Case.example", "no-at-sign", " padded@x.example", ""])("refuses the email %j", async (email) => {
    await as(db, owner, async (s) => {
      expect((await s.fails(...insert(HASH, email)))?.constraint).toBe("facility_invites_email_format");
    });
  });

  it("refuses an invitation that expires before it was made", async () => {
    await as(db, owner, async (s) => {
      expect((await s.fails(...insert(HASH, null, "now() - interval '1 day'")))?.constraint).toBe("facility_invites_expiry_after_creation");
    });
  });
});

// ---------------------------------------------------------------------
// Seeing what a link is for
// ---------------------------------------------------------------------

describe("preview_facility_invite()", () => {
  it("shows the facility and the role, to a signed-in holder of the secret", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s);
      await s.become(erin);
      expect(await preview(s, token)).toEqual([{ facility_name: "Maple Court", role: "staff", email_locked: false, email_matches: true }]);
    });
  });

  it("says whether an email-locked invitation is for the person looking", async () => {
    await as(db, alice, async (s) => {
      const forErin = await invite(s, "ERIN@cedar.example", "admin");
      const forSomeoneElse = await invite(s, "someone@else.example");
      await s.become(erin);
      expect(await preview(s, forErin)).toEqual([{ facility_name: "Maple Court", role: "admin", email_locked: true, email_matches: true }]);
      expect(await preview(s, forSomeoneElse)).toEqual([{ facility_name: "Maple Court", role: "staff", email_locked: true, email_matches: false }]);
    });
  });

  it("tolerates spaces around the secret", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s);
      await s.become(erin);
      expect(await preview(s, `  ${token}\n`)).toHaveLength(1);
    });
  });

  it.each([
    ["an unknown secret", "f".repeat(64)],
    ["garbage", "not a token"],
    ["an empty string", ""],
    ["nothing", null],
  ])("shows nothing for %s", async (_label, token) => {
    await as(db, erin, async (s) => {
      expect(await preview(s, token)).toEqual([]);
    });
  });

  it("shows nothing once the invitation is used, or expired", async () => {
    await as(db, alice, async (s) => {
      const used = await invite(s);
      const late = await invite(s);
      await s.become(erin);
      await accept(s, used);
      await s.become(owner);
      await s.run("update public.facility_invites set created_at = now() - interval '8 days', expires_at = now() - interval '1 hour' where accepted_at is null");
      await s.become(hank);
      expect(await preview(s, used)).toEqual([]);
      expect(await preview(s, late)).toEqual([]);
    });
  });

  it("is not for signed-out visitors", async () => {
    await as(db, anon, async (s) => {
      expect((await s.fails("select * from public.preview_facility_invite('x')"))?.code).toBe("42501");
    });
  });

  it("shows nothing to a caller who is not signed in at all", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s);
      await s.become(service);
      expect(await preview(s, token)).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------
// Accepting
// ---------------------------------------------------------------------

describe("accept_facility_invite()", () => {
  it("makes the person a member of the facility, as staff, with their own email from their account", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s);
      await s.become(erin);
      expect(await accept(s, token)).toBe(F.a);

      expect(await members(s)).toEqual([
        { id: U.alice, facility_id: F.a, email: "alice@maple.example", role: "admin" },
        { id: U.bob, facility_id: F.a, email: "bob@maple.example", role: "staff" },
        { id: U.erin, facility_id: F.a, email: "erin@cedar.example", role: "staff" }, // stored in lower case
      ]);
      // They now see their new facility, and only that one.
      expect(await s.value("select facility_name from public.facilities")).toBe("Maple Court");
    });
  });

  it("gives the role the invitation offered", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s, null, "admin");
      await s.become(erin);
      await accept(s, token);
      expect(await s.value("select role::text from public.facility_users where id = $1", [U.erin])).toBe("admin");
    });
  });

  it("marks the invitation used, and records who used it", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s);
      await s.become(erin);
      await accept(s, token);
      await s.become(owner);
      const [row] = await s.rows<{ accepted_by: string; used: boolean }>("select accepted_by, accepted_at is not null as used from public.facility_invites");
      expect(row).toEqual({ accepted_by: U.erin, used: true });
    });
  });

  it("works for an email-locked invitation when the address matches, whatever its case", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s, "Erin@CEDAR.example");
      await s.become(erin);
      expect(await accept(s, token)).toBe(F.a);
    });
  });

  it("refuses an email-locked invitation for someone else (CG005), and leaves it open", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s, "someone@else.example");
      await s.become(erin);
      expect((await s.fails("select public.accept_facility_invite($1)", [token]))?.code).toBe("CG005");
      await s.become(owner);
      expect(await s.value("select count(*)::int from public.facility_users where id = $1", [U.erin])).toBe(0);
      expect(await s.value("select accepted_at is null from public.facility_invites")).toBe(true);
    });
  });

  it("works once: the second person to open the link is refused (CG004)", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s);
      await s.become(erin);
      await accept(s, token);
      await s.become(hank);
      expect((await s.fails("select public.accept_facility_invite($1)", [token]))?.code).toBe("CG004");
      await s.become(owner);
      expect(await s.value("select count(*)::int from public.facility_users where id = $1", [U.hank])).toBe(0);
    });
  });

  it("the same person opening the link again finds it used up (CG004)", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s);
      await s.become(erin);
      await accept(s, token);
      expect((await s.fails("select public.accept_facility_invite($1)", [token]))?.code).toBe("CG004");
    });
  });

  it("refuses an expired invitation (CG004)", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s);
      await expire(s, erin);
      expect((await s.fails("select public.accept_facility_invite($1)", [token]))?.code).toBe("CG004");
    });
  });

  it.each([
    ["an unknown secret", "f".repeat(64)],
    ["garbage", "hello"],
    ["an empty string", ""],
    ["nothing", null],
  ])("refuses %s (CG004)", async (_label, token) => {
    await as(db, erin, async (s) => {
      expect((await s.fails("select public.accept_facility_invite($1)", [token]))?.code).toBe("CG004");
    });
  });

  it("the secret must be exact: upper-casing it does not work", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s);
      await s.become(erin);
      expect((await s.fails("select public.accept_facility_invite($1)", [token.toUpperCase()]))?.code).toBe("CG004");
    });
  });

  it("refuses someone who already belongs to a facility (CG002), and leaves the invitation open", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s);
      await s.become(dave); // staff of facility B
      expect((await s.fails("select public.accept_facility_invite($1)", [token]))?.code).toBe("CG002");
      await s.become(owner);
      expect(await s.value("select facility_id from public.facility_users where id = $1", [U.dave])).toBe(F.b);
      expect(await s.value("select accepted_at is null from public.facility_invites")).toBe(true);
    });
  });

  it("refuses an account whose email is not confirmed (CG003)", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s);
      await s.become(frank);
      expect((await s.fails("select public.accept_facility_invite($1)", [token]))?.code).toBe("CG003");
    });
  });

  it("refuses an anonymous sign-in, which has no email (CG003)", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s);
      await s.become(gina);
      expect((await s.fails("select public.accept_facility_invite($1)", [token]))?.code).toBe("CG003");
    });
  });

  it("refuses a signed-out visitor, and a caller who is not signed in", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s);
      await s.become(anon);
      expect((await s.fails("select public.accept_facility_invite($1)", [token]))?.code).toBe("42501");
      await s.become(service);
      expect((await s.fails("select public.accept_facility_invite($1)", [token]))?.code).toBe("28000");
    });
  });

  it("is atomic: a refused attempt leaves everything as it was", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s, "someone@else.example");
      await s.become(erin);
      await s.fails("select public.accept_facility_invite($1)", [token]);
      await s.become(owner);
      expect(await s.value("select count(*)::int from public.facility_users")).toBe(4);
      expect(await s.value("select count(*)::int from public.facility_invites where accepted_at is not null")).toBe(0);
    });
  });

  it("works when the facility has lapsed: joining is not a premium tool", async () => {
    await as(db, alice, async (s) => {
      const token = await invite(s);
      await s.become(service);
      await s.run("update public.facilities set subscription_status = 'canceled' where id = $1", [F.a]);
      await s.become(erin);
      expect(await accept(s, token)).toBe(F.a);
      expect(await s.value("select count(*)::int from public.content_items")).toBe(0); // joined, but the library waits for the subscription
    });
  });

  it("a new member can use the facility straight away, as the role they were given", async () => {
    await as(db, alice, async (s) => {
      const staffToken = await invite(s);
      const adminToken = await invite(s, null, "admin");
      await s.become(erin);
      await accept(s, staffToken);
      expect(await s.value("select count(*)::int from public.content_items")).toBe(3);
      expect((await s.fails("select public.create_facility_invite()"))?.code).toBe("42501"); // staff cannot invite

      await s.become(hank);
      await accept(s, adminToken);
      expect(await invite(s)).toMatch(/^[0-9a-f]{64}$/); // an admin can
    });
  });
});
