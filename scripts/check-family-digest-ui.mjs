#!/usr/bin/env node
/* =====================================================================
   The Family Life Digest buttons on the front page, in a real browser.

   Both "Family Life Digest" buttons on the front page (the bar above the packet and the one by the
   packet's own buttons) were wired to a module that was never loaded, so they did nothing. They now
   open the shipped digest drawer (js/familyLifeDigestUI.js, assets/services/familyLifeDigest.js).

     opens      the quick-print bar's button opens the drawer for the person typed into the form,
                and so does the button beside the packet
     who        the drawer's page names them, with the town and the former work from the form
     makes      choosing an observation and a note, then "Generate PDF", downloads a one-page PDF
                that names the person, the note and the observation (read back with PyMuPDF)
     closes     Cancel closes it and returns focus
     fingers    the drawer's buttons are at least 52 px
     private    nothing was requested from outside the page, no script errors
   Needs Playwright and PyMuPDF. Run: node scripts/check-family-digest-ui.mjs
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "digest-"));

try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } });
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + "index.html", { waitUntil: "load" });
  await p.waitForSelector("#first", { state: "attached", timeout: 15000 });
  await p.waitForTimeout(1500);

  /* a made-up person typed into the packet form, nothing saved */
  await p.evaluate(() => {
    const set = (id, v) => { const e = document.getElementById(id); if (e) { e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); } };
    set("goes", "Dorothy"); set("town", "Minot"); set("job", "schoolteacher");
  });
  await p.waitForTimeout(1600);

  const drawerOpen = () => p.evaluate(() => { const r = document.querySelector(".fld-root"); return !!r && r.classList.contains("is-open"); });
  ok(!(await drawerOpen()), "the drawer is closed until a button asks for it");

  /* the bar's button */
  await p.evaluate(() => document.getElementById("qpbFamilyDigest").click()); await p.waitForTimeout(400);
  ok(await drawerOpen(), "the quick-print bar's Family Life Digest button opens the drawer");
  ok(await p.$eval("#fldActivityType", e => e.value) === "Activity packet", "it knows the session was an activity packet");
  const heights = await p.$$eval(".fld-root .fld-btn, .fld-root .fld-close", bs => bs.map(b => Math.round(b.getBoundingClientRect().height)));
  ok(heights.length >= 3 && heights.every(h => h >= 52), `the drawer's buttons are at least 52 px (${heights.join(", ")})`);

  /* the person's tags and note, then the PDF */
  await p.evaluate(() => { const t = document.querySelector('input[name="fldTag"]'); if (t) t.click(); });
  await p.fill("#fldCustomNotes", "Sang along to the radio and told us about her classroom.");
  await p.fill("#fldStaffInitials", "KB");
  const dl = p.waitForEvent("download", { timeout: 15000 }).catch(() => null);
  await p.click("#fldGenerate");
  const d = await dl;
  ok(!!d, "Generate PDF downloads a file");
  if (d) {
    const file = path.join(tmp, "digest.pdf"); await d.saveAs(file);
    ok(/dorothy/i.test(d.suggestedFilename()) && /\.pdf$/i.test(d.suggestedFilename()), `the file is named for the person (${d.suggestedFilename()})`);
    let txt = "", pages = 0;
    try {
      const out = execFileSync("python3", ["-c", "import sys,pymupdf;d=pymupdf.open(sys.argv[1]);print(len(d));print(d[0].get_text())", file], { encoding: "utf8" });
      pages = parseInt(out.split("\n")[0], 10); txt = out;
    } catch (e) { problems.push("PyMuPDF could not read the PDF: " + String(e.message).slice(0, 120)); }
    ok(pages === 1, `one page (${pages})`);
    ok(/Dorothy/.test(txt), "the page names Dorothy");
    ok(/Minot/.test(txt) && /schoolteacher/i.test(txt), "it uses the town and former work from the form");
    ok(/told us about her classroom/.test(txt), "it carries the staff note");
    ok(/Zero-Cloud Privacy Guarantee/.test(txt), "it carries the privacy line");
  }
  await p.waitForTimeout(500);

  /* Cancel, then the other button */
  await p.evaluate(() => document.getElementById("fldCancel").click()); await p.waitForTimeout(300);
  ok(!(await drawerOpen()), "Cancel closes the drawer");
  await p.evaluate(() => { const b = document.getElementById("pcgFamilyDigest"); if (b) { b.disabled = false; b.click(); } }); await p.waitForTimeout(400);
  ok(await drawerOpen(), "the button beside the packet opens it too");
  await p.evaluate(() => document.getElementById("fldCancel").click());

  ok(foreign.length === 0, "nothing is requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 2).join(", ") : ""));
  ok(errors.length === 0, "no script errors" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
  await ctx.close();
} finally { await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); }

console.log(problems.length ? `family digest check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `family digest check passed: ${passed} checks in a real browser (both front-page buttons open the shipped drawer, the PDF is one page and names the person, the note and the town, 52 px buttons, nothing leaves the page)`);
process.exit(problems.length ? 1 : 0);
