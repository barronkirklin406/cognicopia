/* Cognicopia facility screens: #/ehr-import, #/therapy-goals, #/highlights and #/scenarios.

   Each screen is mounted into the Packet Builder's view and torn down when the address changes (same rule as the Studio tools: nothing typed in
   one screen can show up in another). The builder hands in what it owns (deps): esc, toast, store (its encrypted storage), residents(),
   activeId(), nameOf(profile), today(), todayISO(), facility(), activeWing(), board() (the Shift board), initials(), print(pages, title),
   existingProfiles(), saveProfile(id, profile) and flush(). Nothing here is sent anywhere. */
import * as E from "./ehr-import.js";
import * as G from "./slp-goals.js";
import * as HL from "./shift-highlights.js";
import * as T from "./scenario-trees.js";

let deps = null, mounted = null;
const H = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const say = (m) => { try { deps.toast(m); } catch (e) { /* no toast */ } };
const iso = () => (deps && deps.todayISO ? deps.todayISO() : new Date().toISOString().slice(0, 10));
export function init(d) { deps = d; }
export function teardown() { if (mounted) { try { mounted.ac.abort(); mounted.view.innerHTML = ""; } catch (e) { /* the page is gone */ } mounted = null; } }
export function current() { return mounted ? mounted.name : null; }

const TOOLS = {
  "ehr-import": { title: "EHR Import Wizard", eyebrow: "Facility tool", lede: "Bring a resident list from PointClickCare, MatrixCare or any spreadsheet into Cognicopia in four steps. The file is read on this computer and nothing is sent anywhere. Only first names, rooms, wings and care levels are kept." },
  "therapy-goals": { title: "Therapy Goals (SLP)", eyebrow: "Clinical tool", lede: "Paste a therapy note to read its MoCA or MMSE scores, see which CPT codes the clinician may want to consider, and track goals by domain over time. The note's words are never saved; only the numbers and codes you confirm are." },
  highlights: { title: "Shift Highlights", eyebrow: "Facility tool", lede: "One page for the team coming on: calming approaches that settled someone, who was fully engaged, who to keep an eye on, what worked and what is still to do. Taken from the Shift board, by alias." },
  scenarios: { title: "Distress Scenario Practice", eyebrow: "Academy", lede: "Short branching scenarios on responding to distress with dignity. Choose what to do, read why, and finish with a printable completion certificate." }
};
export function render(name, view, d) {
  if (d) deps = d; if (!deps) { view.innerHTML = `<p class="hint">The facility tools are still loading.</p>`; return; }
  teardown(); const t = TOOLS[name]; if (!t) return;
  const ac = new AbortController(); mounted = { name, view, ac, state: {} };
  view.innerHTML = `<div class="st-tool ft-tool" data-ft="${name}"><p class="eyebrow">${H(t.eyebrow)}</p><h1 class="view-title" tabindex="-1">${H(t.title)}</h1><p class="lede">${H(t.lede)}</p><div id="ftBody"></div></div>`;
  ({ "ehr-import": wizard, "therapy-goals": goals, highlights, scenarios })[name](view.querySelector("#ftBody"), mounted);
}
const on = (m, el, ev, fn) => el.addEventListener(ev, fn, { signal: m.ac.signal });

/* ================= EHR import wizard ================= */
function wizard(body, m) {
  const S = m.state; Object.assign(S, { step: 1, system: "pointclickcare", text: "", fileName: "", table: null, mapping: null, opts: { nameMode: "first", defaultWing: "", wingNames: {}, mode: "update" }, pv: null, done: "" });
  const steps = ["Choose the file", "Match the columns", "Choose how to keep them", "Preview and import"];
  const bar = () => `<ol class="ft-steps" aria-label="Steps">${steps.map((s, i) => `<li${i + 1 === S.step ? ' aria-current="step"' : ""}${i + 1 < S.step ? ' class="ft-done"' : ""}><b aria-hidden="true">${i + 1 < S.step ? "\u2713" : i + 1}</b> ${H(s)}${i + 1 < S.step ? ' <span class="sr-only">(done)</span>' : ""}</li>`).join("")}</ol>`;
  const draw = () => { body.innerHTML = bar() + `<div class="ft-panel">${[null, s1, s2, s3, s4][S.step]()}</div>`; const h = body.querySelector(".ft-panel h2"); if (h) h.setAttribute("tabindex", "-1"); };
  const s1 = () => `<h2>Step 1. Choose the file</h2><fieldset class="field"><legend>Where does the file come from?</legend><div class="st-stage">${Object.entries(E.SYSTEMS).map(([k, s]) => `<label class="st-opt"><input type="radio" name="system" value="${k}"${S.system === k ? " checked" : ""}> <span>${H(s.label)}</span></label>`).join("")}</div></fieldset>
    <div class="field"><label for="ehrFile">Resident list (CSV or JSON)</label><input id="ehrFile" type="file" accept=".csv,.json,.txt,text/csv,application/json"><p class="hint">Export a census or resident list from the system and choose it here. Export column names differ between facilities, so the next step lets you check and change every match.</p></div>
    <p class="hint"><b>Never used, even if the file has them:</b> Social Security, record, account and insurance numbers; diagnoses and medications; phone numbers, addresses and family contacts; admission dates; last names; full birth dates (only the year is kept).</p>
    <p class="msg-bad" id="ehrErr" role="alert">${H(S.err || "")}</p><div class="actions"><button class="btn btn-primary" type="button" id="ehrRead">Read the file</button></div>`;
  const s2 = () => { const hs = S.table.headers, sel = (f) => `<select data-field="${f.id}" aria-label="${H(f.label)}"><option value="">Not in this file</option>${hs.map((h, i) => `<option value="${i}"${S.mapping.fields[f.id] === i ? " selected" : ""}>${H(h || "(blank heading)")}</option>`).join("")}</select>`;
    return `<h2>Step 2. Match the columns</h2><p>${H(S.fileName)}: <b>${S.table.rows.length}</b> resident${S.table.rows.length === 1 ? "" : "s"}${S.table.truncated ? " (the first 2,000)" : ""}. It looks like a <b>${H(E.SYSTEMS[S.detected].label)}</b> file. Check each match.</p>
    <div class="st-scroll"><table class="st-matrix"><thead><tr><th scope="col">Cognicopia needs</th><th scope="col">Column in the file</th><th scope="col">Note</th></tr></thead><tbody>${E.FIELDS.map((f) => `<tr><th scope="row">${H(f.label)}</th><td>${sel(f)}</td><td>${H(f.help)}</td></tr>`).join("")}</tbody></table></div>
    ${S.mapping.ignored.length ? `<div class="st-banner"><b>Not used (${S.mapping.ignored.length})</b><p>${S.mapping.ignored.map((x) => `${H(x.header)} <small>(${H(x.why)})</small>`).join("; ")}</p></div>` : ""}
    ${S.mapping.unused.length ? `<p class="hint">Also not used: ${S.mapping.unused.map(H).join(", ")}.</p>` : ""}
    <p class="msg-bad" id="ehrErr" role="alert">${H(S.err || "")}</p><div class="actions"><button class="btn" type="button" data-go="1">Back</button><button class="btn btn-primary" type="button" id="ehrNext2">Next</button></div>`; };
  const wingsInFile = () => { const F = S.mapping.fields; if (F.wing == null) return []; return [...new Set(S.table.rows.map((r) => String(r[F.wing] || "").replace(/\s+/g, " ").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "en", { numeric: true })).slice(0, 24); };
  const s3 = () => { const ws = wingsInFile(), o = S.opts; return `<h2>Step 3. Choose how to keep them</h2>
    <fieldset class="field"><legend>Names</legend><div class="st-stage"><label class="st-opt"><input type="radio" name="nameMode" value="first"${o.nameMode === "first" ? " checked" : ""}> <span>First names only (recommended)<small>Shift board pickers still use the room alias.</small></span></label><label class="st-opt"><input type="radio" name="nameMode" value="alias"${o.nameMode === "alias" ? " checked" : ""}> <span>No names at all<small>Residents are kept as &ldquo;Resident 204-B&rdquo;.</small></span></label></div></fieldset>
    <div class="field"><label for="ehrWing">Wing for any resident whose row has none</label><input id="ehrWing" type="text" maxlength="40" value="${H(o.defaultWing)}" placeholder="For example, Memory Care Unit A"></div>
    ${ws.length ? `<fieldset class="field"><legend>Wing names in the file. Rename any to your own name for it.</legend>${ws.map((w, i) => `<div class="ft-row"><span>${H(w)}</span><input type="text" maxlength="40" data-wing="${H(w)}" aria-label="Name to use for ${H(w)}" value="${H(o.wingNames[w] || "")}" placeholder="${H(w)}"></div>`).join("")}</fieldset>` : ""}
    <fieldset class="field"><legend>A resident who is already here</legend><div class="st-stage"><label class="st-opt"><input type="radio" name="mode" value="update"${o.mode === "update" ? " checked" : ""}> <span>Update what the file carries</span></label><label class="st-opt"><input type="radio" name="mode" value="skip"${o.mode === "skip" ? " checked" : ""}> <span>Leave them as they are</span></label></div></fieldset>
    <div class="actions"><button class="btn" type="button" data-go="2">Back</button><button class="btn btn-primary" type="button" id="ehrPreview">Preview</button></div>`; };
  const s4 = () => { const pv = S.pv, n = pv.counts, r = pv.report, go = n.add + n.update;
    return `<h2>Step 4. Preview and import</h2>${S.done ? `<p class="msg-ok" role="status">${H(S.done)}</p>` : `<p class="st-banner"><b>${n.add}</b> to add, <b>${n.update}</b> to update, <b>${n.skip + n.duplicate}</b> left out.</p>`}
    <ul class="ft-report"><li>Wings: ${r.wings.length ? r.wings.map(H).join(", ") : "none given"}. Rooms tagged: ${r.rooms}.</li>${r.lastNamesDropped ? "<li>Last names were not kept.</li>" : ""}${r.datesReduced ? "<li>Only the year of each birth date was kept.</li>" : ""}${r.tiersFromScore ? `<li>${r.tiersFromScore} starting tier${r.tiersFromScore === 1 ? "" : "s"} suggested from a cognitive score. Staff confirm each tier on the resident's profile.</li>` : ""}${r.noTier ? `<li>${r.noTier} resident${r.noTier === 1 ? " has" : "s have"} no care level and start at Tier 2.</li>` : ""}${r.ignored.length ? `<li>Not used: ${r.ignored.map((x) => H(x.header)).join(", ")}.</li>` : ""}</ul>
    <div class="st-scroll"><table class="st-matrix"><thead><tr><th scope="col">Line</th><th scope="col">Resident</th><th scope="col">Tier</th><th scope="col">Wing</th><th scope="col">Room</th><th scope="col">What happens</th></tr></thead><tbody>${pv.items.slice(0, 200).map((i) => `<tr><td>${i.row.line}</td><td>${H(i.row.preferredName || i.row.alias)}</td><td>${i.row.tier}</td><td>${H(i.row.wing)}</td><td>${H(i.row.unit)}</td><td>${i.action === "add" ? "Add" : i.action === "update" ? "Update" : "Left out"}${i.why ? " (" + H(i.why) + ")" : ""}</td></tr>`).join("")}</tbody></table></div>
    ${pv.items.length > 200 ? `<p class="hint">The first 200 are shown; all ${pv.items.length} are imported.</p>` : ""}
    <div class="actions"><button class="btn" type="button" data-go="3">Back</button><button class="btn btn-primary" type="button" id="ehrGo"${go && !S.done ? "" : " disabled"}>Import ${go} resident${go === 1 ? "" : "s"}</button></div>`; };
  on(m, body, "change", (e) => {
    const t = e.target;
    if (t.name === "system") S.system = t.value; else if (t.dataset && t.dataset.field) { const v = t.value; if (v === "") delete S.mapping.fields[t.dataset.field]; else S.mapping.fields[t.dataset.field] = Number(v); }
    else if (t.name === "nameMode") S.opts.nameMode = t.value; else if (t.name === "mode") S.opts.mode = t.value; else if (t.id === "ehrWing") S.opts.defaultWing = t.value; else if (t.dataset && t.dataset.wing) { if (t.value.trim()) S.opts.wingNames[t.dataset.wing] = t.value; else delete S.opts.wingNames[t.dataset.wing]; }
    else if (t.id === "ehrFile" && t.files && t.files[0]) { const f = t.files[0]; S.fileName = f.name; f.text().then((x) => { S.text = x; }).catch(() => { S.text = ""; }); }
  });
  on(m, body, "click", async (e) => {
    const b = e.target.closest("button"); if (!b) return; S.err = "";
    if (b.dataset.go) { S.step = Number(b.dataset.go); draw(); return; }
    if (b.id === "ehrRead") {
      const file = body.querySelector("#ehrFile").files[0]; if (file && !S.text) S.text = await file.text().catch(() => "");
      if (!S.text) { S.err = "Choose the resident list first."; draw(); return; }
      const t = E.read(S.text); if (!t.ok) { S.err = t.problem; S.text = ""; draw(); return; }
      S.table = t; S.detected = E.detectSystem(t.headers); if (S.system === "other" && S.detected !== "other") S.system = S.detected; S.mapping = E.suggest(t.headers, S.system === "other" ? S.detected : S.system); S.step = 2; draw(); return;
    }
    if (b.id === "ehrNext2") { if (S.mapping.fields.name == null && S.mapping.fields.room == null) { S.err = "Choose the column that holds the resident's name or room."; draw(); return; } S.step = 3; draw(); return; }
    if (b.id === "ehrPreview") { S.pv = E.preview(S.table, S.mapping, Object.assign({}, S.opts, { existing: deps.existingProfiles() })); if (!S.pv.ok) { S.err = S.pv.problem; S.step = 2; draw(); return; } S.done = ""; S.step = 4; draw(); return; }
    if (b.id === "ehrGo") {
      b.disabled = true; const r = E.apply(S.pv.items, deps.existingProfiles(), (id, p) => deps.saveProfile(id, p)); await Promise.resolve(deps.flush && deps.flush());
      S.done = r.added + " added and " + r.updated + " updated from " + S.fileName + (r.failed ? "; " + r.failed + " could not be saved (storage is full or blocked)" : "") + ". They were saved on this computer only."; draw();
    }
  });
  draw();
}

/* ================= therapy goals ================= */
function goals(body, m) {
  const S = m.state; Object.assign(S, { res: deps.activeId && deps.activeId() || "", inst: "moca", parsed: null, note: "", msg: "" });
  const people = () => deps.residents(), nameOf = (p) => deps.nameOf(p);
  if (!people().some((p) => p.id === S.res)) S.res = "";
  const inputs = () => { const I = G.INSTRUMENTS[S.inst], p = S.parsed || { total: null, domains: {}, minutes: null };
    return `<fieldset class="field"><legend>Scores to record (the clinician confirms each number)</legend><div class="ft-grid"><label>${I.label} total (0 to ${I.max})<input type="number" min="0" max="${I.max}" id="gTotal" value="${p.total ? p.total.got : ""}"></label>${I.domains.map((d) => `<label>${H(d.label)} (0 to ${d.max})<input type="number" min="0" max="${d.max}" step="0.5" data-dom="${d.id}" value="${p.domains[d.id] ? p.domains[d.id].got : ""}"></label>`).join("")}<label>Minutes<input type="number" min="1" max="480" id="gMin" value="${p.minutes || ""}"></label><label>Date<input type="date" id="gDate" value="${iso()}"></label></div></fieldset>`; };
  const codesBlock = () => { const p = S.parsed; if (!p) return ""; const cs = G.suggestCodes(p);
    return `<div class="st-banner"><b>Codes to consider</b> (the clinician decides under current CPT and payer rules; this is not billing advice)${cs.length ? `<ul class="ft-codes">${cs.map((c) => `<li><label class="st-opt"><input type="checkbox" data-code="${c.code}" data-units="${c.units}" checked> <span><b>${c.code}</b> &times; ${c.units}<small>${H(c.summary)} ${H(c.why)}</small></span></label></li>`).join("")}</ul>` : "<p>No code is suggested from this note.</p>"}</div>`; };
  const weakBlock = () => { const p = S.parsed; if (!p || !Object.keys(p.domains).length) return ""; const w = G.weakest({ instrument: S.inst, domains: p.domains }, 3);
    return `<div class="st-banner"><b>Lowest share of points</b><p>Set a target if it suits the plan of care.</p><ul class="ft-codes">${w.map((d) => `<li><div class="ft-row"><span><b>${H(d.label)}</b>: ${d.got} of ${d.max}<br><small>${H(d.acts[0])}</small></span><label>Target <input type="number" min="0" max="${d.max}" step="0.5" data-goal="${d.id}" aria-label="Target for ${H(d.label)}"></label></div></li>`).join("")}</ul></div>`; };
  const prog = () => { if (!S.res) return ""; const log = G.readLog(deps.store, S.res), pr = G.progress(log, S.inst), dates = pr.dates.slice(-8);
    if (!dates.length) return `<h2 class="st-h2">Progress</h2><p class="hint">No ${H(pr.label)} scores are recorded for this resident yet.</p>`;
    return `<h2 class="st-h2">Progress: ${H(pr.label)}</h2><div class="st-scroll"><table class="st-matrix"><thead><tr><th scope="col">Domain</th>${dates.map((d) => `<th scope="col">${H(d)}</th>`).join("")}<th scope="col">Change</th><th scope="col">Goal</th></tr></thead><tbody>${pr.domains.filter((d) => d.points.length).map((d) => `<tr><th scope="row">${H(d.label)}</th>${dates.map((dt) => { const x = d.points.find((q) => q.date === dt); return `<td>${x ? x.got : "&ndash;"}</td>`; }).join("")}<td>${d.change == null ? "&ndash;" : (d.change > 0 ? "+" : "") + d.change}</td><td>${d.target == null ? "&ndash;" : d.target + (d.met ? " (met)" : " (not yet)")}</td></tr>`).join("")}</tbody></table></div>
      <div class="actions"><button class="btn" type="button" id="gPrint">Print the one-page summary</button></div>`; };
  const draw = () => {
    body.innerHTML = `<div class="st-form"><div class="field"><label for="gRes">Resident</label><select id="gRes"><option value="">${people().length ? "Choose a resident" : "No saved residents yet"}</option>${people().map((p) => `<option value="${H(p.id)}"${p.id === S.res ? " selected" : ""}>${H(nameOf(p))}</option>`).join("")}</select></div>
      <fieldset class="field"><legend>Instrument</legend><div class="st-stage">${Object.entries(G.INSTRUMENTS).map(([k, i]) => `<label class="st-opt"><input type="radio" name="inst" value="${k}"${S.inst === k ? " checked" : ""}> <span>${H(i.label)}</span></label>`).join("")}</div></fieldset>
      <div class="field"><label for="gNote">Therapy note <span class="sub">Paste it here. It is read on this device and its words are never saved.</span></label><textarea id="gNote" rows="6" maxlength="20000">${H(S.note)}</textarea><div class="actions"><button class="btn" type="button" id="gRead">Read the note</button></div></div>
      ${S.parsed ? `<p class="hint" role="status">Found: ${S.parsed.found.length ? H(S.parsed.found.join("; ")) : "no scores or minutes"}.</p>` : ""}
      ${inputs()}${codesBlock()}${weakBlock()}<p class="msg-bad" id="gErr" role="alert"></p><p class="hint" id="gOk" role="status">${H(S.msg)}</p>
      <div class="actions"><button class="btn btn-primary" type="button" id="gSave">Save this entry</button></div></div>${prog()}`;
  };
  on(m, body, "change", (e) => { const t = e.target; if (t.id === "gRes") { S.res = t.value; draw(); } else if (t.name === "inst") { S.inst = t.value; S.parsed = null; draw(); } else if (t.id === "gNote") S.note = t.value; });
  on(m, body, "click", (e) => {
    const b = e.target.closest("button"); if (!b) return; const err = body.querySelector("#gErr");
    if (b.id === "gRead") { S.note = body.querySelector("#gNote").value; const p = G.parseNote(S.note); if (p.instrument) S.inst = p.instrument; S.parsed = p; draw(); }
    else if (b.id === "gSave") {
      try {
        const dom = {}; body.querySelectorAll("[data-dom]").forEach((x) => { if (x.value !== "") dom[x.dataset.dom] = { got: Number(x.value) }; }); const tot = body.querySelector("#gTotal").value;
        const codes = [...body.querySelectorAll("[data-code]")].filter((x) => x.checked).map((x) => ({ code: x.dataset.code, units: Number(x.dataset.units) })), gl = [...body.querySelectorAll("[data-goal]")].filter((x) => x.value !== "").map((x) => ({ domain: x.dataset.goal, target: Number(x.value) }));
        G.saveEntry(deps.store, S.res, { instrument: S.inst, date: body.querySelector("#gDate").value, total: tot === "" ? null : { got: Number(tot) }, domains: dom, minutes: body.querySelector("#gMin").value || null, codes, goals: gl });
        S.parsed = null; S.note = ""; S.msg = "Saved. The note's words were not kept."; draw();
      } catch (x) { err.textContent = x.message; }
    } else if (b.id === "gPrint") { const p = people().find((q) => q.id === S.res); deps.print([{ html: G.summaryPage({ who: p ? nameOf(p) : "Resident", facility: deps.facility ? deps.facility() : "", log: G.readLog(deps.store, S.res), instrument: S.inst }) }], "Therapy goal summary - " + (p ? nameOf(p) : "resident") + " - " + iso()); }
  });
  draw();
}

/* ================= shift highlights ================= */
function highlights(body, m) {
  const S = m.state; Object.assign(S, { day: iso(), shift: "all" });
  const D = () => globalThis.CogniDailyOps, model = () => HL.build(deps.board(), { day: S.day, shift: S.shift, wing: deps.activeWing ? deps.activeWing() : null, now: deps.today ? deps.today() : new Date() });
  const draw = () => {
    let sheet = ""; try { sheet = HL.page(model(), { facility: deps.facility ? deps.facility() : "", wing: deps.activeWing ? deps.activeWing() : "", initials: deps.initials ? deps.initials() : "" }); } catch (e) { sheet = `<p class="msg-bad">The Shift board could not be read: ${H(e.message)}</p>`; }
    body.innerHTML = `<div class="st-form"><div class="ft-grid"><label>Day<input type="date" id="hDay" value="${H(S.day)}"></label><label>Shift<select id="hShift"><option value="all">All shifts</option>${["day", "evening", "night"].map((s) => `<option value="${s}"${S.shift === s ? " selected" : ""}>${H(D() ? D().shiftLabel(s) : s)}</option>`).join("")}</select></label></div><div class="actions"><button class="btn btn-primary" type="button" id="hPrint">Print the one-page highlights</button></div></div><div class="ft-sheet" aria-label="Preview of the printed page">${sheet}</div>`;
  };
  on(m, body, "change", (e) => { if (e.target.id === "hDay" && /^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) S.day = e.target.value; if (e.target.id === "hShift") S.shift = e.target.value; draw(); });
  on(m, body, "click", (e) => { if (e.target.closest("#hPrint")) deps.print([{ html: HL.page(model(), { facility: deps.facility ? deps.facility() : "", wing: deps.activeWing ? deps.activeWing() : "", initials: deps.initials ? deps.initials() : "" }) }], "Shift highlights - " + S.day + " - " + S.shift); });
  draw();
}

/* ================= scenario practice ================= */
function scenarios(body, m) {
  const S = m.state; Object.assign(S, { name: "", role: "", run: null, last: null, fb: null, result: null, msg: "" });
  const rec = () => T.read(deps.store), mine = () => (S.name ? T.passedBy(rec(), S.name) : { done: [], all: false });
  const list = () => { const done = new Set(mine().done);
    return `<div class="st-form"><div class="ft-grid"><label>Your name, as it should appear on a certificate<input id="scName" type="text" maxlength="60" value="${H(S.name)}" autocomplete="off"></label><label>Your role (optional)<input id="scRole" type="text" maxlength="40" value="${H(S.role)}"></label></div></div>
      <ul class="st-list">${T.SCENARIOS.map((s) => `<li data-sc="${s.id}"><b>${H(s.title)}</b><span class="ft-pass">${done.has(s.id) ? ' <span class="st-tag">Passed</span>' : ""}</span><p>${H(s.summary)} About ${s.minutes} minutes.</p><div class="actions"><button class="btn btn-primary" type="button" data-start="${s.id}">${done.has(s.id) ? "Practise again" : "Begin"}</button></div></li>`).join("")}</ul>
      <div id="scSeriesBox">${seriesBtn()}</div>
      <h2 class="st-h2">Training record</h2>${recordTable()}
      <div class="field"><label for="scCheck">Check a certificate ID</label><div class="ft-row"><input id="scCheck" type="text" maxlength="16" placeholder="SC-XXXX-XXXX"><button class="btn" type="button" id="scCheckGo">Check</button></div><p class="hint" id="scCheckOut" role="status"></p></div><p class="hint">${H(T.NOT_ACCREDITED)}</p>`; };
  const seriesBtn = () => (mine().all ? `<div class="actions"><button class="btn" type="button" id="scSeries">Print my series certificate</button></div>` : "");
  /* typing a name updates the badges in place: the list is never rebuilt under a finger that is about to press Begin */
  const paint = () => { const done = new Set(mine().done); body.querySelectorAll("li[data-sc]").forEach((li) => { const d = done.has(li.dataset.sc); li.querySelector(".ft-pass").innerHTML = d ? ' <span class="st-tag">Passed</span>' : ""; li.querySelector("[data-start]").textContent = d ? "Practise again" : "Begin"; }); const box = body.querySelector("#scSeriesBox"); if (box) box.innerHTML = seriesBtn(); };
  const recordTable = () => { const r = rec().results.slice(-20).reverse(); return r.length ? `<div class="st-scroll"><table class="st-matrix"><thead><tr><th scope="col">Learner</th><th scope="col">Scenario</th><th scope="col">Date</th><th scope="col">Choices matching</th><th scope="col">Certificate</th></tr></thead><tbody>${r.map((x) => `<tr><td>${H(x.learner)}</td><td>${H((T.scenarioOf(x.scenario) || {}).title)}</td><td>${H(x.at.slice(0, 10))}</td><td>${Math.round(x.percent * 100)}%</td><td>${x.id ? H(x.id) : "Not passed"}</td></tr>`).join("")}</tbody></table></div>` : `<p class="hint">Nothing recorded yet.</p>`; };
  const play = () => { const s = T.scenarioOf(S.run.scenario), n = s.nodes[S.run.node];
    if (S.fb && !S.run.done) return `<div class="ft-panel"><p class="st-banner ft-q${S.fb.quality}" role="status"><b>${["Likely to raise the distress", "Reasonable, but there is a better first step", "The approach the training teaches"][S.fb.quality]}.</b> ${H(S.fb.text)}</p><div class="actions"><button class="btn btn-primary" type="button" id="scNext">Continue</button></div></div>`;
    if (S.run.done) { const sc = T.score(S.run);
      return `<div class="ft-panel"><h2>${H(s.title)}</h2>${S.fb ? `<p class="st-banner ft-q${S.fb.quality}"><b>${["Likely to raise the distress", "Reasonable, but there is a better first step", "The approach the training teaches"][S.fb.quality]}.</b> ${H(S.fb.text)}</p>` : ""}<p>${H(n.text)}</p><p class="st-banner"><b>${Math.round(sc.percent * 100)}%</b> of your choices matched the training approach (${sc.earned} of ${sc.possible} points). ${sc.passed ? "That passes (75% or more)." : "Passing is 75% or more. You can practise again."}</p>
        ${S.result ? `<p class="msg-ok" role="status">Saved. Certificate ${H(S.result.id)}.</p><div class="actions"><button class="btn btn-primary" type="button" id="scCert">Print my certificate</button><button class="btn" type="button" id="scBack">Back to the scenarios</button></div>` : `<p class="msg-bad" id="scErr" role="alert">${H(S.msg)}</p><div class="actions"><button class="btn btn-primary" type="button" id="scSave">Save my result${sc.passed ? " and get my certificate" : ""}</button><button class="btn" type="button" id="scBack">Back to the scenarios</button></div>`}</div>`; }
    return `<div class="ft-panel"><h2>${H(s.title)}</h2><p>${H(n.text)}</p><div class="ft-choices">${n.choices.map((c) => `<button class="btn ft-choice" type="button" data-choice="${c.id}">${H(c.text)}</button>`).join("")}</div><p class="hint">Step ${S.run.steps.length + 1}</p></div>`; };
  const draw = () => { body.innerHTML = S.run ? play() : list(); };
  on(m, body, "input", (e) => { if (e.target.id === "scName") { S.name = e.target.value; paint(); } if (e.target.id === "scRole") S.role = e.target.value; });
  on(m, body, "click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.start) { S.run = T.start(b.dataset.start); S.fb = null; S.result = null; S.msg = ""; draw(); body.querySelector("h2") && body.querySelector("h2").setAttribute("tabindex", "-1"); }
    else if (b.dataset.choice) { const r = T.choose(S.run, b.dataset.choice); if (r) { S.run = r.state; S.fb = { text: r.feedback, quality: r.quality }; if (S.run.done) { /* the last answer shows with the ending */ } draw(); } }
    else if (b.id === "scNext") { S.fb = null; draw(); }
    else if (b.id === "scBack") { S.run = null; S.fb = null; S.result = null; draw(); }
    else if (b.id === "scSave") { try { S.result = T.complete(deps.store, { name: S.name, role: S.role }, S.run); S.msg = ""; } catch (x) { S.msg = x.message; } draw(); }
    else if (b.id === "scCert") deps.print([{ html: T.certificatePage(S.result, { facility: deps.facility ? deps.facility() : "" }) }], "Certificate - " + S.name + " - " + S.result.scenario);
    else if (b.id === "scSeries") deps.print([{ html: T.seriesPage(S.name, rec(), { facility: deps.facility ? deps.facility() : "" }) }], "Series certificate - " + S.name);
    else if (b.id === "scCheckGo") { const f = T.find(rec(), body.querySelector("#scCheck").value), out = body.querySelector("#scCheckOut"); out.textContent = f ? "Found: " + f.learner + ", " + (T.scenarioOf(f.scenario) || {}).title + ", " + f.at.slice(0, 10) + "." : "No certificate with that ID is on this computer."; }
  });
  draw();
}
if (typeof window !== "undefined") { window.CogniFacilityTools = { init, render, teardown, current }; window.dispatchEvent(new Event("cogni-facility-tools-ready")); }
