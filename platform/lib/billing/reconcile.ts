import { getFacilityAsServer } from "@/lib/data/billing";
import type { Db } from "@/lib/data/db";
import type { Facility } from "@/lib/db/models";
import type { StripeApi } from "./stripe";
import { reconcileCustomer, type ReconcileOutcome } from "./sync";
import type { BillingFacility } from "./types";

/**
 * Re-check one facility against Stripe now, without waiting for a webhook.
 *
 * Used when an admin comes back from Checkout or from the billing portal, and by
 * the "Check my payment status" button. Paying is the moment people least want to
 * wait, and a webhook can be seconds late, or missing if it was set up wrongly;
 * this makes the page right on the spot. It is the same call the webhook makes,
 * so it cannot disagree with it.
 */
export async function reconcileFacility(
  deps: { stripe: Pick<StripeApi, "subscriptions">; admin: Db; now?: () => Date },
  facility: Pick<BillingFacility, "stripe_customer_id">,
): Promise<ReconcileOutcome> {
  if (!facility.stripe_customer_id) return "none";
  return reconcileCustomer(deps, facility.stripe_customer_id);
}

/**
 * reconcileFacility, then the facility as the server now reads it: what a page needs
 * to show the person the result of what it has just done.
 *
 * The read-back uses the server's own client on purpose. A page has usually already asked
 * for the signed-in person's view of their facility, and asking again as the person would
 * send the very same request. Next.js shares the answer to a repeated GET within one
 * render, so the page would be handed the status it started with, however fresh the
 * database is. A different request gets a fresh answer. It is safe for the server to read
 * this row: the caller has already shown that the person is an admin of this facility.
 */
export async function reconcileAndReload(
  deps: { stripe: Pick<StripeApi, "subscriptions">; admin: Db; now?: () => Date },
  facility: Pick<BillingFacility, "id" | "stripe_customer_id">,
): Promise<{ outcome: ReconcileOutcome; facility: Facility | null }> {
  const outcome = await reconcileFacility(deps, facility);
  return { outcome, facility: await getFacilityAsServer(deps.admin, facility.id) };
}
