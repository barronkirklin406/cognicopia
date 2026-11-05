#!/usr/bin/env node
/* =====================================================================
   Claims check: keeps wording the product cannot back out of every
   published page and text a person can read in the tools.

   Compliance belongs to a facility's program, not to software, so the
   site says "supports" and "no resident data leaves the device", never
   "inherently HIPAA compliant". See docs/blueprint-decisions.md (D1).

   Scans: the pages (root and resources/), the TypeScript services and
   their built scripts (the text the tools print), and the tool scripts.
   Docs and guidance files are left out on purpose: they have to be able
   to quote the phrases they forbid.

   A phrase that is only wrong when asserted ("HIPAA compliant") is allowed
   in a sentence that denies it ("does not make a facility HIPAA compliant").

   Run: node scripts/check-claims.mjs         Node built-ins only.
   ===================================================================== */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/* wrong however it is used */
const NEVER = [
  [/inherently\s+HIPAA/i, "\"inherently HIPAA compliant\" (compliance belongs to a facility's program)"],
  [/HIPAA[- ]?(certified|approved|endorsed)/i, "\"HIPAA certified\" (there is no such certification)"],
  [/military[- ]grade/i, "\"military-grade\" security"],
  [/unhackable|un-hackable/i, "\"unhackable\""],
  [/100\s?%\s+(secure|safe)\b/i, "\"100% secure\""],
  [/\b(survey|audit)[- ]proof\b/i, "\"survey-proof\" or \"audit-proof\""],
  [/\bEngaging Todays\b/, "\"Engaging Todays\" (the line is \"Engaging Today\")"],
  [/Kirk Barron|Kirklin/, "a person's name (the pages speak as Cognicopia, made by BarronCrafts)"]
];
/* wrong when asserted, fine when denied in the same sentence */
const UNLESS_DENIED = [
  [/HIPAA[- ]compliant/i, "\"HIPAA compliant\""],
  [/\bCMS[- ]compliant\b/i, "\"CMS compliant\""],
  [/(ensures?|guarantees?|assures?) (full |complete )?(regulatory |HIPAA |CMS )?compliance/i, "\"ensures compliance\""],
  [/(directly )?satisf(y|ies) (the )?(HIPAA|CMS|F\d{3})/i, "\"satisfies\" a regulation"]
];
const DENIAL = /\b(not|never|no|nor|neither|cannot|can't|isn't|aren't|doesn't|don't|without|rather than|nothing)\b/i;

export function scanText(text){
  const found = [];
  for (const [re, what] of NEVER){ const m = re.exec(text); if (m) found.push({ what, at: m.index }); }
  for (const [re, what] of UNLESS_DENIED){
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m;
    while ((m = g.exec(text))){
      const start = Math.max(text.lastIndexOf(".", m.index), text.lastIndexOf("\n", m.index), m.index - 140);
      if (!DENIAL.test(text.slice(start + 1, m.index))) found.push({ what, at: m.index });
    }
  }
  return found;
}

/* ---------- the rules, tried on sentences whose answer is known ---------- */
const problems = []; let passed = 0;
const ok = (c, msg) => { if (c) passed++; else problems.push(msg); };
ok(scanText("Cognicopia is inherently HIPAA compliant by design.").length > 0, "self-test: the blueprint's claim is caught");
ok(scanText("It is HIPAA compliant.").length > 0, "self-test: a plain claim is caught");
ok(scanText("A HIPAA certified product").length > 0, "self-test: HIPAA certified is caught");
ok(scanText("Engaging Todays").length > 0, "self-test: the tagline typo is caught");
ok(scanText("It ensures compliance with F679.").length > 0, "self-test: ensures compliance is caught");
ok(scanText("It supports a facility’s privacy practices, but it does not by itself make a facility HIPAA compliant.").length === 0, "self-test: a denial is allowed");
ok(scanText("No resident data leaves the device. It supports a facility's HIPAA privacy practices.").length === 0, "self-test: the approved wording is allowed");
ok(scanText("The site does not claim to be CMS compliant.").length === 0, "self-test: a denied claim is allowed");
ok(scanText("Contact Kirk Barron").length > 0 && scanText("Contact Cognicopia").length === 0, "self-test: a personal name is caught, the brand is not");

/* ---------- the files ---------- */
const SKIP_DIR = new Set(["node_modules", ".git", "out", "platform", "docs", ".claude", "vendor", "fonts"]);
function walk(dir, exts, out){
  for (const e of fs.readdirSync(dir, { withFileTypes: true })){
    if (SKIP_DIR.has(e.name) || e.name.startsWith(".next")) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, exts, out);
    else if (exts.includes(path.extname(e.name))) out.push(f);
  }
  return out;
}
const files = [];
for (const f of fs.readdirSync(ROOT)) if (f.endsWith(".html")) files.push(path.join(ROOT, f));
walk(path.join(ROOT, "resources"), [".html"], files);
walk(path.join(ROOT, "src"), [".ts", ".js"], files);
walk(path.join(ROOT, "assets"), [".js"], files);
const strip = s => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, m => /^<script/i.test(m) && !/src=/.test(m.slice(0, 200)) ? m : " ");  // keep inline script text (the tools print from it); drop styles
let scanned = 0;
for (const f of files){
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  if (/jspdf|\.min\./.test(rel)) continue;
  const text = strip(fs.readFileSync(f, "utf8")); scanned++;
  const hits = scanText(text);
  if (rel.endsWith(".html") && /Minot, (North Dakota|ND)/.test(text)) hits.push({ what: "the maker's city (pages name Cognicopia and BarronCrafts, not a place)", at: text.search(/Minot, (North Dakota|ND)/) });
  if (hits.length) hits.forEach(h => problems.push(`${rel}: ${h.what}: "${text.slice(Math.max(0, h.at - 40), h.at + 70).replace(/\s+/g, " ")}"`));
  else passed++;
}
ok(scanned > 40, `scanned ${scanned} files (expected well over 40)`);

console.log(problems.length ? `claims check FAILED: ${problems.length} problem(s)\n  - ` + problems.join("\n  - ") : `claims check passed: ${passed} checks (${scanned} files)`);
process.exit(problems.length ? 1 : 0);
