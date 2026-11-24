#!/usr/bin/env node
/* =====================================================================
   One era rule for every tool: a person's formative years are birth year + 7 to + 28 (assets/services/eraWindow.js,
   .claude/skills/cognicopia-clinical-dignity), proved with made-up birth years from 1920 to 1965.

     module        the window and its three parts; a dated event is kept only when its years touch the window (a woman born in 1946 never
                   meets ration books, one born in 1938 does)
     reminiscence  the engine's remembered years are birth + 7 to + 28 for every birth year, and the songs and dated things on a card
                   are inside them whenever the engine has any (the song list ends in the 1970s, so a person born after 1950 may be
                   offered the nearest songs it has; those are counted and shown, not hidden)
     studio        Songs of my years, The year I turned twenty and the dated "look back" and timeline events (the Activity Page Studio) stay
                   inside the window for every birth year from 1920 to 1950; later births are checked for the same where the data reaches
     packet        the packet tool's (packet.html) decade lists never offer a line whose event is outside the window (ration books for a
                   1946 birth), and "Around ... age" lines are 8, 12 and 20 only
     fallback      the generators' own copy of the numbers (used on a page that has not loaded the module) is the same 7 and 28

   Made-up people only. Needs Playwright for the packet part (skipped, with a note, where it is missing). Run: node scripts/check-era-window.mjs
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const problems = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

/* ---------- the module ---------- */
const eraCtx = vm.createContext({ console }); eraCtx.window = eraCtx; vm.runInContext(read("assets/services/eraWindow.js"), eraCtx, { filename: "eraWindow.js" });
const Era = eraCtx.CogniEra;
{
  const w = Era.windowFor(1946);
  ok(w && w.from === 1953 && w.to === 1974 && w.childhood.join() === "1953,1958" && w.teen.join() === "1959,1966" && w.young.join() === "1967,1974", "windowFor(1946) is 1953 to 1974, with its childhood, teen and young-adult parts");
  ok(Era.windowFor("") === null && Era.windowFor(0) === null && Era.windowFor("nope") === null, "an unknown birth year has no window");
  ok(Era.inWindow(1953, 1946) && Era.inWindow(1974, 1946) && !Era.inWindow(1952, 1946) && !Era.inWindow(1975, 1946), "inWindow includes both ends and nothing else");
  ok(Era.overlaps(1942, 1947, 1938) && !Era.overlaps(1942, 1947, 1946) && Era.overlaps(1950, 1953, 1946), "a span of years counts when it touches the window");
  ok(Era.decadesFor(1946)[0] === 1960 && Era.decadesFor(1946).join() === "1960,1950,1970" && Era.decadesFor(1938)[0] === 1950, "the decade nearest the middle of the window comes first");
  ok(!Era.datedOk("ration books were part of everyday life", 1946) && Era.datedOk("ration books were part of everyday life", 1938) && !Era.datedOk("RATION", 1950), "ration books: not for a 1946 or 1950 birth, yes for 1938");
  ok(!Era.datedOk("the Beatles and Motown were on the record player", 1925) && Era.datedOk("the Beatles and Motown were on the record player", 1946), "the Beatles: not for a 1925 birth, yes for 1946");
  ok(Era.datedOk("the radio was the center of the living room", 1946) && Era.datedOk("anything at all", 0), "a general line stays, and an unknown birth year filters nothing");
}

/* ---------- the engines, in node ---------- */
const ctx = vm.createContext({ console }); ctx.globalThis = ctx; ctx.window = ctx;
const FILES = ["assets/coloring/subjects.bundle.js", "src/services/ColoringManifest.js", "src/engine/ColoringEngine.js", "src/engine/DescribeCreate.js", "assets/services/eraWindow.js", "assets/services/reminiscenceEngine.js", "js/residentContext.js",
  "js/generators/activity-engine.js", "js/generators/coloring-pipeline.js", "js/generators/activity-modules.js", "js/generators/activity-pages.js", "js/generators/activity-life-data.js", "js/generators/activity-life.js", "js/utils/facility-validator.js"];
for (const f of FILES) vm.runInContext(read(f), ctx, { filename: f });
const E = ctx.CognicopiaActivityEngine, R = ctx.CogniResident, RE = ctx.CogniReminiscence, M = ctx.CognicopiaColoringManifest;
M.loadSync();
ok(!!ctx.CogniEra, "the engines see the shared module");

const profileOf = by => ({ schema: R.SCHEMA, version: 2, id: "res-" + by,
  tier1_core: { preferredName: "Pat", cognitiveTier: 1, occupation: { code: "farmer", label: "Farmer" }, topHobbies: [{ code: "gardening", label: "Gardening" }], topicsToAvoid: { topics: [], eras: [], people: "", places: "", other: "" } },
  tier2_enrichment: { birthYear: by, hometown: { place: "Velva, North Dakota" }, music: { genres: [], artists: [], favoriteSong: "" } }, tier3_deep: { notes: "", milestones: [], signatureDish: {}, comforts: [], people: [] } });
const strings = v => typeof v === "string" ? [v] : typeof v === "number" ? [String(v)] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];
const inW = (y, by) => y >= by + 7 && y <= by + 28;

let songsOutside = [], studioOutside = [], refsOutside = [];
for (let by = 1920; by <= 1965; by++) {
  /* the reminiscence engine */
  const d = RE.deck(profileOf(by), { count: 12, seed: "era" });
  ok(d.person.bump[0] === by + 7 && d.person.bump[1] === by + 28, `${by}: the engine's remembered years are ${by + 7} to ${by + 28} (${d.person.bump})`);
  const songYears = d.cards.map(c => c.song && c.song.year).filter(Boolean);
  const out = songYears.filter(y => !inW(y, by)); if (out.length) songsOutside.push(by + ":" + out.length + "/" + songYears.length);
  for (const c of d.cards) for (const ref of (c.refs || [])) { const m = /\((19\d\d)\)|\bnew in (19\d\d)|\bof (19\d\d)\b/.exec(ref), y = m ? +(m[1] || m[2] || m[3]) : 0; if (y && y > by + 28) refsOutside.push(by + ": " + ref); }   // a film or thing from before the window is still around in it (its years run on); one from after the window is not
  /* the Studio: songs, the year they turned twenty, the dated events of a look back and a timeline */
  const P = { stage: 1, dexterity: "steady", name: "Pat", born: by, vocation: "farmer" };
  const songs = E.generate(P, { module: "songs", count: 3, seed: 3 }).sheets.flatMap(sh => strings((sh.blocks || []).filter(b => b.kind === "list")));
  const sy = songs.map(x => { const m = /\((\d{4})\)$/.exec(x); return m ? +m[1] : 0; }).filter(Boolean);
  if (sy.some(y => !inW(y, by))) studioOutside.push(by + " songs");
  const tw = E.generate(P, { module: "twenty", count: 2, seed: 3 }).sheets.flatMap(sh => (sh.blocks || []).filter(b => b.kind === "moments").flatMap(b => b.items.map(i => i.year)));
  if (tw.some(y => !inW(y, by))) studioOutside.push(by + " twenty:" + tw.filter(y => !inW(y, by)).join("/"));
  for (const mod of ["wordgrid", "timeline"]) {
    const sheets = E.generate(P, { module: mod, count: 3, seed: 3 }).sheets;
    const years = sheets.flatMap(sh => strings(sh)).flatMap(t => { const m = /^(?:In )?(1[89]\d\d|20[0-2]\d)\b/.exec(t); return m ? [+m[1]] : []; });
    if (mod === "timeline" && years.some(y => y >= 1900 && !inW(y, by))) studioOutside.push(by + " timeline:" + years.filter(y => !inW(y, by)).join("/"));
  }
}
/* the song list ends in the 1970s: births up to 1950 have a full window of songs, so nothing outside is allowed for them */
const hardSongs = songsOutside.filter(s => +s.split(":")[0] <= 1950);
ok(hardSongs.length === 0, `reminiscence cards: no song outside the years 7 to 28 for births 1920 to 1950 (${hardSongs.join(", ")})`);
ok(refsOutside.length === 0, `reminiscence cards: no dated thing from after the years 7 to 28 end (${refsOutside.slice(0, 3).join(" | ")})`);
const hardStudio = studioOutside.filter(s => +s.split(" ")[0] <= 1950);
ok(hardStudio.length === 0, `the Studio: songs, the year they turned twenty and timeline events stay inside the years 7 to 28 for births 1920 to 1950 (${hardStudio.join(", ")})`);
console.log(`  born after 1950, where the data thins: songs outside the window on ${songsOutside.filter(s => +s.split(":")[0] > 1950).length} of 15 births; Studio ${studioOutside.filter(s => +s.split(" ")[0] > 1950).length}`);

/* ---------- the packet tool's own lists, in a real browser ---------- */
let browser = null, loadPlaywright, serve, agreed;
try { ({ loadPlaywright, serve, agreed } = await import("./lib/browser.mjs")); } catch (e) { /* no helper */ }
let PW = null; try { PW = loadPlaywright && loadPlaywright(); } catch (e) { PW = null; }
if (!PW) console.log("  note: Playwright is not installed here, so the packet tool's lists were not read in a browser");
else {
  const { srv, base } = await serve();
  browser = await PW.chromium.launch();
  try {
    const c = await browser.newContext({ serviceWorkers: "block" }); await agreed(c);
    const p = await c.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto(base + "packet.html"); await p.waitForTimeout(600);
    const out = await p.evaluate(() => {
      const rows = [];
      for (let by = 1920; by <= 1965; by++) {
        const text = [];
        for (const f of ["words", "talk", "name"]) text.push(...eraBits(by, f));
        for (const f of ["words", "life", "music", "screen"]) text.push(...popBits(by, f));
        for (const f of ["culture", "autos", "technology", "printToys", "slang", "cities", "radio", "music", "screen", "venues", "happy", "events", "celebrations"]) text.push(...historicalBits(by, f));
        text.push(...eraOk(by, ERA[eraKey(by)]), ...birthCohortBits(by));
        rows.push({ by, text: text.join(" | "), cohort: birthCohortBits(by).map(x => /age (\d+)/.exec(x)[1]) });
      }
      return rows;
    });
    const bad = out.filter(r => (r.by >= 1943 && /ration/i.test(r.text)) || (r.by >= 1950 && /\bvictory garden\b/i.test(r.text)));
    ok(bad.length === 0, `the packet tool: no ration books or victory gardens for a birth after 1942/1949 (${bad.map(r => r.by).join(", ")})`);
    ok(out.find(r => r.by === 1938).text.length > 200 && out.every(r => r.text.length > 100), "and every birth year still has plenty to talk about");
    ok(out.every(r => r.cohort.join() === "8,12,20" || (r.cohort.length < 3 && r.cohort.every(a => ["8", "12", "20"].includes(a)))), "the birth-cohort lines are for ages 8, 12 and 20 only (35 is outside the years 7 to 28)");
    ok(await p.evaluate(() => eraDecades(1946).join() === "1960,1950,1970".split(",").filter(d => ERA_EXTRA[d]).join()), "eraDecades follows the window");
    ok(errs.length === 0, "no page script fails: " + errs.slice(0, 2));
  } finally { await browser.close(); srv.close(); }
}

/* ---------- the generators' own copy of the numbers ---------- */
for (const f of ["js/generators/activity-life.js", "js/generators/activity-modules.js"]) ok(!/born \+ (10|15|20|30|35)\b.*widen/i.test(read(f)), `${f}: no stray old window`);
ok(/born \+ 7\b/.test(read("js/generators/activity-life.js")) && /born \+ 28\b/.test(read("js/generators/activity-life.js")), "the Studio's fallback is 7 and 28, the same as the module");

console.log(problems.length ? `era window check FAILED: ${problems.length} problem(s)\n  - ` + problems.join("\n  - ") : `era window check passed: ${passed} checks`);
process.exit(problems.length ? 1 : 0);
