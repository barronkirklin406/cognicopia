/* =====================================================================
   Wayfinding: four small helpers that are the same on every page.

     the command bar   Ctrl+K (or Cmd+K), or the Search button in the menu. Type a tool, a guide or a saved resident:
                       "shift board", "sundowning", "Evelyn coloring". Choosing a resident makes them the one every
                       tool opens filled in for; a resident and a tool together opens that tool on them.
     Start here        a short guide for someone new: who are you setting this up for, then the three everyday jobs
                       (a packet, today's card, a coloring page), each with a button that goes there and a small
                       card that stays with the person on that page.
     pinned tools      up to four tools a person uses most, on the home page and the Packet Builder's home.
     the active bar    who every tool is working with: name (or alias), year of birth, stage and what to avoid,
                       with Switch and Clear.

   What is kept: the pinned tools (cognicopia_pins) and where the guide got to (cognicopia_start) in this browser's
   own storage, and nothing about a resident in either. The active resident is only their record number, kept the
   way the tools already keep it: the one chosen in this tab (sessionStorage cgb_active_resident) comes first, then
   the one the packet tool, the Studio and the daily card remember (cognicopia_active_resident). The Packet Builder
   keeps its choice for the tab only and never on the disk, and it still does (its host says tabOnly). Residents are
   read, never written, from the sealed store through js/residentContext.js, and are held in memory only while the
   page is open. A locked store shows no names. Where a screen keeps residents by alias (the Shift board, or the
   Packet Builder with aliases switched on) the bar and the search show aliases and never names.

   The list of tools and guides is js/nav-index.js, written by scripts/site-nav.mjs. Nothing is sent anywhere.
   @global CogniWayfinding
   ===================================================================== */
(function (root) {
  "use strict";
  var doc = root.document; if (!doc || root.CogniWayfinding) return;
  var SELF = (doc.currentScript && doc.currentScript.src) || "", BASE = SELF.replace(/js\/wayfinding\.js(\?.*)?$/, "");
  var PINS_KEY = "cognicopia_pins", START_KEY = "cognicopia_start", ACTIVE_KEY = "cognicopia_active_resident", TAB_KEY = "cgb_active_resident";
  var MAX_ROWS = 10, MAX_PINS = 4, TOUR_HOURS = 2;
  /* what the page lends: residents(), aliasOf(), aliasOnly() (a sentence saying why names are hidden, or ""), copyAlias(),
     setActive(id) (the page's own chooser), toast(), slash ("/" opens the search), tabOnly (never remember the choice on the disk),
     ownBar (the page draws its own active-resident bar) */
  var host = {};

  /* ---------- small helpers ---------- */
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var norm = function (s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); };
  function lsGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null || v === "") root.localStorage.removeItem(k); else root.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function jget(k, d) { try { var v = JSON.parse(lsGet(k) || "null"); return v == null ? d : v; } catch (e) { return d; } }
  var INDEX = function () { return root.CognicopiaNavIndex || []; };
  var byKey = function (k) { return INDEX().filter(function (x) { return x.k === k; })[0] || null; };
  var hrefOf = function (it) { return BASE + it.h; };
  /* is this page the one an address points at? (a Packet Builder screen is its #/route) */
  function onPage(h) {
    var u; try { u = new URL(BASE + h, root.location.href); } catch (e) { return false; }
    var file = function (p) { return p.replace(/\/$/, "/index.html"); };
    if (file(u.pathname) !== file(root.location.pathname)) return false;
    return !/^#\//.test(u.hash) || root.location.hash.indexOf(u.hash) === 0;
  }
  function go(h) { var to = BASE + h; if (onPage(h) && /#/.test(h)) root.location.hash = h.slice(h.indexOf("#")); else root.location.href = to; }
  function dialogOf(cls, label) {
    var d = doc.createElement("dialog"); d.className = cls; d.setAttribute("aria-labelledby", label);
    d.addEventListener("click", function (e) { if (e.target === d) d.close(); });          // a click on the dimmed page closes it
    doc.body.appendChild(d); return d;
  }
  function show(d) { try { if (!d.open) d.showModal(); } catch (e) { d.setAttribute("open", ""); } }
  var toastTimer = null;
  function toast(msg) {
    if (typeof host.toast === "function") { try { host.toast(msg); return; } catch (e) { /* fall through to our own */ } }
    var t = doc.getElementById("wfToast");
    if (!t) { t = doc.createElement("div"); t.id = "wfToast"; t.className = "wf-toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); doc.body.appendChild(t); }
    t.textContent = msg; t.classList.add("is-on"); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("is-on"); }, 4200);
  }

  /* ---------- saved residents: read only, never prompted for ---------- */
  var SS = function () { return root.CogniSecureStore || null; };
  var loading = {};
  function script(src) {
    if (!loading[src]) loading[src] = new Promise(function (res) { var s = doc.createElement("script"); s.src = BASE + src; s.onload = function () { res(true); }; s.onerror = function () { res(false); }; doc.head.appendChild(s); });
    return loading[src];
  }
  /* resolves "open", "locked" or "none": the store and the reader are loaded when the page did not bring them */
  function store() {
    var p = Promise.resolve();
    if (!SS()) p = p.then(function () { return script("assets/services/secureStore.js"); });
    if (!root.CogniResident) p = p.then(function () { return script("js/residentContext.js"); });
    return p.then(function () { var s = SS(); return s && s.ready ? s.ready() : null; }).then(function () {
      var s = SS(); if (!s || !root.CogniResident) return "none";
      var st = "unavailable"; try { st = s.status().state; } catch (e) { /* treated as plain storage */ }
      return st === "locked" || st === "pending" ? "locked" : "open";
    }, function () { return "none"; });
  }
  var aliasWhy = function () { try { return typeof host.aliasOnly === "function" ? String(host.aliasOnly() || "") : ""; } catch (e) { return ""; } };
  var aliasOnly = function () { return !!aliasWhy(); };
  var copiesAlias = function () { try { return typeof host.copyAlias === "function" && !!host.copyAlias(); } catch (e) { return false; } };
  /* the stage as staff have chosen to read it (js/stageLabels.js: Stage, ACL or GDS), read when shown */
  var STAGE = {}; [1, 2, 3].forEach(function (n) { Object.defineProperty(STAGE, n, { enumerable: true, get: function () { return root.CogniStage ? root.CogniStage.tag(n, "Stage " + n) : "Stage " + n; } }); });
  /* a saved profile as the bar and the search show it */
  function view(p) {
    var R = root.CogniResident, w = null; try { w = R ? R.person(p) : null; } catch (e) { w = null; }
    var t1 = (p && p.tier1_core) || {}, name = String(t1.preferredName || "").trim(), alias = "Resident";
    try { alias = typeof host.aliasOf === "function" ? host.aliasOf(p) : (SS() && SS().aliasFor ? SS().aliasFor(p) : "Resident"); } catch (e) { /* keep "Resident" */ }
    var avoid = w ? w.avoid.names.concat(w.avoid.other, w.avoid.places, w.avoid.people) : [];
    return { id: p.id, name: name, alias: alias, unit: String(t1.unitNumber || "").trim(), stage: w ? w.stage || 0 : Number(t1.cognitiveTier) || 0, born: w ? w.born || 0 : 0, avoid: avoid.filter(Boolean), words: w ? w.avoid.words.slice() : [] };
  }
  function residents() {
    var list = [];
    try { if (typeof host.residents === "function") list = host.residents(); else if (SS() && root.CogniResident) list = root.CogniResident.list(SS().storage); } catch (e) { list = []; }
    return (list || []).filter(function (p) { return p && p.id && p.tier1_core; }).map(view);
  }
  var shownName = function (r) { return aliasOnly() || !r.name ? r.alias : r.name; };
  function initials(r) {
    var src = aliasOnly() || !r.name ? r.alias.replace(/^Resident\s+/i, "") : r.name, parts = src.split(/[\s-]+/).filter(Boolean);
    return (parts.length > 1 ? parts[0].charAt(0) + parts[parts.length - 1].charAt(0) : src.slice(0, 2)).toUpperCase();
  }
  /* what the bar says about a resident: "Dorothy (1938) • Stage 2 • Avoid: religion". Beside an alias the year of birth is left out. */
  function describe(r) {
    var named = !aliasOnly() && !!r.name, born = named && r.born ? r.born : 0;
    return { id: r.id, who: shownName(r), born: born, stage: r.stage, avoid: r.avoid.slice(), words: (r.words || []).slice(), detail: (born ? "(" + born + ")" : "") + (r.stage ? (born ? " " : "") + "• " + STAGE[r.stage] : ""), avoidText: r.avoid.length ? r.avoid.join(", ") : "nothing listed" };
  }

  /* ---------- the active resident ---------- */
  function tabId() { try { return root.sessionStorage.getItem(TAB_KEY) || ""; } catch (e) { return ""; } }
  /* the one chosen in this tab, or else the one remembered: the order the packet tool has always started in */
  function activeId() { return tabId() || lsGet(ACTIVE_KEY) || ""; }
  /* the tab always knows; the disk is told only where the page already remembers its choice there, and clearing clears both */
  function writeActive(id) {
    try { if (id) root.sessionStorage.setItem(TAB_KEY, id); else root.sessionStorage.removeItem(TAB_KEY); } catch (e) { /* a private window */ }
    if (!id || !host.tabOnly) lsSet(ACTIVE_KEY, id || null);
  }
  /* choose (or clear) the active resident from here: the page's own chooser does it when it has one, so its form follows */
  function setActive(id) {
    writeActive(id);
    if (typeof host.setActive === "function") { try { host.setActive(id || ""); } catch (e) { /* the page keeps its own choice */ } }
    else doc.dispatchEvent(new CustomEvent("cg-active-resident", { detail: { id: id || "", from: "wayfinding" } }));
    paintBar();
  }
  /* the page's own chooser changed who it is working with: keep the tab and the bar in step (it has already done its own part) */
  function follow(id) { writeActive(id || ""); paintBar(); }
  /* the active resident as a view, or null (nobody chosen, a locked store, or they are no longer saved) */
  function active() {
    var ids = [tabId(), lsGet(ACTIVE_KEY) || ""].filter(Boolean); if (!ids.length) return Promise.resolve(null);
    return store().then(function (st) {
      if (st !== "open") return null;
      var all = residents(), hit = null; ids.forEach(function (id) { hit = hit || all.filter(function (r) { return r.id === id; })[0] || null; });
      return hit;
    });
  }
  var barOn = false;
  function paintBar() {
    if (!barOn) return;
    active().then(function (r) {
      var d = r ? describe(r) : null;
      var bar = doc.getElementById("wfActive");
      if (!d) { if (bar) bar.remove(); doc.documentElement.classList.remove("wf-has-bar"); return; }
      if (!bar) {
        bar = doc.createElement("div"); bar.id = "wfActive"; bar.className = "wf-bar"; bar.setAttribute("role", "region"); bar.setAttribute("aria-label", "Active resident");
        var main = doc.querySelector("main"); if (!main || !main.parentNode) return;
        main.parentNode.insertBefore(bar, main);
      }
      var keep = doc.activeElement && bar.contains(doc.activeElement) ? doc.activeElement.id : "";
      bar.innerHTML = '<p class="wf-bar-txt"><b>Active profile:</b> <span class="wf-bar-who">' + esc(d.who) + "</span>" + (d.detail ? " <span>" + esc(d.detail) + "</span>" : "") +
        ' <span class="wf-bar-avoid">• <b>Avoid:</b> ' + esc(d.avoidText) + '</span></p><div class="wf-bar-btns"><button type="button" class="wf-btn wf-alt" id="wfSwitch">Switch</button><button type="button" class="wf-btn wf-alt" id="wfClear">Clear</button></div>';
      if (keep && doc.getElementById(keep)) doc.getElementById(keep).focus();
      doc.documentElement.classList.add("wf-has-bar");
    });
  }

  /* ---------- pinned tools ---------- */
  var pinnable = function () { return INDEX().filter(function (x) { return x.pin; }); };
  function pins() { var have = jget(PINS_KEY, []); return (Array.isArray(have) ? have : []).filter(function (k) { var it = byKey(k); return it && it.pin; }).slice(0, MAX_PINS); }
  function setPins(list) { var keep = []; (list || []).forEach(function (k) { var it = byKey(k); if (it && it.pin && keep.indexOf(k) < 0 && keep.length < MAX_PINS) keep.push(k); }); lsSet(PINS_KEY, keep.length ? JSON.stringify(keep) : null); paintPins(); return keep; }
  function paintPins() {
    Array.prototype.forEach.call(doc.querySelectorAll("[data-wf-pins]"), function (el) {
      var H = /^h[2-4]$/.test(el.getAttribute("data-wf-pins")) ? el.getAttribute("data-wf-pins") : "h2", list = pins().map(byKey);
      el.classList.add("wf-pins");
      el.innerHTML = '<div class="wf-pins-head"><' + H + ' class="wf-pins-h" id="wfPinsH">My pinned tools</' + H + '><button type="button" class="wf-btn wf-alt" data-wf-pin-edit>' + (list.length ? "Change" : "Choose tools") + "</button></div>" +
        (list.length ? '<ul class="wf-pins-list" aria-labelledby="wfPinsH">' + list.map(function (it) { return '<li><a class="wf-pin" href="' + esc(hrefOf(it)) + '" data-wf-go="' + esc(it.k) + '"><b>' + esc(it.l) + "</b><small>" + esc(it.g) + "</small></a></li>"; }).join("") + "</ul>"
          : '<p class="wf-pins-empty">Pin up to four tools you use most, and they stay here for the next shift.</p>');
    });
  }
  var pick = null;
  function openPinPicker() {
    if (!pick) {
      pick = dialogOf("wf-dlg wf-pick", "wfPickH");
      pick.addEventListener("change", function () {
        var on = Array.prototype.filter.call(pick.querySelectorAll('input[type="checkbox"]'), function (c) { return c.checked; }).map(function (c) { return c.value; });
        setPins(on); paintPick();
      });
      pick.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-wf-close]")) pick.close(); });
    }
    paintPick(); show(pick);
    var first = pick.querySelector("input"); if (first) first.focus();
  }
  function paintPick() {
    var have = pins(), full = have.length >= MAX_PINS, groups = {}, order = [];
    pinnable().forEach(function (it) { if (!groups[it.g]) { groups[it.g] = []; order.push(it.g); } groups[it.g].push(it); });
    var keep = pick.querySelector("input:focus"), focused = keep ? keep.value : "";
    pick.innerHTML = '<div class="wf-dlg-in"><div class="wf-dlg-head"><h2 id="wfPickH">My pinned tools</h2><button type="button" class="wf-btn wf-alt wf-x" data-wf-close aria-label="Close">&times;</button></div>' +
      '<p class="wf-dlg-lede">Tick up to four. They show on the home page and the Packet Builder, and first in Search.</p><p class="wf-pick-count" role="status">' + have.length + " of " + MAX_PINS + " chosen" + (full ? ". Untick one to choose another." : ".") + "</p>" +
      order.map(function (g) { return '<fieldset class="wf-pick-grp"><legend>' + esc(g) + "</legend>" + groups[g].map(function (it) { var on = have.indexOf(it.k) >= 0; return '<label class="wf-check"><input type="checkbox" value="' + esc(it.k) + '"' + (on ? " checked" : "") + (!on && full ? " disabled" : "") + "><span>" + esc(it.l) + "</span></label>"; }).join("") + "</fieldset>"; }).join("") +
      '<div class="wf-dlg-btns"><button type="button" class="wf-btn" data-wf-close>Done</button></div></div>';
    if (focused) { var again = pick.querySelector('input[value="' + focused + '"]'); if (again) again.focus(); }
  }

  /* ---------- the command bar ---------- */
  var dlg = null, input = null, list = null, note = null, opener = null, shown = [];
  var TYPE = { tool: "Tool", guide: "Guide", lesson: "Lesson" };
  function buildCommand() {
    if (dlg) return;
    dlg = dialogOf("ql", "qlH");
    dlg.innerHTML = '<form method="dialog" class="ql-card" id="qlForm">' +
      '<div class="ql-head"><h2 id="qlH">Search</h2><button class="wf-btn wf-alt wf-x ql-x" type="button" id="qlClose" aria-label="Close">&times;</button></div>' +
      '<label class="wf-sr" for="qlInput">Search for a tool, a guide or a saved resident</label>' +
      '<input id="qlInput" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" aria-controls="qlList" placeholder="A tool, a guide, or a resident">' +
      '<p class="ql-note" id="qlNote" role="status"></p><ul class="ql-list" id="qlList" aria-label="Results"></ul>' +
      '<p class="ql-hint"><kbd>Up</kbd> <kbd>Down</kbd> to move, <kbd>Enter</kbd> to choose, <kbd>Esc</kbd> to close.</p></form>';
    input = dlg.querySelector("#qlInput"); list = dlg.querySelector("#qlList"); note = dlg.querySelector("#qlNote");
    dlg.querySelector("#qlForm").addEventListener("submit", function (e) { e.preventDefault(); });
    dlg.querySelector("#qlClose").addEventListener("click", closeCommand);
    dlg.addEventListener("close", function () { if (opener && opener.isConnected) opener.focus(); });
    input.addEventListener("input", paintCommand);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); var f = list.querySelector("button"); if (f) f.focus(); }
      else if (e.key === "Enter") { e.preventDefault(); if (shown.length) choose(0); }
    });
    list.addEventListener("keydown", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (e.key === "ArrowDown") { e.preventDefault(); var n = b.closest("li").nextElementSibling; if (n) n.querySelector("button").focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); var p = b.closest("li").previousElementSibling; if (p) p.querySelector("button").focus(); else input.focus(); }
    });
    list.addEventListener("click", function (e) { var b = e.target.closest("button[data-i]"); if (b) choose(Number(b.getAttribute("data-i"))); });
  }
  var haveStore = "none";
  /* every word typed must be found: in a resident (name, alias, unit), in a tool or guide, or shared between one of each */
  function search(text) {
    var words = norm(text).split(" ").filter(Boolean), only = aliasOnly(), out = [];
    var people = haveStore === "open" ? residents() : [], items = INDEX();
    var hayR = function (r) { return norm([r.alias, r.unit].concat(only ? [] : [r.name]).join(" ")); };
    var hayT = function (it) { return norm([it.l, it.g, it.w, TYPE[it.t]].join(" ")); };
    /* a typed word is found at the start of a word: "dor" finds Dorothy, not vendor; "302" finds Resident 302-B */
    var has = function (hay, w) { return (" " + hay).indexOf(" " + w) >= 0; };
    var hits = function (hay, ws) { return ws.every(function (w) { return has(hay, w); }); };
    if (!words.length) {
      people.slice(0, 6).forEach(function (r) { out.push({ kind: "resident", r: r }); });
      pins().map(byKey).forEach(function (it) { out.push({ kind: "item", it: it, pinned: true }); });
      ["start", "home", "daily", "coloring", "roster"].forEach(function (k) { var it = byKey(k); if (it && !out.some(function (o) { return o.it === it; })) out.push({ kind: "item", it: it }); });
      return out;
    }
    people.forEach(function (r) {
      var hay = hayR(r), mine = words.filter(function (w) { return has(hay, w); }), rest = words.filter(function (w) { return !has(hay, w); });
      if (!mine.length) return;
      if (!rest.length) out.push({ kind: "resident", r: r });
      else items.forEach(function (it) { if (it.t === "tool" && it.k !== "start" && hits(hayT(it), rest)) out.push({ kind: "both", r: r, it: it }); });
    });
    out.sort(function (a, b) { return (a.kind === "both" ? 0 : 1) - (b.kind === "both" ? 0 : 1); });
    var pinned = pins();
    items.filter(function (it) { return hits(hayT(it), words); }).sort(function (a, b) {
      var rank = function (it) { return (norm(it.l).indexOf(words[0]) === 0 ? 0 : 2) + (pinned.indexOf(it.k) >= 0 ? 0 : 1) + ({ tool: 0, lesson: 4, guide: 4 }[it.t] || 0); };
      return rank(a) - rank(b);
    }).forEach(function (it) { out.push({ kind: "item", it: it, pinned: pinned.indexOf(it.k) >= 0 }); });
    return out;
  }
  function paintCommand() {
    var only = aliasOnly(), found = search(input.value);
    shown = found.slice(0, MAX_ROWS);
    list.innerHTML = shown.map(function (o, i) {
      var av, main, sub, named = false;
      if (o.kind === "item") { av = (TYPE[o.it.t] || "T").charAt(0); main = o.it.l; sub = (o.pinned ? "Pinned · " : "") + (TYPE[o.it.t] || "Tool") + " · " + o.it.g; }
      else { av = initials(o.r); named = !only && !!o.r.name;
        if (o.kind === "both") { main = o.it.l + ", for " + shownName(o.r); sub = "Opens it with them chosen"; }
        else { main = shownName(o.r); sub = (named ? [o.r.alias, STAGE[o.r.stage] || ""] : [STAGE[o.r.stage] || "", "Saved resident"]).filter(Boolean).join(" · "); } }
      return '<li><button type="button" class="ql-row" data-i="' + i + '"' + (o.r ? ' data-id="' + esc(o.r.id) + '"' : "") + '><span class="ql-av' + (o.kind === "item" ? " ql-av-tool" : "") + '" aria-hidden="true">' + esc(av) + '</span><span class="ql-who"><b' + (named ? ' class="ops-name"' : "") + ">" + esc(main) + "</b><small>" + esc(sub) + "</small></span></button></li>";
    }).join("");
    var typed = !!norm(input.value);
    note.textContent = !found.length ? (typed ? "Nothing matches that. Try fewer letters." : "Type the name of a tool, a guide or a resident.")
      : found.length > MAX_ROWS ? "Showing " + MAX_ROWS + " of " + found.length + ". Type more to narrow it." : typed ? found.length + (found.length === 1 ? " match." : " matches.") : "";
    if (haveStore === "locked") note.textContent += " Saved residents are locked, so none are listed.";
    if (only) note.textContent += " " + aliasWhy();
  }
  function choose(i) {
    var o = shown[i]; if (!o) return;
    closeCommand();
    if (o.kind === "item") { if (o.it.k === "start") openStart(); else go(o.it.h); return; }
    if (o.kind === "both") { if (onPage(o.it.h)) setActive(o.r.id); else writeActive(o.r.id); go(o.it.h); return; }
    setActive(o.r.id);
    var copy = copiesAlias() && root.navigator.clipboard && root.navigator.clipboard.writeText;
    if (copy) root.navigator.clipboard.writeText(o.r.alias).catch(function () {});
    toast(shownName(o.r) + " is now the active resident." + (copy ? " Their alias is copied, ready to paste into a note." : ""));
  }
  function openCommand(from) {
    buildCommand(); opener = from && from.nodeType ? from : doc.activeElement;
    input.value = ""; paintCommand(); show(dlg); input.focus();
    store().then(function (st) { haveStore = st; if (dlg.open) paintCommand(); });
  }
  function closeCommand() { if (dlg && dlg.open) dlg.close(); }

  /* ---------- Start here ---------- */
  var ROLES = {
    home: { label: "A small memory care home", sub: "About 1 to 20 residents", their: "the resident’s", pins: ["daily", "profile", "coloring", "home"],
      next: [["profile", "Save each resident once, and every tool makes pages from their own life."], ["activity-studio", "Pages about their own life: family, work, hometown, songs."], ["tablet", "Touch activities for a tablet."]] },
    wing: { label: "A larger assisted living or nursing wing", sub: "Many residents, several staff on a shift", their: "the resident’s", pins: ["roster", "shift", "daily", "builder"],
      next: [["roster", "Bring in your census and print for one resident after another."], ["shift", "Notes and tasks for the next shift, by room or alias."], ["facility", "Wings, groups and the month’s schedule."]] },
    clinical: { label: "Speech-language or clinical therapy", sub: "Skilled sessions and goals", their: "the resident’s", pins: ["clinical", "therapy-goals", "activity-studio", "daily"],
      next: [["therapy-goals", "Scores by domain and the goals you set."], ["clinical", "Session notes kept on this computer."], ["res-clinical-alignment", "How the pages line up with clinical practice."]] },
    family: { label: "Caring for a family member", sub: "At home, or when you visit", their: "their", pins: ["home", "daily", "coloring", "tablet"],
      next: [["academy", "Short guides for families."], ["res-caregiver-faq", "Answers to common questions."], ["tablet", "Touch activities for a tablet."]] }
  };
  var STEPS = [
    { key: "home", href: "index.html#make", target: "#go", title: "Make a personal packet", does: "A full packet of large-print pages, built from one person’s own life.",
      how: function (r) { return ["Type " + r.their + " first name and the year they were born.", "Add what else you know, such as a hometown or work. It is optional.", "Press Make the packet. The file downloads, ready to print."]; } },
    { key: "daily", href: "daily.html", target: "#dyMake", title: "Pull today’s card", does: "One page for today, for when there is no time for a packet.",
      how: function () { return ["Choose who it is for: a saved resident, or a group.", "Choose the kind of time: Reminiscence, Music or Comfort.", "Press Make today’s card, then Print."]; } },
    { key: "coloring", href: "builder.html#/coloring", target: "#ccPdf", title: "Print a coloring page", does: "Bold pictures for adults, with thick outlines that print cleanly.",
      how: function () { return ["Choose a picture they would enjoy.", "Press Download PDF, or Print now."]; } }
  ];
  function startState() { var s = jget(START_KEY, null); return s && typeof s === "object" ? s : null; }
  function saveStart(s) { s.at = Date.now(); lsSet(START_KEY, JSON.stringify({ role: ROLES[s.role] ? s.role : "", step: s.step | 0, tour: s.tour ? 1 : 0, done: s.done ? 1 : 0, at: s.at })); }
  var sd = null, st = null;
  function openStart(at) {
    if (!sd) {
      sd = dialogOf("wf-dlg wf-start", "wfStartH");
      sd.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest("[data-wf]"); if (!b || !sd.contains(b)) return;
        var act = b.getAttribute("data-wf");
        if (act === "close") { st.tour = 0; saveStart(st); sd.close(); }
        else if (act === "role") { st.role = b.getAttribute("data-role"); st.step = 1; saveStart(st); paintStart(true); }
        else if (act === "back") { st.step = Math.max(0, st.step - 1); saveStart(st); paintStart(true); }
        else if (act === "next") { st.step = Math.min(STEPS.length + 1, st.step + 1); if (st.step > STEPS.length) st.done = 1; saveStart(st); paintStart(true); }
        else if (act === "there") { st.tour = 1; saveStart(st); sd.close(); var s = STEPS[st.step - 1]; if (onPage(s.href)) { go(s.href); paintCoach(); } else go(s.href); }
        else if (act === "pin") { setPins(Array.prototype.filter.call(sd.querySelectorAll('input[type="checkbox"]'), function (c) { return c.checked; }).map(function (c) { return c.value; })); b.textContent = "Pinned"; b.disabled = true; toast("Your tools are pinned to the home page."); }
      });
    }
    st = startState() || { role: "", step: 0, tour: 0, done: 0 };
    if (typeof at === "number") st.step = at;
    if (!ROLES[st.role]) st.step = 0;
    hideCoach(); paintStart(false); show(sd);
    var f = sd.querySelector("[data-focus]") || sd.querySelector("button"); if (f) f.focus();
  }
  function paintStart(focus) {
    var role = ROLES[st.role], n = STEPS.length, body;
    if (!role || st.step <= 0) {
      body = '<p class="wf-dlg-lede">Three everyday jobs, shown one at a time. First: who are you setting this up for? It only changes the examples, and you can change it later.</p><div class="wf-roles">' +
        Object.keys(ROLES).map(function (k, i) { return '<button type="button" class="wf-role" data-wf="role" data-role="' + k + '"' + (i ? "" : " data-focus") + "><b>" + esc(ROLES[k].label) + "</b><small>" + esc(ROLES[k].sub) + "</small></button>"; }).join("") + "</div>";
    } else if (st.step <= n) {
      var s = STEPS[st.step - 1];
      body = '<p class="wf-step-n">Step ' + st.step + " of " + n + "</p><h3>" + esc(s.title) + '</h3><p class="wf-dlg-lede">' + esc(s.does) + '</p><ol class="wf-how">' + s.how(role).map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ol>" +
        '<div class="wf-dlg-btns"><button type="button" class="wf-btn" data-wf="there" data-focus>Take me there</button><button type="button" class="wf-btn wf-alt" data-wf="next">' + (st.step < n ? "Next step" : "Finish") + '</button><button type="button" class="wf-btn wf-alt" data-wf="back">Back</button></div>';
    } else {
      var have = pins(), sug = role.pins.map(byKey).filter(Boolean);
      body = '<h3>You know the three everyday jobs.</h3><p class="wf-dlg-lede">Two more things that save time on a shift.</p>' +
        '<fieldset class="wf-pick-grp"><legend>Pin your four most used tools to the home page</legend>' + sug.map(function (it) { return '<label class="wf-check"><input type="checkbox" value="' + esc(it.k) + '" checked><span>' + esc(it.l) + "</span></label>"; }).join("") + "</fieldset>" +
        '<div class="wf-dlg-btns"><button type="button" class="wf-btn" data-wf="pin" data-focus>' + (have.length ? "Pin these instead" : "Pin these") + "</button></div>" +
        '<h3>Good next places for you</h3><ul class="wf-next">' + role.next.map(function (x) { var it = byKey(x[0]); return it ? '<li><a class="wf-pin" href="' + esc(hrefOf(it)) + '" data-wf-go="' + esc(it.k) + '"><b>' + esc(it.l) + "</b><small>" + esc(x[1]) + "</small></a></li>" : ""; }).join("") + "</ul>" +
        '<p class="wf-dlg-lede">Press <kbd>Ctrl</kbd> + <kbd>K</kbd> on any page to find a tool, a guide or a resident.</p><div class="wf-dlg-btns"><button type="button" class="wf-btn wf-alt" data-wf="back">Back</button></div>';
    }
    sd.innerHTML = '<div class="wf-dlg-in"><div class="wf-dlg-head"><h2 id="wfStartH">Start here</h2><button type="button" class="wf-btn wf-alt wf-x" data-wf="close" aria-label="Close">&times;</button></div>' + body +
      '<p class="wf-dlg-foot">This guide is always in the Today menu, under Start here.</p></div>';
    if (focus) { var f = sd.querySelector("[data-focus]") || sd.querySelector("button"); if (f) f.focus(); }
  }
  /* the small card that stays with a person on the page a step sent them to */
  function hideCoach() { var c = doc.getElementById("wfCoach"); if (c) c.remove(); Array.prototype.forEach.call(doc.querySelectorAll(".wf-target"), function (e) { e.classList.remove("wf-target"); }); }
  function paintCoach() {
    hideCoach();
    var s0 = startState(); if (!s0 || !s0.tour || !ROLES[s0.role] || s0.step < 1 || s0.step > STEPS.length) return;
    if (Date.now() - (s0.at || 0) > TOUR_HOURS * 3600e3) { s0.tour = 0; saveStart(s0); return; }
    var s = STEPS[s0.step - 1]; if (!onPage(s.href)) return;
    var c = doc.createElement("aside"); c.id = "wfCoach"; c.className = "wf-coach"; c.setAttribute("aria-label", "Start here, step " + s0.step + " of " + STEPS.length);
    c.innerHTML = '<p class="wf-step-n">Start here · step ' + s0.step + " of " + STEPS.length + "</p><h2>" + esc(s.title) + '</h2><ol class="wf-how">' + s.how(ROLES[s0.role]).map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ol>" +
      '<div class="wf-dlg-btns"><button type="button" class="wf-btn" data-coach="next">' + (s0.step < STEPS.length ? "Next: " + esc(STEPS[s0.step].title.toLowerCase()) : "Finish") + '</button><button type="button" class="wf-btn wf-alt" data-coach="guide">Back to the guide</button><button type="button" class="wf-btn wf-alt" data-coach="end">End the tour</button></div>';
    c.addEventListener("click", function (e) {
      var b = e.target.closest("[data-coach]"); if (!b) return;
      var a = b.getAttribute("data-coach"), now = startState() || s0;
      if (a === "end") { now.tour = 0; saveStart(now); hideCoach(); }
      else if (a === "guide") { now.tour = 0; saveStart(now); openStart(now.step); }
      else if (now.step < STEPS.length) { now.step++; now.tour = 1; saveStart(now); var nx = STEPS[now.step - 1]; if (onPage(nx.href)) paintCoach(); else go(nx.href); }
      else { now.step = STEPS.length + 1; now.tour = 0; now.done = 1; saveStart(now); hideCoach(); openStart(now.step); }
    });
    doc.body.appendChild(c);
    var tries = 0; (function mark() { var t = doc.querySelector(s.target); if (t) t.classList.add("wf-target"); else if (tries++ < 20 && doc.getElementById("wfCoach")) setTimeout(mark, 250); })();
  }

  /* ---------- wiring ---------- */
  doc.addEventListener("click", function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var b = t.closest("[data-wf-search]"); if (b) { e.preventDefault(); openCommand(b); return; }
    if (t.closest("[data-wf-start]") || t.closest('a[href$="#start-here"]')) { e.preventDefault(); openStart(); return; }
    if (t.closest("[data-wf-pin-edit]")) { openPinPicker(); return; }
    if (t.closest("#wfSwitch")) { openCommand(t.closest("#wfSwitch")); return; }
    if (t.closest("#wfClear")) { setActive(""); toast("No resident is active now."); return; }
    var a = t.closest("a[data-wf-go]"); if (a && onPage((byKey(a.getAttribute("data-wf-go")) || {}).h || "\u0000")) { if (sd && sd.open) sd.close(); }
  });
  var typing = function (el) { return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)); };
  doc.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && String(e.key).toLowerCase() === "k") { e.preventDefault(); if (dlg && dlg.open) closeCommand(); else openCommand(); return; }
    if (host.slash && e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(doc.activeElement) && !(dlg && dlg.open)) { e.preventDefault(); openCommand(); }
  });
  /* a tool that changes who it is working with says so, and the bar follows */
  doc.addEventListener("cg-active-resident", function () { paintBar(); });
  doc.addEventListener("cognicopia:activeresident", function () { setTimeout(paintBar, 0); });
  doc.addEventListener("cg-residents-changed", function () { paintBar(); });
  root.addEventListener("storage", function (e) { if (e.key === ACTIVE_KEY) paintBar(); if (e.key === PINS_KEY) paintPins(); });
  root.addEventListener("hashchange", function () { paintCoach(); if (root.location.hash === "#start-here") openFromHash(); });
  /* a first-time visitor who has just agreed to the terms on the home page is shown the guide, once */
  doc.addEventListener("cg-terms-accepted", function () { if (onPage("index.html") && !startState()) setTimeout(function () { openStart(0); }, 250); });
  function openFromHash() { try { root.history.replaceState(null, "", root.location.pathname + root.location.search); } catch (e) { /* the address keeps its mark */ } openStart(); }

  function start() {
    barOn = typeof host.setActive === "function" && !host.ownBar;      // a tool page that can be told who to work with; the others show no resident
    paintPins(); paintBar(); paintCoach();
    if (root.location.hash === "#start-here") openFromHash();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start, { once: true }); else start();

  root.CogniWayfinding = Object.freeze({
    host: function (h) { Object.keys(h || {}).forEach(function (k) { host[k] = h[k]; }); if (doc.readyState !== "loading") { barOn = typeof host.setActive === "function" && !host.ownBar; paintBar(); } },
    openCommand: openCommand, closeCommand: closeCommand, openStart: openStart, openPinPicker: openPinPicker,
    activeId: activeId, setActive: setActive, note: follow, active: active, refresh: paintBar, describe: describe,
    summary: function (profile) { return profile && profile.id && profile.tier1_core ? describe(view(profile)) : null; },
    pins: pins, setPins: setPins, mountPins: paintPins, MAX_PINS: MAX_PINS
  });
})(typeof window !== "undefined" ? window : this);
