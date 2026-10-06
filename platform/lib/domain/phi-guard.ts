/**
 * The zero-PHI tripwire, in TypeScript.
 *
 * Cognicopia's server never stores protected health information. The data
 * model has no place for a resident, and this guard refuses JSON whose KEYS
 * name one ("residents", "patient_name", "dob", "diagnosis", "roomNumber").
 *
 * The same lists and the same rules are in the database, as
 * private.jsonb_phi_keys() in supabase/migrations/20261006120100_phi_guard.sql,
 * where they are enforced by a CHECK constraint no application code can skip.
 * This copy exists so the application can refuse a document early, with a clear
 * message, before it reaches the database. tests/db/phi-guard-parity.test.ts
 * runs both against the same keys and fails if they ever disagree.
 *
 * WHAT IT CANNOT DO: it judges keys, not text. A resident's name typed into a
 * free-text value passes. It is a tripwire for mistakes, one layer among
 * several (see docs/saas-platform-architecture.md), never proof that a
 * document is clean.
 */

/** Whole words. "residentName", "resident_name" and "Resident Name" all contain the word resident. */
export const PHI_KEY_WORDS = [
  "resident", "residents",
  "patient", "patients",
  "ssn", "mrn", "dob",
  "diagnosis", "diagnoses",
  "medication", "medications", "prescription", "prescriptions",
  "allergy", "allergies",
  "physician",
  "birthday", "birthdays",
  "insurance", "medicare", "medicaid",
  "email", "phone", "telephone", "address",
  "guardian", "surname", "nickname",
] as const;

/** Whole keys with their separators removed: names that identify only together ("first_name" is firstname). */
export const PHI_KEY_COMPACT = [
  "firstname", "lastname", "middlename", "fullname", "maidenname",
  "givenname", "familyname", "preferredname", "legalname",
  "dateofbirth", "birthdate", "birthday", "birthdays",
  "socialsecurity", "socialsecuritynumber",
  "medicalrecord", "medicalrecordnumber", "healthrecord", "healthrecordnumber",
  "roomnumber", "bednumber", "emergencycontact", "nextofkin",
] as const;

/** Keys are looked at to this depth, like the database function. Deeper documents are refused by size and depth limits. */
export const PHI_MAX_DEPTH = 16;

const WORDS: ReadonlySet<string> = new Set(PHI_KEY_WORDS);
const COMPACT: ReadonlySet<string> = new Set(PHI_KEY_COMPACT);

/** Does this one key name a resident, an identity or a health record? */
export function isPhiKey(key: string): boolean {
  // Split into lowercase words at separators and at camelCase boundaries (ASCII only, like the database).
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/);
  if (words.some((w) => WORDS.has(w))) return true;
  return COMPACT.has(key.toLowerCase().replace(/[^a-z0-9]/g, ""));
}

/** The keys in a JSON value, at any depth, that look like resident or health data. Each once, in order. */
export function findPhiKeys(value: unknown): string[] {
  const found = new Set<string>();
  const walk = (node: unknown, depth: number): void => {
    if (depth >= PHI_MAX_DEPTH || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (isPhiKey(key)) found.add(key);
      walk(child, depth + 1);
    }
  };
  walk(value, 0);
  return [...found].sort(); // a stable order, for stable messages
}

/** Thrown by assertNoPhiKeys. */
export class PhiKeyError extends Error {
  readonly keys: string[];
  constructor(keys: string[]) {
    super(
      `This data has a field that looks like resident or health information (${keys.join(", ")}). ` +
        "Planning data must not include residents, names or health details.",
    );
    this.name = "PhiKeyError";
    this.keys = keys;
  }
}

export function assertNoPhiKeys(value: unknown): void {
  const keys = findPhiKeys(value);
  if (keys.length > 0) throw new PhiKeyError(keys);
}
