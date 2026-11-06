#!/usr/bin/env node
/* =====================================================================
   js/pillar3-qa-agents.js in a real browser (Playwright; exit code 2 where it is not installed).

     network     the Today page makes no request to any other host while the whole agent suite runs (opening the
                 panel, previews, printing three pages); the guard records nothing, and, switched to blocking,
                 stops a call to another host
     page        the accessibility checker finds nothing wrong in the Deep Packet Customization panel or in the print
                 preview window: every control named, 52 px, labelled fields, a named dialog, headings in order,
                 text at 7:1 or better, in daylight and in Night Shift
     checker     the same checker, given a page with known faults, finds each one
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const FIELDS = { goes: "Peggy", born: "1938", town: "Cedar Falls", state: "Iowa", job: "schoolteacher", spouse: "Walter", pets: "Biscuit", hobbies: "gardening", favs: "Sunday radio programs" };
try {
  async function open(night) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
    await ctx.addInitScript((n) => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); if (n) localStorage.setItem("cognicopia_night_shift", "1"); } catch (x) { /* ignore */ } }, !!night);
    const p = await ctx.newPage(), outside = [], errs = [];
    p.on("request", (r) => { if (!r.url().startsWith(base) && !/^(data|blob|about):/.test(r.url())) outside.push(r.url()); });
    p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
    await p.goto(base + "index.html"); await p.waitForSelector("#cgrePanel"); await p.waitForTimeout(600);
    await p.evaluate(() => { for (const [i, v] of Object.entries({ goes: "Peggy", born: "1938", town: "Cedar Falls", state: "Iowa", job: "schoolteacher", spouse: "Walter", pets: "Biscuit", hobbies: "gardening", favs: "Sunday radio programs" })) document.getElementById(i).value = v; });
    return { ctx, p, outside, errs };
  }
  /* ---- network ---- */
  let { ctx, p, outside, errs } = await open();
  const net = await p.evaluate(async () => {
    const m = await import("/js/pillar3-qa-agents.js"), s = new m.PrivacySentinel(), g = s.installNetworkGuard(window);
    window.print = () => {};
    document.querySelector("#cgrePanel summary").click(); await new Promise((r) => setTimeout(r, 100));
    document.getElementById("previewPacketBtn").click(); await new Promise((r) => setTimeout(r, 1200));
    const dlg = document.querySelector("dialog.cgpp-modal[open]"); const printBtn = [...dlg.querySelectorAll("button")].find((b) => /Confirm/.test(b.textContent)); printBtn.click(); await new Promise((r) => setTimeout(r, 600));
    const seen = g.attempts(); g.restore();
    const g2 = s.installNetworkGuard(window, { block: true }); let blocked = false; try { await fetch("https://example.com/x"); } catch (e) { blocked = e instanceof TypeError; } const after = g2.attempts().length; g2.restore();
    return { seen, blocked, after };
  });
  ok(net.seen.length === 0, "the page makes no call to another host while the agents run, a preview is opened and three pages are printed (" + net.seen.length + " seen)");
  ok(outside.length === 0 && errs.length === 0, "the browser saw no request outside the site and no script error (" + outside.concat(errs).slice(0, 2).join("; ") + ")");
  ok(net.blocked && net.after === 1, "in blocking mode a call to another host is refused and recorded");
  await ctx.close();

  /* ---- the page checker on our own components ---- */
  for (const night of [false, true]) {
    ({ ctx, p } = await open(night));
    const r = await p.evaluate(async () => {
      const m = await import("/js/pillar3-qa-agents.js"), ac = new m.AccessibilityChecker();
      document.querySelector("#cgrePanel").open = true;
      const panel = ac.checkDom(document.getElementById("cgrePanel"), window);
      document.getElementById("previewPacketBtn").click(); await new Promise((r) => setTimeout(r, 1000));
      const dlg = ac.checkDom(document.querySelector("dialog.cgpp-modal"), window);
      return { panel, dlg };
    });
    const fmt = (x) => x.problems.slice(0, 3).map((q) => q.criterion + " " + q.message + " @" + q.where).join(" | ");
    ok(r.panel.ok && r.panel.stats.controls >= 8 && r.panel.stats.text >= 10, `the customization panel passes the page checker in ${night ? "Night Shift" : "daylight"} (${r.panel.stats.controls} controls, ${r.panel.stats.text} pieces of text${r.panel.ok ? "" : "; " + fmt(r.panel)})`);
    ok(r.dlg.ok && r.dlg.stats.controls >= 6, `the print preview window passes the page checker in ${night ? "Night Shift" : "daylight"} (${r.dlg.stats.controls} controls${r.dlg.ok ? "" : "; " + fmt(r.dlg)})`);
    await ctx.close();
  }

  /* ---- the checker finds known faults ---- */
  ({ ctx, p } = await open());
  const bad = await p.evaluate(async () => {
    const m = await import("/js/pillar3-qa-agents.js"), ac = new m.AccessibilityChecker();
    const host = document.createElement("div"); host.style.cssText = "position:fixed;left:0;top:0;background:#fff";
    host.innerHTML = '<button id="a"></button><button id="b" style="width:20px;height:20px">x</button><input id="c" type="text"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><p style="color:#999">faint text</p><h1>One</h1><h3>Three</h3><a href="#" tabindex="3">go</a><dialog open><p>no name</p></dialog>';
    document.body.append(host);
    const r = ac.checkDom(host, window); host.remove();
    return r.problems.map((x) => x.criterion + ":" + x.message.slice(0, 40));
  });
  const has = (re) => bad.some((x) => re.test(x));
  ok(has(/4\.1\.2:a control has no name/) && has(/2\.5\.8:a control is smaller/) && has(/3\.3\.2:a field has no label/) && has(/1\.1\.1:an image has no alt/) && has(/1\.4\.6:text is/) && has(/1\.3\.1:a heading skips/) && has(/2\.4\.3:a positive tabindex/) && has(/4\.1\.2:a dialog has no name/), "the page checker finds an unnamed control, a small control, an unlabelled field, a missing alt, faint text, a skipped heading, a positive tabindex and an unnamed dialog (" + bad.length + " findings)");
  await ctx.close();
} finally { await browser.close(); srv.close(); }

if (problems.length) { console.error("pillar 3 UI check FAILED: " + problems.length + " problem(s), " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("pillar 3 UI check passed: " + passed + " checks in a real browser (no outside request, the page checker on the panel and the preview, faults found)");
