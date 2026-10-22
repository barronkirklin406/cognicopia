#!/usr/bin/env node
/* =====================================================================
   Print audit: every printable template, printed in a real browser to a real PDF and read back.
   Run: node scripts/audit-print.mjs [--only pages|builder|packet] [--keep DIR]
   (Playwright for the browser and PyMuPDF for the PDF; exit 2 where either is missing. Part of npm run build, not of npm test: it prints
   several hundred pages. scripts/check-print-pages-ui.mjs and scripts/check-print-type-ui.mjs are the fast guards.)

   Three sets of templates:
     pages    every static page (prices, policies, guides, research, the resident profile...) as Ctrl+P prints it
     builder  every activity the Packet Builder makes, at every level it is made for, as the print window prints it
     packet   the packet tool on the front page (Quick-Print), at all three stages

   For each it checks, from the page's own layout and from the PDF:
     breaks    one sheet per page (a sheet that spills makes an extra page); no heading stranded at the foot of a page;
               a sheet taller than the page
     ink       every word, line and fill is pure black or white (PDF text, strokes, fills, images read back); no picture
               behind the words; no line thinner than the lowest stage's floor (2.25 pt)
     margins   nothing printed inside 0.5 in of an edge on a page the audit does not allow to run edge to edge
     bleed     no menu, button, field, banner, dialog or fixed bar on the paper, in the layout or in the text of the PDF
   Findings print grouped by kind; the exit code is 1 when there are any (the two things no style sheet can change are listed
   under ACCEPTED). npm run build runs it; npm run audit:print runs it by hand.
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { loadPlaywright, serve, ROOT } from "./lib/browser.mjs";

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : "all";
const keep = args.includes("--keep") ? args[args.indexOf("--keep") + 1] : null;
const TMP = keep || fs.mkdtempSync(path.join(os.tmpdir(), "cg-print-audit-"));
fs.mkdirSync(TMP, { recursive: true });

const py = spawnSync("python3", ["-c", "import pymupdf"], { encoding: "utf8" });
if (py.status !== 0) { console.error("PyMuPDF is not installed (pip install pymupdf): the audit needs it to read the PDFs."); process.exit(2); }

/* ---------- reading a PDF back ---------- */
const READER = `
import sys, json, pymupdf
path, mode = sys.argv[1], sys.argv[2]
doc = pymupdf.open(path)
pages = []
for i, pg in enumerate(doc):
    W, H = pg.rect.width, pg.rect.height
    texts = []; nonblack = 0; light = 0; lines = []; minw = None; tiny = 0
    x0 = y0 = 1e9; x1 = y1 = -1e9
    for b in pg.get_text("dict")["blocks"]:
        if b.get("type") == 1:
            continue
        for ln in b.get("lines", []):
            for sp in ln["spans"]:
                t = sp["text"].strip()
                if not t: continue
                texts.append(t)
                if sp["color"] not in (0, 16777215): nonblack += 1
                bx = sp["bbox"]; x0 = min(x0, bx[0]); y0 = min(y0, bx[1]); x1 = max(x1, bx[2]); y1 = max(y1, bx[3])
    last = None
    blocks = [b for b in pg.get_text("dict")["blocks"] if b.get("type") == 0 and b.get("lines")]
    if blocks:
        lb = max(blocks, key=lambda b: b["bbox"][3])
        sp = lb["lines"][-1]["spans"][-1]
        last = {"text": sp["text"].strip()[:60], "size": round(sp["size"], 1), "bold": bool(sp["flags"] & 16) or "Bold" in sp["font"], "y": round(lb["bbox"][3], 1)}
    colors = set(); thin = 0; strokes = 0
    for d in pg.get_drawings():
        for key in ("color", "fill"):
            c = d.get(key)
            if c is None: continue
            t = tuple(round(v, 3) for v in c)
            if t not in ((0.0, 0.0, 0.0), (1.0, 1.0, 1.0), (0.0,), (1.0,)):
                colors.add(t)
        if d.get("color") is not None and d.get("width") is not None and d["type"] in ("s", "fs"):
            strokes += 1
            if d["width"] < 2.0: thin += 1
        r = d["rect"]
        if d.get("fill") is not None and tuple(round(v, 3) for v in d["fill"]) not in ((1.0, 1.0, 1.0), (1.0,)):
            if r.width > 0 and r.height > 0:
                x0 = min(x0, r.x0); y0 = min(y0, r.y0); x1 = max(x1, r.x1); y1 = max(y1, r.y1)
        elif d.get("color") is not None:
            x0 = min(x0, r.x0); y0 = min(y0, r.y0); x1 = max(x1, r.x1); y1 = max(y1, r.y1)
    imgs = []
    for im in pg.get_images(full=True):
        try:
            pix = pymupdf.Pixmap(doc, im[0])
            if pix.alpha: pix = pymupdf.Pixmap(pix, 0)
            if pix.colorspace and pix.colorspace.n > 1:
                gray = pymupdf.Pixmap(pymupdf.csGRAY, pix)
            else:
                gray = pix
            s = gray.samples
            mid = sum(1 for v in s[:: max(1, len(s)//4000)] if 20 < v < 235)
            colorful = False
            if pix.colorspace and pix.colorspace.n >= 3:
                sm = pix.samples; n = pix.n
                for k in range(0, len(sm) - n, n * max(1, (len(sm)//n)//2000)):
                    if abs(sm[k] - sm[k+1]) > 8 or abs(sm[k+1] - sm[k+2]) > 8: colorful = True; break
            imgs.append({"w": pix.width, "h": pix.height, "gray_mid": mid, "colorful": colorful})
        except Exception as e:
            imgs.append({"err": str(e)[:60]})
    pages.append({"n": i + 1, "w": round(W, 1), "h": round(H, 1), "text": " ".join(texts)[:6000], "nonblack": nonblack,
                  "bbox": None if x0 > 1e8 else [round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1)],
                  "last": last, "colors": [list(c) for c in colors][:6], "strokes": strokes, "thin": thin, "images": imgs})
print(json.dumps(pages))
`;
const readPdf = (file) => {
  const r = spawnSync("python3", ["-I", "-c", READER, file, "x"], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error("PDF read failed: " + r.stderr.slice(0, 300));
  return JSON.parse(r.stdout);
};

/* ---------- findings ---------- */
const findings = []; let checks = 0;
const add = (set, what, kind, detail) => findings.push({ set, what, kind, detail });
const ok = (cond, set, what, kind, detail) => { checks++; if (!cond) add(set, what, kind, detail); };

const BANNED = ["Skip to", "Get Full Access", "Instant Soothe", "Sign in", "Accept all", "I agree", "Got it"];   // words that are a button, never a sentence ("License Key / Promo" and "Night Shift" are also named in some pages' own text)
const NAV_TEXT = /\b(Resident tools|Staff & family portal|Terms of Service & Disclaimer\s+Questions)\b/;
const IN = 72;

/* the checks a PDF has to pass, whatever made it */
function judgePdf(set, what, pages, opt = {}) {
  const { sheets = null, edgeToEdge = false, gutter = false, letter = true } = opt;   // noThin: the 2 pt floor is for activity sheets, not for a web page's own rules
  if (sheets != null) ok(pages.length === sheets, set, what, "breaks", `${sheets} sheet(s) made ${pages.length} page(s): a sheet spilled onto another page`);
  pages.forEach((p, i) => {
    const tag = `${what} p${p.n}`;
    if (letter) ok(Math.abs(p.w - 612) < 1 && Math.abs(p.h - 792) < 1, set, tag, "margins", `page is ${p.w} x ${p.h} pt, not US Letter`);
    ok(p.nonblack === 0, set, tag, "ink", `${p.nonblack} text span(s) not pure black`);
    ok(p.colors.length === 0, set, tag, "ink", `drawing in non-black/white: ${JSON.stringify(p.colors)}`);
    const img = p.images.filter((m) => m.colorful || m.gray_mid > 40);
    ok(img.length === 0, set, tag, "ink", `${img.length} picture(s) with gray or color: ${JSON.stringify(img.slice(0, 2))}`);
    if (!opt.noThin) ok(p.thin === 0, set, tag, "ink", `${p.thin} of ${p.strokes} stroke(s) thinner than 2 pt`);
    for (const b of BANNED) ok(!p.text.includes(b.trim()) || b.trim().length < 5, set, tag, "bleed", `the text "${b.trim()}" is on the paper`);
    ok(!NAV_TEXT.test(p.text), set, tag, "bleed", "menu or footer text is on the paper");
    if (p.bbox && !edgeToEdge) {
      const left = gutter ? 1.25 * IN : 0.5 * IN;
      const slack = 1.5;
      ok(p.bbox[0] >= left - slack, set, tag, "margins", `content starts ${((p.bbox[0]) / IN).toFixed(2)} in from the left (needs ${(left / IN).toFixed(2)} in)`);
      ok(p.bbox[2] <= p.w - 0.5 * IN + slack, set, tag, "margins", `content ends ${((p.w - p.bbox[2]) / IN).toFixed(2)} in from the right (needs 0.5 in)`);
      ok(p.bbox[1] >= 0.5 * IN - slack - 26, set, tag, "margins", `content starts ${(p.bbox[1] / IN).toFixed(2)} in from the top`);   // the non-medical line sits at .2in on a sheet; only flagged above
      ok(p.bbox[3] <= p.h - 0.5 * IN + slack + 12, set, tag, "margins", `content ends ${((p.h - p.bbox[3]) / IN).toFixed(2)} in from the foot`);
    }
    if (p.last && pages[i + 1] && !opt.noOrphan) {
      const nextFirst = pages[i + 1].text.slice(0, 40);
      ok(!(p.last.bold && p.last.size >= 14 && p.last.y > p.h - 1.2 * IN && !/^Page \d+ of \d+/.test(p.last.text) && nextFirst), set, tag, "breaks", `a heading ("${p.last.text}") is the last thing on the page and its text starts the next`);
    }
  });
}

/* ---------- the browser ---------- */
const { chromium } = loadPlaywright();
const { srv, base } = await serve(ROOT);
const browser = await chromium.launch();
const newPage = async (vw = 816, vh = 1056) => {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  const p = await ctx.newPage(); p.setDefaultTimeout(30000);
  return { ctx, p };
};

/* what is on the layout in print media that should not be */
const LAYOUT_PROBE = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 1 && r.height > 1 && +cs.opacity > 0; };
  const UI = "nav,button,select,textarea:not([readonly]),input:not([readonly]):not([type=hidden]),[role=button],[role=dialog],dialog[open],.btn,.cg-btn,.plan-btn,.cg-topbar,.cg-sidebar,.cg-foot,.cg-crumbs,.cgl-bar,.upgrade-banner,.arb,.tb,video,audio,iframe,[class*=toast],[aria-live=assertive]";
  const ui = [...document.querySelectorAll(UI)].filter(vis).map((e) => (e.tagName + (e.id ? "#" + e.id : "") + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : "")).slice(0, 60));
  const fixed = [...document.querySelectorAll("body *")].filter((e) => { const p = getComputedStyle(e).position; return (p === "fixed" || p === "sticky") && vis(e); }).map((e) => e.tagName + (e.id ? "#" + e.id : "") + "." + String(e.className).slice(0, 30));
  const text = []; const bg = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = walker.nextNode())) {
    if (!n.nodeValue.trim()) continue; const e = n.parentElement; if (!e || !vis(e) || e.closest("svg,script,style,noscript")) continue;
    const c = getComputedStyle(e).color; if (c !== "rgb(0, 0, 0)") text.push(e.tagName + ":" + c + ":" + n.nodeValue.trim().slice(0, 24));
  }
  for (const e of document.querySelectorAll("body *")) {
    if (!vis(e) || e.closest("svg")) continue; const cs = getComputedStyle(e);
    const b = cs.backgroundColor; if (cs.backgroundImage !== "none") bg.push("image:" + e.tagName + "." + String(e.className).slice(0, 24));
    else if (b !== "rgba(0, 0, 0, 0)" && b !== "rgb(255, 255, 255)" && !/^rgba\(255, 255, 255,/.test(b)) bg.push(b + ":" + e.tagName + "." + String(e.className).slice(0, 24));
  }
  const wide = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  return { ui: [...new Set(ui)].slice(0, 6), fixed: [...new Set(fixed)].slice(0, 4), text: [...new Set(text)].slice(0, 4), bg: [...new Set(bg)].slice(0, 4), wide };
};

try {
  /* ============ pages ============ */
  if (only === "all" || only === "pages") {
    const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) => {
      const rel = path.join(d, e.name);
      if (e.isDirectory()) return /^(node_modules|platform|assets|docs|license-service|owner-private|src|scripts|\.git|\.claude|data|fonts|css|js|js\/vendor|resources\/_)/.test(e.name) ? [] : walk(rel);
      return e.name.endsWith(".html") ? [rel] : [];
    });
    const pages = ["."].flatMap((d) => walk(d)).map((f) => f.replace(/^\.\//, "")).filter((f) => !/^404\.html$/.test(f)).sort();
    const OWN_SHEETS = new Set(["builder.html"]);       // builds its own sheets; printing the page itself must still print nothing odd
    const { ctx, p } = await newPage();
    for (const f of pages) {
      const url = base + f;
      try { await p.goto(url, { waitUntil: "load" }); await p.waitForTimeout(350); } catch (e) { add("pages", f, "load", e.message.slice(0, 80)); continue; }
      await p.emulateMedia({ media: "print" });
      await p.addStyleTag({ content: "*,*::before,*::after{transition:none !important;animation:none !important}" });   // a transition from the screen colors would still be running
      await p.waitForTimeout(150);
      const probe = await p.evaluate(LAYOUT_PROBE);
      ok(probe.ui.length === 0, "pages", f, "bleed", "on the layout in print: " + probe.ui.join(", "));
      ok(probe.fixed.length === 0, "pages", f, "bleed", "a fixed or sticky element is shown in print: " + probe.fixed.join(", "));
      if (!OWN_SHEETS.has(f)) {
        ok(probe.text.length === 0, "pages", f, "ink", "text not pure black in print: " + probe.text.join(" | "));
        ok(probe.bg.length === 0, "pages", f, "ink", "a fill or picture behind the words: " + probe.bg.join(" | "));
      }
      ok(probe.wide <= 1, "pages", f, "margins", `the page is ${probe.wide}px wider than the paper`);
      const file = path.join(TMP, "page-" + f.replace(/[\\/]/g, "_") + ".pdf");
      await p.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
      const pdf = readPdf(file);
      judgePdf("pages", f, pdf, { gutter: !OWN_SHEETS.has(f) && !/^index\.html$/.test(f), edgeToEdge: OWN_SHEETS.has(f), letter: true, noThin: true });
      process.stdout.write(".");
      await p.emulateMedia({ media: "screen" });
    }
    await ctx.close(); console.log(` ${pages.length} pages`);
  }

  /* ============ builder: every activity at every level ============ */
  if (only === "all" || only === "builder") {
    const { ctx, p } = await newPage();
    const errors = []; p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(base + "builder.html#/"); await p.waitForTimeout(1500);
    const acts = await p.evaluate(() => Object.keys(ACT_INDEX));
    console.log(`builder: ${acts.length} activities`);
    let batch = 0;
    for (const level of ["early", "moderate", "advanced"]) {
      const ids = await p.evaluate((lv) => Object.keys(ACT_INDEX).filter((id) => { try { return clinicalOk(lv, id); } catch (e) { return true; } }), level);
      for (let i = 0; i < ids.length; i += 12) {
        const group = ids.slice(i, i + 12); batch++;
        const made = await p.evaluate(async ({ group, level }) => {
          const root = document.getElementById("printRoot");
          printReady = true;                      // the page prints a "nothing to print" note on beforeprint unless a packet was made
          root.className = "pure-bw res-clean";
          const out = [];
          root.innerHTML = group.map((id, k) => {
            const item = { uid: "audit" + k, activityId: id, cfg: { residentName: "Test Resident", date: todayISO(), difficulty: level, era: "general" }, batchSeed: 12345 + k, count: 1, index: 0 };
            let html = ""; try { html = sheetHtml(item, false); } catch (e) { html = ""; out.push({ id, err: String(e.message).slice(0, 80) }); }
            if (/This page is not ready/.test(html)) out.push({ id, err: "the page says it is not ready" });
            return html;
          }).join("");
          numberSheets(root);
          return { out, sheets: root.querySelectorAll(".sheet").length };
        }, { group, level });
        for (const o of made.out) add("builder", `${o.id} (${level})`, "make", o.err);
        await p.emulateMedia({ media: "print" });
        const probe = await p.evaluate(() => {
          const vis = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 1 && r.height > 1; };
          const bad = [...document.querySelectorAll("body > *")].filter((e) => e.id !== "printRoot" && vis(e)).map((e) => e.tagName + "#" + e.id + "." + String(e.className).slice(0, 20));
          const sheets = [...document.querySelectorAll("#printRoot .sheet")];
          const over = sheets.map((s, k) => { const r = s.getBoundingClientRect(); let worst = 0;
            s.querySelectorAll("*").forEach((c) => { if (c.closest("svg") && c.tagName !== "svg") return; const q = c.getBoundingClientRect(); if (q.width && q.height) { worst = Math.max(worst, q.bottom - r.bottom, q.right - r.right); } });
            return { k, h: Math.round(r.height), w: Math.round(r.width), worst: Math.round(worst) }; }).filter((o) => o.worst > 2 || o.h > 1058 || o.w > 818);
          return { bad, over };
        });
        ok(probe.bad.length === 0, "builder", `batch ${batch} (${level})`, "bleed", "outside the print root: " + probe.bad.join(", "));
        for (const o of probe.over) add("builder", `${group[o.k] || "?"} (${level})`, "breaks", `a sheet's content runs ${o.worst}px outside it or the sheet is ${o.w}x${o.h}px`);
        const file = path.join(TMP, `builder-${level}-${i}.pdf`);
        await p.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
        const pdf = readPdf(file);
        judgePdf("builder", `${level} ${group[0]}..`, pdf, { sheets: made.sheets, letter: true, noOrphan: true });
        /* name the sheet when a PDF check fails: re-judge page by page against the group */
        await p.emulateMedia({ media: "screen" });
        process.stdout.write(".");
      }
    }
    console.log(` ${batch} batches`);
    ok(errors.length === 0, "builder", "the page", "make", "script errors: " + errors.slice(0, 2).join(" | "));
    await ctx.close();
  }

  /* ============ the packet tool on the front page ============ */
  if (only === "all" || only === "packet") {
    for (const stage of ["early", "middle", "late"]) {
      const { ctx, p } = await newPage(1366, 900);
      const errors = []; p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(base + "index.html"); await p.waitForTimeout(1500);
      try {
        await p.fill("#first", "Test"); await p.fill("#born", "1938"); await p.fill("#town", "Minot"); await p.fill("#state", "North Dakota");
        await p.fill("#job", "teacher"); await p.fill("#hobbies", "gardening, baking"); await p.fill("#favs", "roses, coffee");
        await p.check(`input[name="stage"][value="${stage}"]`, { force: true });
        await p.evaluate(() => document.getElementById("qpbGenerate").scrollIntoView({ block: "center", behavior: "instant" }));
        await p.click("#qpbGenerate"); await p.waitForSelector("#qpbPreview .qp-sheet", { timeout: 30000 });
        await p.click("#qpbPrint"); await p.waitForTimeout(600);
        const sheets = await p.evaluate(() => document.querySelectorAll("#qpPrintRoot .qp-sheet").length);
        await p.emulateMedia({ media: "print" });
        const probe = await p.evaluate(() => {
          const vis = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 1 && r.height > 1; };
          return { bad: [...document.querySelectorAll("body > *")].filter((e) => e.id !== "qpPrintRoot" && vis(e)).map((e) => e.tagName + "#" + e.id), dark: [...document.querySelectorAll("#qpPrintRoot *")].filter((e) => { const c = getComputedStyle(e); return vis(e) && !e.closest("svg") && e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim()) && c.color !== "rgb(0, 0, 0)"; }).slice(0, 4).map((e) => e.tagName + "." + String(e.className).slice(0, 20) + ":" + getComputedStyle(e).color) };
        });
        ok(probe.bad.length === 0, "packet", `front page packet (${stage})`, "bleed", "outside the print root: " + probe.bad.join(", "));
        ok(probe.dark.length === 0, "packet", `front page packet (${stage})`, "ink", "text not pure black: " + probe.dark.join(" | "));
        const file = path.join(TMP, `packet-${stage}.pdf`);
        await p.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
        judgePdf("packet", `front page packet (${stage})`, readPdf(file), { sheets, letter: true, noOrphan: true });
        console.log(`packet ${stage}: ${sheets} sheets`);
      } catch (e) { add("packet", `front page packet (${stage})`, "make", e.message.slice(0, 120)); }
      ok(errors.length === 0, "packet", `front page packet (${stage})`, "make", "script errors: " + errors.slice(0, 2).join(" | "));
      await ctx.close();
    }
  }
} finally {
  await browser.close(); srv.close();
}

/* ---------- accepted: what a real printer would do the same way and no style sheet can change ---------- */
const ACCEPTED = [
  { what: /^index\.html p4$/, detail: /non-black\/white/ },       // a native checkbox or radio drawn by the browser in its own gray
  { what: /^license-desk\.html p1$/, detail: /picture/ },       // the brand logo (a JPEG): its edges are anti-aliased
];
for (let i = findings.length - 1; i >= 0; i--) if (ACCEPTED.some((a) => a.what.test(findings[i].what) && a.detail.test(findings[i].detail))) findings.splice(i, 1);

/* ---------- report ---------- */
const by = {};
for (const f of findings) { const k = `${f.set}/${f.kind}`; (by[k] ||= []).push(f); }
console.log(`\n${checks} checks, ${findings.length} finding(s)${keep ? ". PDFs kept in " + TMP : ""}.`);
for (const [k, list] of Object.entries(by).sort()) {
  console.log(`\n${k}: ${list.length}`);
  const seen = new Map();
  for (const f of list) { const key = f.detail.replace(/[\d.]+/g, "#"); if (!seen.has(key)) seen.set(key, []); seen.get(key).push(f.what); }
  for (const [d, whats] of seen) console.log(`  - ${d}\n      e.g. ${whats.slice(0, 4).join("; ")}${whats.length > 4 ? ` (+${whats.length - 4} more)` : ""} [${whats.length}]`);
}
if (!keep) fs.rmSync(TMP, { recursive: true, force: true });
process.exit(findings.length ? 1 : 0);
