import "server-only";
import crypto from "node:crypto";
import { DataError } from "@/lib/data/errors";
import { isStripeError } from "@/lib/errors";
import { cleanFacilityName, signLicense, type LicenseTier } from "./token";

/**
 * Turn a paid Stripe Checkout into a license key.
 *
 * The static site's activate.html sends the checkout reference from the address Stripe returned the buyer
 * to (cs_live_...). Nothing the browser says is trusted: this asks Stripe what that session is, and only
 * a completed, paid session for one of OUR two prices becomes a key. The reference is a bearer secret known
 * to the buyer, so the route also limits how fast it can be tried (app/api/licenses/redeem/route.ts).
 *
 * The same reference can be redeemed again later: that is how a monthly license is renewed. A subscription
 * that is still current gets a key good through its present period; a cancelled one gets the end of the
 * period it paid for, so nothing is owed back and nothing is cut short.
 *
 * Takes only what it uses (a narrow Stripe slice), so tests can use a stand-in and never reach the network.
 */
export const CHECKOUT_REFERENCE = /^cs_(?:live|test)_[A-Za-z0-9]{8,200}$/;

interface PriceLike { id?: string }
interface SubscriptionLike {
  id: string;
  status: string;
  items?: { data?: Array<{ current_period_end?: number; price?: PriceLike }> };
}
export interface CheckoutSessionLike {
  id: string;
  mode?: string;
  status?: string | null;
  payment_status?: string;
  created?: number;
  /** Names a Payment Link collected (name_collection): where a business name lands. */
  collected_information?: { business_name?: string | null; individual_name?: string | null } | null;
  customer_details?: { name?: string | null; business_name?: string | null } | null;
  custom_fields?: Array<{ key?: string; text?: { value?: string | null } | null }> | null;
  subscription?: string | SubscriptionLike | null;
  line_items?: { data?: Array<{ price?: PriceLike }> } | null;
}
export interface RedeemDeps {
  stripe: { checkout: { sessions: { retrieve(id: string, params?: { expand?: string[] }): Promise<CheckoutSessionLike> } } };
  /** The private key (PEM) that signs keys. */
  signingKey: string;
  /** The Stripe price id of each plan (STRIPE_PRICE_MONTHLY, STRIPE_PRICE_ANNUAL). */
  prices: { monthly: string; annual: string };
  now?: () => Date;
}
export interface Redeemed {
  licenseKey: string;
  facilityName: string;
  tier: LicenseTier;
  expiresAt: string;
}

const DAY = 86_400_000;
const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
/** A subscription in one of these states has paid for the period it is in. */
const PAID_STATES = new Set(["active", "trialing", "past_due", "canceled"]);

export async function redeemCheckout(deps: RedeemDeps, reference: string): Promise<Redeemed> {
  if (!CHECKOUT_REFERENCE.test(reference)) throw new DataError(400, "invalid_request", "That is not a checkout reference.");
  let session: CheckoutSessionLike;
  try {
    session = await deps.stripe.checkout.sessions.retrieve(reference, { expand: ["subscription", "line_items"] });
  } catch (error) {
    if (isStripeError(error) && error.code === "resource_missing") throw new DataError(404, "not_found", "No payment was found for that reference.");
    throw error;
  }

  if (session.status !== "complete" || !(session.payment_status === "paid" || session.payment_status === "no_payment_required")) {
    throw new DataError(402, "not_paid", "That payment is not finished yet.");
  }

  const priceId = session.line_items?.data?.[0]?.price?.id ?? (typeof session.subscription === "object" && session.subscription ? session.subscription.items?.data?.[0]?.price?.id : undefined);
  const tier: LicenseTier | null = priceId === deps.prices.monthly ? "monthly_facility" : priceId === deps.prices.annual ? "annual_facility" : null;
  if (!tier) throw new DataError(422, "not_a_license", "That payment is not for a Cognicopia license.");

  const now = (deps.now ?? (() => new Date()))().getTime();
  let until: string;
  let stable: string;
  const sub = typeof session.subscription === "object" ? session.subscription : null;
  if (sub) {
    if (!PAID_STATES.has(sub.status)) throw new DataError(402, "not_paid", "That subscription is not active.");
    const ends = (sub.items?.data ?? []).map((item) => item.current_period_end).filter((end): end is number => typeof end === "number");
    if (ends.length === 0) throw new DataError(502, "stripe_incomplete", "Stripe did not say when the subscription is paid through.");
    until = isoDay(Math.max(...ends) * 1000);
    stable = sub.id;
  } else if (session.mode === "payment" && tier === "annual_facility") {
    // a one-time yearly payment: paid through a year from the day it was made
    until = isoDay(((session.created ?? now / 1000) * 1000) + 365 * DAY);
    stable = session.id;
  } else {
    throw new DataError(422, "not_a_license", "That payment is not for a Cognicopia license.");
  }

  const named = session.collected_information?.business_name
    || session.custom_fields?.find((f) => f.key === "facility_name" || f.key === "facilityname")?.text?.value
    || session.customer_details?.business_name
    || session.customer_details?.name
    || "";
  const facilityName = cleanFacilityName(String(named)) || "Your facility";

  // The same purchase always gets the same license id, so withdrawing it later withdraws every renewal too.
  const id = "lic_" + crypto.createHash("sha256").update(stable).digest("hex").slice(0, 16);
  const { token } = signLicense({ facility: facilityName, tier, until, issued: isoDay(now), id }, deps.signingKey);
  return { licenseKey: token, facilityName, tier, expiresAt: until };
}
