import { z } from "zod";
import { PhiKeyError, findPhiKeys } from "./phi-guard";
import { type ParseResult, invalid } from "./result";

/**
 * A facility's generated calendar for one month (activity_calendars.generated_data).
 *
 * ZERO PHI. A calendar plans GROUPS, never residents. A group has a name, an
 * acuity tier and a head count, and that is all it knows about the people in it.
 * There is deliberately no field for a resident, and the schema is strict, so
 * an unknown field is refused rather than stored. Free text ("note") is the
 * one place a name could still be typed; it is short, and the screen warns
 * staff. See docs/saas-platform-architecture.md.
 *
 * Version 1 mirrors the facility planner's month plan (src/services/facilityPlanner.ts):
 * groups with an acuity tier, and slots placing an activity with a group at a
 * date and a time. It is provisional until the generation engine moves over.
 */

export const CALENDAR_SCHEMA_VERSION = 1 as const;

export const MONTH_PATTERN = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
export const MonthSchema = z.string().regex(MONTH_PATTERN, "Use the form YYYY-MM, for example 2026-10.");

const Id = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, "Use letters, numbers, - and _ (up to 40).");

const isRealDate = (s: string): boolean => {
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};
const IsoDate = z
  .string()
  .regex(/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/, "Use the form YYYY-MM-DD.")
  .refine(isRealDate, "That date does not exist.");
const Time = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, "Use the form HH:MM, 24-hour.");

/** 1 Mild Support, 2 Moderate Engagement, 3 Advanced Sensory, 4 Universal Group: the planner's tiers. */
export const AcuitySchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

export const CalendarGroupSchema = z.strictObject({
  id: Id,
  /** What the group is called, such as "Garden Room". Never a person's name. */
  name: z.string().trim().min(1).max(60),
  /** The wing or unit it belongs to, if the facility uses them. */
  wing: z.string().trim().max(60).optional(),
  acuity: AcuitySchema,
  /** How many people, if known. A count, not a list. A calendar made from a stage and a theme does not know. */
  size: z.number().int().min(1).max(60).optional(),
});

export const CalendarSlotSchema = z.strictObject({
  id: Id,
  date: IsoDate,
  time: Time,
  group_id: Id,
  /** A content_items id. */
  content_item_id: z.uuid(),
  /** Staff pinned it, so regenerating the month keeps it. */
  locked: z.boolean(),
  /** Short free text. Staff are warned not to type resident names here. */
  note: z.string().max(140),
});

export const CalendarGeneratorSchema = z.strictObject({
  name: z.string().min(1).max(60),
  version: z.string().min(1).max(20),
  seed: z.string().max(60).optional(),
});

export const MAX_GROUPS = 288; // 24 wings of 12 groups, the planner's limits
// Sized so the largest calendar that passes this schema (every id, note and group at full length)
// still fits the database's 1 MiB limit. tests/db/calendar-roundtrip.test.ts proves it.
export const MAX_SLOTS = 2400;

export const CalendarDataSchema = z
  .strictObject({
    schema_version: z.literal(CALENDAR_SCHEMA_VERSION),
    month: MonthSchema,
    groups: z.array(CalendarGroupSchema).max(MAX_GROUPS),
    slots: z.array(CalendarSlotSchema).max(MAX_SLOTS),
    generator: CalendarGeneratorSchema.optional(),
  })
  .superRefine((cal, ctx) => {
    const groupIds = new Set<string>();
    cal.groups.forEach((g, i) => {
      if (groupIds.has(g.id)) ctx.addIssue({ code: "custom", path: ["groups", i, "id"], message: "Two groups share this id." });
      groupIds.add(g.id);
    });

    const slotIds = new Set<string>();
    const seats = new Set<string>();
    cal.slots.forEach((s, i) => {
      if (slotIds.has(s.id)) ctx.addIssue({ code: "custom", path: ["slots", i, "id"], message: "Two sessions share this id." });
      slotIds.add(s.id);
      if (!groupIds.has(s.group_id)) ctx.addIssue({ code: "custom", path: ["slots", i, "group_id"], message: "No group has this id." });
      if (!s.date.startsWith(cal.month)) ctx.addIssue({ code: "custom", path: ["slots", i, "date"], message: `This date is not in ${cal.month}.` });
      const seat = `${s.group_id}|${s.date}|${s.time}`;
      if (seats.has(seat)) ctx.addIssue({ code: "custom", path: ["slots", i, "time"], message: "This group already has a session at this time." });
      seats.add(seat);
    });
  });

export type CalendarData = z.infer<typeof CalendarDataSchema>;
export type CalendarGroup = z.infer<typeof CalendarGroupSchema>;
export type CalendarSlot = z.infer<typeof CalendarSlotSchema>;

/** A calendar with nothing planned yet. */
export const emptyCalendar = (month: string): CalendarData => ({
  schema_version: CALENDAR_SCHEMA_VERSION,
  month,
  groups: [],
  slots: [],
});

/**
 * Check untrusted calendar data for `month` before it goes near the database.
 * Resident-looking keys are reported first, as their own kind of refusal.
 */
export function parseCalendarData(month: string, input: unknown): ParseResult<CalendarData> {
  const m = MonthSchema.safeParse(month);
  if (!m.success) return invalid("Use the form YYYY-MM, for example 2026-10.", [{ path: "month", message: "Not a month." }]);

  const phi = findPhiKeys(input);
  if (phi.length > 0) {
    return {
      ok: false,
      code: "phi_keys",
      message: new PhiKeyError(phi).message,
      issues: phi.map((key) => ({ path: key, message: "Looks like resident or health information." })),
    };
  }

  const parsed = CalendarDataSchema.safeParse(input);
  if (!parsed.success) {
    return invalid(
      "The calendar data is not valid.",
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  if (parsed.data.month !== month) {
    return invalid(`This calendar is for ${parsed.data.month}, not ${month}.`, [{ path: "month", message: "Does not match." }]);
  }
  return { ok: true, data: parsed.data };
}
