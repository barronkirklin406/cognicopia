/**
 * The Content-Security-Policy for every page, made per request (proxy.ts).
 *
 * WHAT IT STOPS. Script from anywhere but this site's own files and the scripts Next.js adds to the page
 * (they carry this request's nonce), so a script injected through some input would not run. `'strict-dynamic'`
 * lets those trusted scripts load the rest of the app; it also makes browsers ignore a host list or
 * 'unsafe-inline' for scripts, so neither can be used to get around the nonce.
 *
 * STYLES. The stylesheet is a file from this site and Next's inline styles carry the nonce. The one concession
 * is style ATTRIBUTES (`style="..."`), which cannot carry a nonce; the printed calendar sets its font size and
 * row heights that way. An attribute can change how something looks, not run code.
 *
 * EVERYTHING ELSE is this site only: no outside fonts, pictures, frames, forms, plugins or connections.
 * The browser never calls Supabase or Stripe directly; the server does, and Stripe's page is reached by a
 * redirect, not a request the page makes.
 *
 * Pure: a nonce and whether this is development go in; one header value comes out. Tests: tests/security/csp.test.ts.
 */

/** A fresh, unguessable value for one response: 128 random bits as base64. Never reuse one. */
export function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

export function buildCsp(nonce: string, options: { development?: boolean } = {}): string {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(nonce)) throw new Error("The nonce must be base64.");
  const dev = options.development === true;
  const directives = [
    "default-src 'self'",
    // React in development uses eval to rebuild server error stacks in the browser. Production needs none.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // In development Next adds styles on the fly without a nonce.
    `style-src 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return directives.join("; ");
}
