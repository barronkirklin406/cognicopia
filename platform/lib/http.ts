import { NextResponse } from "next/server";
import { DataError } from "@/lib/data/errors";
import type { Issue } from "@/lib/domain/result";
import type { z } from "zod";

/** A JSON error response: { error: { code, message, issues? } }. */
export function problem(status: number, code: string, message: string, issues?: Issue[]): NextResponse {
  return NextResponse.json({ error: { code, message, ...(issues && issues.length > 0 ? { issues } : {}) } }, { status });
}

/**
 * The response for anything a route threw. A DataError says what to tell the
 * caller. Anything else is a bug, and gets a plain 500: its message, which could
 * hold a database row, is neither returned nor logged.
 */
export function handleError(error: unknown): NextResponse {
  if (error instanceof DataError) return problem(error.status, error.code, error.message, error.issues);
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

export const issuesOf = (error: z.ZodError): Issue[] =>
  error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
