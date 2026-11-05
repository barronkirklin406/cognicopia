#!/usr/bin/env node
/* =====================================================================
   The print preview modal (js/print-preview-modal.js, wired into index.html), in a real browser
   (Playwright; exit code 2 where it is not installed).

     button     "Preview Packet" beside "Make the packet", 52 px, opens the modal
     modal      a dialog with a name and a description, focus inside, page behind locked
     pages      three tabs (Resident Activity Sheet; Caregiver Facilitation Protocol & Daily
                Notes; Sensory Guidance) with arrow-key movement
     the sheet  816 x 1056 px at actual size (8.5 x 11 in), 72 px (0.75 in) margins, sans-serif,
                black on white, resident type 18 pt or more
     toner      a measured ink percentage for the page and the packet; black line art only
                is verified; the measurement is right on known shapes (0 %, 25 %, 100 %) and
                finds a gray fill
     summary    the personal details that reached the page (name, family, pets, career,
                hometown, era), and a keep-off-the-page topic is not on it
     controls   Close Preview, Adjust Parameters, Confirm & Print (52 px): Escape and the
                backdrop close, focus returns; printing draws three pages and counts one free
                packet; an used-up allowance opens the buy window instead; a blocked sheet cannot print
     safety     a name that is markup is shown as text and runs nothing
     paper      the printout is three Letter pages
     phone      full screen, no sideways scroll, big buttons
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const FIELDS = { first: "Margaret", goes: "Peggy", born: "1938", town: "Cedar Falls", state: "Iowa", job: "schoolteacher", spouse: "Walter", kids: "Susan, Tom", pets: "Biscuit", hobbies: "gardening, old radio music", favs: "Sunday radio programs", avoid: "" };

try {
  async function open(opts = {}) {
    const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1366, height: 900 }, serviceWorkers: "block", acceptDownloads: true });
    await ctx.addInitScript((night) => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); if (night) localStorage.setItem("cognicopia_night_shift", "1"); } catch (x) { /* ignore */ } window.__printed = 0; window.__rej = 0; addEventListener("unhandledrejection", () => window.__rej++); }, !!opts.night);
    const p = await ctx.newPage(), errs = [], outside = [];
    p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
    p.on("request", (r) => { if (!r.url().startsWith(base) && !/^(data|blob|about):/.test(r.url())) outside.push(r.url()); });
    await p.goto(base + "index.html"); await p.waitForSelector("#previewPacketBtn"); await p.waitForTimeout(700);
    await p.evaluate(() => { window.print = () => { const st = document.getElementById("cgpp-print-stage"); window.__printed++; window.__printStage = st ? { sheets: st.querySelectorAll(".cgpp-sheet").length, cls: document.documentElement.classList.contains("cgpp-printing") } : null; }; });
    return { ctx, p, errs, outside };
  }
  const fill = async (p, f = FIELDS) => { for (const [id, v] of Object.entries(f)) await p.evaluate(([i, val]) => { const e = document.getElementById(i); if (e) { e.value = val; e.dispatchEvent(new Event("input", { bubbles: true })); } }, [id, v]); };
  const openModal = async (p) => { await p.click("#previewPacketBtn"); await p.waitForSelector("dialog.cgpp-modal[open]"); await p.waitForTimeout(250); };
  /* every visible piece of text in the window against the color behind it, as a person sees it */
  const sweep = (p) => p.evaluate(() => {
    const parse = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
    const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
    const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }, L = (c) => .2126 * lin(c.r) + .7152 * lin(c.g) + .0722 * lin(c.b);
    const bg = (el) => { const st = []; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > 0) { st.push(c); if (c.a >= 1) break; } } let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = st.length - 1; i >= 0; i--) base = over(st[i], base); return base; };
    const d = document.querySelector("dialog.cgpp-modal"), bad = []; let n = 0;
    const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
    for (let t; (t = w.nextNode());) { const tx = t.nodeValue.trim(); if (!tx) continue; const e = t.parentElement; if (!e.getClientRects().length) continue; const cs = getComputedStyle(e); if (cs.visibility === "hidden") continue; const b = bg(e), f = over(parse(cs.color), b), x = L(f), y = L(b), cr = (Math.max(x, y) + .05) / (Math.min(x, y) + .05); n++; if (cr < 7) bad.push(tx.slice(0, 30) + " " + cr.toFixed(2)); }
    return { n, bad };
  });
  const modalOpen = (p) => p.evaluate(() => !!document.querySelector("dialog.cgpp-modal[open]"));

  /* ---- the button and the modal ---- */
  let { ctx, p, errs, outside } = await open();
  const btn = await p.evaluate(() => { const b = document.getElementById("previewPacketBtn"), s = document.getElementById("staffOnlyBtn"); const r = b.getBoundingClientRect(); return { h: Math.round(r.height), text: b.textContent.trim(), svg: !!b.querySelector("svg[aria-hidden=true]"), after: s.nextElementSibling === b, sameRow: Math.abs(s.getBoundingClientRect().top - r.top) < 80 }; });
  ok(btn.text === "Preview Packet" && btn.svg && btn.after && btn.h >= 52, `"Preview Packet" (an inline SVG eye, no emoji) sits beside the packet buttons and is 52 px tall (${btn.h})`);
  await fill(p); await p.evaluate(() => { document.querySelector('input[name="stage"][value="middle"]').checked = true; });
  await openModal(p);
  const m = await p.evaluate(() => { const d = document.querySelector("dialog.cgpp-modal"); const lab = document.getElementById(d.getAttribute("aria-labelledby")), des = document.getElementById(d.getAttribute("aria-describedby")); return { role: d.getAttribute("role"), modal: d.getAttribute("aria-modal"), title: lab && lab.textContent, desc: des && des.textContent, focusIn: d.contains(document.activeElement), focus: document.activeElement.className, locked: document.documentElement.classList.contains("cgpp-open") && getComputedStyle(document.documentElement).overflow === "hidden" }; });
  ok(m.role === "dialog" && m.modal === "true" && m.title === "Print Preview" && /8\.5 by 11/.test(m.desc) && /0\.75/.test(m.desc), "the modal is a labelled, described dialog that says what it shows");
  ok(m.focusIn && /cgpp-tab/.test(m.focus) && m.locked, "focus moves into the modal and the page behind is locked");
  for (const sel of [".cgpp-tab:nth-child(2)", ".cgpp-actions .cgpp-btn:nth-child(1)", ".cgpp-btn-primary", ".cgpp-zoom"]) { await p.hover(sel); const hv = await sweep(p); ok(hv.bad.length === 0, `hovering ${sel} leaves every word 7:1 or better (${hv.bad.join(", ") || "none"})`); }
  await p.mouse.move(2, 2);
  const sw1 = await sweep(p); ok(sw1.n > 20 && sw1.bad.length === 0, `every piece of text in the window is 7:1 or better on its background (${sw1.n} checked; below 7:1: ${sw1.bad.join(", ") || "none"})`);

  /* ---- pages ---- */
  const tabs = await p.evaluate(() => [...document.querySelectorAll(".cgpp-tab")].map((t) => ({ n: t.querySelector(".cgpp-tab-n").textContent, name: t.querySelector(".cgpp-tab-name").textContent, sel: t.getAttribute("aria-selected"), h: Math.round(t.getBoundingClientRect().height) })));
  ok(tabs.length === 3 && tabs[0].name === "Resident Activity Sheet" && tabs[1].name === "Caregiver Facilitation Protocol & Daily Notes" && tabs[2].name === "Sensory Guidance" && tabs.map((t) => t.n).join() === "Page 1,Page 2,Page 3" && tabs[0].sel === "true" && tabs.every((t) => t.h >= 52), "three tabs with the three page names, the first selected, each 52 px");
  const pageOf = () => p.evaluate(() => (document.querySelector(".cgpp-holder .cgpp-sheet") || {}).dataset.page);
  ok(await pageOf() === "resident", "page 1 is the resident sheet");
  await p.keyboard.press("ArrowRight"); ok(await pageOf() === "caregiver" && await p.evaluate(() => document.activeElement.id.endsWith("tab1")), "ArrowRight goes to page 2 (and the focus follows)");
  await p.keyboard.press("End"); ok(await pageOf() === "sensory", "End goes to the last page");
  await p.keyboard.press("ArrowRight"); ok(await pageOf() === "resident", "the pages wrap around");
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("Home"); ok(await pageOf() === "resident", "Home goes to the first page");
  const p2 = await (async () => { await p.click(".cgpp-tab:nth-child(2)"); return p.evaluate(() => { const t = document.querySelector(".cgpp-holder").innerText; return { steps: ["Visual Cue", "Verbal Anchor", "Validation Statement"].every((s) => t.includes(s)), order: t.indexOf("Visual Cue") < t.indexOf("Verbal Anchor") && t.indexOf("Verbal Anchor") < t.indexOf("Validation Statement"), notice: t.includes("Affirm the resident's lived reality; never debate historical facts."), daily: t.includes("Daily notes") }; }); })();
  ok(p2.steps && p2.order && p2.notice && p2.daily, "page 2 holds the three steps in order, the validation safety notice and the daily notes lines");
  await p.click(".cgpp-tab:nth-child(3)"); ok(/Sensory/.test(await p.evaluate(() => document.querySelector(".cgpp-holder h2").textContent)) && /Sound/.test(await p.evaluate(() => document.querySelector(".cgpp-holder").innerText)), "page 3 is the sensory guidance");
  await p.click(".cgpp-tab:nth-child(1)");

  /* ---- the sheet: 1:1 ---- */
  await p.click(".cgpp-zoom"); await p.waitForTimeout(150);
  const g = await p.evaluate(() => { const s = document.querySelector(".cgpp-holder .cgpp-sheet"), cs = getComputedStyle(s), r = s.getBoundingClientRect(), body = s.querySelector(".cgpp-list li, .cgpp-card"), bcs = getComputedStyle(body); return { w: Math.round(r.width), h: Math.round(r.height), pad: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft], bg: cs.backgroundColor, fg: bcs.color, ff: cs.fontFamily, fs: parseFloat(bcs.fontSize), zoomLabel: document.querySelector(".cgpp-zoom").textContent, pressed: document.querySelector(".cgpp-zoom").getAttribute("aria-pressed"), nonBW: [...s.querySelectorAll("*")].filter((e) => { const c = getComputedStyle(e).color; return c !== "rgb(0, 0, 0)"; }).length }; });
  ok(g.w === 816 && g.h === 1056, `at actual size the sheet is 816 x 1056 px: 8.5 x 11 in at 96 dpi (${g.w} x ${g.h})`);
  ok(g.pad.every((v) => v === "72px"), `the margins are 0.75 in on every side (${g.pad.join(" ")})`);
  ok(g.bg === "rgb(255, 255, 255)" && g.fg === "rgb(0, 0, 0)" && g.nonBW === 0, "pure black text on pure white, nothing else");
  ok(/sans-serif/i.test(g.ff) && !/serif[^-]/.test(g.ff.replace(/sans-serif/gi, "")), `a sans-serif stack (${g.ff.slice(0, 60)})`);
  ok(g.fs >= 24 - 0.05, `the resident page is set at 18 pt (24 px) or more (${g.fs} px)`);
  ok(g.zoomLabel === "Fit to window" && g.pressed === "true", "the zoom control toggles and says what it will do next");
  await p.click(".cgpp-zoom");
  const fitSc = await p.evaluate(() => document.querySelector(".cgpp-holder").style.transform); ok(/scale\(0\.\d+\)/.test(fitSc) || /scale\(1\)/.test(fitSc), `fit to window scales the sheet (${fitSc})`);

  /* ---- toner ---- */
  await p.waitForFunction(() => /ink/.test((document.querySelector(".cgpp-toner-text") || {}).textContent || "") && !/Measuring/.test(document.querySelector(".cgpp-toner-text").textContent), null, { timeout: 8000 });
  const t1 = await p.textContent(".cgpp-toner-text"), n1 = /This page about ([\d.]+)%/.exec(t1), avg = /whole packet about ([\d.]+)%/.exec(t1);
  ok(/Facility Toner Optimizer/.test(await p.textContent(".cgpp-toner-title")) && n1 && avg && +n1[1] > 0 && +n1[1] < 25 && +avg[1] > 0 && +avg[1] < 25 && /black line art only, no gray fills/.test(t1), `the Facility Toner Optimizer badge shows a measured percentage for the page and the packet, and that there are no gray fills (${t1})`);
  await p.click(".cgpp-tab:nth-child(2)"); const t2 = await p.textContent(".cgpp-toner-text");
  ok(t2 !== t1 && /This page about/.test(t2), "the page figure changes with the page");
  await p.click(".cgpp-tab:nth-child(1)");
  const est = await p.evaluate(async () => {
    const mod = await import("/js/print-preview-modal.js"), box = (h, c) => `<div style="width:816px;height:${h}px;background:${c}"></div>`, w = 816, H = 1056;
    return { white: await mod.inkOfHtml(`<div style="width:816px;height:1056px;background:#fff"></div>`, w, H, ""), quarter: await mod.inkOfHtml(box(264, "#000"), w, H, ""), full: await mod.inkOfHtml(box(1056, "#000"), w, H, ""), gray: await mod.inkOfHtml(box(528, "#888"), w, H, "") };
  });
  ok(est.white.percent === 0 && Math.abs(est.quarter.percent - 25) < 0.2 && est.full.percent === 100, `the measurement is right on known pages: white ${est.white.percent} %, a quarter black ${est.quarter.percent} %, all black ${est.full.percent} %`);
  ok(est.quarter.pureBlackWhite === true && est.gray.pureBlackWhite === false && est.gray.grayFillPercent > 40, `a gray fill is detected (${est.gray.grayFillPercent} % flat gray) and solid black is not called gray`);

  /* ---- the summary tag ---- */
  const chips = await p.evaluate(() => [...document.querySelectorAll(".cgpp-chip")].map((c) => c.textContent));
  ok(["Resident name: Peggy", "Pet names: Biscuit", "Career reference: schoolteacher", "Hometown: Cedar Falls, Iowa", "Era anchors: 1950s"].every((c) => chips.includes(c)) && chips.some((c) => /^Family member names: .*Walter/.test(c)), `the Customization Summary lists what reached the page (${chips.join(" | ")})`);
  const printed = await p.evaluate(() => { const s = document.querySelector(".cgpp-holder").innerText; return /Peggy/.test(s) && /Biscuit|Cedar Falls|schoolteacher/.test(s); });
  ok(printed, "and those details really are on the printed layout");
  /* ---- controls ---- */
  const ctl = await p.evaluate(() => [...document.querySelectorAll(".cgpp-actions .cgpp-btn")].map((b) => ({ t: b.textContent, h: Math.round(b.getBoundingClientRect().height) })));
  ok(ctl.map((c) => c.t).join("|") === "Close Preview|Adjust Parameters|Confirm & Print" && ctl.every((c) => c.h >= 52), "Close Preview, Adjust Parameters and Confirm & Print, each 52 px");
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  ok(!(await modalOpen(p)) && await p.evaluate(() => document.activeElement.id === "previewPacketBtn" && !document.documentElement.classList.contains("cgpp-open") && getComputedStyle(document.documentElement).overflow !== "hidden"), "Escape closes it, returns focus to Preview Packet and unlocks the page");
  await openModal(p); await p.mouse.click(5, 450); await p.waitForTimeout(250); ok(!(await modalOpen(p)), "a click on the backdrop closes it");
  await openModal(p); await p.click(".cgpp-actions .cgpp-btn:nth-child(1)"); await p.waitForTimeout(200); ok(!(await modalOpen(p)), "Close Preview closes it");
  await openModal(p); await p.click(".cgpp-actions .cgpp-btn:nth-child(2)"); await p.waitForTimeout(250);
  ok(!(await modalOpen(p)) && await p.evaluate(() => ["first", "goes"].includes(document.activeElement.id)), "Adjust Parameters closes it and takes you to the form");
  ok(await p.evaluate(() => window.__printed) === 0, "nothing printed so far");

  /* ---- printing and the free allowance ---- */
  const before = await p.evaluate(() => runsUsed());
  await openModal(p); await p.click(".cgpp-actions .cgpp-btn:nth-child(3)"); await p.waitForTimeout(400);
  const pr = await p.evaluate(() => ({ n: window.__printed, st: window.__printStage, after: runsUsed(), stageGone: !document.getElementById("cgpp-print-stage"), cls: document.documentElement.classList.contains("cgpp-printing") }));
  ok(pr.n === 1 && pr.st && pr.st.sheets === 3 && pr.st.cls, "Confirm & Print draws all three pages into the print stage and prints");
  ok(pr.after === before + 1 && pr.stageGone && !pr.cls && !(await modalOpen(p)), "it counts one free packet, then cleans up and closes");
  await p.evaluate(() => { while (runsUsed() < FREE_RUNS) bumpGen(); window.__printed = 0; });
  await openModal(p); await p.click(".cgpp-actions .cgpp-btn:nth-child(3)"); await p.waitForTimeout(400);
  ok(await p.evaluate(() => window.__printed === 0 && getComputedStyle(document.getElementById("gate")).display === "block") && !(await modalOpen(p)), "with the free allowance used up, nothing prints and the buy window opens (the preview closes first)");
  await ctx.close();

  /* ---- blocked sheets, the keep-off list, injection ---- */
  ({ ctx, p, errs, outside } = await open());
  await p.evaluate(async () => { const mod = await import("/js/print-preview-modal.js"); const { asset } = await window.CognicopiaAgents.orchestrator.execute({ mode: "express" }); window.__blockedPromise = mod.openPreview({ asset, audit: { status: "blocked", problems: [{ rule: "medical promise" }], fixes: [] } }); });
  await p.waitForSelector("dialog.cgpp-modal[open]"); await p.waitForTimeout(250);
  const bl = await p.evaluate(() => ({ aria: document.querySelector(".cgpp-btn-primary").getAttribute("aria-disabled"), msg: document.querySelector(".cgpp-audit").textContent }));
  await p.click(".cgpp-btn-primary", { force: true }); await p.waitForTimeout(200);   // Playwright will not click an aria-disabled button; a person might
  ok(bl.aria === "true" && /cannot be printed yet/.test(bl.msg) && /medical promise/.test(bl.msg) && await modalOpen(p) && await p.evaluate(() => window.__printed === 0), "a blocked sheet says why, and Confirm & Print does nothing");
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  await fill(p, { ...FIELDS, avoid: "Cedar Falls, Biscuit" }); await openModal(p);
  ok(await p.evaluate(() => { const t = document.querySelector(".cgpp-holder").innerText + [...document.querySelectorAll(".cgpp-chip")].map((c) => c.textContent).join(" "); return !/Cedar Falls|Biscuit/.test(t); }), "a hometown and a pet on the keep-off-the-page list are on neither the sheet nor the summary");
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  await fill(p, { ...FIELDS, avoid: "", goes: '<img src=x onerror="window.__xss=1">', first: "x", job: '"><script>window.__xss=2<\/script>' }); await openModal(p);
  const xss = await p.evaluate(() => ({ ran: window.__xss, img: !!document.querySelector('.cgpp-modal img[src="x"]'), script: !!document.querySelector(".cgpp-modal script"), text: document.querySelector(".cgpp-holder").innerText.includes('<img src=x'), chip: [...document.querySelectorAll(".cgpp-chip")].some((c) => c.textContent.includes("<img")) }));
  ok(xss.ran === undefined && !xss.img && !xss.script && xss.text && xss.chip, "a name that is markup is shown as plain text and runs nothing");
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);

  /* ---- the printout: three Letter pages ---- */
  await openModal(p); await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  const pdf = await p.evaluate(async () => { const mod = await import("/js/print-preview-modal.js"); const { asset } = await window.CognicopiaAgents.orchestrator.execute({ mode: "express", options: { tier: 2 } }); const st = document.createElement("div"); st.id = "cgpp-print-stage"; st.innerHTML = mod.renderAllPagesHtml(asset); document.body.append(st); document.documentElement.classList.add("cgpp-printing"); return true; });
  await p.emulateMedia({ media: "print" });
  const buf = await p.pdf({ preferCSSPageSize: true, printBackground: true }); const txt = buf.toString("latin1");
  const pages = (txt.match(/\/Type\s*\/Page(?![s\w])/g) || []).length, box = /\/MediaBox\s*\[\s*0\s+0\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*\]/.exec(txt);
  ok(pdf && pages === 3 && box && Math.round(+box[1]) === 612 && Math.round(+box[2]) === 792, `the printout is three US Letter pages (${pages} pages, ${box ? box[1] + " x " + box[2] : "?"} pt)`);
  const pg = await p.evaluate(() => { const rules = [...document.styleSheets].flatMap((ss) => { try { return [...ss.cssRules]; } catch (e) { return []; } }); const r = rules.find((x) => x.type === 6 && /cg-preview/.test(x.cssText || "") && /margin/.test(x.cssText)); return { rule: r ? r.cssText : "", name: getComputedStyle(document.getElementById("cgpp-print-stage")).page, others: [...document.body.children].filter((e) => getComputedStyle(e).display !== "none").map((e) => e.id || e.tagName) }; });
  ok(/size:\s*8\.5in 11in/.test(pg.rule) && /margin:\s*0?\.75in/.test(pg.rule) && pg.name === "cg-preview", `the printout uses its own named page, 8.5 x 11 in with 0.75 in margins, not the site's document page (${pg.name})`);
  ok(pg.others.join() === "cgpp-print-stage", "while printing, nothing else on the page is shown: " + pg.others.join());
  await p.emulateMedia({ media: "screen" });
  ok(errs.length === 0 && await p.evaluate(() => window.__rej) === 0, "no script errors or unhandled rejections: " + errs.join(" | "));
  ok(outside.length === 0, "nothing was requested from outside the site: " + outside.join(", "));
  await ctx.close();

  /* ---- a phone, and Night Shift ---- */
  ({ ctx, p, errs } = await open({ viewport: { width: 390, height: 844 } })); await fill(p); await openModal(p);
  const ph = await p.evaluate(() => { const d = document.querySelector("dialog.cgpp-modal").getBoundingClientRect(); return { w: Math.round(d.width), h: Math.round(d.height), vw: innerWidth, vh: innerHeight, wide: document.documentElement.scrollWidth > innerWidth + 1, dlgWide: document.querySelector("dialog.cgpp-modal").scrollWidth > document.querySelector("dialog.cgpp-modal").clientWidth + 1, btns: [...document.querySelectorAll(".cgpp-actions .cgpp-btn, .cgpp-tab")].map((b) => Math.round(b.getBoundingClientRect().height)), inView: [...document.querySelectorAll(".cgpp-actions .cgpp-btn")].every((b) => { const r = b.getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= -1 && r.bottom <= innerHeight + 1; }) }; });
  ok(ph.w === ph.vw && ph.h === ph.vh && !ph.wide && !ph.dlgWide && ph.btns.every((h) => h >= 52) && ph.inView, `on a phone it fills the screen, nothing scrolls sideways, every control is 52 px and on screen (${ph.w} x ${ph.h})`);
  const sw2 = await sweep(p); ok(sw2.bad.length === 0, `on a phone too, every piece of text is 7:1 or better (${sw2.bad.join(", ") || "none"})`);
  await ctx.close();
  ({ ctx, p } = await open({ night: true })); await fill(p); await openModal(p);
  const sw3 = await sweep(p); ok(sw3.bad.length === 0, `in Night Shift every piece of text is 7:1 or better (${sw3.bad.join(", ") || "none"})`);
  const nt = await p.evaluate(() => { const lum = (c) => { const m = c.match(/\d+/g).map(Number).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; }, ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }; const d = getComputedStyle(document.querySelector("dialog.cgpp-modal")), t = getComputedStyle(document.querySelector(".cgpp-title")), b = getComputedStyle(document.querySelector(".cgpp-btn")), pr = getComputedStyle(document.querySelector(".cgpp-btn-primary")), s = getComputedStyle(document.querySelector(".cgpp-holder .cgpp-sheet")); return { title: ratio(t.color, d.backgroundColor), btn: ratio(b.color, b.backgroundColor), primary: ratio(pr.color, pr.backgroundColor), sheetBg: s.backgroundColor }; });
  ok(nt.title >= 7 && nt.btn >= 7 && nt.primary >= 7 && nt.sheetBg === "rgb(255, 255, 255)", `in Night Shift the modal's text pairs are 7:1 or better (title ${nt.title.toFixed(1)}, buttons ${nt.btn.toFixed(1)}, primary ${nt.primary.toFixed(1)}) and the paper stays white`);
  await ctx.close();
} finally { await browser.close(); srv.close(); }

if (problems.length) { console.error("print preview check FAILED: " + problems.length + " problem(s), " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("print preview check passed: " + passed + " checks in a real browser (the button, a labelled modal, three pages, 8.5 x 11 in with 0.75 in margins, measured toner, the summary tag, three controls, the free allowance, blocked sheets, injection, a three-page printout, phone, Night Shift)");
