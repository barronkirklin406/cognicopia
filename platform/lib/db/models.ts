/**
 * The application's names for what is in the database.
 *
 * database.types.ts is the schema as Supabase sees it and can be regenerated.
 * This file is ours: friendly row types, the enum values as runtime lists, and
 * the JSON columns given the shapes the rest of the code relies on.
 *
 * ZERO PHI: there is no resident type, and no table or column for one.
 */

import type { CalendarData } from "@/lib/domain/calendar";
import type { ContentPayload } from "@/lib/domain/content";
import { Constants, type Database, type Enums, type Tables } from "./database.types";

// ---------------------------------------------------------------------
// Rows, as the database returns them
// ---------------------------------------------------------------------

export type Facility = Tables<"facilities">;
export type FacilityUser = Tables<"facility_users">;
export type FacilityInviteRow = Tables<"facility_invites">;
export type ContentItemRow = Tables<"content_items">;
export type ActivityCalendarRow = Tables<"activity_calendars">;

// ---------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------

export type SubscriptionStatus = Enums<"subscription_status">;
export type FacilityRole = Enums<"facility_role">;
export type DementiaStage = Enums<"dementia_stage">;

export const SUBSCRIPTION_STATUSES = Constants.public.Enums.subscription_status;
export const FACILITY_ROLES = Constants.public.Enums.facility_role;
export const DEMENTIA_STAGES = Constants.public.Enums.dementia_stage;

// ---------------------------------------------------------------------
// The JSON columns, with their shapes
// ---------------------------------------------------------------------
// The database holds JSON of any shape; the application only ever writes the
// shapes in lib/domain, and reads them back through the parsers there.

/** A content item with its payload typed. */
export type ContentItem = Omit<ContentItemRow, "content_payload"> & { content_payload: ContentPayload };

/** A calendar row with its data typed. */
export type ActivityCalendar = Omit<ActivityCalendarRow, "generated_data"> & { generated_data: CalendarData };

// ---------------------------------------------------------------------
// What a tenant may write (the database enforces the same limits)
// ---------------------------------------------------------------------

/** A facility may change its name, and nothing else: billing columns belong to the server. */
export type FacilityPatch = Pick<Database["public"]["Tables"]["facilities"]["Update"], "facility_name">;

/** An admin may change a member's role, and nothing else about them. */
export type FacilityUserPatch = Pick<Database["public"]["Tables"]["facility_users"]["Update"], "role">;

/** A new or replaced calendar. The facility is the caller's own; row level security makes sure. */
export interface CalendarInput {
  facility_id: string;
  month_year: string;
  generated_data: CalendarData;
}

// ---------------------------------------------------------------------
// Column lists, checked against the real database
// ---------------------------------------------------------------------
// `satisfies` makes the compiler insist that each list names every column of
// the row type, and no other. tests/db/types-parity.test.ts then compares these
// lists with the columns of the migrated database. A migration that adds a
// column fails the build here, and then the test, until the types are updated.

type TableName = keyof Database["public"]["Tables"];

export const COLUMNS = {
  facilities: {
    id: true,
    facility_name: true,
    subscription_status: true,
    stripe_customer_id: true,
    stripe_subscription_id: true,
    subscription_interval: true,
    subscription_current_period_end: true,
    subscription_cancel_at_period_end: true,
    subscription_synced_at: true,
    created_at: true,
  },
  facility_users: { id: true, facility_id: true, email: true, role: true, created_at: true },
  facility_invites: {
    id: true,
    facility_id: true,
    token_hash: true,
    email: true,
    role: true,
    created_by: true,
    created_at: true,
    expires_at: true,
    accepted_at: true,
    accepted_by: true,
  },
  content_items: { id: true, title: true, category: true, dementia_stage: true, content_payload: true, created_at: true },
  activity_calendars: { id: true, facility_id: true, month_year: true, generated_data: true, created_at: true },
} as const satisfies { [T in TableName]: Record<keyof Tables<T>, true> };
