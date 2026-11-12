#!/usr/bin/env node
/* =====================================================================
   "High spacing / low visual crowding" in the Activity Page Studio and the Packet Builder, in a real browser.

     studio     a 52 px choice beside the stage and the hands; turning it on gives fewer things on every page of the preview, bold
                boxes, the same stage, the same hands and the same words kept off; the bigger word search steps aside; turning it
                off brings the plain pages back; the printed pages stay pure black and white at the stage's type size
     builder    Settings holds the choice (kept, and new activities start with it); every activity's form has it; with it on the
                preview has about half as many items and the sheet carries the airy class (bold black boxes of 3 pt and more);
                a page added to the packet remembers it; every activity builds with it on, at all three stages, without an error
     fingers    every control 52 px and readable, by day and in Night Shift, at 1366 x 768 and 390 x 844
     private    nothing is requested from outside the page; no script errors
   Made-up people only. Needs Playwright. Run: node scripts/check-spacing-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

async function open(w, h, file, night) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block" });
  await ctx.addInitScript(n => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); if (n) localStorage.setItem("cognicopia_night_shift", "1"); } catch (e) { /* ignore */ } }, !!night);
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + file, { waitUntil: "load" }); await p.waitForTimeout(1500);
  return { ctx, p };
}
const measure = (p, sel) => p.evaluate(s => {
  const lum = c => { const m = c.match(/[\d.]+/g); const [r, g, b] = m.slice(0, 3).map(v => { v = v / 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor, m = c.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > .5)) return c; } return "rgb(255,255,255)"; };
  const el = document.querySelector(s); if (!el) return { missing: true };
  const box = (el.closest("label") || el).getBoundingClientRect(), small = box.width < 52 || box.height < 52;
  const t = el.closest("label") || el, a = lum(getComputedStyle(t).color), b = lum(bgOf(t)), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  return { w: Math.round(box.width), h: Math.round(box.height), small, ratio: Math.round(ratio * 100) / 100, sideways: document.documentElement.scrollWidth > innerWidth + 1 };
}, sel);

try {
  /* ---------- the Studio ---------- */
  for (const [w, h, night] of [[1366, 768, false], [390, 844, false], [1366, 768, true], [390, 844, true]]) {
    const { ctx, p } = await open(w, h, "activity-studio.html", night), tag = `studio ${w}${night ? " night" : ""}`;
    const m = await measure(p, "#asRoomy");
    ok(!m.missing && !m.small && m.ratio >= 4.5 && !m.sideways, `${tag}: the choice is ${m.missing ? "missing" : `${m.w} x ${m.h} px, contrast ${m.ratio}${m.sideways ? ", the page scrolls sideways" : ""}`}`);
    if (w === 1366 && !night) {
      const near = await p.evaluate(() => { const r = document.querySelector("#asRoomy").closest(".as-step"); return !!r && /How much support/.test(r.textContent) && !!r.querySelector('input[name="dexterity"]'); });
      ok(near, "it sits in the step with the stage and the hands");
      await p.click('#asForm input[name="stage"][value="1"] + span').catch(() => {});
      await p.click('.as-stage input[name="view"][value="all"] + span');
      await p.waitForTimeout(900);
      const stats = () => p.evaluate(() => { const s = [...document.querySelectorAll("#asScroll svg")]; return { pages: s.length, texts: s.reduce((n, x) => n + x.querySelectorAll("text").length, 0), rects: s.reduce((n, x) => n + x.querySelectorAll("rect").length, 0), colors: [...new Set(s.flatMap(x => [...x.querySelectorAll("[fill],[stroke]")].flatMap(e => [e.getAttribute("fill"), e.getAttribute("stroke")])).filter(Boolean))] }; });
      const before = await stats();
      ok(before.pages >= 2, `studio: ${before.pages} pages to compare`);
      await p.click("#asRoomy + span").catch(async () => { await p.check("#asRoomy"); });
      await p.waitForTimeout(1200);
      const after = await stats(), checked = await p.$eval("#asRoomy", e => e.checked);
      ok(checked, "studio: the choice is on");
      ok(after.pages === before.pages, `studio: the packet keeps its ${before.pages} pages (${after.pages})`);
      ok(after.texts < before.texts, `studio: fewer words and numbers on the pages with it on (${before.texts} to ${after.texts})`);
      ok(after.colors.every(c => ["none", "#fff", "#000"].includes(c)), `studio: only black and white (${after.colors.join(", ")})`);
      const stageNow = await p.$eval('#asForm input[name="stage"]:checked', e => e.value), dexNow = await p.$eval('#asForm input[name="dexterity"]:checked', e => e.value);
      ok(stageNow === "1" && dexNow === "steady", "studio: the stage and the hands are as they were");
      const ch = await p.$eval("#asChallenge", e => ({ d: e.disabled, c: e.checked }));
      ok(ch.d && !ch.c, "studio: the bigger word search steps aside");
      /* the printed type: no text under the stage's floor (20 pt = 44 px at stage 1) */
      const small = await p.evaluate(() => [...document.querySelectorAll("#asScroll svg text")].filter(t => +t.getAttribute("font-size") < 40).map(t => t.textContent + "@" + t.getAttribute("font-size")));
      ok(small.every(t => /^AS[A-Z]*-/.test(t)), `studio: text under the stage floor: ${small.join(", ")}`);
      await p.click("#asRoomy + span").catch(async () => { await p.uncheck("#asRoomy"); });
      await p.waitForTimeout(1200);
      const back = await stats();
      ok(back.texts === before.texts || Math.abs(back.texts - before.texts) <= 4, `studio: turning it off brings the plain pages back (${before.texts}, then ${back.texts})`);
    }
    await ctx.close();
  }

  /* ---------- the Packet Builder ---------- */
  for (const [w, h, night] of [[1366, 768, false], [390, 844, false], [1366, 768, true]]) {
    const { ctx, p } = await open(w, h, "builder.html#/settings", night), tag = `builder ${w}${night ? " night" : ""}`;
    await p.waitForSelector("#setRoomy", { timeout: 15000 });
    const m = await measure(p, "#setRoomy");
    ok(!m.missing && !m.small && m.ratio >= 4.5 && !m.sideways, `${tag}: the Settings choice is ${m.missing ? "missing" : `${m.w} x ${m.h} px, contrast ${m.ratio}${m.sideways ? ", sideways scroll" : ""}`}`);
    if (w === 1366 && !night) {
      ok(!(await p.evaluate(() => settings.roomy)), "builder: off to begin with");
      await p.click("#setRoomy + span"); await p.waitForTimeout(300);
      ok(await p.evaluate(() => settings.roomy === true), "builder: Settings keeps the choice");
      /* a new activity starts with it, and shows it in its own form */
      await p.evaluate(() => { location.hash = "#/category/" + ACT_INDEX["finish-saying"].categoryId; }); await p.waitForSelector("#config", { state: "attached", timeout: 8000 }); await p.waitForTimeout(400);
      await p.evaluate(() => openConfig("finish-saying")); await p.waitForSelector("#cfgRoomy", { timeout: 8000 });
      ok(await p.$eval("#cfgRoomy", e => e.checked), "builder: a new activity starts with it on");
      const mm = await measure(p, "#cfgRoomy"); ok(!mm.small && mm.ratio >= 4.5, `builder: the activity's choice is ${mm.w} x ${mm.h} px, contrast ${mm.ratio}`);
      await p.waitForTimeout(500);
      const on = await p.evaluate(() => ({ items: document.querySelectorAll("#preview .item").length, cls: /sp-roomy/.test(document.querySelector("#preview .sheet").className), border: parseFloat(getComputedStyle(document.querySelector("#preview .item")).borderTopWidth) }));
      await p.click("#cfgRoomy + span"); await p.waitForTimeout(500);
      const off = await p.evaluate(() => ({ items: document.querySelectorAll("#preview .item").length, cls: /sp-roomy/.test(document.querySelector("#preview .sheet").className) }));
      ok(on.cls && !off.cls, "builder: the sheet carries the airy class only with it on");
      ok(on.items > 0 && on.items <= Math.ceil(off.items * 0.6), `builder: about half as many items in the preview (${off.items} to ${on.items})`);
      ok(on.border >= 4, `builder: each item stands in a bold black box (${on.border} px thick)`);
      await p.click("#cfgRoomy + span"); await p.waitForTimeout(400);
      await p.evaluate(() => { document.querySelector("#cfgForm").requestSubmit(); }); await p.waitForTimeout(500);
      const q = await p.evaluate(() => queue.map(x => !!x.cfg.roomy));
      ok(q.length > 0 && q.every(Boolean), `builder: pages added to the packet remember it (${q.length} added)`);
      /* every activity builds with it on, at three stages */
      const all = await p.evaluate(() => {
        const out = { built: 0, failed: [], thinner: 0, same: 0 };
        for (const id of Object.keys(ACT_INDEX)) for (const diff of ["early", "moderate", "advanced"]) {
          if (!ACT_INDEX[id].levelsBase || !clinicalOk(diff, id)) continue;
          try {
            const sz = r => sheetHtml({ activityId: id, cfg: { residentName: "Test", date: "2026-11-12", difficulty: diff, era: "1950s", roomy: r || undefined }, batchSeed: 4242, count: 1, index: 0 });
            const a = sz(false), b = sz(true);
            if (/not ready/.test(b)) out.failed.push(id + " " + diff); else out.built++;
            if (b.length < a.length) out.thinner++; else out.same++;
          } catch (e) { out.failed.push(id + " " + diff + ": " + e.message); }
        }
        return out;
      });
      ok(all.built >= 45 && !all.failed.length, `builder: ${all.built} activity pages built with it on; failed: ${all.failed.join(", ") || "none"}`);
      ok(all.thinner >= 30, `builder: ${all.thinner} of ${all.built} pages are lighter with it on`);
    }
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }

ok(!foreign.length, `nothing requested from outside the page: ${foreign.slice(0, 3).join(", ")}`);
ok(!errors.length, `no script errors: ${errors.slice(0, 3).join(" | ")}`);
console.log(problems.length ? `spacing UI check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 40).join("\n  - ")
  : `spacing UI check passed: ${passed} checks`);
process.exit(problems.length ? 1 : 0);
