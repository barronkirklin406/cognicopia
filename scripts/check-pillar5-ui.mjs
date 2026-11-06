#!/usr/bin/env node
/* =====================================================================
   js/pillar5-upgrade-agents.js on the Today page, in a real browser (Playwright; exit code 2 where it is not installed).

     suite     the page runs all thirty agents; the system auditor passes them, the pipeline order and a test sheet, and
               sees no call to another host
     sync      two peers in this page connect over a real WebRTC data channel (no ICE servers, so nothing leaves the
               computer), prove the passphrase, and settle on the newer copy; a wrong passphrase does not connect
     voice     listening is refused with no speech recognition or no proof that it runs on the device
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (x) { /* ignore */ } });
  const p = await ctx.newPage(), outside = [], errs = [];
  p.on("request", (r) => { if (!r.url().startsWith(base) && !/^(data|blob|about):/.test(r.url())) outside.push(r.url()); });
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
  await p.goto(base + "index.html"); await p.waitForSelector("#previewPacketBtn"); await p.waitForTimeout(800);
  const a = await p.evaluate(async () => { const r = await window.CognicopiaAgents.audit(); return { ok: r.ok, issues: r.issues, registered: r.roster.registered, missing: r.roster.missing, order: r.order.every((x) => x.ok), smoke: r.smoke, net: r.network.attempts, agents: Object.keys(window.CognicopiaAgents.suite).length }; });
  ok(a.ok && a.registered === 30 && a.order && a.smoke.ok && a.net === 0, "the Today page runs all 30 agents: the auditor passes them (" + (a.issues.join("; ") || "no issues") + "), the pipeline order holds, a test sheet comes out right, no call to another host");
  /* This browser's own SpeechRecognition.available() crashes headless Chromium 153 (found while writing this check), so the real call is not made here; the rule is proven with stand-in windows in check-pillar5-agents.mjs. */
  const v = await p.evaluate(async () => { const m = await import("/js/pillar5-upgrade-agents.js"), va = new m.VoiceAssistant(), none = await va.support({}), noProof = await va.support({ SpeechRecognition: function () {} }); return { none, noProof, cmd: m.parseCommand("go to today").target, started: (await va.start({})).ok }; });
  ok(!v.none.canListen && !v.noProof.canListen && v.started === false && v.cmd === "Today", "in the page, with no speech recognition or no on-device proof, listening is refused, and commands are understood");
  await p.close();   // the Today page is large; the sync test below runs alone
  /* the two-peer test runs on a lighter page of the same site: a headless browser can run out of memory holding the whole Today page and two peers */
  const q = await ctx.newPage(); q.on("pageerror", (e) => errs.push(String(e).slice(0, 160))); await q.goto(base + "contact.html");
  const s = await q.evaluate(async () => {
    const m = await import("/js/pillar5-upgrade-agents.js"), p2 = await import("/js/pillar2-functionality-agents.js"), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const run = async (pa, pb) => {
      const A = p2.memoryStorage(), B = p2.memoryStorage(); A.set("branding", JSON.stringify({ facilityName: "New Name" })); A.set("sync:meta", JSON.stringify({ branding: 2000 })); B.set("branding", JSON.stringify({ facilityName: "Old Name" })); B.set("sync:meta", JSON.stringify({ branding: 1000 })); A.set("preset:tue", "A-preset"); B.set("preset:wed", "B-preset"); A.set("p:r_1", "resident");
      const a = new m.P2PSyncPrototype({ storage: A, iterations: 5000 }), b = new m.P2PSyncPrototype({ storage: B, iterations: 5000 });
      const offer = await a.createOffer(pa), answer = await b.acceptOffer(offer, pb); await a.acceptAnswer(answer);
      for (let i = 0; i < 80 && !(a.state === "connected" && b.state === "connected") && a.state !== "failed" && b.state !== "failed"; i++) await sleep(100);
      await sleep(400); const out = { a: a.state, b: b.state, aBrand: A.get("branding"), bBrand: B.get("branding"), aHas: A.get("preset:wed"), bHas: B.get("preset:tue"), bResident: B.get("p:r_1"), offerHasPass: new RegExp(pa).test(offer + answer) };
      a.close(); b.close(); return out;
    };
    return { good: await run("shared passphrase", "shared passphrase"), bad: await run("right passphrase", "wrong passphrase") };
  });
  ok(s.good.a === "connected" && s.good.b === "connected" && JSON.parse(s.good.bBrand).facilityName === "New Name" && s.good.aHas === "B-preset" && s.good.bHas === "A-preset", "two peers connect over a real data channel and settle on the newer branding and each other's presets (" + s.good.a + "/" + s.good.b + ")");
  ok(s.good.bResident === null && !s.good.offerHasPass, "no resident profile travelled and the connection text carries no passphrase");
  ok(s.bad.a !== "connected" && s.bad.b !== "connected" && JSON.parse(s.bad.bBrand).facilityName === "Old Name" && s.bad.bHas === null, "a peer with the wrong passphrase does not connect and receives nothing (" + s.bad.a + "/" + s.bad.b + ")");
  ok(outside.length === 0 && errs.length === 0, "no request left the site and no script failed (" + outside.concat(errs).slice(0, 2).join("; ") + ")");
  await ctx.close();
} finally { await browser.close(); srv.close(); }

if (problems.length) { console.error("pillar 5 UI check FAILED: " + problems.length + " problem(s), " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("pillar 5 UI check passed: " + passed + " checks in a real browser (30 agents audited on the Today page, real WebRTC sync, the voice rule, no outside request)");
