import { describe, expect, it } from "vitest";
import { ConfigError, fromStripeError, isStripeError } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/http";

describe("ConfigError", () => {
  it("names the variables and says where to look, and carries no value", () => {
    const error = new ConfigError(["STRIPE_SECRET_KEY", "APP_URL"]);
    expect(error.message).toBe("Missing or invalid environment variable(s): STRIPE_SECRET_KEY, APP_URL. See .env.example.");
    expect(error.missing).toEqual(["STRIPE_SECRET_KEY", "APP_URL"]);
    expect(error.name).toBe("ConfigError");
  });
});

describe("isStripeError", () => {
  it("recognises what Stripe's library throws, by its type string", () => {
    for (const type of ["StripeError", "StripeCardError", "StripeInvalidRequestError", "StripeAPIError", "StripeConnectionError", "StripeSignatureVerificationError"]) {
      expect(isStripeError(Object.assign(new Error("x"), { type })), type).toBe(true);
    }
  });

  it.each([null, undefined, "StripeError", 42, new Error("plain"), { type: 7 }, { type: "NotStripe" }, { type: "" }])("does not mistake %j for one", (value) => {
    expect(isStripeError(value)).toBe(false);
  });
});

describe("fromStripeError", () => {
  it.each([
    ["StripeRateLimitError", 429, "rate_limited"],
    ["RateLimitError", 429, "rate_limited"],
    ["StripeConnectionError", 503, "billing_unavailable"],
    ["StripeAuthenticationError", 502, "billing_misconfigured"],
    ["StripePermissionError", 502, "billing_misconfigured"],
    ["StripeInvalidRequestError", 502, "billing_error"],
    ["StripeAPIError", 502, "billing_error"],
    ["StripeCardError", 502, "billing_error"],
    ["StripeIdempotencyError", 502, "billing_error"],
  ])("%s -> %i %s", (type, status, code) => {
    const mapped = fromStripeError({ type });
    expect([mapped.status, mapped.code]).toEqual([status, code]);
    expect(mapped.message.length).toBeGreaterThan(10);
  });

  it("never repeats what Stripe said", () => {
    const mapped = fromStripeError(Object.assign(new Error("No such customer: 'cus_123' for key sk_live_abc"), { type: "StripeInvalidRequestError" }));
    expect(mapped.message).not.toMatch(/cus_123|sk_live/);
  });
});

describe("assertSameOrigin", () => {
  const req = (headers: Record<string, string>, url = "https://app.example/api/x") => new Request(url, { method: "POST", headers });

  it("lets through a request from the same site", () => {
    expect(() => assertSameOrigin(req({ origin: "https://app.example" }))).not.toThrow();
    expect(() => assertSameOrigin(req({ origin: "http://localhost:3000" }, "http://localhost:3000/api/x"))).not.toThrow();
  });

  it("lets through a request with no Origin: not a browser being tricked", () => {
    expect(() => assertSameOrigin(req({}))).not.toThrow();
  });

  it.each(["https://evil.example", "https://app.example.evil.example", "http://app.example.evil.com", "null", "not a url", "", "https://app.example:8443"])(
    "refuses Origin %j",
    (origin) => {
      expect(() => assertSameOrigin(req({ origin }))).toThrow(/another site/);
    },
  );

  it("judges by the host the browser used behind a proxy", () => {
    expect(() => assertSameOrigin(req({ origin: "https://app.cognicopia.org", "x-forwarded-host": "app.cognicopia.org" }))).not.toThrow();
    expect(() => assertSameOrigin(req({ origin: "https://evil.example", "x-forwarded-host": "app.cognicopia.org" }))).toThrow();
  });

  it("answers 403 forbidden_origin", () => {
    try {
      assertSameOrigin(req({ origin: "https://evil.example" }));
    } catch (error) {
      expect(error).toMatchObject({ status: 403, code: "forbidden_origin" });
      return;
    }
    throw new Error("expected a refusal");
  });
});
