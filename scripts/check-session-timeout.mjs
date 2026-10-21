#!/usr/bin/env node
/* =====================================================================
   The 15-minute inactivity timeout (js/sessionTimeout.js), in a real browser (Playwright; exit 2 where it is not installed).

     rules     the limit is 15 minutes (900,000 ms) and the notice is the owner's sentence, word for word; the script is on the packet tool,
               the Packet Builder and Resident Profiles and in the offline cache; it names no web address and makes no request
     activity  a mouse move, a key, a click, a touch and a scroll each start the clock again (a short limit is set through setLimit)
     timeout   the Packet Builder returns to its home screen, the chosen resident and the unsaved drafts are gone, the notice is shown,
               and the SAVED roster, the license and the free-packet count are all still there; Resident Profiles returns to the front page
   ===================================================================== */
import fs from "fs";
import path from "path";
import { loadPlaywright, serve, ROOT } from "./lib/browser.mjs";

const MSG = "Session timed out due to 15 minutes of inactivity to protect resident privacy.";
let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

const src = read("js/sessionTimeout.js");
ok(/var DEFAULT_MS = 15 \* 60 \* 1000;/.test(src), "the limit is 15 minutes (15 * 60 * 1000 ms)");
ok(src.includes('"' + MSG + '"'), "the notice is the owner's sentence, word for word");
for (const f of ["index.html", "builder.html", "profile.html"]) ok(/<script src="js\/sessionTimeout\.js"><\/script>/.test(read(f)), `${f} loads the timeout`);
ok(/js\/sessionTimeout\.js/.test(read("sw.js")), "the offline cache holds the timeout script");
ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|https?:\/\//.test(src.replace(/\/\*[\s\S]*?\*\//g, "")), "the timeout makes no request and names no web address");
["mousemove", "keydown", "click", "touchstart", "scroll"].forEach(t => ok(src.includes(`"${t}"`), `it listens for ${t}`));
ok(/now - lastScroll < 1000/.test(src), "scroll is throttled to one a second");

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const foreign = [], errors = [];
const mk = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } });
  const p = await ctx.newPage();
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  p.on("pageerror", e => errors.push(e.message));
  return { ctx, p };
};
const seed = p => p.evaluate(async () => {
  await window.CogniSecureStore.openForPage();
  const S = window.CogniSecureStore.storage;
  S.setItem("cognicopia_resident_R-TEST", JSON.stringify({ id: "R-TEST", alias: "Resident 101-A", first: "Test" }));
  S.setItem("cognicopia_packet_draft", JSON.stringify({ v: 1, first: "Draft Person" }));
  S.setItem("cognicopia_profile_draft", JSON.stringify({ v: 1, first: "Draft Person" }));
  S.setItem("cognicopia_gen_count", "7");
  S.setItem("cognicopia_license_v2", "COG1.test");
  sessionStorage.setItem("cgb_active_resident", "R-TEST");
  await window.CogniSecureStore.flush();
});
const state = p => p.evaluate(async () => {
  await window.CogniSecureStore.openForPage();
  const S = window.CogniSecureStore.storage;
  return { resident: S.getItem("cognicopia_resident_R-TEST"), pdraft: S.getItem("cognicopia_packet_draft"), fdraft: S.getItem("cognicopia_profile_draft"), count: S.getItem("cognicopia_gen_count"), lic: S.getItem("cognicopia_license_v2"), active: sessionStorage.getItem("cgb_active_resident"), hash: location.hash, path: location.pathname };
});

try {
  /* the Packet Builder times out */
  {
    const { ctx, p } = await mk();
    await p.goto(base + "builder.html#/roster"); await p.waitForSelector("#sidebar", { timeout: 20000 });
    await seed(p);
    ok(await p.evaluate(() => window.CognicopiaSession.DEFAULT_MS) === 900000, "the page's limit is 900,000 ms");
    /* each kind of activity starts the clock again */
    for (const kind of ["mousemove", "keydown", "click", "touchstart", "scroll"]) {
      await p.evaluate(() => { window.__marker = 1; window.CognicopiaSession.setLimit(1800); });
      await p.waitForTimeout(1100);
      await p.evaluate(k => { (k === "scroll" ? window : document.body).dispatchEvent(new Event(k, { bubbles: true })); }, kind);
      await p.waitForTimeout(1100);
      ok(await p.evaluate(() => window.__marker === 1), `${kind} starts the clock again (the page was not reset)`);
    }
    /* then silence */
    await p.evaluate(() => { window.__marker = 1; window.CognicopiaSession.setLimit(1500); });
    await p.waitForFunction(() => window.__marker !== 1, null, { timeout: 8000 }).catch(() => {});
    await p.waitForSelector("#cgTimeoutNote", { timeout: 15000 }).catch(() => {});
    const note = await p.evaluate(() => { const n = document.getElementById("cgTimeoutNote"); return n ? { text: n.textContent, role: n.getAttribute("role") } : null; });
    ok(note && note.text === MSG && note.role === "status", "after silence the notice is the owner's sentence, in a status region");
    const st = await state(p);
    ok(st.hash === "#/" || st.hash === "", `the Packet Builder is back on its home screen (${st.hash || "#/"})`);
    ok(st.active === null, "the chosen resident is forgotten");
    ok(st.pdraft === null && st.fdraft === null, "the unsaved packet and profile drafts are cleared");
    ok(!!st.resident && JSON.parse(st.resident).alias === "Resident 101-A", "the SAVED roster is untouched");
    ok(st.count === "7" && st.lic === "COG1.test", "the free-packet count and the license are untouched");
    const col = await p.evaluate(() => { const g = getComputedStyle(document.getElementById("cgTimeoutNote")); return [g.color, g.backgroundColor]; });
    const lum = rgb => { const k = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2]; };
    const a = lum(col[0]), b = lum(col[1]);
    ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 7, "the notice reads at 7:1 or better");
    await ctx.close();
  }
  /* Resident Profiles goes to the front page */
  {
    const { ctx, p } = await mk();
    await p.goto(base + "profile.html"); await p.waitForTimeout(800);
    await seed(p);
    await p.evaluate(() => window.CognicopiaSession.setLimit(1500));
    await p.waitForURL(/index\.html/, { timeout: 15000 }).catch(() => {});
    await p.waitForSelector("#cgTimeoutNote", { timeout: 10000 }).catch(() => {});
    const st = await state(p);
    ok(/index\.html$/.test(st.path), `Resident Profiles returns to the front page (${st.path})`);
    ok(await p.evaluate(() => (document.getElementById("cgTimeoutNote") || {}).textContent) === MSG, "and shows the notice there");
    ok(st.fdraft === null && st.pdraft === null && !!st.resident, "the drafts are cleared and the saved roster stays");
    await ctx.close();
  }
  /* the packet tool */
  {
    const { ctx, p } = await mk();
    await p.goto(base + "index.html"); await p.waitForTimeout(800);
    await seed(p);
    await p.evaluate(() => window.CognicopiaSession.setLimit(1500));
    await p.waitForSelector("#cgTimeoutNote", { timeout: 15000 }).catch(() => {});
    const st = await state(p);
    ok(st.pdraft === null && st.active === null && !!st.resident && st.count === "7", "the packet tool clears its draft and keeps the saved roster and the count");
    await ctx.close();
  }
  ok(foreign.length === 0, "nothing was requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 3).join(", ") : ""));
  ok(errors.length === 0, "no script error" + (errors.length ? ": " + [...new Set(errors)].slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `session timeout check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ") : `session timeout check passed: ${passed} checks (15 minutes, the owner's sentence, five kinds of activity, the screen cleared and the saved roster, license and count kept)`);
process.exit(problems.length ? 1 : 0);
