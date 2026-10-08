import { NextResponse } from "next/server";
import { z } from "zod";
import { withAccess } from "@/lib/access/with-access";
import { getCalendar, saveCalendar } from "@/lib/data/calendars";
import { MonthSchema, parseCalendarData } from "@/lib/domain/calendar";
import { issuesOf, problem, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * The calendar tools are premium: they need a facility member whose subscription
 * grants access (402 otherwise, with the status and whether the caller can manage
 * billing). The database enforces the same for writing (migration 4).
 */

/** GET /api/calendars?month=2026-10 : the facility's calendar for that month. */
export const GET = withAccess({ premium: true }, async ({ request, db }) => {
  const month = MonthSchema.safeParse(new URL(request.url).searchParams.get("month"));
  if (!month.success) return problem(422, "invalid", "Give a month as month=YYYY-MM.", issuesOf(month.error));

  const calendar = await getCalendar(db, month.data);
  if (!calendar) return problem(404, "not_found", "There is no calendar for that month yet.");
  return NextResponse.json({ calendar });
});

const PutBody = z.object({ month: MonthSchema, data: z.unknown() });

/**
 * PUT /api/calendars  { "month": "2026-10", "data": { ...calendar... } }
 * Creates or replaces the facility's calendar for the month. The facility is
 * always the caller's own, from their membership: a facility named in the body
 * is ignored.
 */
export const PUT = withAccess({ premium: true }, async ({ request, db, membership }) => {
  const body = PutBody.safeParse(await readJson(request));
  if (!body.success) return problem(422, "invalid", "Send { month, data }.", issuesOf(body.error));

  // Resident-looking keys, the schema, the month: all checked before the database.
  const calendar = parseCalendarData(body.data.month, body.data.data);
  if (!calendar.ok) return problem(422, calendar.code, calendar.message, calendar.issues);

  const saved = await saveCalendar(db, {
    facility_id: membership.facility.id,
    month_year: body.data.month,
    generated_data: calendar.data,
  });
  return NextResponse.json({ calendar: saved });
});
