/**
 * Which paths need a signed-in person, and where "next" may lead. Pure, so the
 * proxy, the pages and the tests all use one definition.
 */

/** Pages that need a signed-in person. The proxy sends anyone else to sign in; each page also checks for itself. */
export const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/admin", "/library", "/calendar", "/reminiscence"] as const;

/** Pages a signed-in person has no reason to see: the proxy sends them to the dashboard. */
export const SIGNED_OUT_ONLY = ["/", "/login", "/signup", "/forgot-password"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isSignedOutOnly(pathname: string): boolean {
  return (SIGNED_OUT_ONLY as readonly string[]).includes(pathname);
}

const DEFAULT_NEXT = "/dashboard";
const MAX_NEXT_LENGTH = 512;
// Never send someone on to an API route or into the auth callback, where a link could be made to do something.
const NEVER_NEXT = ["/api", "/auth"];

/**
 * Where to go after signing in: the `next` the page was given, but only if it is
 * a path on this site. Anything else (another site, a protocol-relative address
 * like //evil.example, a backslash trick, a script, control characters, an API
 * route, something too long) becomes the dashboard. This is what stops sign-in
 * from being used to bounce people onto someone else's page.
 */
export function safeNext(raw: string | null | undefined, fallback: string = DEFAULT_NEXT): string {
  if (typeof raw !== "string" || raw === "" || raw.length > MAX_NEXT_LENGTH) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;

  let url: URL;
  try {
    url = new URL(raw, "http://cognicopia.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://cognicopia.invalid") return fallback;
  if (NEVER_NEXT.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) return fallback;
  return `${url.pathname}${url.search}`;
}

/** The sign-in page, remembering where the person was going. */
export function loginPath(next?: string): string {
  const safe = next ? safeNext(next, "") : "";
  return safe && safe !== DEFAULT_NEXT ? `/login?next=${encodeURIComponent(safe)}` : "/login";
}
