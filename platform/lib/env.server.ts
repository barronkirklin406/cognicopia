import "server-only";
import { z } from "zod";
import { describe } from "./env";

/**
 * Settings only the server may see. Importing this from a client component
 * fails the build, because of "server-only".
 *
 * SUPABASE_SERVICE_ROLE_KEY bypasses row level security. It writes billing
 * columns, loads content and invites staff. Never expose it, and never use it
 * to answer a request on a user's behalf without first checking, in code, that
 * the user may do the thing.
 */
const ServerEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof ServerEnv>;

export function getServerEnv(): ServerEnv {
  const parsed = ServerEnv.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!parsed.success) throw new Error(describe(parsed.error));
  return parsed.data;
}
