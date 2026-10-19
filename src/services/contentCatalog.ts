/* =====================================================================
   COGNICOPIA CONTENT CATALOG
   Loads and checks data/content-catalog.json: the public bank of word
   search lists, conversation trivia, reminiscence prompts and packet
   templates that the activity tools draw from.

   What it is, and is not
     - The catalog is public content. Nothing in it is about a person, and
       this loader never sends anything anywhere: it makes one plain GET
       for one file on the site's own address (never another site), with
       no cookies and no custom headers. In a page that is already served
       from the site, that is the same kind of read as loading a script.
     - It never throws. loadContentCatalog() always resolves with a result
       that says where the content came from and what went wrong, so a
       missing, damaged or blocked file cannot stop a packet from being
       made.

   How a load can end
     "network"   the file was read and at least one record is good.
                 `degraded` is true when some records were refused (each
                 refusal is listed in `rejected` with the reason).
     "fallback"  the file could not be used at all (offline and never
                 copied, a damaged file, nothing valid in it), so a small
                 built-in catalog is returned instead and `problems` says
                 why. The offline worker (sw.js) keeps a copy of the file,
                 so a computer that has loaded it once keeps working with
                 no connection.

   What a record must look like (the five fields of the catalog)
     item_id          lowercase letters, digits and underscores, unique
     category         Trivia, WordSearch, ReminiscencePrompt or CognitiveTemplate
     cognitive_tier   Tier_1_Mild, Tier_2_Moderate or Tier_3_Advanced
                      (the person's level of need: Tier_3 is the simplest page)
     tags             a short list of lowercase words
     content_payload  an object shaped for its category (see PAYLOAD below)

   Built into assets/services/contentCatalog.js (globalThis.CogniContentCatalog)
   by scripts/build-services.mjs. Written against plain adapters so the
   checks run it in Node as well as in a real browser.
   @global CogniContentCatalog
   ===================================================================== */

export const VERSION = "1.0.0";
/** Where the catalog lives, from the site's root. A page may pass its own `url`. */
export const DEFAULT_URL = "/data/content-catalog.json";
export const CATEGORIES: readonly string[] = ["Trivia", "WordSearch", "ReminiscencePrompt", "CognitiveTemplate"];
export const TIERS: readonly string[] = ["Tier_1_Mild", "Tier_2_Moderate", "Tier_3_Advanced"];
/** The level as a number, to match a resident profile's cognitiveTier (1, 2 or 3). */
export const TIER_NUMBER: Readonly<Record<string, number>> = { Tier_1_Mild: 1, Tier_2_Moderate: 2, Tier_3_Advanced: 3 };
/** The most a catalog file may hold: a guard against a damaged or wrong file, not a target. */
export const MAX_BYTES = 2000000;
export const MAX_ITEMS = 5000;
export const MAX_TEXT = 400;
export const DEFAULT_TIMEOUT_MS = 8000;
export const DEFAULT_ATTEMPTS = 2;

export type Category = "Trivia" | "WordSearch" | "ReminiscencePrompt" | "CognitiveTemplate";
export type Tier = "Tier_1_Mild" | "Tier_2_Moderate" | "Tier_3_Advanced";
export type Payload = Record<string, unknown>;
export interface CatalogItem { item_id: string; category: Category; cognitive_tier: Tier; tags: string[]; content_payload: Payload; }
export interface Problem { code: string; message: string; }
export interface Rejected { index: number; item_id: string; reasons: string[]; }
export type Source = "network" | "fallback";
export interface CatalogResult {
  /** true when the real catalog was read and used */
  ok: boolean;
  source: Source;
  /** true when some records were refused, or the built-in catalog is standing in */
  degraded: boolean;
  items: CatalogItem[];
  rejected: Rejected[];
  /** what went wrong, in plain words; empty on a clean load */
  problems: Problem[];
  version: string;
  /** how many tries the read took (0 when the file was never asked for) */
  attempts: number;
  loadedAt: number;
}

/* ---------- 1. Checking one record ---------- */

const ID_PATTERN = /^[a-z0-9][a-z0-9_]{2,63}$/;
const TAG_PATTERN = /^[a-z0-9][a-z0-9_]{0,39}$/;
const WORD_PATTERN = /^[A-Z]{3,12}$/;
const WORD_DIRECTIONS: readonly string[] = ["right", "left", "down", "up", "down_right", "down_left", "up_right", "up_left"];
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
/** Text a person will read: a real string, short, with no control characters and no angle brackets. */
function text(v: unknown, what: string, why: string[], max: number = MAX_TEXT): v is string {
  if (typeof v !== "string" || !v.trim()) { why.push(`${what} must be some text`); return false; }
  if (v.length > max) { why.push(`${what} is longer than ${max} characters`); return false; }
  if (/[\u0000-\u0008\u000B-\u001F\u007F<>]/.test(v)) { why.push(`${what} has a control character or an angle bracket`); return false; }
  return true;
}
function list(v: unknown, what: string, why: string[], min: number, max: number): v is unknown[] {
  if (!Array.isArray(v)) { why.push(`${what} must be a list`); return false; }
  if (v.length < min || v.length > max) { why.push(`${what} must hold ${min} to ${max} entries (it has ${v.length})`); return false; }
  return true;
}

/** The shape each category's content_payload must have. */
const PAYLOAD: Record<string, (p: Payload, why: string[]) => void> = {
  /** Trivia: { framing?, questions: [{ prompt, choices?, answer, follow_up? }] } */
  Trivia(p, why){
    if (p.framing !== undefined) text(p.framing, "framing", why);
    if (!list(p.questions, "questions", why, 1, 50)) return;
    (p.questions as unknown[]).forEach((q, i) => {
      const at = `question ${i + 1}`;
      if (!isObject(q)) { why.push(`${at} must be an object`); return; }
      text(q.prompt, `${at}: prompt`, why);
      if (text(q.answer, `${at}: answer`, why) && q.choices !== undefined) {
        if (list(q.choices, `${at}: choices`, why, 2, 6)) {
          const ch = (q.choices as unknown[]).filter((c, k) => text(c, `${at}: choice ${k + 1}`, why)) as string[];
          if (ch.length === (q.choices as unknown[]).length) {
            if (new Set(ch.map(c => c.toLowerCase())).size !== ch.length) why.push(`${at}: the choices repeat`);
            if (!ch.includes(q.answer as string)) why.push(`${at}: the answer is not one of the choices`);
          }
        }
      }
      if (q.follow_up !== undefined) text(q.follow_up, `${at}: follow_up`, why);
    });
  },
  /** WordSearch: { theme, words: [CAPITAL LETTERS, 3 to 12], grid_size: {rows, cols}, directions?, print_notes? } */
  WordSearch(p, why){
    text(p.theme, "theme", why);
    if (list(p.words, "words", why, 4, 40)) {
      const words = p.words as unknown[], bad = words.filter(w => typeof w !== "string" || !WORD_PATTERN.test(w));
      if (bad.length) why.push(`words must be 3 to 12 capital letters (check: ${bad.slice(0, 3).map(String).join(", ")})`);
      else if (new Set(words).size !== words.length) why.push("words repeat");
      else if (isObject(p.grid_size)) {
        const g = p.grid_size, longest = Math.max(...(words as string[]).map(w => w.length));
        const ok = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 5 && n <= 30;
        if (!ok(g.rows) || !ok(g.cols)) why.push("grid_size needs whole-number rows and cols from 5 to 30");
        else if (longest > Math.max(g.rows, g.cols)) why.push(`the longest word (${longest} letters) does not fit the grid`);
      }
    }
    if (!isObject(p.grid_size)) why.push("grid_size must be an object with rows and cols");
    if (p.directions !== undefined && list(p.directions, "directions", why, 1, 8)) {
      const d = p.directions as unknown[];
      if (!d.every(x => typeof x === "string" && WORD_DIRECTIONS.includes(x))) why.push(`directions must come from: ${WORD_DIRECTIONS.join(", ")}`);
    }
    if (p.print_notes !== undefined) text(p.print_notes, "print_notes", why);
  },
  /** ReminiscencePrompt: { prompts: [text], sensory_cues?: [text], facilitator_note? } */
  ReminiscencePrompt(p, why){
    if (list(p.prompts, "prompts", why, 1, 50)) (p.prompts as unknown[]).forEach((x, i) => text(x, `prompt ${i + 1}`, why));
    if (p.sensory_cues !== undefined && list(p.sensory_cues, "sensory_cues", why, 1, 20)) (p.sensory_cues as unknown[]).forEach((x, i) => text(x, `sensory cue ${i + 1}`, why, 80));
    if (p.facilitator_note !== undefined) text(p.facilitator_note, "facilitator_note", why);
  },
  /** CognitiveTemplate: { template_name, page_count, sections: [{ title, activity_type }], print?: { min_font_pt, margin_in, gutter_in } } */
  CognitiveTemplate(p, why){
    text(p.template_name, "template_name", why, 120);
    if (typeof p.page_count !== "number" || !Number.isInteger(p.page_count) || p.page_count < 1 || p.page_count > 60) why.push("page_count must be a whole number from 1 to 60");
    if (list(p.sections, "sections", why, 1, 30)) (p.sections as unknown[]).forEach((s, i) => {
      if (!isObject(s)) { why.push(`section ${i + 1} must be an object`); return; }
      text(s.title, `section ${i + 1}: title`, why, 120);
      if (typeof s.activity_type !== "string" || !/^[a-z0-9_]{2,40}$/.test(s.activity_type)) why.push(`section ${i + 1}: activity_type must be lowercase words joined by underscores`);
    });
    if (p.print !== undefined) {
      if (!isObject(p.print)) why.push("print must be an object");
      else {
        const pr = p.print;
        if (pr.min_font_pt !== undefined && (typeof pr.min_font_pt !== "number" || pr.min_font_pt < 12 || pr.min_font_pt > 72)) why.push("print.min_font_pt must be 12 to 72");
        if (pr.margin_in !== undefined && (typeof pr.margin_in !== "number" || pr.margin_in < 0.5)) why.push("print.margin_in must be at least 0.5");
        if (pr.gutter_in !== undefined && (typeof pr.gutter_in !== "number" || pr.gutter_in < 0.75)) why.push("print.gutter_in must be at least 0.75");
      }
    }
  }
};

/**
 * Checks one record against the schema.
 * @param raw what the file held at this position
 * @returns the clean record (only the five known fields, tags trimmed) and no reasons, or null and every reason it was refused
 */
export function validateItem(raw: unknown): { item: CatalogItem | null; reasons: string[] } {
  const why: string[] = [];
  if (!isObject(raw)) return { item: null, reasons: ["the record is not an object"] };
  const id = raw.item_id;
  if (typeof id !== "string" || !ID_PATTERN.test(id)) why.push("item_id must be 3 to 64 lowercase letters, digits or underscores");
  if (typeof raw.category !== "string" || !CATEGORIES.includes(raw.category)) why.push(`category must be one of: ${CATEGORIES.join(", ")}`);
  if (typeof raw.cognitive_tier !== "string" || !TIERS.includes(raw.cognitive_tier)) why.push(`cognitive_tier must be one of: ${TIERS.join(", ")}`);
  let tags: string[] = [];
  if (list(raw.tags, "tags", why, 1, 20)) {
    const t = (raw.tags as unknown[]).map(x => typeof x === "string" ? x.trim() : x);
    if (!t.every(x => typeof x === "string" && TAG_PATTERN.test(x))) why.push("each tag must be lowercase letters, digits or underscores (up to 40)");
    else if (new Set(t).size !== t.length) why.push("tags repeat");
    else tags = t as string[];
  }
  if (!isObject(raw.content_payload)) why.push("content_payload must be an object");
  else if (typeof raw.category === "string" && PAYLOAD[raw.category]) PAYLOAD[raw.category](raw.content_payload, why);
  if (why.length) return { item: null, reasons: why };
  return { item: { item_id: id as string, category: raw.category as Category, cognitive_tier: raw.cognitive_tier as Tier, tags, content_payload: raw.content_payload as Payload }, reasons: [] };
}

/**
 * Checks a whole parsed catalog. Records that fail are set aside with their reasons; the rest are kept.
 * @param raw the parsed JSON: the catalog object ({ items: [...] }) or a bare list of records
 * @returns the good records, the refused ones, the file's version and any problems with the file itself
 */
export function validateCatalog(raw: unknown): { items: CatalogItem[]; rejected: Rejected[]; problems: Problem[]; version: string } {
  const problems: Problem[] = [], rejected: Rejected[] = [], items: CatalogItem[] = [];
  let rows: unknown;
  let version = "";
  if (Array.isArray(raw)) rows = raw;
  else if (isObject(raw)) { rows = raw.items; if (typeof raw.catalog_version === "string") version = raw.catalog_version.slice(0, 40); }
  else { problems.push({ code: "shape", message: "The catalog file is not a catalog (it should be an object with a list called items)." }); return { items, rejected, problems, version }; }
  if (!Array.isArray(rows)) { problems.push({ code: "shape", message: "The catalog file has no list called items." }); return { items, rejected, problems, version }; }
  let all: unknown[] = rows;
  if (all.length > MAX_ITEMS) { problems.push({ code: "too-many", message: `The catalog lists ${all.length} records; only the first ${MAX_ITEMS} are read.` }); all = all.slice(0, MAX_ITEMS); }
  const seen = new Set<string>();
  all.forEach((r, index) => {
    const v = validateItem(r);
    const id = isObject(r) && typeof r.item_id === "string" ? r.item_id.slice(0, 64) : "";
    if (v.item && seen.has(v.item.item_id)) { rejected.push({ index, item_id: id, reasons: ["item_id is used by an earlier record"] }); return; }
    if (v.item) { seen.add(v.item.item_id); items.push(v.item); } else rejected.push({ index, item_id: id, reasons: v.reasons });
  });
  if (rejected.length) problems.push({ code: "rejected", message: `${rejected.length} of ${all.length} records were set aside because they did not match the schema.` });
  return { items, rejected, problems, version };
}

/* ---------- 2. The built-in catalog ---------- */

/** What stands in when the file cannot be used: small, gentle and valid, so a packet can still be made. */
export const FALLBACK_ITEMS: readonly CatalogItem[] = Object.freeze([
  { item_id: "fallback_wordsearch_garden", category: "WordSearch", cognitive_tier: "Tier_3_Advanced", tags: ["garden", "large_print"],
    content_payload: { theme: "In the Garden", words: ["ROSE", "TULIP", "DAISY", "SEEDS", "LEAF"], grid_size: { rows: 8, cols: 8 }, directions: ["right", "down"] } },
  { item_id: "fallback_trivia_kitchen", category: "Trivia", cognitive_tier: "Tier_2_Moderate", tags: ["kitchen", "household"],
    content_payload: { framing: "An invitation to talk. Every answer is welcome.",
      questions: [{ prompt: "Bread was often made at home. What did a baker use to flatten the dough?", choices: ["A rolling pin", "A garden hose"], answer: "A rolling pin", follow_up: "Who in the family was the best baker?" }] } }
] as CatalogItem[]);

/* ---------- 3. Reading the file ---------- */

/** Anything with the part of fetch's answer this file uses; tests pass their own. */
export interface Reply { ok: boolean; status: number; text(): Promise<string>; headers?: { get(name: string): string | null }; }
export type Fetcher = (url: string, init: { method: "GET"; credentials: "omit"; redirect: "follow"; cache: "default"; signal?: AbortSignal }) => Promise<Reply>;

export interface Options {
  /** The file's address. The site's own only: another site's address is refused. */
  url?: string;
  /** How long to wait for one try, in milliseconds. */
  timeoutMs?: number;
  /** How many tries before giving up (a refused or damaged file is not retried, only a dropped connection or a server error). */
  attempts?: number;
  /** What to return when the file cannot be used. Defaults to the built-in catalog; pass [] for none. */
  fallback?: readonly unknown[];
  /** The site's own origin, for the same-site rule. The page's own by default. */
  origin?: string;
  /** For tests: stands in for fetch. */
  fetcher?: Fetcher;
  /** For tests: stands in for waiting between tries. */
  pause?: (ms: number) => Promise<void>;
  /** For tests: the clock. */
  now?: () => number;
}

/** The address, resolved against the site, or null when it points at another site or is not an address at all. */
export function sameSiteUrl(url: string, origin: string): string | null {
  try {
    const u = new URL(url, origin || undefined);
    if (origin && u.origin !== origin) return null;
    if (u.protocol !== "https:" && u.protocol !== "http:" && u.protocol !== "file:") return null;
    return u.href;
  } catch { return null; }
}

function describeFailure(e: unknown, status: number): Problem {
  if (status) {
    if (status === 404) return { code: "not-found", message: "The content catalog file was not found on the site." };
    if (status >= 500) return { code: "server", message: `The site answered with an error (${status}) when asked for the content catalog.` };
    return { code: "http", message: `The site answered ${status} when asked for the content catalog.` };
  }
  const name = e && typeof e === "object" ? String((e as { name?: unknown }).name) : "";
  if (name === "AbortError" || name === "TimeoutError") return { code: "timeout", message: "Reading the content catalog took too long." };
  return { code: "offline", message: "The content catalog could not be reached (the computer may be offline, and no saved copy was found)." };
}

/**
 * Reads data/content-catalog.json, parses it and checks every record. Never throws and never rejects:
 * when the real file cannot be used, the result carries the built-in catalog and says why.
 * @param options see Options: url, timeoutMs, attempts, fallback
 * @returns CatalogResult: items, what was refused, what went wrong, and where the content came from
 */
export async function loadContentCatalog(options: Options = {}): Promise<CatalogResult> {
  const now = options.now || (() => Date.now());
  const origin = options.origin !== undefined ? options.origin : (() => { try { return String((globalThis as unknown as { location?: { origin?: string } }).location?.origin || ""); } catch { return ""; } })();
  const problems: Problem[] = [];
  const done = (source: Source, items: CatalogItem[], rejected: Rejected[], version: string, attempts: number): CatalogResult =>
    ({ ok: source === "network", source, degraded: source === "fallback" || rejected.length > 0, items, rejected, problems, version, attempts, loadedAt: now() });
  const stand = (attempts: number): CatalogResult => {
    const given = options.fallback;
    const v = given ? validateCatalog(Array.from(given)) : { items: FALLBACK_ITEMS.map(i => i), rejected: [] as Rejected[], problems: [] as Problem[], version: "built-in" };
    problems.push({ code: "fallback", message: "Cognicopia is using its small built-in catalog until the real one can be read." });
    return done("fallback", v.items, v.rejected, v.version || "built-in", attempts);
  };

  const url = sameSiteUrl(options.url || DEFAULT_URL, origin);
  if (!url) { problems.push({ code: "address", message: "The content catalog must come from this site's own address." }); return stand(0); }
  const fetcher: Fetcher | null = options.fetcher || (typeof (globalThis as unknown as { fetch?: unknown }).fetch === "function" ? ((u, init) => (globalThis as unknown as { fetch: (u: string, i: unknown) => Promise<Reply> }).fetch(u, init)) : null);
  if (!fetcher) { problems.push({ code: "unsupported", message: "This browser cannot read files (no fetch)." }); return stand(0); }
  const pause = options.pause || (ms => new Promise<void>(r => setTimeout(r, ms)));
  const attempts = Math.max(1, Math.min(5, Math.floor(options.attempts ?? DEFAULT_ATTEMPTS)));
  const timeoutMs = Math.max(500, Math.min(60000, Math.floor(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)));

  let body: string | null = null, tried = 0;
  for (let n = 1; n <= attempts && body === null; n++) {
    tried = n;
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : 0;
    let status = 0, retry = true;
    try {
      const res = await fetcher(url, { method: "GET", credentials: "omit", redirect: "follow", cache: "default", signal: ctl ? ctl.signal : undefined });
      status = res.status;
      if (!res.ok) { retry = status >= 500; throw new Error("http " + status); }
      const len = Number(res.headers && res.headers.get("content-length"));
      if (Number.isFinite(len) && len > MAX_BYTES) { retry = false; problems.length = 0; problems.push({ code: "too-large", message: "The content catalog file is larger than expected, so it was not read." }); throw new Error("too large"); }
      const raw = await res.text();
      if (raw.length > MAX_BYTES) { retry = false; problems.length = 0; problems.push({ code: "too-large", message: "The content catalog file is larger than expected, so it was not read." }); throw new Error("too large"); }
      body = raw;
    } catch (e) {
      const last = n === attempts || !retry;
      if (!problems.some(p => p.code === "too-large")) { if (last) problems.push(describeFailure(e, status)); }
      if (last) break;
      await pause(300 * n);
    } finally { if (timer) clearTimeout(timer as ReturnType<typeof setTimeout>); }
  }
  if (body === null) return stand(tried);

  let parsed: unknown;
  try { parsed = JSON.parse(body.replace(/^﻿/, "")); }
  catch { problems.push({ code: "parse", message: "The content catalog file is damaged (it is not valid JSON)." }); return stand(tried); }
  const v = validateCatalog(parsed);
  v.problems.forEach(p => problems.push(p));
  if (!v.items.length) { if (!problems.some(p => p.code === "shape")) problems.push({ code: "empty", message: "The content catalog has no usable records." }); return stand(tried); }
  return done("network", v.items, v.rejected, v.version, tried);
}

/* ---------- 4. Picking from the catalog ---------- */

export interface Filter {
  category?: string;
  /** a tier name (Tier_2_Moderate) or its number (2) */
  tier?: string | number;
  /** every one of these tags must be present */
  tags?: readonly string[];
}
/**
 * The records that match a filter, in the order the file lists them.
 * @param items a result's items
 * @param filter category, tier (name or number) and tags (all must match); an empty filter returns everything
 */
export function selectItems(items: readonly CatalogItem[], filter: Filter = {}): CatalogItem[] {
  const tier = typeof filter.tier === "number" ? TIERS[filter.tier - 1] : filter.tier;
  const tags = (filter.tags || []).map(t => String(t).toLowerCase());
  return items.filter(i => (!filter.category || i.category === filter.category) && (!tier || i.cognitive_tier === tier) && tags.every(t => i.tags.includes(t)));
}
