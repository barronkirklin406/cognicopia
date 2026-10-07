import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isProtectedPath, isSignedOutOnly, loginPath } from "@/lib/auth/paths";
import { getPublicEnv } from "@/lib/env";

/**
 * The proxy (called "middleware" before Next.js 16). It runs before a page is
 * drawn, and does two small jobs:
 *
 *   1. KEEPS THE SIGN-IN FRESH. A server component cannot set cookies, so nothing
 *      else can renew a session that is about to expire. Here, the session is
 *      checked and, if it is close to expiring, renewed, and the new cookies go on
 *      the response and on the request the page is about to see.
 *   2. TURNS AWAY, POLITELY, anyone not signed in who asks for a page that needs it
 *      (to the sign-in page, remembering where they were going), and sends someone
 *      already signed in away from the sign-in pages.
 *
 * It is a convenience, not the security. It reads the cookie and checks the token;
 * it cannot see the database, so it knows nothing of roles or subscriptions, and
 * Next.js itself advises against doing more here. Every page and route checks for
 * itself (lib/access), and the database is the last wall (row level security).
 *
 * It skips API routes (they answer 401 as JSON, not with a redirect) and static
 * files. The Stripe webhook is under /api on purpose: Stripe has no session.
 */

/** Supabase's session cookie: sb-<project>-auth-token, in pieces when large (…-auth-token.0, .1). */
const SESSION_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

type CookieToSet = { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] };

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.getAll().some((cookie) => SESSION_COOKIE.test(cookie.name));

  // No session cookie: nothing to renew, and nothing to ask Supabase.
  if (!hasSession) {
    return isProtectedPath(pathname) ? redirect(request, loginPath(`${pathname}${search}`)) : NextResponse.next({ request });
  }

  let env;
  try {
    env = getPublicEnv();
  } catch {
    return NextResponse.next({ request }); // not configured: let the page say so
  }

  // What Supabase asks to be set (new cookies, and the no-cache headers that must go with them).
  const pending: { cookies: CookieToSet[]; headers: Record<string, string> } = { cookies: [], headers: {} };
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value); // the page about to render must see the renewed session
          pending.cookies.push({ name, value, options });
        }
        Object.assign(pending.headers, headers);
      },
    },
  });

  // Checks the token, and renews the session first if it is about to expire.
  let signedIn = false;
  try {
    const { data, error } = await supabase.auth.getClaims();
    signedIn = !error && Boolean(data?.claims);
  } catch {
    signedIn = false;
  }

  const finish = (response: NextResponse): NextResponse => {
    for (const { name, value, options } of pending.cookies) response.cookies.set(name, value, options);
    for (const [key, value] of Object.entries(pending.headers)) response.headers.set(key, value);
    return response;
  };

  if (!signedIn && isProtectedPath(pathname)) return finish(redirect(request, loginPath(`${pathname}${search}`)));
  if (signedIn && isSignedOutOnly(pathname)) return finish(redirect(request, "/dashboard"));
  return finish(NextResponse.next({ request }));
}

function redirect(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.nextUrl));
}

export const config = {
  // Everything except API routes, Next's own files and static assets.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff2?|ttf|otf)$).*)"],
};
