import { z } from "zod";
import type { FacilityRole } from "@/lib/db/models";

/** A facility's name: 1 to 120 characters once trimmed, as the database requires. */
export const FacilityNameSchema = z.string().trim().min(1, "Enter the facility's name.").max(120, "Use 120 characters or fewer.");

/** Only admins manage a facility and its team. (The database enforces this too; this is for the screen.) */
export const canManageFacility = (role: FacilityRole | null | undefined): boolean => role === "admin";
