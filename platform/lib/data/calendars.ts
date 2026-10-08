import { CalendarDataSchema } from "@/lib/domain/calendar";
import type { ActivityCalendar, ActivityCalendarRow, CalendarInput } from "@/lib/db/models";
import type { Db } from "./db";
import { DataError, fromDbError } from "./errors";

/** Read a stored row back with its data checked against the schema it was written under. */
function toCalendar(row: ActivityCalendarRow): ActivityCalendar {
  const parsed = CalendarDataSchema.safeParse(row.generated_data);
  if (!parsed.success) throw new DataError(500, "stored_data_invalid", "The saved calendar could not be read.");
  return { ...row, generated_data: parsed.data };
}

/** The caller's facility's calendar for a month ('YYYY-MM'), or null. Row level security supplies the facility. */
export async function getCalendar(db: Db, month: string): Promise<ActivityCalendar | null> {
  const { data, error } = await db.from("activity_calendars").select("*").eq("month_year", month).maybeSingle();
  if (error) throw fromDbError(error);
  return data ? toCalendar(data) : null;
}

/** The facility's calendars for several months at once ('YYYY-MM' each), keyed by month. Months with no calendar are missing. */
export async function getCalendarsForMonths(db: Db, months: readonly string[]): Promise<Map<string, ActivityCalendar>> {
  const unique = [...new Set(months)].slice(0, 36);
  if (unique.length === 0) return new Map();
  const { data, error } = await db.from("activity_calendars").select("*").in("month_year", unique);
  if (error) throw fromDbError(error);
  return new Map(data.map((row) => [row.month_year, toCalendar(row)]));
}

/**
 * Save a calendar, replacing any that exists for the facility and month.
 * `input.generated_data` must already have passed parseCalendarData(). The
 * database checks again, for resident-looking keys, size and depth.
 */
export async function saveCalendar(db: Db, input: CalendarInput): Promise<ActivityCalendar> {
  const { data, error } = await db
    .from("activity_calendars")
    .upsert(input, { onConflict: "facility_id,month_year" })
    .select("*")
    .single();
  if (error) throw fromDbError(error);
  return toCalendar(data);
}
