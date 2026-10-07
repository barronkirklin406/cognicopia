import { NextResponse } from "next/server";
import { appUrlOrNull } from "@/lib/auth/action-helpers";
import { safeNext } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Where the links in our emails (confirm your address, reset your password) come
 * back to. Supabase has checked the link and gives us a one-time code; here it is
 * exchanged for a session, which is stored in cookies, and the person goes on to
 * where the link said, but only if that is a page on this site (safeNext).
 *
 * A link that was old, or used, or cut short comes back to sign-in with a plain
 * message (never with anything from the address, which could be made to say anything).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = appUrlOrNull() ?? url.origin;
  const to = (path: string) => NextResponse.redirect(new URL(path, base));

  if (url.searchParams.get("error") || url.searchParams.get("error_code")) return to("/login?error=link_expired");

  const code = url.searchParams.get("code");
  if (!code) return to("/login?error=callback");

  const db = await createClient();
  const { error } = await db.auth.exchangeCodeForSession(code);
  if (error) return to("/login?error=callback");

  return to(safeNext(url.searchParams.get("next")));
}
