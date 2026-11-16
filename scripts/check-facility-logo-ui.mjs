#!/usr/bin/env node
/* =====================================================================
   The facility logo on the monthly bundle, proved in a real browser.
     1. js/facility-logo.js on its own: sizes keep their shape and never grow, transparent pixels count as white, a colour or gray
        picture becomes pure black and white, a damaged saved logo is no logo, and nothing is kept that is not a small two-tone PNG.
     2. The bundle's dialog: a coloured logo is chosen, shown as it will print (black and white), kept across a reload, refused when it is
        the wrong kind of file, too big, blank or a solid block, and removed on request. Every control is 52 px.
     3. The PDF, read back with PyMuPDF: the logo is on the index page and on every resident's cover sheet, every pixel of it is pure
        black or white, it is not drawn over any text, and with no logo the bundle has the same pages as before.
     4. Nothing leaves the page: no request outside the site's own files.
   Needs Playwright (and PyMuPDF for part 3; without it that part is skipped with a note). Exits 2 where Playwright is missing,
   and npm run build skips it. Run: node scripts/check-facility-logo-ui.mjs
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";
import { spawnSync } from "child_process";
import { loadPlaywright, serve, ROOT } from "./lib/browser.mjs";

const problems = [], notes = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

/* ---------- 1. the module, on its own ---------- */
{
  const store = new Map();
  const ctx = vm.createContext({ globalThis: null, localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) } });
  ctx.globalThis = ctx; ctx.window = undefined;
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js/facility-logo.js"), "utf8"), ctx, { filename: "js/facility-logo.js" });
  const L = vm.runInContext("CogniFacilityLogo", ctx);

  ok(JSON.stringify(L.fit(1440, 600, 720, 300)) === JSON.stringify({ w: 720, h: 300 }), "a big picture shrinks to the box, keeping its shape");
  ok(JSON.stringify(L.fit(100, 40, 720, 300)) === JSON.stringify({ w: 100, h: 40 }), "a small picture is never enlarged");
  ok(JSON.stringify(L.fit(300, 900, 720, 300)) === JSON.stringify({ w: 100, h: 300 }), "a tall picture is limited by its height");
  ok(L.fit(0, 10, 720, 300).w === 0 && L.fit(NaN, 10, 720, 300).h === 0, "a picture with no size gets none");

  const px = (...rows) => Uint8ClampedArray.from(rows.flat());
  const data = px([0, 0, 0, 255], [255, 255, 255, 255], [200, 30, 30, 255], [255, 220, 100, 255], [0, 0, 0, 0], [0, 0, 0, 128], [150, 150, 150, 255], [100, 100, 100, 255]);
  const share = L.blackWhite(data);
  const v = i => data[i * 4];
  ok(v(0) === 0 && v(1) === 255, "black stays black, white stays white");
  ok(v(2) === 0, "a dark red becomes black");
  ok(v(3) === 255, "a pale yellow becomes white");
  ok(v(4) === 255, "a see-through pixel is white paper, not black");
  ok(v(5) === 255 || v(5) === 0, "a half see-through black is one or the other, never gray");
  ok(v(6) === 255 && v(7) === 0, "mid grays go to the nearer side of the threshold (150 white, 100 black)");
  ok(Array.from({ length: 8 }, (_, i) => data[i * 4 + 3]).every(a => a === 255) && Array.from(data).every((b, i) => i % 4 === 3 || b === 0 || b === 255), "every pixel ends pure black or pure white and fully opaque");
  ok(share > 0.3 && share < 0.7, `the share of ink is reported (${share})`);

  const png = "data:image/png;base64," + Buffer.from("not really a png but base64").toString("base64");
  ok(L.save({ dataUrl: png, w: 100, h: 50 }) === true && L.load() && L.load().w === 100, "a small two-tone PNG is kept and read back");
  ok(!L.save({ dataUrl: "data:image/svg+xml;base64,AAAA", w: 100, h: 50 }) && !L.save({ dataUrl: "javascript:alert(1)", w: 1, h: 1 }), "nothing but a PNG data address is kept");
  ok(!L.save({ dataUrl: png, w: 0, h: 50 }) && !L.save({ dataUrl: png, w: 5000, h: 50 }) && !L.save({ dataUrl: png, w: 1.5, h: 50 }), "a size outside the box is refused");
  ok(!L.save({ dataUrl: "data:image/png;base64," + "A".repeat(500 * 1024), w: 100, h: 50 }), "a logo too large to keep is refused");
  store.set("cognicopia_branding_logo", "{not json"); ok(L.load() === null, "a damaged saved logo is no logo, and nothing throws");
  store.set("cognicopia_branding_logo", JSON.stringify({ dataUrl: "data:image/png;base64,<script>", w: 10, h: 10 })); ok(L.load() === null, "a saved logo that is not base64 is no logo");
  L.save({ dataUrl: png, w: 100, h: 50 }); L.clear(); ok(L.load() === null, "a logo can be removed");
  const size = L.pdfSize({ w: 720, h: 300 }, 2.4, 0.95);
  ok(Math.abs(size.w / size.h - 2.4) < 0.001 && size.h <= 0.95 * 72 + 0.01 && size.w <= 2.4 * 72 + 0.01, "the printed size keeps the shape and fits the box");
  ok(Object.isFrozen(L), "the module cannot be changed from a page");
}

/* ---------- 2 to 4. the dialog and the PDF, in a browser ---------- */
const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-logo-"));
const foreign = [], errors = [];

const prof = (id, name, tier, hobby) => ({ schema: "cognicopia.residentProfile", version: 2, id, createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-09-01T10:00:00Z",
  tier1_core: { preferredName: name, unitNumber: "Test 1", cognitiveTier: tier, visualNeeds: null, occupation: { code: "teacher", label: "Teacher" }, topHobbies: hobby.map(h => ({ code: h.toLowerCase(), label: h })), printNeeds: {}, topicsToAvoid: { topics: [], other: "" } },
  tier2_enrichment: { birthYear: 1938, hometown: { place: "Test City" } }, tier3_deep: { notes: "", people: [] } });
const RESIDENTS = [prof("res-a", "Alma", 2, ["Singing", "Gardening"]), prof("res-c", "Cora", 3, ["Radio"])];

/* a coloured logo: a gold sun with a green ring and dark navy letters on a pale blue field, as a real PNG made in the page */
const makeLogo = (page, kind) => page.evaluate(async kind => {
  const c = document.createElement("canvas"); c.width = 900; c.height = 360; const x = c.getContext("2d");
  if (kind === "blank") { x.fillStyle = "#fff"; x.fillRect(0, 0, 900, 360); }
  else if (kind === "solid") { x.fillStyle = "#101820"; x.fillRect(0, 0, 900, 360); }
  else {
    x.fillStyle = "#dff0ff"; x.fillRect(0, 0, 900, 360);
    x.fillStyle = "#f2b705"; x.beginPath(); x.arc(150, 180, 110, 0, 7); x.fill();
    x.strokeStyle = "#1f6f3f"; x.lineWidth = 26; x.beginPath(); x.arc(150, 180, 140, 0, 7); x.stroke();
    x.fillStyle = "#14213d"; x.font = "bold 120px Arial"; x.fillText("MAPLE", 330, 150); x.fillText("COURT", 330, 290);
  }
  const blob = await new Promise(r => c.toBlob(r, "image/png"));
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}, kind);

const PY = `
import sys, json
try:
    import pymupdf as fitz
except Exception:
    try:
        import fitz
    except Exception:
        print(json.dumps({"missing": True})); sys.exit(0)
doc = fitz.open(sys.argv[1]); out = {"pages": len(doc), "logos": [], "impure": 0, "overlap": 0, "where": [], "text": []}
for i, pg in enumerate(doc):
    imgs = pg.get_images(full=True)
    for im in imgs:
        xref = im[0]
        rects = pg.get_image_rects(xref)
        if not rects: continue                                  # jsPDF lists every picture in every page's resources; only one drawn on the page counts
        pix = fitz.Pixmap(doc, xref)
        if pix.width != int(sys.argv[2]) or pix.height != int(sys.argv[3]): continue    # only the facility's own picture (the Cognicopia mark and other art are other sizes)
        if pix.n - pix.alpha >= 3: pix = fitz.Pixmap(fitz.csGRAY, pix)
        vals = set(pix.samples[k] for k in range(0, len(pix.samples), max(1, pix.n)))
        out["logos"].append({"page": i + 1, "w": pix.width, "h": pix.height, "values": sorted(vals)[:4], "rect": [round(v, 1) for v in rects[0]] if rects else None})
        if not vals <= {0, 255}: out["impure"] += 1
        if rects:
            for b in pg.get_text("dict")["blocks"]:
                for l in b.get("lines", []):
                    for s in l["spans"]:
                        r = fitz.Rect(s["bbox"]) & rects[0]
                        if s["text"].strip() and r.width > 2 and r.height > 2:
                            out["overlap"] += 1; out["where"].append([i + 1, s["text"][:30], [round(v) for v in s["bbox"]], [round(v) for v in rects[0]]])
    out["text"].append(pg.get_text()[:80].replace("\\n", " | "))
print(json.dumps(out))
`;
let LOGO_W = 0, LOGO_H = 0;
const readPdf = file => { const r = spawnSync("python3", ["-I", "-c", PY, file, String(LOGO_W), String(LOGO_H)], { encoding: "utf8", timeout: 90000 }); try { return JSON.parse(r.stdout); } catch (e) { return { missing: true }; } };

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, serviceWorkers: "block" });
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message));
  p.on("dialog", d => d.accept());                      // "export data for ALL residents. Proceed?"
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith("data:") && !u.startsWith("blob:")) foreign.push(u); });
  await p.goto(base + "index.html"); await p.waitForTimeout(500);
  await p.evaluate(list => { window.print = () => {}; list.forEach(x => localStorage.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))); localStorage.setItem("cognicopia_gen_count", "0"); }, RESIDENTS);
  await p.reload(); await p.waitForTimeout(500);

  const open = async () => { await p.evaluate(() => { window.unlocked = () => true; }); await p.click("#mbOpen");  // the bundle is a facility feature; this check is about the logo, so the computer counts as licensed
    await p.waitForSelector("#monthly-bundle-modal[open]"); };
  await open();
  ok(await p.isHidden("#mbLogoRow"), "with no logo chosen there is no preview and no Remove button");
  ok(/never sent anywhere/.test(await p.textContent("#mbLogoMsg")) && /not a photo of a person/.test(await p.textContent("#mbLogoMsg")), "the dialog says the logo stays on this computer and is not a photo of a person");
  const box = async sel => p.$eval(sel, e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  ok((await box("#mbLogo"))[1] >= 52, "the file chooser is at least 52 px tall");

  /* refusals */
  const send = async (name, mime, bytes) => { await p.setInputFiles("#mbLogo", { name, mimeType: mime, buffer: Buffer.from(bytes) }); await p.waitForFunction(() => !/Preparing/.test(document.getElementById("mbLogoMsg").textContent), null, { timeout: 8000 }); return (await p.textContent("#mbLogoMsg")).trim(); };
  ok(/PNG, JPEG, WebP or GIF/.test(await send("logo.svg", "image/svg+xml", "<svg xmlns='http://www.w3.org/2000/svg'/>")), "an SVG file is refused with a sentence (it can carry script)");
  ok(/PNG, JPEG, WebP or GIF/.test(await send("notes.pdf", "application/pdf", "%PDF-1.4")), "a PDF is refused");
  ok(/could not be read/.test(await send("broken.png", "image/png", "this is not a picture")), "a file that is not really a picture is refused");
  ok(/over 2 MB/.test(await send("huge.png", "image/png", Buffer.alloc(2 * 1024 * 1024 + 1))), "a file over 2 MB is refused");
  ok(/nearly all white/.test(await send("blank.png", "image/png", await makeLogo(p, "blank"))), "a blank picture is refused");
  ok(/black block/.test(await send("solid.png", "image/png", await makeLogo(p, "solid"))), "a solid dark picture is refused");
  ok(await p.isHidden("#mbLogoRow") && (await p.evaluate(() => localStorage.getItem("cognicopia_branding_logo"))) === null, "none of those refusals kept anything");
  ok(await p.evaluate(() => document.getElementById("mbLogoMsg").classList.contains("mb-bad")), "a refusal is shown in the warning style");

  /* the good one */
  ok(/Logo saved/.test(await send("maple.png", "image/png", await makeLogo(p, "good"))), "a coloured logo is accepted");
  ok(await p.isVisible("#mbLogoRow") && (await p.$eval("#mbLogoPreview", i => i.naturalWidth)) > 100, "the preview shows the logo");
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem("cognicopia_branding_logo")));
  ok(stored && /^data:image\/png;base64,/.test(stored.dataUrl) && stored.w <= 720 && stored.h <= 300 && stored.w / stored.h > 2.3 && stored.w / stored.h < 2.7, `the kept logo is a small PNG that keeps its shape (${stored && stored.w}x${stored && stored.h})`);
  LOGO_W = stored.w; LOGO_H = stored.h;
  const pure = await p.evaluate(async url => { const i = new Image(); i.src = url; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const x = c.getContext("2d"); x.drawImage(i, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let bad = 0, black = 0; for (let k = 0; k < d.length; k += 4) { if (!((d[k] === 0 || d[k] === 255) && d[k] === d[k + 1] && d[k] === d[k + 2] && d[k + 3] === 255)) bad++; if (d[k] === 0) black++; } return { bad, black: black / (d.length / 4) }; }, stored.dataUrl);
  ok(pure.bad === 0 && pure.black > 0.05 && pure.black < 0.5, `the kept picture is pure black and white (${pure.bad} other pixels, ${(pure.black * 100).toFixed(0)}% ink)`);
  ok((await box("#mbLogoClear"))[1] >= 52, "the Remove button is at least 52 px tall");
  await p.keyboard.press("Escape");

  /* it is kept across a reload */
  await p.reload(); await p.waitForTimeout(500); await open();
  ok(await p.isVisible("#mbLogoRow"), "the logo is still there after a reload");

  /* the PDF with the logo */
  await p.fill("#mbFac", "Maple Court");
  const download = async () => { const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 120000 }), p.click("#mbGo")]); const f = path.join(tmp, `bundle-${Date.now()}.pdf`); await dl.saveAs(f); return f; };
  const withLogo = readPdf(await download());
  if (withLogo.missing) notes.push("PyMuPDF is not installed for python3: the PDF was not read back (pip install pymupdf)");
  else {
    const pages = [...new Set(withLogo.logos.map(l => l.page))];
    ok(pages.length === 3, `the logo is on the index page and on both residents' cover sheets (pages ${pages.join(", ")})`);
    ok(pages[0] === 1, "the first page is the index, and it carries the logo");
    ok(withLogo.impure === 0, `every pixel of the printed logo is pure black or white (${withLogo.impure} pictures with other values)`);
    ok(withLogo.overlap === 0, `the logo is not drawn over any text (${withLogo.overlap} overlaps: ${JSON.stringify(withLogo.where)})`);
    ok(withLogo.logos.every(l => l.rect && l.rect[0] >= 36 && l.rect[2] <= 612 - 36 && l.rect[1] >= 30), "the logo is inside the margins");
    ok(withLogo.logos.every(l => Math.abs((l.rect[2] - l.rect[0]) / (l.rect[3] - l.rect[1]) - l.w / l.h) < 0.05), "the logo keeps its shape on paper");
    ok(/Monthly Activity Bundle/.test(withLogo.text[0]), "the index still says what it is");

    /* and without it */
    await open(); await p.click("#mbLogoClear");
    ok(await p.isHidden("#mbLogoRow") && (await p.evaluate(() => localStorage.getItem("cognicopia_branding_logo"))) === null, "Remove forgets the logo");
    await p.fill("#mbFac", "Maple Court");
    const without = readPdf(await download());
    ok(without.logos.length === 0, `with no logo no picture is added (${without.logos.length})`);
    ok(without.pages === withLogo.pages, `the bundle has the same pages with and without a logo (${without.pages} and ${withLogo.pages})`);
  }
  ok(foreign.length === 0, "nothing was requested from outside the site: " + foreign.slice(0, 2).join(", "));
  ok(errors.length === 0, "no page errors: " + errors.slice(0, 2).join(" | "));
  await ctx.close();
} catch (e) {
  problems.push("the check stopped: " + String(e.message || e).split("\n").slice(0, 3).join(" / "));
} finally {
  await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
}

if (problems.length) { console.error(`facility logo check FAILED: ${problems.length} problem(s), ${passed} passed`); problems.forEach(m => console.error("  - " + m)); process.exit(1); }
console.log(`facility logo check passed: ${passed} checks (the module's rules, the dialog's refusals and preview, a coloured logo printed in pure black and white on the index and every cover sheet and read back from the PDF, nothing leaving the page)${notes.length ? " [" + notes.join("; ") + "]" : ""}`);
