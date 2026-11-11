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
                     Try different pages (a new seed and picture style; a new decade too, unless a birth year is known),
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
  /* the life pages (activity-life.js): each is about the person, and fuller when a saved resident is chosen */
  var LIFE_KINDS = [["lifestory", "My life story (stages 1-2)"], ["generations", "Family across the generations (stages 1-2)"], ["whoswho", "Who's who"], ["mytrade", "My work and its tools (stages 1-2)"],
    ["hometown", "Where I come from"], ["songs", "Songs of my years"], ["twenty", "The year I turned twenty (stages 1-2)"], ["thennow", "Then and now (stages 1-2)"],
    ["myday", "My day, step by step (stages 2-3)"], ["dish", "A dish I made (stages 1-2)"], ["comfort", "What I would like (stages 2-3)"], ["wordplay", "Word play (stages 1-2)"]];
  var HAS_LIFE = E.modules().some(function (m) { return m.id === "lifestory"; });
  if (HAS_LIFE) KINDS = KINDS.concat(LIFE_KINDS);
  /* the suggested packet for each stage: three of the master inventory and a coloring page */
  var SUGGEST = { 1: ["wordgrid", "timeline", "memory", "dialogue", "coloring"], 2: ["dialogue", "household", "phrases", "coloring"], 3: ["coloring", "recognition", "rhythm", "dialogue"] };
  var LABEL = {}; KINDS.forEach(function (k) { LABEL[k[0]] = k[1]; });
  var suggestTurn = 0;
  var state = { mix: { reminiscence: true, exercise: true, daily: true, coloring: true }, vocation: "", stage: 2, dexterity: "steady", decade: 1950, born: "", name: "", nameStyle: "plain", personal: "", challenge: false, answers: false, resident: "", interests: "", avoid: "",
    style: "botanical", words: "", layout: "full", pages: 4, view: "one", dark: false, gutter: false, seed: (Date.now() % 1000000) + 1, variant: 0, index: 0 };
  var made = { pages: [], notes: [], code: "" };

  /* ---------- the controls ---------- */
  function seg(name, legend, opts) {
    return '<fieldset class="as-f"><legend>' + legend + '</legend><div class="as-seg">' + opts.map(function (o) {
      return '<label><input type="radio" name="' + name + '" value="' + o[0] + '"><span>' + o[1] + (o[2] ? '<small>' + o[2] + '</small>' : '') + '</span></label>';
    }).join("") + '</div></fieldset>';
  }
  /* the form is three steps up front (who, how much support, make it) and three closed sections for everything else,
     so a first-time user sees what to do next and an experienced one can open what they need */
  function acc(id, title, hint, body) {
    return '<details class="as-acc" id="' + id + '"><summary><span>' + title + '</span><small>' + hint + '</small></summary><div class="as-acc-body">' + body + '</div></details>';
  }
  function mixBox(k) { return '<label class="as-check"><input type="checkbox" name="mix" value="' + k[0] + '"><span>' + k[1] + '</span></label>'; }
  function build() {
    var who =
      '<section class="as-step" aria-labelledby="asStep1"><h2 id="asStep1">Who is this for?</h2>' +
        '<div class="as-row"><label class="as-lab" for="asResident">Saved resident</label><select id="asResident"><option value="">A new person (not saved yet)</option></select></div>' +
        '<p class="as-hint" id="asWhoHint">Pick someone you saved, or type a first name.</p>' +
        '<div class="as-row"><label class="as-lab" for="asName">First name</label><input id="asName" type="text" maxlength="40" autocomplete="off" placeholder="for example: Eleanor"></div>' +
        '<div class="as-btns as-who-btns"><button type="button" class="as-btn as-alt" id="asSaveRes">Save these details</button><a class="as-btn as-alt as-link" id="asOpenRes" href="profile.html" target="_blank" rel="noopener" hidden>Open the full profile (new tab)</a></div>' +
        '<p class="as-hint" id="asWhoMsg" role="status" aria-live="polite"></p>' +
      '</section>';
    var support =
      '<section class="as-step" aria-labelledby="asStep2"><h2 id="asStep2">How much support?</h2>' +
        seg("stage", "Cognitive stage", [["1", "Stage 1", "Mild"], ["2", "Stage 2", "Moderate"], ["3", "Stage 3", "Advanced"]]) +
        seg("dexterity", "Motor dexterity", [["steady", "Steady"], ["limited", "Limited grip"], ["minimal", "Little control"]]) +
      '</section>';
    var make =
      '<section class="as-step" aria-labelledby="asStep3"><h2 id="asStep3">Make the packet</h2>' +
        '<p class="as-hint">The page on the right is what will print.</p>' +
        '<div class="as-btns"><button type="button" class="as-btn" id="asSuggest">Suggested packet for this stage</button><button type="button" class="as-btn as-alt" id="asRandom">Try different pages</button></div>' +
      '</section>';
    var life = acc("asAccLife", "Their life and interests", "year born, former work, interests, topics to avoid, words from their life",
      '<div class="as-row"><label class="as-lab" for="asDecade">Reminiscence years</label><select id="asDecade">' + E.DECADES.map(function (d) { return '<option value="' + d + '">The ' + d + 's</option>'; }).join("") + '</select></div>' +
      '<div class="as-row"><label class="as-lab" for="asBorn">Year born (suggests the years above)</label><input id="asBorn" type="number" inputmode="numeric" min="1900" max="2010" placeholder="1938"></div>' +
      '<div class="as-row"><label class="as-lab" for="asVocation">Former work (themes the word grids)</label><select id="asVocation"><option value="">Not chosen</option>' + (E.VOCATIONS || []).map(function (v) { return '<option value="' + v.id + '">' + v.label + '</option>'; }).join("") + '</select></div>' +
      '<div class="as-row as-nc"><label class="as-lab" for="asInterests">Interests, separated by commas</label><input id="asInterests" type="text" maxlength="120" placeholder="gardening, baking" autocomplete="off"></div>' +
      '<div class="as-row"><label class="as-lab" for="asAvoid">Topics to avoid, separated by commas</label><input id="asAvoid" type="text" maxlength="120" placeholder="trains, hospitals" autocomplete="off"></div>' +
      '<div class="as-row"><label class="as-lab" for="asPersonal">Names and places from their life, one word each, with commas (family, pets, hometown, a first car)</label><input id="asPersonal" type="text" maxlength="120" autocomplete="off" placeholder="for example: Sarah, Buster, Scobey, Studebaker"></div>' +
      '<fieldset class="as-f"><legend class="as-lab">How the name is lettered (your choice; nothing is guessed from the name)</legend><div class="as-seg"><label><input type="radio" name="nameStyle" value="plain"><span>Plain</span></label><label><input type="radio" name="nameStyle" value="flow"><span>Flowing script</span></label><label><input type="radio" name="nameStyle" value="formal"><span>Formal script</span></label></div></fieldset>');
    var pagesAcc = acc("asAccPages", "Choose the pages yourself", "which kinds of page, how many, coloring style, layout",
      '<fieldset class="as-f"><legend>Content mix</legend><div class="as-mix">' + KINDS.slice(0, 12).map(mixBox).join("") + '</div>' +
      (HAS_LIFE ? '<p class="as-lab as-mix-head" id="asLifeHead">About their own life</p><p class="as-hint">These pages are made from a saved resident\u2019s profile. With no one chosen they still work, with room to write things in.</p><div class="as-mix" role="group" aria-labelledby="asLifeHead">' + LIFE_KINDS.map(mixBox).join("") + '</div>' : '') +
      '<p class="as-hint">The packet takes one page from each kind in turn. A kind made for other stages is skipped, and the note says so.</p></fieldset>' +
      '<div class="as-row"><label class="as-lab" for="asPages">Pages in the packet</label><select id="asPages">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return '<option value="' + n + '">' + n + (n === 1 ? ' page' : ' pages') + '</option>'; }).join("") + '</select></div>' +
      '<div class="as-only-col"><div class="as-row"><label class="as-lab" for="asStyle">Coloring style</label><select id="asStyle">' + PL.STYLES.map(function (st) { return '<option value="' + st.id + '">' + st.label + '</option>'; }).join("") + '</select></div>' +
      '<div class="as-row"><label class="as-lab" for="asWords">Or describe the picture in a few words</label><input id="asWords" type="text" maxlength="120" placeholder="a rose in a jug" autocomplete="off"></div></div>' +
      '<div class="as-only-sheet">' + seg("layout", "Layout for prompts and steps", PL.LAYOUTS.map(function (l) { return [l.id, l.label]; })) + '</div>');
    var printAcc = acc("asAccPrint", "Printing and staff options", "bigger word search, answer key, binding gutter",
      '<div class="as-row"><label class="as-check"><input id="asChallenge" type="checkbox"><span>A bigger word search (early stage only): a full 20 by 20 grid of 20 words running in all eight directions, backward ones included</span></label></div>' +
      '<div class="as-row"><label class="as-check"><input id="asAnswers" type="checkbox"><span>Add a staff answer key at the end (keep it out of the resident\'s packet)</span></label></div>' +
      '<label class="as-check"><input type="checkbox" id="asGutter"><span>Leave a binding gutter (0.75 in, alternating sides for two-sided printing)</span></label>');
    root.innerHTML =
      '<div class="as-grid">' +
      '<form class="as-panel" id="asForm" aria-label="Packet settings" onsubmit="return false">' + who + support + make + life + pagesAcc + printAcc +
      '</form>' +
      '<section class="as-stage" aria-label="Preview">' +
        '<div class="as-bar"><fieldset class="as-f as-viewf"><legend class="as-sr">Preview style</legend><div class="as-seg"><label><input type="radio" name="view" value="one"><span>One page</span></label><label><input type="radio" name="view" value="all"><span>All pages</span></label></div></fieldset>' +
        '<label class="as-check as-darkck"><input type="checkbox" id="asDark"><span>High-contrast dark panel (the printed page stays white)</span></label></div>' +
        '<div class="as-pager"><button type="button" class="as-btn as-alt" id="asPrev" aria-label="Previous page">&#x2190; Back</button><p id="asPos" role="status" aria-live="polite"></p><button type="button" class="as-btn as-alt" id="asNext" aria-label="Next page">Next &#x2192;</button></div>' +
        '<div class="as-sheet" id="asSheet"></div><div class="as-scroll" id="asScroll" hidden></div>' +
        '<div class="as-btns as-out"><button type="button" class="as-btn" id="asPdf">Compile Packet PDF</button><button type="button" class="as-btn" id="asPrint">Print all pages</button><button type="button" class="as-btn as-alt" id="asPng">Download this page (PNG)</button></div>' +
        '<p class="as-hint" id="asLeft" role="status"></p>' +
        '<p class="as-hint" id="asPdfNote" role="status"></p>' +
        '<div class="as-ready" id="asReady"></div>' +
        '<div class="as-notes" id="asNotes" aria-live="polite"></div>' +
        '<div class="as-offline"><p id="asOffline" role="status"></p><button type="button" class="as-btn as-alt" id="asSave">Save for offline use</button></div>' +
      '</section></div><div id="printRoot" aria-hidden="true"></div>' +
      '<dialog class="as-gate" id="asGate" aria-labelledby="asGateT"><h2 id="asGateT">You\u2019ve used all ' + FREE + ' free packets</h2>' +
        '<p>Thank you for trying Cognicopia. A license for your building keeps every tool going, with no limit, and still keeps every resident detail on your own computers.</p>' +
        '<div class="as-btns"><a class="as-btn" id="asGatePlans" href="pricing.html">See plans and pricing</a><button type="button" class="as-btn as-alt" id="asGateKey">I have a license key</button><button type="button" class="as-btn as-alt" id="asGateClose">Not now</button></div></dialog>';
  }

  /* ---------- saved residents, in the same sealed store the roster and the profile form use ---------- */
  var PREFIX = "cognicopia_resident_", SCHEMA = "cognicopia.residentProfile", ACTIVE_KEY = "cognicopia_active_resident", mapped = {};
  var VOC_IDS = ["farmer", "teacher", "nurse", "cook", "mechanic", "secretary", "carpenter", "driver", "shopkeeper", "seamstress"];
  function SS() { return window.CogniSecureStore || null; }
  function LS() { var ss = SS(); if (ss && ss.storage) return ss.storage; try { return window.localStorage; } catch (e) { return null; } }
  var R = window.CogniResident;                      // js/residentContext.js: the one reader of a saved resident
  function readRes(id) { var ls = LS(); return ls ? R.read(ls, id) : null; }
  function listRes() { var ls = LS(); return ls ? R.list(ls) : []; }
  var words = function (v) { return String(v == null ? "" : v).split(/[,;\n]/).map(function (x) { return x.trim(); }).filter(Boolean); };
  var firstWord = function (n) { return String(n || "").trim().split(/\s+/)[0] || ""; };
  var slug = function (t) { return String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40); };
  /* what the form would hold for a saved resident */
  function fromProfile(p) {
    var who = R.person(p), voc = "";
    VOC_IDS.forEach(function (v) { if (!voc && who.work.text.indexOf(v) >= 0) voc = v; });
    /* a ticked topic or era shows by its short name (the engine knows the words behind it); what staff typed shows as typed */
    var avoid = who.avoid.names.concat(who.avoid.other, who.avoid.places, who.avoid.people);
    return { name: who.name, born: who.born || "", stage: who.stage || state.stage, vocation: voc,
      interests: who.interests.join(", "), avoid: avoid.join(", "), personal: who.personalWords.join(", ") };
  }
  /* the chosen resident as the life pages read them (read once, and again after a save) */
  var personCache = { id: "", person: null };
  function personOf(id) { if (personCache.id !== id) { var p = readRes(id); personCache = { id: id, person: p ? R.person(p) : null }; openPhotos(id); } return personCache.person; }
  /* the sealed pictures of the chosen resident's people, opened once (they are kept apart from the profile and read only when
     asked for); the pages are drawn again when they arrive. A locked store or a browser without one simply shows empty frames. */
  function openPhotos(id) {
    var who = personCache.person, ss = SS();
    if (!who || !ss || !ss.getBlob) return;
    var names = who.family.all.map(function (x) { return x.photo; }).filter(Boolean);
    if (!names.length) return;
    Promise.all(names.map(function (n) { return ss.getBlob(n).then(function (d) { return [n, d]; }, function () { return [n, null]; }); })).then(function (list) {
      if (personCache.id !== id || !personCache.person) return;
      var pics = {}; list.forEach(function (x) { if (x[1]) pics[x[0]] = x[1]; });
      if (!Object.keys(pics).length) return;
      var next = {}; Object.keys(personCache.person).forEach(function (k) { next[k] = personCache.person[k]; }); next.photos = pics;
      personCache = { id: id, person: next }; if (state.resident === id) refresh(false);
    });
  }
  function setField(id, v) { var el = $("#" + id); if (el) el.value = v == null ? "" : String(v); }
  function applyResident(id) {
    var p = id ? readRes(id) : null;
    state.resident = p ? id : "";
    if (!p) {                                          // a new person starts clean: nothing of the last resident carries over (the support settings stay)
      mapped = {}; state.name = ""; state.born = ""; state.vocation = ""; state.interests = ""; state.avoid = ""; state.personal = ""; state.variant = 0;
      try { LS().removeItem(ACTIVE_KEY); } catch (e) { /* ignore */ }
      if (window.CogniWayfinding) window.CogniWayfinding.note("");
      sync(); paintWho(); refresh(false); return;
    }
    var f = fromProfile(p); mapped = f;
    state.name = f.name; state.born = f.born; state.stage = f.stage; state.vocation = f.vocation; state.interests = f.interests; state.avoid = f.avoid; state.personal = f.personal; state.variant = 0;
    if (f.born) { var d = E.decadeFor ? E.decadeFor(Number(f.born)) : null; if (d) state.decade = d; }
    if (state.stage !== 1) state.challenge = false;
    try { LS().setItem(ACTIVE_KEY, id); } catch (e) { /* ignore */ }
    if (window.CogniWayfinding) window.CogniWayfinding.note(id);           // the active-resident bar, the search and the tab follow
    sync(); paintWho(); refresh(false);
  }
  function whoMsg(t, bad) { var m = $("#asWhoMsg"); if (!m) return; m.textContent = t; m.className = "as-hint" + (bad ? " as-bad" : t ? " as-ok" : ""); }
  function paintWho() {
    var sel = $("#asResident"), link = $("#asOpenRes"), list = listRes();
    if (!sel) return;
    sel.innerHTML = '<option value="">A new person (not saved yet)</option>' + list.map(function (p) { return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.tier1_core.preferredName) + (p.tier1_core.unitNumber ? " · " + escapeHtml(p.tier1_core.unitNumber) : "") + '</option>'; }).join("");
    sel.value = state.resident && readRes(state.resident) ? state.resident : "";
    link.hidden = !sel.value; if (sel.value) link.href = "profile.html?edit=" + encodeURIComponent(sel.value);
    $("#asSaveRes").textContent = sel.value ? "Save changes to " + firstWord(state.name || (readRes(sel.value) || { tier1_core: {} }).tier1_core.preferredName) : "Save as a new resident";
    var hint = $("#asWhoHint");
    hint.textContent = list.length ? "Pick someone you saved and the form fills in. A name is kept only if you press Save."
      : "No one is saved on this computer yet. Type a name, press Save, and next time pick them here.";
  }
  /* the lines this form manages inside a profile's notes; any other note is left as it was */
  function setNoteLine(notes, label, value) {
    var re = new RegExp("(^|\\n)" + label + ": [^\\n]*"), line = label + ": " + value;
    if (!value) return String(notes || "").replace(re, "").replace(/^\n+/, "");
    return re.test(notes || "") ? String(notes).replace(re, function (m0, lead) { return lead + line; }) : (notes ? notes + "\n" : "") + line;
  }
  function saveResident() {
    var name = String(state.name || "").trim();
    if (!name) { whoMsg("Type their first name first, then press Save.", true); $("#asName").focus(); return; }
    if (!LS()) { whoMsg("This browser is not allowing saving, so nothing was kept.", true); return; }
    var existing = state.resident ? readRes(state.resident) : null, now = new Date().toISOString(), isNew = !existing;
    var p = existing ? JSON.parse(JSON.stringify(existing)) : { schema: SCHEMA, version: 2, id: "res-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6), createdAt: now, meta: { source: "Activity Page Studio" } };
    p.updatedAt = now; p.tier1_core = p.tier1_core || {}; p.tier2_enrichment = p.tier2_enrichment || {}; p.tier3_deep = p.tier3_deep || { notes: "", people: [] };
    var t1 = p.tier1_core, t2 = p.tier2_enrichment, t3 = p.tier3_deep;
    t1.preferredName = name; t1.cognitiveTier = state.stage;
    if (Number(state.born)) t2.birthYear = Number(state.born);
    if (state.vocation && state.vocation !== mapped.vocation) { var v = (E.VOCATIONS || []).filter(function (x) { return x.id === state.vocation; })[0]; t1.occupation = { code: state.vocation, label: v ? v.label : state.vocation }; }
    if (state.avoid !== (mapped.avoid || "")) {
      var ta = t1.topicsToAvoid = t1.topicsToAvoid || { topics: [], eras: [], people: "", places: "", other: "" }, sorted = R.sortAvoidText(state.avoid);
      var typedNow = sorted.typed.map(function (x) { return x.toLowerCase(); });
      var keep = function (list, codesNow) {                                // a ticked box stays ticked while its name is still in the field
        var out = (list || []).filter(function (x) { var c = String(x && x.code || ""); return codesNow.indexOf(c) >= 0 || (!R.AVOID_NAMES[c] && typedNow.indexOf(R.avoidName(x).toLowerCase()) >= 0); });
        codesNow.forEach(function (c) { if (!out.some(function (x) { return x && x.code === c; })) out.push({ code: c, label: R.AVOID_NAMES[c] }); });
        return out;
      };
      ta.topics = keep(ta.topics, sorted.topics); ta.eras = keep(ta.eras, sorted.eras);
      var held = ta.topics.concat(ta.eras).map(function (x) { return R.avoidName(x).toLowerCase(); }).concat(words(ta.people), words(ta.places)).map(function (x) { return x.toLowerCase(); });
      ta.people = words(ta.people).filter(function (x) { return typedNow.indexOf(x.toLowerCase()) >= 0; }).join(", ");
      ta.places = words(ta.places).filter(function (x) { return typedNow.indexOf(x.toLowerCase()) >= 0; }).join(", ");
      ta.other = sorted.typed.filter(function (x) { return held.indexOf(x.toLowerCase()) < 0; }).join(", ");
    }
    if (state.interests !== (mapped.interests || "")) t3.notes = setNoteLine(t3.notes, "Interests", words(state.interests).join(", "));
    if (state.personal !== (mapped.personal || "")) t3.notes = setNoteLine(t3.notes, "Words from their life", words(state.personal).join(", "));
    try { LS().setItem(PREFIX + p.id, JSON.stringify(p)); LS().setItem(ACTIVE_KEY, p.id); if (window.CogniResidentFolder) window.CogniResidentFolder.soon(); } catch (e) { whoMsg(e && e.name === "LockedError" ? "Saved residents are locked. Unlock them first." : "That could not be saved. This browser is not allowing storage, or it is full.", true); return; }
    state.resident = p.id; mapped = fromProfile(p); personCache = { id: "", person: null };
    var done = function () { paintWho(); whoMsg((isNew ? "Saved " + firstWord(name) + ". " : "Updated " + firstWord(name) + ". ") + "Pick them from the list next time. Only on this computer."); };
    if (SS() && SS().flush) SS().flush().then(done, done); else done();
  }

  /* ---------- making the packet ---------- */
  function profile() { return { person: state.resident ? personOf(state.resident) : null, name: state.name, born: Number(state.born) || 0, nameStyle: state.nameStyle, personal: state.personal, challenge: state.challenge, stage: state.stage, dexterity: state.dexterity, decade: state.decade, interests: state.interests, avoid: state.avoid, vocation: state.vocation }; }
  function kindsOn() { return KINDS.map(function (k) { return k[0]; }).filter(function (k) { return state.mix[k]; }); }
  function avoidList() { return R.avoidFromText(state.avoid); }
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
        var pg = PL.composeColoring(c.asset, PL.subjectPaths(c.asset.id), { stage: state.stage, dexterity: state.dexterity, name: state.name, nameStyle: state.nameStyle, code: code });
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
    var ready = FV ? FV.validateBatch(pages, { stage: state.stage, interests: state.interests }) : null;   // the resident's pages only; the staff key is not an activity
    if (ready) FV.report(ready);                                                 // one console report for every batch
    if (state.answers) {                                                         // a staff-only key, last, for the pages that have one
      var groups = [];
      pages.forEach(function (pg, i) { if (pg.meta.key && pg.meta.key.length) groups.push({ title: "Page " + (i + 1) + ": " + (pg.meta.title || ""), lines: pg.meta.key }); });
      if (groups.length) PL.sheetPages({ kind: "answers", stage: state.stage, dexterity: state.dexterity, code: code + "-KEY", groups: groups }, "full").pages
        .forEach(function (pg) { pg.meta.module = "answers"; pg.meta.staff = "Staff only: the answers to this packet. Keep it out of the resident's folder."; pages.push(pg); });
      else notes.push({ kind: "info", text: "No page in this packet has an answer key, so none was added." });
    }
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

  /* ---------- the free trial: the same count the other tools keep (assets/services/trialLedger.js) ----------
     Printing or compiling a PDF uses one free packet; a license key means no limit. When the free packets are used up,
     printing, the PDF and the page image ask for a license instead of working, exactly as the Packet Builder does. */
  var CFG = window.CognicopiaLicenseConfig || {}, FREE = CFG.FREE_RUNS || 50, ledger = null;
  function trial() {
    if (!ledger && window.CogniTrialLedger) { try { ledger = window.CogniTrialLedger.forBrowser(SS() && SS().storage ? SS().storage : window.localStorage); } catch (e) { ledger = null; } }
    return ledger;
  }
  function licensed() { try { return !!(window.CognicopiaLicense && window.CognicopiaLicense.isLicensed()); } catch (e) { return false; } }
  function used() { var l = trial(); try { return l ? l.count() : 0; } catch (e) { return 0; } }
  function blocked() { return !licensed() && !!trial() && used() >= FREE; }
  function spend() { if (!licensed()) { var l = trial(); if (l) { try { l.record(); } catch (e) { /* the page still works */ } } } paintLeft(); }
  function paintLeft() {
    var el = $("#asLeft"); if (!el) return;
    el.textContent = licensed() ? "Licensed: unlimited packets." : trial() ? Math.max(0, FREE - used()) + " of " + FREE + " free packets left. Printing or making a PDF uses one." : "";
  }
  function openGate() {
    var d = $("#asGate"); if (!d) return;
    try { if (d.showModal) d.showModal(); else d.setAttribute("open", ""); } catch (e) { d.setAttribute("open", ""); }
    var b = $("#asGateKey"); if (b) b.focus();
  }

  /* ---------- export ---------- */
  function fontsOnly() {
    var d = document;
    if (!d.fonts || !d.fonts.load) return Promise.resolve();
    return Promise.all([d.fonts.load('400 40px "Atkinson Hyperlegible"'), d.fonts.load('700 40px "Atkinson Hyperlegible"'), d.fonts.load('40px "Pinyon Script"'), d.fonts.load('40px "Marck Script"'), d.fonts.load('700 40px "Atkinson Hyperlegible Mono"')]).catch(function () {}).then(function () { return d.fonts.ready; });
  }
  function download(name, href) { var a = document.createElement("a"); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  /* everything a canvas needs before it draws: the faces, and any photographs on the pages */
  function fontsReady() { return fontsOnly().then(function () { return PL.loadImages && made ? PL.loadImages(made.pages) : null; }); }
  function exportPng() {
    if (blocked()) { openGate(); return; }
    fontsReady().then(function () {
      var cv = document.createElement("canvas"); PL.toCanvas(made.pages[state.index], cv, 1.875);
      download("cognicopia-" + made.code.toLowerCase() + "-page" + (state.index + 1) + ".png", cv.toDataURL("image/png"));
    });
  }
  /* The PDF holds each page as real text and lines in the page's own faces (js/utils/studio-pdf.js): sharp at any size, its words
     searchable, and a small file. A page that cannot be drawn that way exactly goes in as a picture, and the line under the buttons says so. */
  var lastPdf = null;
  function exportPdf() {
    if (blocked()) { openGate(); return; }
    var SP = window.CognicopiaStudioPdf;
    if (!SP || !(window.jspdf && window.jspdf.jsPDF)) { alert("The PDF maker could not load. Reload the page, or use Print and choose Save as PDF."); return; }
    var btn = $("#asPdf"), label = btn.textContent, note = $("#asPdfNote"); btn.disabled = true; btn.textContent = "Compiling the PDF\u2026"; note.textContent = "";
    fontsReady().then(function () { return SP.make(made.pages, { gutter: state.gutter, title: "Cognicopia activity pages " + made.code }); }).then(function (r) {
      r.doc.save("cognicopia-" + made.code.toLowerCase() + ".pdf"); spend();
      lastPdf = { pages: made.pages.length, vector: r.vector, picture: r.picture };
      note.textContent = "PDF made: " + made.pages.length + (made.pages.length === 1 ? " page" : " pages") + (r.picture ? ", " + r.picture + " as a picture and the rest as text and lines." : ", as text and lines that stay sharp at any size.");
    }).catch(function () { alert("The PDF could not be made. Use Print and choose Save as PDF."); }).then(function () { btn.disabled = false; btn.textContent = label; });
  }
  function print() { if (blocked()) { openGate(); return; } fontsReady().then(function () { spend(); window.print(); }); }

  /* ---------- wiring ---------- */
  function sync() {
    $$('input[name="stage"]').forEach(function (r) { r.checked = Number(r.value) === state.stage; });
    $$('input[name="dexterity"]').forEach(function (r) { r.checked = r.value === state.dexterity; });
    $$('input[name="layout"]').forEach(function (r) { r.checked = r.value === state.layout; });
    $$('input[name="view"]').forEach(function (r) { r.checked = r.value === state.view; });
    $$('input[name="nameStyle"]').forEach(function (r) { r.checked = r.value === state.nameStyle; });
    syncChallenge();
    $("#asAnswers").checked = !!state.answers;
    $$('input[name="mix"]').forEach(function (c) { c.checked = !!state.mix[c.value]; });
    $("#asVocation").value = state.vocation; $("#asDecade").value = String(state.decade); $("#asStyle").value = state.style; $("#asPages").value = String(state.pages);
    $("#asDark").checked = state.dark; $("#asGutter").checked = state.gutter;
    setField("asName", state.name); setField("asBorn", state.born); setField("asInterests", state.interests); setField("asAvoid", state.avoid); setField("asPersonal", state.personal); setField("asWords", state.words);
  }
  /* the bigger word search is an early-stage offer: the box follows the stage as it changes */
  function syncChallenge() { var ch = $("#asChallenge"); if (!ch) return; ch.disabled = state.stage !== 1; if (ch.disabled) state.challenge = false; ch.checked = !!state.challenge; }
  function wire() {
    $$('#asForm input[name="stage"], #asForm input[name="dexterity"], #asForm input[name="layout"]').forEach(function (r) {
      r.addEventListener("change", function () { state[r.name] = r.name === "stage" ? Number(r.value) : r.value; state.variant = 0; syncChallenge(); schedule(false); });
    });
    $("#asChallenge").addEventListener("change", function () { state.challenge = this.checked; state.variant = 0; schedule(false); });
    $("#asAnswers").addEventListener("change", function () { state.answers = this.checked; schedule(true); });
    $("#asResident").addEventListener("change", function () { whoMsg(""); applyResident(this.value); });
    $("#asSaveRes").addEventListener("click", saveResident);
    $("#asGateClose").addEventListener("click", function () { $("#asGate").close(); });
    $("#asGateKey").addEventListener("click", function () { $("#asGate").close(); if (window.CognicopiaLicense && window.CognicopiaLicense.openPromo) window.CognicopiaLicense.openPromo(); });
    document.addEventListener("cognicopia:trial", paintLeft);
    if (window.CognicopiaLicense && window.CognicopiaLicense.onChange) window.CognicopiaLicense.onChange(paintLeft);
    $$('input[name="nameStyle"]').forEach(function (r) { r.addEventListener("change", function () { state.nameStyle = r.value; state.variant = 0; schedule(false); }); });
    $$('input[name="mix"]').forEach(function (c) { c.addEventListener("change", function () { state.mix[c.value] = c.checked; schedule(false); }); });
    $$('input[name="view"]').forEach(function (r) { r.addEventListener("change", function () { state.view = r.value; paint(); }); });
    var bind = function (id, key, num) { $("#" + id).addEventListener("input", function (e) { state[key] = num ? Number(e.target.value) : e.target.value; if (key === "words") state.variant = 0; schedule(false); }); };
    bind("asDecade", "decade", true); bind("asVocation", "vocation"); bind("asName", "name"); bind("asPersonal", "personal"); bind("asInterests", "interests"); bind("asAvoid", "avoid"); bind("asStyle", "style"); bind("asWords", "words"); bind("asPages", "pages", true);
    $("#asBorn").addEventListener("input", function (e) {
      state.born = e.target.value; var y = Number(e.target.value);
      if (y >= 1900 && y <= 2010) { state.decade = E.decadeFor(y); $("#asDecade").value = String(state.decade); }
      schedule(false);
    });
    $("#asSuggest").addEventListener("click", function () {
      /* with a saved resident chosen, up to three of the pages their profile can make its own lead the packet (a different three on
         the next press), then the stage's own pages and a coloring page; with no one chosen it is the stage's packet as before */
      var base = SUGGEST[state.stage], life = state.resident && E.lifePagesFor ? E.lifePagesFor(profile()) : [], lead = [];
      if (life.length) { for (var li = 0; li < Math.min(3, life.length); li++) lead.push(life[(suggestTurn * 3 + li) % life.length]); suggestTurn++; }
      var rest = base.filter(function (k) { return k !== "coloring"; }).slice(0, Math.max(1, 4 - lead.length)), pick = lead.concat(rest, ["coloring"]);
      KINDS.forEach(function (k) { state.mix[k[0]] = pick.indexOf(k[0]) >= 0; });
      state.pages = Math.max(state.pages, Math.min(10, pick.length)); state.index = 0; sync(); refresh(false);
    });
    $("#asGutter").addEventListener("change", function (e) { state.gutter = e.target.checked; paint(); });
    $("#asDark").addEventListener("change", function (e) { state.dark = e.target.checked; paint(); });
    $("#asRandom").addEventListener("click", function () {
      state.seed = (Math.random() * 1e9 | 0) + 1; state.variant = 0;
      if (!Number(state.born)) state.decade = E.DECADES[Math.floor(Math.random() * E.DECADES.length)];   // a person's own years stay theirs; only a page for nobody in particular changes decade
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
  /* a screen left open does not stay open: after 15 idle minutes the page forgets who was chosen (nobody saved is deleted) and starts clean */
  if (window.CognicopiaSession && window.CognicopiaSession.onExpire) window.CognicopiaSession.onExpire(function () { try { LS().removeItem(ACTIVE_KEY); } catch (e) { /* ignore */ } });
  /* saved residents: open the sealed store (it asks for the passphrase if the facility set one), list them, and start on the one the other tools last chose */
  (SS() && SS().openForPage ? SS().openForPage().catch(function () { return null; }) : Promise.resolve()).then(function () {
    paintWho();
    var tl = trial(); if (tl && tl.ready) tl.ready().then(paintLeft, paintLeft); else paintLeft();
    var a = null; try { a = LS() && LS().getItem(ACTIVE_KEY); } catch (e) { /* ignore */ }
    var W = window.CogniWayfinding, tab = W ? W.activeId() : "";          // the one chosen in this tab (the Packet Builder, the search) comes first
    if (tab && readRes(tab)) a = tab;
    if (a && readRes(a)) applyResident(a);
  });
  /* the search and the active-resident bar can choose who the Studio is working with */
  if (window.CogniWayfinding) window.CogniWayfinding.host({ residents: listRes, setActive: function (id) { whoMsg(""); applyResident(id && readRes(id) ? id : ""); } });
  window.CognicopiaActivityStudio = Object.freeze({ state: state, refresh: function () { refresh(false); }, pages: function () { return made.pages; }, code: function () { return made.code; }, lastPdf: function () { return lastPdf; } });
})();
