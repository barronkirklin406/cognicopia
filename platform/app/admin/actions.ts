"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cancelInviteFlow, changeRoleFlow, inviteFlow, refreshBillingFlow, removeMemberFlow, renameFacilityFlow } from "@/lib/admin/flows";
import { requireAdmin } from "@/lib/access/guards";
import { appUrlOrNull, field, NOT_SET_UP, stateOf } from "@/lib/auth/action-helpers";
import type { TeamNoticeKey } from "@/lib/auth/messages";
import type { FlowResult, FormState } from "@/lib/auth/state";
import { getStripe } from "@/lib/billing/stripe";
import { ConfigError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The server actions behind the admin pages. Every one checks, for itself, that
 * the person is an admin of a facility (requireAdmin), whatever page the form was
 * on: a server action can be called without its page. The database checks again.
 */

export async function inviteAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const { db } = await requireAdmin("/admin/team");
  const appUrl = appUrlOrNull();
  if (!appUrl) return NOT_SET_UP;
  const state = stateOf(await inviteFlow(db, { email: field(formData, "email"), role: field(formData, "role") }, appUrl));
  revalidatePath("/admin/team");
  return state;
}

/**
 * A change that takes a row off the page (an invitation cancelled, a member removed)
 * ends with a redirect and a notice at the top of the page. By the time the page redraws,
 * the row's own form is gone, and a message kept in it would go with it, leaving a screen
 * reader user with no word on whether it worked. A failure stays with the row, which is
 * still there.
 */
function finishTeamChange(result: FlowResult, notice: TeamNoticeKey): FormState {
  const state = stateOf(result);
  if (state.error) return state;
  revalidatePath("/admin/team");
  redirect(`/admin/team?notice=${notice}`);
}

export async function cancelInviteAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const { db } = await requireAdmin("/admin/team");
  return finishTeamChange(await cancelInviteFlow(db, { id: field(formData, "id") }), "invite-cancelled");
}

export async function changeRoleAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const { db } = await requireAdmin("/admin/team");
  const state = stateOf(await changeRoleFlow(db, { id: field(formData, "id"), role: field(formData, "role") }));
  revalidatePath("/admin/team");
  return state;
}

export async function removeMemberAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const { db } = await requireAdmin("/admin/team");
  return finishTeamChange(await removeMemberFlow(db, { id: field(formData, "id") }), "member-removed");
}

export async function renameFacilityAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const { db, membership } = await requireAdmin("/admin/settings");
  const state = stateOf(await renameFacilityFlow(db, { facility_name: field(formData, "facility_name") }, membership.facility.id));
  revalidatePath("/", "layout"); // the name is in every page's header
  return state;
}

/** "Check my payment status": bring this facility's billing in line with Stripe now. */
export async function refreshBillingAction(_previous: FormState): Promise<FormState> {
  const { membership } = await requireAdmin("/admin/billing");
  let stripe;
  try {
    stripe = getStripe();
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    console.error("[actions] not configured:", error.missing.join(", "));
    return { error: "Billing is not set up yet. Please contact support." };
  }
  const state = stateOf(await refreshBillingFlow({ stripe, admin: createAdminClient() }, membership.facility));
  revalidatePath("/", "layout");
  return state;
}
