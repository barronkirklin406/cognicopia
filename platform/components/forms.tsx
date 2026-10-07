"use client";

import { useId, type ReactNode } from "react";
import { Alert } from "./Alert";
import type { FormState } from "@/lib/auth/state";

/**
 * The small pieces every form is made of. Labels are always visible and tied to
 * their field; a problem with a field is written under it and linked to it, so a
 * screen reader reads it with the field; the whole-form message is announced as soon
 * as it appears; and every control is at least 44 px tall (see globals.css).
 */

export function Field(props: {
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  defaultValue?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  maxLength?: number;
  children?: ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [props.hint ? hintId : null, props.error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      {props.hint ? (
        <span id={hintId} className="hint">
          {props.hint}
        </span>
      ) : null}
      <input
        // A new key when what was typed comes back from the server, so the input shows it again after the form resets.
        key={props.defaultValue ?? ""}
        id={id}
        name={props.name}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        defaultValue={props.defaultValue}
        required={props.required}
        maxLength={props.maxLength}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={describedBy}
        autoCapitalize="none"
        spellCheck={false}
      />
      {props.error ? (
        <span id={errorId} className="error">
          {props.error}
        </span>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  pending,
  children,
  pendingText = "Please wait…",
  className = "btn",
  label,
}: {
  pending: boolean;
  children: ReactNode;
  pendingText?: string;
  className?: string;
  /** What a screen reader says, when the visible text alone would not be clear ("Remove" on each row of a table). */
  label?: string;
}) {
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending || undefined} aria-label={label}>
      {pending ? pendingText : children}
    </button>
  );
}

/** What a form's action said: a problem, good news, and a link to share. */
export function FormAlerts({ state }: { state: FormState }) {
  return (
    <>
      {state.error ? <Alert tone="bad">{state.error}</Alert> : null}
      {state.message ? (
        <Alert tone="info">
          <p>{state.message}</p>
          {state.link ? <ShareLink link={state.link} /> : null}
        </Alert>
      ) : null}
    </>
  );
}

/** A link to hand to someone, with a button to copy it. It is shown once, so it is easy to copy. */
export function ShareLink({ link }: { link: string }) {
  const id = useId();
  return (
    <div className="stack">
      <label htmlFor={id} className="small">
        Invitation link
      </label>
      <input id={id} className="link-box" readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
      <button
        type="button"
        className="btn secondary small"
        onClick={(event) => {
          const button = event.currentTarget;
          void navigator.clipboard?.writeText(link).then(
            () => {
              button.textContent = "Copied";
            },
            () => {
              button.textContent = "Select the link and copy it";
            },
          );
        }}
      >
        Copy the link
      </button>
      <p className="small muted">This is the only time the link is shown. If you lose it, cancel the invitation and make another.</p>
    </div>
  );
}
