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
        services and Cognicopia Coloring checks pass (the design-system check
        re-computes every contrast pair in css/styles.css and proves the SVG
        tracing script, js/coloring.js and their data agree) (the coloring check
        also proves the library, catalog and browser bundle are current,
        and the trace check proves the line-art tracer, the tier
        derivation and the art files;
        the hybrid check proves the coloring subjects, their manifest and
        bundle are current, and draws every subject at every stage; the
        procedural-content check proves Today's Packet is the same all day,
        new each morning, stage-appropriate, one step from the resident's
        interests and free of anything on the avoid list);
     5b. in a real browser (where Playwright is installed): every control on
        the tools, in the states a person reaches and in every page type's
        sidebar is at least 52 px, and no text is below WCAG AA by day or in
        Night Shift (scripts/audit-ux.mjs), the six hubs open, close and mark
        the current page as a person expects (scripts/check-nav-ui.mjs), and the
        Shift board does what it says, down to what is stored and what prints
        (scripts/check-shift-ui.mjs), and licensing and pricing do what they
        say: the 25-packet limit, the upgrade screens, a pasted key, activation,
        months offline, and that only activate.html contacts anything
        (scripts/check-license-ui.mjs), and the design system does what its
        source says: the focus ring, motion that stops when asked, the scroll
        layers, type, the first screen, the coloring script and a printed sheet
        read back from its PDF (scripts/check-design-ui.mjs), and the Academy
        works: its design at AAA, the player, saved progress, the knowledge check,
        the certificate and the print sheets (scripts/check-academy-ui.mjs);
     6. no page or tool text makes a claim the product cannot back (such as
        "HIPAA compliant"; scripts/check-claims.mjs);
     7. the site navigation matches scripts/site-nav.mjs (npm run nav), the
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
const SKIP = new Set([".git", "node_modules", ".next"]);   // .next: the SaaS platform's build output (platform/), never part of the site
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
for (const s of ["check-life-planner.mjs", "check-life-journal.mjs", "check-services.mjs", "check-coloring.mjs", "check-trace.mjs", "check-infinite.mjs", "check-hybrid.mjs", "check-pcg.mjs", "check-clinical.mjs", "check-quality-hub.mjs", "check-clinical-alignment.mjs", "check-soothing.mjs", "check-license.mjs", "check-license-service.mjs", "check-trial.mjs", "check-localdb.mjs", "check-contentcatalog.mjs", "check-contentmatcher.mjs", "check-coloringagent.mjs", "check-design-system.mjs", "check-claims.mjs"]) step(s, () => {
  const out = execFileSync(process.execPath, [path.join(ROOT, "scripts", s)], { encoding: "utf8" }).trim().split("\n")[0];
  return out;
});

/* 5b. what only a browser can measure: tap targets and contrast (npm run audit:ux). Runs where Playwright is installed; says so where it is not. */
step("every control is at least 52 px and no text is below WCAG AA (a real browser)", () => {
  try {
    const out = execFileSync(process.execPath, [path.join(ROOT, "scripts", "audit-ux.mjs"), "--only", "targets,contrast,nav", "--strict"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return /Every budget that was measured is met/.test(out) ? "measured on every page and state, and in the sidebar of every page type, by day and in Night Shift" : out.trim().split("\n").pop();
  } catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim().split("\n").filter(l => /budget|under|below|control|text element/i.test(l)).slice(0, 12).join("\n      ") || e.message);
  }
});

step("the navigation behaves: hubs open and close, the current page is marked, the Packet Builder's sidebar follows its screens (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-nav-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the Shift board works: notes, tasks, the name check, encrypted storage, retention, the print sheet, a locked backup and the unlock (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-shift-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the Academy works: the cream and forest-green design at AAA, the dashboard, search and pills, the player (play, skip, speeds, volume, captions, bookmarks, keyboard), sealed saved progress, the knowledge check, the certificate, the record, Letter print sheets and 52 px controls (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-academy-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the license desk makes keys the system accepts, and nothing can leave the page (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-license-desk-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the free-packet count survives a lowered number, a deleted setting and either copy going missing, the tools share it, and clearing everything starts over as stated (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-trial-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the local database keeps residents and packets, sealed at rest, locked when the store is locked, and nothing leaves the page (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-localdb-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the content catalog loads from the site, a missing, foreign or damaged file gives the stand-in, and it works offline from the saved copy (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-contentcatalog-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("Themed Pages in the roster: five pages from the resident's own interests at their own level, nothing clipped, in black and white, and a catalog that cannot be read still prints (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-contentmatcher-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the Coloring Agent's Describe a page tab: a typed and a random page with no gray, the saved PNG read byte by byte, all 150 pictures at three tiers, Add to packet, the free-packet gate, the spinner, a slow source falling back, plain sentences, 52 px, contrast by day and Night Shift, a phone, and nothing requested from outside the page (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-coloringagent-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("licensing and pricing work: the 25-packet limit, the upgrade screens, pasted keys, activation, months offline, the invoice request, and only activate.html contacts anything (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-license-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the design system works: the focus ring, motion that stops when asked, the scroll layers, type, the first screen, the coloring script, and a printed sheet read back from its PDF (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-design-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

/* 6. navigation and links */
step("the navigation is current on every page", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "site-nav.mjs"), "--check"], { encoding: "utf8" }).trim(); }
  catch (e){ throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message); }
});
step("the crossword on the front page's laptop is the one the engine makes", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "landing-example.mjs"), "--check"], { encoding: "utf8" }).trim(); }
  catch (e){ throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message); }
});
step("findability: every public page has its own title, description and canonical address, the sitemap and robots.txt are current, and the front page's JSON-LD prices are the ones in src/config/license.js", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "seo.mjs"), "--check"], { encoding: "utf8" }).trim(); }
  catch (e){ throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message); }
});
step("the sample packet on the site is the PDF the tool makes now (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "sample-packet.mjs"), "--check"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
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
