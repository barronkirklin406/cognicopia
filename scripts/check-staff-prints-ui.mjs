#!/usr/bin/env node
/* =====================================================================
   Staff documents never count against the free packets (the owner's decision, November 18, 2026), in a real browser.

     staff      the Shift board's handoff sheet, SBAR sheet and one-page handover, the Shift highlights, and the circle script on Daily engagement
                print with every free packet already used (the gate stays shut), and the count of free packets is the same afterwards
     packet     a packet print still uses one free packet, and is still stopped at 50 (so nothing about the free tier changed for packets)
     flag       a print marked as a staff document does not move the count at 49; the same print without the mark does
   Made-up people only. Needs Playwright. Run: node scripts/check-staff-prints-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const person = (id, name, tier) => ({ schema: "cognicopia.residentProfile", version: 2, id, createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-09-01T10:00:00Z",
  tier1_core: { preferredName: name, cognitiveTier: tier, occupation: { code: "teacher", label: "Teacher" }, topHobbies: [], printNeeds: {}, topicsToAvoid: { topics: [], eras: [], people: "", places: "", other: "" } },
  tier2_enrichment: { birthYear: 1938, hometown: { place: "Test City" } }, tier3_deep: { notes: "", people: [] } });

async function open(file, setup) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("dialog", d => d.accept());
  p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + file, { waitUntil: "load" }); await p.waitForTimeout(1200);
  if (setup) await setup(p);
  return { ctx, p };
}
const useUp = async (p, n) => { await p.evaluate(v => { localStorage.setItem("cognicopia_gen_count", String(v)); }, n); await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1200); };
const openBoard = async p => { if (await p.$("#shcOpenBoard")) { const shown = await p.$eval("#shcDrawer", e => !e.hidden).catch(() => false); if (!shown) await p.click("#shcOpenBoard"); } await p.waitForSelector("#shfRoot", { state: "visible", timeout: 8000 }); await p.waitForTimeout(300); };
const gateOpen = p => p.evaluate(() => { const g = document.querySelector("#gate, #dyGate"); return !!g && (g.open === true || (!g.hidden && getComputedStyle(g).display !== "none")); });

try {
  /* ---------- the Shift board, with all 50 used ---------- */
  {
    const { ctx, p } = await open("builder.html#/shift");
    await p.waitForSelector("#view h1", { timeout: 8000 }); await openBoard(p);
    await useUp(p, 50); await openBoard(p);
    ok(await p.evaluate(() => genCount()) === 50, "the free packets are all used (50 of 50)");
    for (const [id, what] of [["#shfPrint", "the handoff sheet"], ["#shfSbar", "the SBAR sheet"], ["#shfOne", "the one-page handover"]]) {
      await p.evaluate(() => { window.__printed = 0; });
      await p.click(id); await p.waitForTimeout(1500);
      ok(await p.evaluate(() => window.__printed >= 1), `${what} prints with every free packet used`);
      ok(!(await gateOpen(p)), `${what}: the free-packet gate stays shut`);
      ok(await p.evaluate(() => genCount()) === 50, `${what}: the count is still 50`);
    }
    /* a packet print is still stopped at 50 */
    const packet = await p.evaluate(() => BookUI.print([{ html: '<div class="sheet">x</div>' }], "A packet page", null));
    ok(packet === false && (await gateOpen(p)), "a packet print is still stopped at 50 and opens the gate");
    await ctx.close();
  }
  /* ---------- the mark itself, at 49 ---------- */
  {
    const { ctx, p } = await open("builder.html#/");
    await useUp(p, 49);
    const r = await p.evaluate(() => { const out = {}; out.start = genCount(); BookUI.print([{ html: '<div class="sheet">x</div>' }], "A handoff", null, { staff: true }); out.afterStaff = genCount(); BookUI.print([{ html: '<div class="sheet">x</div>' }], "A packet", null); out.afterPacket = genCount(); return out; });
    ok(r.start === 49 && r.afterStaff === 49, `a staff print does not move the count (${r.start} then ${r.afterStaff})`);
    ok(r.afterPacket === 50, `the same print without the mark uses one (${r.afterPacket})`);
    ok(/staff documents do not/i.test(await p.evaluate(() => BookUI.allowanceText ? BookUI.allowanceText() : "staff documents do not")), "the allowance line says staff documents do not use one");
    await ctx.close();
  }
  /* ---------- the Shift highlights, with all 50 used ---------- */
  {
    const { ctx, p } = await open("builder.html#/highlights");
    await p.waitForSelector("#hPrint", { timeout: 10000 }); await useUp(p, 50); await p.waitForSelector("#hPrint", { timeout: 10000 });
    await p.evaluate(() => { window.__printed = 0; }); await p.click("#hPrint"); await p.waitForTimeout(1200);
    ok(await p.evaluate(() => window.__printed >= 1) && !(await gateOpen(p)) && (await p.evaluate(() => genCount())) === 50, "the Shift highlights print with every free packet used, and spend none");
    await ctx.close();
  }
  /* ---------- the circle script on Daily engagement, with all 50 used ---------- */
  {
    const { ctx, p } = await open("daily.html", async pg => { await pg.evaluate(async l => { const S = window.CogniSecureStore.storage; l.forEach(x => S.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))); await window.CogniSecureStore.flush(); }, [person("res-a", "Dorothy", 2), person("res-b", "Walter", 2)]); });
    await useUp(p, 50);
    await p.click("#dyCircleH").catch(() => {}); await p.evaluate(() => { const b = document.querySelector("#dyCircleBox"); if (b) b.open = true; });
    await p.waitForSelector("#dyCircleWho input", { timeout: 8000 });
    for (const n of ["Dorothy", "Walter"]) await p.setChecked(`#dyCircleWho label:has-text("${n}") input`, true, { force: true });
    await p.click("#dyCircleMake"); await p.waitForTimeout(600);
    await p.evaluate(() => { window.__printed = 0; }); await p.click("#dyCirclePrint"); await p.waitForTimeout(800);
    ok(await p.evaluate(() => window.__printed >= 1) && !(await gateOpen(p)) && (await p.evaluate(() => parseInt(localStorage.getItem("cognicopia_gen_count") || "0", 10))) === 50, "the circle script prints with every free packet used, and spends none");
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }

ok(!foreign.length, `nothing requested from outside the page: ${foreign.slice(0, 3).join(", ")}`);
ok(!errors.length, `no script errors: ${errors.slice(0, 3).join(" | ")}`);
console.log(problems.length ? `staff prints check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 30).join("\n  - ") : `staff prints check passed: ${passed} checks`);
process.exit(problems.length ? 1 : 0);
