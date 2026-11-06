/* =====================================================================
   Cognicopia agent orchestrator (ES module, offline-first, no dependencies).

   The master router for the agent suite. One request travels one pipeline:

     analyze   caregiver notes and the profile are read (Pillar 2)
     generate  the activity is made, in one of three modes (this file, Pillar 1,
               the reminiscence engine)
     audit     dignity, errorless-learning and privacy checks (clinical audit
               agent, Pillar 3)
     preview   the print preview (print-preview-modal.js)

   Agents are small classes that extend CognicopiaAgent and declare which
   stage they fill. A stage with no agent is skipped and says so in the
   diagnostics, so this file works alone and every other file plugs in.

   Three modes
     individual   one resident: their name, family, pets, career, hometown,
                  anchors and the notes staff wrote
     group        several residents: the themes they share, at the gentlest
                  tier present, so everyone can take part
     express      little or no information: safe defaults for the tier

   The circuit breaker. A generator may be given an LLM provider: an async
   function the caller supplies. This file contains no network code and the
   provider is off by default, so the default path is local. If a provider is
   given and it fails, or takes longer than 2,500 ms, or its answer is not a
   valid, dignified activity, the request is answered at once from the local
   procedural template. After three failures in a row the breaker opens and the
   local template answers immediately, with no wait, until a cool-down ends.
   The breaker depends only on the outcomes it saw and a clock that can be
   replaced, so it behaves the same every time.

   Privacy. A prompt sent to a provider holds the era, the tier and broad
   interest categories only, with {name}-style tokens where a name belongs;
   the names are put back here, on this computer, after the answer returns.
   The diagnostic record holds only the tier, the timings, the source and the
   offline state: no text, no name, no note.

   Use:
     import { createOrchestrator } from "./agent-orchestrator.js";
     const o = createOrchestrator();
     const out = await o.execute({ mode: "express", options: { tier: 2 } });
   Like every module script, a browser will not load this from file://.
   ===================================================================== */

export const VERSION = 1;
export const MODES = Object.freeze({ INDIVIDUAL: "individual", GROUP: "group", EXPRESS: "express" });
export const STAGES = Object.freeze(["analyze", "generate", "audit", "preview"]);
export const TIER_NAMES = Object.freeze({ 1: "mild", 2: "moderate", 3: "severe" });
export const LLM_TIMEOUT_MS = 2500;

const LIMITS = Object.freeze({ text: 160, notes: 4000, list: 12 });
const clip = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const list = (v, n = LIMITS.text) => {
  const raw = Array.isArray(v) ? v : String(v == null ? "" : v).split(/[,;\n]/);
  const seen = new Set(), out = [];
  for (const x of raw) { const t = clip(x, n); const k = t.toLowerCase(); if (t && !seen.has(k)) { seen.add(k); out.push(t); } if (out.length >= LIMITS.list) break; }
  return out;
};

/* ---------- the dignity words, shared by every agent ---------- */
const QUIZ = [/\bdo you remember\b/i, /\bremember when\b/i, /\bcan you (name|recall|tell me the name)\b/i, /\bwhat year\b/i, /\bwhat was the name of\b/i, /\bquiz\b/i, /\btest\b/i, /\bdon't you\b/i, /\bwrong\b/i, /\bincorrect\b/i, /\btry again\b/i, /\bhurry\b/i, /\bcorrect answer\b/i];
const ELDERSPEAK = [/,\s*(honey|sweetie|dear|dearie|sweetheart|sugar|hon)\b/i, /\b(honey|sweetie|dearie|sweetheart)\b[,!.]/i, /\bgood (girl|boy)\b/i, /\bour (little )?(friend|resident)\b/i, /\bbaby talk\b/i];
export function dignityProblems(text) {
  const t = String(text == null ? "" : text), out = [];
  QUIZ.forEach((re) => { if (re.test(t)) out.push("tests or corrects: " + re.source); });
  ELDERSPEAK.forEach((re) => { if (re.test(t)) out.push("elderspeak: " + re.source); });
  return out;
}

/* ---------- tiers and profiles ---------- */
export function normalizeTier(v, fallback = 2) {
  if (v === 1 || v === 2 || v === 3) return v;
  const s = String(v == null ? "" : v).toLowerCase();
  if (/^(1|tier ?1|mild|early|easy|level ?1)$/.test(s)) return 1;
  if (/^(2|tier ?2|moderate|middle|mid|level ?2)$/.test(s)) return 2;
  if (/^(3|tier ?3|severe|late|advanced|level ?3)$/.test(s)) return 3;
  return fallback;
}
export function decadeOf(v) {
  const s = String(v == null ? "" : v);
  const m = /(19[4-8])\d?s?/.exec(s) || null;
  if (m) { const d = Number(m[1]) * 10; return d + "s"; }
  const y = Number(s);
  if (y >= 1900 && y <= 2010) { const d = Math.floor((y + 15) / 10) * 10; return Math.min(1980, Math.max(1940, d)) + "s"; }   // the years a person was about 15
  return "";
}
/* Everything a request may carry about a resident, cleaned and capped. hasData says how much there is to personalise with. */
export function normalizeProfile(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const p = {
    name: clip(r.preferredName || r.name || r.residentName, 60),
    era: decadeOf(r.formativeEra || r.era || r.birthYear),
    tier: normalizeTier(r.ailmentTier != null ? r.ailmentTier : r.tier),
    preferences: list(r.preferences || r.hobbies),
    notes: clip(r.caregiverNotes || r.notes, LIMITS.notes),
    family: list(r.familyNames || r.family),
    spouse: clip(r.spouse, 60), children: list(r.children), grandchildren: list(r.grandchildren),
    pets: list(r.petNames || r.pets),
    career: clip(r.pastCareer || r.career, LIMITS.text),
    hometown: clip(r.hometown, LIMITS.text),
    anchors: list(r.nostalgiaAnchors || r.anchors || r.favoriteEvents),
    avoid: list(r.avoid || r.topicsToAvoid, 60)
  };
  if (p.spouse && !p.family.includes(p.spouse)) p.family.unshift(p.spouse);
  p.hasData = [p.name, p.era, p.preferences.length, p.notes, p.family.length, p.pets.length, p.career, p.hometown, p.anchors.length].filter(Boolean).length;
  return p;
}

/* ---------- tokens: the one way a name gets into a sheet ---------- */
const FALLBACKS = Object.freeze({ name: "you", spouse: "your partner", children: "your children", grandchildren: "your grandchildren", family: "your family", pets: "your pets", career: "your work", hometown: "home", era: "those years", anchors: "the things you loved", hobbies: "the things you enjoy" });
export function tokensOf(p) {
  const first = (a) => (a && a.length ? a[0] : "");
  return {
    name: p.name, spouse: p.spouse, children: p.children.join(", "), grandchildren: p.grandchildren.join(", "), family: p.family.join(", "),
    pets: p.pets.join(", "), pet: first(p.pets), career: p.career, hometown: p.hometown, era: p.era, anchors: p.anchors.join(", "), anchor: first(p.anchors), hobbies: p.preferences.join(", "), hobby: first(p.preferences)
  };
}
/* Replace {name}-style tokens. A token with no value takes a neutral phrase, so no brace ever reaches a printed page. */
export function substitute(text, tokens) {
  return String(text == null ? "" : text).replace(/\{([a-z]+)\}/g, (all, k) => {
    const v = tokens && tokens[k]; if (v) return String(v);
    return FALLBACKS[k] !== undefined ? FALLBACKS[k] : (k === "pet" ? FALLBACKS.pets : k === "anchor" ? FALLBACKS.anchors : k === "hobby" ? FALLBACKS.hobbies : "");
  });
}
/* Broad categories from free text: all that may ever leave in a prompt. */
const CATEGORY_WORDS = [["music", /music|radio|song|sing|piano|band|dance|choir|record/i], ["gardening", /garden|flower|plant|farm|harvest/i], ["cooking", /cook|bak|kitchen|recipe|food/i], ["crafts", /knit|sew|craft|quilt|crochet|paint|woodwork/i], ["outdoors", /fish|walk|bird|camp|hunt|nature/i], ["animals", /dog|cat|horse|pet|animal/i], ["sports", /baseball|football|golf|bowl|sport/i], ["reading", /book|read|poem|news/i]];
export const categoriesOf = (p) => CATEGORY_WORDS.filter(([, re]) => re.test([p.preferences.join(" "), p.career, p.anchors.join(" ")].join(" "))).map(([c]) => c);

/* A topic a resident or family asked to keep off the page. Whole words only, so "war" does not catch "warm". */
export function avoidMatcher(terms) {
  const t = (terms || []).map((x) => String(x).trim()).filter((x) => x.length > 1).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!t.length) return () => false;
  const re = new RegExp("(^|[^A-Za-z0-9])(" + t.join("|") + ")([^A-Za-z0-9]|$)", "i");
  return (text) => re.test(String(text == null ? "" : text));
}

/* ---------- the asset every agent reads and writes ---------- */
export function validateAsset(a) {
  const out = [];
  if (!a || typeof a !== "object") return ["the asset is missing"];
  if (!a.title || typeof a.title !== "string") out.push("no title");
  const pg = a.pages || {};
  if (!pg.resident || !Array.isArray(pg.resident.blocks) || !pg.resident.blocks.length) out.push("page 1 (resident) has no blocks");
  const st = pg.caregiver && pg.caregiver.steps;
  if (!Array.isArray(st) || st.length !== 3 || !["Visual Cue", "Verbal Anchor", "Validation Statement"].every((l, i) => st[i] && st[i].label === l && typeof st[i].text === "string" && st[i].text)) out.push("page 2 must hold the three steps: Visual Cue, Verbal Anchor, Validation Statement");
  if (!pg.caregiver || !pg.caregiver.safetyNotice) out.push("page 2 has no safety notice");
  if (!pg.sensory || !Array.isArray(pg.sensory.items) || !pg.sensory.items.length) out.push("page 3 (sensory) has no items");
  return out;
}
export function assetText(a) {
  const parts = [];
  (function walk(v) { if (typeof v === "string") parts.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.keys(v).forEach((k) => { if (!/^(id|type|kind|spec|grid|cells|fontPt)$/.test(k)) walk(v[k]); }); })(a && a.pages);
  return parts.join("\n");
}

/* ---------- the circuit breaker ---------- */
export class CircuitBreaker {
  constructor(o = {}) {
    this.timeoutMs = o.timeoutMs || LLM_TIMEOUT_MS; this.failureThreshold = o.failureThreshold || 3; this.cooldownMs = o.cooldownMs || 30000;
    this.now = o.now || (() => Date.now()); this.setTimer = o.setTimer || ((f, ms) => setTimeout(f, ms)); this.clearTimer = o.clearTimer || ((h) => clearTimeout(h));
    this.failures = 0; this.openedAt = 0; this._probe = false;
  }
  state() {
    if (this.failures < this.failureThreshold) return "closed";
    return this.now() - this.openedAt >= this.cooldownMs ? "half-open" : "open";
  }
  /* fn(signal) -> value. Resolves { ok, value, ms, reason }; never rejects, never waits when open. */
  async exec(fn) {
    const t0 = this.now(), st = this.state();
    if (st === "open" || (st === "half-open" && this._probe)) return { ok: false, reason: "breaker_open", ms: 0 };
    if (st === "half-open") this._probe = true;
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    let timer;
    try {
      const value = await Promise.race([
        Promise.resolve().then(() => fn(ctl && ctl.signal)),
        new Promise((_, rej) => { timer = this.setTimer(() => { if (ctl) { try { ctl.abort(); } catch (e) { /* ignore */ } } rej(Object.assign(new Error("timeout"), { code: "timeout" })); }, this.timeoutMs); })
      ]);
      this.clearTimer(timer); this.failures = 0; this._probe = false;
      return { ok: true, value, ms: Math.max(0, this.now() - t0) };
    } catch (e) {
      this.clearTimer(timer); this._probe = false;
      this.failures += 1; if (this.failures >= this.failureThreshold) this.openedAt = this.now();
      return { ok: false, reason: e && e.code === "timeout" ? "timeout" : "error", ms: Math.max(0, this.now() - t0) };
    }
  }
}

/* ---------- the diagnostic log: metadata only ---------- */
const DIAG_KEYS = Object.freeze({ v: "number", at: "string", mode: "enum", tier: "number", source: "enum", reason: "enum", offline: "boolean", breaker: "enum", durationMs: "number", llmMs: "number", stages: "array" });
const ENUMS = { mode: Object.values(MODES), source: ["llm", "local"], breaker: ["closed", "open", "half-open"], reason: ["", "no_provider", "timeout", "error", "breaker_open", "invalid_response", "dignity_failed"] };
export class DiagnosticLog {
  constructor(o = {}) { this.max = o.max || 50; this.entries = []; this.storage = o.storage || null; this.key = o.key || "cognicopia_agent_diag"; }
  /* Only whitelisted keys with the right kind of value are kept: a name or a note cannot get in by accident. */
  static clean(e) {
    const out = {};
    for (const k of Object.keys(DIAG_KEYS)) {
      const v = e[k], kind = DIAG_KEYS[k];
      if (kind === "number" && Number.isFinite(v)) out[k] = Math.round(v);
      else if (kind === "boolean" && typeof v === "boolean") out[k] = v;
      else if (kind === "enum" && ENUMS[k] && ENUMS[k].includes(v)) out[k] = v;
      else if (k === "at" && typeof v === "string" && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v)) out[k] = v;
      else if (kind === "array" && Array.isArray(v)) out[k] = v.map((s) => ({ stage: STAGES.includes(s.stage) ? s.stage : "other", agent: /^[A-Za-z0-9]{1,40}$/.test(String(s.agent)) ? String(s.agent) : "agent", ms: Math.round(Number(s.ms) || 0), ok: !!s.ok })).slice(0, 12);
    }
    return Object.freeze(out);
  }
  record(e) {
    const c = DiagnosticLog.clean(e); this.entries.push(c); if (this.entries.length > this.max) this.entries.shift();
    if (this.storage) { try { this.storage.setItem(this.key, JSON.stringify(this.entries.slice(-20))); } catch (x) { /* storage full or blocked: the log is memory-only */ } }
    return c;
  }
  last(n = 10) { return this.entries.slice(-n); }
}

/* ---------- the base agent ---------- */
export const CLINICAL_SYSTEM_PROMPT = [
  "You write activities for adults living with memory loss, for use by assisted living and memory care staff.",
  "Write for an adult relative: warm, plain and respectful. Invite, never test. Never ask a person to recall a fact or a date.",
  "Never correct. Affirm the person's lived reality and feelings; do not argue about historical facts.",
  "Every task must be doable with no wrong answer: offer either-or choices and open invitations.",
  "Use large-print friendly short sentences. No baby talk, no pet names, no childish words.",
  "Use only the {name}-style tokens you are given; never invent a name, a date or a fact about a person.",
  "Return JSON with pages.resident.blocks, pages.caregiver.steps (Visual Cue, Verbal Anchor, Validation Statement), pages.caregiver.safetyNotice and pages.sensory.items.",
  "This supports staff; it is not medical advice and does not replace a resident's care plan."
].join(" ");

export class CognicopiaAgent {
  constructor(o = {}) {
    this.name = o.name || this.constructor.name;
    this.role = o.role || "Geriatric cognitive care activity specialist";
    this.goal = o.goal || "Help care staff offer dignified, safe, personally meaningful activities that need no recall and allow no failure.";
    this.systemPrompt = o.systemPrompt || CLINICAL_SYSTEM_PROMPT;
    this.stage = o.stage || "generate";
    this.capabilities = Object.freeze(o.capabilities || []);
  }
  /* Read the context, return it (changed or not). Overridden by every real agent. */
  async handle(ctx) { return ctx; }
  ping() { return { ok: true, name: this.name, stage: this.stage, role: this.role, version: VERSION }; }
}

/* ---------- the built-in local template: era, tier and what is known ---------- */
const ERA_ANCHORS = Object.freeze({
  "1940s": ["radio programs and big-band music", "victory gardens and home canning", "train travel"],
  "1950s": ["early television", "diners and soda fountains", "drive-in theaters", "rock and roll on the radio"],
  "1960s": ["transistor radios", "folk and Motown music", "family comedies on television"],
  "1970s": ["station wagons and family road trips", "color television", "crafts such as macramé and crocheted afghans"],
  "1980s": ["cassette tapes", "home video rentals", "shopping malls"],
  "mixed": ["music on the radio", "kitchens and home cooking", "the changing seasons", "gardens and flowers"]
});
const FONT_PT = Object.freeze({ 1: 18, 2: 20, 3: 24 });
const SENSORY = Object.freeze({
  1: [["Sound", "Play a song from their years, softly, and let them choose to join in."], ["Touch", "Offer a smooth stone, a soft cloth or a wooden spoon to hold."], ["Sight", "Set out one or two large, clear photographs or a seed catalog page."]],
  2: [["Sound", "Play one familiar, unhurried song. Lower the volume if they turn away."], ["Touch", "Offer one large textured item, such as a knitted square or a wooden spoon."], ["Sight", "Show a single large picture with strong outlines on a plain background."]],
  3: [["Sound", "Hum or play one gentle, familiar tune at low volume."], ["Touch", "Place a warm, soft cloth in their hands, and let them hold it or not."], ["Sight", "Hold one large picture steadily within easy view, in good light."]]
});
const SAFETY = "Choose objects too large to swallow, free of sharp edges, and suited to this person's care plan. Skip any scent or food the person may be sensitive to, and stop if they show distress.";

/* One local template for any tier, era and amount of knowledge. Deterministic: the same input gives the same sheet. */
export function builtinTemplate(ctx) {
  const profile = ctx.profile, tier = ctx.tier, tok = tokensOf(profile);
  const avoided = avoidMatcher(ctx.avoid || profile.avoid), fine = (t) => !avoided(substitute(t, tok));   // anything on the keep-off list is never produced
  const anchors = ((profile.anchors.length ? profile.anchors : (ERA_ANCHORS[profile.era] || ERA_ANCHORS.mixed)).filter(fine).slice(0, 3));
  if (!anchors.length) anchors.push(...ERA_ANCHORS.mixed.filter(fine).slice(0, 3));
  let themes = [];
  if (profile.family.length) themes.push("The people close to you: {family}");
  if (profile.pets.length) themes.push("The animals you loved: {pets}");
  if (profile.career) themes.push("The work you did: {career}");
  if (profile.hometown) themes.push("Where you grew up: {hometown}");
  if (profile.preferences.length) themes.push("Something you enjoy: {hobby}");
  (ERA_ANCHORS[profile.era] || ERA_ANCHORS.mixed).forEach((a) => { if (themes.length < 5) themes.push("From " + (profile.era ? "the " + profile.era : "your years") + ": " + a); });
  themes = themes.filter(fine);
  const invites = themes.slice(0, tier === 3 ? 3 : tier === 2 ? 4 : 5).map((t) => t.replace(/^[^:]+:\s*/, "").length ? "Tell me about " + t.replace(/^[^:]+:\s*/, "") + "." : "Tell me about your day.");
  const choicePairs = [["a quiet song", "a lively song"], ["the morning", "the evening"], ["a garden", "a kitchen"]].slice(0, tier === 3 ? 1 : 2);
  const mood = /agitat|anxious|restless|upset|distress|tearful/i.test(profile.notes) ? "calm" : /interest|enjoy|smil|happy|engag/i.test(profile.notes) ? "engaged" : "neutral";
  const calmNote = mood === "calm" ? "Today's notes mention unease: keep the room quiet, offer one item at a time, and let them set the pace." : "";
  const raw = {
    title: profile.name ? "{name}'s Memory Sheet" : "Memory Lane Sheet",
    theme: themes[0] || "Comfort and familiar things", tier, era: profile.era || "mixed", fontPt: FONT_PT[tier],
    pages: {
      resident: { heading: profile.name ? "{name}, here are some things from your life" : "Some things from your life", fontPt: FONT_PT[tier], blocks: [
        { type: "anchors", title: "From your time", items: anchors },
        { type: "prompts", title: "We can talk about", items: invites },
        { type: "choices", title: "Which would you like?", items: choicePairs.map(([a, b]) => ({ a, b })) }
      ] },
      caregiver: { heading: "Staff Facilitation Protocol", steps: [
        { order: 1, label: "Visual Cue", text: "Sit at eye level in good light. Show the large picture or item from page 1 and let them look for as long as they like." },
        { order: 2, label: "Verbal Anchor", text: "Say one short, warm sentence about it, such as \"" + (anchors[0] ? "This looks like " + anchors[0] + "." : "This looks like something from long ago.") + "\" Then wait quietly." },
        { order: 3, label: "Validation Statement", text: "Whatever they say or feel, join it: \"That sounds like it mattered to you.\" Do not correct. Follow where they take the conversation." }
      ], notes: ["Offer choices, not questions to answer. Any response, a gesture or a silence, is a good response.", calmNote, "Stop at the first sign of tiredness. Record what they enjoyed in the daily notes."].filter(Boolean),
        safetyNotice: "Affirm the resident's lived reality; never debate historical facts." },
      sensory: { heading: "Sensory Guidance", items: SENSORY[tier].map(([sense, text]) => ({ sense, text })), safety: SAFETY }
    }
  };
  return substituteDeep(raw, tok);
}
export function substituteDeep(v, tokens) {
  if (typeof v === "string") return substitute(v, tokens);
  if (Array.isArray(v)) return v.map((x) => substituteDeep(x, tokens));
  if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = substituteDeep(v[k], tokens); return o; }
  return v;
}

/* Which personal details actually reached the sheet, for the preview's summary tag. Read from the finished text, so it is never a guess. */
export function customizationOf(profile, asset, mode, shared) {
  const text = [asset && asset.title, asset && asset.theme, assetText(asset)].join("\n"), out = [], seen = (v) => !!v && text.includes(v);
  if (mode === MODES.GROUP) { (shared || []).slice(0, 6).forEach((s) => out.push({ label: "Shared theme", value: s.kind === "hometown" ? "a shared place" : s.key })); return out; }
  if (seen(profile.name)) out.push({ label: "Resident name", value: profile.name });
  const fam = profile.family.filter(seen); if (fam.length) out.push({ label: "Family member names", value: fam.join(", ") });
  const pets = profile.pets.filter(seen); if (pets.length) out.push({ label: "Pet names", value: pets.join(", ") });
  if (seen(profile.career)) out.push({ label: "Career reference", value: profile.career });
  if (seen(profile.hometown)) out.push({ label: "Hometown", value: profile.hometown });
  const anchors = profile.anchors.filter(seen); if (anchors.length) out.push({ label: "Nostalgia anchors", value: anchors.join(", ") });
  const likes = profile.preferences.filter(seen); if (likes.length) out.push({ label: "Interests", value: likes.join(", ") });
  if (asset && asset.era && asset.era !== "mixed") out.push({ label: "Era anchors", value: asset.era });
  if (asset && Array.isArray(asset.deepTags)) asset.deepTags.forEach((t) => { if (t && t.label && t.value) out.push({ label: String(t.label), value: String(t.value) }); });   // set by a template that took part in the sheet (the reminiscence engine)
  return out;
}

/* ---------- group mode: what the residents have in common ---------- */
export function sharedThemes(profiles) {
  const n = profiles.length, tally = new Map();
  const bump = (kind, key) => { if (!key) return; const k = kind + "|" + String(key).toLowerCase(); const e = tally.get(k) || { kind, key: String(key), count: 0 }; e.count += 1; tally.set(k, e); };
  profiles.forEach((p) => {
    new Set([p.era]).forEach((x) => bump("era", x));
    new Set(categoriesOf(p)).forEach((x) => bump("interest", x));
    bump("hometown", p.hometown); new Set(p.pets.length ? ["pets"] : []).forEach((x) => bump("interest", x));
    new Set(p.anchors.map((a) => a.toLowerCase())).forEach((x) => bump("anchor", x));
  });
  return [...tally.values()].filter((e) => e.count >= Math.min(2, n)).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/* ---------- the generate stage ---------- */
export class GenerationAgent extends CognicopiaAgent {
  constructor(o = {}) {
    super({ name: "GenerationAgent", stage: "generate", role: "Activity generator for individual, group and express modes", capabilities: ["individual", "group", "express"], ...o });
    this.templates = new Map([["default", builtinTemplate]]); this.llm = o.llm || null; this.breaker = o.breaker || new CircuitBreaker();
  }
  registerLocalTemplate(name, fn) { if (typeof fn === "function") this.templates.set(name, fn); return this; }
  template(name) { return this.templates.get(name) || this.templates.get("default"); }
  /* A prompt that carries no name: tokens stand where names belong. */
  buildPrompt(ctx) {
    const p = ctx.profile;
    return [`Mode: ${ctx.mode}.`, `Cognitive tier: ${ctx.tier} (${TIER_NAMES[ctx.tier]}).`, `Formative era: ${p.era || "mixed 1940s to 1980s"}.`,
      `Interest categories: ${categoriesOf(p).join(", ") || "none given"}.`, ctx.mode === MODES.GROUP ? `Shared themes: ${(ctx.shared || []).slice(0, 4).map((s) => s.kind + ":" + (s.kind === "hometown" ? "a shared place" : s.key)).join(", ") || "none"}.` : "",
      "Use these tokens where a personal detail belongs: {name} {family} {pets} {career} {hometown} {anchor} {hobby}.", ctx.concept ? `Concept: ${clip(ctx.concept, 80)}.` : ""].filter(Boolean).join("\n");
  }
  async handle(ctx) {
    const t0 = ctx.clock();
    let source = "local", reason = ctx.llm ? "" : "no_provider", llmMs = 0, asset = null;
    const llm = ctx.llm || this.llm;
    if (llm) {
      const r = await this.breaker.exec((signal) => llm({ system: this.systemPrompt, prompt: this.buildPrompt(ctx), signal, mode: ctx.mode, tier: ctx.tier }));
      llmMs = r.ms; reason = r.ok ? "" : r.reason;
      if (r.ok) {
        let v = r.value; if (typeof v === "string") { try { v = JSON.parse(v); } catch (e) { v = null; } }
        const bad = v ? validateAsset(v) : ["unreadable"];
        if (bad.length) reason = "invalid_response";
        else { const filled = substituteDeep(v, tokensOf(ctx.profile)); if (dignityProblems(assetText(filled)).length) reason = "dignity_failed"; else { asset = filled; source = "llm"; reason = ""; } }
      }
    }
    if (!asset) asset = substituteDeep(this.template(ctx.templateName)(ctx), tokensOf(ctx.profile));   // whoever wrote the template, no brace reaches a page
    ctx.asset = Object.assign({ v: VERSION, mode: ctx.mode }, asset);
    ctx.asset.customization = customizationOf(ctx.profile, ctx.asset, ctx.mode, ctx.shared);
    ctx.source = source; ctx.fallbackReason = reason; ctx.llmMs = llmMs; ctx.generateMs = ctx.clock() - t0;
    return ctx;
  }
}

/* ---------- the orchestrator ---------- */
export class AgentOrchestrator {
  constructor(o = {}) {
    this.clock = o.clock || (() => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()));
    this.generator = new GenerationAgent({ llm: o.llm || null, breaker: o.breaker });
    this.log = o.log || new DiagnosticLog({ storage: o.storage || null });
    this.offline = typeof o.offline === "function" ? o.offline : () => (typeof navigator !== "undefined" && navigator.onLine === false);
    this.registry = new Map(); this.use(this.generator);
  }
  /* Add an agent. One agent per name; a second generate-stage agent replaces the built-in one. */
  use(agent) {
    if (!(agent instanceof CognicopiaAgent)) throw new TypeError("an agent must extend CognicopiaAgent");
    if (!STAGES.includes(agent.stage)) throw new RangeError("unknown stage: " + agent.stage);
    this.registry.set(agent.name, agent); return this;
  }
  registerLocalTemplate(name, fn) { this.generator.registerLocalTemplate(name, fn); return this; }
  agents() { return [...this.registry.values()]; }
  agentsFor(stage) { return this.agents().filter((a) => a.stage === stage); }
  /* The links between agents: which stage has someone, and does each answer a ping. */
  integrity() {
    const stages = STAGES.map((s) => ({ stage: s, agents: this.agentsFor(s).map((a) => a.name), covered: this.agentsFor(s).length > 0 }));
    const pings = this.agents().map((a) => { try { const r = a.ping(); return { name: a.name, ok: !!(r && r.ok) }; } catch (e) { return { name: a.name, ok: false }; } });
    return { ok: stages.every((s) => s.covered || s.stage === "analyze" || s.stage === "preview") && pings.every((p) => p.ok), stages, pings, breaker: this.generator.breaker.state() };
  }
  /* request: { mode?, profile?, profiles?, concept?, options?: { tier, llm, template } } */
  async execute(request) {
    const t0 = this.clock(), req = request && typeof request === "object" ? request : {}, opts = req.options || {};
    const profiles = (Array.isArray(req.profiles) && req.profiles.length ? req.profiles : [req.profile || {}]).slice(0, 40).map(normalizeProfile);
    let mode = Object.values(MODES).includes(req.mode) ? req.mode : (profiles.length > 1 ? MODES.GROUP : profiles[0].hasData >= 2 ? MODES.INDIVIDUAL : MODES.EXPRESS);
    if (req.mode && !Object.values(MODES).includes(req.mode)) return { ok: false, error: "unknown_mode" };
    if (mode === MODES.GROUP && profiles.length < 2) mode = profiles[0].hasData >= 2 ? MODES.INDIVIDUAL : MODES.EXPRESS;
    const gentlest = Math.max(...profiles.map((p) => p.tier));       // the highest tier number is the gentlest tasks: everyone can take part
    const tier = normalizeTier(opts.tier, mode === MODES.GROUP ? gentlest : profiles[0].tier);
    let profile = profiles[0];
    if (mode === MODES.EXPRESS) profile = normalizeProfile({ formativeEra: profiles[0].era, ailmentTier: tier });
    const shared = mode === MODES.GROUP ? sharedThemes(profiles) : [];
    if (mode === MODES.GROUP) {   // the group's own sheet: shared anchors and interests, no one's name or private detail
      const anchors = shared.filter((s) => s.kind === "anchor").map((s) => s.key);
      const interests = shared.filter((s) => s.kind === "interest").map((s) => s.key);
      const eras = shared.filter((s) => s.kind === "era").map((s) => s.key);
      profile = normalizeProfile({ formativeEra: eras[0] || "", ailmentTier: tier, nostalgiaAnchors: anchors, preferences: interests, hometown: (shared.find((s) => s.kind === "hometown") || {}).key || "" });
    }
    const ctx = { request: req, mode, tier, profile, profiles, shared, concept: clip(req.concept, 80), llm: opts.llm || null, templateName: opts.template || "default", avoid: [...new Set(profiles.flatMap((p) => p.avoid))], clock: this.clock, notesText: profiles.map((p) => p.notes).filter(Boolean).join(" \n "), stages: [], analysis: null, asset: null, audit: null };
    for (const stage of STAGES) {
      for (const agent of this.agentsFor(stage)) {
        if (stage === "preview" && !opts.preview) continue;
        const s0 = this.clock();
        try { await agent.handle(ctx); ctx.stages.push({ stage, agent: agent.name, ms: this.clock() - s0, ok: true }); }
        catch (e) { ctx.stages.push({ stage, agent: agent.name, ms: this.clock() - s0, ok: false }); if (stage === "audit") ctx.audit = { status: "not_run", problems: ["the audit agent failed"] }; if (stage === "generate" && !ctx.asset) ctx.asset = Object.assign({ v: VERSION, mode }, builtinTemplate(ctx)); }
      }
    }
    if (!ctx.asset) ctx.asset = Object.assign({ v: VERSION, mode }, builtinTemplate(ctx));
    if (!ctx.audit) ctx.audit = { status: "not_run", problems: [] };
    const diagnostics = this.log.record({ v: VERSION, at: new Date().toISOString(), mode, tier, source: ctx.source || "local", reason: ctx.fallbackReason || "", offline: !!this.offline(), breaker: this.generator.breaker.state(), durationMs: this.clock() - t0, llmMs: ctx.llmMs || 0, stages: ctx.stages });
    return { ok: true, mode, tier, source: ctx.source || "local", asset: ctx.asset, audit: ctx.audit, analysis: ctx.analysis, diagnostics };
  }
}
export const createOrchestrator = (o) => new AgentOrchestrator(o);
export default createOrchestrator;
