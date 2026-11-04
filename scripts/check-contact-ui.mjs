#!/usr/bin/env node
/* =====================================================================
   The Contact & Support page (contact.html), in a real browser (Playwright; exit 2 where it is not installed).

     header     the owner's sentence, word for word, larger than before and not bold
     form       four fields and "Send Message"; an empty form says what to fix and opens nothing; a filled form opens the
                mail program with mailto:cognicopia@outlook.com, "[Cognicopia Inquiry] " + subject, and name, email and message
                in the body; a very long message is cut for the link and copied whole
     buttons    "Send an Email" opens exactly mailto:cognicopia@outlook.com (a filled-in one when an invoice or pilot link made it);
                "Copy Email" writes the address to the clipboard, says "Copied to Clipboard!" for two seconds, and when the browser
                refuses it says what to do instead; when no mail program opens, the page says so
     page       every control 52 px tall, no sideways scrolling on a phone, and nothing is requested from outside the page
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const SENTENCE = "Contact our support with any questions, recommendations, or concerns of any kind.";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
try {
  async function open(opts = {}, url = "contact.html") {
    const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1366, height: 768 }, serviceWorkers: "block", permissions: opts.clip === false ? [] : ["clipboard-read", "clipboard-write"] });
    await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (x) { /* ignore */ } });
    const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p); await cdp.send("Page.enable");
    const nav = [], outside = [];
    cdp.on("Page.frameRequestedNavigation", e => { if (/^mailto:/.test(e.url)) nav.push(decodeURIComponent(e.url)); });
    p.on("request", r => { if (!r.url().startsWith(base) && !/^(data|blob|about|mailto):/.test(r.url())) outside.push(r.url()); });
    await p.goto(base + url); await p.waitForSelector("#contactForm");
    return { ctx, p, nav, outside };
  }

  /* header */
  let { ctx, p, nav, outside } = await open();
  const h = await p.evaluate(() => { const e = document.querySelector(".vine-subtitle"), s = getComputedStyle(e); return { text: e.textContent.trim(), size: parseFloat(s.fontSize), weight: +s.fontWeight, body: document.body.textContent }; });
  ok(h.text === SENTENCE, "the header sentence is the owner's, word for word: " + h.text);
  ok(!/Activities built from a resident's own life/.test(h.body), "the old header sentence is gone");
  ok(h.size > 18 && h.weight < 600, `the sentence is larger than the old 18 px (${h.size} px) and lighter than the old 600 (${h.weight})`);

  /* the form */
  ok(await p.evaluate(() => ["cfName", "cfEmail", "cfSubject", "cfMessage"].every(id => document.getElementById(id) && document.querySelector(`label[for=${id}]`))) && /Send Message/.test(await p.textContent("#cfSend")), "four labelled fields and a Send Message button");
  await p.click("#cfSend"); await p.waitForTimeout(400);
  ok(nav.length === 0, "an empty form opens no mail program");
  ok(await p.evaluate(() => [...document.querySelectorAll(".cf-err:not([hidden])")].length) === 4 && (await p.evaluate(() => document.activeElement.id)) === "cfName", "an empty form names all four fields and moves to the first");
  await p.fill("#cfName", "Maple Court Senior Living"); await p.fill("#cfEmail", "not-an-email"); await p.fill("#cfSubject", "Pilot question"); await p.fill("#cfMessage", "Hello,\nCan we try the packets on our memory care wing?");
  await p.click("#cfSend"); await p.waitForTimeout(300);
  ok(nav.length === 0 && (await p.evaluate(() => document.activeElement.id)) === "cfEmail", "a bad email address is refused and the field is focused");
  await p.fill("#cfEmail", "ap@maplecourt.example"); await p.click("#cfSend"); await p.waitForTimeout(300);
  ok(nav.length === 1 && nav[0].startsWith("mailto:cognicopia@outlook.com?"), "a filled form opens the mail program addressed to cognicopia@outlook.com: " + nav[0]);
  ok(/subject=\[Cognicopia Inquiry\] Pilot question(&|$)/.test(nav[0]), "the subject is [Cognicopia Inquiry] plus the visitor's subject");
  ok(/body=Name: Maple Court Senior Living\r?\nEmail: ap@maplecourt\.example\r?\n\r?\nMessage:\r?\nHello,\r?\nCan we try the packets/.test(nav[0]), "the body holds the name, the email and the message");
  ok(/should open now/.test(await p.textContent("#cfStatus")), "the page says what to do next");
  await p.waitForTimeout(1900);
  await p.close(); await ctx.close();
  ok(outside.length === 0, "nothing was requested from outside the page: " + outside.join(", "));

  /* a long message */
  ({ ctx, p, nav } = await open());
  await p.fill("#cfName", "A"); await p.fill("#cfEmail", "a@b.example"); await p.fill("#cfSubject", "Long"); const long = "word ".repeat(700);
  await p.fill("#cfMessage", long); await p.click("#cfSend"); await p.waitForTimeout(500);
  ok(nav.length === 1 && nav[0].length < 1500, "a very long message is cut for the mail link (" + (nav[0] || "").length + " characters)");
  ok((await p.evaluate(() => navigator.clipboard.readText())).includes("Message:") && (await p.evaluate(() => navigator.clipboard.readText())).length > 3000, "and the whole message is on the clipboard");
  ok(/copied all of it/.test(await p.textContent("#cfStatus")), "and the page says so");
  await ctx.close();

  /* Send an Email and Copy Email */
  ({ ctx, p, nav } = await open());
  ok((await p.getAttribute("#sendEmailBtn", "href")) === "mailto:cognicopia@outlook.com", "Send an Email is the plain mailto address");
  await p.click("#sendEmailBtn"); await p.waitForTimeout(200);
  ok(nav.length === 1 && nav[0] === "mailto:cognicopia@outlook.com", "Send an Email opens mailto:cognicopia@outlook.com: " + nav[0]);
  const place = await p.evaluate(() => { const a = document.getElementById("mailAddress").getBoundingClientRect(), c = document.getElementById("copyEmailBtn").getBoundingClientRect(); return { below: c.top >= a.bottom - 1, same: document.getElementById("copyEmailBtn").closest(".info-box") === document.getElementById("mailAddress").closest(".info-box") }; });
  ok(place.below && place.same, "Copy Email sits directly beneath the address");
  await p.click("#copyEmailBtn"); await p.waitForTimeout(250);
  ok((await p.textContent("#copyEmailBtn")) === "Copied to Clipboard!" && (await p.evaluate(() => navigator.clipboard.readText())) === "cognicopia@outlook.com", "Copy Email writes the address and says Copied to Clipboard!");
  await p.waitForTimeout(2000);
  ok((await p.textContent("#copyEmailBtn")) === "Copy Email", "and the words go back after two seconds");
  await p.waitForTimeout(1500);
  ok(/did not open/.test(await p.textContent("#mailNote")), "when no mail program takes over, the page says what to do: " + (await p.textContent("#mailNote")).slice(0, 60));
  await ctx.close();

  /* the browser refuses the clipboard */
  ({ ctx, p } = await open({ clip: false }));
  await p.evaluate(() => { Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) }, configurable: true }); document.execCommand = () => false; });
  await p.click("#copyEmailBtn"); await p.waitForTimeout(400);
  ok(/cognicopia@outlook\.com/.test(await p.textContent("#mailNote")) && (await p.textContent("#copyEmailBtn")) === "Copy Email", "if copying is refused the address is selected and the page says what to do: " + (await p.textContent("#mailNote")).slice(0, 50));
  await ctx.close();

  /* an invoice link keeps its filled-in message */
  ({ ctx, p, nav } = await open({}, "contact.html?subject=Corporate+Invoice+Request&plan=annual"));
  await p.click("#sendEmailBtn"); await p.waitForTimeout(200);
  ok(nav.length === 1 && /subject=Cognicopia — Corporate Invoice Request/.test(nav[0]) && /Annual/.test(nav[0]), "Send an Email still carries an invoice request's filled-in message");
  await ctx.close();

  /* size and phone */
  for (const [label, vp] of [["a laptop", { width: 1366, height: 768 }], ["a phone", { width: 390, height: 844 }]]) {
    ({ ctx, p } = await open({ viewport: vp }));
    const m = await p.evaluate(() => ({ wide: document.documentElement.scrollWidth <= innerWidth + 1, small: [...document.querySelectorAll("#contactForm input, #contactForm textarea, #cfSend, #copyEmailBtn, #sendEmailBtn")].filter(e => e.getBoundingClientRect().height < 51.5).map(e => e.id) }));
    ok(m.wide, `${label}: no sideways scrolling`); ok(m.small.length === 0, `${label}: every control is 52 px tall (${m.small.join(", ")} are not)`);
    if (vp.width === 390) await p.screenshot({ path: process.env.CG_SHOTS ? process.env.CG_SHOTS + "/contact-390.png" : undefined, fullPage: true }).catch(() => {});
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }

if (problems.length) { console.error("contact page check FAILED: " + problems.length + " problem(s), " + passed + " passed"); problems.forEach(x => console.error("  - " + x)); process.exit(1); }
console.log("contact page check passed: " + passed + " checks in a real browser (the header sentence, the message form, Send an Email, Copy Email with its fallbacks, 52 px controls, nothing leaving the page)");
