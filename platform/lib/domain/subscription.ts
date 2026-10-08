import type { SubscriptionStatus } from "@/lib/db/models";

/**
 * What a subscription status means for a facility. Pure rules: no I/O, so the
 * same answers can be used by a page, a route and a test.
 *
 * Which statuses grant access is decided in two places: here, and in the
 * database (private.subscription_grants_access, migration 4), which is what
 * actually guards the library. tests/db/billing.test.ts runs both over every
 * status and fails if they disagree.
 */

/**
 * The statuses that open the premium tools (the activity library and the
 * calendar tools). 'past_due' is deliberately not here: a payment has failed and
 * the renewal prompt sends the facility's admin to the Stripe billing portal. If
 * you would rather give a grace period, change this list and the database
 * function together.
 */
export const ACCESS_STATUSES = ["trialing", "active"] as const satisfies readonly SubscriptionStatus[];

export function grantsAccess(status: SubscriptionStatus): boolean {
  return (ACCESS_STATUSES as readonly string[]).includes(status);
}

/**
 * The statuses from which a new Checkout may be started: the facility has no
 * subscription that is live. Any other status means a subscription exists, and
 * a second one would bill the facility twice. Those go to the billing portal.
 */
export const CHECKOUT_STATUSES = ["incomplete", "incomplete_expired", "canceled"] as const satisfies readonly SubscriptionStatus[];

export function canStartCheckout(status: SubscriptionStatus): boolean {
  return (CHECKOUT_STATUSES as readonly string[]).includes(status);
}

/** What the facility's admin should do next. */
export type NextStep = "none" | "choose_plan" | "update_payment";

export interface SubscriptionSummary {
  /** Short badge text. */
  label: string;
  tone: "good" | "warn" | "bad" | "neutral";
  headline: string;
  detail: string;
  nextStep: NextStep;
}

const SUMMARIES: Record<SubscriptionStatus, SubscriptionSummary> = {
  trialing: {
    label: "Trial",
    tone: "good",
    headline: "Your free trial is active",
    detail: "You have full access to the activity library and the calendar tools.",
    nextStep: "none",
  },
  active: {
    label: "Active",
    tone: "good",
    headline: "Your subscription is active",
    detail: "You have full access to the activity library and the calendar tools.",
    nextStep: "none",
  },
  past_due: {
    label: "Payment overdue",
    tone: "bad",
    headline: "Your last payment did not go through",
    detail:
      "Update your payment method to restore access to the activity library and the calendar tools. Your team and your saved calendars are safe.",
    nextStep: "update_payment",
  },
  unpaid: {
    label: "Unpaid",
    tone: "bad",
    headline: "Your subscription is unpaid",
    detail:
      "Payment could not be collected after several tries. Update your payment method to restore access. Your team and your saved calendars are safe.",
    nextStep: "update_payment",
  },
  paused: {
    label: "Paused",
    tone: "warn",
    headline: "Your subscription is paused",
    detail: "Open billing to resume it and restore access to the activity library and the calendar tools.",
    nextStep: "update_payment",
  },
  canceled: {
    label: "Ended",
    tone: "bad",
    headline: "Your subscription has ended",
    detail: "Choose a plan to restore access. Your team and your saved calendars are kept.",
    nextStep: "choose_plan",
  },
  incomplete: {
    label: "No plan yet",
    tone: "neutral",
    headline: "Choose a plan to get started",
    detail: "Subscribe to unlock the activity library and the calendar tools.",
    nextStep: "choose_plan",
  },
  incomplete_expired: {
    label: "Checkout expired",
    tone: "warn",
    headline: "Your checkout expired",
    detail: "The first payment did not go through in time. Choose a plan to start again.",
    nextStep: "choose_plan",
  },
};

export function summarize(status: SubscriptionStatus): SubscriptionSummary {
  return SUMMARIES[status];
}

/** A date like "October 6, 2027". UTC, so the day never slips with the reader's time zone. */
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(date);
}

/** One line about the billing period, or null when there is nothing to say. */
export function periodLine(input: {
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  interval: string | null;
}): string | null {
  const date = formatDate(input.currentPeriodEnd);
  if (!date) return null;
  if (input.status === "trialing") return `The trial ends on ${date}.`;
  if (input.status === "active") {
    if (input.cancelAtPeriodEnd) return `Your subscription ends on ${date}. You keep full access until then.`;
    const plan = input.interval === "year" ? "Annual plan" : input.interval === "month" ? "Monthly plan" : "Plan";
    return `${plan}. Renews on ${date}.`;
  }
  return null;
}
