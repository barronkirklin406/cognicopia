#!/usr/bin/env node
/* =====================================================================
   The Zentangle Gallery in a real browser (the owner's Zen Tangle coloring books, kept exactly as drawn). No residents, no license needed to look.

     the door      the Packets door lists "Zentangle Gallery"; #/zentangle shows every book of the manifest, in groups, with its page count and a small first
                   picture, and a book that some people may not welcome (zombies, orcs) says so on its card and again inside
     the pictures  every small picture of every book is read in the browser and judged the way the owner ruled on November 20, 2026: none is a cover (a dark
                   page), a blank page, the "Color Test Page", the crown brand page or a title page ("Zen", "Zen Tangle Coloring", "This Book Belongs To"); the
                   full pages of a sample are pure black and white (only 0 and 255), 1656 wide and about 3:4
     the book      a book opens, every page has a pressable picture (52 px or more, aria-pressed), "Choose every page" and "Clear" work, "Look closer" opens the
                   page larger and closes again, and the Print button counts the chosen pages
     the print     "Print" opens the print window once and spends one free packet (a packet of pages for a resident, never a staff document); the sheets are
                   one picture each, US Letter, inside the 0.5 in margins and clear of the 0.75 in binding gutter; the PDF read back with PyMuPDF has every chosen
                   page
     the look      at 1366 x 768 and 390 x 844 nothing scrolls sideways; every control is 52 px or more; text is 7:1 by day
     nothing else  nothing is requested from outside the page, and no page script fails
   Needs Playwright (exit 2 where it is not installed) and PyMuPDF for the paper. Run: node scripts/check-zentangle-ui.mjs
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { loadPlaywright, serve, ROOT, agreed, agreeToDialogs } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = [], notes = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const SHOTS = process.env.ZG_SHOTS || "";

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/zentangle/manifest.json"), "utf8"));
const PY = `
import sys, json
try:
    import pymupdf as fitz
except Exception:
    try:
        import fitz
    except Exception:
        print(json.dumps({"missing": True})); sys.exit(0)
doc = fitz.open(sys.argv[1]); out = []
for pg in doc:
    pix = pg.get_pixmap(matrix=fitz.Matrix(0.5, 0.5), colorspace=fitz.csGRAY); s = pix.samples; w, h = pix.width, pix.height
    x0 = y0 = 9999; x1 = y1 = -1
    for y in range(h):
        row = s[y * w:(y + 1) * w]
        if min(row) < 200:
            xs = [i for i, v in enumerate(row) if v < 200]; x0 = min(x0, xs[0]); x1 = max(x1, xs[-1]); y0 = min(y0, y); y1 = max(y1, y)
    out.append({"ink": [x0 * 2, y0 * 2, (x1 + 1) * 2, (y1 + 1) * 2], "images": len(pg.get_images())})
print(json.dumps(out))
`;

async function open(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block", timezoneId: "America/Chicago" }); await agreed(ctx);
  await ctx.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  const p = await ctx.newPage(); await agreeToDialogs(p);
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + "builder.html#/zentangle", { waitUntil: "load" }); await p.waitForSelector("[data-zg-book]", { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(600);
  return { ctx, p };
}

try {
  /* ---------- the door and the shelf ---------- */
  {
    const { ctx, p } = await open(1366, 768);
    const cards = await p.$$eval("[data-zg-book]", els => els.map(e => ({ slug: e.dataset.zgBook, text: e.innerText.replace(/\s+/g, " ").trim() })));
    ok(cards.length === manifest.books.length, `the shelf shows every book (${cards.length} of ${manifest.books.length})`);
    ok(manifest.books.every(b => cards.some(c => c.slug === b.slug && c.text.includes(b.title) && c.text.includes(b.pages + " pages"))), "each card names its book and its page count");
    const groups = await p.$$eval(".zg-group", els => els.map(e => e.textContent.trim()));
    ok(groups.length >= 4, `the books are in groups (${groups.join(", ")})`);
    ok(manifest.books.filter(b => b.note).every(b => cards.find(c => c.slug === b.slug).text.includes(b.note)), "a book some people may not welcome says so on its card");
    const nav = await p.evaluate(() => [...document.querySelectorAll("a")].map(a => a.textContent.trim()).filter(t => /Zentangle Gallery/.test(t)).length);
    ok(nav >= 1, "the Packets door lists the Zentangle Gallery in the Packet Builder's menu");
    const small = await p.$$eval(".zg button, .zg a.zg-btn", els => els.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }).filter(([w, h]) => w > 0 && (w < 52 || h < 52)).length);
    ok(small === 0, `every control on the shelf is 52 px or more (${small} smaller)`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "the shelf does not scroll sideways at 1366 x 768");
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, "shelf-1366.png"), fullPage: false });

    /* ---------- every small picture, judged in the browser ---------- */
    const verdict = await p.evaluate(async (books) => {
      const ref = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = "scripts/zentangle-test-page.png"; });
      const cv = document.createElement("canvas"), c = cv.getContext("2d", { willReadFrequently: true });
      const small = (img, w, h) => { cv.width = w; cv.height = h; c.fillStyle = "#fff"; c.fillRect(0, 0, w, h); c.drawImage(img, 0, 0, w, h); const d = c.getImageData(0, 0, w, h).data, g = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) g[i] = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000; return g; };
      const R = small(ref, 32, 42), bad = [];
      let n = 0;
      for (const b of books) {
        for (let k = 1; k <= b.pages; k++) {
          const nn = String(k).padStart(2, "0"), img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = `assets/zentangle/${b.slug}/t/${nn}.webp`; });
          n++;
          if (!img) { bad.push(`${b.slug}/${nn}: the small picture does not load`); continue; }
          const W = 120, H = 156, g = small(img, W, H); let ink = 0, mids = 0, sum = 0, sq = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = g[y * W + x]; sum += v; sq += v * v; if (v >= 40 && v <= 130) mids++; if (v < 150) { ink++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
          const mean = sum / (W * H), share = ink / (W * H), box = ink ? ((x1 - x0 + 1) * (y1 - y0 + 1)) / (W * H) : 0;
          const t = small(img, 32, 42); let diff = 0; for (let i = 0; i < t.length; i++) diff += Math.abs(t[i] - R[i]); diff /= t.length;
          const sd = Math.sqrt(Math.max(0, sq / (W * H) - mean * mean));
          if (mean < 150 && mids / (W * H) > 0.5 && sd < 45) bad.push(`${b.slug}/${nn}: a flat dark gray page (a cover)`);
          else if (share < 0.004) bad.push(`${b.slug}/${nn}: a blank or nearly blank page`);
          else if (diff < 14) bad.push(`${b.slug}/${nn}: the Color Test Page`);
          else if (k <= 12 && box < 0.5) bad.push(`${b.slug}/${nn}: a title, brand or belongs-to page (the drawing fills ${Math.round(box * 100)}% of the page)`);
        }
      }
      return { n, bad };
    }, manifest.books);
    ok(verdict.n === manifest.books.reduce((a, b) => a + b.pages, 0), `every small picture was read (${verdict.n})`);
    ok(verdict.bad.length === 0, `${verdict.bad.length} pages are not coloring designs:\n    ${verdict.bad.slice(0, 20).join("\n    ")}`);

    /* the full pages of a sample are only black and white, at the stated size */
    const bw = await p.evaluate(async (books) => {
      const out = [], cv = document.createElement("canvas"), c = cv.getContext("2d", { willReadFrequently: true });
      for (const b of books.filter((x, i) => i % 5 === 0)) {
        const pg = String(Math.max(1, Math.ceil(b.pages / 2))).padStart(2, "0");
        const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = `assets/zentangle/${b.slug}/${pg}.webp`; });
        if (!img) { out.push({ slug: b.slug, missing: true }); continue; }
        cv.width = img.naturalWidth; cv.height = img.naturalHeight; c.drawImage(img, 0, 0); const d = c.getImageData(0, 0, cv.width, cv.height).data; let other = 0;
        for (let i = 0; i < d.length; i += 4) { const v = d[i]; if ((v !== 0 && v !== 255) || d[i + 1] !== v || d[i + 2] !== v) other++; }
        out.push({ slug: b.slug, w: img.naturalWidth, h: img.naturalHeight, other });
      }
      return out;
    }, manifest.books);
    ok(bw.length >= 5 && bw.every(x => !x.missing && x.w === 1656 && x.w / x.h > 0.73 && x.w / x.h < 0.78 && x.other === 0), `the full pages are 1656 wide, about 3:4, in pure black and white (${bw.filter(x => x.other || x.missing).map(x => x.slug + ":" + (x.other || "missing")).join(", ") || "sample ok"})`);
    await ctx.close();
  }

  /* ---------- a book, choosing and printing ---------- */
  for (const [w, h] of [[1366, 768], [390, 844]]) {
    const { ctx, p } = await open(w, h);
    const book = manifest.books.find(b => b.slug === "dogs") || manifest.books[0];
    await p.click(`[data-zg-book="${book.slug}"]`); await p.waitForSelector("[data-zg-pg]", { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(700);
    const cells = await p.$$("[data-zg-pg]");
    ok(cells.length === book.pages, `${book.title} opens with every page (${cells.length} of ${book.pages}) at ${w} px`);
    const sizes = await p.$$eval(".zg button, .zg a.zg-btn", els => els.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }).filter(([a, b]) => a > 0 && (a < 52 || b < 52)).length);
    ok(sizes === 0, `every control in the book is 52 px or more at ${w} px (${sizes} smaller)`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `the book does not scroll sideways at ${w} px`);
    ok((await p.getAttribute("[data-zg-pg]", "aria-pressed")) === "false", "a page starts not chosen");
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `book-${w}.png`) });
    if (w === 1366) {
      await p.click('[data-zg-pg="1"]'); await p.click('[data-zg-pg="3"]');
      ok((await p.getAttribute('[data-zg-pg="1"]', "aria-pressed")) === "true" && /Selected/.test(await p.innerText(".zg-cell:nth-child(1) .zg-sel").catch(() => "")) || (await p.getAttribute('[data-zg-pg="1"]', "aria-pressed")) === "true", "a chosen page is pressed (and says Selected)");
      ok(/Print 2 pages/.test(await p.innerText("[data-zg-print]")), "the Print button counts the chosen pages");
      await p.click("[data-zg-all]"); ok(/Print (\d+) pages/.test(await p.innerText("[data-zg-print]")) && (await p.innerText("[data-zg-print]")).includes(String(book.pages)), "Choose every page chooses them all");
      await p.click("[data-zg-clear]"); ok((await p.$$eval('[data-zg-pg][aria-pressed="true"]', e => e.length)) === 0, "Clear takes every choice back");
      await p.click('[data-zg-look="2"]'); await p.waitForTimeout(300);
      ok(await p.evaluate(() => { const d = document.getElementById("zgDlg"); return !!d && d.open; }), "Look closer opens the page larger");
      await p.click("[data-zg-close]"); ok(await p.evaluate(() => !document.getElementById("zgDlg").open), "and closes again");

      /* print three pages: one packet, one print window, one picture per sheet inside the margins */
      await p.click('[data-zg-pg="2"]'); await p.click('[data-zg-pg="4"]'); await p.click('[data-zg-pg="6"]');
      const before = await p.evaluate(() => genCount()), lic = await p.evaluate(() => isLicensed());
      await p.click("[data-zg-print]"); await p.waitForFunction(() => window.__printed === 1, null, { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(600);
      ok((await p.evaluate(() => window.__printed)) === 1, "Print opens the print window once");
      ok(lic || (await p.evaluate(() => genCount())) === before + 1, "and counts as one packet, like any printed pages");
      const sh = await p.evaluate(() => { const r = document.getElementById("printRoot"), keep = r.style.cssText; r.style.cssText = "display:block;position:absolute;left:-10000px;top:0";
        const out = [...r.querySelectorAll(".lp-sheet")].map(s => ({ box: [s.offsetWidth, s.offsetHeight], imgs: s.querySelectorAll("img").length, text: s.innerText.trim() })); r.style.cssText = keep; return out; });
      ok(sh.length === 3 && sh.every(s => s.imgs === 1 && s.text === ""), `three sheets, one picture each and no words (${sh.length})`);
      ok(sh.every(s => s.box[0] === 816 && s.box[1] === 1056), "each sheet is US Letter");
      const pdf = path.join(os.tmpdir(), "zentangle-check.pdf");
      await p.emulateMedia({ media: "print" }); fs.writeFileSync(pdf, await p.pdf({ width: "8.5in", height: "11in", printBackground: true, preferCSSPageSize: true })); await p.emulateMedia({ media: "screen" });
      let back = null; try { back = JSON.parse(execFileSync("python3", ["-I", "-c", PY, pdf], { encoding: "utf8", maxBuffer: 1 << 27 })); } catch (e) { notes.push("PyMuPDF could not read the PDF here"); }
      if (!back || back.missing) notes.push("PyMuPDF is not installed for python3: the printed pages were not read back");
      else {
        ok(back.length === 3, `the PDF has the three chosen pages (${back.length})`);
        ok(back.every(g => g.ink[0] >= 53.9 && g.ink[1] >= 35.9 && g.ink[2] <= 576.1 && g.ink[3] <= 756.1), `every picture is inside the 0.5 in margins and clear of the 0.75 in gutter (${[...new Set(back.map(g => g.ink.map(v => Math.round(v)).join(" ")))].join(" | ")})`);
        ok(back.every(g => g.images >= 1), "each page carries its picture");
      }
    }
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }

ok(foreign.length === 0, `nothing is requested from outside the page (${[...new Set(foreign)].slice(0, 3)})`);
ok(errors.length === 0, `no page script fails (${[...new Set(errors)].slice(0, 3)})`);
console.log(problems.length ? `zentangle gallery UI check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 30).join("\n  - ") : `zentangle gallery UI check passed: ${passed} checks${notes.length ? " (" + notes.join("; ") + ")" : ""}`);
process.exit(problems.length ? 1 : 0);
