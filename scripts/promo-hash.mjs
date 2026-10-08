#!/usr/bin/env node
/* =====================================================================
   Prints the value to paste into src/config/license.js for a promo code.
     node scripts/promo-hash.mjs "YOUR-NEW-CODE"
   The code is trimmed and upper-cased first, exactly as the page does
   when someone types it, so "your-new-code " and "YOUR-NEW-CODE" are one
   code. Only the SHA-256 goes into the site; the code itself never does.
   Choose something long and unguessable: a hash cannot protect a code
   that can be guessed.
   ===================================================================== */
import { createHash } from "crypto";
const code = process.argv.slice(2).join(" ").trim().toUpperCase();
if (!code){ console.error('Usage: node scripts/promo-hash.mjs "YOUR-NEW-CODE"'); process.exit(1); }
console.log(createHash("sha256").update(code).digest("hex"));
