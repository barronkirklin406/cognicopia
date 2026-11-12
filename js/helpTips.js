/* =====================================================================
   "How to use · Clinical tip": a 52 px button on the Activity Page Studio, the Packet Builder's home and the Facility
   Portal. It opens three plain steps for the screen and one clinical tip for the person sitting beside the resident.

   The tips are the vetted staff cues the packets already print (src/engine/ClinicalMatrix.js, CUES), chosen for the
   stage the screen is set to; "Another tip" moves to the next one. Nothing is stored and nothing is sent anywhere.
   Checked by scripts/check-help-dictation-ui.mjs.
   @global CogniHelpTips
   ===================================================================== */
(function (root) {
  "use strict";
  var doc = root.document; if (!doc || root.CogniHelpTips) return;
  var SELF = (doc.currentScript && doc.currentScript.src) || "", BASE = SELF.replace(/js\/helpTips\.js(\?.*)?$/, "");
  var TOPICS = {
    studio: { title: "How to use the Activity Page Studio", steps: [
      "Choose who it is for: a saved resident, or type a first name and the year they were born.",
      "Choose the stage and what to make. The page on the right is exactly what will print.",
      "Press Print all pages or Compile Packet PDF. Try different pages gives a fresh set." ] },
    builder: { title: "How to use the Packet Builder", steps: [
      "Start from a quick preset, or open By stage and ability to see only the activities made for a stage.",
      "Choose an activity: its settings and a preview open. Press Add to Packet.",
      "Open Your packet at the top to see every page, then print or download it." ] },
    facility: { title: "How to use the Facility Portal", steps: [
      "Overview shows each wing and its resident groups, by support tier.",
      "Open a wing's tab to plan its month. Auto-populate fills a balanced month of sessions, and every one can be changed.",
      "Directors also see Audit readiness and Team & audit, the facility's own records, kept on this computer." ] }
  };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var cmLoading = null;
  function matrix() {
    if (root.CognicopiaClinicalMatrix) return Promise.resolve(root.CognicopiaClinicalMatrix);
    if (!cmLoading) cmLoading = new Promise(function (res) { var s = doc.createElement("script"); s.src = BASE + "src/engine/ClinicalMatrix.js"; s.onload = function () { res(root.CognicopiaClinicalMatrix || null); }; s.onerror = function () { res(null); }; doc.head.appendChild(s); });
    return cmLoading;
  }
  var n = 0;
  /* put the button and its panel into a screen: after the first lede (or heading) inside box; once per box */
  function attach(box, key, opts) {
    var t = TOPICS[key]; opts = opts || {};
    if (!box || !t || box.querySelector(".ht")) return null;
    var id = "htPanel" + (++n), used = [];
    var wrap = doc.createElement("div"); wrap.className = "ht"; wrap.setAttribute("data-ht", key);
    wrap.innerHTML = '<button type="button" class="ht-pill" aria-expanded="false" aria-controls="' + id + '"><span aria-hidden="true" class="ht-i">i</span>How to use · Clinical tip</button>' +
      '<div class="ht-panel" id="' + id + '" role="region" aria-label="' + esc(t.title) + '" hidden><h2 class="ht-h">' + esc(t.title) + '</h2><ol class="ht-steps">' + t.steps.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + '</ol>' +
      '<h3 class="ht-h3">Clinical tip</h3><p class="ht-tip" aria-live="polite">…</p><div class="ht-btns"><button type="button" class="ht-more">Another tip</button></div>' +
      '<p class="ht-note">From the staff cues printed in the packets, for the stage this screen is set to. A support for your own judgment and the care plan, not medical advice.</p></div>';
    var at = box.querySelector(".lede, .asx-lede, .tbp-lede") || box.querySelector("h1");
    if (at && at.parentNode) at.parentNode.insertBefore(wrap, at.nextSibling); else box.insertBefore(wrap, box.firstChild);
    var pill = wrap.querySelector(".ht-pill"), panel = wrap.querySelector(".ht-panel"), tipEl = wrap.querySelector(".ht-tip");
    function stage() { try { return (opts.stage && opts.stage()) || "middle"; } catch (e) { return "middle"; } }
    function nextTip() {
      return matrix().then(function (CM) {
        if (!CM || !CM.cue) { tipEl.textContent = "Offer a choice of two, and wait ten slow seconds before helping."; return; }
        var c = CM.cue({ stage: stage(), kind: "any", name: "the resident", used: used, rng: { pick: function (a) { return a[Math.floor(Math.random() * a.length)]; } } });
        if (!c) { used = []; c = CM.cue({ stage: stage(), kind: "any", name: "the resident" }); }
        if (c) { used.push(c.raw); tipEl.textContent = String(c.text).replace(/^Clinical Tip:\s*/, ""); }
      });
    }
    pill.addEventListener("click", function () {
      var open = panel.hidden; panel.hidden = !open; pill.setAttribute("aria-expanded", String(open));
      if (open && tipEl.textContent === "…") nextTip();
    });
    wrap.querySelector(".ht-more").addEventListener("click", nextTip);
    return { el: wrap, next: nextTip };
  }
  root.CogniHelpTips = Object.freeze({ attach: attach, topics: Object.keys(TOPICS) });
})(typeof window !== "undefined" ? window : this);
