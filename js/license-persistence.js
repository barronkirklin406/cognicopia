/* =====================================================================
   Cognicopia license persistence (browser, offline, ES module).

   Keeps a verified license key in two places so a browser restart, a
   blocked database or one lost copy does not send a facility back to the
   "paste your key" window:

     primary   IndexedDB  database "cognicopia_store", object store "license"
     backup    localStorage  "cognicopia_store_license", written first and
               synchronously, so it is there even if the page closes at once

   What decides whether a computer is licensed does not change. The signed
   key (ECDSA P-256, assets/services/licenseManager.js) is the only
   authority, and its own paid-through date plus GRACE_DAYS is the only
   clock that can end it. This file never grants access itself: it keeps a
   copy of a key the license manager already accepted and, when the
   manager's own copy is gone, hands that key back to
   CognicopiaLicense.activateKey(), which checks the signature, the dates
   and the revoked list again.

   What is stored, and what each part is for
     token        the COG1.… key (a business name, a plan and two dates,
                  never a resident)
     sigHash      SHA-256 of the key's signature part; the two layers and the
                  token must agree on it
     activatedAt  when this computer first kept the key
     expiresAt    activatedAt + 365 days, but never later than the day the key
                  itself stops working (paid-through date plus grace days), so
                  the copy cannot outlive the key. If the 365 days pass while
                  the signed key is still good (a multi-year Enterprise key),
                  the next page load starts a new window; no one is asked to
                  paste anything, because the signed date is the only clock
                  that can end a license
     fp           a short SHA-256 of coarse device traits (platform, touch,
                  processor count, language). It is computed and compared
                  here and never leaves the browser; no header is sent
                  anywhere, because nothing in this file uses the network
     digest       SHA-256 over all of the above
   The digest and fp are not secrets: anyone who can edit storage can
   recompute them. They catch damage and casual edits. They do not grant
   anything; only the signature does.

   Device tag mismatch. A browser update or a docked tablet can change a
   trait, and locking a care unit out for that would be worse than the
   problem it solves. So by default ("rebind") a changed tag is noted, the
   key is checked again by its signature, and the record is rewritten with
   the new tag. Pass fingerprint: "strict" to refuse a record whose tag
   differs instead.

   Dates. Hydration warns about a record dated in the future (the computer's
   clock may have been set back) and refuses a record whose dates make no
   sense. It does not lock anyone out for a clock it cannot prove wrong.

   The 14-day notice follows the key's signed paid-through date, the same
   date the "Full Access Active" badge uses, and is also shown while a key is
   past that date but still inside its grace days. It is a small, dismissible
   strip with role="status": it never takes focus, never covers the page,
   never prints, and is built with textContent only.

   Failure policy. Every public function returns a promise that resolves,
   never rejects. A blocked or broken layer is skipped and reported in the
   result ({ layers: { indexedDB, localStorage } }); the other layer carries
   on. Nothing here throws to the page.

   Load it after assets/services/licenseManager.js:
     <script type="module" src="js/license-persistence.js"></script>
   A module script runs after classic scripts, so the manager is ready. Like
   every module script, it is not loaded by Chromium from file:// ; from a
   web address or localhost it is.
   ===================================================================== */

export const DB_NAME = "cognicopia_store";
export const DB_VERSION = 1;
export const STORE_NAME = "license";
export const RECORD_KEY = "active";
export const BACKUP_KEY = "cognicopia_store_license";
export const NOTICE_SEEN_KEY = "cognicopia_store_notice_seen";
export const LOCK_KEY = "cognicopia_device_lock";

const DAY = 86400000;
const ENTITLEMENT_DAYS = 365;
const NOTICE_DAYS = 14;
const OPEN_TIMEOUT_MS = 4000;       // some browsers never answer indexedDB.open in a locked-down window
const FUTURE_SLACK_MS = 2 * DAY;    // how far ahead of the clock a record may be dated before it is flagged
const RECORD_VERSION = 1;

/* ---------------------------------------------------------------------
   Error boundary. A guarded function can throw, reject or return a bad
   value and the caller still gets a settled promise with a plain object.
   Errors it makes itself carry `cgLicensePersistence` so the one listener
   at the bottom can silence exactly those and nothing else.
   --------------------------------------------------------------------- */
export class PersistenceError extends Error {
  constructor(code, message, cause) {
    super(message || code);
    this.name = "PersistenceError";
    this.code = code;
    this.cgLicensePersistence = true;
    if (cause !== undefined) this.cause = cause;
  }
}

export function describeError(error) {
  if (!error) return { code: "unknown", message: "Unknown error" };
  return {
    code: typeof error.code === "string" ? error.code : error.name || "error",
    message: String(error.message || error).slice(0, 300)
  };
}

export function createErrorBoundary(options) {
  const opts = options || {};
  const report = typeof opts.onError === "function" ? opts.onError : null;
  const note = (where, error) => {
    if (!report) return;
    try { report(where, describeError(error)); } catch (ignored) { /* a reporter must not break the boundary */ }
  };
  /* guard(name, fn, fallback) -> async function that never rejects.
     fallback is a value or a function (error) => value. */
  function guard(name, fn, fallback) {
    return async function guarded(...args) {
      try {
        return await fn.apply(this, args);
      } catch (error) {
        note(name, error);
        const info = describeError(error);
        if (typeof fallback === "function") {
          try { return fallback(info); } catch (ignored) { /* fall through */ }
        }
        return fallback !== undefined && typeof fallback !== "function"
          ? fallback
          : { ok: false, reason: info.code, message: info.message };
      }
    };
  }
  /* run(name, fn) -> for event handlers: fire and forget, nothing escapes. */
  function run(name, fn) {
    try {
      const out = fn();
      if (out && typeof out.then === "function") out.then(undefined, (error) => note(name, error));
    } catch (error) {
      note(name, error);
    }
  }
  return { guard, run, note };
}

/* ---------------------------------------------------------------------
   The factory. `env` exists so the same code is tested with failing
   storage; the page uses the defaults.
   --------------------------------------------------------------------- */
export function createLicensePersistence(env) {
  const e = env || {};
  const root = e.root || globalThis;
  const doc = "document" in e ? e.document : root.document || null;
  const now = e.now || (() => Date.now());
  const noticeDays = Number.isFinite(e.noticeDays) ? e.noticeDays : NOTICE_DAYS;
  /* The device lock is a choice a facility makes (Security and Accessibility, Device lock), kept in localStorage under LOCK_KEY. A factory option
     still wins, so a test can force either mode. It is read each time, so turning it on or off needs no reload. */
  const lockPref = () => { try { const ls = e.localStorage !== undefined ? e.localStorage : root.localStorage; return !!ls && ls.getItem(LOCK_KEY) === "1"; } catch (error) { return false; } };
  const fingerprintMode = () => (e.fingerprint === "strict" ? "strict" : e.fingerprint === "rebind" ? "rebind" : lockPref() ? "strict" : "rebind");
  const diagnostics = [];
  const boundary = createErrorBoundary({
    onError: (where, info) => {
      diagnostics.push({ where, code: info.code, message: info.message });
      if (diagnostics.length > 20) diagnostics.shift();
    }
  });
  const guard = boundary.guard;

  /* The license manager is the one place a signature is checked. */
  const manager = () => e.license || root.CognicopiaLicense || null;
  const config = () => e.config || root.CognicopiaLicenseConfig || null;

  function sha256(text) {
    const m = manager();
    if (m && typeof m.sha256 === "function") return m.sha256(text);   // synchronous, works on plain http
    throw new PersistenceError("no_hash", "The license manager must load before license-persistence.js.");
  }

  /* ---------- layer 1 of 2: localStorage (synchronous) ---------- */
  let lsChecked = false, lsObject = null;
  function lsHandle() {
    if (!lsChecked) {
      lsChecked = true;
      try {
        const ls = e.localStorage !== undefined ? e.localStorage : root.localStorage;
        if (ls) { ls.setItem("__cg_store_probe", "1"); ls.removeItem("__cg_store_probe"); lsObject = ls; }
      } catch (error) {
        lsObject = null;   // private windows and blocked site data throw here
      }
    }
    return lsObject;
  }
  function lsRead(key) {
    const ls = lsHandle();
    if (!ls) return { available: false, value: null };
    try { return { available: true, value: ls.getItem(key) }; } catch (error) { return { available: false, value: null }; }
  }
  function lsWrite(key, value) {
    const ls = lsHandle();
    if (!ls) return false;
    try { ls.setItem(key, value); return true; } catch (error) { return false; }
  }
  function lsRemove(key) {
    const ls = lsHandle();
    if (!ls) return false;
    try { ls.removeItem(key); return true; } catch (error) { return false; }
  }

  /* ---------- layer 2 of 2: IndexedDB (asynchronous, optional) ---------- */
  let dbPromise = null;
  let dbHandle = null;
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      let settled = false;
      const finish = (db) => { if (!settled) { settled = true; clearTimeout(timer); resolve(db); } };
      const timer = setTimeout(() => finish(null), OPEN_TIMEOUT_MS);
      try {
        const factory = e.indexedDB !== undefined ? e.indexedDB : root.indexedDB;
        if (!factory) { finish(null); return; }
        const request = factory.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          try {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
          } catch (error) { boundary.note("upgrade", error); }
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { try { db.close(); } catch (ignored) { /* already closed */ } dbHandle = null; dbPromise = null; };
          db.onclose = () => { dbHandle = null; dbPromise = null; };
          dbHandle = db;
          finish(db);
        };
        request.onerror = (ev) => { boundary.note("open", request.error); if (ev && typeof ev.preventDefault === "function") ev.preventDefault(); finish(null); };
        request.onblocked = () => { boundary.note("open", new PersistenceError("blocked", "Another tab is holding an older version of the database.")); finish(null); };
      } catch (error) {
        boundary.note("open", error);   // e.g. SecurityError when a browser blocks site data
        finish(null);
      }
    });
    return dbPromise;
  }
  function idbRun(mode, work) {
    return openDb().then((db) => {
      if (!db) return { available: false, value: null };
      return new Promise((resolve) => {
        let done = false;
        const end = (out) => { if (!done) { done = true; clearTimeout(timer); resolve(out); } };
        const timer = setTimeout(() => end({ available: false, value: null }), OPEN_TIMEOUT_MS);
        try {
          const tx = db.transaction(STORE_NAME, mode);
          const store = tx.objectStore(STORE_NAME);
          let value = null;
          const req = work(store);
          if (req) req.onsuccess = () => { value = req.result === undefined ? null : req.result; };
          tx.oncomplete = () => end({ available: true, value });
          tx.onabort = () => { boundary.note("tx", tx.error); end({ available: false, value: null }); };
          tx.onerror = () => { boundary.note("tx", tx.error); };
        } catch (error) {
          boundary.note("tx", error);
          end({ available: false, value: null });
        }
      });
    });
  }
  const idbRead = () => idbRun("readonly", (s) => s.get(RECORD_KEY));
  const idbWrite = (record) => idbRun("readwrite", (s) => { s.put(record, RECORD_KEY); return null; });
  const idbRemove = () => idbRun("readwrite", (s) => { s.delete(RECORD_KEY); return null; });

  /* ---------- the record ---------- */
  function deviceTag() {
    const nav = root.navigator || {};
    const scr = root.screen || {};
    const platform = (nav.userAgentData && nav.userAgentData.platform) || nav.platform || "";
    const touch = Number(nav.maxTouchPoints) > 0 ? "touch" : "no-touch";
    const cores = Number(nav.hardwareConcurrency) || 0;
    const lang = String(nav.language || "").split("-")[0].toLowerCase();
    const depth = Number(scr.colorDepth) >= 24 ? "deep" : "std";
    return sha256(["cgfp1", platform, touch, cores, lang, depth].join("|")).slice(0, 32);
  }
  const digestOf = (r) => sha256(["cgstore1", r.v, r.token, r.sigHash, r.keyId, r.activatedAt, r.expiresAt, r.fp].join("|"));

  function inspect(token) {
    const m = manager();
    if (!m || typeof m.inspectKey !== "function") throw new PersistenceError("no_manager", "The license manager is not loaded.");
    return m.inspectKey(token);
  }
  /* Past its paid-through date and its grace days: the license manager treats the key as ended. */
  const ended = (info) => now() > info.graceEnds;

  function buildRecord(token, previous) {
    const info = inspect(token);
    if (!info || !info.ok) throw new PersistenceError(info && info.reason || "invalid_key", info && info.message || "That key did not pass its check.");
    if (ended(info)) throw new PersistenceError("expired", "That key has ended, so it is not kept.");
    const t = now();
    const continuing = previous && previous.keyId === info.id && Number.isFinite(Date.parse(previous.activatedAt)) && Date.parse(previous.expiresAt) > t;
    const activated = continuing ? Date.parse(previous.activatedAt) : t;
    const expires = Math.min(activated + ENTITLEMENT_DAYS * DAY, info.graceEnds);
    const record = {
      v: RECORD_VERSION, token: info.token, sigHash: sha256(info.signature), keyId: info.id,
      activatedAt: new Date(activated).toISOString(), expiresAt: new Date(expires).toISOString(), fp: deviceTag()
    };
    record.digest = digestOf(record);
    return { record, info };
  }

  /* Read one stored copy and say what is wrong with it, if anything. Never throws. */
  function examine(raw, layer) {
    const out = { layer, record: null, info: null, problems: [], warnings: [] };
    if (raw == null) { out.problems.push("missing"); return out; }
    let r = raw;
    try { if (typeof raw === "string") r = JSON.parse(raw); } catch (error) { out.problems.push("unreadable"); return out; }
    if (!r || typeof r !== "object" || r.v !== RECORD_VERSION || typeof r.token !== "string" || typeof r.digest !== "string") { out.problems.push("shape"); return out; }
    const activated = Date.parse(r.activatedAt), expires = Date.parse(r.expiresAt);
    if (!Number.isFinite(activated) || !Number.isFinite(expires) || expires <= activated || expires - activated > ENTITLEMENT_DAYS * DAY) { out.problems.push("dates"); return out; }
    if (digestOf(r) !== r.digest) { out.problems.push("digest"); return out; }
    let info;
    try { info = inspect(r.token); } catch (error) { out.problems.push("no_manager"); return out; }
    if (!info.ok) { out.problems.push("key:" + info.reason); return out; }
    if (ended(info)) { out.problems.push("expired"); return out; }
    if (sha256(info.signature) !== r.sigHash || info.id !== r.keyId) { out.problems.push("signature_hash"); return out; }
    if (activated > now() + FUTURE_SLACK_MS) out.warnings.push("clock_behind");   // flagged, never a lock-out: the clock or the record may be the one that is wrong
    if (expires <= now()) out.warnings.push("window_renewed");                    // the 365 days passed but the signed key is still good
    if (r.fp !== deviceTag()) {
      if (fingerprintMode() === "strict") { out.problems.push("device"); return out; }
      out.warnings.push("device_changed");
    }
    out.record = r; out.info = info;
    return out;
  }

  /* The key the license manager itself is holding (its own localStorage record), if it still verifies and has not ended. */
  function managerKey() {
    const cfg = config();
    if (!cfg || !cfg.KEYS) return null;
    const stored = lsRead(cfg.KEYS.license);
    if (!stored.value) return null;
    try {
      const rec = JSON.parse(stored.value);
      if (!rec || typeof rec.token !== "string") return null;
      const info = inspect(rec.token);
      return info && info.ok && !ended(info) ? info : null;
    } catch (error) { return null; }
  }
  const better = (a, b) => !b || a.paidThrough > b.paidThrough;

  /* ---------- the public operations ---------- */
  let chain = Promise.resolve();   // saves and removals run one after another, so two tabs' worth of events cannot interleave
  const noop = () => {};
  const serial = (work) => { const run = chain.then(work); chain = run.then(noop, noop); return run; };

  /* Save a key (the COG1 text) in both layers. The backup is written first and is synchronous. */
  const persist = guard("persist", function persistToken(token, previous) {
    return serial(async () => {
      const { record, info } = buildRecord(token, previous);
      const localStorageOk = lsWrite(BACKUP_KEY, JSON.stringify(record));
      const idb = await idbWrite(record);
      const layers = { indexedDB: idb.available, localStorage: localStorageOk };
      const kept = layers.indexedDB || layers.localStorage;
      return { ok: kept, reason: kept ? "saved" : "no_storage", layers, expiresAt: record.expiresAt, paidThrough: new Date(info.paidThrough).toISOString() };
    });
  });

  const forget = guard("forget", function forgetAll() {
    return serial(async () => {
      const removed = lsRemove(BACKUP_KEY);
      const idb = await idbRemove();
      return { ok: true, reason: "forgotten", layers: { indexedDB: idb.available, localStorage: removed } };
    });
  });

  /* Check both copies, give the license manager the best key if it has lost its own, and repair the weaker copy. */
  const hydrate = guard("hydrate", async function hydrateAll() {
    const m = manager();
    if (!m) return { ok: false, restored: false, reason: "no_manager", message: "The license manager is not loaded." };
    let restored = false, message = null, refused = null;
    const restoreFrom = (copy) => {
      const res = m.activateKey(copy.record.token);   // the signature, the dates and the withdrawn list are checked again here
      if (res && res.message) message = res.message;
      if (res && res.ok) { if (res.reason === "applied") restored = true; return true; }
      refused = res && res.reason || "refused";
      return false;
    };

    /* 1. at once, from the synchronous backup: nothing is waited for */
    const lsNow = lsRead(BACKUP_KEY);
    const backup = examine(lsNow.value, "localStorage");
    let current = managerKey();
    if (backup.info && better(backup.info, current) && restoreFrom(backup)) current = managerKey() || backup.info;

    /* 2. from the database, which may hold a later key (for example one entered on a day this window was blocked) */
    const idbNow = await idbRead();
    const primary = examine(idbNow.value, "indexedDB");
    if (primary.info && better(primary.info, current) && restoreFrom(primary)) current = managerKey() || primary.info;

    const problems = { indexedDB: primary.problems, localStorage: backup.problems };
    const warnings = primary.warnings.concat(backup.warnings);
    if (!current) {
      /* a copy refused only because this is another computer is kept: the lock must not erase it, and "Use this key on this computer" needs it */
      const damaged = [primary, backup].some((c) => c.problems.length > 0 && c.problems[0] !== "missing" && c.problems[0] !== "device");
      if (damaged || refused) await forget();       // do not re-read a copy that can never be used
      return { ok: true, restored: false, reason: refused || "nothing_to_restore", message, problems, warnings, layers: { indexedDB: false, localStorage: false } };
    }

    const mine = (c) => !!c.record && c.record.keyId === current.id && Date.parse(c.record.expiresAt) > now();
    const lsOk = lsNow.available, idbOk = idbNow.available;
    const inSync = (!lsOk || mine(backup)) && (!idbOk || mine(primary)) && (!lsOk || !idbOk || primary.record.digest === backup.record.digest);
    let layers = { indexedDB: idbOk && mine(primary), localStorage: lsOk && mine(backup) };
    if (!inSync || warnings.indexOf("device_changed") >= 0) {
      const previous = [primary, backup].map((c) => c.record).find((r) => r && r.keyId === current.id) || null;
      const saved = await persist(current.token, previous);
      if (saved && saved.layers) layers = saved.layers;
    }
    return { ok: true, restored, reason: restored ? "restored" : "already_active", message, problems, warnings, layers, license: typeof m.status === "function" ? m.status() : null };
  }, (info) => ({ ok: false, restored: false, reason: info.code, message: info.message }));

  /* ---------- the optional device lock ----------
     Off (the default): a changed device tag is noted and the record is rewritten with the new one, so a browser update never locks a care unit out.
     On: a stored copy whose tag differs from this computer's is not restored, so a copied browser profile does not quietly unlock another
     computer. It is a soft lock, not a security boundary: the tag is a short hash of coarse traits, and anyone holding the key text can paste it. */
  const readRaw = () => { const out = []; const l = lsRead(BACKUP_KEY).value; if (l != null) out.push(l); return out; };
  /* -> { on, mode, tag, stored, matches } where tag and stored are the first 8 characters of each (never the traits), and matches is null when nothing is stored */
  const deviceLock = guard("deviceLock", async function deviceLockState() {
    const idb = await idbRead(), raws = readRaw().concat(idb.value != null ? [idb.value] : []); let stored = null;
    for (const raw of raws) { try { const r = typeof raw === "string" ? JSON.parse(raw) : raw; if (r && typeof r.fp === "string") { stored = r.fp; break; } } catch (error) { /* an unreadable copy has no tag */ } }
    const tag = deviceTag();
    return { ok: true, on: fingerprintMode() === "strict", mode: fingerprintMode(), tag: tag.slice(0, 8), stored: stored ? stored.slice(0, 8) : null, matches: stored == null ? null : stored === tag };
  });
  const setDeviceLock = guard("setDeviceLock", async function setLock(on) {
    const ok = on ? lsWrite(LOCK_KEY, "1") : lsRemove(LOCK_KEY);
    return Object.assign({ saved: ok }, await deviceLock());
  });
  /* "Use this key on this computer": after a legitimate change (a new tablet, a browser update with the lock on). The key is checked by its
     signature again, then kept with this computer's tag. Returns { ok, reason }. */
  const rebindDevice = guard("rebindDevice", async function rebindThisDevice() {
    const m = manager(); if (!m) return { ok: false, reason: "no_manager", message: "The license manager is not loaded." };
    const idb = await idbRead(), raws = readRaw().concat(idb.value != null ? [idb.value] : []); let token = "";
    for (const raw of raws) { try { const r = typeof raw === "string" ? JSON.parse(raw) : raw; if (r && typeof r.token === "string" && digestOf(r) === r.digest) { const info = inspect(r.token); if (info && info.ok && !ended(info)) { token = r.token; break; } } } catch (error) { /* try the next copy */ } }
    if (!token) return { ok: false, reason: "nothing_to_rebind", message: "No kept key was found to move to this computer. Paste the key again." };
    const res = m.activateKey(token); if (res && res.ok === false) return { ok: false, reason: res.reason || "refused", message: res.message || "The key was refused." };
    const saved = await persist(token, null); return { ok: !!(saved && saved.ok), reason: saved && saved.ok ? "rebound" : "no_storage", message: saved && saved.ok ? "This computer now holds the key." : "The key could not be kept on this computer." };
  });

  /* How the stored copies look right now, for a settings page or a support call. */
  const inspectStored = guard("inspect", async function inspectStoredCopies() {
    const lsNow = lsRead(BACKUP_KEY), idbNow = await idbRead();
    const summarize = (copy, available) => ({ available, valid: !!copy.info, problems: copy.problems, warnings: copy.warnings, expiresAt: copy.record ? copy.record.expiresAt : null });
    return { ok: true, indexedDB: summarize(examine(idbNow.value, "indexedDB"), idbNow.available), localStorage: summarize(examine(lsNow.value, "localStorage"), lsNow.available), errors: diagnostics.slice() };
  });

  /* ---------- the 14-day notice ---------- */
  let queued = null, bannerEl = null, styleDone = false;
  const BANNER_CSS = [
    ".cgstore-notice{position:fixed;left:0;right:0;bottom:0;z-index:9000;display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));box-sizing:border-box;background:var(--cg-paper,#f4f3ef);color:var(--cg-paper-text,#28241f);border-top:4px solid var(--cg-gold-500,#c5a059);font-family:var(--cg-font-ui,system-ui,sans-serif);font-size:1.0625rem;line-height:1.5;box-shadow:0 -4px 16px rgba(0,0,0,.18)}",
    ".cgstore-notice p{margin:0;flex:1 1 280px}",
    ".cgstore-notice a,.cgstore-notice button{min-height:var(--cg-tap,52px);min-width:var(--cg-tap,52px);padding:8px 16px;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;border-radius:10px;border:2px solid var(--cg-green-900,#0f172a);background:var(--cg-white,#fff);color:var(--cg-green-900,#0f172a);font-family:inherit;font-weight:700;font-size:1.0625rem;line-height:1.2;text-decoration:none;cursor:pointer}",
    ".cgstore-notice a:focus-visible,.cgstore-notice button:focus-visible{outline:3px solid var(--cg-focus,#f5b800);outline-offset:2px;box-shadow:0 0 0 5px var(--cg-focus-dark,#0f172a)}",
    "html.cg-night-shift .cgstore-notice{background:#211910;color:#ffedcc;border-top-color:#9b7136}",
    "html.cg-night-shift .cgstore-notice a,html.cg-night-shift .cgstore-notice button{background:#2b2015;color:#ffedcc;border-color:#9b7136}",
    "@media print{.cgstore-notice{display:none !important}}"
  ].join("\n");

  function dateText(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const o = { year: "numeric", month: "long", day: "numeric" };
    if (/^\d{4}-\d\d-\d\d$/.test(String(iso))) o.timeZone = "UTC";   // a bare date is a calendar day, whatever the time zone
    try { return d.toLocaleDateString(undefined, o); } catch (error) { return String(iso).slice(0, 10); }
  }
  /* From the license manager's own status(): the same dates its badge uses. */
  function noticeFor(st) {
    if (!st || !st.keyed) return null;
    if (st.inGrace) {
      return { kind: "grace", daysLeft: Math.max(0, Math.ceil((Date.parse(st.graceEndsAt) - now()) / DAY)),
        text: "The paid period for " + st.facilityName + " ended on " + dateText(st.expiresAt) + ". Everything keeps working until " + dateText(st.graceEndsAt) + "; please renew before then." };
    }
    if (st.daysLeft != null && st.daysLeft <= noticeDays) {
      const when = st.daysLeft <= 0 ? "today" : st.daysLeft === 1 ? "tomorrow" : "in " + st.daysLeft + " days";
      return { kind: "soon", daysLeft: st.daysLeft,
        text: "Your Cognicopia license for " + st.facilityName + " is paid through " + dateText(st.expiresAt) + ", " + when + ". Renew to keep every tool unlocked." };
    }
    return null;
  }
  const today = () => new Date(now()).toISOString().slice(0, 10);
  function drawBanner(n, seenId) {
    if (!doc || !doc.body || bannerEl) return;
    try {
      if (!styleDone) {
        const st = doc.createElement("style"); st.id = "cgstore-style"; st.textContent = BANNER_CSS;
        (doc.head || doc.documentElement).appendChild(st); styleDone = true;
      }
      const bar = doc.createElement("div");
      bar.className = "cgstore-notice"; bar.id = "cgStoreNotice";
      bar.setAttribute("role", "status"); bar.setAttribute("aria-live", "polite");
      const p = doc.createElement("p"); p.textContent = n.text; bar.appendChild(p);
      const m = manager();
      const online = !!(m && typeof m.renewalRef === "function" && m.renewalRef());
      const href = online && typeof m.activateUrl === "function" ? m.activateUrl() + "?renew=1" : m && typeof m.pricingUrl === "function" ? m.pricingUrl() : null;
      if (href) { const a = doc.createElement("a"); a.href = href; a.textContent = online ? "Renew online" : "See plans"; bar.appendChild(a); }
      const close = doc.createElement("button");
      close.type = "button"; close.textContent = "Dismiss"; close.setAttribute("aria-label", "Dismiss the renewal notice for today");
      close.addEventListener("click", () => { lsWrite(NOTICE_SEEN_KEY, seenId + "@" + today()); removeBanner(); });
      bar.appendChild(close);
      doc.body.appendChild(bar);
      bannerEl = bar;
    } catch (error) { boundary.note("banner", error); }
  }
  function removeBanner() {
    try { if (bannerEl && bannerEl.parentNode) bannerEl.parentNode.removeChild(bannerEl); } catch (error) { boundary.note("banner", error); }
    bannerEl = null;
  }
  function clearNotice() { queued = null; removeBanner(); }
  /* Queue the notice: drawn once the page has a body, once only, and not again today after "Dismiss". */
  function queueNotice(st) {
    const n = noticeFor(st);
    if (!n) { clearNotice(); return null; }
    const seenId = String(st.expiresAt);
    if (lsRead(NOTICE_SEEN_KEY).value === seenId + "@" + today()) return Object.assign({ shown: false, dismissed: true }, n);
    if (!bannerEl) { queued = { n, seenId }; flushNotice(); }
    return Object.assign({ shown: !!bannerEl, queued: !bannerEl }, n);
  }
  function flushNotice() {
    if (!queued || !doc) return;
    if (doc.body) { const q = queued; queued = null; drawBanner(q.n, q.seenId); }
    else doc.addEventListener("DOMContentLoaded", flushNotice, { once: true });
  }
  function refreshNotice() {
    const m = manager();
    const st = m && typeof m.status === "function" ? m.status() : null;
    return st && st.keyed ? queueNotice(st) : (clearNotice(), null);
  }

  /* ---------- wiring ---------- */
  let started = false;
  const check = guard("check", async function checkAndNotify() {
    const result = await hydrate();
    result.notice = refreshNotice();
    return result;
  });

  function start() {
    if (started) return;
    started = true;
    if (doc) {
      const onReady = () => boundary.run("start", check);
      if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", onReady, { once: true }); else onReady();
      /* a key the manager accepted (typed, pasted, from the address, or from another tab) is mirrored into both layers */
      doc.addEventListener("cognicopia:license", (ev) => boundary.run("mirror", async () => {
        const info = ev && ev.detail && ev.detail.keyed ? managerKey() : null;
        if (info) {
          const held = examine(lsRead(BACKUP_KEY).value, "localStorage");
          if (!held.info || held.info.id !== info.id || held.info.paidThrough !== info.paidThrough) await persist(info.token, held.record);
        }
        refreshNotice();
      }));
      /* "Remove license from this computer" must not come back from the copy */
      doc.addEventListener("cognicopia:license-removed", () => boundary.run("removed", async () => { clearNotice(); await forget(); }));
    }
    if (root.addEventListener) {
      /* only this file's own errors are silenced here; anything else still reaches the console */
      root.addEventListener("unhandledrejection", (ev) => { if (ev && ev.reason && ev.reason.cgLicensePersistence && typeof ev.preventDefault === "function") ev.preventDefault(); });
    }
  }

  return Object.freeze({
    start, persist, hydrate, forget, check, inspect: inspectStored, deviceLock, setDeviceLock, rebindDevice,
    diagnostics: () => diagnostics.slice(), guard, DB_NAME, STORE_NAME, BACKUP_KEY
  });
}

/* The page's own instance, started as soon as this module is imported. */
const instance = createLicensePersistence();
instance.start();

export const persistLicense = instance.persist;
export const hydrateLicense = instance.hydrate;
export const forgetLicense = instance.forget;
export const checkLicenseStorage = instance.check;
export const inspectLicenseStorage = instance.inspect;
export default instance;
