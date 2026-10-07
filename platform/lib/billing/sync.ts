import { applySubscriptionSnapshot, type ApplyOutcome, type SubscriptionSnapshot } from "@/lib/data/billing";
import type { Db } from "@/lib/data/db";
import { SUBSCRIPTION_STATUSES, type SubscriptionStatus } from "@/lib/db/models";
import type { StripeApi } from "./stripe";

/**
 * Bringing a facility's billing in line with Stripe.
 *
 * The approach is the one Stripe recommends: do not reason about the order of
 * events, ask Stripe what is true. Whatever happened (a payment failed, a card
 * was updated, a plan ended), the answer is the same call: list the customer's
 * subscriptions, pick the one that counts, and record that. Events only say
 * "something changed for this customer". That makes the result the same however
 * late, doubled or out of order events arrive.
 *
 * The time is noted BEFORE Stripe is asked, and recorded with the answer; the
 * database never replaces a newer observation with an older one
 * (apply_stripe_subscription, migration 4).
 */

/** The parts of a Stripe subscription this code reads. A Stripe.Subscription fits. */
export interface SubscriptionLike {
  id: string;
  status: string;
  created: number;
  customer: string | { id: string };
  cancel_at_period_end: boolean;
  items: { data: Array<{ current_period_end?: number; price?: { recurring?: { interval?: string } | null } }> };
}

/**
 * Which subscription counts when a customer has several (an old one ended, a
 * new one started). A subscription that grants access beats one in trouble,
 * which beats one not yet paid for, which beats one that has ended; the newest wins a tie.
 */
const RANK: Record<SubscriptionStatus, number> = {
  active: 4,
  trialing: 4,
  past_due: 3,
  unpaid: 3,
  paused: 3,
  incomplete: 2,
  canceled: 1,
  incomplete_expired: 1,
};

/** A status Stripe may add one day is treated as 'unpaid': an unknown state must not open the premium tools. */
export function normalizeStatus(status: string): SubscriptionStatus {
  if ((SUBSCRIPTION_STATUSES as readonly string[]).includes(status)) return status as SubscriptionStatus;
  console.warn("[billing] unknown subscription status from Stripe:", status);
  return "unpaid";
}

export function pickSubscription<T extends { status: string; created: number }>(subscriptions: readonly T[]): T | null {
  let best: T | null = null;
  for (const sub of subscriptions) {
    if (!best) {
      best = sub;
      continue;
    }
    const a = RANK[normalizeStatus(sub.status)];
    const b = RANK[normalizeStatus(best.status)];
    if (a > b || (a === b && sub.created > best.created)) best = sub;
  }
  return best;
}

export function toSnapshot(sub: SubscriptionLike, observedAt: string): SubscriptionSnapshot {
  const items = sub.items?.data ?? [];
  const ends = items.map((item) => item.current_period_end).filter((end): end is number => typeof end === "number");
  const interval = items[0]?.price?.recurring?.interval;
  return {
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    subscriptionId: sub.id,
    status: normalizeStatus(sub.status),
    interval: interval === "month" || interval === "year" ? interval : null,
    currentPeriodEnd: ends.length > 0 ? new Date(Math.min(...ends) * 1000).toISOString() : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end === true,
    observedAt,
  };
}

export type ReconcileOutcome = ApplyOutcome | "none";

/**
 * Look at Stripe, and record what it says about this customer. 'none' means the
 * customer has no subscriptions at all, so there is nothing to record.
 */
export async function reconcileCustomer(
  deps: { stripe: Pick<StripeApi, "subscriptions">; admin: Db; now?: () => Date },
  customerId: string,
): Promise<ReconcileOutcome> {
  const observedAt = (deps.now ?? (() => new Date()))().toISOString(); // before asking, on purpose
  const list = await deps.stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
  const best = pickSubscription(list.data);
  if (!best) return "none";
  return applySubscriptionSnapshot(deps.admin, toSnapshot(best, observedAt));
}
