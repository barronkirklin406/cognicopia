#!/usr/bin/env node
/* =====================================================================
   The Week Builder, the Staff Run Sheet and the Monthly Participation Summary, in a real browser on the Packet Builder's Facility Portal
   (made-up people only, saved on a made-up computer):

     the door      the Packets door has "Week Builder"; it opens the portal on the Week Builder tab with every resident in a row, their level, "X of 8" facts,
                   Monday's pages and what is kept off; the controls are 52 px and read at 7:1 by day and in Night Shift, at 1366 x 768 and 390 x 844
     the plan      each resident's pages suit their level, never touch a topic they avoid (a made-up avoid word that really matches an activity), the late stage
                   never gets a word search or a scramble, a diagnosis setting (Lewy body) is applied (open spacing), and the same week is planned the same way twice;
                   "Make next week like this one" moves the week on by seven days
     the license   "Make the week" and "Print the monthly summaries" open the license window and print nothing without a license or a pilot key; with a signed key
                   they print and spend no free packet
     the sheets    the Staff Run Sheet is first, lists every resident and every day with Offered / Took part / Watched / Declined boxes, and is staff text (16 pt or
                   larger, pure black, inside the margins); resident pages follow, one after another; the summary says "logged" (what was offered is not recorded),
                   carries the staff's own wording when it is edited, and claims no proof, compliance or finding
     nothing else  nothing is requested from outside the page, and no page script fails
   Needs Playwright (exit 2 where it is not installed) and PyMuPDF for the paper. Run: node scripts/check-week-builder-ui.mjs
   ===================================================================== */
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { loadPlaywright, serve, ROOT, agreed, agreeToDialogs } from "./lib/browser.mjs";
import { issue } from "./issue-license.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = [], notes = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }), jwk = publicKey.export({ format: "jwk" });
const hx = b => Buffer.from(b, "base64url").toString("hex").padStart(64, "0");
const PUB = "04" + hx(jwk.x) + hx(jwk.y);
const CFG = fs.readFileSync(path.join(ROOT, "src/config/license.js"), "utf8").replace(/PUBLIC_KEYS: Object\.freeze\(\[[^\]]*\]\)/, `PUBLIC_KEYS: Object.freeze(["${PUB}"])`);
const KEY = issue({ facility: "Maple Court", tier: "annual_facility", until: "2027-10-31", id: "lic_wkb_test" }, pem).token;

const person = (id, name, o = {}) => ({ schema: "cognicopia.residentProfile", version: 2, id, tier1_core: { preferredName: name, cognitiveTier: o.tier || 2, unitNumber: o.unit || "",
  occupation: o.full ? { code: "teacher", label: "teacher" } : undefined, adaptation: o.adapt || "", topHobbies: o.full ? [{ code: "gardening", label: "gardening" }] : [],
  topicsToAvoid: { topics: [], eras: [], people: "", places: "", other: o.avoid || "" } },
  tier2_enrichment: o.full ? { birthYear: 1938, hometown: { place: "Scobey, Montana" }, music: { genres: [], artists: ["Patsy Cline"], favoriteSong: "Tennessee Waltz" } } : {},
  tier3_deep: o.full ? { notes: "", comforts: ["a warm blanket"], signatureDish: { name: "Apple pie", ingredients: ["apples"], steps: ["bake"] }, people: [{ name: "Sarah Lee", relationship: { code: "daughter", label: "Daughter" } }] } : {} });
const DOT = person("res-dot", "Dorothy", { full: true, tier: 2, avoid: "coloring", unit: "302-B" }), SAM = person("res-sam", "Samuel", { tier: 3, unit: "110" }),
  RUTH = person("res-ruth", "Ruth", { full: true, tier: 1, unit: "204" }), WALT = person("res-walt", "Walt", { tier: 2, unit: "104", adapt: "lewy_body" });

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
                if not s["text"].strip() or s["bbox"][3] <= 30: continue
                colors.add(s["color"]); x0 = min(x0, s["bbox"][0]); y0 = min(y0, s["bbox"][1]); x1 = max(x1, s["bbox"][2]); y1 = max(y1, s["bbox"][3])
                if s["size"] < 15.9: small.append(round(s["size"], 1))
    out.append({"small": small, "colors": sorted(colors), "ink": [x0, y0, x1, y1], "text": pg.get_text()})
print(json.dumps(out))
`;
const lumJs = "const lum=c=>{const m=c.match(/[\\d.]+/g);const[r,g,b]=m.slice(0,3).map(v=>{v=v/255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};const bgOf=el=>{for(let e=el;e;e=e.parentElement){const c=getComputedStyle(e).backgroundColor;if(c&&!/rgba\\(0, 0, 0, 0\\)|transparent/.test(c))return c}return 'rgb(255,255,255)'};";

async function open(w, h, night, licensed) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block", timezoneId: "America/Chicago" }); await agreed(ctx);
  await ctx.addInitScript(n => { try { if (n) localStorage.setItem("cognicopia_night_shift", "1"); } catch (e) { /* ignore */ } window.print = () => { window.__printed = (window.__printed || 0) + 1; }; }, night);
  if (licensed) await ctx.route("**/src/config/license.js", r => r.fulfill({ contentType: "text/javascript", body: CFG }));
  const p = await ctx.newPage(); await agreeToDialogs(p);
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + "builder.html#/facility", { waitUntil: "load" }); await p.waitForTimeout(1500);
  return { ctx, p };
}
const seed = (p, list) => p.evaluate(async l => { const S = window.CogniSecureStore.storage; l.forEach(x => S.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))); await window.CogniSecureStore.flush(); }, list);
const goWeek = async p => { await p.evaluate(() => { location.hash = "#/week-builder"; }); await p.waitForSelector("#wbTable", { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(500); };
const table = p => p.$$eval("#wbTable tbody tr", rows => rows.map(r => ({ id: r.dataset.wbrow, cells: [...r.children].map(c => c.textContent.replace(/\s+/g, " ").trim()) })));
const sheets = p => p.evaluate(() => { const root = document.getElementById("printRoot"), keep = root.style.cssText; root.style.cssText = "display:block;position:absolute;left:-10000px;top:0";
  const out = [...root.querySelectorAll(".sheet")].map(s => ({ run: s.classList.contains("wk-sheet"), ads: s.classList.contains("ads-sheet"), text: s.innerText.replace(/\s+/g, " "), box: [s.offsetWidth, s.offsetHeight] })); root.style.cssText = keep; return out; });

try {
  /* ---------- the door, the table and the plan (no license needed to look) ---------- */
  {
    const { ctx, p } = await open(1366, 768, false, false);
    await seed(p, [DOT, SAM, RUTH, WALT]); await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1500);
    const nav = await p.evaluate(() => (window.CogniNavIndex || window.__navIndex || []).length ? JSON.stringify(window.CogniNavIndex || window.__navIndex) : "");
    const siteNav = fs.readFileSync(path.join(ROOT, "scripts/site-nav.mjs"), "utf8");
    ok(/key: "week-builder", label: "Week Builder"/.test(siteNav) && /Week Builder/.test(fs.readFileSync(path.join(ROOT, "js/nav-index.js"), "utf8")) || /Week Builder/.test(nav), "the Packets door lists the Week Builder (scripts/site-nav.mjs, js/nav-index.js)");
    await goWeek(p); await p.check('[data-privacy-choice="fpNames"] input[value="keep"]', { force: true }); await p.waitForTimeout(400);
    ok((await p.getAttribute("#fpSub-week", "aria-selected")) === "true", "the Week Builder opens on its own tab of the portal");
    const rows = await table(p);
    ok(rows.length === 4, `every resident is a row (${rows.length})`);
    const by = id => rows.find(r => r.id === id);
    ok(by("res-dot") && by("res-dot").cells[0] === "302-B" && /Dorothy/.test(by("res-dot").cells[1]) && /8 of 8/.test(by("res-dot").cells[3]) && /coloring/.test(by("res-dot").cells[5]), "Dorothy: room, name, 8 of 8 facts and what is kept off");
    ok(by("res-sam") && /Late/.test(by("res-sam").cells[2]) && /0 of 8/.test(by("res-sam").cells[3]) && /Add 3 details/.test(by("res-sam").cells[3]), "Samuel: the late level, 0 of 8 facts and a way to add three details");
    ok(by("res-walt") && /Open spacing/.test(by("res-walt").cells[2]), "Walt's diagnosis setting is shown (open spacing, fewer things on a page)");
    ok(rows.map(r => r.cells[0]).join("|") === ["104", "110", "204", "302-B"].join("|"), `rows follow the rooms (${rows.map(r => r.cells[0]).join(", ")})`);
    /* determinism, then the days and pages a day change the plan */
    const a1 = await table(p); await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1500); await goWeek(p); await p.check('[data-privacy-choice="fpNames"] input[value="keep"]', { force: true }); await p.waitForTimeout(400); const a2 = await table(p);
    ok(JSON.stringify(a1) === JSON.stringify(a2), "the same week is planned the same way twice");
    const plan = await p.evaluate(() => { const W = window.CogniWeek, F = window.CogniFacility; const have = {}; F.CATALOG.forEach(a => { have[a.id] = true; });
      const rec = (id, tier, key, avoid) => ({ id, name: id, tier, stageKey: key, room: id, avoidTest: t => avoid.test(t) });
      const res = [rec("res-dot", 2, "middle", /coloring/i), rec("res-sam", 3, "late", /^$/), rec("res-ruth", 1, "early", /^$/)];
      const pl = W.plan({ residents: res, start: "2026-11-25", days: [1, 2, 3, 4, 5], perDay: 3, catalog: F.CATALOG, have });
      return { rows: pl.rows.map(r => ({ id: r.id, names: r.days.flatMap(d => d.pages.map(x => x.name)), perDay: r.days.map(d => d.pages.length) })), start: pl.start, total: pl.total }; });
    const names = id => plan.rows.find(r => r.id === id).names;
    ok(!names("res-dot").some(n => /coloring/i.test(n)) && names("res-dot").length >= 10, "a resident who avoids coloring is never given a coloring page");
    ok(!names("res-sam").some(n => /word search|scramble/i.test(n)), "the late stage gets no word search and no scramble");
    ok(plan.rows.every(r => r.perDay.every(n => n >= 2 && n <= 3)), `three pages a day is two or three a day for every resident (${plan.rows.map(r => r.perDay.join("")).join(" ")})`);
    ok(plan.start === "2026-11-23", `a week starts on its Monday (${plan.start})`);
    const startBefore = await p.inputValue("#wbStart");
    const next = p.locator('[data-act="wb-next"]'); const canNext = await next.count();
    if (canNext) {
      await next.click(); await p.waitForTimeout(500);
      const startAfter = await p.inputValue("#wbStart"), d = (new Date(startAfter) - new Date(startBefore)) / 86400000;
      ok(d === 7, `"Make next week like this one" moves the week on by seven days (${startBefore} to ${startAfter})`);
    } else notes.push("no next-week button without a print right");
    /* 52 px and 7:1 */
    const m = await p.evaluate(new Function(lumJs + `const sec=document.querySelector("#wbH").closest("section"),ctl=[...sec.querySelectorAll("button,input,select,textarea")].filter(e=>e.offsetParent!==null),small=ctl.filter(e=>Math.min(e.getBoundingClientRect().width,e.getBoundingClientRect().height)<(e.type==="checkbox"?20:51.5)).map(e=>e.id||e.textContent.slice(0,20)),low=Math.min(...[...sec.querySelectorAll("*")].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(e=>{const a=lum(getComputedStyle(e).color),b=lum(bgOf(e));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}));return {small,low,sideways:document.documentElement.scrollWidth>innerWidth+2};`));
    ok(m.small.length === 0, `the buttons and fields are 52 px (too small: ${m.small.join(", ") || "none"})`);
    ok(m.low >= 7, `the Week Builder reads at 7:1 (${m.low.toFixed(2)} at worst)`);
    await ctx.close();
  }
  /* ---------- no license: nothing prints, no free packet is spent ---------- */
  {
    const { ctx, p } = await open(1366, 768, false, false);
    await seed(p, [DOT, SAM, RUTH, WALT]); await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1500); await goWeek(p);
    const before = await p.evaluate(() => genCount());
    await p.click('[data-act="wb-print"]'); await p.waitForTimeout(500);
    ok(await p.locator("#cgPromoModal").isVisible().catch(() => false) && /Week Builder/.test(((await p.locator("#cgPromoModal").textContent().catch(() => "")) || "").replace(/\s+/g, " ")), "without a license, Make the week opens the license window and names the Week Builder");
    ok(!(await p.evaluate(() => window.__printed)) && (await p.evaluate(() => genCount())) === before, "and prints nothing and spends no free packet");
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    await p.click('[data-act="wb-month"]'); await p.waitForTimeout(500);
    ok(await p.locator("#cgPromoModal").isVisible().catch(() => false) && !(await p.evaluate(() => window.__printed)), "the monthly summary is a facility feature too: the license window, and nothing printed");
    await ctx.close();
  }
  /* ---------- with a license: the week, the run sheet, the summary, on paper ---------- */
  {
    const { ctx, p } = await open(1366, 768, false, true);
    await seed(p, [DOT, SAM, RUTH, WALT]); await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1500);
    await p.evaluate(async k => { await window.CognicopiaLicense.activate(k); }, KEY).catch(() => {});
    await goWeek(p); await p.check('[data-privacy-choice="fpNames"] input[value="keep"]', { force: true }); await p.waitForTimeout(400);
    const before = await p.evaluate(() => genCount());
    await p.click('[data-act="wb-print"]'); await p.waitForTimeout(2500);
    ok((await p.evaluate(() => window.__printed)) === 1, "with a signed key, Make the week opens the print window once");
    ok((await p.evaluate(() => genCount())) === before, "and spends no free packet");
    const sh = await sheets(p), run = sh.filter(s => s.run);
    ok(run.length >= 1 && sh[0].run, `the Staff Run Sheet is first (${run.length} sheet${run.length === 1 ? "" : "s"})`);
    const runText = run.map(s => s.text).join(" ");
    ok(["Dorothy", "Samuel", "Ruth", "Walt"].every(n => runText.includes(n)) && ["Mon", "Tue", "Wed", "Thu", "Fri"].every(d => new RegExp("\\b" + d + "\\b").test(runText)), "the run sheet lists every resident and every day");
    ok(/Offered/.test(runText) && /Took part/.test(runText) && /Watched/.test(runText) && /Declined/.test(runText), "with the four boxes named: Offered, Took part, Watched, Declined");
    ok(sh.length >= run.length + 20 && sh.slice(run.length).every(s => !s.run), `resident pages follow the run sheet (${sh.length - run.length} pages)`);
    ok(!sh.slice(run.length).some(s => /Staff run sheet/.test(s.text)), "no staff text on a resident page");
    const pdf = path.join(os.tmpdir(), "week-builder-check.pdf");
    await p.emulateMedia({ media: "print" }); fs.writeFileSync(pdf, await p.pdf({ width: "8.5in", height: "11in", printBackground: true, preferCSSPageSize: true })); await p.emulateMedia({ media: "screen" });
    let back = null; try { back = JSON.parse(execFileSync("python3", ["-I", "-c", PY, pdf], { encoding: "utf8", maxBuffer: 1 << 27 })); } catch (e) { notes.push("PyMuPDF could not read the PDF here"); }
    if (!back || back.missing) notes.push("PyMuPDF is not installed for python3: the printed pages were not read back");
    else {
      ok(back.length === sh.length, `the PDF has every page (${back.length} of ${sh.length})`);
      const r = back.slice(0, run.length);
      ok(/Staff run sheet/.test(r[0].text), "page 1 of the PDF is the run sheet");
      ok(r.every(g => g.small.length === 0), `no run-sheet text under 16 pt (${[...new Set(r.flatMap(g => g.small))]})`);
      ok(r.every(g => g.colors.every(c => c === 0)), "the run sheet is pure black on white");
      ok(r.every(g => g.ink[0] >= 35.9 && g.ink[1] >= 35.9 && g.ink[2] <= 576.1 && g.ink[3] <= 756.1), `the run sheet is inside the 0.5 in margins (${[...new Set(r.map(g => g.ink.map(v => Math.round(v)).join(" ")))].join(" | ")})`);
    }
    /* the monthly summary: record something for Dorothy, edit the wording, print */
    await p.evaluate(async () => { await CogniEngage.ready(); const E = CogniEngage;
      await E.record("res-dot", { participation: "engaged", mood: "happy", note: "", activity: "Singing together" }, ["Dorothy"]); await E.record("res-dot", { participation: "joined", mood: "calm", note: "", activity: "Daily card" }, ["Dorothy"]);
      await E.record("res-dot", { participation: "declined", mood: "tired", note: "", activity: "Walk" }, ["Dorothy"]); await window.CogniSecureStore.flush(); });
    await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1500); await goWeek(p); await p.check('[data-privacy-choice="fpNames"] input[value="keep"]', { force: true }); await p.waitForTimeout(300);
    await p.selectOption("#wbWho", "res-dot"); await p.fill("#wbCare", "Dorothy enjoys singing; continue morning music."); await p.waitForTimeout(300);
    await p.click('[data-act="wb-month"]'); await p.waitForTimeout(1200);
    const ms = (await sheets(p)).filter(s => s.ads);
    ok(ms.length === 1 && /Monthly participation summary/.test(ms[0].text) && /Dorothy/.test(ms[0].text), "one summary page for the resident chosen");
    ok(/3 outcomes were logged/.test(ms[0].text) && /Offered.{1,3}is not recorded/.test(ms[0].text) && /Took part \(joined in or fully engaged\) 2/.test(ms[0].text), "it counts what was logged (3: 2 took part) and says Offered is not recorded");
    ok(/Dorothy enjoys singing; continue morning music\./.test(ms[0].text), "the staff's own care-plan wording is on the page");
    ok(/8 of 8 things are on their profile/.test(ms[0].text), "facts out of eight");
    ok(/supports documentation/.test(ms[0].text) && /not an assessment or a finding/.test(ms[0].text) && !/\b(ensures?|proves?|proof|survey-proof|compliant|compliance|CST)\b/i.test(ms[0].text), "it supports documentation and claims no proof, compliance or finding");
    ok((await p.evaluate(() => genCount())) === before, "the summary spends no free packet");
    await p.selectOption("#wbWho", "all"); await p.click('[data-act="wb-month"]'); await p.waitForTimeout(1000);
    ok((await sheets(p)).filter(s => s.ads).length === 4, "Everyone in the wing is four pages");
    await ctx.close();
  }
  /* ---------- by day and in Night Shift, on a phone ---------- */
  for (const [w, h, night] of [[390, 844, false], [1366, 768, true], [390, 844, true]]) {
    const { ctx, p } = await open(w, h, night, false);
    await seed(p, [DOT, SAM, RUTH, WALT]); await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1500); await goWeek(p);
    const m = await p.evaluate(new Function(lumJs + `const sec=document.querySelector("#wbH").closest("section"),ctl=[...sec.querySelectorAll("button,select,input[type=date]")].filter(e=>e.offsetParent!==null),h=Math.min(...ctl.map(e=>e.getBoundingClientRect().height)),low=Math.min(...[...sec.querySelectorAll("*")].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(e=>{const a=lum(getComputedStyle(e).color),b=lum(bgOf(e));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}));return {h,low,sideways:document.documentElement.scrollWidth>innerWidth+2};`));
    ok(m.h >= 51.5 && m.low >= 7, `${w}${night ? " night" : ""}: 52 px (${Math.round(m.h)}), 7:1 (${m.low.toFixed(2)})`);
    ok(!m.sideways || w >= 1000, `${w}: no sideways scroll of the page`);
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }

ok(!foreign.length, `nothing requested from outside the page: ${foreign.slice(0, 3).join(", ")}`);
ok(!errors.length, `no script errors: ${errors.slice(0, 3).join(" | ")}`);
if (notes.length) console.log("note: " + notes.join("; "));
console.log(problems.length ? `week builder check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 30).join("\n  - ") : `week builder check passed: ${passed} checks (the door, the plan by level and avoid list, the license gate, the run sheet first, the summary, 52 px and 7:1)`);
process.exit(problems.length ? 1 : 0);
