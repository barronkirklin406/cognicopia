import type { Db } from "@/lib/data/db";
import { assertSameOrigin, handleError, problem } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";
import { loadAccessContext, type Account, type Membership } from "./context";
import { decideApi, type Need } from "./policy";

/**
 * Route wrappers: the gate for API routes.
 *
 *   withUser(handler)               a signed-in person (401 if not)
 *   withAccess(need, handler)       a facility member (403 if none), an admin if `admin`
 *                                   (403), with a subscription that grants access if
 *                                   `premium` (402, with the status and whether this
 *                                   person can manage billing)
 *
 * Both turn anything the handler throws into a clean JSON error (lib/http.ts),
 * and refuse a browser request from another site when it would change something.
 * The handler gets the person's own database client, so row level security
 * still applies to everything it does.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type Route = (request: Request) => Promise<Response>;

export function withUser(handler: (args: { request: Request; db: Db; user: Account }) => Promise<Response>): Route {
  return async (request) => {
    try {
      if (!SAFE_METHODS.has(request.method)) assertSameOrigin(request);
      const db = await createClient();
      const ctx = await loadAccessContext(db);
      if (!ctx) return problem(401, "unauthenticated", "Sign in to continue.");
      return await handler({ request, db, user: ctx.user });
    } catch (error) {
      return handleError(error);
    }
  };
}

export function withAccess(
  need: Need,
  handler: (args: { request: Request; db: Db; user: Account; membership: Membership }) => Promise<Response>,
): Route {
  return async (request) => {
    try {
      if (!SAFE_METHODS.has(request.method)) assertSameOrigin(request);
      const db = await createClient();
      const decision = decideApi(await loadAccessContext(db), need);
      if (decision.kind === "denied") {
        return problem(decision.status, decision.code, decision.message, undefined, decision.extra);
      }
      return await handler({ request, db, user: decision.ctx.user, membership: decision.ctx.membership });
    } catch (error) {
      return handleError(error);
    }
  };
}
