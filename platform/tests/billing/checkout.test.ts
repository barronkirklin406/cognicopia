import { describe, expect, it, vi } from "vitest";
import { createCheckoutSession } from "@/lib/billing/checkout";
import { ensureStripeCustomer } from "@/lib/billing/customer";
import { createPortalSession } from "@/lib/billing/portal";
import type { StripeApi } from "@/lib/billing/stripe";
import type { BillingFacility } from "@/lib/billing/types";
import type { Db } from "@/lib/data/db";
import { DataError } from "@/lib/data/errors";
import { SUBSCRIPTION_STATUSES } from "@/lib/db/models";
import { canStartCheckout } from "@/lib/domain/subscription";

/**
 * Starting a subscription and opening the billing portal, against a stand-in for
 * Stripe that records what it is asked. Nothing reaches the network.
 */

const FACILITY_ID = "5c6a0000-0000-4000-8000-0000000000aa";

const facility = (over: Partial<BillingFacility> = {}): BillingFacility => ({
  id: FACILITY_ID,
  facility_name: "Maple Court",
  subscription_status: "incomplete",
  stripe_customer_id: null,
  ...over,
});

const config = {
  appUrl: "https://app.cognicopia.org",
  prices: { monthly: "price_month1", annual: "price_year1" },
  trialDays: undefined as number | undefined,
};

/** A recording stand-in for Stripe, and for the server's database client. */
function fakes(options: { storedCustomerId?: string | null } = {}) {
  const customersCreate = vi.fn(async (_params: unknown, _options?: unknown) => ({ id: "cus_new" }));
  const sessionsCreate = vi.fn(async (_params: unknown) => ({ url: "https://checkout.stripe.com/c/pay/cs_test_1" }) as { url: string | null });
  const portalCreate = vi.fn(async (_params: unknown) => ({ url: "https://billing.stripe.com/p/session/abc" }));
  const stripe = {
    customers: { create: customersCreate },
    checkout: { sessions: { create: sessionsCreate } },
    billingPortal: { sessions: { create: portalCreate } },
  } as unknown as StripeApi;

  // The server's client: the update that records the customer id, and the read that follows it.
  const updates: unknown[] = [];
  const stored = { stripe_customer_id: options.storedCustomerId === undefined ? "cus_new" : options.storedCustomerId };
  const chain: any = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "then") return (resolve: (v: unknown) => void) => resolve({ data: [{ id: FACILITY_ID }], error: null });
        return (...args: unknown[]) => {
          if (prop === "update") updates.push(args[0]);
          if (prop === "maybeSingle") return Promise.resolve({ data: { id: FACILITY_ID, ...stored }, error: null });
          return chain;
        };
      },
    },
  );
  const admin = { from: () => chain } as unknown as Db;
  return { stripe, admin, customersCreate, sessionsCreate, portalCreate, updates };
}

describe("createCheckoutSession", () => {
  it("makes the facility a Stripe customer, then a subscription Checkout session for the plan it chose", async () => {
    const f = fakes();
    const result = await createCheckoutSession({ stripe: f.stripe, admin: f.admin, config }, { facility: facility(), adminEmail: "alice@maple.example", plan: "annual" });

    expect(result).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    expect(f.customersCreate).toHaveBeenCalledTimes(1);
    expect(f.customersCreate.mock.calls[0]?.[0]).toEqual({
      name: "Maple Court",
      email: "alice@maple.example",
      metadata: { facility_id: FACILITY_ID },
    });
    expect(f.sessionsCreate).toHaveBeenCalledWith({
      mode: "subscription",
      customer: "cus_new",
      client_reference_id: FACILITY_ID,
      line_items: [{ price: "price_year1", quantity: 1 }],
      allow_promotion_codes: true,
      metadata: { facility_id: FACILITY_ID, plan: "annual" },
      subscription_data: { metadata: { facility_id: FACILITY_ID, plan: "annual" } },
      success_url: "https://app.cognicopia.org/admin/billing?checkout=success",
      cancel_url: "https://app.cognicopia.org/admin/billing?checkout=canceled",
    });
  });

  it("uses the monthly price for the monthly plan", async () => {
    const f = fakes();
    await createCheckoutSession({ stripe: f.stripe, admin: f.admin, config }, { facility: facility(), adminEmail: null, plan: "monthly" });
    expect((f.sessionsCreate.mock.calls[0]?.[0] as any).line_items).toEqual([{ price: "price_month1", quantity: 1 }]);
  });

  it("adds a free trial to the subscription when one is configured", async () => {
    const f = fakes();
    await createCheckoutSession({ stripe: f.stripe, admin: f.admin, config: { ...config, trialDays: 14 } }, { facility: facility(), adminEmail: null, plan: "monthly" });
    expect((f.sessionsCreate.mock.calls[0]?.[0] as any).subscription_data).toEqual({
      metadata: { facility_id: FACILITY_ID, plan: "monthly" },
      trial_period_days: 14,
    });
  });

  it("reuses the facility's Stripe customer when it has one, and makes no new one", async () => {
    const f = fakes();
    await createCheckoutSession(
      { stripe: f.stripe, admin: f.admin, config },
      { facility: facility({ stripe_customer_id: "cus_existing", subscription_status: "canceled" }), adminEmail: null, plan: "monthly" },
    );
    expect(f.customersCreate).not.toHaveBeenCalled();
    expect((f.sessionsCreate.mock.calls[0]?.[0] as any).customer).toBe("cus_existing");
  });

  it.each(SUBSCRIPTION_STATUSES)("a facility that is %s: allowed exactly when no subscription is live", async (status) => {
    const f = fakes();
    const attempt = createCheckoutSession({ stripe: f.stripe, admin: f.admin, config }, { facility: facility({ subscription_status: status, stripe_customer_id: "cus_1" }), adminEmail: null, plan: "annual" });
    if (canStartCheckout(status)) {
      await expect(attempt).resolves.toHaveProperty("url");
    } else {
      await expect(attempt).rejects.toMatchObject({ status: 409, code: "already_subscribed" });
      expect(f.sessionsCreate).not.toHaveBeenCalled();
      expect(f.customersCreate).not.toHaveBeenCalled();
    }
  });

  it("refuses a plan it does not know, without calling Stripe", async () => {
    const f = fakes();
    await expect(
      createCheckoutSession({ stripe: f.stripe, admin: f.admin, config }, { facility: facility(), adminEmail: null, plan: "enterprise" as never }),
    ).rejects.toMatchObject({ status: 422 });
    expect(f.customersCreate).not.toHaveBeenCalled();
    expect(f.sessionsCreate).not.toHaveBeenCalled();
  });

  it("reports a session with no address as a billing error, not as success", async () => {
    const f = fakes();
    f.sessionsCreate.mockResolvedValueOnce({ url: null });
    await expect(createCheckoutSession({ stripe: f.stripe, admin: f.admin, config }, { facility: facility(), adminEmail: null, plan: "annual" })).rejects.toMatchObject({ status: 502 });
  });

  it("lets a Stripe failure through for the route to report, without swallowing it", async () => {
    const f = fakes();
    f.sessionsCreate.mockRejectedValueOnce(Object.assign(new Error("No such price"), { type: "StripeInvalidRequestError" }));
    await expect(createCheckoutSession({ stripe: f.stripe, admin: f.admin, config }, { facility: facility(), adminEmail: null, plan: "annual" })).rejects.toMatchObject({ type: "StripeInvalidRequestError" });
  });

  it("never puts a resident, or anything but the facility's name and the admin's email, in Stripe", async () => {
    const f = fakes();
    await createCheckoutSession({ stripe: f.stripe, admin: f.admin, config }, { facility: facility(), adminEmail: "alice@maple.example", plan: "annual" });
    const sent = JSON.stringify([f.customersCreate.mock.calls, f.sessionsCreate.mock.calls]);
    expect(sent).not.toMatch(/resident|patient|diagnos|medic|birth/i);
  });
});

describe("ensureStripeCustomer", () => {
  it("gives Stripe an idempotency key tied to the facility and the details, so a double click makes one customer", async () => {
    const a = fakes();
    const b = fakes();
    await ensureStripeCustomer({ stripe: a.stripe, admin: a.admin, facility: facility(), email: "alice@maple.example" });
    await ensureStripeCustomer({ stripe: b.stripe, admin: b.admin, facility: facility(), email: "alice@maple.example" });
    const keyA = (a.customersCreate.mock.calls[0]?.[1] as any).idempotencyKey as string;
    const keyB = (b.customersCreate.mock.calls[0]?.[1] as any).idempotencyKey as string;
    expect(keyA).toMatch(/^cognicopia-customer-[0-9a-f]{24}$/);
    expect(keyB).toBe(keyA);
  });

  it("uses a different key if the details differ, so an edited name is not an idempotency conflict", async () => {
    const a = fakes();
    const b = fakes();
    await ensureStripeCustomer({ stripe: a.stripe, admin: a.admin, facility: facility(), email: null });
    await ensureStripeCustomer({ stripe: b.stripe, admin: b.admin, facility: facility({ facility_name: "Maple Court East" }), email: null });
    expect((a.customersCreate.mock.calls[0]?.[1] as any).idempotencyKey).not.toBe((b.customersCreate.mock.calls[0]?.[1] as any).idempotencyKey);
  });

  it("records the customer on the facility, and returns the id on record if another request got there first", async () => {
    const f = fakes({ storedCustomerId: "cus_winner" });
    const id = await ensureStripeCustomer({ stripe: f.stripe, admin: f.admin, facility: facility(), email: null });
    expect(f.updates).toEqual([{ stripe_customer_id: "cus_new" }]);
    expect(id).toBe("cus_winner");
  });

  it("does nothing when the facility already has one", async () => {
    const f = fakes();
    expect(await ensureStripeCustomer({ stripe: f.stripe, admin: f.admin, facility: facility({ stripe_customer_id: "cus_have" }), email: null })).toBe("cus_have");
    expect(f.customersCreate).not.toHaveBeenCalled();
    expect(f.updates).toEqual([]);
  });
});

describe("createPortalSession", () => {
  const portalConfig = { appUrl: "https://app.cognicopia.org", configurationId: undefined as string | undefined };

  it("opens the portal for the facility's customer, and returns to the billing page", async () => {
    const f = fakes();
    const result = await createPortalSession({ stripe: f.stripe, config: portalConfig }, { facility: facility({ stripe_customer_id: "cus_1", subscription_status: "past_due" }) });
    expect(result).toEqual({ url: "https://billing.stripe.com/p/session/abc" });
    expect(f.portalCreate).toHaveBeenCalledWith({ customer: "cus_1", return_url: "https://app.cognicopia.org/admin/billing?portal=return" });
  });

  it("uses a named portal configuration when there is one", async () => {
    const f = fakes();
    await createPortalSession({ stripe: f.stripe, config: { ...portalConfig, configurationId: "bpc_1" } }, { facility: facility({ stripe_customer_id: "cus_1" }) });
    expect(f.portalCreate).toHaveBeenCalledWith({ customer: "cus_1", return_url: "https://app.cognicopia.org/admin/billing?portal=return", configuration: "bpc_1" });
  });

  it("is open to a facility in any status that has a customer: that is how a failed payment is put right", async () => {
    for (const status of SUBSCRIPTION_STATUSES) {
      const f = fakes();
      await expect(createPortalSession({ stripe: f.stripe, config: portalConfig }, { facility: facility({ stripe_customer_id: "cus_1", subscription_status: status }) }), status).resolves.toHaveProperty("url");
    }
  });

  it("answers 409 when there is no billing account yet, without calling Stripe", async () => {
    const f = fakes();
    await expect(createPortalSession({ stripe: f.stripe, config: portalConfig }, { facility: facility() })).rejects.toMatchObject({ status: 409, code: "no_billing_account" });
    expect(f.portalCreate).not.toHaveBeenCalled();
  });

  it("the DataError it throws is one a route can show", async () => {
    const f = fakes();
    await expect(createPortalSession({ stripe: f.stripe, config: portalConfig }, { facility: facility() })).rejects.toBeInstanceOf(DataError);
  });
});
