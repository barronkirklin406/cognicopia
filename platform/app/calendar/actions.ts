"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePremium } from "@/lib/access/guards";
import { field } from "@/lib/auth/action-helpers";
import type { FormState } from "@/lib/auth/state";
import { editCalendarSlotFlow } from "@/lib/calendar/edit-flows";
import { saveGeneratedCalendarFlow } from "@/lib/calendar/flows";

/**
 * Save the month the generator has made. The form sends the plan (month, theme, stages, sessions a
 * day, and the seed of the mix), never the calendar: the server makes the calendar itself, from the
 * library it reads as the signed-in person (lib/calendar/flows.ts). A server action can be called
 * without its page, so this checks, for itself, that the facility's subscription is active; the
 * database checks again.
 */
export async function saveGeneratedCalendarAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const access = await requirePremium("/calendar/generate");
  if (access.blocked) {
    return { error: "Your facility's subscription is not active, so a calendar cannot be saved. An admin can renew it from Billing." };
  }

  const result = await saveGeneratedCalendarFlow(access.db, access.membership.facility.id, {
    month: field(formData, "month"),
    theme: field(formData, "theme"),
    stages: formData.getAll("stages").filter((value) => typeof value === "string"),
    perDay: field(formData, "perDay"),
    seed: field(formData, "seed"),
  });

  if ("state" in result) return result.state;
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect(result.to);
}

/**
 * One hand edit to a saved month: swap a session's activity, pin or unpin it, change its note, or take it out.
 * Like the save above, it checks the subscription for itself (a server action can be called without its page),
 * and lib/calendar/edit-flows.ts checks the rest: the edit itself, that a swapped-in activity is in the library
 * and suits the stage, and that nobody saved the month since the editor's copy. The database checks again.
 */
export async function editCalendarSlotAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const access = await requirePremium("/calendar");
  if (access.blocked) return { error: "Your facility's subscription is not active, so the calendar cannot be changed. An admin can renew it from Billing." };

  const result = await editCalendarSlotFlow(access.db, access.membership.facility.id, {
    month: field(formData, "month"),
    expected: field(formData, "expected"),
    action: field(formData, "action"),
    slot_id: field(formData, "slot_id"),
    ...(formData.has("content_item_id") ? { content_item_id: field(formData, "content_item_id") } : {}),
    ...(formData.has("note") ? { note: field(formData, "note") } : {}),
  });

  if ("state" in result) {
    if (result.state.message) {
      revalidatePath("/calendar");
      revalidatePath("/dashboard");
    }
    return result.state;
  }
  redirect(result.to);
}
