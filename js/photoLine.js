/* =====================================================================
   Photo to line drawing: turns a photograph into bold black lines on white, for a coloring page or a door sign. It runs in this window
   on the computer's own canvas: the photo is read, its edges are found (a light blur, then Sobel), the strongest edges are kept and
   thickened to a printable line, and the result is a PNG of pure black and pure white. The photo itself is not stored, uploaded or kept;
   only the line drawing is held, in memory, for the page being made.

   Honest limits: an edge finder is not a person drawing. A clear, well-lit photo with one main subject gives a good picture; a busy or
   dark one gives a rough one, and quality() says so in plain words. It will not match the library's hand-traced drawings, and the
   lines are not guaranteed to be closed outlines.
   Checked by scripts/check-photo-pages-ui.mjs.
   @global CogniPhotoLine
   ===================================================================== */
(function (root) {
  "use strict";
  var doc = root.document; if (!doc || root.CogniPhotoLine) return;
  var W = 900, H = 1200;                                     // 3:4, the shape of a Studio picture (a line 3 pt thick on paper is about 5 px here)
  var KEEP = 0.085;                                          // the share of the picture kept as line before thickening
  function blur(g, w, h) {                                   // a 3 x 3 box blur, twice: enough to keep texture from becoming lines
    var a = g, b = new Float32Array(g.length), pass, x, y, i, s;
    for (pass = 0; pass < 2; pass++) {
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        s = 0; var n = 0;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var xx = x + dx, yy = y + dy; if (xx >= 0 && xx < w && yy >= 0 && yy < h) { s += a[yy * w + xx]; n++; } }
        b[y * w + x] = s / n;
      }
      var t = a; a = b; b = t === g ? new Float32Array(g.length) : t;
    }
    return a;
  }
  /* gray (0 to 255, width w, height h) -> a mask of line pixels (1) */
  function edges(g, w, h) {
    var s = blur(g, w, h), mag = new Float32Array(w * h), x, y, i, max = 0;
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
      i = y * w + x;
      var gx = -s[i - w - 1] - 2 * s[i - 1] - s[i + w - 1] + s[i - w + 1] + 2 * s[i + 1] + s[i + w + 1];
      var gy = -s[i - w - 1] - 2 * s[i - w] - s[i - w + 1] + s[i + w - 1] + 2 * s[i + w] + s[i + w + 1];
      var m = Math.sqrt(gx * gx + gy * gy); mag[i] = m; if (m > max) max = m;
    }
    if (max < 12) return new Uint8Array(w * h);              // a flat picture has no edges
    var hist = new Uint32Array(256), total = (w - 2) * (h - 2);
    for (i = 0; i < mag.length; i++) hist[Math.min(255, Math.floor(mag[i] / max * 255))]++;
    var cut = 0, acc = 0; for (var k = 255; k >= 0; k--) { acc += hist[k]; if (acc >= total * KEEP) { cut = k; break; } }
    var thr = Math.max(cut / 255 * max, max * 0.06), mask = new Uint8Array(w * h);
    for (i = 0; i < mag.length; i++) mask[i] = mag[i] >= thr ? 1 : 0;
    return mask;
  }
  function dilate(mask, w, h, times) {
    var a = mask, b = new Uint8Array(mask.length), t, x, y, i;
    for (t = 0; t < times; t++) {
      b.fill(0);
      for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) { i = y * w + x; if (a[i] || a[i - 1] || a[i + 1] || a[i - w] || a[i + w] || a[i - w - 1] || a[i - w + 1] || a[i + w - 1] || a[i + w + 1]) b[i] = 1; }
      var s = a; a = b; b = s;
    }
    return a;
  }
  /* an image element (or bitmap) -> Promise of { src, ink, w, h }: src is a PNG data address of only #000 and #fff */
  function fromImage(img) {
    var cv = doc.createElement("canvas"); cv.width = W; cv.height = H; var c = cv.getContext("2d", { willReadFrequently: true });
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return Promise.reject(new Error("That picture is empty."));
    c.fillStyle = "#fff"; c.fillRect(0, 0, W, H);
    var k = Math.max(W / iw, H / ih), dw = iw * k, dh = ih * k; c.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);   // cropped evenly to fill the 3:4 picture
    var d = c.getImageData(0, 0, W, H), g = new Float32Array(W * H), i;
    for (i = 0; i < g.length; i++) g[i] = 0.299 * d.data[i * 4] + 0.587 * d.data[i * 4 + 1] + 0.114 * d.data[i * 4 + 2];
    var mask = dilate(edges(g, W, H), W, H, 2), ink = 0;
    for (i = 0; i < mask.length; i++) { var v = mask[i] ? 0 : 255; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; ink += mask[i]; }
    c.putImageData(d, 0, 0);
    return Promise.resolve({ src: cv.toDataURL("image/png"), ink: ink / mask.length, w: W, h: H });
  }
  /* a chosen file -> the same */
  function fromFile(file) {
    if (!file || !/^image\//.test(file.type || "")) return Promise.reject(new Error("Choose a picture file (a photo)."));
    if (file.size > 25 * 1024 * 1024) return Promise.reject(new Error("That photo is too large. Choose one under 25 MB."));
    return new Promise(function (res, rej) {
      var url = root.URL.createObjectURL(file), im = new root.Image();
      im.onload = function () { root.URL.revokeObjectURL(url); fromImage(im).then(res, rej); };
      im.onerror = function () { root.URL.revokeObjectURL(url); rej(new Error("That file could not be read as a photo.")); };
      im.src = url;
    });
  }
  /* how it came out, in plain words: { ok, say } */
  function quality(r) {
    if (!r) return { ok: false, say: "" };
    if (r.ink < 0.012) return { ok: false, say: "Very few lines were found. A photo with more contrast, or a clearer subject, will draw better." };
    if (r.ink > 0.3) return { ok: false, say: "The photo is very busy, so the drawing is rough. A photo with one main subject against a plain background draws best." };
    return { ok: true, say: "Made. A photo makes a rougher drawing than the library’s hand-traced pictures, so look it over before you print." };
  }
  root.CogniPhotoLine = Object.freeze({ W: W, H: H, fromImage: fromImage, fromFile: fromFile, quality: quality });
})(typeof window !== "undefined" ? window : this);
