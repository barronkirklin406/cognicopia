#!/usr/bin/env node
/* =====================================================================
   The public content catalog (data/content-catalog.json) and the loader
   that reads it (src/services/contentCatalog.ts), without a browser.

     1. the shipped file: it is valid JSON, every record passes the schema,
        ids are unique, all four categories and all three tiers are covered,
        at least four records cover trivia and word search, and every line
        a person will read passes the adult-dignity filter (invite, never test)
     2. the schema refuses what it should: a wrong tier, a duplicate id, a
        trivia answer that is not among its choices, a word that does not fit
        the grid, text with angle brackets
     3. loadContentCatalog() never throws, whatever goes wrong: a dropped
        connection (retried), a 404, a 500 (retried), a timeout, a damaged
        file, a file that is not a catalog, an oversized file, a catalog with
        some bad records (kept apart, the rest used), a catalog with none, an
        address on another site, and a browser with no fetch
     4. the built-in stand-in catalog is itself valid
     5. it is private and wired in: one GET, no cookies, no other site, no
        storage, no clock-based identifiers; the offline worker keeps both files

   Node built-ins only; nothing is fetched. Run: node scripts/check-contentcatalog.mjs
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0; const fails = [];
const ok = (cond, msg) => { if (cond) pass++; else fails.push(msg); };

const box = { console, setTimeout, clearTimeout, AbortController, URL, Date }; box.globalThis = box; vm.createContext(box);
vm.runInContext(read("assets/services/contentCatalog.js"), box);
const C = box.CogniContentCatalog;
ok(C && typeof C.loadContentCatalog === "function", "the built file defines loadContentCatalog");

/* the clinical rulebook, for the dignity filter */
const cx = vm.createContext({ console, Date, Math, JSON, Object, Array, String, Number, RegExp, Map, Set, Error, Intl, parseInt, parseFloat, isFinite, isNaN }); cx.globalThis = cx; cx.window = cx;
vm.runInContext(read("src/engine/ClinicalMatrix.js"), cx, { filename: "ClinicalMatrix.js" });
const CM = cx.CognicopiaClinicalMatrix;

/* ---- 1. the shipped file ---- */
const FILE = JSON.parse(read("data/content-catalog.json"));
const v = C.validateCatalog(FILE);
ok(v.rejected.length === 0 && v.problems.length === 0, "every record in the shipped file passes the schema: " + JSON.stringify(v.rejected).slice(0, 200));
ok(v.items.length >= 4 && v.items.length === FILE.items.length, `the file has ${v.items.length} valid records (at least 4)`);
ok(new Set(v.items.map(i => i.item_id)).size === v.items.length, "every item_id is unique");
ok(C.CATEGORIES.every(c => v.items.some(i => i.category === c)), "all four categories are covered");
ok(C.TIERS.every(t => v.items.some(i => i.cognitive_tier === t)), "all three tiers are covered");
ok(v.items.filter(i => i.category === "Trivia").length >= 2 && v.items.filter(i => i.category === "WordSearch").length >= 2, "there are trivia and word search banks (two or more of each)");
ok(v.items.some(i => i.item_id === "trivia_1950s_music_01" && i.tags.join() === "music,1950s,rock_and_roll,nostalgia"), "the example record from the brief is there, with its tags");
ok(FILE.items.every(i => Object.keys(i).sort().join() === "category,cognitive_tier,content_payload,item_id,tags"), "each record has exactly the five fields of the schema");
ok(v.version === "1.0.0", "the file carries its version");
const strings = []; (function walk(x) { if (typeof x === "string") strings.push(x); else if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") Object.values(x).forEach(walk); })(FILE.items.map(i => i.content_payload));
const flagged = strings.filter(s => CM.dignity.lint(s).length);
ok(strings.length > 30 && flagged.length === 0, `all ${strings.length} lines a person reads pass the dignity filter` + (flagged.length ? ": " + flagged.slice(0, 2).join(" | ") : ""));
const hard = strings.filter(s => /\b(quiz|test your|which answer is wrong|do you remember|wrong|incorrect|score)\b/i.test(s));
ok(hard.length === 0, "nothing quizzes or tests: " + hard.slice(0, 2).join(" | "));
const ws = v.items.filter(i => i.category === "WordSearch");
ok(ws.length && ws.sort((a, b) => b.cognitive_tier.localeCompare(a.cognitive_tier)).every((w, k, a) => k === 0 || a[k - 1].content_payload.words.length <= w.content_payload.words.length), "the simplest tier has the fewest words, the harder tiers more");
ok(C.TIER_NUMBER.Tier_1_Mild === 1 && C.TIER_NUMBER.Tier_3_Advanced === 3, "tiers map to the numbers a resident profile uses");

/* ---- 2. what the schema refuses ---- */
const base = () => JSON.parse(JSON.stringify(FILE.items[0]));
const bad = (mut, re) => { const r = base(); mut(r); const x = C.validateItem(r); return x.item === null && x.reasons.some(s => re.test(s)); };
ok(bad(r => { r.cognitive_tier = "Tier_9"; }, /cognitive_tier/), "an unknown tier is refused");
ok(bad(r => { r.category = "Bingo"; }, /category/), "an unknown category is refused");
ok(bad(r => { r.item_id = "Has Space"; }, /item_id/) && bad(r => { delete r.item_id; }, /item_id/), "a bad or missing item_id is refused");
ok(bad(r => { r.tags = []; }, /tags/) && bad(r => { r.tags = ["Music"]; }, /tag/) && bad(r => { r.tags = ["a", "a"]; }, /repeat/) && bad(r => { r.tags = "music"; }, /list/), "empty, uppercase, repeated or non-list tags are refused");
ok(bad(r => { r.content_payload = []; }, /object/) && bad(r => { r.content_payload = null; }, /object/), "a payload that is not an object is refused");
ok(bad(r => { r.content_payload.questions[0].answer = "Somebody else"; }, /not one of the choices/), "a trivia answer that is not among the choices is refused");
ok(bad(r => { r.content_payload.questions[0].choices = ["A", "a", "B"]; r.content_payload.questions[0].answer = "A"; }, /repeat/), "repeated choices are refused");
ok(bad(r => { r.content_payload.questions = []; }, /questions/), "trivia with no questions is refused");
ok(bad(r => { r.content_payload.questions[0].prompt = "<script>alert(1)</script>"; }, /angle bracket/), "text with angle brackets is refused");
ok(bad(r => { r.content_payload.questions[0].prompt = "x".repeat(401); }, /longer than/), "overlong text is refused");
const wsr = () => JSON.parse(JSON.stringify(FILE.items.find(i => i.category === "WordSearch")));
const wbad = (mut, re) => { const r = wsr(); mut(r); const x = C.validateItem(r); return x.item === null && x.reasons.some(s => re.test(s)); };
ok(wbad(r => { r.content_payload.words = ["rose", "TULIP", "DAISY", "SEEDS", "LEAF"]; }, /capital letters/), "lower-case words are refused");
ok(wbad(r => { r.content_payload.words = ["ROSE", "ROSE", "DAISY", "SEEDS", "LEAF"]; }, /repeat/), "repeated words are refused");
ok(wbad(r => { r.content_payload.words = ["ROSE", "TULIP", "DAISY"]; }, /words must hold/), "too few words is refused");
ok(wbad(r => { r.content_payload.words = ["ROSE", "TULIP", "DAISY", "SEEDS", "SUNFLOWERSS"]; r.content_payload.grid_size = { rows: 8, cols: 8 }; }, /does not fit/), "a word longer than the grid is refused");
ok(wbad(r => { r.content_payload.directions = ["sideways"]; }, /directions/), "an unknown direction is refused");
ok(wbad(r => { r.content_payload.grid_size = { rows: 2, cols: 99 }; }, /grid_size/), "an unreasonable grid is refused");
const tpl = () => JSON.parse(JSON.stringify(FILE.items.find(i => i.category === "CognitiveTemplate")));
ok((() => { const r = tpl(); r.content_payload.print.gutter_in = 0.25; return C.validateItem(r).item === null; })(), "a print gutter under 0.75 in is refused (the print standard)");
ok((() => { const r = tpl(); r.content_payload.print.margin_in = 0.25; return C.validateItem(r).item === null; })(), "a print margin under 0.5 in is refused (the print standard)");
ok(C.validateItem(null).item === null && C.validateItem("x").item === null && C.validateItem([]).item === null, "a record that is not an object is refused");
{
  const dup = C.validateCatalog({ items: [FILE.items[0], FILE.items[0], FILE.items[1]] });
  ok(dup.items.length === 2 && dup.rejected.length === 1 && /earlier record/.test(dup.rejected[0].reasons[0]), "a repeated item_id is set aside, the first copy is kept");
  const mixed = C.validateCatalog({ items: [FILE.items[0], { item_id: "x" }, 5, null, FILE.items[1]] });
  ok(mixed.items.length === 2 && mixed.rejected.length === 3 && mixed.problems[0].code === "rejected", "bad records are set aside one by one and the good ones are kept");
  ok(C.validateCatalog(FILE.items).items.length === FILE.items.length, "a bare list of records is accepted too");
  ok(C.validateCatalog("nope").problems[0].code === "shape" && C.validateCatalog({}).problems[0].code === "shape" && C.validateCatalog(null).problems[0].code === "shape", "something that is not a catalog is a shape problem, not a crash");
}
ok(C.selectItems(v.items, { category: "WordSearch", tier: 2 }).map(i => i.item_id).join() === "wordsearch_kitchen_02", "selectItems finds by category and tier number");
ok(C.selectItems(v.items, { tags: ["music", "1950s"] }).length >= 2 && C.selectItems(v.items, { tags: ["music", "no_such_tag"] }).length === 0, "selectItems needs every tag");
ok(C.selectItems(v.items).length === v.items.length, "an empty filter returns everything");

/* ---- 3. the loader, with every way a read can go wrong ---- */
const reply = (body, o = {}) => ({ ok: o.status === undefined || (o.status >= 200 && o.status < 300), status: o.status === undefined ? 200 : o.status, text: async () => (typeof body === "string" ? body : JSON.stringify(body)), headers: { get: n => (o.headers || {})[n.toLowerCase()] ?? null } });
const run = (fetcher, extra = {}) => C.loadContentCatalog({ fetcher, origin: "https://cognicopia.org", pause: async () => {}, now: () => 1790000000000, ...extra });
const calls = [];
{
  const r = await run(async (url, init) => { calls.push({ url, init }); return reply(FILE); });
  ok(r.ok && r.source === "network" && !r.degraded && r.items.length === FILE.items.length && r.problems.length === 0 && r.version === "1.0.0" && r.attempts === 1 && r.loadedAt === 1790000000000, "a clean read: ok, from the network, nothing degraded");
  ok(calls[0].url === "https://cognicopia.org/data/content-catalog.json" && calls[0].init.method === "GET" && calls[0].init.credentials === "omit", "it asks for the site's own file, with GET and no cookies");
  ok(Object.keys(calls[0].init).sort().join() === "cache,credentials,method,redirect,signal", "and sends nothing else (no body, no custom headers)");
}
{
  let n = 0;
  const r = await run(async () => { n++; if (n === 1) throw new TypeError("Failed to fetch"); return reply(FILE); });
  ok(r.ok && r.attempts === 2 && n === 2, "a dropped connection is retried, and the second try works");
  let m = 0;
  const q = await run(async () => { m++; throw new TypeError("Failed to fetch"); });
  ok(!q.ok && q.source === "fallback" && q.attempts === 2 && m === 2 && q.problems[0].code === "offline" && /offline/.test(q.problems[0].message), "a connection that stays down gives the built-in catalog and says offline");
  ok(q.items.length === 2 && q.degraded === true && q.problems.some(p => p.code === "fallback"), "the stand-in is marked degraded with a plain reason");
}
{
  let n = 0;
  const r = await run(async () => { n++; return reply("", { status: 404 }); });
  ok(!r.ok && r.problems[0].code === "not-found" && n === 1 && r.source === "fallback", "a 404 is not retried, and says not-found");
  let m = 0;
  const s = await run(async () => { m++; return m === 1 ? reply("", { status: 503 }) : reply(FILE); });
  ok(s.ok && s.attempts === 2, "a server error is retried");
  const t = await run(async () => reply("", { status: 500 }));
  ok(!t.ok && t.problems[0].code === "server" && t.attempts === 2, "a server error that stays gives the stand-in");
  const u = await run(async () => reply("", { status: 403 }));
  ok(!u.ok && u.problems[0].code === "http" && u.attempts === 1, "another refusal is reported with its number");
}
{
  const r = await run(async () => { const e = new Error("aborted"); e.name = "AbortError"; throw e; });
  ok(!r.ok && r.problems[0].code === "timeout", "a timeout says timeout");
  const slow = await C.loadContentCatalog({ fetcher: (u, init) => new Promise((_, rej) => { init.signal.addEventListener("abort", () => { const e = new Error("aborted"); e.name = "AbortError"; rej(e); }); }), origin: "https://cognicopia.org", pause: async () => {}, timeoutMs: 500, attempts: 1 });
  ok(!slow.ok && slow.problems[0].code === "timeout", "a request that never answers is cut off by the time limit");
}
{
  const r = await run(async () => reply("{ this is not json"));
  ok(!r.ok && r.problems[0].code === "parse" && r.attempts === 1 && r.source === "fallback", "a damaged file says parse, is not retried, and gives the stand-in");
  ok((await run(async () => reply("﻿" + JSON.stringify(FILE)))).ok, "a file that starts with a byte-order mark still reads");
  const w = await run(async () => reply({ unrelated: true }));
  ok(!w.ok && w.problems[0].code === "shape", "a file that is not a catalog says shape");
  const e = await run(async () => reply({ items: [] }));
  ok(!e.ok && e.problems.some(p => p.code === "empty"), "a catalog with no records says empty");
  const allBad = await run(async () => reply({ items: [{ item_id: "x" }, { nope: 1 }] }));
  ok(!allBad.ok && allBad.source === "fallback" && allBad.problems.some(p => p.code === "rejected") && allBad.items.length === 2, "a catalog where every record is bad falls back");
  const part = await run(async () => reply({ catalog_version: "9.9.9", items: [FILE.items[0], { item_id: "bad" }, FILE.items[3]] }));
  ok(part.ok && part.source === "network" && part.degraded && part.items.length === 2 && part.rejected.length === 1 && part.rejected[0].index === 1 && part.rejected[0].item_id === "bad" && part.version === "9.9.9", "some bad records: the good ones are used, the bad one is listed with its position and reasons");
  const big = await run(async () => reply(FILE, { headers: { "content-length": String(C.MAX_BYTES + 1) } }));
  ok(!big.ok && big.problems[0].code === "too-large", "a file that says it is too large is not read");
  const big2 = await run(async () => reply(" ".repeat(C.MAX_BYTES + 1) + "{}"));
  ok(!big2.ok && big2.problems[0].code === "too-large", "a file that turns out too large is not parsed");
}
{
  const r = await run(async () => { throw new Error("must not be called"); }, { url: "https://evil.example/data/content-catalog.json" });
  ok(!r.ok && r.attempts === 0 && r.problems[0].code === "address", "an address on another site is refused before any request");
  const s = await run(async () => { throw new Error("must not be called"); }, { url: "javascript:alert(1)" });
  ok(!s.ok && s.problems[0].code === "address", "a script address is refused");
  const t = await run(async url => { calls.push(url); return reply(FILE); }, { url: "../data/content-catalog.json" });
  ok(t.ok, "a relative address is resolved against the site");
  const custom = await run(async () => { throw new TypeError("x"); }, { fallback: [FILE.items[2]] });
  ok(custom.source === "fallback" && custom.items.length === 1 && custom.items[0].item_id === FILE.items[2].item_id, "a page can give its own stand-in");
  const empty = await run(async () => { throw new TypeError("x"); }, { fallback: [] });
  ok(empty.source === "fallback" && empty.items.length === 0, "or none at all");
}
{
  const noFetch = vm.createContext({ console, setTimeout, clearTimeout, URL, Date }); noFetch.globalThis = noFetch;
  vm.runInContext(read("assets/services/contentCatalog.js"), noFetch);
  const r = await noFetch.CogniContentCatalog.loadContentCatalog({ origin: "https://cognicopia.org" });
  ok(!r.ok && r.problems[0].code === "unsupported" && r.items.length === 2, "a browser with no fetch gives the stand-in and says unsupported");
}
{
  const throwing = async () => { throw 42; };
  let threw = false; try { const r = await run(throwing); ok(r.source === "fallback", "even a thrown number gives the stand-in"); } catch { threw = true; }
  ok(!threw, "the loader never throws");
}

/* ---- 4. the stand-in is valid ---- */
const fb = C.validateCatalog(Array.from(C.FALLBACK_ITEMS));
ok(fb.items.length === C.FALLBACK_ITEMS.length && fb.rejected.length === 0, "the built-in catalog passes the schema");
ok(Object.isFrozen(C.FALLBACK_ITEMS), "and cannot be changed by a page");
ok(JSON.stringify(C.FALLBACK_ITEMS).split('"').every(s => !CM.dignity.lint(s).length), "and passes the dignity filter");

/* ---- 5. private, and wired in ---- */
const src = read("src/services/contentCatalog.ts");
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
ok(!/XMLHttpRequest|sendBeacon|WebSocket|importScripts|new Image\b|EventSource|navigator\.serviceWorker/.test(code), "no other kind of network call is used");
ok((code.match(/\bfetch\s*\(/g) || []).length <= 1 && /credentials: "omit"/.test(code), "reading is one plain GET with no cookies");
ok(!/document\.cookie|localStorage|sessionStorage|indexedDB|userAgent|Math\.random|\bhttps?:\/\/[a-z]/.test(code), "no cookie, no storage, no identifier and no web address of another site");
ok(read("sw.js").includes('"data/content-catalog.json"') && read("sw.js").includes('"assets/services/contentCatalog.js"'), "the offline worker keeps the catalog and the loader, so they work with no connection");
ok(/^\/\* CogniContentCatalog: built from src\/services\/contentCatalog\.ts/.test(read("assets/services/contentCatalog.js")), "the browser file is the built one");
for (const f of ["index.html", "profile.html"]) ok(!/contentCatalog\.js/.test(read(f)), `${f} does not load the catalog (only the Packet Builder's roster uses it)`);
ok(/<script src="assets\/services\/contentCatalog\.js"><\/script>/.test(read("builder.html")) && !/\bfetch\s*\(/.test(read("builder.html")), "the Packet Builder loads the loader, and its own page still contains no fetch call");
ok(FILE.items.every(i => !/\bhttps?:\/\//.test(JSON.stringify(i))), "the catalog holds no web address");

if (fails.length) { console.log(`content catalog check FAILED: ${fails.length} problem(s), ${pass} passed\n  - ` + fails.join("\n  - ")); process.exit(1); }
console.log(`content catalog check passed: ${pass} checks (the shipped file is valid and gentle, the schema refuses what it should, the loader never throws and always gives an answer, and nothing leaves the site)`);
