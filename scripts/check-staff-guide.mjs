#!/usr/bin/env node
/* =====================================================================
   The Staff Guide and Feature Tour (resources/staff-guide/, js/staffGuide.js).

     rules      the era a resident was 15 to 25 in, the invoice file name, the one-page sheet's words (no browser)
     page       four tabs that open with a click and the arrow keys; every practice screen steps forward and back, and its
                controls do what they say (a level changes the grid, a year changes the era, the month fills a bar, a tile
                praises, the invoice shows its file name); the FAQ opens
     sheet      "Print 1-Page Breakroom Quick-Start Guide (PDF)" downloads a PDF that PyMuPDF reads back: one US Letter page,
                every line inside the 0.75 in margins, no line over another, black text no smaller than 11.5 pt, the four steps
     words      no claim of compliance, no emoji, "no resident data leaves the device", listed under Resources, cached offline
     page rules 52 px controls, no sideways scrolling on a phone, nothing requested from outside, nothing sent
   Exit code 2 where Playwright is not installed.
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";
import { spawnSync } from "child_process";
import { loadPlaywright, serve, ROOT } from "./lib/browser.mjs";

let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---------- the rules ---------- */
const box = {}; box.globalThis = box; vm.createContext(box);
vm.runInContext(read("js/staffGuide.js"), box);
const G = box.CognicopiaStaffGuide;
ok(JSON.stringify(G.eraDecades(1938)) === JSON.stringify(["1950s", "1960s"]), "born in 1938: the 1950s and 1960s");
ok(JSON.stringify(G.eraDecades(1925)) === JSON.stringify(["1940s", "1950s"]), "born in 1925: the 1940s and 1950s");
ok(JSON.stringify(G.eraDecades(1945)) === JSON.stringify(["1960s", "1970s"]), "born in 1945: the 1960s and 1970s");
ok(G.eraDecades(1899).length === 0 && G.eraDecades("abc").length === 0 && G.eraDecades(2001).length === 0, "a year outside 1900 to 1990, or not a number, names no decade");
ok(/1950s and 1960s, when they were 15 to 25/.test(G.eraSentence(1938)), "the era sentence says when they were 15 to 25");
ok(G.invoiceFileName("Maple Court Senior Living", new Date(2026, 9, 22)) === "Cognicopia_Invoice_Maple_Court_Senior_Living_2026-10-22.pdf", "the practice invoice file name follows the real one");
ok(G.invoiceFileName("!!!", new Date(2026, 0, 5)) === "Cognicopia_Invoice_Facility_2026-01-05.pdf", "a name with no letters still makes a file name");
const sheetText = JSON.stringify(G.SHEET);
for (const w of ["Make the packet", "Download PDF Packet", "Download Month (All Residents)", "Generate Bundle PDF", "Finish for me", "Make my invoice (PDF)", "cognicopia@outlook.com"]) ok(sheetText.includes(w), `the sheet uses the real button words: ${w}`);
ok(!/HIPAA|compliant|guarantee/i.test(sheetText), "the sheet claims no compliance");

/* ---------- the words on the page and in the nav ---------- */
const html = read("resources/staff-guide/index.html"), main = html.slice(html.indexOf('<main'), html.indexOf("</main>"));
const text = main.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/&rsquo;/g, "’").replace(/&amp;/g, "&");
ok(/no resident data leaves the device/i.test(text), "the page says no resident data leaves the device");
ok(!/HIPAA[- ]compliant|ensures? compliance|guarantee|zero liability|no liability/i.test(text), "the page claims no compliance and promises no liability");
ok(/supports your facility’s HIPAA privacy practices/.test(text), "it says it supports a facility's HIPAA privacy practices");
ok(!/\p{Extended_Pictographic}/u.test(main), "no emoji on the page (line icons are used)");
ok(!/under 30 seconds|in 30 seconds|saves? hours/i.test(text), "no time or saving that has not been measured");
ok(/about a third of a second/.test(text) && /270 to 310 ms/.test(read("docs/ux-baseline.md")), "the one time given is the measured one in docs/ux-baseline.md");
ok(/slug: "staff-guide"/.test(read("scripts/site-nav.mjs")) && /staff-guide\//.test(read("resources/index.html")), "the Resources hub lists the guide");
ok(/js\/staffGuide\.js/.test(read("sw.js")) && /resources\/staff-guide\/index\.html/.test(read("sw.js")), "the offline cache holds the guide and its script");
ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB/.test(read("js/staffGuide.js").replace(/\/\*[\s\S]*?\*\//g, "")), "the guide's script makes no request and keeps nothing");

/* ---------- the browser ---------- */
const PY = `
import sys, json
import pymupdf as fitz
doc = fitz.open(sys.argv[1]); out = {"pages": doc.page_count, "w": doc[0].rect.width, "h": doc[0].rect.height, "text": "", "lines": [], "colors": [], "sizes": []}
for pg in doc:
    out["text"] += pg.get_text() + "\\n"
    for blk in pg.get_text("dict")["blocks"]:
        for ln in blk.get("lines", []):
            t = "".join(s["text"] for s in ln["spans"]).strip()
            if t:
                out["lines"].append({"t": t, "b": ln["bbox"]})
                out["colors"] += [s["color"] for s in ln["spans"] if s["text"].strip()]
                out["sizes"] += [s["size"] for s in ln["spans"] if s["text"].strip()]
print(json.dumps(out))
`;
const pdfInfo = file => { const r = spawnSync("python3", ["-I", "-c", PY, file], { encoding: "utf8", timeout: 60000 }); try { return JSON.parse(r.stdout.trim().split("\n").pop()); } catch (x) { return null; } };

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-guide-"));
const outside = [], posts = [], errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (x) { /* ignore */ } });
  const p = await ctx.newPage();
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) outside.push(u); if (r.method() !== "GET") posts.push(r.method() + " " + u); });
  p.on("pageerror", x => errors.push(x.message));
  p.on("console", x => { if (x.type() === "error") errors.push("console: " + x.text().slice(0, 140)); });
  await p.goto(base + "resources/staff-guide/"); await p.waitForSelector("#sgTabs");
  ok(/Staff Guide/.test(await p.title()) && (await p.textContent("h1")).includes("Staff Guide"), "the page and its heading are named");

  /* tabs */
  const sel = async () => p.$$eval("#sgTabs [role=tab]", t => t.map(x => x.getAttribute("aria-selected")).join());
  ok((await sel()) === "true,false,false,false" && await p.isVisible("#sg-p1") && !(await p.isVisible("#sg-p2")), "the first tab is open at the start");
  await p.click("#sg-t3"); ok((await sel()) === "false,false,true,false" && await p.isVisible("#sg-p3") && !(await p.isVisible("#sg-p1")), "a click opens the Tablet Activities tab");
  await p.focus("#sg-t3"); await p.keyboard.press("ArrowRight"); ok((await sel()) === "false,false,false,true" && (await p.evaluate(() => document.activeElement.id)) === "sg-t4", "the right arrow moves to the next tab and focuses it");
  await p.keyboard.press("Home"); ok((await sel()) === "true,false,false,false", "Home goes to the first tab");
  await p.keyboard.press("End"); ok((await sel()) === "false,false,false,true", "End goes to the last tab");
  await p.click("#sg-t1");

  /* level and era */
  const cells = () => p.$$eval("#sgGrid span", s => s.length);
  ok((await cells()) === 25, "Middle shows a 5 by 5 practice grid");
  await p.click('[data-sg-stage="late"]'); ok((await cells()) === 16 && /Late/.test(await p.textContent("#sgStageNote")), "Late makes the grid 4 by 4 with larger letters");
  const sz = async () => p.$eval("#sgGrid span", e => parseFloat(getComputedStyle(e).fontSize));
  const late = await sz(); await p.click('[data-sg-stage="early"]'); const early = await sz();
  ok((await cells()) === 36 && late > early, `Early shows more, smaller letters (${early} px) than Late (${late} px)`);
  ok((await p.$$eval("[data-sg-stage]", b => b.map(x => x.getAttribute("aria-pressed")).join())) === "true,false,false", "the chosen level is the pressed one");
  ok(/1950s and 1960s/.test(await p.textContent("#sgEra")), "a year of 1938 names the 1950s and 1960s");
  await p.fill("#sgBorn", "1925"); ok(/1940s and 1950s/.test(await p.textContent("#sgEra")), "changing the year changes the era");
  await p.fill("#sgBorn", "3000"); ok(/between 1900 and 1990/.test(await p.textContent("#sgEra")), "a year out of range is explained");

  /* the stepper */
  const step = async n => p.$eval(`#sg-p${n} .sg-tour`, e => e.getAttribute("data-step") + "|" + (e.querySelector("[aria-current=step]") || {}).textContent.slice(0, 20));
  ok((await step(1)).startsWith("1|") && await p.$eval("#sg-p1 .sg-back", e => e.disabled), "the first step starts with Back switched off");
  await p.click("#sg-p1 .sg-next"); ok((await step(1)).startsWith("2|Under How much of a") && /Step 2 of 3/.test(await p.textContent("#sg-p1 .sg-count")), "Next step moves to step 2 and says so");
  await p.click("#sg-p1 .sg-next"); ok((await p.textContent("#sg-p1 .sg-next")) === "Start again", "the last step offers Start again");
  await p.click("#sg-p1 .sg-next"); ok((await step(1)).startsWith("1|"), "Start again returns to step 1");
  await p.click("#sg-p1 .sg-next"); await p.click("#sg-p1 .sg-back"); ok((await step(1)).startsWith("1|"), "Back goes a step back");

  /* the month */
  await p.click("#sg-t2");
  ok((await p.$$eval("#sgMonth option", o => o.length)) === 12 && (await p.inputValue("#sgMonth")) === String(new Date().getMonth()), "the month list has twelve months and starts on this one");
  await p.click("#sgGo"); await p.waitForFunction(() => document.getElementById("sgBar").getAttribute("aria-valuenow") === "100", null, { timeout: 5000 });
  ok(/Practice only/.test(await p.textContent("#sgBundleMsg")), "the practice bar fills and says nothing was made");

  /* the tablet */
  await p.click("#sg-t3"); await p.click('[data-sg-tile][data-praise="Nicely done."]');
  ok((await p.textContent("#sgPraise")) === "Nicely done." && (await p.$eval("#sgPraise", e => e.classList.contains("on"))), "a tile shows a gentle cheer");
  ok(!/incorrect|try again|that is wrong|that\u2019s wrong/i.test(await p.textContent("#sg-p3")), "the tablet panel never tells a resident they were wrong");

  /* the invoice */
  await p.click("#sg-t4"); await p.click("#sgInvoiceMake");
  ok(/^Cognicopia_Invoice_Maple_Court_Senior_Living_\d{4}-\d\d-\d\d\.pdf$/.test(await p.textContent("#sgFile")), "the practice invoice shows its file name");
  ok(/PO PENDING/.test(await p.textContent("#sgInvoiceMsg")) && /Practice only/.test(await p.textContent("#sgInvoiceMsg")), "an empty PO number reads PO PENDING, and it says nothing was made");
  await p.fill("#sgPo", "PO-7731"); await p.click("#sgInvoiceMake"); ok(/PO-7731/.test(await p.textContent("#sgInvoiceMsg")), "a PO number is shown back");

  /* the FAQ */
  const qa = await p.$$("details.sg-qa"); ok(qa.length >= 5, `the FAQ has ${qa.length} questions`);
  await p.click("details.sg-qa summary"); ok(await p.$eval("details.sg-qa", d => d.open), "a question opens");

  /* the sheet */
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }), p.click("#sgPrint")]);
  const file = path.join(tmp, dl.suggestedFilename()); await dl.saveAs(file);
  ok(dl.suggestedFilename() === "Cognicopia_Staff_QuickStart.pdf", "the sheet downloads as Cognicopia_Staff_QuickStart.pdf (" + dl.suggestedFilename() + ")");
  const info = pdfInfo(file);
  ok(!!info && info.pages === 1 && Math.abs(info.w - 612) < 1 && Math.abs(info.h - 792) < 1, "the sheet is one US Letter page");
  if (info) {
    const T = info.text.replace(/\s+/g, " ");
    for (const w of ["Cognicopia Quick-Start for Activity Staff", "Make a packet for one resident", "Make the month for everyone", "Use the tablet with a resident", "Ask accounts payable to buy", "Make my invoice (PDF)", "Good to know", "cognicopia@outlook.com"]) ok(T.includes(w), `the sheet says: ${w}`);
    ok(info.lines.every(l => l.b[0] >= 53 && l.b[2] <= 559 && l.b[1] >= 40 && l.b[3] <= 740), "every line is inside the 0.75 in margins");
    ok(info.lines.every((a, i) => info.lines.every((b, j) => i >= j || a.b[2] <= b.b[0] + 0.5 || b.b[2] <= a.b[0] + 0.5 || a.b[3] <= b.b[1] + 1 || b.b[3] <= a.b[1] + 1)), "no line is written over another");
    ok(info.colors.every(c => c === 0), "all text is pure black");
    ok(Math.min(...info.sizes) >= 11.5, `no type is smaller than 11.5 pt (smallest ${Math.min(...info.sizes).toFixed(1)})`);
  }
  ok(/saved as Cognicopia_Staff_QuickStart\.pdf/.test(await p.textContent("#sgPrintMsg")), "the page says where the sheet went");
  await ctx.close();
  ok(outside.length === 0, "nothing was requested from outside the page: " + outside.join(", "));
  ok(posts.length === 0, "nothing was sent: " + posts.join(", "));
  ok(errors.length === 0, "no script or console errors: " + errors.join(" | "));

  /* size, phone, contrast */
  for (const [label, vp] of [["a laptop", { width: 1366, height: 768 }], ["a phone", { width: 390, height: 844 }]]) {
    const c2 = await browser.newContext({ viewport: vp, serviceWorkers: "block" }); await c2.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (x) { /* ignore */ } });
    const q = await c2.newPage(); await q.goto(base + "resources/staff-guide/"); await q.waitForSelector("#sgTabs");
    for (const n of [1, 2, 3, 4]) {
      await q.click("#sg-t" + n);
      const m = await q.evaluate(n => ({ wide: document.documentElement.scrollWidth <= innerWidth + 1, small: [...document.querySelectorAll("#sg-p" + n + " button, #sg-p" + n + " input:not([type=checkbox]), #sg-p" + n + " select, #sg-p" + n + " .sg-link")].filter(e => !e.hasAttribute("aria-hidden") && e.getBoundingClientRect().height < 51.5).map(e => e.className || e.id) }), n);
      ok(m.wide, `${label}, tab ${n}: no sideways scrolling`); ok(m.small.length === 0, `${label}, tab ${n}: every control is 52 px tall (${m.small.join(", ")} are not)`);
    }
    const m2 = await q.evaluate(() => ({ small: [...document.querySelectorAll("#sgTabs [role=tab], details.sg-qa summary, #sgPrint")].filter(e => e.getBoundingClientRect().height < 51.5).map(e => e.id || e.tagName) }));
    ok(m2.small.length === 0, `${label}: tabs, questions and the print button are 52 px tall (${m2.small.join(", ")})`);
    await c2.close();
  }
  /* white on the dark controls */
  const c3 = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" }); await c3.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (x) { /* ignore */ } });
  const r = await c3.newPage(); await r.goto(base + "resources/staff-guide/"); await r.waitForSelector("#sgTabs");
  const cols = await r.evaluate(() => ["#sg-t1", "#sg-t1 span", ".sg-next", "#sgPrint", ".sg-level[aria-pressed=true]", ".sg-level[aria-pressed=true] b"].map(s => { const e = document.querySelector(s), c = getComputedStyle(e); return [s, c.color, getComputedStyle(e.closest("button")).backgroundColor]; }));
  const lum = c => { const [a, b, d] = c.match(/\d+/g).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a + 0.7152 * b + 0.0722 * d; };
  for (const [s, fg, bg] of cols) { const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); ok(ratio >= 7, `${s}: text reads at ${ratio.toFixed(1)}:1 (7:1 needed)`); }
  await c3.close();
} finally { await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); }

if (problems.length) { console.error("staff guide check FAILED: " + problems.length + " problem(s), " + passed + " passed"); problems.forEach(x => console.error("  - " + x)); process.exit(1); }
console.log("staff guide check passed: " + passed + " checks (the era rule, four tabs and their practice screens, the PDF sheet read back, the words, 52 px controls, 7:1 text, nothing leaving the page)");
