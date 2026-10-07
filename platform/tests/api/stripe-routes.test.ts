import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessContext } from "@/lib/access/context";

/**
 * The three Stripe routes at the HTTP edge.
 *
 * The webhook is tested with REAL Stripe signatures, made with the library's own
 * test helper, so what is proved is that a forged, altered, stale or unsigned
 * request is refused, and a genuine one is accepted. Stripe's API and the
 * database are stand-ins that record what they are asked.
 */

const loadAccessContext = vi.fn();
vi.mock("@/lib/access/context", () => ({ loadAccessContext: (...args: unknown[]) => loadAccessContext(...args) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ marker: "the user's own client" }) }));

// Stripe: the real library (for signatures), with the calls that would reach the network replaced.
const stripe = new Stripe("sk_test_placeholder");
const subscriptionsList = vi.fn();
const sessionsCreate = vi.fn();
const portalCreate = vi.fn();
const customersCreate = vi.fn();
Object.assign(stripe.subscriptions, { list: subscriptionsList });
Object.assign(stripe.checkout.sessions, { create: sessionsCreate });
Object.assign(stripe.billingPortal.sessions, { create: portalCreate });
Object.assign(stripe.customers, { create: customersCreate });
vi.mock("@/lib/billing/stripe", () => ({ getStripe: () => stripe }));

// The server's database client.
const rpc = vi.fn();
const adminChain: any = new Proxy(
  {},
  {
    get(_t, prop: string) {
      if (prop === "then") return (resolve: (v: unknown) => void) => resolve({ data: [{ id: "f1" }], error: null });
      return (..._args: unknown[]) => (prop === "maybeSingle" ? Promise.resolve({ data: { id: "f1", stripe_customer_id: "cus_new" }, error: null }) : adminChain);
    },
  },
);
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc, from: () => adminChain }) }));

const { POST: checkout } = await import("@/app/api/stripe/checkout/route");
const { POST: portal } = await import("@/app/api/stripe/portal/route");
const { POST: webhook } = await import("@/app/api/stripe/webhook/route");

const ENV = {
  APP_URL: "https://app.cognicopia.org",
  STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
  STRIPE_PRICE_MONTHLY: "price_month1",
  STRIPE_PRICE_ANNUAL: "price_year1",
};

const facility = (status: string, customer: string | null = null) => ({
  id: "f1",
  facility_name: "Maple Court",
  subscription_status: status,
  stripe_customer_id: customer,
  stripe_subscription_id: null,
  subscription_interval: null,
  subscription_current_period_end: null,
  subscription_cancel_at_period_end: false,
});
const as = (role: string, status = "incomplete", customer: string | null = null) =>
  loadAccessContext.mockResolvedValue({ user: { id: "u1", email: "alice@maple.example" }, membership: { role, facility: facility(status, customer) } } as AccessContext);
const json = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://app.cognicopia.org${url}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const body = async (r: Response) => (await r.json()) as Record<string, any>;

beforeEach(() => {
  vi.resetAllMocks();
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  vi.stubEnv("STRIPE_TRIAL_DAYS", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  customersCreate.mockResolvedValue({ id: "cus_new" });
  sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_test_1" });
  portalCreate.mockResolvedValue({ url: "https://billing.stripe.com/p/session/abc" });
  as("admin");
});
afterEach(() => vi.unstubAllEnvs());

// ---------------------------------------------------------------------
// POST /api/stripe/checkout
// ---------------------------------------------------------------------

describe("POST /api/stripe/checkout", () => {
  it("gives an admin the address of a Stripe Checkout session for the plan they chose", async () => {
    const response = await checkout(json("/api/stripe/checkout", { plan: "annual" }));
    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    expect(sessionsCreate.mock.calls[0]?.[0]).toMatchObject({
      mode: "subscription",
      customer: "cus_new",
      client_reference_id: "f1",
      line_items: [{ price: "price_year1", quantity: 1 }],
      success_url: "https://app.cognicopia.org/admin/billing?checkout=success",
      cancel_url: "https://app.cognicopia.org/admin/billing?checkout=canceled",
    });
  });

  it("works for a facility whose subscription has lapsed: an admin must be able to renew", async () => {
    for (const status of ["canceled", "incomplete_expired", "incomplete"]) {
      as("admin", status, "cus_old");
      expect((await checkout(json("/api/stripe/checkout", { plan: "monthly" }))).status, status).toBe(200);
    }
  });

  it("answers 401 with no session, 403 with no facility, and 403 to staff, who cannot start billing", async () => {
    loadAccessContext.mockResolvedValue(null);
    expect((await checkout(json("/api/stripe/checkout", { plan: "annual" }))).status).toBe(401);

    loadAccessContext.mockResolvedValue({ user: { id: "u2", email: null }, membership: null });
    expect((await body(await checkout(json("/api/stripe/checkout", { plan: "annual" })))).error.code).toBe("no_facility");

    as("staff");
    const staff = await checkout(json("/api/stripe/checkout", { plan: "annual" }));
    expect(staff.status).toBe(403);
    expect((await body(staff)).error.code).toBe("forbidden");
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(customersCreate).not.toHaveBeenCalled();
  });

  it.each([{}, { plan: "" }, { plan: "enterprise" }, { plan: "price_year1" }, { plan: 12 }, { plan: null }, { price: "price_free" }])(
    "refuses %j with 422: a browser can only name a plan, never a price",
    async (input) => {
      const response = await checkout(json("/api/stripe/checkout", input));
      expect(response.status).toBe(422);
      expect(sessionsCreate).not.toHaveBeenCalled();
    },
  );

  it("requires JSON, and refuses a request from another site", async () => {
    const form = new Request("https://app.cognicopia.org/api/stripe/checkout", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "plan=annual" });
    expect((await checkout(form)).status).toBe(415);
    const crossSite = json("/api/stripe/checkout", { plan: "annual" }, { origin: "https://evil.example" });
    expect((await checkout(crossSite)).status).toBe(403);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it.each(["active", "trialing", "past_due", "unpaid", "paused"])("a facility that is %s gets 409: it manages its subscription in the portal", async (status) => {
    as("admin", status, "cus_1");
    const response = await checkout(json("/api/stripe/checkout", { plan: "annual" }));
    expect(response.status).toBe(409);
    expect((await body(response)).error.code).toBe("already_subscribed");
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("answers 503 and names the setting when billing is not set up, without touching Stripe", async () => {
    vi.stubEnv("STRIPE_PRICE_ANNUAL", "");
    const response = await checkout(json("/api/stripe/checkout", { plan: "annual" }));
    expect(response.status).toBe(503);
    expect((await body(response)).error.code).toBe("not_configured");
    expect(console.error).toHaveBeenCalledWith("[api] not configured:", "STRIPE_PRICE_ANNUAL");
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("reports a failure at Stripe as Stripe's, not as the user's, and without Stripe's words", async () => {
    sessionsCreate.mockRejectedValue(Object.assign(new Error("No such price: 'price_year1'"), { type: "StripeInvalidRequestError", code: "resource_missing" }));
    const response = await checkout(json("/api/stripe/checkout", { plan: "annual" }));
    expect(response.status).toBe(502);
    const payload = await body(response);
    expect(payload.error.code).toBe("billing_error");
    expect(JSON.stringify(payload)).not.toMatch(/price_year1/);
  });

  it("passes a configured free trial to Stripe", async () => {
    vi.stubEnv("STRIPE_TRIAL_DAYS", "14");
    await checkout(json("/api/stripe/checkout", { plan: "monthly" }));
    expect((sessionsCreate.mock.calls[0]?.[0] as any).subscription_data.trial_period_days).toBe(14);
  });
});

// ---------------------------------------------------------------------
// POST /api/stripe/portal
// ---------------------------------------------------------------------

describe("POST /api/stripe/portal", () => {
  it("gives an admin the address of the Stripe billing portal for their facility's customer", async () => {
    as("admin", "past_due", "cus_1");
    const response = await portal(json("/api/stripe/portal", {}));
    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({ url: "https://billing.stripe.com/p/session/abc" });
    expect(portalCreate).toHaveBeenCalledWith({ customer: "cus_1", return_url: "https://app.cognicopia.org/admin/billing?portal=return" });
  });

  it("is open to a lapsed facility's admin: that is how a failed payment is put right", async () => {
    for (const status of ["past_due", "unpaid", "canceled", "paused"]) {
      as("admin", status, "cus_1");
      expect((await portal(json("/api/stripe/portal", {}))).status, status).toBe(200);
    }
  });

  it("is for admins only: staff get 403", async () => {
    as("staff", "past_due", "cus_1");
    const response = await portal(json("/api/stripe/portal", {}));
    expect(response.status).toBe(403);
    expect(portalCreate).not.toHaveBeenCalled();
  });

  it("answers 409 when the facility has no billing account yet", async () => {
    as("admin", "incomplete", null);
    const response = await portal(json("/api/stripe/portal", {}));
    expect(response.status).toBe(409);
    expect((await body(response)).error.code).toBe("no_billing_account");
  });

  it("answers 401 with no session, and refuses another site's request", async () => {
    loadAccessContext.mockResolvedValue(null);
    expect((await portal(json("/api/stripe/portal", {}))).status).toBe(401);
    as("admin", "active", "cus_1");
    expect((await portal(json("/api/stripe/portal", {}, { origin: "https://evil.example" }))).status).toBe(403);
    expect(portalCreate).not.toHaveBeenCalled();
  });

  it("answers 503 when APP_URL is not set", async () => {
    as("admin", "active", "cus_1");
    vi.stubEnv("APP_URL", "");
    expect((await portal(json("/api/stripe/portal", {}))).status).toBe(503);
  });
});

// ---------------------------------------------------------------------
// POST /api/stripe/webhook
// ---------------------------------------------------------------------

const SECRET = ENV.STRIPE_WEBHOOK_SECRET;
const event = (type: string, object: Record<string, unknown>, id = "evt_1") =>
  JSON.stringify(
    { id, object: "event", api_version: "2026-09-30.endive", created: 1_760_000_000, livemode: false, pending_webhooks: 1, request: { id: null, idempotency_key: null }, type, data: { object } },
    null,
    2, // pretty-printed on purpose: the signature is over these exact bytes
  );
const signed = (payload: string, over: { secret?: string; timestamp?: number } = {}) =>
  stripe.webhooks.generateTestHeaderString({ payload, secret: over.secret ?? SECRET, ...(over.timestamp ? { timestamp: over.timestamp } : {}) });
const delivery = (payload: string, signature: string | null) =>
  new Request("https://app.cognicopia.org/api/stripe/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", ...(signature ? { "stripe-signature": signature } : {}) },
    body: payload,
  });

const updated = (over: Record<string, unknown> = {}) => event("customer.subscription.updated", { id: "sub_1", object: "subscription", customer: "cus_1", status: "past_due", ...over });
const stripeSays = (status: string) =>
  subscriptionsList.mockResolvedValue({
    data: [{ id: "sub_1", status, created: 1, customer: "cus_1", cancel_at_period_end: false, items: { data: [{ current_period_end: 1_800_000_000, price: { recurring: { interval: "year" } } }] } }],
  });

describe("POST /api/stripe/webhook: who is believed", () => {
  beforeEach(() => {
    stripeSays("active");
    rpc.mockResolvedValue({ data: "applied", error: null });
  });

  it("refuses a request with no signature, and does nothing", async () => {
    const response = await webhook(delivery(updated(), null));
    expect(response.status).toBe(400);
    expect((await body(response)).error.code).toBe("missing_signature");
    expect(subscriptionsList).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["a made-up signature", () => "t=1760000000,v1=" + "0".repeat(64)],
    ["garbage", () => "not a signature"],
    ["an empty value", () => ""],
  ])("refuses %s", async (_label, make) => {
    const response = await webhook(delivery(updated(), make()));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a signature made with the wrong secret", async () => {
    const payload = updated();
    const response = await webhook(delivery(payload, signed(payload, { secret: "whsec_someone_elses" })));
    expect(response.status).toBe(400);
    expect((await body(response)).error.code).toBe("invalid_signature");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a body that was changed after it was signed, by a single character", async () => {
    const payload = updated();
    const tampered = payload.replace("cus_1", "cus_2");
    expect(tampered).not.toBe(payload);
    const response = await webhook(delivery(tampered, signed(payload)));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a genuine request replayed after more than five minutes", async () => {
    const payload = updated();
    const old = Math.floor(Date.now() / 1000) - 3600;
    const response = await webhook(delivery(payload, signed(payload, { timestamp: old })));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("accepts a genuine one, signed over the exact bytes, pretty-printing and non-ASCII text included", async () => {
    const payload = updated({ metadata: { note: "Café Müller ✓" } });
    expect(payload).toContain("\n  "); // not re-serialised anywhere: the signature would no longer match
    const response = await webhook(delivery(payload, signed(payload)));
    expect(response.status).toBe(200);
  });

  it("answers 503, not 200, when the signing secret is not set: nothing can be verified", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const payload = updated();
    const response = await webhook(delivery(payload, signed(payload)));
    expect(response.status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("POST /api/stripe/webhook: what a verified event does", () => {
  beforeEach(() => {
    rpc.mockResolvedValue({ data: "applied", error: null });
  });

  it("looks at Stripe for the customer, and records what Stripe says", async () => {
    stripeSays("past_due");
    const payload = updated({ status: "active" }); // the event's own copy is not what is recorded
    const response = await webhook(delivery(payload, signed(payload)));
    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({ received: true, outcome: "applied" });
    expect(subscriptionsList).toHaveBeenCalledWith({ customer: "cus_1", status: "all", limit: 20 });
    expect(rpc).toHaveBeenCalledWith("apply_stripe_subscription", expect.objectContaining({ p_customer_id: "cus_1", p_subscription_id: "sub_1", p_status: "past_due" }));
  });

  it.each([
    ["customer.subscription.deleted", { id: "sub_1", customer: "cus_1", status: "canceled" }],
    ["invoice.payment_failed", { id: "in_1", customer: "cus_1" }],
    ["customer.subscription.created", { id: "sub_1", customer: "cus_1" }],
    ["checkout.session.completed", { id: "cs_1", mode: "subscription", customer: "cus_1" }],
  ])("%s leads to the same look at Stripe", async (type, object) => {
    stripeSays("active");
    const payload = event(type, object);
    expect((await webhook(delivery(payload, signed(payload)))).status).toBe(200);
    expect(subscriptionsList).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("acknowledges an event it does not handle with 200, and does nothing", async () => {
    const payload = event("charge.succeeded", { id: "ch_1", customer: "cus_1" });
    const response = await webhook(delivery(payload, signed(payload)));
    expect(response.status).toBe(200);
    expect((await body(response)).outcome).toBe("ignored");
    expect(subscriptionsList).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("acknowledges an event for a customer no facility has with 200 (retrying cannot help), and logs only ids", async () => {
    stripeSays("active");
    rpc.mockResolvedValue({ data: "unlinked", error: null });
    const payload = updated();
    const response = await webhook(delivery(payload, signed(payload)));
    expect(response.status).toBe(200);
    expect((await body(response)).outcome).toBe("unlinked");
    expect(console.warn).toHaveBeenCalledWith("[stripe] event for a customer no facility has:", "evt_1", "customer.subscription.updated");
  });

  it("acknowledges a stale observation with 200", async () => {
    stripeSays("active");
    rpc.mockResolvedValue({ data: "stale", error: null });
    const payload = updated();
    expect((await body(await webhook(delivery(payload, signed(payload))))).outcome).toBe("stale");
  });

  it("answers 500 when the database fails, so that Stripe tries again", async () => {
    stripeSays("active");
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "connection lost" } });
    const payload = updated();
    const response = await webhook(delivery(payload, signed(payload)));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await body(response))).not.toMatch(/connection lost/);
  });

  it("answers an error when Stripe cannot be reached, so that Stripe tries again", async () => {
    subscriptionsList.mockRejectedValue(Object.assign(new Error("ECONNRESET"), { type: "StripeConnectionError" }));
    const payload = updated();
    const response = await webhook(delivery(payload, signed(payload)));
    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("records nothing and answers 'none' for a customer with no subscriptions", async () => {
    subscriptionsList.mockResolvedValue({ data: [] });
    const payload = updated();
    const response = await webhook(delivery(payload, signed(payload)));
    expect(response.status).toBe(200);
    expect((await body(response)).outcome).toBe("none");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("is repeatable: the same delivery twice records the same thing twice, harmlessly", async () => {
    stripeSays("active");
    const payload = updated();
    const header = signed(payload);
    expect((await webhook(delivery(payload, header))).status).toBe(200);
    expect((await webhook(delivery(payload, header))).status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect((rpc.mock.calls[0]?.[1] as any).p_status).toBe((rpc.mock.calls[1]?.[1] as any).p_status);
  });

  it("never logs the payload or any customer detail", async () => {
    stripeSays("active");
    rpc.mockResolvedValue({ data: "unlinked", error: null });
    const payload = event("customer.subscription.updated", { id: "sub_1", customer: "cus_1", metadata: { email: "margaret@example.com" } });
    await webhook(delivery(payload, signed(payload)));
    const logged = JSON.stringify([(console.warn as any).mock.calls, (console.error as any).mock.calls]);
    expect(logged).not.toMatch(/margaret|@example|cus_1|sub_1/i);
  });
});
