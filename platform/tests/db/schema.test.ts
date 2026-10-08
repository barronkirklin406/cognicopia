import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EMPTY_CALENDAR, F, seedFixtures, U } from "./fixtures";
import { as, createDb, migrationFiles, owner } from "./harness";

/**
 * The shape of the schema: its constraints, the exact privileges each role
 * has, and a few rules that must hold for every table and function, so that
 * a table added later cannot quietly skip them.
 */

let db: PGlite;

beforeAll(async () => {
  db = await createDb();
  await seedFixtures(db);
});
afterAll(async () => {
  await db.close();
});

const TABLES = ["facilities", "facility_users", "content_items", "activity_calendars", "facility_invites"] as const;
const PRIVILEGES = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"] as const;

describe("migrations", () => {
  it("are five files, in order", () => {
    expect(migrationFiles()).toEqual([
      "20261006120000_core_schema.sql",
      "20261006120100_phi_guard.sql",
      "20261006120200_tenancy_and_rls.sql",
      "20261006180000_billing_and_access.sql",
      "20261006180100_facility_invites.sql",
    ]);
  });
});

describe("privileges: each role has exactly what it needs and no more", () => {
  // What a signed-in user may do at TABLE level. Column-level grants are checked below.
  // (facility_invites: SELECT is granted column by column, so it is not a table-level privilege.)
  const authenticated: Record<(typeof TABLES)[number], string[]> = {
    facilities: ["SELECT"],
    facility_users: ["SELECT", "DELETE"],
    content_items: ["SELECT"],
    activity_calendars: ["SELECT", "INSERT", "UPDATE", "DELETE"],
    facility_invites: ["DELETE"],
  };

  it.each(TABLES)("signed-out visitors have no privilege at all on %s", async (table) => {
    await as(db, owner, async (s) => {
      for (const p of PRIVILEGES) {
        expect(await s.value(`select has_table_privilege('anon', 'public.${table}', '${p}')`), `${table} ${p}`).toBe(false);
      }
    });
  });

  it.each(TABLES)("signed-in users have exactly the expected table privileges on %s", async (table) => {
    await as(db, owner, async (s) => {
      for (const p of PRIVILEGES) {
        const has = await s.value<boolean>(`select has_table_privilege('authenticated', 'public.${table}', '${p}')`);
        expect(has, `${table} ${p}`).toBe(authenticated[table].includes(p));
      }
    });
  });

  it("a signed-in user may update only facilities.facility_name and facility_users.role, and nothing on invitations", async () => {
    await as(db, owner, async (s) => {
      const updatable = await s.rows<{ table_name: string; column_name: string }>(
        `select c.table_name, c.column_name
           from information_schema.columns c
          where c.table_schema = 'public'
            and c.table_name in ('facilities', 'facility_users', 'facility_invites')
            and has_column_privilege('authenticated', format('public.%I', c.table_name), c.column_name, 'UPDATE')
          order by 1, 2`,
      );
      expect(updatable).toEqual([
        { table_name: "facilities", column_name: "facility_name" },
        { table_name: "facility_users", column_name: "role" },
      ]);
    });
  });

  it("a signed-in user can read every column of an invitation except the hash of its secret", async () => {
    await as(db, owner, async (s) => {
      const readable = await s.rows<{ column_name: string; can: boolean }>(
        `select c.column_name,
                has_column_privilege('authenticated', 'public.facility_invites', c.column_name, 'SELECT') as can
           from information_schema.columns c
          where c.table_schema = 'public' and c.table_name = 'facility_invites'
          order by c.column_name`,
      );
      expect(readable.filter((c) => !c.can).map((c) => c.column_name)).toEqual(["token_hash"]);
      expect(readable.filter((c) => c.can).length).toBe(readable.length - 1);
      expect(await s.value("select has_column_privilege('anon', 'public.facility_invites', 'id', 'SELECT')")).toBe(false);
    });
  });

  it.each(TABLES)("the server has every privilege on %s", async (table) => {
    await as(db, owner, async (s) => {
      for (const p of PRIVILEGES) {
        expect(await s.value(`select has_table_privilege('service_role', 'public.${table}', '${p}')`), `${table} ${p}`).toBe(true);
      }
    });
  });

  it("who can call each function the Data API exposes", async () => {
    await as(db, owner, async (s) => {
      const can = (role: string, fn: string) =>
        s.value<boolean>(`select has_function_privilege('${role}', '${fn}', 'EXECUTE')`);
      // Signed-in users only, never signed-out visitors.
      for (const fn of [
        "public.create_facility(text)",
        "public.create_facility_invite(text, public.facility_role)",
        "public.preview_facility_invite(text)",
        "public.accept_facility_invite(text)",
      ]) {
        expect(await can("anon", fn), `anon ${fn}`).toBe(false);
        expect(await can("authenticated", fn), `authenticated ${fn}`).toBe(true);
      }
      // The server only: it records what Stripe says, and nobody else may.
      const apply =
        "public.apply_stripe_subscription(text, timestamptz, text, public.subscription_status, text, timestamptz, boolean)";
      expect(await can("anon", apply)).toBe(false);
      expect(await can("authenticated", apply)).toBe(false);
      expect(await can("service_role", apply)).toBe(true);
    });
  });

  it("the internal helpers are for signed-in users and the server; the triggers are for no one", async () => {
    await as(db, owner, async (s) => {
      const can = (role: string, fn: string) =>
        s.value<boolean>(`select has_function_privilege('${role}', '${fn}', 'EXECUTE')`);
      expect(await can("anon", "private.current_facility_id()")).toBe(false);
      expect(await can("authenticated", "private.current_facility_id()")).toBe(true);
      expect(await can("anon", "private.current_facility_role()")).toBe(false);
      expect(await can("authenticated", "private.current_facility_role()")).toBe(true);
      expect(await can("anon", "private.current_facility_has_access()")).toBe(false);
      expect(await can("authenticated", "private.current_facility_has_access()")).toBe(true);
      for (const role of ["anon", "authenticated"]) {
        expect(await can(role, "private.keep_facility_admin()"), role).toBe(false);
        expect(await can(role, "private.sync_facility_user_email()"), role).toBe(false);
        expect(await can(role, "private.subscription_grants_access(public.subscription_status)"), role).toBe(false);
      }
      expect(await s.value("select has_schema_privilege('anon', 'private', 'USAGE')")).toBe(false);
    });
  });
});

describe("rules that hold for every table and function", () => {
  it("every table in public has row level security on", async () => {
    await as(db, owner, async (s) => {
      const off = await s.rows(
        `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity`,
      );
      expect(off).toEqual([]);
    });
  });

  it("every policy applies to signed-in users only, and none is unconditional", async () => {
    await as(db, owner, async (s) => {
      const policies = await s.rows<{ policyname: string; roles: string; qual: string | null; with_check: string | null }>(
        "select policyname, roles::text as roles, qual, with_check from pg_policies where schemaname = 'public' order by tablename, policyname",
      );
      expect(policies.map((p) => p.policyname)).toEqual([
        "activity_calendars_delete_subscribed_facility",
        "activity_calendars_insert_subscribed_facility",
        "activity_calendars_select_own_facility",
        "activity_calendars_update_subscribed_facility",
        "content_items_select_subscribed_members",
        "facilities_select_own",
        "facilities_update_admin",
        "facility_invites_delete_admin",
        "facility_invites_select_admin",
        "facility_users_delete_admin",
        "facility_users_select_same_facility",
        "facility_users_update_admin",
      ]);
      for (const p of policies) {
        expect(p.roles, p.policyname).toBe("{authenticated}");
        expect(p.qual, p.policyname).not.toBe("true");
        expect(p.with_check, p.policyname).not.toBe("true");
      }
    });
  });

  it("every policy on a tenant table pins its rows to the caller's facility, so the pin cannot be dropped unnoticed", async () => {
    // A bare "delete from facility_users" cannot be run to prove this one (the last-admin rule stops it),
    // and Postgres applies the SELECT policy on top of a DELETE's WHERE, which hides a missing pin there.
    // So the expressions themselves are read: each must mention the caller's facility.
    await as(db, owner, async (s) => {
      const policies = await s.rows<{ tablename: string; policyname: string; qual: string | null; with_check: string | null }>(
        `select tablename, policyname, qual, with_check from pg_policies
          where schemaname = 'public' and tablename in ('facilities', 'facility_users', 'activity_calendars', 'facility_invites')
          order by 1, 2`,
      );
      expect(policies.length).toBe(11);
      for (const p of policies) {
        for (const [part, expression] of [["using", p.qual], ["with check", p.with_check]] as const) {
          if (expression !== null) expect(expression, `${p.policyname} (${part})`).toMatch(/current_facility_id/);
        }
      }
    });
  });

  it("every security definer function fixes its search_path", async () => {
    await as(db, owner, async (s) => {
      const definers = await s.rows<{ name: string; config: string | null }>(
        `select n.nspname || '.' || p.proname as name, p.proconfig::text as config
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where p.prosecdef and n.nspname in ('public', 'private')
          order by 1`,
      );
      expect(definers.map((d) => d.name)).toEqual([
        "private.current_facility_has_access",
        "private.current_facility_id",
        "private.current_facility_role",
        "private.keep_facility_admin",
        "private.sync_facility_user_email",
        "public.accept_facility_invite",
        "public.create_facility",
        "public.create_facility_invite",
        "public.preview_facility_invite",
      ]);
      for (const d of definers) expect(d.config, d.name).toMatch(/search_path=/);
    });
  });

  it("every function in public pins its search_path, security definer or not", async () => {
    await as(db, owner, async (s) => {
      const fns = await s.rows<{ proname: string; config: string | null }>(
        `select p.proname, p.proconfig::text as config
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' order by 1`,
      );
      for (const f of fns) expect(f.config, f.proname).toMatch(/search_path=/);
    });
  });

  it("the Data API sees exactly these five functions: every other function is in private", async () => {
    await as(db, owner, async (s) => {
      const exposed = await s.rows<{ proname: string }>(
        `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' order by 1`,
      );
      expect(exposed).toEqual([
        { proname: "accept_facility_invite" },
        { proname: "apply_stripe_subscription" },
        { proname: "create_facility" },
        { proname: "create_facility_invite" },
        { proname: "preview_facility_invite" },
      ]);
    });
  });

  it("no table is keyed to, or has a column for, a resident", async () => {
    await as(db, owner, async (s) => {
      const columns = await s.rows<{ column_name: string }>(
        "select column_name from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position",
      );
      const names = columns.map((c) => c.column_name);
      expect(names.filter((n) => /resident|patient|birth|diagnos|medic|ssn|mrn|room|bed/i.test(n))).toEqual([]);
    });
  });
});

describe("constraints: facilities", () => {
  it.each([
    ["a blank name", "'   '", "facilities_facility_name_length"],
    ["an empty name", "''", "facilities_facility_name_length"],
    ["a name over 120 characters", "repeat('x', 121)", "facilities_facility_name_length"],
  ])("refuse %s", async (_label, nameSql, constraint) => {
    await as(db, owner, async (s) => {
      const failure = await s.fails(`insert into public.facilities (facility_name) values (${nameSql})`);
      expect(failure?.constraint).toBe(constraint);
    });
  });

  it("accept a name of 1 and of 120 characters", async () => {
    await as(db, owner, async (s) => {
      expect((await s.run("insert into public.facilities (facility_name) values ('x'), (repeat('y', 120))")).affected).toBe(2);
    });
  });

  it("start with no subscription: 'incomplete', which grants no access", async () => {
    await as(db, owner, async (s) => {
      expect(await s.value("insert into public.facilities (facility_name) values ('New') returning subscription_status::text")).toBe("incomplete");
      expect(await s.value("select private.subscription_grants_access('incomplete')")).toBe(false);
    });
  });

  it.each(["abc", "su_123", "", "SUB_123"])("refuse the Stripe subscription id %j", async (id) => {
    await as(db, owner, async (s) => {
      const failure = await s.fails("update public.facilities set stripe_subscription_id = $1 where id = $2", [id, F.a]);
      expect(failure?.constraint).toBe("facilities_stripe_subscription_id_format");
    });
  });

  it("refuse one subscription on two facilities", async () => {
    await as(db, owner, async (s) => {
      await s.run("update public.facilities set stripe_subscription_id = 'sub_one' where id = $1", [F.a]);
      const failure = await s.fails("update public.facilities set stripe_subscription_id = 'sub_one' where id = $1", [F.b]);
      expect(failure?.constraint).toBe("facilities_stripe_subscription_id_key");
    });
  });

  it("accept a billing interval of month or year, or none, and nothing else", async () => {
    await as(db, owner, async (s) => {
      for (const interval of ["month", "year", null]) {
        expect((await s.run("update public.facilities set subscription_interval = $1 where id = $2", [interval, F.a])).affected, String(interval)).toBe(1);
      }
      for (const bad of ["week", "day", "Month", "monthly", ""]) {
        const failure = await s.fails("update public.facilities set subscription_interval = $1 where id = $2", [bad, F.a]);
        expect(failure?.constraint, bad).toBe("facilities_subscription_interval_values");
      }
    });
  });

  it("do not cancel at period end unless told to", async () => {
    await as(db, owner, async (s) => {
      expect(await s.value("select subscription_cancel_at_period_end from public.facilities where id = $1", [F.a])).toBe(false);
    });
  });

  it("accept only the Stripe subscription statuses", async () => {
    await as(db, owner, async (s) => {
      for (const status of ["trialing", "active", "past_due", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) {
        expect((await s.run("update public.facilities set subscription_status = $1 where id = $2", [status, F.a])).affected, status).toBe(1);
      }
      expect((await s.fails("update public.facilities set subscription_status = 'free' where id = $1", [F.a]))?.code).toBe("22P02");
    });
  });

  it.each(["abc", "cust_123", "", "CUS_123"])("refuse the Stripe customer id %j", async (id) => {
    await as(db, owner, async (s) => {
      const failure = await s.fails("update public.facilities set stripe_customer_id = $1 where id = $2", [id, F.a]);
      expect(failure?.constraint).toBe("facilities_stripe_customer_id_format");
    });
  });

  it("refuse one Stripe customer on two facilities, but allow many facilities with none", async () => {
    await as(db, owner, async (s) => {
      const failure = await s.fails("update public.facilities set stripe_customer_id = 'cus_maple1' where id = $1", [F.b]);
      expect(failure?.code).toBe("23505");
      expect(failure?.constraint).toBe("facilities_stripe_customer_id_key");
      await s.run("update public.facilities set stripe_customer_id = null");
      expect((await s.run("insert into public.facilities (facility_name) values ('One'), ('Two')")).affected).toBe(2);
    });
  });
});

describe("constraints: facility_users", () => {
  it.each(["Mixed@Case.example", "no-at-sign", "two@@at.example", "spa ce@x.example", "@missing-local.example", "missing-domain@", " padded@x.example"])(
    "refuse the email %j",
    async (email) => {
      await as(db, owner, async (s) => {
        const failure = await s.fails("update public.facility_users set email = $1 where id = $2", [email, U.bob]);
        expect(failure?.constraint).toBe("facility_users_email_format");
      });
    },
  );

  it("require an account that exists", async () => {
    await as(db, owner, async (s) => {
      const failure = await s.fails(
        "insert into public.facility_users (id, facility_id, email) values (gen_random_uuid(), $1, 'ghost@x.example')",
        [F.a],
      );
      expect(failure?.code).toBe("23503");
    });
  });

  it("require a facility that exists", async () => {
    await as(db, owner, async (s) => {
      const failure = await s.fails(
        "insert into public.facility_users (id, facility_id, email) values ($1, gen_random_uuid(), 'erin@cedar.example')",
        [U.erin],
      );
      expect(failure?.code).toBe("23503");
    });
  });

  it("let an account belong to only one facility", async () => {
    await as(db, owner, async (s) => {
      const failure = await s.fails("insert into public.facility_users (id, facility_id, email) values ($1, $2, 'bob@maple.example')", [U.bob, F.b]);
      expect(failure?.code).toBe("23505");
    });
  });

  it("accept only admin and staff", async () => {
    await as(db, owner, async (s) => {
      expect((await s.fails("update public.facility_users set role = 'owner' where id = $1", [U.bob]))?.code).toBe("22P02");
    });
  });
});

describe("constraints: content_items", () => {
  const insert = (category: string, title = "Title"): [string, unknown[]] => [
    "insert into public.content_items (title, category, dementia_stage, content_payload) values ($1, $2, 'early', '{}')",
    [title, category],
  ];

  it.each(["word", "music", "cognicopia-coloring", "a", "a1-b2-c3"])("accept the category %j", async (category) => {
    await as(db, owner, async (s) => {
      expect((await s.run(...insert(category))).affected).toBe(1);
    });
  });

  it.each(["Music", "music ", "a--b", "-a", "a-", "a_b", "", "x".repeat(65), "café"])("refuse the category %j", async (category) => {
    await as(db, owner, async (s) => {
      expect((await s.fails(...insert(category)))?.constraint).toBe("content_items_category_slug");
    });
  });

  it("refuses a blank title and one over 200 characters", async () => {
    await as(db, owner, async (s) => {
      expect((await s.fails(...insert("word", "  ")))?.constraint).toBe("content_items_title_length");
      expect((await s.fails(...insert("word", "t".repeat(201))))?.constraint).toBe("content_items_title_length");
    });
  });

  it("requires the stage to be chosen, and to be a known one", async () => {
    await as(db, owner, async (s) => {
      expect(
        (await s.fails("insert into public.content_items (title, category, content_payload) values ('t', 'word', '{}')"))?.code,
      ).toBe("23502");
      expect(
        (await s.fails("insert into public.content_items (title, category, dementia_stage, content_payload) values ('t', 'word', 'severe', '{}')"))?.code,
      ).toBe("22P02");
      for (const stage of ["early", "middle", "late", "universal"]) {
        expect(
          (await s.run("insert into public.content_items (title, category, dementia_stage, content_payload) values ('t', 'word', $1, '{}')", [stage])).affected,
          stage,
        ).toBe(1);
      }
    });
  });

  it.each(["[]", '"text"', "42", "null", "true"])("refuses a payload that is not an object: %s", async (payload) => {
    await as(db, owner, async (s) => {
      const failure = await s.fails(
        "insert into public.content_items (title, category, dementia_stage, content_payload) values ('t', 'word', 'early', $1::jsonb)",
        [payload],
      );
      expect(failure?.constraint ?? failure?.code).toMatch(/content_items_payload_is_object|23502/);
    });
  });

  it("requires a payload", async () => {
    await as(db, owner, async (s) => {
      expect((await s.fails("insert into public.content_items (title, category, dementia_stage) values ('t', 'word', 'early')"))?.code).toBe("23502");
    });
  });
});

describe("constraints: activity_calendars", () => {
  const insert = "insert into public.activity_calendars (facility_id, month_year, generated_data) values ($1, $2, $3::jsonb)";

  it.each(["2026-01", "2026-12", "1999-06", "2100-09"])("accept the month %s", async (month) => {
    await as(db, owner, async (s) => {
      expect((await s.run(insert, [F.a, month, EMPTY_CALENDAR])).affected).toBe(1);
    });
  });

  it.each(["2026-00", "2026-13", "2026-1", "26-10", "2026-10-01", " 2026-10", "2026/10", "October 2026", ""])(
    "refuse the month %j",
    async (month) => {
      await as(db, owner, async (s) => {
        expect((await s.fails(insert, [F.a, month, EMPTY_CALENDAR]))?.constraint).toBe("activity_calendars_month_year_format");
      });
    },
  );

  it.each(["[]", '"x"', "7", "null"])("refuse calendar data that is not an object: %s", async (data) => {
    await as(db, owner, async (s) => {
      const failure = await s.fails(insert, [F.a, "2026-11", data]);
      expect(failure?.constraint ?? failure?.code).toMatch(/generated_data_is_object|23502/);
    });
  });

  it("refuse a calendar for a facility that does not exist", async () => {
    await as(db, owner, async (s) => {
      expect((await s.fails(insert, ["00000000-0000-4000-8000-0000000000ee", "2026-11", EMPTY_CALENDAR]))?.code).toBe("23503");
    });
  });

  it("bound a calendar to 1 MiB of JSON text", async () => {
    await as(db, owner, async (s) => {
      const overhead = await s.value<number>("select octet_length(jsonb_build_object('note', '')::text)");
      const limit = 1048576;
      const make = (n: number) =>
        `insert into public.activity_calendars (facility_id, month_year, generated_data) values ('${F.a}', '2026-11', jsonb_build_object('note', repeat('x', ${n})))`;
      expect((await s.run(make(limit - overhead))).affected).toBe(1);
      await s.run("delete from public.activity_calendars where month_year = '2026-11'");
      expect((await s.fails(make(limit - overhead + 1)))?.constraint).toBe("activity_calendars_generated_data_size");
    });
  });

  it("bound nesting to 11 levels", async () => {
    await as(db, owner, async (s) => {
      const nest = (levels: number) => `${'{"a":'.repeat(levels)}1${"}".repeat(levels)}`;
      expect((await s.run(insert, [F.a, "2026-11", nest(11)])).affected).toBe(1);
      expect((await s.fails(insert, [F.a, "2026-12", nest(12)]))?.constraint).toBe("activity_calendars_generated_data_shallow");
      // Far deeper than any real document still fails cleanly, and quickly.
      expect((await s.fails(insert, [F.a, "2026-12", nest(400)]))?.constraint).toBe("activity_calendars_generated_data_shallow");
    });
  });
});
