import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStripe } from "@/lib/billing/stripe";

/**
 * The shared Stripe client: Stripe's own host unless, in development only, STRIPE_API_BASE
 * points it at a stand-in server. Nothing here makes a request.
 */

const KEY = "sk_test_placeholder";

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", KEY);
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("STRIPE_API_BASE", "");
});
afterEach(() => vi.unstubAllEnvs());

const where = () => {
  const client = getStripe();
  return `${client.getApiField("protocol")}://${client.getApiField("host")}:${client.getApiField("port")}`;
};

describe("getStripe", () => {
  it("talks to Stripe itself by default", () => {
    expect(where()).toBe("https://api.stripe.com:443");
  });

  it("in development, STRIPE_API_BASE points it at a stand-in server", () => {
    vi.stubEnv("STRIPE_API_BASE", "http://127.0.0.1:12111");
    expect(where()).toBe("http://127.0.0.1:12111");
  });

  it("uses the usual port for an address with none", () => {
    vi.stubEnv("STRIPE_API_BASE", "http://localhost");
    expect(where()).toBe("http://localhost:80");
    vi.stubEnv("STRIPE_API_BASE", "https://stand-in.example");
    expect(where()).toBe("https://stand-in.example:443");
  });

  it("ignores STRIPE_API_BASE in production, so a stray setting can never send live billing elsewhere", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STRIPE_API_BASE", "http://127.0.0.1:12111");
    expect(where()).toBe("https://api.stripe.com:443");
  });

  it.each(["not an address", "ftp://example.com", "javascript:alert(1)", "file:///etc/passwd", "   "])("ignores %j", (value) => {
    vi.stubEnv("STRIPE_API_BASE", value);
    expect(where()).toBe("https://api.stripe.com:443");
  });

  it("reuses the client while the key and address stay the same, and makes a new one when either changes", () => {
    const first = getStripe();
    expect(getStripe()).toBe(first);

    vi.stubEnv("STRIPE_API_BASE", "http://127.0.0.1:12111");
    const second = getStripe();
    expect(second).not.toBe(first);
    expect(getStripe()).toBe(second);

    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_another");
    expect(getStripe()).not.toBe(second);
  });

  it("needs the key, and says which setting is missing", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(() => getStripe()).toThrow(/STRIPE_SECRET_KEY/);
  });
});
