/* =====================================================================
   Daily engagement (daily.html): one card for today, in three choices.

   Who it is for (a saved resident, or a group), what kind of time
   (reminiscence, music or comfort), then one button. The card is one 3:4
   page made by the Activity Page Studio's engine (js/generators/), so it
   keeps every rule the Studio's pages keep: the stage's type size, pure
   black on white, the topics to avoid, nothing that tests. A short line
   for staff is printed at the foot when the page has room for it, and the
   page's full note for staff is shown beside it on the screen.

   Today's card is the same all day for the same person and kind (the date
   and the choices pick it); "Another card" moves to the next one.

   Printing or making a PDF uses one free packet, the same count the other
   tools keep (assets/services/trialLedger.js); a license means no limit.
   Saved residents are read from the sealed store on this computer through
   js/residentContext.js. Nothing is sent anywhere.
   ===================================================================== */
(function () {
  "use strict";
  var E = window.CognicopiaActivityEngine, PL = window.CognicopiaColoringPipeline, PO = window.CognicopiaPrintOptimizer, R = window.CogniResident;
  var root = document.getElementById("dyRoot");
  if (!root || !E || !PL || !R) return;
  var $ = function (s) { return root.querySelector(s); };
  var ACTIVE_KEY = R.ACTIVE_KEY || "cognicopia_active_resident";
  var VOC_IDS = ["farmer", "teacher", "nurse", "cook", "mechanic", "secretary", "carpenter", "driver", "shopkeeper", "seamstress"];
  var STAGE_NAME = ["", "early stage", "middle stage", "late stage"];

  /* what each kind of time draws from, in the order tried, and its short line for staff */
  var KINDS = {
    reminiscence: { label: "Reminiscence", own: ["lifestory", "hometown", "mytrade", "whoswho", "twenty", "thennow", "generations", "dish"], group: ["hometown", "twenty", "thennow", "mytrade", "lifestory"],
      cue: "Sit beside them and read one line aloud. Then wait. Any answer, or none, is welcome." },
    music: { label: "Music", own: ["songs"], group: ["songs"],
      cue: "Play or hum one of these if you can. A tapping foot is an answer too." },
    comfort: { label: "Comfort", own: ["comfort", "myday"], group: ["comfort", "myday"], floor: 2,
      cue: "Offer two of these at a time, by pointing. Bring what they choose." }
  };
  var state = { who: "", stage: 2, decade: 1950, kind: "reminiscence", turn: 0 }, made = null, person = null, photosFor = "";

  /* ---------- saved residents ---------- */
  function SS() { return window.CogniSecureStore || null; }
  function LS() { var ss = SS(); if (ss && ss.storage) return ss.storage; try { return window.localStorage; } catch (e) { return null; } }
  function readRes(id) { var ls = LS(); return ls && id ? R.read(ls, id) : null; }
  function listRes() { var ls = LS(); return ls ? R.list(ls) : []; }
  function choose(id) {
    var p = readRes(id);
    state.who = p ? id : ""; person = p ? R.person(p) : null; photosFor = ""; state.turn = 0;
    try { var ls = LS(); if (ls) { if (p) ls.setItem(ACTIVE_KEY, id); } } catch (e) { /* the card still works */ }
    if (person) openPhotos(id);
  }
  /* the sealed pictures of this resident's people, opened once; the card is drawn again when they arrive */
  function openPhotos(id) {
    var ss = SS(); if (!person || !ss || !ss.getBlob || photosFor === id) return;
    photosFor = id;
    var names = person.family.all.map(function (x) { return x.photo; }).filter(Boolean);
    if (!names.length) return;
    Promise.all(names.map(function (n) { return ss.getBlob(n).then(function (d) { return [n, d]; }, function () { return [n, null]; }); })).then(function (list) {
      if (state.who !== id || !person) return;
      var pics = {}, next = {}; list.forEach(function (x) { if (x[1]) pics[x[0]] = x[1]; });
      if (!Object.keys(pics).length) return;
      Object.keys(person).forEach(function (k) { next[k] = person[k]; }); next.photos = pics; person = next;
      if (made) make();
    });
  }
  /* the profile the engine reads: a saved resident's own, or a group's stage and years */
  function profile(stage) {
    if (!person) return { stage: stage, decade: state.decade };
    var voc = ""; VOC_IDS.forEach(function (v) { if (!voc && person.work.text.indexOf(v) >= 0) voc = v; });
    var avoid = person.avoid.names.concat(person.avoid.other, person.avoid.places, person.avoid.people);
    return { person: person, name: person.name, born: person.born || 0, stage: stage, decade: person.born && E.decadeFor ? E.decadeFor(person.born) || state.decade : state.decade,
      interests: person.interests.join(", "), avoid: avoid.join(", "), personal: person.personalWords.join(", "), vocation: voc };
  }
  function stageNow() { return person ? person.stage || 2 : state.stage; }

  /* ---------- today's card ---------- */
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function hash(t) { var h = 2166136261; for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function candidates(kind, prof) {
    var k = KINDS[kind], fits = {}; E.modules().forEach(function (m) { fits[m.id] = !m.stages || m.stages.indexOf(prof.stage) >= 0; });
    if (!person) return k.group.filter(function (m) { return fits[m]; });
    var held = E.lifePagesFor ? E.lifePagesFor(prof) : [], first = k.own.filter(function (m) { return fits[m] && held.indexOf(m) >= 0; }), rest = k.own.filter(function (m) { return fits[m] && held.indexOf(m) < 0; });
    return first.length ? first : rest;                   // what the profile makes personal comes first; the plain pages only when it holds none of them
  }
  /* one sheet as one page, with the short line for staff at its foot when the page has room for it */
  function pageOf(sheet, cue) {
    if (sheet.kind === "blocks") {
      var withCue = JSON.parse(JSON.stringify(sheet));
      withCue.blocks = (withCue.blocks || []).filter(function (b) { return b.kind !== "staff"; }).concat([{ kind: "staff", text: cue }]);
      var pg = PL.sheetPages(withCue, "full").pages[0];
      if (pg && !PL.validate(pg).length) return { page: pg, cue: true };
    }
    return { page: PL.sheetPages(sheet, "full").pages[0], cue: false };
  }
  function make() {
    var k = KINDS[state.kind], stage = Math.max(k.floor || 1, stageNow()), prof = profile(stage), list = candidates(state.kind, prof);
    var base = hash([today(), state.who || "group", state.kind, stage, person ? "" : state.decade].join("|"));
    made = null;
    for (var n = 0; n < Math.max(1, list.length) && !made; n++) {             // the next kind in line when one cannot make a page from these choices
      var module = list[(base + state.turn + n) % list.length]; if (!module) break;
      var r = E.generate(prof, { module: module, count: 1, seed: ((base + state.turn * 7919) >>> 0) || 1 });
      if (r.notFitting || !r.sheets || !r.sheets.length) continue;
      var out = pageOf(r.sheets[0], k.cue);
      if (out.page) made = { page: out.page, cue: out.cue, sheet: r.sheets[0], module: module, stage: stage, raised: stage !== stageNow(), code: r.sheets[0].code || "" };
    }
    paint();
  }
  function paint() {
    var sheet = $("#dySheet"), has = !!made;
    sheet.classList.toggle("dy-empty", !has);
    sheet.innerHTML = has ? PL.toSVG(made.page) : '<p>Today’s card will appear here.</p>';
    if (has) sheet.setAttribute("aria-label", "Today’s card: " + (made.sheet.title || KINDS[state.kind].label)); else sheet.removeAttribute("aria-label");
    ["dyAgain", "dyPrint", "dyPdf"].forEach(function (id) { $("#" + id).disabled = !has; });
    $("#dyMake").textContent = has ? "Make today’s card again" : "Make today’s card";
    var staff = $("#dyStaff");
    staff.hidden = !has;
    if (has) {
      $("#dyStaffText").textContent = KINDS[state.kind].cue + " " + (made.sheet.staffNote || "");
      $("#dyStaffMore").textContent = (made.raised ? "Comfort pages are made for the middle and late stages, so this one uses the middle stage’s size. " : "") + (made.cue ? "" : "This page is full, so the line for staff is not printed on it. ");
      $("#dyCode").textContent = made.code ? "Page " + made.code : "";
    }
    if (PO && has) PO.fill(document.getElementById("printRoot"), [PL.toSVG(made.page)], {});
    $("#dyMsg").textContent = has ? "" : state.asked ? "No card could be made from these choices. Try another kind of time." : "";
  }

  /* ---------- the free trial: the same count the other tools keep ---------- */
  var CFG = window.CognicopiaLicenseConfig || {}, FREE = CFG.FREE_RUNS || 50, ledger = null;
  function trial() { if (!ledger && window.CogniTrialLedger) { try { ledger = window.CogniTrialLedger.forBrowser(SS() && SS().storage ? SS().storage : window.localStorage); } catch (e) { ledger = null; } } return ledger; }
  function licensed() { try { return !!(window.CognicopiaLicense && window.CognicopiaLicense.isLicensed()); } catch (e) { return false; } }
  function used() { var l = trial(); try { return l ? l.count() : 0; } catch (e) { return 0; } }
  function blocked() { return !licensed() && !!trial() && used() >= FREE; }
  function spend() { if (!licensed()) { var l = trial(); if (l) { try { l.record(); } catch (e) { /* the page still works */ } } } paintLeft(); }
  function paintLeft() { $("#dyLeft").textContent = licensed() ? "Licensed: unlimited packets." : trial() ? Math.max(0, FREE - used()) + " of " + FREE + " free packets left. Printing or making a PDF uses one." : ""; }
  function openGate() { var d = $("#dyGate"); try { if (d.showModal) d.showModal(); else d.setAttribute("open", ""); } catch (e) { d.setAttribute("open", ""); } $("#dyGateKey").focus(); }

  /* ---------- paper ---------- */
  function ready() {
    var d = document, fonts = d.fonts && d.fonts.load ? Promise.all([d.fonts.load('400 40px "Atkinson Hyperlegible"'), d.fonts.load('700 40px "Atkinson Hyperlegible"')]).catch(function () {}).then(function () { return d.fonts.ready; }) : Promise.resolve();
    return fonts.then(function () { return PL.loadImages && made ? PL.loadImages([made.page]) : null; });
  }
  function print() { if (!made) return; if (blocked()) { openGate(); return; } ready().then(function () { spend(); window.print(); }); }
  /* the PDF holds the card as real text and lines (js/utils/studio-pdf.js); a card that cannot be drawn that way exactly goes in as a picture */
  var lastPdf = null;
  function pdf() {
    if (!made) return; if (blocked()) { openGate(); return; }
    var SP = window.CognicopiaStudioPdf;
    if (!SP || !(window.jspdf && window.jspdf.jsPDF)) { $("#dyMsg").textContent = "The PDF maker could not load. Reload the page, or use Print and choose to save as a PDF."; return; }
    var btn = $("#dyPdf"), label = btn.textContent; btn.disabled = true; btn.textContent = "Making the PDF\u2026";
    ready().then(function () { return SP.make([made.page], { title: "Cognicopia daily card" }); }).then(function (r) {
      r.doc.save("cognicopia-daily-card-" + today() + ".pdf");
      lastPdf = { vector: r.vector, picture: r.picture };
      spend();
    }).catch(function () { $("#dyMsg").textContent = "The PDF could not be made. Use Print and choose to save as a PDF."; }).then(function () { btn.disabled = false; btn.textContent = label; });
  }

  /* ---------- the form ---------- */
  function paintWho() {
    var sel = $("#dyWho"), list = listRes();
    sel.innerHTML = '<option value="">A group (no one saved)</option>' + list.map(function (p) { var o = document.createElement("option"); o.value = p.id; o.textContent = String(p.tier1_core.preferredName || "").trim() || "A resident with no name yet"; return o.outerHTML; }).join("");
    sel.value = state.who && readRes(state.who) ? state.who : "";
    $("#dyNone").hidden = list.length > 0;
  }
  function sync() {
    $("#dyGroup").hidden = !!person;
    var note = $("#dyWhoNote"); note.hidden = !person;
    if (person) {
      var bits = [STAGE_NAME[person.stage || 2]]; if (person.born) bits.push("born " + person.born); if (person.hometown && person.hometown.town) bits.push(person.hometown.town);
      note.textContent = (person.name || "This resident") + ": " + bits.join(", ") + ".";
    }
    Array.prototype.forEach.call(root.querySelectorAll('input[name="dyStage"]'), function (r) { r.checked = Number(r.value) === state.stage; });
    Array.prototype.forEach.call(root.querySelectorAll('input[name="dyKind"]'), function (r) { r.checked = r.value === state.kind; });
    $("#dyDecade").value = String(state.decade);
  }
  function changed() { state.turn = 0; sync(); if (made || state.asked) make(); }
  function wire() {
    $("#dyWho").addEventListener("change", function (e) { choose(e.target.value); changed(); });
    root.addEventListener("change", function (e) {
      var t = e.target;
      if (t.name === "dyStage") { state.stage = Number(t.value) || 2; changed(); }
      if (t.name === "dyKind" && KINDS[t.value]) { state.kind = t.value; changed(); }
      if (t.id === "dyDecade") { state.decade = Number(t.value) || 1950; changed(); }
    });
    $("#dyMake").addEventListener("click", function () { state.asked = true; state.turn = 0; make(); var s = $("#dySheet"); if (s.scrollIntoView && window.matchMedia && window.matchMedia("(max-width:900px)").matches) s.scrollIntoView({ block: "start" }); });
    $("#dyAgain").addEventListener("click", function () { state.turn++; make(); });
    $("#dyPrint").addEventListener("click", print);
    $("#dyPdf").addEventListener("click", pdf);
    $("#dyGateClose").addEventListener("click", function () { $("#dyGate").close(); });
    $("#dyGateKey").addEventListener("click", function () { $("#dyGate").close(); if (window.CognicopiaLicense && window.CognicopiaLicense.openPromo) window.CognicopiaLicense.openPromo(); });
    if (window.CognicopiaLicense && window.CognicopiaLicense.onChange) window.CognicopiaLicense.onChange(paintLeft);
  }

  if (PO) PO.install();                                    // the print style sheet: only the card reaches the paper
  $("#dyDecade").innerHTML = (E.DECADES || [1940, 1950, 1960, 1970, 1980]).map(function (d) { return '<option value="' + d + '">The ' + d + "s</option>"; }).join("");
  $("#dyGateT").textContent = "You’ve used all " + FREE + " free packets";
  var want = (/[?&]kind=([a-z]+)/.exec(location.search) || [])[1]; if (want && KINDS[want]) state.kind = want;
  wire(); sync(); paint();
  /* a screen left open does not stay open: after 15 idle minutes the page forgets who was chosen (nobody saved is deleted) */
  if (window.CognicopiaSession && window.CognicopiaSession.onExpire) window.CognicopiaSession.onExpire(function () { try { LS().removeItem(ACTIVE_KEY); } catch (e) { /* ignore */ } });
  /* saved residents: open the sealed store (it asks for the passphrase if the facility set one), list them, and start on the one the other tools last chose */
  (SS() && SS().openForPage ? SS().openForPage().catch(function () { return null; }) : Promise.resolve()).then(function () {
    var a = null; try { a = LS() && LS().getItem(ACTIVE_KEY); } catch (e) { /* ignore */ }
    if (a && readRes(a)) choose(a);
    paintWho(); sync();
    var tl = trial(); if (tl && tl.ready) tl.ready().then(paintLeft, paintLeft); else paintLeft();
    if (/[?&]make=1\b/.test(location.search)) { state.asked = true; make(); }          // "Today's card" on the roster opens the card already made
  });
  window.CognicopiaDailyCard = Object.freeze({ state: state, made: function () { return made; }, kinds: Object.keys(KINDS), lastPdf: function () { return lastPdf; } });
})();
