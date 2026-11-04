/* Daily backup prompts and differential backups.

   A differential backup holds only the saved records that changed since the last backup, and the keys that were removed, so a daily backup stays
   small. Merging one (or a full backup) into another computer's records adds what is new, keeps what is the same, and resolves a record that changed
   on both computers without losing either side's entries:
     - lists of entries (the tracking log, the journal, therapy goals) are joined by each entry's own id or month, and the newer copy of an entry wins;
     - a Shift board is joined with its own merge, which keeps every note, task and engagement and never un-does a finished task;
     - a resident profile or any other record is replaced only by a newer copy, and otherwise this computer's copy is kept;
     - a record removed on the other computer is removed here only if it has not changed here since that backup.
   Every conflict is reported, by what kind of record it was and a short code, never by a name.

   The index of what changed is kept beside the records (cognicopia_backup_index, sealed with them) and holds hashes, not the records. A page calls
   refresh() from time to time (it is cheap), and the screen asks once a day, after something has changed, whether to back up now. Nothing here talks
   to a network. The page seals the file with a passphrase (CogniSecureStore.sealFile); this module deals only in plain objects. */
import { sha256Hex } from "./sha256.js";

export const FORMAT = "cognicopia.diffBackup", VERSION = 1, INDEX_KEY = "cognicopia_backup_index", STATE_KEY = "cognicopia_backup_state", MAX_GONE = 500, MAX_FILE_RECORDS = 5000;
/* the records a backup covers: resident profiles and everything kept about a resident or the facility */
export const PREFIXES = Object.freeze(["cognicopia_resident_", "cognicopia_studio_", "cognicopia_slp_goals_", "cognicopia_clinical_", "cognicopia_heirloom_", "cognicopia_remin_", "cognicopia_engagement_", "cognicopia_dailyops", "cognicopia_academy", "cognicopia_facility", "cognicopia_quality", "cognicopia_alignment", "cgb_settings"]);
const LABELS = [["cognicopia_resident_insights_", "Resident notes"], ["cognicopia_resident_", "Resident profile"], ["cognicopia_studio_tracking_", "Monthly tracking"], ["cognicopia_studio_journal_", "Life narrative journal"], ["cognicopia_studio_planner_", "Seasonal plan"], ["cognicopia_studio_", "Studio record"], ["cognicopia_slp_goals_", "Therapy goals"], ["cognicopia_clinical_", "Session notes"], ["cognicopia_heirloom_", "Memory book"], ["cognicopia_remin_", "Reminiscence"], ["cognicopia_engagement_", "Engagement notes"], ["cognicopia_dailyops", "Shift board"], ["cognicopia_academy", "Academy records"], ["cognicopia_facility", "Facility Portal"], ["cognicopia_quality", "Quality hub"], ["cognicopia_alignment", "Alignment records"], ["cgb_settings", "Settings"]];
export const covered = (key) => PREFIXES.some((p) => key.indexOf(p) === 0) && key.indexOf(INDEX_KEY) !== 0;
/* "Resident profile (…4821)": what kind of record, and the last four characters of its id; never a name */
export function describe(key) { const hit = LABELS.find((l) => key.indexOf(l[0]) === 0), tail = hit && key.length > hit[0].length ? key.slice(-4) : ""; return (hit ? hit[1] : "Record") + (tail ? " (…" + tail + ")" : ""); }

const h16 = (text) => sha256Hex(text).slice(0, 16);
const parse = (t) => { try { return JSON.parse(t); } catch (e) { return undefined; } };
function keysOf(store) { const out = []; try { for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && covered(k)) out.push(k); } } catch (e) { /* a store that cannot list gives nothing */ } return out.sort(); }
const read = (store, key) => { try { return store.getItem(key); } catch (e) { return null; } };
const write = (store, key, value) => { try { store.setItem(key, value); return true; } catch (e) { return false; } };

/* ---- the index ------------------------------------------------------------------------------------------------------------------------------- */
export function readIndex(store) {
  const r = parse(read(store, INDEX_KEY)), gone = {}; if (r && typeof r.gone === "object" && r.gone) for (const [k, v] of Object.entries(r.gone)) gone[k] = typeof v === "string" ? { at: v, h: "" } : { at: String(v && v.at || ""), h: String(v && v.h || "") };
  return { keys: r && typeof r.keys === "object" && r.keys ? r.keys : {}, gone };
}
/* Look at the records now, and note the time of each change. Returns the index. */
export function refresh(store, now = new Date()) {
  const idx = readIndex(store), at = now.toISOString(), live = new Set(keysOf(store)); let dirty = false;
  for (const k of live) { const h = h16(read(store, k) || ""); const cur = idx.keys[k]; if (!cur || cur.h !== h) { idx.keys[k] = { h, at }; dirty = true; } if (idx.gone[k]) { delete idx.gone[k]; dirty = true; } }
  for (const k of Object.keys(idx.keys)) if (!live.has(k)) { idx.gone[k] = { at, h: idx.keys[k].h }; delete idx.keys[k]; dirty = true; }   // the hash is what a removal is matched against on another computer
  const g = Object.entries(idx.gone).sort((a, b) => a[1].at.localeCompare(b[1].at)); if (g.length > MAX_GONE) { g.slice(0, g.length - MAX_GONE).forEach(([k]) => delete idx.gone[k]); dirty = true; }
  if (dirty) write(store, INDEX_KEY, JSON.stringify(idx)); return idx;
}
/* how many records changed (or were removed) after a time; null counts everything */
export function changedCount(idx, since) { const after = (t) => !since || t > since; return Object.values(idx.keys).filter((v) => after(v.at)).length + Object.values(idx.gone).filter((v) => after(v.at)).length; }

/* ---- making a backup ------------------------------------------------------------------------------------------------------------------------- */
/* since: the time of the last backup (a differential), or null for everything -> the plain object to seal and save */
export function makeBackup(store, since, now = new Date()) {
  const idx = refresh(store, now), after = (t) => !since || t > since, records = [];
  for (const [k, v] of Object.entries(idx.keys)) if (after(v.at)) { const val = read(store, k); if (val != null) records.push({ k, v: val, h: v.h, at: v.at }); }
  const removed = Object.entries(idx.gone).filter(([, g]) => after(g.at)).map(([k, g]) => ({ k, at: g.at, h: g.h }));
  return { format: FORMAT, v: VERSION, kind: since ? "differential" : "full", since: since || null, at: now.toISOString(), records, removed };
}
export const isBackup = (f) => !!f && f.format === FORMAT && f.v === VERSION && Array.isArray(f.records) && Array.isArray(f.removed);

/* ---- merging --------------------------------------------------------------------------------------------------------------------------------- */
const stampOf = (o) => String(o && (o.updatedAt || o.at || o.savedAt || "") || "");
const idOf = (e) => (e && typeof e === "object" ? (e.id != null ? "i:" + e.id : e.month != null ? "m:" + e.month : "h:" + h16(JSON.stringify(e))) : "h:" + h16(String(e)));
/* two lists of entries joined by id (or month), the newer copy of an entry winning; order follows the first list, then new entries */
export function mergeLists(mine, theirs) {
  const out = mine.slice(), at = new Map(out.map((e, i) => [idOf(e), i])); let added = 0, updated = 0;
  for (const e of theirs) { const k = idOf(e), i = at.get(k); if (i == null) { at.set(k, out.length); out.push(e); added++; } else if (stampOf(e) > stampOf(out[i])) { out[i] = e; updated++; } }
  return { list: out, added, updated };
}
/* resolvers.dailyops(localText, incomingText) -> merged text, given by the page (CogniDailyOps.mergeBoards) */
function resolve(key, local, incoming, rec, localAt, resolvers) {
  const a = parse(local), b = parse(incoming);
  if (a === undefined || b === undefined) return rec.at > localAt ? { text: incoming, how: "took the newer copy" } : { text: local, how: "kept this computer's copy" };
  if (key.indexOf("cognicopia_dailyops") === 0 && resolvers && typeof resolvers.dailyops === "function") { try { return { text: resolvers.dailyops(local, incoming), how: "joined the notes, tasks and engagement entries" }; } catch (e) { /* fall through to the generic rule */ } }
  if (a && b && Array.isArray(a.entries) && Array.isArray(b.entries)) { const m = mergeLists(a.entries, b.entries), out = Object.assign({}, stampOf(b) > stampOf(a) ? b : a, { entries: m.list }); return { text: JSON.stringify(out), how: "joined the entries (" + m.added + " new, " + m.updated + " newer)" }; }
  if (a && b && stampOf(a) && stampOf(b)) return stampOf(b) > stampOf(a) ? { text: incoming, how: "took the newer copy" } : { text: local, how: "kept this computer's newer copy" };
  return rec.at > localAt ? { text: incoming, how: "took the newer copy" } : { text: local, how: "kept this computer's copy" };
}
/* Merge a backup file into a store. -> { added, unchanged, merged, tookNewer, keptLocal, removed, failed, conflicts: [{ what, how }] } */
export function applyBackup(store, file, now = new Date(), resolvers = {}) {
  const out = { added: 0, unchanged: 0, merged: 0, tookNewer: 0, keptLocal: 0, removed: 0, failed: 0, conflicts: [] };
  if (!isBackup(file)) throw new Error("That is not a Cognicopia backup file.");
  const idx = refresh(store, now), recs = file.records.slice(0, MAX_FILE_RECORDS);
  for (const rec of recs) {
    if (!rec || typeof rec.k !== "string" || typeof rec.v !== "string" || !covered(rec.k)) { out.failed++; continue; }
    const local = read(store, rec.k);
    if (local == null) { if (write(store, rec.k, rec.v)) out.added++; else out.failed++; continue; }
    if (h16(local) === h16(rec.v)) { out.unchanged++; continue; }
    const localAt = (idx.keys[rec.k] || {}).at || "", r = resolve(rec.k, local, rec.v, rec, localAt, resolvers);
    out.conflicts.push({ what: describe(rec.k), how: r.how });
    if (r.text === local) { out.keptLocal++; continue; }
    if (write(store, rec.k, r.text)) { if (r.text === rec.v) out.tookNewer++; else out.merged++; } else out.failed++;
  }
  for (const rm of file.removed.slice(0, MAX_FILE_RECORDS)) {
    if (!rm || typeof rm.k !== "string" || !covered(rm.k)) continue; const local = read(store, rm.k); if (local == null) continue;
    /* removed only if this computer's copy is exactly what the other computer removed; if it differs, it changed here, so it stays */
    const same = rm.h ? h16(local) === rm.h : !((idx.keys[rm.k] || {}).at > (file.since || ""));
    if (!same) { out.conflicts.push({ what: describe(rm.k), how: "kept: it changed here after the backup it was removed from" }); out.keptLocal++; continue; }
    try { store.removeItem(rm.k); out.removed++; } catch (e) { out.failed++; }
  }
  refresh(store, now); return out;
}

/* ---- the daily prompt ------------------------------------------------------------------------------------------------------------------------ */
export const DEFAULT_STATE = Object.freeze({ enabled: true, lastBackupAt: "", lastPromptDay: "", snoozeUntil: "" });
export function readState(store) { const r = parse(read(store, STATE_KEY)); return { enabled: r && r.enabled === false ? false : true, lastBackupAt: r && typeof r.lastBackupAt === "string" ? r.lastBackupAt : "", lastPromptDay: r && typeof r.lastPromptDay === "string" ? r.lastPromptDay : "", snoozeUntil: r && typeof r.snoozeUntil === "string" ? r.snoozeUntil : "" }; }
export const saveState = (store, st) => write(store, STATE_KEY, JSON.stringify(st));
const dayOf = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
/* Ask at most once a day, only when there is something to back up, and not after a backup today or while reminders are paused.
   -> { show, why, changed } */
export function shouldPrompt(state, idx, now = new Date()) {
  const st = state || DEFAULT_STATE, today = dayOf(now), changed = changedCount(idx || { keys: {}, gone: {} }, st.lastBackupAt || null);
  if (st.enabled === false) return { show: false, why: "reminders are off", changed };
  if (st.lastBackupAt && dayOf(new Date(st.lastBackupAt)) === today) return { show: false, why: "already backed up today", changed };
  if (st.lastPromptDay === today) return { show: false, why: "already asked today", changed };
  if (st.snoozeUntil && Date.parse(st.snoozeUntil) > now.getTime()) return { show: false, why: "paused", changed };
  if (!changed) return { show: false, why: "nothing has changed since the last backup", changed };
  return { show: true, why: st.lastBackupAt ? "records changed since the last backup" : "no backup has been made yet", changed };
}
export const markPrompted = (st, now = new Date()) => Object.assign({}, st, { lastPromptDay: dayOf(now) });
export const markBackedUp = (st, now = new Date()) => Object.assign({}, st, { lastBackupAt: now.toISOString(), snoozeUntil: "" });
export const snooze = (st, now = new Date(), hours = 24 * 7) => Object.assign({}, st, { snoozeUntil: new Date(now.getTime() + hours * 3600000).toISOString() });
