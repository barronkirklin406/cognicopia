#!/usr/bin/env node
/* =====================================================================
   Tablet Activities (tablet.html), in a real browser, with real fingers:
   mouse and touch input go in through the browser, the same pointer
   events a tablet makes, and what a person would see is read back.

     - the main menu shows all thirteen activities, each a large card; the level, topic and
       sound choices work and are remembered; the front page has a Tablet Activities button in its
       first screen and the menu bar has an entry
     - word search: dragging a finger along every word finds it (forwards and backwards), a drag
       that is not a word fades with no sound or red, tapping a first and a last letter finds a
       word, and finishing gives the cheer; the late stage reads across only
     - trace the path: the dot follows a finger along the line; wandering off the line, turning
       back or lifting the finger sends it to the start; tracing all the paths finishes
     - crossword and spelling: tapping letters on the on-screen keyboard fills the squares, a wrong
       letter is just not finished (never red), Back takes a letter back, A letter helps, a word is
       marked done and the crossword finishes; the physical keyboard works too
     - finish the saying, sort, put in order, match, odd one out: a wrong choice gets a gentle
       sentence and the right one is shown, a right choice gets a soft word, every one finishes
     - sights and sounds cards move forward and back; color a picture colors a tapped shape in the
       chosen color, with undo and start over; finger paint draws, undoes and clears; bubbles pop
     - the Menu button and Escape return to the menu with focus back on the card
     - every control is at least 52 px on a landscape tablet, a portrait tablet and a phone, nothing
       runs sideways off the screen, and on both tablets nothing needs scrolling
     - the free-packet count: one session is one packet, counted once, and the gate stops a session
       when they are gone
     - nothing is requested from outside the page, no script error appears, and the only things kept
       in the browser are the choices and the free-packet count

   Needs Playwright. Where it is missing this exits 2 and npm run build skips it.
   Run: node scripts/check-tablet-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], foreign = [], errors = []; let passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else problems.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ALL = ["wordsearch", "crossword", "spell", "saying", "trace", "color", "paint", "bubbles", "sort", "order", "match", "odd", "talk"];
const LAND = { width: 1024, height: 768 }, PORT = { width: 768, height: 1024 }, PHONE = { width: 390, height: 844 };

async function fresh(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, hasTouch: true, reducedMotion: o.reduced ? "reduce" : "no-preference" });
  if (o.init) await ctx.addInitScript(o.init);
  const p = await ctx.newPage();
  p.on("request", r => { if (!r.url().startsWith(base) && !r.url().startsWith("data:")) foreign.push(r.url()); });
  p.on("pageerror", e => errors.push("page error: " + e.message));
  p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await p.goto(base + (o.page || "tablet.html")); await p.waitForTimeout(300);
  return { ctx, p };
}
const stageReady = async p => { await p.waitForSelector("#tb:not([hidden])"); await p.waitForFunction(() => document.querySelector("#tbStage").children.length > 0); await p.waitForTimeout(200); };
async function openAct(p, id) { await p.click(`[data-act="${id}"]`); await stageReady(p); }
const dbg = p => p.evaluate(() => { const d = window.CognicopiaTabletUI.debug(); return d ? JSON.parse(JSON.stringify(d)) : null; });
const centerOf = (p, sel, arg) => p.evaluate(([s, a]) => { const e = typeof a === "string" ? document.querySelector(s.replace("%", a)) : document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, [sel, arg]);
async function click(p, sel, arg) { const c = await centerOf(p, sel, arg); if (!c) throw new Error("nothing to click: " + sel + " " + (arg || "")); await p.mouse.click(c[0], c[1]); }
async function clickAttr(p, attr, value) {
  const c = await p.evaluate(([a, v]) => { const e = Array.from(document.querySelectorAll("#tbStage [" + a + "]")).find(x => x.getAttribute(a) === v); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, [attr, value]);
  if (!c) throw new Error("no " + attr + "=" + value); await p.mouse.click(c[0], c[1]);
}
const cheered = async p => { try { await p.waitForSelector(".tb-cheer", { timeout: 4000 }); return true; } catch (e) { return false; } };
const text = (p, sel) => p.evaluate(s => (document.querySelector(s) || {}).textContent || "", sel);
const cellXY = (p, r, c) => centerOf(p, `#tbStage .tb-cell[data-r="${r}"][data-c="${c}"]`);
async function drag(p, a, b, steps = 8) { await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move(b[0], b[1], { steps }); await p.mouse.up(); }
async function toMenu(p) { await p.click("#tbBack"); await p.waitForSelector("#tb", { state: "hidden" }); }
const small = (p, min = 52) => p.evaluate(m => {
  const out = [];
  document.querySelectorAll("#tb button, #tb a[href], #tb input, #tb .tb-cell, #tb .tb-cwc").forEach(e => {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
    const st = getComputedStyle(e); if (st.visibility === "hidden" || st.display === "none") return;
    if (r.width < m - 0.5 || r.height < m - 0.5) out.push((e.className || e.tagName) + " " + Math.round(r.width) + "x" + Math.round(r.height));
  });
  return out;
}, min);

try {
  /* ---------- the menu, and finding it ---------- */
  {
    const { ctx, p } = await fresh({ width: 1366, height: 768 });
    const cards = await p.$$eval(".tbp-card", cs => cs.map(c => { const r = c.getBoundingClientRect(); return { id: c.getAttribute("data-act"), w: r.width, h: r.height, title: c.querySelector("b").textContent }; }));
    ok(cards.length === 13 && JSON.stringify(cards.map(c => c.id).sort()) === JSON.stringify(ALL.slice().sort()), "the menu has all thirteen activities: " + cards.map(c => c.id).join(","));
    ok(cards.every(c => c.w >= 200 && c.h >= 150), "each activity is a large card");
    ok(await p.evaluate(() => document.querySelectorAll(".tbp-menu h2").length === 3), "they are in three groups with headings");
    const hubs = await p.$$eval(".cg-hubs > li, nav a[href='tablet.html']", e => e.length); ok(hubs > 0, "the page is in the site's menu");
    await p.click("label[for=tbStageLate]"); await p.selectOption("#tbTopic", "farming"); await p.click("#tbSound");
    const prefs = await p.evaluate(() => JSON.parse(localStorage.getItem("cognicopia_tablet_prefs")));
    ok(prefs.stage === "late" && prefs.topic === "farming" && prefs.sound === false, "the level, topic and sound choices are kept: " + JSON.stringify(prefs));
    await p.reload(); await p.waitForTimeout(300);
    ok(await p.evaluate(() => document.getElementById("tbStageLate").checked && document.getElementById("tbTopic").value === "farming" && document.getElementById("tbSound").getAttribute("aria-pressed") === "false"), "and they are there again after reloading");
    ok(await p.evaluate(() => !document.getElementById("tbSound").textContent.includes("On")), "the sound button says so");
    await ctx.close();
    /* the front page: a Tablet Activities button in the first screen, and it goes there */
    const home = await fresh({ width: 1366, height: 768 }, { page: "index.html" });
    const btn = await home.p.evaluate(() => { const e = document.querySelector(".lp-btn-tablet"); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height, w: r.width, text: e.textContent.trim() }; });
    ok(btn && btn.bottom < 768 && btn.h >= 52 && btn.w >= 150 && btn.text === "Tablet Activities", "the front page's first screen has a Tablet Activities button: " + JSON.stringify(btn));
    const inMenu = await home.p.evaluate(() => Array.from(document.querySelectorAll("a[href='tablet.html']")).length); ok(inMenu >= 2, "and the menu bar links to it as well (" + inMenu + " links)");
    await home.p.click(".lp-btn-tablet"); await home.p.waitForURL("**/tablet.html"); ok(/Tablet Activities/.test(await text(home.p, "h1")), "pressing the button opens the tablet page");
    const phone = await fresh(PHONE, { page: "index.html" });
    ok(await phone.p.evaluate(() => { const e = document.querySelector(".lp-btn-tablet"); const r = e.getBoundingClientRect(); return r.height >= 52 && r.right <= innerWidth; }), "on a phone the button fits the screen");
    await home.ctx.close(); await phone.ctx.close();
  }

  /* ---------- word search ---------- */
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "wordsearch");
    let d = await dbg(p);
    ok(d.size >= 6 && d.size <= 8 && d.words.length >= 3 && d.words.length <= 5, `a middle-stage word search is ${d.size} x ${d.size} with ${d.words.length} words`);
    ok(await p.evaluate(() => document.querySelectorAll("#tbStage .tb-cell").length) === d.size * d.size, "every square is on the screen");
    /* a drag that is not a word: it fades, no sound, no red, nothing found */
    const w0 = d.placed[0]; let bad = [0, 0], bad2 = [0, 1];
    for (let r = 0; r < d.size; r++) for (let c = 0; c + 2 < d.size; c++) { const s = d.placed.some(pl => pl.dy === 0 && pl.r === r && c >= pl.c && c < pl.c + pl.word.length); if (!s && bad[0] === 0 && bad[1] === 0 && r > 0) { bad = [r, c]; bad2 = [r, c + 1]; } }
    await drag(p, await cellXY(p, bad[0], bad[1]), await cellXY(p, bad2[0], bad2[1]));
    await p.waitForTimeout(150);
    ok((await dbg(p)).found.length === 0, "a drag along letters that are not a word finds nothing");
    await p.waitForTimeout(900);
    ok(await p.evaluate(() => document.querySelectorAll("#tbStage .is-sel").length === 0), "and the highlight simply fades away");
    ok(!/wrong|incorrect|error/i.test(await text(p, "#tbWsMsg")), "with no word of blame: \"" + await text(p, "#tbWsMsg") + "\"");
    /* every word, dragged: the first one backwards */
    for (let k = 0; k < d.placed.length; k++) {
      const pl = d.placed[k], n = pl.word.length, a = await cellXY(p, pl.r, pl.c), b = await cellXY(p, pl.r + pl.dy * (n - 1), pl.c + pl.dx * (n - 1));
      if (k === 0) await drag(p, b, a); else await drag(p, a, b);
      await p.waitForTimeout(120);
      if (k < d.placed.length - 1) ok((await dbg(p)).found.length === k + 1, `dragging along ${pl.word} finds it (${k + 1} of ${d.words.length})`);
    }
    ok(await cheered(p), "finding every word brings the cheer");
    ok(await p.evaluate(() => document.querySelectorAll("#tbWords li.is-found, .tb-words li.is-found").length) === d.words.length, "every word in the list is ticked");
    ok(/\d of \d found/.test(await text(p, "#tbProg")), "the count is on the screen: " + await text(p, "#tbProg"));
    /* tapping a first and a last letter, with a finger */
    await p.click("[data-cheer=next]"); await sleep(400);
    d = await dbg(p);
    ok(d.found.length === 0, "a new word search starts with nothing found");
    const t = d.placed[0], tn = t.word.length, ta = await cellXY(p, t.r, t.c), tb = await cellXY(p, t.r + t.dy * (tn - 1), t.c + t.dx * (tn - 1));
    await p.touchscreen.tap(ta[0], ta[1]); await sleep(120);
    ok(await p.evaluate(() => document.querySelectorAll("#tbStage .is-start").length === 1), "tapping a first letter marks it");
    await p.touchscreen.tap(tb[0], tb[1]); await sleep(150);
    ok((await dbg(p)).found.includes(t.word), "then tapping the last letter finds the word");
    /* the hint */
    await click(p, "#tbHint"); await sleep(150);
    ok(await p.evaluate(() => document.querySelectorAll("#tbStage .is-hint").length === 1) && /first letter is flashing/.test(await text(p, "#tbWsMsg")), "the hint flashes the first letter of a word still to find");
    /* a new one changes the grid */
    const before = await p.evaluate(() => document.querySelector("#tbStage .tb-grid").textContent);
    await click(p, "#tbNew"); await sleep(300);
    ok(before !== await p.evaluate(() => document.querySelector("#tbStage .tb-grid").textContent), "New one makes a different puzzle");
    await ctx.close();
    /* the three stages */
    for (const [lvl, maxSize, maxWords] of [["early", 10, 7], ["late", 6, 3]]) {
      const s = await fresh(LAND); await s.p.click(`label[for=tbStage${lvl[0].toUpperCase() + lvl.slice(1)}]`); await openAct(s.p, "wordsearch");
      const e = await dbg(s.p);
      ok(e.size <= maxSize && e.words.length <= maxWords && e.words.length >= 3, `${lvl} stage: ${e.size} x ${e.size}, ${e.words.length} words`);
      if (lvl === "late") ok(e.placed.every(x => x.dy === 0 && x.dx === 1), "late stage: every word reads straight across");
      if (lvl === "early") ok(e.size >= 9, "early stage: a bigger grid");
      await s.ctx.close();
    }
  }

  /* ---------- trace the path ---------- */
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "trace");
    const pathPts = async () => p.evaluate(() => { const d = window.CognicopiaTabletUI.debug(); return { pts: d.path.pts.map(q => d.toClient(q[0], q[1])), tol: d.tol, round: d.round, idx: d.dotIndex, kind: d.path.kind, n: d.path.pts.length }; });
    let a = await pathPts();
    ok(a.n > 40 && a.round === 0 && a.idx === 0, `the first path (${a.kind}) is on the screen with the dot at the start`);
    ok(/Path 1 of 4/.test(await text(p, "#tbProg")), "the count says Path 1 of 4");
    /* touching away from the dot does not start anything */
    const far = [a.pts[a.n - 1][0], a.pts[a.n - 1][1]]; await p.mouse.move(far[0], far[1]); await p.mouse.down(); await p.mouse.move(far[0] + 10, far[1] + 10, { steps: 3 }); await p.mouse.up();
    ok((await pathPts()).idx === 0 && /Touch the green dot/.test(await text(p, ".tb-trace + .tb-msg")), "touching away from the dot does nothing, and says where to start");
    /* follow it part of the way, then lift: the dot goes back */
    const half = Math.floor(a.n / 2);
    await p.mouse.move(a.pts[0][0], a.pts[0][1]); await p.mouse.down();
    for (let k = 0; k <= half; k += 3) await p.mouse.move(a.pts[k][0], a.pts[k][1]);
    const mid = (await pathPts()).idx;
    ok(mid > half - 8 && mid <= half, `the dot follows the finger along the line (${mid} of ${a.n})`);
    ok(await p.evaluate(() => document.querySelector(".tb-trace .trail").getAttribute("d").length > 20), "a green trail shows how far it has come");
    await p.mouse.up(); await sleep(100);
    ok((await pathPts()).idx === 0 && /lifted/i.test(await text(p, ".tb-trace + .tb-msg")), "lifting the finger sends the dot back to the start");
    ok(await p.evaluate(() => document.querySelector(".tb-trace .trail").getAttribute("d") === ""), "and clears the trail");
    /* slip off the line */
    await p.mouse.move(a.pts[0][0], a.pts[0][1]); await p.mouse.down();
    for (let k = 0; k <= half; k += 3) await p.mouse.move(a.pts[k][0], a.pts[k][1]);
    const out = await p.evaluate(() => { const d = window.CognicopiaTabletUI.debug(); let best = null, bd = 0; for (let x = 40; x < 960; x += 20) for (let y = 40; y < 560; y += 20) { let m = 1e9; for (const q of d.path.pts) m = Math.min(m, Math.hypot(q[0] - x, q[1] - y)); if (m > bd) { bd = m; best = [x, y]; } } return d.toClient(best[0], best[1]); });
    await p.mouse.move(out[0], out[1], { steps: 4 }); await sleep(100);
    ok((await pathPts()).idx === 0 && /slipped off/.test(await text(p, ".tb-trace + .tb-msg")), "slipping off the line sends the dot back to the start");
    await p.mouse.up();
    /* wrong direction */
    await p.mouse.move(a.pts[0][0], a.pts[0][1]); await p.mouse.down();
    for (let k = 0; k <= half; k += 3) await p.mouse.move(a.pts[k][0], a.pts[k][1]);
    for (let k = half; k >= Math.max(0, half - 40); k -= 3) await p.mouse.move(a.pts[k][0], a.pts[k][1]);
    await sleep(100);
    ok((await pathPts()).idx === 0, "turning back along the line sends the dot to the start");
    await p.mouse.up();
    /* a steady trace of every path to the end */
    for (let round = 0; round < 4; round++) {
      a = await pathPts();
      ok(a.round === round && a.idx === 0, `path ${round + 1}: the dot waits at the start`);
      await p.mouse.move(a.pts[0][0], a.pts[0][1]); await p.mouse.down();
      for (let k = 0; k < a.n; k += 2) await p.mouse.move(a.pts[k][0] + (k % 4 ? 2 : -2), a.pts[k][1] + (k % 6 ? 2 : -2));
      await p.mouse.move(a.pts[a.n - 1][0], a.pts[a.n - 1][1]); await p.mouse.up();
      if (round < 3) { await p.waitForFunction(r => window.CognicopiaTabletUI.debug().round === r + 1 && window.CognicopiaTabletUI.debug().dotIndex === 0, round, { timeout: 4000 }).catch(() => {}); ok((await pathPts()).round === round + 1, `path ${round + 1} finished and the next one came`); }
    }
    ok(await cheered(p), "tracing all four paths brings the cheer");
    await ctx.close();
    const c2 = await fresh(LAND); await c2.p.click("label[for=tbStageLate]"); await openAct(c2.p, "trace");
    const lt = await c2.p.evaluate(() => window.CognicopiaTabletUI.debug().tol), ea = await (async () => { const e = await fresh(LAND); await e.p.click("label[for=tbStageEarly]"); await openAct(e.p, "trace"); const v = await e.p.evaluate(() => window.CognicopiaTabletUI.debug().tol); await e.ctx.close(); return v; })();
    ok(lt > ea, `the late-stage lane is wider than the early one (${Math.round(lt)} and ${Math.round(ea)} units)`);
    await c2.ctx.close();
  }

  /* ---------- crossword and spelling ---------- */
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "crossword");
    let d = await dbg(p); const cw = d.cw;
    ok(cw.entries.length >= 3 && await p.evaluate(() => document.querySelectorAll("#tbStage .tb-cwc").length) === cw.cells.join("").replace(/\./g, "").length, `the crossword has ${cw.entries.length} words and a square for every letter`);
    ok(await p.evaluate(() => document.querySelectorAll("#tbStage .tb-key").length) === 27, "an on-screen keyboard appears: 26 letters and Back");
    ok(/^\d+ (Across|Down): .+/.test(await text(p, ".tb-clue")) && /letters/.test(await text(p, ".tb-clue")), "the clue is on the screen: " + (await text(p, ".tb-clue")).replace(/\s+/g, " "));
    const keyOf = L => `#tbStage .tb-key[data-k="${L}"]`;
    const E = cw.entries[0];
    const pick = async e => { await click(p, `#tbStage .tb-cwc[data-r="${e.r}"][data-c="${e.c}"]`); if (!(await text(p, ".tb-clue")).startsWith(e.num + " " + (e.dir === "A" ? "Across" : "Down"))) await click(p, `#tbStage .tb-cwc[data-r="${e.r}"][data-c="${e.c}"]`); return (await text(p, ".tb-clue")).startsWith(e.num + " " + (e.dir === "A" ? "Across" : "Down")); };
    ok(await pick(E), "tapping a square picks its word (tapping a crossing square again turns it)");
    ok(await p.evaluate(() => document.querySelectorAll("#tbStage .tb-cwc.is-word").length) === E.word.length, "and lights up exactly that word's squares");
    /* a wrong letter: not finished, never red */
    const wrongL = E.word.charAt(0) === "Q" ? "Z" : "Q";
    await click(p, keyOf(wrongL)); await sleep(80);
    ok((await dbg(p)).typed[E.r + "," + E.c] === wrongL && Object.keys((await dbg(p)).done).length === 0, "a letter tapped on the keyboard lands in the square, and a wrong one just is not finished");
    ok(!/wrong|incorrect|error/i.test(await p.evaluate(() => document.getElementById("tbLive").textContent + document.querySelector(".tb-clue").textContent)), "with no word of blame");
    await click(p, keyOf("BACK")); await sleep(80);
    ok(!(await dbg(p)).typed[E.r + "," + E.c], "Back takes the letter out again");
    /* the whole crossword, tapped in */
    for (const e of cw.entries) {
      if (!(await pick(e))) { problems.push("could not pick " + e.num + e.dir); continue; }
      for (const L of e.word) await click(p, keyOf(L));
      await sleep(60);
    }
    d = await dbg(p);
    ok(Object.keys(d.done).length === cw.entries.length, `every word is marked done (${Object.keys(d.done).length} of ${cw.entries.length})`);
    ok(await cheered(p), "finishing the crossword brings the cheer");
    await click(p, "[data-cheer=next]"); await sleep(400);
    d = await dbg(p); ok(Object.keys(d.typed).length === 0, "a new crossword starts empty");
    /* the A letter hint and the clue buttons and the real keyboard */
    const clue1 = await text(p, ".tb-clue");
    await click(p, '[data-cwn="1"]'); await sleep(100);
    ok(await text(p, ".tb-clue") !== clue1, "the Clue buttons move to another word");
    await click(p, "#tbCwHint"); await sleep(100);
    ok(Object.keys((await dbg(p)).typed).length === 1, "A letter fills in one correct letter");
    const e2 = d.cw.entries[0]; await pick(e2); await p.keyboard.press("x"); await sleep(60);
    ok(Object.values((await dbg(p)).typed).includes("X"), "the computer's own keyboard types into the crossword too");
    await ctx.close();
  }
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "spell");
    let d = await dbg(p); const count = d.count;
    ok(count >= 3 && /Word 1 of/.test(await text(p, "#tbProg")), `Spell It has ${count} words`);
    for (let i = 0; i < count; i++) {
      d = await dbg(p);
      const given = await p.evaluate(() => document.querySelectorAll("#tbStage .tb-slot.is-given").length);
      ok(given === 1, `word ${i + 1}: the first letter is given at the middle stage`);
      if (i === 0) {
        const bad = d.word.charAt(1) === "Q" ? "Z" : "Q";
        for (let k = given; k < d.word.length; k++) await click(p, `#tbStage .tb-key[data-k="${bad}"]`);
        await sleep(80);
        ok(/Nearly/.test(await text(p, "#tbStage .tb-msg")) && !/wrong/i.test(await text(p, "#tbStage .tb-msg")), "a full word that is not right gets a gentle sentence: " + await text(p, "#tbStage .tb-msg"));
        for (let k = given; k < d.word.length; k++) await click(p, '#tbStage .tb-key[data-k="BACK"]');
        ok(await p.evaluate(() => Array.from(document.querySelectorAll("#tbStage .tb-slot")).filter(s => s.textContent).length) === given, "Back takes the letters out again");
        await click(p, "#tbSpHint"); await sleep(60);
        ok(await p.evaluate(() => Array.from(document.querySelectorAll("#tbStage .tb-slot")).filter(s => s.textContent).length) === given + 1, "A letter fills in the next correct letter");
        for (let k = given + 1; k < d.word.length; k++) await click(p, `#tbStage .tb-key[data-k="${d.word.charAt(k)}"]`);
      } else for (let k = given; k < d.word.length; k++) await click(p, `#tbStage .tb-key[data-k="${d.word.charAt(k)}"]`);
      await sleep(100);
      if (i < count - 1) { ok(await p.evaluate(() => !document.getElementById("tbSpNext").hidden), `word ${i + 1}: spelled right, and Next appears`); await click(p, "#tbSpNext"); await sleep(80); }
    }
    ok(await cheered(p), "spelling every word brings the cheer");
    await ctx.close();
  }

  /* ---------- the choosing activities ---------- */
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "saying");
    let d = await dbg(p); const count = d.count;
    for (let i = 0; i < count; i++) {
      d = await dbg(p); const it = d.item;
      if (i === 0) {
        const wrong = it.options.find(o => o !== it.answer);
        await clickAttr(p, "data-o", String(it.options.indexOf(wrong))); await sleep(100);
        ok(/Good thought/.test(await text(p, "#tbStage .tb-msg")) && await p.evaluate(() => document.querySelectorAll("#tbStage .tb-opt.is-right").length === 1), "a different choice gets \"Good thought. Here is how it goes.\" and the saying is completed");
        ok(await p.evaluate(a => document.querySelector("#tbStage .tb-big").textContent.includes(a), it.answer), "with the answer in the sentence");
      } else {
        await clickAttr(p, "data-o", String(it.options.indexOf(it.answer))); await sleep(100);
        ok(await p.evaluate(() => document.querySelectorAll("#tbStage .tb-opt.is-right").length === 1) && !/Good thought/.test(await text(p, "#tbStage .tb-msg")), `saying ${i + 1}: the right word is marked, with a short word of praise`);
      }
      if (i < count - 1) { await click(p, "#tbSyNext"); await sleep(80); }
    }
    ok(await cheered(p), "the last saying brings the cheer");
    await ctx.close();
  }
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "sort");
    ok(await p.evaluate(() => getComputedStyle(document.getElementById("tbSoNext")).display === "none"), "Next is not on the screen until an item has been sorted");
    let d = await dbg(p); const total = d.groups.length === 2 ? await p.evaluate(() => /Item 1 of (\d+)/.exec(document.getElementById("tbProg").textContent)[1]) : 0;
    for (let i = 0; i < +total; i++) {
      d = await dbg(p);
      const g = i === 0 ? 1 - d.item.group : d.item.group;
      await clickAttr(p, "data-g", String(g)); await sleep(80);
      if (i === 0) ok(await p.evaluate(() => document.querySelectorAll("#tbStage .tb-opt.is-right").length === 1) && !/wrong/i.test(await text(p, "#tbStage .tb-msg")), "a wrong group shows the right one with a plain sentence: " + await text(p, "#tbStage .tb-msg"));
      if (i < +total - 1) { await click(p, "#tbSoNext"); await sleep(60); }
    }
    ok(await cheered(p), "sorting every item brings the cheer");
    await ctx.close();
  }
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "order");
    let d = await dbg(p);
    const items = +(/of (\d+)/.exec(await text(p, "#tbProg"))[1]);
    for (let i = 0; i < items; i++) {
      d = await dbg(p); const steps = d.item.steps.length;
      if (i === 0) {
        const wrong = d.item.order.find(k => k !== 0);
        await clickAttr(p, "data-step", String(wrong)); await sleep(80);
        ok(await p.evaluate(() => document.querySelectorAll("#tbStage .tb-placed li.is-on").length === 0 && document.querySelectorAll("#tbStage .tb-opt.is-shake").length === 1), "a step tapped too early gives a small shake and goes nowhere");
        ok(/Not quite yet/.test(await text(p, "#tbStage .tb-msg")), "with a gentle sentence");
      }
      for (let k = 0; k < steps; k++) { await clickAttr(p, "data-step", String(k)); await sleep(50); }
      ok(await p.evaluate(() => document.querySelectorAll("#tbStage .tb-placed li.is-on").length) === steps, `activity ${i + 1}: every step is in its place`);
      if (i < items - 1) { await click(p, "#tbOrNext"); await sleep(60); }
    }
    ok(await cheered(p), "putting every step in order brings the cheer");
    await ctx.close();
  }
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "match");
    const d = await dbg(p), words = Object.keys(d.truth);
    ok(words.length >= 3, `Match the Clue has ${words.length} pairs`);
    const other = words[1];
    await clickAttr(p, "data-word", words[0]); await clickAttr(p, "data-clue", d.truth[other]); await sleep(100);
    ok(await p.evaluate(() => document.querySelectorAll("#tbStage .is-matched").length === 0) && /do not go together/.test(await text(p, "#tbStage .tb-msg")), "two that do not go together are put down again with a gentle sentence");
    for (const w of words) { await clickAttr(p, "data-word", w); await clickAttr(p, "data-clue", d.truth[w]); await sleep(60); }
    ok(await p.evaluate(() => document.querySelectorAll("#tbStage .is-matched").length) === words.length * 2, "every right pair is marked and locked");
    ok(await cheered(p), "matching every pair brings the cheer");
    await ctx.close();
  }
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "odd");
    const rounds = +(/of (\d+)/.exec(await text(p, "#tbProg"))[1]);
    for (let i = 0; i < rounds; i++) {
      const target = i === 0 ? 0 : 1;
      await p.evaluate(t => { const b = Array.from(document.querySelectorAll("#tbStage [data-odd]")).filter(x => x.getAttribute("data-odd") === String(t))[0]; b.setAttribute("data-pick", "1"); }, target);
      await click(p, '#tbStage [data-pick="1"]'); await sleep(100);
      ok(/The other three are/.test(await text(p, "#tbStage .tb-msg")) && await p.evaluate(() => document.querySelectorAll("#tbStage .tb-opt.is-right").length === 1), i === 0 ? "a wrong pick shows the odd one and what the other three are" : `round ${i + 1}: the odd one is marked`);
      if (i < rounds - 1) { await click(p, "#tbOdNext"); await sleep(60); }
    }
    ok(await cheered(p), "the last round brings the cheer");
    await ctx.close();
  }
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "talk");
    const c0 = await text(p, "#tbStage .tb-card");
    ok(await p.evaluate(() => document.getElementById("tbTaPrev").disabled), "the first card has no Back");
    await click(p, "#tbTaNext"); await sleep(80);
    ok(await text(p, "#tbStage .tb-card") !== c0 && /Card 2 of/.test(await text(p, "#tbProg")), "Next shows another card");
    ok(await p.evaluate(() => document.querySelectorAll("#tbStage .tb-talk div").length) >= 2, "with two or more things to see, hear or feel");
    await click(p, "#tbTaPrev"); await sleep(80);
    ok(await text(p, "#tbStage .tb-card") === c0, "Back returns to the first");
    await ctx.close();
  }

  /* ---------- coloring, painting, bubbles ---------- */
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "color");
    await p.waitForSelector(".tb-pics .tb-pic", { timeout: 8000 });
    ok(await p.evaluate(() => document.querySelectorAll(".tb-pic").length) === 6, "six pictures to choose from");
    await click(p, ".tb-pic"); await p.waitForSelector(".tb-art svg path");
    const nShapes = (await dbg(p)).shapes; ok(nShapes >= 3, `the picture has ${nShapes} shapes to color`);
    await click(p, '.tb-sw[data-color="#4a9d5b"]');
    ok(await p.evaluate(() => document.querySelector('.tb-sw[data-color="#4a9d5b"]').getAttribute("aria-pressed") === "true" && document.querySelectorAll('.tb-sw[aria-pressed="true"]').length === 1), "the chosen color is marked");
    const spot = async () => p.evaluate(() => { const ps = Array.from(document.querySelectorAll(".tb-art svg path")); for (const e of ps) { const r = e.getBoundingClientRect(); for (const [fx, fy] of [[.5, .5], [.3, .5], [.7, .5], [.5, .3], [.5, .7], [.2, .2], [.8, .8]]) { const x = r.left + r.width * fx, y = r.top + r.height * fy; if (document.elementFromPoint(x, y) === e && !e.style.fill) return [x, y]; } } return null; });
    const s1 = await spot(); await p.mouse.click(s1[0], s1[1]); await sleep(60);
    ok((await dbg(p)).filled === 1 && await p.evaluate(() => Array.from(document.querySelectorAll(".tb-art svg path")).some(e => e.style.fill === "rgb(74, 157, 91)")), "tapping a shape colors it in the chosen color");
    await click(p, '.tb-sw[data-color="#d94b3d"]'); const s2 = await spot(); await p.mouse.click(s2[0], s2[1]); await sleep(60);
    ok((await dbg(p)).filled === 2, "a second color on a second shape");
    await click(p, '[data-co="undo"]'); await sleep(60);
    ok((await dbg(p)).filled === 1, "Undo takes the last color off");
    await click(p, '[data-co="clear"]'); await sleep(60);
    ok(await p.evaluate(() => Array.from(document.querySelectorAll(".tb-art svg path")).every(e => !e.style.fill)), "Start over clears every color");
    await click(p, '[data-co="pick"]'); await sleep(200);
    ok(await p.evaluate(() => document.querySelectorAll(".tb-pic").length) === 6, "Another picture returns to the choice");
    await ctx.close();
  }
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "paint");
    const box = await p.evaluate(() => { const r = document.querySelector(".tb-paint").getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
    const px = (fx, fy) => p.evaluate(([fx2, fy2]) => { const cv = document.querySelector(".tb-paint"), c = cv.getContext("2d"); return Array.from(c.getImageData(Math.round(cv.width * fx2), Math.round(cv.height * fy2), 1, 1).data); }, [fx, fy]);
    ok((await px(.5, .5)).join() === "255,255,255,255", "the canvas starts white");
    await p.mouse.move(box[0] + box[2] * .2, box[1] + box[3] * .5); await p.mouse.down(); await p.mouse.move(box[0] + box[2] * .8, box[1] + box[3] * .5, { steps: 10 }); await p.mouse.up();
    ok((await dbg(p)).strokes === 1 && (await px(.5, .5)).join() === "217,75,61,255", "a finger drawn across the canvas paints a line in the chosen color");
    await click(p, '.tb-sw[data-color="#4a9d5b"]'); await click(p, '[data-pw="30"]');
    await p.mouse.move(box[0] + box[2] * .5, box[1] + box[3] * .2); await p.mouse.down(); await p.mouse.move(box[0] + box[2] * .5, box[1] + box[3] * .8, { steps: 10 }); await p.mouse.up();
    ok((await dbg(p)).strokes === 2 && (await px(.5, .3)).join() === "74,157,91,255", "another color, a thicker line");
    await click(p, '[data-pw="undo"]'); ok((await dbg(p)).strokes === 1 && (await px(.5, .3)).join() === "255,255,255,255", "Undo takes the last line away");
    await click(p, '[data-pw="clear"]'); ok((await dbg(p)).strokes === 0 && (await px(.5, .5)).join() === "255,255,255,255", "Clear makes the canvas white again");
    await ctx.close();
  }
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "bubbles");
    const centers = () => p.evaluate(() => Array.from(document.querySelectorAll(".tb-bub:not(.is-pop)")).map(b => { const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; }));
    let cs = await centers(); ok(cs.length >= 3 && cs.every(c => c[2] >= 80), `${cs.length} bubbles drift in the sky, each at least 80 px across`);
    const y0 = cs[0][1]; await sleep(700); const moved = (await centers()).some(c => Math.abs(c[1] - y0) > 5); ok(moved, "they drift upward on their own");
    cs = await centers(); const t = cs.find(c => c[1] > 120 && c[1] < 650) || cs[0];
    await p.touchscreen.tap(t[0], t[1]); await sleep(80);
    ok(await p.evaluate(() => document.querySelectorAll(".tb-bub.is-pop").length) >= 1, "tapping a bubble pops it");
    ok(!(await p.evaluate(() => /\d/.test((document.querySelector("#tbProg") || {}).textContent || ""))), "no number is shown for bubbles");
    await ctx.close();
    const r = await fresh(LAND, { reduced: true }); await openAct(r.p, "bubbles");
    const a1 = await r.p.evaluate(() => Array.from(document.querySelectorAll(".tb-bub")).map(b => b.getBoundingClientRect().top)); await sleep(700);
    const a2 = await r.p.evaluate(() => Array.from(document.querySelectorAll(".tb-bub")).map(b => b.getBoundingClientRect().top));
    ok(a1.length >= 3 && JSON.stringify(a1) === JSON.stringify(a2), "for people who ask for less motion, the bubbles stay still");
    await r.ctx.close();
  }

  /* ---------- the shell: leaving, new ones, focus ---------- */
  {
    const { ctx, p } = await fresh(LAND);
    await p.focus('[data-act="sort"]'); await p.keyboard.press("Enter"); await stageReady(p);
    ok(await p.evaluate(() => document.getElementById("tbTitle").textContent === "Sort It" && document.activeElement.id === "tbBack"), "opening an activity from the keyboard focuses the Menu button");
    ok(await p.evaluate(() => Array.from(document.body.children).filter(n => n.id !== "tb" && n.id !== "tbGate" && n.tagName !== "SCRIPT").every(n => n.inert)), "everything behind the activity is out of reach");
    await p.keyboard.press("Escape"); await p.waitForSelector("#tb", { state: "hidden" });
    ok(await p.evaluate(() => document.activeElement.getAttribute("data-act") === "sort"), "Escape returns to the menu with focus back on the card");
    ok(await p.evaluate(() => !document.documentElement.classList.contains("tb-open") && Array.from(document.body.children).every(n => !n.inert)), "and the menu is usable again");
    await openAct(p, "saying"); await toMenu(p);
    ok(await p.evaluate(() => document.activeElement.getAttribute("data-act") === "saying"), "the Menu button returns to the menu too");
    await ctx.close();
  }

  /* ---------- every control is big enough, nothing runs off the screen ---------- */
  for (const [name, vp, noScroll] of [["landscape tablet", LAND, true], ["portrait tablet", PORT, true], ["phone", PHONE, false]]) {
    const { ctx, p } = await fresh(vp);
    const menu = await p.evaluate(() => ({ over: document.scrollingElement.scrollWidth - innerWidth, cards: Array.from(document.querySelectorAll(".tbp-card, .tbp-seg label, .tbp-sel, #tbSound, #tbFull")).filter(e => { const r = e.getBoundingClientRect(); return r.width < 52 || r.height < 52; }).length }));
    ok(menu.over <= 1 && menu.cards === 0, `${name}: the menu fits the width and every control is 52 px or more`);
    for (const id of ALL) {
      await p.click(`[data-act="${id}"]`); await stageReady(p); if (id === "color") await p.waitForSelector(".tb-pics", { timeout: 8000 }).catch(() => {});
      await p.waitForTimeout(250);
      if (id === "color") { await click(p, ".tb-pic"); await p.waitForSelector(".tb-art svg path"); await sleep(150); }
      const sm = await small(p), fit = await p.evaluate(() => { const s = document.getElementById("tbStage"); return { x: s.scrollWidth - s.clientWidth, y: s.scrollHeight - s.clientHeight }; });
      ok(sm.length === 0, `${name}, ${id}: every control is 52 px or more${sm.length ? " (" + sm.slice(0, 3).join(", ") + ")" : ""}`);
      ok(fit.x <= 1, `${name}, ${id}: nothing runs off the side`);
      if (noScroll) ok(fit.y <= 1, `${name}, ${id}: it fits the screen with no scrolling (${fit.y} px over)`);
      await toMenu(p);
    }
    await ctx.close();
  }

  /* ---------- the free packets ---------- */
  {
    const { ctx, p } = await fresh(LAND);
    const n0 = await p.evaluate(() => localStorage.getItem("cognicopia_gen_count"));
    await openAct(p, "sort"); await toMenu(p); await openAct(p, "match"); await toMenu(p);
    const n1 = await p.evaluate(() => localStorage.getItem("cognicopia_gen_count"));
    ok((n0 === null || n0 === "0") && n1 === "1", `a session is one packet, counted once however many activities it holds (${n0} to ${n1})`);
    await ctx.close();
    const g = await fresh(LAND, { init: 'try{localStorage.setItem("cognicopia_gen_count","25")}catch(e){}' });
    await g.p.click('[data-act="sort"]'); await sleep(400);
    ok(await g.p.evaluate(() => !document.getElementById("tbGate").hidden && document.getElementById("tb").hidden), "with the free packets used up, a session shows the gate instead of starting");
    ok(await g.p.evaluate(() => Array.from(document.querySelectorAll("#tbGate a")).some(a => /pricing\.html/.test(a.getAttribute("href")))), "which leads to the plans");
    await g.p.click("#tbGateClose"); ok(await g.p.evaluate(() => document.getElementById("tbGate").hidden), "and closes");
    await g.ctx.close();
  }

  /* ---------- privacy: only the page's own files; only the choices kept ---------- */
  {
    const { ctx, p } = await fresh(LAND);
    for (const id of ["wordsearch", "crossword", "color", "paint"]) { await openAct(p, id); if (id === "color") await p.waitForSelector(".tb-pics", { timeout: 8000 }).catch(() => {}); await toMenu(p); }
    const keys = await p.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)));
    ok(keys.every(k => /^(cognicopia_tablet_prefs|cognicopia_gen_count|cognicopia_trial_persist|cognicopia_license.*|cognicopia_promo.*)$/.test(k)), "nothing is kept in this browser but the choices and the free-packet count: " + keys.join(", "));
    ok(await p.evaluate(() => document.cookie === ""), "no cookie is set");
    await ctx.close();
  }
  ok(!foreign.length, "nothing was requested from outside the page: " + foreign.slice(0, 3).join(", "));
  ok(!errors.length, "no script error or console error: " + errors.slice(0, 3).join(" | "));
} catch (e) {
  problems.push("the check stopped: " + (e && e.stack ? e.stack.split("\n").slice(0, 5).join(" / ") : e));
} finally { await browser.close(); srv.close(); }

if (problems.length) { console.log(`tablet screen check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 40).join("\n  - ")); process.exit(1); }
console.log(`tablet screen check passed: ${passed} checks in a real browser (all thirteen activities driven by mouse and touch input, three screen sizes, the free-packet gate, and nothing leaving the page)`);
