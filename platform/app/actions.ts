"use server";

import { redirect } from "next/navigation";
import { requireSignedIn } from "@/lib/access/guards";
import { appUrlOrNull, field, NOT_SET_UP, settle } from "@/lib/auth/action-helpers";
import { acceptInviteFlow, createFacilityFlow, forgotPasswordFlow, resetPasswordFlow, signInFlow, signUpFlow } from "@/lib/auth/flows";
import type { FormState } from "@/lib/auth/state";
import { createClient } from "@/lib/supabase/server";

/**
 * The server actions behind the sign-in, sign-up and set-up forms. Each is a thin
 * skin over a flow in lib/auth/flows.ts, which holds the decisions and is tested
 * on its own: this file reads the form, calls the flow, and redirects or hands the
 * state back to the form.
 *
 * Server actions are public endpoints however they are used, so each one that
 * needs a signed-in person checks for itself (requireSignedIn).
 */

export async function signInAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await createClient();
  return settle(await signInFlow(db, { email: field(formData, "email"), password: field(formData, "password"), next: field(formData, "next") }));
}

export async function signUpAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const appUrl = appUrlOrNull();
  if (!appUrl) return NOT_SET_UP;
  const db = await createClient();
  return settle(await signUpFlow(db, { email: field(formData, "email"), password: field(formData, "password"), next: field(formData, "next") }, appUrl));
}

export async function forgotPasswordAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const appUrl = appUrlOrNull();
  if (!appUrl) return NOT_SET_UP;
  const db = await createClient();
  return settle(await forgotPasswordFlow(db, { email: field(formData, "email") }, appUrl));
}

export async function resetPasswordAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await createClient();
  return settle(await resetPasswordFlow(db, { password: field(formData, "password"), confirm: field(formData, "confirm") }));
}

/** Ends this browser's session only, not the person's sessions on their other devices. */
export async function signOutAction(): Promise<void> {
  const db = await createClient();
  await db.auth.signOut({ scope: "local" });
  redirect("/login");
}

export async function createFacilityAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const { db } = await requireSignedIn("/onboarding");
  return settle(await createFacilityFlow(db, { facility_name: field(formData, "facility_name") }));
}

export async function acceptInviteAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const token = field(formData, "token");
  // If the session ended while the page was open, sign-in brings the person back to the same link.
  const { db } = await requireSignedIn(token && /^[0-9a-f]{64}$/.test(token) ? `/join?token=${token}` : "/join");
  return settle(await acceptInviteFlow(db, { token }));
}
