/* =====================================================================
   Turn a paid Stripe Checkout into a license key.

   Nothing the browser says is trusted: this asks Stripe what the session is, and only a completed, paid
   session for one of OUR two prices becomes a key. The same reference can be redeemed again later: that is
   how a monthly license is renewed. A subscription that is still current gets a key good through its
   present period; a cancelled one gets the end of the period it paid for, so nothing is owed back and
   nothing is cut short.
   ===================================================================== */
import { cleanFacilityName, signLicense, stableId } from "./token.mjs";
import { retrieveCheckoutSession } from "./stripe.mjs";

export const CHECKOUT_REFERENCE = /^cs_(?:live|test)_[A-Za-z0-9]{8,200}$/;

const DAY = 86_400_000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
/** A subscription in one of these states has paid for the period it is in. */
const PAID_STATES = new Set(["active", "trialing", "past_due", "canceled"]);

export class ServiceError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

/** The end of the period a subscription has paid for, in either shape Stripe has used for it. */
function paidThrough(sub) {
  const ends = [sub.current_period_end, ...(sub.items?.data ?? []).map((i) => i.current_period_end)].filter((e) => typeof e === "number");
  return ends.length ? Math.max(...ends) : null;
}

/** deps: { stripeKey, signingKey, prices: { monthly, annual }, fetch?, now? } */
export async function redeemCheckout(deps, reference) {
  if (!CHECKOUT_REFERENCE.test(reference)) throw new ServiceError(400, "invalid_request", "That is not a checkout reference.");
  const session = await retrieveCheckoutSession(reference, deps.stripeKey, deps.fetch);
  return licenseFromSession(deps, session);
}

/** The same step, for a session already in hand (the webhook re-reads it from Stripe first). */
export async function licenseFromSession(deps, session) {
  if (session.status !== "complete" || !(session.payment_status === "paid" || session.payment_status === "no_payment_required")) {
    throw new ServiceError(402, "not_paid", "That payment is not finished yet.");
  }
  const sub = session.subscription && typeof session.subscription === "object" ? session.subscription : null;
  const priceId = session.line_items?.data?.[0]?.price?.id ?? sub?.items?.data?.[0]?.price?.id;
  const tier = priceId && priceId === deps.prices.monthly ? "monthly_facility" : priceId && priceId === deps.prices.annual ? "annual_facility" : null;
  if (!tier) throw new ServiceError(422, "not_a_license", "That payment is not for a Cognicopia license.");

  const now = (deps.now ?? (() => new Date()))().getTime();
  let until;
  let stable;
  if (sub) {
    if (!PAID_STATES.has(sub.status)) throw new ServiceError(402, "not_paid", "That subscription is not active.");
    const end = paidThrough(sub);
    if (end === null) throw new ServiceError(502, "stripe_incomplete", "Stripe did not say when the subscription is paid through.");
    until = isoDay(end * 1000);
    stable = sub.id;
  } else if (session.mode === "payment" && tier === "annual_facility") {
    until = isoDay((session.created ?? now / 1000) * 1000 + 365 * DAY);   // a one-time yearly payment: a year from the day it was made
    stable = session.id;
  } else {
    throw new ServiceError(422, "not_a_license", "That payment is not for a Cognicopia license.");
  }

  const named = session.collected_information?.business_name
    || session.custom_fields?.find((f) => f.key === "facility_name" || f.key === "facilityname")?.text?.value
    || session.customer_details?.business_name
    || session.customer_details?.name
    || "";
  const facilityName = cleanFacilityName(named) || "Your facility";
  const id = await stableId(stable);
  const { token } = await signLicense({ facility: facilityName, tier, until, issued: isoDay(now), id }, deps.signingKey);
  return { licenseKey: token, facilityName, tier, expiresAt: until, licenseId: id };
}

/* =====================================================================
   A Net-30 invoice. A facility that pays by invoice gets its key by email too, with no one in between.

   The invoice comes from Stripe's own signed webhook (the caller has already checked the signature), so what it says is
   believed: only an invoice that is billed by email ("send_invoice", never a card checkout, which the checkout path
   above already handles) and holds exactly one of OUR two prices becomes a key. The paid-through date is the end of the
   period the invoice covers, so a yearly invoice gives a year and a renewal invoice, a year more.

   Two moments are supported, chosen by one setting (NET30_KEY_TIMING):
     with_invoice  (the default: the site tells a facility "we send the final invoice and the license key together")
                   the key goes out when the invoice is finalized, together with Stripe's invoice email
     on_payment    the key goes out when the invoice is paid (a check marked as received counts)
   ===================================================================== */
export const INVOICE_REFERENCE = /^in_[A-Za-z0-9_]{8,200}$/;

const priceIdOf = (line) => { const p = line?.pricing?.price_details?.price ?? line?.price; return typeof p === "string" ? p : p?.id ?? null; };
const subscriptionOf = (invoice) => { const s = invoice.parent?.subscription_details?.subscription ?? invoice.subscription; return typeof s === "string" ? s : s?.id ?? null; };

/** deps: { signingKey, prices: { monthly, annual }, timing?: "with_invoice" | "on_payment", now? }; `moment` is the event that arrived: "finalized" or "paid". */
export async function licenseFromInvoice(deps, invoice, moment) {
  const timing = deps.timing === "on_payment" ? "on_payment" : "with_invoice";
  if (!invoice || invoice.object !== "invoice" || invoice.collection_method !== "send_invoice") throw new ServiceError(422, "not_a_license", "That is not a Net-30 invoice.");
  if (moment !== (timing === "on_payment" ? "paid" : "finalized")) throw new ServiceError(422, "not_yet", "The key goes out at a different moment.");
  if (moment === "paid" ? invoice.status !== "paid" : !(invoice.status === "open" || invoice.status === "paid")) throw new ServiceError(402, "not_paid", "That invoice is not in the right state.");

  const lines = (invoice.lines?.data ?? []).filter((l) => { const id = priceIdOf(l); return id && (id === deps.prices.monthly || id === deps.prices.annual); });
  if (lines.length === 0) throw new ServiceError(422, "not_a_license", "That invoice is not for a Cognicopia license.");
  if (lines.length !== 1 || (lines[0].quantity ?? 1) !== 1) throw new ServiceError(422, "needs_a_person", "That invoice is for more than one license; a person makes those keys.");
  const line = lines[0];
  const tier = priceIdOf(line) === deps.prices.monthly ? "monthly_facility" : "annual_facility";

  const now = (deps.now ?? (() => new Date()))().getTime();
  const start = line.period?.start, end = line.period?.end;
  let untilMs;
  if (typeof end === "number" && typeof start === "number" && end > start) untilMs = end * 1000;
  else if (tier === "annual_facility") untilMs = ((invoice.created ?? now / 1000) * 1000) + 365 * DAY;     // an invoice with no period: a year from the day it was made
  else throw new ServiceError(422, "needs_a_person", "That monthly invoice does not say which month it covers.");

  const facilityName = cleanFacilityName(invoice.customer_name) || "Your facility";
  const id = await stableId(subscriptionOf(invoice) || invoice.customer || invoice.id);
  const until = isoDay(untilMs);
  const { token } = await signLicense({ facility: facilityName, tier, until, issued: isoDay(now), id }, deps.signingKey);
  return { licenseKey: token, facilityName, tier, expiresAt: until, licenseId: id };
}
