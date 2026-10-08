import { NextResponse } from "next/server";
import { getStripe } from "@/lib/billing/stripe";
import { handleStripeEvent } from "@/lib/billing/webhook";
import { getWebhookSecret } from "@/lib/env.server";
import { handleError, problem } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/webhook : Stripe tells us a customer's subscription changed.
 *
 * Nothing here is trusted until its signature is checked against the endpoint's
 * signing secret (STRIPE_WEBHOOK_SECRET), over the exact bytes Stripe sent: so the
 * body is read as text, never parsed first. A wrong or missing signature, or one
 * more than five minutes old, is a 400 and nothing else happens.
 *
 * Once verified, the event only names a customer. The facility's billing is then
 * brought in line with what Stripe says now (lib/billing/sync.ts), so late,
 * repeated or out-of-order events all lead to the same result. The answer is 200
 * for an event handled or deliberately ignored, and 500 when Stripe or the
 * database failed: Stripe retries a failed delivery for days.
 *
 * It is outside the sign-in proxy on purpose: Stripe has no session.
 */
export async function POST(request: Request) {
  try {
    const secret = getWebhookSecret();
    const stripe = getStripe();

    const signature = request.headers.get("stripe-signature");
    if (!signature) return problem(400, "missing_signature", "The request is not signed.");

    const payload = await request.text();
    let event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, secret);
    } catch {
      return problem(400, "invalid_signature", "The signature could not be verified.");
    }

    const outcome = await handleStripeEvent({ stripe, admin: createAdminClient() }, event);
    if (outcome === "unlinked") console.warn("[stripe] event for a customer no facility has:", event.id, event.type);
    return NextResponse.json({ received: true, outcome });
  } catch (error) {
    return handleError(error);
  }
}
