/* Cognicopia Studio screens: #/tracking, #/planner, #/journal.

   Each screen is mounted into the Packet Builder's view and torn down again when the address changes. A screen keeps its state inside its
   own mount, aborts its own listeners and empties its own page on the way out, so nothing typed or chosen in one tool can show up in
   another. Records live under each tool's own storage key (js/studio-core.js). Nothing is sent anywhere.

   The builder hands in what it owns (deps): esc, toast, todayISO, store (its encrypted storage), residents() for the saved profiles,
   activeId() for the resident chosen at the top of the page, and nameOf(profile). */

import * as C from "./studio-core.js";

let deps = null, mounted = null;
const H = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => (deps && deps.today ? deps.today() : new Date());
const iso = () => (deps && deps.todayISO ? deps.todayISO() : today().toISOString().slice(0, 10));
const say = (m) => { try { deps.toast(m); } catch (e) { /* no toast */ } };

export function init(d) {
  deps = d; if (typeof document !== "undefined") { try { C.migrate(deps.store, today()); } catch (e) { /* a store that is not ready yet is migrated on first save */ } C.startJournalFeed(document, () => deps.store); }
}
export function teardown() { if (mounted) { try { mounted.ac.abort(); mounted.view.innerHTML = ""; } catch (e) { /* the page is gone */ } mounted = null; } }
export function current() { return mounted ? mounted.name : null; }

const TOOLS = {
  tracking: { title: "Longitudinal Cognitive Tracking", eyebrow: "Staff tool", lede: "Log each month how engaged a resident was, what frustrated them and how tired their eyes were, at the stage they were in. After three months the page looks for a sustained pattern and, if it finds one, suggests whether a gentler or a fuller stage might suit them. It reads what staff recorded; it does not assess anyone." },
  planner: { title: "12-Month Seasonal Planner", eyebrow: "Facility tool", lede: "A year at a glance for the whole community: which era to draw on, the seasonal milestone and the theme for each month. When the plan looks right, one click links every coming month to a bundle that the monthly roster generation can pick up." },
  journal: { title: "Resident Life Narrative Journal", eyebrow: "Staff tool", lede: "Write down spontaneous breakthroughs and the moments that helped someone settle. New keywords and stories are added to the resident's own profile notes automatically, so the next activity can start from them." }
};
export function render(name, view, d) {
  if (d) deps = d; if (!deps) { view.innerHTML = `<p class="hint">The Studio tools are still loading.</p>`; return; }
  teardown(); const t = TOOLS[name]; if (!t) return;
  const ac = new AbortController(); mounted = { name, view, ac, state: {} };
  view.innerHTML = `<div class="st-tool" data-st="${name}"><p class="eyebrow">${H(t.eyebrow)}</p><h1 class="view-title" tabindex="-1">${H(t.title)}</h1><p class="lede">${H(t.lede)}</p><div id="stBody"></div></div>`;
  ({ tracking: tracking, planner: planner, journal: journal }[name])(view.querySelector("#stBody"), mounted);
}
const resOptions = (sel) => { const l = deps.residents(); return `<option value="">${l.length ? "Choose a resident" : "No saved residents yet"}</option>` + l.map((p) => `<option value="${H(p.id)}"${p.id === sel ? " selected" : ""}>${H(deps.nameOf(p))}</option>`).join(""); };
const firstResident = () => { const a = deps.activeId && deps.activeId(), l = deps.residents(); return a && l.some((p) => p.id === a) ? a : ""; };
const on = (m, el, ev, fn) => el.addEventListener(ev, fn, { signal: m.ac.signal });
const radios = (name, labels, val) => `<div class="st-scale" role="radiogroup" aria-label="${H(name)}">${labels.map((l, i) => `<label class="st-opt"><input type="radio" name="${H(name)}" value="${i}"${i === val ? " checked" : ""}><span><b>${i}</b> ${H(l)}</span></label>`).join("")}</div>`;

/* ---------------- tracking ---------------- */
function tracking(body, m) {
  const S = m.state; S.res = firstResident(); S.month = C.monthKey(today());
  body.innerHTML = `<div class="config" style="margin-top:0"><div class="field"><label for="stRes">Resident</label><select id="stRes">${resOptions(S.res)}</select></div><div id="stPanel"></div></div>`;
  const panel = body.querySelector("#stPanel"), sel = body.querySelector("#stRes");
  const draw = () => {
    if (!S.res) { panel.innerHTML = `<p class="hint">Choose a resident to see and add their monthly log.</p>`; return; }
    const log = C.readTracking(deps.store, S.res), cur = log.entries.find((e) => e.month === S.month) || { stage: (log.entries[log.entries.length - 1] || {}).stage || "middle", engagement: 2, frustration: 0, fatigue: 0, triggers: [], note: "" };
    const a = C.analyze(log.entries, today()), rec = a.recommendation;
    panel.innerHTML = `
      <div class="st-banner ${rec.banner ? "st-" + rec.type : ""}" id="stBanner" role="status" aria-live="polite">${rec.banner ? `<b>${H(rec.banner)}</b><p>${H(rec.reason)}</p><p class="hint">${H(rec.note)}</p>` : `<p class="hint">${H(rec.reason || "")}${rec.type === "hold" ? " " + H(rec.note) : ""}</p>`}</div>
      <form id="stForm" class="st-form" novalidate>
        <div class="row2"><div class="field"><label for="stMonth">Month</label><input id="stMonth" type="month" value="${H(S.month)}"></div>
          <fieldset class="field"><legend>Stage this month</legend><div class="st-stage">${C.STAGES.map((s) => `<label class="st-opt"><input type="radio" name="stage" value="${s.code}"${s.code === cur.stage ? " checked" : ""}><span>${H(s.label)}</span></label>`).join("")}</div></fieldset></div>
        <fieldset class="field"><legend>How engaged were they?</legend>${radios("engagement", C.SCALE.engagement, cur.engagement)}</fieldset>
        <fieldset class="field"><legend>How much frustration?</legend>${radios("frustration", C.SCALE.frustration, cur.frustration)}</fieldset>
        <fieldset class="field"><legend>How tired were their eyes (visual fatigue)?</legend>${radios("fatigue", C.SCALE.fatigue, cur.fatigue)}</fieldset>
        <fieldset class="field"><legend>What seemed to bring on frustration?</legend><div class="st-chips">${C.TRIGGERS.map((t) => `<label class="st-opt"><input type="checkbox" name="trig" value="${H(t)}"${cur.triggers.includes(t) ? " checked" : ""}><span>${H(t)}</span></label>`).join("")}</div></fieldset>
        <div class="field"><label for="stNote">A note <span class="sub">Optional. What you saw, in plain words. No names but the resident's.</span></label><textarea id="stNote" rows="3" maxlength="300">${H(cur.note)}</textarea></div>
        <div class="actions"><button class="btn btn-primary" type="submit" id="stSave">Save this month</button></div></form>
      <h2 class="st-h2">The last 12 months</h2>
      <div class="st-scroll"><table class="st-matrix"><caption class="sr-only">Monthly log, newest first</caption><thead><tr><th scope="col">Month</th><th scope="col">Stage</th><th scope="col">Engaged</th><th scope="col">Frustration</th><th scope="col">Eye fatigue</th><th scope="col">What brought it on</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${C.monthsBack(today(), 12).reverse().map((mo) => { const e = log.entries.find((x) => x.month === mo); return e ? `<tr><th scope="row">${H(C.monthLabel(mo))}</th><td>${H((C.STAGES.find((s) => s.code === e.stage) || {}).label)}</td><td>${e.engagement}</td><td>${e.frustration}</td><td>${e.fatigue}</td><td>${H(e.triggers.join(", ")) || "&ndash;"}</td><td><button type="button" class="btn btn-sm" data-edit="${mo}">Open</button></td></tr>` : `<tr class="st-empty"><th scope="row">${H(C.monthLabel(mo))}</th><td colspan="5">Not logged</td><td><button type="button" class="btn btn-sm" data-edit="${mo}">Add</button></td></tr>`; }).join("")}</tbody></table></div>
      <h2 class="st-h2">Trends</h2>
      <div class="st-scroll"><table class="st-matrix"><thead><tr><th scope="col">Window</th><th scope="col">Months logged</th><th scope="col">Engagement</th><th scope="col">Frustration</th><th scope="col">Eye fatigue</th><th scope="col">Most often noted</th></tr></thead><tbody>${[3, 6, 12].map((w) => { const x = a.windows[w]; return `<tr><th scope="row">${w} months</th><td>${x.n}</td>${["engagement", "frustration", "fatigue"].map((k) => `<td>${x.n ? x[k] + " of 4, " + x.trends[k] : "&ndash;"}</td>`).join("")}<td>${H(x.triggers.map((t) => t.trigger).join(", ")) || "&ndash;"}</td></tr>`; }).join("")}</tbody></table></div>`;
  };
  on(m, sel, "change", () => { S.res = sel.value; S.month = C.monthKey(today()); draw(); });
  on(m, body, "click", (e) => { const b = e.target.closest("[data-edit]"); if (b) { S.month = b.dataset.edit; draw(); const f = body.querySelector("#stMonth"); if (f) f.focus(); } });
  on(m, body, "change", (e) => { if (e.target.id === "stMonth" && /^\d{4}-\d{2}$/.test(e.target.value)) { S.month = e.target.value; draw(); } });
  on(m, body, "submit", (e) => {
    if (e.target.id !== "stForm") return; e.preventDefault(); const f = e.target, v = (n) => Number((f.querySelector(`[name="${n}"]:checked`) || {}).value);
    try {
      C.saveEntry(deps.store, S.res, { month: f.querySelector("#stMonth").value, stage: (f.querySelector('[name="stage"]:checked') || {}).value, engagement: v("engagement"), frustration: v("frustration"), fatigue: v("fatigue"), triggers: [...f.querySelectorAll('[name="trig"]:checked')].map((x) => x.value), note: f.querySelector("#stNote").value });
      S.month = f.querySelector("#stMonth").value; say("Saved."); draw(); const bn = body.querySelector("#stBanner"); if (bn) bn.focus && bn.setAttribute("tabindex", "-1");
    } catch (err) { say(err.message); }
  });
  draw();
}

/* ---------------- planner ---------------- */
function planner(body, m) {
  const S = m.state; S.year = today().getFullYear(); S.plan = C.readPlanner(deps.store, S.year);
  const draw = () => {
    const p = S.plan, y = S.year, anyFilled = Object.values(p.months).some((x) => x.milestone || x.arc || x.theme || x.notes);
    body.innerHTML = `<div class="config" style="margin-top:0">
      <div class="row2"><div class="field"><label for="plYear">Year</label><select id="plYear">${[y - 1, y, y + 1].map((n) => `<option${n === S.year ? " selected" : ""}>${n}</option>`).join("")}</select></div>
        <div class="field" style="align-self:end"><div class="actions" style="margin:0"><button type="button" class="btn" id="plDefaults">${anyFilled ? "Reset to sensible defaults" : "Fill in sensible defaults"}</button></div></div></div>
      <p class="hint">Eras come from what residents lived through. Milestones leave out days that can stir strong feelings; add them yourself if your community wants them.</p>
      <div class="st-scroll"><table class="st-matrix st-plan"><caption class="sr-only">The year, month by month</caption><thead><tr><th scope="col">Month</th><th scope="col">Era to draw on</th><th scope="col">Season</th><th scope="col">Milestone</th><th scope="col">Thematic arc</th><th scope="col">Theme for the bundle</th><th scope="col">Notes</th></tr></thead><tbody>
      ${Array.from({ length: 12 }, (_, i) => { const k = String(i + 1).padStart(2, "0"), x = p.months[k], id = "pl" + k, b = p.bundles.find((q) => q.month === y + "-" + k); return `<tr data-m="${k}"><th scope="row">${H(C.monthLabel(y + "-" + k).replace(" " + y, ""))}${b ? `<span class="st-tag">${b.status === "generated" ? "Generated" : "Mapped"}</span>` : ""}</th>
        <td><select aria-label="Era, ${H(k)}" data-f="era">${C.ERAS.map((e) => `<option${e === x.era ? " selected" : ""}>${e}</option>`).join("")}</select></td>
        <td><input type="text" aria-label="Season, month ${k}" data-f="season" maxlength="30" value="${H(x.season)}"></td>
        <td><input type="text" aria-label="Milestone, month ${k}" data-f="milestone" maxlength="80" value="${H(x.milestone)}"></td>
        <td><input type="text" list="plArcs" aria-label="Thematic arc, month ${k}" data-f="arc" maxlength="40" value="${H(x.arc)}"></td>
        <td><input type="text" aria-label="Theme, month ${k}" data-f="theme" maxlength="60" value="${H(x.theme)}" placeholder="${H(x.milestone || x.arc)}"></td>
        <td><input type="text" aria-label="Notes, month ${k}" data-f="notes" maxlength="300" value="${H(x.notes)}"></td></tr>`; }).join("")}</tbody></table></div>
      <datalist id="plArcs">${C.ARCS.map((a) => `<option value="${H(a)}">`).join("")}</datalist>
      <div class="actions"><button type="button" class="btn btn-primary" id="plPremap">Pre-map the coming months to roster bundles</button></div>
      <p class="hint" id="plStatus" role="status" aria-live="polite">${p.bundles.length ? p.bundles.length + " month" + (p.bundles.length === 1 ? "" : "s") + " mapped: " + p.bundles.map((b) => C.monthLabel(b.month).split(" ")[0] + " (" + H(b.theme) + ")").join(", ") + "." : "Nothing is mapped yet."}</p></div>`;
  };
  on(m, body, "change", (e) => {
    const t = e.target;
    if (t.id === "plYear") { S.year = Number(t.value); S.plan = C.readPlanner(deps.store, S.year); draw(); return; }
    const tr = t.closest("tr[data-m]"); if (!tr || !t.dataset.f) return; S.plan.months[tr.dataset.m][t.dataset.f] = t.value; S.plan = C.savePlanner(deps.store, S.plan);
  });
  on(m, body, "click", (e) => {
    if (e.target.id === "plDefaults") { S.plan = C.savePlanner(deps.store, Object.assign(C.defaultPlan(S.year), { bundles: S.plan.bundles })); draw(); say("Defaults filled in."); }
    if (e.target.id === "plPremap") { const from = S.year === today().getFullYear() ? today() : new Date(S.year, 0, 1), r = C.premap(S.plan, from, 12); S.plan = C.savePlanner(deps.store, r.planner); draw(); body.querySelector("#plStatus").textContent = r.mapped ? r.mapped + " month" + (r.mapped === 1 ? "" : "s") + " linked to roster bundles. The monthly roster generation will use them." + (r.mapped === 0 ? "" : "") : "No months to map: they may already be generated, or the year is over."; }
  });
  draw();
}

/* ---------------- journal ---------------- */
function journal(body, m) {
  const S = m.state; S.res = firstResident();
  body.innerHTML = `<div class="config" style="margin-top:0"><div class="field"><label for="jnRes">Resident</label><select id="jnRes">${resOptions(S.res)}</select></div><div id="jnPanel"></div></div>`;
  const panel = body.querySelector("#jnPanel"), sel = body.querySelector("#jnRes");
  const draw = (msg) => {
    if (!S.res) { panel.innerHTML = `<p class="hint">Choose a resident to write in their journal.</p>`; return; }
    const j = C.readJournal(deps.store, S.res), ins = C.readInsights(deps.store, S.res), top = Object.entries(ins.keywords).sort((a, b) => b[1] - a[1]).slice(0, 12);
    panel.innerHTML = `<form id="jnForm" class="st-form" novalidate>
        <fieldset class="field"><legend>What would you like to record?</legend><div class="st-stage">${C.JOURNAL_KINDS.map((k, i) => `<label class="st-opt"><input type="radio" name="kind" value="${k.code}"${i === 0 ? " checked" : ""}><span><b>${H(k.label)}</b><small>${H(k.hint)}</small></span></label>`).join("")}</div></fieldset>
        <div class="field"><label for="jnText">What happened <span class="sub">In plain words, as it happened. Their own words in quotation marks are welcome.</span></label><textarea id="jnText" rows="5" maxlength="600" required></textarea></div>
        <div class="field"><label for="jnCtx">What was going on <span class="sub">Optional: the time, the place, what came before.</span></label><input id="jnCtx" type="text" maxlength="200" autocomplete="off"></div>
        <p class="hint" id="jnKw" aria-live="polite">Keywords will appear here as you write.</p>
        <div class="actions"><button class="btn btn-primary" type="submit">Save to the journal</button></div></form>
      <p class="hint" id="jnFeed" role="status" aria-live="polite">${H(msg || "")}</p>
      <h2 class="st-h2">In their profile notes</h2><p class="hint">${top.length ? top.map(([k, n]) => `<span class="st-tag">${H(k)}${n > 1 ? " ×" + n : ""}</span>`).join(" ") : "Nothing yet. Each entry adds its keywords here."}</p>
      <h2 class="st-h2">The journal</h2><ol class="st-list">${j.entries.slice().reverse().map((e) => `<li><div><span class="st-tag">${H((C.JOURNAL_KINDS.find((k) => k.code === e.kind) || {}).label)}</span> <time datetime="${H(e.at)}">${H(new Date(e.at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))}</time></div><p>${H(e.text)}</p>${e.context ? `<p class="hint">${H(e.context)}</p>` : ""}${e.keywords.length ? `<p class="hint">${e.keywords.map(H).join(" · ")}</p>` : ""}</li>`).join("") || `<li class="hint">No entries yet.</li>`}</ol>`;
  };
  on(m, sel, "change", () => { S.res = sel.value; draw(); });
  on(m, body, "input", (e) => { if (e.target.id === "jnText") { const k = C.keywordsOf(e.target.value), el = body.querySelector("#jnKw"); if (el) el.textContent = k.length ? "Keywords for the profile: " + k.join(", ") : "Keywords will appear here as you write."; } });
  on(m, body, "submit", (e) => {
    if (e.target.id !== "jnForm") return; e.preventDefault(); const f = e.target;
    try {
      const r = C.saveJournalEntry(deps.store, S.res, { kind: (f.querySelector('[name="kind"]:checked') || {}).value, text: f.querySelector("#jnText").value, context: f.querySelector("#jnCtx").value });
      document.dispatchEvent(new CustomEvent("cg-studio-journal-added", { detail: { residentId: S.res, entry: r.entry } }));
      draw("Saved. Adding " + (r.entry.keywords.length ? r.entry.keywords.join(", ") : "the story") + " to their profile notes…");
    } catch (err) { say(err.message); }
  });
  const fed = (ev) => { if (!mounted || mounted.name !== "journal" || ev.detail.residentId !== S.res) return; draw(ev.detail.ok ? "Saved, and added to their profile notes: " + (ev.detail.keywords.join(", ") || "the story") + "." : "Saved. The profile notes could not be updated."); };
  document.addEventListener("cg-studio-profile-fed", fed, { signal: m.ac.signal });
  draw();
}
if (typeof window !== "undefined") { window.CogniStudio = { init, render, teardown, current }; window.dispatchEvent(new Event("cogni-studio-ready")); }
