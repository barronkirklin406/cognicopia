/* =====================================================================
   Signed license keys, made with the Web Crypto API (so the same file runs
   on Netlify, Cloudflare Workers, Vercel and Node, with nothing to install).

   A key is  COG1.<payload>.<signature>:
     payload    base64url of a small JSON object { v, f, t, e, i, n }
                (version, facility name, tier, paid-through date, issued date, license id)
     signature  base64url of the 64 bytes r||s: ECDSA P-256 over SHA-256 of the text "COG1.<payload>"

   It is the format scripts/issue-license.mjs and license-desk.html write by hand, and the browser
   checks it against the public key in src/config/license.js with no server
   (assets/services/licenseManager.js). A key holds a business name and two dates. It never holds a
   resident's name or any health detail.
   ===================================================================== */
export const LICENSE_TIERS = ["monthly_facility", "annual_facility", "enterprise"];

const enc = new TextEncoder();

function b64u(bytes) {
  const b = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Tidy a name from a checkout form: no control characters or angle brackets, single spaces, at most 120 characters. */
export function cleanFacilityName(raw) {
  return String(raw ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

/** The private key as a host setting can hold it: a PEM with real line breaks, a PEM on one line with \n, or bare base64. */
export function derOfKey(text) {
  const body = String(text ?? "").replace(/\\n/g, "\n").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/=]{60,}$/.test(body)) throw new Error("The signing key setting is not a private key.");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export async function importSigningKey(text) {
  return crypto.subtle.importKey("pkcs8", derOfKey(text), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

export function randomId() {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return "lic_" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** A license id that is the same for the same purchase every time, so withdrawing it withdraws every renewal too. */
export async function stableId(seed) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(String(seed))));
  return "lic_" + Array.from(h.slice(0, 8), (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function signLicense(input, keyText) {
  const facility = cleanFacilityName(input.facility);
  if (!facility) throw new Error("A license needs a facility name.");
  if (!LICENSE_TIERS.includes(input.tier)) throw new Error("Unknown license tier.");
  if (!/^\d{4}-\d\d-\d\d$/.test(input.until) || Number.isNaN(Date.parse(input.until))) throw new Error("The paid-through date must look like 2027-10-31.");
  const payload = { v: 1, f: facility, t: input.tier, e: input.until, i: input.issued ?? new Date().toISOString().slice(0, 10), n: input.id ?? randomId() };
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const key = await importSigningKey(keyText);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode("COG1." + body));
  return { token: `COG1.${body}.${b64u(signature)}`, payload };
}
