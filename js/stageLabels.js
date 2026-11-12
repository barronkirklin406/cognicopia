/* =====================================================================
   How the three stages are named on staff screens: the roster, the Activity Page Studio, Daily engagement, the profile and the
   active resident bar. A choice in the Packet Builder's Settings:

     default  each screen as it was made (the Studio says "Stage 2", the Builder says "Tier 2 · Moderate · GDS 5")
     stage    Stage 1, Stage 2, Stage 3
     acl      ACL 5, ACL 4, ACL 3 (the Allen Cognitive Levels that usually sit beside mild, moderate and advanced)
     gds      GDS 3-4, GDS 5, GDS 6-7 (the Global Deterioration Scale ranges the care rulebook already uses)

   A label is not an assessment. The three stages are set by the person's care team; the ACL and GDS numbers here are only the
   usual rough match, shown the way the team writes them, and never on a page a resident reads. The choice is a display
   preference only (it holds no resident's information) and is kept on this computer in localStorage, "cognicopia_stage_label".
   Nothing is sent anywhere. Checked by scripts/check-stage-labels-ui.mjs.
   @global CogniStage
   ===================================================================== */
(function (root) {
  "use strict";
  if (root.CogniStage) return;
  var KEY = "cognicopia_stage_label";
  var MODES = [["default", "Each screen as it is"], ["stage", "Stage 1, 2, 3"], ["acl", "ACL 5, 4, 3"], ["gds", "GDS 3–4, 5, 6–7"]];
  var NAME = { 1: "Mild", 2: "Moderate", 3: "Advanced" };
  var TAG = { stage: { 1: "Stage 1", 2: "Stage 2", 3: "Stage 3" }, acl: { 1: "ACL 5", 2: "ACL 4", 3: "ACL 3" }, gds: { 1: "GDS 3–4", 2: "GDS 5", 3: "GDS 6–7" } };
  var EARLY = { 1: "early stage", 2: "middle stage", 3: "late stage" };
  function mode() { try { var m = root.localStorage.getItem(KEY); return TAG[m] ? m : "default"; } catch (e) { return "default"; } }
  function setMode(m) {
    var v = TAG[m] ? m : "default";
    try { if (v === "default") root.localStorage.removeItem(KEY); else root.localStorage.setItem(KEY, v); } catch (e) { /* kept for this page only */ }
    try { root.document.documentElement.setAttribute("data-stage-label", v); root.dispatchEvent(new root.CustomEvent("cg-stage-label", { detail: { mode: v } })); } catch (e) { /* no page */ }
    return v;
  }
  function n3(n) { n = Math.round(Number(n)); return n >= 1 && n <= 3 ? n : 0; }
  /* the short label for a stage: what the screen would have said (fallback), or the chosen scale */
  function tag(n, fallback) { n = n3(n); var m = mode(); return n && m !== "default" ? TAG[m][n] : (fallback != null ? fallback : n ? TAG.stage[n] : ""); }
  /* "Moderate", "Mild", "Advanced" */
  function name(n) { return NAME[n3(n)] || ""; }
  /* "Stage 2 · Moderate", "ACL 4 · Moderate", "GDS 5 · Moderate" */
  function full(n, fallback) { n = n3(n); if (!n) return fallback || ""; var m = mode(); return m === "default" && fallback != null ? fallback : tag(n) + " · " + NAME[n]; }
  /* the words for the care line: "early stage" by default, or the scale's label when one is chosen */
  function phrase(n) { n = n3(n); var m = mode(); return !n ? "" : m === "default" ? EARLY[n] : TAG[m][n]; }
  /* a screen's own words (a radio's label, say) marked data-stage-tier="1".."3" follow the choice; the first wording is kept to bring back */
  function applyDom(scope) {
    var d = (scope || root.document); if (!d || !d.querySelectorAll) return;
    Array.prototype.forEach.call(d.querySelectorAll("[data-stage-tier]"), function (el) {
      var n = n3(el.getAttribute("data-stage-tier")); if (!n) return;
      if (el.getAttribute("data-stage-was") == null) el.setAttribute("data-stage-was", el.textContent);
      el.textContent = mode() === "default" ? el.getAttribute("data-stage-was") : "Tier " + n + " \u00B7 " + NAME[n] + " \u00B7 " + tag(n);
    });
  }
  root.CogniStage = Object.freeze({ KEY: KEY, MODES: MODES, mode: mode, setMode: setMode, tag: tag, name: name, full: full, phrase: phrase, applyDom: applyDom });
  if (root.document) {
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", function () { applyDom(); }); else applyDom();
    root.addEventListener("cg-stage-label", function () { applyDom(); });
  }
  try { root.document.documentElement.setAttribute("data-stage-label", mode()); } catch (e) { /* no page */ }
})(typeof window !== "undefined" ? window : this);
