#!/usr/bin/env node
/* =====================================================================
   The Packet Builder's home screen in three tabs (builder.html, renderHome), in a real browser.

     tabs       Quick presets, By stage and ability, Build your own: real tabs (the arrow keys move between them),
                remembered for this browser tab; none asks more than eight things of a person at once
     presets    four bundles. With nobody chosen, a stage is asked for and every page added is made for it; with a
                resident chosen, the pages carry their name, their stage, their years and their topics to avoid, as
                the activity form would; each press adds pages to the packet and says so
     by stage   only the activities made for the chosen stage, one area at a time, and how many were left out;
                choosing one opens it ready to add
     your own   the activity categories, and the other tools in one closed section
     fingers    every control at least 52 px and its text readable, by day and in Night Shift, at 1366 x 768 and
                390 x 844; nothing scrolls sideways
     private    nothing is requested from outside the page; no script errors
   Made-up people only. Needs Playwright. Run: node scripts/check-builder-home-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const DOT = { schema: "cognicopia.residentProfile", version: 2, id: "res-dot",
  tier1_core: { preferredName: "Dorothy Example", cognitiveTier: 2, unitNumber: "302-B", occupation: { code: "teacher", label: "Teacher" }, topHobbies: [], printNeeds: {},
    topicsToAvoid: { topics: [{ code: "religion", label: "Religion" }], eras: [], people: "", places: "", other: "storms" } },
  tier2_enrichment: { birthYear: 1938 }, tier3_deep: { notes: "" } };

async function open(w, h, night) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block" });
  await ctx.addInitScript(n => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); if (n) localStorage.setItem("cognicopia_night_shift", "1"); } catch (e) { /* ignore */ } }, !!night);
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + "builder.html#/", { waitUntil: "load" }); await p.waitForSelector("#hmPanel", { timeout: 15000 }); await p.waitForTimeout(600);
  return { ctx, p };
}
const tab = async (p, k) => { await p.click(`#hmTab-${k}`); await p.waitForTimeout(250); };
/* the things a tab asks of a person: its visible controls, not the results it lists or what sits in a closed section */
const primary = p => p.evaluate(() => [...document.querySelectorAll("#hmPanel button, #hmPanel a, #hmPanel input, #hmPanel select, #hmPanel summary")]
  .filter(e => { const r = (e.closest("label") || e).getBoundingClientRect(); return r.width && r.height && !e.closest(".hm-results") && !e.closest("details:not([open]) > *:not(summary)"); }).length);
const measure = p => p.evaluate(() => {
  const lum = c => { const m = c.match(/[\d.]+/g); const [r, g, b] = m.slice(0, 3).map(v => { v = v / 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor, m = c.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > .5)) return c; } return "rgb(255,255,255)"; };
  const box = document.querySelector("#hmPanel"), small = [], low = [];
  box.querySelectorAll("button, a, summary, .seg span").forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.height && (r.width < 52 || r.height < 52)) small.push(`${Math.round(r.width)}x${Math.round(r.height)} "${el.textContent.trim().slice(0, 24)}"`); });
  box.querySelectorAll("*").forEach(el => { if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return; const r = el.getBoundingClientRect(); if (!r.width) return;
    const a = lum(getComputedStyle(el).color), b = lum(bgOf(el)), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05); if (ratio < 4.5) low.push(`${ratio.toFixed(2)} "${el.textContent.trim().slice(0, 24)}"`); });
  return { small, low, sideways: document.documentElement.scrollWidth > innerWidth + 1 };
});
const queueNow = p => p.evaluate(() => queue.map(q => ({ act: q.activityId, cfg: q.cfg })));

try {
  /* ---------- the tabs ---------- */
  {
    const { ctx, p } = await open(1366, 768);
    const tabs = await p.$$eval("#view [role=tab]", t => t.map(x => [x.textContent.trim(), x.getAttribute("aria-selected")]));
    ok(tabs.map(t => t[0]).join("|") === "Quick presets|By stage and ability|Build your own" && tabs[0][1] === "true", `three tabs, the presets first: ${tabs.map(t => t.join(":")).join(", ")}`);
    ok(await p.$eval("#hmPanel", e => e.getAttribute("role") === "tabpanel" && e.getAttribute("aria-labelledby") === "hmTab-presets"), "the panel is labelled by its tab");
    await p.focus("#hmTab-presets"); await p.keyboard.press("ArrowRight"); await p.waitForTimeout(250);
    ok(await p.evaluate(() => document.activeElement.id === "hmTab-stage" && document.activeElement.getAttribute("aria-selected") === "true"), "the arrow keys move to the next tab and open it");
    await p.keyboard.press("End"); await p.waitForTimeout(250);
    ok(await p.evaluate(() => document.activeElement.id === "hmTab-own"), "End goes to the last tab");
    await p.reload({ waitUntil: "load" }); await p.waitForSelector("#hmPanel"); await p.waitForTimeout(500);
    ok(await p.$eval("#hmTab-own", e => e.getAttribute("aria-selected")) === "true", "the tab is remembered when the page is opened again in this tab");
    ok(await p.$eval("#view h1", e => /Build a packet/.test(e.textContent)), "the screen keeps its heading");

    /* ---------- Build your own ---------- */
    const own = await p.evaluate(() => ({ cats: [...document.querySelectorAll("#hmPanel > .card-grid > a.card b")].map(b => b.textContent), more: document.querySelector("#hmPanel details.hm-more"), })).then(async r => ({ cats: r.cats, closed: await p.$eval("#hmPanel details.hm-more", d => !d.open) }));
    ok(own.cats.length === 7 && own.cats.includes("Cognicopia Coloring") && own.cats.includes("Word & Language Activities"), `Build your own lists the seven activity categories (${own.cats.join(", ")})`);
    ok(own.closed && (await p.$$eval("#hmPanel details.hm-more a.card", e => e.length)) >= 10, "and the other tools wait in one closed section");
    await p.click("#hmPanel details.hm-more > summary"); await p.waitForTimeout(150);
    ok(await p.$$eval("#hmPanel details.hm-more a.card[href='#/roster'], #hmPanel details.hm-more a.card[href='#/shift']", e => e.length) === 2, "opening it shows the roster and the Shift board, as before");

    /* ---------- presets with nobody chosen ---------- */
    await tab(p, "presets");
    ok(await p.$$eval('#hmPanel input[name="hmStageP"]', e => e.length) === 3, "with nobody chosen, the presets ask which stage they are for");
    ok((await p.$$eval("#hmPanel .hm-preset h2", e => e.map(x => x.textContent))).join("|") === "Morning warm-up|Quiet afternoon|One-on-one connection|Sensory and calm", "the four presets");
    await p.click('#hmPanel label:has(input[name="hmStageP"][value="advanced"])'); await p.waitForTimeout(250);
    const listed = await p.$$eval('#hmPanel .hm-preset[aria-labelledby="hmP-morning"] .hm-pages li', e => e.map(x => x.textContent));
    const before = (await queueNow(p)).length;
    await p.click('#hmPanel [data-preset="morning"]'); await p.waitForTimeout(400);
    const q1 = (await queueNow(p)).slice(before);
    ok(q1.length === listed.length && q1.length >= 3, `"Add these pages" adds the pages it lists (${q1.length}: ${listed.join(", ")})`);
    ok(q1.every(x => x.cfg.difficulty === "advanced") && await p.evaluate(ids => ids.every(id => clinicalOk("advanced", id)), q1.map(x => x.act)), "every page is set for the chosen stage and is one made for it");
    ok(/Added \d+ pages/.test(await p.evaluate(() => (document.querySelector(".toast, #toast, [role=status].toast") || document.body).textContent)), "and the screen says what was added");

    /* ---------- by stage and ability ---------- */
    await tab(p, "stage");
    for (const lv of ["early", "advanced"]) {
      await p.click(`#hmPanel label:has(input[name="hmStageS"][value="${lv}"])`); await p.waitForTimeout(250);
      for (const area of ["words", "movement", "senses"]) {
        await p.click(`#hmPanel [data-area="${area}"]`); await p.waitForTimeout(200);
        const ids = await p.$$eval("#hmPanel .hm-results [data-home-act]", e => e.map(x => x.dataset.homeAct));
        const fit = await p.evaluate(a => a.ids.every(id => clinicalOk(a.lv, id)), { ids, lv });
        ok(ids.length > 0 && fit, `${lv} stage, ${area}: ${ids.length} activities, each made for that stage`);
      }
    }
    await p.click('#hmPanel label:has(input[name="hmStageS"][value="advanced"])'); await p.click('#hmPanel [data-area="words"]'); await p.waitForTimeout(200);
    const said = await p.$eval("#hmPanel p[role=status]", e => e.textContent);
    ok(/made for the advanced stage; \d+ more in this area/.test(said), `and how many were left out for the stage ("${said}")`);
    const first = await p.$eval("#hmPanel .hm-results [data-home-act]", e => [e.dataset.homeAct, e.querySelector("b").textContent]);
    await p.click(`#hmPanel .hm-results [data-home-act="${first[0]}"]`); await p.waitForTimeout(900);
    ok(/#\/category\//.test(p.url()) && await p.$eval("#cfgForm h2", e => e.textContent) === first[1], `choosing one opens it ready to add (${first[1]})`);
    await ctx.close();
  }

  /* ---------- presets with a resident chosen ---------- */
  {
    const { ctx, p } = await open(1366, 768);
    await p.evaluate(x => { window.CogniSecureStore.storage.setItem("cognicopia_resident_" + x.id, JSON.stringify(x)); return window.CogniSecureStore.flush(); }, DOT);
    await p.reload({ waitUntil: "load" }); await p.waitForSelector("#hmPanel"); await p.waitForTimeout(500);
    await p.selectOption("#arSel", "res-dot"); await p.waitForTimeout(500);
    await p.evaluate(() => { location.hash = "#/"; }); await p.waitForTimeout(400);
    const forLine = await p.$eval("#hmPanel .hm-for", e => e.textContent).catch(() => "");
    ok(/For Dorothy Example, at their own stage \(moderate stage\)/.test(forLine) && !(await p.$('#hmPanel input[name="hmStageP"]')), `with a resident chosen, the presets are for them and ask nothing ("${forLine.slice(0, 70)}")`);
    const before = (await queueNow(p)).length;
    await p.click('#hmPanel [data-preset="connect"]'); await p.waitForTimeout(400);
    const q = (await queueNow(p)).slice(before);
    ok(q.length >= 3 && q.every(x => x.cfg.residentName === "Dorothy Example" && x.cfg.difficulty === "moderate"), `the pages carry her name and her stage (${q.length} pages)`);
    ok(q.every(x => Array.isArray(x.cfg.avoid) && x.cfg.avoid.includes("church") && x.cfg.avoid.includes("storms")), "and her topics to avoid, as whole words (religion's words and her own)");
    ok(q.every(x => ["general", "1940s", "1950s", "1960s", "1970s"].includes(x.cfg.era)) && q.some(x => x.cfg.era === "1950s"), "and the years she lived through young");
    /* the pages themselves: made as the packet makes them, none names what she avoids */
    const texts = await p.evaluate(items => items.map((it, i) => { const pg = buildBatch(ACT_INDEX[it.act], it.cfg, 1000 + i, 1)[0];
      return { hits: pg.avoidHits || [], text: [pg.title, pg.subtitle, pg.instructions, String(pg.html || "").replace(/<[^>]*>/g, " ")].join(" ") }; }), q);
    ok(texts.every(t => !t.hits.length && !/\b(church|prayer|hymn|bible|faith|priest|storms?)\b/i.test(t.text)), "the pages made from them name nothing she avoids");
    await ctx.close();
  }

  /* ---------- eight at most, 52 px, readable: day and Night Shift, laptop and phone ---------- */
  for (const night of [false, true]) for (const [w, h] of [[1366, 768], [390, 844]]) {
    const tag = `${w} px${night ? ", Night Shift" : ""}`;
    const { ctx, p } = await open(w, h, night);
    for (const k of ["presets", "stage", "own"]) {
      await tab(p, k);
      const n = await primary(p), m = await measure(p);
      ok(n > 0 && n <= 8, `${tag}, ${k}: ${n} things to choose from (at most eight)`);
      ok(m.small.length === 0 && m.low.length === 0 && !m.sideways, `${tag}, ${k}: every control 52 px and readable, nothing sideways` + (m.small.length + m.low.length ? ": " + m.small.concat(m.low).slice(0, 4).join("; ") : ""));
    }
    await ctx.close();
  }

  ok(foreign.length === 0, "nothing is requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 2).join(", ") : ""));
  ok(errors.length === 0, "no script errors" + (errors.length ? ": " + [...new Set(errors)].slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `builder home check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `builder home check passed: ${passed} checks in a real browser (three real tabs, remembered; four presets for a stage or for a resident, with their name, stage, years and topics to avoid; only the activities made for a stage, one area at a time; the categories and the other tools; at most eight choices, 52 px and readable by day and in Night Shift, laptop and phone; nothing leaving the page)`);
process.exit(problems.length ? 1 : 0);
