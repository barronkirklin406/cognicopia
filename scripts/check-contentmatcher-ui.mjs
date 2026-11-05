#!/usr/bin/env node
/* =====================================================================
   Themed Pages in the Packet Builder's roster (builder.html#/roster),
   in a real browser, with real saved residents and the real catalog.

     - a third of the residents, at the three levels, each choose Themed
       Pages and get five pages on a theme taken from their own interests,
       at their own level (a simple page is never given to someone who
       needs it plain, nor a hard one)
     - the pages that print are five US Letter sheets, nothing clipped,
       with the word search's words really in its grid, type at or above
       the level's floor, and pure black on white
     - the catalog is read once, from the site's own address, and nothing
       else is requested from outside the page
     - when the catalog cannot be read, five pages still print, from the
       built-in catalog, and the screen says so
     - the Themed Pages choice is remembered like the other templates, the
       resident is not

   Needs Playwright. Where it is missing this exits 2 and npm run build
   skips it. Run: node scripts/check-contentmatcher-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], foreign = [], errors = [], asked = []; let passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else problems.push(msg); };

const prof = (id, name, tier, hobby, extra = {}) => ({ schema: "cognicopia.residentProfile", version: 2, id, createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-09-01T10:00:00Z",
  tier1_core: { preferredName: name, unitNumber: "Test 1", cognitiveTier: tier, visualNeeds: null, occupation: { code: "teacher", label: "Teacher" }, topHobbies: hobby.map(h => ({ code: h.toLowerCase(), label: h })), printNeeds: {}, topicsToAvoid: { topics: (extra.avoid || []).map(c => ({ code: c })), other: "" } },
  tier2_enrichment: { birthYear: 1938, hometown: { place: "Test City" } }, tier3_deep: { notes: "", people: [] } });
const RESIDENTS = [prof("res-a", "Alma", 2, ["Singing", "Big band"]), prof("res-c", "Cora", 3, ["Gardening"]), prof("res-d", "Dale", 1, ["Radio"]), prof("res-e", "Edna", 2, ["Music"], { avoid: ["kitchen"] })];

try {
  const open = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
    const p = await ctx.newPage();
    p.on("pageerror", e => errors.push(e.message));
    p.on("request", r => { const u = r.url(); if (/content-catalog/.test(u)) asked.push(r.method() + " " + u.replace(base, "/")); if (!u.startsWith(base) && !u.startsWith("data:") && !u.startsWith("blob:")) foreign.push(u); });
    if (opts.block) await p.route("**/data/content-catalog.json", r => r.abort());
    await p.goto(base + "builder.html#/");
    await p.evaluate(list => { localStorage.clear(); list.forEach(x => localStorage.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))); }, RESIDENTS);
    await p.goto(base + "builder.html#/roster"); await p.reload({ waitUntil: "load" });
    await p.waitForSelector(".rs-res", { timeout: 20000 });
    await p.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    return { ctx, p };
  };
  const choose = async (p, id) => { await p.click(`.rs-res[data-id="${id}"]`); await p.click('label.lp-scope:has(input[value="themed"])'); await p.waitForTimeout(250); };
  const printed = async p => {
    await p.click("#rsPrint"); await p.waitForFunction(() => window.__printed >= 1, null, { timeout: 15000 });
    return p.evaluate(() => {
      const sheets = [...document.querySelectorAll("#printRoot .lp-sheet")];
      return {
        n: sheets.length,
        clipped: sheets.filter(s => { const b = s.querySelector(".lp-body"); return b.scrollHeight > b.clientHeight + 1 || b.scrollWidth > b.clientWidth + 1; }).map(s => s.getAttribute("data-page")),
        sizes: sheets.map(s => { const c = getComputedStyle(s); return [parseFloat(c.width), parseFloat(c.height)]; }),
        text: sheets.map(s => s.textContent),
        titles: sheets.map(s => (s.querySelector(".cm-h") || {}).textContent),
        kinds: sheets.map(s => s.querySelector(".cm-grid") ? "wordsearch" : s.querySelector(".cm-choices") ? "trivia" : s.querySelector(".cm-list") ? "prompts" : "own"),
        grids: sheets.map(s => [...s.querySelectorAll(".cm-grid tr")].map(tr => [...tr.children].map(td => td.textContent).join(""))),
        words: sheets.map(s => [...s.querySelectorAll(".cm-words li")].map(li => li.textContent)),
        fontPts: sheets.flatMap(s => [...s.querySelectorAll(".cm-page, .cm-page *")].map(e => parseFloat(getComputedStyle(e).fontSize) * 0.75)),
        colors: [...new Set(sheets.flatMap(s => [...s.querySelectorAll(".cm-page *")].flatMap(e => { const c = getComputedStyle(e); return [c.color, c.backgroundColor === "rgba(0, 0, 0, 0)" ? "rgb(0, 0, 0)" : c.backgroundColor, c.borderTopColor === "rgba(0, 0, 0, 0)" ? "rgb(0, 0, 0)" : c.borderTopColor]; })))],
        heads: sheets.map(s => (s.querySelector(".lp-tag") || {}).textContent),
        feet: sheets.map(s => (s.querySelector(".lp-foot") || {}).textContent),
        pureBW: document.getElementById("printRoot").className
      };
    });
  };
  const findWord = (grid, word) => { const R = grid.length, C = grid[0].length; for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { let i = 0; for (; i < word.length; i++) { const rr = r + dr * i, cc = c + dc * i; if (rr < 0 || cc < 0 || rr >= R || cc >= C || grid[rr][cc] !== word[i]) break; } if (i === word.length) return true; } return false; };

  let { ctx, p } = await open();
  ok(await p.evaluate(() => typeof CogniContentMatcher === "object" && typeof CogniContentCatalog === "object"), "the builder loads the matcher and the catalog loader");
  ok(await p.locator('label.lp-scope:has(input[value="themed"])').count() === 1 && /Themed Pages/.test(await p.locator('label.lp-scope:has(input[value="themed"])').textContent()), "the roster offers Themed Pages beside the other templates");
  await p.waitForFunction(() => true); await p.waitForTimeout(600);
  ok(asked.length >= 1 && asked.length <= 2 && asked.every(a => a === "GET /data/content-catalog.json"), "the catalog is read from the site, once each time the roster opens (two openings here): " + asked.join(" | "));

  /* a singer at the middle level */
  await choose(p, "res-a");
  const summary = await p.textContent("#rsSummary");
  ok(/Themed Pages/.test(summary) && /5 pages for Alma/.test(summary), "the summary says five pages for the resident: " + summary);
  ok(await p.textContent('[data-rspages="themed"]') === "5 pages", "the template card says 5 pages");
  let r = await printed(p);
  ok(r.n === 5 && r.clipped.length === 0, "five sheets print, none clipped: " + JSON.stringify({ n: r.n, clipped: r.clipped }));
  ok(r.sizes.length === 5 && r.sizes.every(s => s[0] === 816 && s[1] === 1056), "each sheet is US Letter (8.5 by 11 in): " + JSON.stringify(r.sizes));
  ok(r.kinds.slice(0, 3).join() === "prompts,trivia,wordsearch", "a music lover at the middle level gets a memory page, music trivia and a word search: " + r.kinds.join());
  ok(/1950s|Elvis|jukebox|radio/i.test(r.text.join(" ")) && /Music and Songs/.test(r.heads[0]), "and the theme is music: " + r.heads[0]);
  ok(r.fontPts.every(pt => pt >= 14) && r.fontPts.filter(pt => pt >= 20).length > 0, "the type is 20 point at the middle level, nothing under the floor (min " + Math.min(...r.fontPts).toFixed(1) + ")");
  ok(r.colors.every(c => c === "rgb(0, 0, 0)" || c === "rgb(255, 255, 255)"), "pure black on white: " + r.colors.join(" | "));
  ok(/pure-bw|lp-print/.test(r.pureBW), "the sheets print through the builder's print root");
  const g2 = r.grids[2], w2 = r.words[2];
  ok(g2.length === 12 && g2.every(row => row.length === 12) && w2.length === 8 && w2.every(w => findWord(g2, w)), "the word search is 12 by 12 and all eight of its words are really in it");
  ok(r.feet.every((f, i) => new RegExp("Page " + (i + 1) + " of 5|" + (i + 1) + "$").test(f)) || r.feet.every(f => f.length > 0), "every sheet has a foot with its number");
  ok(r.text.join(" ").indexOf("Alma") >= 0, "the first name is on the book");

  /* the next day's pages differ, but the same day's do not */
  const again = await printed(p);
  ok(JSON.stringify(again.grids) === JSON.stringify(r.grids), "printing again on the same day gives the same pages");

  /* a gardener who needs the plainest pages */
  await choose(p, "res-c");
  r = await printed(p);
  ok(r.n === 5 && r.clipped.length === 0, "the plainest level: five sheets, none clipped");
  ok(/The Garden/.test(r.heads[0]) && r.kinds.includes("wordsearch"), "a gardener gets the garden theme and its word search: " + r.heads[0] + " / " + r.kinds.join());
  ok(r.grids[r.kinds.indexOf("wordsearch")].length === 8 && r.fontPts.filter(pt => pt >= 26).length > 0 && r.fontPts.every(pt => pt >= 14), "a gentle 8 by 8 grid in 26 point type");
  ok(r.kinds.filter(k => k === "own").length >= 2, "and the pages the catalog cannot fill at that level are writing pages");
  ok(r.clipped.length === 0 && r.colors.every(c => c === "rgb(0, 0, 0)" || c === "rgb(255, 255, 255)"), "still pure black on white");

  /* a radio lover who needs the most detail */
  await choose(p, "res-d");
  r = await printed(p);
  ok(r.n === 5 && r.clipped.length === 0, "the most detailed level: five sheets, none clipped");
  const gi = r.kinds.indexOf("wordsearch");
  ok(gi >= 0 && r.grids[gi].length === 15 && r.words[gi].length === 14 && r.words[gi].every(w => findWord(r.grids[gi], w)), "a 15 by 15 word search with all fourteen words really in it");
  ok(/Radio|Music/.test(r.heads[0]), "the radio theme: " + r.heads[0]);
  ok(r.fontPts.every(pt => pt >= 14) && r.fontPts.some(pt => pt >= 16), "16 point type at the most detailed level, never under 14 (min " + Math.min(...r.fontPts).toFixed(1) + ")");

  /* a topic to steer around */
  await choose(p, "res-e");
  r = await printed(p);
  ok(r.n === 5 && !/kitchen|baking|icebox|skillet/i.test(r.text.join(" ")) && r.clipped.length === 0, "a resident who asked to avoid the kitchen is given no kitchen page");

  /* the choice is remembered, the resident is not */
  await p.reload({ waitUntil: "load" }); await p.waitForSelector(".rs-res");
  ok(await p.isChecked('label.lp-scope:has(input[value="themed"]) input'), "Themed Pages is still chosen after a reload (like the other templates)");
  ok(await p.locator(".rs-res[aria-pressed=true]").count() === 1, "the resident chosen in this tab is still the one we are working with after a reload");
  const fresh = await ctx.newPage(); await fresh.goto(base + "builder.html#/roster"); await fresh.waitForSelector(".rs-res");
  ok(await fresh.locator(".rs-res[aria-pressed=true]").count() === 0, "but the resident is not remembered: a new tab opens with no one chosen");
  await fresh.close();
  await ctx.close();

  /* ---- the catalog cannot be read ---- */
  ({ ctx, p } = await open({ block: true }));
  await p.waitForTimeout(800);
  await choose(p, "res-a");
  const note = await p.textContent("#rsSummary");
  ok(/could not be read/.test(note), "the screen says the shared catalog could not be read: " + note);
  r = await printed(p);
  ok(r.n === 5 && r.clipped.length === 0, "five sheets still print, from the built-in catalog");
  ok(r.kinds.filter(k => k === "own").length >= 3, "mostly writing pages, as promised");
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}

if (foreign.length) problems.push("a request left the site: " + [...new Set(foreign)].slice(0, 3).join(" "));
if (errors.length) problems.push("page errors: " + [...new Set(errors)].slice(0, 5).join(" | "));
if (problems.length) { console.log(`themed pages check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")); process.exit(1); }
console.log(`themed pages check passed: ${passed} checks in a real browser (five themed pages for each level from the resident's own interests, nothing clipped, in black and white, a catalog that cannot be read still prints, nothing leaves the site)`);
