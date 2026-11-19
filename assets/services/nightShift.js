/* Night Shift (the dark, low-glare screen mode): hand-written source with no TypeScript; edit this file directly. It is listed in
   HAND_WRITTEN in scripts/build-services.mjs, so npm run services never builds or overwrites it. */
(function(){
  "use strict";
  var KEY = "cognicopia_night_shift";
  var STYLE = [
    "@media screen {",
    "html.cg-night-shift{color-scheme:dark}",
    "html.cg-night-shift{--ink:#efece6;--ink-soft:#b8c9bf;--paper:#101613;--field:#1d2822;--garden:#74511a;--garden-dark:#3d5147;--gold:#86c9a7;--berry:#a35b62;--sky:#5d8a72;--rule:#3d5147;--rule-soft:#36443d;--tint:#1d2822;--warn:#ffc0a3;--bg:#101613;--bg-2:#18211c;--panel:#1d2822;--panel-2:#22302a;--line:rgba(239,236,230,.2);--line-2:rgba(239,236,230,.35);--text:#efece6;--muted:#b8c9bf;--accent:#86c9a7;--accent-hi:#a8dcc0;--accent-deep:#8a641f;--accent-ink:#18211c;--sb-bg:#18211c;--sb-border:rgba(239,236,230,.2);--sb-accent:#86c9a7;--sb-hover:rgba(134,201,167,.18);--sb-txt:#efece6;--sb-muted:#b8c9bf}",
    "html .cg-night-shift-toggle{min-height:var(--tap,52px);padding:8px 14px;border:2px solid #86c9a7;border-radius:10px;background:#22302a;color:#efece6;font:inherit;font-weight:700;font-size:15px;line-height:1.2;cursor:pointer}",
    "html .cg-night-shift-toggle:focus-visible{outline:3px solid #a8dcc0;outline-offset:3px}",
    "html.cg-night-shift body{background-color:#101613!important;background-image:none!important;color:#efece6!important}",
    "html.cg-night-shift .cg-topbar,html.cg-night-shift .cg-sidebar,html.cg-night-shift .cg-sidebar-brand,html.cg-night-shift .topbar,html.cg-night-shift .sidebar{background:#18211c!important;color:#efece6!important;border-color:#3d5147!important}",
    "html.cg-night-shift .cg-topbar a,html.cg-night-shift .cg-topbar button,html.cg-night-shift .topbar a,html.cg-night-shift .topbar button,html.cg-night-shift .cg-sidebar a,html.cg-night-shift .sidebar a{color:#efece6!important}",
    "html.cg-night-shift .cg-topbar,html.cg-night-shift .topbar{gap:12px}",
    "html.cg-night-shift .arb,html.cg-night-shift .qpb,html.cg-night-shift .pcg,html.cg-night-shift #f,html.cg-night-shift .wrap,html.cg-night-shift main,html.cg-night-shift .view{background-color:#18211c!important;color:#efece6!important;border-color:#3d5147!important}",
    "html.cg-night-shift .arb select,html.cg-night-shift .arb select option,html.cg-night-shift .arb-btn,html.cg-night-shift .qpb-btn,html.cg-night-shift .pcg-extra input,html.cg-night-shift #f input,html.cg-night-shift #f select,html.cg-night-shift #f textarea,html.cg-night-shift #f button{background-color:#1d2822!important;color:#efece6!important;border-color:#5d8a72!important}",
    "html.cg-night-shift .arb-btn-primary,html.cg-night-shift .qpb-btn-primary{background:#86c9a7!important;color:#0d1511!important;border-color:#86c9a7!important}",
    "html.cg-night-shift .topbar .btn-primary,html.cg-night-shift .topbar .btn-packet{background:#86c9a7!important;color:#0d1511!important;border-color:#86c9a7!important}",
    "html.cg-night-shift .arb-pill.is-on{background:#74511a!important;color:#efece6!important;border-color:#86c9a7!important}",
    "html.cg-night-shift .qpb-preview{background:#18211c!important}",
    "html.cg-night-shift .tb{--tb-bg:#101613;--tb-ink:#efece6;--tb-soft:#b8c9bf;--tb-line:#c7a25c;--tb-em:#b9822c;--tb-em-dk:#765018;--tb-gold:#86c9a7;--tb-card:#15221c}",
    "html.cg-night-shift .tb-top{background:#18211c!important}",
    "html.cg-night-shift .tb-hello{color:#efece6!important}",
    "html.cg-night-shift .tb-lock{background:#22302a!important;color:#efece6!important;border-color:#5d8a72!important}",
    "html.cg-night-shift .tb-lock small{color:#b8c9bf!important}",
    "html.cg-night-shift .tb-night-toggle{min-height:56px;max-width:175px}",
    "html.cg-night-shift .tb-tab,html.cg-night-shift .tb-btn,html.cg-night-shift .tb-opt,html.cg-night-shift .tb-card,html.cg-night-shift .tb-grid{background:#1d2822!important;color:#efece6!important}",
    "html.cg-night-shift .tb-tab[aria-selected=true],html.cg-night-shift .tb-btn-go,html.cg-night-shift .tb-opt.is-picked,html.cg-night-shift .tb-opt.is-answer{background:#765018!important;color:#efece6!important}",
    "html.cg-night-shift .tb-cell{border-color:#3d5147!important;color:#efece6!important}",
    "html.cg-night-shift .tb-cell.is-fade{background:#1d2822!important}",
    "html.cg-night-shift .tb-words li.is-found{color:#b8c9bf!important}",
    "html.cg-night-shift .tb :focus-visible{outline-color:#a8dcc0}",
    "@media screen and (max-width:1000px){.tb-top{flex-wrap:wrap}.tb-tabs{order:3;width:100%}}",
    "html.cg-night-shift .rap{--rp-card:#18211c;--rp-card2:#1d2822;--rp-field:#101613;--rp-line:rgba(239,236,230,.22);--rp-line2:rgba(239,236,230,.38);--rp-text:#efece6;--rp-muted:#b8c9bf;--rp-accent:#86c9a7;--rp-accent-hi:#a8dcc0;--rp-ink:#18211c;--rp-warn:#ffc0a3}",
    "html.cg-night-shift .rap-hero h1,html.cg-night-shift .rap-step h2,html.cg-night-shift .rap-field>label,html.cg-night-shift .rap-group>legend,html.cg-night-shift .rap-privacy-main{color:#efece6}",
    "html.cg-night-shift .rap-wizard,html.cg-night-shift .rap input,html.cg-night-shift .rap select,html.cg-night-shift .rap textarea{background:#18211c!important;color:#efece6!important;border-color:#5d8a72!important}",
    "html.cg-night-shift .cg-sidebar a:hover,html.cg-night-shift .sidebar a:hover{background:#26352e!important;color:#efece6!important}",
    "html.cg-night-shift .cg-hub > summary,html.cg-night-shift .cg-sidebar-nav a.cg-hub-link,html.cg-night-shift .sidebar .sb-hub-head{color:#efece6!important}",
    "html.cg-night-shift .cg-hub > summary:hover,html.cg-night-shift .cg-hub[open] > summary,html.cg-night-shift .sidebar .sb-hub-head:hover,html.cg-night-shift .sidebar .sb-hub[open] > .sb-hub-head{background:#26352e!important}",
    "html.cg-night-shift :focus-visible{outline-color:#a8dcc0}",
    "}",
  ].join("");
  var style = document.createElement("style");
  style.id = "cg-night-shift-style";
  style.textContent = STYLE;
  document.head.appendChild(style);

  function enabled(){
    try { return window.localStorage.getItem(KEY) === "1"; }
    catch (e){ return false; }
  }
  function applyEnabled(value){
    var on = !!value;
    document.documentElement.classList.toggle("cg-night-shift", on);
    syncButtons(on);
  }
  function setEnabled(value){
    var on = !!value;
    applyEnabled(on);
    try { window.localStorage.setItem(KEY, on ? "1" : "0"); }
    catch (e){ /* The in-page preference still works when storage is unavailable. */ }
  }
  function syncButtons(on){
    Array.prototype.forEach.call(document.querySelectorAll(".cg-night-shift-toggle"), function(button){
      button.setAttribute("aria-pressed", String(on));
      button.textContent = button.hasAttribute("data-cg-icon") ? (on ? "Night Shift: On" : "Night Shift: Off") : (on ? "☀ Night Shift: On" : "🌙 Night Shift: Off");   // an icon badge drawn by the page's own CSS replaces the emoji
      button.title = on ? "Turn off the warm-amber Night Shift theme" : "Turn on the warm-amber Night Shift theme";
    });
  }
  function addHeaderButton(header){
    if (!header || header.querySelector(".cg-night-shift-toggle")) return;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "cg-night-shift-toggle";
    button.setAttribute("aria-label", "Toggle warm-amber Night Shift theme");
    var slot = header.querySelector("[data-cg-night-slot]");
    if (slot) button.setAttribute("data-cg-icon", "night");
    (slot || header).appendChild(button);
  }
  Array.prototype.forEach.call(document.querySelectorAll("[data-cg-night-slot], .cg-topbar, .topbar"), addHeaderButton);
  document.addEventListener("click", function(event){
    var button = event.target.closest && event.target.closest(".cg-night-shift-toggle");
    if (button) setEnabled(!document.documentElement.classList.contains("cg-night-shift"));
  });
  window.addEventListener("storage", function(event){
    if (event.key === KEY) applyEnabled(event.newValue === "1");
  });
  setEnabled(enabled());
  window.cognicopiaNightShiftSync = function(){
    syncButtons(document.documentElement.classList.contains("cg-night-shift"));
  };
})();
