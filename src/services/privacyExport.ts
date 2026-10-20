/* =====================================================================
   COGNICOPIA PRIVACY FOR EXPORTS
   Every file or printout that leaves the screen offers the same three
   choices about names, so a file in a shared downloads folder or a
   print queue never has to carry a resident's name:

     alias   Use aliases instead of names (the default). A resident's
             preferred name and nickname are replaced by the alias on
             their profile ("Resident 302-B"); two residents who share a
             name become "a resident", never guessed between.
     remove  Remove names and personal details. As above, and also: room,
             hometown, birth year (kept as a decade), family and pet
             names, free-text notes, and in text: a title followed by a
             name ("Mrs. Alvarez"), e-mail addresses, phone numbers and
             full dates.
     keep    Keep names as they are, for a file the facility handles under
             its own privacy practices.

   This is a safety net under careful staff, not a guarantee: it cannot
   catch a nickname on no profile, a surname written without a title, or a
   distinctive story. It does not make a file "de-identified" in a legal
   sense, and the screens never say it does.

   Pure functions: no storage, no network, no clock.

   Built into assets/services/privacyExport.js (globalThis.CogniPrivacy)
   by scripts/build-services.mjs.
   @global CogniPrivacy
   ===================================================================== */

export const VERSION = "1.0.0";
export type Level = "alias" | "remove" | "keep";
export const LEVELS: readonly { id: Level; label: string; detail: string; suffix: string }[] = [
  { id: "alias", label: "Use aliases instead of names", detail: "Each resident appears as their alias, such as “Resident 302-B”.", suffix: "aliases" },
  { id: "remove", label: "Remove names and personal details", detail: "Aliases, and no room, town, family names, birth dates or free-text notes.", suffix: "no personal details" },
  { id: "keep", label: "Keep names as they are", detail: "For a file your facility handles under its own privacy practices.", suffix: "" }
];
export const DEFAULT_LEVEL: Level = "alias";
export const isLevel = (v: unknown): v is Level => v === "alias" || v === "remove" || v === "keep";
export const levelOf = (v: unknown): Level => (isLevel(v) ? v : DEFAULT_LEVEL);
export const levelSuffix = (v: unknown): string => LEVELS.filter(l => l.id === levelOf(v))[0].suffix;

/* ---------- aliases ---------- */
interface Prof { id?: unknown; tier1_core?: { preferredName?: unknown; nickname?: unknown; alias?: unknown; unitNumber?: unknown } | null; [k: string]: unknown }
const clean = (v: unknown, max: number): string => String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
const CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function shortCode(id: string, length = 4): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++){ h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  let out = "";
  for (let i = 0; i < length; i++){ out += CODE_CHARS[h % CODE_CHARS.length]; h = Math.floor(h / CODE_CHARS.length) || (h ^ 0x9e3779b9) >>> 0; }
  return out;
}
/* The same alias the screens use (secureStore.ts aliasFor): the one on the profile, else "Resident <room>", else "Resident <code>". */
export function aliasOf(p: Prof | null | undefined): string {
  const t1 = (p && p.tier1_core) || {};
  const own = clean(t1.alias, 32); if (own) return own;
  const unit = clean(t1.unitNumber, 16).toUpperCase(); if (unit) return "Resident " + unit;
  const id = typeof (p && p.id) === "string" ? String(p!.id) : "";
  return "Resident " + (id ? shortCode(id) : "(no unit)");
}

/* ---------- names in text ---------- */
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
interface NameHit { name: string; alias: string; }
export function namesOf(profiles: readonly Prof[]): NameHit[] {
  const by = new Map<string, { name: string; aliases: Set<string> }>();
  const add = (n: string, a: string): void => {
    if (n.length < 2) return;
    const k = n.toLowerCase(), had = by.get(k);
    if (had) had.aliases.add(a); else by.set(k, { name: n, aliases: new Set([a]) });
  };
  (profiles || []).forEach(p => {
    const t1 = (p && p.tier1_core) || {}, a = aliasOf(p);
    const full = clean(t1.preferredName, 40), nick = clean(t1.nickname, 30);
    if (full){ add(full, a); const first = full.split(" ")[0]; if (first && first !== full && first.length >= 3) add(first, a); }
    if (nick && nick.length >= 3) add(nick, a);
  });
  const out: NameHit[] = [];
  by.forEach(v => { const list = Array.from(v.aliases); out.push({ name: v.name, alias: list.length === 1 ? list[0] : "a resident" }); });
  return out.sort((a, b) => b.name.length - a.name.length);
}
const TITLED = /\b(?:Mr|Mrs|Ms|Miss|Mx|Dr|Rev|Fr|Sr)\.?\s+[A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+)?/gu;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?:\+?1[-.\s]?)?\(?\b\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g;
const FULLDATE = /\b(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/g;
export interface Scrubbed { text: string; changes: number; }
export function scrubText(text: string, profiles: readonly Prof[], level: Level): Scrubbed {
  let out = String(text == null ? "" : text), changes = 0;
  if (level === "keep") return { text: out, changes };
  for (const n of namesOf(profiles)){
    const re = new RegExp("(?<![\\p{L}\\p{N}])" + esc(n.name) + "(?![\\p{L}\\p{N}])", "giu");
    out = out.replace(re, () => { changes++; return n.alias; });
  }
  if (level === "remove"){
    for (const [re, to] of [[TITLED, "[name removed]"], [EMAIL, "[e-mail removed]"], [PHONE, "[phone removed]"], [FULLDATE, "[date removed]"]] as [RegExp, string][]){
      out = out.replace(re, () => { changes++; return to; });
    }
  }
  return { text: out, changes };
}

/* ---------- a profile or a roster ---------- */
const decadeOf = (y: unknown): string => { const n = Number(y); return n >= 1880 && n <= 2020 ? Math.floor(n / 10) * 10 + "s" : ""; };
/* A copy of a profile for a file. The original is never changed. */
export function scrubProfile<T extends Prof>(p: T, level: Level): T {
  const copy = JSON.parse(JSON.stringify(p)) as Record<string, Record<string, unknown>> & Prof;
  if (level === "keep") return copy as T;
  const alias = aliasOf(p), t1 = (copy.tier1_core = copy.tier1_core || {}) as Record<string, unknown>;
  t1.preferredName = alias; t1.nickname = ""; t1.alias = alias;
  if (level === "alias") return copy as T;
  t1.unitNumber = "";
  const t2 = (copy.tier2_enrichment || {}) as Record<string, unknown>;
  if (t2.birthYear != null){ const d = decadeOf(t2.birthYear); t2.birthDecade = d; delete t2.birthYear; }
  delete t2.age;
  if (t2.hometown && typeof t2.hometown === "object") (t2.hometown as Record<string, unknown>).place = "";
  const t3 = (copy.tier3_deep || {}) as Record<string, unknown>;
  t3.notes = ""; t3.mentionsInNotes = { artists: [], decades: [] };
  if (Array.isArray(t3.people)) t3.people = (t3.people as Record<string, unknown>[]).map(x => ({ name: "", relationship: x.relationship || null, isPet: !!x.isPet, passedAway: !!x.passedAway }));
  const av = (t1.topicsToAvoid || null) as Record<string, unknown> | null;
  if (av){ av.people = ""; av.places = ""; av.other = ""; }
  const mil = (t2.military || null) as Record<string, unknown> | null;
  if (mil) mil.talkingAboutIt = mil.talkingAboutIt || null;
  copy.meta = Object.assign({}, copy.meta || {}, { scrubbed: level });
  return copy as T;
}
export function scrubRoster<T extends Prof>(list: readonly T[], level: Level): T[] { return (list || []).map(p => scrubProfile(p, level)); }

/* ---------- the same choice on every page ---------- */
const attr = (s: string): string => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
/* The three radio buttons, as HTML each page styles itself (class pv-choice, pv-opt). name is the radio group name. */
export function choiceHtml(name: string, current: unknown, legend = "Names in this file"): string {
  const cur = levelOf(current);
  return '<fieldset class="pv-choice" data-privacy-choice="' + attr(name) + '"><legend>' + attr(legend) + "</legend>" +
    LEVELS.map(l => '<label class="pv-opt"><input type="radio" name="' + attr(name) + '" value="' + l.id + '"' + (l.id === cur ? " checked" : "") + "><span><b>" + attr(l.label) + "</b><small>" + attr(l.detail) + "</small></span></label>").join("") + "</fieldset>";
}
