/* =====================================================================
   Activity Page Studio: the screen.

   Left: what to make, for whom. Right: the page as it will print, on a
   3:4 sheet, drawn live as any control changes. Underneath: whether the
   page passes the print rules, and what staff should know.

   It joins three files:
     js/generators/activity-engine.js     what goes on a sheet, by stage
     js/generators/coloring-pipeline.js   the 3:4 page, preview and export
     assets/coloring/subjects.bundle.js   the finished drawings for coloring

   Export: Print (the browser's own print, pure black on white, 0.5 in
   margins, an optional 0.75 in binding gutter that alternates sides for
   two-sided printing), Download PDF (jsPDF, 300 dpi pictures on US Letter)
   and Download PNG (this page).

   Privacy: a first name typed here is drawn on the page and kept nowhere.
   Nothing here makes a network request or writes to storage; the only
   thing remembered is the page code under the preview, which carries
   the settings and a seed so a page can be made again.
   ===================================================================== */
(function () {
  "use strict";
  var E = window.CognicopiaActivityEngine, PL = window.CognicopiaColoringPipeline;
  var root = document.getElementById("asRoot");
  if (!root) return;
  if (!E || !PL) { root.textContent = "The page maker could not load. Reload the page to try again."; return; }
  try { if (window.CognicopiaColoringManifest && window.CognicopiaColoringManifest.loadSync) window.CognicopiaColoringManifest.loadSync(); } catch (e) { /* coloring pictures are optional for the other modules */ }

  var $ = function (s, r) { return (r || root).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); };
  var state = { module: "reminiscence", stage: 2, dexterity: "steady", decade: 1950, born: "", name: "", interests: "", avoid: "", style: "botanical", words: "", layout: "full", count: 3, gutter: false, seed: (Date.now() % 1000000) + 1, variant: 0, index: 0 };
  var made = { pages: [], notes: [], code: "" };

  var MODULE_HELP = {
    reminiscence: "Things from the chosen decade to look at and talk about. Invitations, never questions with a right answer.",
    exercise: "Word pairs, sorting, a path to follow. At stage 3: look and enjoy, and the path.",
    daily: "A familiar everyday task in clear steps. Fewer steps as the stage advances.",
    coloring: "A bold, finished drawing with a thick outline, from a style or from a few words."
  };

  /* ---------- the controls ---------- */
  function seg(name, legend, opts, hint) {
    return '<fieldset class="as-f"><legend>' + legend + '</legend><div class="as-seg">' + opts.map(function (o) {
      return '<label><input type="radio" name="' + name + '" value="' + o[0] + '"><span>' + o[1] + (o[2] ? '<small>' + o[2] + '</small>' : '') + '</span></label>';
    }).join("") + '</div>' + (hint ? '<p class="as-hint" id="' + name + 'Hint"></p>' : '') + '</fieldset>';
  }
  function build() {
    root.innerHTML =
      '<div class="as-grid">' +
      '<form class="as-panel" id="asForm" aria-label="Page settings" onsubmit="return false">' +
        seg("module", "What to make", [["reminiscence", "Reminiscence"], ["exercise", "Thinking"], ["daily", "Daily living"], ["coloring", "Coloring"]]) +
        seg("stage", "Stage", [["1", "Stage 1", "Mild"], ["2", "Stage 2", "Moderate"], ["3", "Stage 3", "Advanced"]]) +
        seg("dexterity", "Hands", [["steady", "Steady"], ["limited", "Limited grip"], ["minimal", "Little control"]]) +
        '<div class="as-row"><label class="as-lab" for="asDecade">Years to remember</label><select id="asDecade">' + E.DECADES.map(function (d) { return '<option value="' + d + '">The ' + d + 's</option>'; }).join("") + '</select></div>' +
        '<div class="as-row"><label class="as-lab" for="asBorn">Year born (optional; suggests the decade)</label><input id="asBorn" type="number" inputmode="numeric" min="1900" max="2010" placeholder="1938"></div>' +
        '<div class="as-row"><label class="as-lab" for="asName">First name (optional; printed on the page, kept nowhere)</label><input id="asName" type="text" maxlength="40" autocomplete="off"></div>' +
        '<div class="as-row as-nc"><label class="as-lab" for="asInterests">Interests (optional, separated by commas)</label><input id="asInterests" type="text" maxlength="120" placeholder="gardening, baking" autocomplete="off"></div>' +
        '<div class="as-row"><label class="as-lab" for="asAvoid">Topics to avoid (separated by commas)</label><input id="asAvoid" type="text" maxlength="120" placeholder="trains, hospitals" autocomplete="off"></div>' +
        '<div class="as-only-col"><div class="as-row"><label class="as-lab" for="asStyle">Style</label><select id="asStyle">' + PL.STYLES.map(function (s) { return '<option value="' + s.id + '">' + s.label + '</option>'; }).join("") + '</select></div>' +
        '<div class="as-row"><label class="as-lab" for="asWords">Or describe it in a few words</label><input id="asWords" type="text" maxlength="120" placeholder="a rose in a jug" autocomplete="off"></div>' +
        '<button type="button" class="as-btn as-alt" id="asAnother">Another picture</button></div>' +
        '<div class="as-only-sheet">' + seg("layout", "Layout", PL.LAYOUTS.map(function (l) { return [l.id, l.label]; })) +
        '<div class="as-row"><label class="as-lab" for="asCount">How many sheets</label><select id="asCount">' + [1, 2, 3, 4, 6, 8, 12].map(function (n) { return '<option value="' + n + '">' + n + '</option>'; }).join("") + '</select></div></div>' +
        '<label class="as-check"><input type="checkbox" id="asGutter"><span>Leave a binding gutter (0.75 in, alternating sides for two-sided printing)</span></label>' +
        '<div class="as-btns"><button type="button" class="as-btn as-alt" id="asNew">New variation</button></div>' +
      '</form>' +
      '<section class="as-stage" aria-label="Preview">' +
        '<div class="as-pager"><button type="button" class="as-btn as-alt" id="asPrev" aria-label="Previous page">&#x2190; Back</button><p id="asPos" role="status" aria-live="polite"></p><button type="button" class="as-btn as-alt" id="asNext" aria-label="Next page">Next &#x2192;</button></div>' +
        '<div class="as-sheet" id="asSheet"></div>' +
        '<div class="as-btns as-out"><button type="button" class="as-btn" id="asPrint">Print all pages</button><button type="button" class="as-btn" id="asPdf">Download PDF</button><button type="button" class="as-btn as-alt" id="asPng">Download this page (PNG)</button></div>' +
        '<div class="as-notes" id="asNotes" aria-live="polite"></div>' +
      '</section></div><div id="printRoot" aria-hidden="true"></div>';
  }

  /* ---------- making the pages ---------- */
  function profile() { return { name: state.name, born: Number(state.born) || 0, stage: state.stage, dexterity: state.dexterity, decade: state.decade, interests: state.interests, avoid: state.avoid }; }
  function make() {
    var notes = [], pages = [], code = "", avoidList = state.avoid.split(/[,;]/).map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
    if (state.module === "coloring") {
      var c = PL.chooseSubject({ style: state.style, text: state.words, stage: state.stage, seed: state.seed, variant: state.variant, avoid: avoidList });
      if (!c.asset) { return { pages: [], notes: [{ kind: "warn", text: c.why }], code: "" }; }
      code = "ASX" + ["E", "M", "L"][state.stage - 1] + "-C-" + (state.seed >>> 0).toString(36).toUpperCase() + (state.variant ? "." + state.variant : "");
      pages.push(PL.composeColoring(c.asset, PL.subjectPaths(c.asset.id), { stage: state.stage, dexterity: state.dexterity, name: state.name, code: code }));
      notes.push({ kind: "info", text: c.why });
      var st = PL.STYLES.filter(function (s) { return s.id === state.style; })[0];
      if (!state.words.trim() && st && st.note) notes.push({ kind: "info", text: st.note });
      notes.push({ kind: "info", text: "Lines are drawn at " + PL.strokeFor(state.stage, state.dexterity) + " px on the 1200 by 1600 page (" + (PL.strokeFor(state.stage, state.dexterity) / PL.PX_PER_PT).toFixed(1) + " pt on paper). The picture is a finished drawing; words choose among the library and never draw a new subject." });
    } else {
      var r = E.generate(profile(), { module: state.module, count: state.count, seed: state.seed });
      code = r.code;
      var fell = false;
      r.sheets.forEach(function (sh) { var o = PL.sheetPages(sh, state.layout); fell = fell || o.fellBack; o.pages.forEach(function (p) { pages.push(p); }); });
      if (r.problems.length) r.problems.forEach(function (p) { notes.push({ kind: "warn", text: p }); });
      if (fell) notes.push({ kind: "info", text: "Matching, sorting, the path and look-and-enjoy are always full pages; the layout applies to the prompts and steps." });
      var first = r.sheets[0];
      if (first && first.staffNote) notes.push({ kind: "info", text: "For staff: " + first.staffNote });
      if (first && first.dexNote) notes.push({ kind: "info", text: first.dexNote });
    }
    var bad = [];
    pages.forEach(function (pg, i) { PL.validate(pg).forEach(function (m) { bad.push("Page " + (i + 1) + ": " + m); }); });
    notes.unshift(bad.length ? { kind: "warn", text: "Print check: " + bad.slice(0, 3).join(" ") } : { kind: "ok", text: "Print check passed: 3:4 page, pure black on white, every line 6 px or heavier, no text under the stage's size floor, nothing off the page." });
    return { pages: pages, notes: notes, code: code };
  }

  /* ---------- drawing the screen ---------- */
  var timer = 0;
  function refresh(keepIndex) {
    made = make();
    if (!keepIndex) state.index = 0;
    state.index = Math.max(0, Math.min(made.pages.length - 1, state.index));
    paint();
  }
  function paint() {
    var sheet = $("#asSheet"), n = made.pages.length;
    sheet.innerHTML = n ? PL.toSVG(made.pages[state.index], { width: "100%", height: "100%", label: "Page " + (state.index + 1) + " of " + n + ": " + (made.pages[state.index].meta.title || "") }) : '<p class="as-empty">Nothing could be made from those settings.</p>';
    $("#asPos").textContent = n ? "Page " + (state.index + 1) + " of " + n + "  ·  Page code " + made.code : "No page";
    $("#asPrev").disabled = state.index <= 0; $("#asNext").disabled = state.index >= n - 1;
    ["asPrint", "asPdf", "asPng"].forEach(function (id) { $("#" + id).disabled = !n; });
    $("#asNotes").innerHTML = made.notes.map(function (x) { return '<p class="as-note as-' + x.kind + '">' + (x.kind === "ok" ? "&#x2713; " : x.kind === "warn" ? "&#x26A0; " : "") + escapeHtml(x.text) + '</p>'; }).join("");
    $("#asModuleHint").textContent = MODULE_HELP[state.module];
    root.classList.toggle("as-is-coloring", state.module === "coloring");
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
    var btn = $("#asPdf"), label = btn.textContent; btn.disabled = true; btn.textContent = "Making the PDF…";
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
  function print() {
    var area = $("#printRoot");
    area.innerHTML = made.pages.map(function (pg, i) {
      var cls = "as-pp" + (state.gutter ? (i % 2 === 0 ? " as-gl" : " as-gr") : "");
      return '<div class="' + cls + '">' + PL.toSVG(pg, { width: "100%", height: "100%" }) + '</div>';
    }).join("");
    fontsReady().then(function () { window.print(); });
  }

  /* ---------- wiring ---------- */
  function sync() {
    $$('input[name="module"]').forEach(function (r) { r.checked = r.value === state.module; });
    $$('input[name="stage"]').forEach(function (r) { r.checked = Number(r.value) === state.stage; });
    $$('input[name="dexterity"]').forEach(function (r) { r.checked = r.value === state.dexterity; });
    $$('input[name="layout"]').forEach(function (r) { r.checked = r.value === state.layout; });
    $("#asDecade").value = String(state.decade); $("#asStyle").value = state.style; $("#asCount").value = String(state.count);
  }
  function wire() {
    $$("#asForm input[type=radio]").forEach(function (r) {
      r.addEventListener("change", function () {
        var k = r.name, v = r.value; state[k] = (k === "stage") ? Number(v) : v;
        state.variant = 0; schedule(false);
      });
    });
    var bind = function (id, key, num) { $("#" + id).addEventListener("input", function (e) { state[key] = num ? Number(e.target.value) : e.target.value; if (key === "words") state.variant = 0; schedule(false); }); };
    bind("asDecade", "decade", true); bind("asName", "name"); bind("asInterests", "interests"); bind("asAvoid", "avoid"); bind("asStyle", "style"); bind("asWords", "words"); bind("asCount", "count", true);
    $("#asBorn").addEventListener("input", function (e) {
      state.born = e.target.value; var y = Number(e.target.value);
      if (y >= 1900 && y <= 2010) { state.decade = E.decadeFor(y); $("#asDecade").value = String(state.decade); }
      schedule(false);
    });
    $("#asGutter").addEventListener("change", function (e) { state.gutter = e.target.checked; });
    $("#asNew").addEventListener("click", function () { state.seed = (Math.random() * 1e9 | 0) + 1; state.variant = 0; refresh(false); });
    $("#asAnother").addEventListener("click", function () { state.variant++; refresh(false); });
    $("#asPrev").addEventListener("click", function () { state.index--; paint(); });
    $("#asNext").addEventListener("click", function () { state.index++; paint(); });
    $("#asPrint").addEventListener("click", print);
    $("#asPdf").addEventListener("click", exportPdf);
    $("#asPng").addEventListener("click", exportPng);
    root.addEventListener("keydown", function (e) {
      if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== "radio") return;
      if (e.key === "ArrowRight" && state.index < made.pages.length - 1) { state.index++; paint(); }
      if (e.key === "ArrowLeft" && state.index > 0) { state.index--; paint(); }
    });
  }

  build();
  var mh = document.createElement("p"); mh.className = "as-hint"; mh.id = "asModuleHint"; $('input[name="module"]').closest("fieldset").appendChild(mh);
  sync(); wire(); refresh(false);
  window.CognicopiaActivityStudio = Object.freeze({ state: state, refresh: function () { refresh(false); }, pages: function () { return made.pages; }, code: function () { return made.code; } });
})();
