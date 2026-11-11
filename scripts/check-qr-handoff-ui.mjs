#!/usr/bin/env node
/* =====================================================================
   The resident handoff by QR codes (js/qrHandoff.js, the roster's "Pass a resident to an iPad"), in a real browser.

     codes      one made-up resident becomes a handful of codes, each small enough for one QR code; none of them holds
                a readable name; photos are left behind
     round trip each code is drawn by the site's own QR maker and read back by the saved reader (jsQR), in a shuffled
                order with repeats, then opened with the passphrase into the same resident; a wrong passphrase is
                refused in plain words
     sender     the roster shows the codes for the chosen resident in a loop that changes by itself, under three
                times a second; Pause stops it; the passphrase is asked for first
     camera     a second browser whose stand-in camera plays the codes (a video made from them) reads them all,
                asks for the passphrase and adds the resident to its roster, with their name
     no camera  a browser with no camera says so and points to the handoff file
     fingers    every control 52 px and readable, by day and in Night Shift, at 1366 x 768 and 390 x 844
     private    nothing is requested from outside the page; no script errors
   What this cannot prove: a real iPad's camera reading a real screen. Made-up people only.
   Needs Playwright. Run: node scripts/check-qr-handoff-ui.mjs
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const PASS = "maple unit evening 2026";
const DOT = { schema: "cognicopia.residentProfile", version: 2, id: "res-dot", updatedAt: "2026-11-01T10:00:00Z",
  tier1_core: { preferredName: "Dorothy Example", cognitiveTier: 2, unitNumber: "302-B", occupation: { code: "teacher", label: "Teacher" }, topHobbies: [{ code: "gardening", label: "Gardening" }, { code: "baking", label: "Baking" }], printNeeds: {},
    topicsToAvoid: { topics: [{ code: "religion", label: "Religion" }], eras: [], people: "", places: "", other: "storms" } },
  tier2_enrichment: { birthYear: 1938, hometown: { place: "Scobey, Montana" }, meaningfulDecades: ["1950s"] },
  tier3_deep: { notes: "Loves the smell of bread. Taught second grade for thirty years.", people: [{ name: "Sarah Example", relationship: { code: "daughter", label: "Daughter" }, photo: "tok123", isPet: false, passedAway: false }] } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-qr-"));

const watch = p => {
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Requested device not found|NotFoundError/.test(m.text())) errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
};
async function openIn(browser, w, h, file, night) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block" });
  await ctx.addInitScript(n => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); if (n) localStorage.setItem("cognicopia_night_shift", "1"); } catch (e) { /* ignore */ } }, !!night);
  const p = await ctx.newPage(); watch(p);
  await p.goto(base + file, { waitUntil: "load" }); await p.waitForTimeout(900);
  await p.waitForFunction(() => !!window.CogniQrHandoff, null, { timeout: 10000 });
  return { ctx, p };
}
const seed = (p, list) => p.evaluate(l => { l.forEach(x => window.CogniSecureStore.storage.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))); return window.CogniSecureStore.flush(); }, list);
const measure = (p, sel) => p.evaluate(s => {
  const lum = c => { const m = c.match(/[\d.]+/g); const [r, g, b] = m.slice(0, 3).map(v => { v = v / 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor, m = c.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > .5)) return c; } return "rgb(255,255,255)"; };
  const box = document.querySelector(s), small = [], low = [];
  if (!box) return { small: ["missing " + s], low };
  box.querySelectorAll("button, a, input").forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.height && (r.width < 52 || r.height < 52)) small.push(`${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent || el.id).trim().slice(0, 20)}"`); });
  box.querySelectorAll("*").forEach(el => { if (el.closest("svg") || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return; const r = el.getBoundingClientRect(); if (!r.width) return;
    const a = lum(getComputedStyle(el).color), b = lum(bgOf(el)), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05); if (ratio < 4.5) low.push(`${ratio.toFixed(2)} "${el.textContent.trim().slice(0, 24)}"`); });
  return { small, low };
}, sel);

const browser = await chromium.launch();
let frames = [], matrices = [];
try {
  /* ---------- the codes, and a round trip through the saved reader ---------- */
  {
    const { ctx, p } = await openIn(browser, 1366, 768, "builder.html#/roster");
    const got = await p.evaluate(async a => { const r = await window.CogniQrHandoff.pack([a.dot], a.pass, "Maple Unit"); return r; }, { dot: DOT, pass: PASS });
    frames = got.frames;
    const max = await p.evaluate(async () => (await import("./js/qr.js")).MAX_BYTES);
    ok(frames.length >= 2 && frames.length <= 30, `one resident is ${frames.length} codes (${got.bytes} bytes locked, ${got.plainBytes} before; made smaller: ${got.compressed})`);
    ok(frames.every(f => new TextEncoder().encode(f).length <= max && /^CQ1\/[a-z0-9]{4}\/\d+\/\d+\/[A-Za-z0-9_-]+$/.test(f)), `each fits one QR code (at most ${max} bytes) and carries only its number and locked bytes`);
    ok(!frames.join("").match(/Dorothy|Example|Scobey|Sarah|teacher/i), "no name, place or detail can be read in the codes");
    await p.evaluate(() => new Promise((res, rej) => { const s = document.createElement("script"); s.src = "assets/vendor/jsqr.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); }));
    /* each code drawn by the site's QR maker onto a canvas and read back by jsQR */
    const read = await p.evaluate(async list => {
      const { qrSvg, qrMatrix } = await import("./js/qr.js"), out = [], mats = [];
      for (const f of list) {
        const img = new Image(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(qrSvg(f, { scale: 6 })); await img.decode();
        const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
        const hit = window.jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height); out.push(hit ? hit.data : null);
        mats.push(qrMatrix(f).map(r => r.map(v => (v ? 1 : 0)).join("")));
      }
      return { out, mats };
    }, frames);
    matrices = read.mats;
    ok(read.out.every((t, i) => t === frames[i]), `every code drawn by the site's QR maker is read back exactly by the saved reader (${read.out.filter((t, i) => t === frames[i]).length} of ${frames.length})`);
    const back = await p.evaluate(async a => {
      const Q = window.CogniQrHandoff, c = new Q.Collector(), order = a.frames.slice().reverse().concat(a.frames.slice(0, 2));
      let last = null; order.forEach(f => { last = c.add(f); });
      const opened = await Q.open(c.text(), a.pass);
      let wrong = ""; try { await Q.open(c.text(), "not the right passphrase"); } catch (e) { wrong = e.message; }
      const other = new Q.Collector(); other.add(a.frames[0]); other.add(a.frames[1].replace(/^CQ1\/[a-z0-9]{4}/, "CQ1/zzzz"));
      return { done: last.done, have: c.have, n: c.n, p: opened.profiles[0], from: opened.handoff && opened.handoff.station, wrong, otherHave: other.have, junk: c.add("https://example.org").ok };
    }, { frames, pass: PASS });
    ok(back.done && back.have === frames.length, "read backwards and with repeats, every code is gathered once");
    ok(back.p && back.p.tier1_core.preferredName === "Dorothy Example" && back.p.tier2_enrichment.birthYear === 1938 && back.p.tier1_core.topicsToAvoid.other === "storms" && back.from === "Maple Unit", "opened with the passphrase, they are the same resident, with their topics to avoid");
    ok(back.p && !JSON.stringify(back.p).includes("tok123") && back.p.tier3_deep.people[0].name === "Sarah Example", "the photo is left behind; the person in it is not");
    ok(back.wrong === "passphrase", "a wrong passphrase is refused");
    ok(back.otherHave === 1 && back.junk === false, "a code from another loop starts again, and a code that is not a handoff is set aside");

    /* ---------- the sender on the roster ---------- */
    await seed(p, [DOT]); await p.reload({ waitUntil: "load" }); await p.waitForSelector("#rsList .rs-res"); await p.waitForTimeout(500);
    await p.click('.rs-res[data-id="res-dot"]'); await p.waitForTimeout(300);
    await p.evaluate(() => { document.getElementById("rsQr").open = true; });
    await p.click("#rsQrShow"); await p.waitForTimeout(300);
    ok(/passphrase/i.test(await p.textContent("#rsQrMsg")) && !(await p.$("#qhSend[open]")), "with no passphrase, the codes are not shown and it says why");
    await p.fill("#rsQrPass", PASS); await p.click("#rsQrShow"); await p.waitForSelector("#qhSend[open] .qh-code svg", { timeout: 8000 });
    const c1 = await p.textContent("#qhCount"); const s1 = await p.$eval("#qhCode svg path", e => e.getAttribute("d"));
    await p.waitForTimeout(500);
    const c2 = await p.textContent("#qhCount"); const s2 = await p.$eval("#qhCode svg path", e => e.getAttribute("d"));
    ok(/^Code 1 of \d+/.test(c1) && c1 !== c2 && s1 !== s2, `the codes change by themselves (${c1} then ${c2})`);
    ok(await p.evaluate(() => window.CogniQrHandoff.FRAME_MS) >= 334, "no faster than three a second");
    const fill = await p.$eval("#qhCode svg", s => [s.querySelector("path").getAttribute("fill"), s.querySelector("rect").getAttribute("fill"), Math.round(s.getBoundingClientRect().width)]);
    ok(fill[0] === "#000" && fill[1] === "#fff" && fill[2] >= 300, `each code is pure black on white, ${fill[2]} px wide`);
    await p.click('#qhSend [data-qh="pause"]'); await p.waitForTimeout(100); const p1 = await p.textContent("#qhCount"); await p.waitForTimeout(900);
    ok(p1 === await p.textContent("#qhCount") && /paused/.test(p1), "Pause stops the loop");
    ok(await p.$eval("#rsQrPass", e => e.value) === "", "the passphrase is cleared from the form");
    await p.click('#qhSend [data-qh="close"]'); await p.waitForTimeout(200);
    ok(!(await p.$("#qhSend[open]")), "Done closes it");
    await ctx.close();
  }

  /* ---------- no camera ---------- */
  {
    const { ctx, p } = await openIn(browser, 1366, 768, "builder.html#/roster");
    await p.evaluate(() => { document.getElementById("rsQr").open = true; }); await p.click("#rsQrRead"); await p.waitForTimeout(2500);
    const t = await p.textContent("#qhStatus");
    ok(/camera/i.test(t) && /handoff file|not allowed|No camera/i.test(t), `with no camera it says so plainly ("${t}")`);
    await p.keyboard.press("Escape"); await ctx.close();
  }

  /* ---------- 52 px and readable, day and Night Shift, laptop and phone ---------- */
  for (const night of [false, true]) for (const [w, h] of [[1366, 768], [390, 844]]) {
    const tag = `${w} px${night ? ", Night Shift" : ""}`;
    const { ctx, p } = await openIn(browser, w, h, "builder.html#/roster", night);
    await seed(p, [DOT]); await p.reload({ waitUntil: "load" }); await p.waitForSelector("#rsList .rs-res"); await p.waitForTimeout(400);
    await p.click('.rs-res[data-id="res-dot"]'); await p.waitForTimeout(300);
    await p.evaluate(() => { document.getElementById("rsQr").open = true; }); await p.waitForTimeout(150);
    const mf = await measure(p, "#rsQr");
    ok(mf.small.length === 0 && mf.low.length === 0, `${tag}: the roster's section is 52 px and readable` + (mf.small.length + mf.low.length ? ": " + mf.small.concat(mf.low).slice(0, 4).join("; ") : ""));
    await p.fill("#rsQrPass", PASS); await p.click("#rsQrShow"); await p.waitForSelector("#qhSend[open] svg", { timeout: 8000 });
    const ms = await measure(p, "#qhSend");
    const fits = await p.$eval("#qhSend .qh-code svg", s => { const r = s.getBoundingClientRect(); return r.right <= innerWidth && r.width >= 250; });
    ok(ms.small.length === 0 && ms.low.length === 0 && fits, `${tag}: the codes window is 52 px, readable, and its code fits the screen` + (ms.small.length + ms.low.length ? ": " + ms.small.concat(ms.low).slice(0, 4).join("; ") : ""));
    await p.click('#qhSend [data-qh="close"]');
    await p.click("#rsQrRead"); await p.waitForSelector("#qhRead[open]"); await p.waitForTimeout(500);
    const mr = await measure(p, "#qhRead");
    ok(mr.small.length === 0 && mr.low.length === 0, `${tag}: the reading window is 52 px and readable` + (mr.small.length + mr.low.length ? ": " + mr.small.concat(mr.low).slice(0, 4).join("; ") : ""));
    await ctx.close();
  }
} finally { await browser.close(); }

/* ---------- the camera: a second browser whose stand-in camera plays the codes ---------- */
{
  const W = 640, H = 480, FPS = 10, HOLD = 4, file = path.join(tmp, "codes.y4m");
  const out = [Buffer.from(`YUV4MPEG2 W${W} H${H} F${FPS}:1 Ip A1:1 C420jpeg\n`)];
  const plane = m => { const n = m.length, q = 4, mod = Math.floor(Math.min(W, H) / (n + 2 * q)), size = mod * (n + 2 * q), ox = (W - size) >> 1, oy = (H - size) >> 1, y = Buffer.alloc(W * H, 235);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c] === "1") for (let dy = 0; dy < mod; dy++) y.fill(16, (oy + (r + q) * mod + dy) * W + ox + (c + q) * mod, (oy + (r + q) * mod + dy) * W + ox + (c + q + 1) * mod);
    return y; };
  const chroma = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
  for (let loop = 0; loop < 2; loop++) matrices.forEach(m => { const y = plane(m); for (let k = 0; k < HOLD; k++) out.push(Buffer.from("FRAME\n"), y, chroma); });
  fs.writeFileSync(file, Buffer.concat(out));
  const cam = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-file-for-fake-video-capture=" + file] });
  try {
    const { ctx, p } = await openIn(cam, 1366, 768, "builder.html#/roster");
    await ctx.grantPermissions(["camera"], { origin: base.replace(/\/$/, "") }).catch(() => {});
    ok(await p.$$eval("#rsList .rs-res", e => e.length) === 0, "the second browser starts with nobody saved");
    await p.evaluate(() => { document.getElementById("rsQr").open = true; }); await p.click("#rsQrRead");
    await p.waitForSelector("#qhPassForm:not([hidden])", { timeout: 40000 }).catch(() => {});
    const st = await p.textContent("#qhStatus"), ticks = await p.$$eval("#qhTicks li.is-read", e => e.length);
    ok(/All \d+ codes read/.test(st) && ticks === frames.length, `its camera reads every code from the video (${ticks} of ${frames.length}: "${st}")`);
    ok(await p.$eval("#qhVideo", v => v.hidden && !(v.srcObject && v.srcObject.active)), "and the camera is turned off once they are all read");
    await p.fill("#qhPass", "not the right passphrase"); await p.click('#qhPassForm button[type="submit"]'); await p.waitForTimeout(2500);
    ok(/does not open/.test(await p.textContent("#qhStatus")), "a wrong passphrase is refused in plain words");
    await p.fill("#qhPass", PASS); await p.click('#qhPassForm button[type="submit"]'); await p.waitForTimeout(3000);
    ok(/1 added/.test(await p.textContent("#qhStatus")) && /1 added/.test(await p.textContent("#rsQrMsg")), `the resident is added ("${(await p.textContent("#qhStatus")).trim()}")`);
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    const saved = await p.evaluate(() => JSON.parse(window.CogniSecureStore.storage.getItem("cognicopia_resident_res-dot") || "null"));
    ok(saved && saved.tier1_core.preferredName === "Dorothy Example" && /Dorothy Example/.test(await p.textContent("#rsList")), "and is in the second browser's roster, with her name");
    await ctx.close();
  } finally { await cam.close(); }
}
srv.close();
fs.rmSync(tmp, { recursive: true, force: true });
ok(foreign.length === 0, "nothing is requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 2).join(", ") : ""));
ok(errors.length === 0, "no script errors" + (errors.length ? ": " + [...new Set(errors)].slice(0, 3).join("; ") : ""));

console.log(problems.length ? `QR handoff check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `QR handoff check passed: ${passed} checks in a real browser (one resident as a handful of locked codes with no readable name and no photo; each code read back by the saved reader; gathered in any order and opened with the passphrase; the loop on the roster, under three a second, with Pause; a stand-in camera reading a video of the codes and adding the resident; no camera said plainly; 52 px and readable by day and in Night Shift; nothing leaving the page. Not proved: a real iPad camera.)`);
process.exit(problems.length ? 1 : 0);
