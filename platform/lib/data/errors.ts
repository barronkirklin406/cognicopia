import type { Issue } from "@/lib/domain/result";

/** What Supabase returns when a query fails. */
export interface DbError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

/**
 * A failure the caller can show: an HTTP status, a stable code, a message safe
 * for a person to read. It never carries the database's own message or any row
 * data, so nothing a facility typed can leak into a response or a log.
 */
export class DataError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: Issue[] | undefined;

  constructor(status: number, code: string, message: string, issues?: Issue[]) {
    super(message);
    this.name = "DataError";
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

/**
 * Turn a database error into a DataError.
 *
 * Codes: standard Postgres SQLSTATEs, PostgREST's own (PGRST...), and five of
 * ours raised by the migrations: CG001 a facility must keep an admin, CG002 the
 * account already belongs to a facility, CG003 no confirmed email address, CG004
 * the invitation is not valid (unknown, used or expired), CG005 it was sent to a
 * different email address.
 */
export function fromDbError(error: DbError): DataError {
  const code = error.code ?? "";
  const text = `${error.message ?? ""} ${error.details ?? ""}`;

  switch (code) {
    case "28000":
    case "PGRST301":
    case "PGRST303":
      return new DataError(401, "unauthenticated", "Sign in to continue.");
    case "42501":
      return new DataError(403, "forbidden", "You do not have access to this.");
    case "CG001":
      return new DataError(409, "last_admin", "A facility must keep at least one admin. Make another member an admin first.");
    case "CG002":
      return new DataError(409, "already_member", "This account already belongs to a facility.");
    case "CG003":
      return new DataError(403, "email_not_confirmed", "Confirm your email address first.");
    case "CG004":
      return new DataError(410, "invite_invalid", "This invitation is no longer valid. Ask a facility admin for a new one.");
    case "CG005":
      return new DataError(403, "invite_wrong_email", "This invitation was sent to a different email address. Sign in with the address it was sent to.");
    case "54000":
      return new DataError(409, "too_many_invites", "There are too many open invitations. Cancel some first.");
    case "23505":
      return new DataError(409, "conflict", "That already exists.");
    case "23503":
      return new DataError(409, "conflict", "That refers to something that does not exist.");
    case "PGRST116":
      return new DataError(404, "not_found", "Not found.");
    case "23514":
      if (text.includes("no_phi_keys")) {
        return new DataError(
          422,
          "phi_keys",
          "This data has a field that looks like resident or health information. Planning data must not include residents, names or health details.",
        );
      }
      if (text.includes("generated_data_size")) {
        return new DataError(413, "too_large", "This calendar is too large.");
      }
      if (text.includes("generated_data_shallow")) {
        return new DataError(422, "too_deep", "This data is nested too deeply.");
      }
      return new DataError(422, "invalid", "Some of this data is not valid.");
    default:
      // Class 22: bad data (wrong type, bad enum value, invalid parameter).
      if (code.startsWith("22")) return new DataError(422, "invalid", "Some of this data is not valid.");
      return new DataError(500, "internal", "Something went wrong.");
  }
}
