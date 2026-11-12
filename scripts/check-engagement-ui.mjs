#!/usr/bin/env node
/* =====================================================================
   The one-tap engagement log (js/engagementLog.js) and the Family Visit Companion Sheet, in a real browser.

     log        three buttons (Fully engaged, Joined in, Chose another time) and an optional line, 52 px, on Daily engagement, in the
                Tablet Activities staff panel (gone in Resident Mode) and at the top of the Roster's record; one tap writes one entry into
                the resident's tracking record, once, with the activity, the day and the part of the day; "Chose another time" settles
                that part of the day as such; a line that names the resident is refused and nothing is saved; nothing shows with nobody
                chosen
     visit      the Studio's Family visit companion sheet for a saved resident: their name, three starters that went well lately (the
                notes or activities of the last weeks where they joined in or were fully engaged, never one where they chose another
                time), their songs and comforts, and a picture to color together; with no log it falls back to the profile, with no
                profile to lines to write; a topic to avoid keeps a starter off (and it does appear when nothing is avoided)
     fingers    readable (4.5:1) by day and in Night Shift, no sideways scroll, at 1366 x 768 and 390 x 844
     private    the record is written to the sealed store on this computer; nothing is requested from outside the page
   Made-up people only. Needs Playwright. Run: node scripts/check-engagement-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const dot = (o = {}) => ({ schema: "cognicopia.residentProfile", version: 2, id: "res-dot", tier1_core: { preferredName: "Dorothy", cognitiveTier: 2, unitNumber: "302-B", topHobbies: o.noHobby ? [] : [{ code: "gardening", label: "Gardening" }], printNeeds: {}, topicsToAvoid: { topics: [], eras: [], people: "", places: "", other: o.avoid || "" } },
  tier2_enrichment: { birthYear: 1938, music: o.noMusic ? {} : { genres: [], artists: ["Patsy Cline"], favoriteSong: "Tennessee Waltz" } }, tier3_deep: { notes: "", comforts: o.noMusic ? [] : ["a warm blanket"] } });

async function open(w, h, file, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block" });
  await ctx.addInitScript(a => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); if (a.night) localStorage.setItem("cognicopia_night_shift", "1"); if (a.active) localStorage.setItem("cognicopia_active_resident", a.active); } catch (e) { /* ignore */ } }, { night: !!o.night, active: o.active || "" });
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + file, { waitUntil: "load" }); await p.waitForTimeout(1300);
  return { ctx, p };
}
/* a made-up resident, and a log: two sessions that went well, one where they chose another time */
const seed = (p, prof, log) => p.evaluate(async a => {
  await CogniEngage.ready();
  const S = window.CogniSecureStore.storage; S.setItem("cognicopia_resident_" + a.prof.id, JSON.stringify(a.prof));
  for (const e of a.log) { const r = await CogniEngage.record(a.prof.id, e, ["Dorothy"]); if (!r.ok) throw new Error(r.message); }
  await window.CogniSecureStore.flush();
}, { prof, log: log || [] });
const entries = p => p.evaluate(() => { const T = CogniTracker, S = window.CogniSecureStore.storage; return T.normalize(JSON.parse(S.getItem(T.STORE_PREFIX + "res-dot") || "null"), "res-dot", T.dayOf(new Date())); }).then(t => ({ log: t.log, today: t.days[t.log.length ? t.log[t.log.length - 1].day : ""] }));
const LOG = [{ participation: "engaged", note: "Loved the old radio", activity: "Daily card: Reminiscence" }, { participation: "joined", note: "", activity: "Singing together" }, { participation: "declined", note: "Too tired", activity: "Word search" }];
const metrics = (p, sel) => p.evaluate(s => {
  const lum = c => { const m = c.match(/[\d.]+/g); const [r, g, b] = m.slice(0, 3).map(v => { v = v / 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor, m = c.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > .5)) return c; } return "rgb(255,255,255)"; };
  const box = document.querySelector(s); if (!box) return { missing: true };
  const small = [], low = [];
  box.querySelectorAll("button,input").forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.height && (r.width < 52 || r.height < 52)) small.push(`${Math.round(r.width)}x${Math.round(r.height)} ${el.tagName}`); });
  box.querySelectorAll("*").forEach(el => { if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return; const a = lum(getComputedStyle(el).color), b = lum(bgOf(el)), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05); if (ratio < 4.5) low.push(ratio.toFixed(2) + ' "' + el.textContent.trim().slice(0, 20) + '"'); });
  return { small, low, shown: box.getBoundingClientRect().height > 0, buttons: [...box.querySelectorAll("button")].map(b => b.textContent.trim()), sideways: document.documentElement.scrollWidth > innerWidth + 1 };
}, sel);

try {
  /* ---------- Daily engagement ---------- */
  {
    const { ctx, p } = await open(1366, 768, "daily.html");
    await seed(p, dot(), []); await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1300);
    await p.click("#dyMake"); await p.waitForTimeout(900);
    let m = await metrics(p, "#dyLog");
    ok(!(await p.$eval("#dyLog", e => e.getBoundingClientRect().height > 0)), "daily: nothing shows with nobody chosen");
    await p.selectOption("#dyWho", "res-dot"); await p.click("#dyMake"); await p.waitForTimeout(900);
    m = await metrics(p, "#dyLog");
    ok(m.shown && m.buttons.join("|") === "Fully engaged|Joined in|Chose another time", `daily: three buttons (${m.buttons})`);
    ok(!m.small.length && !m.low.length, `daily: 52 px and readable (${m.small.concat(m.low).join(", ") || "yes"})`);
    await p.fill("#dyLog input", "Hummed along"); await p.click('#dyLog button[data-p="joined"]'); await p.waitForTimeout(700);
    let e = await entries(p);
    ok(e.log.length === 1 && e.log[0].participation === "joined" && e.log[0].note === "Hummed along" && /^Daily card: /.test(e.log[0].activity) && e.log[0].day === await p.evaluate(() => CogniTracker.dayOf(new Date())), `daily: one tap wrote one entry (${JSON.stringify(e.log.map(x => [x.participation, x.note, x.activity]))})`);
    ok(/Saved: Joined in/.test(await p.textContent("#dyLog .cg-eng-msg")) && (await p.inputValue("#dyLog input")) === "", "daily: it says it saved, and the line is empty again");
    await p.fill("#dyLog input", "Dorothy loved it"); await p.click('#dyLog button[data-p="engaged"]'); await p.waitForTimeout(600);
    e = await entries(p);
    ok(e.log.length === 1 && /name/i.test(await p.textContent("#dyLog .cg-eng-msg")), "daily: a line that names the resident is refused, and nothing is saved");
    await p.fill("#dyLog input", ""); await p.click('#dyLog button[data-p="declined"]'); await p.waitForTimeout(600);
    e = await entries(p);
    ok(e.log.length === 2 && e.log[1].participation === "declined" && !e.log[1].note, "daily: with no line a tap still saves");
    const slot = await p.evaluate(() => { const T = CogniTracker, S = window.CogniSecureStore.storage, t = T.normalize(JSON.parse(S.getItem(T.STORE_PREFIX + "res-dot")), "res-dot", T.dayOf(new Date())), d = t.days[T.dayOf(new Date())]; return Object.values(d).map(x => x.state); });
    ok(slot.includes("skipped"), `daily: choosing another time settles that part of the day as such (${slot})`);
    await ctx.close();
  }
  /* ---------- the Tablet Activities staff panel ---------- */
  {
    const { ctx, p } = await open(1366, 768, "daily.html", { active: "res-dot" });
    await seed(p, dot(), []); await p.goto(base + "tablet.html", { waitUntil: "load" }); await p.waitForTimeout(2200);
    const m = await metrics(p, "#tbLog");
    ok(m.shown && m.buttons.length === 3 && !m.small.length, `tablet: the staff panel has the three buttons, 52 px (${m.buttons}, ${(m.small || []).join(", ")})`);
    await p.click('#tbLog button[data-p="engaged"]'); await p.waitForTimeout(700);
    const e = await entries(p);
    ok(e.log.length === 1 && e.log[0].participation === "engaged" && e.log[0].activity.length > 2, "tablet: one tap wrote one entry");
    await p.click("#tbResident"); await p.waitForTimeout(500);
    ok(!(await p.$eval("#tbLog", e2 => e2.getBoundingClientRect().height > 0)), "tablet: Resident Mode hides it with the rest of the staff panel");
    await ctx.close();
    const n = await open(1366, 768, "tablet.html"); await n.p.waitForTimeout(800);
    ok(!(await n.p.$eval("#tbLog", e2 => e2.getBoundingClientRect().height > 0)), "tablet: nothing shows with nobody chosen");
    await n.ctx.close();
  }
  /* ---------- the Roster's record ---------- */
  {
    const { ctx, p } = await open(1366, 768, "builder.html#/");
    await seed(p, dot(), []); await p.reload({ waitUntil: "load" }); await p.waitForTimeout(2000);
    await p.evaluate(() => { const d = document.createElement("div"); d.id = "trHost"; d.style.cssText = "position:fixed;top:90px;left:290px;width:760px;max-height:640px;overflow:auto;z-index:99999;background:#fff"; document.body.appendChild(d); TrackerUI.mount(d, BookUI.savedProfiles().find(x => x.id === "res-dot"), () => {}); });
    const m = await metrics(p, "#trHost #trQuick");
    ok(m.shown && m.buttons.length === 3 && !m.small.length, `roster: the record opens with the three buttons, 52 px (${m.buttons}, ${(m.small || []).join(", ")})`);
    await p.click('#trHost #trQuick button[data-p="joined"]'); await p.waitForTimeout(800);
    const e = await entries(p);
    ok(e.log.length === 1 && e.log[0].participation === "joined" && (await p.textContent("#trHost")).includes("Activity with staff"), "roster: one tap wrote one entry, and the record lists it");
    await ctx.close();
  }
  /* ---------- the Family Visit Companion Sheet ---------- */
  const visit = async (prof, log, pick) => {
    const { ctx, p } = await open(1366, 900, "activity-studio.html");
    if (prof) await seed(p, prof, log);
    await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1300);
    if (prof && pick) { await p.selectOption("#asResident", prof.id); await p.waitForTimeout(1200); }
    await p.click("#asAccPages summary");
    for (const k of await p.$$eval('input[name="mix"]', e => e.map(i => i.value))) await p.setChecked(`input[name="mix"][value="${k}"]`, k === "visit", { force: true });
    await p.waitForTimeout(900);
    const text = await p.$eval("#asSheet svg", e => [...e.querySelectorAll("text")].map(t => t.textContent).join(" | "));
    await ctx.close(); return text;
  };
  {
    const t = await visit(dot(), LOG, true);
    ok(/A visit with Dorothy/.test(t) && /Starters that went well lately/.test(t), "visit: the page names her and says what the starters are");
    ok(/Loved the old radio/.test(t) && /Singing together/.test(t), "visit: the starters are what went well lately (a note, else the activity)");
    ok(!/Too tired|Word search/.test(t), "visit: a time they chose another time is never a starter");
    ok(/Songs and comforts/.test(t) && /Tennessee Waltz/.test(t) && /Patsy Cline/.test(t) && /warm blanket/.test(t), "visit: the songs and comforts are hers");
    ok(/Color the .* together/.test(t), "visit: a picture to color together, in the lower half");
    const av = await visit(dot({ avoid: "radio" }), LOG, true);
    ok(!/radio/i.test(av) && /Singing together/.test(av), "visit: a topic to avoid keeps a starter off (and it does appear when nothing is avoided)");
    const none = await visit(dot(), [], true);
    ok(/Things to talk about/.test(none) && /Talk about gardening/.test(none) && !/went well lately/.test(none), "visit: with no log it falls back to the profile");
    const bare = await visit(dot({ noHobby: true, noMusic: true }), [], true);
    ok(/A story I love to tell is/.test(bare) && /Songs and comforts they enjoy/.test(bare), "visit: with nothing known it leaves lines to write on");
    const nobody = await visit(null, [], false);
    ok(/A visit/.test(nobody) && !/went well lately/.test(nobody) && !/Dorothy/.test(nobody), "visit: with nobody chosen it claims nothing about anyone");
  }
  /* ---------- by day and in Night Shift, on a phone ---------- */
  for (const [w, h, night] of [[1366, 768, false], [390, 844, false], [1366, 768, true], [390, 844, true]]) {
    const { ctx, p } = await open(w, h, "daily.html", { night });
    await seed(p, dot(), []); await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1200);
    await p.selectOption("#dyWho", "res-dot"); await p.click("#dyMake"); await p.waitForTimeout(900);
    await p.$eval("#dyLog", e => e.scrollIntoView({ block: "center" }));
    const m = await metrics(p, "#dyLog");
    ok(m.shown && !m.small.length && !m.low.length && !m.sideways, `daily ${w}${night ? " night" : ""}: shown, 52 px, readable, no sideways scroll (${(m.small || []).concat(m.low || []).join(", ")})`);
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }

ok(!foreign.length, `nothing requested from outside the page: ${foreign.slice(0, 3).join(", ")}`);
ok(!errors.length, `no script errors: ${errors.slice(0, 3).join(" | ")}`);
console.log(problems.length ? `engagement check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 40).join("\n  - ") : `engagement check passed: ${passed} checks`);
process.exit(problems.length ? 1 : 0);
