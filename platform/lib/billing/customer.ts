import { createHash } from "node:crypto";
import { getFacilityAsServer, setStripeCustomerId } from "@/lib/data/billing";
import type { Db } from "@/lib/data/db";
import type { StripeApi } from "./stripe";
import type { BillingFacility } from "./types";

/**
 * The facility's Stripe customer id, making the customer if there is none yet.
 *
 * Two requests can arrive together (a double click). Stripe is asked with an
 * idempotency key made from the facility and the details sent, so both get the
 * same customer back; the database keeps whichever id was written first. The
 * customer holds the facility's name and the admin's email as the billing
 * contact, and the facility's id in its metadata. Nothing about a resident.
 */
export async function ensureStripeCustomer(input: {
  stripe: StripeApi;
  admin: Db;
  facility: BillingFacility;
  email: string | null;
}): Promise<string> {
  const { stripe, admin, facility, email } = input;
  if (facility.stripe_customer_id) return facility.stripe_customer_id;

  const details = { name: facility.facility_name, ...(email ? { email } : {}) };
  const fingerprint = createHash("sha256").update(JSON.stringify([facility.id, details])).digest("hex").slice(0, 24);

  const customer = await stripe.customers.create(
    { ...details, metadata: { facility_id: facility.id } },
    { idempotencyKey: `cognicopia-customer-${fingerprint}` },
  );

  await setStripeCustomerId(admin, facility.id, customer.id);
  // If another request got there first, its id is the one on record.
  const stored = await getFacilityAsServer(admin, facility.id);
  return stored?.stripe_customer_id ?? customer.id;
}
