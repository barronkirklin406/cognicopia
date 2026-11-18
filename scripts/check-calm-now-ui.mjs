#!/usr/bin/env node
/* =====================================================================
   Calm now (js/calmNow.js) and the late-stage "to hold" line, in a real browser.

     button     "Calm now" on the active resident bar of the tool pages and on the Packet Builder's "Working with" bar, 52 px, only with a
                resident chosen; terracotta for the fill (white text), never for small text
     dialog     opens as a real modal (focus moves in, Escape closes, focus returns to the button) with their comforts and favorite dish, safe
                things to talk about, the topics to avoid written out, a few lines to say that ask nothing (no question marks), songs of their
                years (titles only) and the line to follow the facility's protocol; thin profiles get honest fallbacks, never an invented fact
     avoid      a topic to avoid never reaches the comforts, talk or songs (and the word does appear when nothing is avoided)
     page       "Print one page" makes one US Letter staff page, read back from a real PDF: pure black on white, inside the margins, every line
                16 pt or larger, the name, the avoid list and the protocol line on it
     hold       a late-stage Daily card and the Studio at stage 3 each say, for staff, one thing to put in their hands with the engine's safety
                line; earlier stages do not
     fingers    7:1 and 52 px by day and in Night Shift, 1366 x 768 and 390 x 844, no sideways scroll
     private    nothing is requested from outside the page
   Made-up people only. Needs Playwright (and PyMuPDF for the page). Run: node scripts/check-calm-now-ui.mjs
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
const person = (id, name, o = {}) => ({ schema: "cognicopia.residentProfile", version: 2, id, tier1_core: { preferredName: name, cognitiveTier: o.tier || 2, unitNumber: "302-B", topHobbies: o.thin ? [] : [{ code: "gardening", label: "Gardening" }], printNeeds: {},
  topicsToAvoid: { topics: o.topics || [], eras: [], people: "", places: "", other: o.avoid || "" } },
  tier2_enrichment: o.thin ? {} : { birthYear: o.born || 1924, hometown: { place: "Scobey, Montana" }, music: { genres: [], artists: ["Patsy Cline"], favoriteSong: "Tennessee Waltz" } },
  tier3_deep: o.thin ? { notes: "" } : { notes: "", comforts: ["a warm blanket", "a cup of tea"], signatureDish: { name: "Apple pie", ingredients: ["apples"], steps: ["bake"] } } });
const DOT = person("res-dot", "Dorothy", { avoid: "radio, storms", topics: [{ code: "religion", label: "Religion" }] }), SAM = person("res-sam", "Samuel", { thin: true, tier: 3 }), FREE = person("res-free", "Frances"), LATE = person("res-late", "Lena", { tier: 3 });

async function open(w, h, file, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block" });
  await ctx.addInitScript(a => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); if (a.night) localStorage.setItem("cognicopia_night_shift", "1"); if (a.active) localStorage.setItem("cognicopia_active_resident", a.active); } catch (e) { /* ignore */ } window.print = () => { window.__printed = (window.__printed || 0) + 1; }; }, { night: !!o.night, active: o.active || "" });
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + file, { waitUntil: "load" }); await p.waitForTimeout(1300);
  return { ctx, p };
}
const seed = (p, list) => p.evaluate(async l => { const S = window.CogniSecureStore.storage; l.forEach(x => S.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))); await window.CogniSecureStore.flush(); }, list);
/* seed in one page, then work in the same browser context with a resident active */
async function withResident(file, id, list, o) {
  const { ctx, p } = await open(1366, 800, "daily.html", Object.assign({}, o, { active: id }));
  await seed(p, list); await p.goto(base + file, { waitUntil: "load" }); await p.waitForTimeout(1800);
  return { ctx, p };
}
const dialogText = p => p.$eval("dialog.cg-calm", e => e.textContent.replace(/\s+/g, " "));
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
    small = []; colors = set(); x0 = y0 = 9999; x1 = y1 = 0
    for b in pg.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                if not s["text"].strip() or s["bbox"][3] <= 30: continue
                colors.add(s["color"]); x0 = min(x0, s["bbox"][0]); y0 = min(y0, s["bbox"][1]); x1 = max(x1, s["bbox"][2]); y1 = max(y1, s["bbox"][3])
                if s["size"] < 15.9: small.append(round(s["size"], 1))
    out.append({"small": small, "colors": sorted(colors), "ink": [x0, y0, x1, y1], "text": pg.get_text()})
print(json.dumps(out))
`;
const lumJs = "const lum=c=>{const m=c.match(/[\\d.]+/g);const[r,g,b]=m.slice(0,3).map(v=>{v=v/255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};const bgOf=el=>{for(let e=el;e;e=e.parentElement){const c=getComputedStyle(e).backgroundColor,m=c.match(/[\\d.]+/g);if(m&&(m.length<4||+m[3]>.5))return c}return 'rgb(255,255,255)'};";
const contrast = (p, sel) => p.evaluate(new Function("s", lumJs + "const box=document.querySelector(s);const low=[];box.querySelectorAll('*').forEach(el=>{if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))return;const a=lum(getComputedStyle(el).color),b=lum(bgOf(el)),r=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);if(r<7)low.push(r.toFixed(2)+' '+el.textContent.trim().slice(0,20))});const sm=[];box.querySelectorAll('button').forEach(b=>{const r=b.getBoundingClientRect();if(r.width&&r.height&&(r.height<52||r.width<52))sm.push(Math.round(r.width)+'x'+Math.round(r.height))});return{low,sm,sideways:document.documentElement.scrollWidth>innerWidth+1}"), sel);

try {
  /* ---------- the button ---------- */
  {
    const { ctx, p } = await open(1366, 800, "daily.html");
    ok(!(await p.$("#wfCalm")), "no button with nobody chosen");
    await ctx.close();
    const w = await withResident("activity-studio.html", "res-dot", [DOT, SAM, FREE, LATE]);
    const b = await w.p.$eval("#wfCalm", e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, t: e.textContent.trim(), bg: getComputedStyle(e).backgroundColor }; });
    ok(b.h >= 52 && b.w >= 52 && b.t === "Calm now" && !/emoji/.test(b.t), `a "Calm now" button on the active bar, 52 px (${Math.round(b.w)} x ${Math.round(b.h)})`);
    /* ---------- the dialog ---------- */
    await w.p.click("#wfCalm"); await w.p.waitForSelector("dialog.cg-calm[open]", { timeout: 8000 });
    ok(await w.p.evaluate(() => document.querySelector("dialog.cg-calm").contains(document.activeElement)), "it opens as a modal and focus moves into it");
    const t = await dialogText(w.p);
    ok(/Calm now: Dorothy/.test(t) && /a warm blanket/.test(t) && /a cup of tea/.test(t) && /A favorite dish: Apple pie/.test(t), "comforts and the favorite dish are there");
    ok(/Gardening/.test(t) && /Where they grew up: Scobey/.test(t), "safe things to talk about are there");
    ok(/Avoid right now/.test(t) && /Religion/.test(t) && /Radio/.test(t) && /Storms/.test(t), "the topics to avoid are written out");
    ok(/You are safe here\. Someone is beside you\./.test(t) && /Take all the time you like\./.test(t) && !/\?/.test(t), "a few lines to say, and nothing in it asks a question");
    ok(/Songs of their years/.test(t) && /Tennessee Waltz/.test(t) && !/\b(lyrics|chorus)\b/i.test(t), "songs of their years, titles only");
    ok(/follow your facility.s own protocol and call the nurse/.test(t), "the line to follow the facility's own protocol");
    ok(!/\b(ensures?|proves?|compliant|finding|diagnos)/i.test(t), "no claim, no finding");
    await w.p.keyboard.press("Escape"); await w.p.waitForTimeout(300);
    ok(!(await w.p.$("dialog.cg-calm[open]")) && await w.p.evaluate(() => document.activeElement && document.activeElement.id === "wfCalm"), "Escape closes it and focus goes back to the button");
    /* the page */
    await w.p.click("#wfCalm"); await w.p.waitForSelector("dialog.cg-calm[open]"); await w.p.click("[data-calm-print]"); await w.p.waitForTimeout(500);
    ok((await w.p.evaluate(() => window.__printed)) === 1 && await w.p.evaluate(() => document.documentElement.classList.contains("cg-calm-printing") && !!document.querySelector(".cg-staff-sheet")), "Print one page opens the print window with the staff page");
    const pdf = path.join(os.tmpdir(), "calm-now-check.pdf");
    await w.p.emulateMedia({ media: "print" }); fs.writeFileSync(pdf, await w.p.pdf({ width: "8.5in", height: "11in", printBackground: true, preferCSSPageSize: true })); await w.p.emulateMedia({ media: "screen" });
    let back = null; try { back = JSON.parse(execFileSync("python3", ["-I", "-c", PY, pdf], { encoding: "utf8" })); } catch (e) { notes.push("PyMuPDF could not read the PDF here"); }
    if (!back || back.missing) notes.push("PyMuPDF is not installed for python3: the printed page was not read back");
    else {
      ok(back.length === 1, `one page (${back.length})`);
      ok(back[0].small.length === 0, `no text under 16 pt (${back[0].small})`);
      ok(back[0].colors.every(c => c === 0), `pure black text (${back[0].colors})`);
      ok(back[0].ink[0] >= 35.9 && back[0].ink[1] >= 35.5 && back[0].ink[2] <= 576.1 && back[0].ink[3] <= 756.1, `inside the 0.5 in margins (${back[0].ink.map(Math.round)})`);
      const flat = back[0].text.replace(/\s+/g, " "); ok(/calm now/i.test(flat) && /Dorothy/.test(flat) && /Radio/.test(flat) && /follow your facility/.test(flat), "the name, the avoid list and the protocol line are on it");
    }
    await w.ctx.close();
  }
  /* ---------- thin profile, and avoid with a word that does appear ---------- */
  {
    const w = await withResident("activity-studio.html", "res-sam", [DOT, SAM, FREE, LATE]);
    await w.p.click("#wfCalm"); await w.p.waitForSelector("dialog.cg-calm[open]");
    const t = await dialogText(w.p);
    ok(/None are recorded yet\. A cup of tea/.test(t) && /Describe what you can see together/.test(t) && /Nothing is listed\. Follow their lead\./.test(t) && !/Apple pie|Scobey/.test(t), "a thin profile gets honest fallbacks and no invented fact");
    await w.ctx.close();
    const f = await withResident("activity-studio.html", "res-free", [DOT, SAM, FREE, LATE]);
    await f.p.click("#wfCalm"); await f.p.waitForSelector("dialog.cg-calm[open]");
    const ft = await dialogText(f.p);
    ok(/Gardening/.test(ft) && /Tennessee Waltz/.test(ft) && /In the Mood|Glenn Miller|Moonlight|Sentimental/i.test(ft), "with nothing avoided, gardening, her favorite song and songs of her years appear");
    await f.ctx.close();
    const g = await withResident("activity-studio.html", "res-g", [person("res-g", "Gail", { avoid: "gardening, mood, tennessee" })]);
    await g.p.click("#wfCalm"); await g.p.waitForSelector("dialog.cg-calm[open]");
    const gt = await dialogText(g.p);
    const body = gt.replace(/Avoid right now.*?What to say/, "What to say");
    ok(!/Gardening/i.test(body) && !/Tennessee/i.test(body) && !/In the Mood/i.test(body), "a topic to avoid keeps gardening, a song of hers and a title out of the lists (it is written out under Avoid right now)");
    await g.ctx.close();
  }
  /* ---------- the Packet Builder's own bar ---------- */
  {
    const { ctx, p } = await open(1366, 800, "builder.html#/");
    await seed(p, [DOT]); await p.evaluate(() => { try { sessionStorage.setItem("cgb_active_resident", "res-dot"); } catch (e) { /* ignore */ } }); await p.reload({ waitUntil: "load" }); await p.waitForTimeout(2200);
    const vis = await p.$eval("#arCalm", e => { const r = e.getBoundingClientRect(); return { h: r.height, hidden: e.hidden }; });
    ok(!vis.hidden && vis.h >= 52, `the Builder's "Working with" bar has the button too (${vis.h})`);
    await p.click("#arCalm"); await p.waitForSelector("dialog.cg-calm[open]", { timeout: 8000 });
    ok(/Calm now: /.test(await dialogText(p)), "and it opens the same dialog");
    await ctx.close();
  }
  /* ---------- the late-stage "to hold" line ---------- */
  {
    const w = await withResident("daily.html", "res-late", [DOT, LATE]);
    await w.p.selectOption("#dyWho", "res-late"); await w.p.click("#dyMake"); await w.p.waitForTimeout(1500);
    const hold = await w.p.$eval("#dyHold", e => ({ hidden: e.hidden, t: e.textContent }));
    ok(!hold.hidden && /^To hold, for staff: .+too large to swallow/.test(hold.t), `a late-stage card says one thing to hold, with the safety line (${hold.t.slice(0, 80)})`);
    await w.p.selectOption("#dyWho", "res-dot"); await w.p.click("#dyMake"); await w.p.waitForTimeout(1200);
    ok(await w.p.$eval("#dyHold", e => e.hidden), "a middle-stage card does not");
    await w.ctx.close();
    const s = await withResident("activity-studio.html", "res-late", [DOT, LATE]);
    await s.p.selectOption("#asResident", "res-late"); await s.p.waitForTimeout(1800);
    const notesText = await s.p.evaluate(() => document.body.innerText);
    ok(/To hold, for staff: .+too large to swallow/.test(notesText), "the Studio says it at stage 3");
    await s.p.selectOption("#asResident", "res-dot"); await s.p.waitForTimeout(1500);
    ok(!/To hold, for staff:/.test(await s.p.evaluate(() => document.body.innerText)), "and not at stage 2");
    ok(!/To hold/.test(await s.p.$eval("#asSheet svg", e => e.textContent)), "it is never on a page");
    await s.ctx.close();
  }
  /* ---------- by day and in Night Shift, on a phone ---------- */
  for (const [w, h, night] of [[1366, 768, false], [390, 844, false], [1366, 768, true], [390, 844, true]]) {
    const ctx0 = await open(w, h, "daily.html", { night, active: "res-dot" });
    await seed(ctx0.p, [DOT]); await ctx0.p.goto(base + "activity-studio.html", { waitUntil: "load" }); await ctx0.p.waitForTimeout(1800);
    await ctx0.p.click("#wfCalm"); await ctx0.p.waitForSelector("dialog.cg-calm[open]");
    const m = await contrast(ctx0.p, "dialog.cg-calm"), bar = await contrast(ctx0.p, "#wfCalm");
    ok(!m.low.length && !m.sm.length && !m.sideways && !bar.low.length, `${w}${night ? " night" : ""}: the dialog and the button read at 7:1 and are 52 px, no sideways scroll (${m.low.concat(m.sm, bar.low).join(", ") || "yes"})`);
    await ctx0.ctx.close();
  }
} finally { await browser.close(); srv.close(); }

ok(!foreign.length, `nothing requested from outside the page: ${foreign.slice(0, 3).join(", ")}`);
ok(!errors.length, `no script errors: ${errors.slice(0, 3).join(" | ")}`);
console.log(problems.length ? `calm now check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 40).join("\n  - ") : `calm now check passed: ${passed} checks` + (notes.length ? "\n  note: " + notes.join("; ") : ""));
process.exit(problems.length ? 1 : 0);
