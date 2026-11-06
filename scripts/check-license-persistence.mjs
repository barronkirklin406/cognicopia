#!/usr/bin/env node
/* js/license-persistence.js with a fake license manager and storage, for the optional device lock: off by default (a changed device is noted and
   rewritten), on when the facility chooses it (a copy from another computer is not restored, and is not erased), "use this key on this computer",
   and that nothing but a short tag is ever shown. IndexedDB is absent here, so the localStorage copy alone is exercised. */
import crypto from "node:crypto";
const { createLicensePersistence, LOCK_KEY, BACKUP_KEY } = await import("../js/license-persistence.js");
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) }; };
const DAY = 86400000, NOW = Date.parse("2026-11-10T12:00:00Z"), TOKEN = "COG1.test.key";
const sha = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
const mkManager = (ls) => ({ sha256: sha, inspectKey: (t) => (t === TOKEN ? { ok: true, token: t, signature: "sig", id: "k1", paidThrough: NOW + 200 * DAY, graceEnds: NOW + 230 * DAY } : { ok: false, reason: "bad", message: "bad key" }),
  activateKey: (t) => { if (t !== TOKEN) return { ok: false, reason: "bad", message: "bad key" }; ls.setItem("cg_license", JSON.stringify({ token: t })); return { ok: true, reason: "applied" }; }, status: () => ({ active: true }) });
const dev = (cores) => ({ navigator: { platform: "Win32", maxTouchPoints: 0, hardwareConcurrency: cores, language: "en-US" }, screen: { colorDepth: 24 } });
const make = (ls, cores, extra = {}) => { const root = Object.assign({ localStorage: ls }, dev(cores)); return createLicensePersistence(Object.assign({ root, localStorage: ls, document: null, indexedDB: null, now: () => NOW, license: mkManager(ls), config: { KEYS: { license: "cg_license" } } }, extra)); };

const ls = mem(); const A = make(ls, 8);
let r = await A.persist(TOKEN); ok(r.ok && ls.getItem(BACKUP_KEY), "a key is kept on computer A");
let st = await A.deviceLock(); ok(st.on === false && st.mode === "rebind" && st.matches === true && st.tag.length === 8 && st.stored === st.tag, "the lock is off by default and the tag matches (" + JSON.stringify(st) + ")");
ok(!JSON.stringify(st).match(/Win32|touch|en/), "only a short tag is shown, never the traits");

/* off: a changed device is rewritten, not refused */
ls.removeItem("cg_license"); const B = make(ls, 4);
let h = await B.hydrate(); ok(h.restored && h.warnings.includes("device_changed"), "with the lock off, a different computer restores the key and notes the change (" + h.reason + ")");
ok((await B.deviceLock()).matches === true, "the stored tag is rewritten to the new computer's");

/* on: another computer is refused, and the copy stays */
const ls2 = mem(); const A2 = make(ls2, 8); await A2.persist(TOKEN); const before = ls2.getItem(BACKUP_KEY);
const on = await A2.setDeviceLock(true); ok(on.on && on.mode === "strict" && ls2.getItem(LOCK_KEY) === "1", "the lock can be turned on and is remembered");
ls2.removeItem("cg_license"); const B2 = make(ls2, 4);
const st2 = await B2.deviceLock(); ok(st2.on && st2.matches === false, "on another computer the stored tag does not match (" + st2.matches + ")");
h = await B2.hydrate(); ok(!h.restored && h.reason !== "restored" && !ls2.getItem("cg_license"), "with the lock on, a copy from another computer is not restored (" + h.reason + ")");
ok(ls2.getItem(BACKUP_KEY) === before, "and the copy is not erased, so it can still be moved");
/* the same computer still works */
ls2.removeItem("cg_license"); const A3 = make(ls2, 8); h = await A3.hydrate(); ok(h.restored, "the original computer is still restored with the lock on");
/* rebind */
ls2.removeItem("cg_license"); const rb = await B2.rebindDevice(); ok(rb.ok && rb.reason === "rebound" && ls2.getItem("cg_license"), "'use this key on this computer' keeps the key here (" + rb.reason + ")");
ok((await B2.deviceLock()).matches === true, "and the stored tag now matches this computer");
ls2.removeItem("cg_license"); h = await B2.hydrate(); ok(h.restored, "after that, the lock lets this computer in");
/* turning it off */
const off = await B2.setDeviceLock(false); ok(!off.on && ls2.getItem(LOCK_KEY) === null, "the lock can be turned off again");
/* nothing to rebind */
const e = make(mem(), 8); const none = await e.rebindDevice(); ok(!none.ok && none.reason === "nothing_to_rebind", "with no kept key there is nothing to move, and it says so");
const bad = mem(); bad.setItem(BACKUP_KEY, "{not json"); const nb = await make(bad, 8).rebindDevice(); ok(!nb.ok, "a damaged copy is not moved");
/* option wins */
const f = make(mem(), 8, { fingerprint: "strict" }); ok((await f.deviceLock()).mode === "strict", "a factory option still forces strict mode for a test");
ok((await make({ getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } }, 8).deviceLock()).ok, "blocked storage does not throw");
if (problems.length) { console.error("license persistence check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("license persistence check passed: " + passed + " checks (device lock off by default, strict refusal that keeps the copy, rebind, blocked storage)");
