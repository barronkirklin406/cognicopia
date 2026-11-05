"use client";

import { useActionState, useId } from "react";
import { editCalendarSlotAction } from "@/app/calendar/actions";
import { FormAlerts } from "@/components/forms";
import { emptyState } from "@/lib/auth/state";
import type { CalendarSlot } from "@/lib/domain/calendar";

/** The library items a session may be changed to (made for its stage, or for any), by group id. */
export type SwapChoices = Record<string, { id: string; title: string }[]>;

/** What the calendar view needs to let someone change a saved month. */
export interface CalendarEditor {
  /** The month's updated_at as loaded: an edit made from an out-of-date copy is refused. */
  updatedAt: string;
  choices: SwapChoices;
}

const button =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border-2 border-garden-dark bg-white px-4 font-[inherit] text-base font-bold text-garden-dark hover:bg-tint disabled:cursor-not-allowed disabled:opacity-60";
const primary = "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border-2 border-garden-dark bg-garden-dark px-4 font-[inherit] text-base font-bold text-white hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60";
const summary = "flex min-h-11 cursor-pointer items-center rounded-lg border-2 border-garden-dark px-3 text-base font-bold text-garden-dark hover:bg-tint";

/**
 * Change one session of a saved month: pin it so planning the month again keeps it, swap its activity for another
 * the library has for the stage, change its note, or take it out. Each is a plain form posting to one server action
 * (app/calendar/actions.ts), so it works before the page's scripts have loaded, and every control is at least 44 px.
 * The month is saved the moment a change is made; the message below says what happened.
 */
export function SessionEditor({ month, slot, editor }: { month: string; slot: CalendarSlot; editor: CalendarEditor }) {
  const [state, formAction, pending] = useActionState(editCalendarSlotAction, emptyState);
  const choices = (editor.choices[slot.group_id] ?? []).filter((item) => item.id !== slot.content_item_id);
  const swapId = useId();
  const noteId = useId();
  const noteHint = `${noteId}-hint`;

  const hidden = (action: string) => (
    <>
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="expected" value={editor.updatedAt} />
      <input type="hidden" name="slot_id" value={slot.id} />
      <input type="hidden" name="action" value={action} />
    </>
  );

  return (
    <div className="grid gap-2 border-t-2 border-rule pt-3 print:hidden" aria-label="Change this session">
      <div className="flex flex-wrap gap-2">
        <form action={formAction}>
          {hidden(slot.locked ? "unpin" : "pin")}
          <button type="submit" disabled={pending} className={slot.locked ? button : primary} aria-pressed={slot.locked}>
            {slot.locked ? "Unpin this session" : "Pin this session"}
          </button>
        </form>
      </div>

      {choices.length > 0 ? (
        <details>
          <summary className={summary}>Change the activity</summary>
          <form action={formAction} className="mt-3 grid gap-2">
            {hidden("swap")}
            <label htmlFor={swapId} className="text-base font-bold">
              Use this instead
            </label>
            <select id={swapId} name="content_item_id" required defaultValue="" className="min-h-11 w-full rounded-lg border-2 border-ink-soft bg-white px-3 py-2 font-[inherit] text-base text-ink">
              <option value="" disabled>
                Choose an activity
              </option>
              {choices.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <p className="m-0 text-sm text-ink-soft">Only activities made for this stage are listed. The session is pinned, so planning the month again keeps your choice.</p>
            <div>
              <button type="submit" disabled={pending} className={primary}>
                Use this activity
              </button>
            </div>
          </form>
        </details>
      ) : null}

      <details>
        <summary className={summary}>Change the note</summary>
        <form action={formAction} className="mt-3 grid gap-2">
          {hidden("note")}
          <label htmlFor={noteId} className="text-base font-bold">
            Note for this session
          </label>
          <textarea
            id={noteId}
            name="note"
            defaultValue={slot.note}
            maxLength={140}
            rows={3}
            aria-describedby={noteHint}
            className="min-h-11 w-full rounded-lg border-2 border-ink-soft bg-white px-3 py-2 font-[inherit] text-base text-ink"
          />
          <p id={noteHint} className="m-0 text-sm text-ink-soft">
            Up to 140 characters. This plans a group, so do not type a resident&rsquo;s name or anything about one person.
          </p>
          <div>
            <button type="submit" disabled={pending} className={primary}>
              Save the note
            </button>
          </div>
        </form>
      </details>

      <details>
        <summary className={summary}>Take this session out</summary>
        <form action={formAction} className="mt-3 grid gap-2">
          {hidden("remove")}
          <p className="m-0 text-base text-ink">This removes the session from the month. You can plan the month again to get it back, if it was not pinned.</p>
          <div>
            <button type="submit" disabled={pending} className={button}>
              Yes, take it out
            </button>
          </div>
        </form>
      </details>

      <div role="status" aria-live="polite">
        <FormAlerts state={state} />
      </div>
    </div>
  );
}
