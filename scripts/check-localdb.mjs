#!/usr/bin/env node
/* =====================================================================
   The local database (src/services/localDb.ts), without a browser.

   It has to do five things, and this proves each one:
     1. only the fields a resident or a packet may hold are stored: a
        missing first name, a wrong care level, a bad id or a packet with
        no pages are refused with a plain message and a code
     2. the five requested functions exist and are asynchronous, with JSDoc,
        and the database is named CognicopiaLocalDB with the two stores
     3. a database upgrade makes both stores with their indexes
     4. errors are explained: a full disk, a blocked browser and a locked
        store each become a LocalDbError with the right code
     5. it is private: no network request, no cookie, no cloud, and it is
        wired to the encrypted store and the offline worker

   (scripts/check-localdb-ui.mjs runs it against a real IndexedDB and the
   real encrypted store in a browser.) Node built-ins only.
   Run: node scripts/check-localdb.mjs
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0; const fails = [];
const ok = (cond, msg) => { if (cond) pass++; else fails.push(msg); };
const throwsCode = (fn, code) => { try { fn(); return false; } catch (e) { return e && e.code === code; } };

const box = { console, setTimeout, clearTimeout }; box.globalThis = box; vm.createContext(box);
vm.runInContext(read("assets/services/localDb.js"), box);
const L = box.CogniLocalDb;
ok(L && typeof L === "object", "the built file defines CogniLocalDb");

/* ---- 2. the names, the stores and the five functions ---- */
ok(L.DB_NAME === "CognicopiaLocalDB" && L.STORE_RESIDENTS === "residents" && L.STORE_PACKETS === "generatedPackets", "the database and both stores have the requested names");
for (const fn of ["saveResident", "getResident", "getAllResidents", "savePacket", "getPacketsForResident"]) ok(typeof L[fn] === "function", `${fn} exists`);
ok(L.TIERS.join() === "Mild,Moderate,Advanced", "the care levels are Mild, Moderate and Advanced");
const src = read("src/services/localDb.ts");
for (const fn of ["saveResident", "getResident", "getAllResidents", "savePacket", "getPacketsForResident"]) {
  const m = new RegExp(`/\\*\\*(?:(?!\\*/)[\\s\\S])*?\\*/\\s*async function ${fn}\\(`).exec(src);
  ok(!!m, `${fn} is an async function with a JSDoc comment`);
}
ok(/@param/.test(src) && /@returns/.test(src) && /@throws/.test(src), "the JSDoc names parameters, results and errors");

/* ---- 1. what is accepted and what is refused ---- */
const good = { firstName: "  Margaret ", hometown: "Duluth, Minnesota", pastOccupation: "Teacher", hobbies: "Gardening", cognitiveTier: "moderate", interests: ["Big band", "big band", " Birds ", "", "Baking"] };
const r = L.cleanResident(good);
ok(r.firstName === "Margaret" && r.cognitiveTier === "Moderate", "a name is trimmed and a care level takes its stored spelling");
ok(r.interests.join("|") === "Big band|Birds|Baking", "interests are trimmed and have no repeats or blanks: " + r.interests.join("|"));
ok(L.cleanResident({ firstName: "Al", cognitiveTier: "Mild", hobbies: ["Fishing", "Cards", " "] }).hobbies === "Fishing, Cards", "hobbies given as a list become one line");
ok(!("ssn" in L.cleanResident({ firstName: "Al", cognitiveTier: "Mild", ssn: "000-00-0000", lastName: "Smith" })), "fields that are not in the profile are dropped, never stored");
ok(L.cleanResident({ firstName: "Al<script>", cognitiveTier: "Mild" }).firstName === "Alscript", "angle brackets and control characters are removed from text");
ok(throwsCode(() => L.cleanResident({ cognitiveTier: "Mild" }), "invalid") && throwsCode(() => L.cleanResident({ firstName: "   ", cognitiveTier: "Mild" }), "invalid"), "a resident without a first name is refused");
ok(throwsCode(() => L.cleanResident({ firstName: "Al", cognitiveTier: "Severe" }), "invalid") && throwsCode(() => L.cleanResident({ firstName: "Al" }), "invalid"), "an unknown or missing care level is refused");
ok(throwsCode(() => L.cleanResident(null), "invalid") && throwsCode(() => L.cleanResident([]), "invalid") && throwsCode(() => L.cleanResident("x"), "invalid"), "a profile that is not an object is refused");
ok(throwsCode(() => L.cleanResident({ firstName: "Al", cognitiveTier: "Mild", id: "has space" }), "invalid") && throwsCode(() => L.cleanResident({ firstName: "Al", cognitiveTier: "Mild", id: "x".repeat(65) }), "invalid"), "an id with odd characters or over 64 is refused");
ok(throwsCode(() => L.cleanResident({ firstName: "Al", cognitiveTier: "Mild", interests: "birds" }), "invalid"), "interests that are not a list are refused");
ok(L.cleanResident({ firstName: "x".repeat(300), cognitiveTier: "Mild" }).firstName.length === 80, "a name is cut at 80 characters");
ok(L.cleanResident({ firstName: "Al", cognitiveTier: "Mild", interests: Array.from({ length: 80 }, (_, i) => "item" + i) }).interests.length === 50, "at most 50 interests are kept");

const NOW = 1790000000000;
const pk = L.cleanPacket({ residentId: "res_1", htmlContent: "<html><body>Hello</body></html>", selectedTemplates: ["Word Search", "Coloring", "Word Search"] }, NOW);
ok(pk.timestamp === NOW && pk.selectedTemplates.join("|") === "Word Search|Coloring", "a packet takes the time now and a tidy template list");
ok(pk.htmlContent === "<html><body>Hello</body></html>", "a packet's HTML is kept exactly as given (it is text, never inserted into a page)");
ok(L.cleanPacket({ residentId: "r", htmlContent: "x", timestamp: "2026-10-01T12:00:00Z" }, NOW).timestamp === Date.parse("2026-10-01T12:00:00Z"), "a date string becomes milliseconds");
ok(L.cleanPacket({ residentId: "r", htmlContent: "x", timestamp: new Date(1700000000000) }, NOW).timestamp === 1700000000000, "a Date becomes milliseconds");
ok(throwsCode(() => L.cleanPacket({ residentId: "r", htmlContent: "x", timestamp: "not a date" }, NOW), "invalid") && throwsCode(() => L.cleanPacket({ residentId: "r", htmlContent: "x", timestamp: -5 }, NOW), "invalid"), "a time that is not a real date is refused");
ok(throwsCode(() => L.cleanPacket({ residentId: "r", htmlContent: "" }, NOW), "invalid") && throwsCode(() => L.cleanPacket({ residentId: "r" }, NOW), "invalid") && throwsCode(() => L.cleanPacket({ residentId: "r", htmlContent: 42 }, NOW), "invalid"), "a packet with no pages is refused");
ok(throwsCode(() => L.cleanPacket({ htmlContent: "x" }, NOW), "invalid") && throwsCode(() => L.cleanPacket({ residentId: "bad id", htmlContent: "x" }, NOW), "invalid"), "a packet with no resident, or a bad resident id, is refused");
ok(throwsCode(() => L.cleanPacket({ residentId: "r", htmlContent: "x".repeat(L.MAX_HTML + 1) }, NOW), "invalid"), "a packet over the size guard is refused");
ok(throwsCode(() => L.cleanPacket({ residentId: "r", htmlContent: "x", selectedTemplates: "word search" }, NOW), "invalid"), "templates that are not a list are refused");

/* ---- 4. errors are explained ---- */
const named = (name, message = "x") => { const e = new Error(message); e.name = name; return e; };
ok(L.explain(named("QuotaExceededError")).code === "quota" && /out of room/.test(L.explain(named("QuotaExceededError")).message), "a full disk becomes code quota, in plain words");
ok(["SecurityError", "InvalidStateError", "UnknownError", "NotSupportedError"].every(n => L.explain(named(n)).code === "unavailable"), "a blocked browser becomes code unavailable");
ok(L.explain(named("LockedError")).code === "locked" && /passphrase/.test(L.explain(named("LockedError")).message), "a locked store becomes code locked, and says to unlock");
ok(L.explain(new Error("boom")).code === "failed" && L.explain("odd").code === "failed", "anything else becomes code failed");
const own = new L.LocalDbError("not-found", "none");
ok(L.explain(own) === own && own instanceof L.LocalDbError && own.name === "LocalDbError", "a LocalDbError passes through unchanged");
ok(L.explain(named("QuotaExceededError")).cause && L.explain(named("QuotaExceededError")).cause.name === "QuotaExceededError", "the browser's own error is kept as the cause");

/* ---- 3 & 2. a fake IndexedDB: the upgrade makes the stores and indexes; with none present, every call rejects "unavailable" ---- */
{
  const made = { stores: {}, indexes: [] };
  const fakeDb = { objectStoreNames: { contains: n => n in made.stores }, createObjectStore(n, o) { made.stores[n] = o; return { createIndex(i, k, o2) { made.indexes.push([n, i, k, o2.unique]); } }; }, close() {}, transaction() { throw named("InvalidStateError"); } };
  const fakeIdb = { open(name, version) { const r = {}; r.name = name; r.version = version; setTimeout(() => { r.result = fakeDb; r.onupgradeneeded && r.onupgradeneeded(); r.onsuccess && r.onsuccess(); }, 0); made.opened = [name, version]; return r; } };
  const db = L.createLocalDb({ indexedDB: fakeIdb, sealer: null });
  const e = await db.getAllResidents().then(() => null, x => x);
  ok(made.opened && made.opened[0] === "CognicopiaLocalDB" && made.opened[1] === 1, "the database is opened as CognicopiaLocalDB, version 1");
  ok(made.stores.residents && made.stores.residents.keyPath === "id" && made.stores.generatedPackets && made.stores.generatedPackets.keyPath === "id", "the upgrade makes both stores, keyed by id");
  ok(made.indexes.some(i => i[0] === "generatedPackets" && i[1] === "byResident" && i[2] === "residentId" && i[3] === false), "packets are indexed by resident");
  ok(made.indexes.some(i => i[0] === "generatedPackets" && i[1] === "byTimestamp"), "packets are indexed by time");
  ok(e && e.name === "LocalDbError" && e.code === "unavailable", "a browser that refuses a transaction gives code unavailable, not a raw exception");
  const none = L.createLocalDb({ indexedDB: null, sealer: null });
  ok((await none.getAllResidents().then(() => null, x => x)).code === "unavailable", "with no IndexedDB at all, a call rejects with code unavailable");
  ok((await none.saveResident({ firstName: "Al", cognitiveTier: "Mild" }).then(() => null, x => x)).code === "unavailable", "and so does a save");
  ok((await none.saveResident({ cognitiveTier: "Mild" }).then(() => null, x => x)).code === "invalid", "a bad profile is refused as invalid before the database is even tried");
  const locked = L.createLocalDb({ indexedDB: fakeIdb, sealer: { state: async () => "locked", put: async () => {}, get: async () => null, remove: async () => {} } });
  ok((await locked.getAllResidents().then(() => null, x => x)).code === "locked" && (await locked.saveResident({ firstName: "Al", cognitiveTier: "Mild" }).then(() => null, x => x)).code === "locked", "a locked encrypted store stops reads and saves with code locked");
}

/* ---- 5. private, and wired in ---- */
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|importScripts|new Image\b|EventSource|navigator\.serviceWorker/.test(code), "the database makes no network request");
ok(!/document\.cookie|localStorage|sessionStorage|userAgent|\bhttps?:\/\//.test(code), "no cookie, no web address and no plain browser storage");
ok(/CogniSecureStore/.test(code) && /cognicopia_localdb_/.test(code), "it seals through the encrypted store");
ok(/"cognicopia_localdb_"/.test(read("src/services/secureStore.ts")) && /"cognicopia_localdb_"/.test(read("assets/services/secureStore.js")), "the encrypted store lists the database's sealed names");
ok(read("sw.js").includes('"assets/services/localDb.js"'), "the offline worker keeps the database script, so it works with no connection");
ok(/^\/\* CogniLocalDb: built from src\/services\/localDb\.ts/.test(read("assets/services/localDb.js")), "the browser file is the built one");

if (fails.length) { console.log(`local database check FAILED: ${fails.length} problem(s), ${pass} passed\n  - ` + fails.join("\n  - ")); process.exit(1); }
console.log(`local database check passed: ${pass} checks (only the allowed fields are kept, bad input is refused in plain words, the stores and indexes are made, errors are explained, and nothing leaves the computer)`);
