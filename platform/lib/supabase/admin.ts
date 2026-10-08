import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { getServerEnv } from "@/lib/env.server";

/**
 * The database client for trusted server code: it has the service role, which
 * BYPASSES row level security.
 *
 * Use it only for what no signed-in user may do for themselves: writing
 * subscription status from a Stripe webhook, loading the content library,
 * inviting a team member, offboarding a facility. In every case, first check in
 * code who is asking and what they may do; the database will not.
 *
 * Never use it to read or write a facility's data in answer to a user's
 * request. That is what lib/supabase/server.ts is for.
 */
export function createAdminClient() {
  const env = getServerEnv();
  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
