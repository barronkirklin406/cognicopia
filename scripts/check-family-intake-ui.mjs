#!/usr/bin/env node
/* =====================================================================
   The family intake form on the profile page (js/familyIntake.js), in a real browser.

     paper      "Print a blank form" makes ONE US Letter page, pure black on white, every question on it, writing lines 3 pt thick, type at 16 pt
                or more (the page is read back with PyMuPDF)
     locked     the family's answers are saved as a LOCKED file by default: a passphrase of at least 10 characters typed twice is required (a
                short one and two that differ are refused in plain words); the file holds none of the words typed
     plain      the plain file is a labelled second choice: its button stays off until the box saying anyone holding it can read it is ticked;
                it does hold the words
     arrive     staff open the family file on another computer: a wrong passphrase is refused in plain words, the right one adds a NEW resident
                (never a copy of an existing one) marked as written by a family, with name, year, town, work, loves, comforts, topics to avoid,
                people (a pet is known as a pet) and the story; a plain file opens without a passphrase
     codes      the same answers show as a loop of QR codes and come back through the collector with the passphrase, not without it
     private    nothing the family types is in the browser's storage before it is saved to a file; nothing is requested from outside
     fingers    52 px and 7:1 by day and in Night Shift, at 1366 x 768 and 390 x 844
   Made-up people only. Needs Playwright (and PyMuPDF for the paper). Run: node scripts/check-family-intake-ui.mjs
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0; const notes = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-fam-"));
const PASS = "blue heron morning 2026";
const A = { name: "Walter", born: "1936", town: "Scobey, Montana", work: "Dairy farmer", loves: "fishing, playing cards", song: "You Are My Sunshine", dish: "Biscuits and gravy", comfort: "a quilt, humming", avoid: "storms, the war", people: "Ruth, daughter\nSpot, dog", story: "He milked every morning at five and sang to the cows." };

async function open(w, h, night) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(n => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); if (n) localStorage.setItem("cognicopia_night_shift", "1"); } catch (e) { /* ignore */ } }, !!night);
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + "profile.html", { waitUntil: "load" }); await p.waitForTimeout(1500);
  await p.waitForFunction(() => !!window.CogniFamilyIntake && !!document.querySelector("#famOpenForm"), null, { timeout: 10000 });
  return { ctx, p };
}
const fill = async p => { for (const [k, v] of Object.entries(A)) await p.fill("#famQ_" + k, v); };
const download = async (p, sel) => { const [d] = await Promise.all([p.waitForEvent("download", { timeout: 30000 }), p.click(sel)]); const f = path.join(tmp, d.suggestedFilename()); await d.saveAs(f); return { file: f, text: fs.readFileSync(f, "utf8"), name: d.suggestedFilename() }; };
const PY = `
import sys, json
try:
    import pymupdf as fitz
except Exception:
    try:
        import fitz
    except Exception:
        print(json.dumps({"missing": True})); sys.exit(0)
doc = fitz.open(sys.argv[1]); pages = []
for pg in doc:
    d = pg.get_text("dict"); sizes = []; colors = set()
    for b in d["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                if s["text"].strip(): sizes.append(round(s["size"], 1)); colors.add(s["color"])
    thin = []
    for dr in pg.get_drawings():
        r = dr["rect"]; h = min(r.width, r.height)
        if h > 0 and h < 2.9 and max(r.width, r.height) > 100: thin.append(round(h, 2))
    pages.append({"text": pg.get_text(), "minsize": min(sizes) if sizes else 0, "colors": sorted(colors), "thin": thin, "w": pg.rect.width, "h": pg.rect.height})
print(json.dumps(pages))
`;
const measure = (p, sel) => p.evaluate(s => {
  const lum = c => { const m = c.match(/[\d.]+/g); const [r, g, b] = m.slice(0, 3).map(v => { v = v / 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor, m = c.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > .5)) return c; } return "rgb(255,255,255)"; };
  const box = document.querySelector(s), small = [], low = [];
  if (!box) return { small: ["missing " + s], low };
  box.querySelectorAll("button, summary, input:not([type=checkbox]), textarea").forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.height && r.height < 52) small.push(`${el.tagName} ${Math.round(r.width)}x${Math.round(r.height)} ${(el.id || el.textContent || "").trim().slice(0, 18)}`); });
  box.querySelectorAll("*").forEach(el => { if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return; const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const a = lum(getComputedStyle(el).color), b = lum(bgOf(el)), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05); if (ratio < 7) low.push(`${ratio.toFixed(2)} "${el.textContent.trim().slice(0, 20)}"`); });
  return { small, low };
}, sel);

try {
  /* ---------- the paper ---------- */
  const fam = await open(1366, 900);
  let p = fam.p;
  ok(await p.$eval("#rapFamH", e => /family member fills this in/i.test(e.textContent)), "the profile page has a section \"A family member fills this in\"");
  await p.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await p.click("#famPrint"); await p.waitForTimeout(400);
  ok(await p.evaluate(() => window.__printed === 1), "Print a blank form asks the browser to print");
  await p.emulateMedia({ media: "print" });
  const pdf = path.join(tmp, "blank.pdf"); fs.writeFileSync(pdf, await p.pdf({ format: "Letter", printBackground: true, margin: { top: "0.5in", bottom: "0.5in", left: "0.75in", right: "0.5in" } }));
  await p.emulateMedia({ media: "screen" });
  let back = null; try { back = JSON.parse(execFileSync("python3", ["-I", "-c", PY, pdf, ""], { encoding: "utf8" }).replace(/^\s+|\s+$/g, "")); } catch (e) { notes.push("PyMuPDF could not read the form here"); }
  if (!back || back.missing) notes.push("PyMuPDF is not installed for python3: the blank form was not read back");
  else {
    const qs = await p.evaluate(() => window.CogniFamilyIntake.QUESTIONS.map(q => q.label));
    ok(back.length === 1, `the blank form is one page (${back.length})`);
    ok(qs.every(q => back[0].text.replace(/\s+/g, " ").includes(q.replace(/\s+/g, " "))), "every question is on it");
    ok(back[0].colors.every(c => c === 0), `pure black type (${back[0].colors})`);
    ok(back[0].minsize >= 16, `type 16 pt or more (smallest ${back[0].minsize})`);
    ok(back[0].thin.length === 0, `writing lines at least 3 pt thick (${back[0].thin})`);
    ok(/Tell us about someone you love/.test(back[0].text), "it has a plain title as real text");
  }
  /* ---------- fill it in ---------- */
  await p.click("#famOpenForm"); await p.waitForSelector("#cgFamDlg[open]");
  ok(await p.evaluate(() => document.activeElement && document.activeElement.id === "cgFamH"), "focus moves into the form");
  await fill(p);
  const stored = await p.evaluate(() => { const hits = []; for (const st of [localStorage, sessionStorage]) for (let i = 0; i < st.length; i++) if (/Walter|Scobey|storms/.test(st.getItem(st.key(i)) || "")) hits.push(st.key(i)); return hits; });
  ok(stored.length === 0, `nothing typed is in the browser's storage (${stored})`);
  /* the passphrase rules */
  await p.fill("#famPass", "short"); await p.fill("#famPass2", "short"); await p.click('[data-fam="lock"]'); await p.waitForTimeout(300);
  ok(/10|characters|passphrase/i.test(await p.textContent("#famMsg")), `a short passphrase is refused in plain words (${await p.textContent("#famMsg")})`);
  await p.fill("#famPass", PASS); await p.fill("#famPass2", PASS + "x"); await p.click('[data-fam="lock"]'); await p.waitForTimeout(300);
  ok(/not the same/i.test(await p.textContent("#famMsg")), "two passphrases that differ are refused");
  await p.fill("#famPass2", PASS);
  const locked = await download(p, '[data-fam="lock"]');
  ok(/\.cognicopia$/.test(locked.name) && !/Walter/i.test(locked.name), `the locked file has no name in its filename (${locked.name})`);
  ok(!/Walter|Scobey|storms|Spot|fishing|sunshine/i.test(locked.text), "the locked file holds none of the words typed");
  ok(/AES-GCM/.test(locked.text) && /PBKDF2/.test(locked.text), "it is locked with the roster's own lock (AES-GCM, PBKDF2)");
  ok(/saved a locked file/i.test(await p.textContent("#famMsg")), "the screen says it saved a locked file and that the passphrase is not kept");
  /* the plain file */
  ok(await p.$eval('[data-fam="plain"]', b => b.disabled), "the plain file's button is off until the warning is ticked");
  await p.evaluate(() => { document.querySelector(".cg-fam-plain").open = true; });
  ok(/anyone who holds it/i.test(await p.textContent(".cg-fam-warn")), "the plain file says anyone holding it can read it");
  await p.check("#famPlainOk"); ok(!(await p.$eval('[data-fam="plain"]', b => b.disabled)), "ticking the box turns the plain button on");
  const plain = await download(p, '[data-fam="plain"]');
  ok(/Walter/.test(plain.text) && /Scobey/.test(plain.text), "the plain file does hold the words");
  /* the codes */
  await p.click('[data-fam="codes"]'); await p.waitForSelector("#qhSend[open] #qhCode svg", { timeout: 15000 });
  const cnt = await p.textContent("#qhCount"); ok(/Code 1 of \d+/.test(cnt), `the codes show in a loop (${cnt})`);
  await p.click('#qhSend [data-qh="close"]');
  const rt = await p.evaluate(async ({ a, pass }) => {
    const m = await import("/js/qrHandoff.js"), prof = window.CogniFamilyIntake.buildProfile(a, "Ann");
    const packed = await m.pack([prof], pass, "Family form"), col = new m.Collector(); const order = packed.frames.map((f, i) => [Math.sin(i * 7.3), f]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
    let last; order.concat(order.slice(0, 2)).forEach(f => { last = col.add(f); });
    let wrong = ""; try { await m.open(col.text(), "not the right passphrase 1"); } catch (e) { wrong = e.message; }
    const got = await m.open(col.text(), pass);
    return { n: packed.frames.length, done: last.done, wrong, name: got.profiles[0].tier1_core.preferredName, review: got.profiles[0].meta.needsReview, readable: packed.frames.some(f => /Walter/.test(f)) };
  }, { a: A, pass: PASS });
  ok(rt.n >= 2 && rt.done && rt.name === "Walter" && rt.review === true, `the codes come back through the collector as the same person, marked for review (${JSON.stringify(rt)})`);
  ok(rt.wrong === "passphrase" && !rt.readable, `the codes need the passphrase and hold no readable name (${rt.wrong})`);
  await fam.ctx.close();

  /* ---------- the staff open it on another computer ---------- */
  const staff = await open(1366, 900); p = staff.p;
  await p.setInputFiles("#famFile", locked.file); await p.fill("#famOpenPass", "wrong horse battery 99"); await p.click("#famAdd"); await p.waitForTimeout(1500);
  ok(/does not open this file/i.test(await p.textContent("#famOpenMsg")), `a wrong passphrase is refused in plain words (${await p.textContent("#famOpenMsg")})`);
  await p.setInputFiles("#famFile", locked.file); await p.fill("#famOpenPass", PASS); await p.click("#famAdd"); await p.waitForFunction(() => { const t = document.querySelector("#famOpenMsg").textContent; return t && !/^Opening|does not open this file/.test(t); }, null, { timeout: 20000 }); await p.waitForTimeout(300); if (!/Added Walter/.test(await p.textContent("#famOpenMsg"))) problems.push("opening the locked file said: " + await p.textContent("#famOpenMsg"));
  ok(/look it over/i.test(await p.textContent("#famOpenMsg")), "it says a family wrote it and staff should look it over");
  ok(await p.$eval("#rapResList", e => /Walter/.test(e.textContent)), "Walter is in the saved residents list");
  const rec = await p.evaluate(() => (() => { const S = window.CogniSecureStore.storage, out = []; for (let i = 0; i < S.length; i++) { const k = S.key(i); if (k.indexOf("cognicopia_resident_res-fam") === 0) out.push(JSON.parse(S.getItem(k))); } return out; })());
  if (!rec.length) problems.push("no new resident was found after opening; the message said: " + await p.textContent("#famOpenMsg"));
  const w = rec[0] || { meta: {}, tier1_core: { topicsToAvoid: {}, occupation: {}, topHobbies: [] }, tier2_enrichment: { hometown: {}, music: {} }, tier3_deep: { people: [], comforts: [], signatureDish: {} } };
  ok(rec.length === 1 && w.tier1_core.preferredName === "Walter" && w.tier2_enrichment.birthYear === 1936 && /Scobey/.test(w.tier2_enrichment.hometown.place), "the new resident has the name, year and town");
  ok(w.meta.needsReview === true && /family/i.test(w.meta.completedBy.label), "it is marked as written by a family, to be looked over");
  ok(/storms/.test(w.tier1_core.topicsToAvoid.other) && w.tier1_core.occupation.label === "Dairy farmer" && w.tier1_core.topHobbies.length === 2, "work, loves and the topics to avoid are kept");
  ok(w.tier3_deep.people.length === 2 && w.tier3_deep.people.find(x => x.name === "Spot").isPet === true && w.tier3_deep.people.find(x => x.name === "Ruth").isPet === false && /sang to the cows/.test(w.tier3_deep.notes), "people (the dog is a pet) and the story are kept");
  ok(w.tier3_deep.comforts.length === 2 && /Biscuits/.test(w.tier3_deep.signatureDish.name) && /Sunshine/.test(w.tier2_enrichment.music.favoriteSong), "comforts, dish and song are kept");
  await p.setInputFiles("#famFile", plain.file); await p.fill("#famOpenPass", ""); await p.click("#famAdd"); await p.waitForTimeout(2000);
  const again = await p.evaluate(() => (() => { const S = window.CogniSecureStore.storage, out = []; for (let i = 0; i < S.length; i++) { const k = S.key(i); if (k.indexOf("cognicopia_resident_res-fam") === 0) out.push(JSON.parse(S.getItem(k))); } return out; })().length);
  ok(again === 2, `a plain file opens without a passphrase, as a second new person and never over the first (${again})`);
  await p.setInputFiles("#famFile", path.join(tmp, "blank.pdf")); await p.click("#famAdd"); await p.waitForTimeout(800);
  ok(/not a Cognicopia family file/i.test(await p.textContent("#famOpenMsg")), "a file that is not a family file is refused in plain words");
  await staff.ctx.close();

  /* ---------- fingers and eyes ---------- */
  for (const [vw, vh, night] of [[1366, 768, false], [390, 844, false], [1366, 768, true], [390, 844, true]]) {
    const c = await open(vw, vh, night); await c.p.evaluate(() => { document.querySelector("#rapFamily").scrollIntoView(); });
    const m1 = await measure(c.p, "#rapFamily");
    await c.p.click("#famOpenForm"); await c.p.waitForSelector("#cgFamDlg[open]"); await c.p.evaluate(() => { document.querySelector(".cg-fam-plain").open = true; });
    const m2 = await measure(c.p, "#cgFamDlg"), side = await c.p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    const label = `${vw}${night ? " night" : ""}`;
    ok(!m1.small.length && !m1.low.length, `${label}: the section reads at 7:1 and its controls are 52 px${m1.small.concat(m1.low).length ? " (" + m1.small.concat(m1.low).slice(0, 4).join(", ") + ")" : ""}`);
    ok(!m2.small.length && !m2.low.length && !side, `${label}: the form reads at 7:1 and its controls are 52 px, no sideways scroll${m2.small.concat(m2.low).length ? " (" + m2.small.concat(m2.low).slice(0, 4).join(", ") + ")" : ""}`);
    await c.ctx.close();
  }
} finally { await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); }

ok(!foreign.length, `nothing requested from outside the page: ${foreign.slice(0, 3).join(", ")}`);
ok(!errors.length, `no script errors: ${errors.slice(0, 3).join(" | ")}`);
console.log(problems.length ? `family intake check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 40).join("\n  - ") : `family intake check passed: ${passed} checks` + (notes.length ? "\n  note: " + notes.join("; ") : ""));
process.exit(problems.length ? 1 : 0);
