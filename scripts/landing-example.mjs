#!/usr/bin/env node
/* =====================================================================
   The crossword on the front page's laptop, made by the packet engine.

   index.html shows a laptop with the packet tool's "Fit the Words In"
   page on its screen. That page is not a drawing of what the tool might
   make: it is what src/pcg makes for a made-up resident (Ruth, born 1938,
   who likes gardening, big-band music and a river town) at the middle
   stage on 1 October 2026, laid out the way the printed page is (numbered
   grid with the first letters given, the clues, the box of words).

     node scripts/landing-example.mjs           write the picture into index.html
     node scripts/landing-example.mjs --check   fail if the page no longer matches the engine
                                                (part of npm test and npm run build)

   The picture lives between the two lp-example comments in index.html.
   If the engine changes what it makes for this resident, --check fails;
   run this script without a flag to bring the picture up to date.
   Node built-ins only.
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const START = "<!-- lp-example:start -->", END = "<!-- lp-example:end -->";

/* ---------- the engine, loaded the way a page loads it ---------- */
const ctx = vm.createContext({ console });
["assets/pcg/pcg-data.bundle.js", "src/pcg/prng.js", "src/pcg/matrix.js", "src/pcg/grammar.js", "src/pcg/puzzles.js", "src/pcg/packet.js"]
  .forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
const RESIDENT = { first: "Ruth", born: 1938, interests: "gardening, big-band music, a river town", stage: "middle" };
const packet = ctx.CognicopiaPCG.generate(RESIDENT, { date: new Date(2026, 9, 1) });
const page = packet.pages[2];
if (!page || !page.crossword) { console.error("landing example: the engine made no crossword for the example resident"); process.exit(1); }
const cw = page.crossword, cells = cw.cells, R = cells.length, C = cells[0].length;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------- the screen: one SVG, so it scales as a picture and nothing in it reflows ---------- */
const wrap = (text, n) => { const out = []; let line = ""; for (const w of text.split(" ")) { if ((line + " " + w).trim().length > n) { out.push(line); line = w; } else line = (line + " " + w).trim(); } if (line) out.push(line); return out; };
const t = (x, y, s, cls, extra = "") => `<text x="${x}" y="${y}" class="${cls}"${extra ? " " + extra : ""}>${esc(s)}</text>`;

const GX = 302, GY = 212, CELL = 38;
const starts = {}; cw.entries.forEach(e => { const k = e.r + "," + e.c; if (!starts[k]) starts[k] = { num: e.num, letter: e.word.charAt(0) }; });
let grid = "";
for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
  if (cells[r].charAt(c) === ".") continue;
  const x = GX + c * CELL, y = GY + r * CELL, st = starts[r + "," + c];
  grid += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" class="xw-cell"/>`;
  if (st) grid += t(x + 3, y + 12, st.num, "xw-num") + (page.firstLetters ? t(x + CELL / 2, y + 28, st.letter, "xw-let", 'text-anchor="middle"') : "");
}

const CX = GX + C * CELL + 24; let cy = GY + 18, clues = "";
for (const [dir, label] of [["A", "Across"], ["D", "Down"]]) {
  const list = cw.entries.filter(e => e.dir === dir).sort((a, b) => a.num - b.num);
  if (!list.length) continue;
  clues += t(CX, cy, label, "xw-head"); cy += 24;
  for (const e of list) { wrap(e.num + ". " + e.clue, 33).forEach((ln, i) => { clues += t(CX + (i ? 16 : 0), cy, ln, "xw-clue"); cy += 19; }); cy += 4; }
  cy += 14;
}

const bank = page.bank.map((w, i) => t(302 + (i + 0.5) * (596 / page.bank.length), 558, w, "xw-bank", 'text-anchor="middle"')).join("");
const rail = ["Word Search", "Finish the Thought", "Fit the Words In", "Color Page", "For Staff"].map((n, i) =>
  (i === 2 ? `<rect x="12" y="${104 + i * 48}" width="190" height="40" rx="8" class="xw-sel"/>` : "") + t(24, 130 + i * 48, (i + 1) + "  " + n, i === 2 ? "xw-rail xw-on" : "xw-rail")).join("");

const svg = `<svg class="lp-xw" viewBox="0 0 1000 625" focusable="false" data-example="Ruth, born 1938, middle stage, 1 October 2026" data-cells="${esc(cells.join("|"))}" data-bank="${esc(page.bank.join(" "))}">` +
  `<rect width="1000" height="625" class="xw-bg"/>` +
  `<rect width="1000" height="52" class="xw-bar"/><line x1="0" y1="52" x2="1000" y2="52" class="xw-rule"/>` +
  `<circle cx="26" cy="26" r="6" class="xw-dot"/><circle cx="46" cy="26" r="6" class="xw-dot"/><circle cx="66" cy="26" r="6" class="xw-dot"/>` +
  t(500, 32, "Ruth · Today's packet", "xw-title", 'text-anchor="middle"') +
  `<rect x="860" y="12" width="118" height="28" rx="8" class="xw-go"/>` + t(919, 31, "Print", "xw-gotxt", 'text-anchor="middle"') +
  `<rect x="0" y="53" width="214" height="572" class="xw-rail-bg"/><line x1="214" y1="53" x2="214" y2="625" class="xw-rule"/>` +
  t(26, 88, "THE FIVE PAGES", "xw-small") + rail +
  t(26, 500, "Ruth, born 1938", "xw-who") + t(26, 524, "Gardening", "xw-small2") + t(26, 544, "Big-band music", "xw-small2") + t(26, 564, "A river town", "xw-small2") +
  `<rect x="274" y="78" width="660" height="620" class="xw-shadow"/><rect x="270" y="72" width="660" height="620" class="xw-paper"/>` +
  t(302, 108, "Ruth", "xw-hd") + t(898, 108, "Page 3 of 5", "xw-hd", 'text-anchor="end"') + `<line x1="302" y1="118" x2="898" y2="118" class="xw-line"/>` +
  t(600, 162, page.title, "xw-h1", 'text-anchor="middle"') + t(600, 190, page.instruction, "xw-ins", 'text-anchor="middle"') +
  grid + clues +
  t(302, 514, "Box of words", "xw-head") + `<rect x="302" y="522" width="596" height="56" class="xw-box"/>` + bank +
  `</svg>`;
const block = `${START}\n${svg}\n${END}`;

/* ---------- write or check ---------- */
const file = path.join(ROOT, "index.html"), html = fs.readFileSync(file, "utf8");
const a = html.indexOf(START), b = html.indexOf(END);
if (a < 0 || b < a) { console.error("landing example: index.html has no lp-example comments to fill"); process.exit(1); }
const next = html.slice(0, a) + block + html.slice(b + END.length);
if (process.argv.includes("--check")) {
  if (next !== html) { console.error("landing example FAILED: the crossword on the front page's laptop is not what the engine makes for the example resident.\n  Run: node scripts/landing-example.mjs"); process.exit(1); }
  const words = cw.entries.map(e => e.word);
  const bad = words.filter(w => !page.bank.includes(w));
  if (bad.length || cw.entries.length < 4) { console.error("landing example FAILED: the example crossword is not sound"); process.exit(1); }
  console.log(`landing example check passed: the front page's crossword is the engine's own (${words.length} words, ${C} x ${R} grid, ${cw.crossings} crossings)`);
} else {
  if (next === html) console.log("landing example: already current");
  else { fs.writeFileSync(file, next); console.log(`landing example: written (${words(cw)} )`); }
}
function words(c) { return c.entries.map(e => e.word).join(" "); }
