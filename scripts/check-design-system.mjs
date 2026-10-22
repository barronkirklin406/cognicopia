#!/usr/bin/env node
/* =====================================================================
   The design system, measured. Run: node scripts/check-design-system.mjs
   (part of npm test and npm run build)

   css/styles.css is one stylesheet for every page. This check holds it to
   what it says it is:
     1. contrast, re-computed from the file's own colors: every text pair
        the stylesheet names meets AAA (7:1), every border, icon and focus
        band meets 3:1, and the two scroll layers, at their strongest, leave
        white and pale-green text above 7:1 on every green they can sit on;
     2. the rules that make it kind: a 3 px two-band focus ring, a press and
        smooth state changes that vanish for prefers-reduced-motion, scroll
        layers that need both scroll-driven animation support and no request
        for less motion, forced-colors support, a print rule that removes the
        decoration, and nothing remote (no import, no web font host);
     3. the print standard as CSS: a Letter page, 0.5 in margins and a 0.75 in
        gutter, pure black on white, and tier lines of 3, 4.5 and 7.875 pt (the
        weights the line-art engine draws; never under 3 pt) with
        vector-effect: non-scaling-stroke;
     4. every page links the stylesheet with the right path, the offline cache
        keeps it and its fonts, the fonts are real woff2 files, small, with
        their open licenses beside them;
     5. js/coloring.js touches no network, storage or clock, and builds SVG
        from an allow-list (it is exercised in a real browser by
        scripts/check-design-ui.mjs);
     6. scripts/build_coloring_svgs.py compiles, runs with nothing to do and
        leaves js/coloring-data.js current; where Python has Pillow and
        vtracer (set PYTHON=/path/to/python to choose) it traces made-up
        masters and proves every outline is closed, in pure black on a 3:4
        page, small, faithful to the master, and refuses a blank picture
        without stopping the others. Where they are missing it says so and
        proves the script exits 2 and writes nothing.
   Node built-ins only.
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync, spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { PAGES } from "./site-nav.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0; const fails = [], notes = [];
const ok = (c, m) => { if (c) pass++; else fails.push(m); };

const CSS = read("css/styles.css");
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "");
const CODE = strip(CSS);

/* ---------- 1. contrast, from the file's own colors ---------- */
const root = /:root\{([\s\S]*?)\n\}/.exec(CODE)[1];
const T = {};
for (const m of root.matchAll(/--cg-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) T[m[1]] = m[2].toLowerCase();
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (top, alpha, under) => "#" + [1, 3, 5].map(i => Math.round(parseInt(top.slice(i, i + 2), 16) * alpha + parseInt(under.slice(i, i + 2), 16) * (1 - alpha)).toString(16).padStart(2, "0")).join("");
ok(Object.keys(T).length >= 28, `the stylesheet names ${Object.keys(T).length} colors`);
for (const need of ["green-950", "green-900", "green-800", "green-700", "parchment", "charcoal", "gold-500", "gold-300", "white", "focus", "focus-dark"]) ok(T[need], `missing token --cg-${need}`);
/* the brand's four colors, as the Quality Standards Hub names them */
ok(T["green-700"] === "#1b382b" && T.parchment === "#f4efe6" && T["gold-500"] === "#c5a059" && T.charcoal === "#1a202c", "the four brand colors are the tokens' anchors");

const TEXT = [];   // [foreground, background]: text, which must reach AAA
const onGreens = ["green-950", "green-900", "green-800", "green-700"], onTans = ["parchment", "tan-100", "tan-200"];
for (const bg of onGreens) for (const fg of ["white", "sage-100", "sage-200", "gold-300", "gold-200"]) TEXT.push([fg, bg]);
for (const bg of ["green-900", "green-800"]) TEXT.push(["tan-300", bg]);
for (const bg of onTans) for (const fg of ["charcoal", "ink-soft", "green-700"]) TEXT.push([fg, bg]);
for (const bg of ["cream", "white", "peach-100"]) for (const fg of ["charcoal", "ink-soft", "green-700"]) TEXT.push([fg, bg]);   // the light front of the packet tool
TEXT.push(["clay-700", "cream"], ["clay-700", "white"], ["white", "green-700"]);
TEXT.push(["charcoal", "gold-300"], ["charcoal", "gold-200"], ["charcoal", "sage-200"], ["charcoal", "tan-300"], ["white", "tan-700"], ["white", "green-600"], ["tan-800", "parchment"],
  ["danger-800", "parchment"], ["ok-800", "parchment"], ["danger-200", "green-900"], ["danger-200", "green-700"], ["ok-200", "green-900"]);
let worst = 99;
for (const [fg, bg] of TEXT) { const r = ratio(T[fg], T[bg]); worst = Math.min(worst, r); ok(r >= 7, `text --cg-${fg} on --cg-${bg} is ${r.toFixed(2)}:1, under AAA (7:1)`); }

/* ---------- 1b. the care tier as a color mode: Tier 1 sapphire and indigo, Tier 2 terracotta and sage, Tier 3 evergreen and muted gold ---------- */
{
  const tierVars = body => { const o = {}; for (const m of body.matchAll(/--cg-(tier(?:-[a-z]+)?)\s*:\s*(#[0-9a-fA-F]{6}|[0-9,]+)/g)) o[m[1]] = m[2].toLowerCase(); return o; };
  const base = /html\{(--cg-tier:[^}]*)\}/.exec(CODE);
  ok(!!base, "the stylesheet sets the default care-tier colors on html");
  const TIERS = { 0: base ? tierVars(base[1]) : {} };
  for (const n of [1, 2, 3]) { const m = new RegExp(`html\\[data-cg-tier="${n}"\\]\\{([^}]*)\\}`).exec(CODE); ok(!!m, `Tier ${n} has its own colors`); TIERS[n] = m ? tierVars(m[1]) : {}; }
  const hue = h => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return { r, g, b }; };
  for (const n of [0, 1, 2, 3]) {
    const t = TIERS[n], label = n ? `Tier ${n}` : "the default tier";
    if (!(t.tier && t["tier-deep"] && t["tier-soft"])) { ok(false, `${label}: tier, deep and soft colors are all set`); continue; }
    const plaid = mix(t.tier, .12, mix(t.tier, .12, t["tier-soft"]));   // where two bands of the quiet tartan cross: the darkest the card's ground gets
    for (const [what, fg, bg] of [["header text on the card", t["tier-deep"], t["tier-soft"]], ["header text where the tartan bands cross", t["tier-deep"], plaid], ["white on the selected level", "#ffffff", t.tier]]) {
      const r = ratio(fg, bg); worst = Math.min(worst, r); ok(r >= 7, `${label}: ${what} is ${r.toFixed(2)}:1, under AAA (7:1)`);
    }
  }
  const c1 = hue(TIERS[1].tier || "#000000"), c2 = hue(TIERS[2].tier || "#000000"), c3 = hue(TIERS[3].tier || "#000000");
  ok(c1.b > c1.r && c1.b > c1.g, "Tier 1 is a sapphire or indigo (blue leads)");
  ok(c2.r > c2.g && c2.r > c2.b && !!TIERS[2]["tier-sage"], "Tier 2 is terracotta (red leads) with a sage edge");
  ok(c3.g > c3.r && c3.g > c3.b && !!TIERS[3]["tier-edge"], "Tier 3 is evergreen with a muted gold edge");
  ok(/\.cg-tierhead\{[^}]*repeating-linear-gradient/.test(CODE), "the generator header card carries the quiet tartan");
  ok(/html:not\(\.cg-night-shift\) body :is\(\.config,\.cfg,\.arb\) \.level input:checked \+ span\{background:var\(--cg-tier\)/.test(CODE), "the selected level takes the tier's color");
}

/* ---------- 1c. type, fields and print ---------- */
ok(/html body :is\(input,select,textarea,label,\.lede,\.sub,\.rap-lede\)[^{]*\{letter-spacing:\.01em\}/.test(CODE), "fields, labels and lead lines carry .01em tracking");
ok(/--cg-font-display:var\(--cg-font-ui\)/.test(CODE) && /--cg-font-name:"Fraunces"/.test(CODE), "headings are the interface face; Fraunces is kept for a resident's name");
ok(/@page cg-doc\{size:8\.5in 11in;margin:\.5in \.5in \.5in 1\.25in\}/.test(CODE) && /body\{page:cg-doc\}/.test(CODE), "a page printed from the browser has 0.5 in margins and a 0.75 in binding gutter (a named page, given to a document with no print root of its own)");
ok(!/@page\s*\{[^}]*margin/.test(CODE), "the shared stylesheet sets no margin on the unnamed page: it would override the @page{margin:0} of a page that builds its own sheets (the Packet Builder printed its sheets 1.25 in to the right and cut off at the foot)");
ok(/:root:root\{color-scheme:light\}/.test(CODE), "a dark-themed page prints on a light canvas");
ok(/:not\(:has\(#printRoot,#qpPrintRoot,#print-stage\)\)/.test(CODE) && /nav,button,\.btn/.test(CODE), "the generic print sheet strips navigation and buttons and leaves a page with its own print root alone");
for (const [fg, bg] of [["gold-500", "green-900"], ["gold-500", "green-800"], ["gold-500", "green-700"], ["tan-400", "green-900"], ["tan-400", "green-800"], ["tan-400", "green-700"], ["green-600", "parchment"],
  ["focus", "green-900"], ["focus-dark", "parchment"], ["focus", "focus-dark"], ["focus-dark", "tan-200"]]) {
  const r = ratio(T[fg], T[bg]); ok(r >= 3, `non-text --cg-${fg} against --cg-${bg} is ${r.toFixed(2)}:1, under 3:1`);
}
/* the studio tools' accents (section 9e): in the day palette the text color is AAA on its own tint, on cream and on white, white text
   is AAA on it (a button), and the bar color is 3:1 on white; in Night Shift (builder panel #16231f, page #0e1614) the light text color is AAA on
   its tint laid over the panel and on both, dark text is AAA on the light button color, and the light bar color is 3:1 */
for (const k of ["terra", "indigo", "moss", "ochre", "slate"]) {
  for (const bg of ["soft", "white", "cream"]) { const b = bg === "soft" ? T[`${k}-soft`] : T[bg]; const r = ratio(T[`${k}-ink`], b); worst = Math.min(worst, r); ok(r >= 7, `tool accent ${k}: text on ${bg} is ${r.toFixed(2)}:1, under AAA`); }
  { const r = ratio("#ffffff", T[`${k}-ink`]); worst = Math.min(worst, r); ok(r >= 7, `tool accent ${k}: white on the button color is ${r.toFixed(2)}:1, under AAA`); }
  ok(ratio(T[`${k}-tool`], T.white) >= 3, `tool accent ${k}: its bar color is under 3:1 on white`);
  for (const under of ["#16231f", "#0e1614"]) {
    const tint = mix(T[`${k}-dk-tool`], 0.14, under);
    for (const [fg, bg, what] of [[T[`${k}-dk-ink`], tint, "text on its tint"], [T[`${k}-dk-ink`], under, "text on the night panel"], [T[`${k}-dk-on`], T[`${k}-dk-tool`], "dark text on the button color"]]) {
      const r = ratio(fg, bg); worst = Math.min(worst, r); ok(r >= 7, `tool accent ${k} (night): ${what} is ${r.toFixed(2)}:1, under AAA`);
    }
    ok(ratio(T[`${k}-dk-tool`], under) >= 3, `tool accent ${k} (night): its bar color is under 3:1 on ${under}`);
  }
}
/* the focus ring is two bands, so one of them always meets 3:1 on whatever is behind it */
ok(ratio(T.focus, T["green-950"]) >= 3 && ratio(T["focus-dark"], T.parchment) >= 3 && ratio(T["focus-dark"], T.white) >= 3, "the focus ring meets 3:1 on dark and on light");
/* the scroll layers at their strongest, over the greens, under the text */
const layerRows = [...CODE.matchAll(/radial-gradient\([^)]*?rgba\((\d+),(\d+),(\d+),(\.?\d+(?:\.\d+)?)\)/g)];
ok(layerRows.length === 2, `two scroll layers, found ${layerRows.length}`);
let layerWorst = 99;
for (const m of layerRows) {
  const hex = "#" + [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, "0")).join(""), a = parseFloat(m[4]);
  ok(a <= 0.08, `a scroll layer is ${a} strong; 0.08 is the most the system allows`);
  for (const bg of onGreens) for (const fg of ["white", "sage-100"]) { const r = ratio(T[fg], mix(hex, a, T[bg])); layerWorst = Math.min(layerWorst, r); ok(r >= 7, `--cg-${fg} on --cg-${bg} under a layer is ${r.toFixed(2)}:1`); }
  /* a page's own background is green 800 or darker; the cards on green 700 are opaque, so a layer never reaches the gold and sage text on them */
  for (const bg of ["green-950", "green-900", "green-800"]) for (const fg of ["sage-200", "gold-300"]) { const r = ratio(T[fg], mix(hex, a, T[bg])); layerWorst = Math.min(layerWorst, r); ok(r >= 7, `--cg-${fg} on --cg-${bg} under a layer is ${r.toFixed(2)}:1`); }
}

/* ---------- 2. the rules that make it kind ---------- */
ok(/:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--cg-focus\)[^}]*box-shadow:\s*0 0 0 6px var\(--cg-focus-dark\)/.test(CODE), "the focus ring is a 3 px outline over a dark inner band");
ok(/forced-colors:\s*active\)\s*\{[^}]*Highlight/.test(CODE), "forced colors keep a visible focus ring");
ok(/:where\([^{]*\bsummary\b[^{]*\):focus-visible/.test(CODE) && /:where\([^{]*\[role="tab"\][^{]*\):focus-visible/.test(CODE) && /:where\([^{]*\[role="switch"\][^{]*\):focus-visible/.test(CODE), "the ring covers summaries, tabs and switches");
ok(/@media \(prefers-reduced-motion:no-preference\)\s*\{[^}]*transition:/.test(CODE) && /:active:not\(:disabled\)\)?\s*\{\s*transform:translateY\(1px\)/.test(CODE), "state changes and the one-pixel press only run when motion is welcome");
ok(/@media \(prefers-reduced-motion:reduce\)[\s\S]*?animation-duration:\.001ms !important[\s\S]*?transition-duration:\.001ms !important/.test(CODE), "reduced motion stops animation and transition");
ok(/:root::before,:root::after\{animation:none !important;transform:none !important\}/.test(CODE), "reduced motion stills the scroll layers");
ok(/@supports \(animation-timeline:scroll\(\)\)\s*\{\s*@media \(prefers-reduced-motion:no-preference\)[\s\S]*?animation-timeline:scroll\(root block\)/.test(CODE), "the scroll layers need scroll-driven animation AND no request for less motion");
ok(/:root::before,:root::after\{[^}]*position:fixed;z-index:-1;pointer-events:none/.test(CODE), "the layers sit behind everything and take no clicks");
ok(/html\.cg-night-shift::before,html\.cg-night-shift::after\{display:none\}/.test(CODE), "the layers are off in Night Shift");
ok(/@media print\{\s*:root::before,:root::after\{display:none !important\}/.test(CODE), "print removes the decoration");
ok(!/@import|url\(\s*["']?(?:https?:)?\/\//.test(CODE) && !/https?:\/\//.test(CODE), "the stylesheet reaches nothing remote");
const faces = [...CODE.matchAll(/@font-face\{[^}]*\}/g)].map(m => m[0]);
ok(faces.length === 3 && faces.every(f => /font-display:swap/.test(f) && /format\("woff2"\)/.test(f) && /url\("\.\.\/fonts\/[A-Za-z-]+\.woff2"\)/.test(f)), "three @font-face rules, all local woff2, none blocking");
ok(!/font-family:"Atkinson Hyperlegible"/.test(faces.join("")), "the UI face is not named Atkinson Hyperlegible, so it cannot replace the embedded print copy in the tools");
ok(/--cg-tap:52px/.test(CODE) && /min-height:var\(--cg-tap\)/.test(CODE), "components size themselves with the 52 px tap floor");
ok(/--cg-step--1:\.9375rem/.test(CODE) && /--cg-step-0:1\.0625rem/.test(CODE), "reading text never falls under 15 px");
ok(/--cg-radius-sm:6px/.test(CODE) && /--cg-radius-md:12px/.test(CODE) && /--cg-radius-lg:20px/.test(CODE), "three radii");
ok(/--cg-space-1:\.25rem[\s\S]*--cg-space-9:6rem/.test(CODE), "a nine-step spacing rhythm");

/* ---------- 3. the print standard as CSS ---------- */
ok(/@page cg-coloring\{size:8\.5in 11in;margin:0\}/.test(CODE), "a named Letter page");
ok(/--cg-margin:\.5in/.test(CODE) && /--cg-gutter:\.75in/.test(CODE) && /padding:var\(--cg-margin\) var\(--cg-margin\) var\(--cg-margin\) var\(--cg-gutter\)/.test(CODE), "0.5 in margins and a 0.75 in gutter on the left");
const line = n => parseFloat((new RegExp(`--cg-line-${n}:([\\d.]+)pt`).exec(CODE) || [])[1]);
ok(line(1) === 3 && line(2) === 4.5 && line(3) === 7.875, `tier lines are ${line(1)}, ${line(2)} and ${line(3)} pt`);
ok(Math.min(line(1), line(2), line(3)) >= 3, "no tier line is under 3 pt");
{
  /* the same numbers the line-art engine draws (4, 6 and 10.5 px = 3, 4.5 and 7.875 pt) */
  const eng = read("assets/cognicopia-coloring/cognicopia-coloring.js");
  const pts = [...eng.matchAll(/pt:\s*([\d.]+)/g)].map(m => +m[1]);
  ok([3, 4.5, 7.875].every(w => pts.includes(w)), "the tier weights are the engine's own weights");
}
ok(/svg\.cg-coloring :is\(path,line,polyline,polygon,circle,ellipse,rect\)\{[^}]*vector-effect:non-scaling-stroke/.test(CODE), "lines keep their width however the picture is scaled");
ok(/svg\.cg-coloring\.tier-1\{--cg-line:var\(--cg-line-1\)\}/.test(CODE) && /\.tier-2\{--cg-line:var\(--cg-line-2\)\}/.test(CODE) && /\.tier-3\{--cg-line:var\(--cg-line-3\)\}/.test(CODE), "tier-1, tier-2 and tier-3");
ok(/@media print\{svg\.cg-coloring \*\{fill:#000 !important;stroke:#000 !important\}\}/.test(CODE) && /background:#fff;color:#000/.test(CODE), "pure black on white in print");

/* ---------- 4. every page, the offline cache, the fonts ---------- */
let linked = 0;
for (const p of PAGES) {
  const html = read(p.file), P = "../".repeat(p.file.split("/").length - 1);
  if (html.includes(`<link rel="stylesheet" href="${P}css/styles.css">`)) linked++;
  else fails.push(`${p.file} does not link ${P}css/styles.css`);
}
ok(linked === PAGES.length && linked >= 30, `${linked} of ${PAGES.length} pages link the stylesheet`);
{
  const sw = read("sw.js");
  for (const f of ["css/styles.css", "fonts/AtkinsonHyperlegible-Regular.woff2", "fonts/AtkinsonHyperlegible-Bold.woff2", "fonts/Fraunces-latin.woff2"]) ok(sw.includes(`"${f}"`), `sw.js does not keep ${f} for offline use`);
  const woff = f => { const b = fs.readFileSync(path.join(ROOT, f)); return b.slice(0, 4).toString("latin1") === "wOF2" ? b.length : -1; };
  let total = 0;
  for (const f of ["fonts/AtkinsonHyperlegible-Regular.woff2", "fonts/AtkinsonHyperlegible-Bold.woff2", "fonts/Fraunces-latin.woff2"]) { const n = woff(f); total += n; ok(n > 10000 && n < 80000, `${f} is ${n} bytes (a real woff2 under 80 KB)`); }
  ok(total < 120000, `the three fonts weigh ${total} bytes`);
  ok(/SIL OPEN FONT LICENSE/.test(read("fonts/OFL.txt")) && /SIL OPEN FONT LICENSE/.test(read("fonts/OFL-Fraunces.txt")) && /Fraunces Project Authors/.test(read("fonts/OFL-Fraunces.txt")), "both open licenses ship with the fonts");
  ok(!/Reserved Font Name\s+["“]/i.test(read("fonts/OFL-Fraunces.txt")), "Fraunces declares no reserved name that a subset would breach");
}
/* the pages that opt in to the editorial type */
for (const f of ["pricing.html", "activate.html", "contact.html", "cognitive-journals.html", "life-planners.html", "zentangle-art.html"]) ok(/<html lang="en" class="cg-ds( cg-paper)?">/.test(read(f)), `${f} should opt in to the editorial type (html.cg-ds)`);
/* the paper look: every page but the packet tool's front page carries it, the Builder carries its app form, and the pieces that make it work are in the stylesheet */
{
  const nav = read("scripts/site-nav.mjs");
  let paper = 0, missing = [];
  for (const p of PAGES){
    const h = read(p.file), tag = (/<html\b[^>]*>/.exec(h) || [""])[0];
    if (p.file === "index.html"){ ok(!/cg-paper/.test(tag), "index.html keeps its own look, not the paper class"); continue; }
    const want = p.builder ? "cg-paper-app" : "cg-paper";
    if (new RegExp(`class="[^"]*\\b${want}\\b`).test(tag)) paper++; else missing.push(p.file);
  }
  for (const [fg, bg, what] of [["#241500", "#ffcc66", "amber button text"], ["#ffffff", T["green-700"], "white on a forest green button"], [T.charcoal, T.cream, "charcoal on cream"], [T["ink-soft"], T.cream, "soft ink on cream"], [T["green-700"], T["sage-100"], "green on a sage panel"], [T["clay-800"], T["peach-100"], "clay on a peach tag"], [T.charcoal, T["ok-200"], "charcoal on a good-news chip"], [T.charcoal, T["tan-100"], "charcoal on a table header"], [T["green-700"], T.white, "green links on white"]])
    ok(ratio(fg, bg) >= 7, `${what} is ${ratio(fg, bg).toFixed(2)}:1, under AAA`);
  ok(!missing.length, `these pages are missing their paper class: ${missing.join(", ")}`);
  ok(paper >= 30, `${paper} pages carry the paper look`);
  ok(/@media screen\{[\s\S]*html\.cg-paper:not\(\.cg-night-shift\) body\{background:var\(--cg-cream\)/.test(CSS), "the stylesheet paints paper pages cream, for the screen only");
  ok(/html\.cg-paper\.cg-night-shift body\{background:#17120c/.test(CSS), "Night Shift keeps a dim palette on paper pages");
  ok(/html\.cg-paper-app:not\(\.cg-night-shift\)\{[^}]*--accent-ink:#ffffff/.test(CSS), "the Builder takes the palette through its own variables");
  const paperCss = CSS.slice(CSS.indexOf("9b. Paper pages"), CSS.indexOf("10. Print"));
  ok(!/@media print/.test(paperCss), "the paper rules are screen-only: printed packets are untouched");
  ok(/class="cg-foot"/.test(read("pricing.html")) && /class="cg-foot"/.test(read("resources/index.html")) && !/class="site-footer"/.test(read("resources/accessibility/index.html")), "paper pages share one generated footer");
  ok(/background:var\(--cg-parchment/.test(nav.slice(nav.indexOf(".cg-crumbs{"), nav.indexOf(".cg-crumbs{") + 200)), "the breadcrumb bar is parchment, not dark green");
}
/* the packet tool: its design layer now reads the shared tokens, and its hero carries the reasons to use it */
{
  const idx = read("index.html");
  ok(/--ds-panel:var\(--cg-green-800/.test(idx) && /--ds-bar-ink:var\(--cg-charcoal/.test(idx), "index.html's palette is the shared tokens");
  ok((idx.match(/class="cg-value"/g) || []).length === 4 && /Made from their own life/.test(idx) && /No resident data leaves this computer/.test(idx) && /first 25 packets/.test(idx), "index.html: four value cards above the form");
  ok(/<p class="tagline">Engaging Today<\/p>/.test(idx) && /Connection, Cognition, Creation/.test(idx), "index.html: the tagline is Engaging Today, with the earlier line kept beneath it");
  ok(!/HIPAA[- ]compliant/i.test(idx), "no blanket compliance claim in the hero");
}

/* ---------- 5. js/coloring.js ---------- */
{
  const js = strip(read("js/coloring.js")), data = read("js/coloring-data.js");
  for (const [what, re] of Object.entries({ fetch: /\bfetch\s*\(/, XMLHttpRequest: /XMLHttpRequest/, sendBeacon: /sendBeacon/, WebSocket: /WebSocket/, "a storage call": /localStorage|sessionStorage|indexedDB/, "the clock": /\bDate\b/, "a random number": /Math\.random/, eval: /\beval\s*\(|new Function/, "innerHTML": /innerHTML|outerHTML|insertAdjacentHTML|document\.write/, "a remote address": /https?:\/\/(?!www\.w3\.org\/2000\/svg)/ }))
    ok(!re.test(js), `js/coloring.js uses ${what}`);
  ok(/\bnew Promise\b/.test(js) && /mount: mount/.test(js) && /WEIGHTS_PT/.test(js), "js/coloring.js has an asynchronous mount");
  ok(/ALLOWED/.test(js) && /TRANSFORM/.test(js) && /DOMParser/.test(js), "js/coloring.js rebuilds SVG from an allow-list");
  ok(/open/.test(js) && /not closed/.test(js), "js/coloring.js refuses an open outline");
  new Function(read("js/coloring.js")); new Function(data);
  ok(/Do not edit by hand/.test(data) && /CognicopiaSvgColoringData/.test(data), "js/coloring-data.js is the generated data file");
}

/* ---------- 6. the Python vtracer script ---------- */
{
  const PY = process.env.PYTHON || "python3";
  const py = (args, opts = {}) => spawnSync(PY, args, { cwd: ROOT, encoding: "utf8", ...opts });
  const probe = py(["--version"]);
  if (probe.error) notes.push(`Python was not found (${PY}): build_coloring_svgs.py was not run`);
  else {
    const compile = py(["-c", "import ast,sys; ast.parse(open('scripts/build_coloring_svgs.py').read())"]);
    ok(compile.status === 0, "scripts/build_coloring_svgs.py parses: " + (compile.stderr || "").trim().split("\n").pop());
    const src = read("scripts/build_coloring_svgs.py");
    ok(!/\b(requests|urllib|http\.client|socket|urlopen)\b/.test(src), "the script makes no network request");
    ok(/colormode="binary"/.test(src) && /mode="spline"/.test(src) && /filter_speckle/.test(src), "VTracer runs in binary mode, with spline fitting and a speckle filter");
    ok(/"assets" \/ "raw_coloring_pngs"/.test(src) && /"assets" \/ "coloring" \/ "_inbox"/.test(src) && /"assets" \/ "svgs"/.test(src) && /"js" \/ "coloring-data\.js"/.test(src), "it reads both master folders and writes assets/svgs and js/coloring-data.js");
    const cur = py(["scripts/build_coloring_svgs.py", "--check"]);
    ok(cur.status === 0 && /current/.test(cur.stdout), "js/coloring-data.js is what the SVGs make: " + (cur.stdout + cur.stderr).trim());
    const none = py(["scripts/build_coloring_svgs.py", "--src", path.join(os.tmpdir(), "cg-no-such-folder"), "--list"]);
    ok(none.status === 0 && /0 picture/.test(none.stdout), "with no masters it lists none and exits 0");

    const have = py(["-c", "import PIL, vtracer"]).status === 0;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-svgs-")), srcDir = path.join(tmp, "src"), outDir = path.join(tmp, "out"), dataFile = path.join(tmp, "data.js");
    fs.mkdirSync(srcDir);
    if (!have) {
      fs.writeFileSync(path.join(srcDir, "a.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64"));
      const r = py(["scripts/build_coloring_svgs.py", "--src", srcDir, "--out", outDir, "--data", dataFile]);
      ok(r.status === 2 && /not installed/.test(r.stderr) && !fs.existsSync(outDir) && !fs.existsSync(dataFile), "without Pillow and vtracer it says so, exits 2 and writes nothing");
      notes.push("Pillow and vtracer are not installed for " + PY + ": the tracing itself was not run (pip install pillow vtracer, or set PYTHON)");
    } else {
      const make = py(["-c", `
from PIL import Image, ImageDraw
d = ${JSON.stringify(srcDir)}
im = Image.new("RGB", (900, 1200), "white"); g = ImageDraw.Draw(im)
g.ellipse((250, 300, 650, 700), outline="black", width=9); g.ellipse((380, 430, 520, 570), outline="black", width=7)
g.line((450, 700, 450, 1000), fill="black", width=11); g.rectangle((200, 1040, 700, 1100), outline="black", width=8)
im.save(d + "/fixture-sprig.png")
Image.new("RGB", (100, 100), "white").save(d + "/fixture-blank.png")
t = Image.new("RGBA", (500, 500), (0, 0, 0, 0)); ImageDraw.Draw(t).ellipse((60, 60, 440, 440), outline=(20, 20, 20, 255), width=12); t.save(d + "/Fixture Ring.png")
`]);
      ok(make.status === 0, "made the fixture masters: " + make.stderr);
      const run = py(["scripts/build_coloring_svgs.py", "--src", srcDir, "--out", outDir, "--data", dataFile]);
      ok(run.status === 1 && /FAIL fixture-blank: no ink found/.test(run.stderr), "a blank master is refused with a reason, and the exit code says so: " + run.stderr.trim().split("\n").pop());
      ok(/ok\s+fixture-sprig/.test(run.stdout) && /ok\s+fixture-ring/.test(run.stdout), "the other masters were still traced (a name with a space and capitals becomes a clean id)");
      const svgs = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter(f => f.endsWith(".svg")).sort() : [];
      ok(svgs.join() === "fixture-ring.svg,fixture-sprig.svg", "the SVGs are written: " + svgs.join());
      for (const f of svgs) {
        const s = fs.readFileSync(path.join(outDir, f), "utf8");
        ok(/^<svg [^>]*viewBox="0 0 600 800"/.test(s), `${f}: a 3:4 page, 600 by 800`);
        ok(!/<script|on\w+=|href=|<image|<style|<text/i.test(s), `${f}: nothing but outlines`);
        const fills = [...s.matchAll(/fill="([^"]+)"/g)].map(m => m[1]);
        ok(fills.length > 0 && fills.every(x => x === "#000000"), `${f}: pure black`);
        const d = [...s.matchAll(/ d="([^"]+)"/g)].map(m => m[1]);
        const subs = d.flatMap(x => x.split(/(?=M)/).map(y => y.trim()).filter(Boolean));
        ok(subs.length >= 2 && subs.every(x => /Z$/.test(x)), `${f}: ${subs.length} outlines, every one closed`);
        ok(s.length < 40000, `${f}: ${(s.length / 1024).toFixed(1)} KB (smoothed, not a pixel staircase)`);
        const xs = [...d.join(" ").matchAll(/-?\d+(?:\.\d+)?/g)].map(m => +m[0]);
        ok(Math.min(...xs) >= -1 && Math.max(...xs) <= 801, `${f}: inside the page`);
      }
      const data = fs.readFileSync(dataFile, "utf8");
      const box = {}; box.globalThis = box; new Function("globalThis", data.replace("typeof globalThis !== \"undefined\" ? globalThis : this", "globalThis"))(box);
      ok(box.CognicopiaSvgColoringData && box.CognicopiaSvgColoringData.items.length === 2 && box.CognicopiaSvgColoringData.items.every(i => /^[a-z0-9-]+$/.test(i.id) && i.svg.startsWith("<svg") && i.title), "js/coloring-data.js holds both pictures with an id, a title and the SVG text");
      const chk = py(["scripts/build_coloring_svgs.py", "--out", outDir, "--data", dataFile, "--check"]);
      ok(chk.status === 0, "--check agrees with what it just wrote");
      fs.appendFileSync(dataFile, "// edited by hand\n");
      ok(py(["scripts/build_coloring_svgs.py", "--out", outDir, "--data", dataFile, "--check"]).status === 1, "--check notices a hand edit");
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const detail = `worst text pair ${worst.toFixed(1)}:1, worst text under a scroll layer ${layerWorst.toFixed(1)}:1`;
console.log(`Design system check: ${pass} checks passed (${detail})`);
for (const n of notes) console.log("  note: " + n);
if (fails.length) {
  console.log(`${fails.length} FAILED:`);
  fails.slice(0, 40).forEach(f => console.log("  - " + f));
  process.exit(1);
}
