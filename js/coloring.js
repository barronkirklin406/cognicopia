/* =====================================================================
   Cognicopia SVG coloring pages: draw a traced picture into a page, in a tier.

   The pictures come from scripts/build_coloring_svgs.py, which traces master
   PNG line art into closed-outline SVG and writes js/coloring-data.js (this file's
   data: window.CognicopiaSvgColoringData). Load them in this order:

     <link rel="stylesheet" href="css/styles.css">
     <script src="js/coloring-data.js"></script>
     <script src="js/coloring.js"></script>

     CognicopiaSvgColoring.mount(document.getElementById("page"), "sprig-demo", { tier: 2 })
       .then(info => ...)        // { id, title, tier, paths, closed }

   The call is asynchronous so a page can wait for a picture the same way whether
   it comes from memory (today) or, if the library ever outgrows one file, from a
   fetch. It does NOT fetch today: the SVG text is held in coloring-data.js so a
   picture draws on file://, on a facility intranet and with the network unplugged
   (a fetch fails on file://), and so the tools keep their promise of no network
   request of their own. Nothing here touches the network, storage or the clock.

   What it does to a picture before it is shown. The SVG is read with DOMParser
   and rebuilt from an allow-list of shapes and attributes: no script, no style,
   no link, no event handler, no image or external reference survives, whatever the
   data held. Every ink shape becomes pure black (the page is black on white). It
   counts the outlines and checks that every one is closed (ends in Z), and says
   so in the result; a picture with an open outline is refused, because an open
   outline is a leak for a crayon. The tier class (tier-1, tier-2, tier-3) is put
   on the <svg>; css/styles.css draws the line weight for it (3, 4.5 and 7.9 pt,
   never under 3 pt, with vector-effect: non-scaling-stroke).
   Runs in the browser (window.CognicopiaSvgColoring) and in a test page.
   ===================================================================== */
(function (root) {
  "use strict";
  if (root.CognicopiaSvgColoring) return;
  var NS = "http://www.w3.org/2000/svg";
  var SHAPES = { g: ["transform", "fill-rule"], path: ["d", "fill-rule", "transform"], line: ["x1", "y1", "x2", "y2", "transform"], polyline: ["points", "transform"], polygon: ["points", "transform"],
    circle: ["cx", "cy", "r", "transform"], ellipse: ["cx", "cy", "rx", "ry", "transform"], rect: ["x", "y", "width", "height", "rx", "ry", "transform"] };
  var ALLOWED = Object.keys(SHAPES).concat(["title", "desc"]);
  var TRANSFORM = /^(?:\s*(?:translate|scale|rotate|matrix)\([-\d.eE\s,]+\)\s*)+$/;
  var NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

  function data() { return root.CognicopiaSvgColoringData || { viewBox: [0, 0, 600, 800], items: [] }; }
  function items() { return data().items || []; }
  function list() { return items().map(function (i) { return { id: i.id, title: i.title, bytes: i.bytes }; }); }
  function find(id) {
    var all = items();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function tierOf(n) {
    var t = Math.round(Number(n));
    return t === 2 || t === 3 ? t : 1;
  }

  /* Rebuild an element from the allow-list only. Returns { node, paths, outlines, open }. */
  function rebuild(src, doc, stats) {
    var tag = src.localName;
    if (ALLOWED.indexOf(tag) < 0) return null;
    var out = doc.createElementNS(NS, tag);
    if (tag === "title" || tag === "desc") { out.textContent = src.textContent; return out; }
    var keep = SHAPES[tag] || [];
    for (var i = 0; i < keep.length; i++) {
      var v = src.getAttribute(keep[i]);
      if (v == null) continue;
      if (keep[i] === "transform" && !TRANSFORM.test(v)) continue;
      if (keep[i] === "fill-rule" && v !== "evenodd" && v !== "nonzero") continue;
      if (keep[i] === "d" || keep[i] === "points") { if (/[<>"']|javascript:/i.test(v)) continue; }
      out.setAttribute(keep[i], v);
    }
    if (tag === "path") {
      var subs = (out.getAttribute("d") || "").split(/(?=[Mm])/).filter(function (sub) { return sub.trim(); });
      if (!subs.length) return null;                 /* a path with nothing to draw is dropped, not counted */
      stats.paths++;
      subs.forEach(function (sub) {
        stats.outlines++;
        if (!/[Zz]\s*$/.test(sub.trim())) stats.open++;
      });
    }
    if (tag in SHAPES) out.setAttribute("fill", "#000000");
    for (var c = src.firstElementChild; c; c = c.nextElementSibling) {
      var child = rebuild(c, doc, stats);
      if (child) out.appendChild(child);
    }
    return out;
  }

  /* Read SVG text into a clean <svg> element and the facts about it. */
  function clean(text, title, doc) {
    var parsed = new root.DOMParser().parseFromString(String(text), "image/svg+xml");
    var src = parsed.documentElement;
    if (!src || src.localName !== "svg" || parsed.getElementsByTagName("parsererror").length) throw new Error("That picture is not a readable SVG.");
    var vb = (src.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || vb.some(isNaN) || vb[2] <= 0 || vb[3] <= 0) throw new Error("That picture has no usable viewBox.");
    if (Math.abs(vb[2] / vb[3] - 0.75) > 0.01) throw new Error("A coloring page is 3:4; this picture is not.");
    var stats = { paths: 0, outlines: 0, open: 0 };
    var svg = doc.createElementNS(NS, "svg");
    svg.setAttribute("xmlns", NS);
    svg.setAttribute("viewBox", vb.join(" "));
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", title || "Coloring page");
    var t = doc.createElementNS(NS, "title"); t.textContent = title || "Coloring page"; svg.appendChild(t);
    for (var c = src.firstElementChild; c; c = c.nextElementSibling) {
      var n = rebuild(c, doc, stats);
      if (n && n.localName !== "title") svg.appendChild(n);
    }
    if (!stats.paths) throw new Error("That picture has no outlines to color.");
    if (stats.open) throw new Error("That picture has " + stats.open + (stats.open === 1 ? " outline that is" : " outlines that are") + " not closed.");
    return { svg: svg, paths: stats.paths, outlines: stats.outlines };
  }

  /* Resolve to { id, title, svg } for a picture in the data, or reject with a plain message. */
  function load(id, doc) {
    return new Promise(function (resolve, reject) {
      try {
        if (!NAME.test(String(id))) throw new Error("That is not a picture name.");
        var item = find(id);
        if (!item) throw new Error("There is no picture called " + id + ".");
        var got = clean(item.svg, item.title, doc || root.document);
        resolve({ id: item.id, title: item.title, svg: got.svg, paths: got.paths, outlines: got.outlines });
      } catch (e) { reject(e); }
    });
  }

  /* Draw a picture into `target` at a tier (1, 2 or 3). With { sheet: true } it is drawn on a Letter page with the binding gutter. */
  function mount(target, id, opts) {
    opts = opts || {};
    var doc = target.ownerDocument || root.document;
    return load(id, doc).then(function (got) {
      var tier = tierOf(opts.tier);
      got.svg.setAttribute("class", "cg-coloring tier-" + tier);
      var holder = target;
      while (target.firstChild) target.removeChild(target.firstChild);
      if (opts.sheet) {
        holder = doc.createElement("div");
        holder.className = "cg-coloring-sheet";
        target.appendChild(holder);
      }
      holder.appendChild(got.svg);
      return { id: got.id, title: got.title, tier: tier, paths: got.paths, outlines: got.outlines, closed: true };
    });
  }

  root.CognicopiaSvgColoring = Object.freeze({ list: list, load: load, mount: mount, tierOf: tierOf, WEIGHTS_PT: Object.freeze({ 1: 3, 2: 4.5, 3: 7.875 }) });
})(typeof globalThis !== "undefined" ? globalThis : this);
