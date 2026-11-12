#!/usr/bin/env node
/* =====================================================================
   The Activity Page Studio's PDF is real text and real lines: in a real
   browser, each file read back with PyMuPDF.

   js/utils/studio-pdf.js draws each page's steps into the PDF as shapes and
   text in the page's own faces. This check makes the same pages both ways,
   the new way and as the picture the PDF used to hold, and compares them.

     words      every word on the page can be read back out of the file, in order
     faces      the page's faces are embedded in the file: Atkinson Hyperlegible, the monospaced cut for a letter
                grid, and the two script faces for a name
     lines      no black line is under 2 pt; nothing is drawn outside the 0.5 in margins; pure black and white
     the same   printed at 100 dpi, the new page and the picture of it agree, pixel for pixel, within 3 in 100
     small      the file is at most a tenth the size of the picture version
     every kind all 24 kinds of page at the three stages, the three hand settings, both script names, a coloring
                page from the library and the binding gutter are drawn this way: none needs a picture
     falls back a page with a letter its face does not hold goes in as a picture, alone, and the screen says so
     a photo    a who's who page with a photograph keeps the photograph inside its frame
     daily      the daily card's PDF is made the same way
     private    the PDF maker's faces come from this site; nothing is requested from outside; no script errors
   Made-up people only. Needs Playwright and PyMuPDF. Run: node scripts/check-studio-pdf-ui.mjs
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
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "cg-studio-pdf-"));

/* read a pair of files back: the new one, and the picture version of the same pages */
const PY = `
import sys, json
try:
    import pymupdf as fitz
except ImportError:
    import fitz
v = fitz.open(sys.argv[1]); p = fitz.open(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2] != "-" else None; out = []
for i, pg in enumerate(v):
    words = [w for w in pg.get_text("words") if w[3] > 34]                      # the non-medical line in the top margin aside
    draws = pg.get_drawings()
    marks = [w[:4] for w in words] + [list(d["rect"]) for d in draws]
    widths = [d["width"] for d in draws if d.get("width") and d.get("color") not in (None, (1, 1, 1))]
    colors = set()
    for d in draws:
        for c in (d.get("color"), d.get("fill")):
            if c is not None: colors.add(tuple(round(x, 2) for x in c))
    for b in pg.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                if s["text"].strip(): colors.add("text:%06x" % s["color"])
    diff = None
    if p is not None:
        a = pg.get_pixmap(dpi=100, colorspace=fitz.csGRAY).samples; b = p[i].get_pixmap(dpi=100, colorspace=fitz.csGRAY).samples
        diff = sum(1 for x, y in zip(a, b) if (x < 128) != (y < 128)) / len(a)
    out.append({"words": [w[4] for w in sorted(words, key=lambda w: (w[5], w[6], w[7]))], "faces": sorted(set(f[3] for f in pg.get_fonts(full=True) if f[1] != "n/a")),
      "images": [[round(x, 1) for x in im["bbox"]] for im in pg.get_image_info()], "thin": min(widths, default=0),
      "ink": [min([m[0] for m in marks], default=0), min([m[1] for m in marks], default=0), max([m[2] for m in marks], default=0), max([m[3] for m in marks], default=0)],
      "colors": sorted(str(c) for c in colors), "diff": diff, "w": pg.rect.width, "h": pg.rect.height, "legal": "Not Medical Advice" in pg.get_text()})
print(json.dumps(out))`;
let pymupdf = true;
const read = (a, b) => { try { return JSON.parse(execFileSync("python3", ["-c", PY, a, b || "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })); } catch (e) { if (/No module named/.test(String(e.stderr || e.message))) { pymupdf = false; return null; } throw e; } };

try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } });
  const watch = pg => { pg.on("pageerror", e => errors.push(e.message)); pg.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); }); pg.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); }); };
  const p = await ctx.newPage(); watch(p);
  await p.goto(base + "activity-studio.html", { waitUntil: "load" }); await p.waitForSelector("#asSheet svg", { timeout: 10000 }); await p.waitForTimeout(900);
  ok(await p.evaluate(() => !!window.CognicopiaStudioPdf && !window.jspdf.jsPDF.__atkinson && !window.CognicopiaPdfFaces), "the PDF maker's faces are not loaded until a PDF is asked for");

  /* the same pages both ways: what the engine makes for one made-up person, every kind of page at every stage */
  const both = async (name, spec) => {
    const r = await p.evaluate(async spec => {
      const E = window.CognicopiaActivityEngine, PL = window.CognicopiaColoringPipeline, SP = window.CognicopiaStudioPdf, pages = [], names = [], said = [];
      const P = Object.assign({ dexterity: "steady", name: "Dorothy", born: 1938, vocation: "teacher", interests: "gardening, baking", nameStyle: "plain", decade: 1950 }, spec.profile || {});
      (spec.mods || E.modules().map(m => m.id)).forEach(m => (spec.stages || [1, 2, 3]).forEach(stage => {
        let g; try { g = E.generate(Object.assign({}, P, { stage }), { module: m, count: 1, seed: spec.seed || 7 }); } catch (e) { return; }
        (g.sheets || []).forEach(sh => { let o; try { o = PL.sheetPages(sh, "full"); } catch (e) { return; } o.pages.forEach(pg => { pages.push(pg); names.push(m + " at stage " + stage); said.push(pg.ops.filter(op => op.t === "text").map(op => op.str).join(" ").split(/\s+/).filter(Boolean)); }); });
      }));
      if (spec.coloring) spec.coloring.forEach(stage => { const c = PL.chooseSubject({ style: "botanical", text: "", stage, seed: 11, variant: 0, avoid: [] }); if (!c.asset) return;
        const pg = PL.composeColoring(c.asset, PL.subjectPaths(c.asset.id), { stage, dexterity: "steady", name: "Dorothy", nameStyle: "plain", code: "T-" + stage });
        pages.push(pg); names.push("a coloring page at stage " + stage); said.push(pg.ops.filter(op => op.t === "text").map(op => op.str).join(" ").split(/\s+/).filter(Boolean)); });
      await Promise.all(['400 40px "Atkinson Hyperlegible"', '700 40px "Atkinson Hyperlegible"', '700 40px "Atkinson Hyperlegible Mono"', '40px "Pinyon Script"', '40px "Marck Script"'].map(f => document.fonts.load(f))); await document.fonts.ready;
      const t0 = performance.now(), v = await SP.make(pages, { gutter: !!spec.gutter }), t1 = performance.now(), pic = spec.noPicture ? null : await SP.make(pages, { pictures: true, gutter: !!spec.gutter }), t2 = performance.now();
      const b64 = d => d.output("datauristring").split(",")[1];
      return { names, said, vector: v.vector, picture: v.picture, msNew: Math.round(t1 - t0), msOld: Math.round(t2 - t1), v: b64(v.doc), p: pic ? b64(pic.doc) : "", paths: pages.map(pg => pg.ops.filter(op => op.t === "path").length) };
    }, spec);
    const a = path.join(DIR, name + "-new.pdf"), b = path.join(DIR, name + "-old.pdf");
    fs.writeFileSync(a, Buffer.from(r.v, "base64")); if (r.p) fs.writeFileSync(b, Buffer.from(r.p, "base64"));
    return Object.assign(r, { file: a, old: r.p ? b : "", kbNew: fs.statSync(a).size / 1024, kbOld: r.p ? fs.statSync(b).size / 1024 : 0, back: read(a, r.p ? b : "") });
  };
  const norm = w => w.join(" ").replace(/\s+/g, " ").trim();

  const all = await both("all", {});
  ok(all.names.length >= 50 && all.vector === all.names.length && all.picture === 0, `every kind of page at every stage is drawn as text and lines: ${all.vector} of ${all.names.length} pages, ${all.picture} as pictures`);
  ok(await p.evaluate(() => !!window.jspdf.jsPDF.__atkinson && !!window.CognicopiaPdfFaces), "the faces were loaded when the PDF was made, from this site");
  if (all.back) {
    const lost = all.back.map((g, i) => norm(g.words) === norm(all.said[i]) ? "" : all.names[i]).filter(Boolean);
    ok(lost.length === 0, `every word on every page reads back out of the file, in order (${all.back.reduce((n, g) => n + g.words.length, 0)} words)` + (lost.length ? "; not these: " + lost.slice(0, 4).join(", ") : ""));
    ok(all.back.every(g => g.faces.includes("AtkinsonHyperlegible")) && all.back.some(g => g.faces.includes("AtkinsonHyperlegibleMono")), `Atkinson Hyperlegible is embedded in every page, and its monospaced cut where there is a letter grid (${[...new Set(all.back.flatMap(g => g.faces))].join(", ")})`);
    ok(all.back.every(g => g.images.length === 0), "no page holds a picture");
    const thin = Math.min(...all.back.map(g => g.thin || 99));
    ok(thin >= 2, `no black line is under 2 pt (the thinnest is ${thin.toFixed(2)} pt)`);
    const out = all.back.map((g, i) => g.ink[0] >= 35.9 && g.ink[1] >= 35.9 && g.ink[2] <= 576.1 && g.ink[3] <= 756.1 ? "" : all.names[i] + " " + g.ink.map(Math.round).join(",")).filter(Boolean);
    ok(out.length === 0, "nothing is drawn outside the 0.5 in margins" + (out.length ? ": " + out.slice(0, 3).join("; ") : ""));
    const odd = [...new Set(all.back.flatMap(g => g.colors))].filter(c => !/^\((0\.0, 0\.0, 0\.0|1\.0, 1\.0, 1\.0|0\.0|1\.0)\)$|^\(0\.0,\)$|^\(1\.0,\)$|^text:000000$/.test(c));
    ok(odd.length === 0, "every mark is pure black or pure white" + (odd.length ? ": " + odd.slice(0, 4).join(" ") : ""));
    ok(all.back.every(g => Math.round(g.w) === 612 && Math.round(g.h) === 792 && g.legal), "each page is US Letter and carries the non-medical line in its top margin");
    const worst = all.back.map((g, i) => [g.diff, all.names[i]]).sort((a, b) => b[0] - a[0])[0], mean = all.back.reduce((n, g) => n + g.diff, 0) / all.back.length;
    ok(worst[0] < 0.03, `printed at 100 dpi the new page and the picture of it agree: the furthest apart differ in ${(worst[0] * 100).toFixed(2)} of 100 dots (${worst[1]}), ${(mean * 100).toFixed(2)} on average`);
  }
  ok(all.kbNew * 10 <= all.kbOld, `the file is ${Math.round(all.kbNew)} KB where the picture version is ${Math.round(all.kbOld)} KB`);
  ok(all.msNew * 3 < all.msOld, `and it is made in ${all.msNew} ms where the pictures took ${all.msOld} ms`);

  /* hands, script names, a library drawing, the gutter */
  for (const dex of ["limited", "minimal"]) { const r = await both("hands-" + dex, { profile: { dexterity: dex }, stages: [2, 3], mods: ["reminiscence", "wordgrid", "memory", "whoswho", "songs", "comfort", "rhythm", "myday"] });
    ok(r.vector === r.names.length && r.picture === 0 && (!r.back || Math.max(...r.back.map(g => g.diff)) < 0.03), `larger pages for ${dex} hands are drawn the same way (${r.vector} pages${r.back ? ", at most " + (Math.max(...r.back.map(g => g.diff)) * 100).toFixed(2) + " of 100 dots apart" : ""})`); }
  /* high spacing / low visual crowding: fewer items, a bold box round each, still real text and lines, pure black and white, inside the margins */
  { const r = await both("roomy", { profile: { roomy: true }, stages: [1, 2, 3], mods: ["reminiscence", "exercise", "daily", "wordgrid", "timeline", "memory", "dialogue", "household", "phrases", "recognition", "rhythm", "lifestory", "whoswho", "mytrade", "hometown", "songs", "dish", "comfort", "wordplay", "myday"] });
    ok(r.names.length >= 40 && r.vector === r.names.length && r.picture === 0, `with high spacing every page is still text and lines, no picture (${r.vector} of ${r.names.length} pages)`);
    if (r.back) {
      const lost = r.back.map((g, i) => norm(g.words) === norm(r.said[i]) ? "" : r.names[i]).filter(Boolean);
      ok(lost.length === 0, "with high spacing every word reads back out of the file, in order" + (lost.length ? "; not these: " + lost.slice(0, 4).join(", ") : ""));
      ok(Math.min(...r.back.map(g => g.thin || 99)) >= 2, "with high spacing no black line is under 2 pt");
      ok(r.back.every(g => g.ink[0] >= 35.9 && g.ink[1] >= 35.9 && g.ink[2] <= 576.1 && g.ink[3] <= 756.1), "with high spacing nothing is drawn outside the 0.5 in margins");
      ok([...new Set(r.back.flatMap(g => g.colors))].every(c => /^\((0\.0, 0\.0, 0\.0|1\.0, 1\.0, 1\.0|0\.0|1\.0)\)$|^\(0\.0,\)$|^\(1\.0,\)$|^text:000000$/.test(c)), "with high spacing every mark is pure black or pure white");
      ok(Math.max(...r.back.map(g => g.diff)) < 0.03, `with high spacing the PDF and the picture of it agree (at most ${(Math.max(...r.back.map(g => g.diff)) * 100).toFixed(2)} of 100 dots apart)`);
    }
    ok(r.kbNew * 10 <= r.kbOld && r.kbNew < 100 * Math.max(1, r.names.length / 10), `with high spacing the file stays small (${Math.round(r.kbNew)} KB for ${r.names.length} pages)`); }
  for (const [ns, face] of [["flow", "PinyonScript"], ["formal", "MarckScript"]]) { const r = await both("name-" + ns, { profile: { nameStyle: ns }, stages: [1, 2], mods: ["reminiscence", "exercise", "daily"] });
    ok(r.vector === r.names.length && (!r.back || (r.back.some(g => g.faces.includes(face)) && Math.max(...r.back.map(g => g.diff)) < 0.03)), `a name in ${ns === "flow" ? "flowing" : "formal"} script is set in its own face, embedded (${face}, ${r.vector} pages)`); }
  const col = await both("coloring", { mods: [], coloring: [1, 2, 3] });
  ok(col.names.length === 3 && col.vector === 3 && col.paths.every(n => n >= 1) && (!col.back || (col.back.every(g => g.images.length === 0) && Math.max(...col.back.map(g => g.diff)) < 0.03)), `a coloring page's drawing from the library is real curves, not a picture (${col.paths.join(", ")} paths${col.back ? ", at most " + (Math.max(...col.back.map(g => g.diff)) * 100).toFixed(2) + " of 100 dots apart" : ""})`);
  const gut = await both("gutter", { gutter: true, stages: [2], mods: ["reminiscence", "songs", "whoswho", "hometown"], noPicture: true });
  ok(gut.vector === gut.names.length && (!gut.back || gut.back.every((g, i) => i % 2 === 0 ? g.ink[0] >= 53.9 && g.ink[2] <= 576.1 : g.ink[0] >= 35.9 && g.ink[2] <= 558.1)), "with a binding gutter the pages keep 0.75 in clear on alternating sides");

  /* a letter the face does not hold: that page alone is a picture */
  const fb = await both("fallback", { profile: { name: "Дарья" }, stages: [2], mods: ["hometown", "exercise"], noPicture: true });
  const named = fb.said.map(w => /Дарья/.test(w.join(" ")));
  ok(named.some(Boolean) && fb.picture === named.filter(Boolean).length && fb.vector === named.filter(x => !x).length, `a page with letters its face does not hold goes in as a picture, and only that page (${fb.picture} of ${fb.names.length})`);
  if (fb.back) ok(fb.back.every((g, i) => named[i] ? g.images.length === 1 && Math.abs(g.images[0][0] - 36) < 1 && Math.abs(g.images[0][2] - 576) < 1 : g.images.length === 0), "the picture sits where the page would have been, inside the margins");

  /* through the Studio's own button, and the line it writes */
  await p.evaluate(() => document.querySelectorAll("details.as-acc").forEach(d => { d.open = true; }));
  await p.fill("#asName", "Дарья"); await p.waitForTimeout(600);
  let dlp = p.waitForEvent("download", { timeout: 60000 }); await p.click("#asPdf"); let dl = await dlp; await p.waitForTimeout(500);
  const note1 = await p.textContent("#asPdfNote"), last1 = await p.evaluate(() => window.CognicopiaActivityStudio.lastPdf());
  ok(!!dl && last1.picture >= 1 && new RegExp(last1.picture + " as a picture").test(note1), `the Studio says when a page went in as a picture (${note1})`);
  await p.fill("#asName", "Dorothy"); await p.waitForTimeout(600);
  dlp = p.waitForEvent("download", { timeout: 60000 }); await p.click("#asPdf"); dl = await dlp; await p.waitForTimeout(500);
  const f2 = path.join(DIR, "button.pdf"); await dl.saveAs(f2); const b2 = read(f2), last2 = await p.evaluate(() => window.CognicopiaActivityStudio.lastPdf());
  ok(last2.picture === 0 && last2.vector === last2.pages && /as text and lines/.test(await p.textContent("#asPdfNote")) && (!b2 || (b2.length === last2.pages && b2.every(g => g.images.length === 0 && g.words.length >= 3))), `the Compile Packet PDF button makes the same kind of file (${last2.vector} pages, ${Math.round(fs.statSync(f2).size / 1024)} KB)`);

  /* a photograph stays inside its frame */
  const ph = await p.evaluate(async () => {
    const E = window.CognicopiaActivityEngine, PL = window.CognicopiaColoringPipeline, SP = window.CognicopiaStudioPdf, R = window.CogniResident;
    const cv = document.createElement("canvas"); cv.width = 800; cv.height = 500; const c = cv.getContext("2d"); c.fillStyle = "#777"; c.fillRect(0, 0, 800, 500); const photo = cv.toDataURL("image/jpeg", 0.8);
    const person = R.person({ schema: "cognicopia.residentProfile", version: 2, id: "t", tier1_core: { preferredName: "Dorothy", cognitiveTier: 2, topicsToAvoid: {} }, tier2_enrichment: { birthYear: 1938 }, tier3_deep: { people: [{ name: "Sarah Example", relationship: { code: "daughter", label: "Daughter" }, photo: "k1" }] } });
    person.photos = { k1: photo };
    const g = E.generate({ stage: 2, name: "Dorothy", born: 1938, person }, { module: "whoswho", count: 1, seed: 3 }), pg = PL.sheetPages(g.sheets[0], "full").pages[0], im = pg.ops.filter(o => o.t === "image")[0];
    await PL.loadImages([pg]); const v = await SP.make([pg], {});
    return { vector: v.vector, frame: im ? [36 + im.x * 0.45, 36 + im.y * 0.45, 36 + (im.x + im.w) * 0.45, 36 + (im.y + im.h) * 0.45] : null, v: v.doc.output("datauristring").split(",")[1] };
  });
  const f3 = path.join(DIR, "photo.pdf"); fs.writeFileSync(f3, Buffer.from(ph.v, "base64")); const b3 = read(f3);
  ok(ph.vector === 1 && !!ph.frame, "a who's who page with a photograph is drawn as text and lines too");
  if (b3) {
    const clipped = execFileSync("python3", ["-c", `
import sys, json
try:
    import pymupdf as fitz
except ImportError:
    import fitz
pg = fitz.open(sys.argv[1])[0]; fr = json.loads(sys.argv[2]); pm = pg.get_pixmap(dpi=72, colorspace=fitz.csGRAY)
def g(x, y): return pm.pixel(int(x), int(y))[0]
cx = (fr[0] + fr[2]) / 2; cy = (fr[1] + fr[3]) / 2
print(json.dumps({"inside": g(cx, cy), "left": g(fr[0] - 8, cy), "right": g(fr[2] + 8, cy), "above": g(cx, fr[1] - 8), "below_edge": g(cx, fr[3] - 12)}))`, f3, JSON.stringify(ph.frame)], { encoding: "utf8" });
    const px = JSON.parse(clipped);
    ok(b3[0].images.length === 1 && px.inside > 60 && px.inside < 200 && px.left > 240 && px.right > 240 && px.above > 240 && px.below_edge < 200, `the photograph fills its frame and is cut off at the frame's edge (gray ${px.inside} inside, white ${px.left}, ${px.right} and ${px.above} beside and above it)`);
    ok(/Sarah/.test(b3[0].words.join(" ")), "and her name under it is still words");
  }
  await p.close();

  /* the daily card */
  const d = await ctx.newPage(); watch(d);
  await d.goto(base + "daily.html", { waitUntil: "load" }); await d.waitForTimeout(1000); await d.click("#dyMake"); await d.waitForTimeout(400);
  dlp = d.waitForEvent("download", { timeout: 30000 }); await d.click("#dyPdf"); dl = await dlp; await d.waitForTimeout(400);
  const f4 = path.join(DIR, "daily.pdf"); await dl.saveAs(f4); const b4 = read(f4), last4 = await d.evaluate(() => window.CognicopiaDailyCard.lastPdf());
  ok(last4 && last4.vector === 1 && last4.picture === 0 && (!b4 || (b4.length === 1 && b4[0].images.length === 0 && b4[0].words.length >= 5 && b4[0].faces.includes("AtkinsonHyperlegible"))) && fs.statSync(f4).size < 120 * 1024, `the daily card's PDF is made the same way (${Math.round(fs.statSync(f4).size / 1024)} KB)`);
  await d.close(); await ctx.close();

  ok(pymupdf, "PyMuPDF is here, so the files were read back (pip install pymupdf)");
  ok(foreign.length === 0, "nothing is requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 2).join(", ") : ""));
  ok(errors.length === 0, "no script errors" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) { /* ignore */ } }

console.log(problems.length ? `studio PDF check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `studio PDF check passed: ${passed} checks in a real browser, the files read back (every kind of page as real words and lines in embedded faces, the same as its picture within 3 dots in 100, no line under 2 pt, inside the margins, a tenth the size or less; script names, a library drawing, the gutter, a photograph in its frame; one page falling back to a picture and saying so; the daily card)`);
process.exit(problems.length ? 1 : 0);
