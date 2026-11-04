/* Cognicopia Pillar 2: functionality (Agents 10 to 15).

     10  ProfileHub                  resident profiles and caregiver notes, kept in this browser only
     11  NoteAnalyzer                reads caregiver notes and recommends activities (staff decide)
     12  DeepCustomizationAgent      suggests deep-customization settings and keeps named presets
     13  DifficultyCalibrator        adjusts how much a sheet asks for, by the condition staff select
     14  BrandingCoordinator         a facility's name, header and black-and-white logo
     15  EngagementLogger            what was offered and how it went, by id, never by name

   Everything stays on this computer. Storage is an adapter you pass in (memory by default; webStorage() wraps the browser's
   localStorage); nothing is sent anywhere. The analyzer and the calibrator support staff judgment: they suggest and adjust
   what a sheet asks for. They do not diagnose, and the wording they add says so. */

import { CognicopiaAgent, normalizeProfile, normalizeTier, avoidMatcher } from "./agent-orchestrator.js";
import { normalizeDeep } from "./reminiscence-engine.js";

export const VERSION = "1.0.0";
const clip = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const list = (v, n, max) => (Array.isArray(v) ? v : String(v == null ? "" : v).split(/[,;\n]/)).map((x) => clip(x, n)).filter(Boolean).slice(0, max);

/* ---------- storage adapters ---------- */
export function memoryStorage() {
  const m = new Map();
  return { get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => { m.set(k, String(v)); }, remove: (k) => { m.delete(k); }, keys: () => [...m.keys()] };
}
/* The browser's localStorage, under a prefix. Every call is guarded: a full or blocked store gives a plain false, never an exception. */
export function webStorage(ls, prefix = "cognicopia_p2_") {
  const store = ls || (typeof localStorage !== "undefined" ? localStorage : null);
  const safe = (f, d) => { try { return store ? f() : d; } catch (e) { return d; } };
  return {
    get: (k) => safe(() => store.getItem(prefix + k), null), set: (k, v) => safe(() => { store.setItem(prefix + k, String(v)); return true; }, false), remove: (k) => safe(() => { store.removeItem(prefix + k); return true; }, false),
    keys: () => safe(() => { const out = []; for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && k.startsWith(prefix)) out.push(k.slice(prefix.length)); } return out; }, [])
  };
}
const readJson = (st, k, d) => { try { const t = st.get(k); return t == null ? d : JSON.parse(t); } catch (e) { return d; } };
const newId = (prefix) => { let r = ""; try { const a = new Uint8Array(6); (globalThis.crypto || {}).getRandomValues(a); r = [...a].map((b) => b.toString(36).padStart(2, "0")).join(""); } catch (e) { r = Math.random().toString(36).slice(2, 14); } return prefix + r.slice(0, 10); };

/* ---------- 10. profile and note hub ---------- */
const MAX_NOTES = 200, NOTE_LEN = 500, MAX_PROFILES = 500;
export class ProfileHub extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "ProfileHub", stage: "analyze", role: "Functionality: resident profile and caregiver note hub", capabilities: ["profiles", "notes"], ...o }); this.store = o.storage || memoryStorage(); this.now = o.now || (() => new Date()); }
  /* If a request names a saved resident (residentId), load the profile and the recent notes into it. */
  async handle(ctx) {
    const id = ctx.request && ctx.request.residentId; if (!id) return ctx;
    const rec = this.get(id); if (!rec) { ctx.analysis = Object.assign({}, ctx.analysis, { hub: { found: false } }); return ctx; }
    ctx.analysis = Object.assign({}, ctx.analysis, { hub: { found: true, notes: rec.notes.length } });
    ctx.hubNotes = rec.notes.slice(-20).map((n) => n.text).join(" \n ");
    return ctx;
  }
  list() { return readJson(this.store, "index", []).map((id) => { const r = this.get(id); return r ? { id, alias: r.alias, updated: r.updated, notes: r.notes.length } : null; }).filter(Boolean); }
  get(id) { const r = readJson(this.store, "p:" + clip(id, 30), null); return r && r.id ? r : null; }
  /* alias is how staff recognize the record (a first name, a room); profile is the details a sheet is made from. */
  save(alias, profile, id) {
    const a = clip(alias, 40); if (!a) throw new RangeError("a profile needs an alias");
    const idx = readJson(this.store, "index", []), exists = id && this.get(id), rid = exists ? clip(id, 30) : newId("r_");
    if (!exists && idx.length >= MAX_PROFILES) throw new RangeError("the hub holds up to " + MAX_PROFILES + " profiles");
    const prev = exists ? this.get(rid) : null, p = normalizeProfile(profile || {});
    const rec = { id: rid, alias: a, profile: { preferredName: p.name, formativeEra: p.era, ailmentTier: p.tier, hobbies: p.preferences, familyNames: p.family, petNames: p.pets, spouse: p.spouse, children: p.children, grandchildren: p.grandchildren, pastCareer: p.career, hometown: p.hometown, nostalgiaAnchors: p.anchors, avoid: p.avoid }, notes: prev ? prev.notes : [], created: prev ? prev.created : this.now().toISOString(), updated: this.now().toISOString() };
    this.store.set("p:" + rid, JSON.stringify(rec)); if (!idx.includes(rid)) { idx.push(rid); this.store.set("index", JSON.stringify(idx)); }
    return rid;
  }
  remove(id) { const rid = clip(id, 30); this.store.remove("p:" + rid); this.store.set("index", JSON.stringify(readJson(this.store, "index", []).filter((x) => x !== rid))); return true; }
  addNote(id, text, o = {}) {
    const rec = this.get(id); if (!rec) throw new RangeError("no such profile"); const t = clip(text, NOTE_LEN); if (!t) throw new RangeError("a note needs some text");
    rec.notes.push({ at: (o.at instanceof Date ? o.at : this.now()).toISOString(), text: t }); if (rec.notes.length > MAX_NOTES) rec.notes = rec.notes.slice(-MAX_NOTES);
    rec.updated = this.now().toISOString(); this.store.set("p:" + rec.id, JSON.stringify(rec)); return rec.notes.length;
  }
  notes(id, o = {}) { const rec = this.get(id); return rec ? rec.notes.slice(-(Math.max(1, Math.min(MAX_NOTES, o.last || MAX_NOTES)))) : []; }
  /* The request a sheet is made from: the profile with its recent notes. */
  toRequest(id, extra = {}) { const rec = this.get(id); if (!rec) throw new RangeError("no such profile"); return Object.assign({}, extra, { residentId: rec.id, profile: Object.assign({}, rec.profile, { caregiverNotes: rec.notes.slice(-20).map((n) => n.text).join(" \n ") }) }); }
}

/* ---------- 11. note analyzer and activity recommender ---------- */
const MOODS = Object.freeze([["anxious", /\b(anxious|agitat\w*|restless|pacing|upset|distress\w*|tearful|worried|fearful|angry|yelling|crying)\b/], ["tired", /\b(tired|sleepy|drowsy|fatigue\w*|napping|lethargic|dozing)\b/], ["withdrawn", /\b(withdrawn|refus\w*|declin\w*|no interest|uninterested|stared|isolat\w*)\b/], ["engaged", /\b(engaged|enjoy\w*|smil\w*|laugh\w*|happy|interested|sang|singing|hummed|humming|loved|lit up|joined in)\b/], ["calm", /\b(calm\w*|relaxed|content|peaceful|settled)\b/]]);
const INTERESTS = Object.freeze([["music", /\b(music|songs?|singing|sang|piano|hymns?|radio|choir|dance|dancing|records?)\b/], ["gardening", /\b(garden\w*|flowers?|plants?|farm\w*|vegetables?|roses?)\b/], ["cooking", /\b(cook\w*|bak\w*|kitchen|recipes?|pies?|bread)\b/], ["crafts", /\b(knit\w*|sew\w*|crochet\w*|quilt\w*|craft\w*|paint\w*|drawing|yarn)\b/], ["animals", /\b(dogs?|cats?|pets?|birds?|horses?|animals?)\b/], ["family", /\b(daughter|son|grand\w+|husband|wife|sister|brother|family|visit\w*)\b/], ["sports", /\b(baseball|football|golf|fishing|bowling|sports?|team)\b/], ["reading", /\b(books?|read\w*|newspaper|poems?|poetry)\b/], ["work", /\b(teacher|nurse|farmer|mechanic|carpent\w+|worked|career|job|office)\b/]]);
const SENSORY = Object.freeze([["sound", /\b(music|singing|songs?|hymns?|humming)\b/], ["touch", /\b(blanket|soft|massage|textur\w+|fabric|holding hands|hand)\b/], ["smell", /\b(scent|smell\w*|perfume|baking|coffee|lavender)\b/], ["sight", /\b(photos?|pictures?|colorful|bright|album)\b/]]);
const PHRASE = "([a-z][a-z' -]{2,28}?)(?=[.,;:!?]|\\s+(?:and|but|when|because|or|if|so)\\b|$)";
const AVOID_RE = new RegExp("(?:(?:doesn't|does not|didn't|did not|never)\\s+(?:like|enjoy|want|care for)|dislikes?|hates?|afraid of|scared of|frightened by|upset by|upset when (?:they|she|he) (?:hear|see)s?|avoid|triggered by|distressed by|bothered by)\\s+(?:the\\s+|a\\s+|an\\s+|any\\s+|to\\s+|being\\s+)?" + PHRASE, "g");
const LIKE_RE = new RegExp("(?:loves?|likes?|enjoys?|enjoyed|favorite|favourite|fond of|responds? well to|calmed by|soothed by)\\s+(?:the\\s+|a\\s+|an\\s+|to\\s+)?" + PHRASE, "g");
const STOP = new Set(["it", "that", "this", "them", "him", "her", "being", "to", "do", "go", "be", "is", "are", "was", "when", "the", "with", "much", "very", "really", "anything", "everything", "nothing"]);
export const CONCEPTS = Object.freeze([
  { id: "music-memories", title: "Music memories", needs: ["music"], calm: true, minutes: 15, group: true },
  { id: "garden-hands", title: "Flowers and garden sorting", needs: ["gardening"], calm: true, minutes: 15, group: true },
  { id: "kitchen-memories", title: "Kitchen and baking memories", needs: ["cooking"], calm: true, minutes: 20, group: true },
  { id: "yarn-and-fabric", title: "Yarn, fabric and quilt squares", needs: ["crafts"], calm: true, minutes: 20, group: true },
  { id: "animal-friends", title: "Animals we have known", needs: ["animals"], calm: true, minutes: 15, group: true },
  { id: "family-album", title: "A look through the family album", needs: ["family"], calm: true, minutes: 15, group: false },
  { id: "ball-toss", title: "Gentle ball toss and sports talk", needs: ["sports"], calm: false, minutes: 15, group: true },
  { id: "read-aloud", title: "A poem or a story read aloud", needs: ["reading"], calm: true, minutes: 10, group: true },
  { id: "work-memories", title: "The work we did", needs: ["work"], calm: false, minutes: 15, group: true },
  { id: "folding-and-sorting", title: "Folding towels and sorting buttons", needs: [], calm: true, minutes: 15, group: true },
  { id: "calm-sensory-moment", title: "A quiet sensory moment", needs: [], calm: true, minutes: 10, group: false }
]);
export class NoteAnalyzer extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "NoteAnalyzer", stage: "analyze", role: "Functionality: caregiver note analyzer and activity recommender", capabilities: ["note-analysis", "recommendations"], ...o }); }
  /* In the pipeline: read the notes, add anything to keep off the page, and record the analysis. Words only ever come OFF a sheet this way. */
  async handle(ctx) {
    const text = [ctx.notesText, ctx.hubNotes].filter(Boolean).join(" \n "); if (!text.trim()) return ctx;
    const a = this.analyze(text, { tier: ctx.tier }), rec = this.recommend(a, { tier: ctx.tier });
    const add = ctx.request && ctx.request.analyzeNotes && ctx.request.analyzeNotes.applyAvoid === false ? [] : a.avoidCandidates;
    if (add.length) ctx.avoid = [...new Set([...(ctx.avoid || []), ...add])];
    ctx.analysis = Object.assign({}, ctx.analysis, { notes: { mood: a.mood, interests: a.interests, sensory: a.sensory, sundowning: a.sundowning, appliedAvoid: add, suggestedTier: a.suggestedTier, recommendations: rec.slice(0, 3).map((r) => r.id) } });
    return ctx;
  }
  analyze(text, o = {}) {
    const t = clip(text, 20000).toLowerCase(), moods = MOODS.filter(([, re]) => re.test(t)).map(([m]) => m), count = (re) => (t.match(new RegExp(re.source, "g")) || []).length;
    const unease = count(MOODS[0][1]), good = count(MOODS[3][1]) + count(MOODS[4][1]), low = count(MOODS[1][1]) + count(MOODS[2][1]);
    const mood = unease > good && unease >= low ? "unsettled" : low > good ? "low-energy" : good > 0 ? "settled" : "unknown";
    const interests = INTERESTS.filter(([, re]) => re.test(t)).map(([k]) => k), sensory = SENSORY.filter(([, re]) => re.test(t)).map(([k]) => k);
    const sundowning = /\b(sundown\w*|late afternoon|towards evening|toward evening|dusk|after dinner|at night)\b/.test(t) && unease > 0;
    const grab = (re) => { const out = []; let m; re.lastIndex = 0; while ((m = re.exec(t))) { const ph = m[1].trim().replace(/\s+/g, " "); const words = ph.split(" "); if (!STOP.has(words[0]) && words.length <= 4 && ph.length >= 3 && !out.includes(ph)) out.push(ph); } return out.slice(0, 8); };
    const avoidCandidates = grab(AVOID_RE), likes = grab(LIKE_RE).filter((x) => !avoidCandidates.includes(x));
    /* A suggestion to be gentler, never to be harder: staff decide. */
    const tier = normalizeTier(o.tier), suggestedTier = (unease >= 2 || low >= 3) && tier < 3 ? tier + 1 : null;
    return { mood, moods, interests, sensory, sundowning, likes, avoidCandidates, suggestedTier, signals: { unease, good, low }, note: "A reading of the notes to support staff judgment. It is not an assessment." };
  }
  recommend(analysis, o = {}) {
    const a = analysis || {}, unsettled = a.mood === "unsettled" || a.sundowning, lowE = a.mood === "low-energy";
    const scored = CONCEPTS.map((c) => {
      let s = 0, why = [];
      if (c.needs.length && c.needs.some((n) => (a.interests || []).includes(n))) { s += 5; why.push("they enjoy " + c.needs[0]); }
      if (c.needs.includes("music") && (a.sensory || []).includes("sound")) { s += 2; why.push("sound has soothed them"); }
      if (unsettled) { if (c.calm) { s += 3; why.push("a calm activity for an unsettled time"); } else s -= 3; if (c.minutes <= 15) s += 1; }
      if (lowE) { if (c.minutes <= 15) { s += 2; why.push("short, for a low-energy day"); } else s -= 1; }
      if (a.mood === "settled" && c.needs.length) s += 1;
      if (!c.needs.length) s += 0.5;
      return { id: c.id, title: c.title, minutes: c.minutes, group: c.group, score: s, reason: why.join("; ") || "a gentle all-round choice" };
    });
    return scored.sort((x, y) => y.score - x.score || x.title.localeCompare(y.title));
  }
}

/* ---------- 12. deep customization: suggestions and presets ---------- */
export const PRESETS = Object.freeze({
  "evening-calm": { label: "Evening calm", deep: { focus: "music", include: { wordSearch: false, sparks: true, matching: true } }, tier: 3, note: "Quiet, familiar and short, for the end of the day." },
  "morning-energy": { label: "Morning energy", deep: { focus: "mixed", include: { wordSearch: true, sparks: true, matching: true } }, tier: null, note: "The full sheet, for a good morning." },
  "music-first": { label: "Music first", deep: { focus: "music", include: { wordSearch: true, sparks: true, matching: false } }, tier: null, note: "Leans on songs and the radio." },
  "family-focus": { label: "Family focus", deep: { focus: "family", include: { wordSearch: false, sparks: true, matching: true } }, tier: null, note: "Leans on the people close to them." },
  "quiet-hands": { label: "Quiet hands", deep: { focus: "home", include: { wordSearch: false, sparks: false, matching: true } }, tier: 3, note: "Things to hold and match, with little reading." }
});
export class DeepCustomizationAgent extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "DeepCustomizationAgent", stage: "analyze", role: "Functionality: deep customization suggestions and presets", capabilities: ["suggest", "presets"], ...o }); this.store = o.storage || memoryStorage(); }
  /* A request may name a preset; its settings fill only what the request left unsaid. */
  async handle(ctx) {
    const req = ctx.request || {}, name = req.preset; if (!name) return ctx;
    const pre = this.preset(name); if (!pre) { ctx.analysis = Object.assign({}, ctx.analysis, { preset: { name: clip(name, 40), found: false } }); return ctx; }
    const merged = this.merge(pre.deep, req.deep); req.deep = merged;
    if (ctx.deep) { const n = normalizeDeep(merged); ctx.deep = Object.assign({}, ctx.deep, { focus: n.focus, include: n.include }); }   // only the preset's focus and parts: what staff typed was already read
    ctx.analysis = Object.assign({}, ctx.analysis, { preset: { name, found: true, label: pre.label, suggestedTier: pre.tier } }); return ctx;
  }
  /* Settings to offer staff, from what the notes said. Staff accept or change them; nothing is applied silently. */
  suggest(analysis) {
    const a = analysis || {}, i = a.interests || [], focus = i.includes("music") ? "music" : i.includes("family") ? "family" : i.some((x) => ["gardening", "cooking", "crafts"].includes(x)) ? "home" : i.includes("work") ? "work" : "mixed";
    const music = (a.likes || []).filter((l) => /music|song|hymn|radio|singing|piano|band|dance/.test(l)).slice(0, 2), foods = (a.likes || []).filter((l) => /pie|bread|cake|coffee|tea|cookie|soup|apple|bak/.test(l)).slice(0, 2);
    const quiet = a.mood === "unsettled" || a.sundowning, d = { focus, music, foods, words: [], include: { wordSearch: !quiet, sparks: true, matching: true } };
    return { deep: d, preset: quiet ? "evening-calm" : null, why: [focus !== "mixed" ? "notes mention " + (focus === "home" ? "home pastimes" : focus) : "", quiet ? "notes suggest a calm, short sheet" : ""].filter(Boolean) };
  }
  merge(base, over) { const b = base || {}, o = over || {}; return Object.assign({}, b, o, { include: Object.assign({}, b.include, o.include) }); }
  preset(name) { const k = clip(name, 40); if (PRESETS[k]) return PRESETS[k]; const mine = readJson(this.store, "preset:" + k.toLowerCase(), null); return mine || null; }
  /* A facility's own preset. The name is for the setting ("Tuesday music hour"), not for a person, and a name that looks like one is refused. */
  savePreset(name, deep, label) {
    const k = clip(name, 40).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""); if (!k) throw new RangeError("a preset needs a name");
    if (PRESETS[k]) throw new RangeError("that name is built in");
    this.store.set("preset:" + k, JSON.stringify({ label: clip(label || name, 60), deep: deep && typeof deep === "object" ? { focus: clip(deep.focus, 20), include: deep.include || {} } : {}, tier: null, note: "A facility preset." })); return k;
  }
}

/* ---------- 13. cognitive difficulty calibrator ---------- */
export const CONDITIONS = Object.freeze({
  alzheimers: { label: "Alzheimer's disease", caps: {}, guidance: ["Offer one thing at a time and let them set the pace."] },
  vascular: { label: "Vascular dementia", caps: { maxPairs: 3, maxSparks: 2 }, minFontPt: 20, guidance: ["Abilities can change from day to day. Offer a clear, short sequence and plenty of time."] },
  lewy: { label: "Lewy body dementia", caps: { maxGrid: 6, maxWords: 4, maxPairs: 3, maxSparks: 2 }, minFontPt: 24, guidance: ["Attention can come and go. Use good light, plain high-contrast sheets, and offer on a good hour. Busy patterns can be hard to read."] },
  ftd: { label: "Frontotemporal dementia", caps: { maxGrid: 6, maxWords: 4, maxPairs: 3 }, minFontPt: 20, guidance: ["A steady routine helps. Pictures and objects can be easier than finding words. Keep the activity simple and repeatable."] },
  korsakoff: { label: "Korsakoff syndrome", caps: { maxSparks: 2 }, minFontPt: 20, remote: true, guidance: ["Recent events may not be held. Talk about years long ago and do not correct anything they say."] }
});
export const CALIBRATION_NOTE = "Adjusts the sheet to support staff judgment; not a diagnosis.";
export class DifficultyCalibrator extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "DifficultyCalibrator", stage: "analyze", role: "Functionality: cognitive difficulty calibrator", capabilities: Object.keys(CONDITIONS), ...o }); }
  async handle(ctx) {
    const c = ctx.request && ctx.request.condition; if (!c) return ctx;
    const cal = this.calibrate(c, ctx.tier); if (!cal) { ctx.analysis = Object.assign({}, ctx.analysis, { calibration: { condition: clip(c, 30), found: false } }); return ctx; }
    ctx.calibration = cal; ctx.analysis = Object.assign({}, ctx.analysis, { calibration: { condition: cal.condition, label: cal.label, caps: cal.caps, minFontPt: cal.minFontPt, note: CALIBRATION_NOTE } }); return ctx;
  }
  /* condition: a key of CONDITIONS (case and spacing are forgiven). Returns the caps the reminiscence template reads, or null. */
  calibrate(condition, tier) {
    const k = String(condition == null ? "" : condition).toLowerCase().replace(/[^a-z]/g, ""), key = k === "alzheimer" || k === "alzheimers" || k === "ad" ? "alzheimers" : k.startsWith("vascular") || k === "vad" ? "vascular" : k.startsWith("lewy") || k === "dlb" ? "lewy" : k === "ftd" || k.startsWith("frontotemporal") ? "ftd" : k.startsWith("korsakoff") ? "korsakoff" : null;
    const c = key && CONDITIONS[key]; if (!c) return null;
    return Object.assign({ condition: key, label: c.label, tier: normalizeTier(tier), caps: Object.assign({}, c.caps), minFontPt: c.minFontPt || 0, remote: !!c.remote, guidance: [c.guidance[0], CALIBRATION_NOTE] }, c.caps);
  }
}

/* ---------- 14. facility branding ---------- */
/* Print is pure black on white, so a logo is reduced to black and white. thresholdPixels works on raw RGBA values (and is tested without a browser);
   toBlackAndWhite draws a logo on a canvas and applies it. */
export function thresholdPixels(rgba, cutoff = 160) {
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) { const a = rgba[i + 3] / 255, lum = (0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]) * a + 255 * (1 - a), v = lum < cutoff ? 0 : 255; out[i] = out[i + 1] = out[i + 2] = v; out[i + 3] = 255; }
  return out;
}
export async function toBlackAndWhite(dataUrl, o = {}) {
  if (typeof document === "undefined") return { ok: false, reason: "no_canvas", dataUrl };
  return new Promise((resolve) => {
    const img = new Image(); img.onerror = () => resolve({ ok: false, reason: "unreadable", dataUrl });
    img.onload = () => { try {
      const max = o.maxPx || 400, k = Math.min(1, max / Math.max(img.width, img.height, 1)), w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
      const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
      const px = g.getImageData(0, 0, w, h), t = thresholdPixels(px.data, o.cutoff); px.data.set(t); g.putImageData(px, 0, 0); resolve({ ok: true, dataUrl: c.toDataURL("image/png"), width: w, height: h });
    } catch (e) { resolve({ ok: false, reason: "blocked", dataUrl }); } };
    img.src = dataUrl;
  });
}
const LOGO_RE = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;
export class BrandingCoordinator extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "BrandingCoordinator", stage: "analyze", role: "Functionality: facility branding coordinator", capabilities: ["branding", "logo"], ...o }); this.store = o.storage || memoryStorage(); }
  /* A request with no branding of its own gets the saved one. */
  async handle(ctx) { const req = ctx.request; if (req && !req.branding) { const b = this.get(); if (b) { req.branding = b; ctx.analysis = Object.assign({}, ctx.analysis, { branding: { applied: true } }); } } return ctx; }
  get() { const b = readJson(this.store, "branding", null); return b && (b.facilityName || b.headerText || b.logoDataUrl) ? b : null; }
  /* Returns { ok, branding, problems }. A bad logo is dropped with a reason; the name and header still save. */
  set(input) {
    const i = input && typeof input === "object" ? input : {}, problems = [];
    const b = { facilityName: clip(String(i.facilityName == null ? "" : i.facilityName).replace(/[<>{}]/g, ""), 80), headerText: clip(String(i.headerText == null ? "" : i.headerText).replace(/[<>{}]/g, ""), 100), logoDataUrl: "" };
    if (i.logoDataUrl) { const u = String(i.logoDataUrl); if (!LOGO_RE.test(u)) problems.push("the logo is not a PNG, JPEG, GIF or WebP image"); else if (u.length > 400000) problems.push("the logo is larger than about 300 KB"); else b.logoDataUrl = u; }
    if (!b.facilityName && !b.headerText && !b.logoDataUrl) return { ok: false, branding: null, problems: problems.length ? problems : ["nothing to save"] };
    this.store.set("branding", JSON.stringify(b)); return { ok: true, branding: b, problems };
  }
  clear() { this.store.remove("branding"); return true; }
}

/* ---------- 15. progress and engagement ---------- */
export const ENGAGEMENT = Object.freeze({ 0: "not interested", 1: "watched", 2: "took part", 3: "enjoyed it" });
const dayKey = (d) => d.toISOString().slice(0, 10);
export class EngagementLogger extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "EngagementLogger", stage: "analyze", role: "Functionality: progress and engagement logger", capabilities: ["log", "summary", "export"], ...o }); this.store = o.storage || memoryStorage(); this.now = o.now || (() => new Date()); }
  /* In the pipeline: if the request names a resident, record which activities have gone well, for the recommender. */
  async handle(ctx) {
    const id = ctx.request && ctx.request.residentId; if (!id) return ctx;
    const s = this.summary(id, { days: 60 }); ctx.analysis = Object.assign({}, ctx.analysis, { history: { entries: s.entries, average: s.average, best: s.best.slice(0, 3).map((b) => b.concept) } }); return ctx;
  }
  /* entry: { residentId, concept, engagement 0..3, minutes?, timeOfDay?, note? }. residentId is the hub's id: no name is ever stored here. */
  log(entry) {
    const e = entry && typeof entry === "object" ? entry : {}, rid = clip(e.residentId, 30), en = Number(e.engagement);
    if (!rid) throw new RangeError("an entry needs a resident id"); if (!(en >= 0 && en <= 3) || !Number.isInteger(en)) throw new RangeError("engagement is 0, 1, 2 or 3");
    const concept = clip(e.concept, 60); if (!concept) throw new RangeError("an entry needs an activity");
    const rec = { id: newId("e_"), at: (e.at instanceof Date ? e.at : this.now()).toISOString(), residentId: rid, concept, engagement: en, minutes: Math.max(0, Math.min(240, Math.round(Number(e.minutes) || 0))), timeOfDay: ["morning", "afternoon", "evening"].includes(e.timeOfDay) ? e.timeOfDay : "", note: clip(e.note, 200) };
    const all = this.all(); all.push(rec); this.store.set("log", JSON.stringify(all.slice(-5000))); return rec.id;
  }
  all() { const a = readJson(this.store, "log", []); return Array.isArray(a) ? a : []; }
  forResident(id, o = {}) { const since = o.days ? this.now().getTime() - o.days * 86400000 : 0; return this.all().filter((x) => x.residentId === clip(id, 30) && new Date(x.at).getTime() >= since); }
  summary(id, o = {}) {
    const rows = this.forResident(id, o), n = rows.length, avg = n ? rows.reduce((s, r) => s + r.engagement, 0) / n : 0;
    const by = (key) => { const m = new Map(); rows.forEach((r) => { const k = r[key]; if (!k) return; const e = m.get(k) || { n: 0, sum: 0 }; e.n++; e.sum += r.engagement; m.set(k, e); }); return [...m.entries()].map(([k, e]) => ({ [key]: k, entries: e.n, average: Math.round(e.sum / e.n * 100) / 100 })).sort((a, b) => b.average - a.average || b.entries - a.entries); };
    const best = by("concept").filter((c) => c.entries >= 1), half = Math.floor(n / 2), first = rows.slice(0, half), last = rows.slice(half), mean = (r) => (r.length ? r.reduce((s, x) => s + x.engagement, 0) / r.length : 0);
    return { entries: n, average: Math.round(avg * 100) / 100, best, times: by("timeOfDay"), trend: n >= 4 ? (mean(last) - mean(first) > 0.3 ? "up" : mean(first) - mean(last) > 0.3 ? "down" : "steady") : "not enough entries yet", labels: ENGAGEMENT };
  }
  facility(o = {}) { const since = o.days ? this.now().getTime() - o.days * 86400000 : 0, rows = this.all().filter((x) => new Date(x.at).getTime() >= since), ids = new Set(rows.map((r) => r.residentId)); const days = {}; rows.forEach((r) => { const k = dayKey(new Date(r.at)); days[k] = (days[k] || 0) + 1; }); return { entries: rows.length, residents: ids.size, average: rows.length ? Math.round(rows.reduce((s, r) => s + r.engagement, 0) / rows.length * 100) / 100 : 0, perDay: days }; }
  /* CSV, with ids and no names. A cell that starts with = + - or @ is made inert so a spreadsheet will not run it. */
  exportCsv(o = {}) {
    const cell = (v) => { let s = String(v == null ? "" : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = o.residentId ? this.forResident(o.residentId) : this.all();
    return ["date,resident_id,activity,engagement,minutes,time_of_day,note"].concat(rows.map((r) => [r.at, r.residentId, r.concept, r.engagement, r.minutes, r.timeOfDay, r.note].map(cell).join(","))).join("\n");
  }
  clear(id) { const rid = id ? clip(id, 30) : null; this.store.set("log", JSON.stringify(rid ? this.all().filter((r) => r.residentId !== rid) : [])); return true; }
}

/* ---------- wiring ---------- */
export const PILLAR2_AGENTS = Object.freeze(["ProfileHub", "NoteAnalyzer", "DeepCustomizationAgent", "DifficultyCalibrator", "BrandingCoordinator", "EngagementLogger"]);
/* Register in this order: hub, branding and the engagement history first, so the analyzer and the calibrator read what they added. */
export function registerPillar2(orchestrator, o = {}) {
  if (!orchestrator || typeof orchestrator.use !== "function") throw new TypeError("registerPillar2 needs an orchestrator");
  const storage = o.storage || memoryStorage();
  const agents = { hub: new ProfileHub({ storage, now: o.now }), branding: new BrandingCoordinator({ storage }), engagement: new EngagementLogger({ storage, now: o.now }), analyzer: new NoteAnalyzer(), deep: new DeepCustomizationAgent({ storage }), calibrator: new DifficultyCalibrator() };
  Object.values(agents).forEach((a) => orchestrator.use(a));
  return agents;
}
export { avoidMatcher };
