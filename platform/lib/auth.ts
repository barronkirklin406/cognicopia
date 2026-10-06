import type { User } from "@supabase/supabase-js";
import type { Db } from "@/lib/data/db";
import { DataError } from "@/lib/data/errors";

/**
 * Who is asking. Asks Supabase Auth to verify the session, as getUser() does,
 * rather than trusting the cookie's contents. Throws a 401 DataError if no one is.
 */
export async function requireUser(db: Db): Promise<User> {
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new DataError(401, "unauthenticated", "Sign in to continue.");
  return data.user;
}
