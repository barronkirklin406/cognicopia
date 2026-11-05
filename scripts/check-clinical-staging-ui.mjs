#!/usr/bin/env node
/* =====================================================================
   The clinical staging layer, driven in a real browser (Playwright; exit 2 where it is not installed):

     builder.html  the tier choice reads Tier, name and GDS and says what it changes (and the words change when Advanced is chosen);
                   every page preview carries its therapy anchor; an activity asked to keep a word off the page redraws without it;
                   Sundowning / De-escalation mode turns a queued page into one calm late-stage reminiscence page
     index.html    the level choices carry their GDS; the Sundowning / De-escalation switch holds the late level, turns off timed and
                   dense pages, and gives the level back when it is turned off
     tablet.html   the levels carry their GDS, every activity card names its therapy, Calm mode shows only the slow activities and a
                   word on the "keep off the screen" list never stays on an activity's screen
     all           nothing is requested from outside the page
   ===================================================================== */
import { serve, loadPlaywright } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

async function open(path, viewport) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1366, height: 1000 }, serviceWorkers: "block" });
  const page = await ctx.newPage(), outside = [], errors = [];
  page.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) outside.push(u); });
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(base + path); await page.waitForTimeout(900);
  return { ctx, page, outside, errors };
}

/* ---------- the Packet Builder ---------- */
{
  const { ctx, page: pg, outside, errors } = await open("builder.html#/category/word");
  const openAct = async id => { await pg.evaluate(a => document.querySelector(`button.card[data-act="${a}"]`).click(), id); await pg.waitForTimeout(450); };
  await openAct("search-guided");
  const labels = await pg.$$eval('input[name="cfgDiff"] + span', els => els.map(e => e.textContent.replace(/\s+/g, " ").trim()));
  ok(labels.length === 3 && /Tier 1 · Mild\s*GDS 3–4 · FAST 3–4/.test(labels[0]) && /Tier 2 · Moderate\s*GDS 5/.test(labels[1]) && /Tier 3 · Advanced\s*GDS 6–7/.test(labels[2]), `the builder's tier choices read Tier, name and GDS (${labels.join(" | ")})`);
  const note1 = await pg.textContent("#tierNote");
  /* the radio is clicked in the page itself: the sticky top bar can sit over it mid-scroll, and what is being proved is the change, not the pointer */
  await pg.evaluate(() => document.querySelector('input[name="cfgDiff"][value="advanced"]').click()); await pg.waitForTimeout(450);
  const note3 = await pg.textContent("#tierNote");
  ok(/type 24 pt bold or larger/.test(note3) && /lines 4\.5 pt or heavier/.test(note3) && /one subject on the page/.test(note3), `choosing Advanced says what changes: ${note3}`);
  ok(note1 !== note3, "the note changes with the tier");
  const meta = await pg.textContent("#pvMeta");
  ok(/Tier 3 · Advanced · GDS 6–7/.test(meta) && /\[Therapy: [^\]]+ \| GDS 6–7\]/.test(meta), `the preview header carries the tier and the anchor: ${meta}`);
  const svgAnchor = await pg.$$eval("#preview svg text", els => els.map(t => t.textContent).filter(t => /^\[Therapy:/.test(t)));
  ok(svgAnchor.length === 1 && /GDS 6–7\]$/.test(svgAnchor[0]), `the printed page carries its anchor in the foot (${svgAnchor.join()})`);
  const big = await pg.$$eval("#preview svg text", els => Math.min.apply(null, els.filter(t => /^[A-Z]{3,}$/.test(t.textContent.trim())).map(t => parseFloat(t.getAttribute("font-size")) || 99)));
  ok(big >= 24 - 0.01 || !isFinite(big), "Advanced draws its words at 24 pt or larger");
  /* a themed page of the older kind carries the anchor in its header */
  await pg.evaluate(() => { const b = document.querySelector('button.card[data-act="word-search"]'); b.click(); }); await pg.waitForTimeout(450);
  const hdr = await pg.$$eval("#preview .sh-anchor", els => els.map(e => e.textContent));
  ok(hdr.length === 1 && /^\[Therapy: Cognitive Stimulation \| GDS 3–4\]$/.test(hdr[0]), `an older page names its therapy in its header (${hdr.join()})`);
  /* avoidance: a word on the page goes away when it is asked to */
  const words = await pg.evaluate(() => [...document.querySelectorAll("#preview .wbank span, #preview .word-bank span, #preview .words span, #preview li, #preview .wlist *")].map(e => e.textContent.trim()).filter(w => /^[A-Za-z]{4,10}$/.test(w)));
  const bank = await pg.evaluate(() => (document.getElementById("preview").innerText.match(/\b[A-Z]{4,10}\b/g) || []).filter((w, i, a) => a.indexOf(w) === i));
  const target = (words[0] || bank.find(w => !/^(FIND|EACH|WORD|WORDS|NAME|DOWN|ACROSS|CIRCLE|GOES|MONDAY|TUESDAY)$/.test(w)) || "").toLowerCase();
  ok(!!target, "the older word search shows words to test with");
  if (target) {
    await pg.evaluate(() => { document.querySelector(".avoid-box").open = true; });
    await pg.fill("#cfgAvoid", target); await pg.waitForTimeout(600);
    const text = await pg.evaluate(() => document.getElementById("preview").innerText);
    ok(!new RegExp("\\b" + target + "\\b", "i").test(text), `with "${target}" kept off the page, the page is drawn without it`);
    await pg.fill("#cfgAvoid", ""); await pg.waitForTimeout(300);
  }
  /* Sundowning / De-escalation: one calm late-stage page */
  await pg.click("#calmModeToggle"); await pg.waitForTimeout(600);
  const calmMeta = await pg.textContent("#pvMeta"), calmText = await pg.$$eval("#preview svg text", els => els.map(t => t.textContent));
  ok(/Sundowning \/ De-escalation/.test(calmMeta), "the preview says it is in Sundowning / De-escalation mode");
  ok(calmText.some(t => /^\[Therapy: .+ \| GDS 6–7\]$/.test(t)) && calmText.some(t => /^Clinical Tip:/.test(t)), "the calm page is a late-stage page with its tip and anchor");
  ok(!(await pg.$("#preview .sh-body")), "the calm page has none of the activity's grid or choices");
  await pg.click("#calmModeToggle"); await pg.waitForTimeout(300);
  ok(errors.length === 0, `the builder raised no script error (${errors.join("; ")})`);
  ok(outside.length === 0, `the builder asked for nothing outside the page (${outside.join(", ")})`);
  await ctx.close();
}

/* ---------- the packet tool ---------- */
{
  const { ctx, page: pg, outside, errors } = await open("index.html");
  const levels = await pg.$$eval(".level span span", els => els.map(e => e.textContent));
  ok(/Tier 1 · Mild · GDS 3–4/.test(levels[0]) && /Tier 2 · Moderate · GDS 5/.test(levels[1]) && /Tier 3 · Advanced · GDS 6–7/.test(levels[2]), "the packet tool's levels carry Tier, name and GDS");
  const state = () => pg.evaluate(() => ({ stage: document.querySelector('input[name="stage"]:checked').value, locked: [...document.querySelectorAll('input[name="stage"]')].every(r => r.disabled),
    on: [...document.querySelectorAll(".act")].filter(a => a.checked).map(a => a.value), offIds: [...document.querySelectorAll(".act")].filter(a => a.disabled).map(a => a.value) }));
  const before = await state();
  await pg.evaluate(() => document.getElementById("calmMode").click()); await pg.waitForTimeout(400);
  const calm = await state();
  ok(calm.stage === "late" && calm.locked, "the switch holds the late level and locks the choice");
  ok(calm.on.length >= 4 && calm.on.every(id => ["talk", "era", "people", "lyric", "task", "orientation", "silhouette", "pathtrace", "matching", "choose-ending", "sequence", "notes", "facsupport", "color", "mandala"].indexOf(id) >= 0), `only calm pages are picked (${calm.on.join()})`);
  ok(["wordsearch", "crossword", "bingo", "clocks", "coins", "search-large"].every(id => calm.offIds.indexOf(id) >= 0), "the word searches, crossword, bingo, clocks and coins are turned off");
  await pg.evaluate(() => document.getElementById("calmMode").click()); await pg.waitForTimeout(400);
  const after = await state();
  ok(after.stage === before.stage && !after.locked, "turning it off gives the level back");
  ok(errors.length === 0, `the packet tool raised no script error (${errors.join("; ")})`);
  ok(outside.length === 0, `the packet tool asked for nothing outside the page (${outside.join(", ")})`);
  await ctx.close();
}

/* ---------- the profile form ---------- */
{
  const { ctx, page: pg, outside, errors } = await open("profile.html");
  const info = await pg.evaluate(() => ({
    legend: [...document.querySelectorAll("legend")].some(l => /Avoidance Protocols & Triggers/.test(l.textContent)),
    eras: document.querySelectorAll('input[name="avoidEras"]').length, people: !!document.getElementById("rapAvoidPeople"), places: !!document.getElementById("rapAvoidPlaces"),
    tiers: [...document.querySelectorAll('input[name="tier"] + span b')].map(b => b.textContent) }));
  ok(info.legend && info.eras === 5 && info.people && info.places, "the profile form has the Avoidance Protocols & Triggers fields");
  ok(info.tiers.join("|") === "Tier 1 · Mild · GDS 3–4|Tier 2 · Moderate · GDS 5|Tier 3 · Advanced · GDS 6–7", `the profile form's tiers read Tier, name and GDS (${info.tiers.join("|")})`);
  /* a profile with an avoidance protocol is saved on this computer and the Packet Builder brings it in */
  await pg.fill("#rapName", "Harold"); await pg.fill("#rapUnit", "Maple 214B"); await pg.fill("#rapBorn", "1934");
  await pg.evaluate(() => {
    document.querySelector('input[name="avoidEras"][value="era-vietnam"]').click(); document.querySelector('input[name="avoidTopics"][value="death"]').click();
    const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); };
    set("rapAvoidPeople", "Tom, Aunt Ruth"); set("rapAvoidPlaces", "Normandy, the old farm"); set("rapAvoidOther", "sirens");
  });
  for (let i = 0; i < 8; i++) { const t = await pg.textContent("#rapNext"); await pg.click("#rapNext"); await pg.waitForTimeout(150); if (/save/i.test(t)) break; }
  await pg.waitForTimeout(600);
  const glance = await pg.evaluate(() => (document.getElementById("rapGlance") || { textContent: "" }).textContent.replace(/\s+/g, " "));
  ok(/Avoid.*Death and loss, Vietnam War.*Tom, Aunt Ruth, Normandy, the old farm, sirens/.test(glance), "the saved profile's summary lists the topics, the era, the names, the places and the rest");
  const b2 = await ctx.newPage(); const b2err = [];
  b2.on("pageerror", e => b2err.push(e.message)); b2.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) outside.push(u); });
  await b2.goto(base + "builder.html#/category/word"); await b2.waitForTimeout(1200);
  await b2.evaluate(() => document.querySelector('button.card[data-act="search-guided"]').click()); await b2.waitForTimeout(500);
  const who = await b2.$$eval("#cfgWho option", os => os.map(o => [o.value, o.textContent]));
  ok(who.length === 2 && who[1][1] === "Harold", "the Packet Builder offers the saved resident");
  if (who[1]) {
    await b2.evaluate(() => { document.querySelector(".avoid-box").open = true; });
    await b2.selectOption("#cfgWho", who[1][0]); await b2.waitForTimeout(700);
    const av = await b2.inputValue("#cfgAvoid");
    ok(["vietnam", "saigon", "death", "funeral", "tom", "aunt ruth", "normandy", "the old farm", "sirens"].every(w => av.split(", ").indexOf(w) >= 0), `choosing the resident brings in the whole protocol (${av.slice(0, 120)})`);
    ok((await b2.inputValue("#cfgName")) === "Harold" && (await b2.evaluate(() => document.querySelector('input[name="cfgDiff"]:checked').value)) === "moderate", "and the name and the tier");
  }
  ok(b2err.length === 0, `the Packet Builder raised no script error (${b2err.join("; ")})`);
  ok(outside.length === 0, `the profile form and the Packet Builder asked for nothing outside the page (${outside.join(", ")})`);
  await ctx.close();
}

/* ---------- the tablet ---------- */
{
  const { ctx, page: pg, outside, errors } = await open("tablet.html", { width: 1024, height: 768 });
  const lv = await pg.$$eval(".tbp-seg label small", els => els.map(e => e.textContent));
  ok(lv.join("|") === "Tier 1 · Mild · GDS 3–4|Tier 2 · Moderate · GDS 5|Tier 3 · Advanced · GDS 6–7", `the tablet's levels read Tier, name and GDS (${lv.join("|")})`);
  const tags = await pg.$$eval(".tbp-card", els => els.map(c => [c.dataset.act, (c.querySelector(".tbp-tag") || {}).textContent || ""]));
  ok(tags.length === 13 && tags.every(t => /· GDS 3–7$/.test(t[1])), `all thirteen activities name their therapy and GDS range (${tags.length})`);
  await pg.click("#tbCalm"); await pg.waitForTimeout(300);
  const shown = await pg.$$eval(".tbp-card", els => els.filter(c => !c.parentNode.hidden).map(c => c.dataset.act));
  ok(shown.length >= 5 && shown.length <= 8 && ["trace", "paint", "sounds"].every(a => shown.indexOf(a) >= 0) && ["wordsearch", "bubbles", "crossword"].every(a => shown.indexOf(a) < 0), `Calm mode shows only the slow activities (${shown.join()})`);
  ok(await pg.$eval("#tbStageLate", e => e.checked) && await pg.$eval("#tbStageEarly", e => e.disabled), "Calm mode holds the late level");
  await pg.click('[data-act="saying"]'); await pg.waitForTimeout(500);
  const anchor = await pg.textContent("#tbAnchor");
  ok(anchor === "[Therapy: Spontaneous Recall | GDS 6–7]", `an open activity shows its anchor in the bar (${anchor})`);
  await pg.click("#tbBack"); await pg.waitForTimeout(300);
  await pg.click("#tbCalm"); await pg.waitForTimeout(300);
  const allShown = await pg.$$eval(".tbp-card", els => els.filter(c => !c.parentNode.hidden).length);
  ok(allShown === 13 && await pg.$eval("#tbStageMiddle", e => e.checked), "turning Calm mode off brings every activity and the chosen level back");
  /* keep a word off the screen: open the sayings, take a word from the screen, ask to keep it off, and the next screen does not show it */
  await pg.click('[data-act="saying"]'); await pg.waitForSelector("#tbStage .tb-opt", { timeout: 15000 });   // wait for the answer buttons, not a fixed half second: a busy computer draws them later
  const screenText = await pg.evaluate(() => document.getElementById("tbStage").innerText);
  const word = (screenText.match(/\b[A-Za-z]{5,10}\b/g) || []).find(w => !/^(Choose|Circle|Which|Finish|Finishes|Another|Lovely|Wonderful|spell|Help|Next)$/i.test(w));
  ok(!!word, "an activity shows words to test with");
  if (word) {
    await pg.click("#tbBack"); await pg.waitForTimeout(300);
    await pg.fill("#tbAvoid", word); await pg.click('[data-act="saying"]'); await pg.waitForSelector("#tbStage .tb-opt", { timeout: 15000 }); await pg.waitForTimeout(150);
    const t2 = await pg.evaluate(() => document.getElementById("tbStage").innerText);
    ok(!new RegExp("\\b" + word + "\\b", "i").test(t2), `with "${word}" kept off the screen, the activity does not show it`);
    /* and in the answer buttons too: take a word that was an answer choice, keep it off, and draw many more screens. The words
       on a row of buttons are read one by one, not run together ("side" "table" "day" is not "sidetableday"). */
    await pg.click("#tbBack"); await pg.waitForTimeout(150); await pg.fill("#tbAvoid", ""); await pg.click('[data-act="saying"]'); await pg.waitForTimeout(300);
    /* a draw can hold only short or hyphenated choices: draw again (up to ten screens) until one has a plain word to test with */
    let choice;
    for (let i = 0; i < 10 && !choice; i++) {
      if (i) { await pg.click("#tbBack"); await pg.waitForTimeout(150); await pg.click('[data-act="saying"]'); await pg.waitForTimeout(300); }
      choice = (await pg.$$eval("#tbStage .tb-opt", els => els.map(e => e.textContent.trim().toLowerCase()))).find(w => /^[a-z]{4,10}$/.test(w));
    }
    ok(!!choice, "the saying shows answer choices to test with");
    let shown = 0;
    for (let i = 0; choice && i < 40; i++) {
      await pg.click("#tbBack"); await pg.waitForTimeout(100);
      await pg.fill("#tbAvoid", choice); await pg.click('[data-act="saying"]'); await pg.waitForTimeout(200);
      if (new RegExp("\\b" + choice + "\\b", "i").test(await pg.evaluate(() => document.getElementById("tbStage").innerText))) shown++;
    }
    ok(shown === 0, `across 40 draws, "${choice}" is never shown, not even as an answer choice (${shown} screens showed it)`);
  }
  ok(errors.length === 0, `the tablet raised no script error (${errors.join("; ")})`);
  ok(outside.length === 0, `the tablet asked for nothing outside the page (${outside.join(", ")})`);
  await ctx.close();
}

await browser.close(); srv.close();
console.log(problems.length ? `clinical staging screen check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ") : `clinical staging screen check passed: ${passed} checks in a real browser (tiers with their GDS in all four tools, therapy anchors, avoidance, Sundowning / De-escalation mode, nothing leaving the page)`);
process.exit(problems.length ? 1 : 0);
