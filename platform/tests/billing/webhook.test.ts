import { describe, expect, it, vi } from "vitest";
import type { StripeApi } from "@/lib/billing/stripe";
import { customerIdOf, handleStripeEvent, HANDLED_EVENT_TYPES } from "@/lib/billing/webhook";
import type { Db } from "@/lib/data/db";

/**
 * What the webhook does with each event. An event only says WHICH CUSTOMER to
 * look at, so these tests are about finding that customer, in every shape and
 * API version Stripe sends, and about ignoring what is not ours.
 */

const event = (type: string, object: unknown) => ({ id: "evt_1", type, data: { object } });

describe("customerIdOf", () => {
  it.each(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"])("%s: the subscription's customer", (type) => {
    expect(customerIdOf(event(type, { id: "sub_1", customer: "cus_1" }))).toBe("cus_1");
  });

  it("invoice.payment_failed: the invoice's customer, whichever API version shaped the invoice", () => {
    // Older API versions: invoice.subscription. Newer: invoice.parent.subscription_details. Both have customer.
    expect(customerIdOf(event("invoice.payment_failed", { id: "in_1", customer: "cus_1", subscription: "sub_1" }))).toBe("cus_1");
    expect(
      customerIdOf(event("invoice.payment_failed", { id: "in_1", customer: "cus_1", parent: { type: "subscription_details", subscription_details: { subscription: "sub_1" } } })),
    ).toBe("cus_1");
  });

  it("checkout.session.completed: the customer, for a subscription session", () => {
    expect(customerIdOf(event("checkout.session.completed", { id: "cs_1", mode: "subscription", customer: "cus_1", subscription: "sub_1" }))).toBe("cus_1");
  });

  it("checkout.session.completed: not ours when it was a one-off payment or a card set-up", () => {
    expect(customerIdOf(event("checkout.session.completed", { mode: "payment", customer: "cus_1" }))).toBeNull();
    expect(customerIdOf(event("checkout.session.completed", { mode: "setup", customer: "cus_1" }))).toBeNull();
  });

  it("reads the customer from an expanded object as well as an id", () => {
    expect(customerIdOf(event("customer.subscription.updated", { customer: { id: "cus_obj", object: "customer" } }))).toBe("cus_obj");
  });

  it.each([null, undefined, "", 42, {}, { id: "" }, [] as unknown])("finds no customer in %j", (customer) => {
    expect(customerIdOf(event("customer.subscription.updated", { customer }))).toBeNull();
  });

  it("finds nothing in an event that is not about a subscription, or has no object", () => {
    expect(customerIdOf(event("charge.succeeded", { customer: "cus_1" }))).toBeNull();
    expect(customerIdOf(event("customer.subscription.updated", null))).toBeNull();
    expect(customerIdOf(event("customer.subscription.updated", "text"))).toBeNull();
    expect(customerIdOf({ type: "customer.subscription.updated", data: undefined as never })).toBeNull();
  });
});

describe("the events it handles", () => {
  it("are the three asked for, and the two that make access start at once", () => {
    expect([...HANDLED_EVENT_TYPES].sort()).toEqual([
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.deleted",
      "customer.subscription.updated",
      "invoice.payment_failed",
    ]);
  });
});

function world() {
  const list = vi.fn(async (_params: unknown) => ({
    data: [{ id: "sub_1", status: "active", created: 1, customer: "cus_1", cancel_at_period_end: false, items: { data: [] } }],
  }));
  const rpc = vi.fn(async (_name: string, _args: unknown) => ({ data: "applied", error: null }));
  return { deps: { stripe: { subscriptions: { list } } as unknown as Pick<StripeApi, "subscriptions">, admin: { rpc } as unknown as Db }, list, rpc };
}

describe("handleStripeEvent", () => {
  it.each(HANDLED_EVENT_TYPES)("%s: looks at Stripe for that customer, and records what it finds", async (type) => {
    const w = world();
    const object = type === "checkout.session.completed" ? { mode: "subscription", customer: "cus_1" } : { customer: "cus_1" };
    expect(await handleStripeEvent(w.deps, event(type, object))).toBe("applied");
    expect(w.list).toHaveBeenCalledWith({ customer: "cus_1", status: "all", limit: 20 });
    expect(w.rpc).toHaveBeenCalledTimes(1);
  });

  it("does not trust the event's own copy of the state: only Stripe's current answer is recorded", async () => {
    const w = world();
    // The event claims the subscription is canceled; Stripe says (now) it is active.
    await handleStripeEvent(w.deps, event("customer.subscription.deleted", { id: "sub_1", status: "canceled", customer: "cus_1" }));
    expect((w.rpc.mock.calls[0]?.[1] as any).p_status).toBe("active");
  });

  it("ignores events it does not handle, without calling Stripe or the database", async () => {
    const w = world();
    for (const type of ["charge.succeeded", "invoice.paid", "customer.created", "payment_intent.succeeded"]) {
      expect(await handleStripeEvent(w.deps, event(type, { customer: "cus_1" })), type).toBe("ignored");
    }
    expect(w.list).not.toHaveBeenCalled();
    expect(w.rpc).not.toHaveBeenCalled();
  });

  it("ignores a handled event that names no customer, and a one-off payment", async () => {
    const w = world();
    expect(await handleStripeEvent(w.deps, event("customer.subscription.updated", {}))).toBe("ignored");
    expect(await handleStripeEvent(w.deps, event("checkout.session.completed", { mode: "payment", customer: "cus_1" }))).toBe("ignored");
    expect(w.list).not.toHaveBeenCalled();
  });

  it("passes on what the database said: stale, or unlinked", async () => {
    for (const answer of ["stale", "unlinked"]) {
      const w = world();
      w.rpc.mockResolvedValueOnce({ data: answer, error: null });
      expect(await handleStripeEvent(w.deps, event("customer.subscription.updated", { customer: "cus_1" }))).toBe(answer);
    }
  });

  it("a customer with no subscriptions is 'none'", async () => {
    const w = world();
    w.list.mockResolvedValueOnce({ data: [] });
    expect(await handleStripeEvent(w.deps, event("customer.subscription.deleted", { customer: "cus_1" }))).toBe("none");
  });

  it("lets a failure through, for the route to answer 500 and Stripe to retry", async () => {
    const w = world();
    w.rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000" } } as never);
    await expect(handleStripeEvent(w.deps, event("customer.subscription.updated", { customer: "cus_1" }))).rejects.toMatchObject({ status: 500 });
  });
});
