import type { Db } from "@/lib/data/db";
import { fromDbError } from "@/lib/data/errors";
import type { Facility, FacilityRole, SubscriptionStatus } from "@/lib/db/models";

/**
 * Who is asking, and what they may do. This is the one place that answers it,
 * for pages (lib/access/guards.ts) and routes (lib/access/with-access.ts) alike.
 *
 * It asks Supabase Auth to verify the session (getUser, never the cookie's own
 * word), then reads the person's membership and facility in ONE query, as them,
 * so row level security decides what they can see.
 */

/** The parts of a facility the app shows, and bases decisions on. */
export interface FacilityBilling {
  id: string;
  facility_name: string;
  subscription_status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_interval: string | null;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean;
}

/** The billing view of a facility row, however it was read. */
export function toFacilityBilling(row: Facility): FacilityBilling {
  return {
    id: row.id,
    facility_name: row.facility_name,
    subscription_status: row.subscription_status,
    stripe_customer_id: row.stripe_customer_id,
    stripe_subscription_id: row.stripe_subscription_id,
    subscription_interval: row.subscription_interval,
    subscription_current_period_end: row.subscription_current_period_end,
    subscription_cancel_at_period_end: row.subscription_cancel_at_period_end,
  };
}

export interface Account {
  id: string;
  email: string | null;
}

export interface Membership {
  role: FacilityRole;
  facility: FacilityBilling;
}

/** `membership` is null for someone signed in who belongs to no facility yet. */
export interface AccessContext {
  user: Account;
  membership: Membership | null;
}

/** An access context whose person belongs to a facility. */
export type MemberContext = AccessContext & { membership: Membership };

const FACILITY_COLUMNS = [
  "id",
  "facility_name",
  "subscription_status",
  "stripe_customer_id",
  "stripe_subscription_id",
  "subscription_interval",
  "subscription_current_period_end",
  "subscription_cancel_at_period_end",
].join(", ");

/** Null when no one is signed in. */
export async function loadAccessContext(db: Db): Promise<AccessContext | null> {
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth.user) return null;
  const user: Account = { id: auth.user.id, email: auth.user.email ?? null };

  const { data, error } = await db
    .from("facility_users")
    .select(`role, facility:facilities(${FACILITY_COLUMNS})`)
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) return { user, membership: null };

  // One facility per account, so one object; tolerate a one-element list all the same.
  const row = data as unknown as { role: FacilityRole; facility: FacilityBilling | FacilityBilling[] | null };
  const facility = Array.isArray(row.facility) ? row.facility[0] : row.facility;
  // A membership whose facility cannot be read should not happen: treat it as no facility.
  if (!facility) return { user, membership: null };
  return { user, membership: { role: row.role, facility } };
}
