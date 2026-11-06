#!/usr/bin/env node
/* Era-Locked Conversational Decks on the Packet Builder page, in a real browser (Playwright; exit 2 where it is not installed):
   the screen is renamed, the category filter and grouping change the deck, and "Print cut-out cards" prints a Letter PDF with four
   cards to a page, dashed cut lines, a response row on every front, a caregiver back page, and every invitation fitting its card. */
import { loadPlaywright, serve } from "./lib/browser.mjs";
import { execFileSync } from "node:child_process"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const { chromium } = loadPlaywright(); const { srv, base } = await serve(); const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (x) { /* ignore */ } });
  const p = await ctx.newPage(), errs = [], outside = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 160))); p.on("request", (r) => { if (!r.url().startsWith(base) && !/^(data|blob|about):/.test(r.url())) outside.push(r.url()); });
  await p.goto(base + "builder.html#/reminiscence"); await p.waitForSelector("#rmRoot", { timeout: 15000 }); await p.waitForTimeout(1200);
  const t = await p.evaluate(() => ({ h1: document.querySelector("h1").textContent, lede: document.querySelector(".lede").textContent, old: /Reminiscence Cards/.test(document.body.innerText), chips: document.querySelectorAll("#dkFilter [data-cat]").length, tags: document.querySelectorAll("#rmPv .dk-tag").length }));
  ok(t.h1 === "Era-Locked Conversational Decks" && /locked to a resident.s own era/.test(t.lede) && /birth|born|years they were born/.test(t.lede) && !t.old && t.chips === 4 && t.tags === 1, "the screen is renamed, says the prompts are anchored to the birth era and life history, and cards carry a category tag");
  await p.selectOption("#rmCount", "12"); await p.waitForTimeout(300);
  const all = await p.$$eval("#rmList small", (e) => e.map((x) => x.textContent));
  ok(all.length >= 8 && new Set(all).size >= 3, "a deck of 12 spans several categories (" + all.length + " cards: " + [...new Set(all)].join(", ") + ")");
  for (const c of ["hometown", "career", "family"]) await p.uncheck(`#dkFilter [data-cat="${c}"]`);
  await p.waitForTimeout(300); const music = await p.$$eval("#rmList small", (e) => e.map((x) => x.textContent));
  ok(music.length > 0 && music.every((x) => x === "Music"), "choosing Music shows only Music cards (" + music.length + ")");
  for (const c of ["hometown", "career", "family"]) await p.check(`#dkFilter [data-cat="${c}"]`);
  await p.check("#dkSort"); await p.waitForTimeout(300); const grouped = await p.$$eval("#rmList small", (e) => e.map((x) => x.textContent)); const order = ["Hometown", "Career", "Music", "Family"], idx = grouped.map((x) => order.indexOf(x));
  ok(idx.every((v, i) => i === 0 || v >= idx[i - 1]), "grouping puts the deck in category order (" + grouped.join(",") + ")");
  const tap = await p.$$eval("#dkFilter label", (e) => e.map((x) => Math.round(x.getBoundingClientRect().height))); ok(Math.min(...tap) >= 52, "every filter control is at least 52 px tall (" + Math.min(...tap) + ")");
  await p.evaluate(() => { window.print = () => {}; }); await p.click("#rmDeck"); await p.waitForTimeout(1500);
  const geo = await p.evaluate(() => { const g = [...document.querySelectorAll(".dk-sheet:not(.dk-backpage) .dk-grid")][0], cards = [...document.querySelectorAll(".dk-front")], fit = cards.map((c) => { const i = c.querySelector(".dk-invite"); return i.scrollHeight <= i.clientHeight + 1; }), frames = cards.map((c) => { const f = c.querySelector(".dk-frame"); return f.scrollHeight <= f.clientHeight + 1; }); return { sheets: document.querySelectorAll(".dk-sheet").length, fronts: cards.length, backs: document.querySelectorAll(".dk-back").length, resp: document.querySelectorAll(".dk-front .dk-resp").length, boxes: document.querySelectorAll(".dk-front .dk-box").length, fitInvite: fit.every(Boolean), fitFrame: frames.every(Boolean), dashed: getComputedStyle(document.querySelector(".dk-card")).borderRightStyle, w: Math.round(document.querySelector(".dk-card").getBoundingClientRect().width), h: Math.round(document.querySelector(".dk-card").getBoundingClientRect().height) }; });
  ok(geo.sheets >= 2 && geo.fronts === geo.resp && geo.boxes === 3 * geo.fronts && geo.backs >= geo.fronts && geo.dashed === "dashed", "the print stage holds the front and back pages, a response row with three boxes on every front, and dashed cut lines (" + geo.fronts + " fronts)");
  await p.emulateMedia({ media: "print" });
  { const m = await p.evaluate(() => { const cards = [...document.querySelectorAll(".dk-front")], fit = cards.map((c) => { const i = c.querySelector(".dk-invite"); return i.scrollHeight <= i.clientHeight + 1; }), fr = cards.map((c) => { const f = c.querySelector(".dk-frame"); return f.scrollHeight <= f.clientHeight + 1; }), r = cards[0].getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), fitInvite: fit.every(Boolean), fitFrame: fr.every(Boolean) }; });
    ok(m.w === 360 && m.h === Math.round(4.85 * 96) && m.fitInvite && m.fitFrame, "each card is 3.75 x 4.85 in and every invitation and frame fits its card (" + m.w + " x " + m.h + " px)"); }
  const pdf = path.join(os.tmpdir(), "dk-" + process.pid + ".pdf"); fs.writeFileSync(pdf, await p.pdf({ preferCSSPageSize: true, printBackground: true }));
  const py = `import pdfplumber,json,sys
with pdfplumber.open(sys.argv[1]) as pdf:
    print(json.dumps({"n":len(pdf.pages),"w":pdf.pages[0].width,"h":pdf.pages[0].height,"p1":(pdf.pages[0].extract_text() or ""),"p2":(pdf.pages[1].extract_text() or "") if len(pdf.pages)>1 else "","edges":[[round(min(c["x0"] for c in pg.chars),1),round(max(c["x1"] for c in pg.chars),1),round(max(c["bottom"] for c in pg.chars),1)] for pg in pdf.pages if pg.chars]}))`;
  const g = JSON.parse(execFileSync("python3", ["-c", py, pdf], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })); fs.unlinkSync(pdf);
  ok(g.n === geo.sheets && Math.round(g.w) === 612 && Math.round(g.h) === 792, "the PDF has one Letter page per sheet (" + g.n + " of " + geo.sheets + ")");
  ok(/Positive/.test(g.p1) && /Neutral/.test(g.p1) && /Story elicited/.test(g.p1) && /Cut on the dashed lines/.test(g.p1) && /caregiver/i.test(g.p2), "page one carries the response rows and the cutting note; page two is the caregiver backs");
  ok(g.edges.every((e) => e[0] >= 36 - 1.5 && e[1] <= 612 - 36 + 1.5 && e[2] <= 792 - 36 + 1.5), "all text stays inside the 0.5 in margins");
  /* color is opt-in: black and white by default, tinted tags only when asked */
  await p.emulateMedia({ media: "screen" }); await p.check("#dkColor"); await p.click("#rmDeck"); await p.waitForTimeout(1200); await p.emulateMedia({ media: "print" });
  const tint = await p.evaluate(() => [...document.querySelectorAll("#printRoot .dk-front")].map((c) => [c.dataset.cat, getComputedStyle(c.querySelector(".dk-tag")).backgroundColor]));
  const want = { hometown: "rgb(207, 232, 230)", career: "rgb(246, 205, 180)", music: "rgb(223, 224, 247)", family: "rgb(243, 230, 179)" };
  ok(tint.length > 0 && tint.every(([c, bg]) => bg === want[c]), "with category colors chosen, each tag prints in its own tint (" + [...new Set(tint.map((t) => t[0]))].join(", ") + ")");
  ok(outside.length === 0 && errs.length === 0, "no outside request and no script error (" + outside.concat(errs).slice(0, 2).join("; ") + ")");
  await ctx.close();
} finally { await browser.close(); srv.close(); }
if (problems.length) { console.error("era decks UI check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("era decks UI check passed: " + passed + " checks in a real browser (renamed screen, category filter and grouping, cut-out cardstock PDF with response rows and backs)");
