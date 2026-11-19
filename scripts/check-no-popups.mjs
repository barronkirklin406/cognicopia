#!/usr/bin/env node
/* =====================================================================
   No browser pop-ups anywhere a person works (.claude/skills/cognicopia-visual-style: "no native alert, confirm or prompt"):
   every question and every notice is an in-page window (js/dialogs.js, CogniDialog). The browser's own windows are blocked in some embedded
   browsers (they answer "no" without showing anything), look like nothing else on the site and cannot be read at the size the site is set to.

   Scans the pages (root and resources/) and the scripts the pages load (js/, src/, assets/ except vendored libraries) for a call to
   alert(, confirm( or prompt( that is not a method of something else (CogniDialog.confirm is the replacement) and not inside a comment.
   Node built-ins only. Run: node scripts/check-no-popups.mjs
   ===================================================================== */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", ".git", "platform", "docs", ".claude", "vendor", "fonts", "tools", "license-service", "outreach", "scripts", "out"]);
const files = [];
function walk(dir, exts){
  for (const e of fs.readdirSync(dir, { withFileTypes: true })){
    if (SKIP.has(e.name) || e.name.startsWith(".next")) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, exts); else if (exts.includes(path.extname(e.name))) files.push(f);
  }
}
walk(ROOT, [".html", ".js", ".ts"]);
const CALL = /(?<![\w$.])(?:window\.|globalThis\.|self\.)?(alert|confirm|prompt)\s*\(|\b(?:window|globalThis|self)\.(alert|confirm|prompt)\s*\(/g;
const bad = []; let scanned = 0;
for (const f of files){
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  if (/jspdf|\.min\.|jsqr|bundle|vendor/.test(rel)) continue;
  let text = fs.readFileSync(f, "utf8"); scanned++;
  if (rel === "js/dialogs.js") continue;
  text = text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, a) => a + " ".repeat(m.length - a.length));
  CALL.lastIndex = 0; let m;
  while ((m = CALL.exec(text))){
    const line = text.slice(0, m.index).split("\n").length, src = text.split("\n")[line - 1].trim().slice(0, 100);
    const full = text.split("\n")[line - 1];
    if (full.length > 1500 || /\bfunction\s+(alert|confirm|prompt)\s*\(/.test(full)) continue;   // a minified library, or a function that is merely named so
    if (/["'`][^"'`]*$/.test(text.slice(text.lastIndexOf("\n", m.index) + 1, m.index)) && !/\)\s*$/.test(text.slice(text.lastIndexOf("\n", m.index) + 1, m.index))) continue;   // inside a string on that line
    bad.push(`${rel}:${line}: ${src}`);
  }
}
/* the check can tell: a made-up line is caught, and the replacement is not */
const probe = t => { CALL.lastIndex = 0; return CALL.test(t); };
const proofs = [probe("if (confirm('Sure?')) go();"), probe("window.alert('hi')"), !probe("await CogniDialog.confirm({})"), !probe("const confirmed = true")];
if (!proofs.every(Boolean)) bad.push("the check's own self-test failed");
/* no emoji on a button or a heading in the two big tools (.claude/skills/cognicopia-visual-style: "no emoji"; a picture a person must interpret is not a label) */
const EMO = /[\u{1F300}-\u{1FAFF}\u2600-\u2612\u2614-\u2712\u2714\u2716-\u27BF\u2B50\u2B1B\u2B1C\u2300-\u23FF]/u;
for (const rel of ["index.html", "builder.html"]){
  const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
  for (const m of text.matchAll(/<(button|h[1-4]|summary)\b[^>]*>([\s\S]{0,300}?)<\/\1>/g)){
    if (m[2].length < 300 && EMO.test(m[2])) bad.push(`${rel}: an emoji on ${m[1]}: ${m[2].replace(/\s+/g, " ").slice(0, 70)}`);
  }
}
console.log(bad.length ? `no-popups check FAILED: ${bad.length} problem(s) (the browser's own windows, or an emoji on a control)\n  - ` + bad.slice(0, 40).join("\n  - ") : `no-popups check passed: ${scanned} files, no alert, confirm or prompt, and no emoji on a button or heading in the two big tools`);
process.exit(bad.length ? 1 : 0);
