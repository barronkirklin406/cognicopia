import { DataError } from "@/lib/data/errors";
import type { PortalConfig } from "@/lib/env.server";
import type { StripeApi } from "./stripe";
import type { BillingFacility } from "./types";

/**
 * A Stripe billing portal session for the facility, and the address to send
 * the admin to. In the portal they update their card, read invoices, change plan
 * or cancel; Stripe tells the webhook what they did. The address works once and
 * soon expires, so it is made when the admin clicks, never stored.
 *
 * A facility with no Stripe customer has nothing to manage yet (409): it needs
 * to choose a plan first.
 */
export async function createPortalSession(
  deps: { stripe: StripeApi; config: PortalConfig },
  input: { facility: BillingFacility },
): Promise<{ url: string }> {
  const { stripe, config } = deps;
  const customer = input.facility.stripe_customer_id;
  if (!customer) throw new DataError(409, "no_billing_account", "There is no billing account yet. Choose a plan first.");

  const session = await stripe.billingPortal.sessions.create({
    customer,
    return_url: `${config.appUrl}/admin/billing?portal=return`,
    ...(config.configurationId ? { configuration: config.configurationId } : {}),
  });
  return { url: session.url };
}
