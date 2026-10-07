import { afterEach, describe, expect, it, vi } from "vitest";
import { reconcileAndReload, reconcileFacility } from "@/lib/billing/reconcile";
import { normalizeStatus, pickSubscription, reconcileCustomer, toSnapshot, type SubscriptionLike } from "@/lib/billing/sync";
import type { StripeApi } from "@/lib/billing/stripe";
import type { Db } from "@/lib/data/db";
import { SUBSCRIPTION_STATUSES } from "@/lib/db/models";
import { grantsAccess } from "@/lib/domain/subscription";

/**
 * Bringing a facility's billing in line with Stripe: which subscription counts,
 * how it is read, and that the time of the observation is noted before Stripe is asked.
 */

const sub = (over: Partial<SubscriptionLike> & { id?: string } = {}): SubscriptionLike => ({
  id: "sub_1",
  status: "active",
  created: 1_700_000_000,
  customer: "cus_1",
  cancel_at_period_end: false,
  items: { data: [{ current_period_end: 1_800_000_000, price: { recurring: { interval: "year" } } }] },
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe("pickSubscription: which one counts when a customer has several", () => {
  it("is null for none", () => {
    expect(pickSubscription([])).toBeNull();
  });

  it("is the only one, whatever its status", () => {
    for (const status of SUBSCRIPTION_STATUSES) expect(pickSubscription([sub({ status })])?.status).toBe(status);
  });

  it("prefers one that grants access over one in trouble, over one not yet paid, over one that has ended", () => {
    const order = ["active", "past_due", "incomplete", "canceled"];
    for (let i = 0; i < order.length; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const better = sub({ id: "better", status: order[i]!, created: 100 });
        const worse = sub({ id: "worse", status: order[j]!, created: 999 }); // even though it is newer
        expect(pickSubscription([worse, better])?.id, `${order[i]} over ${order[j]}`).toBe("better");
        expect(pickSubscription([better, worse])?.id).toBe("better");
      }
    }
  });

  it("treats trialing like active, and past_due, unpaid and paused alike, and canceled like incomplete_expired", () => {
    for (const [a, b] of [["trialing", "active"], ["past_due", "unpaid"], ["unpaid", "paused"], ["canceled", "incomplete_expired"]]) {
      const older = sub({ id: "older", status: a!, created: 1 });
      const newer = sub({ id: "newer", status: b!, created: 2 });
      expect(pickSubscription([older, newer])?.id).toBe("newer");
      expect(pickSubscription([newer, older])?.id).toBe("newer");
    }
  });

  it("the newest wins a tie", () => {
    expect(pickSubscription([sub({ id: "a", created: 5 }), sub({ id: "b", created: 9 }), sub({ id: "c", created: 7 })])?.id).toBe("b");
  });

  it("a facility that resubscribed after cancelling is on the new subscription, and a stale 'deleted' for the old one cannot undo it", () => {
    const old = sub({ id: "sub_old", status: "canceled", created: 1 });
    const fresh = sub({ id: "sub_new", status: "active", created: 2 });
    expect(pickSubscription([old, fresh])?.id).toBe("sub_new");
  });

  it("a failed payment on the old subscription does not beat a paid new one", () => {
    expect(pickSubscription([sub({ id: "old", status: "past_due", created: 1 }), sub({ id: "new", status: "active", created: 2 })])?.id).toBe("new");
  });
});

describe("normalizeStatus", () => {
  it.each(SUBSCRIPTION_STATUSES)("keeps %s", (status) => {
    expect(normalizeStatus(status)).toBe(status);
  });

  it("an unknown status from a future Stripe is treated as unpaid, so it can never open the premium tools", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const status = normalizeStatus("some_new_state");
    expect(status).toBe("unpaid");
    expect(grantsAccess(status)).toBe(false);
    expect(warn).toHaveBeenCalledWith("[billing] unknown subscription status from Stripe:", "some_new_state");
  });
});

describe("toSnapshot", () => {
  const at = "2026-10-06T12:00:00.000Z";

  it("reads the customer, subscription, status, interval, period end and cancel flag", () => {
    expect(toSnapshot(sub(), at)).toEqual({
      customerId: "cus_1",
      subscriptionId: "sub_1",
      status: "active",
      interval: "year",
      currentPeriodEnd: "2027-01-15T08:00:00.000Z",
      cancelAtPeriodEnd: false,
      observedAt: at,
    });
  });

  it("takes the customer from an expanded object as well as from an id", () => {
    expect(toSnapshot(sub({ customer: { id: "cus_obj" } }), at).customerId).toBe("cus_obj");
  });

  it("keeps a month interval, and records nothing for any other", () => {
    const withInterval = (interval?: string) => sub({ items: { data: [{ current_period_end: 1_800_000_000, price: { recurring: interval ? { interval } : null } }] } });
    expect(toSnapshot(withInterval("month"), at).interval).toBe("month");
    for (const other of ["week", "day", undefined]) expect(toSnapshot(withInterval(other), at).interval, String(other)).toBeNull();
  });

  it("uses the earliest period end among the items", () => {
    const s = sub({ items: { data: [{ current_period_end: 1_900_000_000 }, { current_period_end: 1_800_000_000 }] } });
    expect(toSnapshot(s, at).currentPeriodEnd).toBe("2027-01-15T08:00:00.000Z");
  });

  it("has no period end when Stripe gave none", () => {
    expect(toSnapshot(sub({ items: { data: [] } }), at)).toMatchObject({ currentPeriodEnd: null, interval: null });
    expect(toSnapshot(sub({ items: { data: [{}] } }), at).currentPeriodEnd).toBeNull();
  });

  it("is cancelling at period end only when Stripe says so", () => {
    expect(toSnapshot(sub({ cancel_at_period_end: true }), at).cancelAtPeriodEnd).toBe(true);
    expect(toSnapshot(sub({ cancel_at_period_end: false }), at).cancelAtPeriodEnd).toBe(false);
  });

  it("an unknown status becomes unpaid", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(toSnapshot(sub({ status: "mystery" }), at).status).toBe("unpaid");
  });
});

// ---------------------------------------------------------------------

/** A stand-in for Stripe's subscription list, and for the server's database: the order of calls is the point. */
function world(subscriptions: SubscriptionLike[], outcome: string = "applied") {
  const order: string[] = [];
  const list = vi.fn(async (params: unknown) => {
    order.push("stripe");
    void params;
    return { data: subscriptions };
  });
  const rpc = vi.fn(async (_name: string, args: unknown) => {
    order.push("database");
    void args;
    return { data: outcome, error: null };
  });
  return { stripe: { subscriptions: { list } } as unknown as Pick<StripeApi, "subscriptions">, admin: { rpc } as unknown as Db, list, rpc, order };
}

describe("reconcileCustomer", () => {
  it("lists the customer's subscriptions, all statuses, and records the one that counts", async () => {
    const w = world([sub({ id: "sub_old", status: "canceled", created: 1 }), sub({ id: "sub_new", status: "past_due", created: 2 })]);
    const outcome = await reconcileCustomer({ stripe: w.stripe, admin: w.admin, now: () => new Date("2026-10-06T12:00:00Z") }, "cus_1");
    expect(outcome).toBe("applied");
    expect(w.list).toHaveBeenCalledWith({ customer: "cus_1", status: "all", limit: 20 });
    expect(w.rpc).toHaveBeenCalledWith("apply_stripe_subscription", {
      p_customer_id: "cus_1",
      p_observed_at: "2026-10-06T12:00:00.000Z",
      p_subscription_id: "sub_new",
      p_status: "past_due",
      p_interval: "year",
      p_current_period_end: "2027-01-15T08:00:00.000Z",
      p_cancel_at_period_end: false,
    });
  });

  it("notes the time BEFORE asking Stripe: a late answer to an early question must not beat a newer one", async () => {
    const times: string[] = [];
    const w = world([sub()]);
    const clock = () => {
      times.push(`clock@${w.order.length}`);
      return new Date("2026-10-06T12:00:00Z");
    };
    await reconcileCustomer({ stripe: w.stripe, admin: w.admin, now: clock }, "cus_1");
    expect(times).toEqual(["clock@0"]); // read once, before Stripe (index 0) and the database
    expect(w.order).toEqual(["stripe", "database"]);
  });

  it("answers 'none' for a customer with no subscriptions, and records nothing", async () => {
    const w = world([]);
    expect(await reconcileCustomer({ stripe: w.stripe, admin: w.admin }, "cus_1")).toBe("none");
    expect(w.rpc).not.toHaveBeenCalled();
  });

  it.each(["applied", "stale", "unlinked"])("passes the database's answer, %s, back", async (answer) => {
    const w = world([sub()], answer);
    expect(await reconcileCustomer({ stripe: w.stripe, admin: w.admin }, "cus_1")).toBe(answer);
  });

  it("lets a Stripe failure through, so a webhook answers 500 and Stripe retries", async () => {
    const w = world([sub()]);
    w.list.mockRejectedValueOnce(Object.assign(new Error("down"), { type: "StripeConnectionError" }));
    await expect(reconcileCustomer({ stripe: w.stripe, admin: w.admin }, "cus_1")).rejects.toMatchObject({ type: "StripeConnectionError" });
    expect(w.rpc).not.toHaveBeenCalled();
  });

  it("lets a database failure through, too", async () => {
    const w = world([sub()]);
    w.rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "boom" } } as never);
    await expect(reconcileCustomer({ stripe: w.stripe, admin: w.admin }, "cus_1")).rejects.toMatchObject({ status: 500 });
  });

  it("the same Stripe state, seen twice, is recorded the same way twice", async () => {
    const w = world([sub()]);
    const now = () => new Date("2026-10-06T12:00:00Z");
    await reconcileCustomer({ stripe: w.stripe, admin: w.admin, now }, "cus_1");
    await reconcileCustomer({ stripe: w.stripe, admin: w.admin, now }, "cus_1");
    expect(w.rpc.mock.calls[0]).toEqual(w.rpc.mock.calls[1]);
  });
});

describe("reconcileFacility", () => {
  it("does nothing for a facility with no Stripe customer, and never calls Stripe", async () => {
    const w = world([sub()]);
    expect(await reconcileFacility({ stripe: w.stripe, admin: w.admin }, { stripe_customer_id: null })).toBe("none");
    expect(w.list).not.toHaveBeenCalled();
  });

  it("looks at the facility's own customer", async () => {
    const w = world([sub()]);
    await reconcileFacility({ stripe: w.stripe, admin: w.admin }, { stripe_customer_id: "cus_mine" });
    expect(w.list).toHaveBeenCalledWith({ customer: "cus_mine", status: "all", limit: 20 });
  });
});

describe("reconcileAndReload", () => {
  /** The server's database: the rpc that records, and the read of one facility row. */
  function serverDb(w: ReturnType<typeof world>, row: unknown) {
    const reads: [string, string, unknown][] = [];
    const maybeSingle = vi.fn(async () => {
      w.order.push("read");
      return { data: row, error: null };
    });
    const from = vi.fn((table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: unknown) => {
          reads.push([table, `${columns} where ${column}`, value]);
          return { maybeSingle };
        },
      }),
    }));
    return { admin: { rpc: w.rpc, from } as unknown as Db, reads };
  }

  it("records what Stripe says, then reads the facility back with the server's client, in that order", async () => {
    const w = world([sub({ status: "active" })]);
    const { admin, reads } = serverDb(w, { id: "f1", subscription_status: "active" });
    const out = await reconcileAndReload({ stripe: w.stripe, admin }, { id: "f1", stripe_customer_id: "cus_1" });
    expect(out.outcome).toBe("applied");
    expect(out.facility).toMatchObject({ id: "f1", subscription_status: "active" });
    expect(w.order).toEqual(["stripe", "database", "read"]);
    expect(reads).toEqual([["facilities", "* where id", "f1"]]);
  });

  it("reads the facility back even when Stripe has nothing to record", async () => {
    const w = world([]);
    const { admin } = serverDb(w, { id: "f1", subscription_status: "incomplete" });
    const out = await reconcileAndReload({ stripe: w.stripe, admin }, { id: "f1", stripe_customer_id: "cus_1" });
    expect(out.outcome).toBe("none");
    expect(out.facility).toMatchObject({ subscription_status: "incomplete" });
  });

  it("a facility with no Stripe customer is read back without calling Stripe", async () => {
    const w = world([sub()]);
    const { admin } = serverDb(w, { id: "f1", subscription_status: "incomplete" });
    const out = await reconcileAndReload({ stripe: w.stripe, admin }, { id: "f1", stripe_customer_id: null });
    expect(out.outcome).toBe("none");
    expect(w.list).not.toHaveBeenCalled();
  });

  it("lets a Stripe failure through, and does not read anything", async () => {
    const w = world([sub()]);
    w.list.mockRejectedValueOnce(Object.assign(new Error("down"), { type: "StripeConnectionError" }));
    const { admin, reads } = serverDb(w, null);
    await expect(reconcileAndReload({ stripe: w.stripe, admin }, { id: "f1", stripe_customer_id: "cus_1" })).rejects.toMatchObject({ type: "StripeConnectionError" });
    expect(reads).toEqual([]);
  });
});
