/* =====================================================================
   The active care tier, as a color mode for the workspace.
   Sets data-cg-tier="1|2|3" on <html> from whichever level choice a page
   has (the Packet Builder's difficulty, the packet tool's and the tablet's
   level, the profile's support tier), so css/styles.css can color the
   workspace for Tier 1 (sapphire and indigo), Tier 2 (terracotta and
   sage) or Tier 3 (evergreen and muted gold). Nothing is stored or sent;
   it only reads what the page already shows.
   ===================================================================== */
(function () {
  "use strict";
  var MAP = { early: "1", mild: "1", "1": "1", middle: "2", moderate: "2", "2": "2", late: "3", advanced: "3", "3": "3" };
  var PICK = 'input[name="cfgDiff"]:checked, input[name="stage"]:checked, input[name="tier"]:checked';
  function stored() {
    try { var s = JSON.parse(localStorage.getItem("cgb_settings") || "null"); if (s && MAP[s.difficulty]) return MAP[s.difficulty]; } catch (e) { /* storage may be blocked */ }
    try { var t = JSON.parse(localStorage.getItem("cognicopia_tablet_prefs") || "null"); if (t && MAP[t.stage]) return MAP[t.stage]; } catch (e) { /* storage may be blocked */ }
    return "";
  }
  function sync() {
    var r = document.querySelector(PICK), tier = r && MAP[r.value] ? MAP[r.value] : stored(), root = document.documentElement;
    if (tier) { if (root.getAttribute("data-cg-tier") !== tier) root.setAttribute("data-cg-tier", tier); } else root.removeAttribute("data-cg-tier");
  }
  var queued = false;
  function later() { if (queued) return; queued = true; (window.requestAnimationFrame || setTimeout)(function () { queued = false; sync(); }); }
  document.addEventListener("change", later, true);
  window.addEventListener("hashchange", later);
  if (window.MutationObserver) new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true });
  sync();
})();
