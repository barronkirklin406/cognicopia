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
        Night Shift (scripts/audit-ux.mjs), the seven places open, close and mark
        the current page as a person expects (scripts/check-nav-ui.mjs), and the
        Shift board does what it says, down to what is stored and what prints
        (scripts/check-shift-ui.mjs), and licensing and pricing do what they
        say: the 50-packet limit, the upgrade screens, a pasted key, activation,
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
for (const s of ["check-outreach.mjs", "check-life-planner.mjs", "check-life-journal.mjs", "check-services.mjs", "check-coloring.mjs", "check-coloring-margins.mjs", "check-trace.mjs", "check-infinite.mjs", "check-hybrid.mjs", "check-shift-calendar.mjs", "check-describe.mjs", "check-resident-context.mjs", "check-public-domain.mjs", "check-activity-studio.mjs", "check-activity-life.mjs", "check-spacing.mjs", "check-facility-validator.mjs", "check-reminiscence-pages.mjs", "check-pcg.mjs", "check-clinical.mjs", "check-clinical-staging.mjs", "check-facility-ops.mjs", "check-resident-engine.mjs", "check-quality-hub.mjs", "check-clinical-alignment.mjs", "check-soothing.mjs", "check-license.mjs", "check-license-service.mjs", "check-net30-desk.mjs", "check-trial.mjs", "check-localdb.mjs", "check-contentcatalog.mjs", "check-contentmatcher.mjs", "check-coloringagent.mjs", "check-local-art.mjs", "check-tablet.mjs", "check-voice-kit.mjs", "check-design-system.mjs", "check-claims.mjs", "check-favicon.mjs"]) step(s, () => {
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

step("the Shift board calendar: Month, Week and Day, coverage and badges, the staffing insight, the weekly PDF read back, the slide-out board, Ctrl+K lookup, 52 px, a phone (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-shift-calendar-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the Packet Builder's house styles on its printed sheets: four looks by resident and month, calm mode plain, nothing moved in any look, HTML and engine sheets, the late stage plain (a real browser, the PDFs read back)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-builder-looks-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the packet's house styles and its reminiscence pages: four title looks chosen by resident and month, the same pages in every look, Your years, My memory map and Sensory memory cards from the form, the avoid list (a real browser, the PDFs read back)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-packet-looks-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("Activity Page Studio: the settings and the live 3:4 page, every module and style, topics to avoid, the PDF read back (Letter, 0.5 in margins, the gutter), the PNG, print, 52 px, a phone (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-activity-studio-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("Describe & Create: the Packet Builder's Describe a picture and the front page's A picture to color choose the drawing the words name, the packet PDF uses it (read back), refusals, 52 px, a phone (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-describe-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the Resident Roster: initials rows and cards, filter chips with counts, search by words and accents, sort and view remembered, the keyboard, the first-use screen, 52 px, a phone (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-roster-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the residents folder: locked files named by codes, only what changed written, the newer copy winning both ways, residents arriving and leaving, brought back with the passphrase and refused without it, the browser asking again, stop, a browser without folders (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-resident-folder-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the Activity Page Studio's PDF is real words and lines in embedded faces: the same as its picture, no line under 2 pt, inside the margins, a tenth the size; a page that cannot be drawn exactly falls back to a picture and says so (a real browser, the PDFs read back)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-studio-pdf-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("Daily engagement: three choices and one button, a card for every kind of time at every stage, a saved resident's own life and avoid list, the PDF read back, the free packets and the gate, the roster's fuller cards, the three doors (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-daily-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("How to use and a clinical tip on the Studio, the Packet Builder and the Facility Portal; Speak on the profile's notes and the Shift board's note, asking the browser only when pressed, on the device only, greyed out with the reason elsewhere, a dictated name warned of (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-help-dictation-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("High spacing / low visual crowding in the Activity Page Studio and the Packet Builder: a 52 px choice beside the stage and the hands, about half as many items on a page, a bold box round each, the same black and white and type sizes; kept in Settings, offered on every activity, remembered by the pages added to the packet; every activity built with it on (a real browser, day and Night Shift, 1366 x 768 and 390 x 844)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-spacing-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("How the stages are named on staff screens: a choice in Settings (each screen as it is, Stage, ACL or GDS), kept on this computer, followed by the Studio, the Builder, the profile, the active resident bar and the daily card; the kind of work each of the 24 Studio pages does, on the staff screen only, never on a page or in the resident's tablet menu (a real browser, day and Night Shift, 1366 x 768 and 390 x 844)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-stage-labels-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("Therapy goals to a cueing guide: one plain line for each goal a therapist set and has not marked met, in the staff strip of the Studio and of Daily engagement, the same for every resident, never on a page or in print (a real browser, day and Night Shift, 1366 x 768 and 390 x 844)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-cueing-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("The one-tap engagement log (three buttons and an optional line, on Daily engagement, in the Tablet Activities staff panel and at the top of the Roster's record; one tap, one entry; a line naming the resident refused) and the Family Visit Companion Sheet (what went well lately, their songs and comforts, a picture to color together; the profile as the fallback; a topic to avoid kept off) (a real browser, day and Night Shift, 1366 x 768 and 390 x 844)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-engagement-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("The activity documentation summary on the Facility Portal's Audit readiness tab: one US Letter page for each resident chosen (what is known about them, the packets made and the sessions taken part in over 30 days, how pages are made for them, what is kept off), names or aliases as the facility chose, staff text at 16 pt or more, pure black on white, read back from a real PDF; it supports records and claims no proof or compliance (a real browser, day and Night Shift, 1366 x 768 and 390 x 844)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-activity-docs-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("Calm now: a button on the active resident bar and the Packet Builder's Working with bar opens a modal for staff (their comforts and favorite dish, safe things to talk about, the topics to avoid written out, lines that ask nothing, songs of their years by title, the line to follow the facility's own protocol), one printed staff page read back from a real PDF, a topic to avoid kept off every list; and the late-stage \"to hold\" line for staff on Daily engagement and the Studio (a real browser, day and Night Shift, 1366 x 768 and 390 x 844)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-calm-now-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("The group circle on Daily engagement: two to eight saved residents and a theme give a leader's script with a line for each person at their own stage, by name; the avoid lists are joined (a thing any of them avoids is out for everyone, a theme one avoids is not offered); one staff page read back from a real PDF (a real browser, day and Night Shift, 1366 x 768 and 390 x 844)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-group-circle-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("A coloring page from a photo and a door sign in the Activity Page Studio: a chosen photo is turned into a picture of pure black and white (3:4, lines at least 3 pt thick, a sensible amount of ink, a plain note on how it came out), kept in memory only and never in the browser's storage; the coloring page has a 32 pt real-text title and the picture is read back from a real PDF as pure black and white; the door sign has the name, where they come from, their work and a drawing, and Remove brings back a frame with room for a photo; a topic to avoid changes the drawing; 52 px and 7:1 by day and in Night Shift (a real browser, PyMuPDF), nothing requested from outside the page", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-photo-pages-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("The family intake form on the profile page: a blank form prints on one US Letter page in pure black with 3 pt writing lines and type of 16 pt or more; a family member's answers are saved as a LOCKED file by default (a passphrase of 10 or more characters typed twice; short or different ones refused; the file holds none of the words typed), the plain file is a labelled second choice behind a warning, the same answers show as QR codes that need the passphrase; staff open the file on another computer (a wrong passphrase refused in plain words) and the person arrives as a new resident marked as written by a family, never over an existing one; nothing typed is kept in the browser's storage; 52 px and 7:1 by day and in Night Shift (a real browser, PyMuPDF)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-family-intake-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("The one-page shift handover on the Shift board: a button beside the board's other print buttons makes one US Letter staff page (type 16 pt or more, pure black, binding side kept, read back from a real PDF) with the recorded words by alias or room, the calming approaches used, and who is coming on the next shift from the staffing calendar (initials, how many of how many); a resident's name typed into a note never reaches the page; the button stores no resident, note or calendar data; 52 px and 7:1 by day and in Night Shift (a real browser, PyMuPDF)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-shift-handover-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("Staff documents never count against the free packets: the Shift board's handoff, SBAR and one-page handover sheets, the Shift highlights and the circle script on Daily engagement print with all 50 free packets used, the gate stays shut and the count is the same afterwards; a packet print is still stopped at 50 and uses one at 49; the staff mark itself moves nothing (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-staff-prints-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("The variety memory, the era banks and the hybrid sheets (assets/services/variety.js, eraBanks.js, hybridSheets.js): every click its own seed, an item does not come back until the pool has been used, every entry dated and clear of quiz and loss wording, songs from 1930 or earlier, slogans short and listed for review, every dated fact inside born + 7 to + 28 for births 1925 to 1965, a mix of decades with no birth year, two or three hand-under-hand tips per layout, and a topic to avoid never printed", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-variety.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim().split("\n").pop(); }
  catch (e){ throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message); }
});

step("The personal life-detail lexicon (assets/services/personalLexicon.js): a resident's own words (brothers and sisters with their place in the family, pets with their kind, the first car, the town, the work, the birth year) each get one clue true of that exact answer and the letters it takes in a grid; no order, kind or year is ever invented; topics to avoid and people who have passed away are left out; a profile with under three facts is thin; late stage gets no crossword or word search (scripts/check-personal-lexicon.mjs)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-personal-lexicon.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim().split("\n").pop(); }
  catch (e){ throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message); }
});

step("The resident's own words in the word search and the crossword, proved on real PDFs read back with PyMuPDF: the detail fields are kept, early stage word search hints and clue crossword clues are the true ones for their answers with the letters really in the grid, the avoid list is respected, a thin profile is not called 'from your life', late stage has neither puzzle (scripts/check-personal-puzzles-ui.mjs)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-personal-puzzles-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim().split("\n").pop(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright or PyMuPDF is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("Fresh-every-click packets, proved on real PDFs read back with PyMuPDF: three Quick Print clicks and three packet clicks give three different packets, each with hybrid trace-and-talk pages at least 60% full and pure black on white, the staff sheet on page 1 listing each with its tips (hand-under-hand), what this browser remembers holds ids only and clears, nothing leaves the page", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-hybrid-pages-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim().split("\n").pop(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright or PyMuPDF is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("Page economy and the Staff Companion Sheet in the front-page packet, proved on real PDFs read back with PyMuPDF at every stage with every page ticked and with the default pages: page 1 is the Staff Companion Sheet and lists each page by its title with its tip and therapy approach; no resident page carries a clinical tip or therapy tag; no resident page is a \"(continued)\" page; every resident page is at least 60% full.", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-packet-economy-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim().split("\n").pop(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright or PyMuPDF is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("One era rule for every tool (assets/services/eraWindow.js): a person's formative years are birth year + 7 to + 28. For made-up births from 1920 to 1965 the reminiscence engine, the Activity Page Studio (songs, the year they turned twenty, timeline events) and the packet tool's decade lists stay inside those years, and ration books never reach a resident born in 1946.", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-era-window.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim().split("\n").pop(); }
  catch (e){ throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message); }
});

step("The packet tool's clinical content rules, proved on real PDFs read back with PyMuPDF (made-up people only): the pronoun box starts blank and a blank never says her, his or him; military questions print only when military service is a welcome topic; a blank faith prints no hymns, a Catholic only hymns that suit, a Jewish resident none of the Christian hymns; the Quick packet's headings are neutral under 3 known facts; the staff sheet counts the facts known out of 8 and asks the family about work, hometown and one joy.", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-clinical-rules-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright or PyMuPDF is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("Printing a week or a month for a whole wing needs a facility license or a 30-day pilot: in the Packet Builder's Facility Portal the week and month print buttons open the license window with the reason, print nothing and spend no free packet without one, and print with a signed key (the example community, made-up people only).", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-week-print-license-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("Resident Mode in Tablet Activities: only the activities and no link out, the search closed, kept on reload; a 2.5 second hold (mouse, Enter or a finger) to leave, a tap does nothing; a PIN kept as a salted hash, a wrong one refused (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-tablet-resident-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the packet tool's cover at once and the packet a page at a time: page 1 shown in under 150 ms, the progress line, the same packet word for word (also slowed tenfold with other code drawing random numbers between steps), the picture's lines where page 1 has them (a real browser, the PDFs read back)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-packet-stepped-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("a resident handed to an iPad by QR codes: a handful of locked codes with no readable name or photo, each read back by the saved reader, opened with the passphrase; the loop on the roster; a stand-in camera reading a video of the codes into a second browser's roster (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-qr-handoff-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the Packet Builder's home in three tabs: four presets for a stage or a resident (their name, stage, years and topics to avoid), only the activities made for a stage, the categories; at most eight choices a tab, 52 px and readable by day and in Night Shift (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-builder-home-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("wayfinding: the search on every kind of page, a resident and a tool together, the active-resident bar (Switch, Clear, the tools starting from it, aliases on the Shift board), Start here once after the terms with a card on each page, up to four pinned tools; 52 px and readable by day and in Night Shift (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-wayfinding-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the profile's optional story (moments, a dish, comforts, a photo kept sealed and gray) is saved, shown again and used by the Studio's pages (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-profile-story-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the Family Life Digest buttons on the front page open the shipped drawer and make a one-page PDF that names the person (a real browser, the PDF read back)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-family-digest-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the Activity Page Studio and the free trial: a PDF or print uses one free packet, the badge and the line agree, the gate stops print, PDF and image when all 50 are used, a real signed key means no limit (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-studio-trial-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the roster handoff, with two separate browsers: the file is locked, a wrong or missing passphrase is refused, every resident arrives whole by default and sealed, an alias file drops the names and says so, nobody is added twice, a newer copy is kept (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-roster-handoff-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
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

step("the facility logo on the monthly bundle: chosen, turned into pure black and white, refused when wrong, kept on this computer, printed on the index and every cover sheet and read back from the PDF, nothing leaving the page (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-facility-logo-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the packet tool's quick start: three boxes and one button first (first name, year of birth, one joy), a whole packet from those three, and the offer of the full profile after it, 52 px and 7:1 by day and in Night Shift (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-quickstart-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the condition adaptation: one optional choice on the resident's profile, saved and read back, and the packet tool showing only the set of pages it names, open, with the name already in its form (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-adaptation-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("Tablet Activities: all thirteen activities driven by mouse and touch input, the on-screen keyboard, the trace rule, three screen sizes, the free-packet gate, nothing leaving the page (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-tablet-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the clinical staging works: tiers with their GDS in all four tools, therapy anchors, avoidance protocols, Sundowning / De-escalation mode, nothing leaving the page (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-clinical-staging-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the facility operations work: census import, wings kept apart, the zero-telemetry statement, activity and mood records, the SBAR sheet, Session Notes copy for the health record, names choices on exports, nothing leaving the page (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-facility-ops-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("one resident across the tools: the daily record and the suggested tier, the staff companion kept apart from the resident's pages, the two menu groups (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-resident-engine-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the Packet Builder's buttons: the audited ones do what they say, the chosen resident stays chosen across 14 screens, the icons are large, no console errors (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-builder-buttons-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the 28 nostalgia, botanical, harvest and home coloring titles: registered with three tiers, found by name, previewed, queued and printed in pure black and white (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-coloring-titles-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("a page printed straight from the browser: no navigation, buttons or fields, a white page, pure black, margins and a binding gutter, read back from real PDFs (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-print-pages-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("print audit: every page, every Packet Builder activity at every level and the front page's packet, printed to PDF and read back (one sheet a page, pure black, margins, nothing of the web page on the paper) (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "audit-print.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 }).trim().split("\n").slice(-1)[0]; }
  catch (e){
    if (e.status === 2) return "skipped: Playwright or PyMuPDF is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("voice settings: the device's natural voices ranked, three paces, a preview and test sentence, the Academy's High-Fidelity switch, 52 px, nothing leaving the page (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-voice-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the 15-minute inactivity timeout: five kinds of activity restart it, then the screen is cleared and the saved roster, license and count are kept (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-session-timeout.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("terms and disclaimer: the owner's wording, the first-visit agreement kept in this browser only, the non-medical line on every PDF page and printed sheet (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-terms.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the invoice request maker: the form's rules, PO PENDING, totals from the price file, the PDF read back from a real download, nothing sent anywhere (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-invoice.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the Contact & Support page: the owner's header sentence, the message form opening the mail program, Send an Email, Copy Email and their fallbacks, 52 px controls, nothing leaving the page (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-contact-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the Staff Guide and Feature Tour: four practice screens, the FAQ, the one-page Quick-Start PDF read back, the wording rules, 52 px controls, 7:1 text, nothing leaving the page (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-staff-guide.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the Tablet Activities button never ends on a 404: the page opens, and a missing or mistyped page falls back to the in-page tablet mode (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-tablet-route.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the Sensory Trigger box in the Cognitive Life Journal reads at 7:1 or better in the day theme and in Night Shift (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-sensory-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("licensing and pricing work: the 50-packet limit, the upgrade screens, pasted keys, activation, months offline, the invoice request, and only activate.html contacts anything (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-license-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e){
    if (e.status === 2) return "skipped: Playwright is not installed here (see docs/dev-setup.md)";
    throw new Error(((e.stdout || "") + (e.stderr || "")).trim() || e.message);
  }
});

step("the free-trial badge counts down on every page, the hero button reads right, and the window when the 50 are used offers a card or a Net-30 invoice (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-trial-badge-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
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

step("printed type: every printed sheet at all three vision tiers and stages stays at 18 pt or more, pure black and inside the page, the PDF packets are read back, and Quick-Print names the resident (a real browser)", () => {
  try { return execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-print-type-ui.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
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
