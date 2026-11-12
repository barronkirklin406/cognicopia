#!/usr/bin/env node
/* =====================================================================
   How the stages are named on staff screens (js/stageLabels.js) and the kind of work each Studio page does, in a real browser.

     choice     the Packet Builder's Settings offers four ways to name the stages (each screen as it is; Stage 1, 2, 3; ACL 5, 4, 3;
                GDS 3-4, 5, 6-7), 52 px each, readable by day and in Night Shift at 1366 x 768 and 390 x 844; it says a label is not
                an assessment; the choice is kept on this computer and holds nothing about a resident
     screens    by default nothing changes (Stage 1 in the Studio, Tier 1 · Mild · GDS 3-4 in the Builder and on the profile);
                with ACL chosen the Studio's stage buttons, the Builder's tier buttons, the profile's tier choices, the active
                resident bar and the daily card's staff line all say ACL 5, 4, 3; Stage and GDS likewise; clearing it brings the
                first wording back
     tags       each of the 25 kinds of page in the Studio names the work it does ("Modality: Reminiscence"), on the staff screen
     never      no printed or previewed page, and no tablet page a resident reads, shows a stage scale or a modality
     private    nothing is requested from outside the page; no script errors
   Made-up people only. Needs Playwright. Run: node scripts/check-stage-labels-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

async function open(w, h, file, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block" });
  await ctx.addInitScript(a => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); if (a.night) localStorage.setItem("cognicopia_night_shift", "1"); if (a.mode) localStorage.setItem("cognicopia_stage_label", a.mode); } catch (e) { /* ignore */ } }, { night: !!o.night, mode: o.mode || "" });
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + file, { waitUntil: "load" }); await p.waitForTimeout(1300);
  return { ctx, p };
}
const lum = "const lum=c=>{const m=c.match(/[\\d.]+/g);const[r,g,b]=m.slice(0,3).map(v=>{v=v/255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};const bgOf=el=>{for(let e=el;e;e=e.parentElement){const c=getComputedStyle(e).backgroundColor,m=c.match(/[\\d.]+/g);if(m&&(m.length<4||+m[3]>.5))return c}return 'rgb(255,255,255)'};";
const measure = (p, sel) => p.evaluate(new Function("s", lum + "return [...document.querySelectorAll(s)].map(el=>{const t=el.closest('label')||el,r=t.getBoundingClientRect(),a=lum(getComputedStyle(t).color),b=lum(bgOf(t));return{w:Math.round(r.width),h:Math.round(r.height),ratio:Math.round((Math.max(a,b)+.05)/(Math.min(a,b)+.05)*100)/100}})"), sel);
const DOT = { schema: "cognicopia.residentProfile", version: 2, id: "res-dot", tier1_core: { preferredName: "Dorothy Example", cognitiveTier: 2, unitNumber: "302-B", printNeeds: {}, topicsToAvoid: { topics: [{ code: "religion", label: "Religion" }], eras: [], people: "", places: "", other: "" } }, tier2_enrichment: { birthYear: 1938 }, tier3_deep: { notes: "" } };

try {
  /* ---------- the choice in Settings ---------- */
  for (const [w, h, night] of [[1366, 768, false], [390, 844, false], [1366, 768, true], [390, 844, true]]) {
    const { ctx, p } = await open(w, h, "builder.html#/settings", { night }), tag = `settings ${w}${night ? " night" : ""}`;
    await p.waitForSelector("#setStages", { timeout: 15000 });
    const m = await measure(p, '#setStages input[name="setStageLabel"]');
    ok(m.length === 4 && m.every(x => x.w >= 52 && x.h >= 52 && x.ratio >= 4.5), `${tag}: four choices, 52 px and readable (${m.map(x => `${x.w}x${x.h} ${x.ratio}`).join(", ")})`);
    if (w === 1366 && !night) {
      const texts = await p.$$eval('#setStages .seg b', e => e.map(x => x.textContent.trim()));
      ok(texts.join("|") === "Each screen as it is|Stage 1, 2, 3|ACL 5, 4, 3|GDS 3–4, 5, 6–7", `the four ways to name a stage: ${texts.join("|")}`);
      ok(/not an assessment/.test(await p.textContent("#setStages")), "it says a label is not an assessment");
      ok(await p.$eval('#setStages input[value="default"]', e => e.checked), "each screen as it is, to begin with");
      await p.click('#setStages input[value="acl"]'); await p.waitForTimeout(300);
      ok(await p.evaluate(() => localStorage.getItem("cognicopia_stage_label") === "acl" && CogniStage.mode() === "acl"), "choosing ACL keeps the choice on this computer");
      ok(await p.evaluate(() => tierText("early") === "Tier 1 · Mild · ACL 5" && tierText("moderate") === "Tier 2 · Moderate · ACL 4" && tierText("advanced") === "Tier 3 · Advanced · ACL 3"), "the Builder's tiers read ACL 5, 4, 3");
      ok(await p.evaluate(() => tierTwoLine("moderate").includes("ACL 4") && !tierTwoLine("moderate").includes("GDS 5")), "and so does the second line of its tier buttons");
      await p.click('#setStages input[value="default"]'); await p.waitForTimeout(300);
      ok(await p.evaluate(() => localStorage.getItem("cognicopia_stage_label") === null && tierText("early") === "Tier 1 · Mild · GDS 3–4"), "each screen as it is brings the first wording back, and the choice is gone");
    }
    await ctx.close();
  }

  /* ---------- the screens ---------- */
  for (const [mode, studio, tier, gdsLike] of [["", ["Stage 1", "Stage 2", "Stage 3"], ["Tier 1 · Mild · GDS 3–4", "Tier 2 · Moderate · GDS 5", "Tier 3 · Advanced · GDS 6–7"], "middle stage"], ["stage", ["Stage 1", "Stage 2", "Stage 3"], ["Tier 1 · Mild · Stage 1", "Tier 2 · Moderate · Stage 2", "Tier 3 · Advanced · Stage 3"], "Stage 2"],
    ["acl", ["ACL 5", "ACL 4", "ACL 3"], ["Tier 1 · Mild · ACL 5", "Tier 2 · Moderate · ACL 4", "Tier 3 · Advanced · ACL 3"], "ACL 4"], ["gds", ["GDS 3–4", "GDS 5", "GDS 6–7"], ["Tier 1 · Mild · GDS 3–4", "Tier 2 · Moderate · GDS 5", "Tier 3 · Advanced · GDS 6–7"], "GDS 5"]]) {
    const name = mode || "default";
    { const { ctx, p } = await open(1366, 768, "activity-studio.html", { mode });
      const labels = await p.$$eval('#asForm input[name="stage"] + span', e => e.map(x => x.childNodes[0].textContent.trim()));
      ok(JSON.stringify(labels) === JSON.stringify(studio), `${name}: the Studio's stage buttons say ${labels.join(", ")}`);
      const svgText = await p.$$eval("#asSheet svg text", e => e.map(x => x.textContent).join(" "));
      ok(!/\b(ACL|GDS|Modality)\b/.test(svgText), `${name}: the previewed page shows no scale and no modality`);
      await ctx.close(); }
    { const { ctx, p } = await open(1366, 768, "profile.html", { mode });
      const t = await p.$$eval('input[name="tier"] ~ span b', e => e.map(x => x.textContent.trim()));
      ok(JSON.stringify(t) === JSON.stringify(tier), `${name}: the profile's tier choices say ${t.join(" / ")}`);
      await ctx.close(); }
    { const { ctx, p } = await open(1366, 768, "builder.html#/", { mode });
      ok(await p.evaluate(t => ["early", "moderate", "advanced"].map(tierText).join("|") === t.join("|"), tier), `${name}: the Builder's tiers read the same way`);
      await p.evaluate(x => { window.CogniSecureStore.storage.setItem("cognicopia_resident_" + x.id, JSON.stringify(x)); return window.CogniSecureStore.flush(); }, DOT);
      ok(await p.evaluate(g => { const d = CogniWayfinding.describe({ id: "x", name: "Dorothy", alias: "", avoid: [], stage: 2 }); return mode_ok(d.detail, g); function mode_ok(s, g2) { return g2 === "middle stage" ? /Stage 2/.test(s) : s.includes(g2); } }, gdsLike), `${name}: the active resident bar names the stage the same way`);
      ok(await p.evaluate(g => CogniStage.phrase(2) === g, gdsLike), `${name}: the daily card's staff line says "${gdsLike}"`);
      await ctx.close(); }
  }

  /* ---------- the kind of work each page does ---------- */
  {
    const { ctx, p } = await open(1366, 768, "activity-studio.html");
    await p.click("#asAccPages summary");
    const tags = await p.$$eval('input[name="mix"]', e => e.map(i => [i.value, (i.closest("label").querySelector(".as-mod") || {}).textContent || ""]));
    ok(tags.length === 25 && tags.every(t => /^Modality: .{5,}/.test(t[1])), `all ${tags.length} kinds of page name the work they do (${tags.filter(t => !t[1]).map(t => t[0]).join(", ") || "none missing"})`);
    ok(new Set(tags.map(t => t[1])).size >= 12, `and they are not all the same (${new Set(tags.map(t => t[1])).size} different ones)`);
    const m = await measure(p, 'input[name="mix"]'); ok(m.every(x => x.h >= 52 && x.ratio >= 4.5), "each box is still 52 px and readable");
    await p.click('.as-stage input[name="view"][value="all"] + span'); await p.waitForTimeout(700);
    ok(!(await p.$$eval("#asScroll svg text", e => e.map(x => x.textContent).join(" "))).includes("Modality"), "no page carries a modality");
    await ctx.close();
  }
  {
    const { ctx, p } = await open(1366, 768, "tablet.html", { mode: "acl" });
    const shown = await p.evaluate(() => document.body.innerText);
    ok(!/\bACL\b/.test(shown), "the tablet's menu, which a resident uses, shows no scale");
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }

ok(!foreign.length, `nothing requested from outside the page: ${foreign.slice(0, 3).join(", ")}`);
ok(!errors.length, `no script errors: ${errors.slice(0, 3).join(" | ")}`);
console.log(problems.length ? `stage labels check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 40).join("\n  - ") : `stage labels check passed: ${passed} checks`);
process.exit(problems.length ? 1 : 0);
