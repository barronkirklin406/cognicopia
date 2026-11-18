#!/usr/bin/env node
/* =====================================================================
   The activity documentation summary (js/activityDocs.js) on the Facility Portal's Audit readiness tab, in a real browser.

     choice     a card with a 52 px "Who" choice (a sample of up to five, every saved resident, or one), the names choice and a Print
                button, readable at 7:1 by day and in Night Shift, at 1366 x 768 and 390 x 844; a plain message with nobody saved
     page       one US Letter page for each resident: how many of eight things are on their profile (by name, never the answers) and the
                next question for the family (with fewer than three: work, hometown and one joy), the packets made and the sessions
                taken part in over the last 30 days with how, the support level and the type and line weight it brings, and their
                topics to avoid written out (or that nothing is listed); a resident with no log says so
     names      the page carries the name or the alias, as the facility chose
     claims     it supports records and says it is not an assessment; no claim of proof, compliance or a finding
     paper      read back from a real PDF with PyMuPDF: pure black on white, inside the 0.5 in margins, every line 16 pt or larger, one
                page each, nothing clipped
     private    nothing is requested from outside the page
   Made-up people only. Needs Playwright (and PyMuPDF for the PDF). Run: node scripts/check-activity-docs-ui.mjs
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0, notes = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const person = (id, name, o = {}) => ({ schema: "cognicopia.residentProfile", version: 2, id, tier1_core: { preferredName: name, cognitiveTier: o.tier || 2, unitNumber: o.unit || "", occupation: o.full ? { code: "teacher", label: "Teacher" } : undefined, topHobbies: o.full ? [{ code: "gardening", label: "Gardening" }] : [],
  printNeeds: o.full ? { vision: { code: "xl" } } : {}, topicsToAvoid: { topics: [], eras: [], people: "", places: "", other: o.avoid || "" } },
  tier2_enrichment: o.full ? { birthYear: 1938, hometown: { place: "Scobey, Montana" }, music: { genres: [], artists: ["Patsy Cline"], favoriteSong: "Tennessee Waltz" } } : {},
  tier3_deep: o.full ? { notes: "", comforts: ["a warm blanket"], signatureDish: { name: "Apple pie", ingredients: ["apples"], steps: ["bake"] }, people: [{ name: "Sarah Lee", relationship: { code: "daughter", label: "Daughter" } }] } : { notes: "" } });
const DOT = person("res-dot", "Dorothy", { full: true, tier: 2, avoid: "radio, storms", unit: "302-B" }), SAM = person("res-sam", "Samuel", { tier: 3 }), RUTH = person("res-ruth", "Ruth", { full: true, tier: 1 });

async function open(w, h, night, file) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block" });
  await ctx.addInitScript(n => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); if (n) localStorage.setItem("cognicopia_night_shift", "1"); } catch (e) { /* ignore */ } window.print = () => { window.__printed = (window.__printed || 0) + 1; }; }, !!night);
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + (file || "builder.html#/facility"), { waitUntil: "load" }); await p.waitForTimeout(1800);
  return { ctx, p };
}
const toAudit = async p => { const tabs = await p.$$("#fpBar [role=tab], .fp-tab"); for (const t of tabs) if (/Audit readiness/.test(await t.textContent())) { await t.click(); await p.waitForTimeout(700); return true; } return false; };
const seed = (p, list) => p.evaluate(async l => {
  const S = window.CogniSecureStore.storage; l.forEach(x => S.setItem("cognicopia_resident_" + x.id, JSON.stringify(x)));
  await window.CogniSecureStore.flush();
}, list);
const log = p => p.evaluate(async () => {
  await CogniEngage.ready();
  const E = CogniEngage; await E.record("res-dot", { participation: "engaged", note: "", activity: "Singing together" }, ["Dorothy"]); await E.record("res-dot", { participation: "joined", note: "", activity: "Daily card" }, ["Dorothy"]); await E.record("res-dot", { participation: "declined", note: "", activity: "Word search" }, ["Dorothy"]);
  let t = TrackerUI.read("res-dot"); t = CogniTracker.notePacket(t, { pillars: [], names: ["Memory Lane", "Finish the Saying"], minutes: 20 }); TrackerUI.write(t); await window.CogniSecureStore.flush();
});
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
    d = pg.get_text("dict"); small = []; colors = set(); x0 = y0 = 9999; x1 = y1 = 0
    for b in d["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                if not s["text"].strip() or s["bbox"][3] <= 30: continue      # the site's one-line non-medical notice in the top margin is not page text
                colors.add(s["color"]); x0 = min(x0, s["bbox"][0]); y0 = min(y0, s["bbox"][1]); x1 = max(x1, s["bbox"][2]); y1 = max(y1, s["bbox"][3])
                if s["size"] < 15.9: small.append(round(s["size"], 1))
    out.append({"w": pg.rect.width, "h": pg.rect.height, "small": small, "colors": sorted(colors), "ink": [x0, y0, x1, y1], "text": pg.get_text()})
print(json.dumps(out))
`;
const lumJs = "const lum=c=>{const m=c.match(/[\\d.]+/g);const[r,g,b]=m.slice(0,3).map(v=>{v=v/255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};const bgOf=el=>{for(let e=el;e;e=e.parentElement){const c=getComputedStyle(e).backgroundColor,m=c.match(/[\\d.]+/g);if(m&&(m.length<4||+m[3]>.5))return c}return 'rgb(255,255,255)'};";

try {
  /* ---------- nobody saved ---------- */
  {
    const { ctx, p } = await open(1366, 768, false);
    ok(await toAudit(p), "the Audit readiness tab is there");
    await p.click('[data-act="docs-print"]'); await p.waitForTimeout(400);
    ok(/No residents are saved/.test(await p.textContent("#fpDocMsg")) && !(await p.evaluate(() => window.__printed)), "with nobody saved it says so and prints nothing");
    await ctx.close();
  }
  /* ---------- the pages ---------- */
  {
    const { ctx, p } = await open(1366, 768, false);
    await seed(p, [DOT, SAM, RUTH]); await log(p); await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1800);
    await toAudit(p);
    await p.check('[data-privacy-choice="fpNames"] input[value="keep"]', { force: true });
    const card = await p.evaluate(new Function(lumJs + `const el=document.querySelector("#fpDocWho"),r=el.getBoundingClientRect(),b=document.querySelector('[data-act="docs-print"]').getBoundingClientRect(),t=document.querySelector("#fpDocH").closest("section");const q=[...t.querySelectorAll("*")].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(e=>{const a=lum(getComputedStyle(e).color),c=lum(bgOf(e));return (Math.max(a,c)+.05)/(Math.min(a,c)+.05)});return{w:r.width,h:r.height,bw:b.width,bh:b.height,low:Math.min(...q)}`));
    ok(card.h >= 52 && card.bh >= 52 && card.bw >= 52, `the choice and the button are 52 px (${Math.round(card.h)}, ${Math.round(card.bh)})`);
    ok(card.low >= 7, `the card reads at 7:1 (${card.low.toFixed(2)} at worst)`);
    await p.selectOption("#fpDocWho", "all"); await p.click('[data-act="docs-print"]'); await p.waitForTimeout(900);
    ok((await p.evaluate(() => window.__printed)) === 1, "Print opens the print window once");
    const sheets = await p.evaluate(() => {
      const root = document.getElementById("printRoot"), keep = root.style.cssText; root.style.cssText = "display:block;position:absolute;left:-10000px;top:0";
      const out = [...root.querySelectorAll(".ads-sheet")].map(s => { const b = s.querySelector(".ads-body"); return { text: s.textContent.replace(/\s+/g, " "), clipped: b.scrollHeight - b.clientHeight, box: [s.offsetWidth, s.offsetHeight], min: Math.min(...[...s.querySelectorAll("*")].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).map(e => parseFloat(getComputedStyle(e).fontSize))) }; });
      root.style.cssText = keep; return out;
    });
    ok(sheets.length === 3 && sheets.every(s => s.box[0] === 816 && s.box[1] === 1056), `one US Letter page for each of three residents (${sheets.length})`);
    ok(sheets.every(s => s.clipped <= 0), `nothing is cut off at the foot (${sheets.map(s => s.clipped)})`);
    ok(sheets.every(s => s.min >= 21.3), `every line is 16 pt or larger (smallest ${Math.min(...sheets.map(s => s.min)).toFixed(1)} px)`);
    const by = n => sheets.find(s => s.text.includes(n));
    const dot = by("Dorothy"), sam = sheets.find(s => /Samuel|Resident/.test(s.text) && !s.text.includes("Dorothy") && !s.text.includes("Ruth"));
    ok(dot && /Activity documentation summary/.test(dot.text) && /8 of 8 things are on their profile/.test(dot.text) && !/Scobey|Tennessee|Patsy|Sarah|Apple pie/.test(dot.text), "Dorothy: all eight are on the profile, named but never the answers");
    ok(dot && /1 packet made/.test(dot.text) && /3 sessions recorded/.test(dot.text) && /Fully engaged 1, Joined in 1, Chose another time 1/.test(dot.text) && /Singing together/.test(dot.text), "Dorothy: the packet, the sessions and how they took part");
    ok(dot && /Tier 2 · Moderate · GDS 5, set by their care team/.test(dot.text) && /type of at least \d+ pt/.test(dot.text) && /larger print|high contrast/.test(dot.text), "Dorothy: the support level, the type and line weight, and the print needs her profile asks for");
    ok(dot && /Kept off their pages/.test(dot.text) && /radio, storms/.test(dot.text), "Dorothy: her topics to avoid written out");
    ok(sam && /0 packets made/.test(sam.text) && /No sessions are recorded/.test(sam.text) && /Ask the family about work, hometown, and one joy/.test(sam.text) && /Nothing is listed/.test(sam.text), "Samuel, with little on his profile and no log: says so, and asks for work, hometown and one joy");
    const all = sheets.map(s => s.text).join(" ");
    ok(!/\b(ensures?|proves?|proof|survey-proof|compliant|compliance|CST)\b/i.test(all) && /supports a facility/.test(all) && /not an assessment or a finding/.test(all), "it supports records and claims no proof, compliance or finding");
    /* names or aliases */
    await p.check('[data-privacy-choice="fpNames"] input[value="alias"]', { force: true }); await p.selectOption("#fpDocWho", "res-dot"); await p.click('[data-act="docs-print"]'); await p.waitForTimeout(700);
    const aliasText = await p.$eval("#printRoot", e => e.textContent);
    ok(!/Dorothy/.test(aliasText) && /Activity documentation summary/.test(aliasText), "with aliases chosen the page carries no name");
    await p.check('[data-privacy-choice="fpNames"] input[value="keep"]', { force: true }); await p.click('[data-act="docs-print"]'); await p.waitForTimeout(700);
    ok(/Dorothy/.test(await p.$eval("#printRoot", e => e.textContent)), "with names kept it carries the name");
    /* a sample of up to five: 7 residents make 5 pages */
    await seed(p, [1, 2, 3, 4].map(n => person("res-x" + n, "Person" + n))); await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1500); await toAudit(p);
    await p.selectOption("#fpDocWho", "sample"); await p.click('[data-act="docs-print"]'); await p.waitForTimeout(800);
    ok((await p.$$eval("#printRoot .ads-sheet", e => e.length)) === 5, "a sample of seven residents is five pages");
    /* the paper */
    await p.selectOption("#fpDocWho", "all"); await p.click('[data-act="docs-print"]'); await p.waitForTimeout(800);
    const pdf = path.join(os.tmpdir(), "activity-docs-check.pdf");
    await p.emulateMedia({ media: "print" }); fs.writeFileSync(pdf, await p.pdf({ width: "8.5in", height: "11in", printBackground: true, preferCSSPageSize: true })); await p.emulateMedia({ media: "screen" });
    let back = null; try { back = JSON.parse(execFileSync("python3", ["-I", "-c", PY, pdf], { encoding: "utf8" })); } catch (e) { notes.push("PyMuPDF could not read the PDF here"); }
    if (!back || back.missing) notes.push("PyMuPDF is not installed for python3: the printed pages were not read back");
    else {
      ok(back.length === 7, `the PDF has one page for each of seven residents (${back.length})`);
      ok(back.every(g => g.small.length === 0), `no text under 16 pt on any page (${[...new Set(back.flatMap(g => g.small))]})`);
      ok(back.every(g => g.colors.every(c => c === 0)), `only pure black text (${[...new Set(back.flatMap(g => g.colors))]})`);
      ok(back.every(g => g.ink[0] >= 35.9 && g.ink[1] >= 35.9 && g.ink[2] <= 576.1 && g.ink[3] <= 756.1), `everything is inside the 0.5 in margins (the text spans ${[...new Set(back.map(g => g.ink.map(v => Math.round(v * 10) / 10).join(" ")))].join(" | ")} pt; the limits are 36 and 576 across, 36 and 756 down)`);
      ok(back.every(g => /Page 1 of 1/.test(g.text) && /Activity documentation summary/.test(g.text)), "each page is titled and says Page 1 of 1");
    }
    await ctx.close();
  }
  /* ---------- by day and in Night Shift, on a phone ---------- */
  for (const [w, h, night] of [[390, 844, false], [1366, 768, true], [390, 844, true]]) {
    const { ctx, p } = await open(w, h, night);
    await seed(p, [DOT]); await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1800); await toAudit(p);
    const m = await p.evaluate(new Function(lumJs + `const t=document.querySelector("#fpDocH").closest("section"),q=[...t.querySelectorAll("*")].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(e=>{const a=lum(getComputedStyle(e).color),c=lum(bgOf(e));return (Math.max(a,c)+.05)/(Math.min(a,c)+.05)});const s=document.querySelector("#fpDocWho").getBoundingClientRect(),b=document.querySelector('[data-act="docs-print"]').getBoundingClientRect();return{low:Math.min(...q),h:Math.min(s.height,b.height),sideways:document.documentElement.scrollWidth>innerWidth+1}`));
    ok(m.h >= 52 && m.low >= 7 && !m.sideways, `${w}${night ? " night" : ""}: 52 px, 7:1 (${m.low.toFixed(2)}), no sideways scroll`);
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }

ok(!foreign.length, `nothing requested from outside the page: ${foreign.slice(0, 3).join(", ")}`);
ok(!errors.length, `no script errors: ${errors.slice(0, 3).join(" | ")}`);
console.log(problems.length ? `activity docs check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 40).join("\n  - ") : `activity docs check passed: ${passed} checks` + (notes.length ? "\n  note: " + notes.join("; ") : ""));
process.exit(problems.length ? 1 : 0);
