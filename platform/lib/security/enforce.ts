import "server-only";
import { headers } from "next/headers";
import type { FormState } from "@/lib/auth/state";
import type { Db } from "@/lib/data/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRate, clientIp, tooManyTries, type HitCounter, type PolicyName, type Subjects } from "./rate-limit";

/**
 * The counter backed by the database (public.rate_limit_hit, migration 7), and the one call the server actions
 * make: "may this person try this now?". It uses the service role because the function is for the server only;
 * it counts and answers, and reads or writes nothing of anyone's.
 */
export function databaseCounter(admin: Pick<Db, "rpc">): HitCounter {
  return {
    async hit(key, windowSeconds, max) {
      const { data, error } = await admin.rpc("rate_limit_hit", { p_key: key, p_window_seconds: windowSeconds, p_max: max });
      if (error) throw new Error(error.code ?? "rpc");
      const row = data?.[0];
      if (!row) throw new Error("no answer");
      return { allowed: row.allowed, retryAfter: row.retry_after };
    },
  };
}

/**
 * Count this try. Returns null when it may go ahead, or the state to show the form when it may not.
 * The caller's network address is added to `subjects` from the request. Anything that goes wrong in counting
 * (the service role not set, the database down) lets the try through unless `failClosed`, and is logged by kind.
 */
export async function enforceRate(policy: PolicyName, subjects: Subjects = {}, options: { failClosed?: boolean } = {}): Promise<FormState | null> {
  let counter: HitCounter;
  let ip: string | undefined;
  try {
    ip = clientIp(await headers(), process.env.CLIENT_IP_HEADER?.trim() || undefined);
    counter = databaseCounter(createAdminClient());
  } catch (error) {
    console.error(`[rate-limit] not available (${policy}):`, error instanceof Error ? error.name : typeof error);
    return options.failClosed ? { error: "This could not be done right now. Please try again in a few minutes." } : null;
  }
  const verdict = await checkRate(counter, policy, { ip, ...subjects }, options);
  return verdict.allowed ? null : { error: tooManyTries(verdict.retryAfter) };
}
