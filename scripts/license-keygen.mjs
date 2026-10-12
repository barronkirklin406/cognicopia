#!/usr/bin/env node
/* =====================================================================
   Make the license-signing key pair. Run once, by the owner, on the
   owner's own computer:

     node scripts/license-keygen.mjs [--out ~/.cognicopia/license-private.pem]

   It writes the PRIVATE key to a file outside this repository (the default
   is ~/.cognicopia/license-private.pem, mode 600) and prints the PUBLIC key
   as one line to paste into PUBLIC_KEYS in src/config/license.js.

   The private key is the only thing that can make a license key. Keep a
   copy somewhere safe (a password manager); if it is lost, every license
   has to be issued again under a new pair. If it leaks, make a new pair,
   put the new public key in PUBLIC_KEYS, take the old one out, and issue
   fresh keys. It is never committed: the repository's .gitignore refuses
   *.pem and *-private.* files, and the build fails if a private key is
   found in a tracked file.

   Node built-ins only (crypto, fs, os, path).
   ===================================================================== */
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const out = path.resolve((flag("--out") || path.join(os.homedir(), ".cognicopia", "license-private.pem")).replace(/^~(?=$|\/)/, os.homedir()));

if (fs.existsSync(out)) {
  console.error(`Refusing to overwrite ${out}. Move it away first if you really mean to make a new pair.`);
  process.exit(1);
}
const here = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
if (out.startsWith(here + path.sep)) {
  console.error(`That path is inside the repository (${here}). Choose a place outside it, such as ~/.cognicopia/.`);
  process.exit(1);
}

const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
fs.mkdirSync(path.dirname(out), { recursive: true, mode: 0o700 });
fs.writeFileSync(out, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });

const jwk = publicKey.export({ format: "jwk" });
const hex = b64 => Buffer.from(b64, "base64url").toString("hex").padStart(64, "0");
const point = "04" + hex(jwk.x) + hex(jwk.y);

console.log(`Private key written to ${out} (keep it secret and backed up; never commit it).`);
console.log("");
console.log("Paste this line into PUBLIC_KEYS in src/config/license.js:");
console.log("");
console.log(`    PUBLIC_KEYS: Object.freeze(["${point}"]),`);
console.log("");
console.log("For the license service in platform/, set LICENSE_SIGNING_KEY to the contents of the private key file");
console.log("(only if you host the redeem route; see docs/stripe-setup-guide.md). Then: node scripts/issue-license.mjs --help");
