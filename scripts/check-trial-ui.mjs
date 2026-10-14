#!/usr/bin/env node
/* =====================================================================
   The free-packet counter, in a real browser, against the real storage.

   check-trial.mjs proves the logic with pretend storage. This opens the
   packet tool and the Packet Builder and tries the things a person (or a
   browser clean-up) really does to the three copies of the count:

     - types a smaller number into the page's own storage
     - deletes the page's setting
     - deletes the page setting AND the IndexedDB copy (the cache copy brings it back)
     - deletes the page setting AND the cache copy (the IndexedDB copy brings it back)
     - clears everything: a new count starts (the stated limit, asserted so it is never forgotten)

   Also: the two tools share one count, the browser is asked only once to
   keep the data, the gate still opens at 25, and nothing is requested
   from outside the page's own site.

   Needs Playwright; where it is missing this exits 2 and npm run build
   skips it. Run: node scripts/check-trial-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], foreign = [], errors = []; let passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else problems.push(msg); };
const settle = p => p.waitForTimeout(400);

try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
  await ctx.addInitScript(() => {                                   // count the browser's persistence requests without changing its answer
    window.__persistAsks = 0;
    try { const s = navigator.storage, real = s.persist.bind(s); s.persist = () => { window.__persistAsks++; return real(); }; } catch (e) { /* no storage manager */ }
  });
  const open = async (file = "index.html") => {
    const p = await ctx.newPage();
    p.on("pageerror", e => errors.push(file + ": " + e.message));
    p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith("data:") && !u.startsWith("blob:")) foreign.push(u); });
    await p.goto(base + file); await p.waitForFunction(() => typeof genCount === "function" && window.CogniTrialLedger, null, { timeout: 15000 });
    await settle(p);
    return p;
  };
  const stored = p => p.evaluate(async () => {
    const out = { page: localStorage.getItem("cognicopia_gen_count"), idb: null, cache: null };
    try { out.idb = await new Promise(res => { const q = indexedDB.open("cg_trial", 1); q.onsuccess = () => { const g = q.result.transaction("k").objectStore("k").get("n"); g.onsuccess = () => { q.result.close(); res(g.result === undefined ? null : String(g.result)); }; g.onerror = () => res(null); }; q.onerror = () => res(null); q.onupgradeneeded = () => {}; }); } catch (e) { /* none */ }
    try { const c = await caches.open("cg-trial-v1"); const ks = await c.keys(); out.cache = ks.length ? ks.map(k => k.url.split("/").pop()).join(",") : null; } catch (e) { /* none */ }
    return out;
  });

  /* ---- a new computer, and three packets ---- */
  let p = await open();
  ok(await p.evaluate(() => genCount()) === 0, "a new browser has used no free packets");
  await p.evaluate(() => { bumpGen(); bumpGen(); bumpGen(); }); await settle(p);
  let s = await stored(p);
  ok(s.page === "3" && s.idb === "3" && s.cache === "3", "three packets are written to the page setting, IndexedDB and Cache Storage: " + JSON.stringify(s));
  ok(await p.evaluate(() => window.__persistAsks) === 1, "the browser is asked once to keep the data (" + await p.evaluate(() => window.__persistAsks) + " asks for 3 packets)");

  /* ---- type a smaller number ---- */
  await p.evaluate(() => localStorage.setItem("cognicopia_gen_count", "0"));
  ok(await p.evaluate(() => genCount()) === 3, "a smaller number typed into the page's storage is ignored at once");
  await p.evaluate(() => localStorage.setItem("cognicopia_gen_count", "0")); await p.close();
  p = await open();
  ok(await p.evaluate(() => genCount()) === 3, "and after a reload the count is still 3");
  ok((await stored(p)).page === "3", "and the page setting has been put back");

  /* ---- delete the page setting ---- */
  await p.evaluate(() => localStorage.removeItem("cognicopia_gen_count")); await p.close();
  p = await open();
  ok(await p.evaluate(() => genCount()) === 3, "deleting the page's setting does not return the free packets");

  /* ---- delete the page setting and IndexedDB: Cache Storage remains ---- */
  await p.evaluate(async () => { localStorage.removeItem("cognicopia_gen_count"); await new Promise(res => { const q = indexedDB.deleteDatabase("cg_trial"); q.onsuccess = q.onerror = q.onblocked = () => res(); }); }); await p.close();
  p = await open();
  ok(await p.evaluate(() => genCount()) === 3, "deleting the page setting and IndexedDB: the Cache Storage copy brings it back");
  s = await stored(p); ok(s.page === "3" && s.idb === "3", "and both deleted copies are rebuilt: " + JSON.stringify(s));

  /* ---- delete the page setting and the cache copy: IndexedDB remains ---- */
  await p.evaluate(async () => { localStorage.removeItem("cognicopia_gen_count"); await caches.delete("cg-trial-v1"); }); await p.close();
  p = await open();
  ok(await p.evaluate(() => genCount()) === 3, "deleting the page setting and the cache copy: the IndexedDB copy brings it back");
  s = await stored(p); ok(s.cache === "3", "and the cache copy is rebuilt");

  /* ---- the Packet Builder shares the same count ---- */
  const b = await open("builder.html");
  ok(await b.evaluate(() => genCount()) === 3, "the Packet Builder sees the same count as the packet tool");
  ok(/22 of 25 free packets left/.test(await b.evaluate(() => document.getElementById("allowance").textContent)), "and shows 22 of 25 left: " + await b.evaluate(() => document.getElementById("allowance").textContent));
  await b.evaluate(() => bumpGen()); await settle(b); await b.close();
  p = await open();
  ok(await p.evaluate(() => genCount()) === 4, "a packet made in the Builder counts in the packet tool");

  /* ---- the gate still opens at 25 ---- */
  await p.evaluate(() => { while (genCount() < 25) bumpGen(); }); await settle(p);
  ok(await p.evaluate(() => !unlocked() && runsUsed() >= FREE_RUNS), "at 25 the free packets are used up");
  await p.close();

  /* ---- a tab that is still open remembers what it has seen: clearing the data under it does not hand the packets back ---- */
  const keeper = await open();
  const stale = await open();
  await stale.evaluate(async () => {
    localStorage.clear();
    await new Promise(res => { const q = indexedDB.deleteDatabase("cg_trial"); q.onsuccess = q.onerror = q.onblocked = () => res(); });
    await caches.delete("cg-trial-v1");
  }); await settle(stale);
  ok(await keeper.evaluate(() => genCount()) === 25, "clearing the site's data while another tab is open does not reset the count: the open tab restores it");

  /* ---- the stated limit: close every tab, clear everything, and a new count begins ---- */
  for (const pg of ctx.pages()) await pg.close();
  p = await open();
  await p.evaluate(async () => {
    localStorage.clear();
    await new Promise(res => { const q = indexedDB.deleteDatabase("cg_trial"); q.onsuccess = q.onerror = q.onblocked = () => res(); });
    await caches.delete("cg-trial-v1");
  }); await p.close();
  p = await open();
  ok(await p.evaluate(() => genCount()) === 0, "clearing all of the site's data with no tab open starts a new count: the limit of a page that never phones home (" + JSON.stringify(await stored(p)) + ")");
  await p.close();
} finally {
  await browser.close(); srv.close();
}

if (foreign.length) problems.push("a request left the site: " + [...new Set(foreign)].slice(0, 3).join(" "));
if (errors.length) problems.push("page errors: " + [...new Set(errors)].slice(0, 5).join(" | "));
if (problems.length) { console.log(`trial counter check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")); process.exit(1); }
console.log(`trial counter check passed: ${passed} checks in a real browser (three copies of the count survive a low edit, a deleted setting, and either mirror going missing; the two tools share it; clearing everything starts over, as stated)`);
