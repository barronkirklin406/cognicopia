#!/usr/bin/env node
/* =====================================================================
   The content catalog loader (assets/services/contentCatalog.js), in a
   real browser, against the real site files.

     - loadContentCatalog() reads /data/content-catalog.json from the page's
       own site and returns every record, valid and clean
     - a missing file, an address on another site and a damaged file each
       give the built-in catalog and a plain reason, never an exception
     - with the offline worker installed and the connection cut, the catalog
       is still read (from the worker's copy); with no worker and no
       connection, the built-in catalog stands in
     - it only ever asks the page's own site for one file

   Needs Playwright. Where it is missing this exits 2 and npm run build
   skips it. Run: node scripts/check-contentcatalog-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], foreign = [], errors = [], asked = []; let passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else problems.push(msg); };

try {
  const watch = (p) => {
    p.on("pageerror", e => errors.push(e.message));
    p.on("request", r => { const u = r.url(); if (/content-catalog|contentCatalog/.test(u)) asked.push(r.method() + " " + u.replace(base, "/")); if (!u.startsWith(base) && !u.startsWith("data:") && !u.startsWith("blob:")) foreign.push(u); });
  };
  const withLoader = async (ctx, file = "pricing.html") => { const p = await ctx.newPage(); watch(p); await p.goto(base + file); await p.addScriptTag({ url: base + "assets/services/contentCatalog.js" }); return p; };

  /* ---- online, no offline worker ---- */
  let ctx = await browser.newContext({ serviceWorkers: "block" });
  let p = await withLoader(ctx);
  const r = await p.evaluate(() => CogniContentCatalog.loadContentCatalog());
  ok(r.ok && r.source === "network" && !r.degraded && r.problems.length === 0 && r.rejected.length === 0, "the catalog is read from the site: " + JSON.stringify({ ok: r.ok, source: r.source, problems: r.problems }));
  ok(r.items.length >= 4 && r.version === "1.0.0" && r.attempts === 1, `${r.items.length} records, version ${r.version}, one try`);
  ok(r.items.some(i => i.item_id === "trivia_1950s_music_01") && r.items.every(i => ["Trivia", "WordSearch", "ReminiscencePrompt", "CognitiveTemplate"].includes(i.category)), "the records are the shipped ones");
  const sel = await p.evaluate(async () => { const c = await CogniContentCatalog.loadContentCatalog(); return CogniContentCatalog.selectItems(c.items, { category: "Trivia", tier: 3 }).map(i => i.item_id); });
  ok(sel.join() === "trivia_kitchen_icebox_02", "a page can pick records by category and tier");
  ok(asked.length >= 1 && asked.every(a => a === "GET /data/content-catalog.json" || a === "GET /assets/services/contentCatalog.js"), "it asked only for the one file, with GET: " + asked.join(" | "));

  /* ---- the ways it can go wrong ---- */
  const miss = await p.evaluate(() => CogniContentCatalog.loadContentCatalog({ url: "/data/not-there.json" }));
  ok(!miss.ok && miss.source === "fallback" && miss.problems[0].code === "not-found" && miss.items.length === 2 && miss.attempts === 1, "a missing file gives the built-in catalog and says not-found: " + JSON.stringify(miss.problems[0]));
  const other = await p.evaluate(() => CogniContentCatalog.loadContentCatalog({ url: "https://example.org/data/content-catalog.json" }));
  ok(!other.ok && other.attempts === 0 && other.problems[0].code === "address", "another site's address is refused without a request");
  const damaged = await p.evaluate(() => CogniContentCatalog.loadContentCatalog({ url: "/manifest.webmanifest.not-json-but-html.html" }));
  ok(!damaged.ok && ["not-found", "parse", "shape", "http"].includes(damaged.problems[0].code), "an address that is not a catalog gives the stand-in");
  const notJson = await p.evaluate(() => CogniContentCatalog.loadContentCatalog({ url: "/pricing.html" }));
  ok(!notJson.ok && notJson.problems[0].code === "parse" && notJson.items.length === 2, "a page that is not JSON is reported as damaged (parse), not a crash");
  const notCat = await p.evaluate(() => CogniContentCatalog.loadContentCatalog({ url: "/assets/coloring/manifest.json" }));
  ok(!notCat.ok && notCat.source === "fallback", "a JSON file that is not a catalog gives the stand-in");
  const own = await p.evaluate(() => CogniContentCatalog.loadContentCatalog({ url: "/data/not-there.json", fallback: [] }));
  ok(own.source === "fallback" && own.items.length === 0, "a page can ask for no stand-in");
  await ctx.close();

  /* ---- offline, no worker: the stand-in ---- */
  ctx = await browser.newContext({ serviceWorkers: "block" });
  p = await withLoader(ctx);
  await ctx.setOffline(true);
  const off = await p.evaluate(() => CogniContentCatalog.loadContentCatalog({ timeoutMs: 2000 }));
  ok(!off.ok && off.source === "fallback" && off.items.length === 2 && off.problems.some(x => x.code === "offline") && off.attempts === 2, "offline with no saved copy: the built-in catalog, said plainly: " + JSON.stringify(off.problems.map(x => x.code)));
  await ctx.close();

  /* ---- offline with the worker: the saved copy ---- */
  ctx = await browser.newContext({ serviceWorkers: "allow" });
  p = await ctx.newPage(); watch(p);
  await p.goto(base + "index.html");
  await p.evaluate(async () => { await navigator.serviceWorker.ready; });
  await p.waitForFunction(async () => { const ks = await caches.keys(); for (const k of ks) { const c = await caches.open(k); if (await c.match("/data/content-catalog.json")) return true; } return false; }, null, { timeout: 20000 });
  await p.addScriptTag({ url: base + "assets/services/contentCatalog.js" });
  await ctx.setOffline(true);
  const cached = await p.evaluate(() => CogniContentCatalog.loadContentCatalog({ timeoutMs: 5000 }));
  ok(cached.ok && cached.source === "network" && cached.items.length >= 4, "offline with the worker: the catalog still loads from the saved copy: " + JSON.stringify({ ok: cached.ok, problems: cached.problems }));
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}

if (foreign.length) problems.push("a request left the site: " + [...new Set(foreign)].slice(0, 3).join(" "));
if (errors.length) problems.push("page errors: " + [...new Set(errors)].slice(0, 5).join(" | "));
if (problems.length) { console.log(`content catalog check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")); process.exit(1); }
console.log(`content catalog check passed: ${passed} checks in a real browser (read from the site, a missing, foreign or damaged file gives the stand-in, offline works from the saved copy, one plain GET and nothing else)`);
