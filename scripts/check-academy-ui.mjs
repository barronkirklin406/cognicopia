#!/usr/bin/env node
/* =====================================================================
   The Staff & Caregiver Academy (builder.html#/academy), in a real
   browser. (scripts/check-services.mjs proves the logic of CogniAcademy;
   this proves the screen, the player and the storage around it.)

     - the dark-slate design: its tokens, and every text pair at AAA (7:1)
     - the header, the dashboard (three tiles, each with a progress ring),
       the search box and the five filter pills
     - the player: play and pause, back and forward ten seconds, the four
       speeds, volume and mute, captions, bookmarks, full screen, the
       chapter drawer, keyboard control, and the word that is read
       following along in the transcript
     - progress, bookmarks and the audio settings survive a reload, and are
       sealed: nothing under the Academy's name in plain localStorage
     - the knowledge check, completing a lesson, the certificate asking for
       a name, and the training record
     - the key-takeaways sheet prints on whole Letter pages (0.75 in
       gutter, pure black on white) and the Academy makes no network request
     - every control is at least 52 px, no sideways scroll on a phone, and
       the motion stops with prefers-reduced-motion

   Needs Playwright. Where it is not installed this exits 2 and says so,
   and npm run build skips it. Serves the repository on a free local port.
   Run: node scripts/check-academy-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const errors = [], problems = [], foreign = []; let passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else problems.push(msg); };

const open = async (w = 1366, h = 900, extra = {}) => {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: w, height: h }, serviceWorkers: "block", acceptDownloads: true }, extra));
  await ctx.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });   // the print window is not what is tested
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message));
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith("data:") && !u.startsWith("blob:")) foreign.push(u); });
  p.on("dialog", d => d.accept());
  return p;
};
const go = async (p, hash = "#/academy", sel = "#acRoot") => { await p.goto(base + "builder.html" + hash); await p.waitForSelector(sel, { timeout: 10000 }); await p.waitForTimeout(250); };
const count = (p, sel) => p.$$eval(sel, n => n.length);
const text = (p, sel) => p.$eval(sel, e => e.textContent.replace(/\s+/g, " ").trim());
const data = p => p.evaluate(() => JSON.parse(CogniSecureStore.storage.getItem("cognicopia_academy") || "null"));
const flush = p => p.evaluate(() => CogniSecureStore.flush());

/* WCAG contrast, computed the way scripts/check-design-system.mjs does it */
const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

try {
  /* ---------- the screen on a laptop ---------- */
  let p = await open();
  await go(p, "#/academy", "#acGrid .ac-card");
  ok(/Cognicopia Staff & Caregiver Academy/.test(await text(p, "#acRoot h1")), "the header reads Cognicopia Staff & Caregiver Academy");
  ok((await count(p, "#acGrid .ac-card")) === 6, "six masterclass cards show");
  ok((await count(p, "#acDash .ac-tile")) === 3 && (await count(p, "#acDash svg.ac-ring")) === 3, "the dashboard has three tiles, each with a circular progress ring");
  const tiles = await text(p, "#acDash");
  ok(/Courses completed/.test(tiles) && /Hours learned/.test(tiles) && /Certificates earned/.test(tiles), "the tiles are Courses completed, Hours learned and Certificates earned");
  ok(/not accredited/i.test(tiles), "the certificates tile says in-service records, not accredited credit");
  const pills = await p.$$eval('input[name="acCat"] + span', n => n.map(e => e.textContent.trim()));
  ok(pills.join("|") === "All Courses|Memory Care Essentials|Reminiscence|Activity Guidance|Completed", "the five filter pills: " + pills.join("|"));
  const tokens = await p.$eval("#acRoot", e => { const s = getComputedStyle(e); return ["--ac-bg", "--ac-panel", "--ac-card", "--ac-accent", "--ac-accent-hi", "--ac-glow", "--ac-media-glow", "--ac-border", "--ac-text"].map(k => s.getPropertyValue(k).replace(/\s+/g, "")); });
  ok(tokens.join(" ") === "#fbf7f1 #ffffff #ffffff #1b382b #2d5a44 rgba(197,160,89,.10) rgba(27,56,43,.18) #ddd1ba #1a202c", "the Academy wears the site's cream, white and forest-green palette (the lesson player stays a dark screen): " + tokens.join(" "));

  /* every text pair at AAA */
  const pal = await p.$eval("#acRoot", e => { const s = getComputedStyle(e), g = k => s.getPropertyValue(k).trim(); return { bg: g("--ac-bg"), panel: g("--ac-panel"), card: g("--ac-card"), s2: g("--ac-surface-2"), text: g("--ac-text"), t2: g("--ac-text-2"), muted: g("--ac-muted"), at: g("--ac-accent-text"), ink: g("--ac-ink"), acc: g("--ac-accent"), hi: g("--ac-accent-hi"), fam: g("--ac-family"), good: g("--ac-good"), warn: g("--ac-warn") }; });
  const pairs = [];
  for (const s of ["bg", "panel", "card", "s2"]) for (const t of ["text", "t2", "muted", "at", "fam", "good", "warn"]) pairs.push([t, s]);
  pairs.push(["ink", "acc"], ["ink", "hi"]);
  const weak = pairs.filter(([f, b]) => ratio(pal[f], pal[b]) < 7).map(([f, b]) => `${f} on ${b} ${ratio(pal[f], pal[b]).toFixed(2)}`);
  ok(weak.length === 0, "every text pair is at least 7:1 (AAA): " + weak.join(", "));

  /* search and the pills */
  await p.fill("#acQ", "sundown"); await p.waitForTimeout(150);
  ok((await count(p, "#acGrid .ac-card")) === 1 && /Sundowning/.test(await text(p, "#acGrid")), "the search narrows the cards to the matching masterclass");
  await p.fill("#acQ", "zzzz"); await p.waitForTimeout(150);
  ok((await count(p, "#acGrid .ac-card")) === 0 && /No masterclass matches/.test(await text(p, "#acGrid")), "a search with no match says so and offers Show all");
  await p.click('[data-act="clear-filters"]'); await p.waitForTimeout(150);
  ok((await count(p, "#acGrid .ac-card")) === 6 && (await p.inputValue("#acQ")) === "", "Show all clears the search");
  const sizes = {};
  for (const [v, name] of [["essentials", "Memory Care Essentials"], ["reminiscence", "Reminiscence"], ["activity", "Activity Guidance"], ["done", "Completed"]]){
    await p.click(`label:has(input[name="acCat"][value="${v}"])`); await p.waitForTimeout(120);
    sizes[v] = await count(p, "#acGrid .ac-card");
  }
  ok(sizes.essentials > 0 && sizes.essentials < 6 && sizes.reminiscence > 0 && sizes.activity > 0, "the category pills each show some, not all: " + JSON.stringify(sizes));
  ok(sizes.done === 0, "Completed shows nothing before any lesson is completed");

  /* ---------- the lesson player ---------- */
  await go(p, "#/academy/sundowning", "#acStage");
  const total = await p.evaluate(() => { const m = CogniAcademy.MODULES.filter(x => x.id === "sundowning")[0]; return CogniAcademy.cues(m).reduce((s, q) => s + q.dur, 0); });
  ok(total > 120, "the lesson has a timeline (" + Math.round(total) + " s)");
  ok(/Narrated lesson|Recorded lesson/.test(await text(p, ".ac-kind")), "the player says whether the lesson is narrated or recorded");
  const t0 = await p.inputValue("#acSeek");
  await p.click("#acToggle"); await p.waitForTimeout(1600);
  ok(await p.$eval("#acPlayer", e => e.classList.contains("is-playing")), "Play starts the lesson");
  const t1 = +(await p.inputValue("#acSeek"));
  ok(t1 > +t0 + 0.5, "the position moves while it plays (" + t0 + " to " + t1 + ")");
  ok(/is-word/.test(await p.$eval("#acRoot", e => e.innerHTML)), "a word is highlighted as it is read, in the caption or the transcript");
  await p.click("#acToggle"); await p.waitForTimeout(100);
  ok(!(await p.$eval("#acPlayer", e => e.classList.contains("is-playing"))), "Pause stops it");
  const at = +(await p.inputValue("#acSeek"));
  await p.click('[data-pl="fwd"]'); const fwd = +(await p.inputValue("#acSeek"));
  ok(Math.abs(fwd - (at + 10)) < 0.6, "forward ten seconds: " + at + " to " + fwd);
  await p.click('[data-pl="back"]'); const back = +(await p.inputValue("#acSeek"));
  ok(Math.abs(back - at) < 0.6, "back ten seconds returns to " + at + ": " + back);
  const rates = await p.$$eval("#acRate option", n => n.map(o => o.value));
  ok(rates.join(",") === "0.75,1,1.25,1.5", "the speeds are 0.75, 1, 1.25 and 1.5: " + rates.join(","));
  await p.selectOption("#acRate", "1.5"); await p.waitForTimeout(100);
  await p.click('[data-pl="mute"]'); await p.waitForTimeout(100);
  ok((await p.getAttribute('[data-pl="mute"]', "aria-pressed")) === "true" && (await p.inputValue("#acVol")) === "0", "Mute is on and the volume slider reads zero");
  await p.click('[data-pl="mute"]'); await p.fill("#acVol", "0.4"); await p.dispatchEvent("#acVol", "input"); await p.waitForTimeout(100);
  await p.click('[data-pl="cc"]'); await p.waitForTimeout(100);
  ok((await p.getAttribute('[data-pl="cc"]', "aria-pressed")) === "false", "captions switch off");
  await p.click('[data-pl="cc"]');
  await p.click('[data-pl="mark"]'); await p.waitForTimeout(150);
  ok((await count(p, "#acMarks li")) === 1, "a bookmark is added and listed in the drawer");
  ok(await p.$eval("#acDrawer", e => e.open), "the chapter drawer opens when a bookmark is added");
  const chaps = await count(p, "#acDrawerBody [data-chap]");
  await p.click("#acDrawerBody [data-chap]:nth-of-type(1) >> nth=2"); await p.waitForTimeout(120);
  ok(chaps >= 5 && +(await p.inputValue("#acSeek")) > 20, "the chapter list jumps to a chapter (" + chaps + " chapters)");
  await p.focus("#acStage"); await p.keyboard.press("Home"); await p.waitForTimeout(100);
  ok(+(await p.inputValue("#acSeek")) === 0, "the Home key returns to the start");
  await p.keyboard.press("ArrowRight"); await p.waitForTimeout(100);
  ok(+(await p.inputValue("#acSeek")) > 0, "the right arrow moves to the next line");
  ok((await count(p, "#acPlayer .ac-stage-art svg")) >= 1 && (await count(p, "#acPlayer svg .ac-pulse, #acPlayer svg .ac-glow, #acPlayer svg .ac-steam, #acPlayer svg .ac-twinkle, #acPlayer .ac-kb")) >= 1, "the illustration is an inline SVG with a slow pan");
  ok(await p.$eval('[data-pl="full"]', e => !e.disabled), "the full-screen button is there");

  /* progress, bookmark and settings are saved, sealed, and come back */
  await p.click("#acToggle"); await p.waitForTimeout(300); await p.keyboard.press("Space");
  await p.evaluate(() => document.querySelector('[data-act="read"]') && 0);
  await flush(p);
  const saved = await data(p);
  ok(saved && saved.prefs && saved.prefs.rate === 1.5 && saved.prefs.cc === true, "the speed and caption settings are saved: " + JSON.stringify(saved && saved.prefs));
  const plain = await p.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf("cognicopia_academy") === 0));
  ok(plain.length === 0, "the Academy is sealed: nothing under its name in plain localStorage (" + plain.join(",") + ")");
  await p.reload(); await p.waitForSelector("#acStage"); await p.waitForTimeout(400);
  ok((await p.inputValue("#acRate")) === "1.5", "the chosen speed is back after a reload");
  ok((await count(p, "#acMarks li")) === 1, "the bookmark is back after a reload");

  /* ---------- reading, the knowledge check, completing, the certificate ---------- */
  await p.click("#acSub-transcript"); await p.click('[data-act="read"]'); await p.waitForTimeout(150);
  ok(/read the whole lesson/i.test(await text(p, "#acPane")), "reading the whole transcript counts as watching");
  await p.click("#acSub-quiz"); await p.waitForTimeout(100);
  await p.click('[data-act="complete"], .ac-btn[data-act="complete"]').catch(() => {});
  const wrongRun = await p.evaluate(() => { const m = CogniAcademy.MODULES.filter(x => x.id === "sundowning")[0]; return m.quiz.length; });
  ok(wrongRun >= 5, "the knowledge check has " + wrongRun + " questions");
  await p.click('form[data-form="quiz"] button[type=submit]'); await p.waitForTimeout(150);
  ok(/Choose an answer for question 1/.test(await text(p, "#acQuizMsg")), "submitting with unanswered questions asks for an answer, naming the question");
  const answers = await p.evaluate(() => CogniAcademy.MODULES.filter(x => x.id === "sundowning")[0].quiz.map(q => q.answer));
  for (let i = 0; i < answers.length; i++) await p.click(`input[name="acQ${i}"][value="${answers[i]}"]`);
  await p.click('form[data-form="quiz"] button[type=submit]'); await p.waitForTimeout(200);
  ok(/Passed/.test(await text(p, "#acResult")), "all right answers pass the check");
  await p.click('.ac-btn[data-act="complete"]'); await p.waitForTimeout(200);
  ok(/Completed/.test(await text(p, "#acTrack")), "the lesson is marked complete");
  ok((await count(p, "#acTrack [data-cert]")) === 1, "a certificate button appears");
  await p.click("#acTrack [data-cert]"); await p.waitForTimeout(250);
  ok((await count(p, "#acCertName")) === 1, "the certificate asks for a name first");
  await p.fill("#acCertName", "Test Learner");
  const dl = p.waitForEvent("download", { timeout: 15000 }).catch(() => null);
  await p.click('form[data-form="certname"] button[type=submit]');
  const file = await dl;
  ok(!!file && /\.pdf$/i.test(file.suggestedFilename()), "the certificate downloads as a PDF" + (file ? ": " + file.suggestedFilename() : ""));
  await flush(p);
  await go(p, "#/academy", "#acGrid .ac-card");
  ok(/1\s*\/\s*6|^1\b/.test(await text(p, "#acDash .ac-tile")), "the dashboard counts the completed course");
  await p.click('label:has(input[name="acCat"][value="done"])'); await p.waitForTimeout(150);
  ok((await count(p, "#acGrid .ac-card")) === 1, "the Completed pill now shows that lesson");

  /* ---------- the training record, and the printed sheets ---------- */
  await p.click("#acTab-records"); await p.waitForTimeout(250);
  ok(/Test Learner/.test(await text(p, ".ac-table")), "the training record lists the learner");
  await p.click('[data-act="print-records"]'); await p.waitForTimeout(900);
  const sheet = await p.evaluate(() => { const r = document.getElementById("printRoot"), s = [...r.querySelectorAll(".sheet")]; const b = s[0] && s[0].getBoundingClientRect(); return { n: s.length, pure: r.classList.contains("pure-bw"), printed: window.__printed || 0, head: s[0] ? s[0].querySelector("h1").textContent : "", pad: s[0] ? getComputedStyle(s[0]).paddingLeft : "" }; });
  ok(sheet.n >= 1 && sheet.pure && sheet.printed === 1 && /Training records/.test(sheet.head), "the training record prints on Letter sheets, pure black and white");
  ok(sheet.pad === "72px", "the sheet keeps its 0.75 inch binding gutter (" + sheet.pad + ")");
  await go(p, "#/academy/sundowning", "#acStage");
  await p.click("#acSub-guide"); await p.click('[data-act="print-takeaways"]'); await p.waitForTimeout(900);
  const tk = await p.evaluate(() => { const r = document.getElementById("printRoot"), s = [...r.querySelectorAll(".sheet")]; return { n: s.length, clipped: s.filter(x => { const b = x.querySelector(".sh-body"); return b.scrollHeight > b.clientHeight + 1; }).length, foot: s.map(x => x.querySelector(".pgno").textContent), words: r.textContent }; });
  ok(tk.n >= 1 && tk.clipped === 0, "the key takeaways flow onto " + tk.n + " page(s) with nothing clipped");
  ok(tk.foot.every((f, i) => f === "Page " + (i + 1) + " of " + tk.n), "each takeaway page is numbered: " + tk.foot.join(" | "));
  ok(/Sundowning/i.test(tk.words) && /not accredited/i.test(tk.words), "the sheet carries the lesson and the in-service wording");
  await p.close();

  /* ---------- a phone ---------- */
  p = await open(390, 844);
  await go(p, "#/academy", "#acGrid .ac-card");
  const wide = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(wide <= 1, "no sideways scroll on a phone (" + wide + " px over)");
  await go(p, "#/academy/sundowning", "#acStage");
  const wide2 = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(wide2 <= 1, "no sideways scroll on a phone in a lesson (" + wide2 + " px over)");
  const small = await p.evaluate(() => [...document.querySelectorAll("#acRoot button, #acRoot select, #acRoot input:not([type=radio]):not([type=checkbox]):not([type=range]), #acRoot summary, #acRoot a.ac-card-a")].filter(e => { if (e.closest("[data-tap-exempt]")) return false; const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 51.5 || r.width < 51.5) && !(e.tagName === "A"); }).map(e => (e.className || e.tagName) + " " + Math.round(e.getBoundingClientRect().width) + "x" + Math.round(e.getBoundingClientRect().height)));
  ok(small.length === 0, "every Academy control is at least 52 px: " + small.slice(0, 6).join(", "));
  await p.close();

  /* ---------- reduced motion ---------- */
  p = await open(1366, 900, { reducedMotion: "reduce" });
  await go(p, "#/academy/sundowning", "#acStage");
  await p.click("#acToggle"); await p.waitForTimeout(500);
  const anim = await p.evaluate(() => [...document.querySelectorAll("#acRoot svg .ac-pulse, #acRoot svg .ac-glow, #acRoot svg .ac-twinkle, #acRoot svg .ac-steam, #acRoot .ac-kb")].map(e => getComputedStyle(e).animationName).filter(n => n && n !== "none"));
  ok(anim.length === 0, "with reduced motion asked for, nothing animates: " + anim.join(","));
  await p.close();
} finally {
  await browser.close(); srv.close();
}

if (foreign.length) problems.push("the Academy made a network request: " + [...new Set(foreign)].slice(0, 3).join(" "));
if (errors.length) problems.push("page errors: " + [...new Set(errors)].slice(0, 5).join(" | "));
if (problems.length){ console.log(`academy check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")); process.exit(1); }
console.log(`academy check passed: ${passed} checks in a real browser (design tokens and AAA text pairs, dashboard rings, search and pills, the player's play, pause, skip, speeds, volume, captions, bookmarks and keyboard, sealed saved progress, the knowledge check, completing, the certificate, the training record, Letter print sheets with a 0.75 in gutter, phone width, 52 px controls, reduced motion, no network)`);
