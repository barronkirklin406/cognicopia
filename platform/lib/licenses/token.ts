import "server-only";
import crypto from "node:crypto";

/**
 * Signed license keys for the static site (assets/services/licenseManager.js).
 *
 * A key is  COG1.<payload>.<signature>:
 *   payload    base64url of a small JSON object { v, f, t, e, i, n }
 *              (version, facility name, tier, paid-through date, issued date, license id)
 *   signature  base64url of the 64 bytes r||s: ECDSA P-256 over SHA-256 of the text "COG1.<payload>"
 *
 * It is the same format scripts/issue-license.mjs writes by hand for invoices, and the browser checks
 * it against the public key in src/config/license.js with no server. The private key (LICENSE_SIGNING_KEY)
 * is the only thing that can make one; it lives in this service's environment and nowhere else.
 * A key holds a business name and two dates. It never holds a resident's name or any health detail.
 */
export const LICENSE_TIERS = ["monthly_facility", "annual_facility", "enterprise"] as const;
export type LicenseTier = (typeof LICENSE_TIERS)[number];

export interface LicenseInput {
  /** The facility's business name, 1 to 120 characters. */
  facility: string;
  tier: LicenseTier;
  /** The date it is paid through, YYYY-MM-DD. */
  until: string;
  /** The day it was made, YYYY-MM-DD (default: today). */
  issued?: string;
  /** A stable id, for withdrawing a key later (REVOKED_IDS in src/config/license.js). */
  id?: string;
}

const b64u = (bytes: Buffer | string): string => Buffer.from(bytes).toString("base64url");

/** Tidy a name from a checkout form: no control characters or angle brackets, single spaces, at most 120 characters. */
export function cleanFacilityName(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

export function signLicense(input: LicenseInput, privatePem: string): { token: string; payload: Record<string, string | number> } {
  const facility = cleanFacilityName(input.facility);
  if (!facility) throw new Error("A license needs a facility name.");
  if (!LICENSE_TIERS.includes(input.tier)) throw new Error("Unknown license tier.");
  if (!/^\d{4}-\d\d-\d\d$/.test(input.until) || Number.isNaN(Date.parse(input.until))) throw new Error("The paid-through date must look like 2027-10-31.");
  const payload = {
    v: 1,
    f: facility,
    t: input.tier,
    e: input.until,
    i: input.issued ?? new Date().toISOString().slice(0, 10),
    n: input.id ?? "lic_" + crypto.randomBytes(8).toString("hex"),
  };
  const body = b64u(JSON.stringify(payload));
  const signature = crypto.sign("sha256", Buffer.from("COG1." + body, "ascii"), { key: privatePem, dsaEncoding: "ieee-p1363" });
  return { token: `COG1.${body}.${b64u(signature)}`, payload };
}
