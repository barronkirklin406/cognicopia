import "server-only";
import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/env.server";
import { ConfigError } from "@/lib/errors";
import type { FlowResult, FormState } from "./state";

/**
 * Small pieces the server actions share (app/actions.ts and app/admin/actions.ts).
 * They live here because a "use server" file may only export actions.
 */

/** A text field from a submitted form, or null (a missing field, or a file where text was expected). */
export function field(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
}

/**
 * Turn a flow's result into what an action returns: a redirect (which throws, and
 * never returns) or the state to show the form again with.
 */
export function settle(result: FlowResult): FormState {
  if ("to" in result) redirect(result.to);
  return result.state;
}

/** For a form that expects no redirect. */
export function stateOf(result: FlowResult): FormState {
  return "state" in result ? result.state : {};
}

export const NOT_SET_UP: FormState = { error: "This feature is not set up yet. Please contact support." };

/** APP_URL, or null (after logging the NAME of the setting that is missing) when it is not set. */
export function appUrlOrNull(): string | null {
  try {
    return getAppUrl();
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    console.error("[actions] not configured:", error.missing.join(", "));
    return null;
  }
}
