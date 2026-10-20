/* =====================================================================
   COGNICOPIA CENSUS IMPORT AND WINGS
   An Activity Director's census, read on this computer and turned into
   resident profiles: no upload, no server, no network request.

     - A file in CSV (comma, semicolon, tab or pipe separated, quoted
       fields and line breaks inside quotes included) or JSON (a list of
       objects, or an object holding one) is read and its columns matched
       by name to the fields Cognicopia keeps: alias, preferred name,
       acuity tier, life era, interests, wing, room, and optionally the
       year of birth, hometown and former occupation.
     - Tier is read from the words and numbers a census uses: "Tier 2",
       "Moderate", "GDS 5", "FAST 6a", "Early", "1"... GDS or FAST 3-4
       is Tier 1, 5 is Tier 2, 6-7 is Tier 3 (the clinical matrix's own
       mapping). Anything unreadable becomes Tier 2 and says so.
     - Life era is read as decades (1930s to 1980s): "1940s", "40s",
       "1940-1960", or a birth year.
     - Interests are matched to the profile's own interest list; any that
       do not match are kept as a short note, never dropped.
     - Last names are never kept: a profile holds a preferred name, or only
       an alias. A full date of birth is reduced to its year.
     - A preview says what would be added, updated or skipped before
       anything is written. Rows are matched to a resident already here by
       alias (or preferred name) within the same wing, never across wings.
     - Wings: a profile carries the wing it belongs to (tier1_core.wing),
       and a wing's key is its name in lower case, so Memory Care Unit A
       and Assisted Living Unit B keep separate rosters.

   This service reads and builds; it stores nothing itself. The Packet
   Builder writes the profiles into the encrypted store (secureStore.ts).

   Built into assets/services/censusImport.js (globalThis.CogniCensus)
   by scripts/build-services.mjs.
   @global CogniCensus
   ===================================================================== */

export const VERSION = "1.0.0";
export const PROFILE_SCHEMA = "cognicopia.residentProfile";
export const PROFILE_VERSION = 2;
export const MAX_BYTES = 2000000;
export const MAX_ROWS = 2000;
export const DECADES: readonly string[] = ["1930s", "1940s", "1950s", "1960s", "1970s", "1980s"];

/* ---------- 1. Wings ---------- */
export const WING_NONE = "";
export const wingKey = (name: unknown): string => String(name == null ? "" : name).replace(/[\u0000-\u001F\u007F<>]/g, " ").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 40);
export const cleanWing = (name: unknown): string => String(name == null ? "" : name).replace(/[\u0000-\u001F\u007F<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
interface WingLike { tier1_core?: { wing?: unknown } | null }
/* The wing a profile belongs to, as its key ("" when it has none). */
export const wingOf = (p: WingLike | null | undefined): string => wingKey(p && p.tier1_core ? p.tier1_core.wing : "");
/* Only the residents of one wing. A wing of null means no wing is chosen: every resident is shown. */
export function inWing<T extends WingLike>(profiles: readonly T[], wing: string | null): T[] {
  if (wing == null) return profiles.slice();
  const k = wingKey(wing);
  return profiles.filter(p => wingOf(p) === k);
}
/* The wings found on a set of profiles, and how many residents have none. */
export function wingsIn(profiles: readonly WingLike[]): { wings: { key: string; name: string; count: number }[]; unassigned: number } {
  const by = new Map<string, { key: string; name: string; count: number }>();
  let unassigned = 0;
  profiles.forEach(p => {
    const name = cleanWing(p && p.tier1_core ? p.tier1_core.wing : ""), k = wingKey(name);
    if (!k){ unassigned++; return; }
    const had = by.get(k);
    if (had) had.count++; else by.set(k, { key: k, name, count: 1 });
  });
  return { wings: Array.from(by.values()).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)), unassigned };
}

/* ---------- 2. Reading the file ---------- */
export type Format = "csv" | "json";
export function detectFormat(text: string): Format {
  const t = String(text || "").replace(/^﻿/, "").trimStart();
  return t.startsWith("[") || t.startsWith("{") ? "json" : "csv";
}
function pickDelimiter(firstLine: string): string {
  let best = ",", bestN = -1;
  for (const d of [",", ";", "\t", "|"]){
    let n = 0, q = false;
    for (const ch of firstLine){ if (ch === '"') q = !q; else if (ch === d && !q) n++; }
    if (n > bestN){ best = d; bestN = n; }
  }
  return best;
}
/* A CSV file as rows of cells (RFC 4180: quotes, doubled quotes, line breaks inside quotes). */
export function parseCsv(text: string): string[][] {
  const src = String(text || "").replace(/^﻿/, "");
  const delim = pickDelimiter(src.split(/\r?\n/, 1)[0] || "");
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false, any = false;
  for (let i = 0; i < src.length; i++){
    const ch = src[i];
    if (q){
      if (ch === '"'){ if (src[i + 1] === '"'){ cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"'){ q = true; any = true; }
    else if (ch === delim){ row.push(cur); cur = ""; any = true; }
    else if (ch === "\n" || ch === "\r"){
      if (ch === "\r" && src[i + 1] === "\n") i++;
      if (any || cur.length){ row.push(cur); rows.push(row); }
      row = []; cur = ""; any = false;
    } else { cur += ch; any = true; }
  }
  if (any || cur.length){ row.push(cur); rows.push(row); }
  return rows.map(r => r.map(c => c.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim()));
}
function flat(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(flat).filter(Boolean).join("; ");
  if (typeof v === "object") return Object.keys(v as object).map(k => flat((v as Record<string, unknown>)[k])).filter(Boolean).join("; ");
  return String(v).trim();
}
/* A JSON census as a header row and rows of cells, so both formats go the same way on. */
export function parseJson(text: string): { rows: string[][]; problem: string } {
  let data: unknown;
  try { data = JSON.parse(String(text || "").replace(/^﻿/, "")); } catch { return { rows: [], problem: "This is not valid JSON." }; }
  let list: unknown = data;
  if (data && !Array.isArray(data) && typeof data === "object"){
    const o = data as Record<string, unknown>;
    list = o.residents || o.census || o.rows || o.people || o.data || null;
  }
  if (!Array.isArray(list)) return { rows: [], problem: "The JSON must be a list of residents, or an object holding one (residents, census or rows)." };
  const objs = list.filter(x => x && typeof x === "object" && !Array.isArray(x)) as Record<string, unknown>[];
  if (!objs.length) return { rows: [], problem: "The list has no residents in it." };
  const heads: string[] = [];
  objs.forEach(o => Object.keys(o).forEach(k => { if (heads.indexOf(k) < 0) heads.push(k); }));
  return { rows: [heads].concat(objs.map(o => heads.map(h => flat(o[h])))), problem: "" };
}

/* ---------- 3. Matching columns to fields ---------- */
export type Field = "alias" | "preferredName" | "firstName" | "lastName" | "nickname" | "tier" | "era" | "interests" | "wing" | "unit" | "birthYear" | "hometown" | "occupation";
export const FIELD_LABELS: Readonly<Record<Field, string>> = {
  alias: "Alias", preferredName: "Preferred name", firstName: "First name", lastName: "Last name (never kept)", nickname: "Goes by", tier: "Acuity tier", era: "Life era",
  interests: "Interests", wing: "Wing or unit", unit: "Room", birthYear: "Year of birth", hometown: "Hometown", occupation: "Former occupation"
};
/* Exact header words first (lower case, letters and digits only), then words a header contains. */
const EXACT: Readonly<Record<Field, readonly string[]>> = {
  alias: ["alias", "residentalias", "residentid", "residentcode", "code", "identifier", "pseudonym", "id", "residentnumber", "mrn"],
  preferredName: ["preferredname", "preferred", "name", "residentname", "goesby", "fullname", "displayname"],
  firstName: ["firstname", "first", "givenname", "forename"],
  lastName: ["lastname", "last", "surname", "familyname"],
  nickname: ["nickname", "knownas", "aka"],
  tier: ["tier", "acuity", "acuitytier", "carelevel", "level", "stage", "cognitivetier", "supporttier", "gds", "fast", "supportlevel", "cognitivelevel", "acuitylevel"],
  era: ["era", "lifeera", "decade", "decades", "generation", "birthdecade", "formativeera", "meaningfuldecades", "meaningfulera"],
  interests: ["interests", "hobbies", "likes", "activities", "preferences", "favoriteactivities", "pastimes", "interest"],
  wing: ["wing", "unit", "neighborhood", "neighbourhood", "careunit", "community", "household", "floor", "area", "wingunit", "unitwing"],
  unit: ["room", "roomnumber", "roomno", "bed", "apt", "apartment", "suite", "roombed", "location"],
  birthYear: ["birthyear", "yearofbirth", "born", "dob", "dateofbirth", "birthdate", "yob"],
  hometown: ["hometown", "city", "origin", "grewupin", "homecity", "hometownstate"],
  occupation: ["occupation", "career", "formeroccupation", "job", "profession", "vocation", "trade", "work", "formerjob"]
};
const norm = (h: string): string => String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");
export interface Mapping { fields: Partial<Record<Field, number>>; unmapped: string[]; }
export function mapHeaders(headers: readonly string[]): Mapping {
  const fields: Partial<Record<Field, number>> = {}, used = new Set<number>();
  const order = Object.keys(EXACT) as Field[];
  headers.forEach((h, i) => {
    const n = norm(h);
    for (const f of order){ if (fields[f] == null && EXACT[f].indexOf(n) >= 0){ fields[f] = i; used.add(i); break; } }
  });
  // headers that merely contain a field's word ("Resident tier (GDS)", "Favorite hobbies")
  headers.forEach((h, i) => {
    if (used.has(i)) return;
    const n = norm(h);
    const hit = (words: string[]): boolean => words.some(w => n.indexOf(w) >= 0);
    const tests: [Field, string[]][] = [["tier", ["tier", "acuity", "gds", "fast"]], ["era", ["era", "decade"]], ["interests", ["interest", "hobb"]], ["wing", ["wing", "neighborhood"]],
      ["alias", ["alias"]], ["birthYear", ["birth"]], ["hometown", ["hometown"]], ["occupation", ["occupation", "career"]], ["unit", ["room"]], ["preferredName", ["preferred"]]];
    for (const [f, words] of tests){ if (fields[f] == null && hit(words)){ fields[f] = i; used.add(i); break; } }
  });
  return { fields, unmapped: headers.filter((_, i) => !used.has(i)).filter(h => h.trim()) };
}

/* ---------- 4. Reading the values ---------- */
export type Tier = 1 | 2 | 3;
export function tierFrom(raw: string, header = ""): { tier: Tier | null; note: string } {
  const s = String(raw || "").toLowerCase().trim();
  if (!s) return { tier: null, note: "" };
  const nh = norm(header), staged = /gds|fast/.test(s) || /gds|fast/.test(nh), tiered = /tier|acuity|support/.test(s) || /tier|acuity|support/.test(nh);
  const m = /(?:gds|fast|stage|tier|level)?\s*[:#-]?\s*([1-7])\s*[a-f]?\b/.exec(s);
  const byStage = (n: number): Tier => (n <= 4 ? 1 : n === 5 ? 2 : 3);
  if (m){
    const n = +m[1];
    if (staged) return { tier: byStage(n), note: "" };
    if (n <= 3) return { tier: n as Tier, note: "" };
    if (tiered && n === 4) return { tier: 2, note: "Tier 4 is a group tier, so Tier 2 was used" };
    return { tier: byStage(n), note: "" };                  // 4 to 7 with no label can only be a stage
  }
  if (/\b(mild|early|light|independent|high function|mci|standard|full detail)\b/.test(s)) return { tier: 1, note: "" };
  if (/\b(moderate|middle|mid|medium|guided|assisted)\b/.test(s)) return { tier: 2, note: "" };
  if (/\b(advanced|late|severe|sensory|simplified|total|high support|extensive)\b/.test(s)) return { tier: 3, note: "" };
  return { tier: null, note: "The tier \u201C" + String(raw).trim().slice(0, 30) + "\u201D was not recognised" };
}
export function erasFrom(raw: string): { decades: string[]; dropped: string[] } {
  const s = String(raw || "").toLowerCase();
  const got = new Set<number>(), dropped: string[] = [];
  const add = (d: number): void => { const code = d + "s"; if (DECADES.indexOf(code) >= 0) got.add(d); else if (dropped.indexOf(code) < 0) dropped.push(code); };
  // ranges: 1940-1960, 1940s-1960s, 40s to 60s
  s.replace(/\b((?:19)?\d0)s?\s*(?:-|–|—|to|through|thru)\s*((?:19)?\d0)s?\b/g, (_m, a: string, b: string) => {
    const x = +(a.length === 2 ? "19" + a : a), y = +(b.length === 2 ? "19" + b : b);
    for (let d = Math.min(x, y); d <= Math.max(x, y) && d - Math.min(x, y) <= 90; d += 10) add(d);
    return "";
  });
  s.replace(/\b(19\d)0s?\b/g, (_m, a: string) => { add(+(a + "0")); return ""; });
  s.replace(/\b([2-9]0)'?s\b/g, (_m, a: string) => { add(+("19" + a)); return ""; });
  s.replace(/\b(19\d\d)\b/g, (_m, y: string) => { add(Math.floor(+y / 10) * 10); return ""; });
  return { decades: DECADES.filter(c => got.has(+c.slice(0, 4))), dropped };
}
export const HOBBIES: readonly { code: string; label: string; re: RegExp }[] = [
  { code: "gardening", label: "Gardening and flowers", re: /garden|flower|plant/ },
  { code: "word-puzzles", label: "Word puzzles", re: /crossword|word|puzzle|sudoku/ },
  { code: "jigsaw", label: "Jigsaw puzzles", re: /jigsaw/ },
  { code: "cards", label: "Card games", re: /\bcards?\b|bridge|poker|rummy|solitaire|pinochle|cribbage/ },
  { code: "board-games", label: "Board games", re: /board game|checkers|chess|domino|bingo/ },
  { code: "classic-cars", label: "Classic cars", re: /\bcars?\b|auto|truck|motor/ },
  { code: "sewing", label: "Sewing and quilting", re: /sew|quilt|embroider/ },
  { code: "knitting", label: "Knitting and crochet", re: /knit|crochet/ },
  { code: "fishing", label: "Fishing", re: /fish/ },
  { code: "outdoors", label: "Hunting and the outdoors", re: /hunt|camp|hik|outdoor|nature/ },
  { code: "woodworking", label: "Woodworking", re: /wood|carpent|tools/ },
  { code: "baking", label: "Baking", re: /\bbak|pie\b|bread|cookie/ },
  { code: "cooking", label: "Cooking", re: /cook|kitchen|recipe/ },
  { code: "reading", label: "Reading", re: /read|book|poetry|novel|newspaper/ },
  { code: "singing", label: "Music and singing", re: /sing|music|choir|hymn|piano|radio|band|song/ },
  { code: "dancing", label: "Dancing", re: /danc/ },
  { code: "art", label: "Painting and drawing", re: /paint|draw|\bart\b|craft|sketch/ },
  { code: "birds", label: "Bird watching", re: /bird/ },
  { code: "sports", label: "Watching sports", re: /sport|baseball|football|basketball|hockey|team/ },
  { code: "golf-bowling", label: "Golf and bowling", re: /golf|bowl/ },
  { code: "travel", label: "Travel and road trips", re: /travel|road trip|trip|vacation/ },
  { code: "animals", label: "Pets and animals", re: /\bpets?\b|dog|\bcats?\b|horse|animal|farm/ },
  { code: "collecting", label: "Collecting", re: /collect|stamp|coin/ },
  { code: "faith", label: "Church and faith", re: /church|faith|prayer|bible|worship|spiritual/ }
];
export function interestsFrom(raw: string): { hobbies: { code: string; label: string }[]; other: string[]; all: string[] } {
  const parts = String(raw || "").split(/[;,|\n]|\s\/\s/).map(x => x.replace(/\s+/g, " ").trim().slice(0, 60)).filter(Boolean).slice(0, 40);
  const hobbies: { code: string; label: string }[] = [], other: string[] = [];
  parts.forEach(part => {
    const low = part.toLowerCase();
    const hits = HOBBIES.filter(x => x.re.test(low));
    hits.forEach(h => { if (!hobbies.some(x => x.code === h.code)) hobbies.push({ code: h.code, label: h.label }); });
    if (!hits.length && other.indexOf(part) < 0) other.push(part);
  });
  return { hobbies, other, all: parts };
}
export function birthYearFrom(raw: string): number | null {
  const m = /\b(18[89]\d|19\d\d|20[01]\d)\b/.exec(String(raw || ""));
  return m ? +m[1] : null;
}

/* ---------- 5. Rows ---------- */
export interface CensusRow {
  line: number; alias: string; preferredName: string; nickname: string; tier: Tier; tierGiven: boolean; wing: string; unit: string; decades: string[]; hobbies: { code: string; label: string }[]; other: string[];
  birthYear: number | null; hometown: string; occupation: string; problems: string[]; notes: string[]; skip: boolean;
}
const oneLine = (v: unknown, max: number): string => String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
export interface Analysis {
  format: Format; headers: string[]; mapping: Mapping; rows: CensusRow[]; problem: string; truncated: boolean; droppedLastNames: boolean; droppedDates: boolean;
}
export function analyze(text: string, opts: { wing?: string } = {}): Analysis {
  const base: Analysis = { format: "csv", headers: [], mapping: { fields: {}, unmapped: [] }, rows: [], problem: "", truncated: false, droppedLastNames: false, droppedDates: false };
  const src = String(text || "");
  if (!src.trim()) return Object.assign(base, { problem: "The file is empty." });
  if (src.length > MAX_BYTES) return Object.assign(base, { problem: "The file is larger than 2 MB. Split it by wing and import each part." });
  base.format = detectFormat(src);
  let table: string[][];
  if (base.format === "json"){ const j = parseJson(src); if (j.problem) return Object.assign(base, { problem: j.problem }); table = j.rows; }
  else table = parseCsv(src);
  if (table.length < 2) return Object.assign(base, { problem: "The file needs a header row and at least one resident." });
  base.headers = table[0];
  base.mapping = mapHeaders(base.headers);
  const F = base.mapping.fields;
  if (F.alias == null && F.preferredName == null && F.firstName == null) return Object.assign(base, { problem: "No column holds an alias or a name. Name one of the columns “Alias” or “Preferred name”." });
  const body = table.slice(1);
  if (body.length > MAX_ROWS){ base.truncated = true; body.length = MAX_ROWS; }
  const cell = (r: string[], f: Field): string => (F[f] == null ? "" : String(r[F[f] as number] == null ? "" : r[F[f] as number]));
  body.forEach((r, i) => {
    const line = i + 2;
    if (!/[\p{L}\p{N}]/u.test(r.join(""))) return;          // a blank line, or only separators
    const problems: string[] = [], notes: string[] = [];
    const alias = oneLine(cell(r, "alias"), 32);
    let preferred = oneLine(cell(r, "preferredName"), 40);
    const first = oneLine(cell(r, "firstName"), 40);
    if (!preferred && first) preferred = first;
    if (preferred && cell(r, "lastName")) base.droppedLastNames = true;
    if (!preferred && !alias) problems.push("no alias or name");
    if (!preferred && alias) preferred = alias;
    const t = tierFrom(cell(r, "tier"), F.tier != null ? base.headers[F.tier as number] : "");
    if (t.note) notes.push(t.note);
    if (F.tier != null && !String(cell(r, "tier")).trim()) notes.push("no tier given");
    const eras = erasFrom(cell(r, "era"));
    eras.dropped.forEach(d => notes.push("the " + d + " are outside the 1930s to 1980s and were left out"));
    const it = interestsFrom(cell(r, "interests"));
    const dobRaw = cell(r, "birthYear");
    if (/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}-\d{2}-\d{2}/.test(dobRaw)) base.droppedDates = true;
    const by = birthYearFrom(dobRaw);
    const eraList = eras.decades.slice();
    if (!eraList.length && by){ const d = Math.floor(by / 10) * 10 + "s"; if (DECADES.indexOf(d) >= 0) eraList.push(d); }
    const row: CensusRow = { line, alias, preferredName: preferred, nickname: oneLine(cell(r, "nickname"), 30), tier: t.tier || 2, tierGiven: !!t.tier,
      wing: cleanWing(cell(r, "wing") || opts.wing || ""), unit: oneLine(cell(r, "unit"), 16).toUpperCase(), decades: eraList, hobbies: it.hobbies, other: it.other, birthYear: by,
      hometown: oneLine(cell(r, "hometown"), 60), occupation: oneLine(cell(r, "occupation"), 60), problems, notes, skip: problems.length > 0 };
    base.rows.push(row);
  });
  if (!base.rows.length) base.problem = "No residents were found under the header row.";
  return base;
}

/* ---------- 6. The plan: what would be added, updated or left ---------- */
export type Action = "add" | "update" | "skip" | "duplicate";
export interface PlanItem { row: CensusRow; action: Action; existingId: string; why: string; }
interface Existing { id?: unknown; tier1_core?: { preferredName?: unknown; alias?: unknown; unitNumber?: unknown; wing?: unknown } | null }
const sameName = (a: string, b: string): boolean => !!a && !!b && a.toLowerCase().replace(/\s+/g, " ") === b.toLowerCase().replace(/\s+/g, " ");
export function plan(rows: readonly CensusRow[], existing: readonly Existing[], mode: "update" | "skip" = "update"): PlanItem[] {
  const seen = new Map<string, number>();
  return rows.map(row => {
    if (row.skip) return { row, action: "skip" as Action, existingId: "", why: row.problems.join("; ") };
    const wk = wingKey(row.wing);
    const key = wk + "|" + (row.alias || row.preferredName).toLowerCase();
    if (seen.has(key)) return { row, action: "duplicate" as Action, existingId: "", why: "the same resident as line " + seen.get(key) };
    seen.set(key, row.line);
    const hit = existing.filter(p => wingKey(p.tier1_core ? p.tier1_core.wing : "") === wk).filter(p => {
      const t = p.tier1_core || {};
      return (row.alias && sameName(String(t.alias || ""), row.alias)) || sameName(String(t.preferredName || ""), row.preferredName) || (row.alias && sameName(String(t.preferredName || ""), row.alias));
    })[0];
    if (!hit) return { row, action: "add" as Action, existingId: "", why: "" };
    return mode === "skip" ? { row, action: "skip" as Action, existingId: String(hit.id || ""), why: "already here" } : { row, action: "update" as Action, existingId: String(hit.id || ""), why: "already here" };
  });
}
export function counts(items: readonly PlanItem[]): Record<Action, number> {
  const c: Record<Action, number> = { add: 0, update: 0, skip: 0, duplicate: 0 };
  items.forEach(i => { c[i.action]++; });
  return c;
}

/* ---------- 7. Making a profile ---------- */
const visualFor = (tier: Tier): { contrastMode: string; fontSizeScale: number; lineThicknessPt: number } =>
  tier === 3 ? { contrastMode: "high_contrast", fontSizeScale: 1.3, lineThicknessPt: 3 } : tier === 2 ? { contrastMode: "standard", fontSizeScale: 1.15, lineThicknessPt: 2 } : { contrastMode: "standard", fontSizeScale: 1, lineThicknessPt: 2 };
export function newResidentId(rand: () => number = Math.random, now: number = Date.now()): string {
  return "res-" + now.toString(36) + "-" + rand().toString(36).slice(2, 6);
}
/* A profile from a row. An existing profile keeps everything the census does not carry: only the census fields are written over it. */
export function toProfile(row: CensusRow, id: string, now: Date = new Date(), existing?: Record<string, unknown> | null): Record<string, unknown> {
  const stamp = now.toISOString();
  const prev = (existing || {}) as Record<string, Record<string, unknown> | string | undefined>;
  const t1 = Object.assign({}, (prev.tier1_core as Record<string, unknown>) || {}) as Record<string, unknown>;
  const t2 = Object.assign({}, (prev.tier2_enrichment as Record<string, unknown>) || {}) as Record<string, unknown>;
  const t3 = Object.assign({}, (prev.tier3_deep as Record<string, unknown>) || {}) as Record<string, unknown>;
  t1.preferredName = row.preferredName;
  if (row.nickname) t1.nickname = row.nickname; else if (t1.nickname == null) t1.nickname = "";
  if (row.alias) t1.alias = row.alias; else if (t1.alias == null) t1.alias = "";
  if (row.unit) t1.unitNumber = row.unit; else if (t1.unitNumber == null) t1.unitNumber = "";
  t1.wing = row.wing || cleanWing(t1.wing);
  if (row.tierGiven || t1.cognitiveTier == null){
    t1.cognitiveTier = row.tier;
    t1.visualNeeds = visualFor(row.tier);
    t1.difficulty = { level: row.tier === 1 ? 4 : row.tier === 2 ? 3 : 1, label: row.tier === 1 ? "Challenging" : row.tier === 2 ? "Moderate" : "Very easy", scale: "1 (very easy) to 5 (challenging)" };
  }
  if (row.hobbies.length){ const have = Array.isArray(t1.topHobbies) ? (t1.topHobbies as { code: string }[]) : []; t1.topHobbies = have.concat(row.hobbies.filter(h => !have.some(x => x.code === h.code))); }
  else if (t1.topHobbies == null) t1.topHobbies = [];
  if (row.occupation && !t1.occupation) t1.occupation = { code: "other", label: row.occupation };
  else if (t1.occupation == null) t1.occupation = null;
  if (t1.printNeeds == null) t1.printNeeds = { vision: null, readingLevel: null, motorSkills: null, paper: null, ink: null };
  if (t1.topicsToAvoid == null) t1.topicsToAvoid = { topics: [], eras: [], people: "", places: "", other: "" };
  if (row.decades.length) t2.meaningfulDecades = Array.from(new Set((Array.isArray(t2.meaningfulDecades) ? (t2.meaningfulDecades as string[]) : []).concat(row.decades))).sort();
  else if (t2.meaningfulDecades == null) t2.meaningfulDecades = [];
  if (row.birthYear) t2.birthYear = row.birthYear;
  if (row.hometown) t2.hometown = { environment: null, place: row.hometown }; else if (t2.hometown == null) t2.hometown = { environment: null, place: "" };
  const all = row.hobbies.map(h => h.label).concat(row.other);
  if (all.length) t2.interests = all;
  if (row.other.length){
    const line = "Interests (from the census): " + row.other.join("; ") + ".";
    const cur = String(t3.notes || "");
    if (cur.indexOf(line) < 0) t3.notes = cur ? cur + "\n" + line : line;
  }
  if (t3.notes == null) t3.notes = "";
  if (t3.people == null) t3.people = [];
  if (t3.mentionsInNotes == null) t3.mentionsInNotes = { artists: [], decades: [] };
  return {
    schema: PROFILE_SCHEMA, version: PROFILE_VERSION, id,
    preselectedDeescalationActivity: (prev.preselectedDeescalationActivity as string) || null,
    meta: Object.assign({ completedBy: null }, (prev.meta as Record<string, unknown>) || {}, { source: "Census import (this computer)" }),
    createdAt: typeof prev.createdAt === "string" ? prev.createdAt : stamp, updatedAt: stamp,
    tier1_core: t1, tier2_enrichment: t2, tier3_deep: t3
  };
}

/* ---------- 8. A template to start from ---------- */
export const TEMPLATE_CSV = "Alias,Preferred name,Acuity tier,Life era,Interests,Wing,Room\nResident 101-A,Dorothy,Tier 2,1940s-1950s,gardening; church choir; baking,Memory Care Unit A,101-A\nResident 102-B,Walter,Tier 1,1950s,fishing; baseball; crosswords,Memory Care Unit A,102-B\n";
