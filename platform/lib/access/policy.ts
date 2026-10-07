import { grantsAccess, summarize } from "@/lib/domain/subscription";
import { loginPath } from "@/lib/auth/paths";
import type { AccessContext, MemberContext } from "./context";

/**
 * The access rules, as pure functions: given who is asking and what a page or
 * route needs, what happens? No I/O and no Next.js here, so every rule can be
 * tested on its own. lib/access/guards.ts (pages) and lib/access/with-access.ts
 * (routes) apply them.
 *
 *   signed in?  ->  belongs to a facility?  ->  admin, if the thing needs one  ->  subscription grants access, if it is premium
 *
 * The database holds the same line for the library and for writing calendars
 * (migration 4); these checks make the answer a clear page or message instead of an empty result.
 */

export interface Need {
  /** Only a facility admin (an Activity Director). */
  admin?: boolean;
  /** Needs a subscription that grants access: the activity library and the calendar tools. */
  premium?: boolean;
}

// ---------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------

export type PageDecision =
  | { kind: "ok"; ctx: MemberContext }
  | { kind: "redirect"; to: string }
  | { kind: "subscription_required"; ctx: MemberContext };

/** What a page should do. `here` is where the person is trying to go, so sign-in can bring them back. */
export function decidePage(ctx: AccessContext | null, need: Need, here: string): PageDecision {
  if (!ctx) return { kind: "redirect", to: loginPath(here) };
  if (!ctx.membership) return { kind: "redirect", to: "/onboarding" };
  const member: MemberContext = { ...ctx, membership: ctx.membership };
  if (need.admin && ctx.membership.role !== "admin") return { kind: "redirect", to: "/dashboard?notice=admins-only" };
  if (need.premium && !grantsAccess(ctx.membership.facility.subscription_status)) {
    return { kind: "subscription_required", ctx: member };
  }
  return { kind: "ok", ctx: member };
}

/** Where someone goes after signing in with nowhere in particular to go. */
export function landingFor(ctx: AccessContext | null): string {
  if (!ctx) return "/login";
  if (!ctx.membership) return "/onboarding";
  return "/dashboard";
}

// ---------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------

export type ApiDecision =
  | { kind: "ok"; ctx: MemberContext }
  | { kind: "denied"; status: 401 | 402 | 403; code: string; message: string; extra?: Record<string, string | boolean> };

export function decideApi(ctx: AccessContext | null, need: Need): ApiDecision {
  if (!ctx) return { kind: "denied", status: 401, code: "unauthenticated", message: "Sign in to continue." };
  if (!ctx.membership) {
    return { kind: "denied", status: 403, code: "no_facility", message: "Create or join a facility first." };
  }
  const member: MemberContext = { ...ctx, membership: ctx.membership };
  if (need.admin && ctx.membership.role !== "admin") {
    return { kind: "denied", status: 403, code: "forbidden", message: "Only a facility admin can do that." };
  }
  const { role, facility } = ctx.membership;
  if (need.premium && !grantsAccess(facility.subscription_status)) {
    return {
      kind: "denied",
      status: 402,
      code: "subscription_required",
      message:
        role === "admin"
          ? `${summarize(facility.subscription_status).headline}. Open billing to restore access.`
          : `Your facility's subscription is not active. Ask a facility admin to renew it.`,
      extra: { subscription_status: facility.subscription_status, can_manage_billing: role === "admin" },
    };
  }
  return { kind: "ok", ctx: member };
}
