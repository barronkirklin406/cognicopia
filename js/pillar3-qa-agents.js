/* Cognicopia Pillar 3: quality assurance (Agents 16 to 20).

     16  PrivacySentinel          looks for personal identifiers in text, sheets and outgoing payloads, and watches the network calls a page makes
     17  CustomizationValidator   checks what staff typed into a customization before a sheet is made from it
     18  AccessibilityChecker     WCAG-minded checks of a sheet and of a page: contrast, size, labels, keyboard, plain language
     19  FeedbackCategorizer      sorts beta feedback into categories, severity and sentiment, with identifiers removed
     20  ClientCommsAssistant     drafts replies to facility emails from checked facts, for a person to review

   Honest limits. The sentinel DETECTS and MONITORS; it cannot prove that nothing leaks, and the site's real protection is that its tools
   make no network request at all (npm run build checks that). A pattern finds the identifiers it knows (numbers, emails, dates of birth,
   record numbers, street addresses, card numbers) and the names it is told; it cannot find a name it was not given. The assistant only
   drafts: it never sends anything, and it never states a claim the product cannot back. */

import { CognicopiaAgent, assetText, dignityProblems, avoidMatcher } from "./agent-orchestrator.js";
import { memoryStorage } from "./pillar2-functionality-agents.js";

export const VERSION = "1.0.0";
const clip = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

/* ---------- 16. privacy sentinel ---------- */
const MONTHS = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const PATTERNS = Object.freeze([
  ["ssn", /\b(?!000|666|9\d\d)\d{3}[- ](?!00)\d{2}[- ](?!0000)\d{4}\b/g],
  ["email", /\b[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+\b/gi],
  ["phone", /(?<![\d-])(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-])\d{3}[\s.-]\d{4}(?![\d-])/g],
  ["dob", new RegExp("\\b(?:0?[1-9]|1[0-2])[/.-](?:0?[1-9]|[12]\\d|3[01])[/.-]19\\d{2}\\b|\\b19\\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])\\b|\\b" + MONTHS + "\\.? \\d{1,2}(?:st|nd|rd|th)?,? 19\\d{2}\\b|\\b(?:dob|d\\.o\\.b\\.|date of birth)\\b[:\\s]*\\S+", "gi")],   // a resident's birth date (19xx); a current date such as 2026-11-10 is not one
  ["mrn", /\b(?:mrn|medical record(?: number| no\.?)?|patient id|resident id|chart (?:no\.?|number|#)|account (?:no\.?|number))[:#\s]*[A-Z0-9-]{4,}\b/gi],
  ["medicare", /\b[1-9][AC-HJKMNP-RT-Y][AC-HJKMNP-RT-Y0-9]\d[AC-HJKMNP-RT-Y][AC-HJKMNP-RT-Y0-9]\d[AC-HJKMNP-RT-Y]{2}\d{2}\b/g],
  ["address", /\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Boulevard|Blvd|Court|Ct|Way|Place|Pl|Circle|Cir)\b\.?/g],
  ["card", /(?<![\d-])\d(?:[ -]?\d){12,18}(?![\d-])/g]
]);
const luhn = (s) => { const d = s.replace(/\D/g, ""); if (d.length < 13 || d.length > 19) return false; let sum = 0, alt = false; for (let i = d.length - 1; i >= 0; i--) { let n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; } return sum % 10 === 0; };
export const PII_KINDS = Object.freeze([...PATTERNS.map((p) => p[0]), "name"]);
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export class PrivacySentinel extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "PrivacySentinel", stage: "audit", role: "QA: zero-PII privacy sentinel (detects and monitors; it does not prove)", capabilities: PII_KINDS.concat(["network-watch"]), ...o }); }
  /* Findings never carry the value itself: only its kind, where it was and how long it was. */
  scan(text, o = {}) {
    const t = String(text == null ? "" : text), found = [];
    for (const [kind, re] of PATTERNS) { re.lastIndex = 0; let m; while ((m = re.exec(t))) { if (kind === "card" && !luhn(m[0])) continue; if (kind === "ssn" && found.some((f) => f.kind === "card" && m.index >= f.at && m.index < f.at + f.length)) continue; found.push({ kind, at: m.index, length: m[0].length }); if (m[0].length === 0) re.lastIndex++; } }
    const names = (Array.isArray(o.names) ? o.names : []).map((n) => String(n).trim()).filter((n) => n.length >= 2);
    if (names.length) { const re = new RegExp("(?<![A-Za-z])(?:" + names.map(escRe).join("|") + ")(?![A-Za-z])", "gi"); let m; while ((m = re.exec(t))) found.push({ kind: "name", at: m.index, length: m[0].length }); }
    found.sort((a, b) => a.at - b.at);
    return { ok: found.length === 0, count: found.length, kinds: [...new Set(found.map((f) => f.kind))], findings: found };
  }
  redact(text, o = {}) {
    const t = String(text == null ? "" : text), r = this.scan(t, o); if (r.ok) return { text: t, findings: [] };
    let out = "", pos = 0;
    for (const f of r.findings) { if (f.at < pos) continue; out += t.slice(pos, f.at) + "[" + f.kind + " removed]"; pos = f.at + f.length; }
    return { text: out + t.slice(pos), findings: r.findings.map((f) => ({ kind: f.kind })) };
  }
  /* Every string inside anything: a payload, a log, a sheet. */
  scanDeep(value, o = {}) {
    const kinds = new Set(); let count = 0;
    (function walk(v, d) { if (d > 12) return; if (typeof v === "string") { const r = PrivacySentinel.prototype.scan.call({}, v, o); r.findings.forEach((f) => kinds.add(f.kind)); count += r.count; } else if (Array.isArray(v)) v.forEach((x) => walk(x, d + 1)); else if (v && typeof v === "object") Object.keys(v).forEach((k) => walk(v[k], d + 1)); })(value, 0);
    return { ok: count === 0, count, kinds: [...kinds] };
  }
  /* In the pipeline, after the clinical audit: an identifier that reached a sheet is taken out, and the sheet says so. Names are the resident's own and stay. */
  async handle(ctx) {
    if (!ctx.asset) return ctx;
    const removed = []; const clean = (v, key) => typeof v === "string" ? (/^(type|kind|grid|spec|id)$/.test(key || "") ? v : (() => { const r = this.redact(v); r.findings.forEach((f) => removed.push(f.kind)); return r.text; })()) : Array.isArray(v) ? v.map((x) => clean(x, key)) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).map((k) => [k, k === "branding" ? v[k] : clean(v[k], k)])) : v;
    ctx.asset = clean(ctx.asset);
    if (removed.length) { const a = ctx.audit || { status: "pass", fixes: [], problems: [] }; ctx.audit = Object.assign({}, a, { status: a.status === "blocked" ? "blocked" : "fixed", fixes: [...(a.fixes || []), ...[...new Set(removed)].map((k) => ({ rule: "a personal identifier was removed", where: k }))] }); }
    return ctx;
  }
  /* Watch the network calls a page makes. win is a window (or a stand-in); allow lists hosts that may be called. Same-origin, data: and blob: are always fine. */
  installNetworkGuard(win, o = {}) {
    const w = win || (typeof window !== "undefined" ? window : null); if (!w) return { attempts: () => [], restore: () => {}, blocked: () => 0 };
    const attempts = [], allow = new Set((o.allow || []).map(String)), block = !!o.block, restores = [];
    const hostOf = (u) => { try { const x = new URL(String(u), (w.location && w.location.href) || "http://localhost/"); if (/^(data|blob|about):$/.test(x.protocol)) return null; if (w.location && x.origin === w.location.origin) return null; return x.host; } catch (e) { return "unreadable"; } };
    const note = (api, url) => { const host = hostOf(url); if (host === null) return { pass: true }; const allowed = allow.has(host); attempts.push({ api, host, allowed, at: Date.now() }); return { pass: allowed || !block }; };
    const wrap = (obj, name, make) => { if (!obj || typeof obj[name] === "undefined") return; const orig = obj[name]; obj[name] = make(orig); restores.push(() => { obj[name] = orig; }); };
    wrap(w, "fetch", (orig) => function (input, init) { const r = note("fetch", input && input.url ? input.url : input); return r.pass ? orig.apply(this, arguments) : Promise.reject(new TypeError("blocked by the privacy guard")); });
    if (w.XMLHttpRequest && w.XMLHttpRequest.prototype) wrap(w.XMLHttpRequest.prototype, "open", (orig) => function (method, url) { const r = note("xhr", url); if (!r.pass) throw new TypeError("blocked by the privacy guard"); return orig.apply(this, arguments); });
    if (w.navigator) wrap(w.navigator, "sendBeacon", (orig) => function (url) { const r = note("beacon", url); return r.pass ? orig.apply(this, arguments) : false; });
    for (const api of ["WebSocket", "EventSource"]) wrap(w, api, (Orig) => { const W = function (url) { const r = note(api.toLowerCase(), url); if (!r.pass) throw new TypeError("blocked by the privacy guard"); return new Orig(...arguments); }; W.prototype = Orig.prototype; return W; });
    return { attempts: () => attempts.slice(), blocked: () => attempts.filter((a) => !a.allowed && block).length, restore: () => { restores.splice(0).reverse().forEach((f) => f()); } };
  }
}

/* ---------- 17. customization validator ---------- */
const UNSAFE_TOUCH = /\b(small (beads?|buttons?|parts?|coins?|pieces?)|marbles?|pins?|needles?|scissors|knife|blade|sharp|glass|hot (water|coffee|tea)|matches|lighters?|candles? (lit|burning)|medications?|pills?)\b/i;
const OVERCLAIM = /\b(cures?|treats?|reverses?|prevents?|clinically proven|guarantees?|heals?|stops (the )?(decline|progression))\b/i;
export class CustomizationValidator extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "CustomizationValidator", stage: "analyze", role: "QA: customization safety and dignity validator", capabilities: ["dignity", "safety", "conflicts"], ...o }); }
  /* In the pipeline: what staff typed is checked before a sheet is made from it. Text that is not dignified or not safe is left out, and each omission is listed. */
  async handle(ctx) {
    const deep = ctx.deep || (ctx.request && ctx.request.deep) || {}, v = this.validate({ deep, tier: ctx.tier, avoid: ctx.avoid, profile: ctx.profile });
    if (ctx.deep) for (const k of Object.keys(v.cleaned)) ctx.deep[k] = v.cleaned[k];
    ctx.analysis = Object.assign({}, ctx.analysis, { customization: { ok: v.ok, omitted: v.omitted.length, warnings: v.warnings.length } }); ctx.customizationReport = v; return ctx;
  }
  /* input: { deep, tier, avoid, profile }. Returns { ok, errors, warnings, omitted, cleaned }. cleaned holds the lists with offending entries removed. */
  validate(input) {
    const i = input || {}, d = i.deep && typeof i.deep === "object" ? i.deep : {}, avoid = avoidMatcher(i.avoid || []), errors = [], warnings = [], omitted = [], cleaned = {};
    const keep = (field, arr) => (Array.isArray(arr) ? arr : []).filter((t) => {
      const s = String(t), dp = dignityProblems(s);
      if (dp.length) { omitted.push({ field, reason: "not dignified: " + dp[0].replace(/^[^:]+: /, "") }); return false; }
      if (OVERCLAIM.test(s)) { omitted.push({ field, reason: "promises a medical result" }); return false; }
      if (avoid(s)) { omitted.push({ field, reason: "on the keep-off list" }); return false; }
      return true;
    });
    for (const f of ["music", "foods", "places", "words", "notes", "themeWords", "staffNotes"]) if (Array.isArray(d[f])) { cleaned[f] = keep(f, d[f]); }
    const INFANT = /\b(baby|babies|childish|naughty|behave|good girl|good boy|sweetie|honey|dear|obedient|stubborn|difficult|problem resident|wanderer|combative)\b/i;
    for (const f of ["staffNotes", "notes"]) if (cleaned[f]) cleaned[f] = cleaned[f].filter((t) => { if (INFANT.test(t)) { omitted.push({ field: f, reason: "labels or talks down to the resident" }); return false; } return true; });
    for (const f of ["foods", "music"]) if (cleaned[f] && Array.isArray(d.avoid)) { /* conflicts are reported below */ }
    for (const f of ["foods", "music", "places", "words"]) for (const t of (Array.isArray(d[f]) ? d[f] : [])) if (avoid(String(t)) && !(omitted.some((o) => o.field === f && o.reason === "on the keep-off list"))) warnings.push(f + " includes a word on the keep-off list");
    for (const t of (Array.isArray(d.foods) ? d.foods : [])) if (/\b(eat|taste|bite|swallow|feed)\b/i.test(String(t))) warnings.push("a food entry reads like an instruction to eat; sheets only offer scent, never tasting, unless the care plan allows it");
    for (const t of [...(Array.isArray(d.staffNotes) ? d.staffNotes : []), ...(Array.isArray(d.notes) ? d.notes : [])]) if (UNSAFE_TOUCH.test(String(t)) && Number(i.tier) === 3) warnings.push("a note mentions an object that may be unsafe for someone at the latest stage: " + (UNSAFE_TOUCH.exec(String(t)) || [""])[0]);
    if (Array.isArray(d.words) && d.words.length > 8) warnings.push("more than eight word-search words were given; only the first few fit");
    if (d.include && d.include.wordSearch === false && d.include.sparks === false && d.include.matching === false) warnings.push("every part of the resident page is switched off, so the plain conversation sheet is used");
    if (Number(i.tier) === 3 && Array.isArray(d.words) && d.words.some((w) => String(w).length > 6)) warnings.push("long words will be left out of the small grid used at the latest stage");
    if (omitted.some((o) => /promises/.test(o.reason))) errors.push("a promise of a medical result was removed");
    return { ok: errors.length === 0, errors, warnings: [...new Set(warnings)], omitted, cleaned };
  }
}

/* ---------- 18. accessibility ---------- */
const parseColor = (c) => {
  const s = String(c == null ? "" : c).trim().toLowerCase(); if (s === "black") return { r: 0, g: 0, b: 0, a: 1 }; if (s === "white") return { r: 255, g: 255, b: 255, a: 1 };
  let m = /^#([0-9a-f]{3})$/.exec(s); if (m) return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16), a: 1 };
  m = /^#([0-9a-f]{6})$/.exec(s); if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: 1 };
  m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/.exec(s); if (m) { const a = m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]); return { r: +m[1], g: +m[2], b: +m[3], a }; }
  return null;
};
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
export function contrastRatio(fg, bg) {
  const a = parseColor(fg), b = parseColor(bg); if (!a || !b) return null;
  const f = a.a < 1 ? { r: a.r * a.a + b.r * (1 - a.a), g: a.g * a.a + b.g * (1 - a.a), b: a.b * a.a + b.b * (1 - a.a) } : a;
  const l1 = lum(f), l2 = lum(b); return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
}
export const WCAG = Object.freeze({ contrastAAA: 7, contrastAA: 4.5, minTargetPx: 52, minResidentPt: 18, maxSentenceWords: 20 });
export class AccessibilityChecker extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "AccessibilityChecker", stage: "audit", role: "QA: WCAG accessibility checker", capabilities: ["contrast", "print-size", "plain-language", "dom"], ...o }); }
  /* In the pipeline: a finished sheet that fails a check is reported in the audit (it is not changed). */
  async handle(ctx) {
    if (!ctx.asset) return ctx; const r = this.checkAsset(ctx.asset), a = ctx.audit || { status: "pass", fixes: [], problems: [] };
    ctx.accessibility = r; if (!r.ok) ctx.audit = Object.assign({}, a, { problems: [...(a.problems || []), ...r.problems.map((p) => ({ rule: "accessibility " + p.criterion + ": " + p.message, where: p.where || "asset" }))], status: a.status === "blocked" ? "blocked" : a.status });
    return ctx;
  }
  /* A sheet: resident print size, plain language, grid size and shape, and a logo only as an image. */
  checkAsset(asset) {
    const problems = [], a = asset || {}, res = (a.pages && a.pages.resident) || {}, blocks = Array.isArray(res.blocks) ? res.blocks : [];
    if (!(Number(res.fontPt) >= WCAG.minResidentPt)) problems.push({ criterion: "1.4.4", message: "resident print is smaller than " + WCAG.minResidentPt + " pt", where: "pages.resident" });
    const strings = []; (function walk(v, k) { if (typeof v === "string") { if (!/^(type|kind|grid|spec|id|rightOrder)$/.test(k || "")) strings.push(v); } else if (Array.isArray(v)) v.forEach((x) => walk(x, k)); else if (v && typeof v === "object") Object.keys(v).forEach((kk) => walk(v[kk], kk)); })(res, "");
    for (const s of strings) { const longest = s.split(/(?<=[.!?])\s+/).reduce((m, x) => Math.max(m, x.split(/\s+/).filter(Boolean).length), 0); if (longest > WCAG.maxSentenceWords) problems.push({ criterion: "3.1.5", message: "a sentence has " + longest + " words; plain language keeps them to " + WCAG.maxSentenceWords + " or fewer", where: "pages.resident" }); }
    for (const b of blocks) if (b.type === "wordsearch") { const g = (b.grid || []).map(String); if (!g.length || g.some((r) => r.length !== g.length)) problems.push({ criterion: "1.3.1", message: "the word search grid is not square", where: "wordsearch" }); if (Number(b.cellPx) && Number(b.cellPx) < 30) problems.push({ criterion: "2.5.8", message: "word search squares are smaller than 30 px", where: "wordsearch" }); }
    if (!res.heading && !a.title) problems.push({ criterion: "2.4.2", message: "the sheet has no title", where: "asset" });
    const logo = a.branding && a.branding.logoDataUrl; if (logo && !/^data:image\/(png|jpeg|gif|webp);base64,/.test(logo)) problems.push({ criterion: "1.1.1", message: "the logo is not an image", where: "branding" });
    return { ok: problems.length === 0, problems, contrast: contrastRatio("#000", "#fff") };   // sheets print pure black on white: 21:1
  }
  /* A page or a window: names for controls, sizes, labels, headings, language, focus rings and contrast (AAA, the site's own rule). win supplies getComputedStyle. */
  checkDom(root, win) {
    const w = win || (typeof window !== "undefined" ? window : null), problems = [], stats = { controls: 0, text: 0 };
    if (!root || !w) return { ok: false, problems: [{ criterion: "n/a", message: "no page to check" }], stats };
    const doc = root.ownerDocument || root, cs = (e) => w.getComputedStyle(e), visible = (e) => { const s = cs(e); return s.display !== "none" && s.visibility !== "hidden" && (e.getClientRects ? e.getClientRects().length > 0 : true); };
    const nameOf = (e) => (e.getAttribute("aria-label") || (e.getAttribute("aria-labelledby") && e.getAttribute("aria-labelledby").split(/\s+/).map((id) => (doc.getElementById(id) || {}).textContent || "").join(" ")) || e.textContent || e.getAttribute("title") || e.getAttribute("alt") || (e.labels && [...e.labels].map((l) => l.textContent).join(" ")) || e.getAttribute("placeholder") || "").trim();
    if (!(doc.documentElement && doc.documentElement.getAttribute("lang"))) problems.push({ criterion: "3.1.1", message: "the page has no language", where: "html" });
    for (const e of root.querySelectorAll("a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[tabindex]")) {
      if (!visible(e)) continue; stats.controls++;
      const id = e.tagName.toLowerCase() + (e.id ? "#" + e.id : "");
      if (!nameOf(e)) problems.push({ criterion: "4.1.2", message: "a control has no name", where: id });
      if (Number(e.getAttribute("tabindex")) > 0) problems.push({ criterion: "2.4.3", message: "a positive tabindex changes the reading order", where: id });
      const r = e.getBoundingClientRect(), exempt = e.closest("[data-tap-exempt]") || (e.tagName === "A" && e.closest("p,li") && e.closest("p,li").textContent.trim().length > e.textContent.trim().length + 12) || (e.type === "checkbox" && e.closest("label")) || e.type === "radio" && e.closest("label");
      if (!exempt && (r.height < WCAG.minTargetPx - 0.5 || (e.tagName !== "A" && r.width < WCAG.minTargetPx - 0.5))) problems.push({ criterion: "2.5.8", message: "a control is smaller than " + WCAG.minTargetPx + " px (" + Math.round(r.width) + " x " + Math.round(r.height) + ")", where: id });
    }
    for (const img of root.querySelectorAll("img")) if (visible(img) && !img.hasAttribute("alt")) problems.push({ criterion: "1.1.1", message: "an image has no alt text", where: "img" });
    for (const f of root.querySelectorAll("input:not([type=hidden]):not([type=button]):not([type=submit]),select,textarea")) if (visible(f) && !nameOf(f)) problems.push({ criterion: "3.3.2", message: "a field has no label", where: f.id || f.tagName.toLowerCase() });
    for (const d of root.querySelectorAll("dialog[open],[role=dialog]")) if (!d.getAttribute("aria-label") && !d.getAttribute("aria-labelledby")) problems.push({ criterion: "4.1.2", message: "a dialog has no name", where: "dialog" });
    let last = 0; for (const h of root.querySelectorAll("h1,h2,h3,h4,h5,h6")) { if (!visible(h)) continue; const n = +h.tagName[1]; if (last && n > last + 1) problems.push({ criterion: "1.3.1", message: "a heading skips from h" + last + " to h" + n, where: h.textContent.trim().slice(0, 30) }); last = n; }
    /* text against its background, walking up to the first opaque color */
    const bgOf = (el) => { const st = []; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const c = parseColor(cs(n).backgroundColor); if (c && c.a > 0) { st.push(c); if (c.a >= 1) break; } } let b = { r: 255, g: 255, b: 255, a: 1 }; for (let i = st.length - 1; i >= 0; i--) b = { r: st[i].r * st[i].a + b.r * (1 - st[i].a), g: st[i].g * st[i].a + b.g * (1 - st[i].a), b: st[i].b * st[i].a + b.b * (1 - st[i].a), a: 1 }; return b; };
    const walker = doc.createTreeWalker(root, 4); let seen = 0;
    for (let t; (t = walker.nextNode()) && seen < 4000;) { const tx = t.nodeValue.trim(); if (!tx) continue; const e = t.parentElement; if (!e || !visible(e)) continue; seen++; stats.text++; const fg = parseColor(cs(e).color), bg = bgOf(e); if (!fg) continue; const ratio = contrastRatio(`rgba(${fg.r},${fg.g},${fg.b},${fg.a})`, `rgb(${bg.r},${bg.g},${bg.b})`); if (ratio != null && ratio < WCAG.contrastAAA) problems.push({ criterion: "1.4.6", message: "text is " + ratio + ":1 (needs " + WCAG.contrastAAA + ":1)", where: tx.slice(0, 30) }); }
    return { ok: problems.length === 0, problems: problems.slice(0, 200), stats };
  }
}

/* ---------- 19. feedback categorizer ---------- */
export const CATEGORIES = Object.freeze(["privacy", "bug", "print", "accessibility", "content", "usability", "pricing", "feature", "praise", "other"]);
const RULES = Object.freeze({
  privacy: /\b(privacy|private|hipaa|phi|data (leav|leak|sent|shar)\w*|sent to|cloud|tracking|consent|stores? (my|our)|breach|exposed)\b/i,
  bug: /\b(crash\w*|froze|freez\w*|error|broken|doesn'?t work|not working|won'?t (open|load|print|save)|blank|stuck|nothing happens|bug|disappear\w*|lost)\b/i,
  print: /\b(print\w*|printer|margins?|cut off|page break|paper|toner|ink|pdf|letter size|scal(e|ing))\b/i,
  accessibility: /\b(contrast|font size|too small|hard to read|screen reader|keyboard|color ?blind|zoom|large print|can'?t see|glare)\b/i,
  content: /\b(wording|dignit\w*|childish|insult\w*|patroniz\w*|condescend\w*|baby|inappropriate|offensive|inaccurate|era|1950s|song|trivia|wrong (song|year))\b/i,
  usability: /\b(confus\w*|hard to (find|use)|can'?t find|too many (clicks|steps)|unclear|where do i|how do i|tiny button|menu)\b/i,
  pricing: /\b(price|pricing|cost|license|licence|trial|free|invoice|subscription|renew\w*|refund|payment|purchase|\$\d+)\b/i,
  feature: /\b(wish|would be nice|please add|can you add|feature|request|it would help if|suggest\w*)\b/i,
  praise: /\b(love[sd]?|great|wonderful|thank\w*|helpful|perfect|excellent|enjoyed|fantastic|amazing)\b/i
});
const POS = /\b(love[sd]?|great|wonderful|thank\w*|helpful|perfect|excellent|enjoyed|fantastic|amazing|easy|smooth|beautiful|nice)\b/gi, NEG = /\b(hate[sd]?|terrible|awful|frustrat\w*|annoy\w*|useless|broken|confus\w*|slow|crash\w*|lost|angry|disappointed|worse|bad|wrong|cannot|can'?t)\b/gi;
export class FeedbackCategorizer extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "FeedbackCategorizer", stage: "preview", role: "QA: beta feedback categorizer", capabilities: ["categorize", "triage", "digest"], ...o }); this.sentinel = new PrivacySentinel(); this.store = o.storage || memoryStorage(); this.now = o.now || (() => new Date()); }
  async handle(ctx) { return ctx; }
  categorize(text, o = {}) {
    const raw = clip(text, 4000), red = this.sentinel.redact(raw, { names: o.names }), t = red.text, hits = {};
    for (const c of CATEGORIES) if (RULES[c]) { const m = t.match(new RegExp(RULES[c].source, "gi")); if (m) hits[c] = m.length; }
    const order = ["privacy", "bug", "print", "accessibility", "content", "usability", "pricing", "feature", "praise"], tags = order.filter((c) => hits[c]);
    const praiseOnly = tags.length === 1 && tags[0] === "praise", negative = (t.match(NEG) || []).length, positive = (t.match(POS) || []).length;
    const category = tags.length ? (praiseOnly ? "praise" : tags.filter((c) => c !== "praise").sort((a, b) => hits[b] - hits[a] || order.indexOf(a) - order.indexOf(b))[0]) : "other";
    const severity = (hits.privacy && /\b(sent|leak\w*|exposed|breach|shared with)\b/i.test(t)) || (hits.bug && /\b(lost|deleted|data loss|disappear\w*)\b/i.test(t)) ? "critical" : category === "privacy" || category === "bug" ? "high" : ["print", "accessibility", "content", "usability"].includes(category) ? "medium" : "low";
    const sentiment = negative > positive ? "negative" : positive > negative ? "positive" : "neutral";
    return { category, tags, severity, sentiment, summary: red.text.slice(0, 140), redactions: red.findings.map((f) => f.kind), text: red.text };
  }
  /* Keep an entry. Only the redacted text is stored, never the original. */
  add(text, o = {}) { const c = this.categorize(text, o), e = { id: "f_" + Math.random().toString(36).slice(2, 10), at: this.now().toISOString(), category: c.category, tags: c.tags, severity: c.severity, sentiment: c.sentiment, text: c.text, redactions: c.redactions }; const all = this.all(); all.push(e); this.store.set("feedback", JSON.stringify(all.slice(-2000))); return e; }
  all() { try { const a = JSON.parse(this.store.get("feedback") || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  triage(entries) { const rank = { critical: 0, high: 1, medium: 2, low: 3 }; return (entries || this.all()).slice().sort((a, b) => rank[a.severity] - rank[b.severity] || String(b.at).localeCompare(String(a.at))); }
  /* Entries that say nearly the same thing, so one fix answers them all (the same category and half their words in common). */
  groups(entries) {
    const toks = (s) => new Set(String(s).toLowerCase().match(/[a-z]{3,}/g) || []), list = (entries || this.all()), out = [];
    for (const e of list) { const t = toks(e.text); let g = out.find((x) => { const u = new Set([...x.tokens, ...t]), inter = [...t].filter((w) => x.tokens.has(w)).length; return x.category === e.category && u.size && inter / u.size >= 0.5; }); if (g) g.ids.push(e.id); else out.push({ ids: [e.id], tokens: t, category: e.category }); }
    return out.filter((g) => g.ids.length > 1).map((g) => ({ ids: g.ids, category: g.category }));
  }
  digest(entries) { const list = entries || this.all(), by = (k) => list.reduce((m, e) => { m[e[k]] = (m[e[k]] || 0) + 1; return m; }, {}); return { total: list.length, byCategory: by("category"), bySeverity: by("severity"), bySentiment: by("sentiment"), critical: list.filter((e) => e.severity === "critical").length }; }
}

/* ---------- 20. client communications ---------- */
const CLAIM_NEVER = [[/inherently\s+HIPAA/i, "an 'inherently HIPAA compliant' claim"], [/HIPAA[- ]?(certified|approved|endorsed)/i, "a 'HIPAA certified' claim"], [/military[- ]grade|unhackable|100\s?%\s+(secure|safe)/i, "an absolute security claim"], [/clinically proven|\bcures?\b|\btreats? dementia\b/i, "a medical claim"], [/\bguarantee[sd]?\b/i, "a guarantee"], [/\b\d+\s?(hours?|minutes?) (saved|a week|per week)\b|\bsaves? (you )?\d+ hours?\b/i, "an unmeasured time-saving number"], [/\b\d{1,3}\s?%\s+(faster|fewer|more|less|reduction|improvement|of facilities)/i, "an unmeasured percentage"]];
const CLAIM_UNLESS_DENIED = [[/HIPAA[- ]compliant/i, "a 'HIPAA compliant' claim"], [/\bCMS[- ]compliant\b/i, "a 'CMS compliant' claim"], [/(ensures?|assures?) (full |complete )?(regulatory |HIPAA |CMS )?compliance/i, "an 'ensures compliance' claim"]];
const DENIAL = /\b(not|never|no|nor|neither|cannot|can't|isn't|aren't|doesn't|don't|without|rather than|nothing)\b/i;
export function claimsProblems(text) {
  const t = String(text == null ? "" : text), out = [];
  for (const [re, what] of CLAIM_NEVER) if (re.test(t)) out.push(what);
  for (const [re, what] of CLAIM_UNLESS_DENIED) { const g = new RegExp(re.source, "gi"); let m; while ((m = g.exec(t))) { const start = Math.max(t.lastIndexOf(".", m.index), t.lastIndexOf("\n", m.index), m.index - 140); if (!DENIAL.test(t.slice(start + 1, m.index))) out.push(what); } }
  return [...new Set(out)];
}
const NEEDS_PERSON = /\b(lawyer|attorney|legal|sue|complaint|chargeback|dispute|cancel\w*|refund|breach|incident|violation|audit|survey|regulator|state inspector|injur\w*|harm\w*|died|death)\b/i;
export class ClientCommsAssistant extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "ClientCommsAssistant", stage: "preview", role: "QA: client communications assistant (drafts only)", capabilities: ["draft", "claims-check"], ...o }); this.cat = o.categorizer || new FeedbackCategorizer(); this.sentinel = new PrivacySentinel(); this.facts = o.facts || null; }
  async handle(ctx) { return ctx; }
  factsNow() {
    if (this.facts) return this.facts; const c = typeof globalThis !== "undefined" ? globalThis.CognicopiaLicenseConfig : null;
    return c && c.PRICES ? { freeRuns: c.FREE_RUNS, monthly: c.PRICES.monthly && c.PRICES.monthly.text, annual: c.PRICES.annual && c.PRICES.annual.text, enterprise: c.PRICES.enterprise && c.PRICES.enterprise.text } : null;
  }
  /* message: { text, name? }. Returns a draft for a person to read and send; nothing is sent from here. */
  draft(message) {
    const m = message && typeof message === "object" ? message : { text: message }, text = clip(m.text, 6000), c = this.cat.categorize(text), f = this.factsNow(), reasons = [];
    const nm = clip(m.name, 40), first = /[<>{}\[\]]/.test(nm) ? "" : nm.split(/\s+/)[0].replace(/[^A-Za-z'-]/g, ""), hello = first ? "Hello " + first + "," : "Hello,";
    const pii = this.sentinel.scan(text); if (!pii.ok) reasons.push("the message contains personal identifiers (" + pii.kinds.join(", ") + "); do not copy them into a reply or a ticket");
    if (NEEDS_PERSON.test(text)) reasons.push("the message raises a legal, billing-dispute, safety or regulatory matter that a person should answer");
    if (c.severity === "critical") reasons.push("the message reports possible data loss or a privacy problem");
    const body = {
      privacy: "Thank you for asking about privacy. Cognicopia's packet tools work inside your web browser: the details you type about a resident stay on that device, and no resident data leaves the device. Cognicopia supports a facility's HIPAA privacy practices; keeping those practices is the facility's own responsibility, and we do not describe the software as HIPAA compliant. The one page that uses the internet is the license activation page after a card purchase, which sends only a payment reference.",
      bug: "Thank you for telling us about this, and I'm sorry it got in the way of your day. To find the cause, could you tell us which web browser and device you were using, what you did just before it happened, and what you saw on the screen? Please leave out any resident's name or details. Resident information is never needed to fix a problem.",
      print: "Thank you for the note about printing. First, set the printer to 100% or Actual size, since shrink-to-fit changes the margins. Sheets are made for US Letter paper with black text on white. If a page still looks cut off, tell us the browser, the printer and what the page looked like, without any resident details, and we will look into it.",
      accessibility: "Thank you for raising readability. We aim for large, high-contrast print and controls that are easy to reach, and we want to hear where that falls short. Could you tell us which page, which device and what was hard to read or reach? That lets us fix the exact spot.",
      content: "Thank you for flagging this wording. Everything we write for residents should read as it would for an adult relative: it invites, and never tests. Could you tell us the activity and the line you saw, without a resident's name? We will review it, and anything on a facility's keep-off list can also be entered on the form so it never prints.",
      usability: "Thank you for letting us know that was hard to find. Could you tell us what you were trying to do and where you looked first? That helps us move things to where people expect them.",
      pricing: f ? `Thank you for your interest. A facility can make ${f.freeRuns} packets free to start. After that a license is ${f.monthly} or ${f.annual}, and ${String(f.enterprise).toLowerCase()} is available for larger organizations. ` + "If you need an invoice for your accounting team, tell us the facility name and we will help." : "Thank you for your interest. We will confirm current pricing and any free start in our reply.",
      feature: "Thank you for the idea. We read every suggestion. Could you tell us a little about the situation where it would help, such as who would use it and when? We keep a list and use it to decide what to build next. We cannot promise a date.",
      praise: "Thank you so much for the kind words. It means a lot to hear that it is helping the people you care for. If there is anything you wish it did, we would be glad to hear it.",
      other: "Thank you for getting in touch. We have your message and will reply with what we can. If you can tell us a little more about what you are hoping to do, we can point you in the right direction."
    }[c.category] || "Thank you for getting in touch.";
    const full = hello + "\n\n" + body + "\n\nWarm regards,\nThe Cognicopia team";
    const cp = claimsProblems(full); if (cp.length) reasons.push("the draft contains a claim that needs review: " + cp.join(", "));
    const dp = dignityProblems(full); if (dp.length) reasons.push("the draft's wording needs review");
    return { status: "draft", category: c.category, severity: c.severity, subject: { privacy: "Your privacy question", bug: "About the problem you reported", print: "Help with printing", accessibility: "About readability", content: "About the wording you flagged", usability: "About finding your way around", pricing: "Pricing and the free start", feature: "Your suggestion", praise: "Thank you", other: "Your message" }[c.category], body: full, needsPerson: reasons.length > 0, reasons, claims: { ok: cp.length === 0, problems: cp }, sent: false };
  }
}

/* ---------- wiring ---------- */
export const PILLAR3_AGENTS = Object.freeze(["PrivacySentinel", "CustomizationValidator", "AccessibilityChecker", "FeedbackCategorizer", "ClientCommsAssistant"]);
/* Register after the clinical audit agent, so the sentinel and the accessibility checker read the audited sheet. */
export function registerPillar3(orchestrator, o = {}) {
  if (!orchestrator || typeof orchestrator.use !== "function") throw new TypeError("registerPillar3 needs an orchestrator");
  const feedback = new FeedbackCategorizer({ storage: o.storage, now: o.now });
  const agents = { sentinel: new PrivacySentinel(), validator: new CustomizationValidator(), accessibility: new AccessibilityChecker(), feedback, comms: new ClientCommsAssistant({ categorizer: feedback, facts: o.facts }) };
  Object.values(agents).forEach((a) => orchestrator.use(a));
  return agents;
}
export { assetText };
