import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** POST /api/licenses/redeem at the HTTP edge: who may call it, what it answers, and what it never says. */

const retrieve = vi.fn();
vi.mock("@/lib/billing/stripe", () => ({ getStripe: () => ({ checkout: { sessions: { retrieve } } }) }));

const { POST, OPTIONS } = await import("@/app/api/licenses/redeem/route");

const pem = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey.export({ type: "pkcs8", format: "pem" }) as string;
const REF = "cs_live_a1B2c3D4e5F6g7H8i9J0";
const paid = {
  id: REF, mode: "subscription", status: "complete", payment_status: "paid",
  customer_details: { name: "Pat", business_name: "Maple Court" },
  line_items: { data: [{ price: { id: "price_year1" } }] },
  subscription: { id: "sub_1", status: "active", items: { data: [{ current_period_end: Math.floor(Date.parse("2027-10-12") / 1000), price: { id: "price_year1" } }] } },
};
let ip = 0;
const call = (body: unknown, headers: Record<string, string> = {}, method = "POST") =>
  POST(new Request("https://app.cognicopia.org/api/licenses/redeem", {
    method,
    headers: { "content-type": "application/json", origin: "https://cognicopia.org", "x-forwarded-for": `10.0.0.${++ip}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));

const ENV = { LICENSE_SIGNING_KEY: pem, STRIPE_PRICE_MONTHLY: "price_month1", STRIPE_PRICE_ANNUAL: "price_year1" };
beforeEach(() => { retrieve.mockReset(); for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v); });
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/licenses/redeem", () => {
  it("answers a paid checkout with a key, for the static site only, and says not to cache it", async () => {
    retrieve.mockResolvedValue(paid);
    const res = await call({ session_id: REF });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://cognicopia.org");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ license_key: expect.stringMatching(/^COG1\./), facility_name: "Maple Court", tier: "annual_facility", expires_at: "2027-10-12" });
    expect(retrieve).toHaveBeenCalledWith(REF, { expand: ["subscription", "line_items"] });
  });

  it("refuses a page on another site, and answers its preflight with no permission", async () => {
    const res = await call({ session_id: REF }, { origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(retrieve).not.toHaveBeenCalled();
    const pre = await OPTIONS(new Request("https://app.cognicopia.org/api/licenses/redeem", { method: "OPTIONS", headers: { origin: "https://evil.example" } }));
    expect(pre.status).toBe(403);
    const ok = await OPTIONS(new Request("https://app.cognicopia.org/api/licenses/redeem", { method: "OPTIONS", headers: { origin: "https://cognicopia.org" } }));
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://cognicopia.org");
  });

  it("can be told which sites to allow", async () => {
    vi.stubEnv("LICENSE_ALLOWED_ORIGINS", "https://staging.cognicopia.org/, https://cognicopia.org");
    retrieve.mockResolvedValue(paid);
    expect((await call({ session_id: REF }, { origin: "https://staging.cognicopia.org" })).status).toBe(200);
  });

  it("explains an unpaid, unknown or foreign checkout in the shape activate.html reads", async () => {
    retrieve.mockResolvedValue({ ...paid, payment_status: "unpaid" });
    const a = await call({ session_id: REF });
    expect(a.status).toBe(402);
    expect((await a.json()).error.code).toBe("not_paid");
    retrieve.mockRejectedValue(Object.assign(new Error("No such checkout.session"), { type: "StripeInvalidRequestError", code: "resource_missing" }));
    const b = await call({ session_id: REF });
    expect(b.status).toBe(404);
    expect((await b.json()).error.code).toBe("not_found");
  });

  it("asks for JSON and the right field, and turns a Stripe outage into a plain answer that leaks nothing", async () => {
    expect((await call("session_id=x", { "content-type": "text/plain" })).status).toBe(415);
    expect((await call({ nope: 1 })).status).toBe(422);
    expect((await call({ session_id: "sub_123" })).status).toBe(400);
    retrieve.mockRejectedValue(Object.assign(new Error("secret detail sk_live_abc cus_123"), { type: "StripeConnectionError" }));
    const res = await call({ session_id: REF });
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/sk_live|cus_123|secret detail/);
  });

  it("limits how fast one address can try", async () => {
    retrieve.mockResolvedValue(paid);
    const same = { "x-forwarded-for": "203.0.113.9" };
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await call({ session_id: REF }, same)).status);
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true);
    expect(codes.slice(10)).toEqual([429, 429]);
  });

  it("says it is not set up, naming no value, when the signing key is missing", async () => {
    vi.stubEnv("LICENSE_SIGNING_KEY", "");
    const res = await call({ session_id: REF });
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toMatch(/BEGIN/);
  });

  it("accepts the signing key with literal \\n for line breaks", async () => {
    vi.stubEnv("LICENSE_SIGNING_KEY", pem.trim().replace(/\n/g, "\\n"));
    retrieve.mockResolvedValue(paid);
    expect((await call({ session_id: REF })).status).toBe(200);
  });
});
