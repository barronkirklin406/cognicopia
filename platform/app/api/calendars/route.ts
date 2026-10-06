import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getCalendar, saveCalendar } from "@/lib/data/calendars";
import { DataError } from "@/lib/data/errors";
import { getMembership } from "@/lib/data/facilities";
import { MonthSchema, parseCalendarData } from "@/lib/domain/calendar";
import { handleError, issuesOf, problem, readJson } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET /api/calendars?month=2026-10 : the facility's calendar for that month. */
export async function GET(request: Request) {
  try {
    const db = await createClient();
    await requireUser(db);

    const month = MonthSchema.safeParse(new URL(request.url).searchParams.get("month"));
    if (!month.success) return problem(422, "invalid", "Give a month as month=YYYY-MM.", issuesOf(month.error));

    const calendar = await getCalendar(db, month.data);
    if (!calendar) return problem(404, "not_found", "There is no calendar for that month yet.");
    return NextResponse.json({ calendar });
  } catch (error) {
    return handleError(error);
  }
}

const PutBody = z.object({ month: MonthSchema, data: z.unknown() });

/**
 * PUT /api/calendars  { "month": "2026-10", "data": { ...calendar... } }
 * Creates or replaces the facility's calendar for the month.
 */
export async function PUT(request: Request) {
  try {
    const db = await createClient();
    const user = await requireUser(db);

    const body = PutBody.safeParse(await readJson(request));
    if (!body.success) return problem(422, "invalid", "Send { month, data }.", issuesOf(body.error));

    // Resident-looking keys, the schema, the month: all checked before the database.
    const calendar = parseCalendarData(body.data.month, body.data.data);
    if (!calendar.ok) return problem(422, calendar.code, calendar.message, calendar.issues);

    const membership = await getMembership(db, user.id);
    if (!membership) throw new DataError(403, "no_facility", "Create or join a facility first.");

    const saved = await saveCalendar(db, {
      facility_id: membership.facility_id,
      month_year: body.data.month,
      generated_data: calendar.data,
    });
    return NextResponse.json({ calendar: saved });
  } catch (error) {
    return handleError(error);
  }
}
