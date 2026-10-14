/* =====================================================================
   Cognicopia Coloring Agent: describe a picture in a few words (or let the
   library choose one) and get a clean, print-ready black-and-white page.

   What it does, in order:
     1. Wraps the person's words in the clinical prompt wrapper (the same
        words every time: bold, thick, uncrowded, pure black on pure white,
        3:4), after a dignity check on what was typed.
     2. Asks a picture source for the picture. The one built in is the
        Cognicopia Coloring library on this computer (150 pictures, each at
        three tiers), found by meaning ("a rocking chair on a porch") or
        chosen at random from the memory-care categories. A source is any
        function that returns a picture; they are tried in order, each with
        its own time limit, so one that is slow or fails never stops the page:
        the next is tried and the person is told in plain words.
     3. Cleans whatever comes back on an HTML canvas. Brightness
        0.34 R + 0.5 G + 0.16 B under 200 becomes pure black, everything else
        pure white, so no gray survives. The picture is laid on a 3:4 sheet,
        1800 x 2400 px (6 x 8 in at 300 dpi; the dpi is written into the PNG).
     4. Checks the result (pure black and white, 3:4, not blank, no large dark
        area, how thin the thinnest lines print) and hands back a PNG as a Blob
        and a data URL.

     CognicopiaColoringAgent.generate({ subject: "a rocking chair on a porch", tier: 2 })
       .then(r => ...)      // r.blob, r.dataUrl, r.title, r.designId, r.prompt, r.stats, r.notes
     CognicopiaColoringAgent.generate({ random: true, category: "classic-vehicles", avoid: ["driving"] })
     CognicopiaColoringAgent.clean(anyPictureBlobOrImage)   // the black-and-white filter on its own

   No online picture maker is built in. The tools make no network request of
   their own (CLAUDE.md), and nothing in this file touches the network, the
   page address or storage. A source that needs one is the owner's decision;
   see docs/coloring-agent.md for what adding it would take.
   Runs in the browser (window.CognicopiaColoringAgent, also window.ColoringAgent)
   and, for the parts that need no canvas, in Node (scripts/check-coloringagent.mjs).
   ===================================================================== */
(function (root) {
  "use strict";
  if (root.CognicopiaColoringAgent) return;

  /* the clinical prompt wrapper: the owner's words, kept exactly */
  var PREFIX = "Minimalist bold-and-easy adult coloring book page of ";
  var SUFFIX = ", thick pure-black vector outlines, clean uncrowded composition, large fillable areas, solid pure white background, zero shading, zero gray tones, high contrast, 3:4 aspect ratio";

  var THRESHOLD = 200;                               // brightness under this prints black
  var OUT_W = 1800, OUT_H = 2400, PRINT_W_IN = 6, DPI = 300;   // 3:4, 6 x 8 in at 300 dpi
  var MIN_BLACK = 0.002, MAX_BLACK = 0.45;           // a page with less ink is blank; with more, a large dark area
  var MIN_LINE_PT = 3, LINE_SLACK = 0.85;            // the clinical floor, and how much a measured estimate may fall short
  var TIMEOUT_MS = 20000;
  var MAX_SUBJECT = 120;

  /* the memory-care categories the random page draws from (library category ids) */
  var CATEGORIES = [
    { id: "vintage-americana", label: "Vintage Americana", cats: ["vintage-americana"] },
    { id: "botanical", label: "Botanical", cats: ["botanical-garden"] },
    { id: "nostalgic-home", label: "Nostalgic Home Objects", cats: ["nostalgic-heritage", "home-everyday"] },
    { id: "classic-vehicles", label: "Classic Vehicles", cats: ["classic-vehicles"] },
    { id: "zentangle", label: "Simple Zentangles", cats: ["zentangle-mandalas", "bold-easy-patterns"] },
    { id: "wildlife", label: "Wildlife & Nature", cats: ["wildlife-nature"] },
    { id: "seasons", label: "Seasons & Holidays", cats: ["seasons-holidays"] }
  ];

  /* what a person is told, in plain words: nothing technical, nothing that blames */
  var SAY = {
    empty: "Describe the picture in a few words, such as “a rocking chair on a porch”, or choose a random page.",
    long: "That is a little long. A few words about the picture are enough.",
    adult: "Cognicopia pages are made for adults, so please describe the picture in plain adult words.",
    nomatch: "No picture in the library is close to that yet. Try a few plain words, such as “tractor”, “roses” or “teapot”, or choose a random page.",
    avoided: "Every picture that fits is on this resident’s list of topics to avoid. Try another description, or choose a random page.",
    slow: "That is taking longer than expected, so it was set aside. Nothing was lost. Please try again.",
    nolib: "The coloring library could not load on this computer. Reload the page and try again.",
    draw: "The picture could not be drawn on this computer just now. Please try again.",
    blank: "That page came out nearly blank, so it was not used. Please try another description.",
    dark: "That page has a large dark area that would use a lot of ink, so it was not used. Please try another description.",
    read: "The picture could not be read for cleaning. Please try another one.",
    canvas: "This browser cannot clean pictures for printing. Please use a current browser.",
    fellback: "The first picture source was not available, so this page came from the library on this computer.",
    generic: "The page could not be made just now. Nothing was lost. Please try again."
  };

  function fail(code, message) {
    var e = new Error(message || SAY[code] || SAY.generic);
    e.code = code; e.friendly = e.message;
    return e;
  }
  function describeError(e) { return e && e.friendly ? e.friendly : SAY.generic; }

  /* ---------- the words ---------- */
  function tidy(text) {
    return String(text == null ? "" : text).replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ")
      .replace(/^[\s"'“”‘’.,;:!?-]+|[\s"'“”‘’.,;:!?-]+$/g, "");
  }
  /* The wrapped prompt. "A vintage chair" reads "page of a vintage chair"; a title keeps its capitals. */
  function buildPrompt(subject) {
    var s = tidy(subject).replace(/^(A|An|The)\s+(?=[a-z])/, function (m) { return m.toLowerCase(); });
    return PREFIX + s + SUFFIX;
  }
  /* A person's words, checked: { ok, subject } or { ok:false, code, message }. The same dignity filter the picture prompts use. */
  function checkSubject(text) {
    var s = tidy(text);
    if (s.length < 3) return { ok: false, code: "empty", message: SAY.empty };
    if (s.length > MAX_SUBJECT) return { ok: false, code: "long", message: SAY.long };
    var P = root.CognicopiaColoringPrompts, hits = P && P.dignityCheck ? P.dignityCheck(s) : [];
    if (hits.length) {
      var terms = hits.map(function (h) { return "“" + h.term + "”"; }).filter(function (t, i, a) { return a.indexOf(t) === i; });
      return { ok: false, code: "adult", message: SAY.adult + " (" + (terms.length > 1 ? "the words " : "the word ") + terms.join(", ") + ")", terms: hits.map(function (h) { return h.term; }) };
    }
    return { ok: true, subject: s };
  }

  /* ---------- finding a picture by meaning ---------- */
  var STOP = {};
  ("a an the of on in at to for with and or by from into onto my our your her his their its this that these those some any one " +
    "page pages picture pictures coloring colouring color adult adults simple easy big large small little nice pretty lovely beautiful please like want make draw show").split(" ")
    .forEach(function (w) { STOP[w] = 1; });
  /* a few everyday words for what the library calls something else (after plurals are removed) */
  var SYN = { automobile: "car", auto: "car", puppy: "dog", kitty: "cat", kitten: "cat", bouquet: "flower", blossom: "flower", bloom: "flower", airplane: "biplane", plane: "biplane",
    ship: "boat", sailboat: "boat", teapot: "tea", teacup: "tea", clothesline: "laundry", clothespin: "laundry" };

  function stem(w) {
    if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + "y";
    if (w.length > 4 && /(ch|sh|ss|x|z)es$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /s$/.test(w) && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function tokens(text, asked) {
    var out = [];
    String(text).toLowerCase().replace(/&/g, " and ").split(/[^a-z0-9]+/).forEach(function (w) {
      if (!w || (asked && STOP[w])) return;
      w = stem(w);
      if (asked && SYN[w]) w = SYN[w];
      if (out.indexOf(w) < 0) out.push(w);
    });
    return out;
  }

  function library() { return root.CognicopiaColoring || null; }
  function designs() {
    var C = library();
    try { return C && C.designs ? C.designs() : null; } catch (e) { return null; }
  }
  var index = null;
  function indexed(list) {
    if (index && index.n === list.length && index.first === list[0]) return index.rows;
    var C = library(), cat = function (id) { return (C.CAT && C.CAT[id] && C.CAT[id].label) || ""; };
    var rows = list.map(function (d) { return { d: d, t: tokens(d.title), tc: tokens(d.title, true), g: tokens((d.tags || []).join(" ")), x: tokens([cat(d.cat), d.era || "", d.season || ""].join(" ")) }; });
    index = { n: list.length, first: list[0], rows: rows };
    return rows;
  }
  /* On the resident's list of topics to avoid? (avoid: the codes from their profile, as the library uses them) */
  function avoided(d, avoid) {
    if (!avoid || !avoid.length) return false;
    return (d.sensitive || []).some(function (x) { return avoid.indexOf(x) >= 0; });
  }
  /* The library's pictures that fit these words, best first: [{ id, title, score, category }].
     A picture counts only when a word is in its title or tags; the category and era only add to the score. */
  function find(text, opts) {
    opts = opts || {};
    var list = designs();
    if (!list) throw fail("nolib");
    var q = tokens(text, true), out = [];
    if (!q.length) return out;
    indexed(list).forEach(function (r) {
      if (avoided(r.d, opts.avoid)) return;
      var score = 0, hits = 0, strong = 0;
      q.forEach(function (w) {
        var inT = r.t.indexOf(w) >= 0, inG = r.g.indexOf(w) >= 0, h = (inT ? 4 : 0) + (inG ? (inT ? 2 : 3) : 0) || (r.x.indexOf(w) >= 0 ? 1 : 0);
        if (h) hits++;
        if (inT || inG) strong++;
        score += h;
      });
      if (strong && hits === q.length) score += 2;                       // every word found
      if (strong && r.tc.length && r.tc.every(function (w) { return q.indexOf(w) >= 0; })) score += 3;   // the whole title asked for
      if (strong) out.push({ id: r.d.id, title: r.d.title, score: score, category: r.d.cat });
    });
    out.sort(function (a, b) { return b.score - a.score || (a.id < b.id ? -1 : 1); });
    return out;
  }

  /* ---------- the random page ---------- */
  var recent = [];
  function forgetRecent() { recent = []; }
  function categoryById(id) { for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].id === id) return CATEGORIES[i]; return null; }
  function pickOf(list, rng) { return list[Math.min(list.length - 1, Math.floor(rng() * list.length))]; }
  function subjectText(d) { return String(d.title).toLowerCase(); }
  /* One picture from the memory-care categories (every category equally likely, one the person has not just seen),
     leaving out anything on the avoid list: { designId, title, category, subject } */
  function random(opts) {
    opts = opts || {};
    var list = designs();
    if (!list) throw fail("nolib");
    var rng = opts.rng || Math.random, cat = categoryById(opts.category), ok = list.filter(function (d) { return !avoided(d, opts.avoid); });
    var groups = (cat ? [cat] : CATEGORIES).map(function (c) { return { c: c, list: ok.filter(function (d) { return c.cats.indexOf(d.cat) >= 0; }) }; })
      .filter(function (g) { return g.list.length; });
    if (!groups.length) throw fail("avoided");
    var g = pickOf(groups, rng), fresh = g.list.filter(function (d) { return recent.indexOf(d.id) < 0; });
    var d = pickOf(fresh.length ? fresh : g.list, rng);
    recent.push(d.id); if (recent.length > 12) recent.shift();
    return { designId: d.id, title: d.title, category: g.c, subject: subjectText(d) };
  }

  /* ---------- picture sources ---------- */
  var providers = {}, order = ["library"];
  function registerProvider(name, fn, first) {
    providers[name] = fn;
    order = order.filter(function (n) { return n !== name; });
    if (first) order.unshift(name); else order.push(name);
  }
  function tierOf(t) { t = +t; return t === 1 || t === 3 ? t : 2; }

  /* The built-in source: a library picture, drawn on the spot at the tier's own line weight for a 6-inch-wide picture. */
  registerProvider("library", function (ctx) {
    var C = library();
    if (!C || !C.design || !C.render || !C.toSVG) throw fail("nolib");
    var id = ctx.designId;
    if (!id) {
      /* the pictures that fit are those close to the best match; if the resident's avoid list rules out all of them, say so
         rather than quietly show a weaker one */
      var all = find(ctx.subject);
      if (!all.length) throw fail("nomatch");
      var cut = all[0].score * 0.6, ok = all.filter(function (m) { return m.score >= cut && !avoided(C.design(m.id), ctx.avoid); });
      if (!ok.length) throw fail("avoided");
      var top = ok.filter(function (m) { return m.score === ok[0].score; });
      id = pickOf(top, ctx.rng || Math.random).id;
    }
    var d = C.design(id);
    if (!d) throw fail("nomatch");
    var tier = tierOf(ctx.tier), svg;
    try { svg = C.toSVG(C.render(d.id, tier), { standalone: true, widthIn: PRINT_W_IN, label: d.title + ", a picture to color" }); }
    catch (e) { throw fail("draw"); }
    return { svg: svg, title: d.title, designId: d.id, tier: tier, category: d.cat };
  });

  function withTimeout(run, ms) {
    return new Promise(function (resolve, reject) {
      var done = false, t = setTimeout(function () { if (!done) { done = true; reject(fail("slow")); } }, ms);
      Promise.resolve().then(run).then(function (v) { if (!done) { done = true; clearTimeout(t); resolve(v); } },
        function (e) { if (!done) { done = true; clearTimeout(t); reject(e); } });
    });
  }

  /* ---------- the black-and-white filter ---------- */
  /* In place, on canvas pixels (RGBA bytes): brightness 0.34 R + 0.5 G + 0.16 B under the threshold becomes black, the rest white,
     alpha 255. Clear pixels count as paper. Returns { pixels, black, blackShare }. */
  function thresholdPixels(data, threshold) {
    var t = threshold == null ? THRESHOLD : threshold, black = 0, n = data.length / 4;
    for (var i = 0; i < data.length; i += 4) {
      var k = data[i + 3] / 255, p = 255 * (1 - k);
      var lum = 0.34 * (data[i] * k + p) + 0.5 * (data[i + 1] * k + p) + 0.16 * (data[i + 2] * k + p);
      var v = lum < t ? 0 : 255;
      if (!v) black++;
      data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
    }
    return { pixels: n, black: black, blackShare: n ? black / n : 0 };
  }
  /* How many pixels are not pure black or pure white at full opacity (none, after thresholdPixels). */
  function impure(data) {
    var bad = 0;
    for (var i = 0; i < data.length; i += 4) {
      var r = data[i];
      if ((r !== 0 && r !== 255) || data[i + 1] !== r || data[i + 2] !== r || data[i + 3] !== 255) bad++;
    }
    return bad;
  }
  /* How thin the thinnest lines are: the lower tenth of the black runs across every third row and column, in pixels and in
     points at the printed width. An estimate (a run across a corner or the tip of a line is short), used to warn, never to refuse. */
  function lineStats(data, w, h, widthIn) {
    var hist = new Uint32Array(256), total = 0, run, x, y;
    function bump() { hist[run > 255 ? 255 : run]++; total++; run = 0; }
    for (y = 1; y < h; y += 3) { run = 0; for (x = 0; x < w; x++) { if (data[(y * w + x) * 4] === 0) run++; else if (run) bump(); } if (run) bump(); }
    for (x = 1; x < w; x += 3) { run = 0; for (y = 0; y < h; y++) { if (data[(y * w + x) * 4] === 0) run++; else if (run) bump(); } if (run) bump(); }
    if (!total) return null;
    var want = Math.ceil(total * 0.1), acc = 0, len = 1;
    for (; len < 255; len++) { acc += hist[len]; if (acc >= want) break; }
    return { px: len, pt: Math.round(len / (w / widthIn) * 72 * 100) / 100 };
  }

  /* ---------- PNG: write the dpi so it opens at 6 x 8 in ---------- */
  var crcTable = null;
  function crc32(b, from, to) {
    if (!crcTable) { crcTable = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; } }
    var c2 = 0xFFFFFFFF;
    for (var i = from; i < to; i++) c2 = crcTable[(c2 ^ b[i]) & 255] ^ (c2 >>> 8);
    return (c2 ^ 0xFFFFFFFF) >>> 0;
  }
  function put32(b, at, v) { b[at] = v >>> 24 & 255; b[at + 1] = v >>> 16 & 255; b[at + 2] = v >>> 8 & 255; b[at + 3] = v & 255; }
  /* The bytes of a PNG with a pHYs chunk (pixels per metre) right after the header chunk; unchanged when it is not a PNG or already has one. */
  function withDpi(bytes, dpi) {
    var sig = [137, 80, 78, 71, 13, 10, 26, 10], i;
    if (bytes.length < 41) return bytes;
    for (i = 0; i < 8; i++) if (bytes[i] !== sig[i]) return bytes;
    if (bytes[12] !== 73 || bytes[13] !== 72 || bytes[14] !== 68 || bytes[15] !== 82) return bytes;                // IHDR must come first
    for (i = 33; i + 8 < bytes.length && i < 200; i++) if (bytes[i + 4] === 112 && bytes[i + 5] === 72 && bytes[i + 6] === 89 && bytes[i + 7] === 115) return bytes;
    var ppm = Math.round(dpi / 0.0254), chunk = new Uint8Array(21);
    put32(chunk, 0, 9); chunk.set([112, 72, 89, 115], 4); put32(chunk, 8, ppm); put32(chunk, 12, ppm); chunk[16] = 1; put32(chunk, 17, crc32(chunk, 4, 17));
    var out = new Uint8Array(bytes.length + 21);
    out.set(bytes.subarray(0, 33), 0); out.set(chunk, 33); out.set(bytes.subarray(33), 54);
    return out;
  }

  function readBytes(blob) {
    return new Promise(function (resolve, reject) {
      var r = new root.FileReader();
      r.onload = function () { resolve(new Uint8Array(r.result)); };
      r.onerror = function () { reject(fail("draw")); };
      r.readAsArrayBuffer(blob);
    });
  }
  function readDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var r = new root.FileReader();
      r.onload = function () { resolve(String(r.result)); };
      r.onerror = function () { reject(fail("draw")); };
      r.readAsDataURL(blob);
    });
  }
  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new root.Image(), url = null;
      img.onload = function () { if (url) root.URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { if (url) root.URL.revokeObjectURL(url); reject(fail("read")); };
      if (typeof src === "string") img.src = /^\s*(<\?xml|<svg)/i.test(src) ? "data:image/svg+xml;charset=utf-8," + encodeURIComponent(src) : src;
      else { url = root.URL.createObjectURL(src); img.src = url; }
    });
  }

  /* Any picture (SVG text, a Blob, an image or canvas) cleaned to pure black and white on a 3:4 sheet. The whole picture is kept:
     a picture that is not 3:4 gets white margins, never a crop. Resolves { blob, dataUrl, width, height, dpi, printWidthIn,
     printHeightIn, stats }. Refuses a nearly blank page and one with a large dark area. */
  function clean(source, o) {
    o = o || {};
    var W = o.width || OUT_W, H = Math.round(W * 4 / 3), widthIn = o.printWidthIn || PRINT_W_IN, t = o.threshold == null ? THRESHOLD : o.threshold;
    if (!root.document || !root.document.createElement) return Promise.reject(fail("canvas"));
    return Promise.resolve(source).then(function (src) {
      return typeof src === "string" || (root.Blob && src instanceof root.Blob) ? loadImage(src) : src;
    }).then(function (img) {
      var cv = root.document.createElement("canvas");
      cv.width = W; cv.height = H;
      var ctx = cv.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw fail("canvas");
      var sw = img.naturalWidth || img.videoWidth || img.width, sh = img.naturalHeight || img.videoHeight || img.height;
      if (!sw || !sh) throw fail("read");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
      var k = Math.min(W / sw, H / sh), dw = sw * k, dh = sh * k;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      var px;
      try { px = ctx.getImageData(0, 0, W, H); } catch (e) { throw fail("read"); }          // a picture from another site that does not allow reading
      var st = thresholdPixels(px.data, t);
      ctx.putImageData(px, 0, 0);
      var back = ctx.getImageData(0, 0, W, H).data;
      if (impure(back)) throw fail("draw");
      if (st.blackShare < MIN_BLACK) throw fail("blank");
      if (st.blackShare > MAX_BLACK) throw fail("dark");
      var lines = lineStats(back, W, H, widthIn);
      return new Promise(function (resolve, reject) {
        cv.toBlob(function (b) { b ? resolve(b) : reject(fail("draw")); }, "image/png");
      }).then(readBytes).then(function (bytes) {
        var blob = new root.Blob([withDpi(bytes, Math.round(W / widthIn))], { type: "image/png" });
        return readDataUrl(blob).then(function (dataUrl) {
          return { blob: blob, dataUrl: dataUrl, width: W, height: H, dpi: Math.round(W / widthIn), printWidthIn: widthIn, printHeightIn: widthIn * 4 / 3,
            stats: { pure: true, ratio: W / H, threshold: t, blackShare: st.blackShare, lineMinPx: lines && lines.px, lineMinPt: lines && lines.pt,
              thinLines: !!(lines && lines.pt < MIN_LINE_PT * LINE_SLACK), bytes: blob.size } };
        });
      });
    });
  }

  /* ---------- the whole job ---------- */
  function planOf(req) {
    if (req.random) { var r = random({ category: req.category, avoid: req.avoid, rng: req.rng }); return { subject: r.subject, designId: r.designId, category: r.category.label, random: true }; }
    var c = checkSubject(req.subject);
    if (!c.ok) throw fail(c.code, c.message);
    return { subject: c.subject, designId: req.designId || "", category: "", random: false };
  }
  function nowMs() { return root.performance && root.performance.now ? root.performance.now() : Date.now(); }

  /* Make one page. req: { subject } or { random: true, category? }, plus tier (1, 2 or 3), avoid (codes), designId (to draw the same
     picture again at another tier). opts: providers (names or functions; the built-in library by default), timeoutMs, and clean
     (to replace the cleaning step in a test). Resolves { ok, title, designId, categoryId, category, subject, prompt, tier, provider, blob, dataUrl,
     width, height, dpi, stats, notes, ms } or rejects with an error whose .friendly is a plain sentence and .code says which. */
  function generate(req, opts) {
    req = req || {}; opts = opts || {};
    var t0 = nowMs(), notes = [], names = opts.providers || order, cleaner = opts.clean || clean, ms = opts.timeoutMs || TIMEOUT_MS;
    return Promise.resolve().then(function () {
      var plan = planOf(req), prompt = buildPrompt(plan.subject), i = 0, lastErr = null;
      var ctx = function () { return { subject: plan.subject, prompt: prompt, designId: plan.designId, tier: tierOf(req.tier), avoid: req.avoid || [], random: plan.random, rng: req.rng }; };
      function attempt() {
        if (i >= names.length) throw lastErr || fail("generic");
        var name = names[i++], fn = typeof name === "function" ? name : providers[name], label = typeof name === "function" ? "custom" : name;
        if (!fn) return attempt();
        return withTimeout(function () {
          return Promise.resolve(fn(ctx())).then(function (got) {
            if (!got) throw fail("generic");
            return cleaner(got.svg || got.blob || got.image || got.url).then(function (cleaned) { return { got: got, clean: cleaned }; });
          });
        }, ms).then(function (r) {
          if (i > 1) notes.push(SAY.fellback);
          var d = r.got, c = r.clean, L = library();
          return { ok: true, title: d.title || plan.subject, designId: d.designId || plan.designId || "", categoryId: d.category || "",
            category: plan.category || (d.category && L && L.CAT && L.CAT[d.category] ? L.CAT[d.category].label : ""), subject: plan.subject, prompt: prompt,
            tier: tierOf(d.tier || req.tier), provider: label, blob: c.blob, dataUrl: c.dataUrl, width: c.width, height: c.height, dpi: c.dpi, printWidthIn: c.printWidthIn,
            printHeightIn: c.printHeightIn, stats: c.stats, notes: notes, ms: Math.round(nowMs() - t0) };
        }, function (e) { lastErr = e && e.friendly ? e : fail("generic"); return attempt(); });
      }
      return attempt();
    });
  }

  /* Save a result's PNG (a Blob held in this page: no address, no request). */
  function download(result, name) {
    var a = root.document.createElement("a"), url = root.URL.createObjectURL(result.blob);
    a.href = url; a.download = name || "Cognicopia-coloring-page.png"; a.rel = "noopener";
    root.document.body.appendChild(a); a.click(); root.document.body.removeChild(a);
    setTimeout(function () { root.URL.revokeObjectURL(url); }, 4000);
  }

  var api = {
    VERSION: 1, PREFIX: PREFIX, SUFFIX: SUFFIX, THRESHOLD: THRESHOLD, OUT_W: OUT_W, OUT_H: OUT_H, PRINT_W_IN: PRINT_W_IN, DPI: DPI,
    MIN_LINE_PT: MIN_LINE_PT, CATEGORIES: CATEGORIES, SAY: SAY,
    buildPrompt: buildPrompt, checkSubject: checkSubject, find: find, random: random, forgetRecent: forgetRecent,
    generate: generate, clean: clean, download: download, registerProvider: registerProvider, describeError: describeError,
    thresholdPixels: thresholdPixels, impure: impure, lineStats: lineStats, withDpi: withDpi
  };
  root.CognicopiaColoringAgent = api;
  root.ColoringAgent = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
