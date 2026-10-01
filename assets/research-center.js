/* =====================================================================
   CLINICAL SCIENCE & RESEARCH CENTER: what the pages do in the browser
   (resources/research/, written by scripts/research-pages.mjs)
     - Reading settings: text size, line spacing and colors, kept in this
       browser for every Research Center page.
     - Focus mode: the page alone, without the site's navigation.
     - Collapsible sections, opened from the contents, a link, the
       browser's find-in-page, or Expand all; every section opens to print.
     - Citation previews on hover or keyboard focus, and copy buttons.
     - The library's filters: type, topic, evidence strength and search.
     - The board packet: built here as a PDF and saved to this computer.
   Without scripts every section shows, every card shows, and the pages
   read and print in full. The only files this loads are the site's own
   (the PDF library, its font and the Research Center's content, for the
   board packet). Nothing is sent anywhere.
   ===================================================================== */
(function(){
  "use strict";
  var doc = document, html = doc.documentElement, READER = "cg_rc_reader", BOARD = "cg_rc_board";
  var OPTS = { size:["standard", "large", "largest"], lead:["comfortable", "wide"], theme:["paper", "dark", "max"] };
  function $(s, r){ return (r || doc).querySelector(s); }
  function $$(s, r){ return [].slice.call((r || doc).querySelectorAll(s)); }
  function load(key){ try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e){ return null; } }
  function save(key, v){ try { localStorage.setItem(key, JSON.stringify(v)); } catch (e){} }
  var live = $("#rcLive");
  function say(t){ if (!live) return; live.textContent = ""; setTimeout(function(){ live.textContent = t; }, 40); }

  /* controls that need this script */
  $$("[data-rc-js]").forEach(function(el){ el.hidden = false; });

  /* ---------- reading settings ---------- */
  var settings = load(READER) || {};
  function apply(){
    Object.keys(OPTS).forEach(function(k){
      var v = OPTS[k].indexOf(settings[k]) >= 0 ? settings[k] : OPTS[k][0];
      if (v === OPTS[k][0]) html.removeAttribute("data-rc-" + k); else html.setAttribute("data-rc-" + k, v);
      var r = $('input[name="rc-' + k + '"][value="' + v + '"]'); if (r) r.checked = true;
    });
  }
  apply();
  $$('.rc-settings input[type="radio"]').forEach(function(r){
    r.addEventListener("change", function(){ settings[r.name.slice(3)] = r.value; save(READER, settings); apply(); });
  });
  var reset = $('[data-rc="reset"]');
  if (reset) reset.addEventListener("click", function(){ settings = {}; save(READER, settings); apply(); say("Reading settings reset."); });
  var panel = $(".rc-settings");
  if (panel){
    doc.addEventListener("click", function(e){ if (panel.open && !panel.contains(e.target)) panel.open = false; });
    panel.addEventListener("keydown", function(e){ if (e.key === "Escape" && panel.open){ e.stopPropagation(); panel.open = false; $("summary", panel).focus(); } });
  }

  /* ---------- focus mode ---------- */
  var focusBtn = $('[data-rc="focus"]'), exitBtn = $("#rcExit");
  function setFocus(on){
    html.classList.toggle("rc-focus", on);
    if (focusBtn) focusBtn.setAttribute("aria-pressed", String(on));
    if (exitBtn) exitBtn.hidden = !on;
    say(on ? "Focus mode is on. Press Escape to leave it." : "Focus mode is off.");
  }
  if (focusBtn) focusBtn.addEventListener("click", function(){ setFocus(!html.classList.contains("rc-focus")); });
  if (exitBtn) exitBtn.addEventListener("click", function(){ setFocus(false); if (focusBtn) focusBtn.focus(); });

  /* ---------- collapsible sections (the APG accordion pattern) ---------- */
  var secs = $$(".rc-sec"), allBtn = $('[data-rc="expand"]');
  var CHEV = '<svg class="rc-chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="6 9 12 15 18 9"/></svg>';
  function btnOf(sec){ return $(".rc-acc", sec); }
  function isOpen(sec){ var b = btnOf(sec); return !b || b.getAttribute("aria-expanded") === "true"; }
  function setOpen(sec, open){
    var b = btnOf(sec), body = $(".rc-sec-b", sec); if (!b || !body) return;
    b.setAttribute("aria-expanded", String(open));
    if (open) body.removeAttribute("hidden"); else body.setAttribute("hidden", "until-found");   // closed text stays findable with the browser's find
  }
  function syncAll(){
    if (!allBtn) return;
    var open = secs.length && secs.every(isOpen), label = $("span", allBtn);
    if (label) label.textContent = open ? "Collapse all sections" : "Expand all sections";
    allBtn.setAttribute("data-open", open ? "1" : "");
  }
  secs.forEach(function(sec, i){
    var h = $(".rc-sec-h", sec), body = $(".rc-sec-b", sec); if (!h || !body) return;
    var b = doc.createElement("button");
    b.type = "button"; b.className = "rc-acc"; b.setAttribute("aria-controls", body.id);
    while (h.firstChild) b.appendChild(h.firstChild);
    b.insertAdjacentHTML("beforeend", CHEV);
    h.appendChild(b);
    b.addEventListener("click", function(){ setOpen(sec, !isOpen(sec)); syncAll(); });
    body.addEventListener("beforematch", function(){ setOpen(sec, true); syncAll(); });
    setOpen(sec, i === 0);
  });
  if (allBtn) allBtn.addEventListener("click", function(){
    var open = !allBtn.getAttribute("data-open");
    secs.forEach(function(s){ setOpen(s, open); }); syncAll();
    say(open ? "All sections are open." : "All sections are closed.");
  });
  /* a link to a section, or to something inside one, opens it */
  function openFor(id){
    var t = id && doc.getElementById(id); if (!t) return null;
    var sec = t.closest ? t.closest(".rc-sec") : null;
    if (sec && !isOpen(sec)){ setOpen(sec, true); syncAll(); }
    return t;
  }
  function fromHash(){ var t = openFor(decodeURIComponent(location.hash.slice(1))); if (t && t.scrollIntoView) t.scrollIntoView(); }
  window.addEventListener("hashchange", fromHash);
  if (location.hash) fromHash();
  syncAll();

  /* ---------- printing: every section open, then back as it was ---------- */
  var before = null;
  window.addEventListener("beforeprint", function(){ before = secs.map(isOpen); secs.forEach(function(s){ setOpen(s, true); }); });
  window.addEventListener("afterprint", function(){ if (before) secs.forEach(function(s, i){ setOpen(s, before[i]); }); before = null; syncAll(); });
  var printBtn = $('[data-rc="print"]');
  if (printBtn) printBtn.addEventListener("click", function(){ window.print(); });

  /* ---------- citation previews ---------- */
  var tip = null, tipFor = null;
  function hideTip(){ if (tip) tip.hidden = true; if (tipFor) tipFor.removeAttribute("aria-describedby"); tipFor = null; }
  function showTip(a){
    var li = doc.getElementById((a.getAttribute("href") || "").slice(1)), text = li && $(".rc-ref-text", li);
    if (!text) return;
    if (!tip){ tip = doc.createElement("div"); tip.className = "rc-tip"; tip.id = "rcTip"; tip.setAttribute("role", "tooltip"); doc.body.appendChild(tip); }
    tip.textContent = text.textContent; tip.hidden = false;
    a.setAttribute("aria-describedby", "rcTip"); tipFor = a;
    var r = a.getBoundingClientRect(), w = tip.offsetWidth, hh = tip.offsetHeight;
    var x = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2)), y = r.top - hh - 10;
    if (y < 12) y = r.bottom + 10;
    tip.style.left = (x + window.pageXOffset) + "px"; tip.style.top = (y + window.pageYOffset) + "px";
  }
  $$("a.rc-cite").forEach(function(a){
    a.addEventListener("mouseenter", function(){ showTip(a); });
    a.addEventListener("mouseleave", hideTip);
    a.addEventListener("focus", function(){ showTip(a); });
    a.addEventListener("blur", hideTip);
    a.addEventListener("click", hideTip);
  });
  window.addEventListener("scroll", function(){ if (tipFor && doc.activeElement !== tipFor) hideTip(); }, { passive:true });

  doc.addEventListener("keydown", function(e){
    if (e.key !== "Escape") return;
    if (tip && !tip.hidden){ hideTip(); return; }
    if (html.classList.contains("rc-focus")){ setFocus(false); if (focusBtn) focusBtn.focus(); }
  });

  /* ---------- copying ---------- */
  function fallbackCopy(text){
    var t = doc.createElement("textarea"), ok = false;
    t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.top = "0"; t.style.opacity = "0";
    doc.body.appendChild(t); t.select();
    try { ok = doc.execCommand("copy"); } catch (e){}
    t.parentNode.removeChild(t); return ok;
  }
  function copy(text, btn){
    var done = function(){ say("Copied to the clipboard."); var span = btn.lastChild; if (span && span.nodeType === 3){ var old = span.nodeValue; span.nodeValue = "Copied"; setTimeout(function(){ span.nodeValue = old; }, 1600); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function(){ if (fallbackCopy(text)) done(); else say("Copying is blocked here. Select the text to copy it."); });
    else if (fallbackCopy(text)) done(); else say("Copying is blocked here. Select the text to copy it.");
  }
  $$("[data-copy]").forEach(function(b){
    b.addEventListener("click", function(){ var el = $(b.getAttribute("data-copy")); if (el) copy(el.textContent.replace(/\s+/g, " ").trim(), b); });
  });
  var accessed = $("#rcAccessed");
  if (accessed) accessed.textContent = new Date().toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" });

  /* ---------- the library's filters ---------- */
  var cards = $$("#rcCards .rc-card");
  if (cards.length){
    var q = $("#rcQ"), topic = $("#rcTopic"), level = $("#rcLevel"), count = $("#rcCount"), empty = $("#rcEmpty");
    var typeOf = function(){ var r = $('input[name="rc-type"]:checked'); return r ? r.value : ""; };
    var run = function(){
      var t = typeOf(), tp = topic ? topic.value : "", lv = level ? level.value : "", n = 0;
      var words = (q ? q.value : "").toLowerCase().split(/\s+/).filter(Boolean);
      cards.forEach(function(c){
        var ok = (!t || c.getAttribute("data-type") === t) && (!tp || (" " + c.getAttribute("data-topics") + " ").indexOf(" " + tp + " ") >= 0) &&
          (!lv || c.getAttribute("data-level") === lv) && words.every(function(w){ return c.getAttribute("data-text").indexOf(w) >= 0; });
        c.hidden = !ok; if (ok) n++;
      });
      if (count) count.textContent = n === cards.length ? "Showing all " + n + " documents." : "Showing " + n + " of " + cards.length + " documents.";
      if (empty) empty.hidden = n > 0;
    };
    [q, topic, level].forEach(function(el){ if (el) el.addEventListener("input", run); });
    $$('input[name="rc-type"]').forEach(function(r){ r.addEventListener("change", run); });
    var clear = $("#rcClear");
    if (clear) clear.addEventListener("click", function(){
      if (q) q.value = ""; if (topic) topic.value = ""; if (level) level.value = "";
      var all = $('input[name="rc-type"][value=""]'); if (all) all.checked = true;
      run(); if (q) q.focus();
    });
    run();
  }

  /* ---------- the board packet ---------- */
  var go = $("#rcBoardGo"), form = $("#rcBoardForm"), msg = $("#rcBoardMsg");
  var FIELDS = ["facility", "preparedBy", "role", "meeting", "buildings", "residents", "hoursNow", "hoursWith", "hourlyCost"];
  var root = doc.body.getAttribute("data-root") || "";
  function script(src){
    return new Promise(function(ok, fail){
      var s = doc.createElement("script"); s.src = root + src;
      s.onload = ok; s.onerror = function(){ fail(new Error("this site's file " + src + " did not load")); };
      doc.head.appendChild(s);
    });
  }
  function kit(){
    var p = Promise.resolve();
    if (!window.CogniResearch) p = p.then(function(){ return script("assets/services/researchCenter.js"); });
    if (!(window.jspdf && window.jspdf.jsPDF)) p = p.then(function(){ return script("assets/vendor/jspdf.umd.min.js"); });
    return p.then(function(){ if (!window.jspdf.jsPDF.__atkinson) return script("assets/vendor/jspdf-atkinson.js"); });
  }
  function values(){ var o = {}; FIELDS.forEach(function(k){ var el = form && form.elements[k]; o[k] = el ? el.value : ""; }); return o; }
  if (form){
    var kept = load(BOARD) || {};
    FIELDS.forEach(function(k){ var el = form.elements[k]; if (el && typeof kept[k] === "string") el.value = kept[k]; });
    form.addEventListener("input", function(){ save(BOARD, values()); });
    form.addEventListener("submit", function(e){ e.preventDefault(); make(form.querySelector('button[type="submit"]')); });
    var wipe = $("#rcBoardClear");
    if (wipe) wipe.addEventListener("click", function(){
      form.reset(); try { localStorage.removeItem(BOARD); } catch (e){}
      say("The packet details are cleared from this browser.");
      if (form.elements.facility) form.elements.facility.focus();
    });
  }
  var busy = false;
  function make(btn){
    if (busy) return; busy = true;
    var label = btn.innerHTML; btn.setAttribute("aria-busy", "true"); btn.textContent = "Making the packet…";
    if (msg) msg.textContent = "";
    kit().then(function(){
      var R = window.CogniResearch, J = window.jspdf.jsPDF, input = R.normalizeBoard(values());
      var pdf = new J({ unit:"pt", format:"letter", orientation:"portrait", compress:true });
      var split = function(t, w, size, bold){ pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(size); return pdf.splitTextToSize(String(t), w); };
      var pages = R.boardPages(input, split);
      pages.forEach(function(pg, i){ if (i) pdf.addPage("letter", "portrait"); R.draw(pdf, pg); });
      pdf.setProperties({ title:"Cognicopia board packet" + (input.facility ? ": " + input.facility : ""), subject:"Evidence and value summary for a facility board", author:"Cognicopia", creator:"Cognicopia Clinical Science & Research Center" });
      pdf.save(R.boardFileName(input));
      if (msg) msg.textContent = "Your board packet is ready: " + pages.length + " pages, saved to this computer’s downloads.";
    }).catch(function(e){
      if (msg) msg.textContent = "The packet could not be made: " + e.message + ". Reload the page and try again.";
    }).then(function(){ busy = false; btn.removeAttribute("aria-busy"); btn.innerHTML = label; });
  }
  if (go) go.addEventListener("click", function(){ make(go); });
})();
