"use client";

import Link from "next/link";
import { useActionState } from "react";
import { acceptInviteAction, createFacilityAction, forgotPasswordAction, resetPasswordAction, signInAction, signUpAction } from "@/app/actions";
import { emptyState } from "@/lib/auth/state";
import { MIN_PASSWORD_LENGTH } from "@/lib/domain/auth";
import { Field, FormAlerts, SubmitButton } from "./forms";

export function SignInForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signInAction, emptyState);
  return (
    <form action={formAction} className="stack">
      <FormAlerts state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field name="email" label="Email address" type="email" autoComplete="email" defaultValue={state.values?.email} error={state.fieldErrors?.email} required />
      <Field name="password" label="Password" type="password" autoComplete="current-password" error={state.fieldErrors?.password} required />
      <SubmitButton pending={pending} pendingText="Signing in…">
        Sign in
      </SubmitButton>
      <p className="small">
        <Link href="/forgot-password">Forgot your password?</Link>
      </p>
    </form>
  );
}

export function SignUpForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signUpAction, emptyState);
  if (state.message) return <FormAlerts state={state} />; // sent: nothing more to fill in
  return (
    <form action={formAction} className="stack">
      <FormAlerts state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field name="email" label="Work email address" type="email" autoComplete="email" defaultValue={state.values?.email} error={state.fieldErrors?.email} required />
      <Field
        name="password"
        label="Choose a password"
        type="password"
        autoComplete="new-password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters. A few ordinary words in a row work well.`}
        error={state.fieldErrors?.password}
        required
      />
      <SubmitButton pending={pending} pendingText="Creating your account…">
        Create account
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, emptyState);
  if (state.message) return <FormAlerts state={state} />;
  return (
    <form action={formAction} className="stack">
      <FormAlerts state={state} />
      <Field name="email" label="Email address" type="email" autoComplete="email" defaultValue={state.values?.email} error={state.fieldErrors?.email} required />
      <SubmitButton pending={pending} pendingText="Sending…">
        Email me a link
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, emptyState);
  return (
    <form action={formAction} className="stack">
      <FormAlerts state={state} />
      <Field
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        error={state.fieldErrors?.password}
        required
      />
      <Field name="confirm" label="Type it again" type="password" autoComplete="new-password" error={state.fieldErrors?.confirm} required />
      <SubmitButton pending={pending} pendingText="Saving…">
        Save new password
      </SubmitButton>
    </form>
  );
}

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createFacilityAction, emptyState);
  return (
    <form action={formAction} className="stack">
      <FormAlerts state={state} />
      <Field
        name="facility_name"
        label="Facility name"
        autoComplete="organization"
        defaultValue={state.values?.facility_name}
        hint="As you would like it to appear for your team. You can change it later."
        error={state.fieldErrors?.facility_name}
        maxLength={120}
        required
      />
      <SubmitButton pending={pending} pendingText="Setting up…">
        Set up my facility
      </SubmitButton>
    </form>
  );
}

export function AcceptInviteForm({ token, facilityName, roleLabel }: { token: string; facilityName: string; roleLabel: string }) {
  const [state, formAction, pending] = useActionState(acceptInviteAction, emptyState);
  return (
    <form action={formAction} className="stack">
      <FormAlerts state={state} />
      <input type="hidden" name="token" value={token} />
      <SubmitButton pending={pending} pendingText="Joining…">
        {`Join ${facilityName} as ${roleLabel}`}
      </SubmitButton>
    </form>
  );
}
