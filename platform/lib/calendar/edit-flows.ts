import type { FlowResult } from "@/lib/auth/state";
import { getCalendar, updateCalendarIfUnchanged } from "@/lib/data/calendars";
import { contentByIds } from "@/lib/data/content";
import type { Db } from "@/lib/data/db";
import { DataError } from "@/lib/data/errors";
import { MonthSchema, parseCalendarData } from "@/lib/domain/calendar";
import { applyEdit, SlotEditSchema } from "@/lib/domain/calendar-edit";
import { quickTip } from "@/lib/domain/adaptation";
import { formatsOf } from "@/lib/domain/formats";
import { suitsStage, trackOf } from "@/lib/domain/stages";

/**
 * What a hand edit on the calendar does, as a plain function like lib/calendar/flows.ts.
 *
 * The browser says which session, what to do, and which version of the month it was looking at. The server
 * reads the month as the signed-in person, applies the one edit, checks the whole month again with the same
 * check the API uses, and saves only if nobody saved the month since (409 otherwise). A swap also checks that
 * the activity exists in the library the person can see and suits the session's stage: a browser cannot put
 * something else in a month by naming it.
 */

const failed = (error: string): FlowResult => ({ state: { error } });

export interface EditInput {
  month: unknown;
  /** The month's updated_at as the editor last saw it. */
  expected: unknown;
  action: unknown;
  slot_id: unknown;
  content_item_id?: unknown;
  note?: unknown;
}

export async function editCalendarSlotFlow(db: Db, facilityId: string, input: EditInput): Promise<FlowResult> {
  const month = MonthSchema.safeParse(input.month);
  if (!month.success) return failed("That month is not valid.");
  if (typeof input.expected !== "string" || input.expected.length < 10 || input.expected.length > 40) return failed("Reload the page and try again.");

  const edit = SlotEditSchema.safeParse({
    action: input.action,
    slot_id: input.slot_id,
    ...(input.content_item_id !== undefined ? { content_item_id: input.content_item_id } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
  });
  if (!edit.success) return failed(input.action === "note" ? "Keep the note to 140 characters or fewer." : "That change could not be made.");

  try {
    const calendar = await getCalendar(db, month.data);
    if (!calendar) return failed("There is no calendar for that month yet.");
    const data = calendar.generated_data;

    let swapNote: string | undefined;
    if (edit.data.action === "swap") {
      const slot = data.slots.find((s) => s.id === edit.data.slot_id);
      const group = slot ? data.groups.find((g) => g.id === slot.group_id) : undefined;
      const ids = [edit.data.content_item_id, ...(slot ? [slot.content_item_id] : [])];
      const items = await contentByIds(db, ids);
      const chosen = items.get(edit.data.content_item_id);
      if (!chosen) return failed("That activity is not in the library.");
      const stage = group ? trackOf(group) : null;
      if (stage && !suitsStage(chosen.dementia_stage, stage)) return failed("That activity is not made for this stage. Choose one from the list.");
      // The planner's tip follows the activity, but a note staff wrote themselves is theirs and stays.
      const previous = slot ? items.get(slot.content_item_id) : undefined;
      if (stage && slot && previous && slot.note === quickTip(formatsOf(previous)[0] ?? "games", stage)) swapNote = quickTip(formatsOf(chosen)[0] ?? "games", stage);
    }

    const result = applyEdit(data, edit.data, swapNote !== undefined ? { swapNote } : {});
    if (!result.ok) return failed(result.message);
    if (!result.changed) return { state: { message: result.summary } };

    const checked = parseCalendarData(month.data, result.data);
    if (!checked.ok) {
      console.error("[calendar] an edited month was refused:", checked.code);
      return failed("That change could not be saved. Please try again.");
    }
    await updateCalendarIfUnchanged(db, facilityId, month.data, checked.data, input.expected);
    return { state: { message: result.summary } };
  } catch (error) {
    if (error instanceof DataError) return failed(error.message);
    console.error("[calendar] unexpected error", error instanceof Error ? error.name : typeof error);
    return failed("Something went wrong. Please try again.");
  }
}
