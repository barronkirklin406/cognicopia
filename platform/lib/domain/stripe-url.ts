/**
 * Is this an address on Stripe, over https? The billing buttons send the person
 * to whatever address our own API returns, and this is the last check before they
 * go: never anywhere but Stripe.
 */
export function isStripeUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "stripe.com" || url.hostname.endsWith(".stripe.com")) && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}
