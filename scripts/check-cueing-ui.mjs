#!/usr/bin/env node
/* =====================================================================
   Therapy goals to a cueing guide (js/cueingGuide.js), in a real browser.

     lines      each of the eight goal domains has one plain, adult cueing line that invites and never tests (the engine's own tone
                rules), the same for every resident, with no clinical instruction of its own
     studio     choosing a saved resident whose therapist set goals shows one line for each goal not yet met, in a staff strip under
                the choice; a goal marked met drops its line; a resident with no goals, or nobody, shows nothing
     daily      Daily engagement shows the same strip for the same resident
     never      no printed or previewed page carries it, and it is hidden when printing; nothing about the resident but their own
                goals is used
     fingers    readable (4.5:1) by day and in Night Shift, no sideways scroll, at 1366 x 768 and 390 x 844
     private    the goals are read from the resident's record on this computer; nothing is requested from outside the page
   Made-up people only. Needs Playwright. Run: node scripts/check-cueing-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const person = (id, name) => ({ schema: "cognicopia.residentProfile", version: 2, id, tier1_core: { preferredName: name, cognitiveTier: 2, unitNumber: "302-B", printNeeds: {}, topicsToAvoid: { topics: [], eras: [], people: "", places: "", other: "" } }, tier2_enrichment: { birthYear: 1938 }, tier3_deep: { notes: "" } });
const RES = [person("res-dot", "Dorothy Example"), person("res-sam", "Samuel Example")];

async function open(w, h, file, night) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block" });
  await ctx.addInitScript(n => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); if (n) localStorage.setItem("cognicopia_night_shift", "1"); } catch (e) { /* ignore */ } }, !!night);
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + file, { waitUntil: "load" }); await p.waitForTimeout(1200);
  return { ctx, p };
}
/* a resident, with goals for naming and recall (two not yet met) and one met (orientation) */
const seed = p => p.evaluate(async list => {
  const S = window.CogniSecureStore.storage;
  list.forEach(x => S.setItem("cognicopia_resident_" + x.id, JSON.stringify(x)));
  const G = await import("/js/slp-goals.js");
  G.saveEntry(S, "res-dot", { instrument: "moca", date: "2026-09-01", total: { got: 18 }, domains: { naming: { got: 1 }, recall: { got: 2 }, orientation: { got: 3 } }, goals: [{ domain: "naming", target: 3 }, { domain: "recall", target: 4 }, { domain: "orientation", target: 5 }] });
  G.saveEntry(S, "res-dot", { instrument: "moca", date: "2026-10-01", total: { got: 20 }, domains: { orientation: { got: 5 } }, goals: [] });
  await window.CogniSecureStore.flush();
}, RES);
const cue = p => p.evaluate(() => { const e = document.querySelector("#asCue, #dyCue"); return e ? { hidden: e.hidden, text: e.textContent, labels: [...e.querySelectorAll("li > b")].map(b => b.textContent.replace(":", "")) } : null; });

try {
  /* ---------- the lines ---------- */
  {
    const { ctx, p } = await open(1366, 768, "activity-studio.html");
    const r = await p.evaluate(() => ({ cues: Object.entries(CogniCueing.CUES).map(([k, v]) => [k, v.label, v.cue]), tone: Object.values(CogniCueing.CUES).map(v => CognicopiaActivityEngine.toneProblems(v.cue + " " + v.label)) }));
    ok(r.cues.length === 8 && r.cues.every(c => c[2].length > 40 && c[2].length < 200), `eight goal domains, each with one short line (${r.cues.map(c => c[0]).join(", ")})`);
    ok(r.tone.every(t => !t.length), "no line quizzes or talks down");
    ok(r.cues.every(c => !/\b(test|quiz|correct|wrong|swallow|dose|diagnos)/i.test(c[2])), "none tests, corrects, or gives clinical instruction");
    await ctx.close();
  }
  /* ---------- the Studio and Daily engagement ---------- */
  for (const [file, pick, name] of [["activity-studio.html", "#asResident", "studio"], ["daily.html", "#dyWho", "daily"]]) {
    const { ctx, p } = await open(1366, 768, file);
    await seed(p); await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1500);
    let c = await cue(p);
    ok(c && c.hidden, `${name}: nothing shows with nobody chosen`);
    await p.selectOption(pick, "res-sam"); await p.waitForTimeout(700); c = await cue(p);
    ok(c && c.hidden, `${name}: nothing shows for a resident with no goals`);
    await p.selectOption(pick, "res-dot"); await p.waitForTimeout(900); c = await cue(p);
    ok(c && !c.hidden && c.labels.join("|") === "Finding words|Recall", `${name}: a line for each goal not yet met, and none for the one that is met (${c && c.labels.join(", ")})`);
    ok(c && /For staff/.test(c.text) && /does not replace it/.test(c.text), `${name}: it says it is for staff and supports the therapist's plan`);
    ok(c && !/Dorothy|302-B|1938/.test(c.text), `${name}: it holds nothing about the resident but their goals`);
    if (name === "studio") {
      await p.click('.as-stage input[name="view"][value="all"] + span'); await p.waitForTimeout(700);
      ok(!/cueing|finding words/i.test(await p.$$eval("#asScroll svg text", e => e.map(x => x.textContent).join(" "))), "studio: no previewed page carries it");
    }
    await p.emulateMedia({ media: "print" });
    ok(await p.$eval("#asCue, #dyCue", e => getComputedStyle(e).display === "none"), `${name}: it is hidden when printing`);
    await p.emulateMedia({ media: "screen" });
    await p.selectOption(pick, ""); await p.waitForTimeout(500); c = await cue(p);
    ok(c && c.hidden, `${name}: it goes away when the resident is cleared`);
    await ctx.close();
  }
  /* ---------- by day and in Night Shift, on a phone ---------- */
  for (const [w, h, night] of [[1366, 768, false], [390, 844, false], [1366, 768, true], [390, 844, true]]) {
    for (const [file, pick] of [["activity-studio.html", "#asResident"], ["daily.html", "#dyWho"]]) {
      const { ctx, p } = await open(w, h, file, night);
      await seed(p); await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1300);
      await p.selectOption(pick, "res-dot"); await p.waitForTimeout(900);
      const m = await p.evaluate(() => {
        const lum = c => { const m = c.match(/[\d.]+/g); const [r, g, b] = m.slice(0, 3).map(v => { v = v / 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
        const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor, mm = c.match(/[\d.]+/g); if (mm && (mm.length < 4 || +mm[3] > .5)) return c; } return "rgb(255,255,255)"; };
        const box = document.querySelector("#asCue, #dyCue"), low = [];
        box.querySelectorAll("*").forEach(el => { if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return; const a = lum(getComputedStyle(el).color), b = lum(bgOf(el)), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05); if (ratio < 4.5) low.push(ratio.toFixed(2) + ' "' + el.textContent.trim().slice(0, 20) + '"'); });
        return { low, shown: box.getBoundingClientRect().height > 0, sideways: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      ok(m.shown && !m.low.length && !m.sideways, `${file.split(".")[0]} ${w}${night ? " night" : ""}: shown, readable and no sideways scroll${m.low.length ? " (low contrast: " + m.low.join(", ") + ")" : ""}`);
      await ctx.close();
    }
  }
} finally { await browser.close(); srv.close(); }

ok(!foreign.length, `nothing requested from outside the page: ${foreign.slice(0, 3).join(", ")}`);
ok(!errors.length, `no script errors: ${errors.slice(0, 3).join(" | ")}`);
console.log(problems.length ? `cueing check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 40).join("\n  - ") : `cueing check passed: ${passed} checks`);
process.exit(problems.length ? 1 : 0);
