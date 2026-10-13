#!/usr/bin/env node
/* =====================================================================
   The sample packet: a real packet, made by the real tool.

   assets/samples/cognicopia-sample-packet.pdf is what the front page's
   "Download Today's Packet (PDF)" button makes for a made-up resident
   (Ruth, born 1938, who likes gardening, big-band music and a river town)
   at the middle stage on 1 October 2026. A buyer can open it without
   typing anything, and see the five pages an Activity Director would print.

   The script opens index.html in a real browser, with the clock and the
   random numbers held still, fills the form, presses the button and keeps
   the PDF the page itself makes. Nothing is drawn by hand and nothing is
   sent anywhere.

     node scripts/sample-packet.mjs           write the PDF
     node scripts/sample-packet.mjs --check   fail if the tool would now make a different PDF
                                              (part of npm run build; skipped where Playwright is missing)

   If the packet engine or the PDF layout changes, --check fails; run the
   script without a flag and commit the new PDF.
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { loadPlaywright, serve, ROOT } from "./lib/browser.mjs";

const OUT = path.join(ROOT, "assets", "samples", "cognicopia-sample-packet.pdf");
const check = process.argv.includes("--check");

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
let bytes;
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(() => {
    const FIXED = new Date(2026, 9, 1, 9, 0, 0).getTime();            // 1 October 2026, nine in the morning
    const RealDate = Date;
    class StillDate extends RealDate {
      constructor(...a){ if (a.length === 0) super(FIXED); else super(...a); }
      static now(){ return FIXED; }
    }
    window.Date = StillDate;
    let s = 0x2f6e2b1;                                                // a fixed seed: the PDF's own random file id is the same each time
    Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  });
  const p = await ctx.newPage();
  const errors = []; p.on("pageerror", e => errors.push(e.message));
  await p.goto(base + "index.html"); await p.waitForSelector("#pcgCard", { timeout: 15000 });
  const fill = async (id, v) => { await p.fill("#" + id, v); };
  await fill("first", "Ruth"); await fill("born", "1938");
  await fill("hobbies", "gardening, big-band music"); await fill("favs", "roses, a river town");
  await p.check('input[name="stage"][value="middle"]');
  await p.waitForFunction(() => !document.getElementById("pcgPrint").disabled, null, { timeout: 15000 });
  const dl = p.waitForEvent("download", { timeout: 60000 });
  await p.click("#pcgPrint");
  const file = await dl;
  const tmp = path.join(os.tmpdir(), "cognicopia-sample-" + process.pid + ".pdf");
  await file.saveAs(tmp);
  bytes = fs.readFileSync(tmp); fs.unlinkSync(tmp);
  if (errors.length) { console.error("sample packet: the page raised an error: " + errors[0]); process.exit(1); }
} finally {
  await browser.close(); srv.close();
}

if (!bytes || bytes.length < 20000 || bytes.slice(0, 5).toString() !== "%PDF-") { console.error("sample packet: the tool did not make a PDF"); process.exit(1); }
if (check) {
  const have = fs.existsSync(OUT) ? fs.readFileSync(OUT) : null;
  if (!have) { console.error("sample packet: assets/samples/cognicopia-sample-packet.pdf is missing. Run: node scripts/sample-packet.mjs"); process.exit(1); }
  if (!have.equals(bytes)) { console.error("sample packet: the tool now makes a different PDF from the one on the site. Run: node scripts/sample-packet.mjs and commit the new file."); process.exit(1); }
  console.log("sample packet check passed: the PDF on the site is the one the tool makes now (" + bytes.length + " bytes)");
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, bytes);
  console.log("wrote " + path.relative(ROOT, OUT) + " (" + bytes.length + " bytes)");
}
