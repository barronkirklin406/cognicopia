/* =====================================================================
   Print optimizer and offline bundle for the Activity Page Studio.

   Two jobs, both for a secure facility wing with no internet.

   1. Print. install() adds one print style sheet that removes everything
      on the page except the sheets: menus, sidebars, buttons, fields,
      dashboards and the settings panel all go, and each 3:4 sheet (an
      upright page, or a sheet of cards turned sideways) prints on its own
      US Letter page inside 0.5 in margins, in pure black on white. The sheets
      live in one element with the id printRoot (the page the whole site's
      print rules already leave alone). fill() writes them into it, with an
      optional 0.75 in binding gutter that alternates sides for two-sided
      printing.

        @media print hides every element that is not printRoot, inside
        printRoot, or an ancestor of it, so it works on any page without
        naming that page's menu, bar or panel.

   2. Offline. required() lists every file the studio needs (the page, its
      scripts, the type, the PDF library, the library's drawings), cache()
      saves them on this computer, and status() says how many are there
      without the network. The site's service worker already keeps the core
      files; this keeps the whole list, the 34 library drawings included, in
      a cache of its own that a site update does not clear. Nothing leaves the
      computer: every address is one of this site's own files.

   Where the browser has no Cache Storage (a page opened as a file), status()
   says so plainly and the studio works as before.

   Works in the browser (window.CognicopiaPrintOptimizer) and in Node (for the
   checks). No outside address, no resident data, no storage of anything but
   the site's own files.
   ===================================================================== */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CognicopiaPrintOptimizer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";
  var VERSION = "1.0.0", STYLE_ID = "cg-print-optimizer", CACHE = "studio-assets-v1", HOST = "printRoot";

  /* ---------- the print style sheet ---------- */
  function css() {
    return [
      "/* Cognicopia print optimizer " + VERSION + " */",
      "@media screen{#" + HOST + "{display:none}}",
      "@media print{",
      "  @page{size:Letter;margin:.5in}",
      "  html,body{background:#fff!important;margin:0!important;padding:0!important;color:#000!important}",
      /* everything that is not the sheets, or the way down to them, is not printed */
      "  body *:not(:has(#" + HOST + ")):not(#" + HOST + "):not(#" + HOST + " *){display:none!important}",
      "  :has(> #" + HOST + "),:has(#" + HOST + "){display:block!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;background:none!important;max-width:none!important;width:auto!important;min-height:0!important;position:static!important;overflow:visible!important}",
      "  #" + HOST + "{display:block!important}",
      "  .as-pp{width:7.5in;height:9.9in;margin:0;overflow:hidden;break-inside:avoid;break-after:page;page-break-after:always;background:#fff}",
      "  .as-pp:last-child{break-after:auto;page-break-after:auto}",
      "  .as-pp.as-gl{width:7.25in;height:9.66in;margin-left:.25in}",
      "  .as-pp.as-gr{width:7.25in;height:9.66in}",
      "  .as-pp svg{display:block;width:100%;height:100%}",
      "}"
    ].join("\n");
  }
  /* add the style sheet to a document once */
  function install(doc) {
    doc = doc || (typeof document !== "undefined" ? document : null);
    if (!doc || doc.getElementById(STYLE_ID)) return false;
    var st = doc.createElement("style"); st.id = STYLE_ID; st.textContent = css();
    (doc.head || doc.documentElement).appendChild(st);
    return true;
  }
  /* write the sheets (each an SVG string) into the print host; a gutter alternates sides */
  function fill(host, svgs, o) {
    o = o || {};
    host.innerHTML = svgs.map(function (svg, i) { return '<div class="as-pp' + (o.gutter ? (i % 2 === 0 ? " as-gl" : " as-gr") : "") + '">' + svg + "</div>"; }).join("");
    return svgs.length;
  }

  /* ---------- the offline bundle ---------- */
  var CORE = [
    "activity-studio.html", "css/styles.css", "css/pages-utilities.css",
    "js/residentContext.js", "js/generators/activity-engine.js", "js/generators/coloring-pipeline.js", "js/generators/activity-modules.js", "js/generators/activity-pages.js", "js/generators/activity-life-data.js", "js/generators/activity-life.js", "assets/services/reminiscenceEngine.js", "components/packet-generator-ui.js",
    "js/utils/facility-validator.js", "js/utils/print-optimizer.js", "assets/services/secureStore.js", "js/sessionTimeout.js",
    "assets/coloring/subjects.bundle.js", "assets/coloring/manifest.json", "src/services/ColoringManifest.js", "src/engine/DescribeCreate.js",
    "assets/vendor/jspdf.umd.min.js", "assets/vendor/jspdf-atkinson.js", "assets/vendor/jspdf-studio-faces.js", "js/utils/studio-pdf.js", "fonts/AtkinsonHyperlegible-Regular.woff2", "fonts/AtkinsonHyperlegible-Bold.woff2", "fonts/AtkinsonHyperlegibleMono-Bold.woff2", "fonts/PinyonScript-Regular.woff2", "fonts/MarckScript-Regular.woff2"
  ];
  /* every file the studio needs, relative to the site: the core files and the library's own drawings */
  function required(manifest) {
    var m = manifest || (root.CognicopiaColoringManifest || null), list = CORE.slice();
    if (m && m.assets) m.assets().forEach(function (a) { if (a.filePath && list.indexOf(a.filePath) < 0) list.push(a.filePath); });
    return list;
  }
  var hasCaches = function () { return typeof caches !== "undefined" && caches && typeof caches.open === "function"; };
  var abs = function (p) { return typeof location !== "undefined" ? new URL(p, location.href).href : p; };
  /* { supported, total, cached, missing[] }: how many of the files are on this computer without the network */
  function status(list) {
    list = list || required();
    if (!hasCaches()) return Promise.resolve({ supported: false, total: list.length, cached: 0, missing: list.slice() });
    return Promise.all(list.map(function (p) { return caches.match(abs(p)).then(function (r) { return !!r; }, function () { return false; }); })).then(function (found) {
      var missing = list.filter(function (p, i) { return !found[i]; });
      return { supported: true, total: list.length, cached: list.length - missing.length, missing: missing };
    });
  }
  /* save every file that is not yet saved; calls progress(done, total); resolves with the new status */
  function cache(list, progress) {
    list = list || required();
    if (!hasCaches()) return status(list);
    return status(list).then(function (s) {
      var todo = s.missing, done = 0;
      if (!todo.length) return s;
      return caches.open(CACHE).then(function (c) {
        return todo.reduce(function (chain, p) {
          return chain.then(function () { return c.add(abs(p)).catch(function () { /* one missing file must not stop the rest */ }).then(function () { done++; if (progress) progress(done, todo.length); }); });
        }, Promise.resolve());
      }).then(function () { return status(list); });
    });
  }
  /* one plain sentence for the screen */
  function say(s) {
    if (!s.supported) return "Saving for offline use needs the site opened from its web address. The studio still works here.";
    if (s.cached === s.total) return "Ready for offline use: all " + s.total + " files are saved on this computer.";
    return s.cached + " of " + s.total + " files are saved on this computer for offline use.";
  }

  return { VERSION: VERSION, STYLE_ID: STYLE_ID, CACHE: CACHE, CORE: CORE, css: css, install: install, fill: fill, required: required, status: status, cache: cache, say: say };
});
