import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppUrl, getCheckoutConfig, getPortalConfig, getStripeSecretKey, getWebhookSecret } from "@/lib/env.server";
import { ConfigError } from "@/lib/errors";

/**
 * The server's settings: what each needs, how a bad one is reported (by name,
 * never by value), and that a missing Stripe key cannot break anything else.
 */

const GOOD = {
  APP_URL: "https://app.cognicopia.org",
  STRIPE_SECRET_KEY: "sk_test_51abcDEF",
  STRIPE_WEBHOOK_SECRET: "whsec_abc123",
  STRIPE_PRICE_MONTHLY: "price_month1",
  STRIPE_PRICE_ANNUAL: "price_year1",
};
const setAll = (env: Record<string, string | undefined>) => {
  for (const name of ["APP_URL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_MONTHLY", "STRIPE_PRICE_ANNUAL", "STRIPE_PORTAL_CONFIGURATION_ID", "STRIPE_TRIAL_DAYS"]) {
    vi.stubEnv(name, env[name] as string);
    if (env[name] === undefined) delete process.env[name];
  }
};
const missing = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return (error as ConfigError).missing;
  }
  throw new Error("expected a ConfigError");
};

afterEach(() => vi.unstubAllEnvs());

describe("APP_URL", () => {
  it("is the origin: any path or trailing slash is dropped", () => {
    for (const [input, expected] of [
      ["https://app.cognicopia.org", "https://app.cognicopia.org"],
      ["https://app.cognicopia.org/", "https://app.cognicopia.org"],
      ["http://localhost:3000/", "http://localhost:3000"],
      ["https://app.cognicopia.org/some/path?x=1", "https://app.cognicopia.org"],
    ]) {
      setAll({ ...GOOD, APP_URL: input });
      expect(getAppUrl(), input).toBe(expected);
    }
  });

  it.each([undefined, "", "   ", "not a url", "ftp://files.example", "javascript:alert(1)", "app.cognicopia.org"])("is refused when it is %j", (value) => {
    setAll({ ...GOOD, APP_URL: value });
    expect(missing(getAppUrl)).toEqual(["APP_URL"]);
  });
});

describe("Stripe's secret key", () => {
  it.each(["sk_test_51abc", "sk_live_51abc", "rk_test_abc", "rk_live_abc"])("accepts %s", (key) => {
    setAll({ ...GOOD, STRIPE_SECRET_KEY: key });
    expect(getStripeSecretKey()).toBe(key);
  });

  it.each([undefined, "", "pk_test_abc", "whsec_abc", "sk_abc", "sk_test_", "price_abc"])("refuses %j", (key) => {
    setAll({ ...GOOD, STRIPE_SECRET_KEY: key });
    expect(missing(getStripeSecretKey)).toEqual(["STRIPE_SECRET_KEY"]);
  });

  it("an error names the variable, never its value", () => {
    setAll({ ...GOOD, STRIPE_SECRET_KEY: "pk_live_SUPERSECRETVALUE" });
    try {
      getStripeSecretKey();
    } catch (error) {
      expect(String((error as Error).message)).toContain("STRIPE_SECRET_KEY");
      expect(String((error as Error).message)).not.toContain("SUPERSECRETVALUE");
    }
  });
});

describe("the webhook secret", () => {
  it("accepts whsec_ and nothing else", () => {
    setAll({ ...GOOD, STRIPE_WEBHOOK_SECRET: "whsec_abc" });
    expect(getWebhookSecret()).toBe("whsec_abc");
    for (const bad of [undefined, "", "sk_test_abc", "abc"]) {
      setAll({ ...GOOD, STRIPE_WEBHOOK_SECRET: bad });
      expect(missing(getWebhookSecret), String(bad)).toEqual(["STRIPE_WEBHOOK_SECRET"]);
    }
  });
});

describe("checkout settings", () => {
  it("maps each plan to its price, and has no trial by default", () => {
    setAll(GOOD);
    expect(getCheckoutConfig()).toEqual({
      appUrl: "https://app.cognicopia.org",
      prices: { monthly: "price_month1", annual: "price_year1" },
      trialDays: undefined,
    });
  });

  it("reads an optional trial length", () => {
    setAll({ ...GOOD, STRIPE_TRIAL_DAYS: "14" });
    expect(getCheckoutConfig().trialDays).toBe(14);
  });

  it("treats a blank trial length (STRIPE_TRIAL_DAYS=) as none", () => {
    setAll({ ...GOOD, STRIPE_TRIAL_DAYS: "" });
    expect(getCheckoutConfig().trialDays).toBeUndefined();
  });

  it.each(["0", "-3", "91", "1.5", "two weeks"])("refuses a trial of %j days", (value) => {
    setAll({ ...GOOD, STRIPE_TRIAL_DAYS: value });
    expect(missing(getCheckoutConfig)).toEqual(["STRIPE_TRIAL_DAYS"]);
  });

  it("names every setting that is missing at once", () => {
    setAll({});
    expect(missing(getCheckoutConfig).sort()).toEqual(["APP_URL", "STRIPE_PRICE_ANNUAL", "STRIPE_PRICE_MONTHLY"]);
  });

  it("refuses a price that is not a Stripe price id (a product id, for one)", () => {
    setAll({ ...GOOD, STRIPE_PRICE_MONTHLY: "prod_abc" });
    expect(missing(getCheckoutConfig)).toEqual(["STRIPE_PRICE_MONTHLY"]);
  });

  it("does not need the secret key or the webhook secret: those are asked for where they are used", () => {
    setAll({ APP_URL: GOOD.APP_URL, STRIPE_PRICE_MONTHLY: GOOD.STRIPE_PRICE_MONTHLY, STRIPE_PRICE_ANNUAL: GOOD.STRIPE_PRICE_ANNUAL });
    expect(() => getCheckoutConfig()).not.toThrow();
  });
});

describe("portal settings", () => {
  it("needs only APP_URL, and uses Stripe's default portal unless one is named", () => {
    setAll({ APP_URL: GOOD.APP_URL });
    expect(getPortalConfig()).toEqual({ appUrl: "https://app.cognicopia.org", configurationId: undefined });
    setAll({ APP_URL: GOOD.APP_URL, STRIPE_PORTAL_CONFIGURATION_ID: "bpc_123" });
    expect(getPortalConfig().configurationId).toBe("bpc_123");
  });

  it("refuses a portal configuration id that is not one", () => {
    setAll({ APP_URL: GOOD.APP_URL, STRIPE_PORTAL_CONFIGURATION_ID: "config_123" });
    expect(missing(getPortalConfig)).toEqual(["STRIPE_PORTAL_CONFIGURATION_ID"]);
  });
});
