import { NextResponse } from "next/server";
import { withAccess } from "@/lib/access/with-access";
import { getStripe } from "@/lib/billing/stripe";
import { createPortalSession } from "@/lib/billing/portal";
import { getPortalConfig } from "@/lib/env.server";

export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/portal   (send an empty JSON object: {})
 * -> { "url": "https://billing.stripe.com/..." }
 *
 * Admins only. A one-time address for the Stripe billing portal, where the
 * admin updates the card, reads invoices, changes plan or cancels. Works for a
 * lapsed facility too: that is how a past-due payment is put right. A facility
 * with no billing account yet gets 409 (choose a plan first).
 */
export const POST = withAccess({ admin: true }, async ({ membership }) => {
  const { url } = await createPortalSession(
    { stripe: getStripe(), config: getPortalConfig() },
    { facility: membership.facility },
  );
  return NextResponse.json({ url });
});
