#!/usr/bin/env node
/* The Quarterly Legacy & Memory Books on the Packet Builder page, in a real browser (Playwright; exit 2 where it is not installed):
   the screen is renamed, the compile button is there, and a compiled book goes through the builder's own print stage to a PDF with one
   Letter page per book page, the 0.75 in gutter on the inside edge (alternating), page-number footers and nothing outside the margins. */
import { loadPlaywright, serve } from "./lib/browser.mjs";
import { execFileSync } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const { chromium } = loadPlaywright(); const { srv, base } = await serve(); const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (x) { /* ignore */ } });
  const p = await ctx.newPage(), errs = [], outside = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 160))); p.on("request", (r) => { if (!r.url().startsWith(base) && !/^(data|blob|about):/.test(r.url())) outside.push(r.url()); });
  await p.goto(base + "builder.html#/heirloom"); await p.waitForSelector("#hlRoot", { timeout: 15000 }); await p.waitForTimeout(500);
  const t = await p.evaluate(() => ({ h1: document.querySelector("h1").textContent, tabs: [...document.querySelectorAll("[data-tab]")].map((b) => b.textContent), nav: [...document.querySelectorAll(".sb-link")].some((a) => /Quarterly Legacy & Memory Books/.test(a.textContent)), old: /Memory Digest/.test(document.body.innerText) }));
  ok(t.h1 === "Quarterly Legacy & Memory Books" && t.tabs.includes("Quarterly legacy book") && !t.old, "the screen and a new tab are renamed, with no old name left (old name left: " + t.old + ")");
  const r = await p.evaluate(async () => {
    const L = await import("/js/legacy-book.js"), today = new Date("2026-11-10T12:00:00"), d = (n) => new Date(today.getTime() - n * 86400000).toISOString().slice(0, 10);
    const entries = Array.from({ length: 14 }, (_, i) => ({ date: d(i * 5 + 1), kind: ["journal", "reminiscence", "moment", "coloring"][i % 4], title: "Entry " + (i + 1), text: i % 4 === 3 ? "" : "She told us about the farm and the radio. ".repeat(4), design: i % 4 === 3 ? "sunflower-field" : "", share: true, tier: 2 }));
    const book = await L.compile({ profile: () => ({ tier1_core: { preferredName: "Margaret" }, tier2_enrichment: { birthYear: 1938 } }), keeper: () => ({ entries }), journal: () => ({ entries: [{ at: d(2) + "T10:00:00Z", kind: "calming", text: "Settled with a hummed hymn." }] }), tracking: () => ({ entries: [{ month: "2026-10", note: "More relaxed this month." }] }) }, "r1", { today, relation: "Mom", facility: "Maple Grove", message: "We are glad to know her." });
    window.print = () => { window.__stage = { pages: document.querySelectorAll("#printRoot .sheet, .print-stage .sheet, [id*=print] .sheet").length }; };
    BookUI.print(book.pages.map((x) => ({ html: x.html })), "Legacy Book test", null); await new Promise((r) => setTimeout(r, 800));
    return { pages: book.pages.length, stage: window.__stage, sheets: document.querySelectorAll(".lb-sheet").length };
  });
  ok(r.pages >= 8 && r.sheets >= r.pages, "the book is compiled and handed to the builder's print stage (" + r.pages + " pages, " + r.sheets + " sheets drawn)");
  await p.emulateMedia({ media: "print" });
  const pdf = path.join(os.tmpdir(), "lb-" + process.pid + ".pdf"); fs.writeFileSync(pdf, await p.pdf({ preferCSSPageSize: true, printBackground: true }));
  const py = `import pdfplumber,json,sys
with pdfplumber.open(sys.argv[1]) as pdf:
    out=[]
    for i,pg in enumerate(pdf.pages):
        ch=pg.chars
        if not ch: out.append([i+1,None,None,None]); continue
        out.append([i+1, round(min(c["x0"] for c in ch),1), round(max(c["x1"] for c in ch),1), pg.extract_text().replace("\\n"," ")])
    print(json.dumps({"n":len(pdf.pages),"w":pdf.pages[0].width,"h":pdf.pages[0].height,"pages":out}))`;
  const g = JSON.parse(execFileSync("python3", ["-c", py, pdf], { encoding: "utf8" })); fs.unlinkSync(pdf);
  ok(g.n === r.pages && Math.round(g.w) === 612 && Math.round(g.h) === 792, "the PDF has one Letter page per book page (" + g.n + " of " + r.pages + ")");
  const body = g.pages.slice(2).filter((x) => x[1] != null);
  const odd = body.filter((x) => x[0] % 2 === 1), even = body.filter((x) => x[0] % 2 === 0);
  ok(odd.length && odd.every((x) => x[1] >= 54 - 1.5) && even.every((x) => x[2] <= 612 - 54 + 1.5) && odd.every((x) => x[2] <= 612 - 36 + 1.5) && even.every((x) => x[1] >= 36 - 1.5), "text keeps 0.75 in (54 pt) on the inside edge: left on odd pages, right on even, and inside the outer margin");
  ok(g.pages.slice(1).every((x) => new RegExp("Page " + x[0] + " of " + g.n).test(x[3] || "")), "every page after the cover ends with its Page n of N footer " + JSON.stringify(g.pages.slice(1, 4).map((x) => x[3])));
  ok(outside.length === 0 && errs.length === 0, "no outside request and no script error (" + outside.concat(errs).slice(0, 2).join("; ") + ")");
  await ctx.close();
} finally { await browser.close(); srv.close(); }
if (problems.length) { console.error("legacy book UI check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("legacy book UI check passed: " + passed + " checks in a real browser (renamed screen, builder print stage, Letter PDF, alternating 0.75 in gutters, footers)");
