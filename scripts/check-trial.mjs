#!/usr/bin/env node
/* =====================================================================
   The free-packet ledger (src/services/trialLedger.ts), without a browser.

   It has to do five things, and this proves each one by trying to cheat it:
     1. the count is read and written as one whole number, and anything
        else (junk, negatives, decimals, huge values) is ignored
     2. lowering the number in one place does nothing: the largest copy
        wins and the lower ones are put back
     3. a copy that is missing, broken or refused is repaired from the
        others; damaged storage never locks anyone out
     4. an empty ledger stays empty: the limit of this approach is stated
        and tested, not hidden (clearing everything starts a new count)
     5. it is private: no network, no cookie, no fingerprint, and the two
        tools and the offline worker are wired to it

   Node built-ins only. Run: node scripts/check-trial.mjs
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0; const fails = [];
const ok = (cond, msg) => { if (cond) pass++; else fails.push(msg); };

const sandbox = { console }; sandbox.globalThis = sandbox; vm.createContext(sandbox);
vm.runInContext(read("assets/services/trialLedger.js"), sandbox);
const T = sandbox.CogniTrialLedger;

/* ---- 1. what counts as a count ---- */
ok(T.parseCount("12") === 12 && T.parseCount(" 7 ") === 7 && T.parseCount(0) === 0 && T.parseCount("0") === 0, "whole numbers are read, with spaces trimmed");
ok(["", "abc", "-3", "2.5", "1e3", "12abc", "{\"n\":4}", null, undefined, {}, [], "9999999", "٣"].every(v => T.parseCount(v) === null), "junk, negatives, decimals, exponents, objects and huge values are ignored");
ok(T.parseCount("999999") === 999999, "the largest accepted count is six digits");

/* ---- 2. the merge ---- */
{ const m = T.merge([{ source: "page", n: 2 }, { source: "indexeddb", n: 9 }, { source: "cache", n: null }], 0);
  ok(m.n === 9 && m.from === "indexeddb" && m.repair.join() === "page,cache", "the largest copy wins and the others are marked for repair"); }
ok(T.merge([{ source: "page", n: 1 }], 5).n === 5, "what this page has already seen is a floor");
ok(T.merge([{ source: "page", n: null }], 0).n === 0, "nothing anywhere is zero");

/* ---- helpers: fake storage the test can tamper with ---- */
const cell = (store, key) => ({ get: () => (key in store ? store[key] : null), set: v => { if (store.__refuse) throw new Error("quota"); store[key] = v; return true; } });
const mirror = (name, store) => ({
  name,
  read: async () => { if (store.__broken) throw new Error("denied"); return "n" in store ? T.parseCount(store.n) : null; },
  write: async n => { if (store.__broken) throw new Error("denied"); const cur = T.parseCount(store.n); if (cur === null || cur < n) store.n = String(n); },   // raise-only, as the real copies are
});
const settle = () => new Promise(r => setTimeout(r, 5));
const build = (page, idb, cache, extra = {}) => {
  let persistCalls = 0;
  const ledger = T.createLedger({ primary: cell(page, T.COUNT_KEY), asked: cell(page, T.ASKED_KEY), mirrors: [mirror("indexeddb", idb), mirror("cache", cache)], persist: extra.noPersist ? undefined : async () => { persistCalls++; return true; } });
  return { ledger, persistCalls: () => persistCalls };
};

/* ---- recording and the three copies ---- */
{
  const page = {}, idb = {}, cache = {};
  const { ledger, persistCalls } = build(page, idb, cache);
  ok(ledger.count() === 0, "a new computer has used none");
  ledger.record(); ledger.record(); ledger.record();
  await settle();
  ok(ledger.count() === 3 && page[T.COUNT_KEY] === "3" && idb.n === "3" && cache.n === "3", "each packet is written to all three places");
  ok(persistCalls() === 1 && page[T.ASKED_KEY] === "1", "the browser is asked once to keep the data, not on every packet");

  /* ---- 2. lowering one copy does nothing ---- */
  page[T.COUNT_KEY] = "0";
  ok(ledger.count() === 3 && page[T.COUNT_KEY] === "3", "typing a smaller number in the page's storage is undone on the next read");
  const reload1 = build(page, idb, cache); page[T.COUNT_KEY] = "1"; idb.n = "0";
  const r1 = await reload1.ledger.reconcile();
  ok(r1.n === 3 && r1.raised === true && page[T.COUNT_KEY] === "3" && idb.n === "3", "after a reload, one low copy and one zeroed copy are overruled by the largest and repaired");
  ok(reload1.ledger.count() === 3, "and the page reads the restored number");

  /* ---- 3. a missing, broken or refused copy ---- */
  const page2 = { [T.COUNT_KEY]: "4" }, idb2 = { n: "4" }, cache2 = { n: "4" };
  delete page2[T.COUNT_KEY];
  const l2 = build(page2, idb2, cache2).ledger;
  ok((await l2.reconcile()).n === 4 && page2[T.COUNT_KEY] === "4", "a deleted page setting is restored from the other copies");
  const page3 = { [T.COUNT_KEY]: "banana" }, idb3 = { n: "6" }, cache3 = {};
  const l3 = build(page3, idb3, cache3).ledger;
  ok((await l3.reconcile()).n === 6 && page3[T.COUNT_KEY] === "6" && cache3.n === "6", "junk in the page setting is ignored, and the empty cache copy is filled in");
  const page4 = { [T.COUNT_KEY]: "5" }, idb4 = { __broken: true }, cache4 = { __broken: true };
  const l4 = build(page4, idb4, cache4).ledger;
  const r4 = await l4.reconcile();
  ok(r4.n === 5 && l4.record() === 6 && page4[T.COUNT_KEY] === "6", "refused mirrors (a private window, a locked-down browser) do not break counting");
  const page5 = { [T.COUNT_KEY]: "2", __refuse: true }, idb5 = { n: "7" }, cache5 = {};
  const l5 = build(page5, idb5, cache5).ledger;
  ok((await l5.reconcile()).n === 7 && l5.count() === 7, "if the page's own storage refuses writes, the mirrors still hold the count");
  const page6 = { [T.COUNT_KEY]: "zzz" }, idb6 = { n: "also junk" }, cache6 = { n: "-1" };
  const r6 = await build(page6, idb6, cache6).ledger.reconcile();
  ok(r6.n === 0 && r6.raised === false, "junk everywhere is not a lock-out: damaged storage counts as nothing used");
}

/* ---- 4. the stated limit ---- */
{
  const page = {}, idb = {}, cache = {};
  const a = build(page, idb, cache).ledger; for (let i = 0; i < 12; i++) a.record(); await settle();
  for (const k of Object.keys(page)) delete page[k]; for (const k of Object.keys(idb)) delete idb[k]; for (const k of Object.keys(cache)) delete cache[k];
  const b = build(page, idb, cache).ledger;
  const r = await b.reconcile();
  ok(r.n === 0 && b.count() === 0 && !("n" in idb) && !(T.COUNT_KEY in page), "clearing every copy starts a new count, and an empty ledger writes nothing (the honest limit)");
}

/* ---- absorb (a backup restored, or another computer's count) ---- */
{
  const page = { [T.COUNT_KEY]: "10" }, idb = {}, cache = {};
  const { ledger } = build(page, idb, cache);
  ok(ledger.absorb(4) === 10 && page[T.COUNT_KEY] === "10", "restoring a lower number never lowers the count");
  ok(ledger.absorb("17") === 17 && page[T.COUNT_KEY] === "17", "restoring a higher number raises it");
  await settle();
  ok(idb.n === "17" && cache.n === "17" && ledger.absorb("junk") === 17 && ledger.absorb(-5) === 17, "and it reaches the mirrors; junk is ignored");
}

/* ---- listeners, and a listener that throws ---- */
{
  const page = {}, idb = { n: "8" }, cache = {};
  const { ledger } = build(page, idb, cache); const seen = [];
  ledger.onChange(n => { throw new Error("a bad listener"); }); ledger.onChange(n => seen.push(n));
  ledger.record(); await ledger.reconcile();
  ok(seen[0] === 1 && seen[seen.length - 1] === 8 && ledger.count() === 8, "listeners hear about every change, a restored count is announced, and a listener that throws does not stop the count");
  ok(idb.n === "8", "a packet recorded before the other copies are read does not overwrite a higher saved copy");
}

/* ---- the built file, loaded as a page loads it: no indexedDB, no caches ---- */
{
  const store = {};
  const fakeStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const root = { document: undefined };
  const L = T.forBrowser(fakeStorage, root);
  ok(L.count() === 0 && L.record() === 1 && store[T.COUNT_KEY] === "1", "with only the page's storage, counting still works");
  ok((await L.ready()).n === 1, "reconcile works with no mirrors available");
  const flaky = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const M = T.forBrowser(flaky, {});
  ok(M.count() === 0 && M.record() === 1 && M.count() === 1, "when the browser blocks all storage, the count still works for this page's lifetime");
}

/* ---- 5. private, and wired in ---- */
const src = read("src/services/trialLedger.ts");
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|importScripts|new Image\b/.test(code), "the ledger makes no network request");
ok(!/document\.cookie|userAgent|navigator\.(plugins|languages|hardwareConcurrency|deviceMemory)|screen\.|getContext\s*\(|WebGL|AudioContext|canvas/i.test(code), "no cookie and no fingerprinting signal is read");
ok(!/crypto|Math\.random|Date\.now|new Date/.test(code), "no identifier is generated: the only thing stored is one whole number");
ok(T.MIRROR_CACHE.indexOf("cognicopia-") !== 0 && /k\.indexOf\("cognicopia-"\) === 0 && k !== VERSION/.test(read("sw.js")), "the cache copy is named so the offline worker's clean-up does not delete it");
ok(read("sw.js").includes('"assets/services/trialLedger.js"'), "the offline worker keeps the ledger script, so counting works with no connection");
for (const f of ["index.html", "builder.html"]) {
  const h = read(f);
  const tag = h.indexOf('<script src="assets/services/trialLedger.js"></script>'), use = h.indexOf("CogniTrialLedger.forBrowser(CG_LS)");
  ok(tag > 0 && use > tag, `${f}: loads the ledger before it uses it`);
  ok(/function genCount\(\)\{ return TRIAL \?/.test(h) && /function bumpGen\(\)\{ if\(TRIAL\) TRIAL\.record\(\)/.test(h), `${f}: the packet counter reads and writes through the ledger`);
}
ok(/cognicopia_gen_count/.test(src) && T.COUNT_KEY === "cognicopia_gen_count", "the old setting's name is kept, so no one's current count resets when this ships");

if (fails.length) { console.log(`trial ledger check FAILED: ${fails.length} problem(s), ${pass} passed\n  - ` + fails.join("\n  - ")); process.exit(1); }
console.log(`trial ledger check passed: ${pass} checks (the count only goes up, damaged copies are repaired and never lock anyone out, an empty ledger stays empty, and nothing leaves the computer)`);
