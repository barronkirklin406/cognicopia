/* =====================================================================
   Calm now: one click on a resident, for the person who is with them when they are upset. A dialog for staff (and one printed page)
   that holds what is already known about them, so nobody has to remember it in the moment:

     comforts and favorites   their comforts and a favorite dish, from their profile
     safe things to talk about  their interests, hobbies and hometown
     avoid right now          their topics to avoid, written out
     what to say              a few lines that ask nothing of them (from the calming set in src/engine/SoothingContent.js)
     songs of their years     titles, artists and years only: no words are printed here
     the line that matters    if they may be unwell, in pain or unsafe, follow the facility's own protocol

   Nothing here asks for an answer, and nothing is a finding. It is read from the resident's record on this computer; nothing is stored
   and nothing is sent. Late-stage Daily cards and Studio screens also use holdFor(): one thing to put in their hands, from the
   reminiscence engine's vetted list, with its safety line.
   Checked by scripts/check-calm-now-ui.mjs.
   @global CogniCalmNow
   ===================================================================== */
(function (root) {
  "use strict";
  var doc = root.document; if (!doc || root.CogniCalmNow) return;
  var SELF = (doc.currentScript && doc.currentScript.src) || "", BASE = SELF.replace(/js\/calmNow\.js(\?.*)?$/, "");
  var PROTOCOL = "If they may be unwell, in pain or unsafe, follow your facility’s own protocol and call the nurse.";
  var LEDE = "Sit beside them, lower your voice and slow down. Ask nothing of them; a few quiet lines are enough.";
  var SAY = ["g09", "g11", "g08", "g07"];               // "You are safe here. Someone is beside you." and three more that ask nothing
  var loading = {};
  function script(src) {
    if (loading[src]) return loading[src];
    return (loading[src] = new Promise(function (res) { var s = doc.createElement("script"); s.src = BASE + src; s.onload = function () { res(true); }; s.onerror = function () { res(false); }; doc.head.appendChild(s); }));
  }
  function ready() {
    var p = Promise.resolve(true);
    [["CogniSecureStore", "assets/services/secureStore.js"], ["CogniResident", "js/residentContext.js"], ["CogniReminiscence", "assets/services/reminiscenceEngine.js"], ["CognicopiaSoothingContent", "src/engine/SoothingContent.js"]].forEach(function (x) {
      if (!root[x[0]]) p = p.then(function () { return script(x[1]); });
    });
    return p.then(function () { return !!(root.CogniSecureStore && root.CogniSecureStore.storage && root.CogniResident && root.CogniReminiscence); });
  }
  var uniq = function (a) { var seen = {}, out = []; a.forEach(function (x) { var k = String(x).toLowerCase(); if (x && !seen[k]) { seen[k] = 1; out.push(x); } }); return out; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  /* a plain model from a saved resident record (the profile) */
  function model(profile, who) {
    var R = root.CogniResident, RE = root.CogniReminiscence, SC = root.CognicopiaSoothingContent, w = R.person(profile), match = R.avoidMatcher(w.avoid.words || []);
    var ok = function (t) { return !match(String(t)).length; };
    var comforts = w.comforts.filter(ok).slice(0, 4), dish = w.dish && w.dish.name && ok(w.dish.name) ? w.dish.name : "";
    var topics = uniq(w.interests.concat(w.hobbies, w.hometown && w.hometown.town ? ["Where they grew up: " + w.hometown.town] : [])).filter(ok).slice(0, 4);
    var from = w.born ? w.born + 15 : 0, to = w.born ? w.born + 25 : 0, favorite = w.music.favoriteSong && ok(w.music.favoriteSong) ? [w.music.favoriteSong] : [];
    var songs = (RE.SONGS || []).filter(function (s) { return s.year > 1900 && (!from || (s.year >= from - 4 && s.year <= to + 4)) && ok(s.title + " " + s.artist); }).slice(0, 3).map(function (s) { return s.title + ", " + s.artist + " (" + s.year + ")"; });
    var say = (SC && SC.GROUNDING ? SAY.map(function (id) { var g = SC.GROUNDING.filter(function (x) { return x.id === id; })[0]; return g ? g.text : ""; }).filter(Boolean) : ["You are safe here. Someone is beside you.", "Take all the time you like."]);
    var avoidNow = uniq(w.avoid.names.concat(w.avoid.people || [], w.avoid.places || [], w.avoid.other || [])).slice(0, 12).map(function (x) { return String(x).charAt(0).toUpperCase() + String(x).slice(1); });
    return { who: who || w.name || "Resident", comforts: comforts, dish: dish, topics: topics, avoidNow: avoidNow, say: say, songs: uniq(favorite.concat(songs)).slice(0, 4), protocol: PROTOCOL, lede: LEDE };
  }
  /* the dialog's body and the printed page share one body */
  function body(m) {
    var ul = function (a, none) { return a.length ? "<ul>" + a.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "<p>" + esc(none) + "</p>"; };
    return "<p class=\"cg-calm-lede\">" + esc(m.lede) + "</p>" +
      "<section><h3>Comforts and favorites</h3>" + ul(m.comforts.concat(m.dish ? ["A favorite dish: " + m.dish] : []), "None are recorded yet. A cup of tea, a soft blanket and a quiet room are a good start.") + "</section>" +
      "<section><h3>Safe things to talk about</h3>" + ul(m.topics, "None are recorded yet. Describe what you can see together instead.") + "</section>" +
      "<section class=\"cg-calm-avoid\"><h3>Avoid right now</h3>" + ul(m.avoidNow, "Nothing is listed. Follow their lead.") + "</section>" +
      "<section><h3>What to say</h3><ul>" + m.say.map(function (x) { return "<li>“" + esc(x) + "”</li>"; }).join("") + "</ul></section>" +
      "<section><h3>Songs of their years</h3>" + ul(m.songs, "None are recorded yet. Hum something slow and familiar.") + "</section>" +
      "<p class=\"cg-calm-protocol\"><b>" + esc(m.protocol) + "</b></p>";
  }
  function sheetHtml(m) { return '<div class="cg-staff-sheet"><p class="cg-calm-kick">Calm now</p><h1>' + esc(m.who) + "</h1>" + body(m) + '<p class="cg-calm-foot">Staff page · Cognicopia</p></div>'; }

  var dlg = null, opener = null;
  function dialog() {
    if (dlg) return dlg;
    dlg = doc.createElement("dialog"); dlg.className = "cg-calm"; dlg.setAttribute("aria-labelledby", "cgCalmH");
    dlg.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("button"); if (!t) return;
      if (t.hasAttribute("data-calm-close")) dlg.close();
      if (t.hasAttribute("data-calm-print")) printPage();
      if (t.hasAttribute("data-calm-queue")) queuePage();
    });
    dlg.addEventListener("close", function () { if (opener && opener.focus && doc.contains(opener)) opener.focus(); });
    doc.body.appendChild(dlg); return dlg;
  }
  var current = null;
  function printPage() {
    if (!current) return;
    /* the site's print style sheet prints only #printRoot where a page has one (the Studio, Daily engagement, the Packet Builder): the page
       goes in there for the moment and the old contents come back; a page without one gets a print host of its own */
    var pr = doc.getElementById("printRoot"), host = pr, saved = pr ? pr.innerHTML : "", cls = pr ? "cg-calm-printing" : "cg-calm-printing cg-calm-own";
    if (!host) { host = doc.getElementById("cgCalmPrint"); if (!host) { host = doc.createElement("div"); host.id = "cgCalmPrint"; host.setAttribute("aria-hidden", "true"); doc.body.appendChild(host); } }
    host.innerHTML = sheetHtml(current); cls.split(" ").forEach(function (c) { doc.documentElement.classList.add(c); });
    var done = function () { cls.split(" ").forEach(function (c) { doc.documentElement.classList.remove(c); }); if (pr) pr.innerHTML = saved; root.removeEventListener("afterprint", done); };
    root.addEventListener("afterprint", done);
    root.print();
  }
  /* Add to the packet: the card goes into the Packet Builder's packet queue as a staff page (js/studioQueue.js, loaded when it is needed). A staff page spends no
     free packet: a queue made only of staff pages prints and spends nothing. */
  function queuePage() {
    if (!current) return;
    var d = dialog(), msg = d.querySelector(".cg-calm-qmsg"), who = current.who, html = sheetHtml(current);
    var go = function () {
      var Q = root.CogniStudioQueue, n = Q ? Q.addCalm(html, { residentName: who, title: "Calm now: " + who }) : 0;
      if (msg) msg.textContent = n ? "Added to the packet as a staff page. Print it from the packet in the Packet Builder; if that is open in another tab, reload it first." : "The card could not be added. Try again.";
    };
    if (root.CogniStudioQueue) go(); else script("js/studioQueue.js").then(go);
  }
  /* open the dialog for a saved resident (id), named as the screen names them (who) */
  function open(id, who, from) {
    opener = from || doc.activeElement;
    return ready().then(function (ok) {
      var d = dialog();
      if (!ok) { d.innerHTML = '<h2 id="cgCalmH">Calm now</h2><p>The record could not be opened on this computer.</p><div class="cg-calm-btns"><button type="button" data-calm-close>Close</button></div>'; if (!d.open) d.showModal(); return null; }
      var raw = null; try { raw = JSON.parse(root.CogniSecureStore.storage.getItem("cognicopia_resident_" + id) || "null"); } catch (e) { raw = null; }
      if (!raw) { d.innerHTML = '<h2 id="cgCalmH">Calm now</h2><p>That resident could not be found on this computer.</p><div class="cg-calm-btns"><button type="button" data-calm-close>Close</button></div>'; if (!d.open) d.showModal(); return null; }
      current = model(raw, who);
      d.innerHTML = '<h2 id="cgCalmH">Calm now: ' + esc(current.who) + "</h2>" + body(current) + '<p class="cg-calm-qmsg" role="status"></p><div class="cg-calm-btns"><button type="button" data-calm-print>Print one page</button><button type="button" data-calm-queue>Add to the packet</button><button type="button" data-calm-close>Close</button></div>';
      if (!d.open) d.showModal();
      var head = d.querySelector("#cgCalmH"); if (head) { head.tabIndex = -1; head.focus(); d.scrollTop = 0; }
      return current;
    });
  }
  /* one thing to put in their hands for the late stage, with the safety line: { items, safety } from the reminiscence engine's vetted list.
     profile may be null (a group): then it is the engine's plain late-stage choice. */
  function holdFor(profile, seed) {
    var RE = root.CogniReminiscence; if (!RE || !RE.deck) return null;
    var p = profile || { tier1_core: { cognitiveTier: 3 }, tier2_enrichment: {}, tier3_deep: {} };
    try { var c = RE.deck(p, { count: 1, seed: String(seed || "hold") }).cards[0]; return c ? { title: c.title, items: c.touch.items, prompt: c.touch.prompt, safety: c.touch.safety } : null; } catch (e) { return null; }
  }
  root.CogniCalmNow = Object.freeze({ PROTOCOL: PROTOCOL, ready: ready, model: model, open: open, holdFor: holdFor, sheetHtml: sheetHtml });
})(typeof window !== "undefined" ? window : this);
