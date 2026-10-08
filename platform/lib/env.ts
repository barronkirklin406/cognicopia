import { z } from "zod";

/**
 * The settings the browser may see: where Supabase is, and its public (anon)
 * key. Row level security, not secrecy, is what protects the data, so this key
 * is safe to ship in the page.
 *
 * Each variable is read by its literal name. Next.js replaces
 * process.env.NEXT_PUBLIC_* at build time only where it is written out in full.
 */
const PublicEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof PublicEnv>;

export function getPublicEnv(): PublicEnv {
  const parsed = PublicEnv.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) throw new Error(describe(parsed.error));
  return parsed.data;
}

/** Names the variables that are missing or malformed, never their values. */
export function describe(error: z.ZodError): string {
  const names = [...new Set(error.issues.map((i) => i.path.join(".")))].join(", ");
  return `Missing or invalid environment variable(s): ${names}. See .env.example.`;
}
