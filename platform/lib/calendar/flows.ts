import type { FlowResult } from "@/lib/auth/state";
import { saveCalendar } from "@/lib/data/calendars";
import { listContent } from "@/lib/data/content";
import type { Db } from "@/lib/data/db";
import { DataError } from "@/lib/data/errors";
import { parseCalendarData } from "@/lib/domain/calendar";
import { generateCalendar, PlanSchema, toGeneratorItem } from "@/lib/domain/calendar-generator";

/**
 * What the calendar generator's Save button does, as a plain function like lib/admin/flows.ts.
 *
 * The browser sends the plan (month, theme, stages, sessions a day, and the seed of the mix),
 * never the calendar. The server makes the calendar itself from the library it reads as the
 * signed-in person, so what is stored is always something the planner would make, with real
 * library ids, and no browser can store anything else through this door.
 */

const failed = (error: string, fieldErrors?: Record<string, string>): FlowResult => ({ state: { error, ...(fieldErrors ? { fieldErrors } : {}) } });

export interface SavePlanInput {
  month: unknown;
  theme: unknown;
  stages: unknown;
  perDay: unknown;
  seed: unknown;
}

export async function saveGeneratedCalendarFlow(db: Db, facilityId: string, input: SavePlanInput): Promise<FlowResult> {
  const stages = Array.isArray(input.stages) ? input.stages : [];
  const perDay = typeof input.perDay === "string" ? Number(input.perDay) : input.perDay;
  const parsed = PlanSchema.safeParse({ month: input.month, theme: input.theme, stages, perDay, seed: input.seed });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return failed("Check the choices and try again.", fieldErrors);
  }
  const plan = parsed.data;

  try {
    const library = (await listContent(db, { limit: 1000 })).map(toGeneratorItem);
    const made = generateCalendar(plan, library);
    if (!made.ok) return failed(made.message);

    const checked = parseCalendarData(plan.month, made.data);
    if (!checked.ok) {
      console.error("[calendar] generated data was refused:", checked.code);
      return failed("That calendar could not be saved. Please try again.");
    }

    await saveCalendar(db, { facility_id: facilityId, month_year: plan.month, generated_data: checked.data });
    return { to: `/calendar?month=${plan.month}&notice=saved` };
  } catch (error) {
    if (error instanceof DataError) return failed(error.message);
    console.error("[calendar] unexpected error", error instanceof Error ? error.name : typeof error);
    return failed("Something went wrong. Please try again.");
  }
}
