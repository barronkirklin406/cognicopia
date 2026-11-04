/* Idle sanitizer and offline access log.

   1. The access log. A short record, on this computer only, of who-did-what-kind-of-thing: the session started, the saved residents were locked or
      unlocked (and a failed unlock), a resident was opened (by a short code, never a name), a page was printed (a page count, never a title), a
      backup was made or restored, a file was exported or imported, and the screen was wiped for inactivity. It holds no name, no health detail and
      no text a person typed. Each entry carries a SHA-256 hash of the entry before it, so an edited, removed or reordered entry shows up when the
      log is verified. That catches accidents and casual edits; it is not proof against someone who can run code in this browser and rewrite the
      whole chain, and the screen says so.

   2. The idle sanitizer. After the 15 minutes of inactivity js/sessionTimeout.js already watches, and before it locks the store and reloads the page,
      this clears what is only in the page's memory: the open tool screens, the staged print pages, every typed field, the selection and the
      focus, and every object URL the page made for a picture or file. A browser cannot zero its own memory, so the reload that follows is what
      really drops the rest. Saved data is never touched.

   Both are offline, with no library and no network. */

import { sha256Hex } from "./sha256.js";
export { sha256Hex };

/* ---- the access log -------------------------------------------------------------------------------------------------------------------------- */
export const LOG_KEY = "cognicopia_access_log", MAX_ENTRIES = 5000, GENESIS = "0".repeat(64);
export const EVENTS = Object.freeze({
  "session-start": "Session started", unlock: "Saved residents unlocked", "unlock-failed": "Unlock failed", lock: "Saved residents locked", "idle-wipe": "Screen wiped after 15 minutes of inactivity",
  "resident-open": "A resident was opened", print: "Pages were printed", backup: "A backup was made", restore: "A backup was restored", export: "A file was exported", import: "A file was imported",
  "backup-prompt": "Daily backup reminder", "device-lock": "Device lock changed", "log-reset": "The log was started again"
});
const clean = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F<>,"]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const hashOf = (e) => sha256Hex([e.n, e.at, e.ev, e.who, e.ref, e.note, e.prev].join("|"));
export function createLog(store, opts = {}) {
  const now = opts.now || (() => new Date());
  const load = () => { try { const t = store.getItem(LOG_KEY); const a = t ? JSON.parse(t) : []; return Array.isArray(a) ? a.filter((e) => e && typeof e === "object" && typeof e.h === "string") : []; } catch (e) { return []; } };
  const save = (list) => { try { store.setItem(LOG_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } };
  /* o: { who (initials), ref (a short code for a resident, never a name), note (a few words) } -> the entry, or null if it could not be saved */
  function append(ev, o = {}) {
    if (!EVENTS[ev]) return null; const list = load(), last = list[list.length - 1];
    const e = { n: last ? last.n + 1 : 1, at: now().toISOString(), ev, who: clean(o.who, 4), ref: clean(o.ref, 24), note: clean(o.note, 80), prev: last ? last.h : GENESIS }; e.h = hashOf(e); list.push(e);
    const kept = list.length > MAX_ENTRIES ? list.slice(list.length - MAX_ENTRIES) : list;   // the oldest go; the first kept entry still names the hash it followed
    return save(kept) ? e : null;
  }
  const entries = () => load();
  /* { ok, count, brokenAt } : brokenAt is the number of the first entry whose hash or link does not match, or 0 */
  function verify() {
    const list = load(); let prev = list.length ? list[0].prev : GENESIS;
    for (const e of list) { if (e.prev !== prev || hashOf(e) !== e.h || !EVENTS[e.ev]) return { ok: false, count: list.length, brokenAt: e.n }; prev = e.h; }
    for (let i = 1; i < list.length; i++) if (list[i].n !== list[i - 1].n + 1) return { ok: false, count: list.length, brokenAt: list[i].n };
    return { ok: true, count: list.length, brokenAt: 0 };
  }
  const summary = () => { const out = {}; load().forEach((e) => { out[e.ev] = (out[e.ev] || 0) + 1; }); return out; };
  const csv = () => ["number,time,event,initials,reference,note,hash"].concat(load().map((e) => [e.n, e.at, EVENTS[e.ev] || e.ev, e.who, e.ref, e.note, e.h.slice(0, 16)].map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(","))).join("\r\n");
  /* start a new log, keeping the chain unbroken: the first entry of the new log follows the last hash of the old one */
  function reset(o = {}) { const list = load(), head = list.length ? list[list.length - 1] : null; const e = { n: head ? head.n + 1 : 1, at: now().toISOString(), ev: "log-reset", who: clean(o.who, 4), ref: "", note: "after " + list.length + " entries", prev: head ? head.h : GENESIS }; e.h = hashOf(e); return save([e]) ? e : null; }
  return { append, entries, verify, summary, csv, reset };
}

/* ---- the idle sanitizer ---------------------------------------------------------------------------------------------------------------------- */
/* Remember every object URL the page makes, so they can all be released at the wipe. Safe to call twice. */
export function trackObjectUrls(win) {
  const U = win && win.URL; if (!U || U.__cgTracked || typeof U.createObjectURL !== "function") return { urls: new Set() };
  const urls = new Set(), make = U.createObjectURL.bind(U), drop = U.revokeObjectURL ? U.revokeObjectURL.bind(U) : () => {};
  U.createObjectURL = (o) => { const u = make(o); urls.add(u); return u; }; U.revokeObjectURL = (u) => { urls.delete(u); drop(u); }; U.__cgTracked = urls; return { urls };
}
const SKIP = new Set(["file", "button", "submit", "reset", "hidden", "checkbox", "radio"]);
/* Clear what is only in the page's memory. Returns the list of what was done. Every step is guarded: one that fails does not stop the others. */
export function sanitize(win, log, deps = {}) {
  const done = [], step = (name, fn) => { try { const r = fn(); if (r !== false) done.push(name); } catch (e) { /* a step that cannot run is skipped */ } };
  const doc = win && win.document;
  if (log) step("log", () => log.append("idle-wipe", { note: "screen wiped" }) !== null);
  step("tools", () => { ["CogniStudio", "CogniFacilityTools"].forEach((k) => { if (win[k] && typeof win[k].teardown === "function") win[k].teardown(); }); });
  if (doc) {
    step("dialogs", () => { doc.querySelectorAll("dialog[open]").forEach((d) => { try { d.close(); } catch (e) { d.removeAttribute("open"); } }); });
    step("fields", () => { doc.querySelectorAll("input, textarea, select").forEach((el) => { const t = String(el.type || "").toLowerCase(); if (el.tagName === "SELECT") el.selectedIndex = -1; else if (!SKIP.has(t)) el.value = ""; else if (t === "checkbox" || t === "radio") el.checked = false; }); });
    step("screen", () => { (deps.selectors || ["#view", "#printRoot", "[data-wipe]"]).forEach((s) => doc.querySelectorAll(s).forEach((el) => { if (el.replaceChildren) el.replaceChildren(); else el.textContent = ""; })); });
    step("selection", () => { if (win.getSelection) win.getSelection().removeAllRanges(); if (doc.activeElement && doc.activeElement.blur) doc.activeElement.blur(); });
    step("title", () => { doc.title = "Cognicopia"; });
  }
  step("object-urls", () => { const set = win.URL && win.URL.__cgTracked; if (!set) return false; [...set].forEach((u) => win.URL.revokeObjectURL(u)); });
  step("hooks", () => { (deps.extra || []).forEach((f) => f()); });
  return done;
}
/* Wire it to the page: log the session start, lock changes and the wipe, and run the wipe when js/sessionTimeout.js expires.
   deps: { store (where the log lives), refOf(id) for a resident's short code, who() for initials }. Returns the log. */
export function install(win, deps = {}) {
  const store = deps.store || win.localStorage, log = createLog(store); trackObjectUrls(win); win.CogniAccessLog = Object.assign({ EVENTS, refOf: deps.refOf || ((id) => String(id || "").slice(-4)) }, log, { who: deps.who || (() => "") });
  if (!win.__cgAccessStarted) { win.__cgAccessStarted = true; log.append("session-start", { who: win.CogniAccessLog.who() }); }
  const S = win.CogniSecureStore; if (S && typeof S.onChange === "function" && typeof S.status === "function") { let last = null; try { const s0 = S.status(); last = !!(s0 && s0.locked); } catch (e) { last = null; } S.onChange(() => { try { const s = S.status(), now = !!(s && s.locked); if (last !== null && now !== last) log.append(now ? "lock" : "unlock"); last = now; } catch (e) { /* ignore */ } }); }
  if (win.CognicopiaSession && typeof win.CognicopiaSession.onExpire === "function") win.CognicopiaSession.onExpire(() => sanitize(win, log, deps));
  return log;
}
if (typeof window !== "undefined" && window.document && !window.__cgNoAutoInstall) { try { install(window, { refOf: (id) => (window.CogniSecureStore && window.CogniSecureStore.shortCode ? window.CogniSecureStore.shortCode(id) : String(id || "").slice(-4)) }); } catch (e) { /* the page works without the log */ } }
