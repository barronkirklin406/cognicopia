#!/usr/bin/env node
/* =====================================================================
   The Cognicopia favicon (the black cornucopia from the top bar).

     files    assets/favicon-16.png, favicon-32.png, favicon-48.png, assets/apple-touch-icon.png (180) and favicon.ico are real images of the
              right size, black ink on white, and not blank
     pages    every page the site publishes links the 32 and 16 pixel icons, favicon.ico and the touch icon, so no page falls back to the
              browser's default globe; no page uses the large logo photo or a stray file as its icon
     offline  the offline cache holds the icons
   Node built-ins only.
   ===================================================================== */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

const png = f => { const b = fs.readFileSync(path.join(ROOT, f)); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), sig: b.subarray(0, 8).toString("hex"), size: b.length }; };
for (const [f, px] of [["assets/favicon-16.png", 16], ["assets/favicon-32.png", 32], ["assets/favicon-48.png", 48], ["assets/apple-touch-icon.png", 180]]) {
  const i = png(f);
  ok(i.sig === "89504e470d0a1a0a" && i.w === px && i.h === px, `${f} is a ${px} by ${px} PNG (${i.w} by ${i.h})`);
  ok(i.size > 300, `${f} is not blank (${i.size} bytes)`);
}
const ico = fs.readFileSync(path.join(ROOT, "favicon.ico"));
ok(ico.readUInt16LE(0) === 0 && ico.readUInt16LE(2) === 1 && ico.readUInt16LE(4) >= 2, "favicon.ico is an icon file holding at least two sizes");

const skip = /^(platform|license-service|node_modules|docs|assets|out|\.git)\//;
const pages = [];
(function walk(d) { for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { const rel = path.posix.join(d, e.name); if (e.isDirectory()) { if (!skip.test(rel + "/") && e.name !== "node_modules" && e.name !== ".git") walk(rel); } else if (e.name.endsWith(".html")) pages.push(rel); } })(".");
ok(pages.length > 30, `the check found the site's pages (${pages.length})`);
for (const f of pages) {
  const h = fs.readFileSync(path.join(ROOT, f), "utf8"); if (!h.includes("</head>")) continue;
  ok(/<link rel="icon"[^>]*favicon-32\.png"/.test(h) && /<link rel="icon"[^>]*favicon-16\.png"/.test(h) && /rel="shortcut icon" href="[^"]*favicon\.ico"/.test(h) && /rel="apple-touch-icon"[^>]*apple-touch-icon\.png"/.test(h), `${f}: links the Cognicopia favicon`);
  ok(!/<link rel="icon"[^>]*cognicopia-logo\.jpg/.test(h) && !/rel="apple-touch-icon" href="[^"]*icon-192\.png"/.test(h), `${f}: no older icon link is left beside it`);
}
const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
ok(["assets/favicon-16.png", "assets/favicon-32.png", "assets/apple-touch-icon.png", "favicon.ico"].every(f => sw.includes(`"${f}"`)), "the offline cache holds the icons");

if (problems.length) { console.error("favicon check FAILED: " + problems.length + " problem(s), " + passed + " passed"); problems.forEach(x => console.error("  - " + x)); process.exit(1); }
console.log("favicon check passed: " + passed + " checks (the icon files, a link on every page, the offline cache)");
