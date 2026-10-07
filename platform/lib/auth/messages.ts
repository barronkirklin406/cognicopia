/**
 * What to tell a person when Supabase Auth says no. The wording is ours, never
 * Supabase's: its messages can be technical, and some would confirm whether an
 * address has an account. Every message here is safe to show.
 */

export interface AuthFailure {
  code: string;
  message: string;
}

/** The shape of an error from Supabase Auth that this reads. */
export interface AuthErrorLike {
  code?: string | null;
  status?: number | null;
  message?: string | null;
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: "The email or password is not right. Check them and try again.",
  email_not_confirmed: "Confirm your email address first. Check your inbox for the link we sent.",
  over_request_rate_limit: "Too many attempts. Wait a few minutes and try again.",
  over_email_send_rate_limit: "We have sent several emails to that address. Wait a few minutes before asking for another.",
  weak_password: "That password is too weak. Use at least 12 characters, and avoid common words.",
  email_address_invalid: "Enter a valid email address.",
  same_password: "Choose a password different from your current one.",
  signup_disabled: "New accounts cannot be created right now.",
  otp_expired: "That link has expired or was already used. Ask for a new one.",
  flow_state_expired: "That link has expired or was already used. Ask for a new one.",
  flow_state_not_found: "That link has expired or was already used. Ask for a new one.",
  bad_code_verifier: "That link has expired or was already used. Ask for a new one.",
  session_not_found: "Your session has ended. Sign in again.",
  user_banned: "This account cannot sign in. Please contact support.",
};

const GENERIC = "Something went wrong. Please try again.";
const RATE_LIMITED = "Too many attempts. Wait a few minutes and try again.";

export function describeAuthError(error: AuthErrorLike | null | undefined): AuthFailure {
  const code = error?.code ?? "";
  if (code && MESSAGES[code]) return { code, message: MESSAGES[code] };
  if (error?.status === 429) return { code: "over_request_rate_limit", message: RATE_LIMITED };
  return { code: code || "unknown", message: GENERIC };
}

/** What the sign-in page may show for `?error=...`. Anything else shows nothing: the page never echoes a query string. */
const PAGE_ERRORS: Record<string, string> = {
  // The one-time code in an emailed link can only be used in the browser that asked for it. Opened anywhere else, the
  // address is still confirmed (Supabase does that first), so signing in works: say so.
  callback: "That link could not be used in this browser. If it was to confirm your email address, that may already be done: try signing in. Otherwise, ask for a new link.",
  link_expired: "That link has expired or was already used. Ask for a new one.",
  session: "Your session has ended. Sign in again.",
};

/** What a page may show for `?notice=...`, likewise. */
const PAGE_NOTICES: Record<string, string> = {
  "admins-only": "That page is for facility admins.",
  "password-updated": "Your password has been changed.",
  joined: "You have joined the facility.",
};

/**
 * Look a key up in one of those lists. Only an entry the list itself holds
 * counts: a key like "__proto__" or "constructor" must not find something
 * inherited, which the page would then try to show.
 */
function lookup(list: Record<string, string>, key: unknown): string | null {
  return typeof key === "string" && Object.hasOwn(list, key) ? (list[key] ?? null) : null;
}

export const pageError = (key: unknown): string | null => lookup(PAGE_ERRORS, key);
export const pageNotice = (key: unknown): string | null => lookup(PAGE_NOTICES, key);

/**
 * What the team page may show for `?notice=...`: the outcome of a change that took a row
 * off the page, whose own form (and any message in it) is gone by the time the page redraws.
 */
const TEAM_NOTICES = {
  "invite-cancelled": "Invitation cancelled. Its link no longer works.",
  "member-removed": "They have been removed from the facility.",
} as const;

export type TeamNoticeKey = keyof typeof TEAM_NOTICES;
export const teamNotice = (key: unknown): string | null => lookup(TEAM_NOTICES, key);

/** What the calendar page may show for `?notice=...`: a saved calendar redirects here, so the message outlives the form. */
const CALENDAR_NOTICES = {
  saved: "Calendar saved. It replaces any earlier calendar for that month.",
} as const;

export const calendarNotice = (key: unknown): string | null => lookup(CALENDAR_NOTICES, key);
