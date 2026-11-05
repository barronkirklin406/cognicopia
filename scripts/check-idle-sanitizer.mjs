#!/usr/bin/env node
/* js/idle-sanitizer.js: the hash is real SHA-256, the access log chains and verifies (and shows an edit, a removal or a reorder), holds no names, caps
   itself without breaking the chain, exports a CSV; and sanitize() clears the page's memory in a real browser when the inactivity timer runs out. */
import crypto from "node:crypto";
import { loadPlaywright, serve } from "./lib/browser.mjs";
globalThis.__cgNoAutoInstall = true;
const S = await import("../js/idle-sanitizer.js");
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
for (const t of ["", "abc", "The quick brown fox jumps over the lazy dog", "x".repeat(55), "x".repeat(56), "x".repeat(64), "x".repeat(1000), "café — \u{1F600}"]) ok(S.sha256Hex(t) === crypto.createHash("sha256").update(t).digest("hex"), "SHA-256 matches Node's for " + JSON.stringify(t.slice(0, 20)) + " (" + t.length + " characters)");
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), raw: m }; };
let tick = 0; const now = () => new Date(Date.UTC(2026, 10, 10, 12, 0, tick++));
const st = mem(), log = S.createLog(st, { now });
const a = log.append("session-start", { who: "ab" }), b = log.append("unlock"), c = log.append("resident-open", { ref: "R-7K2" }), d = log.append("print", { note: "6 pages" }), e = log.append("idle-wipe");
ok(a.n === 1 && e.n === 5 && a.prev === S.GENESIS && b.prev === a.h && /^[0-9a-f]{64}$/.test(e.h), "entries are numbered and each carries the hash of the one before");
ok(log.verify().ok && log.verify().count === 5, "an untouched log verifies");
ok(log.append("not-an-event") === null && log.append("") === null && log.entries().length === 5, "an event that is not on the list is refused");
const tamper = (fn) => { const t = mem(); t.setItem(S.LOG_KEY, JSON.stringify(log.entries())); const l = JSON.parse(t.getItem(S.LOG_KEY)); fn(l); t.setItem(S.LOG_KEY, JSON.stringify(l)); return S.createLog(t).verify(); };
let v = tamper((l) => { l[2].ref = "R-ZZZ"; }); ok(!v.ok && v.brokenAt === 3, "an edited entry is found (entry " + v.brokenAt + ")");
v = tamper((l) => { l.splice(2, 1); }); ok(!v.ok, "a removed entry is found (entry " + v.brokenAt + ")");
v = tamper((l) => { [l[1], l[2]] = [l[2], l[1]]; }); ok(!v.ok, "a reordered pair is found");
v = tamper((l) => { l[4].ev = "print"; }); ok(!v.ok && v.brokenAt === 5, "a changed event on the last entry is found");
ok(tamper(() => {}).ok, "re-saving without a change still verifies");
const sm = log.summary(); ok(sm["session-start"] === 1 && sm.print === 1 && sm["idle-wipe"] === 1, "the summary counts events");
const csv = log.csv(); ok(/^number,time,event/.test(csv) && /Saved residents unlocked/.test(csv) && csv.split("\r\n").length === 6 && /R-7K2/.test(csv), "the CSV has a header and one line per entry, with readable event names");
const evil = log.append("print", { note: 'Mary Smith, "room 5"\n<script>', ref: "Mary" }); ok(!/[<>"\n,]/.test(evil.note), "commas, quotes, line breaks and markup are removed from what is written (" + JSON.stringify(evil.note) + ")");
ok(S.createLog({ getItem: () => "{bad", setItem() {} }).entries().length === 0 && S.createLog({ getItem: () => null, setItem() { throw new Error("full"); } }).append("lock") === null, "a damaged log reads as empty, and a full store returns null rather than throwing");
/* cap */
const big = mem(), L2 = S.createLog(big, { now }); for (let i = 0; i < S.MAX_ENTRIES + 30; i++) L2.append("print", { note: "p" + i });
const kept = L2.entries(); ok(kept.length === S.MAX_ENTRIES && kept[0].n === 31 && L2.verify().ok, "past " + S.MAX_ENTRIES + " entries the oldest go, and what is left still verifies");
/* reset */
const r = log.reset({ who: "AB" }); ok(r.ev === "log-reset" && r.prev === evil.h && log.verify().ok && log.entries().length === 1 && r.n === evil.n + 1, "starting the log again keeps the chain going from the last hash");
ok(Object.keys(S.EVENTS).length >= 12 && Object.values(S.EVENTS).every((x) => !/name|diagnos/i.test(x)), "the event list holds no names or health details");

/* ---- in a real browser ---- */
const { chromium } = loadPlaywright(); const { srv, base } = await serve(); const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (x) { /* ignore */ } });
  const p = await ctx.newPage(), errs = [], outside = []; p.on("pageerror", (x) => errs.push(String(x).slice(0, 160))); p.on("request", (r2) => { if (!r2.url().startsWith(base) && !/^(data|blob|about):/.test(r2.url())) outside.push(r2.url()); });
  await p.goto(base + "builder.html#/"); await p.waitForSelector("#view h1", { timeout: 15000 }); await p.waitForTimeout(800);
  const ready = await p.evaluate(() => ({ log: !!(window.CogniAccessLog && window.CogniAccessLog.append), hook: !!window.CognicopiaSession.onExpire, first: window.CogniAccessLog && window.CogniAccessLog.entries()[0] && window.CogniAccessLog.entries()[0].ev }));
  ok(ready.log && ready.hook && ready.first === "session-start", "the page installs the log and hooks the inactivity timer, and logs the session start (" + JSON.stringify(ready) + ")");
  /* put something sensitive on the screen, then let the timer run out */
  await p.evaluate(() => { location.hash = "#/therapy-goals"; }); await p.waitForSelector("#gNote"); await p.fill("#gNote", "Resident note with details that must not linger");
  await p.evaluate(() => { window.__u = URL.createObjectURL(new Blob(["resident photo"])); window.print = () => {}; window.__marker = 1; });
  const before = await p.evaluate(() => ({ field: document.querySelector("#gNote").value.length, view: document.querySelector("#view").children.length, tracked: URL.__cgTracked && URL.__cgTracked.size }));
  ok(before.field > 10 && before.view > 0 && before.tracked >= 1, "before the wipe there is text in a field, a screen and a tracked object URL (" + JSON.stringify(before) + ")");
  /* run the real sanitizer without the reload that follows, to look at what it left */
  const after = await p.evaluate(async () => { const S = await import("/js/idle-sanitizer.js"); const done = S.sanitize(window, window.CogniAccessLog, {}); return { done, field: document.querySelector("#gNote") ? document.querySelector("#gNote").value : "gone", view: document.querySelector("#view").children.length, urls: URL.__cgTracked.size, title: document.title, log: window.CogniAccessLog.entries().map((e) => e.ev), sel: String(window.getSelection()), verify: window.CogniAccessLog.verify() }; });
  ok(after.done.includes("tools") && after.done.includes("screen") && after.done.includes("fields") && after.done.includes("object-urls") && after.done[0] === "log", "the wipe runs its steps, the log first (" + after.done.join(", ") + ")");
  ok(after.view === 0 && after.urls === 0 && after.title === "Cognicopia" && after.log[after.log.length - 1] === "idle-wipe" && after.verify.ok, "the screen is empty, object URLs are released, the title is plain and the wipe is in the log, which still verifies");
  const urlGone = await p.evaluate(async () => { try { const r2 = await fetch(window.__u); return r2.ok; } catch (x) { return false; } }); ok(urlGone === false, "the picture's object URL can no longer be read");
  /* the real timer: shorten it, wait, and see the page return to its start with the notice, the log written, and nothing saved lost */
  await p.goto(base + "builder.html#/"); await p.waitForSelector("#view h1"); await p.waitForTimeout(600);
  await p.evaluate(() => { window.__marker = 1; window.CogniStore = null; CG_LS.setItem("cognicopia_resident_keepme", JSON.stringify({ schema: "cognicopia.residentProfile", id: "keepme", tier1_core: { preferredName: "Kept" } })); window.CognicopiaSession.setLimit(1500); });
  await p.waitForFunction(() => window.__marker === undefined, null, { timeout: 12000 }); await p.waitForSelector("#view h1"); await p.waitForTimeout(600);
  const post = await p.evaluate(() => ({ evs: window.CogniAccessLog.entries().map((e) => e.ev), verify: window.CogniAccessLog.verify(), kept: !!CG_LS.getItem("cognicopia_resident_keepme"), note: !!document.getElementById("cgTimeoutNote") }));
  ok(post.evs.includes("idle-wipe") && post.verify.ok && post.kept && post.note, "after the real timer: the wipe is logged, the log verifies, the saved resident is still there and the timeout notice shows (" + post.evs.join(",") + ")");
  ok(outside.length === 0 && errs.length === 0, "no outside request and no script error (" + outside.concat(errs).slice(0, 2).join("; ") + ")");
  await ctx.close();
} finally { await browser.close(); srv.close(); }
if (problems.length) { console.error("idle sanitizer check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("idle sanitizer check passed: " + passed + " checks (SHA-256, chained access log, tamper detection, the cap, the wipe in a real browser)");
