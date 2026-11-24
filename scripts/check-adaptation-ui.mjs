#!/usr/bin/env node
/* =====================================================================
   The condition adaptation, in a real browser (the owner's playbook, Phase 2: "fold the condition suites into the resident profile").
     profile   the profile's Clinical step has one optional choice, "Diagnosis / clinical adaptation", with the seven answers; what is
               chosen is saved in the resident's record (tier1_core.adaptation) and read back into the form; it prints on no page
     reader    js/residentContext.js (window.CogniResident.person) gives every tool the same { code, label }, and an empty one for none
     packet    the packet tool's (packet.html) menu holds no condition cards; choosing a resident shows the one set of pages their profile names,
               already open, and nothing for a resident with none; the set's form has the resident's name in it and does not ask again
   Needs Playwright. Run: node scripts/check-adaptation-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], outside = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

/* made-up residents only (CLAUDE.md: never a real name) */
const person = (id, name, adaptation) => ({ schema: "cognicopia.residentProfile", schemaVersion: 2, id, updatedAt: "2026-11-12T00:00:00Z",
  tier1_core: { preferredName: name, cognitiveTier: 2, adaptation: adaptation ? { code: adaptation, label: adaptation } : null }, tier2_enrichment: { birthYear: 1941 }, tier3_deep: {} });
const WANT = { vascular: "caVascular", lewy_body: "caLewy", ftd: "caFtd", late_stage: "caLateStage", korsakoff: "caKorsakoff", errorless: "caKorsakoff" };
const NAMES = { vascular: "Winifred", lewy_body: "Ruthanne", ftd: "Osgood", late_stage: "Lorraine", korsakoff: "Thaddeus", errorless: "Maribel" };

async function context(seed){
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
  await ctx.addInitScript(list => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); (list || []).forEach(x => localStorage.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))); } catch (e) { /* ignore */ } }, seed || []);
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message));
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) outside.push(u); });
  return { ctx, p };
}

try {
  /* ---------- the profile: the one optional choice, saved and read back ---------- */
  {
    const { ctx, p } = await context();
    await p.goto(base + "profile.html"); await p.waitForTimeout(900);
    const opts = await p.$$eval("#rapAdapt option", o => o.map(x => x.value + "=" + x.textContent.trim()));
    ok(opts.join("|") === "=None / general dementia|lewy_body=Lewy body|ftd=Frontotemporal|vascular=Vascular|korsakoff=Korsakoff|late_stage=Late-stage multi-sensory|errorless=Errorless learning",
      `the profile offers one optional choice with the seven answers (${opts.join(", ")})`);
    ok(await p.$eval("#rapAdapt", s => s.value === "" && !s.required), "it starts at None and is never required");
    await p.fill("#rapName", "Ruthanne"); await p.fill("#rapBorn", "1941");
    await p.evaluate(() => { document.getElementById("rapAdapt").value = "lewy_body"; window.saveResidentProfile(); }); await p.waitForTimeout(700);
    const rec = await p.evaluate(() => { const S = (window.CogniSecureStore && window.CogniSecureStore.storage) || localStorage; for (let i = 0; i < S.length; i++) { const k = S.key(i); if (k && k.indexOf("cognicopia_resident_") === 0) return JSON.parse(S.getItem(k)); } return null; });
    ok(rec && rec.tier1_core.adaptation && rec.tier1_core.adaptation.code === "lewy_body" && rec.tier1_core.adaptation.label === "Lewy body", "saving keeps it in the resident's record as { code, label }");
    await p.goto(base + "profile.html?edit=" + encodeURIComponent(rec.id)); await p.waitForTimeout(900);
    ok(await p.$eval("#rapAdapt", s => s.value) === "lewy_body", "opening the profile again shows the choice");
    await p.goto(base + "activity-studio.html"); await p.waitForTimeout(900);
    const reader = await p.evaluate(r => window.CogniResident ? [window.CogniResident.person(r).adaptation, window.CogniResident.person(Object.assign({}, r, { tier1_core: Object.assign({}, r.tier1_core, { adaptation: null }) })).adaptation] : null, rec);
    ok(reader && reader[0].code === "lewy_body" && reader[0].label === "Lewy body" && reader[1].code === "" && reader[1].label === "", "the shared resident reader gives every tool { code, label }, and an empty one for none" + (reader ? "" : " (no reader on the page)"));
    await ctx.close();
  }

  /* ---------- the packet tool: no condition cards in the menu; the one set the profile names ---------- */
  const seed = Object.keys(WANT).map((code, i) => person("res-a" + i, NAMES[code], code)).concat([person("res-none", "Cornelius", "")]);
  const { ctx, p } = await context(seed);
  await p.goto(base + "packet.html"); await p.waitForTimeout(1500);
  ok(await p.$$eval("#cgSidebar .cg-ailment-card, #cgSidebar [class*='-submenu']", e => e.length) === 0, "the packet tool's menu holds no condition cards: the doors are the same on every page");
  await p.selectOption("#arbSelect", "res-none"); await p.waitForTimeout(500);
  ok(await p.$eval("#cgAdapt", e => e.hidden), "a resident whose profile names no condition sees no adapted set");
  for (const [code, i] of Object.keys(WANT).map((c, i) => [c, i])) {
    await p.selectOption("#arbSelect", "res-a" + i); await p.waitForTimeout(500);
    const st = await p.evaluate(() => { const panel = document.getElementById("cgAdapt"); return { hidden: panel.hidden, shown: [...panel.querySelectorAll(".cg-adapt-list > li")].filter(l => !l.hidden).map(l => (l.querySelector(".cg-ailment-card") || {}).id), note: document.getElementById("cgAdaptNote").textContent }; });
    ok(!st.hidden && st.shown.length === 1 && st.shown[0] === WANT[code] && st.note.includes(NAMES[code]), `${code}: only its own set shows, named for ${NAMES[code]} (${st.shown.join(", ")})`);
    const card = await p.$("#" + WANT[code]); const sub = await p.evaluate(id => { const c = document.getElementById(id); const s = c.parentNode.querySelector('[class*="-submenu"]'); return !!(s && s.classList.contains("is-expanded")); }, WANT[code]);
    ok(card && sub, `${code}: its set is already open`);
    const tall = await p.$eval("#" + WANT[code], e => e.getBoundingClientRect().height);
    ok(tall >= 52, `${code}: its card is at least 52 px tall (${Math.round(tall)})`);
  }
  /* the set's own form has the name in it and does not ask again */
  await p.selectOption("#arbSelect", "res-a1"); await p.waitForTimeout(500);
  await p.click("#dlbOpenModalBtn"); await p.waitForTimeout(400);
  const m = await p.evaluate(() => { const i = document.getElementById("dlbResidentName"); return { value: i.value, asked: getComputedStyle(i.closest("div")).display !== "none", open: document.getElementById("dlbModal").open }; });
  ok(m.open && m.value === "Ruthanne" && !m.asked, `the set's form already has the resident's name and does not ask for it (${JSON.stringify(m)})`);
  await p.keyboard.press("Escape");
  ok(await p.evaluate(() => { const panel = document.getElementById("cgAdapt"); return getComputedStyle(panel).getPropertyValue("display") !== "none" && matchMedia("print").matches === false; }), "the panel is on the screen (and is set to print nothing)");
  await ctx.close();
  ok(errors.length === 0, "no script errors" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
  ok(outside.length === 0, "nothing is requested from outside the page" + (outside.length ? ": " + outside.slice(0, 2).join(", ") : ""));
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `adaptation check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `adaptation check passed: ${passed} checks in a real browser (one optional choice on the profile, saved and read back; the shared reader; no condition cards in the menu; only the set the profile names, open, with the name already in its form; nothing for a resident with none)`);
process.exit(problems.length ? 1 : 0);
