import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/database.types";
import { getPublicEnv } from "@/lib/env";

/**
 * The database client for the browser (client components).
 * Acts as the signed-in user, so row level security applies.
 */
export function createClient() {
  const env = getPublicEnv();
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
