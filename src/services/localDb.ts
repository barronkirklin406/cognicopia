/* =====================================================================
   COGNICOPIA LOCAL DATABASE ("CognicopiaLocalDB")
   Resident profiles and the activity packets made for them, kept in this
   browser's own IndexedDB. Nothing here ever leaves the computer: there is
   no server, account or cloud copy, and this file makes no network
   request of any kind.

   Two object stores
     residents         one profile per resident: id, firstName, hometown,
                       pastOccupation, hobbies, cognitiveTier (Mild,
                       Moderate or Advanced) and an interests list
     generatedPackets  one saved packet per row: id, residentId, timestamp,
                       htmlContent and the list of selectedTemplates

   Sealed at rest (the default)
     A resident's details and a packet's pages carry a name and a life
     story, so they are not written to this database as plain text.
     When the encrypted store (secureStore.ts, "CogniSecureStore") is
     open, each row keeps only what a lookup needs (the id, the tier, the
     time, the template list) and the rest is sealed there with AES-256-GCM,
     so the optional passphrase and "Lock now" cover this data too. When
     the store is locked, reads and writes say so (code "locked") instead of
     failing quietly. Only a browser that cannot encrypt at all (no
     IndexedDB sealing, no Web Crypto) falls back to plain rows, the same
     rule the encrypted store itself follows; info().sealed says which.

   Every function is asynchronous and rejects with a LocalDbError that has
   a plain-language message and a short code: "invalid" (what was given is
   not usable), "not-found", "locked", "quota" (the computer is out of
   room), "unavailable" (this browser has no IndexedDB, or blocks it) or
   "failed" (anything else).

   Built into assets/services/localDb.js (globalThis.CogniLocalDb) by
   scripts/build-services.mjs. Written against plain adapters so the
   checks can run it in Node as well as in a real browser.
   @global CogniLocalDb
   ===================================================================== */

export const VERSION = "1.0.0";
export const DB_NAME = "CognicopiaLocalDB";
export const DB_VERSION = 1;
export const STORE_RESIDENTS = "residents";
export const STORE_PACKETS = "generatedPackets";
/** The three care levels a profile can have. */
export const TIERS: readonly string[] = ["Mild", "Moderate", "Advanced"];
/** The most a saved packet's HTML may hold (characters). A page is a few hundred KB; this is a guard, not a target. */
export const MAX_HTML = 5000000;
export const MAX_INTERESTS = 50;
export const MAX_TEMPLATES = 100;
/** Names of sealed records start with this (listed in secureStore.ts). */
export const SEAL_PREFIX = "cognicopia_localdb_";

export type Tier = "Mild" | "Moderate" | "Advanced";
export type ErrorCode = "invalid" | "not-found" | "locked" | "quota" | "unavailable" | "failed";

/** What a caller gives saveResident(). Unknown fields are ignored on purpose: only these are ever stored. */
export interface ResidentInput {
  id?: string;
  firstName: string;
  hometown?: string;
  pastOccupation?: string;
  hobbies?: string | string[];
  cognitiveTier: string;
  interests?: string[];
}
export interface Resident {
  id: string;
  firstName: string;
  hometown: string;
  pastOccupation: string;
  hobbies: string;
  cognitiveTier: Tier;
  interests: string[];
  createdAt: number;
  updatedAt: number;
  /** True only on a row whose sealed details would not open (damaged); the other details are then empty. */
  unreadable?: boolean;
}
export interface PacketInput {
  id?: string;
  residentId: string;
  timestamp?: number | string | Date;
  htmlContent: string;
  selectedTemplates?: string[];
}
export interface Packet {
  id: string;
  residentId: string;
  timestamp: number;
  htmlContent: string;
  selectedTemplates: string[];
  unreadable?: boolean;
}

/** An error with a short code and a message a person can read. `cause` keeps the browser's own error. */
export class LocalDbError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode, message: string, cause?: unknown){
    super(message, cause === undefined ? undefined : { cause });
    this.name = "LocalDbError";
    this.code = code;
  }
}

/* ---------- 1. Checking what is given ---------- */

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
/** Plain text from a field: no control characters or angle brackets, one space between words, cut to max. */
const clean = (v: unknown, max: number): string => String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);

function invalid(message: string): LocalDbError { return new LocalDbError("invalid", message); }

/** "mild", "MODERATE" and so on become the stored spelling; anything else is refused. */
export function normalizeTier(v: unknown): Tier {
  const s = String(v == null ? "" : v).trim().toLowerCase();
  const hit = TIERS.find(t => t.toLowerCase() === s);
  if (!hit) throw invalid(`The care level must be one of ${TIERS.join(", ")}.`);
  return hit as Tier;
}

function checkId(v: unknown, what: string): string {
  const s = String(v == null ? "" : v);
  if (!ID_PATTERN.test(s)) throw invalid(`${what} must be 1 to 64 letters, digits, dashes or underscores.`);
  return s;
}

/** A tidy list of short strings: trimmed, no repeats (ignoring case), no empties, at most `limit`. */
function cleanList(v: unknown, limit: number, each: number, what: string): string[] {
  if (v == null) return [];
  if (!Array.isArray(v)) throw invalid(`${what} must be a list.`);
  const seen = new Set<string>(), out: string[] = [];
  for (const item of v){
    const s = clean(item, each), k = s.toLowerCase();
    if (!s || seen.has(k)) continue;
    seen.add(k); out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/** Turns what a form gave into exactly the fields a resident row may hold. Throws "invalid" with a plain message. */
export function cleanResident(input: unknown): Omit<Resident, "id" | "createdAt" | "updatedAt"> & { id?: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw invalid("A resident profile must be an object.");
  const p = input as Record<string, unknown>;
  const firstName = clean(p.firstName, 80);
  if (!firstName) throw invalid("A resident needs a first name.");
  const hobbiesIn = Array.isArray(p.hobbies) ? (p.hobbies as unknown[]).map(x => clean(x, 80)).filter(Boolean).join(", ") : p.hobbies;
  const out: ReturnType<typeof cleanResident> = {
    firstName,
    hometown: clean(p.hometown, 120),
    pastOccupation: clean(p.pastOccupation, 120),
    hobbies: clean(hobbiesIn, 500),
    cognitiveTier: normalizeTier(p.cognitiveTier),
    interests: cleanList(p.interests, MAX_INTERESTS, 80, "Interests")
  };
  if (p.id !== undefined && p.id !== null && p.id !== "") out.id = checkId(p.id, "A resident id");
  return out;
}

/** The time as milliseconds since 1970. A number, a date or a date string will do; the default is now. */
function cleanTime(v: unknown, now: number): number {
  if (v === undefined || v === null || v === "") return now;
  const t = v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(String(v));
  if (!Number.isFinite(t) || t <= 0) throw invalid("The time of a packet must be a real date.");
  return Math.floor(t);
}

/** Turns what the packet maker gave into exactly the fields a packet row may hold. Throws "invalid" with a plain message. */
export function cleanPacket(input: unknown, now: number = Date.now()): Omit<Packet, "id"> & { id?: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw invalid("A packet must be an object.");
  const p = input as Record<string, unknown>;
  const residentId = checkId(p.residentId, "A resident id");
  if (typeof p.htmlContent !== "string" || !p.htmlContent.trim()) throw invalid("A packet needs its page content (htmlContent) as text.");
  if (p.htmlContent.length > MAX_HTML) throw invalid("That packet is too large to keep (over 5 million characters).");
  const out: ReturnType<typeof cleanPacket> = {
    residentId,
    timestamp: cleanTime(p.timestamp, now),
    htmlContent: p.htmlContent,
    selectedTemplates: cleanList(p.selectedTemplates, MAX_TEMPLATES, 80, "Selected templates")
  };
  if (p.id !== undefined && p.id !== null && p.id !== "") out.id = checkId(p.id, "A packet id");
  return out;
}

/* ---------- 2. IndexedDB, as promises ---------- */

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error || new Error("IndexedDB request failed")); });
}
/** Runs fn inside one transaction and resolves when it has committed (or rejects when it was refused). */
function tx(d: IDBDatabase, stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    let t: IDBTransaction;
    try { t = d.transaction(stores, mode); } catch (e){ reject(e); return; }
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error || new Error("IndexedDB transaction failed"));
    t.onabort = () => reject(t.error || new Error("IndexedDB transaction aborted"));
    try { fn(t); } catch (e){ try { t.abort(); } catch { /* already finished */ } reject(e); }
  });
}
function openDb(idb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let r: IDBOpenDBRequest;
    try { r = idb.open(DB_NAME, DB_VERSION); } catch (e){ reject(e); return; }
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains(STORE_RESIDENTS)) d.createObjectStore(STORE_RESIDENTS, { keyPath: "id" });
      if (!d.objectStoreNames.contains(STORE_PACKETS)){
        const s = d.createObjectStore(STORE_PACKETS, { keyPath: "id" });
        s.createIndex("byResident", "residentId", { unique: false });
        s.createIndex("byTimestamp", "timestamp", { unique: false });
      }
    };
    // An older tab holding the database open delays an upgrade; give it a few seconds to let go.
    const late = setTimeout(() => reject(new LocalDbError("unavailable", "The saved residents are open in another Cognicopia tab. Close the other tab and try again.")), 8000);
    r.onsuccess = () => {
      clearTimeout(late);
      const d = r.result;
      d.onversionchange = () => { d.close(); };                    // let a newer Cognicopia in another tab upgrade it
      resolve(d);
    };
    r.onerror = () => { clearTimeout(late); reject(r.error || new Error("IndexedDB would not open")); };
  });
}

/** Turns anything the browser throws into a LocalDbError a person can act on. */
export function explain(e: unknown): LocalDbError {
  if (e instanceof LocalDbError) return e;
  const name = e && typeof e === "object" ? String((e as { name?: unknown }).name) : "";
  if (name === "LockedError") return new LocalDbError("locked", "Saved resident details are locked. Unlock them with the passphrase first.", e);
  if (name === "QuotaExceededError") return new LocalDbError("quota", "This computer is out of room for saved packets. Delete older packets and try again.", e);
  if (name === "SecurityError" || name === "InvalidStateError" || name === "UnknownError" || name === "NotSupportedError")
    return new LocalDbError("unavailable", "This browser is not letting Cognicopia keep saved residents (a private window or blocked site data can do this).", e);
  return new LocalDbError("failed", "Cognicopia could not read or write its saved residents. " + (e instanceof Error && e.message ? e.message : ""), e);
}

/* ---------- 3. Sealing ---------- */

/**
 * Where the private part of a row goes. "ready" means put/get/remove work, "locked" means the passphrase is
 * needed, "none" means this browser cannot encrypt (rows are then kept as plain text).
 */
export interface Sealer {
  state(): Promise<"ready" | "locked" | "none">;
  put(name: string, value: string): Promise<void>;
  get(name: string): Promise<string | null>;
  remove(name: string): Promise<void>;
}

/** The page's encrypted store (assets/services/secureStore.js), or null where it is not loaded. */
function secureStoreSealer(root: unknown): Sealer | null {
  const s = (root as { CogniSecureStore?: {
    ready(): Promise<unknown>; status(): { state: string };
    putBlob(n: string, v: string): Promise<void>; getBlob(n: string): Promise<string | null>; deleteBlob(n: string): Promise<void>;
  } }).CogniSecureStore;
  if (!s || typeof s.putBlob !== "function") return null;
  return {
    async state(){ await s.ready(); const st = s.status().state; return st === "open" ? "ready" : st === "locked" ? "locked" : "none"; },
    put: (n, v) => s.putBlob(n, v),
    get: n => s.getBlob(n),
    remove: n => s.deleteBlob(n)
  };
}

/* ---------- 4. The database ---------- */

export interface Options {
  /** An IndexedDB factory; the page's own by default. */
  indexedDB?: IDBFactory;
  /** Where sealed details go. By default the page's encrypted store when it is loaded; pass null to keep plain rows. */
  sealer?: Sealer | null;
  /** The clock, for tests. */
  now?: () => number;
  /** Makes an id, for tests. */
  newId?: (prefix: string) => string;
}

function randomId(prefix: string): string {
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return prefix + c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(b); else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
  return prefix + Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
}

interface ResidentRow { id: string; cognitiveTier: Tier; createdAt: number; updatedAt: number; sealed: boolean; data?: SealedResident; }
interface SealedResident { firstName: string; hometown: string; pastOccupation: string; hobbies: string; interests: string[]; }
interface PacketRow { id: string; residentId: string; timestamp: number; selectedTemplates: string[]; sealed: boolean; htmlContent?: string; }

/** Makes a database handle. Pages use the ready-made functions at the bottom; checks make their own. */
export function createLocalDb(options: Options = {}){
  const root = globalThis as unknown as { indexedDB?: IDBFactory };
  const idb = options.indexedDB || root.indexedDB;
  const sealer: Sealer | null = options.sealer === undefined ? secureStoreSealer(globalThis) : options.sealer;
  const now = options.now || (() => Date.now());
  const newId = options.newId || randomId;
  let opening: Promise<IDBDatabase> | null = null;

  /** Opens the database once; later calls share it. A failed open is tried again next time. */
  function db(): Promise<IDBDatabase> {
    if (!idb) return Promise.reject(new LocalDbError("unavailable", "This browser cannot keep saved residents (it has no IndexedDB)."));
    if (!opening) opening = openDb(idb).catch(e => { opening = null; throw explain(e); });
    return opening;
  }

  /** "ready", "locked" or "none"; a locked store stops every read and write. */
  async function sealState(): Promise<"ready" | "locked" | "none"> {
    if (!sealer) return "none";
    try { return await sealer.state(); } catch (e){ throw explain(e); }
  }
  async function needUnlocked(): Promise<"ready" | "none"> {
    const s = await sealState();
    if (s === "locked") throw new LocalDbError("locked", "Saved resident details are locked. Unlock them with the passphrase first.");
    return s;
  }
  const residentRef = (id: string) => SEAL_PREFIX + "resident_" + id;
  const packetRef = (id: string) => SEAL_PREFIX + "packet_" + id;

  /** Whether this handle seals what it saves right now. */
  async function info(): Promise<{ name: string; version: number; sealed: boolean; state: string }> {
    const s = await sealState();
    return { name: DB_NAME, version: DB_VERSION, sealed: s === "ready", state: s };
  }

  function rowToResident(row: ResidentRow, d: SealedResident | null): Resident {
    if (!d) return { id: row.id, firstName: "", hometown: "", pastOccupation: "", hobbies: "", cognitiveTier: row.cognitiveTier, interests: [], createdAt: row.createdAt, updatedAt: row.updatedAt, unreadable: true };
    return { id: row.id, firstName: d.firstName, hometown: d.hometown, pastOccupation: d.pastOccupation, hobbies: d.hobbies, cognitiveTier: row.cognitiveTier,
      interests: d.interests.slice(), createdAt: row.createdAt, updatedAt: row.updatedAt };
  }
  async function openResident(row: ResidentRow): Promise<Resident> {
    if (!row.sealed) return rowToResident(row, row.data || null);
    let text: string | null = null;
    try { text = sealer ? await sealer.get(residentRef(row.id)) : null; } catch (e){ throw explain(e); }
    if (!text) return rowToResident(row, null);
    try { return rowToResident(row, JSON.parse(text) as SealedResident); } catch { return rowToResident(row, null); }
  }
  async function openPacket(row: PacketRow): Promise<Packet> {
    const base = { id: row.id, residentId: row.residentId, timestamp: row.timestamp, selectedTemplates: row.selectedTemplates.slice() };
    if (!row.sealed) return Object.assign(base, { htmlContent: row.htmlContent || "" });
    let text: string | null = null;
    try { text = sealer ? await sealer.get(packetRef(row.id)) : null; } catch (e){ throw explain(e); }
    return text === null ? Object.assign(base, { htmlContent: "", unreadable: true }) : Object.assign(base, { htmlContent: text });
  }

  /**
   * Adds a resident, or updates the one with the same id.
   * @param profileData {firstName, cognitiveTier, hometown?, pastOccupation?, hobbies?, interests?, id?}
   * @returns the saved profile, with its id and times
   * @throws LocalDbError "invalid" for a missing first name or an unknown care level; "locked", "quota", "unavailable" or "failed" otherwise
   */
  async function saveResident(profileData: ResidentInput): Promise<Resident> {
    try {
      const p = cleanResident(profileData);
      const seal = await needUnlocked() === "ready";
      const d = await db();
      const id = p.id || newId("res_"), t = now();
      let createdAt = t;
      const had = await req(d.transaction(STORE_RESIDENTS, "readonly").objectStore(STORE_RESIDENTS).get(id)) as ResidentRow | undefined;
      if (had) createdAt = had.createdAt;
      const body: SealedResident = { firstName: p.firstName, hometown: p.hometown, pastOccupation: p.pastOccupation, hobbies: p.hobbies, interests: p.interests };
      const row: ResidentRow = { id, cognitiveTier: p.cognitiveTier, createdAt, updatedAt: t, sealed: seal };
      if (seal) await sealer!.put(residentRef(id), JSON.stringify(body)); else row.data = body;
      try { await tx(d, [STORE_RESIDENTS], "readwrite", x => { x.objectStore(STORE_RESIDENTS).put(row); }); }
      catch (e){ if (seal && !had) { try { await sealer!.remove(residentRef(id)); } catch { /* nothing to undo */ } } throw e; }
      return rowToResident(row, body);
    } catch (e){ throw explain(e); }
  }

  /**
   * Finds one resident.
   * @param residentId the id saveResident() gave back
   * @returns the profile, or null when there is none with that id
   */
  async function getResident(residentId: string): Promise<Resident | null> {
    try {
      const id = checkId(residentId, "A resident id");
      await needUnlocked();
      const d = await db();
      const row = await req(d.transaction(STORE_RESIDENTS, "readonly").objectStore(STORE_RESIDENTS).get(id)) as ResidentRow | undefined;
      return row ? await openResident(row) : null;
    } catch (e){ throw explain(e); }
  }

  /**
   * Every saved resident, by first name (then id). A profile whose sealed details would not open
   * comes back with unreadable: true and empty details, so a damaged record is seen, not hidden.
   */
  async function getAllResidents(): Promise<Resident[]> {
    try {
      await needUnlocked();
      const d = await db();
      const rows = await req(d.transaction(STORE_RESIDENTS, "readonly").objectStore(STORE_RESIDENTS).getAll()) as ResidentRow[];
      const all = await Promise.all(rows.map(openResident));
      return all.sort((a, b) => a.firstName.localeCompare(b.firstName) || a.id.localeCompare(b.id));
    } catch (e){ throw explain(e); }
  }

  /**
   * Removes a resident and every packet kept for them.
   * @returns how many packets went with the profile
   */
  async function deleteResident(residentId: string): Promise<number> {
    try {
      const id = checkId(residentId, "A resident id");
      await needUnlocked();
      const d = await db();
      const packets = await req(d.transaction(STORE_PACKETS, "readonly").objectStore(STORE_PACKETS).index("byResident").getAllKeys(id)) as IDBValidKey[];
      await tx(d, [STORE_RESIDENTS, STORE_PACKETS], "readwrite", x => {
        x.objectStore(STORE_RESIDENTS).delete(id);
        const ps = x.objectStore(STORE_PACKETS);
        packets.forEach(k => ps.delete(k));
      });
      if (sealer && (await sealState()) === "ready"){
        for (const k of [residentRef(id)].concat(packets.map(k => packetRef(String(k))))) { try { await sealer.remove(k); } catch { /* already gone */ } }
      }
      return packets.length;
    } catch (e){ throw explain(e); }
  }

  /**
   * Keeps a packet that was made for a resident.
   * @param packetData {residentId, htmlContent, selectedTemplates?, timestamp?, id?}; the time defaults to now
   * @returns the saved packet, with its id and time
   * @throws LocalDbError "invalid" for missing page content, "not-found" when the resident is not saved
   */
  async function savePacket(packetData: PacketInput): Promise<Packet> {
    try {
      const p = cleanPacket(packetData, now());
      const seal = await needUnlocked() === "ready";
      const d = await db();
      const who = await req(d.transaction(STORE_RESIDENTS, "readonly").objectStore(STORE_RESIDENTS).getKey(p.residentId));
      if (who === undefined) throw new LocalDbError("not-found", "That resident is not saved, so a packet cannot be kept for them.");
      const id = p.id || newId("pkt_");
      const row: PacketRow = { id, residentId: p.residentId, timestamp: p.timestamp, selectedTemplates: p.selectedTemplates, sealed: seal };
      const had = await req(d.transaction(STORE_PACKETS, "readonly").objectStore(STORE_PACKETS).getKey(id));
      if (seal) await sealer!.put(packetRef(id), p.htmlContent); else row.htmlContent = p.htmlContent;
      try { await tx(d, [STORE_PACKETS], "readwrite", x => { x.objectStore(STORE_PACKETS).put(row); }); }
      catch (e){ if (seal && had === undefined) { try { await sealer!.remove(packetRef(id)); } catch { /* nothing to undo */ } } throw e; }
      return { id, residentId: p.residentId, timestamp: p.timestamp, htmlContent: p.htmlContent, selectedTemplates: p.selectedTemplates.slice() };
    } catch (e){ throw explain(e); }
  }

  /**
   * The packets kept for one resident, newest first.
   * @param residentId the id saveResident() gave back
   * @returns an empty list when there are none
   */
  async function getPacketsForResident(residentId: string): Promise<Packet[]> {
    try {
      const id = checkId(residentId, "A resident id");
      await needUnlocked();
      const d = await db();
      const rows = await req(d.transaction(STORE_PACKETS, "readonly").objectStore(STORE_PACKETS).index("byResident").getAll(id)) as PacketRow[];
      const all = await Promise.all(rows.map(openPacket));
      return all.sort((a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id));
    } catch (e){ throw explain(e); }
  }

  /** Removes one packet (to free room, or because it is no longer needed). Resolves true when there was one. */
  async function deletePacket(packetId: string): Promise<boolean> {
    try {
      const id = checkId(packetId, "A packet id");
      await needUnlocked();
      const d = await db();
      const had = await req(d.transaction(STORE_PACKETS, "readonly").objectStore(STORE_PACKETS).getKey(id));
      await tx(d, [STORE_PACKETS], "readwrite", x => { x.objectStore(STORE_PACKETS).delete(id); });
      if (sealer && (await sealState()) === "ready") { try { await sealer.remove(packetRef(id)); } catch { /* already gone */ } }
      return had !== undefined;
    } catch (e){ throw explain(e); }
  }

  /** Erases every resident and packet this handle can see, for a page's "clear saved data". */
  async function clearAll(): Promise<void> {
    try {
      await needUnlocked();
      const d = await db();
      const rKeys = await req(d.transaction(STORE_RESIDENTS, "readonly").objectStore(STORE_RESIDENTS).getAllKeys()) as IDBValidKey[];
      const pKeys = await req(d.transaction(STORE_PACKETS, "readonly").objectStore(STORE_PACKETS).getAllKeys()) as IDBValidKey[];
      await tx(d, [STORE_RESIDENTS, STORE_PACKETS], "readwrite", x => { x.objectStore(STORE_RESIDENTS).clear(); x.objectStore(STORE_PACKETS).clear(); });
      if (sealer && (await sealState()) === "ready"){
        for (const k of rKeys.map(k => residentRef(String(k))).concat(pKeys.map(k => packetRef(String(k))))) { try { await sealer.remove(k); } catch { /* already gone */ } }
      }
    } catch (e){ throw explain(e); }
  }

  /** Lets go of the database (a page that is finished with it, or a check). */
  async function close(): Promise<void> {
    const o = opening; opening = null;
    if (o) { try { (await o).close(); } catch { /* it never opened */ } }
  }

  return { saveResident, getResident, getAllResidents, deleteResident, savePacket, getPacketsForResident, deletePacket, clearAll, info, close };
}

/* ---------- 5. The page's own database ---------- */

let shared: ReturnType<typeof createLocalDb> | null = null;
const page = (): ReturnType<typeof createLocalDb> => shared || (shared = createLocalDb());

/** @see createLocalDb: saveResident */
export const saveResident = (profileData: ResidentInput): Promise<Resident> => page().saveResident(profileData);
/** @see createLocalDb: getResident */
export const getResident = (residentId: string): Promise<Resident | null> => page().getResident(residentId);
/** @see createLocalDb: getAllResidents */
export const getAllResidents = (): Promise<Resident[]> => page().getAllResidents();
/** @see createLocalDb: deleteResident */
export const deleteResident = (residentId: string): Promise<number> => page().deleteResident(residentId);
/** @see createLocalDb: savePacket */
export const savePacket = (packetData: PacketInput): Promise<Packet> => page().savePacket(packetData);
/** @see createLocalDb: getPacketsForResident */
export const getPacketsForResident = (residentId: string): Promise<Packet[]> => page().getPacketsForResident(residentId);
/** @see createLocalDb: deletePacket */
export const deletePacket = (packetId: string): Promise<boolean> => page().deletePacket(packetId);
/** @see createLocalDb: clearAll */
export const clearAll = (): Promise<void> => page().clearAll();
/** @see createLocalDb: info */
export const info = (): ReturnType<ReturnType<typeof createLocalDb>["info"]> => page().info();
