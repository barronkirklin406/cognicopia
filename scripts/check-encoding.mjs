#!/usr/bin/env node
/* =====================================================================
   Encoding check: every text file is clean UTF-8, and nothing in the site's
   own code is "mojibake" (UTF-8 that was read as Windows-1252 and saved
   again, so that é shows as Ã©, a degree sign as Â°, an arrow as â†’).

     every tracked text file   valid UTF-8, no byte-order mark
     every .html file          <meta charset="UTF-8"> is the first thing in <head>
     the site's own code       no double-encoded sequences

   Embedded libraries are not checked: they contain real Latin-1 and Unicode
   lookup tables that look like damage but are not. A line longer than
   LONG_LINE characters (minified code) and the files in VENDOR are skipped.
   A repaired character must also land in a range text really uses
   (Latin, punctuation, arrows, shapes, emoji), so a harmless pair such as
   "×…" inside a regular expression is not reported.

   Use:  node scripts/check-encoding.mjs            check the repository
         node scripts/check-encoding.mjs --selftest  plant faults, prove each is found
   Exit code 1 when there is a problem.
   ===================================================================== */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LONG_LINE = 3000;
const VENDOR = [/(^|\/)assets\/vendor\//, /jspdf/i, /\.min\.js$/, /\.bundle\.js$/, /(^|\/)node_modules\//, /(^|\/)package-lock\.json$/, /\.lock$/];
const BINARY = /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|otf|pdf|mp3|wav|zip|gz|svgz)$/i;
const CP1252_HIGH = { 0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178 };
const TO_BYTE = new Map(Object.entries(CP1252_HIGH).map(([b, cp]) => [cp, Number(b)]));
const byteOf = (ch) => { const c = ch.codePointAt(0); if (c < 0x100 && !(c >= 0x80 && c <= 0x9f && CP1252_HIGH[c] !== undefined)) return c; return TO_BYTE.has(c) ? TO_BYTE.get(c) : -1; };
const CONT = "[\\u0080-\\u00bf\\u0152\\u0153\\u0160\\u0161\\u0178\\u017d\\u017e\\u0192\\u02c6\\u02dc\\u2013\\u2014\\u2018\\u2019\\u201a\\u201c\\u201d\\u201e\\u2020\\u2021\\u2022\\u2026\\u2030\\u2039\\u203a\\u20ac\\u2122]";
const RUN = new RegExp("[\\u00c2-\\u00f4]" + CONT + "{1,3}", "g");
/* ranges text really uses once repaired */
const plausible = (cp) => (cp >= 0xa0 && cp <= 0x24f) || (cp >= 0x2000 && cp <= 0x206f) || (cp >= 0x2190 && cp <= 0x27bf) || (cp >= 0x2b00 && cp <= 0x2bff) || (cp >= 0x1f000 && cp <= 0x1faff) || cp === 0xfeff || cp === 0xfe0f || (cp >= 0x20a0 && cp <= 0x20cf) || (cp >= 0x2100 && cp <= 0x214f);

function repair(seg) {
  for (let n = Math.min(4, seg.length); n >= 2; n--) {
    const part = [...seg].slice(0, n), bytes = part.map(byteOf);
    if (bytes.some((b) => b < 0)) continue;
    try {
      const out = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
      const cp = out.codePointAt(0);
      if (out.length < part.join("").length && plausible(cp)) return { shown: part.join(""), repaired: out };
    } catch (e) { /* not valid UTF-8 at this length */ }
  }
  return null;
}

function checkTree(root, files) {
  const problems = [];
  for (const rel of files) {
    if (BINARY.test(rel)) continue;
    const full = path.join(root, rel); let raw;
    try { raw = fs.readFileSync(full); } catch (e) { continue; }
    if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) problems.push(`${rel}: starts with a byte-order mark (BOM)`);
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(raw); } catch (e) { problems.push(`${rel}: is not valid UTF-8`); continue; }
    if (/\.html$/i.test(rel)) {
      const head = /<head\b[^>]*>/i.exec(text);
      const rest = head ? text.slice(head.index + head[0].length).replace(/^(?:\s|<!--[\s\S]*?-->)*/, "") : "";
      if (!rest.startsWith('<meta charset="UTF-8">')) problems.push(`${rel}: <meta charset="UTF-8"> is not the first thing in <head>`);
    }
    if (VENDOR.some((v) => v.test(rel))) continue;
    text.split("\n").forEach((line, i) => {
      if (line.length > LONG_LINE) return;
      for (const m of line.matchAll(RUN)) { const r = repair(m[0]); if (r) problems.push(`${rel}:${i + 1}: "${r.shown}" should be "${r.repaired}"`); }
    });
  }
  return problems;
}

function selftest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-enc-"));
  const put = (n, b) => { fs.mkdirSync(path.dirname(path.join(dir, n)), { recursive: true }); fs.writeFileSync(path.join(dir, n), b); };
  const garble = (str) => Array.from(Buffer.from(str, "utf8"), (b) => String.fromCodePoint(CP1252_HIGH[b] !== undefined ? CP1252_HIGH[b] : b)).join("");   // UTF-8 bytes read as Windows-1252, as the real damage was made
  put("clean.html", '<!doctype html><html><head><meta charset="UTF-8"><title>Pokémon → °F ×</title></head><body>Café • …</body></html>');
  put("late.html", '<!doctype html><html><head><title>t</title><meta charset="UTF-8"></head><body></body></html>');
  put("lower.html", '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
  put("bom.js", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("var a = 1;\n")]));
  put("bad.js", Buffer.from([0x76, 0x61, 0x72, 0x20, 0x78, 0x3d, 0x22, 0xe9, 0x22]));               // a lone Latin-1 byte: not valid UTF-8
  put("garbled.js", 'var a = "' + garble("Pokémon") + '"; var b = "' + garble("72°F") + '"; var c = "' + garble("Next ▶") + '";\n');
  put("regex.js", 'var r = /[×… ]/g; var s = "×…";\n');                         // real characters that only look odd
  put("vendor/jspdf.min.js", 'var t = "' + garble("é") + '";\n');
  const files = fs.readdirSync(dir, { recursive: true }).filter((f) => fs.statSync(path.join(dir, f)).isFile()).map((f) => f.split(path.sep).join("/"));
  const found = checkTree(dir, files); fs.rmSync(dir, { recursive: true, force: true });
  const has = (file, needle) => found.some((p) => p.startsWith(file) && p.includes(needle));
  const expect = [["late.html", "first thing"], ["lower.html", "first thing"], ["bom.js", "byte-order mark"], ["bad.js", "not valid UTF-8"], ["garbled.js", '"é"'], ["garbled.js", '"°"'], ["garbled.js", '"▶"']];
  const missed = expect.filter((e) => !has(...e)), falseAlarms = found.filter((p) => /^(clean\.html|regex\.js|vendor\/)/.test(p));
  if (missed.length || falseAlarms.length) { console.error("self test FAILED"); missed.forEach((m) => console.error("  not found: " + m.join(" | "))); falseAlarms.forEach((f) => console.error("  false alarm: " + f)); process.exit(1); }
  console.log(`self test passed: ${expect.length} planted faults found; clean text, real "×…" and vendor code raised no alarm`);
}

if (process.argv.includes("--selftest")) selftest();
else {
  const root = path.resolve(HERE, "..");
  const files = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 }).split("\n").filter(Boolean);
  const problems = checkTree(root, files);
  if (problems.length) { console.error(`encoding check FAILED: ${problems.length} problem(s)`); problems.slice(0, process.argv.includes("--all") ? problems.length : 60).forEach((p) => console.error("  - " + p)); if (problems.length > 60) console.error(`  ...and ${problems.length - 60} more (run with --all to list every one)`); process.exit(1); }
  console.log(`encoding check passed: ${files.length} tracked files are valid UTF-8 with no byte-order mark, every page declares <meta charset="UTF-8"> first, and the site's own code has no double-encoded text`);
}
