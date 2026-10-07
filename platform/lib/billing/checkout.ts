import type { Db } from "@/lib/data/db";
import { DataError } from "@/lib/data/errors";
import { PLANS, type PlanId } from "@/lib/domain/plans";
import { canStartCheckout } from "@/lib/domain/subscription";
import type { CheckoutConfig } from "@/lib/env.server";
import { ensureStripeCustomer } from "./customer";
import type { StripeApi } from "./stripe";
import type { BillingFacility } from "./types";

/**
 * Start a Stripe Checkout session for a facility's subscription, and return
 * the address to send the admin to.
 *
 * A facility that already has a live subscription is refused (409): a second
 * would bill it twice. It changes plan, updates its card or cancels in the
 * billing portal instead. The plan is chosen by name; its price id comes from
 * the server's settings, so a caller cannot ask for any other price.
 *
 * The session carries the facility's id, on the session and on the subscription,
 * and the customer is the facility's own. The webhook and the "check my payment"
 * button find the facility from that.
 */
export async function createCheckoutSession(
  deps: { stripe: StripeApi; admin: Db; config: CheckoutConfig },
  input: { facility: BillingFacility; adminEmail: string | null; plan: PlanId },
): Promise<{ url: string }> {
  const { stripe, admin, config } = deps;
  const { facility, adminEmail, plan } = input;

  if (!canStartCheckout(facility.subscription_status)) {
    throw new DataError(
      409,
      "already_subscribed",
      "Your facility already has a subscription. Use the billing portal to change it or to update your payment method.",
    );
  }
  if (!PLANS.some((p) => p.id === plan)) throw new DataError(422, "invalid", "Choose a plan: monthly or annual.");

  const customer = await ensureStripeCustomer({ stripe, admin, facility, email: adminEmail });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: facility.id,
    line_items: [{ price: config.prices[plan], quantity: 1 }],
    allow_promotion_codes: true,
    metadata: { facility_id: facility.id, plan },
    subscription_data: {
      metadata: { facility_id: facility.id, plan },
      ...(config.trialDays ? { trial_period_days: config.trialDays } : {}),
    },
    success_url: `${config.appUrl}/admin/billing?checkout=success`,
    cancel_url: `${config.appUrl}/admin/billing?checkout=canceled`,
  });

  if (!session.url) throw new DataError(502, "billing_error", "We could not start checkout. Please try again.");
  return { url: session.url };
}
