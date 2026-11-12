#!/usr/bin/env node
/* =====================================================================
   Resident Mode in Tablet Activities (tablet.html, js/tablet.js), in a real browser.

     on         the site's menu, the settings, the footer and every link are hidden; the activities stay; a Staff exit
                button sits in the top corner; the site's search (Ctrl+K) stays closed; a reload, or the page opened again,
                stays in it
     the exit   a short press does nothing; a press held for 2.5 seconds (a finger or mouse, or Enter held down) leaves
                Resident Mode; the ring fills as it is held; inside an activity the button is on top and clear of the
                activity's own buttons
     the PIN    once set, the long press opens a keypad; a wrong PIN is refused and the tablet stays in the activities;
                the right one leaves; the PIN is not kept as itself; removed, the long press is enough again
     fingers    every new control is at least 52 px and its text readable, by day and with Night Shift's colors, at
                1366 x 768 and 390 x 844 (a portrait tablet is in between)
     private    nothing is requested from outside the page; no script errors
   Needs Playwright. Run: node scripts/check-tablet-resident-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

async function open(w, h, touch) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block", hasTouch: !!touch });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } });
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + "tablet.html", { waitUntil: "load" }); await p.waitForTimeout(900);
  return { ctx, p };
}
const resident = p => p.evaluate(() => document.documentElement.classList.contains("tb-resident"));
const shown = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s)].some(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== "none"; }), sel);
/* hold the button down with the mouse for ms, then let go */
const hold = async (p, ms) => { const b = await p.$eval("#tbExit", e => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }); await p.mouse.move(b[0], b[1]); await p.mouse.down(); await p.waitForTimeout(ms); const ring = await p.$eval("#tbExit", e => +getComputedStyle(e).getPropertyValue("--p") || 0); await p.mouse.up(); await p.waitForTimeout(200); return ring; };
const measure = (p, sel) => p.evaluate(s => {
  const lum = c => { const m = c.match(/[\d.]+/g); const [r, g, b] = m.slice(0, 3).map(v => { v = v / 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor, m = c.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > .5)) return c; } return "rgb(255,255,255)"; };
  const small = [], low = [];
  document.querySelectorAll(s).forEach(box => {
    [box, ...box.querySelectorAll("button, input, a")].filter(el => el.matches("button, input, a")).forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.height && (r.width < 52 || r.height < 52)) small.push(`${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent || el.id).trim().slice(0, 20)}"`); });
    [box, ...box.querySelectorAll("*")].forEach(el => { if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return; const r = el.getBoundingClientRect(); if (!r.width) return;
      const a = lum(getComputedStyle(el).color), b = lum(bgOf(el)), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05); if (ratio < 4.5) low.push(`${ratio.toFixed(2)} "${el.textContent.trim().slice(0, 24)}"`); });
  });
  return { small, low };
}, sel);

try {
  {
    const { ctx, p } = await open(1024, 768);
    ok(!(await resident(p)) && await p.$eval("#tbExit", e => e.hidden), "the tablet starts with Resident Mode off and no Staff exit button");
    await p.click("#tbResident"); await p.waitForTimeout(300);
    ok(await resident(p), "Start Resident Mode turns it on");
    const hidden = await p.evaluate(() => [".cg-sidebar", ".cg-topbar", ".cg-foot", "#tbSetup", ".tbp-note"].map(s => [s, [...document.querySelectorAll(s)].every(e => getComputedStyle(e).display === "none")]));
    ok(hidden.every(x => x[1]), `the site's menu, the settings, the footer and the note are hidden (${hidden.filter(x => !x[1]).map(x => x[0]).join(", ") || "all"})`);
    const links = await p.evaluate(() => [...document.querySelectorAll("a[href]")].filter(a => { const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).map(a => a.getAttribute("href")));
    ok(links.length === 0, "no link out can be reached" + (links.length ? ": " + links.slice(0, 3).join(", ") : ""));
    ok(await shown(p, ".tbp-card") && await shown(p, "#tbSurprise"), "the activities stay");
    const ex = await p.$eval("#tbExit", e => { const r = e.getBoundingClientRect(); return { r: Math.round(innerWidth - r.right), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), label: e.textContent.trim() }; });
    ok(ex.r <= 20 && ex.t <= 20 && ex.w >= 52 && ex.h >= 52 && ex.label === "Staff exit", `a Staff exit button sits in the top corner (${ex.w} x ${ex.h} px)`);
    await p.keyboard.press("Control+k"); await p.waitForTimeout(250);
    ok(!(await p.$("dialog.ql[open]")), "the site's search stays closed");
    await p.reload({ waitUntil: "load" }); await p.waitForTimeout(700);
    ok(await resident(p) && !(await p.$eval("#tbExit", e => e.hidden)), "a reload stays in Resident Mode");
    const tab2 = await ctx.newPage(); await tab2.goto(base + "tablet.html", { waitUntil: "load" }); await tab2.waitForTimeout(600);
    ok(await resident(tab2), "and so does the page opened again, as after the browser restarts");
    await tab2.close();

    /* the long press */
    const r1 = await hold(p, 600);
    ok(await resident(p) && r1 > 0.1 && r1 < 0.5, `a short press does nothing (the ring had filled ${Math.round(r1 * 100)}%)`);
    await p.click("#tbExit"); await p.waitForTimeout(200);
    ok(await resident(p), "and neither does a tap");
    await hold(p, 2700);
    ok(!(await resident(p)) && await shown(p, ".cg-topbar") && await shown(p, "#tbSetup"), "held for 2.5 seconds, it leaves Resident Mode and the settings come back");
    await p.click("#tbResident"); await p.waitForTimeout(200);
    await p.focus("#tbExit"); await p.keyboard.down("Enter"); await p.waitForTimeout(2800); await p.keyboard.up("Enter"); await p.waitForTimeout(200);
    ok(!(await resident(p)), "Enter held down for 2.5 seconds does the same");

    /* inside an activity */
    await p.click("#tbResident"); await p.waitForTimeout(200);
    await p.click('.tbp-card[data-act="wordsearch"]'); await p.waitForTimeout(800);
    const inside = await p.evaluate(() => { const b = document.getElementById("tbExit"), r = b.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const hits = [...document.querySelectorAll(".tb-bar button")].filter(x => { const q = x.getBoundingClientRect(); return q.width && q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top; }).map(x => x.id || x.textContent.trim());
      return { onTop: top === b || b.contains(top), inert: !!b.closest("[inert]"), hits }; });
    ok(inside.onTop && !inside.inert && inside.hits.length === 0, `inside an activity the Staff exit is on top, can be reached, and covers none of its buttons` + (inside.hits.length ? ` (it covers ${inside.hits.join(", ")})` : ""));
    await hold(p, 2700);
    ok(!(await resident(p)), "and the long press works there too");
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);

    /* the PIN */
    await p.fill("#tbPinSet", "12"); await p.click("#tbPinSave"); await p.waitForTimeout(200);
    ok(/four numbers/.test(await p.textContent("#tbPinMsg")), "a PIN that is not four numbers is refused");
    await p.fill("#tbPinSet", "4826"); await p.click("#tbPinSave"); await p.waitForTimeout(300);
    const kept = await p.evaluate(() => localStorage.getItem("cognicopia_tablet_prefs") || "");
    ok(/PIN set/.test(await p.textContent("#tbPinMsg")) && !kept.includes("4826") && /"pin":\{"salt":"[0-9a-f]{16}","hash":"[0-9a-f]{64}"\}/.test(kept), "a PIN is set, and kept with the tablet's choices only as a salted hash, not as itself");
    await p.click("#tbResident"); await p.waitForTimeout(200);
    await hold(p, 2700);
    ok(await resident(p) && !!(await p.$("#tbPinAsk[open]")), "with a PIN, the long press opens the keypad and the tablet stays in Resident Mode");
    const mk = await measure(p, "#tbPinAsk");
    ok(mk.small.length === 0 && mk.low.length === 0, "the keypad's keys are 52 px and readable" + (mk.small.length + mk.low.length ? ": " + mk.small.concat(mk.low).slice(0, 3).join("; ") : ""));
    for (const d of "1111") await p.click(`#tbPinAsk [data-pin="${d}"]`);
    await p.waitForTimeout(300);
    ok(await resident(p) && /not the PIN/.test(await p.textContent("#tbPinAskMsg")) && !!(await p.$("#tbPinAsk[open]")), "a wrong PIN is refused, and the tablet stays in the activities");
    for (const d of "4826") await p.click(`#tbPinAsk [data-pin="${d}"]`);
    await p.waitForTimeout(400);
    ok(!(await resident(p)) && !(await p.$("#tbPinAsk[open]")), "the right PIN leaves Resident Mode");
    await p.click("#tbPinClear"); await p.waitForTimeout(150);
    await p.click("#tbResident"); await p.waitForTimeout(200); await hold(p, 2700);
    ok(!(await resident(p)) && !(await p.$("#tbPinAsk[open]")), "with the PIN removed, the long press is enough again");
    await ctx.close();
  }

  /* ---------- a finger ---------- */
  {
    const { ctx, p } = await open(820, 1180, true);
    await p.tap("#tbResident"); await p.waitForTimeout(200);
    const c = await p.$eval("#tbExit", e => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c[0], y: c[1] }] }); await p.waitForTimeout(2700);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await p.waitForTimeout(300);
    ok(!(await resident(p)), "on a portrait tablet a finger held on Staff exit for 2.5 seconds leaves Resident Mode");
    await ctx.close();
  }

  /* ---------- 52 px and readable: by day and with Night Shift's colors, laptop and phone ---------- */
  for (const night of [false, true]) for (const [w, h] of [[1366, 768], [390, 844]]) {
    const tag = `${w} px${night ? ", Night Shift" : ""}`;
    const { ctx, p } = await open(w, h);
    if (night) await p.evaluate(() => { document.documentElement.classList.add("cg-night-shift"); document.body.classList.add("cg-night-shift"); });
    const ms = await measure(p, "#tbKiosk");
    ok(ms.small.length === 0 && ms.low.length === 0, `${tag}: the Resident Mode settings are 52 px and readable` + (ms.small.length + ms.low.length ? ": " + ms.small.concat(ms.low).slice(0, 4).join("; ") : ""));
    await p.click("#tbResident"); await p.waitForTimeout(250);
    const me = await measure(p, "#tbExit");
    const side = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    ok(me.small.length === 0 && me.low.length === 0 && side, `${tag}: the Staff exit button is 52 px and readable, nothing sideways` + (me.small.length + me.low.length ? ": " + me.small.concat(me.low).join("; ") : ""));
    await ctx.close();
  }
  ok(foreign.length === 0, "nothing is requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 2).join(", ") : ""));
  ok(errors.length === 0, "no script errors" + (errors.length ? ": " + [...new Set(errors)].slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `tablet Resident Mode check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `tablet Resident Mode check passed: ${passed} checks in a real browser (only the activities, no link out, the search closed, kept on reload; a short press or a tap does nothing, a 2.5 second hold by mouse, Enter or a finger leaves; on top inside an activity; a PIN kept as a salted hash, a wrong one refused, the right one leaves; 52 px and readable by day and with Night Shift's colors; nothing leaving the page)`);
process.exit(problems.length ? 1 : 0);
