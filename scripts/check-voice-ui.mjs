#!/usr/bin/env node
/* =====================================================================
   Voice settings, in a real browser, with a stand-in for the device's
   speech (this machine has no real voices, so what is proved is the choice,
   the order, the pace, the pauses and the panel, not how a voice sounds):

     - Tablet Activities: the Voice button opens a panel with three paces, the
       voices of the device (a voice that streams from a server is not
       listed), a Preview for each and a test sentence; Read to Me speaks with
       the chosen voice at 0.90 and pitch 1
     - Tablet Interactive Mode (packet tool): the same panel
     - the Academy: the panel, the pace in its own steps, the High-Fidelity
       switch, and a lesson read with the chosen voice at 0.90 x the pace
     - every control in the panel is at least 52 px; Escape closes it and
       gives the focus back; nothing is requested from outside the page

   Needs Playwright. Where it is not installed this exits 2 and npm run build
   skips it. Run: node scripts/check-voice-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const errors = [], problems = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

/* a stand-in for the device's speech */
const STUB = () => {
  const V = (name, lang, local) => ({ name, lang, localService: local, voiceURI: name, default: false });
  const voices = [V("Microsoft David Desktop - English (United States)", "en-US", true), V("Samantha", "en-US", true), V("Ava (Premium)", "en-US", true), V("Google US English", "en-US", false), V("Zarvox", "en-US", true)];
  window.__said = [];
  const synth = { getVoices: () => voices, cancel() {}, addEventListener() {}, speak(u) { window.__said.push({ text: u.text, voice: u.voice && u.voice.name, rate: u.rate, pitch: u.pitch }); setTimeout(() => u.onend && u.onend(), 5); } };
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  window.print = () => {};
};
const open = async (w = 1366, h = 900) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block" });
  await ctx.addInitScript(STUB);
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message));
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith("data:") && !u.startsWith("blob:")) foreign.push(u); });
  return p;
};
const said = p => p.evaluate(() => window.__said.slice());
const panelChecks = async (p, where) => {
  ok(await p.$("#cgVoicePanel .cgv") !== null, `${where}: the Voice settings panel opens`);
  const rows = await p.$$eval(".cgv-list li .cgv-name", e => e.map(x => x.firstChild.textContent));
  ok(rows[0] === "Ava (Premium)" && rows.includes("Samantha") && !rows.includes("Google US English") && !rows.includes("Zarvox"), `${where}: the device's voices, most natural first, with no server voice and no novelty voice (${rows.join(" | ")})`);
  {
    const paces = await p.$$eval(".cgv-pace button", e => e.map(x => x.textContent));
    ok(paces.join() === "Slow,Natural,Normal", `${where}: three paces (${paces.join()})`);
  }
  const small = await p.$$eval(".cgv button, .cgv input", e => e.filter(x => { const r = x.getBoundingClientRect(); return r.height < 51.5 || (x.tagName === "BUTTON" && r.width < 51.5); }).length);
  ok(small === 0, `${where}: every button in the panel is at least 52 px`);
};

/* ---------- Tablet Activities ---------- */
{
  const p = await open();
  await p.goto(base + "tablet.html"); await p.waitForSelector(".tbp-card");
  const ids = await p.$$eval(".tbp-card", e => e.map(x => x.getAttribute("data-act")));
  let found = false;
  for (const id of ids) {
    await p.click(`.tbp-card[data-act="${id}"]`); await p.waitForTimeout(350);
    if (await p.$eval("#tbVoice", e => !e.hidden).catch(() => false)) { found = true; break; }
    await p.click("#tbBack").catch(() => {}); await p.waitForTimeout(200);
  }
  ok(found, "Tablet Activities: an activity that can be read aloud shows the Voice button");
  if (found) {
    await p.click("#tbSay"); await p.waitForTimeout(150);
    let s = await said(p);
    ok(s.length >= 1 && s.every(x => x.voice === "Ava (Premium)" && x.rate === 0.90 && x.pitch === 1), `Read to Me uses the most natural voice at 0.90, pitch 1 (${JSON.stringify(s.slice(0, 1))})`);
    await p.click("#tbVoice"); await p.waitForSelector("#cgVoicePanel");
    await panelChecks(p, "Tablet Activities");
    await p.evaluate(() => { window.__said.length = 0; });
    await p.click(".cgv-pace button:has-text('Slow')"); await p.waitForTimeout(150);
    s = await said(p);
    ok(s.length && s[0].text === "Welcome to today’s activity." && s[0].rate === 0.78, `one tap on Slow sets the pace and speaks the sample at 0.78 (${JSON.stringify(s[0])})`);
    ok(await p.$eval(".cgv-pace button[aria-pressed=true]", e => e.textContent) === "Slow", "the chosen pace is shown as pressed");
    await p.evaluate(() => { window.__said.length = 0; });
    await p.click(".cgv-list li:nth-child(2) button:has-text('Use')"); await p.waitForTimeout(150);
    s = await said(p);
    ok(s.length && s[0].voice === "Samantha", "choosing a voice speaks the sample with it");
    await p.evaluate(() => { window.__said.length = 0; });
    await p.click(".cgv-test"); await p.waitForTimeout(150);
    s = await said(p);
    ok(s.length && s[0].text === "Welcome to today’s activity." && s[0].voice === "Samantha", "the test button speaks the sample sentence in the chosen voice");
    await p.keyboard.press("Escape"); await p.waitForTimeout(100);
    ok(await p.$("#cgVoicePanel") === null && await p.evaluate(() => document.activeElement && document.activeElement.id) === "tbVoice", "Escape closes the panel and returns the focus to the Voice button");
    await p.reload(); await p.waitForSelector(".tbp-card");
    ok(await p.evaluate(() => JSON.parse(localStorage.getItem("cognicopia_voice")).voice) === "Samantha", "the choice is kept on the device");
  }
  await p.context().close();
}

/* ---------- Tablet Interactive Mode (the packet tool) ---------- */
{
  const p = await open();
  await p.goto(base + "index.html"); await p.waitForTimeout(600);
  ok(await p.evaluate(() => typeof window.launchTabletMode === "function"), "Tablet Interactive Mode can be opened from the packet tool");
  await p.evaluate(() => window.launchTabletMode()); await p.waitForTimeout(900);
  let vb = p.locator(".tb-voice:visible").first();
  if (!(await vb.count())) { for (const tab of await p.$$(".tb-tab")) { await tab.click().catch(() => {}); await p.waitForTimeout(250); if (await p.locator(".tb-voice:visible").count()) break; } vb = p.locator(".tb-voice:visible").first(); }
  if (await vb.count()) { await vb.click(); await p.waitForSelector("#cgVoicePanel"); await panelChecks(p, "Tablet Interactive Mode"); }
  else ok(false, "Tablet Interactive Mode shows a Voice settings button");
  await p.context().close();
}

/* ---------- the Academy ---------- */
{
  const p = await open();
  await p.goto(base + "builder.html#/academy"); await p.waitForSelector("#acRoot", { timeout: 10000 }); await p.waitForTimeout(300);
  await p.click(".ac-card a, .ac-card button, a[href*='#/academy/']"); await p.waitForSelector("#acVset", { timeout: 10000 });
  await p.click("#acVset"); await p.waitForSelector("#cgVoicePanel");
  await panelChecks(p, "Academy");
  ok(await p.$(".cgv-sw input") !== null && /High-Fidelity Voice/.test(await p.textContent(".cgv-sw")), "the Academy panel has the High-Fidelity Voice switch");
  await p.click(".cgv-pace button:has-text('Slow')"); await p.waitForTimeout(150);
  ok(await p.$eval("#acRate", e => e.value) === "0.75", "Slow sets the lesson speed to 0.75x");
  await p.click(".cgv-pace button:has-text('Normal')"); await p.waitForTimeout(150);
  ok(await p.$eval("#acRate", e => e.value) === "1.25", "Normal sets the lesson speed to 1.25x");
  await p.click(".cgv-pace button:has-text('Natural')"); await p.waitForTimeout(150);
  await p.click(".cgv-list li:nth-child(2) button:has-text('Use')"); await p.waitForTimeout(150);
  ok(await p.$eval("#acVoice", e => e.value) === "Samantha" || (await p.$("#acVoice[hidden]")) !== null, "the voice picked in the panel is the one in the player");
  await p.keyboard.press("Escape"); await p.waitForTimeout(100);
  await p.evaluate(() => { window.__said.length = 0; });
  await p.click("#acToggle"); await p.waitForTimeout(500);
  const s = await said(p);
  ok(s.length >= 1 && s[0].voice === "Samantha" && Math.abs(s[0].rate - 0.90) < 0.001 && s[0].pitch === 1, `a lesson is read with the chosen voice at 0.90 and pitch 1 (${JSON.stringify(s[0])})`);
  await p.click("#acToggle").catch(() => {});
  await p.click("#acVset"); await p.waitForSelector("#cgVoicePanel");
  await p.uncheck(".cgv-sw input"); await p.waitForTimeout(400);
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem("cognicopia_voice")).hifi) === false, "turning High-Fidelity off is kept on the device");
  await p.context().close();
}

ok(foreign.length === 0, "nothing was requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 3).join(", ") : ""));
ok(errors.length === 0, "no script error" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
await browser.close(); srv.close();
console.log(problems.length ? `voice settings check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ") : `voice settings check passed: ${passed} checks in a real browser (the Tablet page, Tablet Interactive Mode and the Academy: voices ranked, paces, preview and test sentence, 52 px, nothing leaving the page)`);
process.exit(problems.length ? 1 : 0);
