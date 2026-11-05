/* Cognicopia Pillar 1: production scaling (Agents 5 to 9).

     5  VariationAgent          one concept at three levels, L1 to L3, made from the same request
     6  FormatAgent             individual, group and express sheets, with overrides, and custom [[token]] injection
     7  SeasonalPackAgent       a pack for the season and the coming holidays, chosen from the browser's date
     8  BulkCompiler            many sheets in one run, each checked, then one printable stack
     9  LineArtPromptArchitect  a written specification for black-and-white line art, and a checker for the finished SVG

   All five extend CognicopiaAgent, so the orchestrator's integrity check sees them. Nothing here uses the network or storage:
   a bulk run keeps its results in memory for the person who asked and nothing else. Levels follow the orchestrator's tiers:
   L1 is the mildest stage (the fullest sheet), L3 the latest (the gentlest, with the biggest print). */

import { CognicopiaAgent, normalizeTier, TIER_NAMES, MODES, assetText, avoidMatcher } from "./agent-orchestrator.js";
import { renderAllPagesHtml } from "./print-preview-modal.js";

export const VERSION = "1.0.0";
export const LEVELS = Object.freeze({ L1: 1, L2: 2, L3: 3 });
const clip = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f{}\[\]<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const listOf = (v, n, max) => (Array.isArray(v) ? v : String(v == null ? "" : v).split(/[,;\n]/)).map((x) => clip(x, n)).filter(Boolean).slice(0, max);
const tick = () => new Promise((r) => (typeof setTimeout === "function" ? setTimeout(r, 0) : r()));

/* ---------- 5. variations: L1, L2, L3 ---------- */
/* How demanding a finished sheet is: bigger grids, more pairs and notes, smaller print all raise it. Used to prove L1 > L2 > L3. */
export function difficultyOf(asset) {
  const res = (asset && asset.pages && asset.pages.resident) || {}, blocks = Array.isArray(res.blocks) ? res.blocks : [];
  let score = 0;
  for (const b of blocks) {
    if (b.type === "wordsearch") score += (b.grid || []).length * 3 + (b.words || []).length * 2;
    else if (b.type === "matching") score += (b.items || []).length * 4;
    else if (b.type === "prompts") score += (b.items || []).length * 2;
    else if (b.type === "choices") score += (b.items || []).length * 2;
    else if (b.type === "anchors") score += (b.items || []).length;
  }
  return score + Math.max(0, 28 - (Number(res.fontPt) || 18));
}
export class VariationAgent extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "VariationAgent", stage: "analyze", role: "Production: one concept at difficulty levels L1, L2 and L3", capabilities: ["L1", "L2", "L3"], ...o }); }
  async handle(ctx) { ctx.analysis = Object.assign({}, ctx.analysis, { level: "L" + ctx.tier, levelName: TIER_NAMES[ctx.tier] }); return ctx; }
  /* request: anything the orchestrator takes. Returns { L1, L2, L3, order, monotonic } where each level is a full result. */
  async generate(orchestrator, request, levels = ["L1", "L2", "L3"]) {
    const out = { order: [] };
    for (const key of levels) {
      if (!LEVELS[key]) throw new RangeError("unknown level: " + key);
      const req = Object.assign({}, request, { options: Object.assign({}, request && request.options, { tier: LEVELS[key] }) });
      out[key] = await orchestrator.execute(req); out.order.push(key); await tick();
    }
    const scores = out.order.map((k) => difficultyOf(out[k].asset));
    out.scores = Object.fromEntries(out.order.map((k, i) => [k, scores[i]]));
    out.monotonic = scores.every((s, i) => i === 0 || s < scores[i - 1]);   // each step down is easier than the last
    return out;
  }
}

/* ---------- 6. formats, overrides and custom tokens ---------- */
/* [[token]] markers are filled after the sheet is made. They are separate from the {name} tokens, which carry a resident's details and
   are filled by the generator, so a facility's own words (its name, the season, a date) can be added without touching those. */
export const CUSTOM_TOKENS = Object.freeze(["facility", "director", "season", "holiday", "date", "unit", "theme"]);
export function injectTokens(asset, values) {
  const vals = {}; for (const k of CUSTOM_TOKENS) { const v = clip(values && values[k], 80); if (v) vals[k] = v; }
  const FALL = { facility: "our community", director: "your activity team", season: "this time of year", holiday: "today", date: "today", unit: "our neighborhood", theme: "today" };
  const sub = (t) => String(t).replace(/\[\[\s*([a-z]+)\s*\]\]/gi, (m, k) => { k = k.toLowerCase(); return vals[k] || (FALL[k] !== undefined ? FALL[k] : ""); });
  const walk = (v, key) => typeof v === "string" ? (/^(type|kind|grid|spec|id)$/.test(key || "") ? v : sub(v)) : Array.isArray(v) ? v.map((x) => walk(x, key)) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).map((k) => [k, walk(v[k], k)])) : v;
  return walk(asset);
}
export const hasMarkers = (asset) => /\[\[[a-z\s]*\]\]/i.test(JSON.stringify(asset));
const OVERRIDES = Object.freeze(["tier", "concept", "deep", "tokens", "template", "branding", "avoid", "stage"]);
export class FormatAgent extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "FormatAgent", stage: "generate", role: "Production: individual, group and express formats with overrides and custom token injection", capabilities: ["individual", "group", "express", "overrides", "tokens"], ...o }); }
  /* After the generator has written the sheet: fill the facility's [[tokens]] and attach branding. */
  async handle(ctx) {
    const tokens = ctx.request && ctx.request.tokens; if (ctx.asset) ctx.asset = injectTokens(ctx.asset, tokens || {});
    const b = ctx.request && ctx.request.branding;
    if (b && typeof b === "object" && ctx.asset) {
      const logo = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(String(b.logoDataUrl || "")) && String(b.logoDataUrl).length < 400000 ? b.logoDataUrl : "";
      ctx.asset.branding = { facilityName: clip(b.facilityName, 80), headerText: clip(b.headerText, 100), logoDataUrl: logo };
    }
    return ctx;
  }
  /* format: individual | group | express. overrides: only the keys in OVERRIDES are read; anything else is ignored and listed. */
  buildRequest(format, who, overrides = {}) {
    const mode = Object.values(MODES).includes(format) ? format : null; if (!mode) throw new RangeError("unknown format: " + format);
    const ignored = Object.keys(overrides || {}).filter((k) => !OVERRIDES.includes(k));
    const o = overrides || {}, req = { mode, ignored };
    if (mode === MODES.GROUP) { const ps = Array.isArray(who) ? who : []; if (ps.length < 2) throw new RangeError("a group sheet needs at least two residents"); req.profiles = ps.slice(0, 40); }
    else if (mode === MODES.INDIVIDUAL) { const p = Array.isArray(who) ? who[0] : who; if (!p || typeof p !== "object") throw new RangeError("an individual sheet needs a resident's details"); req.profile = p; }
    else req.profile = { formativeEra: who && who.formativeEra, ailmentTier: o.tier != null ? o.tier : who && who.ailmentTier };   // express: nothing personal is read at all
    req.options = { template: typeof o.template === "string" ? o.template : "default" };
    if (o.tier != null) req.options.tier = normalizeTier(o.tier);
    if (o.concept) req.concept = clip(o.concept, 80);
    if (o.deep && typeof o.deep === "object") req.deep = o.deep;
    if (o.tokens && typeof o.tokens === "object") req.tokens = o.tokens;
    if (o.branding && typeof o.branding === "object") req.branding = o.branding;
    if (o.avoid && mode !== MODES.GROUP) req.profile = Object.assign({}, req.profile, { avoid: listOf(o.avoid, 60, 12).concat(listOf(req.profile && req.profile.avoid, 60, 12)) });
    return req;
  }
  async make(orchestrator, format, who, overrides) { const req = this.buildRequest(format, who, overrides); const r = await orchestrator.execute(req); r.ignoredOverrides = req.ignored; return r; }
}

/* ---------- 7. seasons and holidays, from the browser's date ---------- */
const SEASONS = Object.freeze({
  winter: { words: ["SNOW", "SCARF", "COCOA", "WOOL", "QUILT", "HEARTH", "MITTENS", "CANDLE"], notes: ["A warm quilt and a cup of cocoa make a winter afternoon feel cozy.", "Many families keep a favorite winter recipe that is made year after year."], concept: "Winter comforts" },
  spring: { words: ["RAIN", "TULIP", "ROBIN", "GARDEN", "SEEDS", "BLOOM", "KITE", "PICNIC"], notes: ["Robins are among the first birds many people notice in spring.", "Spring is a good time to plant seeds and watch them grow."], concept: "Spring gardens" },
  summer: { words: ["PICNIC", "PORCH", "FIREFLY", "GARDEN", "BREEZE", "SUNSHINE", "CORN", "LEMONADE"], notes: ["Fireflies light up many summer evenings.", "A glass of cold lemonade is a classic summer treat."], concept: "Summer evenings" },
  autumn: { words: ["LEAVES", "HARVEST", "APPLE", "PUMPKIN", "CIDER", "ACORN", "SCARF", "COZY"], notes: ["Apple picking is a favorite autumn outing.", "In the fall, leaves turn red, orange and gold."], concept: "Autumn harvest" }
});
const nthWeekday = (y, m, wd, n) => { const d = new Date(Date.UTC(y, m, 1)); const first = (7 + wd - d.getUTCDay()) % 7; return new Date(Date.UTC(y, m, 1 + first + 7 * (n - 1))); };
const lastWeekday = (y, m, wd) => { const d = new Date(Date.UTC(y, m + 1, 0)); return new Date(Date.UTC(y, m, d.getUTCDate() - ((7 + d.getUTCDay() - wd) % 7))); };
export function easterOf(y) {   // the anonymous Gregorian algorithm
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, mo - 1, da));
}
/* Every holiday is a day to enjoy, never a test. "gentle" ones can stir strong feelings, so they are left out unless staff ask. "religious" ones likewise. */
export const HOLIDAYS = Object.freeze([
  { id: "new-year", name: "New Year's Day", when: (y) => new Date(Date.UTC(y, 0, 1)), words: ["CALENDAR", "MUSIC", "FRIENDS", "TOAST"], notes: ["A new year is a good time to enjoy old favorites."] },
  { id: "valentines", name: "Valentine's Day", when: (y) => new Date(Date.UTC(y, 1, 14)), words: ["HEART", "CARD", "ROSE", "SWEET"], notes: ["Handwritten cards have long been a way to say something kind."] },
  { id: "st-patricks", name: "St. Patrick's Day", when: (y) => new Date(Date.UTC(y, 2, 17)), words: ["CLOVER", "GREEN", "MUSIC", "DANCE"], notes: ["Green clovers are a cheerful sign of the day."] },
  { id: "independence", name: "Independence Day", when: (y) => new Date(Date.UTC(y, 6, 4)), words: ["PARADE", "PICNIC", "MUSIC", "FLAG"], notes: ["Parades, picnics and music are part of many Fourth of July days."] },
  { id: "thanksgiving", name: "Thanksgiving", when: (y) => nthWeekday(y, 10, 4, 4), words: ["HARVEST", "TURKEY", "FAMILY", "PIE"], notes: ["Many families share a meal and say what they are thankful for."] },
  { id: "winter-celebrations", name: "Winter celebrations", when: (y) => new Date(Date.UTC(y, 11, 15)), words: ["LIGHTS", "CANDLE", "SNOW", "MUSIC"], notes: ["Lights, music and time with family brighten the winter evenings."] },
  { id: "mothers-day", name: "Mother's Day", gentle: true, when: (y) => nthWeekday(y, 4, 0, 2), words: ["FLOWERS", "FAMILY", "CARD", "THANKS"], notes: ["Many families send flowers or call to say thank you."] },
  { id: "fathers-day", name: "Father's Day", gentle: true, when: (y) => nthWeekday(y, 5, 0, 3), words: ["FAMILY", "GARDEN", "CARD", "THANKS"], notes: ["Many families spend the day together or call to say thank you."] },
  { id: "memorial-day", name: "Memorial Day", gentle: true, when: (y) => lastWeekday(y, 4, 1), words: ["FLOWERS", "PARADE", "FLAG", "FAMILY"], notes: ["Many communities hold quiet parades and place flowers."] },
  { id: "easter", name: "Easter", religious: true, when: (y) => easterOf(y), words: ["SPRING", "LILY", "BASKET", "FAMILY"], notes: ["Spring flowers and family meals are part of many Easter days."] },
  { id: "christmas", name: "Christmas", religious: true, when: (y) => new Date(Date.UTC(y, 11, 25)), words: ["CAROLS", "WREATH", "CANDLE", "FAMILY"], notes: ["Carols and family gatherings are part of many Christmas days."] }
]);
export function seasonOf(date, hemisphere = "north") {
  const d = date instanceof Date && !isNaN(date) ? date : new Date(), m = d.getMonth();     // the browser's own date, in its own time zone
  const north = m >= 2 && m <= 4 ? "spring" : m >= 5 && m <= 7 ? "summer" : m >= 8 && m <= 10 ? "autumn" : "winter";
  const flip = { spring: "autumn", summer: "winter", autumn: "spring", winter: "summer" };
  return hemisphere === "south" ? flip[north] : north;
}
export class SeasonalPackAgent extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "SeasonalPackAgent", stage: "analyze", role: "Production: seasonal and holiday pack assembler", capabilities: ["season", "holidays", "pack"], ...o }); this.now = o.now || (() => new Date()); }
  /* If a request names a season pack, add its words and notes to the sheet's deep settings. */
  async handle(ctx) {
    const sp = ctx.request && ctx.request.seasonal; if (!sp) return ctx;
    const item = this.itemFor(sp.date ? new Date(sp.date) : this.now(), sp);
    ctx.analysis = Object.assign({}, ctx.analysis, { season: item.season, holiday: item.holiday });
    const d = ctx.request.deep = Object.assign({}, ctx.request.deep, { themeWords: [...(ctx.request.deep && ctx.request.deep.themeWords || []), ...item.words].slice(0, 8), notes: [...(ctx.request.deep && ctx.request.deep.notes || []), ...item.notes].slice(0, 4) });
    if (ctx.deep) { ctx.deep.themeWords = d.themeWords.slice(); ctx.deep.notes = d.notes.slice(); }
    return ctx;
  }
  upcoming(date, o = {}) {
    const d = date instanceof Date && !isNaN(date) ? date : this.now(), days = Math.max(0, Math.min(60, Number(o.windowDays == null ? 21 : o.windowDays)));
    const today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()), out = [], custom = (Array.isArray(o.customHolidays) ? o.customHolidays : []).map((c) => ({ id: "custom-" + clip(c && c.name, 30), name: clip(c && c.name, 60), when: () => new Date(String(c && c.date) + "T00:00:00Z"), words: listOf(c && c.words, 12, 6).map((w) => w.toUpperCase()), notes: listOf(c && c.notes, 140, 2) })).filter((c) => c.name && !isNaN(c.when()));
    for (const h of [...HOLIDAYS, ...custom]) {
      if (h.gentle && !o.includeGentle) continue; if (h.religious && !o.includeReligious) continue;
      for (const y of [d.getFullYear(), d.getFullYear() + 1]) { const t = h.when(y).getTime(), diff = Math.round((t - today) / 86400000); if (diff >= 0 && diff <= days) { out.push({ id: h.id, name: h.name, inDays: diff, date: new Date(t).toISOString().slice(0, 10), words: h.words, notes: h.notes }); break; } }
    }
    return out.sort((a, b) => a.inDays - b.inDays);
  }
  itemFor(date, o = {}) {
    const season = seasonOf(date, o.hemisphere), s = SEASONS[season], hol = this.upcoming(date, o)[0] || null;
    const words = hol ? [...hol.words, ...s.words] : s.words, notes = hol ? [...hol.notes, ...s.notes] : s.notes;
    return { season, holiday: hol ? hol.name : "", words: [...new Set(words)].slice(0, 8), notes: notes.slice(0, 4), concept: hol ? hol.name : s.concept };
  }
  /* assemblePack({ date?, count?, hemisphere?, includeGentle?, includeReligious?, customHolidays?, profile? }) -> { season, holidays, items, requests } */
  assemblePack(o = {}) {
    const date = o.date ? new Date(o.date) : this.now(); if (isNaN(date)) throw new RangeError("the date is not a date");
    const count = Math.max(1, Math.min(8, Math.floor(o.count) || 4)), season = seasonOf(date, o.hemisphere), s = SEASONS[season], hols = this.upcoming(date, o);
    const items = [];
    for (const h of hols.slice(0, Math.ceil(count / 2))) items.push({ kind: "holiday", label: h.name, inDays: h.inDays, words: [...h.words, ...s.words].slice(0, 8), notes: [...h.notes, ...s.notes].slice(0, 4), concept: h.name });
    let i = 0; while (items.length < count) { const k = i++; items.push({ kind: "season", label: s.concept + (k ? " " + (k + 1) : ""), words: rotate(s.words, k).slice(0, 8), notes: rotate(s.notes, k).slice(0, 4), concept: s.concept }); }
    const requests = items.map((it, n) => ({ profile: o.profile || {}, concept: it.concept, deep: { themeWords: it.words, notes: it.notes, focus: "seasons", variant: n }, tokens: { season, holiday: it.kind === "holiday" ? it.label : "", theme: it.label, date: date.toISOString().slice(0, 10) }, options: Object.assign({ template: o.template || "reminiscence" }, o.tier ? { tier: o.tier } : {}) }));
    return { season, date: date.toISOString().slice(0, 10), holidays: hols, items, requests };
  }
}
const rotate = (a, k) => a.slice(k % a.length).concat(a.slice(0, k % a.length));

/* ---------- 8. bulk compilation ---------- */
export class BulkCompiler extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "BulkCompiler", stage: "preview", role: "Production: bulk packet compilation", capabilities: ["bulk", "print-stack"], ...o }); this.max = o.max || 200; }
  async handle(ctx) { return ctx; }
  /* requests: an array of what the orchestrator takes. One failure never stops the run. Returns { items, summary }. */
  async compile(orchestrator, requests, o = {}) {
    const list = Array.isArray(requests) ? requests.slice(0, Math.min(this.max, o.max || this.max)) : [], items = [];
    const summary = { requested: Array.isArray(requests) ? requests.length : 0, attempted: list.length, made: 0, pass: 0, fixed: 0, blocked: 0, failed: 0, cancelled: false, skipped: Math.max(0, (Array.isArray(requests) ? requests.length : 0) - list.length) };
    for (let i = 0; i < list.length; i++) {
      if (typeof o.shouldCancel === "function" && o.shouldCancel()) { summary.cancelled = true; break; }
      try {
        const r = await orchestrator.execute(list[i]); if (!r || r.ok === false) throw new Error("not made"); const st = r.audit && r.audit.status || "not_run";
        items.push({ index: i, ok: true, status: st, mode: r.mode, tier: r.tier, asset: r.asset }); summary.made++;
        if (st === "pass") summary.pass++; else if (st === "fixed") summary.fixed++; else if (st === "blocked") summary.blocked++;
      } catch (e) { items.push({ index: i, ok: false, status: "failed", error: "this sheet could not be made" }); summary.failed++; }   // a generic line: the message itself could carry a name
      if (typeof o.onProgress === "function") { try { o.onProgress({ done: i + 1, total: list.length }); } catch (e) { /* a broken progress callback never stops the run */ } }
      await tick();
    }
    return { items, summary };
  }
  /* The printable stack: every sheet that may print, three pages each, in order. A blocked or failed sheet is left out and counted. */
  printStack(items) {
    const ok = (items || []).filter((x) => x && x.ok && x.status !== "blocked" && x.asset);
    return { html: ok.map((x) => renderAllPagesHtml(x.asset)).join(""), sheets: ok.length, pages: ok.length * 3, left_out: (items || []).length - ok.length };
  }
}

/* ---------- 9. line art: the written specification and the checker ---------- */
export const LINE_ART = Object.freeze({ aspect: "3:4", viewBox: "0 0 600 800", minStrokePt: 3, minStrokePx: 4, colors: Object.freeze(["#000", "#000000", "black", "#fff", "#ffffff", "white", "none"]) });
const SUBJECTS = Object.freeze([[/music|piano|song|hymn|sing|radio/i, "an upright piano with an open songbook"], [/garden|flower|plant|farm|seed/i, "a watering can beside tall sunflowers"], [/cook|bak|kitchen|pie|bread|recipe/i, "a rolling pin, a pie and a wooden spoon"], [/knit|sew|craft|quilt|yarn|crochet/i, "a ball of yarn with knitting needles"], [/bird|robin|feeder/i, "a bird feeder with two songbirds"], [/fish|lake|boat/i, "a rowboat on a calm lake"], [/car|truck|tractor/i, "a pickup truck beside a barn"]]);
export class LineArtPromptArchitect extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "LineArtPromptArchitect", stage: "analyze", role: "Production: black-and-white vector line art specifications", capabilities: ["line-art-spec", "svg-check"], ...o }); }
  async handle(ctx) {
    const p = ctx.profile || {}, subject = this.subjectFor(p, ctx.avoid);
    ctx.analysis = Object.assign({}, ctx.analysis, { lineArt: { subject, detail: this.detailFor(ctx.tier) } }); return ctx;
  }
  detailFor(tier) { const t = normalizeTier(tier); return { 1: { maxShapes: 14, minShapePx: 40, note: "a full scene with a few small details" }, 2: { maxShapes: 8, minShapePx: 70, note: "a clear scene with medium shapes" }, 3: { maxShapes: 4, minShapePx: 140, note: "one large simple subject with very big shapes" } }[t]; }
  subjectFor(profile, avoid) {
    const fine = (t) => !avoidMatcher(avoid || (profile && profile.avoid) || [])(t), text = [(profile && profile.preferences || []).join(" "), profile && profile.career, (profile && profile.anchors || []).join(" ")].join(" ");
    for (const [re, subject] of SUBJECTS) if (re.test(text) && fine(subject)) return subject;
    return ["a teapot with a cup and saucer", "a vase of daisies on a table", "a rocking chair by a window"].find(fine) || "a simple vase of flowers";
  }
  /* A written specification only. It describes the art; it does not make any, and nothing here calls a picture service. */
  spec(o = {}) {
    const subject = clip(o.subject, 120) || "a vase of daisies on a table", d = this.detailFor(o.tier);
    return {
      subject, aspect: LINE_ART.aspect, viewBox: LINE_ART.viewBox, detail: d,
      prompt: `Black outline drawing of ${subject}, ${d.note}. Clean vector line art, pure black lines on a pure white background, one even line weight, every shape drawn as a closed outline, a single centered subject on a 3:4 portrait page, calm and dignified, suitable for an adult to color.`,
      negativePrompt: "gray, grey, shading, gradient, halftone, hatching, texture, fill, shadow, color, photo, cartoon, childish, baby, cute faces, text, letters, watermark, broken lines, open shapes, tiny details",
      rules: { colorMode: "1-bit: pure black (#000) on pure white (#fff), no gray at all", minStrokePt: LINE_ART.minStrokePt, minStrokePx: LINE_ART.minStrokePx, closedOutlines: true, noFillExceptWhite: true, maxShapes: d.maxShapes, minShapePx: d.minShapePx }
    };
  }
  /* Check a finished SVG against the print standards: black and white only, lines of 3 pt or more, closed shapes, a 3:4 page. */
  checkSvg(svg) {
    const problems = [], s = String(svg == null ? "" : svg);
    if (!/<svg[\s>]/i.test(s)) return { ok: false, problems: ["not an SVG"] };
    const vb = /viewBox\s*=\s*["']\s*([\d.\-]+)[\s,]+([\d.\-]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i.exec(s);
    if (!vb) problems.push("no viewBox"); else if (Math.abs(Number(vb[3]) / Number(vb[4]) - 0.75) > 0.01) problems.push("the page is not 3:4 (" + vb[3] + " x " + vb[4] + ")");
    if (/<(image|filter|linearGradient|radialGradient|pattern|mask|foreignObject|script)\b/i.test(s)) problems.push("contains an image, gradient, filter, pattern or script");
    if (/(?:opacity|fill-opacity|stroke-opacity)\s*[:=]\s*["']?(?!1\b)0?\.?\d/i.test(s)) problems.push("uses transparency, which prints as gray");
    const colors = [...s.matchAll(/(?:fill|stroke|stop-color|color)\s*[:=]\s*["']?\s*([#\w(),.% ]+?)\s*(?=["';}\s>\/])/gi)].map((m) => m[1].toLowerCase());
    const badColor = colors.filter((c) => !LINE_ART.colors.includes(c) && c !== "currentcolor" && c !== "none");
    if (badColor.length) problems.push("a color other than black and white: " + [...new Set(badColor)].slice(0, 3).join(", "));
    const px = (v) => { const m = /^([\d.]+)\s*(pt|px)?$/i.exec(String(v).trim()); return m ? Number(m[1]) * (m[2] && m[2].toLowerCase() === "pt" ? 96 / 72 : 1) : NaN; };
    const shapes = [...s.matchAll(/<(path|rect|circle|ellipse|polygon|polyline|line)\b([^>]*)>/gi)].map((m) => ({ tag: m[1].toLowerCase(), attrs: m[2] }));
    if (!shapes.length) problems.push("no shapes");
    let thin = 0, open = 0;
    for (const sh of shapes) {
      const stroked = /stroke\s*[:=]\s*["']?(?!none\b)(?![\"'])/i.test(sh.attrs), w = /stroke-width\s*[:=]\s*["']?([\d.]+\s*(?:pt|px)?)/i.exec(sh.attrs);
      if (stroked && (!w || !(px(w[1]) >= LINE_ART.minStrokePx - 0.001))) thin++;
      if (sh.tag === "line" || sh.tag === "polyline") open++;
      if (sh.tag === "path") { const d = /\sd\s*=\s*["']([^"']*)["']/i.exec(sh.attrs); const dd = d ? d[1] : ""; const subs = (dd.match(/[Mm]/g) || []).length, closed = (dd.match(/[Zz]/g) || []).length; if (subs > closed) open++; }
    }
    if (thin) problems.push(thin + " line(s) thinner than 3 pt (4 px) or with no stated width");
    if (open) problems.push(open + " shape(s) are not closed outlines");
    return { ok: problems.length === 0, problems, shapes: shapes.length };
  }
}

/* ---------- wiring ---------- */
export const PILLAR1_AGENTS = Object.freeze(["VariationAgent", "FormatAgent", "SeasonalPackAgent", "BulkCompiler", "LineArtPromptArchitect"]);
export function registerPillar1(orchestrator, o = {}) {
  if (!orchestrator || typeof orchestrator.use !== "function") throw new TypeError("registerPillar1 needs an orchestrator");
  const agents = { variation: new VariationAgent(), format: new FormatAgent(), seasonal: new SeasonalPackAgent(o), bulk: new BulkCompiler(o), lineArt: new LineArtPromptArchitect() };
  Object.values(agents).forEach((a) => orchestrator.use(a));
  return agents;
}
