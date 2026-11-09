#!/usr/bin/env node
/* =====================================================================
   js/pillar4-maintenance-agents.js (Agents 21 to 25), in Node. (Real-browser checks: scripts/check-pillar4-ui.mjs.)

     cache        only the site's own files are cached, with checksums; verify finds a changed or missing file; old
                  versions are pruned; the generated service worker is run against a stand-in and behaves
     integrity    damaged, missing and stray profile records are found; the index is rebuilt; backups are verified,
                  rotated and restored; an encrypted backup opens only with its passphrase and only unchanged
     compat       browsers are recognised from their user-agent text; a missing feature is listed with what still works
     performance  median and 95th percentile, per-stage timing from the orchestrator, budgets
     license      trial, trial-ending, exhausted, licensed, renewal warning, grace and lapsed states
   ===================================================================== */
import { createOrchestrator } from "../js/agent-orchestrator.js";
import { ClinicalAuditAgent } from "../js/clinical-audit-agent.js";
import { registerReminiscence } from "../js/reminiscence-engine.js";
import { ProfileHub, memoryStorage } from "../js/pillar2-functionality-agents.js";
import vm from "node:vm";
import { registerPillar4, OfflineCacheManager, renderServiceWorker, ProfileIntegritySentinel, DomCompatibilityTester, PerformanceProfiler, LicenseStateMonitor, sha256Hex, parseUserAgent, stats, FEATURES, MIN_VERSIONS, DEFAULT_BUDGETS, CACHE_PREFIX, PILLAR4_AGENTS } from "../js/pillar4-maintenance-agents.js";

let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

/* ---------- 21. cache ---------- */
const keyOf = (r) => { if (typeof r === "string") return new URL(r, "https://cognicopia.org/").pathname; const u = new URL(r.url); return u.pathname + u.search; };
function fakeCaches() {
  const store = new Map();
  const mk = (name) => { if (!store.has(name)) store.set(name, new Map()); const m = store.get(name); return { put: async (r, res) => { m.set(keyOf(r), res); }, match: async (r) => { const x = m.get(keyOf(r)); return x ? x.clone() : undefined; }, addAll: async (urls) => { for (const u of urls) m.set(keyOf(u), new Response("body of " + u)); }, keys: async () => [...m.keys()], delete: async (r) => m.delete(keyOf(r)), _m: m }; };
  return { open: async (n) => mk(n), keys: async () => [...store.keys()], delete: async (n) => store.delete(n), match: async (r) => { for (const m of store.values()) { const x = m.get(keyOf(r)); if (x) return x.clone(); } return undefined; }, _store: store, _mk: mk };
}
const FILES = { "/index.html": "<html>home</html>", "/css/styles.css": "body{color:#000}", "/js/app.js": "console.log(1)" };
const fetchFn = async (p) => (FILES[p] ? new Response(FILES[p], { status: 200 }) : new Response("nope", { status: 404 }));
const cs = fakeCaches(), cm = new OfflineCacheManager({ caches: cs, fetchFn, origin: "https://cognicopia.org", version: "7" });
ok(cm.cacheName() === "cognicopia-7" && cm.localUrl("/a/b.js?x=1") === "/a/b.js?x=1" && cm.localUrl("css/x.css") === "/css/x.css" && cm.localUrl("https://evil.example.com/x.js") === null && cm.localUrl("javascript:alert(1)") === null && cm.localUrl("//evil.example.com/x") === null && cm.localUrl("https://cognicopia.org/ok.js") === "/ok.js", "only the site's own files are accepted: other hosts, javascript: and protocol-relative addresses are refused");
const pre = await cm.precache(["/index.html", "css/styles.css", "/js/app.js", "https://evil.example.com/x.js", "/missing.js", "/index.html"]);
ok(pre.cached.join() === "/css/styles.css,/index.html,/js/app.js" && pre.failed.length === 2 && pre.failed.some((f) => /not a file of this site/.test(f.reason)) && pre.failed.some((f) => /404/.test(f.reason)) && pre.bytes === Object.values(FILES).reduce((s, t) => s + t.length, 0), `three files are cached once each, a foreign file and a missing file fail with a reason (${pre.bytes} bytes)`);
const mf = await cm.manifest(); ok(mf.files["/index.html"].sha256 === await sha256Hex(FILES["/index.html"]) && mf.version === "7", "the manifest holds each file's SHA-256");
ok((await cm.verify()).ok === true && (await cm.verify()).files === 3, "verification passes on a fresh cache");
const cache7 = cs._store.get("cognicopia-7"); cache7.set("/js/app.js", new Response("tampered")); cache7.delete("/css/styles.css");
const vf = await cm.verify(); ok(!vf.ok && vf.changed.join() === "/js/app.js" && vf.missing.join() === "/css/styles.css", "a changed file and a missing file are each named");
ok((await new OfflineCacheManager({ caches: fakeCaches(), fetchFn, origin: "https://cognicopia.org" }).verify()).reason === "nothing has been cached yet", "verifying before anything is cached says so");
cs._mk("cognicopia-6"); cs._mk("cognicopia-5"); cs._mk("other-site-cache");
ok((await cm.prune()).sort().join() === "cognicopia-5,cognicopia-6" && (await cs.keys()).sort().join() === "cognicopia-7,other-site-cache", "old versions are removed; the current cache and anyone else's are left alone");
const stt = await cm.status(async () => ({ usage: 1234, quota: 99999 })); ok(stt.files === 3 && stt.usage === 1234 && stt.quota === 99999 && (await cm.status(async () => { throw new Error("x"); })).quota === null, "status reports files, bytes and quota, and survives a failing estimate");
const none = await new OfflineCacheManager({ caches: null, fetchFn: null }).precache(["/a"]); ok(none.cached.length === 0 && none.failed.length === 1, "with no cache support, precaching fails plainly");
const flaky = await new OfflineCacheManager({ caches: fakeCaches(), fetchFn: async () => { throw new Error("offline"); }, origin: "https://cognicopia.org" }).precache(["/a.js"]); ok(flaky.failed[0].reason === "could not be fetched", "a fetch that throws is a failed file, not an error");
/* service worker text */
const sw = renderServiceWorker({ version: "7.1", urls: ["/index.html", "/css/styles.css"] });
ok(/cognicopia-/.test(sw) && !/https?:\/\//.test(sw.replace(/\/\* [^*]*\*\//, "")) && sw.includes('"/index.html"'), "the service worker text lists the files and names no other site");
let bad = 0; for (const u of ["https://evil.example.com/x.js", "//evil.example.com/x", 'a";alert(1)//', "javascript:alert(1)", "/a b.js", "/a\n.js"]) { try { renderServiceWorker({ urls: [u] }); bad++; } catch (e) { if (!(e instanceof RangeError)) bad++; } } ok(bad === 0, "a worker is never made from an address that is not a plain file of this site");
{ const handlers = {}, caches2 = fakeCaches(), log = []; const self2 = { addEventListener: (t, f) => { handlers[t] = f; }, location: { origin: "https://cognicopia.org" }, skipWaiting: () => { log.push("skipWaiting"); return Promise.resolve(); }, clients: { claim: () => { log.push("claim"); return Promise.resolve(); } } };
  const net = { ok: true }; const fetch2 = async (req) => { log.push("net " + req.url); if (!net.ok) throw new Error("offline"); return new Response("fresh", { status: 200 }); };
  vm.runInNewContext(sw, { self: self2, caches: caches2, fetch: fetch2, URL, Response, Promise });
  let waited; const ev = (extra) => Object.assign({ waitUntil: (p) => { waited = p; }, respondWith: (p) => { waited = p; } }, extra);
  caches2._mk("cognicopia-1")._m.set("/old.html", new Response("old"));
  await handlers.install(ev()) ; await waited; ok(caches2._store.get("cognicopia-7.1") && caches2._store.get("cognicopia-7.1").has("/index.html") && log.includes("skipWaiting"), "the worker's install step caches the listed files");
  await handlers.activate(ev()); await waited; ok(!caches2._store.has("cognicopia-1") && caches2._store.has("cognicopia-7.1") && log.includes("claim"), "the activate step removes older cognicopia caches and keeps the new one");
  log.length = 0; await handlers.fetch(ev({ request: { method: "GET", url: "https://cognicopia.org/index.html", mode: "navigate" } })); const hit = await waited; ok((await hit.text()).startsWith("body of") && !log.some((l) => l.startsWith("net")), "a cached file is served from the cache without the network");
  log.length = 0; const r2 = await (async () => { await handlers.fetch(ev({ request: { method: "GET", url: "https://cognicopia.org/new.css", mode: "no-cors" } })); return waited; })(); await new Promise((r) => setTimeout(r, 10)); ok((await r2.text()) === "fresh" && caches2._store.get("cognicopia-7.1").has("/new.css"), "an uncached file comes from the network and is kept");
  waited = undefined; handlers.fetch(ev({ request: { method: "POST", url: "https://cognicopia.org/x", mode: "cors" } })); ok(waited === undefined, "a POST is left alone");
  waited = undefined; handlers.fetch(ev({ request: { method: "GET", url: "https://api.example.com/x", mode: "cors" } })); ok(waited === undefined, "a request to another site is never touched");
  net.ok = false; await handlers.fetch(ev({ request: { method: "GET", url: "https://cognicopia.org/gone", mode: "navigate" } })); const off = await waited; ok((await off.text()).startsWith("body of /index.html"), "offline, a page that is not cached falls back to the home page"); }

/* ---------- 22. integrity ---------- */
const store = memoryStorage(), hub = new ProfileHub({ storage: store }), sen = new ProfileIntegritySentinel({ storage: store, iterations: 1000, keep: 3 });
const id1 = hub.save("Room 1", { preferredName: "Peggy" }), id2 = hub.save("Room 2", { preferredName: "Harold" }), id3 = hub.save("Room 3", { preferredName: "Ruth" }); hub.addNote(id1, "note");
ok(sen.check().ok && sen.check().records === 3, "healthy profiles pass the check");
store.set("p:" + id2, "{broken"); store.remove("p:" + id3); store.set("p:r_stray", JSON.stringify({ id: "r_stray", alias: "Stray", profile: {}, notes: [] }));
const bad1 = sen.check(); ok(!bad1.ok && bad1.corrupt.some((c) => c.key === "p:" + id2) && bad1.missing.includes(id3) && bad1.orphans.includes("r_stray"), "a damaged record, a record the list names but is gone, and a record the list lacks are each found");
const rp = sen.repair(); ok(rp.actions.some((a) => a.action === "index rebuilt") && store.get("p:" + id2) === "{broken" && JSON.parse(store.get("index")).sort().join() === [id1, "r_stray"].sort().join(), "repair rebuilds the index from good records and does not delete the damaged one unasked");
const rp2 = sen.repair({ dropCorrupt: true }); ok(rp2.after.ok && store.get("p:" + id2) === null && rp2.actions.some((a) => a.action === "removed"), "when asked, the damaged record is removed and the check then passes");
store.set("index", "not json"); ok(sen.check().corrupt.some((c) => c.key === "index") && sen.repair().after.ok, "an unreadable list is rebuilt");
const snap = await sen.snapshot(); const v1 = await sen.verifySnapshot(snap); ok(v1.ok && v1.count === snap.count && snap.v === 1 && /^[0-9a-f]{64}$/.test(snap.sha256), "a backup carries a SHA-256 of its records and verifies");
const forged = JSON.parse(JSON.stringify(snap)); { const r = forged.records.find((x) => /Peggy/.test(x[1])); r[1] = r[1].replace("Peggy", "Mallory"); } ok(!(await sen.verifySnapshot(forged)).ok && !(await sen.verifySnapshot(null)).ok && !(await sen.verifySnapshot({ v: 1, records: [[1, 2]], sha256: "x" })).ok && !(await sen.verifySnapshot({ v: 2 })).ok, "a changed, empty or malformed backup is refused");
const target = memoryStorage(), sen2 = new ProfileIntegritySentinel({ storage: target }); target.set("p:" + id1, "existing");
const rs = await sen2.restore(snap); ok(rs.ok && rs.skipped === 1 && target.get("p:" + id1) === "existing" && rs.restored === snap.count - 1, "restoring keeps what is already there unless told to overwrite");
const rs2 = await sen2.restore(snap, { overwrite: true }); ok(rs2.ok && JSON.parse(target.get("p:" + id1)).alias === "Room 1" && rs2.after.ok, "with overwrite, the backup wins and the result checks out");
ok((await sen2.restore(forged)).ok === false && (await sen2.restore(forged)).restored === 0, "a forged backup restores nothing");
for (let i = 0; i < 5; i++) { hub.addNote(id1, "n" + i); await sen.backup(); }
ok(sen.backups().length === 3 && sen.backups()[0].n === 5 && sen.latestBackup().v === 1 && !sen.keys().some((k) => k.startsWith("bak:")) && !(await sen.snapshot()).records.some((r) => r[0].startsWith("bak:")), "backups rotate to the newest three and are not backed up inside backups");
const encd = await sen.encrypt(snap, "correct horse battery"); const opened = await sen.decrypt(encd, "correct horse battery");
ok(opened.ok && (await sen.verifySnapshot(opened.bundle)).ok && !/Peggy|Room 1/.test(encd), "an encrypted backup opens with its passphrase, verifies, and shows no resident detail in the file");
ok(!(await sen.decrypt(encd, "wrong passphrase!")).ok && !(await sen.decrypt(encd.replace(/"data":"(.)/, '"data":"A'), "correct horse battery")).ok && (await sen.decrypt("junk", "x")).reason === "not a backup file" && (await sen.decrypt("{}", "x")).ok === false, "a wrong passphrase, a changed file and a file that is not a backup all fail with a plain reason");
let short = false; try { await sen.encrypt(snap, "short"); } catch (e) { short = e instanceof RangeError; } ok(short, "a passphrase under 8 characters is refused");
ok(JSON.parse(await sen.encrypt(snap, "another passphrase")).salt !== JSON.parse(encd).salt, "each encrypted file has its own salt");
const o = registerReminiscence(createOrchestrator().use(new ClinicalAuditAgent())); const p4 = registerPillar4(o, { storage: store, iterations: 1000, cache: { caches: fakeCaches(), fetchFn, origin: "https://cognicopia.org" } });
store.set("p:" + id1, "{broken"); const flagged = await o.execute({ residentId: id1, profile: { preferredName: "Peggy" }, options: { template: "reminiscence" } }); ok(flagged.analysis.integrity && flagged.analysis.integrity.ok === false, "in the pipeline a damaged record for the named resident is flagged in the analysis");

/* ---------- 23. compat ---------- */
const UA = { chrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91", firefox: "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0", safariIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1", samsung: "Mozilla/5.0 (Linux; Android 13; SM-T970) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Safari/537.36", oldChrome: "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36", oldSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15", oldFirefox: "Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0" };
const pu = Object.fromEntries(Object.entries(UA).map(([k, v]) => [k, parseUserAgent(v)]));
ok(pu.chrome.family === "chrome" && pu.chrome.major === 120 && pu.chrome.supported === true && pu.edge.family === "edge" && pu.firefox.family === "firefox" && pu.firefox.supported === true && pu.safariIos.family === "safari" && pu.safariIos.major === 17 && pu.safariIos.mobile && pu.samsung.family === "samsung" && pu.samsung.mobile, "Chrome, Edge, Firefox, Safari on a phone and Samsung Internet are recognised from their user-agent text");
ok(pu.oldChrome.supported === false && pu.oldSafari.supported === false && pu.oldFirefox.supported === false && pu.oldChrome.minimum === MIN_VERSIONS.chrome && parseUserAgent("").supported === null && parseUserAgent(null).family === "unknown" && parseUserAgent("curl/8").family === "unknown", "browsers older than the minimum are marked unsupported, and unknown text is neither");
const fullWin = { document: { createElement: () => ({ noModule: true }) }, HTMLDialogElement: function () {}, CSS: { supports: () => true }, localStorage: { setItem() {}, removeItem() {} }, matchMedia: () => ({ matches: false }), crypto: { subtle: {} }, indexedDB: {}, caches: {}, navigator: { serviceWorker: {}, userAgent: UA.chrome }, structuredClone: () => {}, ResizeObserver: function () {}, HTMLElement: { prototype: { inert: false } } };
fullWin.HTMLDialogElement.prototype.showModal = function () {}; Object.defineProperty(fullWin.HTMLElement.prototype, "inert", { value: false });
const dt = new DomCompatibilityTester(), full = dt.featureReport(fullWin);
ok(full.level === "full" && full.missing.length === 0 && Object.keys(full.supported).length === Object.keys(FEATURES).length && full.ua.family === "chrome", "a window with every feature reports full support");
const weak = Object.assign({}, fullWin, { HTMLDialogElement: undefined, CSS: { supports: (a, b) => /selector\(:has/.test(a) ? false : true }, caches: undefined, localStorage: { setItem() { throw new Error("blocked"); }, removeItem() {} } }), wr = dt.featureReport(weak);
ok(wr.level === "unsupported" && wr.requiredMissing.join() === "dialog,localStorage" && wr.missing.includes("cssHas") && wr.missing.includes("cacheApi") && wr.advice.some((a) => /^needed: dialog/.test(a)) && wr.advice.some((a) => /^optional: cssHas: a few highlights/.test(a)), "missing features are listed with whether they are needed and what still works");
const opt = dt.featureReport(Object.assign({}, fullWin, { caches: undefined })); ok(opt.level === "degraded" && opt.requiredMissing.length === 0, "only optional features missing is degraded, not unsupported");
ok(dt.featureReport(null).level === "unsupported" && Object.values(FEATURES).every((f) => typeof f.test === "function" && typeof f.required === "boolean" && f.fallback), "no window is unsupported, and every feature has a test, a need and a fallback");

/* ---------- 24. performance ---------- */
const s1 = stats([5, 1, 3, 2, 4, 100, 7, 6, 8, 9]);
ok(s1.n === 10 && s1.min === 1 && s1.max === 100 && s1.median === 5.5 && s1.p95 === 100 && s1.mean === 14.5 && stats([]).n === 0 && stats([NaN, "x", 3]).n === 1 && stats([4]).median === 4, "min, median, mean, 95th percentile and max are computed, and junk is ignored");
let tick = 0; const pf = new PerformanceProfiler({ now: () => (tick += 10) }), m1 = await pf.measure(async () => {}, { runs: 4, warmup: 2 });
ok(m1.n === 4 && m1.median === 10, "measure runs the warm-up, then times each run");
const prof = await pf.profileOrchestrator(o, { profile: { preferredName: "Peggy", formativeEra: "1950s", ailmentTier: 1 }, options: { template: "reminiscence" } }, { runs: 3 });
ok(prof.runs === 3 && prof.total.n === 3 && ["analyze", "generate", "audit"].every((k) => prof.stages[k] && prof.stages[k].n === 3) && prof.budgets.some((b) => b.name === "total") && prof.budgets.every((b) => typeof b.ok === "boolean"), "the orchestrator is timed per stage from its own records, and compared with each budget (" + Object.keys(prof.stages).join(",") + ")");
ok(pf.check({ total: { p95: 5000 }, stages: { generate: { p95: 100 }, audit: { p95: 900 } } }).filter((b) => !b.ok).map((b) => b.name).join() === "total,audit" && pf.check({ total: { p95: 1 }, stages: {} }, { total: 0.5 })[0].ok === false && DEFAULT_BUDGETS.total > 0, "a 95th percentile over its budget fails and a custom budget replaces the default");
ok(pf.memory({ performance: {} }) === null && pf.memory({ performance: { memory: { usedJSHeapSize: 52428800, jsHeapSizeLimit: 2147483648 } } }).usedMB === 50 && pf.observeLongTasks({}).supported === false && pf.observeLongTasks({ PerformanceObserver: function () { throw new Error("x"); } }).supported === false, "memory and long-task watching say plainly when the browser cannot give them");
{ let cb; const w = { PerformanceObserver: function (f) { cb = f; this.observe = () => {}; this.disconnect = () => { cb = null; }; } }; const lt = pf.observeLongTasks(w); cb({ getEntries: () => [{ duration: 120.4, startTime: 10 }] }); ok(lt.supported && lt.tasks()[0].ms === 120 && (lt.stop(), cb === null), "long tasks are collected and watching can be stopped"); }

/* ---------- 25. license ---------- */
const mk = (used, st, free = 50) => new LicenseStateMonitor({ ledger: { count: () => used }, license: { status: () => st }, config: { FREE_RUNS: free } });
const noLic = { licensed: false, lapsed: null };
let s;
s = mk(3, noLic).state(); ok(s.mode === "trial" && s.runsLeft === 47 && s.warnings.length === 0, "a few packets used is a plain trial");
s = mk(46, noLic).state(); ok(s.mode === "trial-ending" && s.runsLeft === 4 && /4 free packets left/.test(s.warnings[0]), "five or fewer left warns");
s = mk(49, noLic).state(); ok(/1 free packet left\./.test(s.warnings[0]), "one left is worded in the singular");
s = mk(50, noLic); ok(s.state().mode === "trial-exhausted" && s.canGenerate().allowed === false && /free packets used/.test(s.canGenerate().reason) && /50 free packets have been used/.test(s.state().warnings[0]), "all used is exhausted, and generation is reported as not allowed");
s = mk(80, noLic).state(); ok(s.mode === "trial-exhausted" && s.runsLeft === 0, "a count past the allowance still reads as none left");
s = mk(50, { licensed: true, keyed: true, type: "key", facilityName: "Maple Grove", tierLabel: "Annual facility license", daysLeft: 200, expiresAt: 1 }).state(); ok(s.mode === "licensed" && s.licensed && s.facility === "Maple Grove" && s.warnings.length === 0 && mk(50, { licensed: true, daysLeft: 200 }).canGenerate().allowed, "a license with time left is licensed, with no warning, even if the free packets are used");
s = mk(0, { licensed: true, daysLeft: 9 }).state(); ok(s.mode === "licensed" && /ends in 9 days/.test(s.warnings[0]), "within 14 days of the end, a renewal warning appears");
s = mk(0, { licensed: true, daysLeft: 1 }).state(); ok(/ends in 1 day\./.test(s.warnings[0]), "one day left is worded in the singular");
s = mk(0, { licensed: true, inGrace: true, graceEndsAt: Date.UTC(2026, 11, 31), daysLeft: -3 }).state(); ok(s.mode === "grace" && /grace period \(until 2026-12-31\)/.test(s.warnings[0]) && mk(0, { licensed: true, inGrace: true }).canGenerate().allowed, "a license past its date but in grace is grace, still allowed, with the end date");
s = mk(10, { licensed: false, lapsed: { facilityName: "Maple Grove" } }); ok(s.state().mode === "lapsed" && s.canGenerate().allowed === false && /Maple Grove/.test(s.state().warnings[0]), "a lapsed license is lapsed and not allowed");
const broken = new LicenseStateMonitor({ ledger: { count() { throw new Error("x"); } }, license: { status() { throw new Error("y"); } }, config: null }); ok(broken.state().mode === "unknown" && broken.state().freeRuns === 50 && broken.canGenerate().allowed === true && new LicenseStateMonitor({ ledger: { count: () => "abc" } }).state().runsUsed === null, "services that throw or answer nonsense give an unknown state, never an error");
let changeFn; const lm = new LicenseStateMonitor({ ledger: { count: () => 1 }, license: { status: () => noLic, onChange: (f) => { changeFn = f; } } }), seen = []; const un = lm.subscribe((st) => seen.push(st.mode)); lm.subscribe(() => { throw new Error("bad listener"); }); changeFn(); un(); changeFn();
ok(seen.join() === "trial" && lm.subscribe("x")() === undefined, "listeners hear about a license change, one that throws does not stop the rest, and unsubscribing works");
const lic = await o.execute({ profile: { preferredName: "Peggy" }, options: { template: "reminiscence" } }); ok(lic.analysis.license && typeof lic.analysis.license.mode === "string", "in the pipeline the license state is added to the analysis");

/* ---------- pipeline ---------- */
const ids = o.integrity(); ok(ids.ok && PILLAR4_AGENTS.every((n) => o.agents().some((x) => x.name === n)) && ids.pings.every((p) => p.ok) && CACHE_PREFIX === "cognicopia-", "the five agents are registered and answer the ping");
ok(p4.cache instanceof OfflineCacheManager && p4.integrity instanceof ProfileIntegritySentinel && p4.dom instanceof DomCompatibilityTester && p4.perf instanceof PerformanceProfiler && p4.license instanceof LicenseStateMonitor, "the five agents are the five classes");
let t = false; try { registerPillar4(null); } catch (e) { t = e instanceof TypeError; } ok(t, "registering with no orchestrator is refused");

if (problems.length) { console.error("pillar 4 check FAILED: " + problems.length + " problem(s), " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("pillar 4 check passed: " + passed + " checks (offline cache and service worker, profile integrity and encrypted backups, browser compatibility, performance profiling, trial and license states, orchestrator wiring)");
