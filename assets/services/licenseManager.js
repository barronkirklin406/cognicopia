/* =====================================================================
   Cognicopia license manager (browser, offline).

   One small module that every page loads, so "is this computer licensed?"
   has one answer everywhere:

     paid     the access code from the Stripe receipt, entered in the
              "Activate license" box (kept under cognicopia_license, as
              index.html and builder.html have always done)
     promo    the master promo code, entered in the "Promo Code" window
              this file adds to the top bar

   Promo codes are checked here, in the browser, with no server: the typed
   code is trimmed and upper-cased, hashed with SHA-256, and compared with
   PROMO_SHA256 in src/config/license.js (the code itself is never in the
   site). A match writes, to localStorage:

     cognicopia_license_active  = "true"
     cognicopia_license_type    = "promo"
     cognicopia_activation_date = an ISO timestamp
     cognicopia_license_proof   = a SHA-256 that ties the three together

   The proof is why a bare flag set from the browser's console unlocks
   nothing: the stored values are re-checked on every read, the same way
   the paid code is re-hashed every time (see index.html, isSubscribed).
   Changing PROMO_SHA256 ends every earlier promo activation. If browser
   storage is blocked (some private windows) the activation lasts until
   the page closes, and the person is told so.

   What it does on a page
     - puts a "Promo Code" button beside "Activate license" in the top bar,
       and a modal to type the code (focus trapped, Escape closes, the
       result is announced to screen readers);
     - once licensed, swaps that for a green "Full Access Active" badge and
       hides every "Get Full Access" / payment link and any element marked
       data-upgrade-prompt;
     - tells the page (document event "cognicopia:license") so index.html and
       builder.html open their gates, refresh their counters and close the
       buy screen;
     - checks storage when the page loads and when another tab changes it,
       so a license survives refreshes and offline sessions.

   Nothing here makes a network request. Runs in the browser
   (window.CognicopiaLicense) and in Node (vm) for the tests.
   ===================================================================== */
(function (root) {
  "use strict";
  if (root.CognicopiaLicense) return;
  var CFG = root.CognicopiaLicenseConfig;
  if (!CFG) { try { console.error("Cognicopia license: src/config/license.js must load first."); } catch (e) {} return; }
  var K = CFG.KEYS;
  var MSG_INVALID = "Invalid code. Please check your code and try again.";
  var MSG_OK = "Code Applied Successfully!";
  var MSG_OK_TEMPORARY = "Code Applied Successfully! This browser is not keeping saved data, so full access lasts only until this page is closed.";
  var doc = root.document || null;

  /* ---------- SHA-256, synchronous (crypto.subtle is async and missing on plain http) ---------- */
  var SHA_K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function utf8(str){
    var out = [], i, c, d;
    for (i = 0; i < str.length; i++){
      c = str.charCodeAt(i);
      if (c >= 0xd800 && c < 0xdc00 && i + 1 < str.length && (d = str.charCodeAt(i + 1)) >= 0xdc00 && d < 0xe000){ c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; }
      if (c < 128) out.push(c);
      else if (c < 2048) out.push(192 | (c >> 6), 128 | (c & 63));
      else if (c < 65536) out.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
      else out.push(240 | (c >> 18), 128 | ((c >> 12) & 63), 128 | ((c >> 6) & 63), 128 | (c & 63));
    }
    return out;
  }
  function sha256(text){
    var rr = function(n, x){ return (x >>> n) | (x << (32 - n)); };
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var bytes = utf8(String(text == null ? "" : text)), bl = bytes.length * 8, w = new Array(64), i, j, t;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (i = 7; i >= 0; i--) bytes.push(Math.floor(bl / Math.pow(2, i * 8)) & 255);
    for (j = 0; j < bytes.length; j += 64){
      for (t = 0; t < 16; t++) w[t] = (bytes[j + t * 4] << 24) | (bytes[j + t * 4 + 1] << 16) | (bytes[j + t * 4 + 2] << 8) | bytes[j + t * 4 + 3];
      for (t = 16; t < 64; t++){
        var s0 = rr(7, w[t - 15]) ^ rr(18, w[t - 15]) ^ (w[t - 15] >>> 3), s1 = rr(17, w[t - 2]) ^ rr(19, w[t - 2]) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++){
        var S1 = rr(6, e) ^ rr(11, e) ^ rr(25, e), ch = (e & f) ^ (~e & g), T1 = (h + S1 + ch + SHA_K[t] + w[t]) | 0;
        var S0 = rr(2, a) ^ rr(13, a) ^ rr(22, a), maj = (a & b) ^ (a & c) ^ (b & c), T2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + T1) | 0; d = c; c = b; b = a; a = (T1 + T2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = "";
    for (i = 0; i < 8; i++) out += ("00000000" + (H[i] >>> 0).toString(16)).slice(-8);
    return out;
  }

  /* ---------- storage: localStorage, or this page's memory when the browser refuses ---------- */
  var ls, lsChecked = false, memory = {};
  function storage(){
    if (!lsChecked){
      lsChecked = true;
      try { ls = root.localStorage; ls.setItem("__cg_probe", "1"); ls.removeItem("__cg_probe"); } catch (e){ ls = null; }
    }
    return ls;
  }
  function read(k){
    var s = storage(), v = null;
    if (s){ try { v = s.getItem(k); } catch (e){ v = null; } }
    if (v != null) return v;
    return Object.prototype.hasOwnProperty.call(memory, k) ? memory[k] : null;
  }
  function write(k, v){
    var s = storage();
    if (s){ try { s.setItem(k, v); delete memory[k]; return true; } catch (e){} }
    memory[k] = v;
    return false;
  }
  function remove(k){
    delete memory[k];
    var s = storage();
    if (s){ try { s.removeItem(k); } catch (e){} }
  }

  /* ---------- the answers ---------- */
  var normalize = function(code){ return String(code == null ? "" : code).trim().toUpperCase(); };
  var proofOf = function(date){ return sha256(CFG.PROMO_SHA256 + "|" + date + "|" + CFG.PROMO_TYPE); };
  function isPromoActive(){
    try {
      if (read(K.active) !== "true" || read(K.type) !== CFG.PROMO_TYPE) return false;
      var date = read(K.date);
      if (!date || isNaN(Date.parse(date))) return false;
      return read(K.proof) === proofOf(date);
    } catch (e){ return false; }
  }
  function isPaidActive(){
    try { return sha256(read(K.paid) || "") === CFG.ACCESS_SHA256; } catch (e){ return false; }
  }
  function isLicensed(){ return isPaidActive() || isPromoActive(); }
  function status(){
    var promo = isPromoActive(), paid = isPaidActive();
    return { licensed: promo || paid, promo: promo, paid: paid, type: paid ? "paid" : promo ? CFG.PROMO_TYPE : null, activatedAt: promo ? read(K.date) : null };
  }

  /* ---------- changes ---------- */
  var listeners = [];
  function onChange(fn){ if (typeof fn === "function") listeners.push(fn); }
  function announce(){
    var st = status();
    render();
    listeners.slice().forEach(function(fn){ try { fn(st); } catch (e){} });
    if (doc && typeof root.CustomEvent === "function"){ try { doc.dispatchEvent(new root.CustomEvent("cognicopia:license", { detail: st })); } catch (e){} }
  }

  /* Check a typed promo code and, if it is the master code, switch full access on. */
  function validateAndApplyPromo(inputCode){
    try {
      var code = normalize(inputCode);
      if (!code) return { ok: false, reason: "empty", message: "Enter a promo code first." };
      if (code.length > 128 || sha256(code) !== CFG.PROMO_SHA256) return { ok: false, reason: "invalid", message: MSG_INVALID };
      var date = new Date().toISOString();
      var saved = write(K.active, "true");
      saved = write(K.type, CFG.PROMO_TYPE) && saved;
      saved = write(K.date, date) && saved;
      saved = write(K.proof, proofOf(date)) && saved;
      announce();
      return { ok: true, reason: "applied", persisted: saved, message: saved ? MSG_OK : MSG_OK_TEMPORARY };
    } catch (e){
      return { ok: false, reason: "error", message: "Something went wrong. Please try again." };
    }
  }
  function revokePromo(){
    [K.active, K.type, K.date, K.proof].forEach(remove);
    announce();
    return status();
  }

  /* ---------- the page: button, badge, modal ---------- */
  var CSS = [
    ".cgpromo-btn,.cgpromo-badge{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:8px 14px;border-radius:8px;font:700 15px/1.2 \"Trebuchet MS\",\"Segoe UI\",system-ui,sans-serif;cursor:pointer;white-space:normal;text-align:center;box-sizing:border-box;text-decoration:none}",
    ".cgpromo-btn{background:#fff;color:#14302a;border:2px solid #286E75}",
    ".cgpromo-btn:hover{background:#e6f4f1;border-color:#14302a}",
    ".cgpromo-badge{background:#1e5b3a;color:#fff;border:2px solid #14402a}",
    ".cgpromo-badge:hover{background:#17492e}",
    ".cgpromo-btn:focus-visible,.cgpromo-badge:focus-visible,.cgpromo-card button:focus-visible,.cgpromo-card .cgpromo-input:focus-visible{outline:3px solid #f5b800;outline-offset:2px;box-shadow:0 0 0 5px #14302a}",
    ".cgpromo-hide,.cgpromo-badge[hidden],.cgpromo-btn[hidden]{display:none !important}",
    ".cgpromo-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(6,20,15,.72)}",
    ".cgpromo-overlay[hidden]{display:none}",
    ".cgpromo-card{width:min(460px,100%);max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box;background:#fff;color:#14201a;border:3px solid #14302a;border-radius:16px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.45);font:400 18px/1.5 \"Trebuchet MS\",\"Segoe UI\",system-ui,sans-serif}",
    ".cgpromo-card h2{margin:0 0 8px;font-family:inherit;font-weight:700;font-size:24px;line-height:1.25;color:#14302a}",
    ".cgpromo-card p{margin:0 0 14px}",
    ".cgpromo-card label{display:block;margin:0 0 6px;font-weight:700}",
    ".cgpromo-card form{margin:0}",
    ".cgpromo-card .cgpromo-input{display:block;width:100%;min-height:52px;box-sizing:border-box;padding:10px 14px;border:2px solid #14302a;border-radius:10px;background:#fff;color:#14201a;font-family:inherit;font-weight:700;font-size:20px;line-height:1.2;letter-spacing:.04em}",
    ".cgpromo-card .cgpromo-input[aria-invalid=true]{border-color:#9b1c1c}",
    ".cgpromo-card .cgpromo-input:disabled{opacity:.7}",
    ".cgpromo-status{min-height:1.5em;margin:12px 0 0;font-weight:700}",
    ".cgpromo-status.is-ok{color:#14532d}",
    ".cgpromo-status.is-bad{color:#9b1c1c}",
    ".cgpromo-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}",
    ".cgpromo-actions button{flex:1 1 150px;min-height:52px;padding:10px 16px;border-radius:10px;border:2px solid #14302a;background:#fff;color:#14302a;font-family:inherit;font-weight:700;font-size:18px;line-height:1.2;cursor:pointer}",
    ".cgpromo-actions button:hover:not(:disabled){background:#e6f4f1}",
    ".cgpromo-actions .cgpromo-go{background:#1e5b3a;color:#fff;border-color:#14402a}",
    ".cgpromo-actions .cgpromo-go:hover:not(:disabled){background:#17492e}",
    ".cgpromo-actions button:disabled{opacity:.55;cursor:not-allowed}",
    "@media (min-width:701px) and (max-width:900px){.cg-topbar .cgpromo-btn{order:4}}",
    "@media print{.cgpromo-btn,.cgpromo-badge,.cgpromo-overlay{display:none !important}}",
    "html.cg-night-shift .cgpromo-card{background:#211910;color:#ffedcc;border-color:#9b7136}",
    "html.cg-night-shift .cgpromo-card h2{color:#ffedcc}",
    "html.cg-night-shift .cgpromo-card .cgpromo-input{background:#2b2015;color:#ffedcc;border-color:#9b7136}",
    "html.cg-night-shift .cgpromo-btn,html.cg-night-shift .cgpromo-actions button{background:#2b2015;color:#ffedcc;border-color:#9b7136}",
    "html.cg-night-shift .cgpromo-badge,html.cg-night-shift .cgpromo-actions .cgpromo-go{background:#6f4b16;color:#fff1cf;border-color:#d6a64b}",
    "html.cg-night-shift .cgpromo-status.is-ok{color:#b7e4c7}",
    "html.cg-night-shift .cgpromo-status.is-bad{color:#ffb4a2}"
  ].join("\n");

  var btn = null, badge = null, overlay = null, lastFocus = null, closeTimer = 0, mounted = false;
  var holding = false, flash = null;   // holding: the window is showing a result and must not be redrawn; flash: a message for the next drawing
  var el = function(tag, cls, text){ var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  var upgradeLinks = function(){ return doc.querySelectorAll('a[href*="buy.stripe.com"],[data-upgrade-prompt]'); };
  function dateText(iso){
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    try { return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); } catch (e){ return iso.slice(0, 10); }
  }

  function mount(){
    if (!doc || mounted) return;
    mounted = true;
    if (!doc.getElementById("cgpromo-style")){ var st = el("style"); st.id = "cgpromo-style"; st.textContent = CSS; (doc.head || doc.documentElement).appendChild(st); }
    var bar = doc.querySelector(".cg-topbar");
    if (bar){
      btn = el("button", "cgpromo-btn", "Promo Code");
      btn.type = "button"; btn.id = "cgPromoBtn";
      btn.setAttribute("aria-haspopup", "dialog");
      btn.addEventListener("click", function(){ openPromo(); });
      badge = el("button", "cgpromo-badge"); badge.type = "button"; badge.id = "cgPromoBadge"; badge.hidden = true;
      badge.addEventListener("click", function(){ openPromo(); });
      var toggle = doc.getElementById("hdrlicToggle"), hdr = doc.getElementById("hdrlic");
      var stripe = bar.querySelector('a[href*="buy.stripe.com"]');
      if (toggle && toggle.parentNode) toggle.parentNode.insertBefore(btn, toggle.nextSibling);
      else if (stripe && stripe.parentNode) stripe.parentNode.insertBefore(btn, stripe);
      else bar.insertBefore(btn, bar.firstChild);
      if (hdr && hdr.parentNode === bar) bar.insertBefore(badge, hdr);
      else if (stripe && stripe.parentNode) stripe.parentNode.insertBefore(badge, stripe);
      else bar.insertBefore(badge, btn);
    }
    render();
  }

  /* Show the right thing for the current state: the button, or the badge and no upgrade prompts. */
  function render(){
    if (!doc || !mounted) return;
    var st = status(), on = st.licensed;
    if (btn) btn.classList.toggle("cgpromo-hide", on);
    if (badge){
      badge.hidden = !on;
      badge.textContent = "";
      if (on){
        badge.appendChild(el("span", "", "✓"));
        badge.lastChild.setAttribute("aria-hidden", "true");
        badge.appendChild(el("span", "", st.promo ? "Full Access Active (Promo)" : "Full Access Active"));
        badge.setAttribute("aria-label", (st.promo ? "Full Access Active (Promo)" : "Full Access Active") + (st.promo && st.activatedAt ? ", turned on " + dateText(st.activatedAt) : "") + ". Open details.");
      }
    }
    var hdr = doc.getElementById("hdrlic");
    if (hdr) hdr.classList.toggle("cgpromo-hide", on);
    var links = upgradeLinks();
    for (var i = 0; i < links.length; i++) links[i].classList.toggle("cgpromo-hide", on);
    if (overlay && !overlay.hidden && !holding) fill();
  }

  function focusables(){
    return Array.prototype.filter.call(overlay.querySelectorAll("button,input,[href]"), function(n){ return !n.disabled && !n.hidden && n.offsetParent !== null; });
  }
  function onKey(e){
    if (!overlay || overlay.hidden) return;
    if (e.key === "Escape"){ e.preventDefault(); closePromo(); return; }
    if (e.key !== "Tab") return;
    var f = focusables();
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (doc.activeElement === first || !overlay.contains(doc.activeElement))){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (doc.activeElement === last || !overlay.contains(doc.activeElement))){ e.preventDefault(); first.focus(); }
  }
  function build(){
    overlay = el("div", "cgpromo-overlay");
    overlay.id = "cgPromoModal"; overlay.hidden = true;
    overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true"); overlay.setAttribute("aria-labelledby", "cgPromoTitle");
    overlay.addEventListener("mousedown", function(e){ if (e.target === overlay) closePromo(); });
    doc.body.appendChild(overlay);
    doc.addEventListener("keydown", onKey, true);
  }

  /* The window's contents: the code form, or the "already active" panel. */
  function fill(){
    var st = status(), card = el("div", "cgpromo-card"), msg = el("p", "cgpromo-status"), actions = el("div", "cgpromo-actions");
    msg.id = "cgPromoStatus"; msg.setAttribute("role", "status"); msg.setAttribute("aria-live", "polite");
    if (flash){ msg.className = "cgpromo-status " + flash.cls; msg.textContent = flash.text; flash = null; }
    overlay.textContent = "";
    overlay.appendChild(card);
    if (st.licensed){
      card.appendChild(el("h2", "", st.promo ? "Full Access Active (Promo)" : "Full Access Active")).id = "cgPromoTitle";
      card.appendChild(el("p", "", st.promo
        ? "Promo access was turned on" + (st.activatedAt ? " " + dateText(st.activatedAt) : "") + " on this computer. Every packet, print, export and tool is unlocked, and it stays on after a refresh or with no internet."
        : "A paid license code is active on this computer. Every packet, print, export and tool is unlocked."));
      card.appendChild(msg);
      var done = el("button", "cgpromo-go", "Done"); done.type = "button"; done.addEventListener("click", function(){ closePromo(); });
      actions.appendChild(done);
      if (st.promo && !st.paid){
        var off = el("button", "", "Remove promo access"); off.type = "button";
        off.addEventListener("click", function(){ flash = { cls: "is-ok", text: "Promo access removed from this computer." }; revokePromo(); });
        actions.appendChild(off);
      }
      card.appendChild(actions);
      done.focus();
      return;
    }
    var form = el("form"); form.noValidate = true; form.setAttribute("autocomplete", "off");
    card.appendChild(el("h2", "", "Promo Code")).id = "cgPromoTitle";
    card.appendChild(el("p", "", "Enter your promo code to unlock full access on this computer. The code is checked right here, with no internet needed, and nothing is sent anywhere."));
    var label = el("label", "", "Promo code"); label.setAttribute("for", "cgPromoInput");
    var input = el("input", "cgpromo-input"); input.type = "text"; input.id = "cgPromoInput"; input.placeholder = "Enter Promo Code";
    input.maxLength = 128; input.setAttribute("autocomplete", "off"); input.setAttribute("autocapitalize", "characters"); input.setAttribute("autocorrect", "off"); input.spellcheck = false;
    input.setAttribute("aria-describedby", "cgPromoStatus");
    var go = el("button", "cgpromo-go", "Activate Access"); go.type = "submit";
    var cancel = el("button", "", "Cancel"); cancel.type = "button"; cancel.addEventListener("click", function(){ closePromo(); });
    actions.appendChild(go); actions.appendChild(cancel);
    form.appendChild(label); form.appendChild(input); form.appendChild(msg); form.appendChild(actions);
    card.appendChild(form);
    input.addEventListener("input", function(){ input.removeAttribute("aria-invalid"); if (msg.classList.contains("is-bad")){ msg.textContent = ""; msg.className = "cgpromo-status"; } });
    form.addEventListener("submit", function(e){
      e.preventDefault();
      holding = true;
      var r = validateAndApplyPromo(input.value);
      if (!r.ok) holding = false;
      msg.className = "cgpromo-status " + (r.ok ? "is-ok" : "is-bad");
      msg.textContent = r.message;
      if (r.ok){
        input.disabled = true; go.disabled = true; cancel.disabled = true; input.removeAttribute("aria-invalid");
        clearTimeout(closeTimer);
        closeTimer = setTimeout(function(){ closePromo(); }, r.persisted ? 1400 : 3200);
      } else {
        input.setAttribute("aria-invalid", "true");
        input.focus();
        try { input.select(); } catch (err){}
      }
    });
    input.focus();
  }

  function openPromo(){
    if (!doc) return false;
    if (!doc.body){ doc.addEventListener("DOMContentLoaded", openPromo); return false; }
    if (!mounted) mount();
    if (!overlay) build();
    lastFocus = doc.activeElement;
    clearTimeout(closeTimer);
    overlay.hidden = false;
    doc.documentElement.style.overflow = "hidden";
    fill();
    return true;
  }
  function closePromo(){
    if (!overlay || overlay.hidden) return;
    clearTimeout(closeTimer);
    holding = false; flash = null;
    overlay.hidden = true;
    overlay.textContent = "";
    doc.documentElement.style.overflow = "";
    var back = (badge && !badge.hidden && lastFocus === btn) ? badge : lastFocus;
    if (back && back.focus && doc.contains(back) && back.offsetParent !== null){ try { back.focus(); } catch (e){} }
    else if (badge && !badge.hidden) badge.focus();
  }

  /* ---------- start up: read storage, draw, and watch for other tabs ---------- */
  function start(){
    mount();
    if (root.addEventListener) root.addEventListener("storage", function(e){
      if (!e.key || e.key.indexOf("cognicopia_license") === 0) announce();
    });
  }
  if (doc){
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
  }

  root.CognicopiaLicense = Object.freeze({
    sha256: sha256, normalize: normalize, validateAndApplyPromo: validateAndApplyPromo, revokePromo: revokePromo,
    isPromoActive: isPromoActive, isPaidActive: isPaidActive, isLicensed: isLicensed, status: status,
    openPromo: openPromo, closePromo: closePromo, onChange: onChange, MESSAGES: Object.freeze({ invalid: MSG_INVALID, ok: MSG_OK })
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
