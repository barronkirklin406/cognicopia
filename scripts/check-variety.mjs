#!/usr/bin/env node
/* =====================================================================
   The variety memory, the era banks and the hybrid sheets (assets/services/variety.js, eraBanks.js, hybridSheets.js), in node:

     memory     every click gets its own seed, never the one before; the used list holds ids only, survives a reload (a fake localStorage),
                forgets on clear(), and works with storage blocked
     no repeat  a pool is used through before anything comes back: the first cycle holds no item twice, and the seam of the next cycle never
                repeats one of the last few
     banks      every entry has years and a unique id, no quiz, loss or violence wording (src/pcg/data/safety.json), every lyric row is
                from 1930 or earlier, slogans are short and listed for the owner's review, every picture named exists in the library, and
                a person born 1925 to 1965 has enough of every theme inside their years
     era        for births 1925 to 1965 every dated fact on a sheet is inside born + 7 to + 28; with no birth year the sheets mix decades
     sheets     six layouts, each with a picture, two or three staff tips (hand-under-hand, never hand-over-hand), consecutive sheets never
                alike, a topic to avoid never appears (and does appear when nothing is avoided)
   Node built-ins only. Run: node scripts/check-variety.mjs
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

function world(storage) {
  const ctx = vm.createContext({ console }); ctx.globalThis = ctx; ctx.window = ctx; ctx.self = ctx;
  if (storage === "fake") { const m = {}; ctx.localStorage = { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, _m: m }; }
  if (storage === "blocked") Object.defineProperty(ctx, "localStorage", { get() { throw new Error("blocked"); } });
  for (const f of ["assets/cognicopia-coloring/cognicopia-coloring.js", "assets/services/eraWindow.js", "assets/services/variety.js", "assets/services/eraBanks.js", "assets/services/hybridSheets.js"])
    vm.runInContext(read(f), ctx, { filename: f });
  return ctx;
}
function rng(seed) {
  let a = seed >>> 0;
  const n = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next: n, pick: l => l[Math.floor(n() * l.length)], shuffle: l => { const a2 = l.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(n() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; } };
}

/* ---------- memory ---------- */
{
  const w = world("fake"), V = w.CogniVariety;
  let prev = -1, same = 0; const seen = new Set();
  for (let i = 0; i < 2000; i++) { const s = V.clickSeed(); if (s === prev) same++; prev = s; seen.add(s); }
  ok(same === 0, "no two clicks in a row get the same seed");
  ok(seen.size > 1990, `the seeds are all different (${seen.size} of 2000)`);
  const pool = Array.from({ length: 20 }, (_, i) => ({ id: "i" + i })), R = rng(5), first = [];
  for (let i = 0; i < 20; i++) first.push(V.take(pool, "id", R, 1, { pool: "t" })[0].id);
  ok(new Set(first).size === 20, "the first cycle holds every item once, none twice");
  ok(JSON.stringify(V.used("t")) === JSON.stringify(first), "the list kept is the ids, oldest first");
  ok(Object.keys(w.localStorage._m).length === 1 && /^[\w\[\]{}",:.-]*$/.test(w.localStorage._m.cognicopia_variety), "only one key is kept, and it holds ids and numbers, no names");
  const next = []; for (let i = 0; i < 5; i++) next.push(V.take(pool, "id", R, 1, { pool: "t" })[0].id);
  ok(next.every(id => !first.slice(-5).includes(id)) && new Set(next).size === 5, "after the pool is used up, the seam does not repeat one of the last five");
  V.clear(); ok(V.used("t").length === 0 && !("cognicopia_variety" in w.localStorage._m), "clear() forgets everything");
  const w2 = world("blocked"), V2 = w2.CogniVariety; let thrown = null;
  try { const a = V2.take(pool, "id", rng(1), 3, { pool: "t" }); ok(a.length === 3 && V2.used("t").length === 3, "with storage blocked it still works for the visit"); V2.clickSeed(); } catch (e) { thrown = e; }
  ok(!thrown, "blocked storage does not throw: " + (thrown && thrown.message));
}

/* ---------- banks ---------- */
const w = world("fake"), B = w.CogniBanks, H = w.CogniHybrid, E = w.CogniEra, C = w.CognicopiaColoring, V = w.CogniVariety;
const safety = JSON.parse(read("src/pcg/data/safety.json")), banned = safety.banned.map(b => new RegExp(b.pattern, b.flags));
const LOSS = /\b(war|wars|death|dead|die|died|dying|kill|killed|killing|gun|guns|bomb|bombs|funeral|lonely|grave|cancer|stroke|hurt|pain|sick)\b/i;
const QUIZ = /\b(do you remember|can you recall|quiz|test your|guess|correct answer|wrong)\b/i;
const library = C.designs(), ids = new Set(library.map(d => d.id));
{
  ok(B.ALL.length >= 550, `the banks hold enough (${B.ALL.length} entries)`);
  const seenId = new Set();
  for (const e of B.ALL) {
    ok(!seenId.has(e.id), `duplicate id ${e.id}`); seenId.add(e.id);
    ok(Array.isArray(e.y) && e.y.length === 2 && e.y[0] >= 1750 && e.y[1] <= 1999 && e.y[0] <= e.y[1], `${e.id}: years ${JSON.stringify(e.y)}`);
    const words = [e.t, e.x, e.lead, e.end].filter(Boolean).join(" ");
    if (e.th !== "lyric") for (const re of banned) ok(!re.test(words), `${e.id}: "${words.slice(0, 60)}" breaks a safety rule (${re.source.slice(0, 30)})`);
    ok(!LOSS.test(words) && !QUIZ.test(words), `${e.id}: loss, violence or quiz wording in "${words.slice(0, 60)}"`);
    if (e.art) ok(ids.has(e.art), `${e.id}: the picture "${e.art}" is not in the library`);
    if (e.th === "slogan") { ok(e.t.split(/\s+/).length <= 9, `${e.id}: a slogan over nine words`); ok(e.review === true, `${e.id}: a slogan not marked for review`); }
    if (e.th === "pair") ok(e.pair && e.pair[0] && e.pair[1] && !new RegExp("\\b" + e.pair[0].split(" ")[0] + "\\b", "i").test(e.pair[1]), `${e.id}: a pair that shares a word`);
    if (e.th === "lyric") ok(e.y[0] <= 1930 && /^(hymn|song)$/.test(e.kind), `${e.id}: a lyric after 1930`);
  }
  ok(B.REVIEW.length === B.ALL.filter(e => e.th === "slogan").length && B.REVIEW.length >= 20, `the owner's review list holds every slogan (${B.REVIEW.length})`);
  const MIN = { movie: 15, star: 12, music: 20, band: 10, household: 20, pair: 15, milestone: 6, place: 15, trivia: 8 };
  for (let by = 1925; by <= 1965; by += 5)
    for (const [th, n] of Object.entries(MIN)) { const c = B.ALL.filter(e => e.th === th && B.fits(e, by)).length; ok(c >= n, `born ${by}: only ${c} ${th} entries inside their years (need ${n})`); }
  for (let by = 1935; by <= 1965; by += 5) ok(B.ALL.filter(e => e.th === "tv" && B.fits(e, by)).length >= 5, `born ${by}: too few television entries`);
  for (let by = 1925; by <= 1935; by += 5) ok(B.ALL.filter(e => e.th === "radio" && B.fits(e, by)).length >= 5, `born ${by}: too few radio entries`);
  for (let by = 1940; by <= 1965; by += 5) ok(B.ALL.filter(e => e.th === "slogan" && B.fits(e, by)).length >= 5, `born ${by}: too few slogans`);
}

/* ---------- the sheets ---------- */
const byId = Object.fromEntries(B.ALL.map(e => [e.id, e]));
const compose = (seed, o) => H.compose(Object.assign({ R: rng(seed), library, stage: "middle" }, o || {}));
{
  /* six layouts, a picture, tips */
  for (const lay of H.ORDER) {
    const s = compose(11, { born: 1940, layout: lay });
    ok(s.layout === lay && s.title === H.LAYOUTS[lay].title && !/staff/i.test(s.title), `${lay}: its own title`);
    ok(s.art && ids.has(s.art.id), `${lay}: has a picture from the library`);
    ok(s.tips.length >= 2 && s.tips.length <= 3 && s.tips.every(t => t.length > 30), `${lay}: two or three tips`);
    ok(s.tips.some(t => /hand-under-hand/i.test(t)) && s.tips.every(t => !/hand-over-hand|ensure|guarantee|prove/i.test(t)), `${lay}: a tracing tip says hand-under-hand and none claims too much`);
    ok(!/staff|tip:|clinical|therapy|dementia|alzheimer|gds|errorless/i.test(H.text(s)), `${lay}: nothing for staff or clinical on the resident's page: ${H.text(s).slice(0, 80)}`);
    ok(!QUIZ.test(H.text(s)) && !banned.some(re => re.test(H.text(s))), `${lay}: no quiz wording on the page`);
    if (lay === "match-color") ok(s.pairs && s.pairs.left.length >= 3 && s.pairs.left.every((l, i) => l !== s.pairs.right[i]), "match-color: no word sits beside its own partner");
    if (lay === "trace-sing") ok(s.lyric && s.lyric.lead && s.lyric.end, "trace-sing: a line with its last word");
  }
  const titles = H.ORDER.map(l => H.LAYOUTS[l].title); ok(new Set(titles).size === titles.length && !titles.includes("Color the Pattern"), "the six titles are unique and none is taken by another page");

  /* every dated fact is inside the person's years */
  let facts = 0;
  for (let by = 1925; by <= 1965; by += 3) for (let i = 0; i < 24; i++) {
    const s = compose(by * 100 + i, { born: by, layout: H.ORDER[i % 6], stage: ["early", "middle", "late"][i % 3] });
    for (const id of s.facts) { facts++; const e = byId[id]; ok(e && B.fits(e, by), `born ${by}: ${id} is outside their years`); }
  }
  ok(facts > 500, `the era check looked at ${facts} facts`);

  /* no birth year: a mix of decades */
  const dec = new Set(); const V0 = w.CogniVariety; V0.clear();
  for (let i = 0; i < 60; i++) { const s = compose(900 + i, { layout: ["hum-along", "look-back", "trace-talk"][i % 3] }); s.facts.forEach(id => dec.add(B.decadeOf(byId[id]))); }
  ok(dec.size >= 5, `with no birth year the sheets spread over ${dec.size} decades`);

  /* the chosen decades only */
  V0.clear();
  for (let i = 0; i < 30; i++) { const s = compose(300 + i, { decades: [1950, 1960], layout: "hum-along" }); s.facts.forEach(id => { const e = byId[id]; ok(e.y[1] >= 1950 && e.y[0] <= 1969, `decades 1950s and 60s: ${id} is outside them`); }); }

  /* consecutive sheets never alike; nothing comes back until the pool has been through */
  V0.clear();
  let prev = "", alike = 0; const spans = [], factsSeen = [];
  for (let i = 0; i < 300; i++) {
    const s = compose(V0.clickSeed(), { born: 1940, layout: H.ORDER[i % 6] }), t = H.text(s) + "|" + (s.art && s.art.id);
    if (t === prev) alike++; prev = t; factsSeen.push(...s.facts);
  }
  ok(alike === 0, "300 sheets in a row for one resident: no two in a row alike");
  const lyr = factsSeen.filter(id => /^lyr-/.test(id)); let early = 0;
  lyr.forEach((id, i) => { if (lyr.slice(Math.max(0, i - 7), i).includes(id)) early++; });
  ok(lyr.length >= 40 && early === 0 && new Set(lyr.slice(0, 30)).size === Math.min(30, lyr.length), `a song line did not come back within seven others (${lyr.length} lines, ${early} early repeats; the first 30 are all different)`);
  const art = new Set(); V0.clear(); for (let i = 0; i < 40; i++) art.add(compose(V0.clickSeed(), { born: 1940, layout: "trace-talk" }).art.id);
  ok(art.size >= 30, `forty trace-and-talk sheets used ${art.size} different pictures`);

  /* the topics to avoid */
  const avoid = t => /coca-cola|\bcoke\b|elvis/i.test(t); V0.clear(); let hit = 0, hitAvoided = 0;
  for (let i = 0; i < 400; i++) { const lay = ["hum-along", "trace-talk", "look-back"][i % 3];
    if (/coca-cola|\bcoke\b|elvis/i.test(H.text(compose(5000 + i, { born: 1945, layout: lay })))) hit++;
    if (/coca-cola|\bcoke\b|elvis/i.test(H.text(compose(5000 + i, { born: 1945, layout: lay, avoid })))) hitAvoided++; }
  ok(hit > 0 && hitAvoided === 0, `an avoided name never appears (it appears ${hit} times when nothing is avoided, ${hitAvoided} when it is)`);
}

console.log(problems.length ? `variety check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 40).join("\n  - ") : `variety check passed: ${passed} checks (the memory, ${B.ALL.length} banked entries, six hybrid layouts)`);
process.exit(problems.length ? 1 : 0);
