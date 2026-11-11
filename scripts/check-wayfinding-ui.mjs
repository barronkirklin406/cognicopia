#!/usr/bin/env node
/* =====================================================================
   Wayfinding (js/wayfinding.js, js/nav-index.js): the search, Start here, the pinned tools and the active-resident
   bar, in a real browser.

     search     every page's menu has a Search button; Ctrl+K opens the same search anywhere; a tool or a guide is
                found by its name or a plain word ("sundowning"); Enter opens it
     a person   with residents saved, "Dorothy coloring" offers the coloring tool for Dorothy; choosing it opens
                the Packet Builder with her chosen (for this tab only, not on the disk)
     the bar    on a tool page the bar says who is active: name, year of birth, stage and the topics to avoid
                written out; Switch opens the search, Clear clears it everywhere; the Studio, the daily card and
                Tablet Activities start from the active resident, and the tablet keeps their topics off its screens
     aliases    on the Shift board the Builder's bar and the search show no name and no year of birth
     Start here opens by itself once, right after a first-time visitor agrees to the terms on the home page; four
                roles; three steps, each with a button that goes there and a card that stays with the person
                and outlines the real control; at the end, four suggested tools are pinned in one press; it does not
                open by itself again, and the Today menu's "Start here" opens it on any page
     pins       up to four, never a fifth; on the home page and the Packet Builder's home; first in the search
     private    what is kept (the pins, the guide's progress) holds no name; nothing is requested from outside the
                page; no script errors
     fingers    every control in all of it is at least 52 px, by day and in Night Shift, at 1366 x 768 and 390 x 844,
                and its text is at least 4.5:1 against what is behind it; a phone has no sideways scroll
   Made-up people only. Needs Playwright. Run: node scripts/check-wayfinding-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

const person = (id, name, tier, avoid, unit) => ({ schema: "cognicopia.residentProfile", version: 2, id,
  tier1_core: { preferredName: name, cognitiveTier: tier, unitNumber: unit || "12", occupation: { code: "teacher", label: "Teacher" }, topHobbies: [{ code: "gardening", label: "Gardening" }], printNeeds: {},
    topicsToAvoid: Object.assign({ topics: [], eras: [], people: "", places: "", other: "" }, avoid || {}) },
  tier2_enrichment: { birthYear: tier === 1 ? 1944 : 1938, hometown: { place: "Scobey, Montana" } }, tier3_deep: { notes: "" } });
const DOT = person("res-dot", "Dorothy Example", 2, { topics: [{ code: "religion", label: "Religion" }] }, "302-B");
const GEO = person("res-geo", "George Sample", 1, { other: "Elvis, beach" }, "114");

async function open(w, h, file, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block" });
  await ctx.addInitScript(o => { try { if (!o.fresh) localStorage.setItem("cognicopia_eula_accepted", "true"); if (o.night) localStorage.setItem("cognicopia_night_shift", "1"); } catch (e) { /* ignore */ } }, opts);
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + file, { waitUntil: "load" }); await p.waitForTimeout(900);
  return { ctx, p };
}
const seed = (p, list) => p.evaluate(l => { l.forEach(x => window.CogniSecureStore.storage.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))); return window.CogniSecureStore.flush(); }, list);
const txt = (p, s) => p.$eval(s, e => e.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const rows = p => p.$$eval("dialog.ql[open] .ql-row", e => e.map(r => r.textContent.replace(/\s+/g, " ").trim()));
/* a search field clears its text on the first Escape, and the search closes on the next */
const shut = async p => { for (let i = 0; i < 3 && await p.$("dialog.ql[open]"); i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(120); } };
const search = async (p, q) => { if (!(await p.$("dialog.ql[open]"))) { await p.keyboard.press("Control+k"); await p.waitForSelector("dialog.ql[open]"); } await p.fill("#qlInput", q); await p.waitForTimeout(250); return rows(p); };
/* every control a finger must hit, inside the given parts of the page: its size, and its text against what is behind it */
const measure = (p, scope) => p.evaluate(sel => {
  const lum = c => { const m = c.match(/[\d.]+/g); if (!m) return null; const [r, g, b] = m.slice(0, 3).map(v => { v = v / 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor, m = c.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > .5)) return c; } return "rgb(255,255,255)"; };
  const out = { small: [], low: [], n: 0 };
  document.querySelectorAll(sel).forEach(box => {
    box.querySelectorAll("button, a[href], select, input:not([type=checkbox]):not([type=radio]), label.wf-check").forEach(el => {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(el).visibility === "hidden") return;
      out.n++; if (r.width < 52 || r.height < 52) out.small.push(`${Math.round(r.width)}x${Math.round(r.height)} ${el.id || el.className || el.tagName} "${el.textContent.trim().slice(0, 30)}"`);
    });
    box.querySelectorAll("b, small, span, p, li, h2, h3, legend, button, a").forEach(el => {
      if (!el.childNodes.length || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
      const a = lum(getComputedStyle(el).color), b = lum(bgOf(el)); if (a == null || b == null) return;
      const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      if (ratio < 4.5) out.low.push(`${ratio.toFixed(2)} "${el.textContent.trim().slice(0, 30)}"`);
    });
  });
  return out;
}, scope);

try {
  /* ---------- the search: tools and guides, on every kind of page ---------- */
  for (const file of ["index.html", "daily.html", "resources/caregiver-faq/index.html", "terms.html"]) {
    const f = await open(1366, 768, file);
    const btn = await f.p.$eval(".cg-sidebar .cg-find", e => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), label: e.getAttribute("aria-label") }; }).catch(() => null);
    ok(btn && btn.w >= 52 && btn.h >= 52 && /Search/.test(btn.label), `${file}: the menu has a Search button, ${btn ? btn.w + " x " + btn.h : "missing"} px`);
    await f.p.click(".cg-sidebar .cg-find"); await f.p.waitForTimeout(200);
    ok(!!(await f.p.$("dialog.ql[open]")) && await f.p.evaluate(() => document.activeElement.id === "qlInput"), `${file}: it opens the search, ready to type`);
    await f.p.keyboard.press("Escape"); await f.p.waitForTimeout(150);
    ok(!(await f.p.$("dialog.ql[open]")) && await f.p.evaluate(() => document.activeElement.classList.contains("cg-find")), `${file}: Escape closes it and the keyboard goes back to the button`);
    if (file === "index.html") {
      const r1 = await search(f.p, "sundowning");
      ok(r1.length >= 1 && r1.some(r => /Sundowning|Calm|soothe/i.test(r)), `a plain word finds the guides and tools about it (${r1.slice(0, 3).join(" | ")})`);
      const r2 = await search(f.p, "shift board");
      ok(/^S?\s*Shift board/.test(r2[0] || "") || /Shift board/.test(r2[0] || ""), `"shift board" puts the Shift board first (${r2[0]})`);
      await Promise.all([f.p.waitForURL(/builder\.html#\/shift/), f.p.keyboard.press("Enter")]);
      ok(true, "Enter opens it");
      await f.p.waitForTimeout(600);
      await f.p.keyboard.press("Control+k"); await f.p.waitForSelector("dialog.ql[open]");
      ok(true, "Ctrl+K opens the same search inside the Packet Builder");
      await f.p.keyboard.press("Escape");
    }
    await f.ctx.close();
  }

  /* ---------- a person: "Dorothy coloring", the bar, Switch and Clear ---------- */
  {
    const f = await open(1366, 768, "daily.html");
    await seed(f.p, [DOT, GEO]); await f.p.reload({ waitUntil: "load" }); await f.p.waitForTimeout(900);
    ok(!(await f.p.$("#wfActive")), "with nobody chosen, no bar is shown");
    const r = await search(f.p, "dorothy");
    ok(r.length === 1 && /Dorothy Example/.test(r[0]), `a saved resident is found by name (${r.join(" | ")})`);
    await f.p.keyboard.press("Enter"); await f.p.waitForTimeout(700);
    const bar = await txt(f.p, "#wfActive");
    ok(/^Active profile: Dorothy Example \(1938\) • Stage 2 • Avoid: religion/.test(bar), `the bar says who, the year, the stage and the topics to avoid, written out ("${bar.slice(0, 90)}")`);
    ok(await f.p.$eval("#dyWho", e => e.value) === "res-dot", "and the daily card is now for her");
    ok(await f.p.evaluate(() => sessionStorage.getItem("cgb_active_resident") === "res-dot" && localStorage.getItem("cognicopia_active_resident") === "res-dot"), "the choice is kept for this tab and for the tools that remember it");
    await f.p.click("#wfSwitch"); await f.p.waitForSelector("dialog.ql[open]");
    const r3 = await search(f.p, "george");
    await f.p.keyboard.press("Enter"); await f.p.waitForTimeout(700);
    ok(/George Sample \(1944\) • Stage 1 • Avoid: Elvis, beach/.test(await txt(f.p, "#wfActive")) && await f.p.$eval("#dyWho", e => e.value) === "res-geo", `Switch changes the resident (${r3.join(" | ")})`);
    /* the Studio and the tablet start from the active resident */
    await f.p.goto(base + "activity-studio.html", { waitUntil: "load" }); await f.p.waitForTimeout(1500);
    ok(await f.p.$eval("#asResident", e => e.value) === "res-geo" && /George Sample/.test(await txt(f.p, "#wfActive")), "the Studio opens on him, and its bar says so");
    await f.p.goto(base + "tablet.html", { waitUntil: "load" }); await f.p.waitForTimeout(1500);
    const tb = await f.p.evaluate(() => ({ early: document.getElementById("tbStageEarly").checked, note: document.getElementById("tbFor").textContent, shown: !document.getElementById("tbFor").hidden, saved: localStorage.getItem("cognicopia_tablet_prefs") || "" }));
    ok(tb.early && tb.shown && /George Sample/.test(tb.note) && /Elvis, beach/.test(tb.note), `Tablet Activities starts at his stage and says what it keeps off the screen ("${tb.note}")`);
    ok(!/elvis|beach|george/i.test(tb.saved), "and none of it is saved in the tablet's own settings");
    /* every screen is checked against his words (on top of anything typed), and the screens it makes for him do not show them */
    const words = await f.p.evaluate(() => window.CognicopiaTabletUI.avoid());
    ok(words.includes("elvis") && words.includes("beach"), `every screen is checked against his words (${words.join(", ")})`);
    await f.p.fill("#tbAvoid", "quilting"); await f.p.waitForTimeout(100);
    const both = await f.p.evaluate(() => window.CognicopiaTabletUI.avoid());
    ok(both.includes("quilting") && both.includes("elvis"), "a word typed in the box is added to his, not put in their place");
    let shown = "";
    for (const id of await f.p.evaluate(() => window.CognicopiaTabletUI.activities)) {
      await f.p.evaluate(a => window.CognicopiaTabletUI.open(a), id); await f.p.waitForTimeout(350);
      shown += " " + await f.p.$eval("#tbStage", e => e.textContent);
      await f.p.evaluate(() => window.CognicopiaTabletUI.close()); await f.p.waitForTimeout(150);
    }
    ok(shown.length > 500 && !/\b(elvis|beach(es)?|quilting)\b/i.test(shown), "none of the thirteen activities shows them on its first screen");
    /* "George coloring" opens the coloring tool with him chosen, for this tab only */
    const r4 = await search(f.p, "george coloring");
    ok(/Cognicopia Coloring, for George Sample/.test(r4[0] || ""), `a resident and a tool together offer that tool for them ("${r4[0]}")`);
    await Promise.all([f.p.waitForURL(/builder\.html#\/coloring/), f.p.keyboard.press("Enter")]); await f.p.waitForTimeout(1200);
    ok(await f.p.$eval("#arSel", e => e.value) === "res-geo" && /Avoid: Elvis, beach/.test(await txt(f.p, "#arDetail")), "the Packet Builder opens on him, and its Working with bar writes out what to avoid");
    /* on the Shift board, an alias and no year */
    await f.p.evaluate(() => { location.hash = "#/shift"; }); await f.p.waitForTimeout(900);
    const sh = await search(f.p, "");
    ok(!sh.some(x => /George|Dorothy/.test(x)) && sh.some(x => /Resident/.test(x)), "on the Shift board the search lists aliases, never names");
    await shut(f.p);
    ok(!/1944/.test(await txt(f.p, "#arDetail")), "and the bar leaves out the year of birth beside an alias");
    /* Clear clears it everywhere */
    await f.p.evaluate(() => { location.hash = "#/"; }); await f.p.waitForTimeout(700);
    await f.p.click("#arClear"); await f.p.waitForTimeout(400);
    ok(await f.p.evaluate(() => !sessionStorage.getItem("cgb_active_resident") && !localStorage.getItem("cognicopia_active_resident")) && await f.p.$eval("#arSel", e => e.value) === "", "Clear clears the active resident for every tool");
    await f.p.goto(base + "daily.html", { waitUntil: "load" }); await f.p.waitForTimeout(1200);
    ok(!(await f.p.$("#wfActive")) && await f.p.$eval("#dyWho", e => e.value) === "", "and the daily card no longer opens on anyone");
    await f.ctx.close();
  }

  /* ---------- the packet tool on the home page: its own bar follows the search ---------- */
  {
    const f = await open(1366, 768, "index.html");
    await seed(f.p, [DOT]); await f.p.reload({ waitUntil: "load" }); await f.p.waitForTimeout(1200);
    await search(f.p, "dorothy"); await f.p.keyboard.press("Enter"); await f.p.waitForTimeout(900);
    ok(await f.p.$eval("#arbSelect", e => e.value) === "res-dot" && /^Dorothy\b/.test(await f.p.$eval("#first", e => e.value)), "choosing her in the search fills in the packet tool's form, as its own chooser does");
    ok(/\(1938\) • Stage 2 • Avoid: religion/.test(await txt(f.p, "#arbWho")) && !(await f.p.$("#wfActive")), "its own bar writes out her year, stage and topics to avoid, and no second bar is added");
    await f.ctx.close();
  }

  /* ---------- the Builder keeps its own choice off the disk ---------- */
  {
    const f = await open(1366, 768, "builder.html#/roster");
    await seed(f.p, [DOT]); await f.p.reload({ waitUntil: "load" }); await f.p.waitForTimeout(900);
    await f.p.selectOption("#arSel", "res-dot"); await f.p.waitForTimeout(400);
    ok(await f.p.evaluate(() => sessionStorage.getItem("cgb_active_resident") === "res-dot" && !localStorage.getItem("cognicopia_active_resident")), "a resident chosen in the Packet Builder is kept for this tab only");
    await f.p.goto(base + "activity-studio.html", { waitUntil: "load" }); await f.p.waitForTimeout(1500);
    ok(await f.p.$eval("#asResident", e => e.value) === "res-dot", "and the Studio, opened in the same tab, starts on her");
    await f.ctx.close();
  }

  /* ---------- Start here ---------- */
  {
    const f = await open(1366, 768, "index.html", { fresh: true });
    ok(!(await f.p.$("dialog.wf-start[open]")), "the guide waits until the visitor has agreed to the terms");
    await f.p.click("#cgLegalOk"); await f.p.waitForSelector("dialog.wf-start[open]", { timeout: 3000 }).catch(() => null);
    ok(!!(await f.p.$("dialog.wf-start[open]")), "it opens by itself once they agree");
    const roles = await f.p.$$eval("dialog.wf-start .wf-role b", e => e.map(x => x.textContent));
    ok(roles.length === 4, `four roles: ${roles.join(" | ")}`);
    const m1 = await measure(f.p, "dialog.wf-start[open]");
    ok(m1.small.length === 0 && m1.low.length === 0, `its controls are 52 px and its text readable (${m1.n} controls)` + (m1.small.length + m1.low.length ? ": " + m1.small.concat(m1.low).slice(0, 4).join("; ") : ""));
    await f.p.click('dialog.wf-start .wf-role[data-role="home"]'); await f.p.waitForTimeout(200);
    ok(/Step 1 of 3/.test(await txt(f.p, "dialog.wf-start")) && /personal packet/i.test(await txt(f.p, "dialog.wf-start h3")), "step 1 is the personal packet");
    await f.p.click('dialog.wf-start [data-wf="there"]'); await f.p.waitForTimeout(900);
    ok(!(await f.p.$("dialog.wf-start[open]")) && !!(await f.p.$("#wfCoach")) && await f.p.$eval("#go", e => e.classList.contains("wf-target")), "Take me there goes to the packet tool, with a card and the real button outlined");
    await Promise.all([f.p.waitForURL(/daily\.html/), f.p.click('#wfCoach [data-coach="next"]')]); await f.p.waitForTimeout(1200);
    ok(/step 2 of 3/i.test(await txt(f.p, "#wfCoach")) && await f.p.$eval("#dyMake", e => e.classList.contains("wf-target")), "the card's Next goes on to the daily card, outlining Make today's card");
    await Promise.all([f.p.waitForURL(/builder\.html#\/coloring/), f.p.click('#wfCoach [data-coach="next"]')]); await f.p.waitForTimeout(2500);
    ok(/step 3 of 3/i.test(await txt(f.p, "#wfCoach")) && await f.p.$eval("#ccPdf", e => e.classList.contains("wf-target")).catch(() => false), "and then to the coloring pages, outlining Download PDF");
    const mc = await measure(f.p, "#wfCoach");
    ok(mc.small.length === 0 && mc.low.length === 0, "the card's controls are 52 px and its text readable" + (mc.small.length + mc.low.length ? ": " + mc.small.concat(mc.low).slice(0, 4).join("; ") : ""));
    await f.p.click('#wfCoach [data-coach="next"]'); await f.p.waitForSelector("dialog.wf-start[open]");
    const sug = await f.p.$$eval('dialog.wf-start input[type="checkbox"]:checked', e => e.map(x => x.value));
    ok(sug.length === 4, `at the end four tools are suggested for a small home (${sug.join(", ")})`);
    await f.p.click('dialog.wf-start [data-wf="pin"]'); await f.p.waitForTimeout(200);
    const kept = await f.p.evaluate(() => ({ pins: localStorage.getItem("cognicopia_pins"), start: localStorage.getItem("cognicopia_start") }));
    ok(JSON.parse(kept.pins).length === 4 && !/Dorothy|George|res-/.test(kept.pins + kept.start), `and pinned in one press; what is kept holds no resident (${kept.start})`);
    await f.p.keyboard.press("Escape");
    await f.p.goto(base + "index.html", { waitUntil: "load" }); await f.p.waitForTimeout(1200);
    ok(!(await f.p.$("dialog.wf-start[open]")) && !(await f.p.$("#wfCoach")), "back on the home page it does not open by itself again");
    const pinned = await f.p.$$eval(".lp-doors .wf-pin", e => e.map(a => a.querySelector("b").textContent));
    ok(pinned.length === 4, `the home page shows the four pinned tools (${pinned.join(", ")})`);
    const r = await search(f.p, "");
    ok(/Pinned/.test(r.slice(0, 4).join(" ")), "they come first in the search");
    await shut(f.p);
    /* the picker: never a fifth */
    await f.p.click(".lp-doors [data-wf-pin-edit]"); await f.p.waitForSelector("dialog.wf-pick[open]");
    ok(/4 of 4 chosen/.test(await txt(f.p, ".wf-pick-count")) && await f.p.$$eval('dialog.wf-pick input:not(:checked)', e => e.length > 0 && e.every(x => x.disabled)), "with four chosen, the rest cannot be ticked");
    await f.p.click('dialog.wf-pick input:checked'); await f.p.waitForTimeout(150);
    ok(/3 of 4 chosen/.test(await txt(f.p, ".wf-pick-count")) && await f.p.$$eval('dialog.wf-pick input:not(:checked)', e => e.every(x => !x.disabled)), "untick one and the others open again");
    await f.p.click('dialog.wf-pick [data-wf-close].wf-btn:not(.wf-x)');
    ok((await f.p.$$(".lp-doors .wf-pin")).length === 3, "the strip follows at once");
    /* the Today menu's Start here opens the guide where you are */
    await f.p.goto(base + "terms.html", { waitUntil: "load" }); await f.p.waitForTimeout(700);
    await f.p.evaluate(() => document.querySelector('.cg-sidebar a[href$="#start-here"]').click()); await f.p.waitForTimeout(300);
    ok(!!(await f.p.$("dialog.wf-start[open]")), "the Today menu's Start here opens the guide on any page");
    await f.p.goto(base + "builder.html#/", { waitUntil: "load" }); await f.p.waitForTimeout(1200);
    ok((await f.p.$$("#view .wf-pin")).length === 3, "the Packet Builder's home shows the same pinned tools");
    await f.ctx.close();
  }

  /* ---------- 52 px and contrast: day and Night Shift, laptop and phone ---------- */
  for (const night of [false, true]) for (const [w, h] of [[1366, 768], [390, 844]]) {
    const tag = `${w} px${night ? ", Night Shift" : ""}`;
    /* Night Shift is offered on the home page, the Packet Builder and the profile: the bar is measured by day on Daily engagement, and in the Builder's own bar both ways */
    const f = await open(w, h, night ? "builder.html#/" : "daily.html", { night });
    await seed(f.p, [DOT]); await f.p.evaluate(() => localStorage.setItem("cognicopia_pins", JSON.stringify(["daily", "coloring", "home", "roster"]))); await f.p.reload({ waitUntil: "load" }); await f.p.waitForTimeout(900);
    ok(!night || await f.p.evaluate(() => document.documentElement.classList.contains("cg-night-shift")), `${tag}: Night Shift is on`);
    await search(f.p, "dorothy"); await f.p.keyboard.press("Enter"); await f.p.waitForTimeout(600);
    const mb = await measure(f.p, night ? "#activeRes" : "#wfActive");
    ok(mb.n >= 2 && mb.small.length === 0 && mb.low.length === 0, `${tag}: the active-resident bar's controls are 52 px and its text readable` + (mb.small.length + mb.low.length ? ": " + mb.small.concat(mb.low).slice(0, 4).join("; ") : ""));
    await f.p.evaluate(() => window.CogniWayfinding.setActive("")); await f.p.waitForTimeout(200);
    await f.p.goto(base + "index.html", { waitUntil: "load" }); await f.p.waitForTimeout(900);
    await search(f.p, "co");
    const ms = await measure(f.p, "dialog.ql[open]");
    ok(ms.n >= 3 && ms.small.length === 0 && ms.low.length === 0, `${tag}: the search's rows are 52 px and its text readable` + (ms.small.length + ms.low.length ? ": " + ms.small.concat(ms.low).slice(0, 4).join("; ") : ""));
    await f.p.keyboard.press("Escape"); await f.p.waitForTimeout(120);
    ok(!!(await f.p.$("dialog.ql[open]")) && await f.p.$eval("#qlInput", e => e.value) === "", `${tag}: the first Escape clears what was typed`);
    await shut(f.p);
    ok(!(await f.p.$("dialog.ql[open]")), `${tag}: and the next closes the search`);
    await f.p.evaluate(() => window.CogniWayfinding.openStart(0)); await f.p.waitForTimeout(200);
    const mst = await measure(f.p, "dialog.wf-start[open]");
    ok(mst.small.length === 0 && mst.low.length === 0, `${tag}: Start here's controls are 52 px and its text readable` + (mst.small.length + mst.low.length ? ": " + mst.small.concat(mst.low).slice(0, 4).join("; ") : ""));
    await f.p.keyboard.press("Escape");
    await f.p.evaluate(() => window.CogniWayfinding.openPinPicker()); await f.p.waitForTimeout(200);
    const mp = await measure(f.p, "dialog.wf-pick[open]");
    ok(mp.small.length === 0 && mp.low.length === 0, `${tag}: the pin picker's controls are 52 px and its text readable` + (mp.small.length + mp.low.length ? ": " + mp.small.concat(mp.low).slice(0, 4).join("; ") : ""));
    await f.p.keyboard.press("Escape");
    await f.p.evaluate(() => { const t = document.getElementById("wfToast"); if (t) t.classList.add("is-on"); window.CogniWayfinding.mountPins(); }); await f.p.waitForTimeout(300);
    const mt = await measure(f.p, "#wfToast");
    ok(mt.low.length === 0, `${tag}: the short notices are readable` + (mt.low.length ? ": " + mt.low.slice(0, 2).join("; ") : ""));
    const mpin = await measure(f.p, ".lp-doors .wf-pins");
    ok(mpin.n === 5 && mpin.small.length === 0 && mpin.low.length === 0, `${tag}: the pinned strip's ${mpin.n} controls are 52 px and readable` + (mpin.small.length + mpin.low.length ? ": " + mpin.small.concat(mpin.low).slice(0, 4).join("; ") : ""));
    ok(await f.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${tag}: nothing scrolls sideways`);
    if (w === 390) {
      await f.p.click("#cgSbToggle"); await f.p.waitForTimeout(400);
      const fb = await f.p.$eval(".cg-sidebar .cg-find", e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
      ok(fb[0] >= 52 && fb[1] >= 52, `${tag}: the Menu drawer holds the Search button (${fb.join(" x ")} px)`);
    }
    await f.ctx.close();
  }

  ok(foreign.length === 0, "nothing is requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 2).join(", ") : ""));
  ok(errors.length === 0, "no script errors" + (errors.length ? ": " + [...new Set(errors)].slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `wayfinding check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `wayfinding check passed: ${passed} checks in a real browser (the search on every kind of page; a resident and a tool together; the active-resident bar, Switch and Clear, and the Studio, daily card and tablet starting from it; aliases on the Shift board; the Builder's choice kept for the tab; Start here once after the terms, three steps with a card on each page, four tools pinned in one press; never a fifth pin; 52 px and readable text by day and in Night Shift, laptop and phone; nothing leaving the page)`);
process.exit(problems.length ? 1 : 0);
