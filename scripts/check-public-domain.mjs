#!/usr/bin/env node
/* =====================================================================
   One rule for every printed song line: public domain only.

   Song lyrics from the 1930s on are still under copyright, so a tool may print the words of a song or hymn only
   when the work was first published in 1930 or earlier (in the public domain in the United States since
   January 1, 2026) or is traditional. Anything newer appears by title, artist and year, never by its words.

   The tools used to state four different cut-off years, and two lists carried no years at all. This check reads
   every list of printed lines and holds each entry to the one rule:

     index.html                         LYRICS (Finish the Line): each entry ends with its year
     builder.html                       PD_SONGS (the sing-along sheets): year, decade or "Traditional"
     js/generators/activity-modules.js  the Studio's verse and song lines
     js/clinical-suite.js               PD_SONGS (the first line only)
     js/tabletBanks.js                  the song and hymn sayings, by B.SONG_YEARS

   Node built-ins only. Run: node scripts/check-public-domain.mjs
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath, pathToFileURL } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const LAST_YEAR = 1930;
let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
/* a year, a decade ("1870s"), a span ("Late 1800s") or the word traditional */
const free = y => { const t = String(y == null ? "" : y); if (/^traditional$/i.test(t.trim())) return true; const n = t.match(/\d{4}/); return !!n && Number(n[0]) + (/\d{4}s/.test(t) ? 9 : 0) <= LAST_YEAR; };
ok(free(1930) && !free(1931) && free("1870s") && !free("1930s") && free("Traditional") && !free("") && free("Late 1800s") && !free(1940), "self-test: the rule itself");

/* the front page: Finish the Line */
{
  const s = read("index.html"), i = s.indexOf("const LYRICS = ["), block = s.slice(i, s.indexOf("];", i));
  const rows = [...block.matchAll(/\["([^"]+)","([^"]+)","(hymn|song)"(?:,(\d{4}))?\]/g)];
  ok(rows.length >= 25, `index.html: the Finish the Line list was read (${rows.length} lines)`);
  ok(rows.length === (block.match(/^\s*\[/gm) || []).length - 1 || rows.length === (block.match(/^\s*\["/gm) || []).length, "index.html: every line of the list was understood");
  for (const r of rows) ok(r[4] && free(r[4]), `index.html: "${r[1]} ${r[2]}" has no year of ${LAST_YEAR} or earlier (${r[4] || "none"})`);
  ok(/published[^.]*1930 or earlier|1930 or earlier/.test(s.slice(i - 500, i)), "index.html: the list states the rule above it");
}

/* the Packet Builder: sing-along sheets */
{
  const s = read("builder.html"), i = s.indexOf("const PD_SONGS = ["), block = s.slice(i, s.indexOf("\n];", i));
  const songs = [...block.matchAll(/\{ title:"([^"]+)", decade:"([^"]*)", year:"([^"]*)"/g)];
  ok(songs.length >= 10 && songs.length === (block.match(/\{ title:"/g) || []).length, `builder.html: every sing-along song was read (${songs.length})`);
  for (const m of songs) ok(free(m[3]), `builder.html: "${m[1]}" is dated "${m[3]}", not ${LAST_YEAR} or earlier or Traditional`);
}

/* the Activity Page Studio */
{
  const ctx = vm.createContext({ console }); ctx.globalThis = ctx; ctx.window = ctx;
  for (const f of ["assets/coloring/subjects.bundle.js", "src/services/ColoringManifest.js", "src/engine/ColoringEngine.js", "src/engine/DescribeCreate.js", "js/residentContext.js",
    "js/generators/activity-engine.js", "js/generators/coloring-pipeline.js", "js/generators/activity-modules.js", "js/generators/activity-pages.js"]) vm.runInContext(read(f), ctx, { filename: f });
  const PD = ctx.CognicopiaActivityEngine.PUBLIC_DOMAIN;
  ok(PD && PD.verse.length >= 8 && PD.lyrics.length >= 8, "the Studio's verse and song lines were read");
  for (const v of PD.verse) ok(free(v[2]), `Studio verse "${String(v[0]).slice(0, 30)}" is dated ${v[2]}`);
  for (const l of PD.lyrics) ok(free(l[2]), `Studio song line "${String(l[0]).slice(0, 30)}" is dated ${l[2]}`);
}

/* the Page Toolkit */
{
  const K = await import(pathToFileURL(path.join(ROOT, "js/clinical-suite.js")).href);
  ok(K.PD_SONGS.length >= 5, "the Page Toolkit's songs were read");
  for (const sng of K.PD_SONGS) ok(free(sng.year), `Page Toolkit: "${sng.title}" is dated ${sng.year}`);
}

/* the Tablet's sayings */
{
  const ctx = vm.createContext({ console }); ctx.globalThis = ctx; ctx.window = ctx;
  vm.runInContext(read("js/tabletBanks.js"), ctx, { filename: "js/tabletBanks.js" });
  const B = ctx.CognicopiaTabletBanks, sung = B.SAYINGS.filter(x => x.kind === "song" || x.kind === "hymn");
  ok(sung.length >= 20, `the Tablet's song and hymn lines were read (${sung.length})`);
  for (const x of sung) ok(free(B.SONG_YEARS[x.lead]), `Tablet: "${x.lead} ${x.answer}" has no year of ${LAST_YEAR} or earlier in SONG_YEARS`);
  ok(Object.keys(B.SONG_YEARS).every(k => sung.some(x => x.lead === k)), "the Tablet's year list names no line that is not there");
}

console.log(problems.length ? `public domain check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `public domain check passed: ${passed} checks (every printed song or hymn line in five tools is from a work first published in ${LAST_YEAR} or earlier, or traditional)`);
process.exit(problems.length ? 1 : 0);
