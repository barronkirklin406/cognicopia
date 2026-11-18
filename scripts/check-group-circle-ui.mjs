#!/usr/bin/env node
/* =====================================================================
   The group circle on Daily engagement (js/groupCircle.js), in a real browser.

     choose     a "Lead a group circle" section lists the saved residents with 52 px choices and a theme; two to eight residents are needed
     script     each person gets one line at their own stage, by name, from the years they were about twenty: an invitation, never a question
                to get right; the late stage is one thing with a sensory line; no two people get the same thing when the bank allows it
     avoid      the avoid lists are joined: a thing any one of them avoids is out for the whole circle (and it does appear when that person
                is not in it), the joined words are written out on the page, and a theme one of them avoids is not offered
     again      "Another script" changes the lines
     page       "Print the script" makes one US Letter staff page, read back from a real PDF: pure black on white, inside the margins, every
                line 16 pt or larger; the card's own print area is put back afterwards
     fingers    7:1 and 52 px by day and in Night Shift, 1366 x 768 and 390 x 844, no sideways scroll
     private    nothing is requested from outside the page
   Made-up people only. Needs Playwright (and PyMuPDF for the page). Run: node scripts/check-group-circle-ui.mjs
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
const person = (id, name, o) => ({ schema: "cognicopia.residentProfile", version: 2, id, tier1_core: { preferredName: name, cognitiveTier: o.tier, printNeeds: {}, topHobbies: [], topicsToAvoid: { topics: [], eras: [], people: "", places: "", other: o.avoid || "" } }, tier2_enrichment: { birthYear: o.born }, tier3_deep: { notes: "" } });
const DOT = person("res-dot", "Dorothy", { tier: 2, born: 1924, avoid: "radio" }), WAL = person("res-wal", "Walter", { tier: 1, born: 1938 }), LENA = person("res-lena", "Lena", { tier: 3, born: 1946 });
const MANY = [1, 2, 3, 4, 5, 6, 7].map(n => person("res-m" + n, "Person" + n, { tier: 2, born: 1930 + n }));

async function open(w, h, night) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block" });
  await ctx.addInitScript(n => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); if (n) localStorage.setItem("cognicopia_night_shift", "1"); } catch (e) { /* ignore */ } window.print = () => { window.__printed = (window.__printed || 0) + 1; }; }, !!night);
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + "daily.html", { waitUntil: "load" }); await p.waitForTimeout(1300);
  return { ctx, p };
}
async function withResidents(list, w, h, night) {
  const { ctx, p } = await open(w || 1366, h || 800, night);
  await p.evaluate(async l => { const S = window.CogniSecureStore.storage; l.forEach(x => S.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))); await window.CogniSecureStore.flush(); }, list);
  await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1500);
  await p.click("#dyCircleH"); await p.waitForTimeout(300);
  return { ctx, p };
}
const choose = async (p, names) => { for (const n of names) await p.setChecked(`#dyCircleWho label:has-text("${n}") input`, true, { force: true }); };
const lines = p => p.$$eval("#dyCircleOut li", e => e.map(x => x.textContent.replace(/\s+/g, " ")));
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

try {
  /* ---------- choosing ---------- */
  {
    const { ctx, p } = await withResidents([DOT, WAL, LENA, ...MANY]);
    ok((await p.$$("#dyCircleWho input")).length === 10, "every saved resident can be chosen");
    const sz = await p.$$eval("#dyCircleWho label, #dyCircleTheme, #dyCircleMake", e => e.map(x => Math.round(x.getBoundingClientRect().height)));
    ok(sz.every(h => h >= 52), `the choices, the theme and the button are 52 px (${[...new Set(sz)]})`);
    await choose(p, ["Dorothy"]); await p.click("#dyCircleMake"); await p.waitForTimeout(300);
    ok(/Choose two to eight/.test(await p.textContent("#dyCircleMsg")) && (await lines(p)).length === 0, "one resident is not a circle");
    await choose(p, ["Walter", "Lena", "Person1", "Person2", "Person3", "Person4", "Person5", "Person6"]); await p.click("#dyCircleMake"); await p.waitForTimeout(300);
    ok(/Choose two to eight/.test(await p.textContent("#dyCircleMsg")) && (await lines(p)).length === 0, "nine residents are too many for one circle");
    await ctx.close();
  }
  /* ---------- the script ---------- */
  {
    const { ctx, p } = await withResidents([DOT, WAL, LENA]);
    await p.selectOption("#dyCircleTheme", "music"); await choose(p, ["Dorothy", "Walter", "Lena"]); await p.click("#dyCircleMake"); await p.waitForTimeout(400);
    const l = await lines(p);
    const at = n => l.find(x => x.startsWith(n + ": ")) || "";
    ok(l.length === 3 && at("Dorothy") && at("Walter") && at("Lena"), `a line for each person, by name (${l.length})`);
    ok(l.every(x => /“.+”/.test(x)), "each line is a quoted invitation to say aloud");
    ok(/Listen\. Tap along if you like\./.test(at("Lena")) && !/Listen/.test(at("Dorothy")) && !/Listen/.test(at("Walter")), "the late stage is one thing with a sensory line; the others are not");
    const tone = await p.evaluate(ls => ls.map(x => CognicopiaActivityEngine.toneProblems(x)), l);
    ok(tone.every(t => !t.length) && !/\b(do you remember|what year|quiz|test)\b/i.test(l.join(" ")), "nothing tests or talks down");
    ok(!/radio/i.test(l.join(" ")), "Dorothy avoids radio, so nobody in the circle is offered it");
    ok(/Kept off this circle/.test(await p.textContent("#dyCircleOut")) && /Radio/.test(await p.textContent("#dyCircleOut")), "the joined avoid words are written out");
    const things = new Set(l.map(x => x.replace(/^[^:]+: /, "")));
    ok(things.size === 3, "no two people are given the same thing");
    const before = l.join("|"); await p.click("#dyCircleAgain"); await p.waitForTimeout(300);
    ok((await lines(p)).join("|") !== before, "Another script changes the lines");
    /* the avoided word does appear when its person is not in the circle: across a few scripts */
    await p.setChecked('#dyCircleWho label:has-text("Dorothy") input', false, { force: true });
    let seenRadio = false; for (let i = 0; i < 6 && !seenRadio; i++) { await p.click(i ? "#dyCircleAgain" : "#dyCircleMake"); await p.waitForTimeout(250); seenRadio = /radio/i.test((await lines(p)).join(" ")); }
    ok(seenRadio, "the word does appear when the person who avoids it is not in the circle, so the check cannot pass by luck");
    await p.setChecked('#dyCircleWho label:has-text("Dorothy") input', true, { force: true }); await p.click("#dyCircleMake");
    let leaked = false; for (let i = 0; i < 8; i++) { await p.click(i ? "#dyCircleAgain" : "#dyCircleMake"); await p.waitForTimeout(200); if (/radio/i.test((await lines(p)).join(" "))) leaked = true; }
    ok(!leaked, "across eight scripts with Dorothy in the circle, radio never appears");
    await ctx.close();
  }
  /* ---------- a theme one of them avoids ---------- */
  {
    const g = person("res-g", "Gail", { tier: 2, born: 1930, avoid: "music" });
    const { ctx, p } = await withResidents([g, WAL]);
    await p.selectOption("#dyCircleTheme", "music"); await choose(p, ["Gail", "Walter"]); await p.click("#dyCircleMake"); await p.waitForTimeout(300);
    ok(/avoids this theme/.test(await p.textContent("#dyCircleMsg")) && (await lines(p)).length === 0 && await p.$eval("#dyCirclePrint", e => e.disabled), "a theme one of them avoids is not offered");
    await p.selectOption("#dyCircleTheme", "food"); await p.click("#dyCircleMake"); await p.waitForTimeout(300);
    ok((await lines(p)).length === 2, "another theme works");
    await ctx.close();
  }
  /* ---------- the page ---------- */
  {
    const { ctx, p } = await withResidents([DOT, WAL, LENA]);
    await p.selectOption("#dyCircleTheme", "home"); await choose(p, ["Dorothy", "Walter", "Lena"]); await p.click("#dyCircleMake"); await p.waitForTimeout(300);
    await p.click("#dyCirclePrint"); await p.waitForTimeout(500);
    ok((await p.evaluate(() => window.__printed)) === 1 && await p.evaluate(() => !!document.querySelector("#printRoot .cg-staff-sheet")), "Print the script opens the print window with the staff page");
    const pdf = path.join(os.tmpdir(), "group-circle-check.pdf");
    await p.emulateMedia({ media: "print" }); fs.writeFileSync(pdf, await p.pdf({ width: "8.5in", height: "11in", printBackground: true, preferCSSPageSize: true })); await p.emulateMedia({ media: "screen" });
    let back = null; try { back = JSON.parse(execFileSync("python3", ["-I", "-c", PY, pdf], { encoding: "utf8" })); } catch (e) { notes.push("PyMuPDF could not read the PDF here"); }
    if (!back || back.missing) notes.push("PyMuPDF is not installed for python3: the printed page was not read back");
    else {
      const flat = back[0].text.replace(/\s+/g, " ");
      ok(back.length === 1 && /group circle/i.test(flat) && /Dorothy:/.test(flat) && /Walter:/.test(flat) && /Lena:/.test(flat) && /Kept off this circle/.test(flat), `one page with the names, the lines and what is kept off (${back.length})`);
      ok(back[0].small.length === 0 && back[0].colors.every(c => c === 0), `16 pt or larger, pure black (${back[0].small}, ${back[0].colors})`);
      ok(back[0].ink[0] >= 35.9 && back[0].ink[1] >= 35.5 && back[0].ink[2] <= 576.1 && back[0].ink[3] <= 756.1, `inside the 0.5 in margins (${back[0].ink.map(Math.round)})`);
    }
    await p.evaluate(() => window.dispatchEvent(new Event("afterprint"))); await p.waitForTimeout(200);
    ok(await p.evaluate(() => !document.querySelector("#printRoot .cg-staff-sheet")), "afterwards the card's own print area is put back");
    await ctx.close();
  }
  /* ---------- by day and in Night Shift, on a phone ---------- */
  for (const [w, h, night] of [[1366, 768, false], [390, 844, false], [1366, 768, true], [390, 844, true]]) {
    const { ctx, p } = await withResidents([DOT, WAL, LENA], w, h, night);
    await choose(p, ["Dorothy", "Walter", "Lena"]); await p.click("#dyCircleMake"); await p.waitForTimeout(300);
    const m = await p.evaluate(new Function(lumJs + `const box=document.querySelector("#dyCircleBox"),low=[];box.querySelectorAll("*").forEach(el=>{if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))return;const a=lum(getComputedStyle(el).color),b=lum(bgOf(el)),r=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);if(r<7)low.push(r.toFixed(2)+" "+el.textContent.trim().slice(0,20))});const sm=[];box.querySelectorAll("button,select,#dyCircleWho label,summary").forEach(b=>{const r=b.getBoundingClientRect();if(r.width&&r.height&&(r.height<52||r.width<52))sm.push(Math.round(r.width)+"x"+Math.round(r.height))});return{low,sm,sideways:document.documentElement.scrollWidth>innerWidth+1}`));
    ok(!m.low.length && !m.sm.length && !m.sideways, `${w}${night ? " night" : ""}: 7:1, 52 px, no sideways scroll (${m.low.concat(m.sm).join(", ") || "yes"})`);
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }

ok(!foreign.length, `nothing requested from outside the page: ${foreign.slice(0, 3).join(", ")}`);
ok(!errors.length, `no script errors: ${errors.slice(0, 3).join(" | ")}`);
console.log(problems.length ? `group circle check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 40).join("\n  - ") : `group circle check passed: ${passed} checks` + (notes.length ? "\n  note: " + notes.join("; ") : ""));
process.exit(problems.length ? 1 : 0);
