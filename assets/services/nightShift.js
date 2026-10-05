(function(){
  "use strict";
  var KEY = "cognicopia_night_shift";
  var STYLE = [
    "@media screen {",
    "html.cg-night-shift{color-scheme:dark}",
    "html.cg-night-shift{--ink:#ffedcc;--ink-soft:#e0c99d;--paper:#17120c;--field:#2b2015;--garden:#8a641f;--garden-dark:#684a26;--gold:#d6a64b;--berry:#a35b62;--sky:#9b7136;--rule:#684a26;--rule-soft:#513b22;--tint:#2b2015;--warn:#ffc0a3;--bg:#17120c;--bg-2:#211910;--panel:#2b2015;--panel-2:#332312;--line:rgba(255,237,204,.2);--line-2:rgba(255,237,204,.35);--text:#ffedcc;--muted:#e0c99d;--accent:#d6a64b;--accent-hi:#ffd477;--accent-deep:#8a641f;--accent-ink:#211910;--sb-bg:#211910;--sb-border:rgba(255,237,204,.2);--sb-accent:#d6a64b;--sb-hover:rgba(214,166,75,.18);--sb-txt:#ffedcc;--sb-muted:#e0c99d}",
    "html .cg-night-shift-toggle{min-height:44px;padding:8px 14px;border:2px solid #d6a64b;border-radius:10px;background:#332312;color:#ffedcc;font:inherit;font-weight:700;font-size:15px;line-height:1.2;cursor:pointer}",
    "html .cg-night-shift-toggle:focus-visible{outline:3px solid #ffd477;outline-offset:3px}",
    "html.cg-night-shift body{background-color:#17120c!important;background-image:none!important;color:#ffedcc!important}",
    "html.cg-night-shift .cg-topbar,html.cg-night-shift .cg-sidebar,html.cg-night-shift .cg-sidebar-brand,html.cg-night-shift .topbar,html.cg-night-shift .sidebar{background:#211910!important;color:#ffedcc!important;border-color:#684a26!important}",
    "html.cg-night-shift .cg-topbar a,html.cg-night-shift .cg-topbar button,html.cg-night-shift .topbar a,html.cg-night-shift .topbar button,html.cg-night-shift .cg-sidebar a,html.cg-night-shift .sidebar a{color:#ffedcc!important}",
    "html.cg-night-shift .cg-topbar,html.cg-night-shift .topbar{gap:12px}",
    "html.cg-night-shift .arb,html.cg-night-shift .qpb,html.cg-night-shift #f,html.cg-night-shift .wrap,html.cg-night-shift main,html.cg-night-shift .view{background-color:#211910!important;color:#ffedcc!important;border-color:#684a26!important}",
    "html.cg-night-shift .arb select,html.cg-night-shift .arb select option,html.cg-night-shift .arb-btn,html.cg-night-shift .qpb-btn,html.cg-night-shift #f input,html.cg-night-shift #f select,html.cg-night-shift #f textarea,html.cg-night-shift #f button{background-color:#2b2015!important;color:#ffedcc!important;border-color:#9b7136!important}",
    "html.cg-night-shift .arb-btn-primary,html.cg-night-shift .qpb-btn-primary{background:#6f4b16!important;color:#fff1cf!important;border-color:#d6a64b!important}",
    "html.cg-night-shift .arb-pill.is-on{background:#8a641f!important;color:#fff1cf!important;border-color:#d6a64b!important}",
    "html.cg-night-shift .qpb-preview{background:#211910!important}",
    "html.cg-night-shift .tb{--tb-bg:#17120c;--tb-ink:#ffedcc;--tb-soft:#e0c99d;--tb-line:#c7a25c;--tb-em:#b9822c;--tb-em-dk:#765018;--tb-gold:#d6a64b;--tb-card:#261d13}",
    "html.cg-night-shift .tb-top{background:#211910!important}",
    "html.cg-night-shift .tb-hello{color:#ffedcc!important}",
    "html.cg-night-shift .tb-lock{background:#332312!important;color:#ffedcc!important;border-color:#9b7136!important}",
    "html.cg-night-shift .tb-lock small{color:#e0c99d!important}",
    "html.cg-night-shift .tb-night-toggle{min-height:56px;max-width:175px}",
    "html.cg-night-shift .tb-tab,html.cg-night-shift .tb-btn,html.cg-night-shift .tb-opt,html.cg-night-shift .tb-card,html.cg-night-shift .tb-grid{background:#2b2015!important;color:#ffedcc!important}",
    "html.cg-night-shift .tb-tab[aria-selected=true],html.cg-night-shift .tb-btn-go,html.cg-night-shift .tb-opt.is-picked,html.cg-night-shift .tb-opt.is-answer{background:#765018!important;color:#fff1cf!important}",
    "html.cg-night-shift .tb-cell{border-color:#684a26!important;color:#ffedcc!important}",
    "html.cg-night-shift .tb-cell.is-fade{background:#2b2015!important}",
    "html.cg-night-shift .tb-words li.is-found{color:#e0c99d!important}",
    "html.cg-night-shift .tb :focus-visible{outline-color:#ffd477}",
    "@media screen and (max-width:1000px){.tb-top{flex-wrap:wrap}.tb-tabs{order:3;width:100%}}",
    "html.cg-night-shift .rap{--rp-card:#211910;--rp-card2:#2b2015;--rp-field:#17120c;--rp-line:rgba(255,237,204,.22);--rp-line2:rgba(255,237,204,.38);--rp-text:#ffedcc;--rp-muted:#e0c99d;--rp-accent:#d6a64b;--rp-accent-hi:#ffd477;--rp-ink:#211910;--rp-warn:#ffc0a3}",
    "html.cg-night-shift .rap-hero h1,html.cg-night-shift .rap-step h2,html.cg-night-shift .rap-field>label,html.cg-night-shift .rap-group>legend,html.cg-night-shift .rap-privacy-main{color:#fff1cf}",
    "html.cg-night-shift .rap-wizard,html.cg-night-shift .rap input,html.cg-night-shift .rap select,html.cg-night-shift .rap textarea{background:#211910!important;color:#ffedcc!important;border-color:#9b7136!important}",
    "html.cg-night-shift .cg-sidebar a:hover,html.cg-night-shift .sidebar a:hover{background:#3a2917!important;color:#fff1cf!important}",
    "html.cg-night-shift :focus-visible{outline-color:#ffd477}",
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
      button.textContent = on ? "☀ Night Shift: On" : "🌙 Night Shift: Off";
      button.title = on ? "Turn off the warm-amber Night Shift theme" : "Turn on the warm-amber Night Shift theme";
    });
  }
  function addHeaderButton(header){
    if (!header || header.querySelector(".cg-night-shift-toggle")) return;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "cg-night-shift-toggle";
    button.setAttribute("aria-label", "Toggle warm-amber Night Shift theme");
    header.appendChild(button);
  }
  Array.prototype.forEach.call(document.querySelectorAll(".cg-topbar, .topbar"), addHeaderButton);
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
