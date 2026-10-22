#!/usr/bin/env node
/* =====================================================================
   The Terms of Service and non-medical disclaimer, in a real browser (Playwright; exit 2 where it is not installed).

     wording    the owner's paragraph is the same, letter for letter, in js/legal.js, terms.html and this check;
                the print line is the same in js/legal.js, the PDF maker (assets/vendor/jspdf-atkinson.js and its copy
                inside index.html) and the print style of the Packet Builder and the packet tool
     agreement  the first visit to the packet tool, the Packet Builder and Resident Profiles shows the agreement bar;
                "I agree" saves cognicopia_eula_accepted = "true" and the bar stays away after a reload; terms.html never shows it;
                the bar does not print; nothing is requested from outside the page
     links      "Terms of Service & Disclaimer" is in the footer of every page that has one, in the Packet Builder's menu
                and on the packet tool's footer
     pdf        a PDF made by the PDF maker carries the line on every page, in black, in the top margin and inside the page;
                a maker that opts out (doc.__noLegal) carries none
     print      the Packet Builder's printed sheets carry the line, in black, inside the page and clear of the page's own text
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { loadPlaywright, serve, ROOT } from "./lib/browser.mjs";

const TEXT = "Cognicopia is an educational and cognitive enrichment activity tool designed for resident engagement. It does not provide medical diagnoses, clinical treatment, physical health evaluation, or medical advice. Cognicopia is not a medical device under FDA regulations. All activities and printed packets are intended solely for recreational and cognitive stimulation purposes under the supervision of senior living staff.";
const LINE = "Cognicopia Enrichment Activity — For Cognitive Engagement Only. Not Medical Advice.";
const KEY = "cognicopia_eula_accepted";

let passed = 0; const problems = [], notes = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---------- wording ---------- */
const legal = read("js/legal.js"), terms = read("terms.html"), pdfMaker = read("assets/vendor/jspdf-atkinson.js");
const jsString = (src, name) => { const m = new RegExp("var " + name + " = \"((?:[^\"\\\\]|\\\\.)*)\";").exec(src); return m ? JSON.parse('"' + m[1] + '"') : null; };
ok(jsString(legal, "TEXT") === TEXT, "js/legal.js holds the owner's paragraph word for word");
ok(jsString(legal, "PRINT_LINE") === LINE, "js/legal.js holds the print line word for word");
ok(jsString(pdfMaker, "LEGAL") === LINE, "the PDF maker holds the print line word for word");
const inl = /<script id="pdffont">([\s\S]*?)<\/script>/.exec(read("index.html"));
ok(inl && inl[1] === pdfMaker, "index.html's copy of the PDF maker is the same file");
const body = /<p id="legalBody">([^<]*)<\/p>/.exec(terms);
ok(body && body[1].replace(/&amp;/g, "&") === TEXT, "terms.html holds the owner's paragraph word for word");
ok(/<h2 id="legalHead">Cognicopia Terms of Service &amp; Disclaimer<\/h2>/.test(terms), "terms.html carries the heading");
for (const f of ["builder.html", "index.html"]) ok(read(f).split(LINE).length - 1 >= 1, `${f}'s print style carries the print line`);
ok(/js\/legal\.js/.test(read("sw.js")) && /terms\.html/.test(read("sw.js")), "the offline cache holds the agreement script and the terms page");
for (const f of ["index.html", "builder.html", "profile.html", "terms.html"]) ok(/<script src="js\/legal\.js"><\/script>/.test(read(f)), `${f} loads js/legal.js`);
ok(!/https?:\/\//.test(legal.replace(/\/\*[\s\S]*?\*\//g, "")), "js/legal.js names no web address");
ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(legal), "js/legal.js makes no request");

/* ---------- links ---------- */
for (const f of ["index.html", "builder.html", "profile.html", "pricing.html", "contact.html", "pilot.html", "tablet.html", "terms.html", "resources/index.html"])
  ok(/href="(\.\.\/)*terms\.html"/.test(read(f)), `${f} links to the terms`);

/* ---------- the browser ---------- */
const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const foreign = [], errors = [];
const watch = p => {
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  p.on("pageerror", e => errors.push(e.message));
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-terms-"));
const PY = `
import sys, json
import pymupdf as fitz
doc = fitz.open(sys.argv[1]); out = []
for pg in doc:
    W, H = pg.rect.width, pg.rect.height
    hit = None; others = []
    for blk in pg.get_text("dict")["blocks"]:
        for ln in blk.get("lines", []):
            t = "".join(s["text"] for s in ln["spans"]).strip()
            if not t: continue
            if "Not Medical Advice" in t or "For Cognitive Engagement Only" in t:
                hit = {"text": t, "bbox": ln["bbox"], "color": [s["color"] for s in ln["spans"]], "size": [s["size"] for s in ln["spans"]]}
            else: others.append(ln["bbox"])
    clear = True
    if hit:
        for b in others:
            if not (b[3] <= hit["bbox"][1] - 1 or b[1] >= hit["bbox"][3] + 1 or b[2] <= hit["bbox"][0] or b[0] >= hit["bbox"][2]): clear = False
    out.append({"w": W, "h": H, "hit": hit, "clear": clear, "below": max([b[3] for b in others] or [0]), "above": min([b[1] for b in others] or [9999])})
print(json.dumps(out))
`;
const readPdf = file => {
  const r = spawnSync("python3", ["-I", "-c", PY, file], { encoding: "utf8", timeout: 60000 });
  try { return JSON.parse(r.stdout.trim().split("\n").pop()); } catch (e) { return null; }
};
const lineOnPage = (pg, label, scaled) => {
  const h = pg.hit; if (!h) { problems.push(`${label}: the line is missing`); return; }
  const joined = h.text.replace(/\s+/g, " ");
  ok(joined === LINE || (joined.includes("Cognicopia Enrichment Activity") && joined.includes("Not Medical Advice")), `${label}: the line reads as the owner wrote it`);
  const [x0, y0, x1, y1] = h.bbox;
  if (scaled) {
    /* the browser's own PDF of a web page is shrunk to fit, so sizes are not the printed ones: here only the order on the sheet is proved
       (the printed distances are read from the style, below) */
    ok(x0 >= 0 && x1 <= pg.w && y1 <= pg.h, `${label}: the line is inside the page`);
    ok(y1 <= pg.above + 0.5, `${label}: the line is above everything else on the sheet`);
  } else {
    ok(x0 >= 36 - .5 && x1 <= pg.w - 36 + .5, `${label}: the line sits inside the side margins (${x0.toFixed(0)} to ${x1.toFixed(0)} of ${pg.w.toFixed(0)} pt)`);
    ok(y0 >= 14 && y1 <= 36, `${label}: the line is in the top margin, at least 14 pt below the edge and above the 0.5 in line (top ${y0.toFixed(1)}, bottom ${y1.toFixed(1)} pt)`);
    ok(Math.min(...h.size) >= 6, `${label}: the line is not smaller than 6 pt`);
  }
  ok(h.color.every(c => c === 0), `${label}: the line is pure black`);
  ok(pg.clear, `${label}: nothing else is printed on the line`);
};

try {
  /* the first visit, and the agreement */
  for (const [file, name] of [["index.html", "packet tool"], ["builder.html", "Packet Builder"], ["profile.html", "Resident Profiles"]]) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" });
    const p = await ctx.newPage(); watch(p);
    await p.goto(base + file); await p.waitForSelector("#cgLegal", { timeout: 15000 }).catch(() => {});
    const shown = await p.evaluate(() => { const b = document.getElementById("cgLegal"); return b ? { text: b.querySelector(".cgl-txt p").textContent, head: b.querySelector(".cgl-txt b").textContent, btn: document.getElementById("cgLegalOk").getBoundingClientRect(), link: b.querySelector("a").getBoundingClientRect(), vis: getComputedStyle(b).display !== "none" } : null; });
    ok(!!shown && shown.vis, `${name}: the first visit shows the agreement bar`);
    const lum = rgb => { const k = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2]; };
    const cc = await p.evaluate(() => { const g = (s, pr) => getComputedStyle(document.querySelector(s))[pr]; return { bg: g("#cgLegal", "backgroundColor"), b: g("#cgLegal b", "color"), p: g("#cgLegal p", "color"), a: g("#cgLegal a", "color"), btn: g("#cgLegalOk", "color"), btnBg: g("#cgLegalOk", "backgroundColor") }; });
    const ratio = (x, y) => { const l1 = lum(x), l2 = lum(y); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
    ok(ratio(cc.b, cc.bg) >= 7 && ratio(cc.p, cc.bg) >= 7 && ratio(cc.a, cc.bg) >= 7 && ratio(cc.btn, cc.btnBg) >= 7, `${name}: the bar's text, link and button read at 7:1 or better (${[ratio(cc.b, cc.bg), ratio(cc.p, cc.bg), ratio(cc.a, cc.bg), ratio(cc.btn, cc.btnBg)].map(x => x.toFixed(1)).join(", ")})`);
    ok(shown && shown.link.height >= 52, `${name}: "Read the full terms" is at least 52 px tall (${shown && Math.round(shown.link.height)})`);
    ok(shown && shown.text === TEXT && shown.head === "Cognicopia Terms of Service & Disclaimer", `${name}: the bar shows the owner's wording word for word`);
    ok(shown && shown.btn.width >= 52 && shown.btn.height >= 52, `${name}: "I agree" is at least 52 px (${shown && Math.round(shown.btn.width)} x ${shown && Math.round(shown.btn.height)})`);
    ok(await p.evaluate(k => localStorage.getItem(k), KEY) === null, `${name}: nothing is saved before the person agrees`);
    await p.emulateMedia({ media: "print" });
    ok(await p.evaluate(() => getComputedStyle(document.getElementById("cgLegal")).display) === "none", `${name}: the bar does not print`);
    await p.emulateMedia({ media: "screen" });
    await p.click("#cgLegalOk");
    ok(await p.evaluate(k => localStorage.getItem(k), KEY) === "true", `${name}: "I agree" saves ${KEY} = "true"`);
    ok(await p.$("#cgLegal") === null, `${name}: the bar goes away`);
    await p.reload(); await p.waitForTimeout(900);
    ok(await p.$("#cgLegal") === null, `${name}: after a reload the bar stays away`);
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" });
    const p = await ctx.newPage(); watch(p);
    await p.goto(base + "terms.html"); await p.waitForTimeout(900);
    ok(await p.$("#cgLegal") === null, "terms.html never shows the bar over its own text");
    ok((await p.textContent("#legalBody")) === TEXT, "terms.html shows the owner's paragraph in the page");
    ok(await p.$("#legalAgain") === null && await p.$("#legalState") === null && !/Show the agreement box again|Not yet agreed on this computer/.test(await p.textContent("body")), "terms.html has no debug button and no agreement-status label");
    const heads = await p.$$eval("main .card h2", h => h.map(x => x.textContent.trim()));
    for (const h of ["Not a medical or clinical tool", "Your resident information stays on your computer", "Used with staff and family nearby", "Copyright, printing and license"]) ok(heads.includes(h), `terms.html has the section: ${h}`);
    const body = await p.textContent("main");
    ok(/No resident data leaves the device/.test(body) && /BarronCrafts/.test(body) && /no diagnostic ability/i.test(body) && /supervision of facility staff/i.test(body), "the four sections say what was asked: no diagnosis, no resident data leaves the device, staff supervision, BarronCrafts copyright");
    ok(!/HIPAA[- ]compliant|ensures? compliance|guarantee/i.test(body), "terms.html claims no compliance and promises nothing it cannot");
    await p.click("a[data-cg-terms]"); await p.waitForTimeout(300);
    ok(await p.$("#cgLegalModal") === null, "on terms.html the footer link does not open a window over the page that already holds the text");
    await ctx.close();
  }
  /* the footer link, on pages that carry only the link: a window on demand, never the first-visit bar */
  for (const [url, pre] of [["contact.html", ""], ["resources/staff-guide/", "../../"]]) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" });
    const p = await ctx.newPage(); watch(p);
    await p.goto(base + url); await p.waitForTimeout(900);
    ok(await p.$("#cgLegal") === null, `${url}: no first-visit bar on a page that only has the footer link`);
    const link = await p.$("a[data-cg-terms]"); ok(!!link, `${url}: the footer link is marked to open the agreement`);
    await link.scrollIntoViewIfNeeded(); await link.focus(); await p.keyboard.press("Enter"); await p.waitForTimeout(300);
    ok(await p.$eval("#cgLegalModal", d => d.open).catch(() => false), `${url}: the footer link opens the agreement window`);
    ok((await p.textContent("#cgmText")) === TEXT && /In short/.test(await p.textContent("#cgLegalModal")), `${url}: it shows the owner's paragraph and a short summary`);
    const sizes = await p.$$eval("#cgLegalModal button, #cgLegalModal a", els => els.map(e => Math.round(e.getBoundingClientRect().height)));
    ok(sizes.length === 3 && sizes.every(h => h >= 52), `${url}: its controls are at least 52 px (${sizes.join(", ")})`);
    ok((await p.getAttribute("#cgmFull", "href")) === pre + "terms.html", `${url}: "Read the full terms" goes to ${pre}terms.html`);
    ok(await p.evaluate(k => localStorage.getItem(k), KEY) === null, `${url}: opening it saves nothing`);
    await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    ok(await p.$("#cgLegalModal") === null && await p.evaluate(() => document.activeElement && document.activeElement.hasAttribute("data-cg-terms")), `${url}: Escape closes it and puts focus back on the link`);
    await link.click(); await p.waitForTimeout(200); await p.click("#cgmOk");
    ok(await p.evaluate(k => localStorage.getItem(k), KEY) === "true" && await p.$("#cgLegalModal") === null, `${url}: "I agree" in the window saves the agreement and closes it`);
    await p.emulateMedia({ media: "print" }); await link.click({ force: true }).catch(() => {});
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const p = await ctx.newPage(); watch(p);
    await p.goto(base + "contact.html"); await p.waitForTimeout(700);
    const link = await p.$("a[data-cg-terms]"); await link.scrollIntoViewIfNeeded(); await link.click(); await p.waitForTimeout(300);
    const m = await p.evaluate(() => { const r = document.querySelector("#cgLegalModal").getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, vw: innerWidth, vh: innerHeight }; });
    ok(m.l >= 0 && m.r <= m.vw && m.t >= 0 && m.b <= m.vh, "on a phone the agreement window fits the screen");
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" });
    const p = await ctx.newPage(); watch(p);
    await p.goto(base + "index.html"); await p.waitForSelector("#cgLegal", { timeout: 15000 }).catch(() => {});
    ok(await p.$("#cgLegal") !== null, "the first-visit bar still shows on the packet tool");
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const p = await ctx.newPage(); watch(p);
    await p.goto(base + "builder.html"); await p.waitForSelector("#cgLegal", { timeout: 15000 }).catch(() => {});
    const m = await p.evaluate(() => { const r = document.getElementById("cgLegal").getBoundingClientRect(); return { top: r.top, h: r.height, vh: innerHeight, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
    ok(m.h <= m.vh * 0.5, `on a phone the bar takes at most half the screen (${Math.round(m.h)} of ${m.vh} px)`);
    ok(m.sw <= m.cw + 1, "and does not make the page scroll sideways");
    await ctx.close();
  }

  /* a PDF made by the PDF maker */
  {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 }, serviceWorkers: "block", acceptDownloads: true });
    const p = await ctx.newPage(); watch(p);
    await p.addInitScript(k => { try { localStorage.setItem(k, "true"); } catch (e) { /* ignore */ } }, KEY);
    await p.goto(base + "index.html"); await p.waitForTimeout(900);
    const b64 = await p.evaluate(() => {
      const J = window.jspdf.jsPDF, d = new J({ unit: "pt", format: "letter" });
      d.setFont("helvetica", "bold"); d.setFontSize(20); d.text("Page one of a test packet", 72, 90);
      d.addPage(); d.text("Page two", 72, 90);
      d.setFontSize(12); d.text("Page two foot", 306, 753, { align: "center" });
      d.save("a.pdf"); d.output("arraybuffer");
      const buf = new Uint8Array(d.output("arraybuffer")); let s = ""; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
      const e = new J({ unit: "pt", format: "letter" }); e.__noLegal = true; e.text("An invoice", 72, 90);
      const eb = new Uint8Array(e.output("arraybuffer")); let t = ""; for (let i = 0; i < eb.length; i += 8192) t += String.fromCharCode.apply(null, eb.subarray(i, i + 8192));
      const pages = d.internal.getNumberOfPages();
      return { a: btoa(s), b: btoa(t), pages };
    });
    const fa = path.join(tmp, "a.pdf"), fb = path.join(tmp, "b.pdf");
    fs.writeFileSync(fa, Buffer.from(b64.a, "base64")); fs.writeFileSync(fb, Buffer.from(b64.b, "base64"));
    const ra = readPdf(fa), rb = readPdf(fb);
    if (!ra || !rb) problems.push("the test PDFs could not be read back with PyMuPDF");
    else {
      ok(ra.length === 2, `the test PDF has two pages (${ra.length})`);
      ra.forEach((pg, i) => lineOnPage(pg, `PDF page ${i + 1}`));
      ok(rb.length === 1 && rb[0].hit === null, "a PDF from a maker that opts out carries no line");
    }
    await ctx.close();
  }

  /* the Packet Builder's printed sheets */
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" });
    const p = await ctx.newPage(); watch(p);
    await p.addInitScript(k => { try { localStorage.setItem(k, "true"); } catch (e) { /* ignore */ } window.__pr = 0; window.print = () => { window.__pr++; }; }, KEY);
    p.on("dialog", d => d.accept());
    await p.goto(base + "builder.html#/coloring"); await p.waitForSelector("#ccTabMk", { timeout: 20000 });
    await p.click("#ccTabMk"); await p.waitForSelector("#ccMkQ");
    for (const q of ["Ice Cream Soda", "Water Lily"]) {
      await p.fill("#ccMkQ", q); await p.click("#ccMkFind");
      await p.waitForFunction(() => !document.querySelector(".cc-mk-wait") && document.querySelector(".cc-mk-card"), null, { timeout: 30000 });
      await p.click("#ccMkAdd");
    }
    await p.evaluate(() => document.getElementById("generatePdf").click()); await p.waitForTimeout(4000);
    await p.emulateMedia({ media: "print" });
    const st = await p.evaluate(() => [...document.querySelectorAll("#printRoot .sheet")].map(sh => { const a = getComputedStyle(sh, "::before"), px = v => parseFloat(v); return { pos: a.position, top: px(a.top), left: px(a.left), right: px(a.right), size: px(a.fontSize) * 0.75, color: a.color, h: sh.getBoundingClientRect().height, w: sh.getBoundingClientRect().width }; }));
    const file = path.join(tmp, "sheets.pdf");
    fs.writeFileSync(file, await p.pdf({ preferCSSPageSize: true, printBackground: true }));
    const rs = readPdf(file);
    if (!rs) problems.push("the printed sheets could not be read back with PyMuPDF");
    else {
      ok(rs.length >= 2, `the Packet Builder printed ${rs.length} sheets`);
      rs.forEach((pg, i) => lineOnPage(pg, `printed sheet ${i + 1}`, true));
      ok(st.length >= 2 && st.every(x => x.pos === "absolute" && x.top >= 14.4 - .1 && x.top <= 24 && x.left >= 48 - .1 && x.right >= 48 - .1 && x.size >= 6 && x.color === "rgb(0, 0, 0)" && Math.abs(x.h - 1056) < 1 && Math.abs(x.w - 816) < 1), `every printed sheet is 8.5 x 11 in with the line ${st[0] ? (st[0].top * .75).toFixed(1) : "?"} pt below the top edge, inside the 0.5 in side margins, pure black, ${st[0] ? st[0].size.toFixed(0) : "?"} pt`);
    }
    await ctx.close();
  }
  ok(foreign.length === 0, "nothing was requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 3).join(", ") : ""));
  ok(errors.length === 0, "no script error" + (errors.length ? ": " + [...new Set(errors)].slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); }

console.log(problems.length ? `terms check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ") : `terms check passed: ${passed} checks (the owner's wording word for word, the first-visit agreement kept in this browser only, the line on every PDF page and printed sheet, nothing leaving the page)`);
process.exit(problems.length ? 1 : 0);
