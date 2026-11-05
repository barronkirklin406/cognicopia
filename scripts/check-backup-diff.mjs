#!/usr/bin/env node
/* js/backup-diff.js with two made-up computers: a differential backup holds only what changed, a merge adds and joins without losing either side,
   a removal never undoes a newer local change, conflicts are reported without names, and the daily prompt asks once a day and only when needed. */
import * as B from "../js/backup-diff.js";
await import("../assets/services/dailyOps.js");
const D = globalThis.CogniDailyOps;
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const mem = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k), has: (k) => m.has(k) }; };
const T = (n) => new Date(Date.UTC(2026, 10, 1, 12, 0, 0) + n * 3600000);
const prof = (id, name, at) => JSON.stringify({ schema: "cognicopia.residentProfile", id, tier1_core: { preferredName: name }, updatedAt: at.toISOString() });
const A = mem(), Bs = mem();
A.setItem("cognicopia_resident_aaaa1111", prof("aaaa1111", "Dorothy", T(0))); A.setItem("cognicopia_resident_bbbb2222", prof("bbbb2222", "Walter", T(0)));
A.setItem("cognicopia_studio_tracking_aaaa1111", JSON.stringify({ entries: [{ month: "2026-09", engagement: 2 }, { month: "2026-10", engagement: 3 }], updatedAt: T(0).toISOString() }));
A.setItem("cognicopia_slp_goals_aaaa1111", JSON.stringify({ entries: [{ id: "g1", date: "2026-09-01", total: { got: 18 } }] }));
A.setItem("unrelated_key", "x"); A.setItem("cognicopia_access_log", "[]"); A.setItem("cognicopia_license", "k");
ok(B.covered("cognicopia_resident_x") && B.covered("cognicopia_studio_journal_x") && !B.covered("unrelated_key") && !B.covered("cognicopia_access_log") && !B.covered(B.INDEX_KEY) && !B.covered("cognicopia_store_license"), "a backup covers resident and facility records, and not the license, the access log or its own index");
const full = B.makeBackup(A, null, T(1));
ok(full.kind === "full" && full.records.length === 4 && full.removed.length === 0 && B.isBackup(full) && !JSON.stringify(full).includes("unrelated_key") && !JSON.stringify(full).includes("cognicopia_license"), "a first backup is full and holds the four records, not the others (" + full.records.length + ")");
const r1 = B.applyBackup(Bs, full, T(2)); ok(r1.added === 4 && r1.conflicts.length === 0 && Bs.getItem("cognicopia_resident_aaaa1111") === A.getItem("cognicopia_resident_aaaa1111"), "a full backup is restored onto an empty computer");
const stamp = T(3).toISOString();
/* nothing changed -> a differential is empty */
const d0 = B.makeBackup(A, full.at, T(3)); ok(d0.kind === "differential" && d0.records.length === 0 && d0.removed.length === 0, "with nothing changed, the differential is empty");
/* change on A */
A.setItem("cognicopia_resident_aaaa1111", prof("aaaa1111", "Dorothy", T(5))); A.setItem("cognicopia_studio_tracking_aaaa1111", JSON.stringify({ entries: [{ month: "2026-09", engagement: 2 }, { month: "2026-10", engagement: 3 }, { month: "2026-11", engagement: 4 }], updatedAt: T(5).toISOString() })); A.removeItem("cognicopia_resident_bbbb2222"); A.setItem("cognicopia_remin_aaaa1111", JSON.stringify({ n: 1 }));
const d1 = B.makeBackup(A, full.at, T(6));
ok(d1.records.map((r) => r.k).sort().join() === "cognicopia_remin_aaaa1111,cognicopia_resident_aaaa1111,cognicopia_studio_tracking_aaaa1111" && d1.removed.map((r) => r.k).join() === "cognicopia_resident_bbbb2222", "the differential holds only the two changed records, the new one and the removed key");
ok(JSON.stringify(d1).length < JSON.stringify(full).length, "and is smaller than the full backup");
/* B changed the same tracking record meanwhile */
Bs.setItem("cognicopia_studio_tracking_aaaa1111", JSON.stringify({ entries: [{ month: "2026-09", engagement: 2 }, { month: "2026-10", engagement: 3 }, { month: "2026-12", engagement: 1 }], updatedAt: T(4).toISOString() }));
B.refresh(Bs, T(4));
const r2 = B.applyBackup(Bs, d1, T(7));
const merged = JSON.parse(Bs.getItem("cognicopia_studio_tracking_aaaa1111")).entries.map((e) => e.month).join();
ok(merged === "2026-09,2026-10,2026-12,2026-11" || merged.split(",").sort().join() === "2026-09,2026-10,2026-11,2026-12", "a record changed on both computers keeps every entry from both (" + merged + ")");
ok(r2.added === 1 && r2.merged >= 1 && r2.tookNewer === 1 && Bs.getItem("cognicopia_resident_aaaa1111").includes(T(5).toISOString()), "new records are added, and a profile changed only on the other computer takes the newer copy");
ok(r2.removed === 1 && !Bs.has("cognicopia_resident_bbbb2222"), "a record removed on the other computer and untouched here is removed here");
ok(r2.conflicts.length >= 2 && !JSON.stringify(r2.conflicts).match(/Dorothy|Walter/) && r2.conflicts.every((c) => c.what && c.how) && /…/.test(r2.conflicts[0].what), "conflicts are listed by kind of record and a short code, never by a name (" + r2.conflicts.map((c) => c.what).join("; ") + ")");
/* a removal does not undo a newer local change */
const C = mem(); B.applyBackup(C, full, T(8)); C.setItem("cognicopia_resident_bbbb2222", prof("bbbb2222", "Walter", T(10))); B.refresh(C, T(10));
const r3 = B.applyBackup(C, d1, T(11)); ok(C.has("cognicopia_resident_bbbb2222") && r3.conflicts.some((c) => /kept: it changed here/.test(c.how)), "a removal is not applied to a record that changed here after the backup");
/* older incoming copy does not win */
const E = mem(); E.setItem("cognicopia_resident_aaaa1111", prof("aaaa1111", "Dorothy", T(20))); B.refresh(E, T(20));
const r4 = B.applyBackup(E, full, T(21)); ok(r4.keptLocal >= 1 && JSON.parse(E.getItem("cognicopia_resident_aaaa1111")).updatedAt === T(20).toISOString(), "an older profile in a backup does not replace a newer one here");
/* running the merge again changes nothing */
const r5 = B.applyBackup(Bs, d1, T(30)); ok(r5.added === 0 && r5.merged === 0 && r5.removed === 0, "merging the same backup twice changes nothing more");
/* lists */
const ml = B.mergeLists([{ id: "a", at: "2026-01-01", t: "old" }, { id: "b" }], [{ id: "a", at: "2026-02-01", t: "new" }, { id: "c" }]); ok(ml.list.length === 3 && ml.list[0].t === "new" && ml.added === 1 && ml.updated === 1, "lists join by id and the newer entry wins");
const mm = B.mergeLists([{ month: "2026-01", v: 1, updatedAt: "2026-01-05" }], [{ month: "2026-01", v: 2, updatedAt: "2026-01-01" }]); ok(mm.list[0].v === 1, "an older entry never replaces a newer one");
/* the Shift board */
const mk = (id) => { const r = D.makeNote({ by: "AB", kind: "pass", about: "Room " + id, text: "note " + id, day: "2026-11-10", time: "10:00", shift: "day" }, new Date("2026-11-10T10:00:00Z")); return r.note; };
let b1 = D.emptyBoard(), b2 = D.emptyBoard(); b1 = D.withNote(b1, mk(1)); b2 = D.withNote(b2, mk(2));
const F = mem(), G = mem(); F.setItem("cognicopia_dailyops", JSON.stringify(b1)); G.setItem("cognicopia_dailyops", JSON.stringify(b2)); B.refresh(F, T(1)); B.refresh(G, T(1));
const rr = B.applyBackup(F, B.makeBackup(G, null, T(2)), T(3), { dailyops: (l, i) => JSON.stringify(D.mergeBoards(D.normalizeBoard(l), D.normalizeBoard(i)).board) });
ok(JSON.parse(F.getItem("cognicopia_dailyops")).notes.length === 2 && rr.merged === 1, "two Shift boards are joined with the board's own merge, keeping both notes");
/* bad input */
let err = ""; try { B.applyBackup(mem(), { format: "x" }, T(1)); } catch (e) { err = e.message; } ok(/not a Cognicopia backup/.test(err), "a file that is not a backup is refused plainly");
const odd = mem(); const ro = B.applyBackup(odd, { format: B.FORMAT, v: 1, records: [{ k: "evil_key", v: "x" }, { k: "cognicopia_resident_q", v: 5 }, null, { k: "cognicopia_resident_ok", v: "{}" }], removed: [{ k: "cgb_license" }, null] }, T(1)); ok(ro.failed === 3 && ro.added === 1 && !odd.has("evil_key"), "records outside the covered list, or malformed, are counted and never written");
const full0 = { getItem() { return null; }, setItem() { throw new Error("full"); }, removeItem() {}, length: 0, key: () => null }; ok(B.applyBackup(full0, { format: B.FORMAT, v: 1, records: [{ k: "cognicopia_resident_z", v: "{}" }], removed: [] }, T(1)).failed === 1, "a full store is counted, not thrown");
/* the daily prompt */
const idx = B.refresh(A, T(40)); let st = B.readState(A); ok(st.enabled && !st.lastBackupAt, "reminders are on by default");
let p = B.shouldPrompt(st, idx, T(40)); ok(p.show && /no backup has been made/.test(p.why) && p.changed > 0, "with records and no backup yet, the first day asks");
st = B.markPrompted(st, T(40)); ok(!B.shouldPrompt(st, idx, T(41)).show && /already asked/.test(B.shouldPrompt(st, idx, T(41)).why), "it asks only once a day");
ok(B.shouldPrompt(st, idx, T(40 + 24)).show, "and again the next day");
let st2 = B.markBackedUp(B.readState(A), T(40)); const idxNow = B.refresh(A, T(40)); ok(!B.shouldPrompt(st2, idxNow, T(41)).show && /already backed up today/.test(B.shouldPrompt(st2, idxNow, T(41)).why), "after a backup today it does not ask");
ok(!B.shouldPrompt(st2, idxNow, T(24 * 3 + 40)).show && /nothing has changed/.test(B.shouldPrompt(st2, idxNow, T(24 * 3 + 40)).why), "days later with nothing changed it does not ask");
A.setItem("cognicopia_resident_cccc3333", prof("cccc3333", "June", T(24 * 3 + 41))); const idx3 = B.refresh(A, T(24 * 3 + 41)); ok(B.shouldPrompt(st2, idx3, T(24 * 3 + 42)).show && B.shouldPrompt(st2, idx3, T(24 * 3 + 42)).changed === 1, "a new change days later asks again, and says how many records changed");
ok(!B.shouldPrompt(B.snooze(st2, T(24 * 3 + 42), 24), idx3, T(24 * 3 + 43)).show && B.shouldPrompt(B.snooze(st2, T(24 * 3 + 42), 1), idx3, T(24 * 3 + 50)).show, "a pause holds the reminder back until it ends");
ok(!B.shouldPrompt({ enabled: false }, idx3, T(24 * 3 + 42)).show, "reminders can be turned off");
ok(B.saveState(A, st2) && B.readState(A).lastBackupAt === st2.lastBackupAt && B.readState({ getItem: () => "{bad" }).enabled === true, "the state is saved and read back, and a damaged one reads as the defaults");
if (problems.length) { console.error("backup diff check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("backup diff check passed: " + passed + " checks (differential contents, merge without loss, removals, conflicts without names, the daily prompt)");
