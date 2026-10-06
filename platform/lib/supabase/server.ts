import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/db/database.types";
import { getPublicEnv } from "@/lib/env";

/**
 * The database client for the server (server components, route handlers,
 * server actions). It carries the signed-in user's session from their cookies,
 * so it acts AS that user and row level security applies. Use this by default.
 */
export async function createClient() {
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a server component, which cannot set cookies. Harmless
          // when a proxy refreshes the session; ignore.
        }
      },
    },
  });
}
