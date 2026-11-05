#!/usr/bin/env node
/* =====================================================================
   The Resident Roster (builder.html#/roster), in a real browser.
     the list       each resident is a row (or a card) with initials, a name, a room and a tier tint; the filter chips show
                    how many residents a click would show; High contrast is a filter of its own; sorting by room or by name;
                    the choice of list or cards and the sort are remembered, the resident never is
     the search     every word must appear in the name, the alias or the room, in any order, accents and case ignored; a
                    search that finds nobody says so and offers "Show everyone"
     the keyboard   Down from the search box enters the list, Up and Down walk it, Home and End jump, Enter in the search
                    box chooses the first match; a filter chip keeps the keyboard after it redraws
     first use      an empty roster shows what to do (add a profile, import a census), not an empty box
     all            every control is 52 px, nothing sideways on a phone, nothing leaves the page, no script error
   Needs Playwright. Run: node scripts/check-roster-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

/* made-up people only */
const resident = (id, name, unit, tier, highContrast) => ({ schema: "cognicopia.residentProfile", version: 2, id, createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-09-01T10:00:00Z",
  tier1_core: { preferredName: name, unitNumber: unit, cognitiveTier: tier, visualNeeds: highContrast ? { contrastMode: "high_contrast", lineThicknessPt: 3 } : null, occupation: { code: "teacher", label: "Teacher" }, topHobbies: [{ code: "gardening", label: "Gardening" }], printNeeds: {}, topicsToAvoid: { topics: [], other: "" }, difficulty: { level: tier } },
  tier2_enrichment: { birthYear: 1936, hometown: { place: "Test City" } }, tier3_deep: { notes: "", people: [] } });
const PEOPLE = [resident("r1", "Dorothy Test", "201-A", 2), resident("r2", "Walter Test", "202-B", 1), resident("r3", "Zoë Álvarez", "203-A", 3, true), resident("r4", "Harold Test", "204-A", 1), resident("r5", "Evelyn Test", "", 2)];

async function open(w, h, people) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block" });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } });
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + "builder.html#/roster", { waitUntil: "load" }); await p.waitForSelector("#rsScreen", { timeout: 8000 });
  if (people.length) {
    await p.evaluate(list => list.forEach(x => localStorage.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))), people);
    await p.reload({ waitUntil: "load" }); await p.waitForSelector("#rsScreen", { timeout: 8000 });
  }
  await p.waitForTimeout(300);
  return { ctx, p };
}
const names = p => p.$$eval("#rsList .rs-res b", e => e.map(x => x.textContent.trim()));
const chip = (p, sel) => p.$eval(sel, e => ({ text: e.textContent.replace(/\s+/g, " ").trim(), pressed: e.getAttribute("aria-pressed") }));
const count = (p, t) => p.$eval(`.rs-chip[data-tier="${t}"] .rs-n`, e => +e.textContent);
const hereIs = (p, sel) => p.evaluate(s => document.activeElement && document.activeElement.matches(s), sel);

try {
  /* ---------- the list, the counts, the tints ---------- */
  let { ctx, p } = await open(1366, 900, PEOPLE);
  ok(JSON.stringify(await names(p)) === JSON.stringify(["Dorothy Test", "Walter Test", "Zoë Álvarez", "Harold Test", "Evelyn Test"]), "five residents are listed by room (the one with no room last)");
  ok(JSON.stringify(await p.$$eval("#rsList .rs-av", e => e.map(x => x.textContent))) === JSON.stringify(["DT", "WT", "ZÁ", "HT", "ET"]), "each row has the resident's initials in a circle");
  ok(await p.$eval("#rsList .rs-res", e => e.textContent.indexOf("Unit 201-A") >= 0) && (await p.$$eval("#rsList .rs-res", e => e[4].textContent.indexOf("No unit on file") >= 0)), "the room is shown, and a missing room says so");
  const counts = [await count(p, 0), await count(p, 1), await count(p, 2), await count(p, 3), await p.$eval(".rs-chip[data-flag] .rs-n", e => +e.textContent)];
  ok(JSON.stringify(counts) === JSON.stringify([5, 2, 2, 1, 1]), `the chips show how many residents each would show (${counts.join(", ")})`);
  const tints = await p.$$eval("#rsList .rs-av", e => e.map(x => getComputedStyle(x).backgroundColor));
  ok(new Set(tints).size === 3, "the three tiers have three different tints");

  /* ---------- filters ---------- */
  await p.click('.rs-chip[data-tier="1"]');
  ok(JSON.stringify(await names(p)) === JSON.stringify(["Walter Test", "Harold Test"]) && (await chip(p, '.rs-chip[data-tier="1"]')).pressed === "true", "Tier 1 shows the two Tier 1 residents and is marked pressed");
  ok(await hereIs(p, '.rs-chip[data-tier="1"]'), "the keyboard stays on the chip after the list is redrawn");
  ok(await p.textContent("#rsCount") === "2 of 5 residents shown", "the count says 2 of 5 residents shown");
  ok(+(await p.$eval(".rs-chip[data-flag] .rs-n", e => e.textContent)) === 0, "High contrast counts none within Tier 1");
  await p.click('.rs-chip[data-tier="0"]'); await p.click(".rs-chip[data-flag]");
  ok(JSON.stringify(await names(p)) === JSON.stringify(["Zoë Álvarez"]) && (await chip(p, ".rs-chip[data-flag]")).pressed === "true", "High contrast shows only the resident who needs it");
  await p.click(".rs-chip[data-flag]");
  ok((await names(p)).length === 5, "pressing it again shows everyone");

  /* ---------- search: every word, any order, accents ignored ---------- */
  await p.fill("#rsSearch", "alvarez zoe");
  ok(JSON.stringify(await names(p)) === JSON.stringify(["Zoë Álvarez"]), "two words in any order, typed without accents, find Zoë Álvarez");
  ok(await count(p, 0) === 1 && await count(p, 3) === 1 && await count(p, 1) === 0, "the chips count within the search");
  await p.fill("#rsSearch", "202");
  ok(JSON.stringify(await names(p)) === JSON.stringify(["Walter Test"]), "a room number finds the resident");
  await p.fill("#rsSearch", "zzz");
  const emptyShown = await p.$eval("#rsEmpty", e => !e.hidden && e.textContent.indexOf("Nobody matches that") >= 0);
  ok(emptyShown && (await names(p)).length === 0, "a search that finds nobody says so");
  await p.click("#rsEmpty [data-clear]");
  ok((await names(p)).length === 5 && await p.inputValue("#rsSearch") === "" && await hereIs(p, "#rsSearch") && await p.$eval("#rsEmpty", e => e.hidden), "Show everyone clears the search and the filters and puts the keyboard back in the search box");

  /* ---------- sort and view are remembered; the resident is not ---------- */
  await p.selectOption("#rsSort", "name");
  ok(JSON.stringify(await names(p)) === JSON.stringify(["Dorothy Test", "Evelyn Test", "Harold Test", "Walter Test", "Zoë Álvarez"]), "sorting by name puts them in alphabetical order");
  await p.click('.rs-view [data-view="cards"]');
  const cols = await p.$$eval("#rsList .rs-res", e => new Set(e.map(x => Math.round(x.getBoundingClientRect().left))).size);
  ok(await p.getAttribute("#rsList", "data-view") === "cards" && cols >= 2 && (await chip(p, '.rs-view [data-view="cards"]')).pressed === "true", `Cards lays the residents out in columns (${cols})`);
  await p.click("#rsList .rs-res >> nth=1"); await p.waitForTimeout(150);
  ok((await p.textContent(".rs-name")).indexOf("Evelyn") >= 0, "choosing a resident shows who the book is for");
  await p.reload({ waitUntil: "load" }); await p.waitForSelector("#rsScreen"); await p.waitForTimeout(300);
  ok(await p.inputValue("#rsSort") === "name" && await p.getAttribute("#rsList", "data-view") === "cards", "after a reload the sort and the view are as they were left");
  const leaked = await p.evaluate(() => Object.keys(localStorage).filter(k => /roster/i.test(k)).map(k => localStorage.getItem(k)).join(" "));
  ok(!/r[1-5]\b|Evelyn|Dorothy/.test(leaked), "what is remembered for the roster names no resident");

  /* ---------- the keyboard ---------- */
  await p.click('.rs-view [data-view="list"]'); await p.selectOption("#rsSort", "room");
  await p.focus("#rsSearch"); await p.keyboard.press("ArrowDown");
  ok(await hereIs(p, ".rs-res") && await p.evaluate(() => document.activeElement.textContent.indexOf("Dorothy") >= 0), "Down from the search box enters the list on the first resident");
  await p.keyboard.press("ArrowDown");
  ok(await p.evaluate(() => document.activeElement.textContent.indexOf("Walter") >= 0), "Down moves to the next resident");
  await p.keyboard.press("End");
  ok(await p.evaluate(() => document.activeElement.textContent.indexOf("Evelyn") >= 0), "End goes to the last resident");
  await p.keyboard.press("Home"); await p.keyboard.press("ArrowUp");
  ok(await hereIs(p, "#rsSearch"), "Up from the first resident goes back to the search box");
  await p.fill("#rsSearch", "harold"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
  ok((await p.textContent(".rs-name")).indexOf("Harold") >= 0, "Enter in the search box chooses the first match");

  /* ---------- touch size ---------- */
  const small = await p.evaluate(() => [...document.querySelectorAll(".rs-chip,.rs-view button,#rsSort,.rs-res")].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 51.5 || r.width < 51.5); }).map(e => e.className || e.id));
  ok(small.length === 0, "every chip, view button, the sort and every resident is at least 52 px" + (small.length ? ": " + small.slice(0, 4).join(", ") : ""));
  await ctx.close();

  /* ---------- first use: nobody saved yet ---------- */
  ({ ctx, p } = await open(1366, 900, []));
  const first = await p.evaluate(() => { const e = document.getElementById("rsEmpty"); return { shown: !e.hidden, add: !!e.querySelector('a[href="profile.html"]'), census: !!e.querySelector("[data-opencensus]"), disabled: document.getElementById("rsSearch").disabled }; });
  ok(first.shown && first.add && first.census && first.disabled, "with nobody saved the roster offers to add a profile or import a census, and the search box waits");
  await p.click("#rsEmpty [data-opencensus]"); await p.waitForTimeout(150);
  ok(await p.$eval("#rsCs", e => e.open), "Import a census opens the census section");
  await ctx.close();

  /* ---------- a phone ---------- */
  ({ ctx, p } = await open(390, 844, PEOPLE));
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "nothing scrolls sideways on a phone");
  await p.click('.rs-view [data-view="cards"]');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1) && (await p.$$eval("#rsList .rs-res", e => e.every(x => x.getBoundingClientRect().right <= innerWidth + 1))), "and the cards fit the screen");
  await ctx.close();

  ok(foreign.length === 0, "nothing is requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 2).join(", ") : ""));
  ok(errors.length === 0, "no script errors" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `roster screen check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ") : `roster screen check passed: ${passed} checks in a real browser (the list, counts and tints, filters, search by words and accents, sort and view remembered, the keyboard, first use, 52 px, a phone, nothing leaving the page)`);
process.exit(problems.length ? 1 : 0);
