#!/usr/bin/env node
/* =====================================================================
   The Sensory Trigger box in the Cognitive Life Journal preview, in a real browser.
   The box keeps its own dark fill, so its words must be light in every theme: in the
   day (paper) theme the page's text colors turn dark, and dark words on that fill could
   not be read. This opens the journal with the example resident, finds the box in the
   day theme and in Night Shift, and measures every line of it against its own background.
   Each must reach 7:1 (AAA).

   Needs Playwright. Where it is missing this exits 2 and npm run build skips it.
   Run: node scripts/check-sensory-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = []; let passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else problems.push(msg); };
const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

try {
  for (const mode of ["day", "night"]){
    const p = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await p.goto(base + "builder.html#/journal");
    await p.waitForTimeout(1200);
    await p.getByRole("button", { name: "Try an example" }).click();
    await p.waitForTimeout(800);
    for (let i = 0; i < 8 && !(await p.$(".lj-sensory-trigger")); i++){ const nx = await p.$('[data-pv="1"]'); if (!nx) break; await nx.click(); await p.waitForTimeout(250); }
    if (mode === "night") await p.evaluate(() => { document.documentElement.classList.remove("cg-paper-app"); document.documentElement.classList.add("cg-night-shift"); });
    const r = await p.evaluate(() => {
      const bx = document.querySelector(".lj-sensory-trigger"); if (!bx) return null;
      const bg = getComputedStyle(bx).backgroundColor;
      return { bg, lines: ["b", "p", "strong", "small"].map(t => { const e = bx.querySelector(t); return e ? [t, getComputedStyle(e).color] : null; }).filter(Boolean) };
    });
    ok(!!r, `${mode}: the Sensory Trigger box appears for the example resident`);
    if (r){
      ok(r.lines.length === 4, `${mode}: the box has its heading, both cues and the staff note`);
      for (const [t, c] of r.lines) ok(ratio(c, r.bg) >= 7, `${mode}: <${t}> in the Sensory Trigger box reads at 7:1 or better (got ${ratio(c, r.bg).toFixed(1)}:1)`);
    }
    await p.close();
  }
} finally { await browser.close(); srv.close(); }

if (problems.length){ console.error(`sensory trigger check FAILED: ${problems.length} problem(s), ${passed} passed`); problems.forEach(m => console.error("  - " + m)); process.exit(1); }
console.log(`sensory trigger check passed: ${passed} checks in a real browser (the box reads at 7:1 or better in the day theme and in Night Shift)`);
