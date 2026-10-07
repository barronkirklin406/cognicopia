import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { loginPath } from "@/lib/auth/paths";
import type { Db } from "@/lib/data/db";
import { createClient } from "@/lib/supabase/server";
import { loadAccessContext, type AccessContext, type MemberContext } from "./context";
import { decidePage, type Need } from "./policy";

/**
 * Page guards. Call one at the top of a page, before it touches any data.
 *
 * Next.js advice (and ours): check close to the data, in the page itself, not
 * only in a layout. A layout is not rendered again when someone moves between
 * pages inside it, so a check there can be skipped. The proxy (proxy.ts) also
 * turns away people who are not signed in, but only as a courtesy: it reads the
 * cookie and cannot see the database. These guards are the real check, and the
 * database is the last one.
 */

/** The person and their facility, read once per request however many components ask. */
export const getAccess = cache(async (): Promise<{ db: Db; ctx: AccessContext | null }> => {
  const db = await createClient();
  return { db, ctx: await loadAccessContext(db) };
});

export interface Guarded extends MemberContext {
  db: Db;
}

async function guard(need: Need, here: string): Promise<Guarded> {
  const { db, ctx } = await getAccess();
  const decision = decidePage(ctx, need, here);
  if (decision.kind === "redirect") redirect(decision.to);
  return { db, ...decision.ctx };
}

/** A signed-in member of a facility. Anyone else is sent where they belong: sign in, or set up a facility. */
export function requireMember(here: string): Promise<Guarded> {
  return guard({}, here);
}

/** A facility admin (an Activity Director). Staff go back to the dashboard. */
export function requireAdmin(here: string): Promise<Guarded> {
  return guard({ admin: true }, here);
}

/** A signed-in person who may or may not belong to a facility yet: for setting one up, or accepting an invitation. */
export async function requireSignedIn(here: string): Promise<{ db: Db; ctx: AccessContext }> {
  const { db, ctx } = await getAccess();
  if (!ctx) redirect(loginPath(here));
  return { db, ctx };
}

export type PremiumAccess = Guarded & { blocked: boolean };

/**
 * A member of a facility, with `blocked` saying whether its subscription fails to
 * grant access to the premium tools: the activity library and the calendar tools.
 * Nothing is redirected for a lapsed subscription. The page checks `blocked`
 * before it reads any premium data, and shows the renewal prompt instead.
 */
export async function requirePremium(here: string): Promise<PremiumAccess> {
  const { db, ctx } = await getAccess();
  const decision = decidePage(ctx, { premium: true }, here);
  if (decision.kind === "redirect") redirect(decision.to);
  return { db, ...decision.ctx, blocked: decision.kind === "subscription_required" };
}
