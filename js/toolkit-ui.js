/* Page Toolkit screen (#/toolkit): puts four tested modules in front of staff.

     Wing packets    js/todays-packet.js    one packet for every resident on the wing, shifted for the time of day, a divider sheet before each,
                                            one after another so the browser stays responsive, with progress and a Cancel.
     Their details   js/packet-builder.js   children, grandchildren, great-grandchildren, the streets they grew up on and the words they use, kept
                                            on the resident's profile; and a recommendation from logged completions for print size and grid size.
     Clinical pages  js/clinical-suite.js   step checklist, single-anchor sheet, sorting grid, spaced-retrieval pages and a coin template.

   Mounted into the builder's view and torn down at the next address change, like the other tools. Nothing is sent anywhere.
   deps: esc, toast, store, residents(), activeId(), nameOf(p), activeWing(), saveProfile(id, p), flush(), todayISO(), print(pages, title, opts). */
import * as TP from "./todays-packet.js";
import * as PB from "./packet-builder.js";
import * as CS from "./clinical-suite.js";

let deps = null, mounted = null, suite = null;
const H = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const say = (m) => { try { deps.toast(m); } catch (e) { /* no toast */ } };
export function init(d) { deps = d; }
export function teardown() { if (mounted) { mounted.cancel = true; try { mounted.ac.abort(); mounted.view.innerHTML = ""; } catch (e) { /* the page is gone */ } mounted = null; } }
export function current() { return mounted ? mounted.name : null; }
const on = (m, el, ev, fn) => el.addEventListener(ev, fn, { signal: m.ac.signal });
const sheet = (title, body) => `<div class="sheet cl-sheet"><h1 class="cl-title">${H(title)}</h1>${body}</div>`;
const STAGE = { 1: "early", 2: "middle", 3: "late" };

/* the agent suite is built once, when first needed */
async function agents() {
  if (suite) return suite;
  const [P5, P2, RE] = await Promise.all([import("./pillar5-upgrade-agents.js"), import("./pillar2-functionality-agents.js"), import("./reminiscence-engine.js")]);
  const store = (() => { try { return P2.webStorage(window.localStorage); } catch (e) { return undefined; } })();
  suite = { orchestrator: P5.createSuite(store ? { storage: store } : {}).orchestrator, buildRequest: RE.buildRequest }; return suite;
}
/* a saved profile in the words the agents use */
export function agentProfile(p) {
  const t1 = (p && p.tier1_core) || {}, t2 = (p && p.tier2_enrichment) || {}, t3 = (p && p.tier3_deep) || {}, mg = PB.extendProfile(t3.multigen || {});
  return Object.assign({}, mg, { preferredName: String(t1.preferredName || "").trim(), formativeEra: t2.birthYear ? String(t2.birthYear) : "", ailmentTier: STAGE[Number(t1.cognitiveTier)] || "middle",
    hobbies: (Array.isArray(t1.topHobbies) ? t1.topHobbies : []).map((h) => h.label || h.code).filter(Boolean).join(", "), hometown: t2.hometown && t2.hometown.place || "", pastCareer: t1.occupation && t1.occupation.label || "" });
}
export function requestFor(p, build) {
  const t1 = (p && p.tier1_core) || {}, ag = agentProfile(p), tuned = t1.tuned && typeof t1.tuned === "object" ? t1.tuned : null;
  return Object.assign(build(ag, PB.deepFromProfile(ag)), tuned ? { calibration: PB.calibrationFrom({ fontPt: tuned.fontPt, grid: tuned.grid, lineHeight: tuned.lineHeight }) } : {});
}

export function render(view, d) {
  if (d) deps = d; if (!deps) { view.innerHTML = '<p class="hint">The page toolkit is still loading.</p>'; return; }
  teardown(); const ac = new AbortController(); mounted = { name: "toolkit", view, ac, state: { tab: "queue", res: deps.activeId && deps.activeId() || "", msg: "" }, cancel: false };
  const S = mounted.state, tabs = [["queue", "Wing packets"], ["details", "Their details"], ["clinical", "Clinical pages"]];
  view.innerHTML = `<div class="st-tool ft-tool" data-ft="toolkit"><p class="eyebrow">Studio tool</p><h1 class="view-title" tabindex="-1">Page Toolkit</h1><p class="lede">Make a packet for a whole wing, keep the details that make a page theirs, and print the clinical pages. Everything is made on this computer.</p><div class="st-stage" role="tablist" aria-label="Sections" id="tkTabs"></div><div id="tkBody"></div></div>`;
  const tabsEl = view.querySelector("#tkTabs"), body = view.querySelector("#tkBody");
  const draw = () => { tabsEl.innerHTML = tabs.map(([k, l]) => `<button class="btn${S.tab === k ? " btn-primary" : ""}" type="button" role="tab" aria-selected="${S.tab === k}" data-tab="${k}">${H(l)}</button>`).join(""); body.innerHTML = ({ queue, details, clinical })[S.tab](); };
  S.redraw = draw; on(mounted, tabsEl, "click", (e) => { const b = e.target.closest("[data-tab]"); if (b) { S.tab = b.dataset.tab; S.msg = ""; draw(); } });
  on(mounted, body, "click", (e) => click(e, mounted, draw)); on(mounted, body, "change", (e) => change(e, mounted, draw)); draw();
}

/* ---- wing packets ---- */
function queue() {
  const S = mounted.state, list = deps.residents(), wing = deps.activeWing ? deps.activeWing() : null, slot = TP.SHIFTS[TP.timeOfDay(new Date())];
  return `<h2 class="st-h2">Packets for ${wing ? H(wing) : "every wing"}</h2><p class="hint">${list.length} resident${list.length === 1 ? "" : "s"} on this roster. Right now it is ${H(slot.label.toLowerCase())}: <b>${H(slot.intent)}</b>.${slot.gentler ? " The pages are set one step gentler." : ""} A divider sheet comes before each resident's packet. Change the wing in Settings to make a different wing's packets.</p>
    <label class="st-opt"><input type="checkbox" id="tkTwo" checked> <span>Two-sided binder gutters<small>The 0.75 in gutter alternates sides.</small></span></label>
    <div class="actions"><button class="btn btn-primary" type="button" id="tkMake"${list.length && !S.running ? "" : " disabled"}>Make ${list.length} packet${list.length === 1 ? "" : "s"}</button><button class="btn" type="button" id="tkCancel"${S.running ? "" : " disabled"}>Cancel</button></div>
    <progress id="tkProg" max="${Math.max(1, list.length)}" value="${S.done || 0}" aria-label="Packets made" ${S.running || S.result ? "" : "hidden"}></progress><p class="msg-bad" id="tkErr" role="alert"></p><p class="hint" id="tkMsg" role="status">${H(S.msg)}</p>
    ${S.result ? `<div class="st-banner"><b>${S.result.summary.made}</b> made, <b>${S.result.summary.blocked}</b> held back by the clinical audit, <b>${S.result.summary.failed}</b> could not be made${S.result.summary.cancelled ? " (cancelled)" : ""}.</div><ul class="ft-report">${S.result.items.map((i) => `<li>${H(i.label)}: ${H(i.status)}</li>`).join("")}</ul><div class="actions"><button class="btn btn-primary" type="button" id="tkPrint"${S.result.pages.length ? "" : " disabled"}>Print ${S.result.pages.length / 2} packet${S.result.pages.length === 2 ? "" : "s"}</button></div>` : ""}`;
}
async function make(m, draw) {
  const S = m.state, list = deps.residents(), err = m.view.querySelector("#tkErr"); if (S.running) return; S.running = true; S.done = 0; S.result = null; S.msg = "Preparing…"; m.cancel = false; draw();
  try {
    const A = await agents(), residents = list.map((p, i) => ({ id: p.id, label: "Resident " + (i + 1), unit: (p.tier1_core && p.tier1_core.unitNumber ? "Room " + p.tier1_core.unitNumber : ""), request: requestFor(p, A.buildRequest) }));
    /* residents are shown on the divider by alias or room, never by name (the same rule as the Shift board) */
    list.forEach((p, i) => { residents[i].label = (p.tier1_core && p.tier1_core.alias) || (p.tier1_core && p.tier1_core.unitNumber ? "Resident " + p.tier1_core.unitNumber : "Resident " + (i + 1)); });
    const res = await TP.queuePackets(A.orchestrator, residents, { wing: deps.activeWing && deps.activeWing() || "", shouldCancel: () => m.cancel, onProgress: (x) => { S.done = x.done; const pr = m.view.querySelector("#tkProg"); if (pr) { pr.value = x.done; pr.hidden = false; } } });
    S.result = res; S.msg = ""; if (window.CogniAccessLog) window.CogniAccessLog.append("export", { note: res.summary.made + " wing packets" });
  } catch (e) { S.msg = ""; if (mounted === m) { const er = m.view.querySelector("#tkErr"); if (er) er.textContent = "The packets could not be made: " + (e && e.message || e); } }
  S.running = false; if (mounted === m) draw();
}

/* ---- their details ---- */
const lines = (v) => (Array.isArray(v) ? v : []).join(", ");
function details() {
  const S = mounted.state, list = deps.residents(); if (!list.some((p) => p.id === S.res)) S.res = ""; const p = list.find((x) => x.id === S.res), t3 = (p && p.tier3_deep) || {}, mg = PB.extendProfile(t3.multigen || {}), t1 = (p && p.tier1_core) || {};
  const head = `<div class="field"><label for="tkRes">Resident</label><select id="tkRes"><option value="">${list.length ? "Choose a resident" : "No saved residents yet"}</option>${list.map((x) => `<option value="${H(x.id)}"${x.id === S.res ? " selected" : ""}>${H(deps.nameOf(x))}</option>`).join("")}</select></div>`;
  if (!p) return head;
  const tier = Number(t1.cognitiveTier) || 2, tuned = t1.tuned || {}, entries = PB.readCompletions(deps.store, p.id), base = { tier, fontPt: tuned.fontPt || 20, lineHeight: tuned.lineHeight || 1.4, grid: tuned.grid || 7 }, rec = PB.autoTune(entries, base);
  return head + `<h2 class="st-h2">Family and neighborhood</h2><p class="hint">Separate with commas. These become names, places and word-search words on their pages.</p>
    <div class="ft-grid">${[["children", "Children"], ["grandchildren", "Grandchildren"], ["greatGrandchildren", "Great-grandchildren"], ["neighborhoodStreets", "Streets they grew up on"], ["regionalTerms", "Words they use (pop or soda, davenport or couch)"]].map(([k, l]) => `<label>${H(l)}<input type="text" data-mg="${k}" maxlength="400" value="${H(lines(mg[k]))}"></label>`).join("")}</div>
    <div class="actions"><button class="btn btn-primary" type="button" id="tkSaveMg">Save these details</button></div><p class="hint" id="tkMsg" role="status">${H(S.msg)}</p>
    <h2 class="st-h2">Completion and print settings</h2><p class="hint">Log how much of an activity was finished. After three, the page suggests a print size and grid size, one step at a time, never outside this tier's own limits. It is a pattern in what staff recorded, not an assessment.</p>
    <div class="ft-grid"><label>Share finished (0 to 100)<input type="number" id="tkPct" min="0" max="100" step="5" value=""></label></div><div class="actions"><button class="btn" type="button" id="tkLog">Log this activity</button></div><p class="msg-bad" id="tkErr" role="alert"></p>
    <p class="st-banner" role="status"><b>${entries.length}</b> logged. Now: ${base.fontPt} pt, line height ${base.lineHeight}, ${base.grid} by ${base.grid} grid. ${H(rec.reason || "")}${rec.action && rec.action !== "hold" ? `<br><b>Suggested:</b> ${rec.fontPt} pt, line height ${rec.lineHeight}, ${rec.grid} by ${rec.grid} grid.` : ""}</p>
    ${rec.action && rec.action !== "hold" ? `<div class="actions"><button class="btn btn-primary" type="button" id="tkApply">Use the suggested settings</button></div>` : ""}${t1.tuned ? `<div class="actions"><button class="btn" type="button" id="tkClearTune">Go back to the standard settings</button></div>` : ""}`;
}
async function saveProfile(p) { deps.saveProfile(p.id, p); await Promise.resolve(deps.flush && deps.flush()); }

/* ---- clinical pages ---- */
function clinical() {
  const S = mounted.state, c = S.clin || (S.clin = { kind: "steps", steps: "Wash your hands\nPut on the apron\nGet out the bowl\nMeasure the flour\nStir it well\nPour it in the pan", recall: "Our street, Maple Street\nThe family dog, Biscuit\nMy favorite song, Moon River", coins: "penny, nickel, dime, quarter", trades: ["kitchen", "garden", "workshop"] }), kinds = [["steps", "Step checklist"], ["anchor", "Single-anchor sheet"], ["sort", "Sorting grid"], ["recall", "Spaced-retrieval pages"], ["coin", "Coin template"]];
  const form = { steps: `<div class="field"><label for="tkSteps">One step to a line (up to 12)</label><textarea id="tkSteps" rows="6" maxlength="1500">${H(c.steps || "Wash your hands\nPut on the apron\nGet out the bowl\nMeasure the flour\nStir it well\nPour it in the pan")}</textarea></div>`,
    anchor: `<div class="ft-grid"><label>Shape<select id="tkAnchor">${CS.ANCHOR_NAMES.map((n) => `<option value="${H(n)}"${c.anchor === n ? " selected" : ""}>${H(n)}</option>`).join("")}</select></label><label>Light<select id="tkMode">${CS.ILLUMINATION.map((m) => `<option value="${m.code}"${c.mode === m.code ? " selected" : ""}>${H(m.label)}: ${H(m.note)}</option>`).join("")}</select></label><label>Word under it<input id="tkWord" type="text" maxlength="30" value="${H(c.word || "")}"></label></div>`,
    sort: `<fieldset class="field"><legend>Trades (up to 4)</legend><div class="st-stage">${CS.TRADES.map((t) => `<label class="st-opt"><input type="checkbox" data-trade="${t.code}"${(c.trades || ["kitchen", "garden", "workshop"]).includes(t.code) ? " checked" : ""}> <span>${H(t.label)}</span></label>`).join("")}</div></fieldset>`,
    recall: `<div class="field"><label for="tkRecall">Up to four items, one to a line, as cue, answer (for example: Our street, Maple Street)</label><textarea id="tkRecall" rows="5" maxlength="800">${H(c.recall || "Our street, Maple Street\nThe family dog, Biscuit\nMy favorite song, Moon River")}</textarea></div>`,
    coin: `<div class="field"><label for="tkCoins">Coins, separated by commas (penny, nickel, dime, quarter)</label><input id="tkCoins" type="text" maxlength="80" value="${H(c.coins || "penny, nickel, dime, quarter")}"></div>` }[c.kind];
  return `<fieldset class="field"><legend>Page</legend><div class="st-stage">${kinds.map(([k, l]) => `<label class="st-opt"><input type="radio" name="kind" value="${k}"${c.kind === k ? " checked" : ""}> <span>${H(l)}</span></label>`).join("")}</div></fieldset>${form}
    <p class="msg-bad" id="tkErr" role="alert">${H(S.msg)}</p><div class="actions"><button class="btn btn-primary" type="button" id="tkClinPrint">Print the page</button></div><p class="hint">Pure black on white, lines of 3 pt or more. These pages support staff judgment; they are not treatment.</p>`;
}
export function clinicalPages(c) {
  if (c.kind === "steps") { const steps = String(c.steps || "").split("\n").map((s) => s.trim()).filter(Boolean); if (!steps.length) throw new Error("Write at least one step."); return [sheet("Steps", CS.stepChecklist(steps))]; }
  if (c.kind === "anchor") { const svg = CS.anchorSvg(c.anchor || "circle"), v = CS.validateAnchor(svg); if (!v.ok) throw new Error("That anchor is too busy: " + (v.problems || []).join(", ")); return [sheet("", CS.anchorSheet(c.anchor || "circle", { mode: c.mode, word: c.word }))]; }
  if (c.kind === "sort") return [sheet("Sort and match", CS.vocationMatrix(c.trades && c.trades.length ? c.trades : undefined))];
  if (c.kind === "recall") { const items = String(c.recall || "").split("\n").map((l) => { const [cue, ...a] = l.split(","); return { cue: (cue || "").trim(), answer: a.join(",").trim() }; }).filter((x) => x.cue && x.answer); const pg = CS.spacedRetrievalPages(items).filter(Boolean); if (!pg.length) throw new Error("Write at least one item as cue, answer."); return pg.map((x) => sheet("", x.html)); }
  if (c.kind === "coin") return [sheet("Coins", CS.coinTemplate(String(c.coins || "").split(",").map((s) => s.trim()).filter(Boolean)))];
  throw new Error("Choose a page.");
}

/* ---- events ---- */
function change(e, m, draw) {
  const t = e.target, S = m.state;
  if (t.id === "tkRes") { S.res = t.value; S.msg = ""; draw(); }
  else if (t.name === "kind") { S.clin.kind = t.value; S.msg = ""; draw(); }
  else if (S.tab === "clinical") { const c = S.clin; if (t.id === "tkSteps") c.steps = t.value; else if (t.id === "tkAnchor") c.anchor = t.value; else if (t.id === "tkMode") c.mode = t.value; else if (t.id === "tkWord") c.word = t.value; else if (t.id === "tkRecall") c.recall = t.value; else if (t.id === "tkCoins") c.coins = t.value; else if (t.dataset && t.dataset.trade) c.trades = [...m.view.querySelectorAll("[data-trade]")].filter((x) => x.checked).map((x) => x.dataset.trade).slice(0, 4); }
}
async function click(e, m, draw) {
  const b = e.target.closest("button"); if (!b) return; const S = m.state, err = m.view.querySelector("#tkErr"); if (err) err.textContent = "";
  try {
    if (b.id === "tkMake") await make(m, draw);
    else if (b.id === "tkCancel") { m.cancel = true; S.msg = "Cancelling after the packet in progress…"; draw(); }
    else if (b.id === "tkPrint") deps.print(S.result.pages.map((p) => ({ html: p.html })), "Packets - " + deps.todayISO(), { twoSided: !!m.view.querySelector("#tkTwo") && m.view.querySelector("#tkTwo").checked });
    else if (b.id === "tkSaveMg") { const p = deps.residents().find((x) => x.id === S.res); if (!p) return; const mg = {}; m.view.querySelectorAll("[data-mg]").forEach((i) => { mg[i.dataset.mg] = i.value; }); const q = JSON.parse(JSON.stringify(p)); q.tier3_deep = q.tier3_deep || {}; q.tier3_deep.multigen = PB.extendProfile(mg); q.updatedAt = new Date().toISOString(); await saveProfile(q); S.msg = "Saved. Their pages use these from the next packet."; draw(); }
    else if (b.id === "tkLog") { const v = Number(m.view.querySelector("#tkPct").value); if (!(v >= 0 && v <= 100) || m.view.querySelector("#tkPct").value === "") { err.textContent = "Enter a number from 0 to 100."; return; } PB.logCompletion(deps.store, S.res, { completion: v / 100 }); draw(); }
    else if (b.id === "tkApply" || b.id === "tkClearTune") {
      const p = deps.residents().find((x) => x.id === S.res); if (!p) return; const q = JSON.parse(JSON.stringify(p)); q.tier1_core = q.tier1_core || {};
      if (b.id === "tkApply") { const t1 = p.tier1_core || {}, tuned = t1.tuned || {}, rec = PB.autoTune(PB.readCompletions(deps.store, p.id), { tier: Number(t1.cognitiveTier) || 2, fontPt: tuned.fontPt || 20, lineHeight: tuned.lineHeight || 1.4, grid: tuned.grid || 7 }); q.tier1_core.tuned = { fontPt: rec.fontPt, lineHeight: rec.lineHeight, grid: rec.grid }; } else delete q.tier1_core.tuned;
      q.updatedAt = new Date().toISOString(); await saveProfile(q); S.msg = b.id === "tkApply" ? "The suggested settings are saved." : "Back to the standard settings."; draw();
    } else if (b.id === "tkClinPrint") { S.msg = ""; deps.print(clinicalPages(S.clin).map((x) => ({ html: x })), "Clinical page - " + S.clin.kind + " - " + deps.todayISO(), {}); }
  } catch (x) { S.msg = x && x.message ? x.message : "That did not work."; if (S.tab === "clinical") draw(); else if (err) err.textContent = S.msg; }
}
if (typeof window !== "undefined") { window.CogniToolkit = { init, render, teardown, current }; window.dispatchEvent(new Event("cogni-toolkit-ready")); }
