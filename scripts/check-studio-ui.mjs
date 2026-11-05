#!/usr/bin/env node
/* The three Studio tools in the Packet Builder, in a real browser (Playwright; exit 2 where it is not installed):
   #/tracking, #/planner and #/journal are routed and in the sidebar; the tracking page raises a Transition Recommendation from
   three months of logs; the planner fills defaults and pre-maps bundles; the journal feeds the resident's profile notes through the
   background listener; and nothing typed or shown in one tool is in another (state is torn down at each address change). */
import { loadPlaywright, serve } from "./lib/browser.mjs";
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const { chromium } = loadPlaywright(); const { srv, base } = await serve(); const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (x) { /* ignore */ } });
  const p = await ctx.newPage(), errs = [], outside = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 160))); p.on("request", (r) => { if (!r.url().startsWith(base) && !/^(data|blob|about):/.test(r.url())) outside.push(r.url()); });
  const go = async (h) => { await p.goto(base + "builder.html" + h); await p.waitForSelector("#view h1", { timeout: 15000 }); await p.waitForTimeout(500); };
  const route = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(600); };
  await go("#/");
  await p.evaluate(() => { CG_LS.setItem("cognicopia_resident_p1", JSON.stringify({ schema: "cognicopia.residentProfile", id: "p1", tier1_core: { preferredName: "Peggy" }, tier2_enrichment: { birthYear: 1938 }, tier3_deep: {} })); });
  const nav = await p.evaluate(() => [...document.querySelectorAll("#sidebar .sb-link")].map((a) => a.getAttribute("href") + "|" + a.textContent.trim()).filter((x) => /#\/(tracking|planner|journal)\|/.test(x)));
  ok(nav.length === 3 && nav.some((x) => /tracking\|Cognitive Tracking/.test(x)) && nav.some((x) => /planner\|12-Month Seasonal Planner/.test(x)) && nav.some((x) => /journal\|Life Narrative Journal/.test(x)), "the sidebar has the three tools at #/tracking, #/planner and #/journal (" + nav.join("; ") + ")");
  /* tracking */
  await route("#/tracking"); await p.waitForSelector("#stRes");
  const h1 = await p.textContent("#view h1"); ok(h1 === "Longitudinal Cognitive Tracking", "#/tracking opens the tracking tool");
  await p.selectOption("#stRes", "p1"); await p.waitForSelector("#stForm");
  await p.evaluate(async () => { const C = await import("/js/studio-core.js"), t = new Date(), mk = (n) => { const d = new Date(t.getFullYear(), t.getMonth() - n, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }; for (const n of [2, 1]) C.saveEntry(CG_LS, "p1", { month: mk(n), stage: "middle", engagement: 1, frustration: 3, fatigue: 3, triggers: ["Noise", "Small print"], note: "" }); });
  await p.selectOption("#stRes", ""); await p.selectOption("#stRes", "p1"); await p.waitForSelector("#stForm");
  ok(!(await p.textContent("#stBanner")).includes("Transition Recommendation"), "with two months logged there is no recommendation yet");
  await p.check('input[name="engagement"][value="1"]'); await p.check('input[name="frustration"][value="3"]'); await p.check('input[name="fatigue"][value="4"]'); await p.check('input[name="trig"][value="Noise"]'); await p.fill("#stNote", "Rubbed her eyes and set the page aside.");
  await p.click("#stSave"); await p.waitForTimeout(500);
  const banner = await p.textContent("#stBanner"); ok(/Transition Recommendation/.test(banner) && /Late stage/.test(banner) && /not an assessment/.test(banner), "three months of fatigue raises a Transition Recommendation toward the gentler stage (" + banner.trim().slice(0, 80) + "...)");
  const trends = await p.$$eval(".st-matrix tbody tr", (r) => r.length); ok(trends >= 15, "the 12-month matrix and the 3, 6 and 12 month trends are shown (" + trends + " rows)");
  const sizes = await p.$$eval("#stForm input:not([type=hidden]), #stForm textarea, #stForm button", (e) => e.map((x) => { const l = x.closest("label"); const r = (l || x).getBoundingClientRect(); return Math.round(r.height); })); ok(sizes.filter((h) => h > 0 && h < 52).length === 0, "every control in the log form is at least 52 px tall (" + Math.min(...sizes) + " smallest)");
  /* journal + feed */
  await route("#/journal"); await p.waitForSelector("#jnRes"); await p.selectOption("#jnRes", "p1"); await p.waitForSelector("#jnForm");
  ok(!(await p.textContent("#view")).includes("Rubbed her eyes") && !(await p.$("#stForm")), "the journal shows nothing from the tracking tool");
  await p.fill("#jnText", "Hummed Amazing Grace and settled when Biscuit the dog sat beside her."); await p.waitForTimeout(100);
  ok(/biscuit/.test(await p.textContent("#jnKw")), "keywords appear as the note is written");
  await p.click("#jnForm button[type=submit]"); await p.waitForFunction(() => /added to their profile notes:/.test(document.querySelector("#jnFeed").textContent), null, { timeout: 5000 });
  const fed = await p.evaluate(() => { const ins = JSON.parse(CG_LS.getItem("cognicopia_resident_insights_p1")), pr = JSON.parse(CG_LS.getItem("cognicopia_resident_p1")); return { kw: ins.keywords, an: ins.anecdotes.length, deep: pr.tier3_deep.lifeNarrative && pr.tier3_deep.lifeNarrative.keywords, name: pr.tier1_core.preferredName }; });
  ok(fed.kw.biscuit === 1 && fed.an === 1 && fed.deep.includes("biscuit") && fed.name === "Peggy", "the background listener added the keywords and story to the resident's profile notes, leaving the rest of the profile alone");
  ok(/biscuit/.test(await p.textContent("#view")) && (await p.$$eval(".st-list li", (l) => l.length)) === 1, "the journal lists the entry and the profile keywords");
  /* planner */
  await route("#/planner"); await p.waitForSelector("#plDefaults");
  ok(!(await p.$("#jnForm")) && !(await p.textContent("#view")).includes("Biscuit"), "the planner shows nothing from the journal");
  await p.click("#plDefaults"); await p.waitForTimeout(300);
  const nov = await p.$eval('tr[data-m="11"] [data-f="milestone"]', (e) => e.value); ok(nov === "Thanksgiving", "defaults give each month an era, season and milestone (November: " + nov + ")");
  await p.fill('tr[data-m="12"] [data-f="theme"]', "Winter lights and music"); await p.dispatchEvent('tr[data-m="12"] [data-f="theme"]', "change");
  await p.click("#plPremap"); await p.waitForTimeout(400);
  const st = await p.textContent("#plStatus"); const saved = await p.evaluate(() => { const y = new Date().getFullYear(), pl = JSON.parse(CG_LS.getItem("cognicopia_studio_planner_" + y)); return { b: pl.bundles.length, dec: (pl.bundles.find((b) => b.month === y + "-12") || {}).theme }; });
  ok(/linked to roster bundles/.test(st) && saved.b >= 1 && (saved.dec === "Winter lights and music" || new Date().getMonth() === 11), "the bulk pre-map links the coming months to bundles and uses the month's own theme (" + saved.b + " mapped; " + st.trim().slice(0, 60) + ")");
  /* isolation */
  await route("#/journal"); await p.waitForSelector("#jnRes"); await p.selectOption("#jnRes", "p1"); await p.fill("#jnText", "unsaved private words");
  await route("#/tracking"); await p.waitForSelector("#stRes");
  ok(!(await p.textContent("#view")).includes("unsaved private words") && !(await p.$("#jnText")), "an unsaved note does not follow you to another tool");
  await route("#/journal"); await p.waitForSelector("#jnRes"); ok((await p.$eval("#jnText", (e) => e.value).catch(() => "")) === "", "coming back to a tool opens it fresh");
  const keys = await p.evaluate(() => { const o = {}; for (let i = 0; i < CG_LS.length; i++) { const k = CG_LS.key(i); if (/^cognicopia_(studio|resident_insights)/.test(k)) o[k] = CG_LS.getItem(k); } return o; });
  ok(Object.entries(keys).every(([k, v]) => !/unsaved private words/.test(v)) && Object.keys(keys).some((k) => /studio_tracking_p1/.test(k)) && Object.keys(keys).some((k) => /studio_journal_p1/.test(k)) && Object.keys(keys).some((k) => /studio_planner_/.test(k)), "each tool kept its records under its own key and the unsaved text was never stored");
  const mounted = await p.evaluate(() => window.CogniStudio.current()); await route("#/roster"); ok(mounted === "journal" && (await p.evaluate(() => window.CogniStudio.current())) === null && (await p.$$eval("#view [data-st]", (e) => e.length)) === 0, "leaving a Studio tool tears it down");
  /* legacy */
  await route("#/life-journal"); await p.waitForSelector("#lj-name"); ok(!!(await p.$("#lj-name")), "the old combined journal is still reachable at #/life-journal");
  ok(outside.length === 0 && errs.length === 0, "no outside request and no script error (" + outside.concat(errs).slice(0, 2).join("; ") + ")");
  await ctx.close();
} finally { await browser.close(); srv.close(); }
if (problems.length) { console.error("studio UI check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("studio UI check passed: " + passed + " checks in a real browser (routes and sidebar, recommendation banner, planner pre-map, journal feed, isolation, teardown)");
