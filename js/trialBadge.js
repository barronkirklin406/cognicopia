/* =====================================================================
   The free-trial badge: "Free Trial: 24 / 25 Generations Remaining", live, in the action bar under the navigation on every page
   that has one (an element marked data-cg-trial; scripts/site-nav.mjs writes it) and in the packet tool's wood bar.

   The count is the trial ledger's (assets/services/trialLedger.js: packets used, kept in the page's storage and two backups, so clearing
   one setting does not hand the free packets back). This only shows it: remaining = FREE_RUNS minus used. It follows every packet made
   (the ledger's "cognicopia:trial" event), a change in another tab, and a license (a licensed facility sees no badge).

   The remaining number is also kept in localStorage under cognicopia_trial_generations (25 on a first visit) so another page or a
   person's own script can read it; it is never the source of truth and never raises what the ledger holds. Nothing leaves the page.
   ===================================================================== */
(function (root) {
  "use strict";
  var KEY = "cognicopia_trial_generations";
  var d = root.document;
  if (!d) return;

  function total() { var c = root.CognicopiaLicenseConfig; return (c && c.FREE_RUNS) || 25; }
  function store() {
    if (root.CG_LS) return root.CG_LS;                                   // the packet tool's and the builder's own (sealed) storage
    if (root.CogniSecureStore && root.CogniSecureStore.storage) return root.CogniSecureStore.storage;
    try { return root.localStorage; } catch (e) { return null; }
  }
  var ledger = null;
  function used() {
    try {
      if (!ledger && root.CogniTrialLedger) { var s = store(); if (s) ledger = root.CogniTrialLedger.forBrowser(s); }
      if (ledger) return ledger.count();
      var v = parseInt(root.localStorage.getItem("cognicopia_gen_count"), 10);
      return isFinite(v) && v > 0 ? v : 0;
    } catch (e) { return 0; }
  }
  function licensed() { try { return !!(root.CognicopiaLicense && root.CognicopiaLicense.isLicensed()); } catch (e) { return false; } }

  var ZAP = '<svg class="cg-trial-ic" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>';
  function paint() {
    var n = total(), left = Math.max(0, n - used());
    try { root.localStorage.setItem(KEY, String(left)); } catch (e) { /* no storage: the badge still shows */ }
    var els = d.querySelectorAll("[data-cg-trial]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (licensed()) {
        el.hidden = true;
        if (el.closest) { var wrap = el.closest(".cgw-trial-wrap"); if (wrap) wrap.hidden = true; }
        continue;
      }
      if (el.closest) { var wrap = el.closest(".cgw-trial-wrap"); if (wrap) wrap.hidden = false; }
      el.hidden = false;
      el.className = "cg-trial" + (left === 0 ? " cg-trial-out" : left <= 5 ? " cg-trial-low" : "");
      el.setAttribute("role", "status");
      el.innerHTML = ZAP + '<span>Free Trial: <b>' + left + ' / ' + n + '</b> Generations Remaining</span>';
    }
  }
  root.CognicopiaTrialBadge = { paint: paint, remaining: function () { return Math.max(0, total() - used()); } };

  var RESET_KEY = "cognicopia_trial_reset_time";
  var CYCLE_MS = 7 * 24 * 60 * 60 * 1000;                               // 7-day automatic weekly reset

  function checkWeeklyReset() {
    try {
      var now = Date.now();
      var raw = root.localStorage ? root.localStorage.getItem(RESET_KEY) : null;
      var lastReset = raw ? parseInt(raw, 10) : 0;
      if (!lastReset || isNaN(lastReset) || (now - lastReset) >= CYCLE_MS) {
        if (root.localStorage) {
          root.localStorage.setItem(RESET_KEY, String(now));
          root.localStorage.setItem("cognicopia_gen_count", "0");
          root.localStorage.setItem(KEY, String(total()));
        }
        var s = store();
        if (s) {
          try { s.setItem(RESET_KEY, String(now)); } catch(e){}
          try { s.setItem("cognicopia_gen_count", "0"); } catch(e){}
          try { s.setItem(KEY, String(total())); } catch(e){}
        }
        try { if (root.indexedDB) root.indexedDB.deleteDatabase("cg_trial"); } catch(e){}
        try { if (root.caches) root.caches.delete("cg-trial-v1"); } catch(e){}
        if (d && typeof d.dispatchEvent === "function") {
          d.dispatchEvent(new CustomEvent("cognicopia:trial", { detail: { used: 0 } }));
        }
      }
    } catch (e) { /* ignore */ }
  }

  function start() {
    checkWeeklyReset();
    try { if (root.localStorage.getItem(KEY) === null) root.localStorage.setItem(KEY, String(total())); } catch (e) { /* ignore */ }
    paint();
    d.addEventListener("cognicopia:trial", paint);
    d.addEventListener("cognicopia:license", paint);
    root.addEventListener("storage", paint);
    if (root.CogniTrialLedger) { try { var s = store(); if (s) { ledger = ledger || root.CogniTrialLedger.forBrowser(s); ledger.ready().then(paint, function () {}); } } catch (e) { /* ignore */ } }
    setTimeout(paint, 600); setTimeout(paint, 2500);                       // a sealed store opens a moment after the page does
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
