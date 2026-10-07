import { describe, expect, it } from "vitest";
import { isStripeUrl } from "@/lib/domain/stripe-url";

/** The last check before the browser leaves for Stripe: only ever Stripe, and only over https. */
describe("isStripeUrl", () => {
  it.each([
    "https://checkout.stripe.com/c/pay/cs_test_a1B2c3",
    "https://billing.stripe.com/p/session/test_abc",
    "https://stripe.com/",
    "https://pay.stripe.com/receipts/x",
  ])("follows %s", (url) => {
    expect(isStripeUrl(url)).toBe(true);
  });

  it.each([
    ["another site", "https://example.com/checkout"],
    ["plain http", "http://checkout.stripe.com/c/pay/x"],
    ["a look-alike that merely ends the same", "https://evilstripe.com/"],
    ["stripe.com as a subdomain of someone else", "https://checkout.stripe.com.evil.test/"],
    ["stripe.com as the user name", "https://checkout.stripe.com@evil.test/"],
    ["credentials in the address", "https://user:secret@checkout.stripe.com/"],
    ["a script", "javascript:alert(1)"],
    ["a protocol-relative address", "//checkout.stripe.com/"],
    ["a relative path", "/c/pay/x"],
    ["a data address", "data:text/html,<p>hi</p>"],
    ["not an address", "not an address"],
    ["an empty string", ""],
  ])("refuses %s", (_label, url) => {
    expect(isStripeUrl(url)).toBe(false);
  });

  it.each([undefined, null, 7, {}, ["https://checkout.stripe.com/"], true])("refuses a value that is not a string: %j", (value) => {
    expect(isStripeUrl(value)).toBe(false);
  });
});
