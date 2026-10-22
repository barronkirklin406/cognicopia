#!/usr/bin/env node
/* =====================================================================
   The design system, in a real browser. scripts/check-design-system.mjs proves
   what css/styles.css and js/coloring.js say; this proves what they do:

     - the stylesheet and the two typefaces load, from this site only;
     - the focus ring is there for the keyboard, absent for a mouse click on a
       button, and kept in forced-colors;
     - a button presses by one pixel and returns; a card lifts on hover; a
       disclosure fades open; and none of it moves when the person has asked
       for reduced motion (or in print, or in Night Shift for the layers);
     - the two scroll-driven layers exist, sit behind everything, take no
       clicks, drift with the scroll where the browser can, and leave white
       text at 7:1 or better on every pixel they paint;
     - headings and body text are both the interface face (Atkinson Hyperlegible; Fraunces is kept only for a resident's name), at sizes
       that never fall under 16 px, on every page that opted in, and no page
       scrolls sideways on a phone;
     - the first screen of the packet tool shows the reasons to use it;
     - js/coloring.js draws a picture at each tier with the print standard's
       line weights, refuses what it must (open outlines, a wrong shape, a
       hostile file) and fetches nothing;
     - a mounted sheet, printed to PDF, is one US Letter page whose ink stays
       inside the 0.5 in margins and the 0.75 in binding gutter, is pure black
       on white, and whose lines are 3, 4.5 and 7.875 pt (read back with
       PyMuPDF where it is installed).

   Needs Playwright. Where it is not installed this exits 2 and says so, and
   npm run build skips it. Serves the repository on a free local port. Set
   SHOTS=some/folder to keep screenshots.
   Run: node scripts/check-design-ui.mjs
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const ORIGIN = new URL(base).origin;
const SHOTS = process.env.SHOTS ? path.resolve(process.env.SHOTS) : "";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const errors = [], strays = [], problems = [], notes = []; let passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else problems.push(msg); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, name + ".png") }); };

/* ---------- pages made here, so the checks do not depend on a page's own CSS ---------- */
const FIXTURES = {
  "kit.html": `<!doctype html><html lang="en" class="cg-ds"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kit</title>
<link rel="stylesheet" href="/css/styles.css"><style>body{margin:0;padding:24px;background:#08262c;color:#fff;min-height:300vh}</style></head><body><main>
<h1 id="h1">A heading for the page</h1><h2 id="h2">A section heading</h2><h3 id="h3">A smaller heading</h3>
<p id="para">A paragraph of ordinary text, long enough to run past one line so that its measure can be read from the page itself and compared with the token that sets it, because a line of text that runs the whole width of a wide window is hard to follow.</p>
<a id="link" href="#x">A link</a> <button id="btn" type="button">A button</button> <a id="cta" class="cg-btn" href="#y">A call to action</a>
<details id="det"><summary id="sum">A summary</summary><p>Inside.</p></details>
<div id="tab" role="tab" tabindex="0">A tab</div> <div id="sw" role="switch" aria-checked="false" tabindex="0">A switch</div>
<input id="inp" type="text" aria-label="A name">
<ul class="cg-values"><li class="cg-value"><b>One</b><span>A detail</span></li></ul>
</main></body></html>`,
  "bare.html": `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Bare</title><link rel="stylesheet" href="/css/styles.css">
<style>html,body{margin:0}body{background:#0b2f36;min-height:300vh}</style></head><body></body></html>`,
  "coloring.html": `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Coloring</title><link rel="stylesheet" href="/css/styles.css">
<style>html,body{margin:0;background:#fff}</style><script src="/js/coloring.js"></script></head><body><div id="page"></div></body></html>`
};

/* pictures made here: a good one (a frame and a sprig), and the ones that must be refused or cleaned */
const FRAME = "M30 30H570V770H30Z M62 62V738H538V62Z", SPRIG = "M300 220C346 280 346 360 300 430C254 360 254 280 300 220Z";
const svg = (inner, vb = "0 0 600 800") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>`;
const ITEMS = [
  { id: "frame-demo", title: "Frame demo", bytes: 400, svg: svg(`<path fill-rule="evenodd" d="${FRAME}"/><path d="${SPRIG}"/>`) },
  { id: "hostile-demo", title: "Hostile demo", bytes: 900, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" onload="window.__pwned=1" style="background:url(http://127.0.0.1:1/evil.png)">
<script>window.__pwned=2</script><style>svg{display:none}</style><image href="http://127.0.0.1:1/evil.png" width="10" height="10"/>
<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>
<a href="javascript:window.__pwned=3"><path d="M50 50H150V150H50Z"/></a><use href="http://127.0.0.1:1/x.svg#a"/>
<g transform="translate(5 5)" onclick="window.__pwned=4" style="display:none"><path id="p1" class="x" fill="red" stroke="red" style="fill:red" onmouseover="window.__pwned=5" d="M200 200H300V300H200Z"/>
<path transform="url(javascript:window.__pwned=6)" d="M400 400H500V500H400Z"/></g><path d="javascript:alert(1)"/><path d=""/></svg>` },
  { id: "open-demo", title: "Open demo", bytes: 100, svg: svg(`<path d="M30 30H570V770H30Z M100 100L400 400"/>`) },
  { id: "open-two-demo", title: "Two open demo", bytes: 100, svg: svg(`<path d="M30 30L570 30 M30 100L570 100"/>`) },
  { id: "landscape-demo", title: "Landscape demo", bytes: 100, svg: svg(`<path d="M30 30H770V570H30Z"/>`, "0 0 800 600") },
  { id: "empty-demo", title: "Empty demo", bytes: 100, svg: svg(`<title>Nothing</title>`) },
  { id: "blank-path-demo", title: "Blank path demo", bytes: 100, svg: svg(`<path d=""/>`) },
  { id: "no-viewbox-demo", title: "No viewBox demo", bytes: 100, svg: `<svg xmlns="http://www.w3.org/2000/svg"><path d="M1 1H5V5Z"/></svg>` },
  { id: "broken-demo", title: "Broken demo", bytes: 10, svg: "<svg" }
];

/* a context that serves the made-up pages, blocks the service worker, and writes down anything that leaves this site */
const context = async (w, h, opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block", ...opts });
  await ctx.route(u => u.pathname.startsWith("/__fixture/"), r => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: FIXTURES[new URL(r.request().url()).pathname.split("/").pop()] || "" }));
  ctx.on("request", r => { if (/^(data|blob|about):/.test(r.url())) return; if (new URL(r.url()).origin !== ORIGIN) strays.push(r.url()); });
  return ctx;
};
const open = async (ctx, url) => { const p = await ctx.newPage(); p.on("pageerror", e => errors.push(url + ": " + e.message)); await p.goto(base + url); await p.evaluate(() => document.fonts.ready); return p; };
const style = (p, sel, props, pseudo) => p.evaluate(([s, ps, pe]) => { const e = s === "root" ? document.documentElement : document.querySelector(s), c = getComputedStyle(e, pe || null); return Object.fromEntries(ps.map(k => [k, c[k]])); }, [sel, props, pseudo]);
const durations = v => String(v).split(",").map(x => parseFloat(x));

try {
  /* =============== the kit: what the stylesheet does to ordinary controls =============== */
  let ctx = await context(1366, 768), p = await open(ctx, "__fixture/kit.html");
  const sheets = await p.evaluate(() => [...document.styleSheets].map(s => ({ href: s.href || "", rules: (() => { try { return s.cssRules.length; } catch (e) { return -1; } })() })));
  ok(sheets.some(s => /\/css\/styles\.css$/.test(s.href) && s.rules > 40), "css/styles.css loads and is read by the browser");
  const faces = await p.evaluate(() => [...document.fonts].map(f => ({ family: f.family.replace(/["']/g, ""), weight: f.weight, status: f.status })));
  const loaded = (fam, wt) => faces.some(f => f.family === fam && (!wt || f.weight === wt) && f.status === "loaded");
  ok(!!loaded, "the font checker is available (Fraunces is only loaded where a resident's name is set)");
  ok(loaded("Cognicopia UI", "400") && loaded("Cognicopia UI", "700"), "the interface face loaded in regular and bold from /fonts");
  ok(!faces.some(f => f.status === "error"), "no typeface failed to load");

  /* type and rhythm */
  const t = await p.evaluate(() => { const g = (s, k) => getComputedStyle(document.querySelector(s))[k]; const para = document.getElementById("para").getBoundingClientRect();
    return { h1: g("#h1", "fontFamily"), h1w: g("#h1", "fontWeight"), h1s: parseFloat(g("#h1", "fontSize")), h2s: parseFloat(g("#h2", "fontSize")), h3s: parseFloat(g("#h3", "fontSize")), body: g("#para", "fontFamily"), bodys: parseFloat(g("#para", "fontSize")),
      lh: parseFloat(g("#para", "lineHeight")) / parseFloat(g("#para", "fontSize")), pw: para.width, pmax: parseFloat(g("#para", "maxWidth")), h2top: g("#h2", "marginTop"), tap: getComputedStyle(document.documentElement).getPropertyValue("--cg-tap").trim() }; });
  ok(/Atkinson Hyperlegible|Cognicopia UI/.test(t.h1) && !/Fraunces/.test(t.h1) && t.h1w === "700", "headings are Atkinson Hyperlegible, bold, on a page that opts in (cg-ds)");
  ok(/^"?Cognicopia UI"?,/.test(t.body), "body text is the interface face");
  ok(t.h1s > t.h2s && t.h2s > t.h3s && t.h3s >= 20 && t.h1s <= 44.1, `the heading scale steps down and stays readable (${t.h1s}, ${t.h2s}, ${t.h3s} px)`);
  ok(t.bodys >= 16 && t.lh >= 1.5, `body text is ${t.bodys} px with ${t.lh.toFixed(2)} line height (never under 16 px)`);
  ok(t.pw <= t.pmax + 0.5 && t.pmax > 400 && t.pmax < 760, `a paragraph keeps a comfortable line length (${Math.round(t.pw)} px, measure ${Math.round(t.pmax)} px)`);
  ok(t.h2top === "24px", "stacked blocks in a page's main are a step apart (24 px)");
  ok(t.tap === "52px", "the touch token is 52 px");

  /* the ring: tab through every kind of control */
  const RING = { style: "solid", width: "3px", color: "rgb(245, 184, 0)", offset: "3px" };
  for (const id of ["link", "btn", "cta", "sum", "tab", "sw", "inp"]) {
    await p.keyboard.press("Tab"); await p.waitForTimeout(330);
    const r = await p.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return { id: e.id, style: s.outlineStyle, width: s.outlineWidth, color: s.outlineColor, offset: s.outlineOffset, shadow: s.boxShadow }; });
    ok(r.id === id && r.style === RING.style && r.width === RING.width && r.color === RING.color && r.offset === RING.offset && /rgb\(16, 36, 26\) 0px 0px 0px 6px/.test(r.shadow),
      `Tab reaches #${id} and shows the two-band ring (${r.id}: ${r.width} ${r.style} ${r.color}, ${r.shadow})`);
  }
  await shot(p, "kit-focus");
  await p.click("#btn"); await p.waitForTimeout(330);
  ok((await style(p, "#btn", ["outlineStyle"])).outlineStyle === "none", "a mouse click on a button draws no ring");
  await p.click("#inp"); await p.waitForTimeout(330);
  ok((await style(p, "#inp", ["outlineStyle", "outlineWidth"])).outlineWidth === "3px", "a text field shows the ring however it was focused");

  /* touch: state changes ease, a press moves one pixel, a card lifts */
  const tr = await style(p, "#btn", ["transitionProperty", "transitionDuration"]);
  ok(/background-color/.test(tr.transitionProperty) && /transform/.test(tr.transitionProperty) && /box-shadow/.test(tr.transitionProperty), "a button eases its color, shadow and press");
  ok(durations(tr.transitionDuration).every(d => d > 0 && d <= 0.2), `each transition is short (${tr.transitionDuration})`);
  await p.hover("#btn"); await p.mouse.down(); await p.waitForTimeout(330);
  ok((await style(p, "#btn", ["transform"])).transform === "matrix(1, 0, 0, 1, 0, 1)", "pressing a button moves it one pixel down");
  await p.mouse.up(); await p.mouse.move(700, 600); await p.waitForTimeout(330);
  ok((await style(p, "#btn", ["transform"])).transform === "none", "and releasing returns it");
  const before = (await style(p, "#cta", ["boxShadow"])).boxShadow;
  await p.hover("#cta"); await p.waitForTimeout(330);
  const after = (await style(p, "#cta", ["boxShadow"])).boxShadow;
  ok(before !== after && /12px/.test(after) && !/12px/.test(before), "a .cg-btn lifts its shadow on hover");
  const cb = await p.evaluate(() => { const r = document.getElementById("cta").getBoundingClientRect(); return { w: r.width, h: r.height }; });
  ok(cb.h >= 52 && cb.w >= 52, `a .cg-btn is at least 52 px both ways (${Math.round(cb.w)} x ${Math.round(cb.h)})`);
  await p.click("#sum"); await p.waitForTimeout(40);
  ok((await style(p, "#det", ["animationName"])).animationName === "cg-open", "a disclosure fades open");
  await p.click("#sum");

  /* the scroll-driven layers */
  const fixedLayers = await Promise.all(["::before", "::after"].map(pe => style(p, "root", ["position", "zIndex", "pointerEvents", "content"], pe)));
  ok(fixedLayers.every(l => l.position === "fixed" && l.zIndex === "-1" && l.pointerEvents === "none" && l.content !== "none"), "both layers exist, sit behind everything and take no clicks");
  const timeline = await p.evaluate(() => CSS.supports("animation-timeline", "scroll()"));
  const ty = pe => p.evaluate(x => new DOMMatrix(getComputedStyle(document.documentElement, x).transform).m42, pe);
  if (timeline) {
    ok((await style(p, "root", ["animationName"], "::before")).animationName === "cg-drift-slow" && (await style(p, "root", ["animationName"], "::after")).animationName === "cg-drift-fast", "with scroll timelines available, each layer has its own drift");
    await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" })); await p.waitForTimeout(250);
    const slow = await ty("::before"), fast = await ty("::after");
    ok(near(slow, -0.09 * 768, 2) && near(fast, -0.18 * 768, 3), `at the bottom of the page the layers have drifted 9 vh and 18 vh (${slow.toFixed(1)} and ${fast.toFixed(1)} px)`);
    await p.evaluate(() => scrollTo({ top: 0, behavior: "instant" })); await p.waitForTimeout(250);
    ok(Math.abs(await ty("::before")) < 1 && Math.abs(await ty("::after")) < 1, "and they return to rest at the top");
  } else notes.push("this browser has no scroll-driven animation: the layers were checked still, which is how they behave there");
  if (!timeline) ok((await style(p, "root", ["animationName"], "::before")).animationName === "none", "without scroll timelines the layers stay still");
  await p.evaluate(() => document.documentElement.classList.add("cg-night-shift"));
  ok((await style(p, "root", ["display"], "::before")).display === "none" && (await style(p, "root", ["display"], "::after")).display === "none", "Night Shift removes the layers");
  await p.evaluate(() => document.documentElement.classList.remove("cg-night-shift"));
  await p.emulateMedia({ media: "print" });
  ok((await style(p, "root", ["display"], "::before")).display === "none" && (await style(p, "root", ["display"], "::after")).display === "none", "print removes the layers");
  await p.emulateMedia({ media: null });
  ok((await style(p, "root", ["scrollBehavior"])).scrollBehavior === "smooth", "in-page links scroll smoothly");

  /* reduced motion: nothing slides, fades, drifts or presses */
  await p.emulateMedia({ reducedMotion: "reduce" }); await p.waitForTimeout(100);
  const rt = await style(p, "#btn", ["transitionDuration"]);
  ok(durations(rt.transitionDuration).every(d => d <= 0.00001), `reduced motion makes every transition instant (${rt.transitionDuration})`);
  ok((await style(p, "root", ["animationName"], "::before")).animationName === "none" && (await style(p, "root", ["animationName"], "::after")).animationName === "none", "reduced motion stills the layers");
  await p.evaluate(() => scrollTo({ top: 99999, behavior: "instant" })); await p.waitForTimeout(200);
  ok((await ty("::before")) === 0 && (await ty("::after")) === 0, "and they do not move when the page scrolls");
  await p.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await p.hover("#btn"); await p.mouse.down(); await p.waitForTimeout(200);
  ok((await style(p, "#btn", ["transform"])).transform === "none", "a press does not move a button");
  await p.mouse.up(); await p.mouse.move(700, 600);
  ok((await style(p, "root", ["scrollBehavior"])).scrollBehavior === "auto", "in-page links jump instead of gliding");
  await p.click("#sum"); await p.waitForTimeout(40);
  ok(durations((await style(p, "#det", ["animationDuration"])).animationDuration).every(d => d <= 0.00001) || (await style(p, "#det", ["animationName"])).animationName === "none", "a disclosure opens without fading");
  await p.click("#sum");
  await p.emulateMedia({ reducedMotion: "no-preference" });

  /* forced colors: the system's own highlight takes over, so the ring must still be drawn */
  await p.emulateMedia({ forcedColors: "active" }); await p.evaluate(() => document.activeElement.blur());
  await p.click("body", { position: { x: 5, y: 5 } }); await p.keyboard.press("Tab"); await p.waitForTimeout(330);
  const fc = await p.evaluate(() => { const s = getComputedStyle(document.activeElement); return { id: document.activeElement.id, style: s.outlineStyle, width: s.outlineWidth }; });
  ok(fc.id === "link" && fc.style === "solid" && fc.width === "3px", "in forced-colors mode the ring is still a 3 px solid outline");
  await p.emulateMedia({ forcedColors: null });
  await ctx.close();

  /* what the layers do to readability, measured on the pixels the browser painted */
  ctx = await context(1366, 768); p = await open(ctx, "__fixture/bare.html");
  const paint = async () => { const png = await p.screenshot(); return p.evaluate(async b64 => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    const L = (r, gg, b) => .2126 * f(r) + .7152 * f(gg) + .0722 * f(b); let max = 0, min = 1;
    for (let i = 0; i < d.length; i += 16) { const l = L(d[i], d[i + 1], d[i + 2]); if (l > max) max = l; if (l < min) min = l; }
    const cr = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    return { white: cr(1, max), sage: cr(L(0xe3, 0xf1, 0xe8), max), gold: cr(L(0xe8, 0xcc, 0x8a), max), lightest: max, darkest: min };
  }, png.toString("base64")); };
  const top = await paint();
  await p.evaluate(() => scrollTo({ top: 99999, behavior: "instant" })); await p.waitForTimeout(300);
  const bottom = await paint();
  const worstWhite = Math.min(top.white, bottom.white), worstSage = Math.min(top.sage, bottom.sage), worstGold = Math.min(top.gold, bottom.gold);
  ok(worstWhite >= 7 && worstSage >= 7 && worstGold >= 7, `on the page surface (green 800), white text is ${worstWhite.toFixed(1)}:1, pale-sage ${worstSage.toFixed(1)}:1 and gold ${worstGold.toFixed(1)}:1 on the lightest pixel the layers paint, at the top and the bottom (AAA is 7:1)`);
  notes.push(`under the layers, on green 800: white ${worstWhite.toFixed(1)}:1, pale sage ${worstSage.toFixed(1)}:1, gold ${worstGold.toFixed(1)}:1`);
  ok(top.lightest > top.darkest * 1.2 && bottom.lightest > bottom.darkest * 1.2, "the page is not a flat color: the layers are painted");
  await ctx.close();

  /* =============== the pages: the stylesheet on the real site =============== */
  const OPTED = ["pricing.html", "activate.html", "contact.html", "cognitive-journals.html", "life-planners.html", "zentangle-art.html"];
  for (const [w, h] of [[1366, 768], [390, 844]]) {
    ctx = await context(w, h);
    for (const url of ["index.html", ...OPTED]) {
      p = await open(ctx, url); await p.waitForTimeout(250);
      const r = await p.evaluate(() => { const h1 = document.querySelector(".hero-title") || document.querySelector("main h1") || document.querySelector("h1");
        return { sheet: [...document.styleSheets].some(s => /\/css\/styles\.css$/.test(s.href || "")), sw: document.documentElement.scrollWidth, iw: innerWidth, h1: h1 ? getComputedStyle(h1).fontFamily : "", fr: [...document.fonts].some(f => f.family.replace(/["']/g, "") === "Fraunces" && f.status === "loaded") }; });
      ok(r.sheet, `${url} links the design stylesheet (${w} px)`);
      ok(r.sw <= r.iw, `${url} does not scroll sideways at ${w} px (${r.sw} of ${r.iw})`);
      ok(!/Fraunces/.test(r.h1), `${url} sets its heading in the interface face (${w} px)`);
    }
    if (w === 1366) { p = await open(ctx, "index.html"); await p.waitForTimeout(400); await shot(p, "index-laptop"); }
    await ctx.close();
  }
  ctx = await context(1366, 768); p = await open(ctx, "index.html"); await p.waitForTimeout(300);
  const lap = await p.evaluate(() => [...document.querySelectorAll(".cg-value")].map(e => Math.round(e.getBoundingClientRect().bottom)));
  ok(lap.length === 5 && lap.every(b => b <= 768), `at 1366 x 768 all five value cards are fully on the first screen (bottoms at ${lap.join(", ")} px)`);
  await ctx.close();
  /* the front of the packet tool: a hero in two columns, a button that reaches the tool, the evidence, the footer */
  ctx = await context(1366, 768); p = await open(ctx, "index.html"); await p.waitForTimeout(300);
  const lp = await p.evaluate(() => { const c = document.querySelector(".lp-copy").getBoundingClientRect(), v = document.querySelector(".lp-visual").getBoundingClientRect(), b = document.querySelector(".lp-btn");
    return { side: v.left >= c.right - 1 && v.width > 300, href: b.getAttribute("href"), bh: b.getBoundingClientRect().height, make: !!document.querySelector("#make .wrap #f"),
      marks: [...document.querySelectorAll(".lp-marks a")].map(a => a.getAttribute("href")), foot: document.querySelectorAll(".lp-footer nav a").length, quote: (document.querySelector(".lp-quote figcaption") || {}).textContent || "",
      hidden: document.querySelector(".lp-visual").getAttribute("aria-hidden") }; });
  ok(lp.side && lp.hidden === "true", "the hero is two columns: the words, and beside them a picture of the tool that screen readers skip");
  ok(lp.href === "#make" && lp.bh >= 52 && lp.make, `"Make a packet" (${lp.bh} px tall) points at the packet tool, which sits under it on the same page`);
  ok(lp.marks.length === 5 && lp.marks.every(h => /^resources\/research\/[a-z-]+\/$/.test(h)), "the evidence row links five Research Center summaries");
  ok(lp.foot === 15 && /Cognicopia/.test(lp.quote) && !/Kirk Barron/.test(lp.quote), "the footer has its three columns of links and the quote is credited to Cognicopia, not a person");
  await p.click(".lp-btn"); await p.waitForTimeout(900);
  const landed = await p.evaluate(() => ({ title: Math.round(document.getElementById("makeTitle").getBoundingClientRect().top), wood: Math.round(document.getElementById("cgWood").getBoundingClientRect().top), vh: innerHeight }));
  /* the packet tool now opens with the wood bar (licensing and care controls), so the page lands on the bar and the heading sits just under it */
  ok(landed.wood >= 60 && landed.wood < 100, `"Make a packet" scrolls to the tool, which opens with the wood bar just under the navigation (${landed.wood} px from the top)`);
  ok(landed.title >= 136 && landed.title < landed.vh * 0.6, `and the heading is clear of the bars and in the first screen (${landed.title} px from the top)`);
  await shot(p, "index-landing");
  await ctx.close();
  ctx = await context(390, 844); p = await open(ctx, "index.html"); await p.waitForTimeout(300);
  const ph = await p.evaluate(() => { const a = [...document.querySelectorAll(".cg-value")].map(e => { const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; }); return { cards: a, h1: Math.round(document.querySelector(".hero-title").getBoundingClientRect().top) }; });
  ok(ph.cards.length === 5 && ph.cards[0][1] <= 844, `at 390 x 844 the first value card is fully on the first screen (${ph.cards[0].join("-")} px of 844)`);
  await shot(p, "index-phone");
  await ctx.close();

  /* =============== js/coloring.js =============== */
  ctx = await context(900, 1100); p = await ctx.newPage(); p.on("pageerror", e => errors.push("coloring: " + e.message));
  await p.addInitScript(items => { window.CognicopiaSvgColoringData = { viewBox: [0, 0, 600, 800], items }; }, ITEMS);
  await p.goto(base + "__fixture/coloring.html");
  const mount = (id, opts) => p.evaluate(async ([i, o]) => { try { const r = await CognicopiaSvgColoring.mount(document.getElementById("page"), i, o); return { ok: true, r }; } catch (e) { return { ok: false, message: e.message }; } }, [id, opts]);
  const api = await p.evaluate(() => ({ frozen: Object.isFrozen(CognicopiaSvgColoring), weights: CognicopiaSvgColoring.WEIGHTS_PT, wfrozen: Object.isFrozen(CognicopiaSvgColoring.WEIGHTS_PT),
    list: CognicopiaSvgColoring.list().map(i => i.id), tiers: [[0, 1], [1, 1], [2, 2], [3, 3], ["3", 3], [7, 1], [undefined, 1], [2.4, 2], [2.6, 3], [-5, 1], [NaN, 1]].map(([i, w]) => CognicopiaSvgColoring.tierOf(i) === w) }));
  ok(api.frozen && api.wfrozen, "the coloring API is frozen: a page cannot swap its parts");
  ok(api.weights[1] === 3 && api.weights[2] === 4.5 && api.weights[3] === 7.875, "its tier weights are 3, 4.5 and 7.875 pt");
  ok(api.list.length === ITEMS.length && api.list[0] === "frame-demo", "list() reads the data");
  ok(api.tiers.every(Boolean), "tierOf() reads 1, 2 and 3, and anything else as 1");

  const WANT = { 1: 4, 2: 6, 3: 10.5 };    /* px: 3, 4.5 and 7.875 pt */
  for (const tier of [1, 2, 3]) {
    const m = await mount("frame-demo", { tier });
    const f = await p.evaluate(() => { const s = document.querySelector("#page > svg"), pth = s.querySelector("path"), c = getComputedStyle(pth);
      return { cls: s.getAttribute("class"), role: s.getAttribute("role"), label: s.getAttribute("aria-label"), vb: s.getAttribute("viewBox"), n: s.querySelectorAll("path").length, sw: parseFloat(c.strokeWidth), ve: c.vectorEffect, fill: c.fill, stroke: c.stroke, rule: pth.getAttribute("fill-rule"), join: c.strokeLinejoin, kids: document.getElementById("page").children.length }; });
    ok(m.ok && m.r.tier === tier && m.r.paths === 2 && m.r.outlines === 3 && m.r.closed === true, `tier ${tier}: the frame and the sprig are drawn as 2 paths and 3 closed outlines`);
    ok(f.cls === `cg-coloring tier-${tier}` && f.role === "img" && f.label === "Frame demo" && f.vb === "0 0 600 800" && f.kids === 1, `tier ${tier}: the svg carries its tier class, a role, a label and its 3:4 box`);
    ok(near(f.sw, WANT[tier], 0.01) && f.sw >= 4, `tier ${tier}: lines are ${f.sw} px (${WANT[tier] * .75} pt), never under 3 pt`);
    ok(f.ve === "non-scaling-stroke" && f.fill === "rgb(0, 0, 0)" && f.stroke === "rgb(0, 0, 0)" && f.rule === "evenodd" && f.join === "round", `tier ${tier}: pure black, rounded, evenodd kept, vector-effect non-scaling-stroke`);
  }
  await mount("frame-demo", { tier: 2 }); await mount("frame-demo", { tier: 3 });
  ok((await p.evaluate(() => document.querySelectorAll("#page svg").length)) === 1, "drawing again replaces the picture instead of adding one");

  /* what it refuses */
  const refusals = [["open-demo", /1 outline that is not closed/], ["open-two-demo", /2 outlines that are not closed/], ["landscape-demo", /3:4/], ["empty-demo", /no outlines/], ["blank-path-demo", /no outlines/], ["no-viewbox-demo", /no usable viewBox/], ["broken-demo", /not a readable SVG/],
    ["no-such-picture", /no picture called no-such-picture/], ["../etc/passwd", /not a picture name/], ["Frame-Demo", /not a picture name/], ["", /not a picture name/], ["a".repeat(65), /not a picture name/]];
  for (const [id, re] of refusals) { const m = await mount(id, { tier: 1 }); ok(!m.ok && re.test(m.message), `refused: ${id.length > 20 ? id.slice(0, 8) + "..." : JSON.stringify(id)} (${m.ok ? "it was drawn" : m.message})`); }
  ok((await p.evaluate(() => document.querySelectorAll("#page svg").length)) === 1, "a refused picture leaves the last good one on the page");

  /* what it cleans */
  const requestsBefore = strays.length;
  const hs = await mount("hostile-demo", { tier: 1 }); await p.waitForTimeout(400);
  const clean = await p.evaluate(() => { const s = document.querySelector("#page svg"), all = [...s.querySelectorAll("*")].concat(s);
    return { pwned: window.__pwned, tags: [...new Set(all.map(e => e.localName))].sort(), badAttrs: all.flatMap(e => [...e.attributes].map(a => a.name)).filter(n => /^on|^style$|^href$|^xlink|^id$/.test(n)),
      fills: [...s.querySelectorAll("path")].map(e => e.getAttribute("fill")), transforms: [...s.querySelectorAll("[transform]")].map(e => e.getAttribute("transform")), paths: s.querySelectorAll("path").length, text: s.textContent }; });
  ok(hs.ok && hs.r.paths === 2 && clean.paths === 2, `a hostile file is cleaned and its two real outlines kept (${hs.ok ? hs.r.paths : hs.message})`);
  ok(clean.pwned === undefined, "no script in it ran");
  ok(clean.tags.every(x => ["svg", "title", "g", "path"].includes(x)), `only drawing shapes survive (${clean.tags.join(", ")})`);
  ok(clean.badAttrs.length === 0, `no event handler, style, link or id survives (${clean.badAttrs.join(", ") || "none"})`);
  ok(clean.fills.every(f => f === "#000000"), "every shape is forced to pure black");
  ok(clean.transforms.length === 1 && clean.transforms[0] === "translate(5 5)", "a safe transform is kept and a hostile one is dropped");
  ok(strays.length === requestsBefore && !strays.some(u => /evil|x\.svg/.test(u)), "it asked for nothing outside this site");
  ok(clean.text.trim() === "Hostile demo", "no foreign markup text came through (only the title)");

  /* a mounted sheet */
  await mount("frame-demo", { tier: 2, sheet: true });
  const sh = await p.evaluate(() => { const e = document.querySelector(".cg-coloring-sheet"), c = getComputedStyle(e), s = e.querySelector("svg").getBoundingClientRect();
    return { w: c.width, h: c.height, pad: [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft], bg: c.backgroundColor, page: c.page, svg: [s.left, s.top, s.width, s.height] }; });
  ok(sh.w === "816px" && sh.h === "1056px", "a sheet is 8.5 x 11 in");
  ok(sh.pad.join(" ") === "48px 48px 48px 72px", "with 0.5 in margins and a 0.75 in binding gutter on the left");
  ok(sh.svg[0] === 72 && sh.svg[1] === 48 && sh.svg[2] === 696 && sh.svg[3] === 960, "the picture fills exactly the printable area");
  ok(sh.bg === "rgb(255, 255, 255)" && sh.page === "cg-coloring", "on pure white, on its own named page");
  await shot(p, "coloring-sheet");

  /* ... and as a PDF, read back with PyMuPDF */
  const PY = `
import sys, json
try:
    import pymupdf as fitz
except Exception:
    try:
        import fitz
    except Exception:
        print(json.dumps({"missing": True})); sys.exit(0)
doc = fitz.open(sys.argv[1]); pg = doc[0]
res = {"missing": False, "pages": doc.page_count, "w": pg.rect.width, "h": pg.rect.height}
dpi = 150
pix = pg.get_pixmap(dpi=dpi, colorspace=fitz.csRGB, alpha=False)
w, h, s = pix.width, pix.height, pix.samples
r, g, b = s[0::3], s[1::3], s[2::3]
res["gray_only"] = (r == g == b)
white = b"\\xff" * w
rows = [r[y*w:(y+1)*w] for y in range(h)]
ys = [y for y in range(h) if rows[y] != white]
res["ink"] = ([min(len(rows[y]) - len(rows[y].lstrip(b"\\xff")) for y in ys) / dpi, ys[0] / dpi, max(len(rows[y].rstrip(b"\\xff")) for y in ys) / dpi, (ys[-1] + 1) / dpi] if ys else None)
cols, widths = set(), set()
for d in pg.get_drawings():
    for k in ("color", "fill"):
        c = d.get(k)
        if c is not None: cols.add(tuple(round(v, 3) for v in c))
    if d.get("color") is not None and d.get("width") is not None: widths.add(round(d["width"], 3))
res["colors"] = sorted(cols); res["widths"] = sorted(widths); res["images"] = len(pg.get_images())
print(json.dumps(res))
`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-design-"));
  try {
    let pdfFacts = 0;
    for (const tier of [1, 2, 3]) {
      await mount("frame-demo", { tier, sheet: true });
      const file = path.join(tmp, `tier-${tier}.pdf`);
      fs.writeFileSync(file, await p.pdf({ preferCSSPageSize: true, printBackground: true }));
      const py = spawnSync("python3", ["-I", "-c", PY, file], { encoding: "utf8", timeout: 60000 });
      let r = null; try { r = JSON.parse(py.stdout.trim().split("\n").pop()); } catch (e) { /* reported below */ }
      if (!r) { problems.push(`the tier ${tier} PDF could not be read back: ${(py.stderr || py.stdout).trim().slice(0, 200)}`); continue; }
      if (r.missing) { notes.push("PyMuPDF is not installed for python3: the printed sheet was not measured (pip install pymupdf)"); break; }
      const [l, t, rt, b] = r.ink;
      ok(r.pages === 1 && near(r.w, 612, .01) && near(r.h, 792, .01), `tier ${tier}: the sheet prints as one US Letter page (${r.pages} page, ${r.w} x ${r.h} pt)`);
      ok(l >= 0.75 - 0.01 && rt <= 8.0 + 0.01 && t >= 0.5 - 0.01 && b <= 10.5 + 0.01, `tier ${tier}: the ink stays inside the margins and the gutter (left ${l.toFixed(2)} in, right ${rt.toFixed(2)} of 8.00, top ${t.toFixed(2)}, bottom ${b.toFixed(2)} of 10.50)`);
      ok(rt - l > 6.0 && b - t > 8.0, `tier ${tier}: the picture uses the page (${(rt - l).toFixed(1)} x ${(b - t).toFixed(1)} in)`);
      ok(r.gray_only && r.colors.every(c => c.every(v => v === 0) || c.every(v => v === 1)) && r.images === 0, `tier ${tier}: pure black on pure white, no color and no raster image`);
      const want = { 1: 3, 2: 4.5, 3: 7.875 }[tier];
      ok(r.widths.length === 1 && near(r.widths[0], want, 0.005), `tier ${tier}: every line in the PDF is ${want} pt (found ${r.widths.join(", ")})`);
      pdfFacts++;
    }
    if (pdfFacts === 3) notes.push("the three sheets were printed to PDF and read back with PyMuPDF");
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  await ctx.close();

  ok(errors.length === 0, "no script errors on any of these pages" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
  ok(strays.length === 0, "nothing was requested from outside this site" + (strays.length ? ": " + strays.slice(0, 3).join(", ") : ""));
} finally { await browser.close(); srv.close(); }

const extra = notes.length ? ` [${notes.join("; ")}]` : "";
console.log(problems.length ? `design behavior check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ") : `design behavior check passed: ${passed} checks in a real browser (stylesheet and fonts, focus, motion, scroll layers, type, the first screen, the coloring script, a printed sheet)${extra}`);
process.exit(problems.length ? 1 : 0);
