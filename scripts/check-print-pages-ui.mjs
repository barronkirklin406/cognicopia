#!/usr/bin/env node
/* =====================================================================
   A page printed straight from the browser, in a real browser (Playwright; exit 2 where it is not installed).

   Pages that build their own sheets (the Packet Builder, the packet tool) are checked elsewhere. Every other page
   (prices, a policy, a guide for a binder, the resident profile) gets one print sheet from css/styles.css:

     - no navigation, sidebar, button or field to fill in is printed (a box that only shows a value, such as a
       license key, stays);
     - nothing is printed behind the words: a white page, no background picture or fill;
     - every word, tick and border is pure black, so a printer set to color or to black and white gives the same page;
     - on US Letter with 0.5 in margins and a 0.75 in binding gutter on the left (read back from a real PDF with PyMuPDF
       where it is installed);
     - the resident profile prints its words, and its pocket card still prints alone, when that card is asked for.

   Serves the repository on a free local port and requests nothing else.
   Run: node scripts/check-print-pages-ui.mjs
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { serve, loadPlaywright } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
let passed = 0; const problems = [], notes = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

const PAGES = ["pricing.html", "contact.html", "pilot.html", "faq.html", "about.html", "features.html", "referral.html", "profile.html", "clinical-alignment.html",
  "resources/privacy-and-data/index.html", "resources/security-questions/index.html", "resources/accessibility/index.html", "resources/index.html"];
const PDF_PAGES = ["pricing.html", "faq.html", "resources/privacy-and-data/index.html"];

const PY = `
import sys, json
try:
    import pymupdf as fitz
except Exception:
    try:
        import fitz
    except Exception:
        print(json.dumps({"missing": True})); sys.exit(0)
doc = fitz.open(sys.argv[1])
res = {"missing": False, "pages": doc.page_count, "w": doc[0].rect.width, "h": doc[0].rect.height}
dpi = 100; l = t = 1e9; r = b = 0; gray = True; colors = set()
for pg in doc:
    pix = pg.get_pixmap(dpi=dpi, colorspace=fitz.csRGB, alpha=False); w, h, s = pix.width, pix.height, pix.samples
    R, G, B = s[0::3], s[1::3], s[2::3]
    if not (R == G == B): gray = False
    white = b"\\xff" * w
    rows = [R[y*w:(y+1)*w] for y in range(h)]
    ys = [y for y in range(h) if rows[y] != white]
    if ys:
        t = min(t, ys[0] / dpi); b = max(b, (ys[-1] + 1) / dpi)
        l = min(l, min(len(rows[y]) - len(rows[y].lstrip(b"\\xff")) for y in ys) / dpi); r = max(r, max(len(rows[y].rstrip(b"\\xff")) for y in ys) / dpi)
    for blk in pg.get_text("dict")["blocks"]:
        for ln in blk.get("lines", []):
            for sp in ln["spans"]:
                if sp["text"].strip(): colors.add(sp["color"])
res.update(ink=[l, t, r, b] if r else None, gray=gray, textcolors=sorted(colors))
print(json.dumps(res))
`;

/* what a printed page must not show, measured in the page itself under print media */
const MEASURE = () => {
  document.getAnimations().forEach(a => { try { a.finish(); } catch (e) { /* an endless animation has no end to jump to */ } });
  const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden"; };
  const count = sel => [...document.querySelectorAll(sel)].filter(vis).length;
  const bg = e => getComputedStyle(e);
  let text = 0, notBlack = 0, filled = 0;
  document.querySelectorAll("body *").forEach(e => {
    if (!vis(e) || e.closest("svg")) return;
    if ([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) { text++; if (getComputedStyle(e).color !== "rgb(0, 0, 0)") notBlack++; }
    const c = getComputedStyle(e).backgroundColor; if (c !== "rgba(0, 0, 0, 0)" && c !== "rgb(255, 255, 255)" && e.tagName !== "TEXTAREA" && e.tagName !== "INPUT") filled++;
  });
  return {
    chrome: count("nav,.cg-sidebar,.cg-topbar,.cg-crumbs,.cg-menu-btn"),
    controls: count("button,[role=button],.btn,.cg-btn,select,input:not([readonly]):not([type=hidden]),textarea:not([readonly])"),
    htmlBg: bg(document.documentElement).backgroundColor, bodyBg: bg(document.body).backgroundColor,
    bgImage: bg(document.documentElement).backgroundImage !== "none" || bg(document.body).backgroundImage !== "none",
    text, notBlack, filled
  };
};

try {
  for (const pg of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: "block" });
    const p = await ctx.newPage(); const errors = [];
    p.on("pageerror", e => errors.push(e.message));
    await p.goto(base + pg); await p.waitForTimeout(700);
    await p.emulateMedia({ media: "print" });
    const m = await p.evaluate(MEASURE);
    ok(m.chrome === 0, `${pg}: no navigation, sidebar or top bar is printed (${m.chrome})`);
    ok(m.controls === 0, `${pg}: no button or field to fill in is printed (${m.controls})`);
    ok(m.htmlBg.replace(/\s/g, "") === "rgb(255,255,255)" && m.bodyBg.replace(/\s/g, "") === "rgb(255,255,255)" && !m.bgImage, `${pg}: a white page with no picture behind the words (${m.htmlBg} / ${m.bodyBg})`);
    ok(m.text > 5 && m.notBlack === 0, `${pg}: every printed word is pure black (${m.notBlack} of ${m.text} are not)`);
    ok(m.filled === 0, `${pg}: no colored fill behind the words (${m.filled})`);
    ok(errors.length === 0, `${pg}: no script error (${errors[0] || ""})`);
    await ctx.close();
  }

  /* a box that only shows a value keeps printing: the license key on the activation page */
  {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: "block" });
    const p = await ctx.newPage(); await p.goto(base + "activate.html"); await p.waitForTimeout(500);
    await p.evaluate(() => { const k = document.getElementById("actKey"); if (k) { k.style.display = "block"; k.closest("[hidden]")?.removeAttribute("hidden"); k.value = "EXAMPLE-KEY-NOT-REAL"; } });
    await p.emulateMedia({ media: "print" });
    const keep = await p.evaluate(() => { document.getAnimations().forEach(a => { try { a.finish(); } catch (e) { /* no end */ } }); const k = document.getElementById("actKey"); if (!k) return null; const cs = getComputedStyle(k); return { display: cs.display, color: cs.color }; });
    ok(keep && keep.display !== "none" && keep.color === "rgb(0, 0, 0)", `activate.html: a read-only license key box stays on the printed page, in black (${JSON.stringify(keep)})`);
    await ctx.close();
  }

  /* the resident profile prints its words; its pocket card still prints alone when it is asked for */
  {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: "block" });
    const p = await ctx.newPage(); await p.goto(base + "profile.html"); await p.waitForTimeout(700);
    await p.emulateMedia({ media: "print" });
    const words = await p.evaluate(() => { const h = document.querySelector(".rap-hero h1"); return h ? { vis: getComputedStyle(h).visibility, disp: getComputedStyle(h).display } : null; });
    ok(words && words.vis === "visible" && words.disp !== "none", "profile.html: printing the page prints its words, not a blank sheet");
    const asked = await p.evaluate(() => {
      window.__printCalls = [];
      window.print = () => { const a = document.getElementById("plcPrintArea"); window.__printCalls.push({ cls: document.documentElement.classList.contains("plc-printing"), shown: a && a.style.display }); };
      try { window.CogniPocketLanyard.open({ firstName: "Sample" }); } catch (e) { return "open threw: " + e.message; }
      document.getElementById("plcPrint").click();
      return window.__printCalls[0] || "print was not called";
    });
    ok(asked && asked.cls === true && asked.shown === "block", `profile.html: Print Card opens the card's own print on the first press (${JSON.stringify(asked)})`);
    const alone = await p.evaluate(() => {
      document.documentElement.classList.add("plc-printing");
      const a = document.getElementById("plcPrintArea"); a.style.display = "block";
      document.getAnimations().forEach(x => { try { x.finish(); } catch (e) { /* no end */ } });
      return { card: getComputedStyle(a).visibility, rap: getComputedStyle(document.querySelector(".rap")).visibility };
    });
    ok(alone.card === "visible" && alone.rap === "hidden", `profile.html: asked for, the pocket card prints alone (card ${alone.card}, page ${alone.rap})`);
    await ctx.close();
  }

  /* a Packet Builder page keeps its own print rules: the generic sheet does not reach it */
  {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: "block" });
    const p = await ctx.newPage(); await p.goto(base + "builder.html"); await p.waitForTimeout(900);
    await p.emulateMedia({ media: "print" });
    const own = await p.evaluate(() => { const r = document.getElementById("printRoot"); return r ? getComputedStyle(r).display : null; });
    ok(own === "block", `builder.html: only its own print root prints (${own})`);
    await ctx.close();
  }

  /* real PDFs: US Letter, margins and gutter, pure black on white */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-print-"));
  try {
    let read = 0;
    for (const pg of PDF_PAGES) {
      const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: "block" });
      const p = await ctx.newPage(); await p.goto(base + pg); await p.waitForTimeout(700); await p.emulateMedia({ media: "print" });
      const file = path.join(tmp, "page.pdf");
      fs.writeFileSync(file, await p.pdf({ preferCSSPageSize: true, printBackground: true }));
      await ctx.close();
      const py = spawnSync("python3", ["-I", "-c", PY, file], { encoding: "utf8", timeout: 60000 });
      let r = null; try { r = JSON.parse(py.stdout.trim().split("\n").pop()); } catch (e) { /* reported below */ }
      if (!r) { problems.push(`${pg}: the PDF could not be read back: ${(py.stderr || py.stdout).trim().slice(0, 200)}`); continue; }
      if (r.missing) { notes.push("PyMuPDF is not installed for python3: the printed pages were not measured (pip install pymupdf)"); break; }
      const [l, t, rt, b] = r.ink;
      ok(Math.abs(r.w - 612) < .01 && Math.abs(r.h - 792) < .01, `${pg}: prints on US Letter (${r.w} x ${r.h} pt)`);
      ok(l >= 1.25 - .03 && t >= .5 - .03 && rt <= 8.0 + .03 && b <= 10.5 + .03, `${pg}: ink stays inside the 0.5 in margins and the 0.75 in gutter (left ${l.toFixed(2)} in of 1.25, top ${t.toFixed(2)}, right ${rt.toFixed(2)} of 8.00, bottom ${b.toFixed(2)} of 10.50)`);
      ok(r.gray && r.textcolors.every(c => c === 0), `${pg}: pure black on pure white, no color (${r.textcolors.join(", ")})`);
      read++;
    }
    if (read === PDF_PAGES.length) notes.push(`${read} pages printed to PDF and read back with PyMuPDF`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
} finally { await browser.close(); srv.close(); }

const extra = notes.length ? ` [${notes.join("; ")}]` : "";
console.log(problems.length ? `print pages check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ") : `print pages check passed: ${passed} checks in a real browser (${PAGES.length} pages printed with no navigation, buttons or fields, a white page, pure black, margins and a binding gutter; the resident profile prints its words and its pocket card alone when asked)${extra}`);
process.exit(problems.length ? 1 : 0);
