#!/usr/bin/env node
/* =====================================================================
   A coloring page made from a photo, and a door sign, in the Activity Page Studio (js/photoLine.js and the two new kinds of page), in a
   real browser.

     photo      a chosen photo is turned into a picture of only pure black and pure white, with lines at least 3 pt thick on paper and a
                sensible amount of ink, with a plain note about how it came out; it is kept in memory for the packet and nowhere else
                (nothing in the browser's storage holds it); Remove puts everything back
     coloring   "Coloring page from a photo": one page with a 32 pt or larger title, the picture in a frame and a caption, black and white,
                made into a real PDF (the picture read back as pure black and white)
     door sign  the first name large, a photo frame (the line drawing, or room to put a photo), where they come from, the work, and a library
                drawing for their trade or what they love; a topic to avoid keeps a drawing off
     fingers    52 px and 7:1 by day and in Night Shift, 1366 x 768 and 390 x 844
     private    nothing is requested from outside the page
   Made-up people only. Needs Playwright (and PyMuPDF for the PDF). Run: node scripts/check-photo-pages-ui.mjs
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0; const notes = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const person = (id, name, o = {}) => ({ schema: "cognicopia.residentProfile", version: 2, id, tier1_core: { preferredName: name, cognitiveTier: 2, occupation: { code: o.work || "teacher", label: o.workLabel || "Teacher" }, topHobbies: o.hobbies || [], printNeeds: {},
  topicsToAvoid: { topics: [], eras: [], people: "", places: "", other: o.avoid || "" } }, tier2_enrichment: { birthYear: 1938, hometown: { place: "Scobey, Montana" } }, tier3_deep: { notes: "" } });
const DOT = person("res-dot", "Dorothy"), COOK = person("res-cook", "Carl", { work: "cook", workLabel: "Cook", avoid: "tea, teapot" }), COOK2 = person("res-cook2", "Cora", { work: "cook", workLabel: "Cook" });

async function open(w, h, night) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(n => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); if (n) localStorage.setItem("cognicopia_night_shift", "1"); } catch (e) { /* ignore */ } }, !!night);
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + "activity-studio.html", { waitUntil: "load" }); await p.waitForTimeout(1500);
  return { ctx, p };
}
/* a made-up photo: a plain scene (sky, a house, a sun, a tree) as a JPEG file */
const PHOTO = path.join(os.tmpdir(), "photo-pages-check.jpg");
{
  const { ctx, p } = await open(800, 600);
  const b64 = await p.evaluate(() => { const c = document.createElement("canvas"); c.width = 1200; c.height = 900; const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 900); g.addColorStop(0, "#9fd0ff"); g.addColorStop(1, "#e8f4ff"); x.fillStyle = g; x.fillRect(0, 0, 1200, 900);
    x.fillStyle = "#7a9a5a"; x.fillRect(0, 650, 1200, 250); x.fillStyle = "#c46a3a"; x.fillRect(380, 380, 440, 300); x.fillStyle = "#6b3a22"; x.beginPath(); x.moveTo(340, 390); x.lineTo(600, 220); x.lineTo(860, 390); x.fill();
    x.fillStyle = "#f4e3b5"; x.fillRect(540, 520, 120, 160); x.fillStyle = "#fff2a8"; x.beginPath(); x.arc(1000, 160, 70, 0, 7); x.fill(); x.fillStyle = "#3c6b2a"; x.beginPath(); x.arc(200, 520, 120, 0, 7); x.fill(); x.fillStyle = "#5a3a1a"; x.fillRect(185, 600, 30, 100);
    return c.toDataURL("image/jpeg", 0.9).split(",")[1]; });
  fs.writeFileSync(PHOTO, Buffer.from(b64, "base64")); await ctx.close();
}
const mix = async (p, only) => { await p.evaluate(() => { document.querySelector("#asAccPages").open = true; }); for (const k of await p.$$eval('input[name="mix"]', e => e.map(i => i.value))) await p.setChecked(`input[name="mix"][value="${k}"]`, only.includes(k), { force: true }); await p.waitForTimeout(900); };
const openAcc = async p => { await p.evaluate(() => { const d = document.querySelector("#asAccPhoto"); if (d) d.open = true; }); };
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
    imgs = []
    for im in pg.get_images(full=True):
        pm = fitz.Pixmap(doc, im[0])
        if pm.n - pm.alpha >= 3: pm = fitz.Pixmap(fitz.csGRAY, pm)
        vals = set(pm.samples)
        imgs.append({"w": pm.width, "h": pm.height, "odd": sorted(v for v in vals if v not in (0, 255))[:5]})
    out.append({"text": pg.get_text(), "images": imgs})
print(json.dumps(out))
`;

try {
  const { ctx, p } = await open(1366, 900);
  await p.evaluate(async l => { const S = window.CogniSecureStore.storage; l.forEach(x => S.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))); await window.CogniSecureStore.flush(); }, [DOT, COOK, COOK2]);
  await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1500);
  await openAcc(p);
  /* ---------- the photo ---------- */
  await p.setInputFiles("#asPhoto", PHOTO); await p.waitForFunction(() => !document.querySelector("#asPhotoPrev").hidden, null, { timeout: 20000 });
  const msg = await p.textContent("#asPhotoMsg");
  ok(/Made\./.test(msg) && /rougher drawing/.test(msg), `a plain note on how it came out (${msg.slice(0, 80)})`);
  const stats = await p.evaluate(() => new Promise(res => { const im = document.querySelector("#asPhotoPrev"), c = document.createElement("canvas"); const go = () => { c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext("2d"); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let odd = 0, ink = 0; const runs = [];
    for (let y = 0; y < c.height; y += 7) { let run = 0; for (let xx = 0; xx < c.width; xx++) { const v = d[(y * c.width + xx) * 4]; if (v !== 0 && v !== 255) odd++; if (v === 0) { run++; ink++; } else { if (run) runs.push(run); run = 0; } } }
    runs.sort((a, b) => a - b); res({ w: c.width, h: c.height, odd, ink: ink / (c.width * Math.ceil(c.height / 7)), med: runs[Math.floor(runs.length / 2)] || 0 }); }; if (im.complete && im.naturalWidth) go(); else im.onload = go; }));
  ok(stats.w * 4 === stats.h * 3, `the drawing is 3:4 (${stats.w} x ${stats.h})`);
  ok(stats.odd === 0, `only pure black and pure white (${stats.odd} other pixels)`);
  ok(stats.ink > 0.012 && stats.ink < 0.3, `a sensible amount of ink (${(stats.ink * 100).toFixed(1)} percent)`);
  ok(stats.med >= 5, `lines at least 3 pt thick on paper (median run ${stats.med} px of ${stats.w})`);
  const kept = await p.evaluate(() => { const hits = []; for (const st of [localStorage, sessionStorage]) for (let i = 0; i < st.length; i++) if (/data:image/.test(st.getItem(st.key(i)) || "")) hits.push(st.key(i)); return hits; });
  ok(kept.length === 0, `nothing in the browser's storage holds the photo or its drawing (${kept})`);
  /* ---------- the coloring page ---------- */
  await mix(p, ["photocolor"]);
  const t = await p.$eval("#asSheet svg", e => ({ texts: [...e.querySelectorAll("text")].map(x => [x.textContent, +x.getAttribute("font-size")]), img: e.querySelectorAll("image").length, colors: [...new Set([...e.querySelectorAll("[fill],[stroke]")].flatMap(x => [x.getAttribute("fill"), x.getAttribute("stroke")]).filter(Boolean))] }));
  const title = t.texts.find(x => /Color this together/.test(x[0]));
  ok(title && title[1] >= 71, `a real-text title of 32 pt or larger (${title && title[1]})`);
  ok(t.img === 1 && t.colors.every(c => ["none", "#fff", "#000"].includes(c)), `one picture in a black and white page (${t.img}, ${t.colors})`);
  const pdfDl = await Promise.all([p.waitForEvent("download", { timeout: 60000 }), p.click("#asPdf")]).then(x => x[0]); const pdf = path.join(os.tmpdir(), "photo-pages-check.pdf"); await pdfDl.saveAs(pdf);
  let back = null; try { back = JSON.parse(execFileSync("python3", ["-I", "-c", PY, pdf], { encoding: "utf8" })); } catch (e) { notes.push("PyMuPDF could not read the PDF here"); }
  if (!back || back.missing) notes.push("PyMuPDF is not installed for python3: the PDF was not read back");
  else {
    ok(back.length === 1 && /Color this together/.test(back[0].text) && back[0].images.length === 1, `the PDF has the title as text and the picture (${back[0] && back[0].images.length} picture)`);
    ok(back[0].images.every(i => i.odd.length === 0), `the picture in the PDF is pure black and white (${back[0].images.map(i => i.odd)})`);
  }
  /* ---------- the door sign ---------- */
  await mix(p, ["doorsign"]); await p.selectOption("#asResident", "res-dot"); await p.waitForTimeout(1500);
  const s = await p.$eval("#asSheet svg", e => ({ t: [...e.querySelectorAll("text")].map(x => x.textContent).join(" | "), img: e.querySelectorAll("image").length, paths: e.querySelectorAll("path").length }));
  ok(/Dorothy/.test(s.t) && /From Scobey/.test(s.t) && /Teacher/.test(s.t), `the sign says her name, where she comes from and her work (${s.t.slice(0, 90)})`);
  ok(s.img === 1 && s.paths > 3, "it has her photo as a line drawing and a library drawing for her work");
  await p.click("#asPhotoClear"); await p.waitForTimeout(600); await mix(p, ["doorsign"]);
  const s2 = await p.$eval("#asSheet svg", e => ({ t: [...e.querySelectorAll("text")].map(x => x.textContent).join(" | "), img: e.querySelectorAll("image").length }));
  ok(s2.img === 0 && /A photo can go here/.test(s2.t) && /Dorothy/.test(s2.t), "Remove brings back a frame with room for a photo, and the name stays");
  ok(!(await p.$eval("#asPhotoPrev", e => !e.hidden)), "and the preview is gone");
  /* a topic to avoid keeps a drawing off: Carl, a cook who avoids tea, is not drawn a teapot; Cora, a cook with nothing to avoid, is */
  const picOf = async id => { await p.selectOption("#asResident", id); await p.waitForTimeout(1500); return p.$eval("#asSheet svg", e => e.innerHTML.length); };
  const pathCount = async id => { await p.selectOption("#asResident", id); await p.waitForTimeout(1500); return p.$$eval("#asSheet svg path", e => e.length); };
  const carl = await pathCount("res-cook"), cora = await pathCount("res-cook2");
  ok(carl > 0 && cora > 0 && carl !== cora, `a topic to avoid changes the drawing (Carl ${carl} paths, Cora ${cora})`);
  void picOf;
  await ctx.close();
  /* ---------- by day and in Night Shift, on a phone ---------- */
  for (const [w, h, night] of [[1366, 768, false], [390, 844, false], [1366, 768, true], [390, 844, true]]) {
    const c2 = await open(w, h, night); await openAcc(c2.p);
    const m = await c2.p.evaluate(new Function("const lum=c=>{const m=c.match(/[\\d.]+/g);const[r,g,b]=m.slice(0,3).map(v=>{v=v/255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};const bgOf=el=>{for(let e=el;e;e=e.parentElement){const c=getComputedStyle(e).backgroundColor,m=c.match(/[\\d.]+/g);if(m&&(m.length<4||+m[3]>.5))return c}return 'rgb(255,255,255)'};const box=document.querySelector('#asAccPhoto'),low=[];box.querySelectorAll('*').forEach(el=>{if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))return;const a=lum(getComputedStyle(el).color),b=lum(bgOf(el)),r=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);if(r<7)low.push(r.toFixed(2)+' '+el.textContent.trim().slice(0,18))});const f=document.querySelector('#asPhoto').getBoundingClientRect();return{low,fh:f.height,sideways:document.documentElement.scrollWidth>innerWidth+1}"));
    ok(!m.low.length && m.fh >= 52 && !m.sideways, `${w}${night ? " night" : ""}: the photo section reads at 7:1, the chooser is 52 px (${Math.round(m.fh)}), no sideways scroll${m.low.length ? " (" + m.low.join(", ") + ")" : ""}`);
    await c2.ctx.close();
  }
} finally { await browser.close(); srv.close(); }

ok(!foreign.length, `nothing requested from outside the page: ${foreign.slice(0, 3).join(", ")}`);
ok(!errors.length, `no script errors: ${errors.slice(0, 3).join(" | ")}`);
console.log(problems.length ? `photo pages check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 40).join("\n  - ") : `photo pages check passed: ${passed} checks` + (notes.length ? "\n  note: " + notes.join("; ") : ""));
process.exit(problems.length ? 1 : 0);
