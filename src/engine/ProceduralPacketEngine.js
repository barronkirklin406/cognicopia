/* =====================================================================
   Cognicopia Procedural Packet Engine: the one front door every packet
   generator on the site shares (window.CognicopiaProceduralPacketEngine,
   also window.ProceduralPacketEngine).

   It does four jobs, and keeps every generator the same on each:

     1. quickStep(cfg)      the two-choice step before anything prints:
                            Soothe Intensity / Cognitive Level (mild / early,
                            moderate / mid, acute / late) and Reminiscence
                            Theme (nature, heritage, music, or a surprise mix).
                            One dialog, #instant-soothe-modal, with the answer
                            from the last time already chosen, so a caregiver
                            can press Enter and be done in two seconds.
     2. generate(o)         one to three fresh pages from SoothingPacketEngine,
                            drawn from a new random seed, steered away from what
                            this computer printed lately (the history below).
     3. print(packet)       the pages go into a hidden #print-stage, laid out as
                            8.5 x 11 in Letter sheets (0.65 in on the binding
                            side, 0.5 in on the other three, pure black on
                            white), then window.print(), then the stage is
                            taken down again.
     4. register / run      each generator of the site (instant soothe, ailment
                            packets, packet builder, life planners) registers
                            itself here, so they all start the same way.

   What it remembers, on this computer only (see docs/privacy-and-storage.md):
     cognicopia_soothe_history   the ids (never names or text) of what was
                                 printed lately, so the next print is new
     cognicopia_soothe_last      the last stage and theme chosen

   Works offline: no request, no library. A page that includes this file
   tells it about itself with configure(), which carries the active
   resident, the licence gate and where to report a problem.
   ===================================================================== */
(function (root) {
  "use strict";
  var VERSION = "1.0.0";
  var doc = root.document;
  var E = root.CognicopiaSoothingEngine, CA = root.CognicopiaClinicalActivities, C = root.CognicopiaSoothingContent, PCG = root.CognicopiaPCG || {};
  if (!E || !CA || !C) throw new Error("Load SoothingPacketEngine.js (and what it needs) before ProceduralPacketEngine.js.");

  var KEYS = { history: "cognicopia_soothe_history", last: "cognicopia_soothe_last" };
  var DIALOG_ID = "instant-soothe-modal", STAGE_ID = "print-stage";
  /* the sheet: 8.5 x 11 in Letter, 0.65 in on the binding (left) side and 0.5 in on the other three; the drawing fills the rest, 7.35 x 10 in */
  var SHEET = { widthIn: 8.5, heightIn: 11, leftIn: 0.65, otherIn: 0.5, view: [46.8, 36, 529.2, 720], drawW: "7.35in", drawH: "10in" };

  /* ---------- the two choices, as they are worded on screen ---------- */
  var STAGES = [
    { id: "early", key: "A", name: "Mild / Early", text: "Deeper historical trivia, word association and detailed line art." },
    { id: "middle", key: "B", name: "Moderate / Mid", text: "Simple reminiscence cues, thick-line motor paths and bold coloring." },
    { id: "late", key: "C", name: "Acute / Late", text: "Sensory grounding, ultra-bold motifs and rhythmic breathing or tactile paths." }
  ];
  var THEMES = [
    { id: "nature", key: "A", name: "Calming Nature & Gardens", text: "Gardens, birds, weather, water and the seasons." },
    { id: "heritage", key: "B", name: "Classic Home & Heritage", text: "Home and daily life, 1940s–1970s." },
    { id: "music", key: "C", name: "Music, Crafts & Nostalgia", text: "Songs, sewing, handwork and radio days." },
    { id: "mix", key: "D", name: "Random / Surprise Mix", text: "A different theme on each page." }
  ];

  /* ---------- storage that never gets in the way ---------- */
  var memory = {};
  function ls() { try { return root.localStorage || null; } catch (e) { return null; } }
  function read(key) {
    var s = ls(), raw = null;
    try { raw = s ? s.getItem(key) : memory[key] == null ? null : memory[key]; } catch (e) { raw = memory[key] == null ? null : memory[key]; }
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function write(key, value) {
    var raw = JSON.stringify(value), s = ls();
    memory[key] = raw;
    try { if (s) s.setItem(key, raw); } catch (e) { /* full or blocked: it is kept for this visit */ }
  }
  function drop(key) { delete memory[key]; var s = ls(); try { if (s) s.removeItem(key); } catch (e) { /* nothing to remove */ } }

  /* ---------- history: what was printed lately, as ids, oldest first ---------- */
  var POOL_SIZE = function (name) { return E.counts()[name] || 0; };
  var History = {
    read: function () {
      var h = read(KEYS.history), out = {};
      E.POOLS.forEach(function (p) {
        var list = h && Array.isArray(h[p]) ? h[p] : [];
        out[p] = list.filter(function (id) { return typeof id === "string" && id.length <= 24; }).slice(-POOL_SIZE(p));
      });
      return out;
    },
    /* add the ids of one packet (the "used" lists of its plan). A list holds as many ids as its pool has items, oldest first; the engine
       takes anything not on it before it takes anything that is, and once a pool is used up it starts again from the one used longest ago,
       so nothing comes back until everything else has had its turn */
    record: function (used) {
      var h = History.read();
      E.POOLS.forEach(function (p) {
        var add = used && Array.isArray(used[p]) ? used[p] : [];
        add.forEach(function (id) { h[p] = h[p].filter(function (x) { return x !== id; }); h[p].push(id); });
        var limit = Math.max(3, POOL_SIZE(p));
        if (h[p].length > limit) h[p] = h[p].slice(h[p].length - limit);
      });
      h.v = 1;
      write(KEYS.history, h);
      return h;
    },
    clear: function () { drop(KEYS.history); }
  };
  var Last = {
    read: function () {
      var l = read(KEYS.last);
      return { stage: l && STAGES.some(function (s) { return s.id === l.stage; }) ? l.stage : null, theme: l && THEMES.some(function (t) { return t.id === l.theme; }) ? l.theme : null };
    },
    write: function (stage, theme) { write(KEYS.last, { stage: stage, theme: theme }); }
  };

  /* ---------- a fresh seed for every print ---------- */
  var counter = 0;
  function entropy() {
    var words = [];
    try {
      if (root.crypto && root.crypto.getRandomValues) { var a = new Uint32Array(3); root.crypto.getRandomValues(a); words = [a[0], a[1], a[2]]; }
    } catch (e) { words = []; }
    if (!words.length) {
      var t = (root.performance && root.performance.now ? root.performance.now() : 0) * 1000;
      words = [Date.now() % 4294967296, Math.floor(t) % 4294967296, (++counter * 2654435761) % 4294967296];
    }
    return words.map(function (w) { return (w >>> 0).toString(36); }).join("-") + "." + (++counter).toString(36);
  }

  /* ---------- the page tells this file about itself ---------- */
  var host = { context: null, licence: null, notify: null };
  function configure(h) { h = h || {}; Object.keys(h).forEach(function (k) { host[k] = h[k]; }); return api; }
  function context() { var c = null; try { c = host.context ? host.context() : null; } catch (e) { c = null; } return c || {}; }
  function say(msg) { if (host.notify) host.notify(msg); else if (root.alert) root.alert(msg); }

  /* the years a person's own young adulthood fell in, from a birth year (the reminiscence bump), kept to 1901-1989 */
  function eraFromBirthYear(y) {
    y = parseInt(y, 10);
    if (!(y > 1850 && y < 2010)) return null;
    var a = Math.max(1901, y + 10), b = Math.min(1989, y + 35);
    return a <= b ? [a, b] : null;
  }

  /* ---------- the styles: the dialog, and the sheets on paper ---------- */
  var CSS = [
    "#" + STAGE_ID + "{display:none}",
    /* ---- the quick-start dialog: black on white, big targets, a clear focus ring ---- */
    "dialog.iso{box-sizing:border-box;width:min(760px,calc(100vw - 20px));max-height:calc(100vh - 20px);max-height:calc(100dvh - 20px);margin:auto;padding:0;border:4px solid #000;border-radius:16px;background:#fff;color:#000;font:18px/1.4 'Atkinson Hyperlegible',Arial,Helvetica,sans-serif;overflow:auto;box-shadow:0 12px 48px rgba(0,0,0,.45)}",
    "dialog.iso::backdrop{background:rgba(0,0,0,.72)}",
    "dialog.iso:not([open]){display:none}",
    ".iso *{box-sizing:border-box}",
    ".iso-form{margin:0;padding:18px 20px 20px}",
    ".iso-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}",
    ".iso-title{margin:0;font-size:28px;line-height:1.2;font-weight:700;color:#000}",
    ".iso-x{flex:none;min-width:48px;min-height:48px;border:3px solid #000;border-radius:12px;background:#fff;color:#000;font:700 28px/1 Arial,sans-serif;cursor:pointer}",
    ".iso-lead{margin:6px 0 14px;font-size:18px;color:#000}",
    ".iso-group{margin:0 0 14px;padding:0;border:0;min-width:0}",
    ".iso-group legend{padding:0;margin:0 0 8px;font-size:20px;font-weight:700;color:#000}",
    ".iso-n{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;margin-right:8px;border-radius:50%;background:#000;color:#fff;font-size:17px}",
    ".iso-opts{display:grid;gap:10px;grid-template-columns:repeat(3,minmax(0,1fr))}",
    ".iso-opts-4{grid-template-columns:repeat(2,minmax(0,1fr))}",
    ".iso-opt{position:relative;display:flex;gap:10px;align-items:flex-start;min-height:64px;padding:10px 12px;border:3px solid #000;border-radius:12px;background:#fff;color:#000;cursor:pointer}",
    ".iso-opt input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}",
    ".iso-key{flex:none;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:3px solid #000;border-radius:8px;font-weight:700;font-size:17px;color:#000;background:#fff}",
    ".iso-txt{display:block;min-width:0}",
    ".iso-txt b{display:block;font-size:18px;line-height:1.25}",
    ".iso-txt small{display:block;margin-top:2px;font-size:15px;line-height:1.3;font-weight:400}",
    ".iso-bolt{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;margin-right:8px;border-radius:50%;background:#000;font-size:20px;line-height:1;vertical-align:middle}",
    ".iso-opt.is-on{background:#000;color:#fff}",
    ".iso-opt.is-on .iso-key{background:#fff;color:#000;border-color:#fff}",
    ".iso-opt.is-on .iso-txt small,.iso-opt.is-on .iso-txt b{color:#fff}",
    ".iso-opt.is-focus{outline:5px solid #ffbf00;outline-offset:3px}",
    ".iso-note{margin:0 0 12px;min-height:1.4em;font-size:16px;color:#000}",
    ".iso-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:stretch}",
    ".iso-go{flex:1 1 100%;min-height:68px;padding:12px 18px;border:4px solid #000;border-radius:14px;background:#ffd23f;color:#000;font:700 22px/1.2 'Atkinson Hyperlegible',Arial,sans-serif;cursor:pointer}",
    ".iso-go:hover{background:#ffc400}",
    ".iso-alt,.iso-cancel{flex:1 1 200px;min-height:52px;padding:8px 14px;border:3px solid #000;border-radius:12px;background:#fff;color:#000;font:700 17px/1.2 'Atkinson Hyperlegible',Arial,sans-serif;cursor:pointer}",
    ".iso-alt[hidden]{display:none}",
    ".iso-go:focus-visible,.iso-alt:focus-visible,.iso-cancel:focus-visible,.iso-x:focus-visible{outline:5px solid #ffbf00;outline-offset:3px}",
    "@media (max-width:620px){.iso-opts,.iso-opts-4{grid-template-columns:1fr}.iso-form{padding:14px 12px 16px}.iso-title{font-size:24px}.iso-go{font-size:19px}}",
    "@media (max-height:640px){.iso-opt{min-height:52px;padding:6px 10px}.iso-lead{margin-bottom:8px}.iso-group{margin-bottom:8px}.iso-txt small{display:none}}",
    /* ---- on paper: only #print-stage; Letter sheets; pure black on white ---- */
    "@media print{",
    "html body[data-print=\"soothe\"]{background:#fff!important;margin:0!important;padding:0!important;color:#000!important}",
    "html body[data-print=\"soothe\"] > *:not(#" + STAGE_ID + "){display:none!important}",
    "html body[data-print=\"soothe\"] > #" + STAGE_ID + "{display:block!important;position:static!important;margin:0!important;padding:0!important;background:#fff!important}",
    "#" + STAGE_ID + " .ps-sheet{display:block;box-sizing:border-box;width:" + SHEET.widthIn + "in;height:" + SHEET.heightIn + "in;margin:0;padding:" + SHEET.otherIn + "in " + SHEET.otherIn + "in " + SHEET.otherIn + "in " + SHEET.leftIn + "in;overflow:hidden;background:#fff;color:#000;break-after:page;page-break-after:always;break-inside:avoid;page-break-inside:avoid;box-shadow:none}",
    "#" + STAGE_ID + " .ps-sheet:last-child{break-after:auto;page-break-after:auto}",
    "#" + STAGE_ID + " .ps-sheet svg{display:block;width:" + SHEET.drawW + ";height:" + SHEET.drawH + ";filter:none!important;text-rendering:geometricPrecision}",
    "#" + STAGE_ID + ",#" + STAGE_ID + " *{-webkit-print-color-adjust:exact;print-color-adjust:exact;text-shadow:none!important}",
    "}"
  ].join("\n");
  function ensureStyle() {
    if (doc.getElementById("ps-style")) return;
    var st = doc.createElement("style"); st.id = "ps-style"; st.textContent = CSS; (doc.head || doc.documentElement).appendChild(st);
  }

  /* ---------- the dialog ---------- */
  function optHtml(group, o) {
    return '<label class="iso-opt" data-v="' + o.id + '"><input type="radio" name="iso-' + group + '" value="' + o.id + '">' +
      '<span class="iso-key" aria-hidden="true">' + o.key + '</span><span class="iso-txt"><b>' + o.name + '</b><small>' + o.text + '</small></span></label>';
  }
  function dialogHtml() {
    return '<form method="dialog" class="iso-form" novalidate>' +
      '<div class="iso-head"><h2 class="iso-title" id="iso-title">Instant Soothe</h2><button type="button" class="iso-x" data-iso="cancel" aria-label="Close without printing">×</button></div>' +
      '<p class="iso-lead" id="iso-lead"></p>' +
      '<fieldset class="iso-group" id="iso-stage"><legend><span class="iso-n" aria-hidden="true">1</span>Soothe Intensity / Cognitive Level</legend><div class="iso-opts">' + STAGES.map(function (s) { return optHtml("stage", s); }).join("") + '</div></fieldset>' +
      '<fieldset class="iso-group" id="iso-theme"><legend><span class="iso-n" aria-hidden="true">2</span>Reminiscence Theme</legend><div class="iso-opts iso-opts-4">' + THEMES.map(function (t) { return optHtml("theme", t); }).join("") + '</div></fieldset>' +
      '<p class="iso-note" id="iso-note" role="status"></p>' +
      '<div class="iso-actions"><button type="submit" class="iso-go" id="iso-go"></button>' +
      '<button type="button" class="iso-alt" id="iso-alt" data-iso="alt" hidden></button>' +
      '<button type="button" class="iso-cancel" data-iso="cancel">Cancel</button></div></form>';
  }
  var dlg = null, pending = null;
  function ensureDialog() {
    ensureStyle();
    if (dlg && doc.body.contains(dlg)) return dlg;
    dlg = doc.getElementById(DIALOG_ID);
    if (!dlg) {
      dlg = doc.createElement("dialog"); dlg.id = DIALOG_ID; dlg.className = "iso";
      dlg.setAttribute("aria-labelledby", "iso-title"); dlg.setAttribute("aria-describedby", "iso-lead");
      dlg.innerHTML = dialogHtml(); doc.body.appendChild(dlg);
    }
    var form = dlg.querySelector("form");
    var sync = function () {
      Array.prototype.forEach.call(dlg.querySelectorAll(".iso-opt"), function (l) { l.classList.toggle("is-on", l.querySelector("input").checked); });
    };
    dlg.addEventListener("change", sync);
    dlg.addEventListener("focusin", function (e) {
      Array.prototype.forEach.call(dlg.querySelectorAll(".iso-opt"), function (l) { l.classList.toggle("is-focus", l.contains(e.target) && e.target.matches && e.target.matches(":focus-visible")); });
    });
    dlg.addEventListener("focusout", function () { Array.prototype.forEach.call(dlg.querySelectorAll(".iso-opt"), function (l) { l.classList.remove("is-focus"); }); });
    form.addEventListener("submit", function (e) { e.preventDefault(); finish("go"); });
    dlg.addEventListener("click", function (e) {
      var t = e.target, b = t && t.closest ? t.closest("[data-iso]") : null;
      if (b) { e.preventDefault(); finish(b.getAttribute("data-iso")); return; }
      if (t === dlg) finish("cancel");                                   // a click on the backdrop
    });
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); finish("cancel"); });   // Esc
    dlg.addEventListener("close", function () { if (pending) finish("cancel"); });
    dlg.sync = sync;
    return dlg;
  }
  function chosen(name) { var i = dlg.querySelector('input[name="iso-' + name + '"]:checked'); return i ? i.value : null; }
  function finish(action) {
    if (!pending) return;
    var p = pending; pending = null;
    var out = null;
    if (action !== "cancel") out = { stage: chosen("stage"), theme: chosen("theme"), action: action };
    if (out && action === "go") Last.write(out.stage, out.theme);
    try { if (dlg.open) dlg.close(); } catch (e) { dlg.removeAttribute("open"); }
    if (p.opener && p.opener.focus && !out) { try { p.opener.focus(); } catch (e) { /* the opener is gone */ } }
    p.resolve(out);
  }

  /* quickStep(cfg) -> Promise of { stage, theme, action } or null if it was closed.
     cfg: { title, lead, confirm, stage, theme, note, alt: "label of a second way out" } */
  function quickStep(cfg) {
    cfg = cfg || {};
    return new Promise(function (resolve) {
      var d = ensureDialog();
      if (pending) finish("cancel");
      var last = Last.read(), stage = STAGES.some(function (s) { return s.id === cfg.stage; }) ? cfg.stage : last.stage || "middle";
      var theme = THEMES.some(function (t) { return t.id === cfg.theme; }) ? cfg.theme : last.theme || "mix";
      d.querySelector("#iso-title").textContent = cfg.title || "Instant Soothe";
      d.querySelector("#iso-lead").textContent = cfg.lead || "Two quick choices, then one press makes a fresh calming packet.";
      var label = String(cfg.confirm || "⚡ Generate & Print Instant Packet"), go = d.querySelector("#iso-go");
      go.textContent = "";
      if (label.charAt(0) === "⚡") {                                       // the bolt sits on a black disc, so it shows against the yellow
        var bolt = doc.createElement("span"); bolt.className = "iso-bolt"; bolt.setAttribute("aria-hidden", "true"); bolt.textContent = "⚡";
        go.appendChild(bolt); label = label.replace(/^⚡\s*/, "");
      }
      go.appendChild(doc.createTextNode(label));
      d.querySelector("#iso-note").textContent = cfg.note || "";
      var alt = d.querySelector("#iso-alt"); alt.hidden = !cfg.alt; alt.textContent = cfg.alt || "";
      d.querySelector('input[name="iso-stage"][value="' + stage + '"]').checked = true;
      d.querySelector('input[name="iso-theme"][value="' + theme + '"]').checked = true;
      d.sync();
      pending = { resolve: resolve, opener: doc.activeElement };
      if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
      if (go.focus) go.focus({ preventScroll: true });                       // Enter makes the packet
      d.scrollTop = 0;
    });
  }

  /* ---------- the print stage ---------- */
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function fontsReady() {
    if (!doc.fonts || !doc.fonts.load) return Promise.resolve();
    var load = Promise.all(["400", "700"].map(function (w) { return doc.fonts.load(w + ' 20px "Atkinson Hyperlegible"'); })).catch(function () { return null; });
    return Promise.race([load, wait(3000)]);
  }
  function frames() { return new Promise(function (r) { var raf = root.requestAnimationFrame || function (f) { return setTimeout(f, 16); }; raf(function () { raf(r); }); }); }

  var live = null;                                                            // what is on the stage now, so it can be taken down
  function cleanup() {
    if (!live) { var old = doc.getElementById(STAGE_ID); if (old && old.parentNode) old.parentNode.removeChild(old); doc.body.removeAttribute("data-print"); return; }
    var l = live; live = null;
    if (l.stage && l.stage.parentNode) l.stage.parentNode.removeChild(l.stage);
    if (l.page && l.page.parentNode) l.page.parentNode.removeChild(l.page);
    doc.body.removeAttribute("data-print");
    if (l.title != null) doc.title = l.title;
    root.removeEventListener("afterprint", l.after);
  }
  function sheetsHtml(pages) {
    return pages.map(function (pg) {
      return '<section class="ps-sheet">' + CA.toSVG(pg.full, { width: SHEET.drawW, height: SHEET.drawH, background: "#fff", viewBox: SHEET.view }) + "</section>";
    }).join("");
  }
  /* print(packet, opts) -> Promise, settled once the print dialog is on its way.
     packet: what generate() returned (or { pages: [{ full }] }). opts: { title, name } */
  function print(packet, opts) {
    opts = opts || {};
    cleanup();
    ensureStyle();
    var stage = doc.createElement("div");
    stage.id = STAGE_ID; stage.setAttribute("aria-hidden", "true");
    stage.innerHTML = sheetsHtml(packet.pages);
    var page = doc.createElement("style"); page.id = "ps-page"; page.textContent = "@page{size:" + SHEET.widthIn + "in " + SHEET.heightIn + "in;margin:0}";
    doc.head.appendChild(page); doc.body.appendChild(stage);
    var l = live = { stage: stage, page: page, title: doc.title, after: function () { cleanup(); } };
    root.addEventListener("afterprint", l.after);
    doc.body.setAttribute("data-print", "soothe");
    var who = opts.name ? " - " + opts.name : "";
    doc.title = (opts.title || "Cognicopia Instant Soothe") + who + " - " + packet.date;       // the PDF's file name
    return fontsReady().then(frames).then(function () {
      if (live !== l) return false;                                          // another print replaced this one
      root.print();
      return true;
    });
  }

  /* ---------- making a packet ---------- */
  /* generate(o) -> a packet. o: { stage, theme, name, wing, date, era, avoid, count, seed, record }
     The seed is new each time unless one is given; what is printed is added to the history unless record is false. */
  function generate(o) {
    o = o || {};
    var packet = E.generate({
      stage: o.stage, theme: o.theme, seed: o.seed == null ? entropy() : o.seed, history: History.read(), era: o.era || null, avoid: o.avoid || [],
      count: o.count, name: o.name || "", wing: o.wing || "", date: o.date || (PCG.prng && PCG.prng.today ? PCG.prng.today().iso : "")
    });
    if (o.record !== false) History.record(packet.used);
    return packet;
  }

  var generators = {};
  function register(kind, fn) { if (typeof fn === "function") generators[kind] = fn; return api; }
  function run(kind, o) { if (!generators[kind]) return Promise.reject(new Error("No generator is registered for " + kind)); return Promise.resolve(generators[kind](o || {})); }

  function blocked() { try { return !!(host.licence && host.licence.blocked && host.licence.blocked()); } catch (e) { return false; } }
  function counted() { try { if (host.licence && host.licence.used) host.licence.used(); } catch (e) { /* a counter that fails never stops a calming page */ } }

  /* The Instant Soothe button: the dialog, then a packet, then paper. Resolves with the packet, or null if it was closed.
     o: { context, title, confirm, lead, note, printTitle } to make it for another generator (the life planner's calming page) */
  function instantSoothe(o) {
    o = o || {};
    if (blocked()) { try { host.licence.openGate(); } catch (e) { /* no gate on this page */ } return Promise.resolve(null); }
    var c = o.context || context(), name = c.name || "", stage = c.stage && STAGES.some(function (s) { return s.id === c.stage; }) ? c.stage : null;
    var note = name && stage ? "Set from " + name + "'s profile (" + C.STAGE_LABEL[stage] + "). Change it if today calls for something different." : "No resident is chosen, so this packet is general and needs no profile.";
    return quickStep({ title: o.title || "Instant Soothe", stage: stage, note: o.note || note, alt: c.alt && c.alt.label, confirm: o.confirm,
      lead: o.lead || "Two quick choices, then one press makes a fresh calming packet and prints it." })
      .then(function (pick) {
        if (!pick) return null;
        if (pick.action === "alt") { try { c.alt.run(); } catch (e) { say("That calming page could not be printed: " + (e && e.message || e)); } return null; }
        var packet;
        try { packet = generate({ stage: pick.stage, theme: pick.theme, name: name, wing: c.wing, date: c.date, era: c.era, avoid: c.avoid }); }
        catch (e) { say("A calming packet could not be made: " + (e && e.message || e)); return null; }
        return print(packet, { title: o.printTitle || "Cognicopia Instant Soothe", name: name }).then(function () { counted(); return packet; });
      });
  }
  register("instant-soothe", instantSoothe);

  var api = Object.freeze({
    VERSION: VERSION, KEYS: KEYS, STAGES: STAGES, THEMES: THEMES, SHEET: SHEET,
    engine: E, History: History, Last: Last, entropy: entropy, eraFromBirthYear: eraFromBirthYear,
    configure: configure, quickStep: quickStep, generate: generate, print: print, cleanup: cleanup,
    register: register, run: run, instantSoothe: instantSoothe, css: function () { return CSS; }, blocked: blocked
  });
  root.CognicopiaProceduralPacketEngine = api;
  root.ProceduralPacketEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
