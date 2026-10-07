import type { Facility, SubscriptionStatus } from "@/lib/db/models";
import type { Db } from "./db";
import { DataError, fromDbError } from "./errors";

/**
 * What the server records about a facility's billing. Every function here takes
 * the SERVICE ROLE client (lib/supabase/admin.ts): billing columns belong to the
 * server, and no signed-in user may write them. The caller has already decided
 * who is asking and what they may do.
 */

/** A facility, read as the server: fresh, whatever any user may see. Null if there is none. */
export async function getFacilityAsServer(admin: Db, facilityId: string): Promise<Facility | null> {
  const { data, error } = await admin.from("facilities").select("*").eq("id", facilityId).maybeSingle();
  if (error) throw fromDbError(error);
  return data;
}

/**
 * Record a facility's Stripe customer id, if it has none yet. Returns true when
 * this call set it, false when one was already there (another request won the
 * race, or it was set before). A customer id already on a different facility is
 * a 409: one Stripe customer belongs to one facility.
 */
export async function setStripeCustomerId(admin: Db, facilityId: string, customerId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("facilities")
    .update({ stripe_customer_id: customerId })
    .eq("id", facilityId)
    .is("stripe_customer_id", null)
    .select("id");
  if (error) throw fromDbError(error);
  return data.length > 0;
}

/** One observation of a facility's Stripe subscription. */
export interface SubscriptionSnapshot {
  customerId: string;
  subscriptionId: string;
  status: SubscriptionStatus;
  /** 'month' or 'year'; null for any other interval. */
  interval: "month" | "year" | null;
  /** ISO timestamp, or null when Stripe gave none. */
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** ISO timestamp noted BEFORE Stripe was asked: an older observation never replaces a newer one. */
  observedAt: string;
}

export type ApplyOutcome = "applied" | "stale" | "unlinked";

/**
 * Record a snapshot, through apply_stripe_subscription() (migration 4), which
 * finds the facility by its Stripe customer and refuses to go backwards.
 */
export async function applySubscriptionSnapshot(admin: Db, snapshot: SubscriptionSnapshot): Promise<ApplyOutcome> {
  const { data, error } = await admin.rpc("apply_stripe_subscription", {
    p_customer_id: snapshot.customerId,
    p_observed_at: snapshot.observedAt,
    p_subscription_id: snapshot.subscriptionId,
    p_status: snapshot.status,
    ...(snapshot.interval ? { p_interval: snapshot.interval } : {}),
    ...(snapshot.currentPeriodEnd ? { p_current_period_end: snapshot.currentPeriodEnd } : {}),
    p_cancel_at_period_end: snapshot.cancelAtPeriodEnd,
  });
  if (error) throw fromDbError(error);
  if (data === "applied" || data === "stale" || data === "unlinked") return data;
  throw new DataError(500, "internal", "Something went wrong.");
}
