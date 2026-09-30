#!/usr/bin/env node
/* =====================================================================
   Checks for the TypeScript services (src/services/*.ts): the browser
   builds are current, the sources type-check (when tsc is installed), and
   each service does what its header promises, run from the same built
   files the Packet Builder loads. Node built-ins only (tsc optional).
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0; const fails = [];
const ok = (cond, msg) => { if (cond) pass++; else fails.push(msg); };
const group = (name, fn) => { try { fn(); } catch (e){ fails.push(`${name}: threw ${e.stack || e}`); } };

/* 1. builds current, types sound */
try { execFileSync(process.execPath, [path.join(ROOT, "scripts", "build-services.mjs"), "--check"], { stdio:"pipe" }); pass++; }
catch (e){ fails.push("built services are out of date: " + String(e.stderr || e.stdout || e.message).trim()); }
let tscNote = "tsc not installed: type check skipped";
try { execFileSync("tsc", ["-v"], { stdio:"pipe" }); try { execFileSync("tsc", ["-p", path.join(ROOT, "tsconfig.json")], { stdio:"pipe" }); pass++; tscNote = "types check"; } catch (e){ fails.push("tsc: " + String(e.stdout || e.message).trim()); } } catch (e){ /* no tsc */ }

/* 2. load every built service into one sandbox, as the browser does */
const sandbox = { console }; sandbox.globalThis = sandbox; vm.createContext(sandbox);
const OUT = path.join(ROOT, "assets", "services");
fs.readdirSync(OUT).filter(f => f.endsWith(".js")).sort().forEach(f => vm.runInContext(fs.readFileSync(path.join(OUT, f), "utf8"), sandbox, { filename:"assets/services/" + f }));
const V = sandbox.CogniVectorEngine;

/* 3. Dynamic Vector Engine */
group("vectorEngine", () => {
  ok(V && typeof V.transformSvg === "function", "CogniVectorEngine is not loaded");
  // the stroke policy, exactly as specified
  const t = [1, 2, 3].map(k => V.tierLines(k, 3));
  ok(JSON.stringify(t.map(x => x.linePx)) === "[3,6,10.5]", "tier lines from a 3 px base: " + t.map(x => x.linePx));
  ok(JSON.stringify(t.map(x => x.multiplier)) === "[1,2,3.5]", "tier multipliers: " + t.map(x => x.multiplier));
  [1, 2, 3].forEach(k => {
    const P = V.STROKE_POLICY[k];
    for (const base of [0.5, 1, 2, 2.4, 3, 5, 20]){
      const L = V.tierLines(k, base);
      ok(L.linePx >= P.px.min && L.linePx <= P.px.max, `tier ${k} from base ${base}: ${L.linePx} px outside ${P.px.min}-${P.px.max}`);
      ok(L.multiplier >= P.multiplier.min && L.multiplier <= P.multiplier.max, `tier ${k} multiplier ${L.multiplier}`);
      ok(L.detailPx <= L.linePx && L.detailPx >= Math.min(P.detailPx, L.linePx), `tier ${k} detail ${L.detailPx}`);
    }
  });
  ok(V.STROKE_POLICY[1].px.min === 2 && V.STROKE_POLICY[1].px.max === 3 && V.STROKE_POLICY[2].px.min === 5 && V.STROKE_POLICY[2].px.max === 7 && V.STROKE_POLICY[3].px.min === 9 && V.STROKE_POLICY[3].px.max === 12, "tier px ranges");

  // the CogniCore engine prints with the same numbers
  const cc = { console }; cc.globalThis = cc; vm.createContext(cc);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "assets", "cognicore", "lineart.js"), "utf8"), cc);
  [1, 2, 3].forEach(k => { const w = cc.CogniCore.WEIGHTS[cc.CogniCore.TIERS[k].weight], L = V.tierLines(k, 3);
    ok(w.px === L.linePx && Math.abs(w.pt - L.linePt) < 1e-9 && Math.abs(w.detailPt - L.detailPt) < 1e-9, `CogniCore tier ${k} weights ${w.px} px / ${w.detailPt} pt differ from the DVE ${L.linePx} px / ${L.detailPt} pt`); });

  // parser: round trip, errors
  const lib = path.join(ROOT, "assets", "coloring");
  const files = fs.readdirSync(lib).filter(d => !d.startsWith("_") && d !== "ingested").flatMap(d => fs.readdirSync(path.join(lib, d)).filter(f => f.endsWith(".svg")).map(f => path.join(lib, d, f)));
  ok(files.length >= 300, "library SVGs found: " + files.length);
  let worst = 0, worstName = "";
  for (const f of files){
    const src = fs.readFileSync(f, "utf8"), ast = V.parseSvg(src), once = V.serializeSvg(ast);
    ok(V.serializeSvg(V.parseSvg(once)) === once, "round trip " + path.basename(f));
    for (const k of [1, 2, 3]){
      const r = V.transformSvg(src, { tier:k });
      if (r.report.ms > worst){ worst = r.report.ms; worstName = path.basename(f) + " T" + k; }
      const scale = +((/scale\(([0-9.]+)\)/.exec(r.svg) || [])[1] || 1), P = V.STROKE_POLICY[k];
      for (const m of r.svg.matchAll(/stroke-width="([0-9.]+)"/g)){ const px = +m[1] * scale * r.report.pxPerUnit;
        ok(px >= P.detailPx - .01 && px <= P.px.max + .01, `${path.basename(f)} T${k}: a ${px.toFixed(2)} px line`); }
      ok(/^<svg[^>]*stroke-linecap="round"[^>]*stroke-linejoin="round"/.test(r.svg), `${path.basename(f)} T${k}: round caps and joins`);
      ok(!/(?:fill|stroke)="(?!#000"|#fff"|none")/.test(r.svg), `${path.basename(f)} T${k}: a paint other than black or white`);
    }
  }
  ok(worst < 150, `the slowest page took ${worst} ms (limit 150): ${worstName}`);
  for (const bad of ["<svg><g></svg>", "<div></div>", "<svg a=\"1></svg>", "<svg>"]){ let threw = false; try { V.parseSvg(bad); } catch (e){ threw = e.name === "SvgParseError"; } ok(threw, "no parse error for " + bad); }
  ok(V.parseSvg('<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "b">]><!-- c --><svg a="x &amp; y"><![CDATA[z]]></svg>').attrs.a === "x & y", "prolog, entities, CDATA");

  // Ramer-Douglas-Peucker and simplification of traced paths
  ok(V.rdp([[0, 0], [1, .01], [2, 0], [3, 5], [4, 0]], .1).length === 4, "rdp keeps the peak and drops the wobble");
  const pts = []; for (let i = 0; i < 3000; i++){ const a = i / 3000 * 2 * Math.PI; pts.push((300 + 200 * Math.cos(a) + Math.sin(i * 7) * .05).toFixed(2) + " " + (400 + 200 * Math.sin(a)).toFixed(2)); }
  const tr = V.transformSvg(`<svg viewBox="0 0 600 800" width="6in"><path fill="none" stroke="#333" stroke-width="1" d="M${pts.join(" L")} Z"/></svg>`, { tier:2 });
  ok(tr.report.simplifiedPaths === 1 && tr.report.pointsAfter < 150, `traced circle simplified to ${tr.report.pointsAfter} points`);

  // fill-drawn line art gets outlines to reach the weight; holes count as holes
  const ring = r => `M${300 + r} 400 A${r} ${r} 0 1 1 ${300 - r} 400 A${r} ${r} 0 1 1 ${300 + r} 400 Z`;
  const fr = V.transformSvg(`<svg viewBox="0 0 600 800" width="6in"><path fill="#000" fill-rule="evenodd" d="${ring(200)} ${ring(197)}"/></svg>`, { tier:3 });
  ok(fr.report.thickenedFills === 1 && Math.abs(fr.report.measuredBasePx - 2.87) < .1, `fill thickening: base ${fr.report.measuredBasePx}, thickened ${fr.report.thickenedFills}`);

  // color, opacity and Tier 3 details
  const m = V.transformSvg('<svg viewBox="0 0 300 400"><g transform="scale(2)" style="stroke:#c33;stroke-width:.8" fill="#9cf" opacity=".7"><rect x="10" y="10" width="100" height="100" style="fill:#fc9"/><circle cx="60" cy="150" r="3"/><circle cx="90" cy="150" r="2" fill="#111"/><path d="M10 180 q 5 -5 10 0"/></g></svg>', { tier:3, printWidthIn:6 });
  ok(!/opacity|#c33|#9cf|#fc9|#111/.test(m.svg), "colors and opacity normalized: " + m.svg);
  ok(m.report.droppedDetails === 2 && /r="2"/.test(m.svg), "Tier 3 drops the small white circle and the squiggle but keeps the black dot");
  ok(V.transformSvg('<svg viewBox="0 0 300 400"><circle cx="60" cy="150" r="3" fill="#fff" stroke="#000"/></svg>', { tier:1, printWidthIn:6 }).report.droppedDetails === 0, "Tier 1 keeps small details");

  // page frame and gutter math (points)
  const f1 = V.pageFrame({ unit:"pt" }), f2 = V.pageFrame({ unit:"pt", duplex:true, pageNumber:2 });
  ok(f1.width === 612 && f1.height === 792 && f1.margins.left === 54 && f1.margins.right === 36 && f1.margins.top === 36 && f1.margins.bottom === 36, "letter page, 0.75 in gutter, 0.5 in margins");
  ok(f1.gutterSide === "left" && f2.gutterSide === "right" && f2.margins.right === 54 && f2.holes[0].cx === 612 - 27, "two-sided pages mirror the gutter and holes");
  ok(JSON.stringify(f1.holes.map(h => h.cy)) === "[90,396,702]" && f1.holes[0].r === 11.25, "three-hole punch positions");
  const art = V.fitArt(V.pageFrame(), { reserveTop:1, reserveBottom:.75 });
  ok(Math.abs(art.w / art.h - .75) < 1e-9 && art.x >= .75 && art.x + art.w <= 8 + 1e-9 && art.y >= 1.5, "art box is 3:4 inside the frame");

  // legends
  ok(V.legendSvg("off", 7) === "" && V.legendHeightIn("off") === 0, "legend off");
  for (const mode of ["anxiety-reduction", "high-contrast"]){
    const s = V.legendSvg(mode, 7);
    ok(V.parseSvg(s).name === "svg" && V.LEGENDS[mode].swatches.every(sw => s.includes(sw.hex)), mode + " legend SVG");
    const calls = []; const doc = new Proxy({}, { get:(o, k) => (...a) => { calls.push([k, ...a]); } });
    const h = V.drawLegendPdf(doc, mode, 54, 700, 504);
    ok(h === 54 && calls.filter(c => c[0] === "roundedRect").length === V.LEGENDS[mode].swatches.length + 1, mode + " legend PDF");
  }
  // the side-column legend: fits its column, draws every swatch, never runs off the page
  ok(V.legendColumnSvg("off") === "" && V.legendColumnHeightIn("off") === 0, "legend column off");
  ok(JSON.stringify(V.wrapText("Anxiety Reduction Mode", 13)) === '["Anxiety","Reduction","Mode"]' && V.wrapText("", 10).length === 0, "wrapText");
  for (const mode of ["anxiety-reduction", "high-contrast"]){
    const s = V.legendColumnSvg(mode), root = V.parseSvg(s), h = V.legendColumnHeightIn(mode);
    ok(root.name === "svg" && V.LEGENDS[mode].swatches.every(sw => s.includes(sw.hex)) && root.attrs.width === "1.25in", mode + " legend column SVG");
    ok(h > 2 && h < 6, `${mode} legend column is ${h} in tall`);
    const calls = []; const doc = new Proxy({}, { get:(o, k) => (...a) => { calls.push([k, ...a]); } });
    const hp = V.drawLegendColumnPdf(doc, mode, 500, 200);
    ok(Math.abs(hp - h * 72) < 1e-9 && calls.filter(c => c[0] === "roundedRect").length === V.LEGENDS[mode].swatches.length + 1, mode + " legend column PDF");
    const texts = calls.filter(c => c[0] === "text");
    ok(texts.every(c => c[2] >= 500 && c[2] <= 500 + 90 && c[3] >= 200 && c[3] <= 200 + hp), mode + " legend column text stays inside its box");
    ok(V.LEGENDS[mode].swatches.every(sw => texts.some(c => c[1] === sw.name)), mode + " legend column names every color");
  }

  // any SVG into a PDF as vectors: transforms, inherited paint, even-odd rings, black and white only
  const rec = () => { const calls = []; return { calls, doc:new Proxy({}, { get:(o, k) => k === "then" ? undefined : (...a) => { calls.push([k, ...a]); } }) }; };
  const A = rec(), sv = V.drawSvgPdf(A.doc, '<svg viewBox="0 0 100 200"><g transform="translate(10 20)" stroke="#123" stroke-width="2" fill="#eee"><rect x="0" y="0" width="10" height="10"/><path d="M0 50 L20 50" fill="none"/></g><circle cx="50" cy="100" r="5" fill="none" stroke="none"/><path fill="#000" fill-rule="evenodd" d="M0 0 H10 V10 H0 Z M2 2 H8 V8 H2 Z"/></svg>', 72, 72, 144);
  ok(sv.paths === 3, "drawSvgPdf paths: " + sv.paths);
  const mv = A.calls.find(c => c[0] === "moveTo");
  ok(mv && Math.abs(mv[1] - (72 + 10 * 1.44)) < 1e-9 && Math.abs(mv[2] - (72 + 20 * 1.44)) < 1e-9, "drawSvgPdf applies the viewBox scale and group transform: " + mv);
  ok(A.calls.some(c => c[0] === "setLineWidth" && Math.abs(c[1] - 2.88) < 1e-9), "drawSvgPdf scales line widths");
  ok(A.calls.filter(c => c[0] === "setFillColor" || c[0] === "setDrawColor").every(c => (c[1] === 0 || c[1] === 255) && c[1] === c[2] && c[2] === c[3]), "drawSvgPdf paints only black and white");
  ok(A.calls.filter(c => c[0] === "fillStroke").length === 1 && A.calls.filter(c => c[0] === "stroke").length === 1 && A.calls.filter(c => c[0] === "fillEvenOdd").length === 1, "drawSvgPdf fill, stroke and even-odd operators");
  const lib1 = files.find(f => /-t3\.svg$/.test(f)), B = rec(), big = V.drawSvgPdf(B.doc, fs.readFileSync(lib1, "utf8"), 54, 108, 504);
  ok(big.paths > 5 && big.ms < 150, `drawSvgPdf on ${path.basename(lib1)}: ${big.paths} paths in ${big.ms} ms`);
  const xs = B.calls.filter(c => c[0] === "moveTo" || c[0] === "lineTo").map(c => c[1]);
  ok(Math.min(...xs) >= 54 - 1e-6 && Math.max(...xs) <= 54 + 504 + 1e-6, "drawSvgPdf keeps a library page inside its box");

  ok(V.LEGENDS["anxiety-reduction"].swatches.every(s => /blue|sea|sage|fern/i.test(s.name)), "calming legend is blues and greens");
  ok(V.LEGENDS["high-contrast"].swatches.some(s => /yellow/i.test(s.name)) && V.LEGENDS["high-contrast"].swatches.some(s => /navy/i.test(s.name)), "high-contrast legend has yellow and navy");
  sandbox.__dveWorst = worst;
});

if (fails.length){ console.log(`services check FAILED: ${fails.length} problem(s), ${pass} passed\n  - ` + fails.slice(0, 30).join("\n  - ")); process.exit(1); }
console.log(`services check passed: ${pass} checks (${tscNote}; slowest page ${sandbox.__dveWorst} ms)`);
