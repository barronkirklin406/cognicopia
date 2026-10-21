#!/usr/bin/env node
/* =====================================================================
   The Coloring Agent's "Describe a page" tab in the Packet Builder
   (builder.html#/coloring), in a real browser, with the real library.

     - a typed description ("A vintage rocking chair on a porch") and a random page each give a
       3:4 page, 1800 x 2400, with not one gray pixel, and the PNG the person saves is read back
       byte by byte (checksums, the 300 dpi chunk, every pixel pure black or white)
     - the black-and-white filter on a raw picture (grays, a color, a clear background, a
       landscape picture, a blank one, a solid black one) does exactly what its formula says
     - every one of the 150 pictures, across the three tiers, comes out pure, with a sensible
       amount of ink, and its thinnest lines print at no less than the tier's line weight
     - Add to packet queues the page like any other coloring page; a higher tier draws the same
       picture again with heavier lines; a saved PNG counts against the free packets and the gate
       stops it when they are gone
     - a spinner shows while a page is made (and stops moving for people who ask for less motion);
       a slow or failing source falls back to the library with one plain sentence; a missing
       library, a childish word, words that fit nothing and an avoid-topic each get a plain sentence
     - a resident's avoid list is honored by a description and by the random page
     - every control is 52 px, text passes WCAG AA by day and in Night Shift, nothing runs off a
       phone's screen, and nothing is requested from outside the page

   Needs Playwright. Where it is missing this exits 2 and npm run build skips it.
   Run: node scripts/check-coloringagent-ui.mjs
   ===================================================================== */
import fs from "fs";
import zlib from "zlib";
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], foreign = [], errors = []; let passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else problems.push(msg); };

/* a PNG read the slow way, from its bytes: chunks and checksums, the dpi, and every pixel */
const crc = b => typeof zlib.crc32 === "function" ? zlib.crc32(b) >>> 0 : (() => { let c, t = [], x = 0xFFFFFFFF; for (let n = 0; n < 256; n++){ c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xFFFFFFFF) >>> 0; })();
function readPng(buf){
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (buf.length < 60 || sig.some((v, i) => buf[i] !== v)) return { valid: false };
  let at = 8, w = 0, h = 0, bd = 0, ct = 0, il = 0, phys = null; const idat = [], types = []; let badCrc = 0;
  while (at < buf.length){
    const len = buf.readUInt32BE(at), type = buf.toString("latin1", at + 4, at + 8), data = buf.subarray(at + 8, at + 8 + len);
    if (crc(buf.subarray(at + 4, at + 8 + len)) !== buf.readUInt32BE(at + 8 + len)) badCrc++;
    types.push(type);
    if (type === "IHDR"){ w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; il = data[12]; }
    if (type === "IDAT") idat.push(data);
    if (type === "pHYs") phys = [data.readUInt32BE(0), data.readUInt32BE(4), data[8]];
    at += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct];
  if (!ch || bd !== 8 || il) return { valid: true, w, h, types, badCrc, phys, decodable: false };
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++){
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = px.subarray(y * stride, (y + 1) * stride), prev = y ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++){
      const a = i >= ch ? cur[i - ch] : 0, b = prev ? prev[i] : 0, c = prev && i >= ch ? prev[i - ch] : 0; let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4){ const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
  }
  let bad = 0, black = 0;
  for (let i = 0; i < px.length; i += ch){
    const r = px[i];
    if ((r !== 0 && r !== 255) || (ch >= 3 && (px[i + 1] !== r || px[i + 2] !== r)) || (ch === 4 && px[i + 3] !== 255) || (ch === 2 && px[i + 1] !== 255)) bad++;
    else if (r === 0) black++;
  }
  return { valid: true, w, h, types, badCrc, phys, decodable: true, bad, black, share: black / (w * h) };
}
const dataUrlBytes = u => Buffer.from(u.slice(u.indexOf(",") + 1), "base64");

const PREFIX = "Minimalist bold-and-easy adult coloring book page of ";
const SUFFIX = ", thick pure-black vector outlines, clean uncrowded composition, large fillable areas, solid pure white background, zero shading, zero gray tones, high contrast, 3:4 aspect ratio";
const resident = (id, name, tier, avoid) => ({ schema: "cognicopia.residentProfile", version: 2, id, createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-09-01T10:00:00Z",
  tier1_core: { preferredName: name, unitNumber: "Test 1", cognitiveTier: tier, visualNeeds: null, occupation: { code: "teacher", label: "Teacher" }, topHobbies: [], printNeeds: {}, topicsToAvoid: { topics: avoid.map(c => ({ code: c })), other: "" } },
  tier2_enrichment: { birthYear: 1938, hometown: { place: "Test City" } }, tier3_deep: { notes: "", people: [] } });

try {
  const open = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: opts.w || 1366, height: opts.h || 768 }, serviceWorkers: "block", acceptDownloads: true, reducedMotion: opts.reduced ? "reduce" : "no-preference" });
    await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } });   // this check is about the Describe a page tab, not the first-visit agreement
    if (opts.clipboard) await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base.replace(/\/$/, "") });
    const p = await ctx.newPage();
    p.on("pageerror", e => errors.push(e.message));
    p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
    p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith("data:") && !u.startsWith("blob:")) foreign.push(u); });
    if (opts.residents){ await p.goto(base + "builder.html#/"); await p.evaluate(list => { localStorage.clear(); list.forEach(x => localStorage.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))); }, opts.residents); }
    await p.goto(base + "builder.html#/coloring"); if (opts.residents) await p.reload({ waitUntil: "load" });
    await p.waitForSelector("#ccTabMk", { timeout: 20000 });
    return { ctx, p };
  };
  const toTab = async p => { await p.click("#ccTabMk"); await p.waitForSelector("#ccMkQ"); };
  const find = async (p, text) => { await p.fill("#ccMkQ", text); await p.click("#ccMkFind"); await p.waitForFunction(() => !document.querySelector(".cc-mk-wait") && (document.querySelector(".cc-mk-card") || document.querySelector(".cc-mk-err")), null, { timeout: 20000 }); };
  const card = p => p.evaluate(async () => {
    const c = document.querySelector(".cc-mk-card"); if (!c) return null;
    const img = c.querySelector("img"); await img.decode();
    const cv = document.createElement("canvas"); cv.width = img.naturalWidth; cv.height = img.naturalHeight; const x = cv.getContext("2d"); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, cv.width, cv.height).data; let bad = 0, black = 0;
    for (let i = 0; i < d.length; i += 4){ const r = d[i]; if ((r !== 0 && r !== 255) || d[i + 1] !== r || d[i + 2] !== r || d[i + 3] !== 255) bad++; else if (!r) black++; }
    return { design: c.dataset.design, tier: +c.dataset.tier, category: c.dataset.category, provider: c.dataset.provider, w: img.naturalWidth, h: img.naturalHeight, bad, share: black / (d.length / 4), src: img.src, title: c.querySelector("h3").textContent, meta: c.querySelector(".cc-mk-side").textContent, alt: img.alt };
  });

  /* ---------- 1. the tab, a typed description, and what it gives ---------- */
  let { ctx, p } = await open();
  ok(await p.evaluate(() => !!window.CognicopiaColoringAgent && window.ColoringAgent === window.CognicopiaColoringAgent), "the agent is loaded and also answers to ColoringAgent");
  await toTab(p);
  ok(await p.getAttribute("#ccTabMk", "aria-selected") === "true" && await p.getAttribute("#ccPanel", "aria-labelledby") === "ccTabMk" && await p.getAttribute("#ccTabMk", "role") === "tab", "the Describe a page tab is a real tab, selected");
  await p.focus("#ccTabMk"); await p.keyboard.press("ArrowLeft");
  ok(await p.getAttribute("#ccTabNew", "aria-selected") === "true", "the left arrow goes from it to New pages");
  await p.keyboard.press("ArrowRight"); await p.waitForSelector("#ccMkQ");
  ok(await p.getAttribute("#ccTabMk", "aria-selected") === "true" && await p.evaluate(() => document.activeElement && document.activeElement.id) === "ccTabMk", "and the right arrow comes back to it, with focus on it");
  ok(await p.isVisible("#ccMkQ") && await p.isVisible("#ccMkFind") && await p.isVisible("#ccMkRandom") && /Generate random clinical page/.test(await p.textContent("#ccMkRandom")), "the words box, Find this page and Generate random clinical page are there");
  ok(/resident.s name/.test(await p.textContent("#ccMkHint")), "the box asks people not to type a resident's name");
  ok(await p.textContent("#ccMkOut").then(t => /Your page will show here/.test(t)), "before anything is asked, the card says where the page will show");

  await find(p, "A vintage rocking chair on a porch");
  let c = await card(p);
  ok(c && c.design === "rocking-chair" && c.provider === "library" && c.tier === 2, "a typed description gives The Rocking Chair, from the library, at Tier 2");
  ok(await p.evaluate(() => document.activeElement && document.activeElement.id) === "ccMkFind", "keyboard focus is back on Find this page when the page is ready");
  ok(c && c.w === 1800 && c.h === 2400 && c.w / c.h === 0.75, "the page is 3:4, 1800 x 2400");
  ok(c && c.bad === 0 && c.share > 0.02 && c.share < 0.3, `not one gray pixel in the page the browser shows (${c && c.bad} impure), with ${c && (c.share * 100).toFixed(1)}% ink`);
  ok(c && /^data:image\/png;base64,/.test(c.src) && /rocking chair/i.test(c.alt) && /pure black on white/.test(c.alt), "the image is a PNG held in the page, with words for a screen reader");
  ok(c && /Pure black and white/.test(c.meta) && /1800 × 2400 px, 300 dpi at 6 × 8 in/.test(c.meta) && /Tier 2/.test(c.meta), "its details are stated: pure black and white, 1800 x 2400, 300 dpi at 6 x 8 in");
  ok(await p.textContent("#ccMkNote") === "Found: The Rocking Chair.", "a short sentence says what was found");
  const shown = readPng(dataUrlBytes(c.src));
  ok(shown.valid && shown.decodable && shown.w === 1800 && shown.h === 2400 && shown.bad === 0 && !shown.badCrc && shown.phys && shown.phys[0] === 11811 && shown.phys[1] === 11811 && shown.phys[2] === 1, "read byte by byte, the PNG is whole, every pixel pure, and it says 300 dpi");
  const words = PREFIX + "a vintage rocking chair on a porch" + SUFFIX;
  await p.click(".cc-mk-words summary");
  ok(await p.textContent("#ccMkWords") === words, "the words behind the page are the clinical wrapper around what was typed");

  /* the words box is remembered, and so is the tab */
  await p.reload({ waitUntil: "load" }); await p.waitForSelector("#ccMkQ");
  ok(await p.inputValue("#ccMkQ") === "A vintage rocking chair on a porch" && await p.getAttribute("#ccTabMk", "aria-selected") === "true", "the words and the tab are remembered after a reload");

  /* ---------- 2. a higher tier draws the same picture again, heavier ---------- */
  await find(p, "A vintage rocking chair on a porch");
  const t2 = await card(p);
  await p.click('label:has(input[name="ccMkTier"][value="3"])');
  await p.waitForFunction(() => { const x = document.querySelector(".cc-mk-card"); return x && x.dataset.tier === "3" && !document.querySelector(".cc-mk-wait"); }, null, { timeout: 20000 });
  const t3 = await card(p);
  ok(t3.design === t2.design && t3.tier === 3 && t3.bad === 0 && t3.share > t2.share && /Tier 3/.test(t3.meta), `the same picture at Tier 3 has heavier lines (${(t2.share * 100).toFixed(1)}% ink, then ${(t3.share * 100).toFixed(1)}%)`);
  await p.click('label:has(input[name="ccMkTier"][value="2"])');
  await p.waitForFunction(() => { const x = document.querySelector(".cc-mk-card"); return x && x.dataset.tier === "2" && !document.querySelector(".cc-mk-wait"); }, null, { timeout: 20000 });

  /* ---------- 3. Add to packet ---------- */
  ok(await p.evaluate(() => queue.length) === 0, "the packet starts empty");
  await p.click("#ccMkAdd");
  const q = await p.evaluate(() => ({ n: queue.length, a: queue[0] && queue[0].activityId, pages: queue[0] && queue[0].cfg.opts.pages, tier: queue[0] && queue[0].cfg.opts.tier, sheet: queue[0] ? sheetHtml(queue[0]) : "", badge: (document.querySelector(".btn-packet .count") || {}).textContent }));
  ok(q.n === 1 && q.a === "cognicopia-coloring-library" && q.pages.join() === "rocking-chair" && q.tier === 2 && q.badge === "1", "Add to packet queues the library page and the packet count goes to 1");
  ok(/class="sheet cc-sheet[^"]*" data-tier="2" data-design="rocking-chair"/.test(q.sheet) && /<svg /.test(q.sheet) && /<footer class="care-coaching-footer"><b>Clinical Tip:<\/b>/.test(q.sheet) && /Page 1 of 1/.test(q.sheet), "it prints on the standard sheet, as a vector, with the clinical tip and the page number");
  ok(/Added The Rocking Chair to your packet/.test(await p.textContent("#toast")), "a sentence says it was added");

  /* ---------- 4. Download print-ready PNG: the file itself, and the free-packet count ---------- */
  const before = await p.evaluate(() => genCount());
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 20000 }), p.click("#ccMkPng")]);
  const name = dl.suggestedFilename(), file = await dl.path(), bytes = fs.readFileSync(file), png = readPng(bytes);
  ok(/^Cognicopia - The Rocking Chair - Tier 2 - \d{4}-\d{2}-\d{2}\.png$/.test(name), "the file is named for the page, the tier and the date: " + name);
  ok(png.valid && png.decodable && png.w === 1800 && png.h === 2400 && png.bad === 0 && png.types[0] === "IHDR" && png.types[1] === "pHYs" && png.types[png.types.length - 1] === "IEND" && png.types.slice(2, -1).every(t => t === "IDAT") && !png.badCrc, `the saved file is a whole PNG with every pixel pure black or white (${png.bad} impure; ${png.types.length} chunks, ${png.badCrc} with a bad checksum)`);
  ok(png.phys && png.phys[0] === 11811 && png.phys[2] === 1, "and it says 300 dpi, so it opens at 6 x 8 in");
  ok(png.share > 0.02 && png.share < 0.3 && bytes.length < 600 * 1024, `with a sensible amount of ink and a small file (${(png.share * 100).toFixed(1)}%, ${Math.round(bytes.length / 1024)} KB)`);
  ok(await p.evaluate(() => genCount()) === before + 1, "a saved PNG counts against the free packets, like a PDF");
  await p.evaluate(() => { for (let i = genCount(); i < FREE_RUNS; i++) bumpGen(); });
  let blocked = false; try { await Promise.all([p.waitForEvent("download", { timeout: 1200 }), p.click("#ccMkPng")]); } catch (e){ blocked = true; }
  ok(blocked && await p.evaluate(() => !document.getElementById("gate").hidden), "when the free packets are used, the gate opens and no file is saved");
  await p.evaluate(() => { document.getElementById("gate").hidden = true; });

  /* ---------- 5. words that cannot be used, and words that fit nothing ---------- */
  await find(p, "a cute kitty");
  let e1 = await p.textContent(".cc-mk-err");
  ok(/plain adult words/.test(e1) && /cute/.test(e1) && await p.getAttribute(".cc-mk-err", "role") === "alert" && !await p.isVisible(".cc-mk-card"), "a childish word is set aside, named, and the page is not shown");
  await find(p, "xyzzy plugh");
  ok(/No picture in the library is close to that yet/.test(await p.textContent(".cc-mk-err")) && /tractor/.test(await p.textContent(".cc-mk-err")), "words that fit nothing say so, with a few to try");
  await find(p, "");
  ok(/Describe the picture in a few words/.test(await p.textContent(".cc-mk-err")), "nothing typed asks for a few words");
  await p.fill("#ccMkQ", "Do you remember the old farm"); await p.click("#ccMkFind"); await p.waitForSelector(".cc-mk-err");
  ok(/plain adult words/.test(await p.textContent(".cc-mk-err")), "a memory-quiz phrase is set aside");
  const tryGood = async () => { await find(p, "the farm tractor"); return card(p); };
  c = await tryGood();
  ok(c && c.design === "farm-tractor" && !await p.isVisible(".cc-mk-err"), "after a sentence of help, a good description works and the sentence goes");

  /* ---------- 6. the random page ---------- */
  await p.selectOption("#ccMkCat", "classic-vehicles");
  const titles = [];
  for (let i = 0; i < 4; i++){
    await p.click("#ccMkRandom");
    await p.waitForFunction(n => /random page/i.test(document.getElementById("ccMkNote").textContent) && !document.querySelector(".cc-mk-wait") && document.getElementById("ccMkNote").textContent !== n, await p.textContent("#ccMkNote"), { timeout: 20000 }).catch(() => {});
    await p.waitForSelector(".cc-mk-card");
    const r = await card(p); titles.push(r.title);
    ok(r.category === "classic-vehicles" && r.bad === 0 && r.w === 1800 && r.h === 2400 && r.share > 0.02, `random page ${i + 1} from Classic Vehicles is ${r.title}: pure, 3:4, in the category`);
    ok(/^A random page from Classic Vehicles: /.test(await p.textContent("#ccMkNote")) && r.src && r.provider === "library", "and the sentence says it was a random page from that category");
  }
  ok(new Set(titles).size === 4, "four random pages in a row are four different pictures: " + titles.join(", "));
  await p.selectOption("#ccMkCat", "any"); await p.click("#ccMkRandom"); await p.waitForSelector(".cc-mk-card");
  c = await card(p);
  ok(c && ["vintage-americana", "botanical-garden", "nostalgic-heritage", "home-everyday", "classic-vehicles", "zentangle-mandalas", "bold-easy-patterns", "wildlife-nature", "seasons-holidays"].indexOf(c.category) >= 0 && c.bad === 0, "a random page from every category is a pure page in one of them");

  /* ---------- 7. copy the words ---------- */
  await ctx.close();
  ({ ctx, p } = await open({ clipboard: true }));
  await toTab(p); await find(p, "tulips in a vase");
  await p.click(".cc-mk-words summary"); await p.click("#ccMkCopy");
  const clip = await p.evaluate(() => navigator.clipboard.readText().catch(() => null));
  ok(clip === PREFIX + "tulips in a vase" + SUFFIX, "Copy the words puts the clinical wrapper on the clipboard");
  await ctx.close();

  /* ---------- 8. the black-and-white filter on pictures from anywhere ---------- */
  ({ ctx, p } = await open());
  const filt = await p.evaluate(async () => {
    const A = window.CognicopiaColoringAgent, out = {};
    const blobOf = (w, h, draw, type) => new Promise(res => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); draw(x, w, h); c.toBlob(res, type || "image/png"); });
    const sample = (png, fx, fy) => new Promise(res => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext("2d"); x.drawImage(img, 0, 0); const d = x.getImageData(Math.round(fx * c.width), Math.round(fy * c.height), 1, 1).data; res([d[0], d[1], d[2], d[3]]); }; img.src = png; });
    const raw = await blobOf(900, 1200, (x, w, h) => {
      x.fillStyle = "#fff"; x.fillRect(0, 0, w, h);
      [[150, 150, 150], [199, 199, 199], [200, 200, 200], [230, 230, 230], [255, 0, 0], [255, 255, 0], [0, 0, 255]].forEach((c, i) => { x.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; x.fillRect(100, 100 + i * 140, 300, 120); });
      x.clearRect(500, 100, 300, 120);                                                  // a clear background
      x.fillStyle = "rgba(0,0,0,0.5)"; x.fillRect(500, 240, 300, 120);                  // half-clear black
      x.fillStyle = "rgba(0,0,0,0.05)"; x.fillRect(500, 380, 300, 120);                 // nearly clear black
    });
    const r = await A.clean(raw);
    const png = r.dataUrl;
    out.width = r.width; out.height = r.height; out.dpi = r.dpi; out.pure = r.stats.pure; out.share = r.stats.blackShare;
    // the middle of each patch, in the 1800 x 2400 result (each patch is 2x its size in the 900 x 1200 source)
    const at = (x0, y0) => sample(png, (x0 + 150) * 2 / 1800 + 0, (y0 + 60) * 2 / 2400);
    out.g150 = await at(100, 100); out.g199 = await at(100, 240); out.g200 = await at(100, 380); out.g230 = await at(100, 520);
    out.red = await at(100, 660); out.yellow = await at(100, 800); out.blue = await at(100, 940);
    out.clear = await sample(png, (650) * 2 / 1800, (160) * 2 / 2400); out.half = await sample(png, 650 * 2 / 1800, 300 * 2 / 2400); out.faint = await sample(png, 650 * 2 / 1800, 440 * 2 / 2400);
    // a photograph-like picture: smooth gray gradients and noise, saved as a lossy JPEG
    const jpg = await blobOf(1200, 1200, (x, w, h) => { x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); const g = x.createRadialGradient(w * .5, h * .5, 10, w * .5, h * .5, w * .35); g.addColorStop(0, "#222"); g.addColorStop(1, "#e0e0e0"); x.fillStyle = g; x.beginPath(); x.ellipse(w * .5, h * .5, w * .35, h * .3, 0, 0, 7); x.fill(); for (let i = 0; i < 3000; i++){ x.fillStyle = `rgba(${Math.random() * 255 | 0},${Math.random() * 255 | 0},${Math.random() * 255 | 0},.15)`; x.fillRect(Math.random() * w, Math.random() * h, 5, 5); } }, "image/jpeg");
    try { const rj = await A.clean(jpg); out.jpg = { pure: rj.stats.pure, w: rj.width, h: rj.height, ok: true }; } catch (e) { out.jpg = { ok: false, code: e.code, friendly: e.friendly }; }
    // a landscape picture keeps all of itself, centred on a white 3:4 sheet
    const wide = await blobOf(1200, 600, (x, w, h) => { x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.fillStyle = "#000"; x.fillRect(0, 0, w, 40); x.fillRect(0, h - 40, w, 40); x.fillRect(0, 0, 40, h); x.fillRect(w - 40, 0, 40, h); });
    const rw = await A.clean(wide);
    out.wide = { above: await sample(rw.dataUrl, 0.5, 0.2), below: await sample(rw.dataUrl, 0.5, 0.8), inner: await sample(rw.dataUrl, 0.5, 0.5), top: await sample(rw.dataUrl, 0.5, 760 / 2400), bottom: await sample(rw.dataUrl, 0.5, 1640 / 2400),
      left: await sample(rw.dataUrl, 20 / 1800, 0.5), right: await sample(rw.dataUrl, 1780 / 1800, 0.5), w: rw.width, h: rw.height };
    // a blank picture and a solid black one are refused in plain words
    const blank = await blobOf(600, 800, (x, w, h) => { x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); });
    const dark = await blobOf(600, 800, (x, w, h) => { x.fillStyle = "#000"; x.fillRect(0, 0, w, h); });
    for (const [k, b] of [["blank", blank], ["dark", dark]]) { try { await A.clean(b); out[k] = "accepted"; } catch (e) { out[k] = { code: e.code, friendly: e.friendly }; } }
    try { await A.clean(new Blob(["not a picture"], { type: "image/png" })); out.junk = "accepted"; } catch (e) { out.junk = { code: e.code, friendly: e.friendly }; }
    return out;
  });
  const isBlack = v => v[0] === 0 && v[1] === 0 && v[2] === 0 && v[3] === 255, isWhite = v => v[0] === 255 && v[1] === 255 && v[2] === 255 && v[3] === 255;
  ok(filt.width === 1800 && filt.height === 2400 && filt.dpi === 300 && filt.pure === true, "a raw picture comes out 1800 x 2400, pure, at 300 dpi");
  ok(isBlack(filt.g150) && isBlack(filt.g199) && isWhite(filt.g200) && isWhite(filt.g230), `gray 150 and 199 print black, 200 and 230 print white (${[filt.g150, filt.g199, filt.g200, filt.g230].map(v => v[0]).join(", ")})`);
  ok(isBlack(filt.red) && isBlack(filt.blue) && isWhite(filt.yellow), "pure red and blue print black; yellow, which is bright, prints white");
  ok(isWhite(filt.clear) && isBlack(filt.half) && isWhite(filt.faint), "a clear background is paper, half-clear black prints black, nearly clear black prints white");
  ok(filt.jpg.ok && filt.jpg.pure && filt.jpg.w === 1800 && filt.jpg.h === 2400, "a lossy photograph-like picture is cleaned to pure black and white too" + (filt.jpg.ok ? "" : " (" + filt.jpg.code + ")"));
  const W = filt.wide;
  ok(W.w === 1800 && W.h === 2400 && isWhite(W.above) && isWhite(W.below) && isWhite(W.inner) && [W.top, W.bottom, W.left, W.right].every(isBlack), "a landscape picture keeps all four of its edges, centred on white, never cropped");
  ok(filt.blank.code === "blank" && /nearly blank/.test(filt.blank.friendly) && filt.dark.code === "dark" && /large dark area/.test(filt.dark.friendly), "a blank picture and a solid black one are refused in plain words");
  ok(filt.junk.code === "read" && /could not be read/.test(filt.junk.friendly), "something that is not a picture is refused in plain words");

  /* ---------- 9. every picture, every tier ---------- */
  const sweep = await p.evaluate(async () => {
    const A = window.CognicopiaColoringAgent, C = window.CognicopiaColoring, out = [], list = C.designs();
    for (let i = 0; i < list.length; i++){
      const d = list[i], tier = i % 3 + 1;
      try { const r = await A.generate({ designId: d.id, subject: d.title.toLowerCase(), tier }); out.push({ id: d.id, tier, pure: r.stats.pure, share: r.stats.blackShare, pt: r.stats.lineMinPt, thin: r.stats.thinLines, w: r.width, h: r.height, kb: r.stats.bytes / 1024, ms: r.ms }); }
      catch (e) { out.push({ id: d.id, tier, err: e.code }); }
    }
    return out;
  });
  const floors = { 1: 3.0, 2: 3.6, 3: 7.5 };
  ok(sweep.length === 150 && !sweep.filter(r => r.err).length, `all ${sweep.length} pictures were made (${sweep.filter(r => r.err).length} refused)`);
  ok(sweep.every(r => r.pure && r.w === 1800 && r.h === 2400), "each is pure black and white, 1800 x 2400");
  ok(sweep.every(r => r.share > 0.02 && r.share < 0.3), "each has between 2% and 30% ink: " + sweep.filter(r => !(r.share > 0.02 && r.share < 0.3)).map(r => r.id + " " + (r.share * 100).toFixed(1)).join(", "));
  ok(sweep.every(r => r.pt >= floors[r.tier] && !r.thin), "each one's thinnest lines print at its tier's weight or more (Tier 1 at 3 pt, Tier 2 at 3.75, Tier 3 at 7.9): " + sweep.filter(r => !(r.pt >= floors[r.tier])).map(r => r.id + " T" + r.tier + " " + r.pt).join(", "));
  ok(sweep.every(r => r.kb < 400), "each file is under 400 KB (largest " + Math.round(Math.max(...sweep.map(r => r.kb))) + " KB)");
  ok(Math.max(...sweep.map(r => r.ms)) < 3000, "each takes under three seconds (slowest " + Math.round(Math.max(...sweep.map(r => r.ms))) + " ms)");
  await ctx.close();

  /* ---------- 10. a spinner while it is made; a slow source; a failing one; no library ---------- */
  ({ ctx, p } = await open());
  await toTab(p);
  await p.evaluate(() => { window.ColoringAgent.registerProvider("slow-then-gone", () => new Promise((ok, no) => setTimeout(() => no(new Error("HTTP 503 raw detail")), 900)), true); });
  await p.fill("#ccMkQ", "grandfather clock"); await p.click("#ccMkFind");
  await p.waitForSelector(".cc-mk-wait", { timeout: 5000 });
  const spin = await p.evaluate(() => ({ role: document.querySelector(".cc-mk-wait").getAttribute("role"), text: document.querySelector(".cc-mk-wait").textContent, anim: getComputedStyle(document.querySelector(".cc-spin")).animationName, disabled: [document.getElementById("ccMkFind").disabled, document.getElementById("ccMkRandom").disabled] }));
  ok(spin.role === "status" && /checking it for printing/.test(spin.text) && spin.anim !== "none" && spin.disabled.every(Boolean), "while a page is made a spinner shows, announced as a status, and both buttons wait");
  await p.waitForSelector(".cc-mk-card", { timeout: 20000 });
  c = await card(p);
  const note = await p.textContent(".cc-mk-card .cc-mk-side");
  ok(c.design === "grandfather-clock" && c.provider === "library" && /The first picture source was not available, so this page came from the library on this computer\./.test(note) && !/503|raw detail|HTTP/.test(note), "a source that fails after a wait falls back to the library, with one plain sentence and none of its raw error");
  ok(await p.evaluate(() => !document.getElementById("ccMkFind").disabled && !document.getElementById("ccMkRandom").disabled), "and the buttons are ready again");
  await ctx.close();

  ({ ctx, p } = await open({ reduced: true }));
  await toTab(p);
  await p.evaluate(() => { window.ColoringAgent.registerProvider("slow", () => new Promise(r => setTimeout(() => r(null), 900)), true); });
  await p.fill("#ccMkQ", "tulips in a vase"); await p.click("#ccMkFind"); await p.waitForSelector(".cc-spin", { timeout: 5000 });
  ok(await p.evaluate(() => getComputedStyle(document.querySelector(".cc-spin")).animationName) === "none", "for people who ask for less motion the spinner stands still");
  await ctx.close();

  ({ ctx, p } = await open());
  await toTab(p);
  await p.evaluate(() => { delete window.CognicopiaColoring; });
  await find(p, "a rocking chair");
  ok(/could not load on this computer/.test(await p.textContent(".cc-mk-err")) && !/undefined|TypeError/.test(await p.textContent(".cc-mk-err")), "with the library gone, the page says so in plain words");
  await ctx.close();

  /* ---------- 11. a resident's avoid list ---------- */
  ({ ctx, p } = await open({ residents: [resident("res-x", "Ora", 1, ["driving"])] }));
  await p.selectOption("#ccWho", "res-x"); await toTab(p);
  ok(/nothing on their list of topics to avoid/.test(await p.textContent("#ccPanel")) && await p.evaluate(() => document.querySelector('input[name="ccMkTier"]:checked').value) === "1", "choosing a resident starts at their tier and the tab says their avoid list is honored");
  await find(p, "the sunday sedan");
  ok(/list of topics to avoid/.test(await p.textContent(".cc-mk-err")), "a description whose picture is on their avoid list says so, and shows nothing");
  await find(p, "sedan or a tractor");
  c = await card(p);
  ok(c && c.design === "farm-tractor", "a description that fits something else shows that");
  await p.selectOption("#ccMkCat", "classic-vehicles");
  const bad = [];
  for (let i = 0; i < 10; i++){ await p.click("#ccMkRandom"); await p.waitForFunction(() => !document.querySelector(".cc-mk-wait")); await p.waitForSelector(".cc-mk-card"); const r = await card(p); if (["sunday-sedan", "farm-pickup", "woody-wagon", "convertible", "bread-truck", "vintage-bicycle", "motor-scooter", "fire-engine", "streetcar"].indexOf(r.design) >= 0 && await p.evaluate(id => window.CognicopiaColoring.design(id).sensitive.indexOf("driving") >= 0, r.design)) bad.push(r.design); }
  ok(!bad.length, "ten random vehicle pages never touch what is on their list: " + bad.join(", "));
  await ctx.close();

  /* ---------- 12. 52 px, contrast by day and Night Shift, and a phone ---------- */
  for (const [w, h, label] of [[1366, 768, "desktop"], [390, 844, "phone"]]){
    ({ ctx, p } = await open({ w, h }));
    await toTab(p); await find(p, "A vintage rocking chair on a porch");
    await p.click(".cc-mk-words summary");
    await p.mouse.move(2, 2);
    await p.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
    const m = await p.evaluate(() => {
      const els = [...document.querySelectorAll("#ccPanel button, #ccPanel input[type=text], #ccPanel select, #ccPanel summary, #ccPanel .seg label")].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height; });
      const small = els.map(e => { const r = e.getBoundingClientRect(); return { id: e.id || e.className || e.tagName, w: Math.round(r.width), h: Math.round(r.height), exempt: !!e.closest("[data-tap-exempt]") }; }).filter(x => !x.exempt && (x.w < 52 || x.h < 52));
      const card = document.querySelector(".cc-mk-card").getBoundingClientRect(), img = document.querySelector(".cc-mk-img").getBoundingClientRect();
      return { small, count: els.length, scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, cardRight: card.right, imgW: img.width, imgH: img.height };
    });
    ok(m.count >= 9 && !m.small.length, `${label}: every control in the tab is at least 52 px (${m.count} measured; small: ${JSON.stringify(m.small)})`);
    ok(m.scrollW <= m.innerW + 1 && m.cardRight <= m.innerW + 1, `${label}: nothing runs off the screen (page ${m.scrollW} of ${m.innerW})`);
    ok(Math.abs(m.imgW / m.imgH - 0.75) < 0.01, `${label}: the picture keeps its 3:4 shape on screen`);
    for (const night of [false, true]){
      await p.evaluate(on => document.documentElement.classList.toggle("cg-night-shift", on), night);
      await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const low = await p.evaluate(() => {
        const px = css => { const c = document.createElement("canvas"); c.width = c.height = 1; const x = c.getContext("2d", { willReadFrequently: true }); x.clearRect(0, 0, 1, 1); x.fillStyle = css; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
        const bgOf = el => { const layers = []; for (let e = el; e; e = e.parentElement){ const c = px(getComputedStyle(e).backgroundColor); if (c.a > 0){ layers.push(c); if (c.a >= 1) break; } } let b = { r: 255, g: 255, b: 255 }; for (let i = layers.length - 1; i >= 0; i--){ const L = layers[i]; b = { r: L.r * L.a + b.r * (1 - L.a), g: L.g * L.a + b.g * (1 - L.a), b: L.b * L.a + b.b * (1 - L.a) }; } return b; };
        const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
        const ratio = el => { const fg = px(getComputedStyle(el).color), bg = bgOf(el), a = lum(fg) * fg.a + lum(bg) * (1 - fg.a) , l1 = Math.max(a, lum(bg)), l2 = Math.min(a, lum(bg)); return (l1 + .05) / (l2 + .05); };
        const sel = ["#ccPanel .cc-count", "#ccPanel label[for=ccMkQ]", "#ccMkHint", "#ccMkFind", "#ccMkRandom", "#ccMkCat", "#ccMkNote", ".cc-mk-side h3", ".cc-mk-meta", "#ccMkAdd", "#ccMkPng", ".cc-mk-words summary", "#ccMkWords", "#ccMkCopy", ".cc-tierseg legend", ".seg label span"];
        return sel.map(s => { const e = document.querySelector(s); return e && e.textContent.trim() ? [s, Math.round(ratio(e) * 100) / 100] : null; }).filter(Boolean).filter(x => x[1] < 4.5);
      });
      ok(!low.length, `${label}, ${night ? "Night Shift" : "by day"}: text passes WCAG AA (below 4.5: ${JSON.stringify(low)})`);
    }
    if (label === "phone") await p.screenshot({ path: process.env.CC_SHOT || "/dev/null" }).catch(() => {});
    await ctx.close();
  }

  ok(!foreign.length, "nothing was requested from outside the page: " + foreign.slice(0, 3).join(", "));
  ok(!errors.length, "no script error or console error: " + errors.slice(0, 3).join(" | "));
} catch (e){
  problems.push("the check stopped: " + (e && e.stack ? e.stack.split("\n").slice(0, 4).join(" / ") : e));
} finally { await browser.close(); srv.close(); }

if (problems.length){ console.log(`coloring agent screen check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 40).join("\n  - ")); process.exit(1); }
console.log(`coloring agent screen check passed: ${passed} checks in a real browser (a typed and a random page with no gray, the saved PNG read byte by byte, all 150 pictures at three tiers, Add to packet, the gate, the spinner, a slow source, plain sentences, 52 px, contrast by day and Night Shift, a phone, and nothing requested from outside the page)`);
