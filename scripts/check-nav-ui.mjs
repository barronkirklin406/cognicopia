#!/usr/bin/env node
/* =====================================================================
   Navigation behavior, in a real browser: the six hubs open and close the
   way a person expects (drop-downs across the top bar of a wide window, a
   Menu drawer on a phone), the current page is marked, and the Packet
   Builder's sidebar follows its screens. (scripts/site-nav.mjs --check proves what the
   pages contain; this proves what they do.)

   Needs Playwright. Where it is not installed this exits 2 and says so, and
   npm run build skips it. Serves the repository on a free local port.
   Run: node scripts/check-nav-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const errors = [], problems = []; let passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else problems.push(msg); };
const page = async (w, h) => { const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block" }), p = await ctx.newPage(); p.on("pageerror", e => errors.push(e.message)); return p; };
const open = (p, sel, attr) => p.$$eval(sel, (n, a) => n.filter(d => d.open).map(d => d.dataset.hub || d.id.replace("cgHub-", "")), attr);
const only = async (p, sel, ...want) => JSON.stringify(await open(p, sel)) === JSON.stringify(want);

try {
  /* a static page on a wide window: the six hubs run across a top bar, each a drop-down. None is open as the page opens; the hub that holds the
     page is marked; opening one closes the others; a click elsewhere or Escape closes it; the bar stays at the top while the page scrolls */
  let p = await page(1366, 900);
  const here = q => q.$$eval("details.cg-hub[data-here]", n => n.map(d => d.id.replace("cgHub-", "")));
  await p.goto(base + "index.html"); await p.waitForTimeout(400);
  const bar = await p.evaluate(() => { const b = document.getElementById("cgSidebar").getBoundingClientRect(); return { top: b.top, h: b.height, w: b.width, pad: parseFloat(getComputedStyle(document.body).paddingLeft) }; });
  ok(bar.top === 0 && bar.h <= 80 && bar.w >= 1350 && bar.pad === 0, `the six hubs are a top bar across the page (${Math.round(bar.w)} x ${Math.round(bar.h)} px), with no side column`);
  ok((await open(p, "details.cg-hub")).length === 0 && JSON.stringify(await here(p)) === '["today"]', "the packet tool opens with no drop-down open and Today marked as the hub that holds it");
  await p.click("#cgHub-studio > summary"); await p.waitForTimeout(150);
  ok(await only(p, "details.cg-hub", "studio"), "clicking Studio opens its drop-down");
  const drop = await p.evaluate(() => { const nav = document.getElementById("cgSidebar").getBoundingClientRect(), d = document.querySelector("#cgHub-studio > .cg-sb-sub").getBoundingClientRect(), links = [...document.querySelectorAll("#cgHub-studio > .cg-sb-sub a")].map(a => a.getBoundingClientRect().height); return { below: d.top >= nav.bottom, h: d.height, n: links.length, min: Math.min(...links) }; });
  ok(drop.below && drop.h > 100 && drop.n === 4 && drop.min >= 52, `the drop-down opens below the bar with its four places, each at least 52 px tall (${drop.n}, smallest ${drop.min} px)`);
  await p.focus("#cgHub-facility > summary"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
  ok(await only(p, "details.cg-hub", "facility"), "Enter on Facility opens it and closes Studio");
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  ok((await open(p, "details.cg-hub")).length === 0 && await p.evaluate(() => document.activeElement === document.querySelector("#cgHub-facility > summary")), "Escape closes it and leaves the keyboard on Facility");
  await p.click("#cgHub-resources > summary"); await p.waitForTimeout(150);
  await p.mouse.click(1290, 700);   // below the page's first screen of cards and well right of the drop-down, which now holds four groups await p.waitForTimeout(150);
  ok((await open(p, "details.cg-hub")).length === 0, "a click elsewhere on the page closes an open drop-down");
  await p.evaluate(() => scrollTo({ top: 1500, behavior: "instant" })); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.getElementById("cgSidebar").getBoundingClientRect().top) === 0, "the bar stays at the top while the page scrolls");
  await p.goto(base + "resources/quality-standards/"); await p.waitForTimeout(400);
  ok((await open(p, "details.cg-hub")).length === 0 && JSON.stringify(await here(p)) === '["resources"]', "a resource module marks Resources as the hub that holds it");
  ok(await p.$eval(".cg-sidebar a[aria-current='page']", e => e.textContent.trim()) === "Quality Standards Hub", "a resource module marks its own link as current");
  await p.goto(base + "contact.html"); await p.waitForTimeout(300);
  ok((await open(p, "details.cg-hub")).length === 0 && (await here(p)).length === 0, "the contact page opens with no hub open or marked");
  ok(await p.$eval(".cg-hub-foot a[aria-current='page']", e => e.textContent.trim()) === "Contact Cognicopia", "the contact page marks its Contact link as current");
  await p.goto(base + "life-planners.html"); await p.waitForTimeout(300);
  ok(JSON.stringify(await here(p)) === '["studio"]' && (await p.$$(".cg-sidebar a[aria-current='page']")).length === 0, "a product page marks Studio and claims no link as the current page");

  /* the same page on a phone: the Menu drawer, with the hub that holds the page open inside it */
  let q = await page(390, 844);
  await q.goto(base + "index.html"); await q.waitForTimeout(400);
  ok(await q.$eval("#cgSbToggle", e => getComputedStyle(e).display !== "none" && e.getAttribute("aria-expanded") === "false"), "on a phone the static pages show the Menu button");
  await q.click("#cgSbToggle"); await q.waitForTimeout(300);
  ok(await q.evaluate(() => { const b = document.getElementById("cgSidebar").getBoundingClientRect(); return b.left >= 0 && b.width > 250; }) && await only(q, "details.cg-hub", "today"), "the Menu opens the drawer with Today open inside it");
  await q.keyboard.press("Escape"); await q.waitForTimeout(300);
  ok(await q.$eval("#cgSbToggle", e => e.getAttribute("aria-expanded") === "false"), "Escape closes the drawer");
  await q.context().close();

  /* the Packet Builder: its sidebar follows its screens */
  await p.goto(base + "builder.html#/"); await p.waitForTimeout(700);
  ok(await only(p, "details.sb-hub", "packets"), "the Packet Builder's home opens Activity Packets");
  ok((await p.$$("#catNav .sb-link")).length === 6, "Activity Packets lists the six activity categories (Coloring is in Studio)");
  await p.click("details.sb-hub[data-hub='studio'] > summary"); await p.waitForTimeout(150);
  ok(await only(p, "details.sb-hub", "studio"), "opening Studio closes Activity Packets");
  await p.click(".sb-link[data-route='coloring']"); await p.waitForTimeout(700);
  ok(await p.$eval(".sb-link[aria-current='page']", e => e.dataset.route) === "coloring", "choosing Cognicopia Coloring marks it current");
  ok(/^\d+$/.test((await p.textContent("#navColoringCount")).trim()), "Cognicopia Coloring shows how many pictures it has");
  await p.click("details.sb-hub[data-hub='facility'] > summary"); await p.click(".sb-link[data-route='roster']"); await p.waitForTimeout(700);
  ok(await p.$eval(".sb-link[aria-current='page']", e => e.dataset.route) === "roster" && await only(p, "details.sb-hub", "facility"), "choosing the roster marks it current and keeps Facility open");
  await p.click("a.sb-hub-link[data-route='academy']"); await p.waitForTimeout(700);
  ok(await p.$eval("a.sb-hub-link[aria-current='page']", e => e.dataset.route) === "academy", "Academy, a plain link, is marked current");
  await p.evaluate(() => { location.hash = "#/planner"; }); await p.waitForTimeout(600);
  ok(await only(p, "details.sb-hub", "studio"), "a typed address (#/planner) opens the hub that holds it");
  await p.evaluate(() => { location.hash = "#/category/word"; }); await p.waitForTimeout(600);
  ok(await p.$eval("#catNav .sb-link[aria-current='page']", e => e.dataset.cat) === "word" && await only(p, "details.sb-hub", "packets"), "a category marks itself current under Activity Packets");
  await p.goBack(); await p.waitForTimeout(600);
  ok(await only(p, "details.sb-hub", "studio"), "Back returns to the hub that held the page before");

  /* a phone: the menu */
  p = await page(390, 844);
  await p.goto(base + "builder.html#/"); await p.waitForTimeout(600);
  ok((await p.getAttribute("#sbToggle", "aria-label")) === "Open Menu", "on a phone the button says Menu");
  await p.click("#sbToggle"); await p.waitForTimeout(250);
  ok(await p.$eval("#sidebar", e => e.classList.contains("is-open")), "the menu opens");
  await p.click("details.sb-hub[data-hub='studio'] > summary"); await p.waitForTimeout(200);
  ok(await p.$eval("#sidebar", e => e.classList.contains("is-open")), "opening a hub keeps the menu open");
  await p.click(".sb-link[data-route='planner']"); await p.waitForTimeout(500);
  ok(!(await p.$eval("#sidebar", e => e.classList.contains("is-open"))), "choosing a place closes the menu");
  ok(errors.length === 0, "no script errors on any of these pages" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `navigation behavior check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ") : `navigation behavior check passed: ${passed} checks`);
process.exit(problems.length ? 1 : 0);
