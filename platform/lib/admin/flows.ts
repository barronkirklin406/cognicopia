import { z } from "zod";
import type { FlowResult } from "@/lib/auth/state";
import { reconcileFacility } from "@/lib/billing/reconcile";
import type { StripeApi } from "@/lib/billing/stripe";
import type { Db } from "@/lib/data/db";
import { DataError } from "@/lib/data/errors";
import { createInvite, cancelInvite } from "@/lib/data/invites";
import { removeMember, renameFacility, setMemberRole } from "@/lib/data/team";
import { FACILITY_ROLES } from "@/lib/db/models";
import { FacilityNameSchema } from "@/lib/domain/facility";
import { CreateInviteSchema, inviteLink } from "@/lib/domain/invite";
import { isStripeError } from "@/lib/errors";

/**
 * What the admin pages' forms do (team, settings, billing), as plain functions,
 * like lib/auth/flows.ts: input is checked here, the answers are ours, and a
 * failure never shows anything technical. The server actions are a thin skin over
 * these, and each one first checks the person is an admin (requireAdmin).
 */

const Id = z.uuid("That is not a valid id.");
const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** A DataError's message is written for people. Anything else is not shown. */
function say(error: unknown, overrides: Record<string, string> = {}): string {
  if (error instanceof DataError) return overrides[error.code] ?? error.message;
  console.error("[admin] unexpected error", error instanceof Error ? error.name : typeof error);
  return "Something went wrong. Please try again.";
}

const done = (message: string): FlowResult => ({ state: { message } });
const failed = (error: string, values?: Record<string, string>): FlowResult => ({ state: { error, ...(values ? { values } : {}) } });

// ---------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------

/** Make an invitation, and hand back the link to share. The link is shown once: only its hash is kept. */
export async function inviteFlow(db: Db, input: { email: unknown; role: unknown }, appUrl: string): Promise<FlowResult> {
  const parsed = CreateInviteSchema.safeParse({ email: text(input.email), role: input.role });
  const values = { email: text(input.email).trim().toLowerCase() };
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { state: { error: "Check the highlighted fields.", fieldErrors, values } };
  }
  try {
    const token = await createInvite(db, parsed.data);
    const tied = parsed.data.email ? ` It only works for ${parsed.data.email}.` : "";
    return {
      state: {
        message: `Invitation created. Share this link with the person; it works once and lasts 7 days.${tied}`,
        link: inviteLink(appUrl, token),
      },
    };
  } catch (error) {
    return failed(say(error, { already_member: "That person is already on your team." }), values);
  }
}

export async function cancelInviteFlow(db: Db, input: { id: unknown }): Promise<FlowResult> {
  const id = Id.safeParse(input.id);
  if (!id.success) return failed("That invitation could not be found.");
  try {
    return (await cancelInvite(db, id.data)) ? done("Invitation cancelled. Its link no longer works.") : failed("That invitation could not be cancelled. It may already have been used.");
  } catch (error) {
    return failed(say(error));
  }
}

export async function changeRoleFlow(db: Db, input: { id: unknown; role: unknown }): Promise<FlowResult> {
  const id = Id.safeParse(input.id);
  const role = z.enum(FACILITY_ROLES).safeParse(input.role);
  if (!id.success || !role.success) return failed("Choose a person and a role.");
  try {
    await setMemberRole(db, id.data, role.data);
    return done(role.data === "admin" ? "They are now an admin." : "They are now staff.");
  } catch (error) {
    return failed(say(error));
  }
}

export async function removeMemberFlow(db: Db, input: { id: unknown }): Promise<FlowResult> {
  const id = Id.safeParse(input.id);
  if (!id.success) return failed("Choose a person to remove.");
  try {
    await removeMember(db, id.data);
    return done("They have been removed from the facility.");
  } catch (error) {
    return failed(say(error));
  }
}

// ---------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------

export async function renameFacilityFlow(db: Db, input: { facility_name: unknown }, facilityId: string): Promise<FlowResult> {
  const parsed = FacilityNameSchema.safeParse(input.facility_name);
  const values = { facility_name: text(input.facility_name) };
  if (!parsed.success) return { state: { error: "Check the highlighted fields.", fieldErrors: { facility_name: parsed.error.issues[0]?.message ?? "Enter the facility's name." }, values } };
  try {
    await renameFacility(db, facilityId, parsed.data);
    return { state: { message: "The facility's name has been updated.", values: { facility_name: parsed.data } } };
  } catch (error) {
    return failed(say(error), values);
  }
}

// ---------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------

/** "Check my payment status": bring the facility's billing in line with Stripe now. */
export async function refreshBillingFlow(
  deps: { stripe: Pick<StripeApi, "subscriptions">; admin: Db },
  facility: { stripe_customer_id: string | null },
): Promise<FlowResult> {
  try {
    const outcome = await reconcileFacility(deps, facility);
    switch (outcome) {
      case "applied":
        return done("Your billing status has been checked and is up to date.");
      case "stale":
        return done("Your billing status is already up to date.");
      case "none":
        return done("There is nothing to check yet: no subscription has been started.");
      case "unlinked":
        return failed("We could not match your billing account. Please contact support.");
    }
  } catch (error) {
    if (isStripeError(error)) return failed("We could not reach the billing service. Try again in a moment.");
    return failed(say(error));
  }
}
