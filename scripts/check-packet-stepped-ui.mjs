#!/usr/bin/env node
/* =====================================================================
   The packet tool's cover at once, and the packet made a page at a time (index.html: packetSteps, buildPacketStepped,
   recordPdfOps, opsToSvg), in a real browser.

     at once    pressing "Make the packet" shows a picture of page 1 in under 150 ms, measured on this computer, then
                "Building page X of about N" as the pages are made, then "Finished: N pages", N being the PDF's own count
     the same   the packet made a page at a time is the one made in one go, word for word on every page; also with the
                computer slowed tenfold and other code drawing random numbers between the steps (the packet's own
                random source is set aside while it waits)
     the cover  every line of the picture is a line of the PDF's page 1, in the same place (within 3 points), and the
                picture has the same mark
     reading    the caption is readable by day and in Night Shift, at 1366 x 768 and 390 x 844
     private    nothing is requested from outside the page; no script errors
   Made-up people only. Needs Playwright and PyMuPDF. Run: node scripts/check-packet-stepped-ui.mjs
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-step-"));
const READ = `
import sys, json
try:
    import pymupdf as fitz
except ImportError:
    import fitz
doc = fitz.open(sys.argv[1]); out = {"pages": [p.get_text() for p in doc], "spans": [], "images": len(doc[0].get_image_info())}
for b in doc[0].get_text("dict")["blocks"]:
    for l in b.get("lines", []):
        for s in l["spans"]:
            if s["text"].strip(): out["spans"].append([s["text"].strip(), (s["bbox"][0] + s["bbox"][2]) / 2, s["origin"][1], s["size"]])
print(json.dumps(out))`;
const readPdf = f => JSON.parse(execFileSync("python3", ["-c", READ, f], { encoding: "utf8", maxBuffer: 64 << 20 }));

async function open(w, h, night) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true, serviceWorkers: "block" });
  await ctx.addInitScript(n => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); if (n) localStorage.setItem("cognicopia_night_shift", "1"); } catch (e) { /* ignore */ } }, !!night);
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + "index.html", { waitUntil: "load" }); await p.waitForTimeout(800);
  await p.evaluate(() => {
    window.print = () => {};
    /* keep a copy of what the button asks for, so the same packet can be made in one go afterwards; and every line the progress shows */
    const orig = window.buildPacketStepped; window.__seen = [];
    window.buildPacketStepped = function (r) { window.__r = JSON.parse(JSON.stringify(r)); return orig.apply(this, arguments); };
    new MutationObserver(() => { const t = document.getElementById("pkLiveMsg").textContent; if (t && window.__seen[window.__seen.length - 1] !== t) window.__seen.push(t); }).observe(document.getElementById("pkLiveMsg"), { childList: true, characterData: true, subtree: true });
  });
  await p.fill("#first", "Margaret"); await p.fill("#born", "1938"); await p.fill("#town", "Scobey"); await p.fill("#hobbies", "gardening, baking"); await p.fill("#fac", "Maple House");
  return { ctx, p };
}
const save = async (p, name, act) => { const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 90000 }), act()]); const f = path.join(tmp, name); await dl.saveAs(f); return f; };

try {
  /* ---------- at once, then a page at a time ---------- */
  const { ctx, p } = await open(1366, 768);
  const stepped = await save(p, "stepped.pdf", () => p.click("#go"));
  await p.waitForTimeout(400);
  const T = await p.evaluate(() => window.CognicopiaPacketTimings), seen = await p.evaluate(() => window.__seen);
  const A = readPdf(stepped);
  ok(T && T.preview >= 0 && T.preview < 150, `a picture of page 1 shows ${T && T.preview} ms after the press (under 150 ms; the whole packet took ${T && T.done} ms here)`);
  ok(new RegExp("^Finished: " + A.pages.length + " pages").test(seen[seen.length - 1] || ""), `it ends with "Finished" and the PDF's own count (${seen[seen.length - 1]}; the PDF has ${A.pages.length})`);

  /* ---------- the same packet ---------- */
  const once = await save(p, "once.pdf", () => p.evaluate(() => { buildPacket(window.__r); }));
  const B = readPdf(once);
  const differs = A.pages.map((t, i) => t === B.pages[i] ? -1 : i).filter(i => i >= 0);
  ok(A.pages.length === B.pages.length && A.pages.length >= 20 && differs.length === 0, `made a page at a time it is the packet made in one go, word for word on all ${A.pages.length} pages` + (differs.length ? ` (page ${differs[0] + 1} differs)` : ""));

  /* slowed tenfold, as on a busy old computer, with other code drawing random numbers between the steps: the button again */
  const cdp = await ctx.newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 10 });
  await p.evaluate(() => { window.__seen = []; window.__ticks = 0; window.__iv = setInterval(() => { for (let i = 0; i < 50; i++) prand(); window.__ticks++; }, 1); });
  const slow = await save(p, "slow.pdf", () => p.click("#go"));
  await p.waitForTimeout(300); await p.evaluate(() => clearInterval(window.__iv));
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const C = readPdf(slow), ticks = await p.evaluate(() => window.__ticks), seen2 = await p.evaluate(() => window.__seen);
  const nums = seen2.map(t => (/^Building page (\d+)/.exec(t) || [])[1]).filter(Boolean).map(Number);
  ok(nums.length >= 3 && nums.every((v, i) => !i || v > nums[i - 1]) && /of about \d+/.test(seen2.find(t => /^Building page/.test(t)) || ""), `on a slow computer the screen follows it: "Building page X of about N" (${nums.length} steps shown: ${nums.slice(0, 4).join(", ")}…)`);
  ok(ticks > 0, `the other code really ran between the steps (${ticks} times, drawing 50 random numbers each)`);
  ok(C.pages.length === B.pages.length && C.pages.every((t, i) => t === B.pages[i]), "and the packet is still the same, word for word: its own random source was set aside while it waited");

  /* ---------- the picture is page 1 ---------- */
  const svg = await p.evaluate(() => { const s = document.querySelector("#pkLiveSheet svg"); return s ? { texts: [...s.querySelectorAll("text")].map(t => [t.textContent, +t.getAttribute("x"), +t.getAttribute("y"), +t.getAttribute("font-size"), t.getAttribute("text-anchor")]), images: s.querySelectorAll("image").length, view: s.getAttribute("viewBox") } : null; });
  ok(svg && svg.view === "0 0 612 792" && svg.texts.length >= 4, `the picture is the sheet, 612 x 792 points, with ${svg ? svg.texts.length : 0} lines of text`);
  const miss = (svg ? svg.texts : []).filter(([s, x, y, fs]) => !A.spans.some(([t, cx, oy, sz]) => t === s.trim() && Math.abs(oy - y) <= 3 && Math.abs(sz - fs) <= 0.6 && Math.abs(cx - x) <= 3));
  ok(svg && miss.length === 0, "every line of the picture is a line of the PDF's page 1, in the same place and size" + (miss.length ? ": " + miss.slice(0, 3).map(m => m[0]).join(" | ") : ""));
  ok(svg && svg.texts.some(t => /Margaret/.test(t[0])) && svg.texts.some(t => /Maple House/.test(t[0])) && svg.images === A.images && A.images >= 1, `the name and the home are on it, and the same mark (${svg && svg.images} picture)`);
  await ctx.close();

  /* ---------- the caption, by day and in Night Shift ---------- */
  for (const night of [false, true]) for (const [w, h] of [[1366, 768], [390, 844]]) {
    const tag = `${w} px${night ? ", Night Shift" : ""}`;
    const o = await open(w, h, night);
    await save(o.p, "x.pdf", () => o.p.click("#go")); await o.p.waitForTimeout(300);
    const r = await o.p.evaluate(() => {
      const lum = c => { const m = c.match(/[\d.]+/g); const [r, g, b] = m.slice(0, 3).map(v => { v = v / 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
      const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor, m = c.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > .5)) return c; } return "rgb(255,255,255)"; };
      const fig = document.getElementById("pkLive"), sheet = document.getElementById("pkLiveSheet").getBoundingClientRect();
      const low = [...fig.querySelectorAll("figcaption span")].map(el => { const a = lum(getComputedStyle(el).color), b = lum(bgOf(el)); return [(Math.max(a, b) + .05) / (Math.min(a, b) + .05), el.textContent.slice(0, 20)]; }).filter(x => x[0] < 4.5);
      return { low, shown: !fig.hidden && sheet.width >= 120, sideways: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    ok(r.shown && r.low.length === 0 && !r.sideways, `${tag}: the picture shows and its caption is readable` + (r.low.length ? ": " + r.low.map(x => x[0].toFixed(2) + " " + x[1]).join("; ") : ""));
    await o.ctx.close();
  }
  ok(foreign.length === 0, "nothing is requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 2).join(", ") : ""));
  ok(errors.length === 0, "no script errors" + (errors.length ? ": " + [...new Set(errors)].slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); }

console.log(problems.length ? `stepped packet check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `stepped packet check passed: ${passed} checks in a real browser (page 1 shown in under 150 ms, then "Building page X of about N" and the PDF's own count; the same packet word for word made a page at a time, also slowed tenfold with other code drawing random numbers between the steps; the picture's lines where page 1 has them; a readable caption by day and in Night Shift; nothing leaving the page)`);
process.exit(problems.length ? 1 : 0);
