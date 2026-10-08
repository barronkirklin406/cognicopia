import { z } from "zod";
import { FACILITY_ROLES } from "@/lib/db/models";

/**
 * Invitations, as the app sees them: what an admin may ask for, and what a link
 * looks like. The database checks all of it again (migration 5).
 */

/** An email address typed into a form: trimmed, lower case, and plausible. Empty means "not tied to an address". */
const OptionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "That email address is too long.")
  .refine((value) => value === "" || /^[^@\s]+@[^@\s]+$/.test(value), "Enter a valid email address, or leave it empty.")
  .transform((value) => (value === "" ? null : value));

export const CreateInviteSchema = z.object({
  email: OptionalEmail,
  role: z.enum(FACILITY_ROLES),
});

/** The secret in an invitation link: 64 lower-case hex characters. */
export const InviteTokenSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{64}$/, "This invitation link is not valid.");

/** The address an admin shares. The secret is the only thing in it. */
export function inviteLink(appUrl: string, token: string): string {
  return `${appUrl}/join?token=${token}`;
}

/** What is said about an invitation that is still open, so an admin can tell them apart. */
export type InviteState = "open" | "used" | "expired";

export function inviteState(invite: { accepted_at: string | null; expires_at: string }, now: Date = new Date()): InviteState {
  if (invite.accepted_at) return "used";
  return new Date(invite.expires_at).getTime() <= now.getTime() ? "expired" : "open";
}
