#!/usr/bin/env node
/* =====================================================================
   Cognicopia UX audit: measures what a script can measure, in a real
   browser, and lists what only a person can judge.

   Measured (numbers, not opinions):
     targets   interactive controls smaller than the minimum tap target, per page and viewport
     contrast  text below WCAG AA against the background behind it, by day and in Night Shift
     nav       how many destinations and groups each sidebar offers
     clicks    clicks (and typed fields) a workflow takes, counted as the script performs it
     print     how long a packet, a coloring PDF and a roster print take to produce
     weight    the size of each tool's page and how long it takes to load

   Left to a person (printed at the end): the principles that need judgment, such as
   consistency, tone and whether a screen feels calm.

   A goal is a claim only once this has measured it. Run it before and after a change and
   compare; docs/ux-baseline.md holds the numbers to beat. Timings are from the machine that
   runs the script: a developer laptop or a sandbox, not a facility PC. Compare like with like.

   Run:  node scripts/audit-ux.mjs                     everything, a table
         node scripts/audit-ux.mjs --only targets,nav  some measurements
         node scripts/audit-ux.mjs --json out.json     also write the numbers
         node scripts/audit-ux.mjs --min-target 52      tap-target minimum in CSS px (default 44)
         node scripts/audit-ux.mjs --list               name every control that is too small, once each
         node scripts/audit-ux.mjs --strict             exit 1 if a budget below is broken
   Needs Playwright (already used by this repo's checks): it is found in node_modules, or in
   /opt/node22/lib/node_modules. It is not part of npm test, because timings vary by machine.
   Serves the repository on a local port; makes no other network request.
   ===================================================================== */
import fs from "fs";
import http from "http";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf("--" + name); return i < 0 ? def : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true); };
const ONLY = opt("only") && opt("only") !== true ? String(opt("only")).split(",") : null;
const want = k => !ONLY || ONLY.includes(k);
const MIN = +(opt("min-target", 44)) || 44;
const STRICT = args.includes("--strict"), LIST = args.includes("--list");

/* Budgets: what "good" means here. Strict mode fails when one is broken. */
const BUDGETS = {
  tapTargetsBelowMin: 0,      // controls under the minimum, per page and viewport
  contrastFailures: 0,        // text below WCAG AA
  clicks: { packet: 1, coloring: 2, roster: 3 },   // clicks to a finished sheet, by workflow
  doherty_ms: 400             // a response a person waits for; printing a whole packet is judged against its own, looser line
};

/* ---------- Playwright ---------- */
function loadPlaywright(){
  for (const base of [ROOT + "/", "/opt/node22/lib/node_modules/", "/usr/lib/node_modules/", "/usr/local/lib/node_modules/"]){
    try { return createRequire(base)("playwright"); } catch (e) { /* try the next place */ }
  }
  console.error("Playwright was not found. Install it (npm install --no-save playwright) or run where it is available.");
  process.exit(2);
}

/* ---------- a static server for the repository ---------- */
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".txt": "text/plain" };
function serve(){
  return new Promise(ok => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" });
      fs.createReadStream(f).pipe(res);
    }).listen(0, "127.0.0.1", () => ok({ srv, base: `http://127.0.0.1:${srv.address().port}/` }));
  });
}

const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const results = { generated: new Date().toISOString().slice(0, 10), minTarget: MIN, targets: [], contrast: [], nav: [], clicks: [], print: [], weight: [] };
const broken = [];

/* the pages and views measured */
const VIEWS = [
  ["index.html", "index.html"], ["profile.html", "profile.html"],
  ["builder home", "builder.html#/"], ["builder coloring", "builder.html#/coloring"], ["builder roster", "builder.html#/roster"],
  ["builder facility", "builder.html#/facility"], ["builder planner", "builder.html#/planner"], ["builder journal", "builder.html#/journal"],
  ["builder academy", "builder.html#/academy"]
];
const VIEWPORTS = [["phone 390", 390, 844], ["laptop 1366", 1366, 768]];

async function main(){
  const { chromium } = loadPlaywright();
  const { srv, base } = await serve();
  const browser = await chromium.launch();
  const open = async (w, h, extra) => { const ctx = await browser.newContext(Object.assign({ viewport: { width: w, height: h }, serviceWorkers: "block", acceptDownloads: true }, extra || {})); const page = await ctx.newPage(); page.on("dialog", d => d.accept()); return { ctx, page }; };

  /* ---------- weight and load ---------- */
  if (want("weight")){
    for (const f of ["index.html", "builder.html", "profile.html"]){
      const bytes = fs.statSync(path.join(ROOT, f)).size, times = [];
      for (let i = 0; i < 3; i++){
        const { ctx, page } = await open(1366, 768);
        const t0 = Date.now(); await page.goto(base + f, { waitUntil: "load" }); times.push(Date.now() - t0); await ctx.close();
      }
      results.weight.push({ page: f, kb: Math.round(bytes / 1024), load_ms: median(times) });
    }
  }

  /* ---------- tap targets ---------- */
  if (want("targets")){
    for (const [vname, w, h] of VIEWPORTS){
      const { ctx, page } = await open(w, h);
      for (const [label, url] of VIEWS){
        await page.goto(base + url, { waitUntil: "load" }); await page.waitForTimeout(700);
        const r = await page.evaluate(min => {
          const sel = "button, a[href], select, input:not([type=hidden]), textarea, summary, [role=button], [role=tab], [role=switch], [tabindex]:not([tabindex='-1'])";
          const all = [...document.querySelectorAll(sel)].filter(el => {
            const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
            if (!b.width || !b.height || cs.visibility === "hidden" || cs.display === "none" || el.closest("[hidden], .sr-only, [aria-hidden='true']")) return false;
            if (el.closest("details:not([open]) > :not(summary)")) return false;
            if (el.tagName === "A" && cs.display === "inline" && el.closest("p, li, td, dd")) return false;                       // a link in a sentence (WCAG 2.2 inline exception)
            if ((el.type === "checkbox" || el.type === "radio") && el.closest("label")) return false;                            // the label is the target
            if (el.tagName === "INPUT" && el.type === "file") return false;
            return true;
          });
          const small = all.filter(el => { const b = el.getBoundingClientRect(); return b.height < min - .5 || b.width < min - .5; });
          return { total: all.length, small: small.length, sample: small.slice(0, 4).map(el => { const b = el.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)} ${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${typeof el.className === "string" && el.className ? "." + el.className.split(" ")[0] : ""} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24)}"`; }),
            all: small.map(el => { const b = el.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)} ${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).join(".") : ""} "${(el.textContent || el.getAttribute("aria-label") || el.getAttribute("title") || el.value || "").trim().replace(/\s+/g, " ").slice(0, 28)}"`; }) };
        }, MIN);
        results.targets.push({ view: label, viewport: vname, total: r.total, below_min: r.small, sample: r.sample, all: LIST ? r.all : undefined });
        if (r.small > BUDGETS.tapTargetsBelowMin) broken.push(`${label} @${vname}: ${r.small} control(s) under ${MIN} px`);
      }
      await ctx.close();
    }
  }

  /* ---------- contrast ---------- */
  if (want("contrast")){
    const measure = () => {
      const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
      const lum = c => { const f = x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
      const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
      const bgOf = el => { const stack = []; for (let e = el; e; e = e.parentElement){ const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0){ stack.push(c); if (c.a >= 1) break; } } let out = { r: 255, g: 255, b: 255, a: 1 }; for (let i = stack.length - 1; i >= 0; i--) out = blend(stack[i], out); return out; };
      let total = 0; const bad = [], seen = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
      while ((n = walker.nextNode())){
        const t = n.textContent.trim(); if (!t) continue;
        const el = n.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
        const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue;
        const cs = getComputedStyle(el); if (cs.visibility === "hidden" || +cs.opacity === 0) continue;
        if (el.closest("[hidden], script, style, svg, noscript, option, .sr-only")) continue;
        let hidden = false; for (let e = el; e; e = e.parentElement) if (getComputedStyle(e).display === "none"){ hidden = true; break; } if (hidden) continue;
        const fg = parse(cs.color), bg = bgOf(el); if (!fg || !bg) continue;
        const f = blend(fg, bg); total++;
        const L1 = lum(f), L2 = lum(bg), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
        const size = parseFloat(cs.fontSize), large = size >= 24 || (+cs.fontWeight >= 700 && size >= 18.66), need = large ? 3 : 4.5;
        if (ratio < need) bad.push(`${ratio.toFixed(2)} < ${need} ${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} "${t.slice(0, 28)}"`);
      }
      return { total, bad };
    };
    for (const mode of ["day", "night"]){
      const { ctx, page } = await open(1366, 768);
      for (const [label, url] of VIEWS.slice(0, 5)){
        await page.goto(base + url, { waitUntil: "load" }); await page.waitForTimeout(700);
        if (mode === "night") await page.evaluate(() => { document.documentElement.classList.add("cg-night-shift"); document.body.classList.add("cg-night-shift"); }), await page.waitForTimeout(500);
        const r = await page.evaluate(measure);
        results.contrast.push({ view: label, mode, text_elements: r.total, below_aa: r.bad.length, sample: r.bad.slice(0, 3) });
        if (r.bad.length > BUDGETS.contrastFailures) broken.push(`${label} (${mode}): ${r.bad.length} text element(s) below WCAG AA`);
      }
      await ctx.close();
    }
  }

  /* ---------- navigation ---------- */
  if (want("nav")){
    const { ctx, page } = await open(1366, 768);
    for (const [label, url, links, groups] of [
      ["index.html sidebar", "index.html", ".cg-sidebar-nav a", "details.cg-sb-acc"],
      ["builder sidebar", "builder.html#/", ".sb-link", ".sb-group, .sb-heading, nav h2, nav h3"]
    ]){
      await page.goto(base + url, { waitUntil: "load" }); await page.waitForTimeout(500);
      const r = await page.evaluate(([l, g]) => {
        const links = [...document.querySelectorAll(l)], vis = links.filter(a => { const b = a.getBoundingClientRect(); return b.width && b.height; });
        return { links: links.length, visible_without_opening: vis.length, groups: document.querySelectorAll(g).length, top_level: [...new Set(links.map(a => (a.getAttribute("href") || "").split("#")[0] || a.dataset.route || ""))].length };
      }, [links, groups]);
      results.nav.push(Object.assign({ view: label }, r));
    }
    await ctx.close();
  }

  /* ---------- clicks and print time ---------- */
  if (want("clicks") || want("print")){
    /* a counted workflow: every click the person would make goes through step() */
    const counter = page => { let clicks = 0, typed = 0; return { click: async (sel, o) => { clicks++; await page.click(sel, o); }, fill: async (sel, v) => { typed++; await page.fill(sel, v); }, get clicks(){ return clicks; }, get typed(){ return typed; } }; };

    /* packet for one resident (index.html): name and year typed, one click on Generate */
    {
      const times = []; let clicks = 0, typed = 0, err = null;
      for (let i = 0; i < 3; i++){
        const { ctx, page } = await open(1366, 768);
        await page.goto(base + "index.html", { waitUntil: "load" }); await page.waitForTimeout(500);
        await page.evaluate(() => { window.print = () => {}; try { localStorage.clear(); } catch (e) {} });
        const s = counter(page);
        try {
          await s.fill("#first", "Walter"); await s.fill("#born", "1938");
          const t0 = Date.now(); await s.click("#go");
          await page.waitForFunction(() => { const d = document.querySelector(".done"); return d && getComputedStyle(d).display !== "none"; }, null, { timeout: 60000 });
          times.push(Date.now() - t0); clicks = s.clicks; typed = s.typed;
        } catch (e) { err = String(e.message).split("\n")[0]; }
        await ctx.close();
      }
      if (err) results.clicks.push({ workflow: "A packet for one resident", error: err });
      else {
        results.clicks.push({ workflow: "A packet for one resident (index.html)", clicks, typed_fields: typed, to: "a finished packet", budget: BUDGETS.clicks.packet });
        results.print.push({ what: "Packet for one resident, click to finished", median_ms: median(times), runs_ms: times });
        if (clicks > BUDGETS.clicks.packet) broken.push(`packet workflow takes ${clicks} clicks`);
      }
    }

    /* a coloring page as a PDF (Packet Builder): choose the picture, download */
    {
      const { ctx, page } = await open(1366, 900);
      try {
        await page.goto(base + "builder.html#/coloring", { waitUntil: "load" }); await page.waitForSelector(".cc-card", { timeout: 20000 });
        const s = counter(page);
        await s.click(".cc-card >> nth=0");
        const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), s.click('button:has-text("Download PDF")')]);
        await dl.path();
        results.clicks.push({ workflow: "A coloring page as a PDF (Packet Builder)", clicks: s.clicks, typed_fields: s.typed, to: "a downloaded PDF", budget: BUDGETS.clicks.coloring });
        if (s.clicks > BUDGETS.clicks.coloring) broken.push(`coloring workflow takes ${s.clicks} clicks`);
        const ms = await page.evaluate(async () => {
          const L = CogniLibrary, JsPDF = await L.loadPdfKit(), st = L.state(), ids = ["sunflower", "red-barn", "farm-tractor", "barn-owl", "vintage-bicycle", "rotary-telephone"].filter(id => CognicopiaColoring.design(id));
          st.picks = ids; st.tier = 2; const list = ids.map((id, i) => L.pageOpts(i)), runs = [];
          for (let i = 0; i < 3; i++){ const t0 = performance.now(); L.buildPdf(JsPDF, list); runs.push(Math.round(performance.now() - t0)); }
          return { runs, n: ids.length };
        });
        results.print.push({ what: `Coloring PDF, ${ms.n} pages, Tier 2 (drawing only; the PDF library is already loaded)`, median_ms: median(ms.runs), runs_ms: ms.runs });
      } catch (e) { results.clicks.push({ workflow: "A coloring page as a PDF", error: String(e.message).split("\n")[0] }); }
      await ctx.close();
    }

    /* a book for a saved resident (roster): resident, book, print */
    {
      const { ctx, page } = await open(1280, 900);
      try {
        await page.goto(base + "builder.html#/", { waitUntil: "load" }); await page.waitForTimeout(300);
        const prof = (id, name, tier) => ({ schema: "cognicopia.residentProfile", version: 2, id, createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-09-01T10:00:00Z",
          tier1_core: { preferredName: name, unitNumber: "Test 1", cognitiveTier: tier, visualNeeds: null, occupation: { code: "teacher", label: "Teacher" }, topHobbies: [{ code: "gardening", label: "Gardening" }], printNeeds: {}, topicsToAvoid: { topics: [], other: "" }, difficulty: { level: 3 } },
          tier2_enrichment: { birthYear: 1936, hometown: { place: "Test City" } }, tier3_deep: { notes: "", people: [] } });
        await page.evaluate(list => { localStorage.clear(); list.forEach(x => localStorage.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))); }, [prof("res-a", "Test A", 2), prof("res-b", "Test B", 1)]);
        await page.goto(base + "builder.html#/roster", { waitUntil: "load" }); await page.reload({ waitUntil: "load" });     // a reload, so the page seals and reads the saved profiles
        await page.waitForSelector(".rs-res", { timeout: 20000 });
        await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed = performance.now(); }; });
        const s = counter(page);
        await s.click('.rs-res[data-id="res-a"]'); await s.click('label.lp-scope:has(input[value="journal"])');
        const t0 = Date.now(); await s.click("#rsPrint");
        await page.waitForFunction(() => window.__printed > 0, null, { timeout: 60000 });
        results.clicks.push({ workflow: "A book for a saved resident (roster)", clicks: s.clicks, typed_fields: s.typed, to: "the print window", budget: BUDGETS.clicks.roster });
        results.print.push({ what: "Roster journal for one resident, Print click to print window", median_ms: Date.now() - t0, runs_ms: [Date.now() - t0] });
        if (s.clicks > BUDGETS.clicks.roster) broken.push(`roster workflow takes ${s.clicks} clicks`);
      } catch (e) { results.clicks.push({ workflow: "A book for a saved resident (roster)", error: String(e.message).split("\n")[0] }); }
      await ctx.close();
    }
  }

  await browser.close(); srv.close();
}

/* ---------- report ---------- */
const pad = (s, n) => String(s).padEnd(n);
function report(){
  const out = [];
  out.push(`Cognicopia UX audit, ${results.generated}. Tap-target minimum ${MIN} px. Timings are from this machine only.\n`);
  if (results.weight.length){ out.push("PAGE WEIGHT AND LOAD"); results.weight.forEach(r => out.push(`  ${pad(r.page, 14)} ${String(r.kb).padStart(6)} KB   load ${r.load_ms} ms`)); out.push(""); }
  if (results.targets.length){
    out.push(`TAP TARGETS under ${MIN} px (controls that are not links inside a sentence)`);
    results.targets.forEach(r => out.push(`  ${pad(r.view, 18)} ${pad(r.viewport, 14)} ${String(r.below_min).padStart(3)} of ${String(r.total).padStart(3)}${r.sample.length ? "   e.g. " + r.sample.slice(0, 2).join("; ") : ""}`));
    out.push("");
    if (LIST){
      out.push("EVERY CONTROL UNDER THE MINIMUM (once per kind, with the views it appears in)");
      const seen = new Map();
      results.targets.forEach(r => (r.all || []).forEach(x => { const k = x.replace(/^\d+x\d+ /, ""); const e = seen.get(k) || { size: x.match(/^\d+x\d+/)[0], views: new Set() }; e.views.add(r.view + " " + r.viewport.split(" ")[0]); seen.set(k, e); }));
      [...seen].sort((a, b) => b[1].views.size - a[1].views.size).forEach(([k, e]) => out.push(`  ${pad(e.size, 8)} ${k}   [${[...e.views].slice(0, 3).join(", ")}${e.views.size > 3 ? ", +" + (e.views.size - 3) : ""}]`));
      out.push("");
    }
  }
  if (results.contrast.length){
    out.push("CONTRAST below WCAG AA (text against its background)");
    results.contrast.forEach(r => out.push(`  ${pad(r.view, 18)} ${pad(r.mode, 6)} ${String(r.below_aa).padStart(3)} of ${String(r.text_elements).padStart(4)}${r.sample.length ? "   e.g. " + r.sample[0] : ""}`));
    out.push("");
  }
  if (results.nav.length){ out.push("NAVIGATION"); results.nav.forEach(r => out.push(`  ${pad(r.view, 20)} ${r.links} links (${r.visible_without_opening} visible without opening a group), ${r.groups} group headings, ${r.top_level} distinct destinations`)); out.push(""); }
  if (results.clicks.length){ out.push("CLICKS (counted as performed)"); results.clicks.forEach(r => out.push(r.error ? `  ${r.workflow}: could not run (${r.error})` : `  ${pad(r.workflow, 46)} ${r.clicks} click(s), ${r.typed_fields} typed field(s), to ${r.to}   (budget ${r.budget})`)); out.push(""); }
  if (results.print.length){ out.push(`PRINT-GENERATION TIME (a response a person waits for is judged against ${BUDGETS.doherty_ms} ms; making a whole packet is a longer job)`); results.print.forEach(r => out.push(`  ${pad(r.what, 78)} ${String(r.median_ms).padStart(6)} ms`)); out.push(""); }
  out.push("FOR A PERSON TO JUDGE (a script cannot)");
  [
    "Consistency: do the same controls look and behave the same on every page (Jakob's law, consistency)?",
    "Tone: is every resident-facing line dignified, free of quizzing and childish wording?",
    "Calm: does a screen show only what the next step needs (Hick's law)? How many choices does a person face at once, and are they grouped (Miller's law)?",
    "Progress cues: are badges and 'unfinished' markers few enough not to feed alert fatigue (Zeigarnik)? Cap them at one or two on a screen.",
    "Error recovery: can a mistake be undone, and does the message say what to do next?",
    "Reading: do the largest and smallest text sizes still read well on the printed sheet and on a tablet?",
    "Real use: watch an Activity Director do the three workflows. Where do they hesitate?"
  ].forEach(l => out.push("  [ ] " + l));
  return out.join("\n");
}

await main();
console.log(report());
if (opt("json") && opt("json") !== true){ fs.writeFileSync(path.resolve(String(opt("json"))), JSON.stringify(results, null, 2)); console.log(`\nNumbers written to ${opt("json")}`); }
if (broken.length){ console.log(`\n${broken.length} budget(s) broken:\n  ` + broken.slice(0, 40).join("\n  ")); if (STRICT) process.exit(1); }
else console.log("\nEvery budget that was measured is met.");
