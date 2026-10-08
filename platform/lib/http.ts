import { NextResponse } from "next/server";
import { DataError } from "@/lib/data/errors";
import type { Issue } from "@/lib/domain/result";
import { ConfigError, fromStripeError, isStripeError } from "@/lib/errors";
import type { z } from "zod";

/**
 * A JSON error response: { error: { code, message, issues?, ...extra } }.
 * `extra` is for a few machine-readable facts, such as the subscription status
 * behind a 402. Never put a database row or a user's own input in it.
 */
export function problem(
  status: number,
  code: string,
  message: string,
  issues?: Issue[],
  extra?: Record<string, string | number | boolean | null>,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(issues && issues.length > 0 ? { issues } : {}), ...(extra ?? {}) } },
    { status },
  );
}

/**
 * The response for anything a route threw. A DataError says what to tell the
 * caller. A missing setting is a 503, and a failure at Stripe is told as Stripe's
 * failure (see lib/errors.ts). Anything else is a bug, and gets a plain 500: its
 * message, which could hold a database row, is neither returned nor logged.
 */
export function handleError(error: unknown): NextResponse {
  if (error instanceof DataError) return problem(error.status, error.code, error.message, error.issues);
  if (error instanceof ConfigError) {
    console.error("[api] not configured:", error.missing.join(", ")); // the names, never the values
    return problem(503, "not_configured", "This feature is not set up yet. Please contact support.");
  }
  if (isStripeError(error)) {
    console.error("[api] stripe error", error.type, error.code ?? "");
    const mapped = fromStripeError(error);
    return problem(mapped.status, mapped.code, mapped.message);
  }
  console.error("[api] unexpected error", error instanceof Error ? error.name : typeof error);
  return problem(500, "internal", "Something went wrong.");
}

/**
 * Read a JSON request body. Requires Content-Type: application/json: a browser
 * cannot send that cross-site without a preflight, which closes the door on a
 * forged form post riding on the user's cookies.
 */
export async function readJson(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    throw new DataError(415, "unsupported_media_type", "Send JSON with Content-Type: application/json.");
  }
  try {
    return await request.json();
  } catch {
    throw new DataError(400, "invalid_json", "The request body is not valid JSON.");
  }
}

/**
 * Refuse a browser request that was made from another site. Browsers always send
 * Origin on a cross-site POST, so a mismatch means someone else's page is trying
 * to act with this user's cookies. A request with no Origin (a script, curl, the
 * server itself) is not a browser being tricked, and is let through: it has no
 * cookies of the user's to ride on. This is a second wall behind SameSite cookies
 * and the JSON-only rule above.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin === null) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    // "null" and anything else that is not an address
  }
  if (originHost !== host) throw new DataError(403, "forbidden_origin", "This request came from another site.");
}

export const issuesOf = (error: z.ZodError): Issue[] =>
  error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
