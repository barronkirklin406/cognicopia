import { z } from "zod";
import { CalendarSlotSchema, type CalendarData, type CalendarSlot } from "./calendar";

/**
 * Changing a generated month by hand: swap a session's activity, pin it so planning the month again keeps
 * it, change its note, or take it out. Pure: a calendar and an edit go in, a new calendar or a plain reason
 * comes out. Nothing here reads a database or a clock; lib/calendar/edit-flows.ts does the reading and
 * saving around it, and checks that the activity chosen exists and suits the stage.
 *
 * ZERO PHI. An edit can only touch the fields a session already has. The note is the one free-text field;
 * it is trimmed and capped like the generator's, and the screen warns staff not to type a resident's name.
 */

const Id = CalendarSlotSchema.shape.id;

export const SlotEditSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("swap"), slot_id: Id, content_item_id: z.uuid() }),
  z.strictObject({ action: z.literal("pin"), slot_id: Id }),
  z.strictObject({ action: z.literal("unpin"), slot_id: Id }),
  z.strictObject({ action: z.literal("note"), slot_id: Id, note: z.string().max(140) }),
  z.strictObject({ action: z.literal("remove"), slot_id: Id }),
]);
export type SlotEdit = z.infer<typeof SlotEditSchema>;

export type EditResult = { ok: true; data: CalendarData; changed: boolean; summary: string } | { ok: false; code: "not_found"; message: string };

const gone = (): EditResult => ({ ok: false, code: "not_found", message: "That session is no longer in this month. Reload the page to see the month as it is now." });

/**
 * Apply one edit. `swapNote` is the note a swapped session should carry: the planner's tip for the new
 * activity, which the caller works out (it needs the library). It replaces the note only when the old note was
 * the planner's own tip, never when staff had written something themselves.
 */
export function applyEdit(data: CalendarData, edit: SlotEdit, options: { swapNote?: string } = {}): EditResult {
  const at = data.slots.findIndex((slot) => slot.id === edit.slot_id);
  const slot = data.slots[at];
  if (!slot) return gone();

  const replace = (next: CalendarSlot): CalendarData => ({ ...data, slots: data.slots.map((s, i) => (i === at ? next : s)) });

  switch (edit.action) {
    case "swap": {
      if (slot.content_item_id === edit.content_item_id) return { ok: true, data, changed: false, summary: "That is already the activity for this session." };
      // A hand-chosen activity is pinned: planning the month again should not undo a choice someone made on purpose.
      const next: CalendarSlot = { ...slot, content_item_id: edit.content_item_id, locked: true, ...(options.swapNote !== undefined ? { note: options.swapNote.slice(0, 140) } : {}) };
      return { ok: true, data: replace(next), changed: true, summary: "The activity was changed, and the session is pinned so planning the month again keeps it." };
    }
    case "pin":
      return slot.locked ? { ok: true, data, changed: false, summary: "This session was already pinned." } : { ok: true, data: replace({ ...slot, locked: true }), changed: true, summary: "Pinned. Planning the month again will keep this session." };
    case "unpin":
      return !slot.locked ? { ok: true, data, changed: false, summary: "This session was not pinned." } : { ok: true, data: replace({ ...slot, locked: false }), changed: true, summary: "Unpinned. Planning the month again may change this session." };
    case "note": {
      const note = edit.note.replace(/\s+/g, " ").trim();
      return note === slot.note ? { ok: true, data, changed: false, summary: "The note is unchanged." } : { ok: true, data: replace({ ...slot, note }), changed: true, summary: "The note was saved." };
    }
    case "remove":
      return { ok: true, data: { ...data, slots: data.slots.filter((_, i) => i !== at) }, changed: true, summary: "The session was taken out of the month." };
  }
}
