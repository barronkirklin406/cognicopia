import type { Facility, FacilityUser } from "@/lib/db/models";
import type { Db } from "./db";
import { fromDbError } from "./errors";

/**
 * Create a facility and become its admin, in one step. Only a signed-in user
 * with a confirmed email and no facility can; the database checks all of it.
 * Returns the new facility's id.
 */
export async function createFacility(db: Db, facilityName: string): Promise<string> {
  const { data, error } = await db.rpc("create_facility", { p_facility_name: facilityName });
  if (error) throw fromDbError(error);
  return data;
}

/** The caller's own membership: which facility, and as what. Null if they belong to none. */
export async function getMembership(db: Db, userId: string): Promise<FacilityUser | null> {
  const { data, error } = await db.from("facility_users").select("*").eq("id", userId).maybeSingle();
  if (error) throw fromDbError(error);
  return data;
}

/** The caller's own facility. Row level security means there is at most one to see. */
export async function getFacility(db: Db): Promise<Facility | null> {
  const { data, error } = await db.from("facilities").select("*").maybeSingle();
  if (error) throw fromDbError(error);
  return data;
}
