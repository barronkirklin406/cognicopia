import type { FacilityRole } from "@/lib/db/models";
import type { Db } from "./db";
import { DataError, fromDbError } from "./errors";

/**
 * The facility's people and settings. Called as the signed-in person: row level
 * security lets everyone on the team see the team, and lets only an admin change
 * a member's role, remove a member, or rename the facility. A facility always
 * keeps an admin: removing or demoting the last one is refused by the database
 * (CG001).
 */

export interface Member {
  id: string;
  email: string;
  role: FacilityRole;
  created_at: string;
}

export async function listMembers(db: Db): Promise<Member[]> {
  const { data, error } = await db
    .from("facility_users")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw fromDbError(error);
  return data;
}

/** Change a member's role. Admins only: for anyone else the database finds nothing to change, and this says 403. */
export async function setMemberRole(db: Db, userId: string, role: FacilityRole): Promise<void> {
  const { data, error } = await db.from("facility_users").update({ role }).eq("id", userId).select("id");
  if (error) throw fromDbError(error);
  if (data.length === 0) throw new DataError(403, "forbidden", "You do not have access to this.");
}

/** Remove a member from the facility. Admins only. */
export async function removeMember(db: Db, userId: string): Promise<void> {
  const { data, error } = await db.from("facility_users").delete().eq("id", userId).select("id");
  if (error) throw fromDbError(error);
  if (data.length === 0) throw new DataError(403, "forbidden", "You do not have access to this.");
}

/** Rename the facility. Admins only; the name is the one thing a facility may change about itself. */
export async function renameFacility(db: Db, facilityId: string, name: string): Promise<void> {
  const { data, error } = await db.from("facilities").update({ facility_name: name }).eq("id", facilityId).select("id");
  if (error) throw fromDbError(error);
  if (data.length === 0) throw new DataError(403, "forbidden", "You do not have access to this.");
}
