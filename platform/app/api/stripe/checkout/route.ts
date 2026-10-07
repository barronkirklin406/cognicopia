import { NextResponse } from "next/server";
import { z } from "zod";
import { withAccess } from "@/lib/access/with-access";
import { createCheckoutSession } from "@/lib/billing/checkout";
import { getStripe } from "@/lib/billing/stripe";
import { PlanSchema } from "@/lib/domain/plans";
import { getCheckoutConfig } from "@/lib/env.server";
import { issuesOf, problem, readJson } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const Body = z.object({ plan: PlanSchema });

/**
 * POST /api/stripe/checkout  { "plan": "monthly" | "annual" }
 * -> { "url": "https://checkout.stripe.com/..." }
 *
 * Admins only (an Activity Director): staff cannot start or change billing.
 * Starts a Stripe Checkout session for the facility's subscription. The browser
 * names a plan; the price comes from the server's settings. A facility that
 * already has a subscription gets 409 and is pointed at the billing portal.
 */
export const POST = withAccess({ admin: true }, async ({ request, user, membership }) => {
  const body = Body.safeParse(await readJson(request));
  if (!body.success) return problem(422, "invalid", "Choose a plan: monthly or annual.", issuesOf(body.error));

  const { url } = await createCheckoutSession(
    { stripe: getStripe(), admin: createAdminClient(), config: getCheckoutConfig() },
    { facility: membership.facility, adminEmail: user.email, plan: body.data.plan },
  );
  return NextResponse.json({ url });
});
