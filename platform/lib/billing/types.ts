import type { Facility } from "@/lib/db/models";

/** The part of a facility the billing code needs. */
export type BillingFacility = Pick<Facility, "id" | "facility_name" | "subscription_status" | "stripe_customer_id">;
