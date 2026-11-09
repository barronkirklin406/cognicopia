/* Cognicopia Pillar 4: maintenance (Agents 21 to 25).

     21  OfflineCacheManager        the offline file bundle: a manifest with hashes, a cache of the site's own files, verification, pruning, and the text of a service worker
     22  ProfileIntegritySentinel   checks the saved profiles for damage, repairs what is safe, and makes verified, optionally encrypted backups
     23  DomCompatibilityTester     which browser features this browser has, which are missing, and what still works without them
     24  PerformanceProfiler        how long things take (median, 95th percentile), stage by stage, against budgets you set
     25  LicenseStateMonitor        the free-packet count and the license state in one place, with early warnings

   All of it runs in this browser. The cache manager fetches only files from the site's own address and refuses any other host. Backups
   leave the computer only if a person saves the file themselves; with a passphrase they are encrypted (AES-GCM) before that. The
   performance budgets are targets to watch while building, not promises, and no number here is for a public page. */

import { CognicopiaAgent } from "./agent-orchestrator.js";

export const VERSION = "1.0.0";
const enc = (s) => new TextEncoder().encode(s);
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const subtle = () => (globalThis.crypto && globalThis.crypto.subtle) || null;
export async function sha256Hex(data) {
  const s = subtle(); if (!s) throw new Error("this browser cannot compute a checksum");
  return hex(await s.digest("SHA-256", typeof data === "string" ? enc(data) : data));
}
const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
const canonical = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((q) => [q, x[q]])) : x));

/* ---------- 21. offline cache ---------- */
export const CACHE_PREFIX = "cognicopia-";
const MANIFEST_KEY = "/__cognicopia_manifest__";
const SAFE_PATH = /^[A-Za-z0-9._~\/%@+-]+(\?[A-Za-z0-9._~=&%-]*)?$/;
export class OfflineCacheManager extends CognicopiaAgent {
  constructor(o = {}) {
    super({ name: "OfflineCacheManager", stage: "preview", role: "Maintenance: offline asset bundler and cache manager", capabilities: ["precache", "verify", "prune", "service-worker"], ...o });
    this.caches = o.caches || (typeof caches !== "undefined" ? caches : null); this.fetchFn = o.fetchFn || (typeof fetch !== "undefined" ? (...a) => fetch(...a) : null);
    this.origin = o.origin || (typeof location !== "undefined" ? location.origin : "http://localhost"); this.version = String(o.version || "1").replace(/[^A-Za-z0-9._-]/g, "") || "1";
  }
  async handle(ctx) { return ctx; }
  cacheName() { return CACHE_PREFIX + this.version; }
  /* Only the site's own files: the same address, over http or https. */
  localUrl(u) { try { const x = new URL(String(u), this.origin + "/"); return (x.protocol === "http:" || x.protocol === "https:") && x.origin === new URL(this.origin).origin ? x.pathname + x.search : null; } catch (e) { return null; } }
  async precache(urls, o = {}) {
    if (!this.caches || !this.fetchFn) return { cached: [], failed: [{ url: "", reason: "no cache or no fetch in this browser" }], bytes: 0 };
    const seen = new Set(), list = (Array.isArray(urls) ? urls : []).map((u) => ({ raw: u, path: this.localUrl(u) })).filter((x) => { const k = x.path || "raw:" + x.raw; if (seen.has(k)) return false; seen.add(k); return true; }), cache = await this.caches.open(this.cacheName()), manifest = {}, cached = [], failed = []; let bytes = 0;
    const one = async ({ raw, path }) => {
      if (!path) { failed.push({ url: String(raw).slice(0, 80), reason: "not a file of this site" }); return; }
      try { const res = await this.fetchFn(path, { cache: "reload" }); if (!res || !res.ok) { failed.push({ url: path, reason: "status " + (res && res.status) }); return; }
        const buf = await res.clone().arrayBuffer(); manifest[path] = { sha256: await sha256Hex(buf), bytes: buf.byteLength }; bytes += buf.byteLength; await cache.put(path, res); cached.push(path); }
      catch (e) { failed.push({ url: path, reason: "could not be fetched" }); }
    };
    const n = Math.max(1, Math.min(8, o.concurrency || 4)); const q = list.slice(); await Promise.all(Array.from({ length: n }, async () => { for (let x; (x = q.shift());) await one(x); }));
    await cache.put(MANIFEST_KEY, new Response(JSON.stringify({ v: 1, version: this.version, files: manifest }), { headers: { "content-type": "application/json" } }));
    return { cached: cached.sort(), failed, bytes };
  }
  async manifest() { if (!this.caches) return null; try { const c = await this.caches.open(this.cacheName()), r = await c.match(MANIFEST_KEY); return r ? await r.json() : null; } catch (e) { return null; } }
  /* Is every file in the cache, and does it still match the checksum taken when it was stored? */
  async verify() {
    const m = await this.manifest(); if (!m) return { ok: false, missing: [], changed: [], reason: "nothing has been cached yet" };
    const c = await this.caches.open(this.cacheName()), missing = [], changed = [];
    for (const [path, meta] of Object.entries(m.files || {})) { const r = await c.match(path); if (!r) { missing.push(path); continue; } try { if ((await sha256Hex(await r.arrayBuffer())) !== meta.sha256) changed.push(path); } catch (e) { changed.push(path); } }
    return { ok: !missing.length && !changed.length, missing, changed, files: Object.keys(m.files || {}).length };
  }
  /* Remove the caches of older versions. Only ours (the prefix) and never the current one. */
  async prune() { if (!this.caches) return []; const gone = []; for (const k of await this.caches.keys()) if (k.startsWith(CACHE_PREFIX) && k !== this.cacheName()) { await this.caches.delete(k); gone.push(k); } return gone; }
  async status(estimate) {
    const m = await this.manifest(), est = typeof estimate === "function" ? estimate : (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate ? () => navigator.storage.estimate() : null);
    let quota = null; try { quota = est ? await est() : null; } catch (e) { quota = null; }
    return { cacheName: this.cacheName(), files: m ? Object.keys(m.files || {}).length : 0, bytes: m ? Object.values(m.files || {}).reduce((s, f) => s + (f.bytes || 0), 0) : 0, usage: quota && quota.usage != null ? quota.usage : null, quota: quota && quota.quota != null ? quota.quota : null };
  }
}
/* The text of a service worker that keeps these files for offline use. It is only text: saving it as sw.js and registering it is a deliberate step. */
export function renderServiceWorker(o = {}) {
  const version = String(o.version || "1").replace(/[^A-Za-z0-9._-]/g, "") || "1", urls = [...new Set((Array.isArray(o.urls) ? o.urls : []).map(String))];
  const bad = urls.filter((u) => !SAFE_PATH.test(u) || /^[a-z]+:|^\/\//i.test(u)); if (bad.length) throw new RangeError("these are not files of this site: " + bad.slice(0, 3).join(", "));
  const fallback = SAFE_PATH.test(String(o.fallback || "")) ? String(o.fallback) : "/index.html";
  return `/* Generated by js/pillar4-maintenance-agents.js. Keeps the site's own files for offline use. It never caches or fetches another site. */
const VERSION = ${JSON.stringify(version)}, PREFIX = ${JSON.stringify(CACHE_PREFIX)}, NAME = PREFIX + VERSION, FILES = ${JSON.stringify(urls)}, FALLBACK = ${JSON.stringify(fallback)};
self.addEventListener("install", (event) => { event.waitUntil(caches.open(NAME).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== NAME).map((k) => caches.delete(k)))).then(() => self.clients && self.clients.claim())); });
self.addEventListener("fetch", (event) => {
  const req = event.request; if (req.method !== "GET") return;
  const url = new URL(req.url); if (url.origin !== self.location.origin) return;
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res && res.ok) { const copy = res.clone(); caches.open(NAME).then((c) => c.put(req, copy)); } return res; }).catch(() => (req.mode === "navigate" ? caches.match(FALLBACK) : Response.error()))));
});
`;
}

/* ---------- 22. profile integrity ---------- */
export class ProfileIntegritySentinel extends CognicopiaAgent {
  constructor(o = {}) {
    super({ name: "ProfileIntegritySentinel", stage: "analyze", role: "Maintenance: profile integrity and backup sentinel", capabilities: ["check", "repair", "backup", "restore", "encrypt"], ...o });
    this.store = o.storage; this.now = o.now || (() => new Date()); this.keep = o.keep || 3; this.iterations = o.iterations || 210000;
  }
  /* In the pipeline: if a request names a saved resident whose record is damaged, say so in the analysis. */
  async handle(ctx) { const id = ctx.request && ctx.request.residentId; if (!id || !this.store) return ctx; const r = this.check(); const bad = r.corrupt.some((c) => c.key === "p:" + id); ctx.analysis = Object.assign({}, ctx.analysis, { integrity: { ok: !bad, corruptRecords: r.corrupt.length } }); return ctx; }
  keys() { try { return this.store.keys().filter((k) => !k.startsWith("bak:")); } catch (e) { return []; } }
  /* Every saved profile parses and has the fields it needs; the index and the records agree. */
  check() {
    const corrupt = [], keys = this.keys(), recs = keys.filter((k) => k.startsWith("p:")); let index = [], indexOk = true;
    try { const t = this.store.get("index"); index = t == null ? [] : JSON.parse(t); if (!Array.isArray(index)) throw new Error("x"); } catch (e) { indexOk = false; corrupt.push({ key: "index", reason: "the list of profiles cannot be read" }); }
    for (const k of recs) { try { const r = JSON.parse(this.store.get(k)); if (!r || typeof r !== "object" || r.id !== k.slice(2) || typeof r.alias !== "string" || !r.profile || typeof r.profile !== "object" || !Array.isArray(r.notes)) throw new Error("shape"); } catch (e) { corrupt.push({ key: k, reason: "the record is damaged" }); } }
    const have = new Set(recs.map((k) => k.slice(2))), good = new Set(recs.filter((k) => !corrupt.some((c) => c.key === k)).map((k) => k.slice(2)));
    const missing = indexOk ? index.filter((id) => !have.has(id)) : [], orphans = indexOk ? [...good].filter((id) => !index.includes(id)) : [...good];
    return { ok: corrupt.length === 0 && missing.length === 0 && orphans.length === 0, records: recs.length, corrupt, missing, orphans };
  }
  /* What is safe: rebuild the index from the good records. A damaged record is removed only when asked (a backup should be taken first). */
  repair(o = {}) {
    const r = this.check(), actions = [];
    if (o.dropCorrupt) for (const c of r.corrupt) if (c.key.startsWith("p:")) { this.store.remove(c.key); actions.push({ action: "removed", key: c.key }); }
    const ids = this.keys().filter((k) => k.startsWith("p:")).map((k) => k.slice(2)).filter((id) => { try { const x = JSON.parse(this.store.get("p:" + id)); return x && x.id === id && Array.isArray(x.notes); } catch (e) { return false; } });
    const before = JSON.stringify(this.store.get("index")); this.store.set("index", JSON.stringify(ids)); if (before !== JSON.stringify(this.store.get("index"))) actions.push({ action: "index rebuilt", entries: ids.length });
    return { actions, after: this.check() };
  }
  async snapshot() {
    const records = this.keys().sort().map((k) => [k, this.store.get(k)]).filter((r) => r[1] != null);
    const body = { v: 1, createdAt: this.now().toISOString(), count: records.length, records };
    return Object.assign({}, body, { sha256: await sha256Hex(canonical(body.records)) });
  }
  async verifySnapshot(b) {
    if (!b || b.v !== 1 || !Array.isArray(b.records) || typeof b.sha256 !== "string") return { ok: false, reason: "not a backup file" };
    if (!b.records.every((r) => Array.isArray(r) && r.length === 2 && typeof r[0] === "string" && typeof r[1] === "string")) return { ok: false, reason: "the backup's records are malformed" };
    return (await sha256Hex(canonical(b.records))) === b.sha256 ? { ok: true, count: b.records.length } : { ok: false, reason: "the backup has been changed or damaged" };
  }
  /* Restore only a verified backup. Existing records are kept unless overwrite is set. Backups themselves are never restored. */
  async restore(b, o = {}) {
    const v = await this.verifySnapshot(b); if (!v.ok) return { ok: false, reason: v.reason, restored: 0, skipped: 0 };
    let restored = 0, skipped = 0; for (const [k, val] of b.records) { if (k.startsWith("bak:")) { skipped++; continue; } if (this.store.get(k) != null && !o.overwrite) { skipped++; continue; } this.store.set(k, val); restored++; }
    return { ok: true, restored, skipped, after: this.check() };
  }
  /* A rolling set of backups kept beside the data, newest first. */
  async backup() { const s = await this.snapshot(), n = Number(this.store.get("bak:next") || 0) + 1; this.store.set("bak:" + n, JSON.stringify(s)); this.store.set("bak:next", String(n)); const all = this.backups(); for (const x of all.slice(this.keep)) this.store.remove("bak:" + x.n); return { n, count: s.count, at: s.createdAt }; }
  backups() { return this.store.keys().filter((k) => /^bak:\d+$/.test(k)).map((k) => ({ n: Number(k.slice(4)) })).sort((a, b) => b.n - a.n); }
  latestBackup() { const b = this.backups()[0]; try { return b ? JSON.parse(this.store.get("bak:" + b.n)) : null; } catch (e) { return null; } }
  /* A file a person can save: AES-GCM with a key made from the passphrase (PBKDF2, SHA-256). A wrong passphrase or a changed file fails to open. */
  async encrypt(bundle, passphrase) {
    const s = subtle(); if (!s) throw new Error("this browser cannot encrypt"); if (typeof passphrase !== "string" || passphrase.length < 8) throw new RangeError("the passphrase needs at least 8 characters");
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), iterations = this.iterations;
    const key = await s.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, await s.importKey("raw", enc(passphrase), "PBKDF2", false, ["deriveKey"]), { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    const ct = await s.encrypt({ name: "AES-GCM", iv }, key, enc(JSON.stringify(bundle)));
    return JSON.stringify({ cognicopiaBackup: 1, kdf: "PBKDF2-SHA256", iterations, salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(ct)) });
  }
  async decrypt(text, passphrase) {
    const s = subtle(); if (!s) throw new Error("this browser cannot decrypt");
    let f; try { f = JSON.parse(text); } catch (e) { return { ok: false, reason: "not a backup file" }; } if (!f || f.cognicopiaBackup !== 1 || !f.salt || !f.iv || !f.data) return { ok: false, reason: "not a backup file" };
    try { const iterations = Math.max(1000, Math.min(2000000, Number(f.iterations) || 0)), key = await s.deriveKey({ name: "PBKDF2", salt: unb64(f.salt), iterations, hash: "SHA-256" }, await s.importKey("raw", enc(String(passphrase)), "PBKDF2", false, ["deriveKey"]), { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      return { ok: true, bundle: JSON.parse(new TextDecoder().decode(await s.decrypt({ name: "AES-GCM", iv: unb64(f.iv) }, key, unb64(f.data)))) }; }
    catch (e) { return { ok: false, reason: "the passphrase is wrong or the file was changed" }; }
  }
}

/* ---------- 23. browser compatibility ---------- */
export const FEATURES = Object.freeze({
  dialog: { required: true, fallback: "dialogs open as plain panels", test: (w) => !!w.HTMLDialogElement && typeof w.HTMLDialogElement.prototype.showModal === "function" },
  customProperties: { required: true, fallback: "colors fall back to the page's plain styles", test: (w) => !!(w.CSS && w.CSS.supports && w.CSS.supports("color", "var(--x)")) },
  esModules: { required: true, fallback: "the agent suite cannot load", test: (w) => "noModule" in w.document.createElement("script") },
  localStorage: { required: true, fallback: "nothing can be remembered between visits", test: (w) => { try { const k = "__cg_probe__"; w.localStorage.setItem(k, "1"); w.localStorage.removeItem(k); return true; } catch (e) { return false; } } },
  matchMedia: { required: true, fallback: "dark and reduced-motion preferences are not read", test: (w) => typeof w.matchMedia === "function" },
  cssHas: { required: false, fallback: "a few highlights (such as a chosen card) do not show", test: (w) => !!(w.CSS && w.CSS.supports && w.CSS.supports("selector(:has(*))")) },
  focusVisible: { required: false, fallback: "the focus ring shows on mouse clicks too", test: (w) => !!(w.CSS && w.CSS.supports && w.CSS.supports("selector(:focus-visible)")) },
  subtleCrypto: { required: false, fallback: "checksums and encrypted backups are not available", test: (w) => !!(w.crypto && w.crypto.subtle) },
  indexedDB: { required: false, fallback: "the extra copy of the free-packet count is not kept", test: (w) => !!w.indexedDB },
  cacheApi: { required: false, fallback: "the offline file bundle cannot be kept", test: (w) => !!w.caches },
  serviceWorker: { required: false, fallback: "the site must be loaded online the first time each visit", test: (w) => !!(w.navigator && w.navigator.serviceWorker) },
  structuredClone: { required: false, fallback: "a slower copy is used", test: (w) => typeof w.structuredClone === "function" },
  resizeObserver: { required: false, fallback: "the preview does not resize itself", test: (w) => typeof w.ResizeObserver === "function" },
  inert: { required: false, fallback: "the page behind a dialog stays reachable by keyboard in older browsers", test: (w) => "inert" in w.HTMLElement.prototype }
});
export const MIN_VERSIONS = Object.freeze({ chrome: 105, edge: 105, firefox: 121, safari: 16, samsung: 20, opera: 91 });   // where :has(), dialogs and modules all work
export function parseUserAgent(ua) {
  const s = String(ua == null ? "" : ua), m = (re) => { const x = re.exec(s); return x ? parseInt(x[1], 10) : null; };
  let family = "unknown", major = null;
  if (/SamsungBrowser\/(\d+)/.test(s)) { family = "samsung"; major = m(/SamsungBrowser\/(\d+)/); }
  else if (/Edg(?:e|A|iOS)?\/(\d+)/.test(s)) { family = "edge"; major = m(/Edg(?:e|A|iOS)?\/(\d+)/); }
  else if (/OPR\/(\d+)/.test(s)) { family = "opera"; major = m(/OPR\/(\d+)/); }
  else if (/(?:Firefox|FxiOS)\/(\d+)/.test(s)) { family = "firefox"; major = m(/(?:Firefox|FxiOS)\/(\d+)/); }
  else if (/(?:Chrome|CriOS)\/(\d+)/.test(s)) { family = "chrome"; major = m(/(?:Chrome|CriOS)\/(\d+)/); }
  else if (/Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari/.test(s)) { family = "safari"; major = m(/Version\/(\d+)/); }
  return { family, major, mobile: /Mobi|Android|iPhone|iPad/.test(s), supported: major == null || !MIN_VERSIONS[family] ? null : major >= MIN_VERSIONS[family], minimum: MIN_VERSIONS[family] || null };
}
export class DomCompatibilityTester extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "DomCompatibilityTester", stage: "preview", role: "Maintenance: cross-browser DOM compatibility tester", capabilities: ["features", "smoke", "user-agent"], ...o }); }
  async handle(ctx) { return ctx; }
  featureReport(win) {
    const w = win || (typeof window !== "undefined" ? window : null), supported = {}, missing = [], advice = [];
    if (!w) return { supported, missing, level: "unsupported", advice: ["no browser window to test"], ua: parseUserAgent("") };
    for (const [k, f] of Object.entries(FEATURES)) { let ok = false; try { ok = !!f.test(w); } catch (e) { ok = false; } supported[k] = ok; if (!ok) { missing.push(k); advice.push((f.required ? "needed: " : "optional: ") + k + ": " + f.fallback); } }
    const reqMissing = missing.filter((k) => FEATURES[k].required), ua = parseUserAgent(w.navigator && w.navigator.userAgent);
    return { supported, missing, requiredMissing: reqMissing, level: reqMissing.length ? "unsupported" : missing.length ? "degraded" : "full", advice, ua };
  }
  /* Real behaviors, not just presence: a dialog opens and closes, details toggles, a form validates, a custom property applies, :has() matches. */
  smokeTest(win) {
    const w = win || window, d = w.document, results = [], host = d.createElement("div"); host.style.cssText = "position:fixed;left:-9999px;top:0;--cg-probe:12px";
    host.innerHTML = '<dialog id="p1"><p>x</p></dialog><details id="p2"><summary>s</summary>t</details><form id="p3"><input required id="p3i"></form><div id="p4"><span class="k"></span></div><div id="p5" style="width:var(--cg-probe)"></div>';
    d.body.append(host); const t = (name, fn) => { let ok = false, why = ""; try { ok = !!fn(); } catch (e) { why = String(e && e.message || e).slice(0, 60); } results.push({ name, ok, why }); };
    t("a modal dialog opens and closes", () => { const x = host.querySelector("#p1"); x.showModal(); const o = x.open; x.close(); return o && !x.open; });
    t("details opens when set", () => { const x = host.querySelector("#p2"); x.open = true; return x.open === true; });
    t("a required field is invalid when empty", () => host.querySelector("#p3").checkValidity() === false);
    t("a custom property sets a size", () => w.getComputedStyle(host.querySelector("#p5")).width === "12px");
    t("a selector with :has() matches", () => host.querySelector("#p4:has(.k)") !== null);
    t("matchMedia answers", () => typeof w.matchMedia("(prefers-reduced-motion: reduce)").matches === "boolean");
    host.remove(); return { ok: results.every((r) => r.ok), results };
  }
}

/* ---------- 24. performance ---------- */
export function stats(samples) {
  const a = (samples || []).filter((x) => Number.isFinite(x)).sort((x, y) => x - y), n = a.length; if (!n) return { n: 0, min: 0, median: 0, mean: 0, p95: 0, max: 0 };
  const q = (p) => a[Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1))], r = (x) => Math.round(x * 100) / 100;
  return { n, min: r(a[0]), median: r(n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2), mean: r(a.reduce((s, x) => s + x, 0) / n), p95: r(q(0.95)), max: r(a[n - 1]) };
}
export const DEFAULT_BUDGETS = Object.freeze({ total: 1000, generate: 400, audit: 200, analyze: 200 });   // milliseconds: targets to watch, not promises
export class PerformanceProfiler extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "PerformanceProfiler", stage: "preview", role: "Maintenance: JavaScript performance profiler", capabilities: ["measure", "stages", "budgets", "long-tasks"], ...o }); this.now = o.now || (() => (typeof performance !== "undefined" ? performance.now() : Date.now())); this.budgets = Object.assign({}, DEFAULT_BUDGETS, o.budgets); }
  async handle(ctx) { return ctx; }
  async measure(fn, o = {}) { const runs = Math.max(1, Math.min(200, o.runs || 5)), warm = Math.max(0, Math.min(10, o.warmup == null ? 1 : o.warmup)), out = []; for (let i = 0; i < warm; i++) await fn(); for (let i = 0; i < runs; i++) { const t0 = this.now(); await fn(); out.push(this.now() - t0); } return stats(out); }
  /* Run a request through the orchestrator several times and time each stage, as the orchestrator itself recorded it. */
  async profileOrchestrator(orchestrator, request, o = {}) {
    const runs = Math.max(1, Math.min(100, o.runs || 5)), totals = [], by = {};
    for (let i = 0; i < (o.warmup == null ? 1 : o.warmup); i++) await orchestrator.execute(request);
    for (let i = 0; i < runs; i++) { const t0 = this.now(), r = await orchestrator.execute(request); totals.push(this.now() - t0); const st = (r.diagnostics && r.diagnostics.stages) || []; const per = {}; for (const s of st) per[s.stage] = (per[s.stage] || 0) + (Number(s.ms) || 0); for (const k of Object.keys(per)) (by[k] = by[k] || []).push(per[k]); }
    const total = stats(totals), stages = Object.fromEntries(Object.keys(by).map((k) => [k, stats(by[k])]));
    return { runs, total, stages, budgets: this.check({ total, stages }) };
  }
  /* Compare the 95th percentile with each budget. */
  check(report, budgets) { const b = Object.assign({}, this.budgets, budgets), out = []; if (report.total && b.total != null) out.push({ name: "total", limitMs: b.total, p95: report.total.p95, ok: report.total.p95 <= b.total }); for (const [k, s] of Object.entries(report.stages || {})) if (b[k] != null) out.push({ name: k, limitMs: b[k], p95: s.p95, ok: s.p95 <= b[k] }); return out; }
  memory(win) { const w = win || (typeof performance !== "undefined" ? { performance } : null), m = w && w.performance && w.performance.memory; return m ? { usedMB: Math.round(m.usedJSHeapSize / 1048576 * 10) / 10, limitMB: Math.round(m.jsHeapSizeLimit / 1048576) } : null; }
  /* Tasks that hold the page for 50 ms or more, where the browser reports them. */
  observeLongTasks(win) {
    const w = win || (typeof window !== "undefined" ? window : null), tasks = []; if (!w || typeof w.PerformanceObserver !== "function") return { supported: false, tasks: () => [], stop: () => {} };
    let obs = null; try { obs = new w.PerformanceObserver((l) => { for (const e of l.getEntries()) tasks.push({ ms: Math.round(e.duration), at: Math.round(e.startTime) }); }); obs.observe({ type: "longtask", buffered: true }); } catch (e) { return { supported: false, tasks: () => [], stop: () => {} }; }
    return { supported: true, tasks: () => tasks.slice(), stop: () => { try { obs.disconnect(); } catch (e) { /* already stopped */ } } };
  }
}

/* ---------- 25. trial and license ---------- */
export const RENEWAL_WARNING_DAYS = 14, TRIAL_WARNING_RUNS = 5;
export class LicenseStateMonitor extends CognicopiaAgent {
  /* o.ledger: { count() }; o.license: { status(), onChange?(fn) }; o.config: { FREE_RUNS } */
  constructor(o = {}) {
    super({ name: "LicenseStateMonitor", stage: "analyze", role: "Maintenance: trial and license state monitor", capabilities: ["state", "warnings", "subscribe"], ...o });
    this.ledger = o.ledger || (typeof globalThis !== "undefined" && globalThis.CogniTrialLedger && globalThis.CogniTrialLedger.forBrowser ? null : null); this.license = o.license || (typeof globalThis !== "undefined" ? globalThis.CognicopiaLicense : null) || null;
    this.config = o.config || (typeof globalThis !== "undefined" ? globalThis.CognicopiaLicenseConfig : null) || { FREE_RUNS: 50 }; this.listeners = [];
    if (this.license && typeof this.license.onChange === "function") { try { this.license.onChange(() => this.notify()); } catch (e) { /* a license service without change events is fine */ } }
  }
  async handle(ctx) { const s = this.state(); ctx.analysis = Object.assign({}, ctx.analysis, { license: { mode: s.mode, runsLeft: s.runsLeft } }); return ctx; }
  state() {
    const free = Number(this.config && this.config.FREE_RUNS) || 50; let used = null; try { used = this.ledger && typeof this.ledger.count === "function" ? Number(this.ledger.count()) : null; if (!Number.isFinite(used)) used = null; } catch (e) { used = null; }
    let st = null; try { st = this.license && typeof this.license.status === "function" ? this.license.status() : null; } catch (e) { st = null; }
    const warnings = [], runsLeft = used == null ? null : Math.max(0, free - used);
    let mode = "unknown";
    if (st && st.licensed) {
      mode = st.inGrace ? "grace" : "licensed";
      if (st.inGrace) warnings.push("This license has passed its paid-through date and is in its grace period" + (st.graceEndsAt ? " (until " + new Date(st.graceEndsAt).toISOString().slice(0, 10) + ")" : "") + ". Renew to keep it going.");
      else if (st.daysLeft != null && st.daysLeft <= RENEWAL_WARNING_DAYS) warnings.push("This license ends in " + Math.max(0, st.daysLeft) + " day" + (st.daysLeft === 1 ? "" : "s") + ". Renew to keep it going.");
    } else if (st && st.lapsed) { mode = "lapsed"; warnings.push("The license for " + (st.lapsed.facilityName || "this facility") + " has ended. Paste a renewed key or choose a plan."); }
    else if (used != null) { mode = runsLeft === 0 ? "trial-exhausted" : runsLeft <= TRIAL_WARNING_RUNS ? "trial-ending" : "trial"; if (mode === "trial-exhausted") warnings.push("The " + free + " free packets have been used. A license is needed to make more."); else if (mode === "trial-ending") warnings.push(runsLeft + " free packet" + (runsLeft === 1 ? "" : "s") + " left."); }
    return { mode, freeRuns: free, runsUsed: used, runsLeft, licensed: !!(st && st.licensed), type: st && st.type || null, tier: st && st.tierLabel || null, facility: st && st.facilityName || null, expiresAt: st && st.expiresAt || null, daysLeft: st && st.daysLeft != null ? st.daysLeft : null, inGrace: !!(st && st.inGrace), warnings };
  }
  /* May another packet be made? Mirrors the page's own gate; it reports, and the page decides. */
  canGenerate() { const s = this.state(); return { allowed: s.mode !== "trial-exhausted" && s.mode !== "lapsed", mode: s.mode, reason: s.mode === "trial-exhausted" ? "free packets used" : s.mode === "lapsed" ? "license ended" : "" }; }
  subscribe(fn) { if (typeof fn !== "function") return () => {}; this.listeners.push(fn); return () => { this.listeners = this.listeners.filter((x) => x !== fn); }; }
  notify() { const s = this.state(); for (const fn of this.listeners.slice()) { try { fn(s); } catch (e) { /* one listener never stops the rest */ } } return s; }
}

/* ---------- wiring ---------- */
export const PILLAR4_AGENTS = Object.freeze(["OfflineCacheManager", "ProfileIntegritySentinel", "DomCompatibilityTester", "PerformanceProfiler", "LicenseStateMonitor"]);
export function registerPillar4(orchestrator, o = {}) {
  if (!orchestrator || typeof orchestrator.use !== "function") throw new TypeError("registerPillar4 needs an orchestrator");
  const agents = { cache: new OfflineCacheManager(o.cache || {}), integrity: new ProfileIntegritySentinel({ storage: o.storage, now: o.now, iterations: o.iterations }), dom: new DomCompatibilityTester(), perf: new PerformanceProfiler(o.perf || {}), license: new LicenseStateMonitor(o.license || {}) };
  Object.values(agents).forEach((a) => orchestrator.use(a));
  return agents;
}
