#!/usr/bin/env node
/* =====================================================================
   The three pages on the front page's laptop, made by Cognicopia's own engines.

   index.html shows a laptop whose screen can show three things Cognicopia makes. None is a drawing of what the tool
   might make: each is what the engine makes for one made-up resident (Ruth, born 1938, who likes gardening, big-band
   music and a river town, at the middle stage, on 1 October 2026), laid out the way the printed page is.

     Reminiscence card   a conversation card from the reminiscence engine (assets/services/reminiscenceEngine.js): an
                         invitation, three ways in, a song from the years she remembers best, something to hold
     Word search         the packet engine's word search (src/pcg): a true square grid, the words to find
     Memory timeline     her years, from the same engine's own "reminiscence bump" (about ages 10 to 30) and the years of
                         the songs on her cards

     node scripts/landing-example.mjs           write the three screens into index.html
     node scripts/landing-example.mjs --check   fail if the page no longer matches the engines (part of npm run build)

   The pictures live between the two lp-example comments in index.html, one SVG each, so they scale as a picture and
   nothing in them reflows. If an engine changes what it makes for this resident, --check fails; run this script
   without a flag to bring the page up to date. Node built-ins only.
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const START = "<!-- lp-example:start -->", END = "<!-- lp-example:end -->";
const TODAY = new Date(2026, 9, 1);

/* ---------- the engines, loaded the way a page loads them ---------- */
const pcgCtx = vm.createContext({ console });
["assets/pcg/pcg-data.bundle.js", "src/pcg/prng.js", "src/pcg/matrix.js", "src/pcg/grammar.js", "src/pcg/puzzles.js", "src/pcg/packet.js"]
  .forEach(f => vm.runInContext(read(f), pcgCtx, { filename: f }));
const remCtx = vm.createContext({ console }); remCtx.globalThis = remCtx; remCtx.window = remCtx;
vm.runInContext(read("assets/services/reminiscenceEngine.js"), remCtx, { filename: "assets/services/reminiscenceEngine.js" });

/* a made-up resident: the rail on every screen says "EXAMPLE RESIDENT" */
const RESIDENT = { first: "Ruth", born: 1938, interests: "gardening, big-band music, a river town", stage: "middle" };
const PROFILE = { id: "landing-example-ruth", tier1_core: { preferredName: "Ruth", cognitiveTier: 2, occupation: { code: "teacher" }, topHobbies: [{ code: "gardening" }], topicsToAvoid: { topics: [] } },
  tier2_enrichment: { birthYear: 1938, hometown: { place: "Dubuque, IA", environment: "small_town" } } };
const packet = pcgCtx.CognicopiaPCG.generate(RESIDENT, { date: TODAY });
const ws = packet.pages[0];
const deck = remCtx.CogniReminiscence.deck(PROFILE, { count: 6, today: TODAY, seed: "1" });
const who = deck.person, cards = deck.cards;
const card = cards.filter(c => c.topic === "in-the-garden")[0] || cards[0];
const cardNo = cards.indexOf(card) + 1;
const PAGES = packet.pages.slice(0, 5).map(p => p.title.replace(/^For Staff:.*/, "For Staff"));

/* ---------- drawing helpers: one SVG, 1000 x 625 (16:10), every size a number so nothing is left to the browser ---------- */
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const t = (x, y, s, cls, extra = "") => `<text x="${x}" y="${y}" class="${cls}"${extra ? " " + extra : ""}>${esc(s)}</text>`;
const wrap = (text, n) => { const out = []; let line = ""; for (const w of String(text).split(" ")) { if ((line + " " + w).trim().length > n) { out.push(line); line = w; } else line = (line + " " + w).trim(); } if (line) out.push(line); return out; };
const W = 1000, H = 625, BAR = 48, STRIP = 34, RAIL = 230, TOP = BAR + STRIP;
const PW = 395, PH = 511, PX = RAIL + (W - RAIL - PW) / 2, PY = TOP + (H - TOP - PH) / 2;   // a Letter page (8.5 x 11) and a 3.75 x 4.85 card are both 0.773
const CX = PX + PW / 2, L = PX + 35, R = PX + PW - 23, CW = R - L;                                   // 0.75 in binding side, 0.5 in margin, at 46.5 units to the inch

function chrome(status, listTitle, items, current, label) {
  let s = `<svg class="lp-xw" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" focusable="false">` +
    `<rect width="${W}" height="${H}" class="xw-bg"/>` +
    `<rect width="${W}" height="${BAR}" class="xw-bar"/>` + t(24, 31, "Cognicopia", "xw-brand") + t(CX + 115, 31, "Today's packet for Ruth", "xw-title", 'text-anchor="middle"') +
    `<rect x="${W - 124}" y="8" width="100" height="32" rx="8" class="xw-go"/>` + t(W - 74, 30, "Print", "xw-gotxt", 'text-anchor="middle"') +
    `<rect y="${BAR}" width="${W}" height="${STRIP}" class="xw-strip"/>` + t(24, BAR + 23, status, "xw-status") + t(W - 24, BAR + 23, "Stays on this computer", "xw-status", 'text-anchor="end"') +
    `<rect x="0" y="${TOP}" width="${RAIL}" height="${H - TOP}" class="xw-rail"/><line x1="${RAIL}" y1="${TOP}" x2="${RAIL}" y2="${H}" class="xw-rule"/>` +
    t(24, TOP + 36, "EXAMPLE RESIDENT", "xw-cap") + t(24, TOP + 72, "Ruth", "xw-who") + t(24, TOP + 96, "Born 1938 · Middle stage", "xw-small");
  ["Gardening", "Big-band music", "A river town"].forEach((c, i) => { const w = Math.round(c.length * 8.4 + 26), y = TOP + 112 + i * 32; s += `<rect x="24" y="${y}" width="${w}" height="26" rx="13" class="xw-chip"/>` + t(24 + w / 2, y + 18, c, "xw-chiptxt", 'text-anchor="middle"'); });
  s += t(24, TOP + 238, listTitle, "xw-cap");
  items.forEach((n, i) => { const y = TOP + 252 + i * 34, on = i === current; s += (on ? `<rect x="12" y="${y}" width="${RAIL - 24}" height="30" rx="8" class="xw-sel"/>` : "") + t(26, y + 21, n, on ? "xw-item xw-on" : "xw-item"); });
  return s + `<rect x="${RAIL}" y="${TOP}" width="${W - RAIL}" height="${H - TOP}" class="xw-desk"/>`;
}
const paperHead = (page, title, ins) => `<rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" class="xw-paper"/>` +
  t(L, PY + 32, "Ruth", "xw-hd") + t(R, PY + 32, page, "xw-hd xw-hdr", 'text-anchor="end"') + `<line x1="${L}" y1="${PY + 42}" x2="${R}" y2="${PY + 42}" class="xw-line"/>` +
  t(CX + (L - PX - (PX + PW - R)) / 2, PY + 84, title, "xw-h1", 'text-anchor="middle"') + (ins ? ins.map((ln, i) => t(CX + (L - PX - (PX + PW - R)) / 2, PY + 110 + i * 20, ln, "xw-ins", 'text-anchor="middle"')).join("") : "");
const MID = L + CW / 2;

/* ---------- 1. the reminiscence card ---------- */
function screenCard() {
  const tint = "#f3e6b3";                                                                          // the "Family" card tint (js/era-decks.js)
  let s = chrome("Reminiscence cards · Card " + cardNo + " of " + cards.length + " · Large print", "SIX CARDS FOR RUTH", cards.map(c => c.title), cardNo - 1,
    "Example screen: a reminiscence card made for Ruth, “" + card.title + "”, with an invitation to talk, three ways in, a song from her years and something to hold.");
  s += `<rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="18" class="xw-paper"/><rect x="${PX + 9}" y="${PY + 9}" width="${PW - 18}" height="${PH - 18}" rx="12" class="xw-cardedge"/>`;
  s += t(CX, PY + 46, "REMINISCENCE CARD " + cardNo + " OF " + cards.length, "xw-cap", 'text-anchor="middle"') + t(CX, PY + 88, card.title, "xw-h1", 'text-anchor="middle"');
  s += `<rect x="${PX + 28}" y="${PY + 106}" width="${PW - 56}" height="50" rx="10" fill="${tint}"/>` + t(CX, PY + 138, card.invite, "xw-invite", 'text-anchor="middle"');
  s += t(PX + 32, PY + 190, "THREE WAYS IN", "xw-cap");
  let y = PY + 216;
  card.starters.forEach(st => { s += `<circle cx="${PX + 38}" cy="${y - 5}" r="3.5" class="xw-dot"/>`; wrap(st, 36).forEach((ln, i) => { s += t(PX + 52, y, ln, "xw-body"); y += 22; }); y += 6; });
  y += 4; s += `<line x1="${PX + 32}" y1="${y - 14}" x2="${PX + PW - 32}" y2="${y - 14}" class="xw-hair"/>`;
  s += t(PX + 32, y + 12, "A SONG FROM HER YEARS", "xw-cap") + t(PX + 32, y + 38, card.song.title, "xw-song") + t(PX + 32, y + 58, card.song.artist + " · " + card.song.year, "xw-small");
  y += 84; s += t(PX + 32, y + 8, "SOMETHING TO HOLD", "xw-cap");
  wrap(card.touch.prompt, 40).forEach((ln, i) => { s += t(PX + 32, y + 32 + i * 21, ln, "xw-body"); });
  return s + `</svg>`;
}

/* ---------- 2. the word search ---------- */
function screenSearch() {
  const n = ws.size, rows = ws.rows;
  let s = chrome("Page 1 of 5 · Word Search · Large print", "THE FIVE PAGES", PAGES, 0, "Example screen: a Word Search page made for Ruth, a square grid of " + n + " by " + n + " letters with " + ws.list.length + " words to find: " + ws.list.join(", ").toLowerCase() + ".");
  s += paperHead("Page 1 of 5", ws.title, wrap(ws.instruction, 44));
  const cell = 36, gx = MID - n * cell / 2, gy = PY + 128;
  let g = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) g += `<rect x="${gx + c * cell}" y="${gy + r * cell}" width="${cell}" height="${cell}" class="xw-cell"/>` + t(gx + c * cell + cell / 2, gy + r * cell + 26, rows[r].charAt(c), "xw-letter", 'text-anchor="middle"');
  s += g + `<rect x="${gx}" y="${gy}" width="${n * cell}" height="${n * cell}" class="xw-frame"/>`;
  const wy = gy + n * cell + 30;
  s += t(L, wy, "Words to find", "xw-head");
  ws.list.forEach((w, i) => { s += t(L + (i % 3) * (CW / 3), wy + 28 + Math.floor(i / 3) * 24, w, "xw-word"); });
  return s + `</svg>`;
}

/* ---------- 3. the memory timeline ---------- */
function screenTimeline() {
  const songs = cards.map(c => c.song).filter((v, i, a) => a.findIndex(x => x.id === v.id) === i).sort((a, b) => a.year - b.year);
  const rowsT = [{ year: who.birthYear, head: "Ruth is born", sub: "Born " + who.birthYear, kind: "mile" }, { year: who.bump[0], head: "Ten years old", sub: "The years she remembers best begin", kind: "mile" }]
    .concat(songs.map(sg => ({ year: sg.year, head: sg.title, sub: sg.artist, kind: "song" })), [{ year: who.bump[1], head: "Thirty years old", sub: "Those years, in her own words", kind: "mile" }]);
  const ins = wrap("People remember the years from about 10 to 30 most readily. These songs were new then.", 46);
  let s = chrome("Memory timeline · Built from her birth year and her six cards", "BUILT FROM", ["Her birth year, " + who.birthYear, "Ages 10 to 30", "Songs of those years"], -1,
    "Example screen: a memory timeline made for Ruth, born " + who.birthYear + ", marking the years " + who.bump[0] + " to " + who.bump[1] + " she remembers best and the songs that were new then: " + songs.map(x => x.title + " (" + x.year + ")").join(", ") + ".");
  s += paperHead("Her years", "Ruth’s Years", ins);
  const lx = L + 76, y0 = PY + 154, gap = Math.min(34, Math.floor(280 / (rowsT.length - 1)));
  const yOf = i => y0 + i * gap, bumpTop = rowsT.findIndex(r => r.year === who.bump[0]), bumpBot = rowsT.findIndex(r => r.year === who.bump[1]);
  s += `<rect x="${lx - 13}" y="${yOf(bumpTop) - 4}" width="26" height="${yOf(bumpBot) - yOf(bumpTop) + 8}" rx="13" class="xw-bump"/><line x1="${lx}" y1="${yOf(0)}" x2="${lx}" y2="${yOf(rowsT.length - 1)}" class="xw-axis"/>`;
  rowsT.forEach((r, i) => { const y = yOf(i);
    s += t(lx - 22, y + 5, r.year, "xw-year", 'text-anchor="end"') + `<circle cx="${lx}" cy="${y}" r="${r.kind === "mile" ? 8 : 6}" class="${r.kind === "mile" ? "xw-node xw-node-m" : "xw-node"}"/>` + t(lx + 24, y - 2, r.head, "xw-tl-h") + t(lx + 24, y + 15, r.sub, "xw-tl-s"); });
  const ly = PY + PH - 36;
  s += `<rect x="${L}" y="${ly - 12}" width="26" height="16" rx="8" class="xw-bump"/>` + t(L + 36, ly + 1, "Ages 10 to 30: remembered most vividly", "xw-small");
  return s + `</svg>`;
}

const screens = [screenCard(), screenSearch(), screenTimeline()];
const block = START + "\n" + screens.map((svg, i) => `<div class="lp-panel" role="tabpanel" id="lpPanel${i + 1}" aria-labelledby="lpTab${i + 1}"${i ? " hidden" : ""}>${svg}</div>`).join("\n") + "\n" + END;

/* ---------- write or check ---------- */
const sound = [];
if (!ws.rows.every(r => r.length === ws.rows.length) || ws.size !== ws.rows.length) sound.push("the word search is not a true square");
ws.list.forEach(w => { if (!ws.placed.some(p => p.word === w)) sound.push("the word " + w + " is not placed in the grid"); });
cards.forEach(c => [c.invite].concat(c.starters, [c.touch.prompt]).forEach(x => { if (remCtx.CogniReminiscence.toneProblems(x).length) sound.push("tone problem in: " + x); }));
if (who.bump[1] - who.bump[0] !== 20) sound.push("the reminiscence window is not 20 years");
const file = path.join(ROOT, "index.html"), html = fs.readFileSync(file, "utf8");
const a = html.indexOf(START), b = html.indexOf(END);
if (a < 0 || b < a) { console.error("landing example: index.html has no lp-example comments to fill"); process.exit(1); }
const next = html.slice(0, a) + block + html.slice(b + END.length);
if (sound.length) { console.error("landing example FAILED: what the engines made is not sound:\n  - " + sound.join("\n  - ")); process.exit(1); }
if (process.argv.includes("--check")) {
  if (next !== html) { console.error("landing example FAILED: the pages on the front page's laptop are not what the engines make for the example resident.\n  Run: node scripts/landing-example.mjs"); process.exit(1); }
  console.log(`landing example check passed: the front page's three screens are the engines' own (a ${ws.size} x ${ws.size} word search with ${ws.list.length} words, the card "${card.title}", a timeline of ${who.bump[0]} to ${who.bump[1]} with ${cards.length} songs)`);
} else if (next === html) console.log("landing example: already current");
else { fs.writeFileSync(file, next); console.log("landing example: written"); }
