/* =====================================================================
   Inactivity timeout: a screen left open on a shared computer does not stay open.

   After 15 minutes with no mouse movement, key, click, touch or scroll (the scroll check is throttled to one a second),
   the page
     1. clears what is only on the screen: the packet tool's and the profile form's unsaved drafts, and the one resident chosen for
        this tab (sessionStorage "cgb_active_resident"),
     2. locks the saved residents again when the facility has chosen a passphrase (CogniSecureStore.lock), and
     3. returns to the start: the Packet Builder's home screen, or the packet tool's front page for the profile form,
     then says, in a notice at the foot of the window:
        "Session timed out due to 15 minutes of inactivity to protect resident privacy."

   It deletes nothing that was saved: the roster, the profiles, the license and the free-packet count stay as they were.
   No network, no library. scripts/check-session-timeout.mjs proves it with a short limit set through setLimit().
   ===================================================================== */
(function (root) {
  "use strict";
  var DEFAULT_MS = 15 * 60 * 1000;
  var MESSAGE = "Session timed out due to 15 minutes of inactivity to protect resident privacy.";
  var NOTICE = "cgb_session_timeout_notice", ACTIVE = "cgb_active_resident";
  var DRAFTS = ["cognicopia_packet_draft", "cognicopia_profile_draft"];
  var limit = DEFAULT_MS, timer = 0, lastScroll = 0, count = 0;

  function safe(fn) { try { return fn(); } catch (e) { return undefined; } }
  function store() { return safe(function () { return root.CogniSecureStore && root.CogniSecureStore.storage ? root.CogniSecureStore.storage : root.localStorage; }); }

  function page() {
    var p = root.location.pathname.replace(/\/+$/, "");
    return /builder\.html$/.test(p) ? "builder" : /profile\.html$/.test(p) ? "profile" : "front";
  }

  /* what is only on the screen goes; what was saved stays */
  function clearTransient() {
    var s = store(); DRAFTS.forEach(function (k) { safe(function () { if (s) s.removeItem(k); }); });
    safe(function () { root.sessionStorage.removeItem(ACTIVE); });
  }
  function relock() {
    var S = root.CogniSecureStore;
    if (!S || !S.status || !S.lock) return;
    var st = safe(function () { return S.status(); });
    if (st && st.passphrase) safe(function () { S.lock(); });
  }

  function expire() {
    timer = 0; count++;
    clearTransient(); relock();
    safe(function () { root.sessionStorage.setItem(NOTICE, "1"); });
    var go = function () {
      var where = page();
      if (where === "builder") { safe(function () { root.location.hash = "#/"; }); root.location.reload(); }
      else if (where === "profile") root.location.replace("index.html");
      else root.location.reload();
    };
    /* the sealed store writes in the background: let the cleared drafts reach it before the page goes */
    var f = safe(function () { return root.CogniSecureStore && root.CogniSecureStore.flush ? root.CogniSecureStore.flush() : null; });
    Promise.resolve(f).then(go, go);
  }

  function restart() { if (timer) root.clearTimeout(timer); timer = root.setTimeout(expire, limit); }
  function activity(e) {
    if (e && e.type === "scroll") { var now = Date.now(); if (now - lastScroll < 1000) return; lastScroll = now; }
    restart();
  }

  /* the notice: its own small element, so it does not depend on any page's toast */
  function notice() {
    var d = root.document; if (!d.body || d.getElementById("cgTimeoutNote")) return;
    var st = d.createElement("style");
    st.textContent = "#cgTimeoutNote{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:1500;max-width:min(640px,92vw);padding:14px 20px;border-radius:12px;background:#10241a;color:#ffffff;border:2px solid #ffd477;font:600 17px/1.45 'Atkinson Hyperlegible',system-ui,Arial,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.4)}@media print{#cgTimeoutNote{display:none !important}}";
    d.head.appendChild(st);
    var n = d.createElement("div"); n.id = "cgTimeoutNote"; n.setAttribute("role", "status"); n.setAttribute("aria-live", "polite"); n.textContent = MESSAGE;
    d.body.appendChild(n);
    root.setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 12000);
  }

  function start() {
    ["mousemove", "keydown", "click", "touchstart"].forEach(function (t) { root.addEventListener(t, activity, { passive: true, capture: true }); });
    root.addEventListener("scroll", activity, { passive: true, capture: true });
    restart();
    var flagged = safe(function () { return root.sessionStorage.getItem(NOTICE); });
    if (flagged) { safe(function () { root.sessionStorage.removeItem(NOTICE); }); notice(); }
  }

  root.CognicopiaSession = {
    MESSAGE: MESSAGE, DEFAULT_MS: DEFAULT_MS,
    setLimit: function (ms) { limit = Math.max(200, +ms || DEFAULT_MS); restart(); },    // for the check; the page keeps 15 minutes
    expiredCount: function () { return count; },
    expireNow: expire
  };
  if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : this);
