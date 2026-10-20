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
     - trace the path (a bee, a train, a dog): the marker follows a finger along a wide glowing lane
       and always stays on it; wandering off, lifting the finger or turning back never sends it
       back; it works with real touch events; tracing every journey finishes
     - crossword and spelling: tapping letters on the on-screen keyboard fills the squares, a wrong
       letter is just not finished (never red), Back takes a letter back, A letter helps, a word is
       marked done and the crossword finishes; the physical keyboard works too
     - finish the saying, sort, put in order, match, odd one out: a wrong choice gets a gentle
       sentence and the right one is shown, a right choice gets a soft word, every one finishes
     - sights and sounds: touching a picture plays its sound and the wave moves; "which one is it?" plays
       a sound and a wrong picture plays its own, losing nothing; the sounds are loud enough to hear and
       never clip; color a picture colors a tapped shape in the chosen color, with undo and start over;
       finger paint draws, undoes and clears; bubbles pop
     - every activity has the same frame: Home, Read to Me, Finish for me (which completes it with a
       celebration), Next (a different activity at once) and, after fifteen quiet seconds, a glowing hint
     - nothing on any screen is red, and a wrong choice never ends the activity
     - the Home button and Escape return to the menu with focus back on the card
     - every control is at least 72 px on a landscape tablet and a portrait tablet (56 px on a phone, never
       under 52), nothing runs sideways off the screen, and on both tablets nothing needs scrolling
     - all text reaches 7:1 against its background, by day and in Night Shift
     - the free-packet count: one session is one packet, counted once, and the gate stops a session
       when they are gone
     - nothing is requested from outside the page, no script error appears, and the only things kept
       in the browser are the choices and the free-packet count

   Needs Playwright. Where it is missing this exits 2 and npm run build skips it.
   Run: node scripts/check-tablet-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";
import { measure as measureColor, sparse as colorSparse, MIN_SHAPES, MAX_SHAPES } from "./lib/tablet-color-measure.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], foreign = [], errors = []; let passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else problems.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ALL = ["wordsearch", "crossword", "spell", "saying", "trace", "color", "paint", "bubbles", "sort", "order", "match", "odd", "sounds"];
/* the activities already rebuilt to the 72 px floor; the others still meet the older 52 px one (this list grows until it holds all thirteen) */
const BIG = new Set(ALL);
const SPEECH = "window.__spoken=[];(function(){try{var s=window.speechSynthesis;if(!s)return;var o=s.speak.bind(s);s.speak=function(u){window.__spoken.push(u.text);try{o(u)}catch(e){}};}catch(e){}})();";
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
/* a real finger: touch events sent through the browser's own channel, the way a tablet's screen sends them */
async function touchPath(ctx, p, pts) {
  const cdp = await ctx.newCDPSession(p), send = (type, pt) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pt ? [{ x: pt[0], y: pt[1], id: 1 }] : [] });
  await send("touchStart", pts[0]);
  for (let k = 1; k < pts.length; k++) await send("touchMove", pts[k]);
  await send("touchEnd"); await cdp.detach();
}
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

/* text against its background, for everything visible in the activity screen (the colors a person sees, not the ones in the style sheet) */
const lowContrast = (p, min = 4.5) => p.evaluate(m => {
  const parse = c => { const x = /rgba?\(([^)]+)\)/.exec(c); if (!x) return null; const v = x[1].split(",").map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const lum = c => { const f = n => { n /= 255; return n <= .03928 ? n / 12.92 : Math.pow((n + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const back = e => { for (let n = e; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > .5) return c; if (getComputedStyle(n).backgroundImage !== "none") return null; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const bad = [];
  document.querySelectorAll("#tb *").forEach(e => {
    if (!Array.from(e.childNodes).some(n => n.nodeType === 3 && n.textContent.trim())) return;
    const r = e.getBoundingClientRect(), st = getComputedStyle(e); if (!r.width || !r.height || st.visibility === "hidden" || st.display === "none") return;
    const fg = parse(e instanceof SVGElement ? st.fill : st.color), bg = back(e); if (!fg || !bg) return;      // a drawing's text is colored by fill
    const a = lum(fg), b = lum(bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    if (ratio < m) bad.push((e.className && e.className.baseVal === undefined ? e.className : e.tagName) + " " + ratio.toFixed(2) + " " + (e.textContent || "").trim().slice(0, 18));
  });
  return bad;
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
    const inMenu = await home.p.evaluate(() => Array.from(document.querySelectorAll("a[href='tablet.html'], a[href='./tablet.html']")).length); ok(inMenu >= 2, "and the menu bar links to it as well (" + inMenu + " links)");
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
    ok(d.size >= 4 && d.size <= 5 && d.words.length === ({ 4: 3, 5: 4 })[d.size], `a middle-stage word search is ${d.size} x ${d.size} with ${d.words.length} words, from the ${d.pack} pack`);
    ok(await p.evaluate(() => document.querySelectorAll("#tbStage .tb-cell").length) === d.size * d.size, "every square is on the screen");
    ok(await p.evaluate(() => { const c = document.querySelector("#tbStage .tb-cell"), r = c.getBoundingClientRect(), fs = parseFloat(getComputedStyle(c).fontSize); return r.width >= 72 && fs >= r.width * 0.5; }), "the squares are at least 72 px and the letters fill them");
    /* a drag that is not a word: it fades, no red, nothing found */
    let bad = null;
    for (let r = 1; r < d.size && !bad; r++) for (let c = 0; c + 1 < d.size && !bad; c++) { const s = d.placed.some(pl => pl.dy === 0 && pl.r === r && c >= pl.c && c + 1 < pl.c + pl.word.length); if (!s) bad = [r, c]; }
    await drag(p, await cellXY(p, bad[0], bad[1]), await cellXY(p, bad[0], bad[1] + 1));
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
    ok(await p.evaluate(() => document.querySelectorAll("#tbStage .tb-wd.is-found").length) === d.words.length, "every word in the list is ticked");
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
    /* a word in the list: its letters glow */
    await click(p, "#tbStage .tb-wd:not(.is-found)"); await sleep(150);
    ok(await p.evaluate(() => document.querySelectorAll("#tbStage .tb-cell.tb-glow").length) >= 3 && /letters are glowing/.test(await text(p, "#tbWsMsg")), "touching a word in the list makes its letters glow");
    /* the size buttons make the grid bigger or smaller */
    const size0 = (await dbg(p)).size;
    await click(p, size0 > 3 ? '[data-grid="-1"]' : '[data-grid="1"]'); await sleep(300);
    const size1 = (await dbg(p)).size;
    ok(size1 === size0 + (size0 > 3 ? -1 : 1) && /\d × \d/.test(await text(p, "#tbGridN")), `the size buttons change the grid (${size0} x ${size0} to ${size1} x ${size1})`);
    ok(await p.evaluate(() => JSON.parse(localStorage.getItem("cognicopia_tablet_prefs")).grid) === size1, "and the size is remembered");
    /* a new one changes the grid */
    const before = await p.evaluate(() => document.querySelector("#tbStage .tb-grid").textContent);
    await click(p, "#tbNew"); await sleep(300);
    ok(before !== await p.evaluate(() => document.querySelector("#tbStage .tb-grid").textContent), "Next makes a different puzzle");
    await ctx.close();
    /* every size from 3 x 3 to 6 x 6 */
    for (const sz of [3, 4, 5, 6]) {
      const s = await fresh(LAND, { init: `try{localStorage.setItem("cognicopia_tablet_prefs",JSON.stringify({stage:"early",topic:"",sound:true,speed:2,grid:${sz}}))}catch(e){}` });
      await openAct(s.p, "wordsearch");
      const e = await dbg(s.p), need = { 3: 2, 4: 3, 5: 4, 6: 5 }[sz];
      ok(e.size === sz && e.words.length === need && await s.p.evaluate(() => document.querySelectorAll("#tbStage .tb-cell").length) === sz * sz, `a ${sz} x ${sz} grid with ${need} words`);
      ok(await s.p.evaluate(() => { const c = document.querySelector("#tbStage .tb-cell").getBoundingClientRect(); return c.width >= 72; }), `${sz} x ${sz}: the squares are 72 px or more`);
      await s.ctx.close();
    }
    /* the three stages */
    for (const [lvl, lo, hi] of [["early", 5, 6], ["late", 3, 4]]) {
      const s = await fresh(LAND); await s.p.click(`label[for=tbStage${lvl[0].toUpperCase() + lvl.slice(1)}]`); await openAct(s.p, "wordsearch");
      const e = await dbg(s.p);
      ok(e.size >= lo && e.size <= hi, `${lvl} stage: ${e.size} x ${e.size}, ${e.words.length} words`);
      if (lvl === "late") ok(e.placed.every(x => x.dy === 0 && x.dx === 1), "late stage: every word reads straight across");
      await s.ctx.close();
    }
  }

  /* ---------- trace the path ---------- */
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "trace");
    const info = () => p.evaluate(() => { const d = window.CognicopiaTabletUI.debug(); return { pts: d.path.pts.map(q => d.toClient(q[0], q[1])), tol: d.tol, round: d.round, idx: d.index, shown: d.shown, away: d.away, over: d.over, scene: d.scene, n: d.path.pts.length, from: d.from, to: d.to, kind: d.path.kind }; });
    const msgText = () => text(p, ".tb-trace + .tb-msg");
    let a = await info();
    ok(a.n > 40 && a.round === 0 && a.idx === 0 && ["bee", "train", "dog"].includes(a.scene), `the first journey (${a.scene}, ${a.kind}) is on the screen with the marker at the start`);
    ok(/Journey 1 of 3/.test(await text(p, "#tbProg")), "the count says Journey 1 of 3");
    ok(await p.evaluate(() => document.querySelectorAll("#tbStage canvas.tb-trace").length) === 1 && await p.evaluate(() => { const c = document.querySelector(".tb-trace"), g = c.getContext("2d"), d = g.getImageData(0, 0, c.width, c.height).data; let colored = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] !== d[0] || d[i + 1] !== d[1]) colored++; return colored > 200; }), "it is drawn on a canvas, with a lane, a goal and a marker");
    { const m0 = await msgText(); ok(/Help the bee|Guide the train|Help the dog/.test(m0), "the screen says what the journey is: " + m0); }
    /* touching away from the marker leaves it waiting, kindly */
    const far = a.pts.reduce((best, q) => Math.hypot(q[0] - a.pts[0][0], q[1] - a.pts[0][1]) > Math.hypot(best[0] - a.pts[0][0], best[1] - a.pts[0][1]) ? q : best, a.pts[0]);
    await p.mouse.move(far[0], far[1]); await p.mouse.down(); await p.mouse.move(far[0] + 10, far[1] + 10, { steps: 3 }); await p.mouse.up();
    ok((await info()).idx === 0 && /waiting right here/.test(await msgText()), "touching away from the marker does nothing, and says it is waiting: " + await msgText());
    /* follow part of the way, then lift: it stays where it is */
    const half = Math.floor(a.n / 2);
    await p.mouse.move(a.pts[0][0], a.pts[0][1]); await p.mouse.down();
    for (let k = 0; k <= half; k += 3) await p.mouse.move(a.pts[k][0], a.pts[k][1]);
    await sleep(250);
    const mid = await info();
    ok(mid.idx > half - 8 && mid.idx <= half && Math.abs(mid.shown - mid.idx) < 6, `the marker follows the finger along the lane (point ${mid.idx} of ${a.n}) and glides, not jumps`);
    await p.mouse.up(); await sleep(150);
    ok((await info()).idx === mid.idx && !/lifted|slipped/i.test(await msgText()), "lifting the finger leaves the marker where it is");
    /* wander far off, turn back along the line, wobble: nothing moves it backward */
    await p.mouse.move(a.pts[mid.idx][0], a.pts[mid.idx][1]); await p.mouse.down();
    const out = await p.evaluate(() => { const d = window.CognicopiaTabletUI.debug(); let best = null, bd = 0; for (let x = 40; x < 960; x += 20) for (let y = 40; y < 560; y += 20) { let m = 1e9; for (const q of d.path.pts) m = Math.min(m, Math.hypot(q[0] - x, q[1] - y)); if (m > bd) { bd = m; best = [x, y]; } } return d.toClient(best[0], best[1]); });
    await p.mouse.move(out[0], out[1], { steps: 4 }); await sleep(80);
    ok((await info()).idx >= mid.idx && (await info()).away, "wandering far off the lane leaves the marker waiting, not sent back");
    for (let k = mid.idx; k >= Math.max(0, mid.idx - 40); k -= 3) await p.mouse.move(a.pts[k][0], a.pts[k][1]);
    await sleep(80);
    const back0 = (await info()).idx;
    for (let k = back0; k >= Math.max(0, back0 - 20); k -= 2) await p.mouse.move(a.pts[k][0], a.pts[k][1]);
    ok((await info()).idx >= back0, "turning back along the line never moves the marker backward");
    await p.mouse.up();
    /* a trembling hand: wobble around the line, picking up where it was left */
    await p.mouse.move(a.pts[mid.idx][0], a.pts[mid.idx][1]); await p.mouse.down();
    for (let k = mid.idx; k < a.n; k += 2) await p.mouse.move(a.pts[k][0] + (k % 4 ? 0.9 : -0.9) * a.tol * 0.6, a.pts[k][1] + (k % 6 ? 0.7 : -0.7) * a.tol * 0.6);
    await p.mouse.move(a.pts[a.n - 1][0], a.pts[a.n - 1][1]); await p.mouse.up();
    await p.waitForFunction(() => window.CognicopiaTabletUI.debug().over, null, { timeout: 4000 }).catch(() => {});
    ok((await info()).over && /has (reached|pulled|found)/.test(await msgText()), "a wobbling hand still finishes the journey, and the screen says so: " + await msgText());
    /* the next two journeys: a different scene each time, finished with a real touch */
    const seen = [a.scene];
    for (let round = 1; round < 3; round++) {
      await p.waitForFunction(r => window.CognicopiaTabletUI.debug().round === r && !window.CognicopiaTabletUI.debug().over, round, { timeout: 5000 }).catch(() => {});
      const b = await info(); seen.push(b.scene);
      ok(b.round === round && b.idx === 0, `journey ${round + 1}: the marker waits at the start`);
      await touchPath(ctx, p, b.pts.filter((_, k) => k % 2 === 0));
      await p.waitForFunction(() => window.CognicopiaTabletUI.debug().over, null, { timeout: 4000 }).catch(() => {});
      ok((await info()).over, `journey ${round + 1}: a real touch along the lane carries the marker to its goal`);
    }
    ok(new Set(seen).size === 3, "the three journeys are three different scenes: " + seen.join(", "));
    ok(await cheered(p), "finishing all three journeys brings the cheer");
    await ctx.close();
    /* the wider lane for a later stage, and Finish for me */
    const lt = await (async () => { const e = await fresh(LAND); await e.p.click("label[for=tbStageLate]"); await openAct(e.p, "trace"); const v = await e.p.evaluate(() => window.CognicopiaTabletUI.debug().tol); await e.ctx.close(); return v; })();
    const ea = await (async () => { const e = await fresh(LAND); await e.p.click("label[for=tbStageEarly]"); await openAct(e.p, "trace"); const v = await e.p.evaluate(() => window.CognicopiaTabletUI.debug().tol); await e.ctx.close(); return v; })();
    ok(lt > ea, `the late-stage lane is wider than the early one (${Math.round(lt)} and ${Math.round(ea)} units)`);
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
    const { ctx, p } = await fresh(LAND, { init: SPEECH });
    await openAct(p, "spell");
    let d = await dbg(p); const count = d.count;
    ok(count === 5 && /Word 1 of 5/.test(await text(p, "#tbProg")), `Spell It has ${count} words`);
    const tiles = () => p.$$eval("#tbStage .tb-tile:not(.is-placed)", ts => ts.map(t => t.getAttribute("data-l")));
    const tileXY = L => centerOf(p, `#tbStage .tb-tray .tb-tile[data-l="${L}"]:not(.is-placed)`);
    const slotXY = k => centerOf(p, `#tbStage .tb-slot[data-s="${k}"]`);
    for (let i = 0; i < count; i++) {
      d = await dbg(p);
      ok(await p.evaluate(() => !!document.querySelector("#tbStage .tb-pic-card img")) && /\w/.test(await text(p, "#tbStage .tb-clueline")), `word ${i + 1}: there is a picture and a clue (${d.art})`);
      ok(!(await p.evaluate(() => document.querySelector("#tbStage .tb-pic-card").textContent.trim())), `word ${i + 1}: the picture has no letters in it`);
      ok(await p.evaluate(() => document.querySelectorAll("#tbStage .tb-slot").length) === d.word.length && (await tiles()).sort().join("") === d.word.split("").sort().join(""), `word ${i + 1}: ${d.word.length} places and exactly the letters of the word as blocks`);
      if (i === 0) {
        /* a block that is not right for the place: it hops and comes back, with a kind sentence */
        const wrongL = (await tiles()).find(L => L !== d.word[0]);
        if (wrongL) {
          const c = await tileXY(wrongL); await p.mouse.click(c[0], c[1]); await sleep(250);      /* (the hop that follows takes about a second to settle, so the drag below starts after it) */
          ok((await dbg(p)).placed === 0 && /Not that one/.test(await text(p, "#tbStage .tb-msg")) && !/wrong/i.test(await text(p, "#tbStage .tb-msg")), "a tap on the wrong letter places nothing, with a kind sentence: " + await text(p, "#tbStage .tb-msg"));
          await sleep(900);
          /* dragged to the wrong place: it floats back */
          const from = await tileXY(wrongL), to = await slotXY(0), at0 = await p.evaluate(L => { const r = document.querySelector(`#tbStage .tb-tray .tb-tile[data-l="${L}"]`).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; }, wrongL);
          await drag(p, from, to); await sleep(900);
          const at1 = await p.evaluate(L => { const r = document.querySelector(`#tbStage .tb-tray .tb-tile[data-l="${L}"]`).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; }, wrongL);
          ok((await dbg(p)).placed === 0 && Math.abs(at0[0] - at1[0]) < 3 && Math.abs(at0[1] - at1[1]) < 3, "a wrong letter dragged to a place glides back to where it was");
        }
        /* the right letter, dragged, stays */
        const right = await tileXY(d.word[0]), slot = await slotXY(0);
        await drag(p, right, slot); await sleep(600);
        ok((await dbg(p)).placed === 1 && await p.evaluate(() => document.querySelector('#tbStage .tb-slot[data-s="0"] .tb-tile') !== null), "the right letter dragged to its place stays there");
        /* the next one, with a real touch */
        const t2 = await tileXY(d.word[1]), s2 = await slotXY(1);
        await touchPath(ctx, p, [t2, [(t2[0] + s2[0]) / 2, (t2[1] + s2[1]) / 2], s2]); await sleep(600);
        ok((await dbg(p)).placed === 2, "a real touch can slide a letter into place too");
        for (let k = 2; k < d.word.length; k++) { const c = await tileXY(d.word[k]); await p.mouse.click(c[0], c[1]); await sleep(120); }
      } else for (let k = 0; k < d.word.length; k++) { const c = await tileXY(d.word[k]); await p.mouse.click(c[0], c[1]); await sleep(120); }
      await sleep(300);
      ok((await dbg(p)).finished && (await p.evaluate(() => window.__spoken)).some(x => x.toLowerCase() === d.word.toLowerCase()), `word ${i + 1}: spelled right, and the word is spoken: ${(await p.evaluate(() => window.__spoken)).slice(-1)[0]}`);
      if (i < count - 1) { ok(await p.evaluate(() => !document.getElementById("tbSpNext").hidden), `word ${i + 1}: Next word appears`); await click(p, "#tbSpNext"); await sleep(120); }
    }
    ok(await cheered(p), "spelling every word brings the cheer");
    await ctx.close();
    /* the late stage gives the first letter */
    const l = await fresh(LAND); await l.p.click("label[for=tbStageLate]"); await openAct(l.p, "spell");
    ok(await l.p.evaluate(() => document.querySelectorAll("#tbStage .tb-slot.is-given").length) === 1 && await l.p.evaluate(() => document.querySelectorAll("#tbStage .tb-tray .tb-tile").length) + 1 === (await dbg(l.p)).word.length, "late stage: the first letter is already in place");
    await l.ctx.close();
  }

  /* ---------- the choosing activities ---------- */
  {
    const { ctx, p } = await fresh(LAND, { init: SPEECH });
    await openAct(p, "saying");
    let d = await dbg(p); const count = d.count;
    ok(count === 5 && d.item.options.length === 3, "five sayings, three choices each");
    for (let i = 0; i < count; i++) {
      d = await dbg(p); const it = d.item;
      if (i === 0) {
        const wrong = it.options.find(o => o !== it.answer);
        await clickAttr(p, "data-o", String(it.options.indexOf(wrong))); await sleep(100);
        ok(/Good thought\. Try another/.test(await text(p, "#tbStage .tb-msg")) && await p.evaluate(() => document.querySelectorAll("#tbStage .tb-opt.is-right").length === 0 && document.querySelectorAll("#tbStage .tb-blank-slot").length === 1 && document.querySelectorAll("#tbStage .tb-opt:not([disabled])").length === 2), "a different choice steps back softly: the saying stays open and the other two choices are still there");
        const wrong2 = it.options.find(o => o !== it.answer && o !== wrong);
        await clickAttr(p, "data-o", String(it.options.indexOf(wrong2))); await sleep(150);
        ok(await p.evaluate(() => document.querySelectorAll("#tbStage .tb-opt.tb-glow").length) === 1, "after a second try the right choice glows");
        await clickAttr(p, "data-o", String(it.options.indexOf(it.answer))); await sleep(100);
        ok(await p.evaluate(a => document.querySelector("#tbStage .tb-big u").textContent === a && document.querySelectorAll("#tbStage .tb-opt.is-right").length === 1, it.answer), "then the right word completes the saying: " + it.answer);
        ok((await p.evaluate(() => window.__spoken)).some(x => x.toLowerCase().includes(it.answer.toLowerCase())), "and the whole saying is spoken aloud");
      } else if (i === 1 && await p.evaluate(() => !document.getElementById("tbSyHelp").hidden)) {
        /* spelling it, with letter blocks */
        await click(p, "#tbSyHelp"); await sleep(200);
        const ans = it.answer.toUpperCase();
        ok(await p.evaluate(() => document.querySelectorAll("#tbStage .tb-tile").length) === ans.length, `Help me spell it: ${ans.length} letter blocks for ${ans}`);
        for (const L of ans) { const c = await centerOf(p, `#tbStage .tb-tray .tb-tile[data-l="${L}"]:not(.is-placed)`); await p.mouse.click(c[0], c[1]); await sleep(110); }
        await sleep(200);
        ok(await p.evaluate(a => document.querySelector("#tbStage .tb-big u") && document.querySelector("#tbStage .tb-big u").textContent === a, it.answer), "spelling the word completes the saying");
      } else {
        await clickAttr(p, "data-o", String(it.options.indexOf(it.answer))); await sleep(100);
        ok(await p.evaluate(() => document.querySelectorAll("#tbStage .tb-opt.is-right").length === 1), `saying ${i + 1}: the right word is marked, with a short word of praise`);
      }
      if (i < count - 1) { await click(p, "#tbSyNext"); await sleep(80); }
    }
    ok(await cheered(p), "the last saying brings the cheer");
    await ctx.close();
  }
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "sort");
    let d = await dbg(p);
    ok(d.groups.length === 2 && await p.evaluate(() => document.querySelectorAll(".tb-bin").length) === 2 && await p.evaluate(() => Array.from(document.querySelectorAll(".tb-binhead img, .tb-thing img")).every(i => /assets\/tablet\/[\w-]+\.png$/.test(i.getAttribute("src")))), "two baskets, each with a picture, and every card is a real picture");
    ok(await p.evaluate(() => Array.from(document.querySelectorAll(".tb-thing")).every(b => b.textContent.trim().length >= 3)), "every picture has its name under it");
    const cards = () => p.evaluate(() => window.CognicopiaTabletUI.debug().cards()), bins = () => p.evaluate(() => window.CognicopiaTabletUI.debug().bins());
    const drag = async (a, b2) => { await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move(b2[0], b2[1], { steps: 8 }); await p.mouse.up(); };
    const total = d.total, bs = await bins(); let cs = await cards();
    ok(cs.length === total && total >= 4, `${total} pictures to sort`);
    const c0 = cs[0]; await drag([c0.x, c0.y], bs[1 - c0.group]); await sleep(900);
    ok((await dbg(p)).placed === 0 && (await cards()).length === total, "a picture dropped in the other basket floats back and goes nowhere");
    ok(/goes with/.test(await text(p, "#tbStage .tb-msg")) && !/wrong/i.test(await text(p, "#tbStage .tb-msg")) && await p.evaluate(() => document.querySelectorAll(".tb-bin.tb-glow").length) === 1, "with a plain sentence about where it does go, and that basket glows: " + await text(p, "#tbStage .tb-msg"));
    cs = await cards(); const c1 = cs.find(c => c.i === c0.i); await drag([c1.x, c1.y], bs[c1.group]); await sleep(700);
    ok((await dbg(p)).placed === 1 && await p.evaluate(() => document.querySelectorAll(".tb-bin .tb-binput .tb-thing.is-placed").length) === 1 && /1 of \d+ sorted/.test(await text(p, "#tbProg")), "dragged to its own basket, a picture settles inside it, and the count says so");
    cs = await cards(); const c2 = cs[0];
    await p.mouse.click(c2.x, c2.y); await sleep(60);
    ok((await dbg(p)).picked === c2.i && await p.evaluate(() => document.querySelectorAll(".tb-thing.is-picked[aria-pressed=true]").length) === 1, "touching a picture picks it up");
    await p.mouse.click(bs[1 - c2.group][0], bs[1 - c2.group][1] + 30); await sleep(200);
    ok((await dbg(p)).placed === 1 && (await dbg(p)).picked === -1, "touching the other basket puts nothing in it");
    for (const c of await cards()) { const cc = (await cards()).find(x => x.i === c.i); if (!cc) continue; await p.mouse.click(cc.x, cc.y); await sleep(50); await p.mouse.click(bs[cc.group][0], bs[cc.group][1] + 30); await sleep(120); }
    ok((await dbg(p)).placed === total, "touching each picture and then its basket sorts the rest");
    ok(await cheered(p), "sorting every picture brings the cheer");
    await ctx.close();
  }
  {
    /* a real finger drags a picture, a clue and a step (touch events through the browser's own channel) */
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "sort");
    const d = await p.evaluate(() => { const x = window.CognicopiaTabletUI.debug(); return { cards: x.cards(), bins: x.bins() }; }), c = d.cards[0], b = d.bins[c.group];
    await touchPath(ctx, p, [[c.x, c.y], [c.x + (b[0] - c.x) * .3, c.y + (b[1] - c.y) * .3], [c.x + (b[0] - c.x) * .7, c.y + (b[1] - c.y) * .7], b]); await sleep(700);
    ok((await dbg(p)).placed === 1 && await p.evaluate(() => document.querySelectorAll(".tb-bin .tb-thing.is-placed").length) === 1, "Sort It: a finger drags a picture into its basket");
    const w = d.cards.find(x => x.group !== c.group), wb = d.bins[c.group]; const cw = await p.evaluate(i => { const e = document.querySelector('[data-i="' + i + '"]'); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, w.i);
    await touchPath(ctx, p, [cw, [(cw[0] + wb[0]) / 2, (cw[1] + wb[1]) / 2], wb]); await sleep(1000);
    ok((await dbg(p)).placed === 1, "and a finger that takes a picture to the other basket brings it back");
    await toMenu(p); await openAct(p, "order");
    const st = await p.evaluate(() => { const x = window.CognicopiaTabletUI.debug(); return { steps: x.steps(), slots: x.slots() }; }), s0 = st.steps.find(q => q.k === 0);
    await touchPath(ctx, p, [[s0.x, s0.y], [(s0.x + st.slots[0][0]) / 2, (s0.y + st.slots[0][1]) / 2], st.slots[0]]); await sleep(700);
    ok((await dbg(p)).placed === 1, "Put It in Order: a finger drags the first step to its place");
    await ctx.close();
  }
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "order");
    ok(await p.evaluate(() => getComputedStyle(document.getElementById("tbOrNext")).display === "none"), "Another job is not on the screen until a job is done");
    const items = +(/of (\d+)/.exec(await text(p, "#tbProg"))[1]);
    for (let i = 0; i < items; i++) {
      const d = await dbg(p), steps = d.item.steps.length, place = () => p.evaluate(() => window.CognicopiaTabletUI.debug().steps()), slots = () => p.evaluate(() => window.CognicopiaTabletUI.debug().slots());
      ok(steps >= 3 && await p.evaluate(() => document.querySelectorAll(".tb-oslot").length) === steps, `job ${i + 1}: ${steps} numbered places for the steps`);
      if (i === 0) {
        const later = d.item.order.find(k => k !== 0);
        await clickAttr(p, "data-step", String(later)); await sleep(100);
        ok((await dbg(p)).placed === 0 && await p.evaluate(() => document.querySelectorAll(".tb-oslot.is-filled").length) === 0 && /a little later/.test(await text(p, "#tbStage .tb-msg")), "a step touched too early goes nowhere, with a gentle sentence");
        const first = (await place()).find(s => s.k === 0), sl = await slots();
        await p.mouse.move(first.x, first.y); await p.mouse.down(); await p.mouse.move(sl[2][0], sl[2][1], { steps: 8 }); await p.mouse.up(); await sleep(700);
        ok((await dbg(p)).placed === 1 && await p.evaluate(() => document.querySelector('[data-slot="0"] .tb-step') !== null), "the first step, dragged to any place, settles in the first place");
      }
      for (let k = (await dbg(p)).placed; k < steps; k++) { await clickAttr(p, "data-step", String(k)); await sleep(80); }
      ok(await p.evaluate(() => document.querySelectorAll(".tb-oslot.is-filled").length) === steps && await p.evaluate(s => s.every((t, k) => (document.querySelector(`[data-slot="${k}"] .tb-step`) || {}).textContent === t), d.item.steps), `job ${i + 1}: every step is in its place, in order`);
      if (i < items - 1) { await click(p, "#tbOrNext"); await sleep(80); }
    }
    ok(await cheered(p), "putting every step in order brings the cheer");
    await ctx.close();
  }
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "match");
    const d = await dbg(p), arts = Object.keys(d.truth);
    ok(arts.length >= 3 && await p.evaluate(() => document.querySelectorAll(".tb-mpic img[src$='.png']").length) === arts.length, `Match the Clue has ${arts.length} pictures, each a real picture`);
    await clickAttr(p, "data-art", arts[0]); await clickAttr(p, "data-clue", d.truth[arts[1]].clue); await sleep(120);
    ok(await p.evaluate(() => document.querySelectorAll(".is-matched").length === 0) && /do not go together/.test(await text(p, "#tbStage .tb-msg")), "a picture and a clue that do not go together are put down again with a gentle sentence");
    const pos = a => p.evaluate(x => window.CognicopiaTabletUI.debug().cluePos(x), a), pics = () => p.evaluate(() => window.CognicopiaTabletUI.debug().pictures());
    const target = (await pics()).find(x => x.art === arts[2]), from = await pos(arts[2]);
    await p.mouse.move(from[0], from[1]); await p.mouse.down(); await p.mouse.move(target.x, target.y, { steps: 8 }); await p.mouse.up(); await sleep(200);
    ok((await dbg(p)).matched === 1 && await p.evaluate(a => document.querySelector(`[data-art="${a}"]`).classList.contains("is-matched") && document.querySelector(`[data-art="${a}"] .tb-mdone`).textContent.length > 5, arts[2]), "a clue dragged onto its picture locks, and the clue settles under the picture");
    for (const a of arts) { if (a === arts[2]) continue; await clickAttr(p, "data-clue", d.truth[a].clue); await clickAttr(p, "data-art", a); await sleep(80); }
    ok(await p.evaluate(() => document.querySelectorAll(".tb-mpic.is-matched").length) === arts.length, "every right pair is marked and locked");
    ok(await cheered(p), "matching every pair brings the cheer");
    await ctx.close();
  }
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "odd");
    const rounds = +(/of (\d+)/.exec(await text(p, "#tbProg"))[1]), cards = () => p.evaluate(() => window.CognicopiaTabletUI.debug().cards());
    ok(rounds >= 3 && (await cards()).length === 4 && (await cards()).filter(c => c.odd).length === 1 && await p.evaluate(() => document.querySelectorAll(".tb-oddcard img[src$='.png']").length) === 4, `${rounds} rounds of four pictures, one of them the odd one`);
    for (let i = 0; i < rounds; i++) {
      let cs = await cards();
      if (i === 0) {
        const not = cs.find(c => !c.odd); await p.mouse.click(not.x, not.y); await sleep(100);
        ok(await p.evaluate(() => document.querySelectorAll(".tb-oddcard.is-aside").length === 1 && document.querySelectorAll(".tb-oddcard.is-found").length === 0) && /goes with the others/.test(await text(p, "#tbStage .tb-msg")) && !/wrong/i.test(await text(p, "#tbStage .tb-msg")), "touching one that belongs sets it aside with a kind sentence: " + await text(p, "#tbStage .tb-msg"));
        const not2 = (await cards()).filter(c => !c.odd)[1]; await p.mouse.click(not2.x, not2.y); await sleep(100);
        ok(await p.evaluate(() => document.querySelectorAll(".tb-oddcard.tb-glow").length) === 1, "after a second try the odd one glows");
        cs = await cards();
      }
      const od = cs.find(c => c.odd); await p.mouse.click(od.x, od.y); await sleep(150);
      ok(/The other three are all/.test(await text(p, "#tbStage .tb-msg")) && await p.evaluate(() => document.querySelectorAll(".tb-oddcard.is-found").length === 1 && document.querySelectorAll(".tb-oddcard.is-together").length === 3), `round ${i + 1}: the odd one is marked, the other three are named: ` + await text(p, "#tbStage .tb-msg"));
      if (i < rounds - 1) { await click(p, "#tbOddNext"); await sleep(80); }
    }
    ok(await cheered(p), "the last round brings the cheer");
    await ctx.close();
  }
  /* ---------- sights and sounds ---------- */
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "sounds");
    let d = await dbg(p);
    ok(d.cards.length === 6 && await p.evaluate(() => document.querySelectorAll("#tbStage .tb-snd").length) === 6 && d.mode === "listen", "the board shows six pictures, each with its name, ready to listen");
    ok(await p.evaluate(() => Array.from(document.querySelectorAll("#tbStage .tb-snd")).every(b => b.querySelector("img.tb-ico[src$=\".png\"]") && b.textContent.trim().length > 3)), "every picture is a real picture with a name beside it");
    ok(await p.evaluate(() => document.querySelectorAll("#tbStage canvas.tb-wave").length) === 1, "a wave is drawn above the board");
    /* touching a picture plays its sound; the wave moves */
    await click(p, `[data-snd="${d.cards[0]}"]`); await sleep(450);
    /* a sound with a slow swell (waves, chimes) is still building on a busy machine: wait for it to be heard, up to five seconds */
    /* (the level is read at one instant, and a song has quiet gaps, so the loudest moment seen is the one to judge) */
    await p.evaluate(() => { window.__loudest = 0; });
    await p.waitForFunction(() => { const k = window.CognicopiaTabletUI.debug().peak; window.__loudest = Math.max(window.__loudest, k); return window.__loudest > 2; }, null, { timeout: 5000 }).catch(() => {});
    d = await dbg(p); d.peak = Math.max(d.peak, await p.evaluate(() => window.__loudest));
    ok(d.playing === d.cards[0] && d.peak > 2, `touching a picture plays its sound (the sound's wave reads ${d.peak} of 128)`);
    ok(await p.evaluate(id => document.querySelector(`[data-snd="${id}"]`).classList.contains("is-playing") && document.querySelector(`[data-snd="${id}"]`).classList.contains("is-heard"), d.cards[0]) && /1 of 6 heard/.test(await text(p, "#tbProg")), "that picture is marked as playing and heard, and the count says 1 of 6");
    const wave = async () => p.evaluate(() => { const c = document.querySelector(".tb-wave"), g = c.getContext("2d"), px = g.getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < px.length; i += 4 * 23) h = (h * 31 + px[i + 3] + px[i + 1]) | 0; return h; });
    const w1 = await wave(); let moved = false;
    for (let k = 0; k < 12 && !moved; k++) { await sleep(120); moved = (await wave()) !== w1; }
    ok(moved, "the wave moves while the sound plays");
    /* the rest, then the cheer */
    for (const id of d.cards.slice(1)) { await click(p, `[data-snd="${id}"]`); await sleep(160); }
    ok((await dbg(p)).heard.length === 6, "all six sounds have been heard");
    ok(await (async () => { try { await p.waitForSelector(".tb-cheer", { timeout: 9000 }); return true; } catch (e) { return false; } })(), "hearing every sound brings the cheer");
    await ctx.close();
  }
  {
    /* "which one is it?": a wrong picture plays its own sound and loses nothing */
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "sounds");
    await click(p, '[data-mode="find"]'); await sleep(900);
    let d = await dbg(p);
    ok(d.mode === "find" && d.target && d.rounds === 3 && /Sound 1 of 3/.test(await text(p, "#tbProg")) && d.playing === d.target, "the second way: a sound plays, and the screen asks which picture goes with it");
    const wrong = d.cards.find(c => c !== d.target);
    await click(p, `[data-snd="${wrong}"]`); await sleep(300);
    d = await dbg(p);
    ok(d.misses === 1 && d.playing === wrong && /That one is the/.test(await text(p, "#tbStage .tb-wavebox p")) && !/wrong|incorrect/i.test(await text(p, "#tbStage .tb-wavebox p")), "a picture that is not the one plays its own sound, with a kind sentence: " + await text(p, "#tbStage .tb-wavebox p"));
    ok(await p.evaluate(() => Array.from(document.querySelectorAll("#tbStage .tb-snd")).every(b => !b.disabled)) && d.round === 0, "nothing is locked and the round is still open");
    await sleep(2800);
    ok((await dbg(p)).playing === d.target, "then the sound to find plays again");
    for (let r = 0; r < 3; r++) {
      d = await dbg(p); await click(p, `[data-snd="${d.target}"]`); await sleep(120);
      ok(await p.evaluate(id => document.querySelector(`[data-snd="${id}"]`).classList.contains("is-right"), d.target) && /Yes, that is/.test(await text(p, "#tbStage .tb-wavebox p")), `round ${r + 1}: the right picture is marked, with a soft word of praise`);
      if (r < 2) await sleep(2100);
    }
    ok(await cheered(p) || await (async () => { try { await p.waitForSelector(".tb-cheer", { timeout: 4000 }); return true; } catch (e) { return false; } })(), "matching every sound brings the cheer");
    await ctx.close();
  }
  {
    /* with sound turned off the board says so and offers to turn it on */
    const { ctx, p } = await fresh(LAND, { init: 'try{localStorage.setItem("cognicopia_tablet_prefs",JSON.stringify({stage:"middle",topic:"",sound:false}))}catch(e){}' });
    await openAct(p, "sounds");
    ok(await p.evaluate(() => !document.getElementById("tbSndOn").hidden) && /Sound is turned off/.test(await text(p, "#tbStage .tb-wavebox p")), "with the sound turned off, the board says so and offers a button to turn it on");
    await click(p, '[data-snd]'); await sleep(200);
    ok((await dbg(p)).playing === null, "and nothing plays until it is turned on");
    await click(p, "#tbSndOn"); await sleep(120); await click(p, '[data-snd]'); await sleep(400);
    ok((await dbg(p)).playing !== null && (await p.evaluate(() => JSON.parse(localStorage.getItem("cognicopia_tablet_prefs")).sound)) === true, "turning it on works, and the choice is kept");
    await ctx.close();
  }
  {
    /* every sound is made on the tablet, loud enough to hear and never clipping */
    const { ctx, p } = await fresh(LAND);
    const r = await p.evaluate(async () => { const S = window.CognicopiaTabletSound, out = {}; for (const m of S.META) out[m.id] = await S.render(m.id, 22050); return out; });
    for (const [id, v] of Object.entries(r)) ok(v && !v.nan && v.peak > 0.12 && v.peak < 0.98 && v.rms > 0.015 && v.earlyRms > 0.01 && v.sounding > 1.5, `the ${id} sound is made on the tablet: peak ${v && v.peak.toFixed(2)}, loudness ${v && v.rms.toFixed(3)}, ${v && v.sounding.toFixed(1)} s`);
    await ctx.close();
  }

  /* ---------- coloring, painting, bubbles ---------- */
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "color");
    await p.waitForSelector(".tb-pics .tb-pic", { timeout: 8000 });
    ok(await p.evaluate(() => document.querySelectorAll(".tb-pic").length) === 8, "eight pictures to choose from");
    ok((await dbg(p)).all >= 20, `${(await dbg(p)).all} pictures in all, twenty or more`);
    const first = await p.evaluate(() => document.querySelector(".tb-pic").getAttribute("data-id"));
    await click(p, '[data-more="1"]'); await sleep(150);
    ok(await p.evaluate(f => document.querySelector(".tb-pic").getAttribute("data-id") !== f, first), "More pictures brings others");
    await click(p, ".tb-pic"); await p.waitForSelector(".tb-sheet canvas.tb-lines", { timeout: 8000 });
    const spots = () => p.evaluate(() => window.CognicopiaTabletUI.debug().spots());
    const pixel = (x, y) => p.evaluate(([a, b]) => window.CognicopiaTabletUI.debug().pixel(a, b), [x, y]);
    const d0 = await dbg(p); ok(d0.shapes >= 3, `the picture has ${d0.shapes} shapes to color`);
    ok(await p.evaluate(() => document.querySelectorAll("[data-bank]").length) === 4 && await p.evaluate(() => document.querySelectorAll(".tb-sw").length) === 8, "four sets of colors, eight colors in each");
    await click(p, '[data-bank="2"]');
    ok(await p.evaluate(() => document.querySelector('[data-bank="2"]').getAttribute("aria-pressed") === "true" && document.querySelector(".tb-sw").getAttribute("aria-label") === "Leaf" && JSON.parse(localStorage.getItem("cognicopia_tablet_prefs")).palette === 2), "choosing the Garden set changes the colors, and the choice is kept");
    await click(p, '.tb-sw[data-color="#4a9d5b"]');
    ok(await p.evaluate(() => document.querySelector('.tb-sw[data-color="#4a9d5b"]').getAttribute("aria-pressed") === "true" && document.querySelectorAll('.tb-sw[aria-pressed="true"]').length === 1), "the chosen color is marked");
    let sp = await spots(); await p.mouse.click(sp[0][0], sp[0][1]); await sleep(60);
    sp = await spots();
    ok((await dbg(p)).filled === 1 && (await pixel(sp[0][0], sp[0][1])).join() === "74,157,91,255", "tapping a shape fills it with the chosen color");
    ok((await Promise.all(sp.slice(1).map(s => pixel(s[0], s[1])))).every(v => v[3] === 0), "and the color stays inside its lines: no other shape changed");
    await click(p, '.tb-sw[data-color="#c27a4a"]'); await p.mouse.click(sp[1][0], sp[1][1]); await sleep(60);
    ok((await dbg(p)).filled === 2 && (await pixel(sp[1][0], sp[1][1])).join() === "194,122,74,255", "a second color on a second shape");
    await p.mouse.click(sp[1][0], sp[1][1]); await sleep(60);
    ok((await dbg(p)).filled === 2 && (await pixel(sp[1][0], sp[1][1])).join() === "194,122,74,255", "tapping the same shape again keeps it colored");
    await click(p, '[data-co="undo"]'); await sleep(60);
    ok((await dbg(p)).filled === 2, "Undo takes back the last tap");
    await click(p, '[data-co="undo"]'); await sleep(60);
    ok((await dbg(p)).filled === 1 && (await pixel(sp[1][0], sp[1][1]))[3] === 0, "and the one before it");
    await click(p, '[data-co="clear"]'); await sleep(60);
    ok((await dbg(p)).filled === 0 && (await pixel(sp[0][0], sp[0][1]))[3] === 0, "Start over clears every color");
    await click(p, '[data-co="undo"]'); await sleep(60);
    ok((await dbg(p)).filled === 1, "and Undo brings a color back after it");
    await click(p, "#tbAssist");
    await p.waitForSelector(".tb-cheer", { timeout: 15000 });
    ok((await dbg(p)).filled === (await dbg(p)).shapes, "Finish for me colors every shape that is left");
    await click(p, "[data-cheer=next]"); await sleep(300);
    await click(p, ".tb-pic"); await p.waitForSelector(".tb-sheet canvas.tb-lines", { timeout: 8000 });
    await click(p, '[data-co="pick"]'); await sleep(200);
    ok(await p.evaluate(() => document.querySelectorAll(".tb-pic").length) === 8, "Another picture returns to the choice");
    await ctx.close();
  }
  {
    /* every picture Color a Picture offers has shapes enough to color (and not too many), and the list of pictures left out is exactly the sparse ones */
    const { ctx, p } = await fresh(LAND);
    const m = await measureColor(p), offered = Object.keys(m).filter(id => m[id].cat !== "zentangle-mandalas" && !m[id].sensitive), skip = await p.evaluate(() => window.CognicopiaTabletBanks.COLOR_SKIP);
    const thin = colorSparse(m), few = offered.filter(id => !skip.includes(id) && Math.min(m[id].early, m[id].middle, m[id].late) < MIN_SHAPES), many = offered.filter(id => Math.max(m[id].early, m[id].middle, m[id].late) > MAX_SHAPES);
    ok(offered.length - skip.length >= 20 && !few.length && !many.length, `${offered.length - skip.length} pictures to offer, each with ${MIN_SHAPES} to ${MAX_SHAPES} shapes to color at every stage` + (few.length ? ` (too few: ${few.join(", ")})` : "") + (many.length ? ` (too many: ${many.join(", ")})` : ""));
    ok(JSON.stringify([...skip].sort()) === JSON.stringify(thin), "the pictures left out are exactly the sparse ones: " + JSON.stringify(thin));
    const eng = await p.evaluate(() => { const C = window.CognicopiaColoring, T = window.CognicopiaTablet; return C ? T.designChoices({ seed: "x" }, C.designs()) : null; });
    ok(!eng || skip.every(id => !eng.includes(id)), "and none of them is offered");
    await ctx.close();
  }
  {
    /* a tap on the middle of any shape, in any picture, colors that shape and no other (sixteen pictures, two pages of the choice) */
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "color"); await p.waitForSelector(".tb-pics .tb-pic", { timeout: 8000 });
    const bad = []; let shapes = 0;
    for (let pg = 0; pg < 2; pg++) {
      for (let i = 0; i < 8; i++) {
        await p.evaluate(k => document.querySelectorAll(".tb-pic")[k].click(), i); await p.waitForSelector(".tb-sheet canvas.tb-lines", { timeout: 8000 }); await sleep(120);
        const sp = await p.evaluate(() => window.CognicopiaTabletUI.debug().spots().map(x => [x[0], x[1]]));
        for (let k = 0; k < Math.min(4, sp.length - 1); k++) {      // never the last shape: a finished picture brings the cheer over the buttons
          const before = await p.evaluate(() => window.CognicopiaTabletUI.debug().spots().map(x => x[2]));
          await p.mouse.click(sp[k][0], sp[k][1]); await sleep(30);
          const after = await p.evaluate(() => window.CognicopiaTabletUI.debug().spots().map(x => x[2])), changed = after.map((c, j) => c !== before[j] ? j : -1).filter(j => j >= 0);
          shapes++; if (changed.length !== 1 || changed[0] !== k) bad.push(`picture ${pg * 8 + i + 1}, shape ${k + 1}: ${changed.join()}`);
        }
        await click(p, '[data-co="pick"]'); await sleep(80);
      }
      if (pg === 0) { await click(p, '[data-more="1"]'); await sleep(120); }
    }
    ok(shapes >= 30 && !bad.length, `a tap in the middle of ${shapes} shapes across sixteen pictures colors that shape and only that one` + (bad.length ? " (" + bad.slice(0, 3).join("; ") + ")" : ""));
    await ctx.close();
  }
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "paint");
    const box = await p.evaluate(() => { const r = document.querySelector(".tb-paint").getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
    const ink = (fx, fy) => p.evaluate(([x, y]) => window.CognicopiaTabletUI.debug().ink(x, y), [box[2] * fx, box[3] * fy]);
    const paper = (fx, fy) => p.evaluate(([x, y]) => window.CognicopiaTabletUI.debug().bgPixel(x, y), [box[2] * fx, box[3] * fy]);
    const near = (a, b, tol) => a.slice(0, 3).every((v, i) => Math.abs(v - b[i]) <= tol);
    const drag = async (x0, y0, x1, y1) => { await p.mouse.move(box[0] + box[2] * x0, box[1] + box[3] * y0); await p.mouse.down(); await p.mouse.move(box[0] + box[2] * x1, box[1] + box[3] * y1, { steps: 12 }); await p.mouse.up(); };
    const p0 = await paper(.5, .5); ok(p0[3] === 255 && !(p0[0] === 255 && p0[1] === 255 && p0[2] === 255), "the sheet starts as warm parchment, not a blank white screen");
    ok((await ink(.5, .5))[3] === 0, "and nothing is painted on it");
    await drag(.2, .5, .8, .5);
    let c = await ink(.5, .5); ok((await dbg(p)).strokes === 1 && c[3] > 235 && near(c, [244, 182, 194], 10), "a finger drawn across the sheet paints a soft line in the chosen color");
    await click(p, '[data-tab="colors"]'); await click(p, '[data-bank="1"]'); await click(p, '.tb-sw[data-color="#2f6fd0"]'); await click(p, '[data-tab="brush"]'); await click(p, '[data-size="3"]'); await click(p, '[data-brush="soft"]');
    await drag(.5, .15, .5, .85);
    c = await ink(.5, .3); ok((await dbg(p)).strokes === 2 && c[3] > 235 && near(c, [47, 111, 208], 10), "another color, and a wider brush");
    ok(await p.evaluate(() => document.querySelectorAll("[data-brush]").length) === 4 && await p.evaluate(() => document.querySelectorAll("[data-size]").length) === 4, "four brushes and four sizes");
    await click(p, '[data-brush="blend"]'); await click(p, '[data-size="1"]');
    const before = await ink(.58, .62); await drag(.4, .62, .75, .62); const after = await ink(.58, .62);
    ok((await dbg(p)).brush === "blend" && after[3] > before[3], "the blending brush smears paint into the space beside it");
    await click(p, '[data-tab="paper"]'); const w0 = await paper(.5, .9); await click(p, '[data-paper="1"]'); const w1 = await paper(.5, .9);
    ok(JSON.stringify(w0) !== JSON.stringify(w1) && (await dbg(p)).paper === 1 && await p.evaluate(() => JSON.parse(localStorage.getItem("cognicopia_tablet_prefs")).paper === 1), "a different paper (wood) can be chosen, and is kept");
    ok(await p.evaluate(() => document.querySelectorAll("[data-paper]").length) === 4 && (await ink(.5, .3))[3] > 235, "four papers; the painting stays on top of each");
    const n = (await dbg(p)).strokes;
    await click(p, '[data-act="undo"]'); ok((await dbg(p)).strokes === n - 1, "Undo takes the last stroke away");
    await click(p, '[data-act="clear"]'); ok((await ink(.5, .3))[3] === 0, "Clear makes the sheet bare");
    await click(p, '[data-act="undo"]'); ok((await ink(.5, .3))[3] > 235, "and Undo brings the painting back after a Clear");
    await ctx.close();
  }
  {
    const { ctx, p } = await fresh(LAND);
    await openAct(p, "bubbles");
    const centers = () => p.evaluate(() => window.CognicopiaTabletUI.debug().centers());
    let cs = await centers(); ok(cs.length >= 3 && cs.every(c => c[2] >= 80), `${cs.length} bubbles drift in the sky, each at least 80 px across`);
    const y0 = cs[0][1]; await sleep(700); const moved = (await centers()).some(c => Math.abs(c[1] - y0) > 4) ; ok(moved, "they drift upward on their own");
    const t = (await centers()).find(c => c[1] > 150 && c[1] < 600) || (await centers())[0];
    const popped0 = await p.evaluate(() => window.CognicopiaTabletUI.debug().popped());
    await p.touchscreen.tap(t[0], t[1]); await sleep(120);
    ok(await p.evaluate(() => window.CognicopiaTabletUI.debug().popped()) === popped0 + 1, "tapping a bubble pops it");
    ok(!(await p.evaluate(() => /\d/.test((document.querySelector("#tbProg") || {}).textContent || ""))), "no number is shown for bubbles");
    const s0 = (await dbg(p)).speed; await click(p, '[data-speed="1"]');
    ok((await dbg(p)).speed === s0 + 1 && /Float:/.test(await text(p, "#tbSpeedLbl")), "Faster and Slower change how quickly they float, and say so in words");
    await click(p, "#tbAssist"); await p.waitForSelector(".tb-cheer", { timeout: 15000 });
    ok(await p.evaluate(() => window.CognicopiaTabletUI.debug().count()) === 0, "Finish for me lets every bubble go");
    await ctx.close();
    const r = await fresh(LAND, { reduced: true }); await openAct(r.p, "bubbles");
    const a1 = await r.p.evaluate(() => window.CognicopiaTabletUI.debug().centers().map(c => c[1])); await sleep(700);
    const a2 = await r.p.evaluate(() => window.CognicopiaTabletUI.debug().centers().map(c => c[1]));
    ok(a1.length >= 3 && JSON.stringify(a1) === JSON.stringify(a2), "for people who ask for less motion, the bubbles stay still");
    await r.ctx.close();
  }

  /* ---------- the shell: leaving, new ones, focus ---------- */
  {
    const { ctx, p } = await fresh(LAND);
    await p.focus('[data-act="sort"]'); await p.keyboard.press("Enter"); await stageReady(p);
    ok(await p.evaluate(() => document.getElementById("tbTitle").textContent === "Sort It" && document.activeElement.id === "tbBack"), "opening an activity from the keyboard focuses the Home button");
    ok(await p.evaluate(() => Array.from(document.body.children).filter(n => n.id !== "tb" && n.id !== "tbGate" && n.tagName !== "SCRIPT").every(n => n.inert)), "everything behind the activity is out of reach");
    await p.keyboard.press("Escape"); await p.waitForSelector("#tb", { state: "hidden" });
    ok(await p.evaluate(() => document.activeElement.getAttribute("data-act") === "sort"), "Escape returns to the menu with focus back on the card");
    ok(await p.evaluate(() => !document.documentElement.classList.contains("tb-open") && Array.from(document.body.children).every(n => !n.inert)), "and the menu is usable again");
    await openAct(p, "saying"); await toMenu(p);
    ok(await p.evaluate(() => document.activeElement.getAttribute("data-act") === "saying"), "the Home button returns to the menu too");
    await ctx.close();
  }

  /* ---------- the same frame on every activity: Finish for me, Next, Home and a hint after a quiet moment ---------- */
  const redish = p => p.evaluate(() => {
    const out = [], rx = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/g, red = (r, g, b, a) => r > 170 && g < 100 && b < 100 && (a == null || a > 0.3);
    document.querySelectorAll("#tb *").forEach(e => {
      const st = getComputedStyle(e), r0 = e.getBoundingClientRect(); if (!r0.width || st.display === "none") return;
      if (e.closest(".tb-pal, .tb-art, .tb-pics, .tb-ico")) return;                         // colors to paint with, and the pictures themselves, are content, not signals
      for (const prop of ["color", "backgroundColor", "borderTopColor", "borderBottomColor", "borderLeftColor", "borderRightColor", "outlineColor", "boxShadow", "fill", "stroke"]) {
        const v = st[prop] || ""; let m; rx.lastIndex = 0;
        while ((m = rx.exec(v))) if (red(+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4])) out.push((e.className && e.className.baseVal === undefined ? e.className : e.tagName) + " " + prop + " " + m[0]);
      }
    });
    return out;
  });
  {
    const { ctx, p } = await fresh(LAND);
    ok(await p.evaluate(() => window.CognicopiaTabletUI.idleMs()) === 15000, "a quiet moment is fifteen seconds");
    await p.evaluate(() => window.CognicopiaTabletUI.idleMs(900));
    const sig = id => p.evaluate(x => { const d = window.CognicopiaTabletUI.debug(); if (x === "trace") return d.path.d + d.scene; if (x === "paint") return String(d.strokes); if (x === "bubbles") return String(d.seed); return document.getElementById("tbStage").innerHTML.replace(/style="[^"]*"/g, ""); }, id);
    for (const id of ALL) {
      await openAct(p, id); if (id === "color") await p.waitForSelector(".tb-pics .tb-pic", { timeout: 8000 });
      const st = await p.evaluate(() => window.CognicopiaTabletUI.stats());
      ok(st && st.assist && st.hint && await p.evaluate(() => !document.getElementById("tbAssist").hidden && !document.getElementById("tbNew").hidden && !document.getElementById("tbBack").hidden), `${id}: Home, Finish for me and Next are on the screen, and it can give a hint`);
      ok(!(await redish(p)).length, `${id}: nothing on the screen is red: ${(await redish(p)).slice(0, 2).join("; ")}`);
      /* a quiet moment: the right place glows */
      await sleep(1600);
      const h1 = await p.evaluate(() => ({ s: window.CognicopiaTabletUI.stats(), glow: document.querySelectorAll("#tbStage .tb-glow").length }));
      const drawn = await p.evaluate(x => { const d = window.CognicopiaTabletUI.debug() || {}; return x === "paint" ? !!d.demo || document.querySelectorAll(".tb-glow").length > 0 : x === "bubbles" ? !!(d.hintOn && d.hintOn()) : false; }, id);
      ok(h1.s.hints >= 1 && (h1.glow >= 1 || id === "trace" || drawn), `${id}: after a quiet moment a hint appears (${h1.s.hints} given, ${h1.glow} places glowing${drawn ? ", shown on the canvas" : ""})`);
      /* Next: a fresh one at once, and not the same as before */
      if (id === "paint") { const b = await p.evaluate(() => { const r = document.querySelector(".tb-paint").getBoundingClientRect(); return [r.left + r.width * .3, r.top + r.height * .5, r.left + r.width * .7]; }); await p.mouse.move(b[0], b[1]); await p.mouse.down(); await p.mouse.move(b[2], b[1], { steps: 6 }); await p.mouse.up(); ok((await sig(id)) === "1", "paint: a stroke is on the canvas before Next"); }
      const before = await sig(id);
      await click(p, "#tbNew"); await sleep(450); if (id === "color") await p.waitForSelector(".tb-pics .tb-pic", { timeout: 8000 });
      const after = await sig(id);
      ok(id === "paint" ? after === "0" : after !== before, `${id}: Next brings a fresh one at once${id === "paint" ? " (a clean sheet)" : ""}`);
      ok(await p.evaluate(() => !window.CognicopiaTabletUI.stats().done) && !(await p.evaluate(() => document.querySelector(".tb-cheer"))), `${id}: and starts it unfinished, with nothing carried over`);
      /* Finish for me: the activity completes with the celebration */
      await click(p, "#tbAssist");
      const t0 = Date.now(); let done = false;
      try { await p.waitForSelector(".tb-cheer", { timeout: 15000 }); done = true; } catch (e) { done = false; }
      ok(done && await p.evaluate(() => window.CognicopiaTabletUI.stats().done), `${id}: Finish for me completes it with the celebration (in ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      ok(await p.evaluate(() => document.getElementById("tbAssist").disabled) && /\w/.test(await text(p, ".tb-cheer p")) && !(await redish(p)).length, `${id}: the celebration is warm, with no red, and Finish for me waits`);
      /* Another one starts a new activity; Home goes back to the menu */
      await click(p, "[data-cheer=next]"); await sleep(400);
      ok(await p.evaluate(() => !document.querySelector(".tb-cheer") && window.CognicopiaTabletUI.stats() && !window.CognicopiaTabletUI.stats().done), `${id}: "Another one" starts a fresh activity`);
      await toMenu(p);
    }
    await ctx.close();
  }
  {
    /* any touch means someone is here: the hint waits another quiet moment */
    const { ctx, p } = await fresh(LAND);
    await p.evaluate(() => window.CognicopiaTabletUI.idleMs(1400));
    await openAct(p, "sort");
    await sleep(900); await click(p, "#tbTitle");
    await sleep(900);
    ok((await p.evaluate(() => window.CognicopiaTabletUI.stats().hints)) === 0, "a touch sends the hint's clock back to the start");
    await sleep(1300);
    ok((await p.evaluate(() => window.CognicopiaTabletUI.stats().hints)) >= 1, "and the hint comes after the next quiet moment");
    await ctx.close();
  }
  {
    /* Surprise me: the tablet chooses, and not the same one twice in a row */
    const { ctx, p } = await fresh(LAND);
    const got = [];
    for (let k = 0; k < 4; k++) { await p.click("#tbSurprise"); await stageReady(p); got.push(await p.evaluate(() => window.CognicopiaTabletUI.current())); await toMenu(p); }
    ok(got.every(g => ALL.includes(g)) && got.every((g, i) => i === 0 || g !== got[i - 1]), "Surprise me opens an activity each time, never the same one twice running: " + got.join(", "));
    ok(await p.evaluate(() => document.activeElement.id === "tbSurprise"), "and Home returns to it");
    await ctx.close();
  }

  /* ---------- every control is big enough, nothing runs off the screen ---------- */
  for (const [name, vp, tablet, noScroll] of [["landscape tablet", LAND, true, true], ["portrait tablet", PORT, true, true], ["phone", PHONE, false, false]]) {
    const { ctx, p } = await fresh(vp);
    const menu = await p.evaluate(() => ({ over: document.scrollingElement.scrollWidth - innerWidth, cards: Array.from(document.querySelectorAll(".tbp-card, .tbp-seg label, .tbp-sel, #tbSound, #tbFull, #tbSurprise")).filter(e => { const r = e.getBoundingClientRect(); return r.width < 52 || r.height < 52; }).length }));
    ok(menu.over <= 1 && menu.cards === 0, `${name}: the menu fits the width and every control is 52 px or more`);
    for (const id of ALL) {
      await p.click(`[data-act="${id}"]`); await stageReady(p); if (id === "color") await p.waitForSelector(".tb-pics", { timeout: 8000 }).catch(() => {});
      await p.waitForTimeout(250);
      if (id === "color") { await click(p, ".tb-pic"); await p.waitForSelector(".tb-sheet canvas.tb-lines", { timeout: 8000 }); await sleep(150); }
      const floor = tablet && BIG.has(id) ? 72 : 52, sm = await small(p, floor), fit = await p.evaluate(() => { const s = document.getElementById("tbStage"); return { x: s.scrollWidth - s.clientWidth, y: s.scrollHeight - s.clientHeight }; });
      const bar = await p.evaluate(() => Array.from(document.querySelectorAll("#tb .tb-bar button")).filter(e => e.getBoundingClientRect().width > 0).map(e => { const r = e.getBoundingClientRect(); return { id: e.id, w: Math.round(r.width), h: Math.round(r.height) }; }));
      const barFloor = tablet ? 72 : 56;
      ok(bar.length >= 3 && bar.every(b => b.w >= barFloor && b.h >= barFloor), `${name}, ${id}: Home, Finish for me and Next are ${barFloor} px or more${bar.filter(b => b.w < barFloor || b.h < barFloor).length ? " (" + bar.map(b => b.id + " " + b.w + "x" + b.h).join(", ") + ")" : ""}`);
      ok(sm.length === 0, `${name}, ${id}: every control is ${floor} px or more${sm.length ? " (" + sm.slice(0, 3).join(", ") + ")" : ""}`);
      ok(fit.x <= 1, `${name}, ${id}: nothing runs off the side`);
      if (noScroll) ok(fit.y <= 1, `${name}, ${id}: it fits the screen with no scrolling (${fit.y} px over)`);
      await toMenu(p);
    }
    await ctx.close();
  }

  /* ---------- text can be read, by day and in Night Shift ---------- */
  for (const night of [false, true]) {
    const { ctx, p } = await fresh(LAND);
    if (night) await p.evaluate(() => document.documentElement.classList.add("cg-night-shift"));
    for (const id of ALL) {
      await p.click(`[data-act="${id}"]`); await stageReady(p);
      if (id === "color") { await p.waitForSelector(".tb-pics", { timeout: 8000 }).catch(() => {}); await click(p, ".tb-pic"); await p.waitForSelector(".tb-sheet canvas.tb-lines", { timeout: 8000 }); }
      await sleep(250);
      const lo = await lowContrast(p, 7);
      ok(lo.length === 0, `${night ? "Night Shift" : "day"}, ${id}: all text reaches 7:1 (${lo.slice(0, 3).join("; ")})`);
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
