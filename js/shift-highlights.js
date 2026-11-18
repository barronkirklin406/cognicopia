/* One-page shift handoff highlights: what a team coming on shift most needs from the one going off, taken from the Shift board (CogniDailyOps)
   and set on a single US Letter page.

     Instant Soothe   every time a calming approach (Instant Soothe, a de-escalation page, a calming activity) was used on the shift, with how the
                      resident was recorded afterwards: settled, still unsettled or not recorded. The words are staff's; the page does not judge.
     Fully engaged    who took part fully, in what.
     Keep an eye on   residents recorded as restless, anxious, sad, distracted or overstimulated, and "keep an eye on" notes.
     What worked      "what worked" notes.
     Still to do      open tasks.

   Residents appear by alias or room only, as on the board. Each section has a limit so the page can never run onto a second sheet; what does not
   fit is counted ("and 3 more on the full handoff sheet"). Pure black on white, lines of 3 pt or more. */

const D = () => (typeof globalThis !== "undefined" && globalThis.CogniDailyOps) || null;
const need = () => { const d = D(); if (!d) throw new Error("The Shift board tools did not load."); return d; };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (s, n) => { const t = String(s == null ? "" : s).replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
export const LIMITS = Object.freeze({ soothe: 6, engaged: 6, watch: 6, worked: 5, open: 6, text: 120 });
export const SOOTHE_RE = /\b(instant[\s-]*soothe|soothe|soothing|calming|calm(?:ing)? (?:page|packet|activity)|de-?escalat\w*|sundown\w*)\b/i;
const SETTLED = new Set(["calm", "content", "happy", "tired"]);
const outcomeOf = (mood) => (!mood ? "not recorded" : SETTLED.has(mood) ? "settled" : "still unsettled");

/* opts: { day, shift ("day" | "evening" | "night" | "all"), wing, now }
   -> { day, shift, forLabel, soothe, engaged, watch, worked, open, more, totals } */
export function build(board, opts = {}) {
  const d = need(), day = opts.day || d.slotAt(opts.now || new Date()).day, shift = opts.shift || "all", wing = opts.wing == null ? null : opts.wing, b = board || d.emptyBoard();
  const eng = d.engagementsFor(b, day, shift, wing), notes = d.notesFor(b, day, shift, wing), h = d.handoff(b, day, shift, opts.now || new Date(), wing);
  const mood = (id) => (id ? (d.moodOf(id) || {}).label || "" : "");
  const soothe = eng.filter((e) => SOOTHE_RE.test(e.activity)).map((e) => ({ resident: e.resident, time: e.time ? d.timeLabel(e.time) : "", activity: e.activity, outcome: outcomeOf(e.mood), mood: mood(e.mood), note: e.note }));
  const engaged = eng.filter((e) => !SOOTHE_RE.test(e.activity) && e.participation === "engaged").map((e) => ({ resident: e.resident, time: e.time ? d.timeLabel(e.time) : "", activity: e.activity, mood: mood(e.mood) }));
  const flagged = eng.filter((e) => e.mood && (d.moodOf(e.mood) || {}).flag).map((e) => ({ about: e.resident, text: (mood(e.mood) + (e.activity ? " during " + e.activity : "")).trim() + (e.note ? ". " + e.note : "") }));
  const watch = [...flagged, ...notes.filter((n) => n.kind === "watch").map((n) => ({ about: n.about, text: n.text }))];
  const worked = notes.filter((n) => n.kind === "worked").map((n) => ({ about: n.about, text: n.text }));
  const open = h.open.map((t) => ({ about: t.about, text: t.what, who: t.for }));
  const cut = (list, n) => list.slice(0, n), more = { soothe: Math.max(0, soothe.length - LIMITS.soothe), engaged: Math.max(0, engaged.length - LIMITS.engaged), watch: Math.max(0, watch.length - LIMITS.watch), worked: Math.max(0, worked.length - LIMITS.worked), open: Math.max(0, open.length - LIMITS.open) };
  return { day, shift, forLabel: h.forLabel, soothe: cut(soothe, LIMITS.soothe), engaged: cut(engaged, LIMITS.engaged), watch: cut(watch, LIMITS.watch), worked: cut(worked, LIMITS.worked), open: cut(open, LIMITS.open), more,
    totals: { soothe: soothe.length, settled: soothe.filter((s) => s.outcome === "settled").length, engaged: engaged.length, watch: watch.length, worked: worked.length, open: open.length } };
}
const sec = (title, items, more, render, empty) => `<section class="sh-sec"><h2>${esc(title)}</h2>${items.length ? `<ul class="sh-list">${items.map(render).join("")}</ul>` : `<p class="sh-none">${esc(empty)}</p>`}${more ? `<p class="sh-more">and ${more} more on the full handoff sheet</p>` : ""}</section>`;
const who = (a) => (a ? `<b>${esc(clip(a, 32))}</b> ` : "");
/* ctx: { facility, wing, initials } -> one sheet (html) */
export function page(h, ctx = {}) {
  const d = need(), c = ctx || {}, T = LIMITS.text, shiftName = h.shift === "all" ? "All shifts" : d.shiftLabel(h.shift);
  const body = [
    sec("Instant Soothe and calming approaches", h.soothe, h.more.soothe, (s) => `<li class="sh-soothe sh-${s.outcome.replace(/\s+/g, "-")}">${who(s.resident)}${esc(clip(s.activity, 60))}${s.time ? ", " + esc(s.time) : ""}: <b>${esc(s.outcome)}</b>${s.mood ? " (" + esc(s.mood.toLowerCase()) + ")" : ""}${s.note ? ". " + esc(clip(s.note, T)) : ""}</li>`, "None recorded on this shift."),
    sec("Fully engaged", h.engaged, h.more.engaged, (e) => `<li>${who(e.resident)}${esc(clip(e.activity, 60))}${e.mood ? " (" + esc(e.mood.toLowerCase()) + ")" : ""}</li>`, "None recorded on this shift."),
    sec("Keep an eye on", h.watch, h.more.watch, (w) => `<li>${who(w.about)}${esc(clip(w.text, T))}</li>`, "Nothing flagged."),
    sec("What worked", h.worked, h.more.worked, (w) => `<li>${who(w.about)}${esc(clip(w.text, T))}</li>`, "Nothing recorded."),
    sec("Still to do", h.open, h.more.open, (t) => `<li><span class="sh-box" aria-hidden="true"></span>${who(t.about)}${esc(clip(t.text, T))}${t.who ? " <small>(" + esc(t.who) + ")</small>" : ""}</li>`, "No open tasks.")
  ].join("");
  return `<div class="sheet sh-hi"><header class="tr-head"><p class="tr-kicker">Shift handoff highlights${c.wing ? " &middot; " + esc(c.wing) : ""}</p><h1>${esc(d.dayLabel ? d.dayLabel(h.day) : h.day)} &middot; ${esc(shiftName)}</h1><p>${h.forLabel ? esc(h.forLabel) + " &middot; " : ""}${h.totals.soothe ? h.totals.settled + " of " + h.totals.soothe + " calming approach" + (h.totals.soothe === 1 ? "" : "es") + " recorded as settled &middot; " : ""}${h.totals.engaged} fully engaged</p></header>${body}
    <p class="tr-note">Residents are shown by alias or room. These are the words staff recorded on the Shift board; they are not an assessment.</p>
    <footer class="tr-foot"><span>${esc(c.facility || "Cognicopia")} &middot; Shift handoff highlights${c.initials ? " &middot; " + esc(c.initials) : ""}</span><b>Page 1 of 1</b></footer></div>`;
}

/* ---------- the handover: one page for the team coming on (a staff sheet, 16 pt and larger, pure black on white) ----------
   The same recorded words as the highlights, cut to what fits at a large size, with who is planned for the NEXT shift from the staffing calendar
   (initials only). Residents appear by alias or room, exactly as on the board; nothing is stored. */
export const HAND = Object.freeze({ soothe: 2, watch: 3, worked: 2, open: 3, text: 80 });
const NEXT = { day: "evening", evening: "night", night: "day" };
/* cal: the staffing calendar record (or null); -> null when there is nothing to say (all shifts, or no calendar), else { day, shift, label, planned, initials, assigned, needed, specialists, specialistsNeeded, gap } */
export function comingOn(cal, day, shift) {
  const C = (typeof globalThis !== "undefined" && globalThis.CogniShiftCal) || null;
  if (!C || !cal || !NEXT[shift] || !/^\d{4}-\d{2}-\d{2}$/.test(String(day))) return null;
  const nextShift = NEXT[shift], nextDay = shift === "night" ? C.addDays(day, 1) : day, cv = C.coverage(C.normalize(cal), nextDay, nextShift), label = (C.SHIFTS.filter((x) => x.id === nextShift)[0] || {}).label || nextShift;
  return { day: nextDay, shift: nextShift, label, planned: cv.planned, initials: cv.people.map((p) => p.initials).filter(Boolean), assigned: cv.assigned, needed: cv.needed, specialists: cv.specialists, specialistsNeeded: cv.specialistsNeeded, gap: cv.gap + cv.specialistGap };
}
/* h: build()'s result; ctx: { facility, wing, coming (comingOn's result) } -> one sheet (html) */
export function handoverPage(h, ctx = {}) {
  const d = need(), c = ctx || {}, T = HAND.text, shiftName = h.shift === "all" ? "All shifts" : d.shiftLabel(h.shift);
  const part = (title, items, total, n, render, empty) => { const shown = items.slice(0, n), more = Math.max(0, total - shown.length);
    return `<section class="cg-ho-sec"><h3>${esc(title)}</h3>${shown.length ? `<ul>${shown.map(render).join("")}</ul>` : `<p>${esc(empty)}</p>`}${more ? `<p class="cg-ho-more">and ${more} more on the full handoff sheet.</p>` : ""}</section>`; };
  const k = c.coming;
  const coming = !k ? "" : `<section class="cg-ho-sec"><h3>Coming on: ${esc(k.label)} shift</h3>` + (!k.planned ? `<p>No one is planned yet for the ${esc(k.label.toLowerCase())} shift.</p>`
    : `<p><b>${esc(k.initials.join(", "))}</b>. ${k.assigned} of ${k.needed} needed${k.specialistsNeeded ? `, ${k.specialists} dementia-trained of ${k.specialistsNeeded} wanted` : ""}.${k.gap ? " More people are needed." : ""}</p>`) + "</section>";
  const body = coming
    + part("Calming approaches used", h.soothe, h.totals.soothe, HAND.soothe, (s) => `<li>${who(s.resident)}${esc(clip(s.activity, 40))}${s.time ? ", " + esc(s.time) : ""}: <b>${esc(s.outcome)}</b></li>`, "None recorded.")
    + part("Keep an eye on", h.watch, h.totals.watch, HAND.watch, (w) => `<li>${who(w.about)}${esc(clip(w.text, T))}</li>`, "Nothing flagged.")
    + part("What worked", h.worked, h.totals.worked, HAND.worked, (w) => `<li>${who(w.about)}${esc(clip(w.text, T))}</li>`, "Nothing recorded.")
    + part("Still to do", h.open, h.totals.open, HAND.open, (t) => `<li>${who(t.about)}${esc(clip(t.text, T))}${t.who ? " (" + esc(t.who) + ")" : ""}</li>`, "No open tasks.");
  return `<div class="cg-staff-sheet cg-ho"><p class="cg-calm-kick">Shift handover${c.wing ? " &middot; " + esc(c.wing) : ""}</p><h1>${esc(d.dayLabel ? d.dayLabel(h.day) : h.day)} &middot; ${esc(shiftName)}</h1>${body}`
    + `<p class="cg-calm-foot">Residents are shown by alias or room. These are the words staff recorded; not an assessment. ${esc(c.facility || "Cognicopia")}</p></div>`;
}
