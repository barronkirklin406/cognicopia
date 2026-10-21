#!/usr/bin/env node
/* =====================================================================
   The 28 nostalgia, botanical, harvest and home titles the owner listed, one by one, in the Packet Builder
   (builder.html#/coloring), in a real browser (Playwright; exit 2 where it is not installed).

   Each title (Ice Cream Soda, Water Lily, ... Gone Fishing) is
     - registered:  the library holds it, with all three detail tiers
     - searchable:  asking for it by its name finds it first
     - previewable: the page it gives is 3:4, 1800 x 2400, and not one pixel is gray
     - queueable:   Add to packet puts it in the packet, on the standard sheet
   and the whole packet of 28 then
     - prints:      opens the print window with 28 whole sheets, every sheet pure black on white, no script error

   Needs Playwright. Where it is missing this exits 2 and npm run build skips it.
   ===================================================================== */
import fs from "fs";
import path from "path";
import { loadPlaywright, serve, ROOT } from "./lib/browser.mjs";

const TITLES = [
  ["Ice Cream Soda", "ice-cream-soda"], ["Water Lily", "water-lily"], ["Calla Lilies", "calla-lilies"], ["Hydrangea", "hydrangea"],
  ["Magnolia Blossoms", "magnolia-branch"], ["Porch Geranium", "porch-geranium"], ["Watering Can", "watering-can"], ["Garden Wheelbarrow", "garden-wheelbarrow"],
  ["Autumn Maple Leaves", "autumn-maple"], ["Oak Leaves and Acorns", "oak-acorns"], ["Herbs on the Windowsill", "windowsill-herbs"], ["Apples on the Branch", "apple-branch"],
  ["Fresh Strawberries", "strawberries"], ["Pumpkin Patch", "pumpkin-patch"], ["Horn of Plenty", "cornucopia"], ["Vegetable Basket", "harvest-basket"],
  ["Laundry Day", "clothesline"], ["Setting the Table", "table-setting"], ["Tea for Two", "tea-for-two"], ["Sewing Basket", "sewing-basket"],
  ["Knitting Basket", "knitting-basket"], ["Baking Day", "baking-day"], ["Potting Bench", "potting-bench"], ["Writing a Letter", "letter-writing"],
  ["Summer Picnic", "picnic-basket"], ["Ironing Day", "ironing-day"], ["Sunday Paper", "sunday-paper"], ["Gone Fishing", "gone-fishing"]
];

let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

/* registered: three tiers each, in the catalog the builder is made from */
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/cognicopia_coloring_catalog.json"), "utf8"));
const tiers = {}; cat.assets.forEach(a => { (tiers[a.design_id] = tiers[a.design_id] || new Set()).add(a.tier); });
TITLES.forEach(([t, id]) => ok(tiers[id] && tiers[id].size === 3, `${t}: the library holds ${id} with all three tiers`));

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const errors = [], foreign = [];
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" });
await ctx.addInitScript(() => { window.__pr = 0; window.print = () => { window.__pr++; }; });
const p = await ctx.newPage();
p.on("pageerror", e => errors.push(e.message));
p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
p.on("dialog", d => d.accept());

await p.goto(base + "builder.html#/coloring"); await p.waitForSelector("#ccTabMk", { timeout: 20000 });
await p.click("#ccTabMk"); await p.waitForSelector("#ccMkQ");

for (const [title, id] of TITLES) {
  await p.fill("#ccMkQ", title); await p.click("#ccMkFind");
  await p.waitForFunction(() => !document.querySelector(".cc-mk-wait") && (document.querySelector(".cc-mk-card") || document.querySelector(".cc-mk-err")), null, { timeout: 30000 });
  const c = await p.evaluate(async () => {
    const card = document.querySelector(".cc-mk-card"); if (!card) return null;
    const img = card.querySelector("img"); await img.decode();
    const cv = document.createElement("canvas"); cv.width = img.naturalWidth; cv.height = img.naturalHeight; const x = cv.getContext("2d"); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, cv.width, cv.height).data; let bad = 0;
    for (let i = 0; i < d.length; i += 4) { const r = d[i]; if ((r !== 0 && r !== 255) || d[i + 1] !== r || d[i + 2] !== r || d[i + 3] !== 255) bad++; }
    return { design: card.dataset.design, w: img.naturalWidth, h: img.naturalHeight, bad };
  });
  ok(c && c.design === id, `${title}: asking for it finds ${id} first (${c && c.design})`);
  ok(c && c.w === 1800 && c.h === 2400 && c.bad === 0, `${title}: the page is 3:4, 1800 x 2400 and pure black and white (${c && c.w}x${c && c.h}, ${c && c.bad} gray)`);
  await p.click("#ccMkAdd");
}

/* the whole packet */
const q = await p.evaluate(() => ({ n: queue.length, designs: queue.map(i => (i.cfg.opts.pages || [])[0]) }));
ok(q.n === TITLES.length && TITLES.every(([, id]) => q.designs.includes(id)), `Add to packet queued all ${TITLES.length} (${q.n})`);
await p.evaluate(() => document.getElementById("generatePdf").click()); await p.waitForTimeout(4000);
const pr = await p.evaluate(() => {
  const root = document.getElementById("printRoot"), sheets = [...root.querySelectorAll(".sheet")];
  const nonBW = [...root.querySelectorAll(".sheet svg [stroke]:not([stroke='none']), .sheet svg [fill]:not([fill='none'])")].filter(e => { const s = e.getAttribute("stroke"), f = e.getAttribute("fill"); const okc = v => !v || v === "none" || /^(#000|#000000|black|#fff|#ffffff|white)$/i.test(v); return !(okc(s) && okc(f)); }).length;
  return { printed: window.__pr, sheets: sheets.length, nonBW, clean: root.classList.contains("pure-bw") };
});
ok(pr.printed >= 1 && pr.sheets >= TITLES.length, `the packet opens the print window with ${pr.sheets} sheets (one for each of ${TITLES.length})`);
ok(pr.clean && pr.nonBW === 0, `every sheet prints pure black on white (${pr.nonBW} lines or fills in another color)`);
ok(errors.length === 0, "no script or console error" + (errors.length ? ": " + [...new Set(errors)].slice(0, 3).join("; ") : ""));
ok(foreign.length === 0, "nothing was requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 3).join(", ") : ""));

await browser.close(); srv.close();
console.log(problems.length ? `coloring titles check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ") : `coloring titles check passed: ${passed} checks in a real browser (28 titles registered with three tiers, found by name, previewed in pure black and white, queued and printed)`);
process.exit(problems.length ? 1 : 0);
