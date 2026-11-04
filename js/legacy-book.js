/* Quarterly Legacy & Memory Books: the compilation engine.

   One call gathers the last 90 days of a resident's kept memories and lays them out as a bindable keepsake volume: a family cover page,
   an optional family message page, a contents page, then chapter dividers and pages (Artwork, Puzzles, Reminiscence Highlights,
   Moments and Breakthroughs, What Our Team Noticed), each page with a page-number footer and the binding gutter (0.75 in) on the
   inside edge. It works on pages as HTML in the Packet Builder's own print window, so the book is saved as a PDF from there. Nothing
   is sent anywhere.

   What goes in is only what staff chose to share (an entry marked "not for the family" stays out), with personal identifiers taken
   out and wording that talks down to the resident left out. The readers (where each kind of record lives) are passed in, so this
   module has no storage of its own and is tested in Node. */

import { dignityProblems } from "./agent-orchestrator.js";
import { PrivacySentinel } from "./pillar3-qa-agents.js";
import { seasonOf } from "./pillar1-production-agents.js";

export const VERSION = "1.0.0";
export const GUTTER_IN = 0.75, OUTER_IN = 0.5, LINES_PER_PAGE = 30;
export const CHAPTERS = Object.freeze([
  { key: "artwork", title: "Artwork", blurb: "Pages they colored and made." },
  { key: "puzzles", title: "Puzzles", blurb: "Word searches, matching and other puzzles they worked on." },
  { key: "reminiscence", title: "Reminiscence Highlights", blurb: "Their own words and the stories they shared." },
  { key: "moments", title: "Moments and Breakthroughs", blurb: "Times worth remembering, and what helped them feel at ease." },
  { key: "team", title: "What Our Team Noticed", blurb: "Observations from the people who care for them each day." }
]);
const sentinel = new PrivacySentinel();
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const DAY = 86400000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const longDate = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const TALKDOWN = /\b(baby|babies|childish|naughty|behave|good girl|good boy|stubborn|difficult|combative|wanderer|problem resident|refused)\b/i;

/* What may be printed from a staff-written line: identifiers out, and nothing that labels or talks down to the resident. */
export function cleanText(text, max = 600) { const t = sentinel.redact(clip(text, max)).text; return !t || dignityProblems(t).length || TALKDOWN.test(t) ? "" : t; }

/* ---------- 2. the 90-day aggregation ---------- */
/* deps: { profile(id), keeper(id), journal(id), tracking(id), engagement(id) }, each may be missing or async. Returns what the book is made of. */
export async function aggregate(deps, residentId, o = {}) {
  const d = deps || {}, days = Math.max(7, Math.min(366, o.days || 90)), to = o.today instanceof Date ? o.today : new Date(), from = new Date(to.getTime() - days * DAY), f = iso(from), t = iso(to);
  const call = async (fn, ...a) => { try { return typeof fn === "function" ? await fn(...a) : null; } catch (e) { return null; } };
  const [profile, keeper, journal, tracking, engagement] = await Promise.all([call(d.profile, residentId), call(d.keeper, residentId), call(d.journal, residentId), call(d.tracking, residentId), call(d.engagement, residentId)]);
  const inWin = (day) => /^\d{4}-\d{2}-\d{2}/.test(day) && day.slice(0, 10) >= f && day.slice(0, 10) <= t;
  const ch = { artwork: [], puzzles: [], reminiscence: [], moments: [], team: [] }, skipped = { private: 0, outsideWindow: 0, filtered: 0 };
  for (const e of (keeper && keeper.entries) || []) {
    if (!inWin(String(e.date))) { skipped.outsideWindow++; continue; }
    if (e.share === false) { skipped.private++; continue; }
    const text = cleanText(e.text), title = cleanText(e.title, 80); if ((clip(e.text, 5) && !text) || (!text && !title && !e.design && !e.photo)) { skipped.filtered++; continue; }   // text that could not be printed takes its whole entry with it
    const item = { date: e.date.slice(0, 10), title, text, by: clip(e.by, 60), design: e.design || "", photo: e.photo || "", card: clip(e.card, 80), tier: e.tier || 2 };
    (e.kind === "coloring" ? ch.artwork : e.kind === "moment" ? ch.moments : ch.reminiscence).push(item);
  }
  for (const r of Array.isArray(engagement) ? engagement : []) {
    if (!/word ?search|puzzle|matching|crossword|sudoku/i.test(String(r.concept || "")) || !inWin(String(r.at || r.date || ""))) continue;
    const note = cleanText(r.note, 200); ch.puzzles.push({ date: String(r.at || r.date).slice(0, 10), title: clip(r.concept, 80), text: note || (Number(r.engagement) >= 2 ? "Took part and enjoyed it." : "Joined in."), by: "", engagement: Number(r.engagement) || 0 });
  }
  for (const j of (journal && journal.entries) || []) {
    if (!inWin(String(j.at))) continue; const text = cleanText(j.text); if (!text) { skipped.filtered++; continue; }
    ch.moments.push({ date: j.at.slice(0, 10), title: j.kind === "calming" ? "A calming moment" : "A breakthrough", text, by: "" });
  }
  for (const e of (tracking && tracking.entries) || []) { const n = cleanText(e.note, 300); if (n && inWin(e.month + "-28")) ch.team.push({ date: e.month + "-01", title: monthName(e.month), text: n, by: "" }); }
  for (const k of Object.keys(ch)) ch[k].sort((a, b) => a.date.localeCompare(b.date));
  const t1 = (profile && profile.tier1_core) || {}, t2 = (profile && profile.tier2_enrichment) || {}, by = Number(t2.birthYear) || 0;
  const resident = { id: residentId, name: clip(t1.preferredName, 40), birthYear: by, era: by >= 1900 && by <= 2010 ? (Math.floor((by + 15) / 10) * 10) + "s" : "" };
  return { range: { from: f, to: t, days }, resident, chapters: ch, counts: Object.fromEntries(Object.entries(ch).map(([k, v]) => [k, v.length])), skipped, total: Object.values(ch).reduce((s, v) => s + v.length, 0) };
}
const monthName = (m) => new Date(m + "-15T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });

/* ---------- 3. the cover ---------- */
const poss = (n) => n + "’s";   // Jess’s, Dolores’s: the common modern form
export function coverTitle(o) {
  const who = clip(o.relation, 30) || clip(o.name, 40), season = seasonOf(o.today || new Date(), o.hemisphere), S = season.charAt(0).toUpperCase() + season.slice(1);
  return { title: (who ? poss(who) + " " : "") + S + " Memories & Milestones", season: S, who };
}
export function coverHtml(m) {
  const c = coverTitle({ relation: m.relation, name: m.resident.name, today: m.today, hemisphere: m.hemisphere });
  return `<div class="lb-cover"><div class="lb-cover-top">${esc(m.facility || "")}</div>
    <div class="lb-cover-main"><div class="lb-rule"></div><h1 class="lb-cover-title">${esc(c.title)}</h1><div class="lb-rule"></div>
    ${m.resident.name ? `<p class="lb-cover-name">${esc(m.resident.name)}</p>` : ""}
    ${m.resident.era ? `<p class="lb-badge" aria-label="Era">${m.resident.birthYear ? "Born " + esc(m.resident.birthYear) + " &middot; " : ""}The ${esc(m.resident.era)} years</p>` : ""}
    <p class="lb-cover-range">${esc(longDate(m.range.from))} to ${esc(longDate(m.range.to))}</p></div>
    <div class="lb-cover-foot"><p>A keepsake of ${esc(m.range.days)} days, prepared with care for the family by the Activities and Life Enrichment team${m.facility ? " at " + esc(m.facility) : ""}.</p>
    <p class="lb-small">What is shown here was kept with the resident&rsquo;s dignity in mind. It records moments, not assessments.</p></div></div>`;
}

/* ---------- 4. pages, dividers, gutters and footers ---------- */
const cost = (it) => 3 + Math.ceil(String(it.text || "").length / 78) + (it.design || it.photo ? 6 : 0);
export function paginate(items, capacity = LINES_PER_PAGE) {
  const pages = []; let cur = [], used = 0;
  for (const it of items) { const c = Math.min(cost(it), capacity); if (cur.length && used + c > capacity) { pages.push(cur); cur = []; used = 0; } cur.push(it); used += c; }
  if (cur.length) pages.push(cur); return pages;
}
function itemHtml(it, art) {
  const pic = it.design && art ? `<div class="lb-art">${art(it.design, it.tier)}</div>` : "";
  return `<article class="lb-item"><header><span class="lb-date">${esc(longDate(it.date))}</span>${it.title ? `<h3>${esc(it.title)}</h3>` : ""}</header>${pic}${it.text ? `<p>${esc(it.text)}</p>` : ""}${it.by ? `<p class="lb-by">Recorded by ${esc(it.by)}</p>` : ""}</article>`;
}
const sheet = (body, n, total, label, role) => `<div class="sheet lb-sheet ${n % 2 ? "lb-odd" : "lb-even"} lb-${role}" data-lb-page="${n}">${body}<footer class="lb-foot"><span>${esc(label)}</span><b class="lb-no">${role === "cover" ? "" : "Page " + n + " of " + total}</b></footer></div>`;
/* compile(deps, residentId, { today, relation, facility, message, art, days, includeTeam }) -> { pages: [{ html, role, chapter }], meta, counts, empty } */
export async function compile(deps, residentId, o = {}) {
  const m = await aggregate(deps, residentId, o); m.today = o.today || new Date(); m.relation = o.relation; m.facility = clip(o.facility, 80); m.hemisphere = o.hemisphere;
  const chapters = CHAPTERS.filter((c) => m.chapters[c.key].length && (c.key !== "team" || o.includeTeam !== false)); const message = cleanText(o.message, 900);
  const title = coverTitle({ relation: o.relation, name: m.resident.name, today: m.today, hemisphere: o.hemisphere }).title;
  const parts = []; parts.push({ role: "cover", html: coverHtml(m), label: title });
  if (message) parts.push({ role: "message", html: `<div class="lb-msg"><p class="lb-kicker">A note for the family</p><h2>From our team</h2><div class="lb-message">${esc(message).split(/\n+/).map((l) => `<p>${l}</p>`).join("")}</div></div>`, label: title });
  parts.push({ role: "contents", html: "@@CONTENTS@@", label: title });
  const startOf = {};
  for (const c of chapters) {
    parts.push({ role: "divider", chapter: c.key, html: `<div class="lb-divider"><p class="lb-kicker">Chapter</p><h2>${esc(c.title)}</h2><div class="lb-rule"></div><p>${esc(c.blurb)}</p><p class="lb-count">${m.chapters[c.key].length} ${m.chapters[c.key].length === 1 ? "entry" : "entries"}</p></div>`, label: c.title });
    const pgs = paginate(m.chapters[c.key]); pgs.forEach((items, i) => parts.push({ role: "content", chapter: c.key, html: `<div class="lb-content"><h2 class="lb-run">${esc(c.title)}${pgs.length > 1 ? " <small>(" + (i + 1) + " of " + pgs.length + ")</small>" : ""}</h2>${items.map((it) => itemHtml(it, o.art)).join("")}</div>`, label: c.title }));
  }
  if (!chapters.length) parts.push({ role: "content", html: `<div class="lb-content"><h2 class="lb-run">This quarter</h2><p>Nothing has been shared for the last ${m.range.days} days yet. Keep memories during the quarter and compile the book again.</p></div>`, label: title });
  parts.forEach((p, i) => { p.n = i + 1; if (p.chapter && p.role === "divider") startOf[p.chapter] = p.n; });
  const contents = `<div class="lb-toc"><h2>Contents</h2><ol>${chapters.map((c) => `<li><span>${esc(c.title)}</span><i></i><b>${startOf[c.key]}</b></li>`).join("")}</ol><p class="lb-small">${m.total} entr${m.total === 1 ? "y" : "ies"} from ${esc(longDate(m.range.from))} to ${esc(longDate(m.range.to))}.</p></div>`;
  const pages = parts.map((p) => ({ role: p.role, chapter: p.chapter || "", n: p.n, html: sheet(p.html === "@@CONTENTS@@" ? contents : p.html, p.n, parts.length, p.label, p.role) }));
  return { pages, meta: { title, range: m.range, resident: m.resident, pageCount: parts.length, gutterIn: GUTTER_IN }, counts: m.counts, skipped: m.skipped, empty: m.total === 0 };
}
/* The CSS the pages need. The same rules live in css/styles.css; this is returned so a test, or a stand-alone export, can inline them. */
export const BOOK_CSS = `
.lb-sheet{box-sizing:border-box;color:#000;background:#fff;font-family:"Atkinson Hyperlegible","Segoe UI",Arial,sans-serif;line-height:1.4;position:relative;display:flex;flex-direction:column;break-after:page;page-break-after:always}
.lb-odd{padding:.75in .5in .75in ${GUTTER_IN}in!important}.lb-even{padding:.75in ${GUTTER_IN}in .75in .5in!important}`;
export { esc };
