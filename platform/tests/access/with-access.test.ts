import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessContext } from "@/lib/access/context";
import { DataError } from "@/lib/data/errors";
import { ConfigError } from "@/lib/errors";

/**
 * The route wrappers: what each answers, in what order, and that a handler is
 * never reached when it should not be. The database client and the lookup of who
 * is asking are replaced; the rules themselves are tested in policy.test.ts.
 */

const loadAccessContext = vi.fn();
vi.mock("@/lib/access/context", () => ({ loadAccessContext: (...args: unknown[]) => loadAccessContext(...args) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ marker: "the user's own client" }) }));

const { withAccess, withUser } = await import("@/lib/access/with-access");

const facility = (status: string) => ({
  id: "f1",
  facility_name: "Maple Court",
  subscription_status: status,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  subscription_interval: null,
  subscription_current_period_end: null,
  subscription_cancel_at_period_end: false,
});
const member = (role: string, status = "active"): AccessContext =>
  ({ user: { id: "u1", email: "u1@maple.example" }, membership: { role, facility: facility(status) } }) as AccessContext;

const request = (method = "GET", headers: Record<string, string> = {}) => new Request("https://app.example/api/thing", { method, headers });
const body = async (r: Response) => (await r.json()) as Record<string, any>;
const ok = vi.fn(async () => Response.json({ done: true }));

beforeEach(() => {
  vi.resetAllMocks();
  ok.mockImplementation(async () => Response.json({ done: true }));
});

describe("withUser", () => {
  it("answers 401 when no one is signed in, and never reaches the handler", async () => {
    loadAccessContext.mockResolvedValue(null);
    const response = await withUser(ok)(request());
    expect(response.status).toBe(401);
    expect((await body(response)).error.code).toBe("unauthenticated");
    expect(ok).not.toHaveBeenCalled();
  });

  it("gives the handler the request, the person's own client and who they are, even with no facility", async () => {
    loadAccessContext.mockResolvedValue({ user: { id: "u2", email: "b@x.example" }, membership: null });
    const req = request();
    const response = await withUser(ok)(req);
    expect(response.status).toBe(200);
    expect(ok).toHaveBeenCalledWith({ request: req, db: { marker: "the user's own client" }, user: { id: "u2", email: "b@x.example" } });
  });
});

describe("withAccess", () => {
  it("answers 401, then 403 no_facility, in that order, before anything else", async () => {
    loadAccessContext.mockResolvedValueOnce(null);
    expect((await withAccess({ admin: true, premium: true }, ok)(request())).status).toBe(401);

    loadAccessContext.mockResolvedValueOnce({ user: { id: "u2", email: null }, membership: null });
    const response = await withAccess({ admin: true, premium: true }, ok)(request());
    expect(response.status).toBe(403);
    expect((await body(response)).error.code).toBe("no_facility");
    expect(ok).not.toHaveBeenCalled();
  });

  it("answers 403 forbidden when an admin is needed and the person is staff", async () => {
    loadAccessContext.mockResolvedValue(member("staff"));
    const response = await withAccess({ admin: true }, ok)(request());
    expect(response.status).toBe(403);
    expect((await body(response)).error.code).toBe("forbidden");
    expect(ok).not.toHaveBeenCalled();
  });

  it("answers 402 for a premium route when the subscription has lapsed, with the status and who can fix it", async () => {
    loadAccessContext.mockResolvedValue(member("admin", "past_due"));
    const asAdmin = await withAccess({ premium: true }, ok)(request());
    expect(asAdmin.status).toBe(402);
    expect((await body(asAdmin)).error).toMatchObject({ code: "subscription_required", subscription_status: "past_due", can_manage_billing: true });

    loadAccessContext.mockResolvedValue(member("staff", "canceled"));
    const asStaff = await withAccess({ premium: true }, ok)(request());
    expect(asStaff.status).toBe(402);
    expect((await body(asStaff)).error).toMatchObject({ subscription_status: "canceled", can_manage_billing: false });
    expect(ok).not.toHaveBeenCalled();
  });

  it("lets a subscribed member through to a premium route, with their membership", async () => {
    loadAccessContext.mockResolvedValue(member("staff", "trialing"));
    const req = request();
    const response = await withAccess({ premium: true }, ok)(req);
    expect(response.status).toBe(200);
    expect(ok).toHaveBeenCalledWith(
      expect.objectContaining({ request: req, user: { id: "u1", email: "u1@maple.example" }, membership: expect.objectContaining({ role: "staff" }) }),
    );
  });

  it("does not ask for a subscription when the route is not premium", async () => {
    loadAccessContext.mockResolvedValue(member("admin", "canceled"));
    expect((await withAccess({ admin: true }, ok)(request())).status).toBe(200);
  });
});

describe("a request from another site", () => {
  it.each([
    ["POST", "https://evil.example"],
    ["PUT", "https://evil.example"],
    ["DELETE", "https://evil.example"],
    ["PATCH", "null"],
  ])("%s with Origin %s is refused with 403 before anything is read", async (method, origin) => {
    for (const wrap of [withUser(ok), withAccess({}, ok)]) {
      const response = await wrap(request(method, { origin, host: "app.example" }));
      expect(response.status).toBe(403);
      expect((await body(response)).error.code).toBe("forbidden_origin");
    }
    expect(ok).not.toHaveBeenCalled();
    expect(loadAccessContext).not.toHaveBeenCalled();
  });

  it("a read from another site is not a threat, and is let through", async () => {
    loadAccessContext.mockResolvedValue(member("staff"));
    expect((await withAccess({}, ok)(request("GET", { origin: "https://evil.example" }))).status).toBe(200);
  });

  it("a POST from this site, or from a script with no Origin, is let through", async () => {
    loadAccessContext.mockResolvedValue(member("staff"));
    expect((await withAccess({}, ok)(request("POST", { origin: "https://app.example" }))).status).toBe(200);
    expect((await withAccess({}, ok)(request("POST"))).status).toBe(200);
  });

  it("a POST behind a proxy is judged by the host the browser used", async () => {
    loadAccessContext.mockResolvedValue(member("staff"));
    const response = await withAccess({}, ok)(request("POST", { origin: "https://app.cognicopia.org", "x-forwarded-host": "app.cognicopia.org" }));
    expect(response.status).toBe(200);
  });
});

describe("what goes wrong inside a handler", () => {
  beforeEach(() => {
    loadAccessContext.mockResolvedValue(member("admin"));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("a DataError is told as it is", async () => {
    const response = await withAccess({}, async () => {
      throw new DataError(409, "already_subscribed", "Your facility already has a subscription.");
    })(request());
    expect(response.status).toBe(409);
    expect((await body(response)).error).toEqual({ code: "already_subscribed", message: "Your facility already has a subscription." });
  });

  it("a missing setting is a 503, and the log names the variable, never a value", async () => {
    const response = await withAccess({}, async () => {
      throw new ConfigError(["STRIPE_SECRET_KEY"]);
    })(request());
    expect(response.status).toBe(503);
    expect((await body(response)).error.code).toBe("not_configured");
    expect(console.error).toHaveBeenCalledWith("[api] not configured:", "STRIPE_SECRET_KEY");
  });

  it("a failure at Stripe is told as Stripe's, without Stripe's message, and logged by type and code only", async () => {
    const stripeError = Object.assign(new Error("No such price: 'price_secretish'. Customer cus_123 ..."), { type: "StripeInvalidRequestError", code: "resource_missing" });
    const response = await withAccess({}, async () => {
      throw stripeError;
    })(request());
    expect(response.status).toBe(502);
    const payload = await body(response);
    expect(payload.error.code).toBe("billing_error");
    expect(JSON.stringify(payload)).not.toMatch(/price_secretish|cus_123/);
    expect(console.error).toHaveBeenCalledWith("[api] stripe error", "StripeInvalidRequestError", "resource_missing");
    expect(JSON.stringify((console.error as any).mock.calls)).not.toMatch(/price_secretish|cus_123/);
  });

  it("a Stripe rate limit is a 429, and an unreachable Stripe a 503", async () => {
    for (const [type, status] of [["StripeRateLimitError", 429], ["StripeConnectionError", 503], ["StripeAuthenticationError", 502]] as const) {
      const response = await withAccess({}, async () => {
        throw Object.assign(new Error("x"), { type });
      })(request());
      expect(response.status, type).toBe(status);
    }
  });

  it("anything else is a plain 500 with no message", async () => {
    const response = await withAccess({}, async () => {
      throw new Error("duplicate key value violates unique constraint ... Failing row contains (Margaret)");
    })(request());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await body(response))).not.toMatch(/Margaret|duplicate key/);
    expect(JSON.stringify((console.error as any).mock.calls)).not.toMatch(/Margaret|duplicate key/);
  });
});
