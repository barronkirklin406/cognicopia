import type { Db } from "@/lib/data/db";
import type { StripeApi } from "./stripe";
import { reconcileCustomer, type ReconcileOutcome } from "./sync";

/**
 * What to do with an event from Stripe.
 *
 * Subscribe the webhook endpoint to exactly these events (documented in
 * .env.example and platform/README.md). Anything else that arrives is
 * acknowledged and ignored, so an endpoint set to "all events" does no harm.
 *
 *   customer.subscription.updated  a status, plan or card changed (this is also how a
 *                                   past-due subscription becomes active again)
 *   customer.subscription.deleted  the subscription ended
 *   invoice.payment_failed         a payment failed
 *   customer.subscription.created  a subscription began
 *   checkout.session.completed     a customer finished Checkout (so access starts at once)
 *
 * Each one only tells us WHICH CUSTOMER to look at. The state itself is read from
 * Stripe (see sync.ts), so the events' payloads, their order and the API version
 * of the endpoint do not matter.
 */
export const HANDLED_EVENT_TYPES = [
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
  "customer.subscription.created",
  "checkout.session.completed",
] as const;

/** The parts of a Stripe event this code reads. A Stripe.Event fits. */
export interface EventLike {
  id?: string;
  type: string;
  data: { object: unknown };
}

export type WebhookOutcome = ReconcileOutcome | "ignored";

/** A Stripe expandable field: the id, or the object with an id. */
function idOf(value: unknown): string | null {
  if (typeof value === "string" && value !== "") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    const id = (value as { id: unknown }).id;
    if (typeof id === "string" && id !== "") return id;
  }
  return null;
}

/** The Stripe customer an event is about, or null when it is not about a subscription. */
export function customerIdOf(event: EventLike): string | null {
  const object = (event.data?.object ?? null) as { customer?: unknown; mode?: unknown } | null;
  if (!object || typeof object !== "object") return null;
  switch (event.type) {
    case "checkout.session.completed":
      return object.mode === "subscription" ? idOf(object.customer) : null; // a one-off payment is not ours
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "invoice.payment_failed":
      return idOf(object.customer);
    default:
      return null;
  }
}

export async function handleStripeEvent(
  deps: { stripe: Pick<StripeApi, "subscriptions">; admin: Db; now?: () => Date },
  event: EventLike,
): Promise<WebhookOutcome> {
  if (!(HANDLED_EVENT_TYPES as readonly string[]).includes(event.type)) return "ignored";
  const customerId = customerIdOf(event);
  if (!customerId) return "ignored";
  return reconcileCustomer(deps, customerId);
}
