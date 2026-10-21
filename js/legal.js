/* =====================================================================
   Terms of Service and the non-medical disclaimer: the first-visit agreement.

   One small script, no network, no library. On the first visit to a tool page a bar at the foot of the window
   shows the disclaimer and an "I agree" button; the agreement is kept in this browser only
   (localStorage "cognicopia_eula_accepted" = "true"). Choosing "I agree" hides the bar for good on this computer.
   The bar never covers a printed page, and it is not shown on terms.html, where the same text is read in full.

   The text below is the owner's wording, word for word. scripts/check-terms.mjs compares it, letter for letter,
   with terms.html and the print footer in assets/vendor/jspdf-atkinson.js.
   ===================================================================== */
(function (root) {
  "use strict";
  var KEY = "cognicopia_eula_accepted";
  var HEADING = "Cognicopia Terms of Service & Disclaimer";
  var TEXT = "Cognicopia is an educational and cognitive enrichment activity tool designed for resident engagement. It does not provide medical diagnoses, clinical treatment, physical health evaluation, or medical advice. Cognicopia is not a medical device under FDA regulations. All activities and printed packets are intended solely for recreational and cognitive stimulation purposes under the supervision of senior living staff.";
  var PRINT_LINE = "Cognicopia Enrichment Activity — For Cognitive Engagement Only. Not Medical Advice.";

  function read() { try { return root.localStorage.getItem(KEY) === "true"; } catch (e) { return false; } }
  function write(on) {
    try { if (on) root.localStorage.setItem(KEY, "true"); else root.localStorage.removeItem(KEY); } catch (e) { /* private window: the bar simply shows again next visit */ }
  }

  var CSS = [
    "#cgLegal{position:fixed;left:0;right:0;bottom:0;z-index:1200;background:#10241a;color:#ffffff;border-top:4px solid #ffd477;",
    "box-shadow:0 -6px 24px rgba(0,0,0,.35);font:400 16px/1.5 'Atkinson Hyperlegible',system-ui,Arial,sans-serif;padding:14px 16px}",
    "#cgLegal .cgl-in{max-width:1100px;margin:0 auto;display:flex;gap:16px;align-items:center;flex-wrap:wrap}",
    "#cgLegal .cgl-txt{flex:1 1 420px;min-width:0;max-height:34vh;overflow:auto}",
    "#cgLegal .cgl-txt b{display:block;font-size:17px;margin:0 0 2px;color:#ffffff !important}",
    "#cgLegal .cgl-txt p{margin:0;max-width:none;color:#ffffff !important}",
    "#cgLegal a{display:inline-flex;align-items:center;min-height:52px;padding:0 6px;color:#ffd477 !important;text-decoration:underline;text-underline-offset:3px}",
    "#cgLegal .cgl-btns{display:flex;gap:12px;align-items:center;flex-wrap:wrap}",
    "#cgLegal button{min-width:52px;min-height:52px;padding:0 24px;border-radius:10px;border:2px solid #ffd477;background:#ffd477 !important;color:#10241a !important;font:700 17px/1 'Atkinson Hyperlegible',system-ui,Arial,sans-serif;cursor:pointer}",
    "#cgLegal button:hover{background:#ffe29a !important}",
    "#cgLegal button:focus-visible,#cgLegal a:focus-visible{outline:3px solid #ffffff;outline-offset:3px;box-shadow:0 0 0 6px #10241a}",
    "@media print{#cgLegal{display:none !important}}"
  ].join("");

  function bar() { return root.document.getElementById("cgLegal"); }

  function hide() {
    var b = bar(); if (b && b.parentNode) b.parentNode.removeChild(b);
    root.document.body.style.paddingBottom = root.document.body.getAttribute("data-cgl-pad") || "";
    root.document.documentElement.style.scrollPaddingBottom = "";
    root.document.body.removeAttribute("data-cgl-pad");
  }

  function show() {
    var d = root.document; if (!d.body || bar()) return;
    if (!d.getElementById("cgLegalCss")) { var st = d.createElement("style"); st.id = "cgLegalCss"; st.textContent = CSS; d.head.appendChild(st); }
    var b = d.createElement("section"); b.id = "cgLegal"; b.setAttribute("role", "region"); b.setAttribute("aria-label", HEADING);
    b.innerHTML = '<div class="cgl-in"><div class="cgl-txt"><b></b><p></p></div><div class="cgl-btns"><button type="button" id="cgLegalOk">I agree</button><a href="terms.html">Read the full terms</a></div></div>';
    b.querySelector("b").textContent = HEADING; b.querySelector("p").textContent = TEXT;
    d.body.appendChild(b);
    d.body.setAttribute("data-cgl-pad", d.body.style.paddingBottom || "");
    d.body.style.paddingBottom = (b.offsetHeight + 8) + "px";
    d.documentElement.style.scrollPaddingBottom = (b.offsetHeight + 16) + "px";          // a focused control scrolls clear of the bar, not under it
    d.getElementById("cgLegalOk").addEventListener("click", function () { write(true); hide(); });
  }

  var api = {
    KEY: KEY, HEADING: HEADING, TEXT: TEXT, PRINT_LINE: PRINT_LINE,
    accepted: read,
    accept: function () { write(true); hide(); },
    reset: function () { write(false); },
    show: show
  };
  root.CognicopiaLegal = api;

  function start() { if (!read() && !/(^|\/)terms\.html$/.test(root.location.pathname)) show(); }
  if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : this);
