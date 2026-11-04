/* Therapy goal tracking for speech-language pathologists and therapy staff who use Cognicopia activities in skilled sessions.

   A pasted therapy note is read on this device: the MoCA or MMSE total and the sub-scores (domains) it mentions, the session minutes, and
   words that point to the kind of service given. From those the page suggests which CPT codes the clinician may want to consider, and which
   kinds of Cognicopia activity suit each domain that scored low. The clinician confirms or changes each one; nothing is billed or
   decided here.

   What is kept for a resident: the date, the instrument, the numbers the clinician confirmed, the codes the clinician chose and the goals
   the clinician set. The note's own text is never saved. A goal is a target score for a domain, and progress is arithmetic on the scores
   recorded (first, latest, change); it does not interpret them.

   Codes are a reference, not billing advice: they are chosen by the treating clinician under current CPT and payer rules. The short
   descriptions are in plain words, not the AMA's descriptor text. 97124 is a massage code and is never suggested. */
import { readJson, writeJson } from "./studio-core.js";

export const SCHEMA = "cognicopia.slpGoals", VERSION = 1, KEY = "cognicopia_slp_goals_";
const rid = (id) => String(id == null ? "" : id).replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 64);
const clean = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const num = (v) => { const n = Number(String(v).replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? n : NaN; };

/* The domains of each test, with the points each is worth, the words a note uses for it, and the kinds of activity that practise it. */
const ACT = {
  recall: ["Spaced-retrieval cards, with the answer given back after a short wait", "Reminiscence cards that invite a story, with a cue after a pause"],
  orient: ["A large-print calendar and season page to fill in together", "A daily orientation board: day, month, season, place"],
  attention: ["Word search with across-only words and a few big letters", "Short matching and cancellation pages with wide spacing"],
  visuo: ["Mazes and path-tracing pages with thick lines", "Simple shape copying and clock-drawing practice pages"],
  exec: ["Sequencing cards: put the steps of a familiar task in order", "A one-step-at-a-time recipe or routine page"],
  naming: ["Picture-naming pages using familiar objects", "Naming from a description, with the first sound as a cue"],
  language: ["Word-fluency pages: things found in a kitchen, a garden, a shop", "Sentence completion with common sayings"],
  abstraction: ["Category sorting: what goes together and why", "Matching pairs: things that go together"],
  register: ["Three-word repeat-and-recall pages with a long pause", "Names and faces matching"]
};
export const INSTRUMENTS = Object.freeze({
  moca: { label: "MoCA", max: 30, domains: [
    { id: "visuoexec", label: "Visuospatial and executive", max: 5, words: /visuo[\s-]*spatial(?:\s*(?:\/|and|&|,)?\s*executive)?|executive|trail|clock|cube/, acts: [...ACT.visuo, ...ACT.exec] },
    { id: "naming", label: "Naming", max: 3, words: /naming|animals/, acts: ACT.naming },
    { id: "attention", label: "Attention", max: 6, words: /attention|digit span|serial|vigilance/, acts: ACT.attention },
    { id: "language", label: "Language", max: 3, words: /language|repetition|fluency/, acts: ACT.language },
    { id: "abstraction", label: "Abstraction", max: 2, words: /abstraction|similarit/, acts: ACT.abstraction },
    { id: "recall", label: "Delayed recall", max: 5, words: /delayed recall|delayed|recall|memory/, acts: ACT.recall },
    { id: "orientation", label: "Orientation", max: 6, words: /orientation|oriented/, acts: ACT.orient }] },
  mmse: { label: "MMSE", max: 30, domains: [
    { id: "orientation", label: "Orientation", max: 10, words: /orientation|oriented/, acts: ACT.orient },
    { id: "registration", label: "Registration", max: 3, words: /registration|immediate recall/, acts: ACT.register },
    { id: "attention", label: "Attention and calculation", max: 5, words: /attention|calculation|serial|spell|world backward/, acts: ACT.attention },
    { id: "recall", label: "Recall", max: 3, words: /delayed recall|recall|memory/, acts: ACT.recall },
    { id: "language", label: "Language and praxis", max: 9, words: /language|praxis|naming|repetition|command|reading|writing|copy/, acts: [...ACT.language, ...ACT.naming, ...ACT.visuo] }] }
});
const domOf = (inst, id) => ((INSTRUMENTS[inst] || {}).domains || []).find((d) => d.id === id) || null;

/* ---- reading a note --------------------------------------------------------------------------------------------------------------------------- */
const SERVICE = { language: /\b(speech|language|word[- ]finding|naming|fluency|comprehension|communication|aphasia|voice|auditory)\b/i, cognitive: /\b(cognitive|memory|attention|executive|problem[- ]solving|sequenc|strateg|orientation|reasoning|compensatory)\b/i, test: /\b(administered|testing|tested|standardi[sz]ed|re-?evaluat|evaluation|screen(?:ed|ing)?)\b/i, group: /\bgroup\b/i, notDirect: /\b(consult|chart review|documentation only)\b/i };
/* text -> { instrument, total, domains: { id: { got, max } }, minutes, language, cognitive, test, group, found: [what was recognised] }.
   Every number is read as written; a sub-score above what its domain allows is left out and named in `found` as skipped. */
export function parseNote(text) {
  const t = String(text == null ? "" : text).slice(0, 20000), low = t.toLowerCase(), out = { instrument: null, total: null, domains: {}, minutes: null, language: false, cognitive: false, test: false, group: false, found: [] };
  const hasMoca = /\bmoca\b|montreal cognitive/.test(low), hasMmse = /\bmmse\b|mini[- ]mental/.test(low);
  out.instrument = hasMoca && !hasMmse ? "moca" : hasMmse && !hasMoca ? "mmse" : hasMoca ? (low.search(/\bmoca\b|montreal/) <= low.search(/\bmmse\b|mini[- ]mental/) ? "moca" : "mmse") : null;
  const inst = INSTRUMENTS[out.instrument];
  if (inst) {
    const tm = low.match(new RegExp("(?:" + (out.instrument === "moca" ? "moca|montreal cognitive assessment" : "mmse|mini[- ]mental(?: state)?(?: exam(?:ination)?)?") + ")[^0-9\\n]{0,20}(\\d{1,2})\\s*(?:\\/|out of|of)?\\s*(30)?\\b"));
    if (tm && num(tm[1]) <= inst.max) { out.total = { got: num(tm[1]), max: inst.max }; out.found.push(inst.label + " total " + tm[1] + "/" + inst.max); }
    for (const d of inst.domains) {
      const re = new RegExp("(?:^|[^a-z])(" + d.words.source + ")[^0-9\\n]{0,14}(\\d{1,2})\\s*(?:\\/|out of|of)\\s*(\\d{1,2})\\b|(?:^|[^a-z])(" + d.words.source + ")[^0-9\\n]{0,14}(\\d{1,2})(?!\\d|\\s*(?:\\/|out of|of|minutes|min\\b|%))", "g");
      let m, best = null;
      while ((m = re.exec(low))) { const got = num(m[2] != null ? m[2] : m[5]), mx = m[3] != null ? num(m[3]) : d.max; if (mx !== d.max) continue; if (got <= d.max && !best) best = { got, max: d.max }; else if (got > d.max) out.found.push(d.label + " " + got + " skipped: more than the " + d.max + " points it is worth"); }
      if (best) { out.domains[d.id] = best; out.found.push(d.label + " " + best.got + "/" + best.max); }
    }
  }
  const mm = low.match(/(\d{1,3})\s*(?:-|\s)?\s*(?:minutes|minute|mins|min)\b/); if (mm) { const v = num(mm[1]); if (v >= 1 && v <= 480) { out.minutes = v; out.found.push(v + " minutes"); } }
  out.language = SERVICE.language.test(t); out.cognitive = SERVICE.cognitive.test(t); out.test = SERVICE.test.test(t) && !!out.instrument; out.group = SERVICE.group.test(t);
  return out;
}

/* ---- codes: suggestions only ------------------------------------------------------------------------------------------------------------------ */
const REF = { "97129": "Cognitive function intervention, direct one-on-one, first 15 minutes.", "97130": "Cognitive function intervention, each additional 15 minutes (add-on to 97129).", "92507": "Speech, language, voice, communication or auditory processing treatment, individual (untimed).", "92508": "The same treatment for a group of two or more (untimed).", "96125": "Standardized cognitive performance testing, per hour, with interpretation and report." };
export const codeSummary = (c) => { const g = typeof globalThis !== "undefined" && globalThis.CogniClinical; const r = g && g.codeRef ? g.codeRef(c) : null; return r ? r.summary : REF[c] || ""; };
/* Timed units by the usual 8-minute rule: 8 to 22 minutes is one unit, 23 to 37 is two, and so on. */
export const unitsFor = (minutes) => (minutes >= 8 ? Math.floor((minutes + 7) / 15) : 0);
/* -> [{ code, units, why }] in the order a clinician would consider them. Never 97124 (massage). */
export function suggestCodes(p) {
  const out = [], mins = p && p.minutes; if (!p) return out;
  if (p.test) out.push({ code: "96125", units: mins ? Math.max(1, Math.round(mins / 60)) : 1, why: "The note describes standardized testing (" + (INSTRUMENTS[p.instrument] || {}).label + "). Name the instrument in the objective section." });
  if (p.group) out.push({ code: "92508", units: 1, why: "The note says the session was a group." });
  else {
    if (p.cognitive && mins && !p.test) { const u = unitsFor(mins); if (u >= 1) { out.push({ code: "97129", units: 1, why: "Cognitive work, " + mins + " minutes of direct one-on-one time." }); if (u > 1) out.push({ code: "97130", units: u - 1, why: "Each further 15 minutes after the first (" + u + " timed units in all)." }); } }
    else if (p.cognitive && !mins && !p.test) out.push({ code: "97129", units: 1, why: "Cognitive work is described, but no minutes were found. Add the direct time before choosing units." });
    if (p.language && !p.test) out.push({ code: "92507", units: 1, why: "Speech-language treatment is described. This code is untimed: one per session." });
  }
  return out.map((c) => Object.assign(c, { summary: codeSummary(c.code) }));
}

/* ---- the record ------------------------------------------------------------------------------------------------------------------------------- */
const iso = (d) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d + "T00:00:00Z")) ? d : "");
export function normalizeEntry(e) {
  const x = e && typeof e === "object" ? e : {}, inst = INSTRUMENTS[x.instrument] ? x.instrument : "moca", I = INSTRUMENTS[inst], domains = {};
  for (const d of I.domains) { const v = x.domains && x.domains[d.id]; if (v && Number.isFinite(Number(v.got)) && Number(v.got) >= 0 && Number(v.got) <= d.max) domains[d.id] = { got: Math.round(Number(v.got) * 10) / 10, max: d.max }; }
  const tg = x.total && Number(x.total.got), total = Number.isFinite(tg) && tg >= 0 && tg <= I.max ? { got: tg, max: I.max } : null;
  return { id: clean(x.id, 24) || "g" + Math.random().toString(36).slice(2, 9), date: iso(x.date) || iso(new Date().toISOString().slice(0, 10)), instrument: inst, total, domains,
    minutes: Number.isFinite(Number(x.minutes)) && Number(x.minutes) > 0 && Number(x.minutes) <= 480 ? Math.round(Number(x.minutes)) : null,
    codes: (Array.isArray(x.codes) ? x.codes : []).map((c) => ({ code: /^(97129|97130|92507|92508|96125)$/.test(String(c && c.code)) ? String(c.code) : "", units: Math.max(1, Math.min(8, Math.round(Number(c && c.units) || 1))) })).filter((c) => c.code).slice(0, 5),
    goals: (Array.isArray(x.goals) ? x.goals : []).map((g) => ({ domain: I.domains.some((d) => d.id === (g && g.domain)) ? g.domain : "", target: Number.isFinite(Number(g && g.target)) ? Number(g.target) : null, note: clean(g && g.note, 160) })).filter((g) => g.domain).slice(0, 8) };
}
export function normalizeLog(raw, residentId) { const r = raw && typeof raw === "object" ? raw : {}; return { schema: SCHEMA, v: VERSION, residentId: rid(residentId), entries: (Array.isArray(r.entries) ? r.entries : []).map(normalizeEntry).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).slice(-200) }; }
export const readLog = (store, id) => normalizeLog(readJson(store, KEY + rid(id), null), id);
export function saveEntry(store, residentId, entry) {
  const id = rid(residentId); if (!id) throw new Error("Choose a resident first."); const log = readLog(store, id), e = normalizeEntry(entry);
  if (!e.total && !Object.keys(e.domains).length) throw new Error("Enter a total or at least one sub-score.");
  const i = log.entries.findIndex((x) => x.id === e.id); if (i >= 0) log.entries[i] = e; else log.entries.push(e);
  log.entries.sort((a, b) => a.date.localeCompare(b.date)); if (!writeJson(store, KEY + id, log)) throw new Error("The record could not be saved (storage is full or blocked)."); return e;
}
export function removeEntry(store, residentId, entryId) { const id = rid(residentId), log = readLog(store, id); log.entries = log.entries.filter((e) => e.id !== entryId); return writeJson(store, KEY + id, log); }

/* ---- progress --------------------------------------------------------------------------------------------------------------------------------- */
/* For one instrument: each domain's scores in date order, first, latest, change and the goal (the latest target set), with whether it is met.
   -> { instrument, dates, total: { first, latest, change }, domains: [{ id, label, max, points: [{date, got}], first, latest, change, target, met, acts }] } */
export function progress(log, instrument) {
  const inst = INSTRUMENTS[instrument] || INSTRUMENTS.moca, es = (log && log.entries || []).filter((e) => e.instrument === (INSTRUMENTS[instrument] ? instrument : "moca"));
  const tot = es.filter((e) => e.total).map((e) => e.total.got), t = { first: tot.length ? tot[0] : null, latest: tot.length ? tot[tot.length - 1] : null, change: null }; if (tot.length > 1) t.change = Math.round((t.latest - t.first) * 10) / 10;
  const domains = inst.domains.map((d) => {
    const pts = es.filter((e) => e.domains[d.id]).map((e) => ({ date: e.date, got: e.domains[d.id].got })), first = pts.length ? pts[0].got : null, latest = pts.length ? pts[pts.length - 1].got : null;
    let target = null; es.forEach((e) => e.goals.forEach((g) => { if (g.domain === d.id && g.target != null) target = g.target; }));
    return { id: d.id, label: d.label, max: d.max, points: pts, first, latest, change: pts.length > 1 ? Math.round((latest - first) * 10) / 10 : null, target, met: target != null && latest != null ? latest >= target : null, acts: d.acts };
  });
  return { instrument: INSTRUMENTS[instrument] ? instrument : "moca", label: inst.label, dates: es.map((e) => e.date), total: t, domains };
}
/* The domains with the most room, lowest share of their points first, to suggest where goals might be set. */
export function weakest(entry, n = 3) {
  const e = normalizeEntry(entry), I = INSTRUMENTS[e.instrument];
  return I.domains.filter((d) => e.domains[d.id]).map((d) => ({ id: d.id, label: d.label, got: e.domains[d.id].got, max: d.max, share: e.domains[d.id].got / d.max, acts: d.acts })).sort((a, b) => a.share - b.share || a.label.localeCompare(b.label)).slice(0, n);
}

/* ---- the printed summary: one US Letter page, black on white ---------------------------------------------------------------------------------- */
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* model: { who, facility, log, instrument, preparedBy } */
export function summaryPage(model) {
  const m = model || {}, pr = progress(m.log, m.instrument), dates = pr.dates.slice(-6), D = (iso2) => new Date(iso2 + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const rows = pr.domains.filter((d) => d.points.length).map((d) => `<tr><th scope="row">${esc(d.label)} <small>(of ${d.max})</small></th>${dates.map((dt) => { const p = d.points.find((x) => x.date === dt); return `<td>${p ? p.got : "&ndash;"}</td>`; }).join("")}<td>${d.change == null ? "&ndash;" : (d.change > 0 ? "+" : "") + d.change}</td><td>${d.target == null ? "&ndash;" : d.target + (d.met ? " (met)" : "")}</td></tr>`).join("");
  const act = pr.domains.filter((d) => d.target != null && d.met === false).map((d) => `<li><b>${esc(d.label)}:</b> ${esc(d.acts[0])}</li>`).join("");
  const codes = (m.log && m.log.entries || []).filter((e) => e.instrument === pr.instrument).slice(-1)[0], cl = codes ? codes.codes.map((c) => `<li><b>${c.code}</b> &times; ${c.units}: ${esc(codeSummary(c.code))}</li>`).join("") : "";
  return `<div class="sheet slp-sheet"><header class="tr-head"><p class="tr-kicker">Therapy goal summary &middot; ${esc(pr.label)}</p><h1>${esc(m.who || "Resident")}</h1><p>${esc(m.facility || "")}${m.preparedBy ? " &middot; Prepared by " + esc(m.preparedBy) : ""}</p></header>
    <h2>Scores recorded</h2>${rows ? `<table class="tr-table"><thead><tr><th scope="col">Domain</th>${dates.map((dt) => `<th scope="col">${esc(D(dt))}</th>`).join("")}<th scope="col">Change</th><th scope="col">Goal</th></tr></thead><tbody>${rows}${pr.total.latest != null ? `<tr><th scope="row">Total <small>(of ${(INSTRUMENTS[pr.instrument]).max})</small></th>${dates.map((dt) => { const e = (m.log.entries || []).find((x) => x.date === dt && x.instrument === pr.instrument && x.total); return `<td>${e ? e.total.got : "&ndash;"}</td>`; }).join("")}<td>${pr.total.change == null ? "&ndash;" : (pr.total.change > 0 ? "+" : "") + pr.total.change}</td><td>&ndash;</td></tr>` : ""}</tbody></table>` : "<p>No scores have been recorded yet.</p>"}
    ${act ? `<h2>Activities to practise the goals not yet met</h2><ul class="tr-notes">${act}</ul>` : ""}
    ${cl ? `<h2>Codes the clinician chose for the latest session</h2><ul class="tr-notes">${cl}</ul>` : ""}
    <p class="tr-note">These are the numbers the clinician recorded and simple arithmetic on them. They are not an assessment, and the codes are the clinician's own choices under current CPT and payer rules.</p>
    <footer class="tr-foot"><span>${esc(m.facility || "Cognicopia")} &middot; Therapy goal summary</span><b>Page 1 of 1</b></footer></div>`;
}
