/**
 * What a form action hands back to the form it came from. Plain data only: it
 * crosses from server to browser, so it never holds anything secret.
 */
export interface FormState {
  /** A problem with the whole form. */
  error?: string;
  /** A problem with one field, by field name. */
  fieldErrors?: Record<string, string>;
  /** Good news: "Check your email". */
  message?: string;
  /** What was typed, so the form can show it again (never a password). */
  values?: Record<string, string>;
  /** A link to show once, such as a new invitation's. */
  link?: string;
}

export const emptyState: FormState = {};

/** The outcome of a flow: send the person somewhere, or show the form again with this state. */
export type FlowResult = { to: string } | { state: FormState };
