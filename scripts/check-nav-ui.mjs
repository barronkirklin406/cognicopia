#!/usr/bin/env node
/* =====================================================================
   Navigation behavior, in a real browser: the three doors (Today, Packets,
   Residents) and "For directors" open and close the way a person expects (drop-downs across the top bar of a wide window, a
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
  /* a static page on a wide window (1280 px and up): the three doors and "For directors" run across a top bar, each a drop-down. None is open as the page opens; the hub that holds the
     page is marked; opening one closes the others; a click elsewhere or Escape closes it; the bar stays at the top while the page scrolls */
  let p = await page(1366, 900);
  const here = q => q.$$eval("details.cg-hub[data-here]", n => n.map(d => d.id.replace("cgHub-", "")));
  await p.goto(base + "index.html"); await p.waitForTimeout(400);
  const bar = await p.evaluate(() => { const b = document.getElementById("cgSidebar").getBoundingClientRect(); return { top: b.top, h: b.height, w: b.width, pad: parseFloat(getComputedStyle(document.body).paddingLeft) }; });
  ok(bar.top === 0 && bar.h <= 80 && bar.w >= 1350 && bar.pad === 0, `the doors are a top bar across the page (${Math.round(bar.w)} x ${Math.round(bar.h)} px), with no side column`);
  const doors = await p.$$eval(".cg-hubs > .cg-hub-li", l => l.map(x => x.querySelector("summary").textContent.trim()));
  ok(JSON.stringify(doors) === '["Today","Packets","Residents","For directors"]', `the bar holds the three doors and For directors, in that order, and nothing else (${doors.join(", ")})`);
  ok((await open(p, "details.cg-hub")).length === 0 && JSON.stringify(await here(p)) === '["packets"]', "the packet tool opens with no drop-down open and Packets marked as the door that holds it");
  await p.click("#cgHub-packets > summary"); await p.waitForTimeout(150);
  ok(await only(p, "details.cg-hub", "packets"), "clicking Packets opens its drop-down");
  const drop = await p.evaluate(() => { const nav = document.getElementById("cgSidebar").getBoundingClientRect(), d = document.querySelector("#cgHub-packets > .cg-sb-sub").getBoundingClientRect(), links = [...document.querySelectorAll("#cgHub-packets > .cg-sb-sub a")].map(a => a.getBoundingClientRect().height); return { below: d.top >= nav.bottom, h: d.height, n: links.length, min: Math.min(...links) }; });
  ok(drop.below && drop.h > 100 && drop.n >= 8 && drop.min >= 52, `the drop-down opens below the bar with the packet tools, each at least 52 px tall (${drop.n}, smallest ${drop.min} px)`);
  await p.focus("#cgHub-directors > summary"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
  ok(await only(p, "details.cg-hub", "directors"), "Enter on For directors opens it and closes Packets");
  const secs = await p.$$eval("#cgHub-directors .cg-sb-glabel", l => l.map(x => x.textContent.trim()));
  const panel = await p.evaluate(() => { const r = document.querySelector("#cgHub-directors > .cg-sb-sub").getBoundingClientRect(); return { l: r.left, r: r.right, links: document.querySelectorAll("#cgHub-directors > .cg-sb-sub a").length }; });
  ok(JSON.stringify(secs) === '["Facility","Academy","Resources"]' && panel.l >= 0 && panel.r <= 1366 && panel.links <= 12, `For directors holds three sections, Facility, Academy and Resources, a short list each, inside the window (${secs.join(", ")}; ${panel.links} links)`);
  ok(await p.evaluate(() => { const e = document.querySelector("#cgHub-directors > summary"), c = getComputedStyle(e); return c.color !== c.backgroundColor; }), "an open door's name stays readable");
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  ok((await open(p, "details.cg-hub")).length === 0 && await p.evaluate(() => document.activeElement === document.querySelector("#cgHub-directors > summary")), "Escape closes it and leaves the keyboard on For directors");
  await p.click("#cgHub-directors > summary"); await p.waitForTimeout(150);
  await p.mouse.click(1290, 700);   // below the page's first screen of cards and well right of the drop-down, which now holds four groups await p.waitForTimeout(150);
  ok((await open(p, "details.cg-hub")).length === 0, "a click elsewhere on the page closes an open drop-down");
  await p.evaluate(() => scrollTo({ top: 1500, behavior: "instant" })); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.getElementById("cgSidebar").getBoundingClientRect().top) === 0, "the bar stays at the top while the page scrolls");
  await p.goto(base + "resources/quality-standards/"); await p.waitForTimeout(400);
  ok((await open(p, "details.cg-hub")).length === 0 && JSON.stringify(await here(p)) === '["directors"]', "a resource module marks For directors as the door that holds it");
  ok((await p.$$(".cg-sidebar a[aria-current='page']")).length === 0, "a module the short list does not show marks its door only (its link is on the Resources page and in the search)");
  await p.goto(base + "resources/caregiver-faq/"); await p.waitForTimeout(400);
  ok(await p.$eval(".cg-sidebar a[aria-current='page']", e => e.textContent.trim()) === "Caregiver FAQ", "a module in the short list marks its own link as current");
  await p.goto(base + "contact.html"); await p.waitForTimeout(300);
  ok((await open(p, "details.cg-hub")).length === 0 && (await here(p)).length === 0, "the contact page opens with no hub open or marked");
  ok(await p.$eval(".cg-hub-foot a[aria-current='page']", e => e.textContent.trim()) === "Contact Cognicopia", "the contact page marks its Contact link as current");
  await p.goto(base + "life-planners.html"); await p.waitForTimeout(300);
  ok(JSON.stringify(await here(p)) === '["packets"]' && (await p.$$(".cg-sidebar a[aria-current='page']")).length === 0, "a product page marks Packets and claims no link as the current page");

  /* the same page on a phone: the Menu drawer, with the hub that holds the page open inside it */
  let q = await page(390, 844);
  await q.goto(base + "index.html"); await q.waitForTimeout(400);
  ok(await q.$eval("#cgSbToggle", e => getComputedStyle(e).display !== "none" && e.getAttribute("aria-expanded") === "false"), "on a phone the static pages show the Menu button");
  await q.click("#cgSbToggle"); await q.waitForTimeout(300);
  ok(await q.evaluate(() => { const b = document.getElementById("cgSidebar").getBoundingClientRect(); return b.left >= 0 && b.width > 250; }) && await only(q, "details.cg-hub", "packets"), "the Menu opens the drawer with Packets open inside it");
  ok(await q.evaluate(() => { const b = document.querySelector(".cg-sidebar-brand"); const r = b && b.getBoundingClientRect(); return !!r && r.width > 0 && getComputedStyle(b).display !== "none"; }), "on a phone the Cognicopia name and logo are on the screen with the Menu");
  await q.keyboard.press("Escape"); await q.waitForTimeout(300);
  ok(await q.$eval("#cgSbToggle", e => e.getAttribute("aria-expanded") === "false"), "Escape closes the drawer");
  await q.context().close();

  /* the Packet Builder: its sidebar follows its screens */
  await p.goto(base + "builder.html#/"); await p.waitForTimeout(700);
  ok(await only(p, "details.sb-hub", "packets"), "the Packet Builder's home opens Packets");
  ok(JSON.stringify(await p.$$eval("details.sb-hub > summary", s => s.map(x => x.textContent.trim()))) === '["Today","Packets","Residents","For directors"]', "its menu holds the same three doors and For directors");
  ok((await p.$$("#catNav .sb-link")).length === 6, "Packets lists the six activity categories");
  await p.click("details.sb-hub[data-hub='residents'] > summary"); await p.waitForTimeout(150);
  ok(await only(p, "details.sb-hub", "residents"), "opening Residents closes Packets");
  await p.click("details.sb-hub[data-hub='packets'] > summary"); await p.waitForTimeout(150);
  await p.click(".sb-link[data-route='coloring']"); await p.waitForTimeout(700);
  ok(await p.$eval(".sb-link[aria-current='page']", e => e.dataset.route) === "coloring", "choosing Cognicopia Coloring marks it current");
  ok(/^\d+$/.test((await p.textContent("#navColoringCount")).trim()), "Cognicopia Coloring shows how many pictures it has");
  /* For directors: the Facility Portal on top, then six sections (Facility's four, the Academy, Resources), each opening by its heading */
  await p.click("details.sb-hub[data-hub='directors'] > summary"); await p.waitForTimeout(150);
  const facSeen = () => p.$$eval("details.sb-hub[data-hub='directors'] :is(a, summary)", els => els.filter(e => e.checkVisibility({ checkVisibilityCSS: true })).length);
  ok(await facSeen() === 8, `opening For directors shows its own heading, the Portal and six section headings, not every link (${await facSeen()})`);
  ok(await p.$$eval("details.sb-hub[data-hub='directors'] .sb-sub", d => d.length) === 6 && await p.$$eval("details.sb-hub[data-hub='directors'] .sb-link", l => l.length) === 16, "all sixteen links are still there, in six sections");
  ok(await p.$$eval("details.sb-sub", d => d.every(x => !x.open)), "no section starts open when no director's screen is open");
  await p.click("details.sb-sub[data-part='every'] > summary"); await p.waitForTimeout(150);
  await p.click("details.sb-sub[data-part='records'] > summary"); await p.waitForTimeout(150);
  ok(await p.$$eval("details.sb-sub", d => d.filter(x => x.open).map(x => x.dataset.part).join()) === "records", "opening one section closes the other");
  const subH = await p.$$eval(".sb-sub-head", h => h.map(x => Math.round(x.getBoundingClientRect().height)));
  ok(subH.length === 6 && subH.every(h => h >= 52), `the section headings are at least 52 px (${subH.join(", ")})`);
  await p.click("details.sb-sub[data-part='every'] > summary"); await p.click(".sb-link[data-route='shift']"); await p.waitForTimeout(700);
  ok(await p.$eval(".sb-link[aria-current='page']", e => e.dataset.route) === "shift" && await only(p, "details.sb-hub", "directors"), "choosing the Shift board marks it current and keeps For directors open");
  ok(await p.$$eval("details.sb-sub", d => d.filter(x => x.open).map(x => x.dataset.part).join()) === "every", "and the section that holds it is the one open");
  await p.click("details.sb-hub[data-hub='residents'] > summary"); await p.click(".sb-link[data-route='roster']"); await p.waitForTimeout(700);
  ok(await p.$eval(".sb-link[aria-current='page']", e => e.dataset.route) === "roster" && await only(p, "details.sb-hub", "residents"), "choosing the roster marks it current and keeps Residents open");
  await p.click("details.sb-hub[data-hub='directors'] > summary"); await p.click("details.sb-sub[data-part='academy'] > summary"); await p.click(".sb-link[data-route='academy']"); await p.waitForTimeout(700);
  ok(await p.$eval(".sb-link[aria-current='page']", e => e.dataset.route) === "academy" && await only(p, "details.sb-hub", "directors") && await p.$$eval("details.sb-sub", d => d.filter(x => x.open).map(x => x.dataset.part).join()) === "academy", "choosing the Academy marks it current and keeps its section of For directors open");
  await p.evaluate(() => { location.hash = "#/planner"; }); await p.waitForTimeout(600);
  ok(await only(p, "details.sb-hub", "packets"), "a typed address (#/planner) opens the door that holds it");
  await p.evaluate(() => { location.hash = "#/clinical"; }); await p.waitForTimeout(600);
  ok(await only(p, "details.sb-hub", "directors") && await p.$$eval("details.sb-sub", d => d.filter(x => x.open).map(x => x.dataset.part).join()) === "records", "a typed address inside For directors (#/clinical) opens it and the section that holds it");
  await p.evaluate(() => { location.hash = "#/planner"; }); await p.waitForTimeout(500);
  await p.evaluate(() => { location.hash = "#/category/word"; }); await p.waitForTimeout(600);
  ok(await p.$eval("#catNav .sb-link[aria-current='page']", e => e.dataset.cat) === "word" && await only(p, "details.sb-hub", "packets"), "a category marks itself current under Packets");
  await p.goBack(); await p.waitForTimeout(600);
  ok(await only(p, "details.sb-hub", "packets"), "Back returns to the door that held the page before");

  /* a phone: the menu */
  p = await page(390, 844);
  await p.goto(base + "builder.html#/"); await p.waitForTimeout(600);
  ok((await p.getAttribute("#sbToggle", "aria-label")) === "Open Menu", "on a phone the button says Menu");
  await p.click("#sbToggle"); await p.waitForTimeout(250);
  ok(await p.$eval("#sidebar", e => e.classList.contains("is-open")), "the menu opens");
  await p.click("details.sb-hub[data-hub='residents'] > summary"); await p.waitForTimeout(200);
  ok(await p.$eval("#sidebar", e => e.classList.contains("is-open")), "opening a door keeps the menu open");
  await p.click(".sb-link[data-route='roster']"); await p.waitForTimeout(500);
  ok(!(await p.$eval("#sidebar", e => e.classList.contains("is-open"))), "choosing a place closes the menu");
  /* the floating Menu button never covers the action bar (the free-trial line, the buttons), on a phone, a narrow tablet or a wide one */
  for (const [w, h] of [[390, 844], [700, 900], [1024, 768]]) {
    const q2 = await page(w, h);
    for (const f of ["daily.html", "activity-studio.html", "tablet.html", "profile.html", "pricing.html", "resources/caregiver-faq/index.html"]) {
      await q2.goto(base + f, { waitUntil: "load" }); await q2.waitForTimeout(500);
      const hit = await q2.evaluate(() => { const m = document.getElementById("cgSbToggle"), a = m && m.getBoundingClientRect(); if (!a || !a.width) return "no Menu button";
        return [...document.querySelectorAll(".cg-topbar .cg-chip, .cg-topbar a, .cg-topbar button")].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.height && getComputedStyle(e).visibility !== "hidden" && b.left < a.right && b.right > a.left && b.top < a.bottom && b.bottom > a.top; }).map(e => e.textContent.trim().slice(0, 30)).join(" | "); });
      ok(hit === "", `${f} at ${w} px: the Menu button covers nothing in the action bar` + (hit ? ` (it covers: ${hit})` : ""));
    }
    await q2.context().close();
  }
  ok(errors.length === 0, "no script errors on any of these pages" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `navigation behavior check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ") : `navigation behavior check passed: ${passed} checks`);
process.exit(problems.length ? 1 : 0);
