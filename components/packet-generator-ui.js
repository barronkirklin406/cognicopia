/* =====================================================================
   Activity Page Studio: the Master Control Panel and Packet Assembler.

   Left: the configuration hub. Right: the page as it will print, on a
   3:4 sheet, drawn live. Underneath: whether it passes the print rules,
   and what staff should know.

   Configuration     stage 1 to 3, hands, the years to remember, a first
                     name, interests and topics to avoid;
   Content mix       any of reminiscence prompts, thinking exercises,
                     daily-living steps and coloring pages, bundled into
                     one packet of 1 to 10 pages, taking turns so the
                     packet is varied;
   Layout            full pages, or cards: 4 (2 by 2), 6 (2 by 3), 8 sideways
                     (2 by 4) or 5 wide tickets on the upright sheet;
   Buttons           Generate Live Preview (same settings, same pages),
                     Randomize Theme (a new decade, picture style and seed),
                     Compile Packet PDF, Print, Download this page (PNG);
   Preview           one page at a time (a carousel) or every page in a
                     scroll; a high-contrast dark panel for the screen that
                     leaves the printed page clean white.

   It joins three files:
     js/generators/activity-engine.js     what goes on a sheet, by stage
     js/generators/coloring-pipeline.js   the 3:4 page, preview and export
     assets/coloring/subjects.bundle.js   the finished drawings for coloring

   Export: Print (the browser's own print, pure black on white, 0.5 in
   margins, one sheet to a paper page, an optional 0.75 in binding gutter
   that alternates sides for two-sided printing); Compile Packet PDF
   (jsPDF, 300 dpi pictures on US Letter, the same gutter); PNG.

   Privacy: a first name typed here is drawn on the page and kept nowhere.
   Nothing here makes a network request or writes to storage; the page
   code under the preview carries the settings and a seed, so a page can
   be made again.
   ===================================================================== */
(function () {
  "use strict";
  var E = window.CognicopiaActivityEngine, PL = window.CognicopiaColoringPipeline, FV = window.CognicopiaFacilityValidator, PO = window.CognicopiaPrintOptimizer;
  var root = document.getElementById("asRoot");
  if (!root) return;
  if (!E || !PL) { root.textContent = "The page maker could not load. Reload the page to try again."; return; }
  if (PO) PO.install();                                                          // the print style sheet: only the sheets reach the paper
  try { if (window.CognicopiaColoringManifest && window.CognicopiaColoringManifest.loadSync) window.CognicopiaColoringManifest.loadSync(); } catch (e) { /* coloring pictures are optional for the other kinds */ }

  var $ = function (s, r) { return (r || root).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); };
  /* the kinds of page a packet can hold. The first four are the studio's own; the rest are the master inventory (activity-modules.js), each made for a stage. */
  var KINDS = [["reminiscence", "Reminiscence prompts"], ["exercise", "Thinking exercises"], ["daily", "Daily living steps"], ["coloring", "Coloring pages"],
    ["wordgrid", "Word grids and look-back (stages 1-2)"], ["timeline", "Timeline sorting (stages 1-2)"], ["memory", "Memory pairs to cut out (stages 1-2)"],
    ["dialogue", "Guided dialogue sheets"], ["household", "Household matching (stages 1-2)"], ["phrases", "Sayings and song lines (stages 1-2)"],
    ["recognition", "Shapes and colors (stages 2-3)"], ["rhythm", "Rhythm and word tickets (stages 2-3)"]];
  /* the suggested packet for each stage: three of the master inventory and a coloring page */
  var SUGGEST = { 1: ["wordgrid", "timeline", "memory", "dialogue", "coloring"], 2: ["dialogue", "household", "phrases", "coloring"], 3: ["coloring", "recognition", "rhythm", "dialogue"] };
  var LABEL = {}; KINDS.forEach(function (k) { LABEL[k[0]] = k[1]; });
  var state = { mix: { reminiscence: true, exercise: true, daily: true, coloring: true }, vocation: "", stage: 2, dexterity: "steady", decade: 1950, born: "", name: "", interests: "", avoid: "",
    style: "botanical", words: "", layout: "full", pages: 4, view: "one", dark: false, gutter: false, seed: (Date.now() % 1000000) + 1, variant: 0, index: 0 };
  var made = { pages: [], notes: [], code: "" };

  /* ---------- the controls ---------- */
  function seg(name, legend, opts) {
    return '<fieldset class="as-f"><legend>' + legend + '</legend><div class="as-seg">' + opts.map(function (o) {
      return '<label><input type="radio" name="' + name + '" value="' + o[0] + '"><span>' + o[1] + (o[2] ? '<small>' + o[2] + '</small>' : '') + '</span></label>';
    }).join("") + '</div></fieldset>';
  }
  function build() {
    root.innerHTML =
      '<div class="as-grid">' +
      '<form class="as-panel" id="asForm" aria-label="Packet settings" onsubmit="return false">' +
        seg("stage", "Cognitive stage", [["1", "Stage 1", "Mild"], ["2", "Stage 2", "Moderate"], ["3", "Stage 3", "Advanced"]]) +
        seg("dexterity", "Motor dexterity", [["steady", "Steady"], ["limited", "Limited grip"], ["minimal", "Little control"]]) +
        '<div class="as-row"><label class="as-lab" for="asDecade">Birth decade / reminiscence theme</label><select id="asDecade">' + E.DECADES.map(function (d) { return '<option value="' + d + '">The ' + d + 's</option>'; }).join("") + '</select></div>' +
        '<div class="as-row"><label class="as-lab" for="asBorn">Year born (optional; suggests the decade)</label><input id="asBorn" type="number" inputmode="numeric" min="1900" max="2010" placeholder="1938"></div>' +
        '<div class="as-row"><label class="as-lab" for="asVocation">Former work (optional; themes the word grids)</label><select id="asVocation"><option value="">Not chosen</option>' + (E.VOCATIONS || []).map(function (v) { return '<option value="' + v.id + '">' + v.label + '</option>'; }).join("") + '</select></div>' +
        '<div class="as-row"><label class="as-lab" for="asName">First name (optional; printed on the page, kept nowhere)</label><input id="asName" type="text" maxlength="40" autocomplete="off"></div>' +
        '<div class="as-row as-nc"><label class="as-lab" for="asInterests">Interests (optional, separated by commas)</label><input id="asInterests" type="text" maxlength="120" placeholder="gardening, baking" autocomplete="off"></div>' +
        '<div class="as-row"><label class="as-lab" for="asAvoid">Topics to avoid (separated by commas)</label><input id="asAvoid" type="text" maxlength="120" placeholder="trains, hospitals" autocomplete="off"></div>' +
        '<fieldset class="as-f"><legend>Content mix</legend><div class="as-mix">' + KINDS.map(function (k) {
          return '<label class="as-check"><input type="checkbox" name="mix" value="' + k[0] + '"><span>' + k[1] + '</span></label>';
        }).join("") + '</div><button type="button" class="as-btn as-alt" id="asSuggest">Suggested packet for this stage</button><p class="as-hint">The packet takes one page from each kind in turn. A kind made for other stages is skipped, and the note says so.</p></fieldset>' +
        '<div class="as-only-col"><div class="as-row"><label class="as-lab" for="asStyle">Coloring style</label><select id="asStyle">' + PL.STYLES.map(function (s) { return '<option value="' + s.id + '">' + s.label + '</option>'; }).join("") + '</select></div>' +
        '<div class="as-row"><label class="as-lab" for="asWords">Or describe the picture in a few words</label><input id="asWords" type="text" maxlength="120" placeholder="a rose in a jug" autocomplete="off"></div></div>' +
        '<div class="as-only-sheet">' + seg("layout", "Layout for prompts and steps", PL.LAYOUTS.map(function (l) { return [l.id, l.label]; })) + '</div>' +
        '<div class="as-row"><label class="as-lab" for="asPages">Pages in the packet</label><select id="asPages">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return '<option value="' + n + '">' + n + (n === 1 ? ' page' : ' pages') + '</option>'; }).join("") + '</select></div>' +
        '<label class="as-check"><input type="checkbox" id="asGutter"><span>Leave a binding gutter (0.75 in, alternating sides for two-sided printing)</span></label>' +
        '<div class="as-btns"><button type="button" class="as-btn" id="asGen">Generate Live Preview</button><button type="button" class="as-btn as-alt" id="asRandom">Randomize Theme</button></div>' +
      '</form>' +
      '<section class="as-stage" aria-label="Preview">' +
        '<div class="as-bar"><fieldset class="as-f as-viewf"><legend class="as-sr">Preview style</legend><div class="as-seg"><label><input type="radio" name="view" value="one"><span>One page</span></label><label><input type="radio" name="view" value="all"><span>All pages</span></label></div></fieldset>' +
        '<label class="as-check as-darkck"><input type="checkbox" id="asDark"><span>High-contrast dark panel (the printed page stays white)</span></label></div>' +
        '<div class="as-pager"><button type="button" class="as-btn as-alt" id="asPrev" aria-label="Previous page">&#x2190; Back</button><p id="asPos" role="status" aria-live="polite"></p><button type="button" class="as-btn as-alt" id="asNext" aria-label="Next page">Next &#x2192;</button></div>' +
        '<div class="as-sheet" id="asSheet"></div><div class="as-scroll" id="asScroll" hidden></div>' +
        '<div class="as-btns as-out"><button type="button" class="as-btn" id="asPdf">Compile Packet PDF</button><button type="button" class="as-btn" id="asPrint">Print all pages</button><button type="button" class="as-btn as-alt" id="asPng">Download this page (PNG)</button></div>' +
        '<div class="as-ready" id="asReady"></div>' +
        '<div class="as-notes" id="asNotes" aria-live="polite"></div>' +
        '<div class="as-offline"><p id="asOffline" role="status"></p><button type="button" class="as-btn as-alt" id="asSave">Save for offline use</button></div>' +
      '</section></div><div id="printRoot" aria-hidden="true"></div>';
  }

  /* ---------- making the packet ---------- */
  function profile() { return { name: state.name, born: Number(state.born) || 0, stage: state.stage, dexterity: state.dexterity, decade: state.decade, interests: state.interests, avoid: state.avoid, vocation: state.vocation }; }
  function kindsOn() { return KINDS.map(function (k) { return k[0]; }).filter(function (k) { return state.mix[k]; }); }
  function avoidList() { return state.avoid.split(/[,;]/).map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean); }
  var STAGE_KEY = ["E", "M", "L"];

  /* one list of pages per kind, each long enough to fill the packet */
  function pagesFor(kind, ki, n, notes) {
    var seed = (state.seed + ki * 7919) >>> 0, out = [];
    if (kind === "coloring") {
      var seen = {};
      for (var v = 0; v < n + 4 && out.length < n; v++) {
        var c = PL.chooseSubject({ style: state.style, text: state.words, stage: state.stage, seed: seed, variant: state.variant + v, avoid: avoidList() });
        if (!c.asset) { if (!out.length) notes.push({ kind: "warn", text: c.why }); break; }
        if (seen[c.asset.id]) continue;
        seen[c.asset.id] = 1;
        var code = "ASX" + STAGE_KEY[state.stage - 1] + "-C-" + seed.toString(36).toUpperCase() + "." + (out.length + 1);
        var pg = PL.composeColoring(c.asset, PL.subjectPaths(c.asset.id), { stage: state.stage, dexterity: state.dexterity, name: state.name, code: code });
        pg.meta.kind = "coloring"; pg.meta.module = "coloring"; pg.meta.why = c.why;
        pg.meta.staff = "Goal: calm, creative focus with a familiar picture. Ask while they color: " + (c.asset.prompt || "What does this bring to mind?") + " Offer chunky crayons or thick markers; ten to fifteen minutes is plenty, and any color is the right color.";
        out.push(pg);
      }
      return out;
    }
    var packed = (kind === "reminiscence" || kind === "rhythm") && state.layout !== "full";   // prompts are dealt onto cards together, so every card sheet is full
    var r = E.generate(profile(), { module: kind, count: packed ? Math.min(60, n * 8) : Math.min(12, n), seed: seed });
    if (r.notFitting) {
      var fit = (E.modules().filter(function (m) { return m.id === kind; })[0] || {}).stages || [];
      notes.push({ kind: "info", text: LABEL[kind].replace(/ \(.*\)$/, "") + " is made for stage" + (fit.length > 1 ? "s " + fit.join(" and ") : " " + fit[0]) + ", so it is left out of this stage's packet." });
      return out;
    }
    r.problems.forEach(function (p) { notes.push({ kind: "warn", text: p }); });
    if (packed) {
      PL.packPrompts(r.sheets, state.layout).forEach(function (pg) { pg.meta.module = kind; pg.meta.staff = r.sheets[0].staffNote; pg.meta.dexNote = r.sheets[0].dexNote; out.push(pg); });
      return out;
    }
    r.sheets.forEach(function (sh) {
      var o = PL.sheetPages(sh, state.layout);
      o.pages.forEach(function (pg) { pg.meta.module = kind; pg.meta.staff = sh.staffNote; pg.meta.dexNote = sh.dexNote; pg.meta.fellBack = o.fellBack; out.push(pg); });
    });
    return out;
  }
  function make() {
    var kinds = FV && FV.interleave ? FV.interleave(kindsOn()) : kindsOn(), notes = [];
    if (!kinds.length) return { pages: [], notes: [{ kind: "warn", text: "Choose at least one kind of page under Content mix." }], code: "" };
    var n = state.pages, lists = kinds.map(function (k, i) { return pagesFor(k, i, n, notes); }), at = kinds.map(function () { return 0; }), pages = [];
    while (pages.length < n && lists.some(function (l, i) { return at[i] < l.length; })) {
      lists.forEach(function (l, i) { if (pages.length < n && at[i] < l.length) pages.push(l[at[i]++]); });
    }
    var code = "ASPK-" + STAGE_KEY[state.stage - 1] + "-" + (state.seed >>> 0).toString(36).toUpperCase() + (state.variant ? "." + state.variant : "");
    var ready = FV ? FV.validateBatch(pages, { stage: state.stage, interests: state.interests }) : null;
    if (ready) FV.report(ready);                                                 // one console report for every batch
    var bad = [];
    pages.forEach(function (pg, i) { PL.validate(pg).forEach(function (m) { bad.push("Page " + (i + 1) + ": " + m); }); });
    notes.unshift(bad.length ? { kind: "warn", text: "Print check: " + bad.slice(0, 3).join(" ") } : { kind: "ok", text: "Print check passed: every page is 3:4, pure black on white, every line 6 px or heavier, no text under the stage's size floor, nothing off the page." });
    var mix = {}; pages.forEach(function (pg) { mix[pg.meta.module] = (mix[pg.meta.module] || 0) + 1; });
    notes.push({ kind: "info", text: "This packet: " + kinds.filter(function (k) { return mix[k]; }).map(function (k) { return mix[k] + " " + LABEL[k].toLowerCase(); }).join(", ") + "." });
    if (pages.length < n) notes.push({ kind: "info", text: "Only " + pages.length + " of the " + n + " pages could be made from these choices." });
    if (pages.some(function (pg) { return pg.meta.fellBack; })) notes.push({ kind: "info", text: "Matching, sorting, the path and look-and-enjoy are always full pages; the layout applies to prompts and steps." });
    return { pages: pages, notes: notes, code: code, kinds: kinds, ready: ready };
  }

  /* ---------- drawing the screen ---------- */
  var timer = 0;
  function refresh(keepIndex) {
    made = make();
    if (!keepIndex) state.index = 0;
    state.index = Math.max(0, Math.min(made.pages.length - 1, state.index));
    paint();
  }
  function svgOf(pg, i) { return PL.toSVG(pg, { width: "100%", height: "100%", label: "Page " + (i + 1) + " of " + made.pages.length + ": " + (pg.meta.title || "") }); }
  function paint() {
    var n = made.pages.length, one = state.view === "one", pg = made.pages[state.index];
    $("#asSheet").hidden = !one; $("#asScroll").hidden = one;
    $("#asSheet").innerHTML = n && one ? svgOf(pg, state.index) : (n ? "" : '<p class="as-empty">Nothing could be made from those settings.</p>');
    if (!one) $("#asScroll").innerHTML = made.pages.map(function (p, i) { return '<div class="as-sw" role="group" aria-label="Page ' + (i + 1) + ' of ' + n + '"><div class="as-sheet">' + svgOf(p, i) + '</div><p class="as-cap">Page ' + (i + 1) + ' · ' + escapeHtml(LABEL[p.meta.module] || "") + '</p></div>'; }).join("");
    $("#asPos").textContent = n ? (one ? "Page " + (state.index + 1) + " of " + n : n + (n === 1 ? " page" : " pages")) + "  ·  Packet code " + made.code : "No page";
    $("#asPrev").disabled = !one || state.index <= 0; $("#asNext").disabled = !one || state.index >= n - 1;
    ["asPrint", "asPdf", "asPng"].forEach(function (id) { $("#" + id).disabled = !n; });
    var extra = [];
    if (pg && one) {
      extra.push({ kind: "info", text: "This page: " + (LABEL[pg.meta.module] || "") + (pg.meta.code ? " (" + pg.meta.code + ")" : "") + "." });
      if (pg.meta.why) extra.push({ kind: "info", text: pg.meta.why });
      if (pg.meta.staff) extra.push({ kind: "info", text: "For staff: " + pg.meta.staff });
      if (pg.meta.key && pg.meta.key.length) extra.push({ kind: "info", text: "Answer key (staff only): " + pg.meta.key.join("; ") });
      if (pg.meta.dexNote) extra.push({ kind: "info", text: pg.meta.dexNote });
      if (pg.meta.module === "coloring") extra.push({ kind: "info", text: "Lines are drawn at " + (PL.strokeFor(state.stage, state.dexterity) / PL.PX_PER_PT).toFixed(1) + " pt on paper. The picture is a finished drawing; words choose among the library and never draw a new subject." });
    }
    $("#asNotes").innerHTML = made.notes.concat(extra).map(function (x) { return '<p class="as-note as-' + x.kind + '">' + (x.kind === "ok" ? "&#x2713; " : x.kind === "warn" ? "&#x26A0; " : "") + escapeHtml(x.text) + '</p>'; }).join("");
    var svgs = made.pages.map(function (p) { return PL.toSVG(p, { width: "100%", height: "100%" }); });
    if (PO) PO.fill($("#printRoot"), svgs, { gutter: state.gutter });
    $("#asReady").innerHTML = made.ready ? readyHtml(made.ready) : "";
    var kinds = kindsOn();
    root.classList.toggle("as-has-coloring", !!state.mix.coloring);
    root.classList.toggle("as-has-sheets", kinds.some(function (k) { return k !== "coloring"; }));
    root.classList.toggle("as-has-interests", !!state.mix.reminiscence);
    root.classList.toggle("as-dark", state.dark);
  }
  /* the readiness score and what it is made of, as a folding panel */
  function readyHtml(r) {
    var P = r.parts, row = function (k, label) { return '<li><span>' + label + '</span><b>' + P[k] + '</b></li>'; };
    return '<details class="as-rd as-rd-' + (r.level === "Ready" ? "ok" : r.level === "Ready with notes" ? "note" : "warn") + '"><summary>Clinical readiness: ' + r.score + ' / 100 &middot; ' + r.level + '</summary>' +
      '<ul class="as-rd-parts">' + row("contrast", "Contrast and legibility") + row("stroke", "Stroke weight") + row("whitespace", "Negative space") + row("variety", "Variety") + row("framework", "Framework alignment") + '</ul>' +
      '<p class="as-rd-dom">Domains in this packet: ' + escapeHtml(r.domains.join(", ") || "none") + '</p>' +
      '<ul class="as-rd-fw">' + r.framework.map(function (f) { return '<li><span aria-hidden="true">' + (f.pass ? "&#x2713;" : "&#x26A0;") + '</span> ' + escapeHtml(f.label) + '<small> (' + escapeHtml(f.source) + ')</small></li>'; }).join("") + '</ul>' +
      (r.findings.length ? '<ul class="as-rd-notes">' + r.findings.slice(0, 6).map(function (f) { return '<li>' + escapeHtml(f) + '</li>'; }).join("") + '</ul>' : '') +
      '<p class="as-rd-fine">A self-check that supports a facility\'s own program; it is not a clinical certification.</p></details>';
  }
  function escapeHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function schedule(keep) { clearTimeout(timer); timer = setTimeout(function () { refresh(keep); }, 120); }

  /* ---------- export ---------- */
  function fontsReady() {
    var d = document;
    if (!d.fonts || !d.fonts.load) return Promise.resolve();
    return Promise.all([d.fonts.load('400 40px "Atkinson Hyperlegible"'), d.fonts.load('700 40px "Atkinson Hyperlegible"')]).catch(function () {}).then(function () { return d.fonts.ready; });
  }
  function download(name, href) { var a = document.createElement("a"); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  function exportPng() {
    fontsReady().then(function () {
      var cv = document.createElement("canvas"); PL.toCanvas(made.pages[state.index], cv, 1.875);
      download("cognicopia-" + made.code.toLowerCase() + "-page" + (state.index + 1) + ".png", cv.toDataURL("image/png"));
    });
  }
  function exportPdf() {
    var lib = window.jspdf && window.jspdf.jsPDF;
    if (!lib) { alert("The PDF maker could not load. Reload the page, or use Print and choose Save as PDF."); return; }
    var btn = $("#asPdf"), label = btn.textContent; btn.disabled = true; btn.textContent = "Compiling the PDF…";
    fontsReady().then(function () {
      var doc = new lib({ unit: "in", format: "letter", orientation: "portrait", compress: true });
      made.pages.forEach(function (pg, i) {
        if (i) doc.addPage();
        var cv = document.createElement("canvas"); PL.toCanvas(pg, cv, 1.875);                      // 2250 x 3000: 300 dpi across 7.5 in
        var w = state.gutter ? 7.25 : 7.5, h = w * 4 / 3, x = state.gutter ? (i % 2 === 0 ? 0.75 : 0.5) : 0.5;
        doc.addImage(cv.toDataURL("image/png"), "PNG", x, 0.5, w, h, undefined, "FAST");
      });
      doc.save("cognicopia-" + made.code.toLowerCase() + ".pdf");
    }).catch(function () { alert("The PDF could not be made. Use Print and choose Save as PDF."); }).then(function () { btn.disabled = false; btn.textContent = label; });
  }
  function print() { fontsReady().then(function () { window.print(); }); }

  /* ---------- wiring ---------- */
  function sync() {
    $$('input[name="stage"]').forEach(function (r) { r.checked = Number(r.value) === state.stage; });
    $$('input[name="dexterity"]').forEach(function (r) { r.checked = r.value === state.dexterity; });
    $$('input[name="layout"]').forEach(function (r) { r.checked = r.value === state.layout; });
    $$('input[name="view"]').forEach(function (r) { r.checked = r.value === state.view; });
    $$('input[name="mix"]').forEach(function (c) { c.checked = !!state.mix[c.value]; });
    $("#asVocation").value = state.vocation; $("#asDecade").value = String(state.decade); $("#asStyle").value = state.style; $("#asPages").value = String(state.pages);
    $("#asDark").checked = state.dark; $("#asGutter").checked = state.gutter;
  }
  function wire() {
    $$('#asForm input[name="stage"], #asForm input[name="dexterity"], #asForm input[name="layout"]').forEach(function (r) {
      r.addEventListener("change", function () { state[r.name] = r.name === "stage" ? Number(r.value) : r.value; state.variant = 0; schedule(false); });
    });
    $$('input[name="mix"]').forEach(function (c) { c.addEventListener("change", function () { state.mix[c.value] = c.checked; schedule(false); }); });
    $$('input[name="view"]').forEach(function (r) { r.addEventListener("change", function () { state.view = r.value; paint(); }); });
    var bind = function (id, key, num) { $("#" + id).addEventListener("input", function (e) { state[key] = num ? Number(e.target.value) : e.target.value; if (key === "words") state.variant = 0; schedule(false); }); };
    bind("asDecade", "decade", true); bind("asVocation", "vocation"); bind("asName", "name"); bind("asInterests", "interests"); bind("asAvoid", "avoid"); bind("asStyle", "style"); bind("asWords", "words"); bind("asPages", "pages", true);
    $("#asBorn").addEventListener("input", function (e) {
      state.born = e.target.value; var y = Number(e.target.value);
      if (y >= 1900 && y <= 2010) { state.decade = E.decadeFor(y); $("#asDecade").value = String(state.decade); }
      schedule(false);
    });
    $("#asSuggest").addEventListener("click", function () {
      KINDS.forEach(function (k) { state.mix[k[0]] = SUGGEST[state.stage].indexOf(k[0]) >= 0; });
      state.pages = Math.max(state.pages, 4); sync(); refresh(false);
    });
    $("#asGutter").addEventListener("change", function (e) { state.gutter = e.target.checked; paint(); });
    $("#asDark").addEventListener("change", function (e) { state.dark = e.target.checked; paint(); });
    $("#asGen").addEventListener("click", function () { clearTimeout(timer); refresh(false); });
    $("#asRandom").addEventListener("click", function () {
      state.seed = (Math.random() * 1e9 | 0) + 1; state.variant = 0;
      state.decade = E.DECADES[Math.floor(Math.random() * E.DECADES.length)];
      state.style = PL.STYLES[Math.floor(Math.random() * PL.STYLES.length)].id; state.words = ""; $("#asWords").value = "";
      sync(); refresh(false);
    });
    $("#asPrev").addEventListener("click", function () { state.index--; paint(); });
    $("#asNext").addEventListener("click", function () { state.index++; paint(); });
    $("#asPrint").addEventListener("click", print);
    $("#asPdf").addEventListener("click", exportPdf);
    $("#asPng").addEventListener("click", exportPng);
    root.addEventListener("keydown", function (e) {
      if (state.view !== "one" || (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== "radio" && e.target.type !== "checkbox")) return;
      if (e.key === "ArrowRight" && state.index < made.pages.length - 1) { state.index++; paint(); }
      if (e.key === "ArrowLeft" && state.index > 0) { state.index--; paint(); }
    });
  }

  function offlineStatus() { if (!PO) return; PO.status().then(function (st) { $("#asOffline").textContent = PO.say(st); $("#asSave").hidden = !st.supported || st.cached === st.total; }); }
  function wireOffline() {
    if (!PO) { $("#asOffline").textContent = ""; $("#asSave").hidden = true; return; }
    $("#asSave").addEventListener("click", function () {
      var b = $("#asSave"); b.disabled = true;
      PO.cache(null, function (d, t) { $("#asOffline").textContent = "Saving " + d + " of " + t + "…"; }).then(function (st) { $("#asOffline").textContent = PO.say(st); b.disabled = false; b.hidden = st.cached === st.total; });
    });
    offlineStatus();
  }
  build(); sync(); wire(); wireOffline(); refresh(false);
  window.CognicopiaActivityStudio = Object.freeze({ state: state, refresh: function () { refresh(false); }, pages: function () { return made.pages; }, code: function () { return made.code; } });
})();
