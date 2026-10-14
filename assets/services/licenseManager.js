/* =====================================================================
   Cognicopia license manager (browser, offline).

   One small module that every page loads, so "is this computer licensed?"
   has one answer everywhere. Four ways in, in the order they are tried:

     key      a signed license key, COG1.<facility and dates>.<signature>,
              sent after a card payment or on an invoice. The owner signs it
              with a private key that is never on this site; the page checks
              the signature against the public key in src/config/license.js
              (ECDSA P-256 with SHA-256, done below in plain JavaScript, so
              it works with no internet, on file:// and on plain http). The
              key carries the facility's name, the kind of license
              (monthly_facility, annual_facility or enterprise) and the date
              it is paid through. A key keeps working offline for
              GRACE_DAYS after that date (90 by default), so a unit that is
              offline for months is not locked out. Nothing about a key can
              be changed without the signature failing.
     paid     the shared access code from the receipt of the earlier,
              single-price license (kept under cognicopia_license, as
              index.html and builder.html have always done)
     promo    the master promo code
     (the last two are the older, shared codes; see src/config/license.js)

   The same window takes all three: paste a key or type a code, and the
   window works out which it is. A key can also arrive in the address,
   ?license_key=... or #license_key=... (the address is cleaned afterwards),
   and a checkout can arrive as ?session_id=...; this file cannot contact
   Stripe, so a session id is passed on to activate.html, the one page that
   may use the internet.

   How a key is stored. The page keeps the whole key under
   cognicopia_license_v2 with the facility, tier and date beside it. Only the
   key counts: every read checks its signature again, so editing the other
   fields, or pasting a made-up record, unlocks nothing. It is kept in
   localStorage, not the encrypted store: the answer to "is this computer
   licensed?" is needed immediately and on every page, the key is signed so
   hiding it protects nothing, and a locked store would otherwise show a
   buy screen to a facility that has paid. If browser storage is blocked
   (some private windows) the license lasts until the page closes, and the
   person is told so.

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
   Changing PROMO_SHA256 ends every earlier promo activation.

   What it does on a page
     - puts a "License Key / Promo" button beside "Activate license" in the
       top bar, and a window to paste a key or type a code (focus trapped,
       Escape closes, the result is announced to screen readers);
     - once licensed, swaps that for a green "Full Access Active" badge and
       hides every "Get Full Access" / payment link and any element marked
       data-upgrade-prompt;
     - tells the page (document event "cognicopia:license") so index.html and
       builder.html open their gates, refresh their counters and close the
       buy screen;
     - checks storage when the page loads and when another tab changes it,
       so a license survives refreshes and offline sessions.

   Nothing here makes a network request. The only clock it reads is the
   current date, to see whether a key is still inside its dates. Runs in the
   browser (window.CognicopiaLicense) and in Node (vm) for the tests.
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
  var NOT_SAVED = " This browser is not keeping saved data, so full access lasts only until this page is closed.";
  var DAY = 86400000;
  var doc = root.document || null;
  var SELF = (doc && doc.currentScript && doc.currentScript.src) || "";   // where this file was loaded from, to find activate.html beside the site

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


  /* ---------- signed license keys: ECDSA P-256 / SHA-256, checked here ----------
     A key is  COG1.<payload>.<signature>  where payload is base64url of a small
     JSON object and signature is base64url of the 64 bytes r||s over the text
     "COG1.<payload>". Only a signature check is needed, so only the public
     half of the curve work is here: no signing, no random numbers. BigInt is
     called, not written as a literal, so a browser without it still loads this
     file and says so instead of failing to parse. */
  var HAS_BIG = typeof root.BigInt === "function";
  var EC = null, pubCache = {};
  function curve(){
    if (EC) return EC;
    var h = function(x){ return root.BigInt("0x" + x); };
    EC = {
      Z: root.BigInt(0), O: root.BigInt(1), T: root.BigInt(2), H3: root.BigInt(3), F: root.BigInt(4), E: root.BigInt(8),
      p: h("ffffffff00000001000000000000000000000000ffffffffffffffffffffffff"),
      n: h("ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"),
      b: h("5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b"),
      gx: h("6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"),
      gy: h("4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"),
      hex: h
    };
    EC.G = [EC.gx, EC.gy, EC.O];
    EC.INF = [EC.O, EC.O, EC.Z];
    return EC;
  }
  function md(a, m){ var r = a % m; return r < EC.Z ? r + m : r; }
  function inv(a, m){                                   // extended Euclid
    var oldR = md(a, m), r = m, oldS = EC.O, s = EC.Z, q, t;
    while (r !== EC.Z){ q = oldR / r; t = oldR - q * r; oldR = r; r = t; t = oldS - q * s; oldS = s; s = t; }
    return md(oldS, m);
  }
  function dbl(P){                                      // Jacobian doubling, a = -3
    var p = EC.p, X = P[0], Y = P[1], Z = P[2];
    if (Z === EC.Z || Y === EC.Z) return EC.INF;
    var d = Z * Z % p, g = Y * Y % p, b = X * g % p;
    var al = EC.H3 * md((X - d) * (X + d), p) % p;
    var x3 = md(al * al - EC.E * b, p);
    return [x3, md(al * (EC.F * b - x3) - EC.E * g * g, p), md((Y + Z) * (Y + Z) - g - d, p)];
  }
  function add(P, Q){                                   // Jacobian addition
    if (P[2] === EC.Z) return Q;
    if (Q[2] === EC.Z) return P;
    var p = EC.p, z1 = P[2], z2 = Q[2], z1z1 = z1 * z1 % p, z2z2 = z2 * z2 % p;
    var u1 = P[0] * z2z2 % p, u2 = Q[0] * z1z1 % p, s1 = P[1] * z2 % p * z2z2 % p, s2 = Q[1] * z1 % p * z1z1 % p;
    var h = md(u2 - u1, p), r = md(s2 - s1, p);
    if (h === EC.Z) return r === EC.Z ? dbl(P) : EC.INF;
    var h2 = h * h % p, h3 = h * h2 % p, v = u1 * h2 % p, x3 = md(r * r - h3 - EC.T * v, p);
    return [x3, md(r * (v - x3) - s1 * h3, p), z1 * z2 % p * h % p];
  }
  function mul2(u1, P1, u2, P2){                        // u1*P1 + u2*P2 in one pass (Shamir's trick)
    var bits = function(x){ var s = x.toString(2); while (s.length < 256) s = "0" + s; return s; };
    var a = bits(u1), b = bits(u2), P12 = add(P1, P2), R = EC.INF, i, x, y;
    for (i = 0; i < 256; i++){
      R = dbl(R); x = a.charAt(i) === "1"; y = b.charAt(i) === "1";
      if (x && y) R = add(R, P12); else if (x) R = add(R, P1); else if (y) R = add(R, P2);
    }
    return R;
  }
  function publicPoint(hex){                            // 04 + x + y, checked to be on the curve
    if (pubCache.hasOwnProperty(hex)) return pubCache[hex];
    var pt = null;
    if (/^04[0-9a-fA-F]{128}$/.test(hex)){
      var x = EC.hex(hex.slice(2, 66)), y = EC.hex(hex.slice(66)), p = EC.p;
      if (x < p && y < p && md(y * y - (x * x % p * x % p) + EC.H3 * x - EC.b, p) === EC.Z) pt = [x, y, EC.O];
    }
    pubCache[hex] = pt;
    return pt;
  }
  function verifyEcdsa(z, r, s, Q){
    var n = EC.n, p = EC.p;
    if (r <= EC.Z || r >= n || s <= EC.Z || s >= n) return false;
    var w = inv(s, n), R = mul2(z * w % n, EC.G, r * w % n, Q);
    if (R[2] === EC.Z) return false;
    var zi = inv(R[2], p);
    return md(R[0] * zi % p * zi % p, n) === r;
  }

  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  function b64u(s){                                     // base64url text to an array of bytes, or null
    if (s.length % 4 === 1) return null;
    var out = [], buf = 0, bits = 0, i, v;
    for (i = 0; i < s.length; i++){
      v = B64.indexOf(s.charAt(i));
      if (v < 0) return null;
      buf = (buf << 6) | v; bits += 6;
      if (bits >= 8){ bits -= 8; out.push((buf >> bits) & 255); buf &= (1 << bits) - 1; }
    }
    return out;
  }
  function fromUtf8(b){
    var s = "", i = 0, c, cp;
    while (i < b.length){
      c = b[i++];
      if (c < 128) s += String.fromCharCode(c);
      else if (c < 224) s += String.fromCharCode(((c & 31) << 6) | (b[i++] & 63));
      else if (c < 240) s += String.fromCharCode(((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63));
      else { cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63); cp -= 0x10000; s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023)); }
    }
    return s;
  }
  function bigOf(bytes){ var h = "", i; for (i = 0; i < bytes.length; i++) h += ("0" + bytes[i].toString(16)).slice(-2); return EC.hex(h); }

  var KEY_FORMAT = /COG(\d+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{86})/;   // the signature is always 86 characters, so text pasted after the key is not read as part of it
  var looksLikeKey = function(text){ return /COG\d+\.[A-Za-z0-9_-]/.test(String(text == null ? "" : text).replace(/\s+/g, "")); };
  var TIER_IDS = function(){ return Object.keys(CFG.TIERS || {}); };
  var verified = {};                                    // token -> result; a signature is checked once per page

  /* Check a key's signature and read what it says. This does not look at the date (see timeOf). */
  function inspectKey(raw){
    var bad = function(reason, message){ return { ok: false, reason: reason, message: message }; };
    var text = String(raw == null ? "" : raw);
    if (!text.trim()) return bad("empty", "Paste your license key first.");
    var m = KEY_FORMAT.exec(text.replace(/\s+/g, ""));
    if (!m) return bad("format", looksLikeKey(text)
      ? "That license key is not complete. Copy the whole key, from COG1 to the last character."
      : "That does not look like a license key. A key starts with COG1. and is one long line; copy all of it from your email or invoice.");
    if (m[1] !== "1") return bad("version", "This key is from a newer version of Cognicopia. Reload the page to get the update, then paste it again.");
    var token = m[0];
    if (verified.hasOwnProperty(token)) return verified[token];
    var res = (function(){
      if (!HAS_BIG) return bad("unsupported", "This browser is too old to check license keys. Update it, or ask us for help.");
      var keys = CFG.PUBLIC_KEYS || [];
      if (!keys.length) return bad("not_configured", "License keys are not switched on for this copy of the site yet. Please contact us and we will sort it out.");
      var sig = b64u(m[3]);
      if (!sig || sig.length !== 64) return bad("format", "That license key is not complete. Copy the whole key, from COG1 to the last character.");
      curve();
      var z = EC.hex(sha256("COG1." + m[2])), r = bigOf(sig.slice(0, 32)), s = bigOf(sig.slice(32)), good = false, i, Q;
      for (i = 0; i < keys.length && !good; i++){ Q = publicPoint(String(keys[i])); if (Q && verifyEcdsa(z, r, s, Q)) good = true; }
      if (!good) return bad("signature", "This license key could not be verified. Check that every character was copied, or ask us to send it again.");
      var pl, body = b64u(m[2]);
      try { pl = JSON.parse(fromUtf8(body || [])); } catch (e){ pl = null; }
      if (!pl || pl.v !== 1 || typeof pl.f !== "string" || !pl.f.trim() || pl.f.length > 120 || TIER_IDS().indexOf(pl.t) < 0 || typeof pl.e !== "string" || isNaN(Date.parse(pl.e)) || typeof pl.n !== "string")
        return bad("format", "This license key is not one this version understands. Please contact us.");
      if ((CFG.REVOKED_IDS || []).indexOf(pl.n) >= 0) return bad("revoked", "This license key has been withdrawn. Please contact us.");
      var paidTo = Date.parse(pl.e) + (/^\d{4}-\d\d-\d\d$/.test(pl.e) ? DAY : 0);   // a bare date means the end of that day
      return {
        ok: true, token: token, signature: m[3], id: pl.n, facilityName: pl.f.trim(), licenseTier: pl.t,
        expiresAt: pl.e, issuedAt: typeof pl.i === "string" ? pl.i : null, paidThrough: paidTo,
        graceEnds: paidTo + (Number(CFG.GRACE_DAYS) || 0) * DAY
      };
    })();
    verified[token] = res;
    return res;
  }
  /* Where a checked key stands today: "active", "grace" (past its date, inside the grace days) or "expired". */
  function timeOf(info){
    var now = Date.now();
    return now <= info.paidThrough ? "active" : now <= info.graceEnds ? "grace" : "expired";
  }
  function publicOf(info){
    return { facilityName: info.facilityName, licenseTier: info.licenseTier, tierLabel: (CFG.TIERS || {})[info.licenseTier] || info.licenseTier, expiresAt: info.expiresAt,
      graceEndsAt: new Date(info.graceEnds).toISOString(), id: info.id, issuedAt: info.issuedAt };
  }
  /* The key stored on this computer, if its signature still checks. */
  function storedKey(){
    try {
      var raw = read(K.license);
      if (!raw) return null;
      var rec = JSON.parse(raw);
      if (!rec || typeof rec.token !== "string") return null;
      var info = inspectKey(rec.token);
      return info.ok ? info : null;
    } catch (e){ return null; }
  }
  function isKeyActive(){
    try { var info = storedKey(); return !!info && timeOf(info) !== "expired"; } catch (e){ return false; }
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
  function isLicensed(){ return isKeyActive() || isPaidActive() || isPromoActive(); }
  function status(){
    var promo = isPromoActive(), paid = isPaidActive(), info = storedKey(), keyed = false, when = null, lic = null, lapsed = null;
    if (info){
      when = timeOf(info); lic = publicOf(info); keyed = when !== "expired";
      if (!keyed) lapsed = { facilityName: lic.facilityName, licenseTier: lic.licenseTier, expiresAt: lic.expiresAt };
    }
    return {
      licensed: keyed || paid || promo, promo: promo, paid: paid, keyed: keyed,
      type: keyed ? "key" : paid ? "paid" : promo ? CFG.PROMO_TYPE : null,
      activatedAt: promo ? read(K.date) : null,
      facilityName: keyed ? lic.facilityName : null, licenseTier: keyed ? lic.licenseTier : null, tierLabel: keyed ? lic.tierLabel : null,
      expiresAt: keyed ? lic.expiresAt : null, graceEndsAt: keyed ? lic.graceEndsAt : null, inGrace: keyed && when === "grace",
      daysLeft: keyed ? Math.ceil((info.paidThrough - Date.now()) / DAY) : null, lapsed: lapsed
    };
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
  function dateText(iso){
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var o = { year: "numeric", month: "long", day: "numeric" };
    if (/^\d{4}-\d\d-\d\d$/.test(String(iso))) o.timeZone = "UTC";   /* a date with no time is a calendar day: do not let a US time zone slip it back one day */
    try { return d.toLocaleDateString(undefined, o); } catch (e){ return String(iso).slice(0, 10); }
  }
  /* Ask the browser to keep this site's data when space runs short, so a license is not lost to a clean-up. Best effort. */
  function keepStorage(){
    try { var s = root.navigator && root.navigator.storage; if (s && typeof s.persist === "function") s.persist(); } catch (e){}
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

  /* Check a signed license key and, if it is good and in date, switch full access on. */
  function activateKey(raw){
    try {
      var info = inspectKey(raw);
      if (!info.ok) return { ok: false, reason: info.reason, message: info.message };
      var when = timeOf(info);
      if (when === "expired") return { ok: false, reason: "expired", message: "This license key ended on " + dateText(info.expiresAt) + ". Renew it, or ask us for a new key." };
      var held = storedKey();
      if (held && held.id !== info.id && timeOf(held) !== "expired" && held.paidThrough > info.paidThrough)   // an older key never replaces a newer one
        return { ok: true, reason: "kept", persisted: true, license: publicOf(held), message: "This computer already has a license for " + held.facilityName + " paid through " + dateText(held.expiresAt) + ", which is later than this key. Nothing was changed." };
      var saved = write(K.license, JSON.stringify({
        facilityName: info.facilityName, licenseTier: info.licenseTier, expiresAt: info.expiresAt, isLicensed: true,
        signature: info.signature, token: info.token, activatedAt: new Date().toISOString()
      }));
      keepStorage();
      announce();
      return {
        ok: true, reason: "applied", persisted: saved, license: publicOf(info),
        message: "License activated for " + info.facilityName + "." + (when === "grace" ? " It was paid through " + dateText(info.expiresAt) + "; please renew soon." : "") + (saved ? "" : NOT_SAVED)
      };
    } catch (e){
      return { ok: false, reason: "error", message: "Something went wrong. Please try again." };
    }
  }
  function revokeKey(){
    [K.license, K.ref].forEach(remove);
    announce();
    return status();
  }
  /* One box for everything a person might be holding: a key, the earlier access code, or a promo code. */
  function activate(raw){
    var t = String(raw == null ? "" : raw);
    if (!t.trim()) return { ok: false, reason: "empty", kind: null, message: "Enter your license key or code first." };
    var r;
    if (looksLikeKey(t)){ r = activateKey(t); r.kind = "key"; return r; }
    if (t.trim().length <= 128 && sha256(t.trim()) === CFG.ACCESS_SHA256){
      var saved = write(K.paid, t.trim());
      announce();
      return { ok: true, reason: "applied", kind: "paid", persisted: saved, message: saved ? MSG_OK : MSG_OK_TEMPORARY };
    }
    r = validateAndApplyPromo(t); r.kind = "promo";
    return r;
  }
  /* The checkout a key came from, kept so "renew" on activate.html can ask for a fresh key. */
  var REF = /^cs_(?:live|test)_[A-Za-z0-9]{8,200}$/;
  function rememberRef(id){ if (typeof id === "string" && REF.test(id)) return write(K.ref, id); return false; }
  function renewalRef(){ var v = read(K.ref); return v && REF.test(v) ? v : null; }

  /* ---------- the address: ?license_key=, #license_key= and ?session_id= ---------- */
  var base = function(){ return SELF ? SELF.replace(/assets\/services\/licenseManager\.js(?:[?#].*)?$/, "") : ""; };
  var activateUrl = function(){ return base() + (CFG.ACTIVATE_PATH || "activate.html"); };
  var pricingUrl = function(){ return base() + (CFG.PRICING_PATH || "pricing.html"); };
  function urlParam(name){
    var loc = root.location;
    if (!loc) return null;
    var m = new RegExp("[?&#]" + name + "=([^&#]*)").exec((loc.search || "") + (loc.hash || ""));
    if (!m) return null;
    try { return decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (e){ return m[1]; }
  }
  function cleanUrl(names){
    try {
      var loc = root.location, hist = root.history;
      if (!loc || !hist || typeof hist.replaceState !== "function") return;
      var strip = function(part, lead){
        var body = String(part || "").replace(/^[?#]/, "");
        if (!body) return "";
        var keep = body.split("&").filter(function(kv){ return names.indexOf(kv.split("=")[0]) < 0; });
        return keep.length ? lead + keep.join("&") : "";
      };
      hist.replaceState(hist.state, "", loc.pathname + strip(loc.search, "?") + strip(loc.hash, "#"));
    } catch (e){}
  }
  var bootNote = null;   // what happened to a key that came in the address, shown in the window once the page is drawn
  function fromUrl(){
    var loc = root.location;
    if (!loc) return;
    var key = urlParam("license_key"), sid = urlParam("session_id");
    if (key == null && sid == null) return;
    if (/(?:^|\/)activate(?:\.html)?\/?$/.test(loc.pathname || "")) return;   // that page reads its own address
    if (key != null){
      var r = key.trim() ? activate(key) : { ok: false, message: "Paste your license key first." };
      bootNote = { ok: !!r.ok, text: r.message };
      cleanUrl(["license_key"]);
    }
    if (sid != null){
      if (!isLicensed() && REF.test(sid) && typeof loc.replace === "function"){
        try { loc.replace(activateUrl() + "?session_id=" + encodeURIComponent(sid)); return; } catch (e){}
      }
      cleanUrl(["session_id"]);
    }
  }

  /* ---------- the page: button, badge, modal ---------- */
  var CSS = [
    ".cgpromo-btn,.cgpromo-badge{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:var(--tap,52px);padding:8px 14px;border-radius:8px;font:700 15px/1.2 \"Trebuchet MS\",\"Segoe UI\",system-ui,sans-serif;cursor:pointer;white-space:normal;text-align:center;box-sizing:border-box;text-decoration:none}",
    ".cgpromo-btn{background:#fff;color:#14302a;border:2px solid #286E75}",
    ".cgpromo-btn:hover{background:#e6f4f1;border-color:#14302a}",
    ".cgpromo-badge{background:#1e5b3a;color:#fff;border:2px solid #14402a}",
    ".cgpromo-badge:hover{background:#17492e}",
    ".cgpromo-btn:focus-visible,.cgpromo-badge:focus-visible,.cgpromo-card button:focus-visible,.cgpromo-card a:focus-visible,.cgpromo-card .cgpromo-input:focus-visible{outline:3px solid #f5b800;outline-offset:2px;box-shadow:0 0 0 5px #14302a}",
    ".cgpromo-hide,.cgpromo-badge[hidden],.cgpromo-btn[hidden]{display:none !important}",
    ".cgpromo-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(6,20,15,.72)}",
    ".cgpromo-overlay[hidden]{display:none}",
    ".cgpromo-card{width:min(520px,100%);max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box;background:#fff;color:#14201a;border:3px solid #14302a;border-radius:16px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.45);font:400 18px/1.5 \"Trebuchet MS\",\"Segoe UI\",system-ui,sans-serif}",
    ".cgpromo-card h2{margin:0 0 8px;font-family:inherit;font-weight:700;font-size:24px;line-height:1.25;color:#14302a}",
    ".cgpromo-card p{margin:0 0 14px}",
    ".cgpromo-card label{display:block;margin:0 0 6px;font-weight:700}",
    ".cgpromo-card form{margin:0}",
    ".cgpromo-card .cgpromo-input{display:block;width:100%;min-height:52px;box-sizing:border-box;padding:10px 14px;border:2px solid #14302a;border-radius:10px;background:#fff;color:#14201a;font-family:inherit;font-weight:700;font-size:18px;line-height:1.3;letter-spacing:.02em;resize:vertical;word-break:break-all}",
    ".cgpromo-card textarea.cgpromo-input{min-height:104px}",
    ".cgpromo-card .cgpromo-input[aria-invalid=true]{border-color:#9b1c1c}",
    ".cgpromo-card .cgpromo-input:disabled{opacity:.7}",
    ".cgpromo-status{min-height:1.5em;margin:12px 0 0;font-weight:700}",
    ".cgpromo-status.is-ok{color:#14532d}",
    ".cgpromo-status.is-bad{color:#9b1c1c}",
    ".cgpromo-note{padding:10px 14px;border-left:5px solid #8a5a00;background:#fff4dc;border-radius:6px}",
    ".cgpromo-more{margin:14px 0 0;font-size:16px}",
    ".cgpromo-more a{color:#14302a;font-weight:700;display:inline-flex;align-items:center;min-height:var(--tap,52px)}",
    ".cgpromo-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}",
    ".cgpromo-actions button,.cgpromo-actions a{flex:1 1 150px;min-height:52px;padding:10px 16px;border-radius:10px;border:2px solid #14302a;background:#fff;color:#14302a;font-family:inherit;font-weight:700;font-size:18px;line-height:1.2;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;text-align:center;text-decoration:none;box-sizing:border-box}",
    ".cgpromo-actions button:hover:not(:disabled),.cgpromo-actions a:hover{background:#e6f4f1}",
    ".cgpromo-actions .cgpromo-go{background:#1e5b3a;color:#fff;border-color:#14402a}",
    ".cgpromo-actions .cgpromo-go:hover:not(:disabled){background:#17492e}",
    ".cgpromo-actions button:disabled{opacity:.55;cursor:not-allowed}",
    "@media (min-width:701px) and (max-width:900px){.cg-topbar .cgpromo-btn{order:4}}",
    "@media print{.cgpromo-btn,.cgpromo-badge,.cgpromo-overlay{display:none !important}}",
    "html.cg-night-shift .cgpromo-card{background:#211910;color:#ffedcc;border-color:#9b7136}",
    "html.cg-night-shift .cgpromo-card h2{color:#ffedcc}",
    "html.cg-night-shift .cgpromo-card .cgpromo-input{background:#2b2015;color:#ffedcc;border-color:#9b7136}",
    "html.cg-night-shift .cgpromo-btn,html.cg-night-shift .cgpromo-actions button,html.cg-night-shift .cgpromo-actions a{background:#2b2015;color:#ffedcc;border-color:#9b7136}",
    "html.cg-night-shift .cgpromo-badge,html.cg-night-shift .cgpromo-actions .cgpromo-go{background:#6f4b16;color:#fff1cf;border-color:#d6a64b}",
    "html.cg-night-shift .cgpromo-note{background:#3a2a10;border-color:#d6a64b}",
    "html.cg-night-shift .cgpromo-more a{color:#ffedcc}",
    "html.cg-night-shift .cgpromo-status.is-ok{color:#b7e4c7}",
    "html.cg-night-shift .cgpromo-status.is-bad{color:#ffb4a2}"
  ].join("\n");

  var btn = null, badge = null, overlay = null, lastFocus = null, closeTimer = 0, mounted = false;
  var holding = false, flash = null;   // holding: the window is showing a result and must not be redrawn; flash: a message for the next drawing
  var el = function(tag, cls, text){ var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  var upgradeLinks = function(){ return doc.querySelectorAll('a[href*="buy.stripe.com"],[data-upgrade-prompt]'); };

  function mount(){
    if (!doc || mounted) return;
    mounted = true;
    if (!doc.getElementById("cgpromo-style")){ var st = el("style"); st.id = "cgpromo-style"; st.textContent = CSS; (doc.head || doc.documentElement).appendChild(st); }
    var bar = doc.querySelector(".cg-topbar");
    if (bar){
      btn = el("button", "cgpromo-btn", "License Key / Promo");
      btn.type = "button"; btn.id = "cgPromoBtn";
      btn.setAttribute("aria-haspopup", "dialog");
      btn.addEventListener("click", function(){ openPromo(); });
      badge = el("button", "cgpromo-badge"); badge.type = "button"; badge.id = "cgPromoBadge"; badge.hidden = true;
      badge.addEventListener("click", function(){ openPromo(); });
      var toggle = doc.getElementById("hdrlicToggle"), hdr = doc.getElementById("hdrlic");
      var stripe = bar.querySelector('a[href*="buy.stripe.com"],a[data-upgrade-prompt]');
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
        var soon = st.keyed && (st.inGrace || (st.daysLeft != null && st.daysLeft <= 30));
        var label = (st.promo && !st.keyed && !st.paid ? "Full Access Active (Promo)" : "Full Access Active") + (soon ? " — renew soon" : "");
        badge.appendChild(el("span", "", "✓"));
        badge.lastChild.setAttribute("aria-hidden", "true");
        badge.appendChild(el("span", "", label));
        badge.setAttribute("aria-label", label + (st.keyed ? ", " + st.facilityName + ", paid through " + dateText(st.expiresAt) : st.promo && st.activatedAt ? ", turned on " + dateText(st.activatedAt) : "") + ". Open details.");
      }
    }
    var hdr = doc.getElementById("hdrlic");
    if (hdr) hdr.classList.toggle("cgpromo-hide", on);
    var links = upgradeLinks();
    for (var i = 0; i < links.length; i++) links[i].classList.toggle("cgpromo-hide", on);
    if (overlay && !overlay.hidden && !holding) fill();
  }

  function focusables(){
    return Array.prototype.filter.call(overlay.querySelectorAll("button,input,textarea,[href]"), function(n){ return !n.disabled && !n.hidden && n.offsetParent !== null; });
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
  function link(href, text){ var a = el("a", "", text); a.href = href; return a; }

  /* The window's contents: the form for a key or code, or the "already active" panel. */
  function fill(){
    var st = status(), card = el("div", "cgpromo-card"), msg = el("p", "cgpromo-status"), actions = el("div", "cgpromo-actions");
    msg.id = "cgPromoStatus"; msg.setAttribute("role", "status"); msg.setAttribute("aria-live", "polite");
    if (flash){ msg.className = "cgpromo-status " + flash.cls; msg.textContent = flash.text; flash = null; }
    overlay.textContent = "";
    overlay.appendChild(card);
    if (st.licensed){
      var promoOnly = st.promo && !st.keyed && !st.paid;
      card.appendChild(el("h2", "", promoOnly ? "Full Access Active (Promo)" : "Full Access Active")).id = "cgPromoTitle";
      var body;
      if (st.keyed){
        body = st.facilityName + " — " + st.tierLabel + ". Paid through " + dateText(st.expiresAt) + "."
          + (st.inGrace ? " That date has passed; the license keeps working until " + dateText(st.graceEndsAt) + ", so please renew soon." : "")
          + " Every packet, print, export and tool is unlocked, and it stays on after a refresh or with no internet.";
      } else if (promoOnly){
        body = "Promo access was turned on" + (st.activatedAt ? " " + dateText(st.activatedAt) : "") + " on this computer. Every packet, print, export and tool is unlocked, and it stays on after a refresh or with no internet.";
      } else {
        body = "A paid license code is active on this computer. Every packet, print, export and tool is unlocked.";
      }
      card.appendChild(el("p", "", body));
      card.appendChild(msg);
      var done = el("button", "cgpromo-go", "Done"); done.type = "button"; done.addEventListener("click", function(){ closePromo(); });
      actions.appendChild(done);
      if (st.keyed && (st.inGrace || (st.daysLeft != null && st.daysLeft <= 30)) && renewalRef()) actions.appendChild(link(activateUrl() + "?renew=1", "Renew online"));
      if (st.keyed){
        var out = el("button", "", "Remove license from this computer"); out.type = "button";
        out.addEventListener("click", function(){
          if (out.getAttribute("data-sure") !== "1"){ out.setAttribute("data-sure", "1"); out.textContent = "Tap again to remove it"; return; }
          flash = { cls: "is-ok", text: "License removed from this computer. Paste the key again to turn it back on." }; revokeKey();
        });
        actions.appendChild(out);
      } else if (promoOnly){
        var off = el("button", "", "Remove promo access"); off.type = "button";
        off.addEventListener("click", function(){ flash = { cls: "is-ok", text: "Promo access removed from this computer." }; revokePromo(); });
        actions.appendChild(off);
      }
      card.appendChild(actions);
      done.focus();
      return;
    }
    var form = el("form"); form.noValidate = true; form.setAttribute("autocomplete", "off");
    card.appendChild(el("h2", "", "Activate your license")).id = "cgPromoTitle";
    if (st.lapsed) card.appendChild(el("p", "cgpromo-note", "The license for " + st.lapsed.facilityName + " ended on " + dateText(st.lapsed.expiresAt) + " (plus " + (Number(CFG.GRACE_DAYS) || 0) + " days of grace). Paste a new key below"
      + (renewalRef() ? ", or renew online." : ".")));
    card.appendChild(el("p", "", "Paste the license key from your purchase email or invoice, or type a promo code. It is checked right here, with no internet needed, and nothing is sent anywhere."));
    var label = el("label", "", "License key or promo code"); label.setAttribute("for", "cgPromoInput");
    var input = el("textarea", "cgpromo-input"); input.id = "cgPromoInput"; input.rows = 3; input.placeholder = "COG1.… or a promo code";
    input.maxLength = 1200; input.setAttribute("autocomplete", "off"); input.setAttribute("autocapitalize", "off"); input.setAttribute("autocorrect", "off"); input.spellcheck = false;
    input.setAttribute("aria-describedby", "cgPromoStatus");
    var go = el("button", "cgpromo-go", "Activate Access"); go.type = "submit";
    var cancel = el("button", "", "Cancel"); cancel.type = "button"; cancel.addEventListener("click", function(){ closePromo(); });
    actions.appendChild(go); actions.appendChild(cancel);
    form.appendChild(label); form.appendChild(input); form.appendChild(msg); form.appendChild(actions);
    card.appendChild(form);
    var more = el("p", "cgpromo-more");
    more.appendChild(link(pricingUrl(), "See plans and prices"));
    if (st.lapsed && renewalRef()){ more.appendChild(doc.createTextNode(" · ")); more.appendChild(link(activateUrl() + "?renew=1", "Renew online")); }
    card.appendChild(more);
    input.addEventListener("input", function(){ input.removeAttribute("aria-invalid"); if (msg.classList.contains("is-bad")){ msg.textContent = ""; msg.className = "cgpromo-status"; } });
    input.addEventListener("keydown", function(e){ if (e.key === "Enter" && !e.shiftKey){ e.preventDefault(); if (typeof form.requestSubmit === "function") form.requestSubmit(); else go.click(); } });
    form.addEventListener("submit", function(e){
      e.preventDefault();
      holding = true;
      var r = activate(input.value);
      if (!r.ok) holding = false;
      msg.className = "cgpromo-status " + (r.ok ? "is-ok" : "is-bad");
      msg.textContent = r.message;
      if (r.ok){
        input.disabled = true; go.disabled = true; cancel.disabled = true; input.removeAttribute("aria-invalid");
        clearTimeout(closeTimer);
        closeTimer = setTimeout(function(){ closePromo(); }, r.persisted ? 1800 : 3600);
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

  /* ---------- start up: read the address and storage, draw, and watch for other tabs ---------- */
  fromUrl();
  function start(){
    mount();
    if (root.addEventListener) root.addEventListener("storage", function(e){
      if (!e.key || e.key.indexOf("cognicopia_license") === 0) announce();
    });
    if (bootNote){ flash = { cls: bootNote.ok ? "is-ok" : "is-bad", text: bootNote.text }; bootNote = null; openPromo(); }
  }
  if (doc){
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
  }

  root.CognicopiaLicense = Object.freeze({
    sha256: sha256, normalize: normalize, validateAndApplyPromo: validateAndApplyPromo, revokePromo: revokePromo,
    isPromoActive: isPromoActive, isPaidActive: isPaidActive, isKeyActive: isKeyActive, isLicensed: isLicensed, status: status,
    activate: activate, activateKey: activateKey, inspectKey: inspectKey, revokeKey: revokeKey, looksLikeKey: looksLikeKey,
    rememberRef: rememberRef, renewalRef: renewalRef, activateUrl: activateUrl, pricingUrl: pricingUrl,
    openPromo: openPromo, closePromo: closePromo, onChange: onChange, MESSAGES: Object.freeze({ invalid: MSG_INVALID, ok: MSG_OK })
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
