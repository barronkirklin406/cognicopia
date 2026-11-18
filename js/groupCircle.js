/* =====================================================================
   Group circle: a leader's script for a small group, on Daily engagement. Choose two to eight saved residents and a theme; the script
   gives each person something to talk about at their own stage, by name, from the years they were about twenty (the same era bank
   and the same invitations the Activity Page Studio uses), and keeps off the circle anything ANY of them avoids: if one person's
   topics to avoid rule a thing out, it is out for everyone.

   It is for the person leading, on one staff page (16 pt and larger, pure black on white). Every line invites and none tests. Nothing
   is stored and nothing is sent; the names come from the resident records on this computer and are printed only on the page made.
   Checked by scripts/check-group-circle-ui.mjs.
   @global CogniGroupCircle
   ===================================================================== */
(function (root) {
  "use strict";
  if (root.CogniGroupCircle) return;
  var E = function () { return root.CognicopiaActivityEngine; }, R = function () { return root.CogniResident; };
  var OPENING = "Welcome everyone. Go around the circle one person at a time. Say each line gently, then wait and follow wherever the person takes it.";
  var CLOSING = "Thank everyone for sharing. A smile, a hum or a held hand is taking part.";
  var QUIET = "Let’s enjoy a quiet moment together.";
  var cap = function (s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function themes() { var K = E().kit; return K.KIND_ORDER.map(function (k) { return { id: k, label: K.KIND_LABEL[k] }; }); }

  /* members: [{ who, person }] (person from CogniResident.person); o: { theme, turn }.
     -> { theme, themeLabel, avoid (the words kept off, written out), items: [{ who, stage, prompt, sense, thing }], opening, closing, blocked } */
  function build(members, o) {
    o = o || {}; var K = E().kit, theme = K.KIND_ORDER.indexOf(o.theme) >= 0 ? o.theme : K.KIND_ORDER[0], turn = Math.max(0, Math.round(o.turn || 0));
    var avoid = []; members.forEach(function (m) { ((m.person && m.person.avoid && m.person.avoid.words) || []).forEach(function (w) { if (avoid.indexOf(w) < 0) avoid.push(w); }); });
    var match = R().avoidMatcher(avoid), label = K.KIND_LABEL[theme], blocked = !!match(label).length, used = {};
    var items = members.map(function (m, i) {
      var p = m.person || {}, stage = Math.max(1, Math.min(3, Math.round(p.stage) || 2)), decade = K.decadeFor(p.born || 0), bank = blocked ? [] : (K.ERA[decade][theme] || []).filter(function (t) { return !match(t).length; });
      var thing = "", n = bank.length;
      for (var k = 0; k < n; k++) { var cand = bank[(i + turn + k) % n]; if (!used[cand]) { thing = cand; break; } }
      if (!thing && n) thing = bank[(i + turn) % n];
      if (thing) used[thing] = 1;
      var tpls = K.INVITE[stage][theme], line = thing ? tpls[(i + turn) % tpls.length].replace("{t}", stage === 3 ? cap(thing) : thing) : QUIET;
      return { who: m.who, stage: stage, thing: thing, prompt: line, sense: thing && stage === 3 ? K.SENSE[theme] : "" };
    });
    return { theme: theme, themeLabel: label, avoid: avoid.map(cap), items: items, opening: OPENING, closing: CLOSING, blocked: blocked };
  }
  /* the staff page */
  function pageHtml(c, o) {
    o = o || {};
    var li = c.items.map(function (it) { return "<li><b>" + esc(it.who) + ":</b> “" + esc(it.prompt) + "”" + (it.sense ? " " + esc(it.sense) : "") + "</li>"; }).join("");
    return '<div class="cg-staff-sheet"><p class="cg-calm-kick">Group circle</p><h1>' + esc(c.themeLabel) + "</h1>" + (o.facility ? "<p>" + esc(o.facility) + "</p>" : "") +
      "<section><h3>Before you start</h3><p>" + esc(c.opening) + "</p></section>" +
      "<section><h3>Around the circle</h3><ol>" + li + "</ol></section>" +
      '<section class="cg-calm-avoid"><h3>Kept off this circle</h3><p>' + (c.avoid.length ? esc(c.avoid.join(", ")) + "." : "Nothing is listed.") + "</p></section>" +
      "<section><h3>To finish</h3><p>" + esc(c.closing) + '</p></section><p class="cg-calm-foot">Staff page · Cognicopia</p></div>';
  }
  root.CogniGroupCircle = Object.freeze({ themes: themes, build: build, pageHtml: pageHtml, OPENING: OPENING, CLOSING: CLOSING });
})(typeof window !== "undefined" ? window : this);
