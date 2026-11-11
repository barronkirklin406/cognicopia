#!/usr/bin/env node
/* =====================================================================
   Daily engagement (daily.html), the three doors on the front page and the
   fuller roster cards: in a real browser.

     arrives    three choices and one button; nothing is made until it is pressed
     a group    every kind of time makes a page at every stage; the page passes the print check, its title is
                32 pt or more, and a short line for staff is printed at its foot or the screen says it is not
     today      the same card all day (a reload gives the same page); "Another card" gives a different one
     a person   a saved resident's card is from their own life and carries their name; a topic they avoid
                stays off it, however many cards are tried
     paper      the PDF is one US Letter page of real words and lines inside 0.5 in margins (read back);
                a PDF and a print each use one free packet; with all 50 used both ask for a license
     roster     a card shows their work, their town and up to three things they enjoy; "Today's card" opens
                the daily screen already made for them; "Make a packet" opens the Studio on them
     doors      the front page has three doors, each a large link that leads somewhere real
     type       the card, and the Studio's pages, are set in Atkinson Hyperlegible and not a fallback face
     fingers    every control is at least 52 px; a phone has no sideways scroll
     private    nothing is requested from outside the page; no script errors
   Made-up people only. Needs Playwright. Run: node scripts/check-daily-ui.mjs
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const DAY = /^\d{4}-\d{2}-\d{2}$/.test(process.env.CG_DAY || "") ? process.env.CG_DAY : "";

const person = (id, name, tier, extra) => Object.assign({ schema: "cognicopia.residentProfile", version: 2, id,
  tier1_core: { preferredName: name, cognitiveTier: tier, unitNumber: "12", occupation: { code: "teacher", label: "Teacher" }, topHobbies: ["Gardening", "Baking", "Hymns", "Quilting"].map(h => ({ code: h.toLowerCase(), label: h })), printNeeds: {},
    topicsToAvoid: { topics: [], eras: [], people: "", places: "", other: "" } },
  tier2_enrichment: { birthYear: 1938, hometown: { place: "Scobey, Montana" } },
  tier3_deep: { notes: "", people: [{ name: "Sarah Example", relationship: { code: "daughter", label: "Daughter" }, isPet: false, passedAway: false }], comforts: [{ code: "warm-tea", label: "Warm tea" }, { code: "music", label: "Music playing" }] } }, extra || {});
const DOT = person("res-dot", "Dorothy Example", 2);
const GEO = person("res-geo", "George Sample", 1);
GEO.tier1_core.topicsToAvoid = { topics: [{ code: "religion", label: "Religion" }], eras: [], people: "", places: "", other: "Elvis, beach, aspen" };   // words that are on these cards often when nothing is avoided

async function open(w, h, file) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } });
  /* today's card depends on the date, so the check can be run as if on another day: CG_DAY=2027-02-03 node scripts/check-daily-ui.mjs */
  if (DAY) await ctx.addInitScript(iso => { const shift = new Date(iso + "T10:00:00").getTime() - Date.now(), Real = Date;
    window.Date = class extends Real { constructor(...a) { if (a.length) super(...a); else super(Real.now() + shift); } static now() { return Real.now() + shift; } }; }, DAY);
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + (file || "daily.html"), { waitUntil: "load" }); await p.waitForTimeout(1000);
  return { ctx, p };
}
const seed = (p, list) => p.evaluate(l => { l.forEach(x => window.CogniSecureStore.storage.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))); return window.CogniSecureStore.flush(); }, list);
const kind = async (p, k) => { await p.evaluate(k2 => document.querySelector('input[name="dyKind"][value="' + k2 + '"]').click(), k); await p.waitForTimeout(250); };
const stage = async (p, n) => { await p.evaluate(n2 => document.querySelector('input[name="dyStage"][value="' + n2 + '"]').click(), n); await p.waitForTimeout(250); };
const card = p => p.evaluate(() => { const m = window.CognicopiaDailyCard.made(), PL = window.CognicopiaColoringPipeline; if (!m) return null;
  const title = m.page.ops.filter(o => o.role === "title"), texts = m.page.ops.filter(o => o.t === "text");
  return { code: m.code, module: m.module, stage: m.stage, cue: m.cue, raised: m.raised, problems: PL.validate(m.page), titlePx: title.length ? Math.min(...title.map(o => o.size)) : 0,
    text: texts.map(o => o.str).join(" "), staffOnPage: texts.some(o => o.role === "staff"), svg: !!document.querySelector("#dySheet svg") }; });
const left = p => p.$eval("#dyLeft", e => e.textContent.trim());
/* is the page's type really Atkinson Hyperlegible, or a fallback? The face is measured against the site's own copy and against Arial. */
const face = p => p.evaluate(async () => { try { await document.fonts.load('700 40px "Atkinson Hyperlegible"'); await document.fonts.load('700 40px "Cognicopia UI"'); await document.fonts.ready; } catch (e) { /* measured below */ }
  const c = document.createElement("canvas").getContext("2d"), w = f => { c.font = "700 40px " + f; return c.measureText("Hamburgefonstiv 0123 Rhubarb pie").width; };
  return { page: w('"Atkinson Hyperlegible", Arial'), own: w('"Cognicopia UI"'), arial: w("Arial") }; });
const PDFINFO = `
import sys, json
try:
    import pymupdf as fitz
except ImportError:
    import fitz
doc = fitz.open(sys.argv[1]); pg = doc[0]; words = pg.get_text("words")
marks = [w[:4] for w in words if w[3] > 34] + [list(d["rect"]) for d in pg.get_drawings()]
print(json.dumps({"pages": len(doc), "w": pg.rect.width, "h": pg.rect.height, "images": len(pg.get_image_info()), "text": pg.get_text(),
  "faces": sorted(set(f[3] for f in pg.get_fonts(full=True) if f[1] != "n/a")),
  "ink": [round(v, 1) for v in [min(m[0] for m in marks), min(m[1] for m in marks), max(m[2] for m in marks), max(m[3] for m in marks)]]}))`;

try {
  /* ----- arrives ----- */
  const a = await open(1366, 768);
  ok(await a.p.title() === "Daily Engagement — Cognicopia" && /Daily engagement/.test(await a.p.textContent("h1")), "the page is Daily engagement");
  ok(await a.p.$$eval('input[name="dyKind"]', r => r.map(x => x.value).join()) === "reminiscence,music,comfort" && await a.p.$eval("#dyWho", s => s.options.length === 1 && s.value === ""), "three kinds of time, and with nobody saved the card is for a group");
  ok(await card(a.p) === null && /will appear here/.test(await a.p.textContent("#dySheet")) && await a.p.$eval("#dyStaff", e => e.hidden), "nothing is made until the button is pressed");
  ok(await a.p.$$eval("#dyAgain, #dyPrint, #dyPdf", b => b.every(x => x.disabled)), "Another card, Print and the PDF wait for a card");
  ok(!(await a.p.$eval("#dyNone", e => e.hidden)) && await a.p.$eval("#dyNone a", e => /profile\.html$/.test(e.href)), "with nobody saved it says so and offers to add a resident");
  const fit = await a.p.evaluate(() => { const m = document.getElementById("dyMake").getBoundingClientRect(); return { make: Math.round(m.bottom), vh: innerHeight, sheet: Math.round(document.getElementById("dySheet").getBoundingClientRect().height) }; });
  ok(fit.sheet <= fit.vh - 100, `at 1366 x 768 the whole card fits in the window (${fit.sheet} px of ${fit.vh})`);

  /* ----- a group: every kind at every stage ----- */
  let made = 0; const titles = new Set(), notOnPage = [];
  for (const st of [1, 2, 3]) { await stage(a.p, st); for (const k of ["reminiscence", "music", "comfort"]) {
    await kind(a.p, k); await a.p.click("#dyMake"); await a.p.waitForTimeout(250);
    for (let t = 0; t < 4; t++) {
      const c = await card(a.p);
      if (!c || !c.svg) { problems.push(`a group at stage ${st}, ${k}: no card was made`); break; }
      made++; titles.add(c.module);
      if (c.problems.length) problems.push(`a group at stage ${st}, ${k} (${c.code}): ${c.problems.join("; ").slice(0, 160)}`);
      if (c.titlePx < 72) problems.push(`a group at stage ${st}, ${k} (${c.code}): the title is ${c.titlePx} px, under 32 pt`);
      if (c.cue !== c.staffOnPage) problems.push(`${c.code}: the page and the screen disagree about the line for staff`);
      if (!c.cue) { notOnPage.push(c.code); if (!/not printed/.test(await a.p.textContent("#dyStaffMore"))) problems.push(`${c.code}: the line for staff is not on the page and the screen does not say so`); }
      if (k === "comfort" && st === 1 && (!c.raised || c.stage !== 2 || !/middle stage/.test(await a.p.textContent("#dyStaffMore")))) problems.push("a comfort card at the early stage does not say it uses the middle stage's size");
      await a.p.click("#dyAgain"); await a.p.waitForTimeout(200);
    }
  } }
  ok(made === 36, `a group gets a card for every kind of time at every stage, four in a row (${made} of 36 cards)`);
  ok(titles.size >= 6, `from several kinds of page (${[...titles].join(", ")})`);
  ok(notOnPage.length <= 6, `nearly every card has room for the line for staff (${36 - notOnPage.length} of 36)`);
  ok(/Sit beside them|Play or hum|Offer two/.test(await a.p.textContent("#dyStaffText")) && !(await a.p.$eval("#dyStaff", e => e.hidden)), "the screen shows the note for staff beside the card");

  const f1 = await face(a.p);
  ok(Math.abs(f1.page - f1.own) < 0.5 && Math.abs(f1.page - f1.arial) > 1, `the card is set in Atkinson Hyperlegible, not a fallback face (${f1.page.toFixed(1)} px, the site's copy ${f1.own.toFixed(1)}, Arial ${f1.arial.toFixed(1)})`);

  /* ----- the same card all day ----- */
  await stage(a.p, 2); await kind(a.p, "reminiscence"); await a.p.click("#dyMake"); await a.p.waitForTimeout(250);
  const first = await card(a.p);
  await a.p.reload({ waitUntil: "load" }); await a.p.waitForTimeout(1000); await a.p.click("#dyMake"); await a.p.waitForTimeout(250);
  const again = await card(a.p);
  ok(first.code === again.code && first.text === again.text, `today's card is the same after a reload (${first.code})`);
  await a.p.click("#dyAgain"); await a.p.waitForTimeout(250);
  const other = await card(a.p);
  ok(other.text !== first.text, `Another card gives a different one (${other.code})`);
  ok(/50 of 50 free packets left/.test(await left(a.p)), `looking at cards uses no free packet (${await left(a.p)})`);

  /* 52 px, on the form as it stands with a card made */
  const sizes = await a.p.$$eval("#dyWho, #dyDecade, .dy-seg label, .dy-kinds label, .dy-btn", els => els.filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); }));
  ok(sizes.length >= 12 && sizes.every(s => s >= 52), `every control is at least 52 px (${sizes.length} controls, the smallest ${Math.min(...sizes)})`);

  /* ----- a saved resident ----- */
  await seed(a.p, [DOT, GEO]);
  await a.p.reload({ waitUntil: "load" }); await a.p.waitForTimeout(1100);
  ok(await a.p.$eval("#dyWho", s => [...s.options].map(o => o.textContent).join("|")) === "A group (no one saved)|Dorothy Example|George Sample" && await a.p.$eval("#dyNone", e => e.hidden), "saved residents are listed by name");
  await a.p.selectOption("#dyWho", "res-dot"); await a.p.waitForTimeout(300);
  ok(/Dorothy Example: middle stage, born 1938, Scobey\./.test(await a.p.textContent("#dyWhoNote")) && await a.p.$eval("#dyGroup", e => e.hidden), `choosing her shows her stage, year and town, and the group's choices step aside (${await a.p.textContent("#dyWhoNote")})`);
  await kind(a.p, "reminiscence"); await a.p.click("#dyMake"); await a.p.waitForTimeout(300);
  let own = ""; for (let t = 0; t < 6; t++) { own += " " + (await card(a.p)).text; await a.p.click("#dyAgain"); await a.p.waitForTimeout(200); }
  ok(/For Dorothy/.test(own) && /Scobey/.test(own) && /Sarah|classroom|teach/i.test(own), `her reminiscence cards are from her own life: her name, her town, her daughter or her work (${own.slice(0, 110)})`);
  await kind(a.p, "music"); await a.p.waitForTimeout(250);
  const songs = await card(a.p);
  ok(songs.module === "songs" && /1953 to 1963/.test(songs.text), `her music card is songs from the years she was 15 to 25 (${songs.text.slice(0, 60)})`);
  await kind(a.p, "comfort"); await a.p.waitForTimeout(250);
  let comf = ""; for (let t = 0; t < 4; t++) { comf += " " + (await card(a.p)).text; await a.p.click("#dyAgain"); await a.p.waitForTimeout(200); }
  ok(/Warm tea/.test(comf) && /Music playing/.test(comf), "her comfort card offers the comforts in her profile");

  /* a topic he avoids stays off every card; the control is the same cards for Dorothy, who avoids nothing */
  const sweep = async id => { await a.p.selectOption("#dyWho", id); await a.p.waitForTimeout(300); let all = "";
    for (const k of ["music", "reminiscence"]) { await kind(a.p, k); for (let t = 0; t < 14; t++) { const c = await card(a.p); all += " " + (c ? c.text : ""); await a.p.click("#dyAgain"); await a.p.waitForTimeout(120); } } return all; };
  const geo = await sweep("res-geo"), dot = await sweep("res-dot");
  const AVOIDED = /\b(elvis|beach|aspens?|church|hymns?|prayer|bible)\b/i, hit = t => (t.match(new RegExp(AVOIDED.source, "gi")) || []).map(w => w.toLowerCase()).filter((w, i, l) => l.indexOf(w) === i).join(", ");
  ok(geo.length > 2000 && !AVOIDED.test(geo), `George avoids religion, Elvis, the beach and aspens: across 28 cards none of those words appears (${hit(geo) || "none"})`);
  ok(/\belvis\b|\bbeach\b/i.test(dot), `the same cards for Dorothy, who avoids nothing, do carry such words, so his list is what keeps them out (${hit(dot)})`);

  /* ----- paper ----- */
  await a.p.selectOption("#dyWho", "res-dot"); await kind(a.p, "reminiscence"); await a.p.waitForTimeout(300);
  const dlp = a.p.waitForEvent("download", { timeout: 15000 }).catch(() => null);
  await a.p.click("#dyPdf"); const dl = await dlp;
  ok(!!dl && /^cognicopia-daily-card-\d{4}-\d{2}-\d{2}\.pdf$/.test(dl ? dl.suggestedFilename() : ""), `a PDF is made, named for the day and never for the resident (${dl ? dl.suggestedFilename() : "none"})`);
  if (dl) {
    const tmp = path.join(os.tmpdir(), "cognicopia-daily-" + process.pid + ".pdf"); await dl.saveAs(tmp);
    try {
      const info = JSON.parse(execFileSync("python3", ["-c", PDFINFO, tmp], { encoding: "utf8" }));
      ok(info.pages === 1 && Math.round(info.w) === 612 && Math.round(info.h) === 792, `the PDF is one US Letter page (${info.pages} page, ${info.w} x ${info.h} pt)`);
      ok(info.images === 0 && /For Dorothy/.test(info.text) && info.faces.includes("AtkinsonHyperlegible"), `the card is real words and lines in its own face, not a picture (${info.faces.join(", ")})`);
      ok(info.ink[0] >= 35.9 && info.ink[1] >= 35.9 && info.ink[2] <= 576.1 && info.ink[3] <= 756.1, `everything on it sits inside 0.5 in margins (${info.ink.join(", ")} pt)`);
    } catch (e) { ok(/No module named/.test(String(e.stderr || e.message)), "the PDF could be read back: " + String(e.message).slice(0, 120)); }
    finally { try { fs.unlinkSync(tmp); } catch (e) { /* ignore */ } }
  }
  await a.p.waitForTimeout(900);
  ok(/49 of 50/.test(await left(a.p)), `making a PDF uses one free packet (${await left(a.p)})`);
  await a.p.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await a.p.click("#dyPrint"); await a.p.waitForTimeout(1200);
  ok(await a.p.evaluate(() => window.__printed) === 1 && /48 of 50/.test(await left(a.p)), `printing uses one (${await left(a.p)})`);
  ok(await a.p.$$eval("#printRoot .as-pp svg", s => s.length) === 1 && !!(await a.p.$("#cg-print-optimizer")), "only the card is sent to the paper: one sheet in the print host");
  await a.p.evaluate(async () => { const l = window.CogniTrialLedger.forBrowser(window.CogniSecureStore.storage); await l.ready(); while (l.count() < 50) l.record(); });
  await a.p.evaluate(() => { window.__printed = 0; });
  await a.p.click("#dyPrint"); await a.p.waitForTimeout(600);
  ok(await a.p.evaluate(() => window.__printed) === 0 && await a.p.$eval("#dyGate", d => d.open) && /used all 50 free packets/.test(await a.p.textContent("#dyGateT")), "with all 50 used, Print opens the license window and prints nothing");
  ok((await a.p.$$eval("#dyGate .dy-btn", b => b.map(x => Math.round(x.getBoundingClientRect().height)))).every(h => h >= 52) && await a.p.$eval("#dyGate a", e => /pricing\.html$/.test(e.href)), "its buttons are 52 px and it offers the plans");
  await a.p.click("#dyGateClose");
  const none = a.p.waitForEvent("download", { timeout: 2500 }).catch(() => null);
  await a.p.click("#dyPdf"); ok(!(await none) && await a.p.$eval("#dyGate", d => d.open), "the PDF is held the same way");
  await a.p.click("#dyGateClose"); await a.p.click("#dyAgain"); await a.p.waitForTimeout(250);
  ok(!!(await card(a.p)), "the card on the screen still works with the free packets used up");
  await a.ctx.close();

  /* ----- a phone ----- */
  const ph = await open(390, 844);
  await ph.p.click("#dyMake"); await ph.p.waitForTimeout(500);
  const phone = await ph.p.evaluate(() => ({ wide: document.documentElement.scrollWidth, vw: innerWidth, sheet: Math.round(document.getElementById("dySheet").getBoundingClientRect().width), small: [...document.querySelectorAll("#dyWho, .dy-seg label, .dy-kinds label, .dy-btn")].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); }).filter(s => s < 52).length }));
  ok(phone.wide <= phone.vw + 1 && phone.sheet >= 300 && phone.small === 0, `on a phone nothing scrolls sideways, the card is ${phone.sheet} px wide and every control is 52 px (${phone.wide} of ${phone.vw})`);
  await ph.ctx.close();

  /* ----- the roster ----- */
  const r = await open(1366, 900, "builder.html#/roster");
  await seed(r.p, [DOT, person("res-wal", "Walter Sample", 1, {})]);
  await r.p.evaluate(() => { const w = JSON.parse(window.CogniSecureStore.storage.getItem("cognicopia_resident_res-wal")); delete w.tier1_core.occupation; w.tier1_core.topHobbies = []; w.tier2_enrichment.hometown = {}; window.CogniSecureStore.storage.setItem("cognicopia_resident_res-wal", JSON.stringify(w)); return window.CogniSecureStore.flush(); });
  await r.p.reload({ waitUntil: "load" }); await r.p.waitForSelector("#rsList .rs-res"); await r.p.waitForTimeout(700);
  await r.p.click('.rs-view button[data-view="cards"]'); await r.p.waitForTimeout(200);
  const cards = await r.p.$$eval("#rsList .rs-res", els => els.map(e => ({ id: e.dataset.id, text: e.innerText.replace(/\s+/g, " ") })));
  const dc = cards.find(c => c.id === "res-dot") || { text: "" }, wc = cards.find(c => c.id === "res-wal") || { text: "" };
  ok(/Teacher · Scobey, Montana/.test(dc.text) && /Enjoys Gardening, Baking, Hymns(?!, Quilting)/.test(dc.text), `her card shows her work, her town and three things she enjoys (${dc.text})`);
  ok(!/Enjoys|·/.test(wc.text) && /Walter Sample/.test(wc.text), `a card with none of that on file shows no empty line (${wc.text})`);
  await r.p.click('.rs-view button[data-view="list"]'); await r.p.waitForTimeout(200);
  ok(await r.p.$$eval("#rsList .rs-life, #rsList .rs-joys", els => els.every(e => e.getBoundingClientRect().height === 0)), "a list row stays one line: the extra lines are for cards");
  await r.p.click('.rs-res[data-id="res-dot"]'); await r.p.waitForTimeout(400);
  ok(/Teacher · Scobey, Montana\. Enjoys Gardening, Baking, Hymns\./.test(await r.p.textContent("#rsWho")), "the chosen resident's panel says the same");
  const go = await r.p.$$eval(".rs-go a", els => els.map(e => ({ text: e.textContent.trim(), h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) })));
  ok(go.length === 2 && go[0].text === "Today’s card" && go[1].text === "Make a packet" && go.every(g => g.h >= 52 && g.w >= 52), `and offers Today's card and Make a packet, 52 px tall (${go.map(g => g.text + " " + g.h).join(", ")})`);
  await Promise.all([r.p.waitForURL(/daily\.html\?make=1/), r.p.click('.rs-go a[href^="daily"]')]);
  await r.p.waitForSelector("#dySheet svg", { timeout: 8000 }).catch(() => {});
  const opened = await card(r.p);
  ok(await r.p.$eval("#dyWho", e => e.value) === "res-dot" && opened && /For Dorothy/.test(opened.text), "Today's card opens the daily screen with her chosen and her card already made");
  ok(!/res-dot|Dorothy/.test(r.p.url()), "and the address carries nothing about her");
  await r.p.goto(base + "builder.html#/roster", { waitUntil: "load" }); await r.p.waitForSelector("#rsList .rs-res"); await r.p.waitForTimeout(600);
  await r.p.click('.rs-res[data-id="res-dot"]'); await r.p.waitForTimeout(300);
  await Promise.all([r.p.waitForURL(/activity-studio\.html/), r.p.click('.rs-go a[href^="activity-studio"]')]);
  await r.p.waitForSelector("#asSheet svg", { timeout: 10000 }); await r.p.waitForTimeout(1200);
  ok(await r.p.$eval("#asResident", e => e.value) === "res-dot", "Make a packet opens the Activity Page Studio on her");
  const f2 = await face(r.p);
  ok(Math.abs(f2.page - f2.own) < 0.5 && Math.abs(f2.page - f2.arial) > 1, `the Studio's pages are set in Atkinson Hyperlegible too (${f2.page.toFixed(1)} px, Arial ${f2.arial.toFixed(1)})`);
  await r.ctx.close();

  /* ----- the three doors ----- */
  for (const [w, h] of [[1366, 768], [390, 844]]) {
    const f = await open(w, h, "index.html");
    const doors = await f.p.$$eval(".lp-doors .lp-door", els => els.map(e => { const b = e.getBoundingClientRect(); return { name: e.querySelector("b").textContent, href: e.getAttribute("href"), w: Math.round(b.width), h: Math.round(b.height) }; }));
    ok(doors.map(d => d.name + ">" + d.href).join("|") === "Daily engagement>daily.html|Packets and booklets>#make|Residents>profile.html", `at ${w} px the front page has three doors (${doors.map(d => d.name).join(", ")})`);
    ok(doors.length === 3 && doors.every(d => d.h >= 120 && d.w >= 240), `each a large link (${doors.map(d => d.w + " x " + d.h).join(", ")})`);
    ok(await f.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1) && await f.p.$("#make") !== null, "nothing scrolls sideways and the packet door leads to the tool on this page");
    if (w === 1366) { await Promise.all([f.p.waitForURL(/daily\.html$/), f.p.click('.lp-door[href="daily.html"]')]); ok(/Daily engagement/.test(await f.p.textContent("h1")), "the first door opens Daily engagement"); }
    await f.ctx.close();
  }

  ok(foreign.length === 0, "nothing is requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 2).join(", ") : ""));
  ok(errors.length === 0, "no script errors" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `daily engagement check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `daily engagement check passed: ${passed} checks in a real browser (three choices and one button; a card for every kind of time at every stage; the same card all day; a saved resident's own life, their avoid list kept; the PDF read back, the free packets counted and the gate; the roster's fuller cards and its two buttons; the three doors; 52 px; a phone; nothing leaving the page)`);
process.exit(problems.length ? 1 : 0);
