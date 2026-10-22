/* =====================================================================
   Terms of Service and the non-medical disclaimer: the first-visit agreement.

   One small script, no network, no library. On the first visit to a tool page a bar at the foot of the window
   shows the disclaimer and an "I agree" button; the agreement is kept in this browser only
   (localStorage "cognicopia_eula_accepted" = "true"). Choosing "I agree" hides the bar for good on this computer.
   The bar never covers a printed page, and it is not shown on terms.html, where the same text is read in full.

   The footer's "Terms of Service & Disclaimer" link (any link marked data-cg-terms) opens the same text in a window on demand, with a short
   summary and a link to the full page. Pages that carry only that link load this script with data-bar="off": the first-visit bar is then
   never shown there.

   The text below is the owner's wording, word for word. scripts/check-terms.mjs compares it, letter for letter,
   with terms.html and the print footer in assets/vendor/jspdf-atkinson.js.
   ===================================================================== */
(function (root) {
  "use strict";
  if (root.CognicopiaLegal) return;                       // a page that asks for the script twice gets it once
  var me = root.document && root.document.currentScript, BAR_OFF = !!(me && me.getAttribute("data-bar") === "off");
  var KEY = "cognicopia_eula_accepted";
  var HEADING = "Cognicopia Terms of Service & Disclaimer";
  var TEXT = "Cognicopia is an educational and cognitive enrichment activity tool designed for resident engagement. It does not provide medical diagnoses, clinical treatment, physical health evaluation, or medical advice. Cognicopia is not a medical device under FDA regulations. All activities and printed packets are intended solely for recreational and cognitive stimulation purposes under the supervision of senior living staff.";
  /* What the full page says, in four short lines (terms.html holds each in full). */
  var SUMMARY = [
    ["Not medical or clinical", "Cognicopia is an educational and cognitive enrichment tool. It does not diagnose, treat or advise, and it is not a medical device."],
    ["Resident details stay on your computer", "Names and notes are kept only in the browser on the computer where they were typed. No resident data leaves the device."],
    ["Used with staff nearby", "It is made for recreation and engagement under the supervision of facility staff or family."],
    ["Printing and copyright", "Cognicopia is copyright BarronCrafts. A license lets a facility print and use its pages for its own residents."]
  ];
  var PRINT_LINE = "Cognicopia Enrichment Activity — For Cognitive Engagement Only. Not Medical Advice.";

  function read() { try { return root.localStorage.getItem(KEY) === "true"; } catch (e) { return false; } }
  function write(on) {
    try { if (on) root.localStorage.setItem(KEY, "true"); else root.localStorage.removeItem(KEY); } catch (e) { /* private window: the bar simply shows again next visit */ }
  }

  var CSS = [
    "#cgLegal{position:fixed;left:0;right:0;bottom:0;z-index:1200;background:#08262c;color:#ffffff;border-top:4px solid #ffd477;",
    "box-shadow:0 -6px 24px rgba(0,0,0,.35);font:400 16px/1.5 'Atkinson Hyperlegible',system-ui,Arial,sans-serif;padding:14px 16px}",
    "#cgLegal .cgl-in{max-width:1100px;margin:0 auto;display:flex;gap:16px;align-items:center;flex-wrap:wrap}",
    "#cgLegal .cgl-txt{flex:1 1 420px;min-width:0;max-height:34vh;overflow:auto}",
    "#cgLegal .cgl-txt b{display:block;font-size:17px;margin:0 0 2px;color:#ffffff !important}",
    "#cgLegal .cgl-txt p{margin:0;max-width:none;color:#ffffff !important}",
    "#cgLegal a{display:inline-flex;align-items:center;min-height:52px;padding:0 6px;color:#ffd477 !important;text-decoration:underline;text-underline-offset:3px}",
    "#cgLegal .cgl-btns{display:flex;gap:12px;align-items:center;flex-wrap:wrap}",
    "#cgLegal button{min-width:52px;min-height:52px;padding:0 24px;border-radius:10px;border:2px solid #ffd477;background:#ffd477 !important;color:#08262c !important;font:700 17px/1 'Atkinson Hyperlegible',system-ui,Arial,sans-serif;cursor:pointer}",
    "#cgLegal button:hover{background:#ffe29a !important}",
    "#cgLegal button:focus-visible,#cgLegal a:focus-visible{outline:3px solid #ffffff;outline-offset:3px;box-shadow:0 0 0 6px #08262c}",
    "#cgLegalModal{width:min(640px,calc(100vw - 24px));max-height:calc(100vh - 24px);padding:0;border:3px solid #08262c;border-radius:14px;background:#ffffff;color:#08262c;font:400 17px/1.55 'Atkinson Hyperlegible',system-ui,Arial,sans-serif}",
    "#cgLegalModal::backdrop{background:rgba(0,0,0,.6)}",
    "#cgLegalModal .cgm-in{padding:22px 24px;max-height:calc(100vh - 30px);overflow:auto}",
    "#cgLegalModal h2{margin:0 0 10px;font:700 22px/1.25 'Atkinson Hyperlegible',system-ui,Arial,sans-serif;color:#08262c !important;border:0 !important}",
    "#cgLegalModal p,#cgLegalModal li,#cgLegalModal b{color:#08262c !important;max-width:none}",
    "#cgLegalModal p{margin:0 0 12px}#cgLegalModal ul{margin:0 0 14px;padding-left:1.2em}#cgLegalModal li{margin:0 0 8px}",
    "#cgLegalModal .cgm-btns{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:8px}",
    "#cgLegalModal button,#cgLegalModal a.cgm-link{display:inline-flex;align-items:center;justify-content:center;min-width:52px;min-height:52px;padding:0 22px;border-radius:10px;border:2px solid #08262c;font:700 17px/1 'Atkinson Hyperlegible',system-ui,Arial,sans-serif;cursor:pointer;text-decoration:none;box-sizing:border-box}",
    "#cgLegalModal button.cgm-main{background:#08262c !important;color:#ffffff !important}#cgLegalModal button.cgm-alt,#cgLegalModal a.cgm-link{background:#ffffff !important;color:#08262c !important}",
    "#cgLegalModal button:focus-visible,#cgLegalModal a:focus-visible{outline:3px solid #ffd477;outline-offset:2px;box-shadow:0 0 0 6px #08262c}",
    "@media print{#cgLegal,#cgLegalModal{display:none !important}}"
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

  /* The same words, on demand, in a window. Escape or Close puts focus back where it was. */
  function openModal(opener) {
    var d = root.document; if (!d.body) return;
    if (typeof root.HTMLDialogElement !== "function") { root.location.href = "terms.html"; return; }
    var old = d.getElementById("cgLegalModal"); if (old && old.parentNode) old.parentNode.removeChild(old);
    if (!d.getElementById("cgLegalCss")) { var st = d.createElement("style"); st.id = "cgLegalCss"; st.textContent = CSS; d.head.appendChild(st); }
    var m = d.createElement("dialog"); m.id = "cgLegalModal"; m.setAttribute("aria-labelledby", "cgmHead");
    var here = /\/resources\//.test(root.location.pathname) ? "../../" : "";
    m.innerHTML = '<div class="cgm-in"><h2 id="cgmHead"></h2><p id="cgmText"></p><p><b>In short</b></p><ul id="cgmList"></ul><div class="cgm-btns"><button type="button" class="cgm-main" id="cgmOk"></button><a class="cgm-link" id="cgmFull">Read the full terms</a><button type="button" class="cgm-alt" id="cgmClose">Close</button></div></div>';
    m.querySelector("#cgmHead").textContent = HEADING; m.querySelector("#cgmText").textContent = TEXT;
    var ul = m.querySelector("#cgmList"); SUMMARY.forEach(function (r) { var li = d.createElement("li"); li.innerHTML = "<b></b> "; li.querySelector("b").textContent = r[0] + "."; li.appendChild(d.createTextNode(" " + r[1])); ul.appendChild(li); });
    m.querySelector("#cgmFull").setAttribute("href", here + "terms.html");
    var ok = m.querySelector("#cgmOk"); ok.textContent = read() ? "Got it" : "I agree";
    d.body.appendChild(m);
    function done() { if (m.open) m.close(); }
    ok.addEventListener("click", function () { if (!read()) { write(true); hide(); } done(); });
    m.querySelector("#cgmClose").addEventListener("click", done);
    m.addEventListener("close", function () { if (m.parentNode) m.parentNode.removeChild(m); if (opener && opener.focus) { try { opener.focus(); } catch (e) { /* the page moved on */ } } });
    m.addEventListener("click", function (e) { if (e.target === m) done(); });            // a click on the dim area around it closes it
    m.showModal(); ok.focus();
  }
  if (root.document) root.document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[data-cg-terms]") : null;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;      // a new tab or window still opens the page
    if (/(^|\/)terms\.html$/.test(root.location.pathname)) return;                                                  // the page already holds the full text
    e.preventDefault(); openModal(a);
  });

  var api = {
    KEY: KEY, HEADING: HEADING, TEXT: TEXT, PRINT_LINE: PRINT_LINE,
    accepted: read,
    accept: function () { write(true); hide(); },
    reset: function () { write(false); },
    show: show,
    open: openModal,
    SUMMARY: SUMMARY
  };
  root.CognicopiaLegal = api;

  function start() { if (!BAR_OFF && !read() && !/(^|\/)terms\.html$/.test(root.location.pathname)) show(); }
  if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : this);
