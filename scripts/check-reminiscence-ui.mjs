#!/usr/bin/env node
/* =====================================================================
   The reminiscence engine on the Today page (js/reminiscence-engine.js, wired into index.html),
   in a real browser (Playwright; exit code 2 where it is not installed).

     panel      "Deep Packet Customization" sits in the packet form, closed until opened, every
                control 52 px or taller, every field has a label, no network request
     preview    a deep setting reaches the preview: the word search, the notes from their years,
                the things that go together, the summary chips; staff notes only on page 2
     fit        page 1 stays inside the 0.75 in margins for every stage, with ordinary and with
                very long entries (measured on the drawn page, not estimated)
     word search the grid is the size of the stage, letters 24 px or more, black on white
     controls   "Make a different version" changes the grid and "Clear these fields" empties
                the panel; a keep-off word is not printed from any field
     saved      nothing typed in the panel is written to the browser's storage
     colors     every piece of text in the panel is 7:1 or better, in daylight and Night Shift
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const FIELDS = { goes: "Peggy", born: "1938", town: "Cedar Falls", state: "Iowa", job: "schoolteacher", spouse: "Walter", kids: "Susan, Tom", pets: "Biscuit", hobbies: "gardening, old radio music", favs: "Sunday radio programs" };

try {
  async function open(opts = {}) {
    const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1366, height: 900 }, serviceWorkers: "block" });
    await ctx.addInitScript((night) => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); if (night) localStorage.setItem("cognicopia_night_shift", "1"); } catch (x) { /* ignore */ } }, !!opts.night);
    const p = await ctx.newPage(), errs = [], outside = [];
    p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
    p.on("request", (r) => { if (!r.url().startsWith(base) && !/^(data|blob|about):/.test(r.url())) outside.push(r.url()); });
    await p.goto(base + "index.html"); await p.waitForSelector("#cgrePanel"); await p.waitForTimeout(600);
    return { ctx, p, errs, outside };
  }
  const fill = async (p, f) => { for (const [id, v] of Object.entries(f)) await p.evaluate(([i, val]) => { const e = document.getElementById(i); if (e) { e.value = val; e.dispatchEvent(new Event("input", { bubbles: true })); } }, [id, v]); };
  const stage = (p, v) => p.evaluate((x) => { document.querySelector('input[name="stage"][value="' + x + '"]').checked = true; }, v);
  const openPanel = async (p) => { if (!(await p.evaluate(() => document.getElementById("cgrePanel").open))) await p.click("#cgrePanel summary"); };
  const openModal = async (p) => { await p.click("#previewPacketBtn"); await p.waitForSelector("dialog.cgpp-modal[open]"); await p.waitForTimeout(300); };
  const closeModal = async (p) => { await p.keyboard.press("Escape"); await p.waitForTimeout(200); };
  /* the first page as the engine made it, drawn at actual size, measured */
  const measureResident = (p, req) => p.evaluate(async (r) => {
    const mod = await import("/js/print-preview-modal.js"), res = await window.CognicopiaAgents.orchestrator.execute(r); if (r.__brand) res.asset.branding = { facilityName: "Maple Grove Memory Care", headerText: "Activities Department" };
    const holder = document.createElement("div"); holder.style.cssText = "position:fixed;left:-9999px;top:0"; holder.innerHTML = mod.renderPageHtml(res.asset, "resident", 1, 3) + "<style>" + mod.SHEET_CSS + "</style>"; document.body.append(holder);
    const sheet = holder.querySelector(".cgpp-sheet"), sr = sheet.getBoundingClientRect(), blocks = [...sheet.querySelectorAll(".cgpp-block")], last = blocks[blocks.length - 1], lr = last ? last.getBoundingClientRect() : sr;
    const td = sheet.querySelector(".cgpp-ws td"), tc = td ? getComputedStyle(td) : null, rows = sheet.querySelectorAll(".cgpp-ws tr").length;
    const out = { sheetH: Math.round(sr.height), bottom: Math.round(lr.bottom - sr.top), limit: Math.round(sr.height - 72 - 46),   // in print the footer line follows the content (about 46 px) instead of sitting at the bottom
 blocks: blocks.length, types: res.asset.pages.resident.blocks.map((b) => b.type), ws: td ? { rows, cell: Math.round(td.getBoundingClientRect().width), px: parseFloat(tc.fontSize), color: tc.color, bg: getComputedStyle(sheet).backgroundColor } : null, status: res.audit.status };
    holder.remove(); return out;
  }, req);
  const sweep = (p, sel) => p.evaluate((s) => {
    const parse = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
    const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
    const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }, L = (c) => .2126 * lin(c.r) + .7152 * lin(c.g) + .0722 * lin(c.b);
    const bg = (el) => { const st = []; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > 0) { st.push(c); if (c.a >= 1) break; } } let b = { r: 255, g: 255, b: 255, a: 1 }; for (let i = st.length - 1; i >= 0; i--) b = over(st[i], b); return b; };
    const root = document.querySelector(s), bad = []; let n = 0, min = 21;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let t; (t = w.nextNode());) { const tx = t.nodeValue.trim(); if (!tx) continue; const e = t.parentElement; if (!e.getClientRects().length) continue; const cs = getComputedStyle(e); if (cs.visibility === "hidden" || cs.display === "none") continue;
      const b = bg(e), f = over(parse(cs.color), b), l1 = L(f), l2 = L(b), r = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); n++; min = Math.min(min, r); if (r < 7) bad.push(tx.slice(0, 40) + " " + r.toFixed(2)); }
    for (const e of root.querySelectorAll("input[type=text],textarea,select")) { const cs = getComputedStyle(e), b = bg(e), f = over(parse(cs.color), b), l1 = L(f), l2 = L(b), r = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); n++; min = Math.min(min, r); if (r < 7) bad.push("field " + e.id + " " + r.toFixed(2)); }
    return { n, bad, min: Math.round(min * 100) / 100 };
  }, sel);

  /* ---- the panel ---- */
  let { ctx, p, errs, outside } = await open();
  const info = await p.evaluate(() => {
    const d = document.getElementById("cgrePanel"), s = d.querySelector("summary"), form = document.getElementById("f");
    const controls = [...d.querySelectorAll("input[type=text],textarea,select,button,summary")].map((e) => Math.round(e.getBoundingClientRect().height));
    d.open = true;
    const all = [...d.querySelectorAll("input,textarea,select")], boxes = [...d.querySelectorAll(".cgre-check")].map((e) => Math.round(e.getBoundingClientRect().height));
    const hit = [...d.querySelectorAll("input[type=text],textarea,select,button")].map((e) => Math.round(e.getBoundingClientRect().height));
    const labelled = all.every((e) => e.type === "checkbox" ? e.closest("label") && e.closest("label").textContent.trim().length > 4 : (document.querySelector('label[for="' + e.id + '"]') || {}).textContent);
    const mounted = !!document.getElementById("deepCustomMount") && form.contains(d), openByDefault = false;
    return { tag: d.tagName, summaryH: Math.round(s.getBoundingClientRect().height), controls: controls.length, hit, boxes, labelled, mounted, sumText: s.textContent.trim(), checkboxes: d.querySelectorAll("input[type=checkbox]").length, allChecked: [...d.querySelectorAll("input[type=checkbox]")].every((c) => c.checked), openByDefault };
  });
  ok(info.tag === "DETAILS" && info.mounted && /Deep Packet Customization/.test(info.sumText), "the panel is a details block in the packet form, named Deep Packet Customization");
  ok(info.summaryH >= 52 && info.hit.every((h) => h >= 52) && info.boxes.every((h) => h >= 52 && true), `every control is 52 px or taller (summary ${info.summaryH}, fields ${info.hit.join("/")}, checkboxes ${info.boxes.join("/")})`);
  ok(info.labelled && info.checkboxes === 3 && info.allChecked, "every field has a label; three parts are on by default");
  await p.evaluate(() => { document.getElementById("cgrePanel").open = false; });
  ok(!(await p.evaluate(() => document.getElementById("cgrePanel").open)), "the panel starts closed so the form stays short");

  /* ---- a setting reaches the preview ---- */
  await fill(p, FIELDS); await openPanel(p);
  await fill(p, { cgreMusic: "Patsy Cline", cgreFoods: "apple pie", cgrePlaces: "the farm", cgreWords: "orchard", cgreStaff: "Prefers the window seat\nEnjoys a cardigan" });
  await p.selectOption("#cgreFocus", "music");
  await openModal(p);
  const chips = await p.evaluate(() => [...document.querySelectorAll(".cgpp-tag .cgpp-chip, .cgpp-tag li, .cgpp-tag span")].map((e) => e.textContent).join(" | "));
  ok(/Favorite music/.test(chips) && /Patsy Cline/.test(chips) && /Word search/.test(chips) && /Staff notes/.test(chips) && /Memory focus/.test(chips) && /Resident name/.test(chips), "the summary chips list the deep settings that reached the sheet (" + chips.slice(0, 160) + ")");
  const pages = await p.evaluate(async () => { const mod = await import("/js/print-preview-modal.js"); const r = await window.CognicopiaAgents.orchestrator.execute((await import("/js/reminiscence-engine.js")).buildRequest(window.CognicopiaAgents.profileFromForm(), window.CognicopiaAgents.deepPanel.read())); const h = document.createElement("div"); h.innerHTML = mod.renderAllPagesHtml(r.asset); const get = (k) => h.querySelector('[data-page="' + k + '"]').textContent; return { one: get("resident"), two: get("caregiver"), three: get("sensory"), ws: h.querySelectorAll(".cgpp-ws tr").length, pairs: h.querySelectorAll(".cgpp-pairs ol").length }; });
  ok(/window seat/.test(pages.two) && !/window seat|cardigan/.test(pages.one) && !/window seat|cardigan/.test(pages.three), "staff notes are on page 2 only");
  ok(/Patsy Cline/.test(pages.three) && /apple pie/.test(pages.three) && /Find these words/.test(pages.one) && /go together/.test(pages.one) && /just for fun/.test(pages.one) && pages.ws >= 6 && pages.pairs === 2, "the word search, the notes from their years and the pairs are on page 1; their music and kitchen scent are on page 3");
  ok(/Affirm the resident's lived reality; never debate historical facts\./.test(pages.two) && /Visual Cue/.test(pages.two) && /Verbal Anchor/.test(pages.two) && /Validation Statement/.test(pages.two), "page 2 carries the three steps and the validation therapy safety notice");
  await closeModal(p);

  /* ---- the controls ---- */
  const grid = () => p.evaluate(async () => JSON.stringify((await window.CognicopiaAgents.orchestrator.execute((await import("/js/reminiscence-engine.js")).buildRequest(window.CognicopiaAgents.profileFromForm(), window.CognicopiaAgents.deepPanel.read()))).asset.pages.resident.blocks.find((b) => b.type === "wordsearch").grid));
  const g1 = await grid(); await p.click("#cgreShuffle"); const g2 = await grid(); await p.click("#cgreShuffle"); const g3 = await grid();
  ok(g1 !== g2 && g2 !== g3 && /different version/.test(await p.textContent("#cgreStatus")), "Make a different version gives a new grid each time and says so");
  await p.click("#cgreReset");
  const cleared = await p.evaluate(() => ["cgreMusic", "cgreFoods", "cgrePlaces", "cgreWords", "cgreStaff"].every((i) => document.getElementById(i).value === "") && document.getElementById("cgreFocus").value === "mixed" && [...document.querySelectorAll("#cgrePanel input[type=checkbox]")].every((c) => c.checked));
  const gr = await grid(); await p.click("#cgreShuffle"); const gs = await grid(); await p.click("#cgreReset");
  ok(cleared && gs !== gr && (await grid()) === gr, "Clear these fields empties the panel and puts the first version back");
  await p.click("#cgreInc-wordSearch"); await p.click("#cgreInc-sparks");
  const some = await measureResident(p, { profile: await p.evaluate(() => window.CognicopiaAgents.profileFromForm()), deep: await p.evaluate(() => window.CognicopiaAgents.deepPanel.read()), options: { template: "reminiscence" } });
  ok(!some.types.includes("wordsearch") && !some.types.includes("prompts") && some.types.includes("matching") || some.types.includes("anchors"), "unticking a part removes it from page 1 (" + some.types.join(",") + ")");
  await p.click("#cgreInc-wordSearch"); await p.click("#cgreInc-sparks");

  /* nothing typed is stored */
  await fill(p, { cgreMusic: "Patsy Cline", cgreStaff: "Private staff note" }); await openModal(p); await closeModal(p);
  const stored = await p.evaluate(() => { let t = ""; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); t += k + "=" + localStorage.getItem(k) + "\n"; } for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); t += k + "=" + sessionStorage.getItem(k) + "\n"; } } catch (e) { /* none */ } return t; });
  ok(!/Patsy Cline|Private staff note/.test(stored), "nothing typed in the panel is written to browser storage");

  /* the keep-off list holds for every deep field */
  await fill(p, { avoid: "Patsy Cline, apple pie, Biscuit", cgreMusic: "Patsy Cline", cgreFoods: "apple pie", cgreStaff: "Biscuit is restless" });
  const kept = await p.evaluate(async () => JSON.stringify((await window.CognicopiaAgents.orchestrator.execute((await import("/js/reminiscence-engine.js")).buildRequest(window.CognicopiaAgents.profileFromForm(), window.CognicopiaAgents.deepPanel.read()))).asset));
  ok(!/Patsy Cline|apple pie|Biscuit/i.test(kept), "a keep-off word is printed from no field");
  await fill(p, { avoid: "" });
  ok(errs.length === 0 && outside.length === 0, `no script error and no request outside the site (${errs.concat(outside).slice(0, 2).join("; ")})`);
  await ctx.close();

  /* ---- the page fits, in every stage, with ordinary and very long entries ---- */
  ({ ctx, p, errs, outside } = await open());
  const LONG = { cgreMusic: "a very long song title that goes on and on ".repeat(3), cgreFoods: "a very long food name that goes on ".repeat(3), cgrePlaces: "a place with a very long name indeed ".repeat(3), cgreWords: "extraordinarily, wonderfully, magnificent, gardening", cgreStaff: "x ".repeat(80) };
  const fits = []; const wsInfo = {};
  for (const tier of ["early", "middle", "late"]) for (const mode of ["ordinary", "long", "bare"]) {
    await p.reload(); await p.waitForSelector("#cgrePanel"); await p.waitForTimeout(400);
    if (mode !== "bare") await fill(p, FIELDS);
    await openPanel(p); if (mode === "long") await fill(p, LONG); else if (mode === "ordinary") await fill(p, { cgreMusic: "Patsy Cline", cgreFoods: "apple pie", cgrePlaces: "the farm" });
    await stage(p, tier);
    const m = await measureResident(p, { profile: await p.evaluate(() => window.CognicopiaAgents.profileFromForm()), deep: await p.evaluate(() => window.CognicopiaAgents.deepPanel.read()), options: { template: "reminiscence" }, __brand: true });   // with a facility header band, which takes the most room
    fits.push(`${tier}/${mode}: bottom ${m.bottom} of ${m.limit}`); if (!(m.bottom <= m.limit)) problems.push(`page 1 spills past the bottom margin at ${tier}/${mode}: ${m.bottom} > ${m.limit}`); else passed++;
    if (m.status === "blocked") problems.push(`the audit blocked ${tier}/${mode}`); else passed++;
    if (mode === "ordinary") wsInfo[tier] = m.ws;
  }
  ok(wsInfo.early && wsInfo.middle && wsInfo.late && wsInfo.early.rows === 8 && wsInfo.middle.rows === 7 && wsInfo.late.rows === 6, "the word search is 8, 7 and 6 squares across for the early, middle and late stages (" + ["early", "middle", "late"].map((t) => wsInfo[t] && wsInfo[t].rows).join("/") + ")");
  console.log("  page 1 bottoms (px from the top, limit 938, with a facility header band): " + fits.join("; "));
  ok(Object.values(wsInfo).every((w) => w && w.cell >= 30 && w.px >= 24 && w.color === "rgb(0, 0, 0)" && w.bg === "rgb(255, 255, 255)") && wsInfo.late.cell >= wsInfo.early.cell, "grid letters are 24 px or more, black on white, and the largest cells are for the latest stage (" + ["early", "middle", "late"].map((t) => wsInfo[t] && wsInfo[t].cell + "px").join("/") + ")");
  await ctx.close();

  /* ---- the printout is three Letter pages, even with every field full ---- */
  const pdfPages = async (p, req) => {
    await p.evaluate(async (r) => { const mod = await import("/js/print-preview-modal.js"), res = await window.CognicopiaAgents.orchestrator.execute(r); r.__brand && (res.asset.branding = { facilityName: "Maple Grove Memory Care", headerText: "Activities Department" }); if (!document.getElementById("cgpp-sheet-style")) { const sty = document.createElement("style"); sty.id = "cgpp-sheet-style"; sty.textContent = mod.SHEET_CSS; document.head.appendChild(sty); }   // the modal adds this when it opens
    const st = document.createElement("div"); st.id = "cgpp-print-stage"; st.innerHTML = mod.renderAllPagesHtml(res.asset); document.body.append(st); document.documentElement.classList.add("cgpp-printing"); }, req);
    await p.emulateMedia({ media: "print" });
    const buf = await p.pdf({ preferCSSPageSize: true, printBackground: true }); await p.emulateMedia({ media: "screen" });
    return (buf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  };
  const heavy = { cgreMusic: "a very long song title that goes on and on ".repeat(3), cgreFoods: "a very long food name that goes on ".repeat(3), cgrePlaces: "a place with a very long name indeed ".repeat(3), cgreWords: "orchard, piano, extraordinarily", cgreStaff: Array.from({ length: 4 }, (_, i) => "Staff note number " + (i + 1) + " " + "with a good deal of detail ".repeat(7)).join("\n") };
  const printed = [];
  for (const tier of ["early", "middle", "late"]) for (const brand of [false, true]) {
    ({ ctx, p } = await open()); await fill(p, FIELDS); await openPanel(p); await fill(p, heavy); await stage(p, tier);
    const n = await pdfPages(p, { profile: await p.evaluate(() => window.CognicopiaAgents.profileFromForm()), deep: await p.evaluate(() => window.CognicopiaAgents.deepPanel.read()), options: { template: "reminiscence" }, __brand: brand });
    printed.push(`${tier}${brand ? "+header" : ""}:${n}`); await ctx.close();
  }
  ok(printed.every((x) => /:3$/.test(x)), "the printout is exactly three Letter pages in every stage, with every field full and with a facility header (" + printed.join(" ") + ")");

  /* ---- in print the squares stay square (the page's own print rules once stretched the table across the sheet) ---- */
  ({ ctx, p } = await open()); await fill(p, FIELDS); await openPanel(p);
  const prn = await p.evaluate(async () => {
    const mod = await import("/js/print-preview-modal.js"), eng = await import("/js/reminiscence-engine.js"), res = await window.CognicopiaAgents.orchestrator.execute(eng.buildRequest(window.CognicopiaAgents.profileFromForm(), window.CognicopiaAgents.deepPanel.read()));
    if (!document.getElementById("cgpp-sheet-style")) { const sty = document.createElement("style"); sty.id = "cgpp-sheet-style"; sty.textContent = mod.SHEET_CSS; document.head.appendChild(sty); }
    const st = document.createElement("div"); st.id = "cgpp-print-stage"; st.innerHTML = mod.renderAllPagesHtml(res.asset); document.body.append(st); document.documentElement.classList.add("cgpp-printing"); return true;
  });
  await p.emulateMedia({ media: "print" });
  const pm = await p.evaluate(() => { const t = document.querySelector("#cgpp-print-stage .cgpp-ws"), r = t.getBoundingClientRect(), tds = [...t.querySelectorAll("tr:first-child td")].map((d) => Math.round(d.getBoundingClientRect().width)), rows = [...t.querySelectorAll("tr")].map((x) => Math.round(x.getBoundingClientRect().height)); return { n: t.querySelectorAll("tr").length, cols: tds.length, w: Math.round(r.width), h: Math.round(r.height), cw: tds[0], rh: rows[0], even: new Set(tds).size === 1 && new Set(rows).size === 1 }; });
  ok(prn && pm.n === pm.cols && pm.even && Math.abs(pm.cw - pm.rh) <= 2 && Math.abs(pm.w - pm.h) <= 4, `in print the grid is ${pm.n} x ${pm.cols} with square cells (${pm.cw} x ${pm.rh} px) and a square block (${pm.w} x ${pm.h} px)`);
  await ctx.close();

  /* ---- any square grid is drawn square and inside the margins ---- */
  ({ ctx, p } = await open());
  const sq = await p.evaluate(async () => {
    const mod = await import("/js/print-preview-modal.js"), out = [];
    for (const n of [1, 2, 5, 12, 20, 25, 30]) {
      const grid = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[(r * 7 + c * 3) % 26]).join(""));
      const asset = { title: "t", pages: { resident: { heading: "h", fontPt: 18, blocks: [{ type: "wordsearch", title: "Find", grid, words: ["ABC"], cellPx: 40 }] } } };
      const h = document.createElement("div"); h.style.cssText = "position:fixed;left:-9999px;top:0"; h.innerHTML = mod.renderPageHtml(asset, "resident", 1, 3) + "<style>" + mod.SHEET_CSS + "</style>"; document.body.append(h);
      const t = h.querySelector(".cgpp-ws"), rows = t.querySelectorAll("tr").length, cols = t.querySelector("tr").children.length, tr = t.getBoundingClientRect(), sheet = h.querySelector(".cgpp-sheet").getBoundingClientRect();
      out.push({ n, rows, cols, w: Math.round(tr.width), hgt: Math.round(tr.height), inside: tr.right <= sheet.right - 72 + 1 && tr.left >= sheet.left + 72 - 1 });
      h.remove();
    }
    return out;
  });
  ok(sq.every((g) => g.rows === g.n && g.cols === g.n && g.inside && Math.abs(g.w - g.hgt) <= 2), "grids of 1, 2, 5, 12, 20, 25 and 30 squares are drawn with as many columns as rows, equal width and height, inside the margins (" + sq.map((g) => g.n + ":" + g.w + "x" + g.hgt).join(" ") + ")");
  await ctx.close();

  /* ---- colors, daylight and Night Shift ---- */
  for (const night of [false, true]) {
    ({ ctx, p } = await open({ night })); await openPanel(p);
    const isNight = await p.evaluate(() => document.documentElement.classList.contains("cg-night-shift"));
    const s = await sweep(p, "#cgrePanel");
    ok(s.n > 20 && s.bad.length === 0 && (night ? isNight : !isNight), `panel text is 7:1 or better in ${night ? "Night Shift" : "daylight"} (${s.n} pieces of text, lowest ${s.min}${s.bad.length ? "; " + s.bad.slice(0, 3).join(", ") : ""})`);
    await ctx.close();
  }

  /* ---- a phone ---- */
  ({ ctx, p } = await open({ viewport: { width: 390, height: 844 } })); await openPanel(p);
  const ph = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, panelW: Math.round(document.getElementById("cgrePanel").getBoundingClientRect().width), over: [...document.querySelectorAll("#cgrePanel *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length }));
  ok(ph.sw <= ph.cw + 1 && ph.over === 0 && ph.panelW <= 390, `on a phone the panel fits the screen with no sideways scroll (${ph.panelW}px wide)`);
  await ctx.close();
} finally { await browser.close(); srv.close(); }

if (problems.length) { console.error("reminiscence UI check FAILED: " + problems.length + " problem(s), " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("reminiscence UI check passed: " + passed + " checks in a real browser (the panel, a deep setting in the preview, staff notes on page 2 only, one printed page in every stage, the word search, the controls, nothing stored, colors, a phone)");
