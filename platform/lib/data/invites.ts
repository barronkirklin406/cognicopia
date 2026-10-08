import type { FacilityRole } from "@/lib/db/models";
import type { Db } from "./db";
import { DataError, fromDbError } from "./errors";

/**
 * Invitations to join a facility (migration 5). Every call is made as the signed-in
 * person, so row level security and the functions' own checks decide what they may
 * do: an admin makes, lists and cancels their facility's invitations; anyone signed
 * in who holds a secret may preview and accept it.
 *
 * The secret is returned once, by createInvite, and is not stored. Only its hash
 * is, and the hash cannot be read back by anyone signed in.
 */

export interface InviteRow {
  id: string;
  email: string | null;
  role: FacilityRole;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

/** Make an invitation. Admins only. Returns the secret for the link. */
export async function createInvite(db: Db, input: { email: string | null; role: FacilityRole }): Promise<string> {
  const { data, error } = await db.rpc("create_facility_invite", {
    ...(input.email ? { p_email: input.email } : {}),
    p_role: input.role,
  });
  if (error) throw fromDbError(error);
  if (typeof data !== "string" || data === "") throw new DataError(500, "internal", "Something went wrong.");
  return data;
}

/** The facility's invitations, newest first. Admins only: for anyone else row level security shows none. */
export async function listInvites(db: Db): Promise<InviteRow[]> {
  const { data, error } = await db
    .from("facility_invites")
    .select("id, email, role, created_at, expires_at, accepted_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw fromDbError(error);
  return data;
}

/** Cancel an open invitation. A used one is kept as the record of who joined. Returns whether one was cancelled. */
export async function cancelInvite(db: Db, id: string): Promise<boolean> {
  const { data, error } = await db.from("facility_invites").delete().eq("id", id).select("id");
  if (error) throw fromDbError(error);
  return data.length > 0;
}

export interface InvitePreview {
  facility_name: string;
  role: FacilityRole;
  email_locked: boolean;
  email_matches: boolean;
}

/** What a link is for. Null when the secret is unknown, used or expired. */
export async function previewInvite(db: Db, token: string): Promise<InvitePreview | null> {
  const { data, error } = await db.rpc("preview_facility_invite", { p_token: token });
  if (error) throw fromDbError(error);
  return data[0] ?? null;
}

/** Join the facility the secret belongs to. Returns the facility's id. */
export async function acceptInvite(db: Db, token: string): Promise<string> {
  const { data, error } = await db.rpc("accept_facility_invite", { p_token: token });
  if (error) throw fromDbError(error);
  return data;
}
