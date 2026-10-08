import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SUBSCRIPTION_STATUSES } from "@/lib/db/models";
import { ACCESS_STATUSES, canStartCheckout, grantsAccess } from "@/lib/domain/subscription";
import { EMPTY_CALENDAR, F, seedFixtures, U } from "./fixtures";
import { anon, as, createDb, owner, service, user, type Session } from "./harness";

/**
 * The subscription gate, and how Stripe's state is recorded.
 *
 *   - which statuses grant access, in the database and in TypeScript, over every status
 *   - what a facility can and cannot do in each status (library, calendars, and everything it keeps)
 *   - apply_stripe_subscription(): what it records, and what it refuses to
 */

let db: PGlite;

beforeAll(async () => {
  db = await createDb();
  await seedFixtures(db);
});
afterAll(async () => {
  await db.close();
});

const alice = user(U.alice); // admin, facility A (Maple Court)
const bob = user(U.bob); // staff, facility A
const carol = user(U.carol); // admin, facility B (Birch Manor, trialing)
const erin = user(U.erin); // no facility

/** Set facility A's status as the server does, then carry on as `who`. */
async function lapse(s: Session, status: string, who = bob) {
  await s.become(service);
  await s.run("update public.facilities set subscription_status = $1 where id = $2", [status, F.a]);
  await s.become(who);
}

const APPLY = `select public.apply_stripe_subscription($1, $2::timestamptz, $3, $4::public.subscription_status, $5, $6::timestamptz, $7)`;
const snapshot = (over: Partial<Record<string, unknown>> = {}): unknown[] => {
  const v = { customer: "cus_maple1", at: "2026-10-06T12:00:00Z", sub: "sub_one", status: "active", interval: "year", end: "2027-10-06T12:00:00Z", cancel: false, ...over };
  return [v.customer, v.at, v.sub, v.status, v.interval, v.end, v.cancel];
};
const UTC = `'YYYY-MM-DD"T"HH24:MI:SS"Z"'`;
const billing = (s: Session) =>
  s.rows<Record<string, unknown>>(
    `select subscription_status::text as status, stripe_subscription_id as sub, subscription_interval as interval,
            to_char(subscription_current_period_end at time zone 'UTC', ${UTC}) as period_end,
            subscription_cancel_at_period_end as cancel,
            to_char(subscription_synced_at at time zone 'UTC', ${UTC}) as synced
       from public.facilities where id = $1`,
    [F.a],
  ).then((rows) => rows[0]);

// ---------------------------------------------------------------------
// Which statuses grant access
// ---------------------------------------------------------------------

describe("which statuses grant access", () => {
  it.each(SUBSCRIPTION_STATUSES)("%s: the database and lib/domain/subscription.ts agree", async (status) => {
    await as(db, owner, async (s) => {
      expect(await s.value("select private.subscription_grants_access($1::public.subscription_status)", [status])).toBe(grantsAccess(status));
    });
  });

  it("only trialing and active grant access; past due does not", async () => {
    expect([...ACCESS_STATUSES]).toEqual(["trialing", "active"]);
    await as(db, owner, async (s) => {
      const granted = await s.rows<{ status: string }>(
        "select e::text as status from unnest(enum_range(null::public.subscription_status)) e where private.subscription_grants_access(e) order by 1",
      );
      expect(granted.map((r) => r.status)).toEqual(["active", "trialing"]);
    });
  });

  it("a new Checkout can start only when no subscription is live", () => {
    expect(SUBSCRIPTION_STATUSES.filter(canStartCheckout).sort()).toEqual(["canceled", "incomplete", "incomplete_expired"]);
    // A status that grants access can never start another: that would bill the facility twice.
    for (const status of ACCESS_STATUSES) expect(canStartCheckout(status)).toBe(false);
  });
});

describe("current_facility_has_access()", () => {
  const has = (s: Session) => s.value<boolean>("select private.current_facility_has_access()");

  it.each(SUBSCRIPTION_STATUSES)("is %s for a member of a facility in that status", async (status) => {
    await as(db, bob, async (s) => {
      await lapse(s, status);
      expect(await has(s)).toBe(grantsAccess(status));
      await s.become(alice);
      expect(await has(s)).toBe(grantsAccess(status));
    });
  });

  it("is false for someone who belongs to no facility", async () => {
    await as(db, erin, async (s) => expect(await has(s)).toBe(false));
  });

  it("looks at the caller's own facility only", async () => {
    await as(db, bob, async (s) => {
      await lapse(s, "canceled");
      await s.become(carol); // facility B is trialing
      expect(await has(s)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------
// The library
// ---------------------------------------------------------------------

describe("the library needs a subscription that grants access", () => {
  const count = (s: Session) => s.value<number>("select count(*)::int from public.content_items");

  it.each(SUBSCRIPTION_STATUSES)("a facility that is %s", async (status) => {
    await as(db, bob, async (s) => {
      await lapse(s, status, bob);
      expect(await count(s), `staff, ${status}`).toBe(grantsAccess(status) ? 3 : 0);
      await s.become(alice);
      expect(await count(s), `admin, ${status}`).toBe(grantsAccess(status) ? 3 : 0);
    });
  });

  it("the server always sees it, whatever any facility's status", async () => {
    await as(db, service, async (s) => {
      await s.run("update public.facilities set subscription_status = 'canceled'");
      expect(await count(s)).toBe(3);
    });
  });

  it("one facility lapsing does not close the library to another", async () => {
    await as(db, bob, async (s) => {
      await lapse(s, "unpaid");
      expect(await count(s)).toBe(0);
      await s.become(carol);
      expect(await count(s)).toBe(3);
    });
  });
});

// ---------------------------------------------------------------------
// Calendars
// ---------------------------------------------------------------------

describe("calendars: reading stays open, writing needs a subscription that grants access", () => {
  const newMonth: [string, unknown[]] = [
    "insert into public.activity_calendars (facility_id, month_year, generated_data) values ($1, '2026-11', $2::jsonb)",
    [F.a, EMPTY_CALENDAR],
  ];
  const upsert: [string, unknown[]] = [
    `insert into public.activity_calendars (facility_id, month_year, generated_data) values ($1, '2026-10', $2::jsonb)
       on conflict (facility_id, month_year) do update set generated_data = excluded.generated_data`,
    [F.a, JSON.stringify({ schema_version: 1, month: "2026-10", groups: [], slots: [], note: "again" })],
  ];

  it.each(SUBSCRIPTION_STATUSES)("a facility that is %s", async (status) => {
    const allowed = grantsAccess(status);
    await as(db, bob, async (s) => {
      await lapse(s, status);

      // Its own saved calendar can always be read.
      expect(await s.value("select count(*)::int from public.activity_calendars"), "read").toBe(1);

      // Writing: only with access.
      expect((await s.fails(...newMonth))?.code ?? null, "insert").toBe(allowed ? null : "42501");
      expect((await s.fails(...upsert))?.code ?? null, "upsert").toBe(allowed ? null : "42501");
      const update = await s.fails("update public.activity_calendars set generated_data = $1::jsonb where month_year = '2026-10'", [EMPTY_CALENDAR]);
      expect(update?.code ?? null, "update").toBe(allowed ? null : "42501");

      // Delete is filtered, not refused: it simply finds nothing it may delete.
      const removed = await s.run("delete from public.activity_calendars where month_year = '2026-10'");
      expect(removed.affected, "delete").toBe(allowed ? 1 : 0);
    });
  });

  it("a lapsed facility's calendar is exactly as it was left", async () => {
    await as(db, bob, async (s) => {
      await lapse(s, "past_due");
      await s.fails(...upsert);
      await s.run("delete from public.activity_calendars");
      await s.become(owner);
      expect(await s.value("select generated_data = $2::jsonb from public.activity_calendars where facility_id = $1", [F.a, EMPTY_CALENDAR])).toBe(true);
    });
  });

  it("the facility that is paid up is not affected by another's lapse", async () => {
    await as(db, bob, async (s) => {
      await lapse(s, "canceled");
      await s.become(carol); // facility B, trialing
      expect(
        (await s.run("insert into public.activity_calendars (facility_id, month_year, generated_data) values ($1, '2026-11', $2::jsonb)", [F.b, EMPTY_CALENDAR])).affected,
      ).toBe(1);
    });
  });

  it("paying again opens everything straight away", async () => {
    await as(db, bob, async (s) => {
      await lapse(s, "past_due");
      expect((await s.fails(...newMonth))?.code).toBe("42501");
      expect(await s.value("select count(*)::int from public.content_items")).toBe(0);

      await s.become(service);
      expect(await s.value(APPLY, snapshot({ status: "active" }))).toBe("applied");
      await s.become(bob);
      expect((await s.run(...newMonth)).affected).toBe(1);
      expect(await s.value("select count(*)::int from public.content_items")).toBe(3);
    });
  });
});

describe("what a lapsed facility keeps", () => {
  it.each(["past_due", "unpaid", "canceled", "paused", "incomplete", "incomplete_expired"])(
    "%s: its facility, its team, its name and its billing details stay in reach",
    async (status) => {
      await as(db, bob, async (s) => {
        await lapse(s, status, alice);
        // The facility row, with its billing facts: the billing page needs them to offer the right way back.
        const [row] = await s.rows<{ facility_name: string; subscription_status: string }>(
          "select facility_name, subscription_status::text as subscription_status from public.facilities",
        );
        expect(row).toEqual({ facility_name: "Maple Court", subscription_status: status });
        // The team, and managing it.
        expect(await s.value("select count(*)::int from public.facility_users")).toBe(2);
        expect((await s.run("update public.facility_users set role = 'admin' where id = $1", [U.bob])).affected).toBe(1);
        // The facility's own name.
        expect((await s.run("update public.facilities set facility_name = 'Maple Court East' where id = $1", [F.a])).affected).toBe(1);
      });
    },
  );
});

// ---------------------------------------------------------------------
// apply_stripe_subscription()
// ---------------------------------------------------------------------

describe("apply_stripe_subscription()", () => {
  it("records the snapshot on the facility that has that Stripe customer", async () => {
    await as(db, service, async (s) => {
      expect(await s.value(APPLY, snapshot({ status: "past_due", cancel: true }))).toBe("applied");
      expect(await billing(s)).toEqual({
        status: "past_due",
        sub: "sub_one",
        interval: "year",
        period_end: "2027-10-06T12:00:00Z",
        cancel: true,
        synced: "2026-10-06T12:00:00Z",
      });
    });
  });

  it("does not touch any other facility", async () => {
    await as(db, service, async (s) => {
      await s.run(APPLY, snapshot({ status: "canceled" }));
      expect(await s.value("select subscription_status::text from public.facilities where id = $1", [F.b])).toBe("trialing");
    });
  });

  it("answers 'unlinked', and changes nothing, when no facility has that customer", async () => {
    await as(db, service, async (s) => {
      expect(await s.value(APPLY, snapshot({ customer: "cus_nobody" }))).toBe("unlinked");
      expect((await billing(s))?.status).toBe("active");
      expect(await s.value("select count(*)::int from public.facilities where stripe_subscription_id is not null")).toBe(0);
    });
  });

  it("is idempotent: the same observation, delivered twice, leaves the same state", async () => {
    await as(db, service, async (s) => {
      expect(await s.value(APPLY, snapshot())).toBe("applied");
      const once = await billing(s);
      expect(await s.value(APPLY, snapshot())).toBe("applied");
      expect(await billing(s)).toEqual(once);
    });
  });

  it("never goes backwards: an observation older than the last one is dropped as 'stale'", async () => {
    await as(db, service, async (s) => {
      expect(await s.value(APPLY, snapshot({ at: "2026-10-06T12:00:10Z", status: "active" }))).toBe("applied");
      // A late answer to an earlier question: Stripe said past due at 12:00:05.
      expect(await s.value(APPLY, snapshot({ at: "2026-10-06T12:00:05Z", status: "past_due" }))).toBe("stale");
      expect((await billing(s))?.status).toBe("active");
      // A newer observation does replace it.
      expect(await s.value(APPLY, snapshot({ at: "2026-10-06T12:00:20Z", status: "past_due" }))).toBe("applied");
      expect((await billing(s))?.status).toBe("past_due");
    });
  });

  it("a new subscription replaces an ended one when it is observed later", async () => {
    await as(db, service, async (s) => {
      await s.run(APPLY, snapshot({ sub: "sub_old", status: "canceled", at: "2026-10-06T12:00:00Z" }));
      expect(await s.value(APPLY, snapshot({ sub: "sub_new", status: "active", at: "2026-10-06T13:00:00Z" }))).toBe("applied");
      expect(await billing(s)).toMatchObject({ sub: "sub_new", status: "active" });
    });
  });

  it("stores month and year intervals, and nothing for any other", async () => {
    await as(db, service, async (s) => {
      const cases: [string | null, string | null][] = [["month", "month"], ["year", "year"], ["week", null], ["day", null], [null, null]];
      for (const [index, [interval, stored]] of cases.entries()) {
        await s.run(APPLY, snapshot({ interval, at: `2026-10-06T12:00:0${index}Z` })); // each later than the last
        expect((await billing(s))?.interval, String(interval)).toBe(stored);
      }
    });
  });

  it("the optional arguments can be left out", async () => {
    await as(db, service, async (s) => {
      expect(
        await s.value(
          "select public.apply_stripe_subscription('cus_maple1', '2026-10-06T12:00:00Z', 'sub_one', 'active')",
        ),
      ).toBe("applied");
      expect(await billing(s)).toMatchObject({ status: "active", interval: null, period_end: null, cancel: false });
    });
  });

  it.each([
    ["no customer", snapshot({ customer: null })],
    ["no time observed", snapshot({ at: null })],
    ["no subscription", snapshot({ sub: null })],
    ["no status", snapshot({ status: null })],
  ])("refuses %s with 22023", async (_label, args) => {
    await as(db, service, async (s) => {
      expect((await s.fails(APPLY, args))?.code).toBe("22023");
    });
  });

  it("refuses a subscription id that is not one, and a status Stripe does not have", async () => {
    await as(db, service, async (s) => {
      expect((await s.fails(APPLY, snapshot({ sub: "abc" })))?.constraint).toBe("facilities_stripe_subscription_id_format");
      expect((await s.fails(APPLY, snapshot({ status: "free" })))?.code).toBe("22P02");
    });
  });

  it("will not put one subscription on two facilities", async () => {
    await as(db, service, async (s) => {
      await s.run(APPLY, snapshot({ customer: "cus_maple1", sub: "sub_shared" }));
      const failure = await s.fails(APPLY, snapshot({ customer: "cus_birch1", sub: "sub_shared" }));
      expect(failure?.constraint).toBe("facilities_stripe_subscription_id_key");
    });
  });

  it("is for the server only: neither signed-out nor signed-in callers may run it", async () => {
    for (const who of [anon, alice, bob, erin]) {
      await as(db, who, async (s) => {
        expect((await s.fails(APPLY, snapshot({ status: "active" })))?.code, JSON.stringify(who)).toBe("42501");
        await s.become(owner);
        expect((await billing(s))?.status).toBe("active"); // unchanged (fixture value)
      });
    }
  });

  it("even if it were run with a signed-in user's rights, it could not write the billing columns", async () => {
    // Not security definer, so the column privileges from migration 3 still apply. Grant execute by mistake...
    await as(db, owner, async (s) => {
      await s.run(
        "grant execute on function public.apply_stripe_subscription(text, timestamptz, text, public.subscription_status, text, timestamptz, boolean) to authenticated",
      );
      await s.become(alice);
      // ...and it still refuses: the admin has no UPDATE on those columns (and cannot see the other tenants' rows).
      expect((await s.fails(APPLY, snapshot({ status: "active" })))?.code).toBe("42501");
    });
  });
});

describe("the whole path, as a new customer lives it", () => {
  it("a new facility is blocked until the first snapshot arrives, then opened; a failed payment closes it again", async () => {
    await as(db, erin, async (s) => {
      const id = await s.value<string>("select public.create_facility('Cedar House')");
      const count = () => s.value<number>("select count(*)::int from public.content_items");
      expect(await count()).toBe(0);

      // The server makes a Stripe customer for the facility, and later hears that it has paid.
      await s.become(service);
      await s.run("update public.facilities set stripe_customer_id = 'cus_cedar1' where id = $1", [id]);
      expect(await s.value(APPLY, snapshot({ customer: "cus_cedar1", sub: "sub_cedar", status: "active", at: "2026-10-06T12:00:00Z" }))).toBe("applied");
      await s.become(erin);
      expect(await count()).toBe(3);

      // A payment fails.
      await s.become(service);
      expect(await s.value(APPLY, snapshot({ customer: "cus_cedar1", sub: "sub_cedar", status: "past_due", at: "2026-11-06T12:00:00Z" }))).toBe("applied");
      await s.become(erin);
      expect(await count()).toBe(0);

      // And it is put right.
      await s.become(service);
      expect(await s.value(APPLY, snapshot({ customer: "cus_cedar1", sub: "sub_cedar", status: "active", at: "2026-11-07T12:00:00Z" }))).toBe("applied");
      await s.become(erin);
      expect(await count()).toBe(3);
    });
  });
});
