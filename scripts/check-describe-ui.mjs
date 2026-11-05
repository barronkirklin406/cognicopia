#!/usr/bin/env node
/* =====================================================================
   Describe & Create in a real browser.
     the Packet Builder   the coloring library's New pages tab has "Describe a picture": typed words make a page with the drawing
                          they choose, at the tier chosen; it joins your pages and the print preview under its page code, and the
                          note says which words were used and which were not; Enter works; a refused or empty request makes
                          nothing; 52 px controls; nothing sideways on a phone
     the front page       the packet form's "A picture to color" says, as the words are typed, which drawing they choose; the
                          packet made from the form uses that drawing for its coloring page (the PDF is read back with PyMuPDF),
                          and the same form without it chooses its own picture
     all                  nothing leaves the page, no script error
   Needs Playwright and PyMuPDF. Run: node scripts/check-describe-ui.mjs
   ===================================================================== */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const PY = `
import sys
try:
    import pymupdf as fitz
except ImportError:
    import fitz
doc = fitz.open(sys.argv[1]); print("\\n".join(p.get_text() for p in doc))`;
async function open(w, h, url) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } });
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + url, { waitUntil: "load" }); await p.waitForTimeout(1200);
  return { ctx, p };
}
async function packetText(p) {
  const dl = p.waitForEvent("download", { timeout: 90000 });
  await p.click("#go");
  const file = await dl, tmp = path.join(os.tmpdir(), "cognicopia-describe-" + process.pid + "-" + Date.now() + ".pdf");
  await file.saveAs(tmp);
  try { return execFileSync("python3", ["-c", PY, tmp], { encoding: "utf8" }); } finally { fs.unlinkSync(tmp); }
}

try {
  /* ---------- the Packet Builder ---------- */
  let { ctx, p } = await open(1366, 900, "builder.html#/coloring");
  await p.click("#ccTabNew"); await p.waitForTimeout(400);
  ok(await p.$("#ccDescText") !== null && await p.$("#ccDescGo") !== null, "the New pages tab has a box to describe a picture");
  await p.fill("#ccDescText", "a classic grandfather clock in a cozy parlor"); await p.click("#ccDescGo"); await p.waitForTimeout(700);
  let note = await p.textContent("#ccGenNote");
  ok(/Grandfather Clock/.test(note) && /“parlor”/.test(note) && /HM-grandfather_clock-/.test(note), "the words make a grandfather clock page, and the note names the words not used and the page code");
  const picks = await p.$$eval("#ccPreview, .cc-sel, .cc-selection", n => n.map(x => x.textContent).join(" "));
  ok(/grandfather_clock|Grandfather Clock/.test(picks), "the page joins your pages and the print preview");
  await p.fill("#ccDescText", "a detailed close-up of a tiger lily in bloom"); await p.press("#ccDescText", "Enter"); await p.waitForTimeout(700);
  note = await p.textContent("#ccGenNote");
  ok(/There is no drawing of exactly that yet/.test(note) && /“tiger lily”/.test(note), "Enter works, and a subject the drawings do not have is called the closest");
  const before = await p.$$eval("#ccGenGrid > *", n => n.length);
  await p.fill("#ccDescText", "a gun"); await p.click("#ccDescGo"); await p.waitForTimeout(500);
  ok(/not a subject for a coloring page/.test(await p.textContent("#ccGenNote")) && await p.$$eval("#ccGenGrid > *", n => n.length) === before, "a request that is not for a coloring page in care makes nothing and says so gently");
  await p.fill("#ccDescText", ""); await p.click("#ccDescGo"); await p.waitForTimeout(400);
  ok(/Type a few words/.test(await p.textContent("#ccGenNote")), "an empty request asks for a few words");
  const sizes = await p.$$eval("#ccDescText, #ccDescGo", n => n.map(e => Math.round(e.getBoundingClientRect().height)));
  ok(sizes.every(h => h >= 52), `the box and its button are at least 52 px tall (${sizes.join(", ")})`);
  await ctx.close();
  ({ ctx, p } = await open(390, 844, "builder.html#/coloring"));
  await p.click("#ccTabNew"); await p.waitForTimeout(400);
  await p.fill("#ccDescText", "a cardinal in the snow"); await p.click("#ccDescGo"); await p.waitForTimeout(600);
  ok(/Cardinal/.test(await p.textContent("#ccGenNote")) && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "on a phone it works and nothing scrolls sideways");
  await ctx.close();

  /* ---------- the front page ---------- */
  ({ ctx, p } = await open(1366, 900, "index.html"));
  await p.fill("#first", "Ruth"); await p.fill("#born", "1938"); await p.fill("#hobbies", "gardening, baking");
  await p.check('input[name="stage"][value="middle"]');
  await p.fill("#colorWish", "a classic grandfather clock in a cozy parlor"); await p.waitForTimeout(600);
  const wish = await p.textContent("#colorWishNote");
  ok(/Grandfather Clock/.test(wish) && /“parlor”/.test(wish), "the packet form says, as the words are typed, which drawing they choose and what is not drawn: " + wish);
  ok(await p.$eval('input.act[value="color"]', e => e.checked) && /now ticked/.test(wish), "describing a picture ticks the coloring page in the activities, and says so");
  const withWish = await packetText(p);
  ok(/The Grandfather Clock/.test(withWish), "the packet's coloring page is the grandfather clock the words chose (read back from the PDF)");
  await p.fill("#colorWish", ""); await p.waitForTimeout(300);
  ok((await p.textContent("#colorWishNote")) === "", "clearing the words clears the note");
  const without = await packetText(p);
  ok(!/The Grandfather Clock/.test(without), "without the words the packet chooses its own picture for the coloring page");
  await ctx.close();

  ok(foreign.length === 0, "nothing is requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 2).join(", ") : ""));
  ok(errors.length === 0, "no script errors" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `describe screen check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `describe screen check passed: ${passed} checks in a real browser (the Packet Builder's Describe a picture, the front page's A picture to color and the packet PDF read back, refusals, 52 px, a phone, nothing leaving the page)`);
process.exit(problems.length ? 1 : 0);
