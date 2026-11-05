/* Today's Packet: time-aware prompts and wing-wide queues.

   timeOfDay() and timeAware() shift a packet request with the hour: mornings lean on energizing orientation (the day, the season, a
   task to sort or match), afternoons and evenings on calming reminiscence that helps with sundowning (music, familiar things, fewer
   pieces, a gentler stage). queuePackets() makes one packet for every resident on a wing or floor, one after another so the browser
   stays responsive, and returns them with a divider sheet in front of each. Nothing is sent anywhere. */

import { renderAllPagesHtml } from "./print-preview-modal.js";
export const VERSION = "1.0.0";
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f{}<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

export function timeOfDay(date) { const h = (date instanceof Date && !isNaN(date) ? date : new Date()).getHours(); return h >= 5 && h < 12 ? "morning" : h >= 12 && h < 17 ? "afternoon" : "evening"; }
export const SHIFTS = Object.freeze({
  morning: { label: "Morning", intent: "Energizing orientation", focus: "seasons", include: { wordSearch: true, sparks: true, matching: true }, gentler: 0, preset: null },
  afternoon: { label: "Afternoon", intent: "Calming reminiscence", focus: "music", include: { wordSearch: false, sparks: true, matching: true }, gentler: 0, preset: null },
  evening: { label: "Evening", intent: "Calm, sundowning-friendly reminiscence", focus: "music", include: { wordSearch: false, sparks: true, matching: true }, gentler: 1, preset: "evening-calm" }
});
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/* The orientation line a morning sheet carries: said as a fact to enjoy, never a question to answer. */
export const orientationLine = (d) => "Today is " + WEEKDAY[d.getDay()] + ", " + MONTH[d.getMonth()] + " " + d.getDate() + ".";
/* request: anything the orchestrator takes. Returns a new request shifted for the hour; the original is not changed. */
export function timeAware(request, when = new Date()) {
  const r = request && typeof request === "object" ? request : {}, slot = timeOfDay(when), s = SHIFTS[slot], deep = Object.assign({}, r.deep), tierIn = Number(r.options && r.options.tier) || Number(r.profile && (r.profile.ailmentTier || r.profile.tier)) || 2;
  const notes = [...(slot === "morning" ? [orientationLine(when)] : slot === "evening" ? ["Take it slowly. There is no need to finish."] : []), ...(Array.isArray(deep.notes) ? deep.notes : [])].slice(0, 4);
  const tier = Math.min(3, tierIn + s.gentler);
  return Object.assign({}, r, { slot, deep: Object.assign({}, deep, { focus: deep.focus && deep.focus !== "mixed" ? deep.focus : s.focus, include: Object.assign({}, s.include, deep.include), notes }), options: Object.assign({ template: "reminiscence" }, r.options, { tier }), preset: r.preset || s.preset || undefined, timeOfDay: slot, intent: s.intent });
}

/* ---------- the wing queue ---------- */
export function dividerHtml(o) {
  return `<div class="sheet pk-divider" data-pk-divider><div class="pk-div"><p class="pk-kicker">${esc(o.wing || "Today’s Packets")}</p><h2>${esc(o.label || "Resident")}</h2><p class="pk-sub">${esc(o.unit || "")}</p><div class="pk-rule"></div><p>Resident ${o.n} of ${o.total}</p><p>${esc(o.slotLabel || "")}${o.date ? " &middot; " + esc(o.date) : ""}</p></div></div>`;
}
/* residents: [{ id, label, unit?, request }]. Returns { items, pages, summary }. One failure never stops the queue; shouldCancel and onProgress are honoured. */
export async function queuePackets(orchestrator, residents, o = {}) {
  const list = (Array.isArray(residents) ? residents : []).slice(0, o.max || 200), when = o.when instanceof Date ? o.when : new Date(), items = [], pages = [], summary = { requested: list.length, made: 0, blocked: 0, failed: 0, cancelled: false };
  const tick = () => new Promise((r) => setTimeout(r, 0)), date = when.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), slot = SHIFTS[timeOfDay(when)];
  for (let i = 0; i < list.length; i++) {
    if (typeof o.shouldCancel === "function" && o.shouldCancel()) { summary.cancelled = true; break; }
    const r = list[i], label = clip(r.label, 60) || "Resident " + (i + 1);
    try {
      const res = await orchestrator.execute(timeAware(r.request, when)); if (!res || res.ok === false) throw new Error("not made");
      if (res.audit && res.audit.status === "blocked") { summary.blocked++; items.push({ id: r.id, label, status: "blocked" }); }
      else { summary.made++; items.push({ id: r.id, label, status: res.audit ? res.audit.status : "pass", asset: res.asset }); pages.push({ role: "divider", html: dividerHtml({ wing: o.wing, label, unit: r.unit, n: i + 1, total: list.length, slotLabel: slot.label + ": " + slot.intent, date }) }); pages.push({ role: "packet", html: renderAllPagesHtml(res.asset) }); }
    } catch (e) { summary.failed++; items.push({ id: r.id, label, status: "failed" }); }
    if (typeof o.onProgress === "function") { try { o.onProgress({ done: i + 1, total: list.length }); } catch (e) { /* a broken callback never stops the queue */ } }
    await tick();
  }
  return { items, pages, summary };
}
