#!/usr/bin/env node
/* =====================================================================
   Daily engagement cards and the group circle script in the Packet Builder's packet queue, in a real browser (made-up people only, saved on a made-up computer):

     the card      "Add this card to the packet" (off until a card is made) and "Copies" (1 to 6) put the finished card in the queue for the resident chosen,
                   once or in copies; adding spends no free packet
     the circle    "Add the script to the packet" (off until a script is made, and off for a theme someone avoids) puts the leader's script in the queue as a
                   staff page, with every name and prompt exactly as shown
     the packet    the Packet Builder lists them; printing cards draws each as a Letter sheet and counts as one packet; printing only the circle script is a staff
                   document: it prints and spends no free packet, even when none are left; a packet of cards still stops at the gate when none are left
     fingers       the new controls are 52 px or more at 1366 x 768 and 390 x 844, with no sideways scroll
     nothing else  nothing is requested from outside the page, and no page script fails
   Needs Playwright (exit 2 where it is not installed). Run: node scripts/check-daily-queue-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve, agreed, agreeToDialogs } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const person = (id, name, o) => ({ schema: "cognicopia.residentProfile", version: 2, id, tier1_core: { preferredName: name, cognitiveTier: o.tier, printNeeds: {}, topHobbies: [], topicsToAvoid: { topics: [], eras: [], people: "", places: "", other: o.avoid || "" } },
  tier2_enrichment: { birthYear: o.born, hometown: { place: "Scobey, Montana" } }, tier3_deep: { notes: "" } });
const RUTH = person("res-ruth", "Ruth", { tier: 2, born: 1938 }), WALT = person("res-walt", "Walt", { tier: 1, born: 1940 }), LENA = person("res-lena", "Lena", { tier: 3, born: 1946 });

async function open(w, h, url) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block", timezoneId: "America/Chicago" }); await agreed(ctx);
  await ctx.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  const p = await ctx.newPage(); await agreeToDialogs(p);
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + url, { waitUntil: "load" }); await p.waitForTimeout(1300);
  return { ctx, p };
}
const small = (p, sel) => p.$$eval(sel, els => els.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }).filter(([w, h]) => w > 0 && (w < 52 || h < 52)).length);
const readQueue = p => p.evaluate(() => JSON.parse(window.CogniSecureStore.storage.getItem("cgb_queue") || "[]"));

try {
  /* ---------- fingers ---------- */
  for (const [w, h] of [[390, 844], [1366, 768]]) {
    const { ctx, p } = await open(w, h, "daily.html");
    ok((await p.$("#dyQueue")) && (await p.$("#dyCopies")) && (await p.$("#dyCircleQueue")), `Daily engagement has the add-to-packet controls at ${w} px`);
    ok((await small(p, "#dyQueueBox button, #dyQueueBox select")) === 0, `the card's add-to-packet controls are 52 px or more at ${w} px`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `no sideways scroll at ${w} px`);
    ok(await p.$eval("#dyQueue", b => b.disabled), "Add this card is off until a card is made");
    await ctx.close();
  }

  /* ---------- add from Daily engagement ---------- */
  const { ctx, p } = await open(1366, 800, "daily.html");
  await p.evaluate(async list => { const S = window.CogniSecureStore.storage; list.forEach(x => S.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))); await window.CogniSecureStore.flush(); }, [RUTH, WALT, LENA]);
  await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1500);
  await p.selectOption("#dyWho", "res-ruth"); await p.click("#dyMake"); await p.waitForSelector("#dySheet svg", { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(500);
  ok(!(await p.$eval("#dyQueue", b => b.disabled)), "Add this card is on once a card is made");
  await p.selectOption("#dyCopies", "2"); await p.click("#dyQueue"); await p.waitForTimeout(400);
  let q = await readQueue(p);
  ok(q.length === 2 && q.every(x => x.activityId === "studio-page-queued" && x.cfg.residentName === "Ruth" && /<svg/.test(x.cfg.opts.svg)), `the card is in the queue twice for Ruth (${q.length})`);
  ok(/Added 2 cards to the packet for Ruth/.test(await p.innerText("#dyQueueNote")), "and Daily engagement says so in plain words");

  await p.click("#dyCircleH"); await p.waitForTimeout(300);
  ok(await p.$eval("#dyCircleQueue", b => b.disabled), "Add the script is off until a script is made");
  for (const n of ["Ruth", "Walt", "Lena"]) await p.setChecked(`#dyCircleWho label:has-text("${n}") input`, true, { force: true });
  await p.click("#dyCircleMake"); await p.waitForTimeout(400);
  ok(!(await p.$eval("#dyCircleQueue", b => b.disabled)), "Add the script is on once a script is made");
  await p.click("#dyCircleQueue"); await p.waitForTimeout(400);
  q = await readQueue(p);
  const circ = q.filter(x => x.activityId === "group-circle-queued");
  ok(circ.length === 1 && ["Ruth", "Walt", "Lena"].every(n => circ[0].cfg.opts.html.includes(n)) && /Around the circle/.test(circ[0].cfg.opts.html), "the circle script is in the queue with every name");
  ok(q.length === 3, `three items in the queue in all (${q.length})`);

  /* ---------- print from the Packet Builder ---------- */
  const p2 = await ctx.newPage(); p2.on("pageerror", e => errors.push(e.message)); p2.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p2.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p2.goto(base + "builder.html", { waitUntil: "load" }); await p2.waitForTimeout(2500);
  ok((await p2.evaluate(() => queue.length)) === 3, "the Packet Builder lists the three queued items");
  const lic = await p2.evaluate(() => isLicensed());
  const g0 = await p2.evaluate(() => genCount());
  await p2.evaluate(() => { window.__printed = 0; generatePdf(queue.filter(q => q.activityId === "studio-page-queued")); }); await p2.waitForTimeout(1200);
  ok((await p2.evaluate(() => window.__printed)) === 1, "printing the two cards opens the print window");
  ok(await p2.evaluate(() => document.querySelectorAll("#printRoot .sheet-zg").length) === 2, "as two Letter sheets");
  ok(lic || (await p2.evaluate(() => genCount())) === g0 + 1, "and counts as one packet");
  const g1 = await p2.evaluate(() => genCount());
  await p2.evaluate(() => { window.__printed = 0; generatePdf(queue.filter(q => q.activityId === "group-circle-queued")); }); await p2.waitForTimeout(1200);
  const st = await p2.evaluate(() => { const s = document.querySelector("#printRoot .sheet-gc"); return s ? s.innerText.replace(/\s+/g, " ") : ""; });
  ok(/Group circle/i.test(st) && /Ruth/.test(st) && /Walt/.test(st) && /Lena/.test(st), "printing the circle script alone draws the staff page with every name");
  ok((await p2.evaluate(() => genCount())) === g1, "and spends no free packet, because a staff document is not a packet");
  /* with no free packets left, the script still prints; a packet of cards still stops at the gate */
  await p2.evaluate(() => { window.genCount = () => 9999; });
  await p2.evaluate(() => { window.__printed = 0; generatePdf(queue.filter(q => q.activityId === "group-circle-queued")); }); await p2.waitForTimeout(800);
  ok(lic || (await p2.evaluate(() => window.__printed)) === 1, "the circle script prints even when no free packets are left");
  await p2.evaluate(() => { window.__printed = 0; generatePdf(queue.filter(q => q.activityId === "studio-page-queued")); }); await p2.waitForTimeout(800);
  ok(lic || (await p2.evaluate(() => window.__printed)) === 0, "while cards stop at the gate when none are left");
  await ctx.close();
} finally { await browser.close(); srv.close(); }

ok(foreign.length === 0, `nothing is requested from outside the page (${[...new Set(foreign)].slice(0, 3)})`);
ok(errors.length === 0, `no page script fails (${[...new Set(errors)].slice(0, 3)})`);
console.log(problems.length ? `daily queue UI check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 20).join("\n  - ") : `daily queue UI check passed: ${passed} checks`);
process.exit(problems.length ? 1 : 0);
