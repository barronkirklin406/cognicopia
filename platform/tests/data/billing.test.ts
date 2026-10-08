import { describe, expect, it } from "vitest";
import { applySubscriptionSnapshot, getFacilityAsServer, setStripeCustomerId, type SubscriptionSnapshot } from "@/lib/data/billing";
import type { Db } from "@/lib/data/db";
import { DataError } from "@/lib/data/errors";

/**
 * The server's billing writes, against a recording stand-in for its client.
 * What the database does with them is tested in tests/db/billing.test.ts.
 */

type Result = { data?: unknown; error?: { code?: string; message?: string } | null };

function fakeDb(result: Result) {
  const calls: [string, unknown[]][] = [];
  const settled = { data: null, error: null, ...result };
  const chain: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "then") return (resolve: (v: unknown) => void) => resolve(settled);
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

const snapshot = (over: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot => ({
  customerId: "cus_1",
  subscriptionId: "sub_1",
  status: "active",
  interval: "year",
  currentPeriodEnd: "2027-10-06T12:00:00.000Z",
  cancelAtPeriodEnd: false,
  observedAt: "2026-10-06T12:00:00.000Z",
  ...over,
});

describe("getFacilityAsServer", () => {
  it("reads one facility by id", async () => {
    const { db, calls } = fakeDb({ data: { id: "f1" } });
    expect(await getFacilityAsServer(db, "f1")).toEqual({ id: "f1" });
    expect(calls).toContainEqual(["from", ["facilities"]]);
    expect(calls).toContainEqual(["eq", ["id", "f1"]]);
  });

  it("is null when there is none", async () => {
    expect(await getFacilityAsServer(fakeDb({ data: null }).db, "f1")).toBeNull();
  });
});

describe("setStripeCustomerId", () => {
  it("sets the customer only where there is none, and says whether it did", async () => {
    const { db, calls } = fakeDb({ data: [{ id: "f1" }] });
    expect(await setStripeCustomerId(db, "f1", "cus_1")).toBe(true);
    expect(calls).toContainEqual(["update", [{ stripe_customer_id: "cus_1" }]]);
    expect(calls).toContainEqual(["eq", ["id", "f1"]]);
    expect(calls).toContainEqual(["is", ["stripe_customer_id", null]]);
  });

  it("says false when one was already there (another request won)", async () => {
    expect(await setStripeCustomerId(fakeDb({ data: [] }).db, "f1", "cus_1")).toBe(false);
  });

  it("answers 409 when the customer is already another facility's", async () => {
    const { db } = fakeDb({ error: { code: "23505", message: 'duplicate key value violates unique constraint "facilities_stripe_customer_id_key"' } });
    await expect(setStripeCustomerId(db, "f1", "cus_1")).rejects.toMatchObject({ status: 409, code: "conflict" });
  });
});

describe("applySubscriptionSnapshot", () => {
  it("calls apply_stripe_subscription with the snapshot, and returns its answer", async () => {
    for (const answer of ["applied", "stale", "unlinked"] as const) {
      const { db, calls } = fakeDb({ data: answer });
      expect(await applySubscriptionSnapshot(db, snapshot())).toBe(answer);
      expect(calls).toEqual([
        [
          "rpc",
          [
            "apply_stripe_subscription",
            {
              p_customer_id: "cus_1",
              p_observed_at: "2026-10-06T12:00:00.000Z",
              p_subscription_id: "sub_1",
              p_status: "active",
              p_interval: "year",
              p_current_period_end: "2027-10-06T12:00:00.000Z",
              p_cancel_at_period_end: false,
            },
          ],
        ],
      ]);
    }
  });

  it("leaves out what Stripe did not give, so the database records it as none", async () => {
    const { db, calls } = fakeDb({ data: "applied" });
    await applySubscriptionSnapshot(db, snapshot({ interval: null, currentPeriodEnd: null, cancelAtPeriodEnd: true }));
    const args = (calls[0]?.[1] as [string, Record<string, unknown>])[1];
    expect(args).not.toHaveProperty("p_interval");
    expect(args).not.toHaveProperty("p_current_period_end");
    expect(args.p_cancel_at_period_end).toBe(true);
  });

  it("reports a database failure as a DataError, without its message", async () => {
    const { db } = fakeDb({ error: { code: "42501", message: "permission denied for function apply_stripe_subscription" } });
    const error = await applySubscriptionSnapshot(db, snapshot()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DataError);
    expect((error as DataError).message).not.toMatch(/apply_stripe_subscription/);
  });

  it("refuses an answer it does not know", async () => {
    await expect(applySubscriptionSnapshot(fakeDb({ data: "something else" }).db, snapshot())).rejects.toMatchObject({ status: 500 });
    await expect(applySubscriptionSnapshot(fakeDb({ data: null }).db, snapshot())).rejects.toMatchObject({ status: 500 });
  });
});
