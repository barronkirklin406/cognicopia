#!/usr/bin/env node
/* =====================================================================
   Cognicopia build check.  Run: npm run build
   The site ships as plain HTML files (GitHub Pages), so "building" is
   verifying that what will be published is sound:
     1. every inline script on every page parses;
     2. the three tools (packet tool, Packet Builder, resident profile)
        make no network requests of their own: no remote scripts, styles,
        fonts or images, and no fetch, XHR, beacons or sockets (the
        bundled PDF library's own file loader is left out of the scan);
     3. the print face is embedded (Atkinson Hyperlegible, data: URIs only)
        and its license ships with it;
     4. every file the offline service worker pre-caches exists, and so
        does every icon in the web manifest;
     5. the server file parses, and the planner, journal, TypeScript
        services and Cognicopia Coloring checks pass (the coloring check
        also proves the library, catalog and browser bundle are current;
        the hybrid check proves the coloring subjects, their manifest and
        bundle are current, and draws every subject at every stage; the
        procedural-content check proves Today's Packet is the same all day,
        new each morning, stage-appropriate, one step from the resident's
        interests and free of anything on the avoid list);
     6. the site navigation matches scripts/site-nav.mjs (npm run nav), the
        Research Center's pages match their content (npm run research), and
        every relative link and asset on every page points at a file that
        exists (a folder means its index.html).
   Node built-ins only. Exits non-zero on any failure.
   ===================================================================== */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const exists = f => fs.existsSync(path.join(ROOT, f));
const TOOLS = ["index.html", "builder.html", "profile.html"];
const fails = [];
const step = (name, fn) => {
  try { const note = fn(); console.log("  ok   " + name + (note ? "  (" + note + ")" : "")); }
  catch (e){ fails.push(name + ": " + e.message); console.log("  FAIL " + name + ": " + e.message); }
};
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

console.log("Cognicopia build check");

/* 1. inline scripts parse */
const SKIP = new Set([".git", "node_modules"]);
const htmlIn = dir => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(e =>
  SKIP.has(e.name) ? [] : e.isDirectory() ? htmlIn(path.posix.join(dir, e.name)) : e.name.endsWith(".html") ? [path.posix.join(dir, e.name)] : []);
const pages = htmlIn("").sort();
step(`inline scripts parse on all ${pages.length} pages`, () => {
  let n = 0;
  for (const f of pages){
    for (const m of read(f).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
      const attrs = m[1];
      if (/\bsrc=/.test(attrs) || /type=["']?(?:application\/(?:ld\+)?json|module|text\/template)/i.test(attrs)) continue;
      try { new Function(m[2]); n++; }
      catch (e){ throw new Error(`${f}: ${e.message}`); }
    }
  }
  return n + " scripts";
});

/* 2. no network use in the tools */
const NET = {
  "a remote script": /<script[^>]+src=["']?(?:https?:)?\/\//i,
  "a remote stylesheet": /<link[^>]+rel=["']?stylesheet[^>]*href=["']?(?:https?:)?\/\//i,
  "a remote CSS resource": /url\(\s*["']?(?:https?:)?\/\//i,
  "a CSS import": /@import\b/i,
  "a remote image": /<img[^>]+src=["']?(?:https?:)?\/\//i,
  "fetch()": /\bfetch\s*\(/,
  "XMLHttpRequest": /XMLHttpRequest/,
  "sendBeacon": /sendBeacon/,
  "a WebSocket": /new\s+WebSocket\b/,
  "an EventSource": /new\s+EventSource\b/
};
for (const f of TOOLS) step(`${f} makes no network requests`, () => {
  const h = read(f).replace(/<script id="pdflib">[\s\S]*?<\/script>/, "");   // jsPDF's optional file loader is never called
  for (const [what, re] of Object.entries(NET)) must(!re.test(h), "contains " + what);
});

/* 3. the embedded print face */
const FACES = /@font-face\{font-family:"Atkinson Hyperlegible";font-style:(normal|italic);font-weight:(400|700);[^}]*src:url\(data:font\/woff2;base64,[A-Za-z0-9+/=]{2000,}\)/g;
for (const f of ["builder.html", "index.html"]) step(`${f} embeds Atkinson Hyperlegible`, () => {
  const block = (/<style id="print-font">([\s\S]*?)<\/style>/.exec(read(f)) || [])[1];
  must(block, "no print-font block");
  const faces = [...block.matchAll(FACES)].map(m => m[1] + " " + m[2]).sort();
  must(faces.join() === "italic 400,italic 700,normal 400,normal 700", "faces: " + faces.join());
  must(!/url\((?!data:)/.test(block), "a face is loaded from a file");
  return "4 faces";
});
step("the packet PDFs embed Atkinson Hyperlegible", () => {
  const h = read("index.html"), js = (/<script id="pdffont">([\s\S]*?)<\/script>/.exec(h) || [])[1];
  must(js, "no pdffont block");
  must(h.indexOf('<script id="pdflib">') < h.indexOf('<script id="pdffont">'), "pdffont must follow the PDF library");
  ["normal", "bold", "italic", "bolditalic"].forEach(s => must(new RegExp(s + ':"[A-Za-z0-9+/=]{20000,}"').test(js), "missing " + s));
});
step("the shared PDF library matches the packet tool's", () => {
  // assets/vendor/*.js are the packet tool's jsPDF and PDF font, shared with the Packet Builder
  const h = read("index.html"), inline = id => (new RegExp('<script id="' + id + '">([\\s\\S]*?)</script>').exec(h) || [])[1];
  must(inline("pdflib") === read("assets/vendor/jspdf.umd.min.js"), "assets/vendor/jspdf.umd.min.js differs from index.html's pdflib");
  must(inline("pdffont") === read("assets/vendor/jspdf-atkinson.js"), "assets/vendor/jspdf-atkinson.js differs from index.html's pdffont");
});
step("the font license ships with the fonts", () => { must(exists("fonts/OFL.txt"), "fonts/OFL.txt missing"); must(/SIL OPEN FONT LICENSE/i.test(read("fonts/OFL.txt")), "not the OFL"); });

/* 4. offline files */
step("every file the service worker pre-caches exists", () => {
  const sw = read("sw.js"), core = /const CORE = \[([\s\S]*?)\];/.exec(sw);
  must(core, "no CORE list in sw.js");
  const files = [...core[1].matchAll(/"([^"]+)"/g)].map(m => m[1]).filter(f => f !== "./");
  files.forEach(f => must(exists(f), f + " is missing"));
  new Function(sw.replace(/self\.addEventListener/g, "(() => {})"));   // parses
  return files.length + " files";
});
step("every web manifest icon exists", () => {
  const m = JSON.parse(read("manifest.webmanifest"));
  must(m.icons && m.icons.length, "no icons");
  m.icons.forEach(i => must(exists(i.src), i.src + " is missing"));
  must(exists(m.start_url.replace(/^\.\//, "")), "start_url missing");
});

/* 5. server and the automated checks */
step("server.js parses", () => { execFileSync(process.execPath, ["--check", path.join(ROOT, "server.js")]); });
for (const s of ["check-life-planner.mjs", "check-life-journal.mjs", "check-services.mjs", "check-coloring.mjs", "check-infinite.mjs", "check-hybrid.mjs", "check-pcg.mjs", "check-clinical.mjs", "check-license.mjs"]) step(s, () => {
  const out = execFileSync(process.execPath, [path.join(ROOT, "scripts", s)], { encoding: "utf8" }).trim().split("\n")[0];
  return out;
});

/* 6. navigation and links */
step("the navigation is current on every page", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "site-nav.mjs"), "--check"], { encoding: "utf8" }).trim(); }
  catch (e){ throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message); }
});
step("the Research Center pages are current", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "research-pages.mjs"), "--check"], { encoding: "utf8" }).trim(); }
  catch (e){ throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message); }
});
step("the Research Center's page script parses", () => { execFileSync(process.execPath, ["--check", path.join(ROOT, "assets", "research-center.js")]); });
step(`every relative link resolves on all ${pages.length} pages`, () => {
  let n = 0; const broken = new Set();
  for (const f of pages){
    const dir = path.posix.dirname(f), h = read(f).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
    for (const m of h.matchAll(/\s(?:href|src|action|poster)\s*=\s*(["'])([^"']*)\1/gi)){
      const v = m[2].trim();
      if (!v || /^(#|[a-z][a-z0-9+.-]*:|\/\/)/i.test(v)) continue;
      let t = decodeURIComponent(v.replace(/[?#].*$/, ""));
      if (!t) continue;
      t = t.startsWith("/") ? t.slice(1) : path.posix.join(dir, t);
      const full = path.join(ROOT, t), ok = fs.existsSync(full) && (!fs.statSync(full).isDirectory() || fs.existsSync(path.join(full, "index.html")));
      n++; if (!ok) broken.add(`${f}: ${v}`);
    }
  }
  must(!broken.size, broken.size + " broken:\n      " + [...broken].slice(0, 20).join("\n      "));
  return n + " links";
});

if (fails.length){ console.log(`\nBuild check FAILED (${fails.length}):\n  - ` + fails.join("\n  - ")); process.exit(1); }
console.log("\nBuild completed: every check passed.");
