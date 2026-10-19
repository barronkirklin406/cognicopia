/* =====================================================================
   Cognicopia Tablet Activities: the pictures.

   Every picture the tablet activities show is a finished illustration kept
   in assets/tablet/ (one transparent PNG each, made in Canva and cut from
   its sheets by scripts/make-tablet-pictures.py), so nothing is fetched
   from outside and the same picture shows on every tablet. sw.js keeps
   them for offline use. A picture carries its meaning in its shape, never
   in color alone.

     CognicopiaTabletArt.img(id, { size, label })    the picture as an <img> string
     CognicopiaTabletArt.has(id), .ids(), .name(id)  what is there, and what a screen reader says
     CognicopiaTabletArt.src(id)                     the file's address
     CognicopiaTabletArt.image(id, size, cb)         the picture as an Image, to draw on a canvas

   Pure data and strings: it runs in the browser and in Node (where
   scripts/check-tablet.mjs proves every picture has its file).
   ===================================================================== */
(function (root) {
  "use strict";
  var DIR = "assets/tablet/", PICS = {};
  /* pic(id, name): the name is what a screen reader says when the picture stands alone */
  function pic(id, name) { PICS[id] = name; }

  /* ---------- sounds ---------- */
  pic("bird", "a robin singing on a branch");
  pic("train", "a steam train");
  pic("guitar", "an acoustic guitar");
  pic("cat", "a purring cat");
  pic("storm", "a thunderstorm");
  pic("bells", "a church bell");
  pic("chimes", "wind chimes");
  pic("waves", "ocean waves");
  pic("phone", "an old telephone");

  /* ---------- the trace-the-path scenes ---------- */
  pic("bee", "a bee");
  pic("flower", "a flower");
  pic("station", "a railway station");
  pic("dog", "a dog");
  pic("bone", "a bone");

  var api = {
    dir: DIR,
    has: function (id) { return !!PICS[id]; },
    ids: function () { return Object.keys(PICS); },
    name: function (id) { return PICS[id] || ""; },
    src: function (id) { return PICS[id] ? DIR + id + ".png" : ""; },
    /* opts.size in pixels (omit to let the page size it), opts.label to describe it (omit when the words are beside it) */
    img: function (id, opts) {
      var o = opts || {}; if (!PICS[id]) return "";
      var size = o.size ? ' width="' + o.size + '" height="' + o.size + '"' : "";
      var alt = o.label === undefined ? ' alt="" aria-hidden="true"' : ' alt="' + String(o.label || PICS[id]).replace(/"/g, "&quot;") + '"';
      return '<img class="tb-ico" src="' + api.src(id) + '"' + size + alt + ' decoding="async" draggable="false">';
    },
    /* the picture as an Image (to draw on a canvas); cb gets the Image once it is ready, or null.
       One file serves every size, so the size only reaches the Image's own width and height. */
    image: function (id, size, cb) {
      api._img = api._img || {};
      var im = api._img[id];
      if (im) { if (im.complete && im.naturalWidth) cb(im); else im.addEventListener("load", function () { cb(im); }); return; }
      if (typeof Image === "undefined" || !PICS[id]) { cb(null); return; }
      im = new Image(); api._img[id] = im;
      im.onload = function () { cb(im); }; im.onerror = function () { delete api._img[id]; cb(null); };
      im.width = size; im.height = size;
      im.src = api.src(id);
    }
  };
  root.CognicopiaTabletArt = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
