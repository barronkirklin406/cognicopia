import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataError } from "@/lib/data/errors";
import { RateLimiter } from "@/lib/licenses/rate-limit";
import { redeemCheckout, type CheckoutSessionLike, type RedeemDeps } from "@/lib/licenses/redeem";
import { cleanFacilityName, signLicense } from "@/lib/licenses/token";

/**
 * Turning a paid checkout into a license key, and proving the key is one the static site accepts.
 *
 * The last block loads the REAL browser files (src/config/license.js and assets/services/licenseManager.js)
 * in a sandbox with this test's public key and hands them what the service signed. If the two sides ever
 * drift apart in format, this is the test that fails.
 */

const ROOT = path.resolve(import.meta.dirname, "../../..");
const pair = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const signingKey = pair.privateKey.export({ type: "pkcs8", format: "pem" }) as string;
const jwk = pair.publicKey.export({ format: "jwk" });
const hex = (b: string) => Buffer.from(b, "base64url").toString("hex").padStart(64, "0");
const publicHex = "04" + hex(jwk.x as string) + hex(jwk.y as string);

const PRICES = { monthly: "price_month1", annual: "price_year1" };
const REF = "cs_live_a1B2c3D4e5F6g7H8i9J0";
const NOW = new Date("2026-10-12T15:00:00Z");
const periodEnd = (iso: string) => Math.floor(Date.parse(iso) / 1000);

function session(over: Partial<CheckoutSessionLike> & { plan?: "monthly" | "annual"; end?: string; subStatus?: string } = {}): CheckoutSessionLike {
  const priceId = PRICES[over.plan ?? "annual"];
  return {
    id: REF,
    mode: "subscription",
    status: "complete",
    payment_status: "paid",
    created: periodEnd("2026-10-12T14:00:00Z"),
    customer_details: { name: "Pat Example", business_name: "Maple Court Senior Living" },
    custom_fields: null,
    line_items: { data: [{ price: { id: priceId } }] },
    subscription: { id: "sub_123", status: over.subStatus ?? "active", items: { data: [{ current_period_end: periodEnd(over.end ?? "2027-10-12T14:00:00Z"), price: { id: priceId } }] } },
    ...over,
  };
}
const deps = (s: CheckoutSessionLike | Error): RedeemDeps => ({
  stripe: { checkout: { sessions: { retrieve: async () => { if (s instanceof Error) throw s; return s; } } } },
  signingKey,
  prices: PRICES,
  now: () => NOW,
});
const refused = async (s: CheckoutSessionLike | Error, ref = REF) => {
  try { await redeemCheckout(deps(s), ref); } catch (e) { return e as DataError; }
  throw new Error("expected a refusal");
};

/** The static site's real files, in a sandbox, with this test's public key. */
function browser(now: Date) {
  const cfgSrc = fs.readFileSync(path.join(ROOT, "src/config/license.js"), "utf8").replace("PUBLIC_KEYS: Object.freeze([])", `PUBLIC_KEYS: Object.freeze(["${publicHex}"])`);
  const store = new Map<string, string>();
  const FakeDate = class extends Date { constructor(...a: unknown[]) { if (a.length) super(...(a as [string])); else super(now); } static now() { return now.getTime(); } };
  const box: Record<string, unknown> = {
    console, JSON, Object, String, Math, Array, isNaN, parseInt, Date: FakeDate,
    localStorage: { getItem: (k: string) => (store.has(k) ? store.get(k)! : null), setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k) },
  };
  box.globalThis = box; box.window = box;
  vm.createContext(box);
  vm.runInContext(cfgSrc, box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "assets/services/licenseManager.js"), "utf8"), box);
  return box.CognicopiaLicense as { activateKey(k: string): { ok: boolean; message: string }; status(): Record<string, unknown>; isLicensed(): boolean };
}

describe("redeemCheckout", () => {
  it("turns a paid annual subscription into a key that names the facility and the paid-through date", async () => {
    const r = await redeemCheckout(deps(session()), REF);
    expect(r).toMatchObject({ facilityName: "Maple Court Senior Living", tier: "annual_facility", expiresAt: "2027-10-12" });
    expect(r.licenseKey).toMatch(/^COG1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{86}$/);
  });

  it("knows the monthly plan", async () => {
    const r = await redeemCheckout(deps(session({ plan: "monthly", end: "2026-11-12T14:00:00Z" })), REF);
    expect(r).toMatchObject({ tier: "monthly_facility", expiresAt: "2026-11-12" });
  });

  it("takes the facility name from the name a Payment Link collected first, then a custom field, then the business name, then the name", async () => {
    const z = await redeemCheckout(deps(session({ collected_information: { business_name: "Oak Hollow Care" }, custom_fields: [{ key: "facility_name", text: { value: "ignored" } }] })), REF);
    expect(z.facilityName).toBe("Oak Hollow Care");
    const a = await redeemCheckout(deps(session({ custom_fields: [{ key: "facility_name", text: { value: "  Cedar   Grove  " } }] })), REF);
    expect(a.facilityName).toBe("Cedar Grove");
    const b = await redeemCheckout(deps(session({ customer_details: { name: "Pat Example", business_name: null } })), REF);
    expect(b.facilityName).toBe("Pat Example");
    const c = await redeemCheckout(deps(session({ customer_details: null })), REF);
    expect(c.facilityName).toBe("Your facility");
  });

  it("cleans a hostile or oversized name", () => {
    expect(cleanFacilityName("<b>Evil\u0000 Name</b>\n\t")).toBe("b Evil Name /b");
    expect(cleanFacilityName("x".repeat(500))).toHaveLength(120);
  });

  it("gives the same license id to the same purchase every time, so withdrawing it withdraws every renewal", async () => {
    const a = await redeemCheckout(deps(session()), REF), b = await redeemCheckout(deps(session({ end: "2028-10-12T14:00:00Z" })), REF);
    const id = (t: string) => JSON.parse(Buffer.from(t.split(".")[1] as string, "base64url").toString()).n;
    expect(id(a.licenseKey)).toBe(id(b.licenseKey));
    expect(id(a.licenseKey)).toMatch(/^lic_[0-9a-f]{16}$/);
  });

  it("gives a cancelled subscription the end of the period it paid for", async () => {
    const r = await redeemCheckout(deps(session({ subStatus: "canceled", end: "2026-11-01T00:00:00Z" })), REF);
    expect(r.expiresAt).toBe("2026-11-01");
  });

  it("treats a one-time yearly payment as paid through a year from the day it was made", async () => {
    const s = session({ mode: "payment", subscription: null });
    const r = await redeemCheckout(deps(s), REF);
    expect(r).toMatchObject({ tier: "annual_facility", expiresAt: "2027-10-12" });
  });

  it("refuses what is not a finished, paid license, and says why", async () => {
    expect((await refused(session({ status: "open" }))).status).toBe(402);
    expect((await refused(session({ payment_status: "unpaid" }))).code).toBe("not_paid");
    expect((await refused(session({ subStatus: "incomplete" }))).code).toBe("not_paid");
    expect((await refused(session({ subStatus: "unpaid" }))).code).toBe("not_paid");
    const other = session();
    other.line_items = { data: [{ price: { id: "price_something_else" } }] };
    other.subscription = { id: "sub_123", status: "active", items: { data: [{ current_period_end: periodEnd("2027-10-12T14:00:00Z"), price: { id: "price_something_else" } }] } };
    expect((await refused(other)).code).toBe("not_a_license");
    expect((await refused(session({ mode: "payment", plan: "monthly", subscription: null }))).code).toBe("not_a_license");
  });

  it("refuses a reference of the wrong shape without asking Stripe", async () => {
    const retrieve = vi.fn();
    for (const bad of ["", "cs_", "sub_123", "cs_live_<script>", "cs_live_short", "x".repeat(400), "cs_live_" + "a".repeat(250)]) {
      await expect(redeemCheckout({ ...deps(session()), stripe: { checkout: { sessions: { retrieve } } } }, bad)).rejects.toMatchObject({ status: 400 });
    }
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("tells a session Stripe does not have as 404, and does not hide other failures", async () => {
    const missing = Object.assign(new Error("No such checkout.session: 'cs_live_x'"), { type: "StripeInvalidRequestError", code: "resource_missing" });
    expect((await refused(missing)).status).toBe(404);
    await expect(redeemCheckout(deps(Object.assign(new Error("boom"), { type: "StripeConnectionError" })), REF)).rejects.toThrow("boom");
  });
});

describe("what the service signs is what the browser accepts", () => {
  it("is verified by the static site's own license manager, tier and dates intact", async () => {
    const r = await redeemCheckout(deps(session()), REF);
    const L = browser(NOW);
    const out = L.activateKey(r.licenseKey);
    expect(out.ok, out.message).toBe(true);
    expect(L.status()).toMatchObject({ licensed: true, keyed: true, facilityName: "Maple Court Senior Living", licenseTier: "annual_facility", expiresAt: "2027-10-12", inGrace: false });
  });

  it("keeps working offline for months, then through the grace days, then stops", async () => {
    const r = await redeemCheckout(deps(session({ plan: "monthly", end: "2026-11-12T14:00:00Z" })), REF);
    const at = (iso: string) => { const L = browser(new Date(iso)); L.activateKey(r.licenseKey); return L; };
    const early = browser(NOW); early.activateKey(r.licenseKey);
    expect(early.isLicensed()).toBe(true);
    // an unlicensed computer cannot be given an old key after the grace days
    expect(browser(new Date("2027-03-01T00:00:00Z")).activateKey(r.licenseKey).ok).toBe(false);
    expect(at("2026-12-20T00:00:00Z").isLicensed()).toBe(true);
  });

  it("refuses a key signed by a different private key, and one with an edited date", async () => {
    const r = await redeemCheckout(deps(session()), REF);
    const stranger = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    const forged = signLicense({ facility: "Thief", tier: "enterprise", until: "2099-01-01" }, stranger).token;
    expect(browser(NOW).activateKey(forged).ok).toBe(false);
    const [h, body, sig] = r.licenseKey.split(".") as [string, string, string];
    const edited = JSON.parse(Buffer.from(body, "base64url").toString());
    edited.e = "2099-01-01";
    expect(browser(NOW).activateKey([h, Buffer.from(JSON.stringify(edited)).toString("base64url"), sig].join(".")).ok).toBe(false);
  });
});

describe("RateLimiter", () => {
  it("allows a few tries, then refuses, then forgives after the window", () => {
    let t = 0;
    const limiter = new RateLimiter(3, 1000, () => t);
    expect([limiter.take("a"), limiter.take("a"), limiter.take("a"), limiter.take("a")]).toEqual([true, true, true, false]);
    expect(limiter.take("b")).toBe(true);
    t = 1500;
    expect(limiter.take("a")).toBe(true);
  });
});

beforeEach(() => vi.restoreAllMocks());
