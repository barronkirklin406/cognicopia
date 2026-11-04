/* Packet builder extensions: multi-generational life mapping and difficulty auto-tuning.

   extendProfile() widens a resident's input beyond one generation: children, grandchildren and great-grandchildren by name, the streets
   of the neighborhood they grew up in, and the regional words they use (pop or soda, davenport or couch). Those become the details a
   sheet is made from (names, places, word-search words) without any re-typing.

   autoTune() reads the completion rates staff logged for a resident and nudges how the sheets are set: print size (18 to 24 pt), line
   height and puzzle grid size, a step at a time, never below the stage's own floor and never beyond the stage's own ceiling. It only
   changes how much a sheet asks for. It reads a pattern in what staff recorded; it is not an assessment.
   Records are kept under cognicopia_studio_completion_<resident> in the builder's own storage; nothing is sent anywhere. */

const clip = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f{}<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const list = (v, n = 60, max = 12) => { const raw = Array.isArray(v) ? v : String(v == null ? "" : v).split(/[,;\n]/), seen = new Set(), out = []; for (const x of raw) { const t = clip(x, n), k = t.toLowerCase(); if (t && !seen.has(k)) { seen.add(k); out.push(t); } if (out.length >= max) break; } return out; };
export const VERSION = "1.0.0";

/* ---------- 1. the wider biographical schema ---------- */
export const MULTIGEN_FIELDS = Object.freeze(["children", "grandchildren", "greatGrandchildren", "neighborhoodStreets", "regionalTerms"]);
const STREET = /\b(street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|court|ct|way|place|pl)\b\.?/gi;
/* A street as people say it: "Maple" for "412 Maple Street" (house numbers are never kept). */
export const streetName = (s) => clip(String(s).replace(/^\s*\d+\s*/, "").replace(STREET, ""), 30);
export function extendProfile(raw) {
  const r = raw && typeof raw === "object" ? raw : {}, out = Object.assign({}, r);
  out.children = list(r.children, 40, 10); out.grandchildren = list(r.grandchildren, 40, 16); out.greatGrandchildren = list(r.greatGrandchildren, 40, 16);
  out.neighborhoodStreets = list((Array.isArray(r.neighborhoodStreets) ? r.neighborhoodStreets : String(r.neighborhoodStreets || "").split(/[,;\n]/)).map(streetName), 30, 8);
  out.regionalTerms = list(r.regionalTerms, 40, 10);
  const family = [...out.children, ...out.grandchildren, ...out.greatGrandchildren];
  out.familyNames = list([...(Array.isArray(r.familyNames) ? r.familyNames : String(r.familyNames || "").split(/[,;\n]/)), ...family], 40, 24);
  out.nostalgiaAnchors = list([...(Array.isArray(r.nostalgiaAnchors) ? r.nostalgiaAnchors : String(r.nostalgiaAnchors || "").split(/[,;\n]/)), ...out.neighborhoodStreets.map((s) => s + " Street")], 60, 12);
  return out;
}
/* The deep-customization settings these details give a sheet: street and regional words for the word search, and a note in the resident's own vocabulary. */
export function deepFromProfile(p) {
  const e = extendProfile(p), words = [...e.neighborhoodStreets, ...e.regionalTerms, ...e.grandchildren].filter((w) => w.replace(/[^A-Za-z]/g, "").length >= 3);
  return { words: words.slice(0, 8), places: e.neighborhoodStreets.slice(0, 4).map((s) => s + " Street"), notes: e.regionalTerms.length ? ["Many people where you grew up said " + e.regionalTerms.slice(0, 2).join(" and ") + "."] : [] };
}

/* ---------- 2. completion log and auto-tuning ---------- */
export const TIER_LIMITS = Object.freeze({ 1: { minPt: 18, maxPt: 22, minGrid: 7, maxGrid: 10 }, 2: { minPt: 20, maxPt: 24, minGrid: 6, maxGrid: 8 }, 3: { minPt: 22, maxPt: 24, minGrid: 5, maxGrid: 6 } });
const KEY = "cognicopia_studio_completion_";
const rid = (v) => (/^[A-Za-z0-9_-]{1,60}$/.test(String(v)) ? String(v) : "");
export function readCompletions(store, id) { try { const j = JSON.parse(store.getItem(KEY + rid(id)) || "null"); return (j && Array.isArray(j.entries) ? j.entries : []).map((e) => ({ at: clip(e.at, 30), completion: Math.max(0, Math.min(1, Number(e.completion) || 0)), grid: Math.max(0, Math.min(30, Math.round(Number(e.grid) || 0))), fontPt: Math.max(0, Math.min(40, Number(e.fontPt) || 0)) })).filter((e) => e.at); } catch (e) { return []; } }
/* completion: the share of an activity finished, 0 to 1 (a word search with 4 of 5 words found is 0.8). */
export function logCompletion(store, residentId, entry) {
  const id = rid(residentId); if (!id) throw new RangeError("choose a resident first"); const c = Number(entry && entry.completion); if (!(c >= 0 && c <= 1)) throw new RangeError("completion is a number from 0 to 1");
  const all = readCompletions(store, id).concat({ at: new Date((entry && entry.at) || Date.now()).toISOString(), completion: c, grid: Math.round(Number(entry && entry.grid) || 0), fontPt: Number(entry && entry.fontPt) || 0 }).slice(-60);
  store.setItem(KEY + id, JSON.stringify({ v: 1, residentId: id, entries: all })); return all;
}
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
/* base: the settings in use now { tier, fontPt, lineHeight, grid }. Returns the next settings and why. Needs at least 3 completions. */
export function autoTune(entries, base) {
  const b = Object.assign({ tier: 2, fontPt: 20, lineHeight: 1.4, grid: 7 }, base), L = TIER_LIMITS[b.tier] || TIER_LIMITS[2], recent = (Array.isArray(entries) ? entries : []).slice(-5), clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const cur = { tier: b.tier, fontPt: clampN(b.fontPt, 18, 24), lineHeight: clampN(b.lineHeight, 1.3, 1.7), grid: clampN(b.grid, L.minGrid, L.maxGrid) };
  if (recent.length < 3) return Object.assign({}, cur, { action: "hold", reason: "Log at least three finished activities and the settings will adjust.", rate: null, n: recent.length });
  const rate = Math.round(mean(recent.map((e) => e.completion)) * 100) / 100;
  if (rate < 0.5) return { tier: b.tier, fontPt: clampN(cur.fontPt + 2, Math.max(18, L.minPt), Math.min(24, L.maxPt)), lineHeight: Math.round(clampN(cur.lineHeight + 0.1, 1.3, 1.7) * 100) / 100, grid: clampN(cur.grid - 1, L.minGrid, L.maxGrid), action: "easier", reason: "About " + Math.round(rate * 100) + "% of recent activities were finished, so print is larger, lines are looser and the puzzle grid is smaller.", rate, n: recent.length };
  if (rate >= 0.9) return { tier: b.tier, fontPt: clampN(cur.fontPt - 2, Math.max(18, L.minPt), Math.min(24, L.maxPt)), lineHeight: Math.round(clampN(cur.lineHeight - 0.1, 1.3, 1.7) * 100) / 100, grid: clampN(cur.grid + 1, L.minGrid, L.maxGrid), action: "fuller", reason: "About " + Math.round(rate * 100) + "% of recent activities were finished, so the puzzle grid grows by one and print and spacing ease back a little.", rate, n: recent.length };
  return Object.assign({}, cur, { action: "hold", reason: "About " + Math.round(rate * 100) + "% were finished: the settings are working.", rate, n: recent.length });
}
/* The caps the reminiscence template reads (ctx.calibration), from tuned settings. */
export const calibrationFrom = (t) => ({ minFontPt: t.fontPt, maxGrid: t.grid, maxWords: Math.max(3, t.grid - 3), lineHeight: t.lineHeight });
