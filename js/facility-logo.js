/* A facility's own logo, for the pages it prints for its own residents.

   The logo is chosen on the computer, turned into pure black and white right here (a facility's printed pages are pure black on
   white, and a colour or gray logo would print as a smudge), kept in this browser only, and drawn onto the monthly bundle's
   cover sheets and index. Nothing is uploaded or sent anywhere; no network is used.

   The picture is for the facility's brand, never for a resident: there is no field for a name or a photo of a person here.

   window.CogniFacilityLogo:
     KEY, MAX_BYTES, BOX                     the storage key and the limits
     fit(w, h, maxW, maxH)                   a size that fits the box and keeps the shape (never enlarges)
     blackWhite(rgba, threshold)             pure: pixels to pure black (0) or white (255), transparent counted as white; returns the share that is black
     fromFile(file)                          Promise of { dataUrl, w, h, inkShare }, or rejects with a sentence for the person
     load() / save(logo) / clear()           the kept logo (checked every time it is read), or null
     pdfSize(logo, maxIn, maxHIn)            the printed size in points, shape kept
*/
(function (root) {
  "use strict";
  var KEY = "cognicopia_branding_logo";
  var MAX_BYTES = 2 * 1024 * 1024;                     // the file chosen
  var MAX_STORED = 400 * 1024;                         // what is kept (a two-tone PNG of this size is large)
  var BOX = { w: 720, h: 300 };                        // pixels: 3 in x 1.25 in at 240 dpi
  var TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  var PREFIX = "data:image/png;base64,";

  function fit(w, h, maxW, maxH) {
    w = Number(w); h = Number(h);
    if (!(w > 0) || !(h > 0)) return { w: 0, h: 0 };
    var s = Math.min(1, maxW / w, maxH / h);
    return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
  }

  function blackWhite(rgba, threshold) {
    var t = threshold == null ? 140 : threshold, black = 0, n = rgba.length / 4;
    for (var i = 0; i < rgba.length; i += 4) {
      var a = rgba[i + 3] / 255;
      // over white paper: a see-through pixel is white
      var r = rgba[i] * a + 255 * (1 - a), g = rgba[i + 1] * a + 255 * (1 - a), b = rgba[i + 2] * a + 255 * (1 - a);
      var v = 0.299 * r + 0.587 * g + 0.114 * b < t ? 0 : 255;
      rgba[i] = rgba[i + 1] = rgba[i + 2] = v; rgba[i + 3] = 255;
      if (v === 0) black++;
    }
    return n ? black / n : 0;
  }

  function decode(file) {
    return new Promise(function (resolve, reject) {
      var url = null, done = function (img) { if (url) URL.revokeObjectURL(url); resolve(img); };
      var fail = function () { if (url) URL.revokeObjectURL(url); reject(new Error("That picture could not be read. Try a PNG or JPEG file.")); };
      try {
        url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () { done(img); };
        img.onerror = fail;
        img.src = url;
      } catch (e) { fail(); }
    });
  }

  function fromFile(file) {
    if (!file || typeof file !== "object" || typeof file.size !== "number") return Promise.reject(new Error("Choose a picture file."));
    if (TYPES.indexOf(file.type) === -1) return Promise.reject(new Error("Choose a PNG, JPEG, WebP or GIF picture."));
    if (file.size > MAX_BYTES) return Promise.reject(new Error("That file is over 2 MB. Choose a smaller picture of the logo."));
    if (file.size === 0) return Promise.reject(new Error("That file is empty."));
    return decode(file).then(function (img) {
      var nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height;
      if (!(nw >= 16 && nh >= 16)) throw new Error("That picture is too small to print clearly. Choose one at least 16 pixels across.");
      var size = fit(nw, nh, BOX.w, BOX.h), c = document.createElement("canvas");
      c.width = size.w; c.height = size.h;
      var ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("This browser cannot prepare the picture.");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size.w, size.h);
      ctx.drawImage(img, 0, 0, size.w, size.h);
      var data = ctx.getImageData(0, 0, size.w, size.h), share = blackWhite(data.data);
      if (share < 0.004) throw new Error("That picture is nearly all white, so there would be nothing to print. Choose a logo with dark lines or letters.");
      if (share > 0.7) throw new Error("That picture is mostly dark, so it would print as a black block. Choose a logo with dark lines on a light background.");
      ctx.putImageData(data, 0, 0);
      var dataUrl = c.toDataURL("image/png");
      if (dataUrl.length > MAX_STORED) throw new Error("That picture is too detailed to keep. Choose a simpler version of the logo.");
      return { dataUrl: dataUrl, w: size.w, h: size.h, inkShare: share };
    });
  }

  function valid(logo) {
    return !!logo && typeof logo === "object" && typeof logo.dataUrl === "string" && logo.dataUrl.indexOf(PREFIX) === 0 && logo.dataUrl.length <= MAX_STORED &&
      /^[A-Za-z0-9+/]+={0,2}$/.test(logo.dataUrl.slice(PREFIX.length)) && Number.isInteger(logo.w) && Number.isInteger(logo.h) && logo.w >= 1 && logo.h >= 1 && logo.w <= BOX.w && logo.h <= BOX.h;
  }
  function load() {
    try {
      var raw = root.localStorage.getItem(KEY);
      if (!raw) return null;
      var logo = JSON.parse(raw);
      return valid(logo) ? { dataUrl: logo.dataUrl, w: logo.w, h: logo.h } : null;     // a damaged record is no logo, never a broken page
    } catch (e) { return null; }
  }
  function save(logo) {
    if (!valid(logo)) return false;
    try { root.localStorage.setItem(KEY, JSON.stringify({ dataUrl: logo.dataUrl, w: logo.w, h: logo.h })); return true; } catch (e) { return false; }
  }
  function clear() { try { root.localStorage.removeItem(KEY); } catch (e) { /* nothing to remove */ } }

  /* points: shape kept, never larger than maxIn x maxHIn inches */
  function pdfSize(logo, maxIn, maxHIn) {
    var s = Math.min((maxIn * 72) / logo.w, (maxHIn * 72) / logo.h);
    return { w: logo.w * s, h: logo.h * s };
  }

  root.CogniFacilityLogo = Object.freeze({ KEY: KEY, MAX_BYTES: MAX_BYTES, BOX: BOX, valid: valid, fit: fit, blackWhite: blackWhite, fromFile: fromFile, load: load, save: save, clear: clear, pdfSize: pdfSize });
})(typeof window !== "undefined" ? window : globalThis);
