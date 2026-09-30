/* =====================================================================
   COGNICOPIA SECURE STORE
   Resident details, drafts and clinical notes, encrypted in this
   browser's own storage. Nothing here ever leaves the computer: there is
   no server, account or cloud copy, and this file makes no network
   requests.

   How it works
     - Every record is sealed with AES-256-GCM (Web Crypto), a fresh
       96-bit IV per write, and the record's own name as additional
       authenticated data, so a record cannot be swapped for another.
     - Records live in IndexedDB ("cognicopia-secure"), never in
       localStorage. Plain copies found in localStorage (from before this
       store existed) are sealed on first open and then removed.
     - The key is a non-extractable CryptoKey: page scripts can use it but
       can never read or export its bytes. By default it is a device key,
       kept in the same database. That keeps records unreadable to anything
       that copies the storage files without this browser, but not to
       someone who can open this browser profile.
     - For stronger protection, set a passphrase. The data key is then
       stored only wrapped by a key drawn from the passphrase (PBKDF2,
       SHA-256, 600,000 rounds), and nothing opens without it. After an
       unlock, staff choose how long this computer stays unlocked; "Lock
       now" forgets the key at once.

   Pages use `storage`, a drop-in for window.localStorage: names that hold
   resident details (SEALED_PREFIXES) go to the sealed store; everything
   else (license, counters, layout choices) passes through to
   localStorage unchanged. Reads are synchronous from a decrypted copy in
   memory, filled by ready(); writes return at once and are sealed and
   saved in the background (flush() waits for them). Other open tabs are
   told of every change and receive it as an ordinary "storage" event.
   If this browser cannot encrypt (no IndexedDB or Web Crypto), the store
   says so (status().encrypted is false) and falls back to localStorage,
   so the tools keep working.

   Also here: anonymous aliases for shared screens and staff pages
   ("Resident 302-B"), and the locked .cognicopia roster file used to hand
   residents from one station to another. It is the same file format as
   the packet tool's locked backups, so either can open the other's.

   Built into assets/services/secureStore.js, a plain browser script that
   sets globalThis.CogniSecureStore, by scripts/build-services.mjs.
   @global CogniSecureStore
   ===================================================================== */

export const VERSION = "1.0.0";
export const DB_NAME = "cognicopia-secure";
const DB_VERSION = 2;                                   // 2: the "blobs" store for photos
const RINGS = "keyring", RECORDS = "records", BLOBS = "blobs";

/* The storage names that hold resident details. */
export const SEALED_PREFIXES: readonly string[] = [
  "cognicopia_resident_",       // resident profiles (profile.html)
  "cognicopia_profile_draft",   // the profile form in progress
  "cognicopia_packet_draft",    // the packet form in progress (index.html)
  "cgb_queue",                  // the Packet Builder's queue (names and details on its pages)
  "cgb_planner",                // Life Planner form
  "cgb_journal",                // Life Journal form
  "cgb_settings",               // Packet Builder settings (they include a default resident name)
  "cognicopia_clinical_",       // SLP session notes (slpClinicalService)
  "cognicopia_heirloom_",       // monthly memory digest entries
  "cognicopia_remin_",          // reminiscence responses
  "cognicopia_facility"         // the Facility Portal: wings, groups, team, audit trail and each wing's month schedules
];
export const isSealed = (name: string): boolean => SEALED_PREFIXES.some(p => name.startsWith(p));

export type State = "pending" | "open" | "locked" | "unavailable";
export interface StoreStatus {
  state: State;
  encrypted: boolean;          // records are sealed at rest
  passphrase: boolean;         // a passphrase is required to open them
  unlockedUntil: number | null;
  records: number;
  migrated: number;            // plain copies sealed on this open
  unreadable: number;          // records that would not open (damaged)
  ms: number;                  // time ready() took
  reason: string;
}

export const PBKDF2_ROUNDS = 600000;
export const KEEP_CHOICES: readonly { minutes: number; label: string }[] = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 480, label: "8 hours (a shift)" },
  { minutes: 0, label: "This page only" }
];
export const DEFAULT_KEEP_MINUTES = 480;

/* ---------- 1. Environment (looked up when used, so tests can supply it) ---------- */
interface Env { idb: IDBFactory | null; subtle: SubtleCrypto | null; random: ((n: number) => Uint8Array) | null; ls: Storage | null; }
function env(): Env {
  const g = globalThis as unknown as { indexedDB?: IDBFactory; crypto?: Crypto; localStorage?: Storage };
  let ls: Storage | null = null;
  try { ls = g.localStorage || null; } catch { ls = null; }           // blocked storage throws on access
  const c = g.crypto;
  return { idb: g.indexedDB || null, subtle: c && c.subtle ? c.subtle : null, random: c && c.getRandomValues ? (n: number) => c.getRandomValues(new Uint8Array(new ArrayBuffer(n))) : null, ls };
}
const enc = new TextEncoder(), dec = new TextDecoder();
const now = (): number => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
const bytes = (n: number): Uint8Array => { const r = env().random; if (!r) throw new Error("no random source"); return r(n); };
const buf = (a: Uint8Array): ArrayBuffer => a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength) as ArrayBuffer;

export function toB64(data: ArrayBuffer | Uint8Array): string {
  const a = data instanceof Uint8Array ? data : new Uint8Array(data); let s = "";
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(a.subarray(i, i + 0x8000)));
  return btoa(s);
}
export function fromB64(str: string): Uint8Array {
  const s = atob(str), a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a;
}

/* ---------- 2. IndexedDB, as promises ---------- */
function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error || new Error("IndexedDB request failed")); });
}
function openDb(idb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let r: IDBOpenDBRequest;
    try { r = idb.open(DB_NAME, DB_VERSION); } catch (e){ reject(e); return; }
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains(RINGS)) d.createObjectStore(RINGS);
      if (!d.objectStoreNames.contains(RECORDS)) d.createObjectStore(RECORDS);
      if (!d.objectStoreNames.contains(BLOBS)) d.createObjectStore(BLOBS);
    };
    // An older tab holding the database open delays an upgrade; give it a few seconds to let go.
    const late = setTimeout(() => reject(new Error("IndexedDB is held open by another tab")), 8000);
    r.onsuccess = () => {
      clearTimeout(late);
      const d = r.result;
      d.onversionchange = () => { d.close(); };                    // let a newer Cognicopia in another tab upgrade it
      resolve(d);
    };
    r.onerror = () => { clearTimeout(late); reject(r.error || new Error("IndexedDB would not open")); };
  });
}
/* Runs fn inside one transaction; resolves when it has committed. */
function tx(d: IDBDatabase, stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    let t: IDBTransaction;
    try { t = d.transaction(stores, mode); } catch (e){ reject(e); return; }
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error || new Error("IndexedDB transaction failed"));
    t.onabort = () => reject(t.error || new Error("IndexedDB transaction aborted"));
    try { fn(t); } catch (e){ try { t.abort(); } catch { /* already done */ } reject(e); }
  });
}

/* ---------- 3. Keys and sealing ---------- */
interface DeviceRing { mode: "device"; key: CryptoKey; created: string; }
interface PassRing { mode: "passphrase"; salt: Uint8Array; rounds: number; iv: Uint8Array; wrapped: ArrayBuffer; created: string; }
type Ring = DeviceRing | PassRing;
interface SessionKey { key: CryptoKey; expires: number; keepMs: number; }
interface SealedRecord { iv: Uint8Array; data: ArrayBuffer; t: number; }

const AES = { name: "AES-GCM", length: 256 } as const;
async function deriveKek(pass: string, salt: Uint8Array, rounds: number): Promise<CryptoKey> {
  const s = env().subtle!;
  const base = await s.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return s.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: buf(salt), iterations: rounds }, base, AES, false, ["encrypt", "decrypt"]);
}
async function seal(key: CryptoKey, name: string, value: string): Promise<SealedRecord> {
  const iv = bytes(12);
  const data = await env().subtle!.encrypt({ name: "AES-GCM", iv: buf(iv), additionalData: buf(enc.encode(name)) }, key, enc.encode(value));
  return { iv, data, t: Date.now() };
}
async function unseal(key: CryptoKey, name: string, r: SealedRecord): Promise<string> {
  const plain = await env().subtle!.decrypt({ name: "AES-GCM", iv: buf(r.iv), additionalData: buf(enc.encode(name)) }, key, r.data);
  return dec.decode(plain);
}
/* A new data key. With a passphrase, it is made once as bytes, wrapped,
   imported back as non-extractable, and the bytes are overwritten. */
async function newDeviceKey(): Promise<CryptoKey> {
  return env().subtle!.generateKey(AES, false, ["encrypt", "decrypt"]) as Promise<CryptoKey>;
}
async function wrapNewKey(pass: string, rounds: number): Promise<{ ring: PassRing; key: CryptoKey }> {
  const s = env().subtle!, raw = bytes(32), salt = bytes(16), iv = bytes(12);
  try {
    const kek = await deriveKek(pass, salt, rounds);
    const wrapped = await s.encrypt({ name: "AES-GCM", iv: buf(iv) }, kek, buf(raw));
    const key = await s.importKey("raw", buf(raw), AES, false, ["encrypt", "decrypt"]);
    return { ring: { mode: "passphrase", salt, rounds, iv, wrapped, created: new Date().toISOString() }, key };
  } finally { raw.fill(0); }
}
async function unwrapKey(ring: PassRing, pass: string): Promise<CryptoKey | null> {
  const s = env().subtle!, kek = await deriveKek(pass, ring.salt, ring.rounds);
  let raw: Uint8Array;
  try { raw = new Uint8Array(await s.decrypt({ name: "AES-GCM", iv: buf(ring.iv) }, kek, ring.wrapped)); }
  catch { return null; }                                           // the wrong passphrase
  try { return await s.importKey("raw", buf(raw), AES, false, ["encrypt", "decrypt"]); }
  finally { raw.fill(0); }
}

/* ---------- 4. State ---------- */
const S = {
  state: "pending" as State, db: null as IDBDatabase | null, key: null as CryptoKey | null, ring: null as Ring | null,
  mirror: new Map<string, string>(), pending: new Map<string, string | null>(), keysCache: null as string[] | null,
  unlockedUntil: null as number | null, migrated: 0, unreadable: 0, ms: 0, reason: "",
  ready: null as Promise<StoreStatus> | null, writing: Promise.resolve() as Promise<void>, timer: 0 as unknown,
  channel: null as BroadcastChannel | null, listeners: [] as ((name: string | null) => void)[], lastExtend: 0, keepMs: 0
};

export function status(): StoreStatus {
  return { state: S.state, encrypted: S.state === "open" || S.state === "locked", passphrase: !!S.ring && S.ring.mode === "passphrase",
    unlockedUntil: S.unlockedUntil, records: S.mirror.size, migrated: S.migrated, unreadable: S.unreadable, ms: S.ms, reason: S.reason };
}

function emit(type: string, detail: Record<string, unknown> = {}): void {
  const g = globalThis as unknown as { dispatchEvent?: (e: Event) => boolean; CustomEvent?: typeof CustomEvent };
  if (g.dispatchEvent && g.CustomEvent) g.dispatchEvent(new g.CustomEvent("cognicopia:store", { detail: Object.assign({ type }, detail) }));
}
/* Another tab's change arrives as an ordinary "storage" event. */
function storageEvent(name: string, oldValue: string | null, newValue: string | null): void {
  const g = globalThis as unknown as { dispatchEvent?: (e: Event) => boolean; StorageEvent?: typeof StorageEvent; location?: Location };
  if (g.dispatchEvent && g.StorageEvent) g.dispatchEvent(new g.StorageEvent("storage", { key: name, oldValue, newValue, url: g.location ? g.location.href : "" }));
  S.listeners.forEach(fn => { try { fn(name); } catch { /* a listener's own problem */ } });
}
export function onChange(fn: (name: string | null) => void): () => void {
  S.listeners.push(fn);
  return () => { S.listeners = S.listeners.filter(f => f !== fn); };
}

/* ---------- 5. Opening ---------- */
export function ready(): Promise<StoreStatus> {
  if (!S.ready) S.ready = open().then(() => status());
  return S.ready;
}
async function open(): Promise<void> {
  const t0 = now(), e = env();
  try {
    if (!e.idb || !e.subtle || !e.random) throw new Error(!e.idb ? "no IndexedDB" : "no Web Crypto");
    S.db = await openDb(e.idb);
    await loadRing();
    listen();
  } catch (err){
    S.state = "unavailable"; S.reason = String((err as Error).message || err); S.db = null; S.key = null;
  }
  S.ms = Math.round((now() - t0) * 10) / 10;
}
async function loadRing(): Promise<void> {
  const d = S.db!;
  let ring: Ring | undefined, session: SessionKey | undefined;
  await tx(d, [RINGS], "readonly", t => {
    const st = t.objectStore(RINGS);
    req(st.get("ring")).then(v => { ring = v as Ring | undefined; });
    req(st.get("session")).then(v => { session = v as SessionKey | undefined; });
  });
  if (!ring){                                                        // first open on this computer
    const key = await newDeviceKey();
    ring = { mode: "device", key, created: new Date().toISOString() };
    const r = ring;
    await tx(d, [RINGS], "readwrite", t => { t.objectStore(RINGS).put(r, "ring"); });
  }
  S.ring = ring;
  if (ring.mode === "device"){ S.key = ring.key; S.unlockedUntil = null; }
  else if (session && session.expires > Date.now()){ S.key = session.key; S.unlockedUntil = session.expires; S.keepMs = session.keepMs || 0; }
  else {
    if (session) await tx(d, [RINGS], "readwrite", t => { t.objectStore(RINGS).delete("session"); });
    S.key = null; S.unlockedUntil = null;
  }
  if (S.key){ await loadRecords(); await migrate(); S.state = "open"; extendSession(); }
  else { S.mirror.clear(); S.state = "locked"; }
  S.keysCache = null;
}
async function loadRecords(): Promise<void> {
  const d = S.db!, key = S.key!;
  let names: IDBValidKey[] = [], rows: SealedRecord[] = [];
  await tx(d, [RECORDS], "readonly", t => {
    const st = t.objectStore(RECORDS);
    req(st.getAllKeys()).then(v => { names = v; });
    req(st.getAll()).then(v => { rows = v as SealedRecord[]; });
  });
  const opened = await Promise.all(rows.map((r, i) => unseal(key, String(names[i]), r).then(v => v, () => null)));
  S.mirror.clear(); S.unreadable = 0;
  opened.forEach((v, i) => { const n = String(names[i]); if (v == null) S.unreadable++; else S.mirror.set(n, v); });
  S.pending.forEach((v, n) => { if (v == null) S.mirror.delete(n); else S.mirror.set(n, v); });   // writes made while opening win
}
/* Plain copies left in localStorage are sealed, then removed. */
async function migrate(): Promise<void> {
  const ls = env().ls; if (!ls) return;
  const found: [string, string][] = [];
  try { for (let i = 0; i < ls.length; i++){ const k = ls.key(i); if (k && isSealed(k)){ const v = ls.getItem(k); if (v != null) found.push([k, v]); } } }
  catch { return; }
  if (!found.length) return;
  found.forEach(([k, v]) => { S.mirror.set(k, v); S.pending.set(k, v); });
  await persist();
  found.forEach(([k, v]) => { try { if (ls.getItem(k) === v) ls.removeItem(k); } catch { /* left for next time */ } });
  S.migrated += found.length; S.keysCache = null;
}

/* ---------- 6. Saving ---------- */
function schedule(): void {
  if (S.timer) return;
  S.timer = setTimeout(() => { S.timer = 0; S.writing = S.writing.then(persist, persist); }, 0);
}
async function persist(): Promise<void> {
  if (!S.db || !S.key || !S.pending.size) return;
  const batch = Array.from(S.pending.entries()); S.pending.clear();
  const key = S.key;
  try {
    const sealed = await Promise.all(batch.map(([n, v]) => v == null ? Promise.resolve(null) : seal(key, n, v)));
    await tx(S.db, [RECORDS], "readwrite", t => {
      const st = t.objectStore(RECORDS);
      batch.forEach(([n], i) => { const r = sealed[i]; if (r) st.put(r, n); else st.delete(n); });
    });
    if (S.channel) S.channel.postMessage({ type: "records", names: batch.map(b => b[0]) });
    extendSession();
  } catch (err){
    batch.forEach(([n, v]) => { if (!S.pending.has(n)) S.pending.set(n, v); });   // try again with the next write
    emit("error", { message: "Saved details could not be written: " + String((err as Error).message || err) });
    throw err;
  }
}
export function flush(): Promise<void> {
  if (S.timer){ clearTimeout(S.timer as number); S.timer = 0; S.writing = S.writing.then(persist, persist); }
  return S.writing.catch(() => undefined);
}
/* An unlock lasts for the chosen time without use; any save extends it. */
function extendSession(): void {
  if (!S.db || !S.key || !S.ring || S.ring.mode !== "passphrase" || S.unlockedUntil == null || S.keepMs <= 0) return;
  const t = Date.now(); if (t - S.lastExtend < 60000) return;
  S.lastExtend = t;
  const session: SessionKey = { key: S.key, expires: t + S.keepMs, keepMs: S.keepMs };
  S.unlockedUntil = session.expires;
  tx(S.db, [RINGS], "readwrite", tr => { tr.objectStore(RINGS).put(session, "session"); }).catch(() => undefined);
}

/* ---------- 7. The localStorage stand-in ---------- */
function lsGet(n: string): string | null { const ls = env().ls; try { return ls ? ls.getItem(n) : null; } catch { return null; } }
function allKeys(): string[] {
  if (S.keysCache) return S.keysCache;
  const ls = env().ls, out: string[] = [], plainAll = S.state === "unavailable";
  try { if (ls) for (let i = 0; i < ls.length; i++){ const k = ls.key(i); if (k != null && (plainAll || !isSealed(k))) out.push(k); } } catch { /* blocked */ }
  if (!plainAll) S.mirror.forEach((_, k) => out.push(k));
  S.keysCache = out;
  return out;
}
export class LockedError extends Error {
  constructor(){ super("Saved resident details are locked. Unlock them with the passphrase to make changes."); this.name = "LockedError"; }
}
export const storage = {
  getItem(name: string): string | null {
    name = String(name);
    if (!isSealed(name) || S.state === "unavailable") return lsGet(name);
    const v = S.mirror.get(name);
    return v === undefined ? null : v;
  },
  setItem(name: string, value: string): void {
    name = String(name); value = String(value);
    if (!isSealed(name) || S.state === "unavailable"){ const ls = env().ls; if (!ls) throw new Error("storage unavailable"); ls.setItem(name, value); S.keysCache = null; return; }
    if (S.state === "locked") throw new LockedError();
    const old = S.mirror.get(name);
    S.mirror.set(name, value); S.pending.set(name, value);
    if (old === undefined) S.keysCache = null;
    schedule();
  },
  removeItem(name: string): void {
    name = String(name);
    if (!isSealed(name) || S.state === "unavailable"){ const ls = env().ls; try { if (ls) ls.removeItem(name); } catch { /* blocked */ } S.keysCache = null; return; }
    if (S.state === "locked") throw new LockedError();
    if (S.mirror.delete(name)) S.keysCache = null;
    S.pending.set(name, null);
    schedule();
  },
  key(i: number): string | null { const k = allKeys()[i]; return k === undefined ? null : k; },
  get length(): number { return allKeys().length; }
};
/* Every sealed name that starts with prefix, with its value. */
export function entries(prefix: string): [string, string][] {
  const out: [string, string][] = [];
  if (S.state === "unavailable"){ const ls = env().ls; try { if (ls) for (let i = 0; i < ls.length; i++){ const k = ls.key(i); if (k && k.startsWith(prefix)){ const v = ls.getItem(k); if (v != null) out.push([k, v]); } } } catch { /* blocked */ } }
  else S.mirror.forEach((v, k) => { if (k.startsWith(prefix)) out.push([k, v]); });
  return out.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
}

/* ---------- 8. Other tabs ---------- */
function listen(): void {
  const BC = (globalThis as unknown as { BroadcastChannel?: typeof BroadcastChannel }).BroadcastChannel;
  if (!BC || S.channel) return;
  S.channel = new BC("cognicopia-secure");
  S.channel.onmessage = (ev: MessageEvent) => {
    const m = ev.data || {};
    if (m.type === "records" && Array.isArray(m.names)) refresh(m.names.map(String)).catch(() => undefined);
    else if (m.type === "keyring") reopen().catch(() => undefined);
  };
}
async function refresh(names: string[]): Promise<void> {
  if (!S.db || !S.key || S.state !== "open") return;
  const got: (SealedRecord | undefined)[] = [];
  await tx(S.db, [RECORDS], "readonly", t => { const st = t.objectStore(RECORDS); names.forEach((n, i) => { req(st.get(n)).then(v => { got[i] = v as SealedRecord | undefined; }); }); });
  const key = S.key;
  for (let i = 0; i < names.length; i++){
    const n = names[i], r = got[i]; if (S.pending.has(n)) continue;     // this tab's newer write wins
    const oldValue = S.mirror.has(n) ? S.mirror.get(n)! : null;
    let newValue: string | null = null;
    if (r){ try { newValue = await unseal(key, n, r); } catch { continue; } }
    if (newValue === oldValue) continue;
    if (newValue == null) S.mirror.delete(n); else S.mirror.set(n, newValue);
    S.keysCache = null;
    storageEvent(n, oldValue, newValue);
  }
}
/* The keyring changed in another tab (a passphrase set or removed, a lock). */
async function reopen(): Promise<void> {
  if (!S.db) return;
  const was = S.state;
  await loadRing();
  if (was === "open" && S.state === "locked"){
    emit("locked");
    const g = globalThis as unknown as { location?: Location };
    if (g.location && typeof g.location.reload === "function") g.location.reload();   // take names off the screen
  } else { S.keysCache = null; storageEvent("", null, null); emit("changed"); }
}
function announceRing(): void { if (S.channel) S.channel.postMessage({ type: "keyring" }); }

/* ---------- 9. Passphrase ---------- */
function needOpen(): void { if (S.state !== "open" || !S.db || !S.key) throw new Error(S.state === "locked" ? "Unlock first." : "Encrypted storage is not available in this browser."); }
export function passphraseProblem(pass: string): string {
  if (typeof pass !== "string" || pass.length < 10) return "Use a passphrase of at least 10 characters. A short sentence works well.";
  if (/^(.)\1+$/.test(pass)) return "Use a passphrase that is not one character repeated.";
  return "";
}
/* Write every record (and every photo) again under a new key, in one transaction. */
async function resealAll(key: CryptoKey, ring: Ring, session: SessionKey | null): Promise<void> {
  const d = S.db!, old = S.key!;
  await flush();
  const rows = await Promise.all(Array.from(S.mirror.entries()).map(async ([n, v]) => [n, await seal(key, n, v)] as [string, SealedRecord]));
  let bn: IDBValidKey[] = [], bv: SealedRecord[] = [];
  await tx(d, [BLOBS], "readonly", t => { const st = t.objectStore(BLOBS); req(st.getAllKeys()).then(v => { bn = v; }); req(st.getAll()).then(v => { bv = v as SealedRecord[]; }); });
  const blobs = (await Promise.all(bv.map(async (r, i) => {
    const n = String(bn[i]);
    try { return [n, await seal(key, n, await unseal(old, n, r))] as [string, SealedRecord]; } catch { return null; }   // a damaged photo is dropped
  }))).filter((x): x is [string, SealedRecord] => !!x);
  await tx(d, [RINGS, RECORDS, BLOBS], "readwrite", t => {
    const st = t.objectStore(RECORDS); st.clear(); rows.forEach(([n, r]) => st.put(r, n));
    const bs = t.objectStore(BLOBS); bs.clear(); blobs.forEach(([n, r]) => bs.put(r, n));
    const rg = t.objectStore(RINGS); rg.put(ring, "ring");
    if (session) rg.put(session, "session"); else rg.delete("session");
  });
  S.key = key; S.ring = ring; S.unlockedUntil = session ? session.expires : null; S.lastExtend = Date.now();
  announceRing();
}
export async function setPassphrase(pass: string, keepMinutes: number = DEFAULT_KEEP_MINUTES, currentPass?: string): Promise<void> {
  needOpen();
  const problem = passphraseProblem(pass); if (problem) throw new Error(problem);
  if (S.ring!.mode === "passphrase"){                              // a change: the same key, wrapped again
    const ring = S.ring as PassRing;
    const check = currentPass == null ? null : await unwrapKey(ring, currentPass);
    if (!check) throw new Error("The current passphrase is not right.");
  }
  const { ring, key } = await wrapNewKey(pass, PBKDF2_ROUNDS);
  S.keepMs = Math.max(0, keepMinutes) * 60000;
  const session: SessionKey | null = S.keepMs > 0 ? { key, expires: Date.now() + S.keepMs, keepMs: S.keepMs } : null;
  await resealAll(key, ring, session);
}
export async function removePassphrase(pass: string): Promise<void> {
  needOpen();
  if (S.ring!.mode !== "passphrase") return;
  if (!(await unwrapKey(S.ring as PassRing, pass))) throw new Error("That passphrase is not right.");
  const key = await newDeviceKey();
  await resealAll(key, { mode: "device", key, created: new Date().toISOString() }, null);
}
export async function unlock(pass: string, keepMinutes: number = DEFAULT_KEEP_MINUTES): Promise<boolean> {
  if (!S.db || !S.ring) return false;
  if (S.ring.mode !== "passphrase" || S.state === "open") return true;
  const key = await unwrapKey(S.ring, pass);
  if (!key) return false;
  S.key = key; S.keepMs = Math.max(0, keepMinutes) * 60000;
  if (S.keepMs > 0){
    const session: SessionKey = { key, expires: Date.now() + S.keepMs, keepMs: S.keepMs };
    await tx(S.db, [RINGS], "readwrite", t => { t.objectStore(RINGS).put(session, "session"); });
    S.unlockedUntil = session.expires; S.lastExtend = Date.now();
  } else S.unlockedUntil = null;
  await loadRecords(); await migrate();
  S.state = "open"; S.keysCache = null;
  announceRing();
  emit("unlocked");
  return true;
}
/* Forget the key everywhere on this computer. */
export async function lock(): Promise<void> {
  if (!S.db || !S.ring || S.ring.mode !== "passphrase") return;
  await flush();
  await tx(S.db, [RINGS], "readwrite", t => { t.objectStore(RINGS).delete("session"); });
  S.key = null; S.unlockedUntil = null; S.mirror.clear(); S.pending.clear(); S.keysCache = null; S.state = "locked";
  announceRing();
  emit("locked");
}
/* Remove every sealed record and the key: a fresh start on this computer. */
export async function wipe(): Promise<void> {
  if (S.timer){ clearTimeout(S.timer as number); S.timer = 0; }
  S.pending.clear();
  const ls = env().ls;
  if (ls){ const gone: string[] = []; try { for (let i = 0; i < ls.length; i++){ const k = ls.key(i); if (k && isSealed(k)) gone.push(k); } gone.forEach(k => ls.removeItem(k)); } catch { /* blocked */ } }
  if (S.db){
    const key = await newDeviceKey();
    await tx(S.db, [RINGS, RECORDS, BLOBS], "readwrite", t => { t.objectStore(RECORDS).clear(); t.objectStore(BLOBS).clear(); const rg = t.objectStore(RINGS); rg.put({ mode: "device", key, created: new Date().toISOString() } as DeviceRing, "ring"); rg.delete("session"); });
    S.ring = { mode: "device", key, created: new Date().toISOString() }; S.key = key; S.state = "open"; S.unlockedUntil = null;
    announceRing();
  }
  S.mirror.clear(); S.keysCache = null;
}

/* ---------- 9b. Photos and other large items ----------
   Sealed like every record, but kept in their own store and read only
   when asked for, so opening a page never decrypts them all. Names must
   start with a sealed prefix (for example "cognicopia_heirloom_photo_").
   They need the encrypted store: without it, they are refused. */
function needBlobs(name: string): void {
  if (!isSealed(name)) throw new Error("Not a sealed name: " + name);
  if (S.state === "locked") throw new LockedError();
  if (S.state !== "open" || !S.db || !S.key) throw new Error("Photos need a browser that can encrypt them (a current Chrome, Edge, Firefox or Safari).");
}
export async function putBlob(name: string, value: string): Promise<void> {
  needBlobs(name);
  const r = await seal(S.key!, name, String(value)), d = S.db!;
  await tx(d, [BLOBS], "readwrite", t => { t.objectStore(BLOBS).put(r, name); });
}
export async function getBlob(name: string): Promise<string | null> {
  needBlobs(name);
  let r: SealedRecord | undefined;
  await tx(S.db!, [BLOBS], "readonly", t => { req(t.objectStore(BLOBS).get(name)).then(v => { r = v as SealedRecord | undefined; }); });
  if (!r) return null;
  try { return await unseal(S.key!, name, r); } catch { return null; }
}
export async function deleteBlob(name: string): Promise<void> {
  needBlobs(name);
  await tx(S.db!, [BLOBS], "readwrite", t => { t.objectStore(BLOBS).delete(name); });
}
export async function blobNames(prefix: string): Promise<string[]> {
  if (S.state !== "open" || !S.db) return [];
  let keys: IDBValidKey[] = [];
  await tx(S.db, [BLOBS], "readonly", t => { req(t.objectStore(BLOBS).getAllKeys()).then(v => { keys = v; }); });
  return keys.map(String).filter(k => k.startsWith(prefix)).sort();
}

/* ---------- 10. Aliases ---------- */
interface ProfileLike { id?: unknown; tier1_core?: { preferredName?: unknown; unitNumber?: unknown; alias?: unknown } | null; }
const clean = (v: unknown, max: number): string => String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
const CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
/* A short, stable code from an ID (FNV-1a), with no easily confused characters. */
export function shortCode(id: string, length = 4): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++){ h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  let out = "";
  for (let i = 0; i < length; i++){ out += CODE_CHARS[h % CODE_CHARS.length]; h = Math.floor(h / CODE_CHARS.length) || (h ^ 0x9e3779b9) >>> 0; }
  return out;
}
/* The alias a resident goes by on shared screens and staff pages: the one
   staff chose, else "Resident <unit>", else "Resident <code>". It never
   contains the resident's name. */
export function aliasFor(p: ProfileLike | null | undefined): string {
  const t1 = (p && p.tier1_core) || {};
  const own = clean(t1.alias, 32); if (own) return own;
  const unit = clean(t1.unitNumber, 16).toUpperCase(); if (unit) return "Resident " + unit;
  const id = typeof (p && p.id) === "string" ? String(p!.id) : "";
  return "Resident " + (id ? shortCode(id) : "(no unit)");
}
export function displayName(p: ProfileLike | null | undefined, useAlias: boolean): string {
  const name = clean(p && p.tier1_core ? p.tier1_core.preferredName : "", 40);
  return useAlias || !name ? aliasFor(p) : name;
}

/* ---------- 11. Locked files (.cognicopia) and station handoffs ----------
   The same envelope as the packet tool's locked files (index.html):
   { format:"cognicopia-locked", v:1, kind, kdf:{PBKDF2, SHA-256,
   iterations, salt}, cipher:{AES-GCM, 256, iv}, data } in base64. A
   roster is kind "residents" around the packet tool's backup format. */
export const LOCKED_FORMAT = "cognicopia-locked";
export const BACKUP_FORMAT = "cognicopia.residentBackup";
export const PROFILE_SCHEMA = "cognicopia.residentProfile";
export interface LockedEnvelope { format: string; v: number; kind: string; kdf: { name: string; hash: string; iterations: number; salt: string }; cipher: { name: string; length: number; iv: string }; data: string; }
export async function sealFile(obj: unknown, pass: string, kind: string, rounds: number = PBKDF2_ROUNDS): Promise<LockedEnvelope> {
  const s = env().subtle; if (!s) throw new Error("This browser cannot lock files.");
  const salt = bytes(16), iv = bytes(12), key = await deriveKek(pass, salt, rounds);
  const data = await s.encrypt({ name: "AES-GCM", iv: buf(iv) }, key, enc.encode(JSON.stringify(obj)));
  return { format: LOCKED_FORMAT, v: 1, kind, kdf: { name: "PBKDF2", hash: "SHA-256", iterations: rounds, salt: toB64(salt) }, cipher: { name: "AES-GCM", length: 256, iv: toB64(iv) }, data: toB64(data) };
}
export const isLockedFile = (o: unknown): o is LockedEnvelope => !!o && typeof o === "object" && (o as { format?: unknown }).format === LOCKED_FORMAT;
/* Throws Error("format") for a file that is not a locked file, Error("passphrase") for the wrong passphrase. */
export async function openFile(env0: unknown, pass: string): Promise<unknown> {
  const s = env().subtle; if (!s) throw new Error("This browser cannot open locked files.");
  if (!isLockedFile(env0)) throw new Error("format");
  const k = env0.kdf || ({} as LockedEnvelope["kdf"]), c = env0.cipher || ({} as LockedEnvelope["cipher"]), rounds = Number(k.iterations);
  if (env0.v !== 1 || k.name !== "PBKDF2" || k.hash !== "SHA-256" || c.name !== "AES-GCM" || !(rounds >= 100000 && rounds <= 5000000) || typeof env0.data !== "string") throw new Error("format");
  const key = await deriveKek(pass, fromB64(k.salt), rounds);
  let plain: ArrayBuffer;
  try { plain = await s.decrypt({ name: "AES-GCM", iv: buf(fromB64(c.iv)) }, key, buf(fromB64(env0.data))); }
  catch { throw new Error("passphrase"); }
  return JSON.parse(dec.decode(plain));
}
export interface RosterFile { format: string; version: number; app: string; exportedAt: string; recordCount: number; profiles: Record<string, unknown>[]; handoff?: { station: string; note: string }; }
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
/* A profile a roster may carry: the right schema, an ID and a name. The
   receiving page normalizes the rest as it does for any profile. */
export function isProfile(p: unknown): p is Record<string, unknown> & { id: string; tier1_core: { preferredName: string } } {
  if (!p || typeof p !== "object" || Array.isArray(p)) return false;
  const o = p as { schema?: unknown; id?: unknown; tier1_core?: { preferredName?: unknown } };
  return o.schema === PROFILE_SCHEMA && typeof o.id === "string" && ID_RE.test(o.id) && !!o.tier1_core && typeof o.tier1_core.preferredName === "string" && !!o.tier1_core.preferredName.trim();
}
export function rosterFile(profiles: unknown[], station = "", note = ""): RosterFile {
  const list = profiles.filter(isProfile);
  const out: RosterFile = { format: BACKUP_FORMAT, version: 1, app: "Cognicopia", exportedAt: new Date().toISOString(), recordCount: list.length, profiles: list };
  if (station || note) out.handoff = { station: clean(station, 60), note: clean(note, 200) };
  return out;
}
export async function exportRoster(profiles: unknown[], pass: string, station = "", note = ""): Promise<LockedEnvelope> {
  const problem = passphraseProblem(pass); if (problem) throw new Error(problem);
  return sealFile(rosterFile(profiles, station, note), pass, "residents");
}
/* Opens a roster file (locked, or a plain backup) and returns its valid profiles. */
export async function readRoster(text: string, pass: string): Promise<{ profiles: Record<string, unknown>[]; skipped: number; exportedAt: string; handoff: RosterFile["handoff"] | null }> {
  let o: unknown;
  try { o = JSON.parse(text); } catch { throw new Error("format"); }
  if (isLockedFile(o)){
    if (o.kind !== "residents") throw new Error("kind");
    o = await openFile(o, pass);
  }
  const r = o as Partial<RosterFile>;
  if (!r || r.format !== BACKUP_FORMAT || !Array.isArray(r.profiles)) throw new Error("format");
  const profiles = r.profiles.filter(isProfile);
  return { profiles, skipped: r.profiles.length - profiles.length, exportedAt: String(r.exportedAt || ""), handoff: r.handoff || null };
}
/* How incoming residents join the ones already here. "newer" (the
   handoff default) keeps whichever copy was updated last. */
export type MergeMode = "newer" | "replace" | "skip";
export function mergeRoster(existing: Record<string, unknown>[], incoming: Record<string, unknown>[], mode: MergeMode = "newer"): { write: Record<string, unknown>[]; added: number; updated: number; kept: number } {
  const byId = new Map<string, Record<string, unknown>>();
  existing.forEach(p => { if (isProfile(p)) byId.set(p.id, p); });
  const stamp = (p: Record<string, unknown>): number => { const t = Date.parse(String(p.updatedAt || p.createdAt || "")); return Number.isFinite(t) ? t : 0; };
  const write: Record<string, unknown>[] = []; let added = 0, updated = 0, kept = 0;
  incoming.forEach(p => {
    if (!isProfile(p)) return;
    const have = byId.get(p.id);
    if (!have){ write.push(p); byId.set(p.id, p); added++; return; }
    if (mode === "skip" || (mode === "newer" && stamp(p) <= stamp(have))){ kept++; return; }
    write.push(p); byId.set(p.id, p); updated++;
  });
  return { write, added, updated, kept };
}

/* ---------- 12. The unlock prompt ----------
   A small dialog any page can show when the store is locked. It resolves
   true once unlocked, false if staff continue without resident details. */
export function promptUnlock(): Promise<boolean> {
  const g = globalThis as unknown as { document?: Document };
  const doc = g.document;
  if (!doc || S.state !== "locked") return Promise.resolve(S.state === "open");
  if (doc.readyState === "loading")                                  // called from the head: wait for the page body
    return new Promise(resolve => doc.addEventListener("DOMContentLoaded", () => { promptUnlock().then(resolve); }, { once: true }));
  return new Promise(resolve => {
    const wrap = doc.createElement("div");
    wrap.setAttribute("style", "position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:16px;background:rgba(6,20,14,.78);font:16px/1.5 'Atkinson Hyperlegible','Trebuchet MS','Segoe UI',sans-serif");
    const opts = KEEP_CHOICES.map(c => `<option value="${c.minutes}"${c.minutes === DEFAULT_KEEP_MINUTES ? " selected" : ""}>${c.label}</option>`).join("");
    wrap.innerHTML = `<form role="dialog" aria-modal="true" aria-labelledby="cssTitle" aria-describedby="cssBody" style="width:min(460px,100%);padding:24px;border-radius:14px;background:#fff;color:#10251c;box-shadow:0 20px 60px rgba(0,0,0,.4)">
      <h2 id="cssTitle" style="margin:0 0 6px;font-size:21px;line-height:1.25;color:#10251c">Saved resident details are locked</h2>
      <p id="cssBody" style="margin:0 0 14px;color:#2f4a3d">Enter this computer's Cognicopia passphrase to open them. They are encrypted on this computer and are never sent anywhere.</p>
      <label for="cssPass" style="display:block;font-weight:700;margin-bottom:4px;color:#10251c">Passphrase</label>
      <input id="cssPass" type="password" autocomplete="current-password" required style="box-sizing:border-box;width:100%;min-height:44px;padding:8px 10px;border:2px solid #52796f;border-radius:8px;font:inherit;background:#fff;color:#10251c">
      <label for="cssKeep" style="display:block;font-weight:700;margin:12px 0 4px;color:#10251c">Keep unlocked on this computer for</label>
      <select id="cssKeep" style="box-sizing:border-box;width:100%;min-height:44px;padding:6px 8px;border:2px solid #52796f;border-radius:8px;font:inherit;background:#fff;color:#10251c">${opts}</select>
      <p id="cssMsg" role="alert" style="min-height:1.5em;margin:10px 0 0;color:#9b1c1c;font-weight:700"></p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px">
        <button type="submit" style="min-height:44px;padding:8px 18px;border:0;border-radius:8px;background:#1b4332;color:#fff;font:inherit;font-weight:700;cursor:pointer">Unlock</button>
        <button type="button" id="cssSkip" style="min-height:44px;padding:8px 14px;border:2px solid #1b4332;border-radius:8px;background:#fff;color:#1b4332;font:inherit;font-weight:700;cursor:pointer">Continue without them</button>
      </div></form>`;
    doc.body.appendChild(wrap);
    const form = wrap.querySelector("form") as HTMLFormElement, pass = wrap.querySelector("#cssPass") as HTMLInputElement;
    const keep = wrap.querySelector("#cssKeep") as HTMLSelectElement, msg = wrap.querySelector("#cssMsg") as HTMLElement, skip = wrap.querySelector("#cssSkip") as HTMLButtonElement;
    const before = doc.activeElement as HTMLElement | null;
    const done = (ok: boolean): void => { wrap.remove(); if (before && before.focus) before.focus(); resolve(ok); };
    form.addEventListener("submit", ev => {
      ev.preventDefault();
      if (!pass.value){ msg.textContent = "Type the passphrase."; pass.focus(); return; }
      msg.textContent = "Opening…"; (form.querySelector("[type=submit]") as HTMLButtonElement).disabled = true;
      unlock(pass.value, Number(keep.value)).then(ok => {
        (form.querySelector("[type=submit]") as HTMLButtonElement).disabled = false;
        if (ok) done(true); else { msg.textContent = "That passphrase is not right. Try again."; pass.select(); }
      }, () => { msg.textContent = "The details could not be opened. Try again."; });
    });
    skip.addEventListener("click", () => done(false));
    wrap.addEventListener("keydown", ev => {
      if (ev.key === "Escape"){ ev.preventDefault(); done(false); }
      if (ev.key === "Tab"){                                         // keep focus inside the dialog
        const f = Array.from(form.querySelectorAll<HTMLElement>("input,select,button")).filter(x => !(x as HTMLButtonElement).disabled);
        const first = f[0], last = f[f.length - 1];
        if (ev.shiftKey && doc.activeElement === first){ ev.preventDefault(); last.focus(); }
        else if (!ev.shiftKey && doc.activeElement === last){ ev.preventDefault(); first.focus(); }
      }
    });
    pass.focus();
  });
}
/* ready(), then the unlock prompt if a passphrase is set: what a page runs before it reads resident details. */
export async function openForPage(): Promise<StoreStatus> {
  await ready();
  if (S.state === "locked") await promptUnlock();
  return status();
}
