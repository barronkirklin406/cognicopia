/* Cognicopia Studio core: the logic behind the three Studio tools.

     #/tracking   Longitudinal Cognitive Tracking and Recommendations   (staff, one resident at a time)
     #/planner    12-Month Therapeutic Engagement and Seasonal Planner  (facility)
     #/journal    Resident Life Narrative and Breakthrough Journal      (staff, one resident at a time)

   Pure logic, no page: every function takes the storage it should use, so the whole thing is tested in Node and runs in the Packet
   Builder against its encrypted store. Nothing is sent anywhere. Each tool keeps its own records under its own key, so one tool can
   never read or overwrite another's (see docs/studio-storage.md):

     cognicopia_studio_tracking_<resident>   monthly engagement, frustration and fatigue
     cognicopia_studio_journal_<resident>    breakthroughs and calming moments
     cognicopia_studio_planner_<year>        the facility's annual matrix and its bundle plan
     cognicopia_resident_insights_<resident> keywords and anecdotes fed back from the journal (beside the profile, never inside it)
     cognicopia_studio_meta                  the schema version

   The tracking engine reads patterns in what staff recorded. It supports staff judgment; it is not an assessment or a diagnosis. */

import { HOLIDAYS, seasonOf, SeasonalPackAgent } from "./pillar1-production-agents.js";
import { PrivacySentinel } from "./pillar3-qa-agents.js";

export const SCHEMA_VERSION = 1;
export const KEYS = Object.freeze({ tracking: "cognicopia_studio_tracking_", journal: "cognicopia_studio_journal_", planner: "cognicopia_studio_planner_", insights: "cognicopia_resident_insights_", meta: "cognicopia_studio_meta", profile: "cognicopia_resident_" });
export const SCHEMAS = Object.freeze({ tracking: "cognicopia.studio.tracking", journal: "cognicopia.studio.journal", planner: "cognicopia.studio.planner", insights: "cognicopia.residentInsights" });
export const STAGES = Object.freeze([{ code: "early", label: "Early stage", next: "middle" }, { code: "middle", label: "Middle stage", next: "late" }, { code: "late", label: "Late stage", next: null }]);
export const TRIGGERS = Object.freeze(["Noise", "Glare or poor light", "Time of day", "An unfamiliar task", "Too many steps", "Small print", "A crowded room", "Discomfort or pain", "Hunger or thirst", "Tiredness", "A change of routine", "Something else"]);
export const SCALE = Object.freeze({ engagement: ["Not interested", "Watched", "Took part a little", "Took part well", "Eagerly took part"], frustration: ["None", "A little", "Some", "Quite a lot", "Very much"], fatigue: ["None", "A little", "Some", "Quite a lot", "Very much"] });
const ID = /^[A-Za-z0-9_-]{1,60}$/;
const clip = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const uid = (p) => p + Math.random().toString(36).slice(2, 10);

/* ---------- storage: one guarded reader and writer for everything ---------- */
export function readJson(store, key, fallback) { try { const t = store.getItem(key); if (t == null) return fallback; const v = JSON.parse(t); return v == null ? fallback : v; } catch (e) { return fallback; } }
export function writeJson(store, key, value) { try { store.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; } }
const rid = (v) => (ID.test(String(v)) ? String(v) : "");
export const monthKey = (d) => { const x = d instanceof Date ? d : new Date(d); return isNaN(x) ? "" : x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0"); };
const monthOk = (m) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(m)) ? String(m) : "");
const monthIndex = (m) => { const [y, mo] = m.split("-").map(Number); return y * 12 + (mo - 1); };
export const monthsBack = (today, n) => { const out = [], i0 = monthIndex(monthKey(today)); for (let i = n - 1; i >= 0; i--) { const k = i0 - i; out.push(Math.floor(k / 12) + "-" + String((k % 12) + 1).padStart(2, "0")); } return out; };
export const monthLabel = (m) => { const [y, mo] = String(m).split("-").map(Number); return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][(mo || 1) - 1] + " " + y; };

/* ---------- the schema update: run at start, safe to run again ---------- */
/* Version 0 is "nothing recorded". Version 1 adds the three Studio stores and the insights record. A record written by a future version is left alone. */
export function migrate(store, now = new Date()) {
  const meta = readJson(store, KEYS.meta, null), report = { from: meta && meta.v || 0, to: SCHEMA_VERSION, repaired: 0, kept: 0 };
  if (meta && meta.v > SCHEMA_VERSION) return Object.assign(report, { to: meta.v, skipped: "written by a newer version" });
  for (let i = 0; i < (store.length || 0); i++) {
    const k = store.key(i); if (!k) continue;
    const kind = k.startsWith(KEYS.tracking) ? "tracking" : k.startsWith(KEYS.journal) ? "journal" : k.startsWith(KEYS.planner) ? "planner" : k.startsWith(KEYS.insights) ? "insights" : null; if (!kind) continue;
    const raw = readJson(store, k, null); const fixed = kind === "tracking" ? normalizeTracking(raw, k.slice(KEYS.tracking.length)) : kind === "journal" ? normalizeJournal(raw, k.slice(KEYS.journal.length)) : kind === "planner" ? normalizePlanner(raw, k.slice(KEYS.planner.length)) : normalizeInsights(raw, k.slice(KEYS.insights.length));
    if (JSON.stringify(fixed) !== JSON.stringify(raw)) { writeJson(store, k, fixed); report.repaired++; } else report.kept++;
  }
  writeJson(store, KEYS.meta, { v: SCHEMA_VERSION, migratedAt: new Date(now).toISOString() }); return report;
}

/* ---------- 1. tracking ---------- */
export function normalizeEntry(e) {
  const o = e && typeof e === "object" ? e : {}, m = monthOk(o.month); if (!m) return null;
  const stage = STAGES.some((s) => s.code === o.stage) ? o.stage : "middle";
  return { id: typeof o.id === "string" && ID.test(o.id) ? o.id : uid("t"), month: m, stage, engagement: int(o.engagement, 0, 4, 2), frustration: int(o.frustration, 0, 4, 0), fatigue: int(o.fatigue, 0, 4, 0), triggers: [...new Set((Array.isArray(o.triggers) ? o.triggers : []).map(String).filter((t) => TRIGGERS.includes(t)))], note: clip(o.note, 300) };
}
export function normalizeTracking(raw, residentId) {
  const r = raw && typeof raw === "object" ? raw : {}, byMonth = new Map();
  (Array.isArray(r.entries) ? r.entries : []).map(normalizeEntry).filter(Boolean).forEach((e) => byMonth.set(e.month, e));   // one entry a month: the last one wins
  return { schema: SCHEMAS.tracking, v: SCHEMA_VERSION, residentId: rid(residentId), entries: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-60) };
}
export const readTracking = (store, id) => normalizeTracking(readJson(store, KEYS.tracking + rid(id), null), id);
export function saveEntry(store, residentId, entry) {
  const id = rid(residentId); if (!id) throw new RangeError("choose a resident first"); const e = normalizeEntry(entry); if (!e) throw new RangeError("choose a month");
  const log = readTracking(store, id); log.entries = log.entries.filter((x) => x.month !== e.month).concat(e); const out = normalizeTracking(log, id);
  if (!writeJson(store, KEYS.tracking + id, out)) throw new Error("the entry could not be saved"); return out;
}
export function removeEntry(store, residentId, month) { const id = rid(residentId), log = readTracking(store, id); log.entries = log.entries.filter((x) => x.month !== month); return writeJson(store, KEYS.tracking + id, normalizeTracking(log, id)) ? log : null; }
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0), r2 = (x) => Math.round(x * 100) / 100;
/* The slope per month, from the months themselves, so a missing month does not bend the line. */
function slope(points) { const n = points.length; if (n < 2) return 0; const mx = mean(points.map((p) => p[0])), my = mean(points.map((p) => p[1])); let num = 0, den = 0; for (const [x, y] of points) { num += (x - mx) * (y - my); den += (x - mx) * (x - mx); } return den ? num / den : 0; }
const trendOf = (s, flatBelow = 0.15) => (s > flatBelow ? "rising" : s < -flatBelow ? "falling" : "steady");
const THRESH = Object.freeze({ highFatigue: 2.5, highFrustration: 2.5, lowEngagement: 2, goodEngagement: 3, calm: 1.5 });
/* entries: tracking entries. today: the date the answer is for. Windows of 3, 6 and 12 months; a recommendation needs at least 3 months logged in the window it rests on. */
export function analyze(entries, today = new Date()) {
  const list = (Array.isArray(entries) ? entries : []).map(normalizeEntry).filter(Boolean).sort((a, b) => a.month.localeCompare(b.month)), now = monthIndex(monthKey(today)), windows = {};
  for (const w of [3, 6, 12]) {
    const sub = list.filter((e) => { const d = now - monthIndex(e.month); return d >= 0 && d < w; }), pts = (k) => sub.map((e) => [monthIndex(e.month), e[k]]);
    const trig = new Map(); sub.forEach((e) => e.triggers.forEach((t) => trig.set(t, (trig.get(t) || 0) + 1)));
    windows[w] = { months: w, n: sub.length, engagement: r2(mean(sub.map((e) => e.engagement))), frustration: r2(mean(sub.map((e) => e.frustration))), fatigue: r2(mean(sub.map((e) => e.fatigue))), engagementSlope: r2(slope(pts("engagement"))), frustrationSlope: r2(slope(pts("frustration"))), fatigueSlope: r2(slope(pts("fatigue"))), triggers: [...trig.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([t, n]) => ({ trigger: t, months: n })) };
    windows[w].trends = { engagement: trendOf(windows[w].engagementSlope), frustration: trendOf(windows[w].frustrationSlope), fatigue: trendOf(windows[w].fatigueSlope) };
  }
  const cur = list.length ? list[list.length - 1] : null, stage = cur ? cur.stage : null, idx = STAGES.findIndex((s) => s.code === stage), w3 = windows[3], w6 = windows[6];
  const NOTE = "A pattern in what staff recorded, to talk over with the care team. It is not an assessment.";
  let rec = { type: "insufficient", from: stage, to: null, reason: "Log at least three months in the last three to see a pattern.", banner: "", note: NOTE };
  const tired3 = w3.n >= 3 && (w3.fatigue >= THRESH.highFatigue || w3.frustration >= THRESH.highFrustration) && w3.engagement <= THRESH.lowEngagement + 0.5 && w3.trends.fatigue !== "falling";
  const tired6 = w6.n >= 4 && w6.fatigue >= THRESH.highFatigue && w6.trends.fatigue === "rising" && w6.engagement <= THRESH.lowEngagement + 0.5;
  const well3 = w3.n >= 3 && w3.engagement >= THRESH.goodEngagement && w3.fatigue <= THRESH.calm && w3.frustration <= THRESH.calm && w3.trends.engagement !== "falling";
  if (stage && (tired3 || tired6)) {
    const to = idx >= 0 && STAGES[idx].next ? STAGES[idx].next : null, why = [w3.fatigue >= THRESH.highFatigue ? "fatigue has averaged " + w3.fatigue + " of 4" : "", w3.frustration >= THRESH.highFrustration ? "frustration has averaged " + w3.frustration + " of 4" : "", "engagement has averaged " + w3.engagement + " of 4"].filter(Boolean).join(", ");
    rec = { type: "gentler", from: stage, to, sustained: tired6 && tired3 ? "3 and 6 months" : tired3 ? "3 months" : "6 months", reason: "Over the last " + (tired3 ? 3 : 6) + " months, " + why + (w3.triggers.length ? ". Most often noted: " + w3.triggers.map((t) => t.trigger.toLowerCase()).join(", ") : "") + ".", note: NOTE,
      banner: to ? "Transition Recommendation: sheets one stage gentler (" + STAGES.find((s) => s.code === to).label + ") may suit better. Larger print, fewer pieces and more rest between activities." : "Transition Recommendation: this is already the gentlest stage. Consider comfort-focused, sensory activities and a conversation with the care team about what would help." };
  } else if (stage && well3) {
    const to = idx > 0 ? STAGES[idx - 1].code : null;
    rec = { type: to ? "step-up" : "continue", from: stage, to, sustained: "3 months", note: NOTE, reason: "Over the last 3 months, engagement has averaged " + w3.engagement + " of 4, with little fatigue (" + w3.fatigue + ") or frustration (" + w3.frustration + ").",
      banner: to ? "Transition Recommendation: things are going well. A trial of the " + STAGES.find((s) => s.code === to).label + " sheets, one activity at a time, may offer more variety." : "Things are going well at the earliest stage. Keep the current activities and add variety they enjoy." };
  } else if (w3.n >= 3) rec = { type: "hold", from: stage, to: null, reason: "The last 3 months are mixed: no sustained fatigue and no sustained ease.", banner: "", note: NOTE };
  return { windows, current: cur, stage, recommendation: rec, months: list.length };
}

/* ---------- 3. the journal ---------- */
const STOP = new Set("a about after again all also am an and any are as at be because been before being but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours out over own same she should so some such than that the their theirs them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours said says told asked started began today yesterday resident staff day morning afternoon evening time really got get went came come went like liked something someone".split(/\s+/));
export function keywordsOf(text, max = 8) {
  const counts = new Map(); for (const w of String(text == null ? "" : text).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z][a-z'-]{2,24}/g) || []) { const k = w.replace(/^['-]+|['-]+$/g, ""); if (k.length >= 3 && !STOP.has(k) && !/^\d/.test(k)) counts.set(k, (counts.get(k) || 0) + 1); }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(([k]) => k);
}
export const JOURNAL_KINDS = Object.freeze([{ code: "breakthrough", label: "A breakthrough", hint: "Something new or unexpected: a word, a memory, a skill, a smile." }, { code: "calming", label: "A calming moment", hint: "What helped them settle, and how." }]);
const sentinel = new PrivacySentinel();
export function normalizeJournalEntry(e) {
  const o = e && typeof e === "object" ? e : {}, at = new Date(o.at), text = sentinel.redact(clip(o.text, 600)).text; if (!text) return null;
  return { id: typeof o.id === "string" && ID.test(o.id) ? o.id : uid("j"), at: isNaN(at) ? new Date().toISOString() : at.toISOString(), kind: JOURNAL_KINDS.some((k) => k.code === o.kind) ? o.kind : "breakthrough", text, context: sentinel.redact(clip(o.context, 200)).text, keywords: Array.isArray(o.keywords) && o.keywords.length ? o.keywords.map((k) => clip(k, 24).toLowerCase()).filter(Boolean).slice(0, 8) : keywordsOf(text) };
}
export function normalizeJournal(raw, residentId) { const r = raw && typeof raw === "object" ? raw : {}; return { schema: SCHEMAS.journal, v: SCHEMA_VERSION, residentId: rid(residentId), entries: (Array.isArray(r.entries) ? r.entries : []).map(normalizeJournalEntry).filter(Boolean).sort((a, b) => a.at.localeCompare(b.at)).slice(-500) }; }
export const readJournal = (store, id) => normalizeJournal(readJson(store, KEYS.journal + rid(id), null), id);
export function saveJournalEntry(store, residentId, entry) {
  const id = rid(residentId); if (!id) throw new RangeError("choose a resident first"); const e = normalizeJournalEntry(entry); if (!e) throw new RangeError("write what happened");
  const j = readJournal(store, id); j.entries.push(e); const out = normalizeJournal(j, id); if (!writeJson(store, KEYS.journal + id, out)) throw new Error("the entry could not be saved"); return { entry: e, journal: out };
}
export function normalizeInsights(raw, residentId) {
  const r = raw && typeof raw === "object" ? raw : {}, kw = {}; if (r.keywords && typeof r.keywords === "object") for (const [k, n] of Object.entries(r.keywords)) { const c = clip(k, 24).toLowerCase(); if (c && Number(n) > 0) kw[c] = Math.min(9999, Math.round(Number(n))); }
  const top = Object.entries(kw).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 60);
  return { schema: SCHEMAS.insights, v: SCHEMA_VERSION, residentId: rid(residentId), keywords: Object.fromEntries(top), anecdotes: (Array.isArray(r.anecdotes) ? r.anecdotes : []).map((a) => ({ at: clip(a && a.at, 30), kind: JOURNAL_KINDS.some((k) => k.code === (a && a.kind)) ? a.kind : "breakthrough", text: clip(a && a.text, 240) })).filter((a) => a.text).slice(-25), updatedAt: clip(r.updatedAt, 30) };
}
export const readInsights = (store, id) => normalizeInsights(readJson(store, KEYS.insights + rid(id), null), id);
/* The feed: a newly logged entry adds its keywords and its anecdote to the resident's insights, and, if their saved profile has a deep section, a short keyword list there too (nothing else in the profile is touched). */
export function feedProfile(store, residentId, entry, now = new Date()) {
  const id = rid(residentId), e = normalizeJournalEntry(entry); if (!id || !e) return { ok: false };
  const ins = readInsights(store, id); for (const k of e.keywords) ins.keywords[k] = (ins.keywords[k] || 0) + 1;
  ins.anecdotes.push({ at: e.at, kind: e.kind, text: e.text }); ins.updatedAt = new Date(now).toISOString(); const out = normalizeInsights(ins, id);
  const wrote = writeJson(store, KEYS.insights + id, out); let profileUpdated = false;
  const p = readJson(store, KEYS.profile + id, null);
  if (p && p.schema === "cognicopia.residentProfile" && p.tier3_deep && typeof p.tier3_deep === "object") { p.tier3_deep.lifeNarrative = { keywords: Object.keys(out.keywords).slice(0, 20), updatedAt: out.updatedAt }; profileUpdated = writeJson(store, KEYS.profile + id, p); }
  const p2 = readJson(store, KEYS.profile + id, null), known = [(p2 && p2.tier1_core && p2.tier1_core.preferredName) || "", ...((p2 && p2.tier3_deep && p2.tier3_deep.people) || []).map((x) => x && x.name)];
  const mentions = extractMentions(e.text + " " + e.context, known), applied = applyMentions(store, id, mentions);
  return { ok: wrote, keywords: e.keywords, profileUpdated: profileUpdated || applied.added.length > 0, insights: out, mentions: applied.added };
}

/* ---------- names and pets mentioned in a note (offline) ---------- */
const REL_CODE = { son: "son", daughter: "daughter", grandson: "grandchild", granddaughter: "grandchild", grandchild: "grandchild", husband: "spouse", wife: "spouse", sister: "sibling", brother: "sibling", mother: "parent", father: "parent", friend: "friend", neighbor: "neighbor", neighbour: "neighbor", nephew: "other-family", niece: "other-family", cousin: "other-family" };
const REL_LABEL = { spouse: "Husband or wife", son: "Son", daughter: "Daughter", grandchild: "Grandchild", sibling: "Brother or sister", parent: "Mother or father", "other-family": "Other family", friend: "Friend", neighbor: "Neighbor", "pet-dog": "Pet dog", "pet-cat": "Pet cat", "pet-other": "Other pet", other: "Someone else" };
const NOT_NAMES = new Set("monday tuesday wednesday thursday friday saturday sunday january february march april june july august september october november december god lord jesus christmas easter thanksgiving mass grace amazing staff nurse doctor mom dad mama papa granny nana".split(" "));
const NAME = "([A-Z][a-z]{2,15})";
const PET_KIND = { dog: "pet-dog", puppy: "pet-dog", cat: "pet-cat", kitten: "pet-cat", horse: "pet-other", pony: "pet-other", bird: "pet-other", parakeet: "pet-other", canary: "pet-other", rabbit: "pet-other" };
export function extractMentions(text, known) {
  const t = String(text == null ? "" : text), people = [], pets = [], seen = new Set((known || []).map((k) => String(k).toLowerCase()));
  const add = (list, name, rel) => { const k = name.toLowerCase(); if (NOT_NAMES.has(k) || seen.has(k)) return; seen.add(k); list.push({ name, rel }); };
  for (const m of t.matchAll(new RegExp("\\b(?:dog|puppy|cat|kitten|horse|pony|bird|parakeet|canary|rabbit)\\s+(?:named|called)\\s+" + NAME, "g"))) add(pets, m[1], PET_KIND[m[0].split(/\s+/)[0].toLowerCase()] || "pet-other");
  for (const m of t.matchAll(new RegExp("\\b" + NAME + "\\s+the\\s+(dog|puppy|cat|kitten|horse|pony|bird|parakeet|canary|rabbit)\\b", "g"))) add(pets, m[1], PET_KIND[m[2].toLowerCase()]);
  for (const m of t.matchAll(new RegExp("\\b(?:[Hh]er|[Hh]is|[Tt]heir|[Mm]y|[Tt]he)\\s+(dog|puppy|cat|kitten|horse|pony|bird|parakeet|canary|rabbit)\\s+" + NAME, "g"))) add(pets, m[2], PET_KIND[m[1].toLowerCase()]);
  for (const m of t.matchAll(new RegExp("\\b(?:[Hh]er|[Hh]is|[Tt]heir|[Mm]y|[Tt]he)\\s+(son|daughter|grandson|granddaughter|grandchild|husband|wife|sister|brother|mother|father|friend|neighbou?r|nephew|niece|cousin)\\s+" + NAME, "g"))) add(people, m[2], REL_CODE[m[1].toLowerCase()] || "other");
  return { people, pets };
}
/* Add what a note mentioned to the saved profile's people and pets (tier3_deep.people, the list profile.html shows), marked as found in a note so staff can check it. Never more than 12 in all, never a name already there. */
export function applyMentions(store, residentId, m) {
  const id = rid(residentId), p = id ? readJson(store, KEYS.profile + id, null) : null, out = { added: [], skipped: 0 };
  if (!p || p.schema !== "cognicopia.residentProfile" || !p.tier3_deep || typeof p.tier3_deep !== "object") return out;
  const list = Array.isArray(p.tier3_deep.people) ? p.tier3_deep.people : (p.tier3_deep.people = []), have = new Set(list.map((x) => String(x && x.name).toLowerCase()));
  for (const x of [...((m && m.people) || []), ...((m && m.pets) || [])]) {
    if (have.has(x.name.toLowerCase())) { out.skipped++; continue; } if (list.length >= 12) { out.skipped++; continue; }
    list.push({ name: x.name, relationship: { code: x.rel, label: REL_LABEL[x.rel] || x.rel }, isPet: /^pet-/.test(x.rel), passedAway: false, foundInJournal: true }); have.add(x.name.toLowerCase()); out.added.push(x);
  }
  if (out.added.length) writeJson(store, KEYS.profile + id, p); return out;
}

/* A background listener: the journal announces each new entry on the document, and this hears it. Safe to start twice. */
export function startJournalFeed(doc, getStore) {
  if (!doc || doc.__cgStudioFeed) return doc && doc.__cgStudioFeed;
  const handler = (ev) => { const d = ev && ev.detail || {}; setTimeout(() => { let r = { ok: false }; try { r = feedProfile(getStore(), d.residentId, d.entry); } catch (e) { r = { ok: false }; } doc.dispatchEvent(new CustomEvent("cg-studio-profile-fed", { detail: { residentId: d.residentId, ok: r.ok, keywords: r.keywords || [], profileUpdated: !!r.profileUpdated, mentions: r.mentions || [] } })); }, 0); };
  doc.addEventListener("cg-studio-journal-added", handler); doc.__cgStudioFeed = { stop: () => { doc.removeEventListener("cg-studio-journal-added", handler); delete doc.__cgStudioFeed; } }; return doc.__cgStudioFeed;
}

/* ---------- 2. the planner ---------- */
export const ERAS = Object.freeze(["1930s", "1940s", "1950s", "1960s", "1970s", "Mixed"]);
export const ARCS = Object.freeze(["Home and kitchen", "Music and radio", "Work and craft", "Family and friends", "Gardens and weather", "Outings and travel", "Faith and quiet traditions", "Sports and games"]);
const SEASON_NAME = { winter: "Winter", spring: "Spring", summer: "Summer", autumn: "Autumn" };
/* Regional climates: what "the season" means and which words and notes suit it. Month numbers are 1 to 12 (northern hemisphere; "south" flips them). */
export const CLIMATES = Object.freeze({
  temperate: { label: "Four seasons (temperate)", seasons: null },
  cold: { label: "Long winters (northern and mountain)", seasons: [["Long winter", [11, 12, 1, 2, 3], ["SNOW", "MITTENS", "HEARTH", "SLED", "QUILT"], "Long winter evenings were for quilts, cards and stories by the stove."], ["Thaw and spring", [4, 5], ["MUD", "ROBIN", "SEEDS", "RAIN", "TULIP"], "The first thaw brought the sound of dripping water and the first robins."], ["Short summer", [6, 7, 8], ["LAKE", "GARDEN", "PORCH", "BERRIES", "FIREFLY"], "The short summer was packed with picking berries and long light evenings."], ["Early autumn", [9, 10], ["LEAVES", "HARVEST", "WOOD", "APPLE", "SCARF"], "Autumn meant putting up the harvest and stacking wood."]] },
  warm: { label: "Warm and mild (southern)", seasons: [["Mild winter", [12, 1, 2], ["ORANGE", "BREEZE", "PORCH", "GARDEN", "SUN"], "Mild winter days were for sitting out on the porch."], ["Spring bloom", [3, 4, 5], ["BLOOM", "AZALEA", "ROSE", "PICNIC", "TEA"], "Spring came early with blossoms and picnics."], ["Long summer", [6, 7, 8, 9], ["LEMONADE", "FAN", "SHADE", "PEACH", "FIREFLY"], "Long summers were for shade, fans and sweet tea."], ["Gentle autumn", [10, 11], ["PECAN", "HARVEST", "COTTON", "FAIR", "COZY"], "Autumn brought fairs and pecans."]] },
  tropical: { label: "Tropical (wet and dry seasons)", seasons: [["Dry season", [11, 12, 1, 2, 3, 4], ["BREEZE", "PALM", "MARKET", "SUN", "SHELL"], "In the dry season the markets and festivals filled the streets."], ["Rainy season", [5, 6, 7, 8, 9, 10], ["RAIN", "MANGO", "GREEN", "UMBRELLA", "GARDEN"], "The rains turned everything green and brought the mangoes."]] },
  desert: { label: "Dry and desert", seasons: [["Cool season", [11, 12, 1, 2, 3], ["SAGE", "SUNSET", "ADOBE", "BLANKET", "STARS"], "Cool desert evenings were for blankets and stars."], ["Hot season", [4, 5, 6, 7, 8, 9, 10], ["SHADE", "CACTUS", "WATER", "FAN", "MESA"], "In the heat, people lived in the shade and waited for sunset."]] },
  coastal: { label: "Coastal", seasons: null, extra: { words: ["SHELL", "TIDE", "GULL", "SAND", "BOAT"], note: "The sea air and the sound of the gulls are part of coastal memories." } }
});
/* Days that can be hard for some residents: each holiday carries tags, and one click can exclude every holiday that carries a chosen tag. */
export const STRESS_TAGS = Object.freeze({ loud: "Loud celebrations and fireworks", alcohol: "Celebrations built around drinking", crowds: "Large gatherings and crowds", war: "War and remembrance", loss: "Days about parents, which can bring loss to mind", religious: "Religious observances" });
export const HOLIDAY_TAGS = Object.freeze({ "new-year": ["loud", "alcohol", "crowds"], "st-patricks": ["alcohol", "crowds"], independence: ["loud", "crowds"], thanksgiving: ["crowds"], "winter-celebrations": ["crowds"], "mothers-day": ["loss"], "fathers-day": ["loss"], "memorial-day": ["war"], easter: ["religious"], christmas: ["religious", "crowds"] });
const holidayExcluded = (id, ex) => (HOLIDAY_TAGS[id] || []).some((t) => (ex || []).includes(t));
export function climateSeason(climate, month, hemisphere) {
  const c = CLIMATES[climate]; if (!c || !c.seasons) return null; const m = hemisphere === "south" ? ((month + 5) % 12) + 1 : month;
  const row = c.seasons.find((r) => r[1].includes(m)); return row ? { season: row[0], words: row[2], note: row[3] } : null;
}
const emptyMonth = () => ({ era: "Mixed", season: "", milestone: "", arc: "", notes: "", theme: "" });
export function normalizePlanner(raw, year) {
  const r = raw && typeof raw === "object" ? raw : {}, y = int(year || r.year, 2000, 2100, new Date().getFullYear()), months = {};
  for (let m = 1; m <= 12; m++) { const k = String(m).padStart(2, "0"), x = r.months && r.months[k] || {}; months[k] = { era: ERAS.includes(x.era) ? x.era : "Mixed", season: clip(x.season, 30), milestone: clip(x.milestone, 80), arc: clip(x.arc, 40), notes: clip(x.notes, 300), theme: clip(x.theme, 60) }; }
  const bundles = (Array.isArray(r.bundles) ? r.bundles : []).map((b) => ({ id: typeof b.id === "string" && ID.test(b.id) ? b.id : uid("b"), month: monthOk(b.month), era: ERAS.includes(b.era) ? b.era : "Mixed", theme: clip(b.theme, 60), arc: clip(b.arc, 40), concept: clip(b.concept, 80), words: (Array.isArray(b.words) ? b.words : []).map((w) => clip(w, 24).toUpperCase()).filter(Boolean).slice(0, 8), notes: (Array.isArray(b.notes) ? b.notes : []).map((n) => clip(n, 140)).filter(Boolean).slice(0, 4), status: ["mapped", "generated"].includes(b.status) ? b.status : "mapped", mappedAt: clip(b.mappedAt, 30) })).filter((b) => b.month);
  const climate = Object.prototype.hasOwnProperty.call(CLIMATES, r.climate) ? r.climate : "temperate", exclusions = (Array.isArray(r.exclusions) ? r.exclusions : []).filter((t) => Object.prototype.hasOwnProperty.call(STRESS_TAGS, t));
  return { schema: SCHEMAS.planner, v: SCHEMA_VERSION, year: y, months, bundles, climate, exclusions: [...new Set(exclusions)] };
}
export const readPlanner = (store, year) => normalizePlanner(readJson(store, KEYS.planner + int(year, 2000, 2100, new Date().getFullYear()), null), year);
export function savePlanner(store, planner) { const p = normalizePlanner(planner, planner && planner.year); if (!writeJson(store, KEYS.planner + p.year, p)) throw new Error("the plan could not be saved"); return p; }
/* Sensible starting values: the season, the first holiday of the month that is not sensitive, the eras in turn, the arcs in turn. */
export function defaultPlan(year, o = {}) {
  const p = normalizePlanner({ year, climate: o.climate, exclusions: o.exclusions }, year), erasCycle = ["1940s", "1950s", "1960s", "1970s"];
  for (let m = 1; m <= 12; m++) {
    const k = String(m).padStart(2, "0"), hol = HOLIDAYS.filter((h) => !h.gentle && !h.religious).map((h) => { const d = h.when(p.year); return { h, month: d.getUTCMonth() + 1 }; }).find((x) => x.month === m);
    const cs = climateSeason(p.climate, m);
    p.months[k] = { era: erasCycle[(m - 1) % 4], season: cs ? cs.season : SEASON_NAME[seasonOf(new Date(p.year, m - 1, 15))], milestone: hol && !holidayExcluded(hol.h.id, p.exclusions) ? hol.h.name : "", arc: ARCS[(m - 1) % ARCS.length], notes: "", theme: "" };
  }
  return p;
}
/* The bulk pre-map: link each month's theme to a bundle that the monthly roster generation can pick up. Months already generated are left as they are. */
export function premap(planner, from = new Date(), count = 12) {
  const p = normalizePlanner(planner, planner && planner.year), agent = new SeasonalPackAgent(), start = new Date(from.getFullYear(), from.getMonth(), 1), made = [];
  const keep = p.bundles.filter((b) => b.status === "generated");
  for (let i = 0; i < Math.max(1, Math.min(24, count)); i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1), mk = monthKey(d), m = p.months[String(d.getMonth() + 1).padStart(2, "0")] || emptyMonth();
    if (d.getFullYear() !== p.year || keep.some((b) => b.month === mk)) continue;
    const item = agent.itemFor(new Date(d.getFullYear(), d.getMonth(), 12), {}), cs = climateSeason(p.climate, d.getMonth() + 1), cx = CLIMATES[p.climate] && CLIMATES[p.climate].extra;
    const holiday = HOLIDAYS.find((h) => item.holiday === h.name); if (holiday && holidayExcluded(holiday.id, p.exclusions)) { item.holiday = ""; item.concept = cs ? cs.season : item.concept; }
    if (cs) { item.words = [...new Set([...cs.words, ...item.words.filter((w) => !holiday || !holidayExcluded(holiday.id, p.exclusions))])].slice(0, 8); item.notes = [cs.note, ...item.notes.filter((n) => !/winter|summer|spring|autumn|fall/i.test(n))].slice(0, 4); }
    if (cx) { item.words = [...new Set([...cx.words.slice(0, 3), ...item.words])].slice(0, 8); item.notes = [cx.note, ...item.notes].slice(0, 4); }
    const theme = m.theme || m.milestone || m.arc || item.concept;
    made.push({ id: uid("b"), month: mk, era: m.era, theme: clip(theme, 60), arc: m.arc, concept: clip(m.milestone || m.arc || item.concept, 80), words: item.words, notes: [m.notes, ...item.notes].filter(Boolean).slice(0, 4), status: "mapped", mappedAt: new Date().toISOString() });
  }
  p.bundles = [...keep, ...made].sort((a, b) => a.month.localeCompare(b.month)); return { planner: normalizePlanner(p, p.year), mapped: made.length };
}
/* What the monthly roster generation needs: one request per resident, from that month's bundle. */
export function requestsFor(planner, month, profiles, template = "reminiscence") {
  const b = (planner && planner.bundles || []).find((x) => x.month === month); if (!b) return [];
  const era = /^19\d0s$/.test(b.era) ? b.era : "";
  return (Array.isArray(profiles) ? profiles : [{}]).map((p, i) => ({ profile: Object.assign({}, p, era && !p.formativeEra ? { formativeEra: era } : {}), concept: b.concept, deep: { themeWords: b.words, notes: b.notes, focus: "seasons", variant: i }, tokens: { theme: b.theme, season: seasonOf(new Date(month + "-12T12:00:00")) }, options: { template } }));
}
export function markGenerated(planner, month) { const p = normalizePlanner(planner, planner && planner.year); p.bundles.forEach((b) => { if (b.month === month) b.status = "generated"; }); return p; }
export const emptyPlannerMonth = emptyMonth;

/* Change the climate or the excluded days of a plan that already has entries: seasons follow the climate, and any milestone that carries an excluded tag is cleared (a milestone staff typed themselves is kept). */
export function applyOptions(plan, o = {}) {
  const p = normalizePlanner(Object.assign({}, plan, { climate: o.climate != null ? o.climate : plan && plan.climate, exclusions: o.exclusions != null ? o.exclusions : plan && plan.exclusions }), plan && plan.year);
  for (let m = 1; m <= 12; m++) {
    const k = String(m).padStart(2, "0"), x = p.months[k], cs = climateSeason(p.climate, m), plain = SEASON_NAME[seasonOf(new Date(p.year, m - 1, 15))];
    if (!x.season || Object.values(SEASON_NAME).includes(x.season) || CLIMATE_NAMES.has(x.season)) x.season = cs ? cs.season : plain;
    const h = HOLIDAYS.find((q) => x.milestone === q.name); if (h && holidayExcluded(h.id, p.exclusions)) x.milestone = "";
  }
  p.bundles = p.bundles.filter((b) => b.status === "generated" || !(b.concept && HOLIDAYS.some((h) => h.name === b.concept && holidayExcluded(h.id, p.exclusions))));
  return p;
}
const CLIMATE_NAMES = new Set(Object.values(CLIMATES).flatMap((c) => (c.seasons || []).map((r) => r[0])));
