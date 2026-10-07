import type { z } from "zod";
import type { Db } from "@/lib/data/db";
import { DataError } from "@/lib/data/errors";
import { createFacility } from "@/lib/data/facilities";
import { acceptInvite } from "@/lib/data/invites";
import { ForgotPasswordSchema, OnboardingSchema, ResetPasswordSchema, SignInSchema, SignUpSchema } from "@/lib/domain/auth";
import { InviteTokenSchema } from "@/lib/domain/invite";
import { describeAuthError } from "./messages";
import { safeNext } from "./paths";
import type { FlowResult, FormState } from "./state";

/**
 * What each sign-in and set-up form does, as plain functions. The server actions
 * (app/actions.ts) are a thin skin over these: they read the form, call a flow,
 * and either redirect or hand the state back. Keeping the decisions here means
 * they are tested without a browser or a server.
 *
 * Rules that run through all of them:
 *   - input is checked here, on the server, whatever the browser did;
 *   - what is said back is our own wording (messages.ts), never Supabase's;
 *   - a passwordless "we sent an email" answer is the same whether or not the
 *     address has an account, so these forms cannot be used to find out who does;
 *   - "next" is only ever a path on this site (paths.ts: safeNext);
 *   - a password is never put back into the form's state, and never logged.
 */

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** Zod's complaints as field errors, first message per field. */
function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

const invalid = (error: z.ZodError, values: Record<string, string> = {}): FlowResult => ({
  state: { error: "Check the highlighted fields.", fieldErrors: fieldErrors(error), values },
});

/** The address people come back to after confirming an email, then on to `next`. */
function callback(appUrl: string, next: string): string {
  return `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`;
}

// ---------------------------------------------------------------------

export async function signInFlow(db: Db, input: { email: unknown; password: unknown; next: unknown }): Promise<FlowResult> {
  const parsed = SignInSchema.safeParse({ email: input.email, password: input.password });
  const values = { email: text(input.email).trim().toLowerCase() };
  if (!parsed.success) return invalid(parsed.error, values);

  const { error } = await db.auth.signInWithPassword(parsed.data);
  if (error) return { state: { error: describeAuthError(error).message, values } };
  return { to: safeNext(text(input.next)) };
}

export async function signUpFlow(db: Db, input: { email: unknown; password: unknown; next: unknown }, appUrl: string): Promise<FlowResult> {
  const parsed = SignUpSchema.safeParse({ email: input.email, password: input.password });
  const values = { email: text(input.email).trim().toLowerCase() };
  if (!parsed.success) return invalid(parsed.error, values);

  const { error } = await db.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: callback(appUrl, safeNext(text(input.next))) },
  });
  // An address that already has an account gets no error from Supabase either (it sends nothing new),
  // so this answer cannot be used to find out who has one.
  if (error) return { state: { error: describeAuthError(error).message, values } };
  return {
    state: {
      message: `We sent a link to ${parsed.data.email}. Open it to confirm your address, then sign in. It may take a minute to arrive; check your spam folder too.`,
    },
  };
}

export async function forgotPasswordFlow(db: Db, input: { email: unknown }, appUrl: string): Promise<FlowResult> {
  const parsed = ForgotPasswordSchema.safeParse({ email: input.email });
  const values = { email: text(input.email).trim().toLowerCase() };
  if (!parsed.success) return invalid(parsed.error, values);

  const { error } = await db.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: callback(appUrl, "/reset-password") });
  // Rate limits are worth saying; "no such user" is not, and Supabase does not say it.
  if (error && (error.status === 429 || String(error.code).includes("rate_limit"))) {
    return { state: { error: describeAuthError(error).message, values } };
  }
  return { state: { message: "If that address has an account, we have sent it a link to choose a new password." } };
}

/** For someone who arrived by a recovery link: the callback has already signed them in. */
export async function resetPasswordFlow(db: Db, input: { password: unknown; confirm: unknown }): Promise<FlowResult> {
  const parsed = ResetPasswordSchema.safeParse({ password: input.password, confirm: input.confirm });
  if (!parsed.success) return invalid(parsed.error);

  const { data } = await db.auth.getUser();
  if (!data.user) return { state: { error: describeAuthError({ code: "session_not_found" }).message } };

  const { error } = await db.auth.updateUser({ password: parsed.data.password });
  if (error) return { state: { error: describeAuthError(error).message } };
  return { to: "/dashboard?notice=password-updated" };
}

// ---------------------------------------------------------------------
// After signing in
// ---------------------------------------------------------------------

/** A DataError's message is written for people; anything else is not shown. */
function say(error: unknown, fallback = "Something went wrong. Please try again."): string {
  return error instanceof DataError ? error.message : fallback;
}

export async function createFacilityFlow(db: Db, input: { facility_name: unknown }): Promise<FlowResult> {
  const parsed = OnboardingSchema.safeParse({ facility_name: input.facility_name });
  const values = { facility_name: text(input.facility_name) };
  if (!parsed.success) return invalid(parsed.error, values);
  try {
    await createFacility(db, parsed.data.facility_name);
  } catch (error) {
    if (error instanceof DataError && error.code === "already_member") return { to: "/dashboard" };
    if (!(error instanceof DataError)) console.error("[onboarding] unexpected error", error instanceof Error ? error.name : typeof error);
    return { state: { error: say(error), values } };
  }
  // The facility has no subscription yet: choosing a plan is the next thing to do.
  return { to: "/admin/billing?welcome=1" };
}

export async function acceptInviteFlow(db: Db, input: { token: unknown }): Promise<FlowResult> {
  const token = InviteTokenSchema.safeParse(input.token);
  if (!token.success) return { state: { error: "This invitation link is not valid. Ask a facility admin for a new one." } };
  try {
    await acceptInvite(db, token.data);
  } catch (error) {
    if (!(error instanceof DataError)) console.error("[join] unexpected error", error instanceof Error ? error.name : typeof error);
    return { state: { error: say(error) } };
  }
  return { to: "/dashboard?notice=joined" };
}
