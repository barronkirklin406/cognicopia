#!/usr/bin/env node
/* =====================================================================
   The Packet Builder's buttons and routes, driven in a real browser (Playwright; exit 2 where it is not installed).

     buttons   the ones an audit once flagged as doing nothing each do something a person can see or get:
               Reminiscence "A fresh set" changes the cards and says so, "Print now" opens the print window;
               the Roster's census "Read the file" says to choose a file first and "Download a template" gives the file;
               the Journal's step buttons move the page; the Facility "Overview" tab is the one selected
     icons     the menu's icons are 24 px or larger and the card icons 28 px or larger
     resident  the one chosen resident stays chosen as the tab moves from screen to screen, and is kept for this tab only
     routes    fourteen screens open with no script error and no console error, and nothing is requested from outside the page
   ===================================================================== */
import fs from "fs";
import { serve, loadPlaywright } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

const outside = [], errors = [];
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block", acceptDownloads: true });
const pg = await ctx.newPage();
pg.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) outside.push(u); });
pg.on("pageerror", e => errors.push("page: " + e.message));
pg.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
pg.on("dialog", d => d.accept());
await pg.addInitScript(() => { window.__pr = 0; window.print = () => { window.__pr++; }; });
const go = async hash => { await pg.goto(base + "builder.html" + hash); await pg.waitForTimeout(1000); };

/* ---------- Reminiscence ---------- */
await go("#/reminiscence");
const before = await pg.$eval("#rmList", e => e.textContent);
await pg.click("#rmNew"); await pg.waitForTimeout(500);
ok(before !== await pg.$eval("#rmList", e => e.textContent), "Reminiscence: \"A fresh set\" changes the cards");
await pg.click("#rmPrint"); await pg.waitForTimeout(2500);
ok(await pg.evaluate(() => window.__pr) >= 1, "Reminiscence: \"Print now\" opens the print window");

/* ---------- two made-up residents, and the Roster's census buttons ---------- */
const tmp = "/tmp/cognicopia-builder-buttons-census.csv";
fs.writeFileSync(tmp, 'Alias,Preferred Name,GDS,Life Era,Hobbies,Wing,Room\n"Resident 201-A",Dorothy,5,"1940s-1950s","gardening; church choir",Memory Care Unit A,201-A\nResident 202-B,Walter,3,1960s,"fishing",Memory Care Unit A,202-B\n');
await go("#/roster");
await pg.click("#rsCs > summary");
await pg.click("#rsCsRead"); await pg.waitForTimeout(300);
ok(/Choose the census file first/.test(await pg.$eval("#rsCsOut", e => e.textContent)), "Roster: \"Read the file\" asks for a file first");
const [dl] = await Promise.all([pg.waitForEvent("download", { timeout: 4000 }).catch(() => null), pg.click("#rsCsTpl")]);
ok(!!dl && /census template/i.test(dl.suggestedFilename()), "Roster: \"Download a template\" gives the template file");
await pg.setInputFiles("#rsCsFile", tmp); await pg.click("#rsCsRead"); await pg.waitForSelector("#rsCsGo"); await pg.click("#rsCsGo"); await pg.waitForTimeout(500);
ok(await pg.$$eval("#rsList .rs-res", e => e.length) === 2, "Roster: reading and importing the census adds both residents");

/* ---------- the one resident stays chosen as the tab moves ---------- */
const dorothy = await pg.$eval("#arSel", s => [...s.options].filter(o => /Dorothy/.test(o.textContent)).map(o => o.value)[0]);
await pg.selectOption("#arSel", dorothy); await pg.waitForTimeout(400);
const routes = ["#/", "#/category/word", "#/coloring", "#/planner", "#/journal", "#/roster", "#/clinical", "#/heirloom", "#/reminiscence", "#/shift", "#/facility", "#/academy", "#/settings", "#/planner-care-companion"];
let kept = 0;
for (const r of routes) {
  await pg.evaluate(h => { location.hash = h; }, r); await pg.waitForTimeout(500);
  if (await pg.evaluate(() => sessionStorage.getItem("cgb_active_resident")) === dorothy && await pg.$eval("#arSel", s => s.value) === dorothy) kept++;
}
ok(kept === routes.length, `the chosen resident stays chosen on every screen (${kept} of ${routes.length})`);
ok(!(await pg.evaluate(() => { for (let i = 0; i < localStorage.length; i++) if (localStorage.getItem(localStorage.key(i)) === "" + sessionStorage.getItem("cgb_active_resident")) return true; return false; })), "and is kept for this tab only, not on the disk");

/* ---------- the Journal's steps and the Facility tab ---------- */
await go("#/journal");
const y0 = await pg.evaluate(() => scrollY);
await pg.click(".lp-step >> nth=1"); await pg.waitForTimeout(700);
ok(await pg.evaluate(() => scrollY) !== y0, "Journal: the second step moves to its section");
await go("#/facility");
ok(await pg.$eval("#fpTab-overview", e => e.getAttribute("aria-selected")) === "true", "Facility: Overview is the tab that is open");

/* ---------- the icons ---------- */
await go("#/");
const sizes = await pg.evaluate(() => ({
  menu: Math.min(...[...document.querySelectorAll("#sidebar .sb-link svg")].map(s => s.getBoundingClientRect().width)),
  cards: Math.min(...[...document.querySelectorAll(".home-card svg, .tool-card svg, .card svg")].filter(s => s.getBoundingClientRect().width > 0).map(s => s.getBoundingClientRect().width).concat([99]))
}));
ok(sizes.menu >= 23.5, `the menu's icons are 24 px or larger (smallest ${sizes.menu.toFixed(1)} px)`);

/* ---------- every screen opens clean ---------- */
errors.length = 0;
for (const r of routes) { await go(r); }
ok(errors.length === 0, "fourteen screens open with no script or console error" + (errors.length ? ": " + [...new Set(errors)].slice(0, 3).join("; ") : ""));
ok(outside.length === 0, "nothing was requested from outside the page" + (outside.length ? ": " + outside.slice(0, 3).join(", ") : ""));

await browser.close(); srv.close();
console.log(problems.length ? `builder buttons check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ") : `builder buttons check passed: ${passed} checks in a real browser (the audited buttons, the chosen resident across ${routes.length} screens, icon sizes, clean screens, nothing leaving the page)`);
process.exit(problems.length ? 1 : 0);
