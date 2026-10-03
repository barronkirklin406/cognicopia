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
const sandbox = { console, TextEncoder, TextDecoder }; sandbox.globalThis = sandbox; vm.createContext(sandbox);
const OUT = path.join(ROOT, "assets", "services");
fs.readdirSync(OUT).filter(f => f.endsWith(".js")).sort().forEach(f => vm.runInContext(fs.readFileSync(path.join(OUT, f), "utf8"), sandbox, { filename:"assets/services/" + f }));
const V = sandbox.CogniVectorEngine;

/* Emergency print: profile choice, direct resident action, and isolated page */
group("emergencyPrint", () => {
  const profileHtml = fs.readFileSync(path.join(ROOT, "profile.html"), "utf8");
  const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const builderHtml = fs.readFileSync(path.join(ROOT, "builder.html"), "utf8");
  ok(/name="preselectedDeescalationActivity"/.test(profileHtml), "profile form exposes the emergency activity choice");
  ok(/preselectedDeescalationActivity:\s*text\("rapSootheActivity"\)/.test(profileHtml) &&
     /preselectedDeescalationActivity:\s*p\.preselectedDeescalationActivity/.test(profileHtml), "profile choice is saved and restored");
  ok(/id="arbSoothe"[^>]*>[\s\S]*?Instant Soothe \/ Print/.test(indexHtml) &&
     /builder\.html\?emergency=/.test(indexHtml), "active resident card links directly to emergency print");
  ok(/requested[\s\S]*?allowed\.includes\(requested\)[\s\S]*?:\s*"line-tracing"/.test(builderHtml), "unknown or missing activity falls back to line tracing");
  ok(/difficulty = \["", "early", "moderate", "advanced"\]\[tier\]/.test(builderHtml), "support tiers map to matching activity load");
  ok(/const item = \{ activityId:activity\.id,[\s\S]*?count:1[\s\S]*?generatePdf\(\[item\]/.test(builderHtml), "emergency print contains exactly one page");
  ok(/function generatePdf\(items, printOptions\)[\s\S]*?items = Array\.isArray\(items\) \? items : queue;[\s\S]*?root\.innerHTML = items\.map\(item => sheetHtml\(item, calmMode\)\)/.test(builderHtml), "emergency pages print separately without changing the saved queue");
  ok(/printEmergencyActivity[\s\S]*?generatePdf\(\[item\], \{ emergency:true, calmMode:false/.test(builderHtml) &&
     /printPanicPacket\(\)[\s\S]*?calmMode:false/.test(builderHtml), "resident-specific and fixed emergency packets bypass the queued-page calm override");
  ok(/CG_STORE_READY\.then\(\(\) => \{[\s\S]*?router\(\);[\s\S]*?printEmergencyActivity\(emergencyResidentId\)/.test(builderHtml), "emergency action waits for secure storage before loading the resident");
});

group("panicPacket", () => {
  const builderHtml = fs.readFileSync(path.join(ROOT, "builder.html"), "utf8");
  ok(/id="panicButton"[^>]*>[\s\S]*?Sundowning \/ Rapid De-escalation/.test(builderHtml), "panic button is prominent in the Packet Builder top bar");
  ok(/const PANIC_PACKET = \[[\s\S]*?activityId:"line-tracing", cfg:\{ difficulty:"advanced"[\s\S]*?activityId:"lyric-sheet"[\s\S]*?difficulty:"advanced"[\s\S]*?emergencySongTitle:"Take Me Out to the Ball Game"/.test(builderHtml), "panic payload is fixed to late-tier tracing and a known public-domain sing-along");
  ok(/function printPanicPacket\(\)\s*\{\s*generatePdf\(buildPanicPacket\(\), \{ emergency:true/.test(builderHtml), "panic print goes straight to the isolated PDF pipeline");
  ok(/emergencySongTitle[\s\S]*?this\.pool\(cfg\)\.find\(s => s\.title === cfg\.emergencySongTitle\)/.test(builderHtml), "panic lyric page deterministically uses the selected public-domain song");
  ok(/function tactilePairingFor\(activity, page, cfg\)[\s\S]*?page\.sensoryPairing[\s\S]*?activity\.sensoryPairing/.test(builderHtml), "activity and generated-page models accept explicit sensory pairings");
  ok(/cinnamon or vanilla extract[\s\S]*?Check allergies, scent sensitivities and facility guidance first/.test(builderHtml), "baking-themed pairing includes a scent prompt and safety check");
  ok(/item\.cfg\.difficulty === "advanced" \? tactilePairingFor/.test(builderHtml) && /For staff · Sensory Prompt:/.test(builderHtml), "only late-tier sheets append the labeled sensory prompt");
  ok(/PANIC_PACKET\.map\(page => \(\{[\s\S]*?batchSeed:newSeed\(\)[\s\S]*?count:1/.test(builderHtml), "panic print creates fresh, one-copy recipes without queue writes");
});

group("sundowningCalmAndCoachingFooter", () => {
  const builderHtml = fs.readFileSync(path.join(ROOT, "builder.html"), "utf8");
  const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const coaching = "Do not ask questions or test memory. Sit beside them, place the marker in their hand, and model slow, calm breathing.";
  ok(/id="calmModeToggle"[^>]*aria-pressed="false"[\s\S]*?Late-Stage \/ Sundowning Calm/.test(builderHtml), "calm mode has a high-visibility, accessible Packet Builder toggle");
  ok(/if \(calmMode == null \? sundowningCalmActive : calmMode\) return `<section class="sheet sheet-calm"[\s\S]*?stroke-width="6pt"[\s\S]*?stroke-dasharray/.test(builderHtml), "calm mode replaces activity content with one maximum-weight dashed path");
  ok(/function sheetHtml\(item\)[\s\S]*?activitySheetHtml\(item\)[\s\S]*?care-coaching-footer/.test(builderHtml), "the shared queued-print wrapper adds the coaching footer");
  ok(builderHtml.includes(coaching) && indexHtml.includes(coaching), "the exact coaching reminder is included in both activity print pipelines");
  ok(/function coachingFooter\(\)[\s\S]*?this\.d\.text\("Do not ask questions or test memory\./.test(indexHtml), "main PDF pages draw the coaching footer from the shared document engine");
});

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

  // the Cognicopia Coloring engine prints with the same numbers
  const cc = { console }; cc.globalThis = cc; vm.createContext(cc);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "assets", "cognicopia-coloring", "lineart.js"), "utf8"), cc);
  [1, 2, 3].forEach(k => { const w = cc.CognicopiaColoring.WEIGHTS[cc.CognicopiaColoring.TIERS[k].weight], L = V.tierLines(k, 3);
    ok(w.px === L.linePx && Math.abs(w.pt - L.linePt) < 1e-9 && Math.abs(w.detailPt - L.detailPt) < 1e-9, `Cognicopia Coloring tier ${k} weights ${w.px} px / ${w.detailPt} pt differ from the DVE ${L.linePx} px / ${L.detailPt} pt`); });

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

/* 4. Secure store: sealing, migration, passphrase, locked files, aliases.
   Each "page" is a fresh copy of the built script in its own context,
   sharing one IndexedDB and one localStorage, as tabs of a browser do. */
function fakeIndexedDB(){
  const dbs = new Map(), later = fn => setTimeout(fn, 0);
  const request = () => ({ onsuccess:null, onerror:null, result:undefined, error:null });
  function database(rec){
    return {
      objectStoreNames:{ contains:n => rec.stores.has(n) },
      createObjectStore(n){ rec.stores.set(n, new Map()); },
      transaction(names, mode){
        names = [].concat(names);
        names.forEach(n => { if (!rec.stores.has(n)) throw new Error("no store " + n); });
        const snapshot = new Map(names.map(n => [n, new Map(rec.stores.get(n))])), queue = [];
        const t = { oncomplete:null, onerror:null, onabort:null, error:null, done:false,
          abort(){ if (t.done) return; t.done = true; snapshot.forEach((m, n) => rec.stores.set(n, m)); later(() => t.onabort && t.onabort({})); },
          objectStore(n){
            if (!names.includes(n)) throw new Error("store not in transaction");
            const op = fn => { if (t.done) throw new Error("transaction finished"); const r = request(); queue.push([r, fn]); return r; };
            const m = () => rec.stores.get(n), ro = () => { if (mode !== "readwrite") throw new Error("read-only transaction"); };
            return {
              get:k => op(() => m().get(k)),
              getAll:() => op(() => Array.from(m().values())),
              getAllKeys:() => op(() => Array.from(m().keys())),
              put:(v, k) => { ro(); return op(() => { m().set(k, v); return k; }); },
              delete:k => { ro(); return op(() => { m().delete(k); }); },
              clear:() => { ro(); return op(() => { m().clear(); }); }
            };
          } };
        const run = () => later(() => {
          if (t.done) return;
          const next = queue.shift();
          if (!next){ t.done = true; t.oncomplete && t.oncomplete({}); return; }
          const [r, fn] = next;
          try { r.result = fn(); r.onsuccess && r.onsuccess({}); } catch (e){ r.error = e; r.onerror && r.onerror({}); t.error = e; t.abort(); return; }
          run();
        });
        run();
        return t;
      }
    };
  }
  return { dbs, open(name, version){
    const r = request(); r.onupgradeneeded = null; r.onblocked = null;
    later(() => {
      let rec = dbs.get(name); const upgrade = !rec || rec.version < version;
      if (!rec){ rec = { version, stores:new Map() }; dbs.set(name, rec); }
      r.result = database(rec);
      if (upgrade){ rec.version = version; r.onupgradeneeded && r.onupgradeneeded({}); }
      r.onsuccess && r.onsuccess({});
    });
    return r;
  } };
}
function fakeLocalStorage(){
  const m = new Map();
  return { m, getItem:k => m.has(k) ? m.get(k) : null, setItem:(k, v) => { m.set(String(k), String(v)); }, removeItem:k => { m.delete(k); },
    key:i => Array.from(m.keys())[i] ?? null, get length(){ return m.size; } };
}
const SECURE_JS = fs.readFileSync(path.join(OUT, "secureStore.js"), "utf8");
function page(shared){
  const ctx = { console, TextEncoder, TextDecoder, setTimeout, clearTimeout, performance, btoa, atob, crypto:shared.crypto === undefined ? globalThis.crypto : shared.crypto,
    indexedDB:shared.idb, localStorage:shared.ls };
  ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(SECURE_JS, ctx, { filename:"assets/services/secureStore.js" });
  return ctx.CogniSecureStore;
}
async function secureStoreChecks(){
  const idb = fakeIndexedDB(), ls = fakeLocalStorage(), shared = { idb, ls };
  const profile = (id, name, unit, updatedAt) => ({ schema:"cognicopia.residentProfile", version:2, id, updatedAt, tier1_core:{ preferredName:name, unitNumber:unit }, tier2_enrichment:{}, tier3_deep:{ notes:"Loves the rose garden" } });
  // plain copies from before the store existed
  ls.setItem("cognicopia_resident_r1", JSON.stringify(profile("r1", "Margaret Ellison", "302-b", "2026-09-01T00:00:00Z")));
  ls.setItem("cognicopia_profile_draft", JSON.stringify({ v:1, data:{ preferredName:"Walter" } }));
  ls.setItem("cognicopia_license", "abc");
  const A = page(shared), st = await A.ready();
  ok(st.state === "open" && st.encrypted && !st.passphrase && st.migrated === 2 && st.records === 2, "first open seals the plain copies: " + JSON.stringify(st));
  ok(A.isSealed("cognicopia_engagement_r1"), "tablet engagement notes are classified as sealed records");
  ok(ls.getItem("cognicopia_resident_r1") === null && ls.getItem("cognicopia_profile_draft") === null && ls.getItem("cognicopia_license") === "abc", "plain copies removed, other names left alone");
  ok(JSON.parse(A.storage.getItem("cognicopia_resident_r1")).tier1_core.preferredName === "Margaret Ellison", "sealed profile reads back");
  const recs = idb.dbs.get("cognicopia-secure").stores.get("records");
  const raw = Array.from(recs.values()).map(r => Buffer.from(r.data).toString("latin1")).join("");
  ok(recs.size === 2 && !/Margaret Ellison|Walter"|rose garden/.test(raw), "records are ciphertext at rest");
  const ring = idb.dbs.get("cognicopia-secure").stores.get("keyring").get("ring");
  ok(ring.mode === "device" && ring.key.extractable === false && ring.key.algorithm.name === "AES-GCM" && ring.key.algorithm.length === 256, "device key: non-extractable AES-256-GCM");
  // the localStorage stand-in
  A.storage.setItem("cognicopia_license", "xyz"); A.storage.setItem("cognicopia_resident_r2", JSON.stringify(profile("r2", "Ruth Adams", "", "2026-09-02T00:00:00Z")));
  ok(ls.getItem("cognicopia_license") === "xyz" && ls.getItem("cognicopia_resident_r2") === null, "only unsealed names reach localStorage");
  const names = []; for (let i = 0; i < A.storage.length; i++) names.push(A.storage.key(i));
  ok(names.includes("cognicopia_license") && names.includes("cognicopia_resident_r2") && names.includes("cognicopia_resident_r1") && names.length === 4, "key(i) and length cover both: " + names);
  A.storage.removeItem("cognicopia_profile_draft");
  await A.flush();
  ok(recs.size === 2 && recs.has("cognicopia_resident_r2") && !recs.has("cognicopia_profile_draft"), "writes and removals persist on flush");
  ok(A.entries("cognicopia_resident_").map(e => e[0]).join() === "cognicopia_resident_r1,cognicopia_resident_r2", "entries by prefix");
  // a second page sees the same records
  const B = page(shared); await B.ready();
  ok(JSON.parse(B.storage.getItem("cognicopia_resident_r2")).tier1_core.preferredName === "Ruth Adams" && B.status().migrated === 0, "another page opens the sealed records");
  // tampering and swapping are refused
  const r1 = recs.get("cognicopia_resident_r1"), saved = new Uint8Array(r1.data.slice(0));
  new Uint8Array(r1.data)[5] ^= 1;
  const C = page(shared), cs = await C.ready();
  ok(cs.unreadable === 1 && C.storage.getItem("cognicopia_resident_r1") === null, "a changed record does not open");
  new Uint8Array(r1.data).set(saved);
  recs.set("cognicopia_resident_r9", recs.get("cognicopia_resident_r2"));
  const D = page(shared), ds = await D.ready();
  ok(ds.unreadable === 1 && D.storage.getItem("cognicopia_resident_r9") === null && D.storage.getItem("cognicopia_resident_r1") !== null, "a record moved to another name does not open");
  recs.delete("cognicopia_resident_r9");
  // passphrase: set, lock, wrong, right, remove
  let threw = ""; try { await D.setPassphrase("short"); } catch (e){ threw = e.message; }
  ok(/at least 10/.test(threw), "short passphrases refused");
  const P = "a quiet morning by the lake";
  await D.setPassphrase(P, 60);
  const pr = idb.dbs.get("cognicopia-secure").stores.get("keyring").get("ring");
  ok(pr.mode === "passphrase" && pr.rounds === 600000 && !pr.key && pr.wrapped.byteLength === 48, "passphrase ring keeps only the wrapped key");
  const E = page(shared), es = await E.ready();
  ok(es.state === "open" && es.passphrase && es.unlockedUntil > Date.now() && E.storage.getItem("cognicopia_resident_r1") !== null, "unlocked for the chosen time on this computer");
  await E.lock();
  const F = page(shared), fs0 = await F.ready();
  ok(fs0.state === "locked" && F.storage.getItem("cognicopia_resident_r1") === null && F.storage.getItem("cognicopia_license") === "xyz", "locked: sealed names read as empty, others still work");
  let lockedErr = ""; try { F.storage.setItem("cognicopia_resident_r3", "{}"); } catch (e){ lockedErr = e.name; }
  ok(lockedErr === "LockedError", "locked: writes are refused, not lost silently");
  ok(await F.unlock("not the passphrase") === false && F.status().state === "locked", "the wrong passphrase does not open");
  ok(await F.unlock(P, 0) === true && JSON.parse(F.storage.getItem("cognicopia_resident_r1")).tier1_core.preferredName === "Margaret Ellison", "the right passphrase opens");
  const G = page(shared); ok((await G.ready()).state === "locked", "\"this page only\" leaves other pages locked");
  // photos: sealed in their own store, read only when asked for, resealed with the key, cleared on wipe
  const photo = "data:image/jpeg;base64," + "QUJD".repeat(5000);
  await F.putBlob("cognicopia_heirloom_photo_p1", photo);
  const blobs = idb.dbs.get("cognicopia-secure").stores.get("blobs");
  ok(blobs.size === 1 && !Buffer.from(blobs.get("cognicopia_heirloom_photo_p1").data).toString("latin1").includes("QUJDQUJD"), "photos are ciphertext at rest");
  const Fp = page(shared); await Fp.ready().catch(() => null); if (Fp.status().state === "locked") await Fp.unlock(P, 0);
  ok(await Fp.getBlob("cognicopia_heirloom_photo_p1") === photo && !Fp.storage.getItem("cognicopia_heirloom_photo_p1") && Fp.status().records === F.status().records, "photos open on request and are not loaded with the records");
  ok(JSON.stringify(await F.blobNames("cognicopia_heirloom_photo_")) === '["cognicopia_heirloom_photo_p1"]', "photo names by prefix");
  let notSealed = ""; try { await F.putBlob("cc_photo", "x"); } catch (e){ notSealed = e.message; } ok(/Not a sealed name/.test(notSealed), "photos need a sealed name");
  await F.removePassphrase(P);
  const H = page(shared), hs = await H.ready();
  ok(await H.getBlob("cognicopia_heirloom_photo_p1") === photo, "photos survive a change of key");
  ok(hs.state === "open" && !hs.passphrase && H.storage.getItem("cognicopia_resident_r2") !== null, "passphrase removed: back to the device key, nothing lost");
  const Lk = page(shared); await Lk.ready(); await Lk.setPassphrase("another quiet morning here", 0);
  const Lk2 = page(shared); await Lk2.ready();
  let lockedBlob = ""; try { await Lk2.getBlob("cognicopia_heirloom_photo_p1"); } catch (e){ lockedBlob = e.name; } ok(lockedBlob === "LockedError", "locked: photos are refused");
  ok(await Lk2.unlock("another quiet morning here", 0) && await Lk2.getBlob("cognicopia_heirloom_photo_p1") === photo, "unlocked: the photo opens under the new key");
  await Lk2.wipe();
  ok(blobs.size === 0 && (await Lk2.blobNames("")).length === 0, "wipe clears photos too");
  // no IndexedDB or Web Crypto: plain localStorage, and it says so
  const U = page({ idb:undefined, ls:fakeLocalStorage() }), us = await U.ready();
  U.storage.setItem("cognicopia_resident_x", "{}");
  ok(us.state === "unavailable" && !us.encrypted && U.storage.getItem("cognicopia_resident_x") === "{}", "falls back to localStorage when it cannot encrypt");
  let noPhotos = ""; try { await U.putBlob("cognicopia_heirloom_photo_x", "x"); } catch (e){ noPhotos = e.message; } ok(/Photos need/.test(noPhotos), "without encryption, photos are refused rather than kept in plain storage");
  // locked files: the packet tool's own lock and unlock open these, and the reverse
  const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), a = idx.indexOf('const LOCKED_FORMAT="cognicopia-locked"'), b = idx.indexOf("function downloadBlob", a);
  const pt = { crypto:globalThis.crypto, TextEncoder, TextDecoder, btoa, atob, window:{ crypto:globalThis.crypto, TextEncoder } }; pt.globalThis = pt; vm.createContext(pt);
  vm.runInContext(idx.slice(a, b).replace(/^const /gm, "var ") + "\nthis.lockData = lockData; this.unlockData = unlockData;", pt);
  const env1 = await H.sealFile({ hello:"world" }, P, "resident");
  ok(JSON.stringify(await pt.unlockData(env1, P)) === '{"hello":"world"}', "the packet tool opens this store's locked files");
  const env2 = await pt.lockData({ n:1 }, P, "residents");
  ok(JSON.stringify(await H.openFile(env2, P)) === '{"n":1}', "this store opens the packet tool's locked files");
  let bad = ""; try { await H.openFile(env2, "nope nope nope"); } catch (e){ bad = e.message; } ok(bad === "passphrase", "wrong passphrase reported");
  // station handoff
  const here = [profile("r1", "Margaret Ellison", "302-B", "2026-09-01T00:00:00Z"), profile("r2", "Ruth Adams", "", "2026-09-05T00:00:00Z")];
  const there = [profile("r1", "Margaret Ellison", "302-B", "2026-09-03T00:00:00Z"), profile("r2", "Ruth A.", "", "2026-09-04T00:00:00Z"), profile("r4", "Joe Park", "12", "2026-09-04T00:00:00Z"), { schema:"x" }];
  const file = await H.exportRoster(there, P, "Maple Unit station", "Evening shift");
  ok(file.kind === "residents" && file.format === "cognicopia-locked" && !/Margaret Ellison|Joe Park/.test(JSON.stringify(file)), "roster file is locked");
  const got = await H.readRoster(JSON.stringify(file), P);
  ok(got.profiles.length === 3 && got.handoff.station === "Maple Unit station", "roster reads back its valid profiles");
  const plain = await H.readRoster(JSON.stringify({ format:"cognicopia.residentBackup", version:1, profiles:[...there] }), "");
  ok(plain.profiles.length === 3 && plain.skipped === 1, "plain backups read, invalid entries skipped");
  const m = H.mergeRoster(here, got.profiles, "newer");
  ok(m.added === 1 && m.updated === 1 && m.kept === 1 && m.write.map(p => p.id).join() === "r1,r4", "newer copy wins: " + JSON.stringify({ a:m.added, u:m.updated, k:m.kept }));
  ok(H.mergeRoster(here, got.profiles, "skip").write.length === 1 && H.mergeRoster(here, got.profiles, "replace").write.length === 3, "skip and replace");
  let kindErr = ""; try { await H.readRoster(JSON.stringify(env1), P); } catch (e){ kindErr = e.message; } ok(kindErr === "kind", "a single-resident file is not taken for a roster");
  // aliases
  ok(H.aliasFor(profile("r1", "Margaret", "302-b")) === "Resident 302-B", "alias from the unit");
  ok(H.aliasFor({ id:"r1", tier1_core:{ preferredName:"Margaret", alias:"Rose Room 4" } }) === "Rose Room 4", "staff's own alias");
  const code = H.aliasFor({ id:"abc123", tier1_core:{ preferredName:"Margaret" } });
  ok(/^Resident [2-9A-HJ-NP-Z]{4}$/.test(code) && code === H.aliasFor({ id:"abc123", tier1_core:{} }) && code !== H.aliasFor({ id:"abc124", tier1_core:{} }), "stable code alias: " + code);
  ok(H.displayName(profile("r1", "Margaret", "7"), false) === "Margaret" && H.displayName(profile("r1", "Margaret", "7"), true) === "Resident 7", "displayName");
  // speed: 300 residents open well inside the page budget
  const big = { idb:fakeIndexedDB(), ls:fakeLocalStorage() }, filler = "x".repeat(3000);
  for (let i = 0; i < 300; i++) big.ls.setItem("cognicopia_resident_p" + i, JSON.stringify(Object.assign(profile("p" + i, "Resident " + i, String(i)), { filler })));
  await page(big).ready();
  const T = page(big), ts = await T.ready();
  ok(ts.records === 300 && ts.ms < 150, `300 sealed residents open in ${ts.ms} ms`);
  sandbox.__storeMs = ts.ms;
}
try { await secureStoreChecks(); } catch (e){ fails.push("secureStore: threw " + (e.stack || e)); }

/* 5. Reminiscence engine: the knowledge base, the wording, and decks for many residents. */
group("reminiscenceEngine", () => {
  const R = sandbox.CogniReminiscence;
  ok(R && typeof R.deck === "function", "CogniReminiscence is not loaded");
  const cc = { console }; cc.globalThis = cc; vm.createContext(cc);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "assets", "cognicopia-coloring", "cognicopia-coloring.js"), "utf8"), cc);
  const designs = new Set(cc.CognicopiaColoring.designs().map(d => d.id)), songIds = new Set(R.SONGS.map(x => x.id));
  ok(songIds.size === R.SONGS.length, "song ids are unique");
  const texts = [];
  for (const t of R.TOPICS){
    ok(t.invite.length === 3 && t.invite.every(Boolean), t.id + ": three invitations");
    ok(t.starters.length >= 4 && t.simple.length >= 3, t.id + ": at least 4 starters and 3 tier-3 lines");
    ok(t.simple.filter(x => x !== t.invite[2]).length >= 3, t.id + ": 3 tier-3 lines besides the invitation");
    ok(t.art.length && t.art.every(a => designs.has(a)), t.id + ": art from the Cognicopia Coloring library: " + t.art.filter(a => !designs.has(a)));
    ok(t.touch.prompt && t.touch.simple && t.touch.items, t.id + ": a tactile prompt");
    ok((t.songs || []).every(x => songIds.has(x)), t.id + ": songs exist");
    ok(t.refs.every(r => r.years[0] >= 1850 && r.years[0] <= r.years[1] && r.years[1] <= 2000), t.id + ": reference years");
    ok(t.refs.every(r => !r.states || r.states.every(st => /^[A-Z]{2}$/.test(st))), t.id + ": state codes");
    texts.push(...t.invite, ...t.starters, ...t.simple, t.touch.prompt, t.touch.simple);
  }
  ok(R.SONGS.every(x => x.year === 0 || (x.year >= 1880 && x.year <= 1990)), "song years");
  const bad = texts.map(x => [x, R.toneProblems(x)]).filter(x => x[1].length);
  ok(!bad.length, "wording: " + JSON.stringify(bad.slice(0, 3)));
  ok(R.toneProblems("Do you remember your first car?").length && R.toneProblems("Good girl, honey.").length && !R.toneProblems("Tell me about your first car.").length, "the wording check itself");
  // places
  const po = R.placeOf("Wheeling, West Virginia"), pd = R.placeOf("Dayton, OH"), px = R.placeOf("Guadalajara");
  ok(po.region.code === "appalachia" && po.state === "WV" && pd.region.code === "midwest" && pd.state === "OH" && !px.region, "places: " + JSON.stringify([po.state, pd.state]));
  // residents
  const P = o => ({ id:o.id, tier1_core:{ preferredName:o.name || "Pat", cognitiveTier:o.tier || 2, occupation:{ code:o.job || "" }, primaryVocation:o.voc ? { code:o.voc } : null,
    topicsToAvoid:{ topics:(o.avoid || []).map(code => ({ code })) }, topHobbies:(o.hobbies || []).map(code => ({ code })) },
    tier2_enrichment:{ birthYear:o.by, region:o.region ? { code:o.region } : null, hometown:{ environment:{ code:o.env || "" }, place:o.place || "" },
      music:{ genres:(o.genres || []).map(code => ({ code })), artists:o.artists || [], favoriteSong:o.fav || "" },
      military:o.mil ? { branch:{ code:"army" }, talkingAboutIt:{ code:o.mil } } : {} } });
  ok(R.person(P({ by:1938, env:"rural", place:"Ames, Iowa" })).placeLabel === "Rural Midwest" && R.person(P({ by:1938, env:"city", place:"Brooklyn, NY" })).placeLabel === "Urban Northeast", "\"Rural Midwest\", \"Urban Northeast\"");
  ok(R.person(P({ job:"nurse" })).vocation.code === "nursing" && R.person(P({ job:"cook" })).vocation.code === "culinary" && R.person(P({ job:"farmer", voc:"mechanic" })).vocation.code === "mechanic", "vocations from occupation, or chosen");
  const topicById = Object.fromEntries(R.TOPICS.map(t => [t.id, t])), songById = Object.fromEntries(R.SONGS.map(x => [x.id, x]));
  const refIndex = new Map(); R.TOPICS.forEach(t => t.refs.forEach(r => refIndex.set(t.id + "|" + r.text, r)));
  const envs = ["rural", "small-town", "city", "coastal", "mountains", "abroad", ""], places = ["Ames, Iowa", "Brooklyn, NY", "Macon, Georgia", "Minot, ND", "Burlington, Vermont", "Austin, Texas", "Boise, Idaho", "Seattle, WA", "Wheeling, WV", "Toronto, Ontario", ""];
  const avoids = [[], ["driving"], ["war", "home"], ["medical", "religion", "water"], ["children", "money", "death"]];
  let n = 0, decks = 0;
  for (const v of R.VOCATIONS) for (const tier of [1, 2, 3]) for (let k = 0; k < 4; k++){
    const by = 1928 + (n * 7) % 30, env = envs[n % envs.length], place = env === "abroad" ? "" : places[n % places.length], avoid = avoids[n % avoids.length];
    const mil = ["welcome", "gentle", "avoid", ""][n % 4], job = v.occupations[0] || "other";
    const prof = P({ id:"r" + n, by, env, place, avoid, job, tier, mil, genres:[["country"], ["motown"], ["latin"], []][n % 4], hobbies:[["fishing"], ["gardening", "animals"], [], ["sports"]][n % 4], fav:n % 5 === 0 ? "Moon River" : "" });
    n++;
    const d = R.deck(prof, { count:6 }), who = d.person; decks++;
    const tag = `${v.code} T${tier} b.${by} ${env}/${place} avoid ${avoid} mil ${mil}`;
    ok(d.cards.length >= 3, tag + ": at least 3 cards, got " + d.cards.length);
    ok(new Set(d.cards.map(c => c.topic)).size === d.cards.length, tag + ": no card twice");
    ok(new Set(d.cards.map(c => c.song.title)).size === d.cards.length, tag + ": no song twice: " + d.cards.map(c => c.song.title));
    if (v.code !== "general" && !(topicById[R.TOPICS.find(t => (t.vocations || []).includes(v.code)).id].avoid || []).some(a => avoid.includes(a)) && (v.code !== "military" || mil === "welcome" || mil === "gentle" || mil === ""))
      ok(d.cards.some(c => c.kind === "work"), tag + ": a card about their work");
    for (const c of d.cards){
      const t = topicById[c.topic];
      ok(c.starters.length === 3 && c.starters.every(Boolean) && new Set(c.starters).size === 3, tag + " " + c.topic + ": three different starters");
      ok(!!c.song.title && !!c.touch.prompt && !!c.touch.safety, tag + " " + c.topic + ": a song and a touch prompt");
      ok(!(t.avoid || []).some(a => avoid.includes(a)), tag + ": avoided topic " + c.topic);
      const sg = songById[c.song.id]; if (sg) ok(!(sg.avoid || []).some(a => avoid.includes(a)), tag + ": avoided song " + sg.id);
      if (sg && sg.year) ok(sg.year >= by - 40 && sg.year <= by + 50, tag + ": song far from their years " + sg.id);
      if (c.topic === "letters-home") ok(mil === "welcome" || mil === "gentle" || (mil === "" && v.code === "military"), tag + ": service topic without a welcome");
      ok(c.starters.concat([c.invite]).every(x => !R.toneProblems(x).length), tag + ": wording");
      if (tier === 3) ok(c.starters.every(x => x !== c.invite), tag + ": tier 3 repeats its invitation");
      for (const rt of c.refs){
        const r = refIndex.get(c.topic + "|" + rt);
        ok(!!r, "unknown ref " + rt);
        if (!r) continue;
        ok(r.years[0] <= who.life[1] && r.years[1] >= who.life[0], tag + ": reference outside their lifetime: " + rt);
        if (r.states) ok(r.states.includes(who.state), tag + ": a state reference for someone from elsewhere: " + rt);
        else if (r.regions) ok(who.region && r.regions.includes(who.region.code), tag + ": a regional reference for someone from elsewhere: " + rt);
        else if (who.region && who.region.code === "abroad") ok(r.anywhere, tag + ": a North American reference for someone raised abroad: " + rt);
        ok(!(r.avoid || []).some(a => avoid.includes(a)), tag + ": avoided reference " + rt);
      }
    }
  }
  const fav = R.deck(P({ id:"f", by:1940, fav:"Moon River" }), { count:6 });
  ok(fav.cards[0].song.title === "Moon River" && fav.cards.filter(c => /moon river/i.test(c.song.title)).length === 1, "their favorite song first, and only once");
  const a1 = JSON.stringify(R.deck(P({ id:"x", by:1940, job:"teacher" }), { seed:"1" }).cards), a2 = JSON.stringify(R.deck(P({ id:"x", by:1940, job:"teacher" }), { seed:"1" }).cards), a3 = JSON.stringify(R.deck(P({ id:"x", by:1940, job:"teacher" }), { seed:"2" }).cards);
  ok(a1 === a2 && a1 !== a3, "decks repeat for the same seed and vary for another");
  const t0 = performance.now(); for (let i = 0; i < 500; i++) R.deck(P({ id:"p" + i, by:1930 + i % 30, job:"mechanic", place:"Ames, Iowa", env:"rural" }), { count:8 });
  const per = (performance.now() - t0) / 500;
  ok(per < 5, `a deck takes ${per.toFixed(2)} ms`);
  sandbox.__remStats = `${decks} decks checked, ${per.toFixed(2)} ms each`;
});



/* 6. SLP clinical service: staging to tiers, code checks, and notes made only of what staff recorded. */
group("slpClinicalService", () => {
  const K = sandbox.CogniClinical;
  ok(K && typeof K.soapPages === "function", "CogniClinical is not loaded");
  ok(K.GDS_STAGES.map(x => x.code).join() === "1,2,3,4,5,6,7", "GDS stages 1-7");
  ok(K.FAST_STAGES.map(x => x.code).join() === "1,2,3,4,5,6a,6b,6c,6d,6e,7a,7b,7c,7d,7e,7f", "FAST stages 1 to 7f");
  for (const t of K.TIER_STAGES){
    t.gds.forEach(g => ok(K.tierForStage({ gds:g }).tier === t.tier, `GDS ${g} -> Tier ${t.tier}`));
    t.fast.forEach(f => ok(K.tierForStage({ fast:f }).tier === t.tier, `FAST ${f} -> Tier ${t.tier}`));
  }
  const tiers = [["1", 1], ["2", 1], ["3", 1], ["4", 1], ["5", 2], ["6", 3], ["7", 3]];
  tiers.forEach(([g, t]) => ok(K.tierForStage({ gds:g }).tier === t, "GDS " + g));
  ["7a", "7c", "7f"].forEach(f => { const m = K.tierForStage({ fast:f }); ok(m.tier === 3 && m.beyond && /sensory/.test(m.note), "FAST " + f + " is past printed pages"); });
  const dis = K.tierForStage({ gds:"4", fast:"6b" });
  ok(dis.tier === 3 && !dis.agree && /Review/.test(dis.note), "GDS and FAST disagree: more support, flagged");
  ok(K.tierForStage({}).tier === null && K.tierForStage({ gds:"9", fast:"8z" }).tier === null, "no stage, or not a stage: no tier");
  // the code reference
  const c97124 = K.codeRef("97124"), c97130 = K.codeRef("97130");
  ok(c97124 && !c97124.cognitive && /massage/i.test(c97124.summary) && /97129/.test(c97124.note), "97124 is flagged as massage, pointing to 97129/97130");
  ok(c97130.addOnTo === "97129" && K.codeRef("92507").timed === false && K.codeRef("96125").minutes === 60, "code facts");
  // checks
  const S = o => K.normalizeSession(Object.assign({ date:"2026-09-29", minutes:30, clinician:"Dana Ruiz", subjective:"Alert.", format:"individual" }, o));
  const has = (s, re, level) => K.checkSession(s).some(c => re.test(c.text) && (!level || c.level === level));
  ok(has(S({ codes:[{ code:"97124", units:1 }] }), /massage/, "stop"), "97124 stops");
  ok(has(S({ codes:[{ code:"97130", units:1 }] }), /add-on/, "stop"), "97130 alone stops");
  ok(!has(S({ codes:[{ code:"97129", units:1 }, { code:"97130", units:1 }] }), /add-on/), "97129 + 97130 is fine");
  ok(has(S({ codes:[{ code:"92508" }] }), /group/, "warn") && has(S({ format:"group", codes:[{ code:"92507" }] }), /92508/, "warn"), "individual vs group codes");
  ok(has(S({ format:"group", codes:[{ code:"97129" }] }), /one-on-one/), "97129 in a group");
  ok(has(S({ codes:[{ code:"96125", units:1 }] }), /instrument/) && !has(S({ codes:[{ code:"96125", units:1 }], measures:[{ task:"MoCA", trials:30, correct:21 }] }), /instrument/), "96125 asks for the instrument");
  ok(has(S({ codes:[{ code:"92507", units:3 }] }), /untimed/), "untimed code with units");
  ok(has(S({ minutes:20, codes:[{ code:"97129", units:1 }, { code:"97130", units:2 }] }), /units against the time/) && !has(S({ minutes:38, codes:[{ code:"97129", units:1 }, { code:"97130", units:1 }] }), /units against/), "units against minutes");
  ok(has(S({ date:"" }), /date/, "stop") && has(S({ minutes:"", codes:[{ code:"97129" }] }), /minutes/, "stop"), "date and minutes");
  ok(has(S({ subjective:"" }), /Nothing is recorded/), "an empty note is flagged");
  // cleaning, never adding
  const n = K.normalizeSession({ date:"2026-13-45", minutes:9999, subjective:"a\u0000b\r\nc", measures:[{ task:"x", trials:5, correct:9, cue:"super" }], codes:[{ code:"bad code!" }, { code:"97129", units:99 }], goals:"one\n\ntwo" });
  ok(n.date === "" && n.minutes === 480 && n.subjective === "ab\nc" && n.measures[0].correct === 5 && n.measures[0].cue === "" && n.codes.length === 1 && n.codes[0].units === 16 && n.goals.join("|") === "one|two", "sessions are cleaned and bounded: " + JSON.stringify(n).slice(0, 200));
  const empty = K.soapBlocks(S({ subjective:"", date:"2026-09-29" }), { residentName:"Ruth", unit:"", facility:"", staging:null, profileTier:2 });
  ok(["S", "O", "A", "P"].every(k => { const b = empty.find(x => x.key === k); return !b.recorded && b.paragraphs.join() === "Not recorded."; }), "empty sections say Not recorded, nothing else");
  const typed = { subjective:"Said she liked the barn.\nSmiled at the song.", assessment:"Engaged; benefits from visual cues.", plan:"Continue twice weekly.",
    measures:[{ task:"Naming", trials:8, correct:6, cue:"minimal", note:"after a model" }] };
  const blocks = K.soapBlocks(S(typed), { residentName:"Ruth", unit:"4", facility:"", staging:{ date:"2026-09-01", gds:"5", fast:"5", recordedBy:"Dr. Lee", note:"" }, profileTier:2 });
  const byKey = k => blocks.find(b => b.key === k).paragraphs;
  ok(byKey("S").join("\n") === typed.subjective && byKey("A").join("\n") === typed.assessment && byKey("P").join("\n") === typed.plan, "S, A and P are exactly what was typed");
  ok(byKey("O")[0] === "Naming: 6 of 8 trials (75%), minimal cues, after a model.", "O is the recorded numbers and their arithmetic: " + byKey("O")[0]);
  ok(/GDS 5 · FAST 5/.test(byKey("staging").join(" ")) && /Tier 2/.test(byKey("staging").join(" ")), "staging on file");
  // pages
  const one = K.soapPages(S(typed), { residentName:"Ruth", unit:"4", facility:"Maple Grove", staging:null, profileTier:2 });
  ok(one.length >= 1 && one.every((h, i) => h.includes(`Page ${i + 1} of ${one.length}`)) && one[one.length - 1].includes("slp-sign") && one.slice(0, -1).every(h => !h.includes("slp-sign")), "page numbers; signature lines on the last page only");
  const long = K.soapPages(S(Object.assign({}, typed, { subjective:"An observation sentence of ordinary length. ".repeat(160), assessment:"Interpretation. ".repeat(300) })), { residentName:"Ruth", unit:"", facility:"", staging:null, profileTier:null });
  ok(long.length >= 3 && long.some(h => /\(continued\)/.test(h)), "a long note continues on following pages: " + long.length);
  const pieces = K.paginate(K.soapBlocks(S(Object.assign({}, typed, { subjective:"word ".repeat(3000) })), { residentName:"", unit:"", facility:"", staging:null, profileTier:null }), 0.8);
  const L = K.LAYOUT;
  ok(pieces.every(pg => pg.reduce((h, p) => h + L.HEAD_IN + L.GAP_IN + p.text.length * L.LINE_IN, 0) <= L.PAGE_BODY_IN + 1e-9), "every page's estimated height fits");
  ok(K.soapPages(S(typed), { residentName:"Ruth", unit:"4", facility:"", staging:{ date:"2026-09-01", gds:"5", fast:"5", recordedBy:"Dr. Lee", note:"" }, profileTier:2 }).length === 1, "a typical note is one page");
  const xss = K.soapPages(S({ subjective:'<img src=x onerror="alert(1)">', clinician:"<b>x</b>" }), { residentName:"<script>", unit:"", facility:"", staging:null, profileTier:null }).join("");
  ok(!/<img|<script>|<b>x/.test(xss) && /&lt;img/.test(xss), "everything typed is escaped");
  const log = K.normalizeLog({ staging:[{ date:"2026-08-01", gds:"4" }, { date:"2026-09-01", gds:"5", fast:"5" }, { gds:"x" }], sessions:[S({ date:"2026-09-20", minutes:30 }), S({ date:"2026-09-02", minutes:45 }), S({ date:"2026-07-01", minutes:60 })] }, "r1");
  ok(log.staging.length === 2 && K.latestStaging(log).gds === "5" && log.sessions[0].date === "2026-07-01", "logs: staging kept, sorted by date");
  const sum = K.summaryPage(log, { residentName:"Ruth", unit:"4", facility:"", staging:K.latestStaging(log), profileTier:2 }, "2026-09-01", "2026-09-30");
  ok(/2 sessions, 75 minutes recorded/.test(sum) && /Tier 2/.test(sum), "summary counts the period");
});

/* 7. Heirloom: entries kept as recorded, the monthly digest, and the hardcover interior and cover. */
group("heirloomService", () => {
  const H = sandbox.CogniHeirloom;
  ok(H && typeof H.planBook === "function", "CogniHeirloom is not loaded");
  const e = H.normalizeEntry({ date:"2026-09-03", kind:"journal", text:"I  liked\tthe barn.\n\nIt was red.", title:"x".repeat(300), photo:"bad id!", tier:7, share:false });
  ok(e.text === "I liked the barn.\n\nIt was red." && e.title.length === 80 && !e.photo && e.tier === 2 && e.share === false, "entries are cleaned, never reworded: " + JSON.stringify(e.text));
  ok(H.normalizeEntry({ kind:"weird" }).kind === "moment" && H.normalizeEntry({ kind:"coloring", design:"red-barn" }).design === "red-barn" && H.normalizeEntry({ kind:"journal", design:"red-barn" }).design === "", "kinds and designs");
  ok(H.monthsBetween("2025-11", "2026-02").join() === "2025-11,2025-12,2026-01,2026-02" && H.monthLabel("2026-09") === "September 2026", "months");
  ok(JSON.stringify([10, 150, 151, 300, 301, 500, 700, 701].map(H.gutterFor)) === "[0.75,0.75,0.75,0.75,0.75,0.75,0.75,0.875]", "the gutter: 0.75 in, more past 700 pages");
  const kdp = H.PRINTERS.find(p => p.code === "kdp"), lulu = H.PRINTERS.find(p => p.code === "lulu");
  ok(H.padTo(10, lulu) === 24 && H.padTo(33, lulu) === 34 && H.padTo(10, kdp) === 76, "pages padded to the printer's minimum and an even count");
  const t6 = H.TRIMS.find(t => t.code === "6x9"), gk = H.bookGeometry(t6, kdp, 100), gl = H.bookGeometry(t6, lulu, 100);
  ok(gk.pageW === 6.125 && gk.pageH === 9.25 && gl.pageW === 6.25 && gl.pageH === 9.25, "KDP bleeds the outside edge only; Lulu all four sides");
  ok(gk.content(1).x === 0.75 && Math.abs(gk.content(2).x - 0.625) < 1e-9 && gk.content(2).x + gk.content(2).w === 6.125 - 0.75 && gl.content(1).x === 0.875, "the gutter is on the bound side of each page");
  // a year of entries
  const words = n => Array.from({ length:n }, (_, i) => ["We", "grew", "tomatoes", "by", "the", "porch", "and", "my", "mother", "canned", "every", "one"][i % 12]).join(" ");
  const raw = [];
  for (let m = 1; m <= 12; m++) for (let k = 0; k < 6; k++){
    const kind = ["journal", "reminiscence", "coloring", "moment"][k % 4];
    raw.push({ id:"e" + m + "x" + k, date:`2026-${String(m).padStart(2, "0")}-${String(3 + k * 4).padStart(2, "0")}`, kind, title:k % 2 ? "Sunday dinners" : "", text:words(10 + (k * 17 + m * 5) % 140), by:"Maria",
      card:kind === "reminiscence" ? "The Farm Year" : "", design:kind === "coloring" ? "red-barn" : "", photo:kind === "coloring" && k % 3 === 0 ? "p" + m + "x" + k : "", photoW:1200, photoH:1600, share:k !== 5 });
  }
  const K = H.normalizeKeeper({ entries:raw, dedication:"For Margaret." }, "r1");
  const sep = H.digestFor(K, "2026-09");
  ok(K.entries.length === 72 && sep.count === 5 && sep.sections[0].heading === "In Their Own Words", "a month's digest holds only shared entries, their words first");
  const deps = { photoAspect:() => 0.75 };
  const inside = (it, box) => it.t === "band" || (it.x >= box.x - 1e-6 && it.x + it.w <= box.x + box.w + 1e-6 && it.y >= box.y - 1e-6 && it.y + it.h <= box.y + box.h + 1e-6);
  const dg = H.planDigest({ residentName:"Margaret", facility:"Maple Grove", month:sep, coverDesign:"red-barn", coverTier:2 }, deps);
  ok(dg.length >= 2 && dg[0].kind === "cover" && dg.every((p, i) => p.items.every(it => inside(it, H.letterGeometry().content(i + 1)))), "the digest stays inside its margins");
  // every recorded word is there, as recorded
  const flat = dg.flatMap(p => p.items.filter(i => i.t === "text").map(i => i.lines.join(" "))).join(" ").replace(/\s+/g, " ");
  ok(sep.sections.flatMap(s => s.entries).every(en => flat.includes(en.text.replace(/\s+/g, " "))), "every shared entry's words appear exactly");
  ok(!flat.includes(K.entries.find(x => !x.share && x.date.startsWith("2026-09")).text), "an entry kept private stays out");
  for (const pr of H.PRINTERS) for (const tr of H.TRIMS.filter(t => t.printers.includes(pr.code))){
    const bk = H.planBook({ residentName:"Margaret", facility:"Maple Grove", months:H.bookFor(K, "2026-01", "2026-12"), dedication:"For Margaret.", title:"Margaret's Year", subtitle:"2026", coverDesign:"red-barn", coverTier:2 }, tr, pr, deps);
    const g = bk.geometry, tag = pr.code + " " + tr.code;
    ok(bk.pages.length === bk.padded && bk.pages.length % 2 === 0 && bk.pages.length >= pr.minPages, tag + ": page count " + bk.pages.length);
    ok(bk.pages.every((p, i) => p.items.every(it => inside(it, g.content(i + 1)))), tag + ": everything inside the safe area");
    ok(bk.pages.every((p, i) => p.kind !== "chapter" || i % 2 === 0), tag + ": chapters open on right-hand pages");
    ok(bk.pages[bk.pages.length - 1].kind === "colophon" && bk.pages[0].kind === "title", tag + ": title page first, closing page last");
  }
  // drawing
  const calls = []; const doc = new Proxy({}, { get:(o, k) => (...a) => { calls.push([k, ...a]); } });
  const drawn = dg.reduce((n, p) => n + H.drawPage(doc, p, { art:(d, id, t, x, y, w) => { calls.push(["art", id, t, x, y, w]); }, photoData:id => id === "p9x0" ? "data:image/jpeg;base64,AAAA" : null, font:"helvetica" }), 0);
  ok(drawn > 10 && calls.some(c => c[0] === "text") && calls.some(c => c[0] === "art" && c[1] === "red-barn") && calls.every(c => c[0] !== "addImage" || c[1].startsWith("data:image/jpeg")), "pages draw as text, vector art and JPEG photos");
  const html = H.pageHtml({ kind:"body", items:[{ t:"text", x:1, y:1, w:5, h:1, lines:['<img src=x onerror=alert(1)>'], size:12, lead:.2 }] }, H.letterGeometry(), { art:() => "", photoUrl:() => "" });
  ok(!/<img src=x/.test(html) && /&lt;img/.test(html), "entries are escaped on the page");
  // cover
  const est = H.coverEstimate(t6, 120), spec = H.coverSpec(est);
  ok(Math.abs(spec.back.w + spec.spineBox.w + spec.front.w - spec.width) < 1e-9 && spec.front.x === spec.back.w + spec.spine, "cover: back, spine and front fill the width");
  const cp = H.planCover({ residentName:"Margaret", facility:"Maple Grove", months:[], dedication:"For Margaret, who taught us all to garden.", title:"Margaret's Year", subtitle:"2026", coverDesign:"red-barn", coverTier:2 }, spec);
  ok(cp.items.every(it => it.x >= spec.safe - 1e-9 && it.y >= spec.safe - 1e-9 && it.x + it.w <= spec.width - spec.safe + 1e-9 && it.y + it.h <= spec.height - spec.safe + 1e-9 && !(it.x < spec.front.x && it.x + it.w > spec.back.w)), "cover text and art stay in the safe area, off the spine");
  ok(H.coverSpec({ width:999, height:-1, spine:9, wrap:9 }).width === 40, "cover numbers are bounded");
});

/* 8. Facility planner: acuity tiers, recommendations, the month scheduler, moves, packets and exports. */
group("facilityPlanner", () => {
  const F = sandbox.CogniFacility;
  ok(F && typeof F.autoPopulate === "function", "CogniFacility is not loaded");
  const J = x => JSON.stringify(x);
  // acuity tiers and what each prints at
  ok(J(F.ACUITY.map(a => a.difficulty)) === '["early","moderate","advanced","moderate"]' && J(F.ACUITY.map(a => a.name)) === '["Mild Support","Moderate Engagement","Advanced Sensory","Universal Group"]', "the four tiers and their print levels");
  ok(F.acuityOf(0).tier === 2 && F.acuityOf(9).tier === 2 && F.acuityOf(NaN).tier === 2 && F.acuityOf(3).tier === 3 && F.acuityOf("4").tier === 4, "a value that is not a tier reads as Tier 2");
  ok(J(F.PILLARS.map(p => p.name)) === '["Coloring","Numbers","Words","Letters","Movement","Music"]', "the six pillars in their fixed order");
  // recommendations: something calibrated in every pillar at every tier, best fits first
  for (const t of [1, 2, 3, 4]){
    const rec = F.recommend(t);
    ok(rec.length === 6 && rec.every(r => r.recommended.length >= 1), `tier ${t}: a recommendation in every pillar`);
    ok(rec.every(r => r.recommended.every(a => a.tiers.includes(t)) && r.other.every(a => !a.tiers.includes(t))), `tier ${t}: recommended are calibrated for the tier, the rest are not`);
    ok(rec.every(r => r.recommended.length + r.other.length === F.CATALOG.filter(a => a.pillar === r.pillar.id).length), `tier ${t}: nothing lost`);
    if (t === 3) ok(rec.every(r => r.recommended[0].sensory), "tier 3 leads with sensory activities: " + rec.map(r => r.recommended[0].id));
    if (t === 4) ok(rec.every(r => r.recommended[0].group), "tier 4 leads with group activities: " + rec.map(r => r.recommended[0].id));
    ok(rec.every(r => !r.recommended.some((a, i) => i && r.recommended[0].best.indexOf(t) < 0 && a.best.indexOf(t) >= 0)), `tier ${t}: best fits first`);
  }
  const only = F.recommend(2, ["lyric-sheet", "word-search"]);
  ok(only.filter(r => r.recommended.length).map(r => r.pillar.id).join() === "words,music", "only activities this build has are offered");
  const morning = F.recommend(2, undefined, "morning"), late = F.recommend(2, undefined, "late");
  ok(morning.slice(0, 3).map(r => r.pillar.id).join() === "numbers,letters,movement", "10 AM pacing leads with higher-engagement pillars");
  ok(late.slice(0, 3).map(r => r.pillar.id).join() === "coloring,music,words", "5 PM pacing leads with calming pillars");
  const numberLoad = pacing => F.recommend(2, undefined, pacing).filter(r => r.pillar.id === "numbers")[0].recommended[0].id;
  ok(numberLoad("morning") === "number-ladder" && numberLoad("late") === "number-tracing", "pacing reorders activities within a pillar toward the selected cognitive load");
  // normalizing: bounds, a director always there, times cleaned
  const big = F.normalizeFacility({ wings:Array.from({ length:30 }, (_, i) => ({ id:"w" + i, name:"  Wing\u0007 " + i + "x".repeat(90), cadence:{ weekday:["25:00", "05:00", "10:00", "10:00", "09:00", "11:00", "13:00", "15:00", "16:00"], weekend:"no" },
    groups:Array.from({ length:20 }, (_, k) => ({ id:k % 2 ? "same" : "g" + k, name:"Group " + k, acuity:k % 6, size:k * 10 })) })), team:[{ id:"m1", name:"Pat", role:"coordinator", wings:["w1", "nope"] }], active:"ghost" });
  ok(big.wings.length === 24 && big.wings[0].name.length === 60 && !/[\u0000-\u001f]/.test(big.wings[0].name), "wings bounded, names cleaned");
  ok(J(big.wings[0].cadence.weekday) === '["09:00","10:00","11:00","13:00"]' && J(big.wings[0].cadence.weekend) === '["10:30"]', "session times checked, at most 4 a day: " + J(big.wings[0].cadence));
  const g0 = big.wings[0].groups;
  ok(g0.length === 12 && new Set(g0.map(g => g.id)).size === 12 && g0.every(g => [1, 2, 3, 4].includes(g.acuity) && g.size >= 1 && g.size <= 60), "groups bounded, ids unique, tiers and sizes valid");
  ok(big.team[0].role === "director" && big.active === big.team[0].id && J(big.team[1].wings) === '["w1"]', "a director is always there; team wings must exist");
  // permissions
  const demo = F.demoFacility(), dir = demo.team[0], coord = demo.team[1], staff = demo.team[2];
  ok(F.can(dir, "manageTeam") && F.can(coord, "editSchedule", "w-mcw") && !F.can(coord, "editSchedule", "w-ale") && !F.can(coord, "manageWings")
    && F.can(staff, "print", "w-ale") && !F.can(staff, "editSchedule", "w-ale") && !F.can(staff, "view", "w-mcw"), "roles: director everything, coordinators their wings, staff view and print");
  ok(F.visibleWings(demo, coord).map(w => w.id).join() === "w-mcw" && F.visibleWings(demo, dir).length === 2, "each role sees its wings");
  const au = F.withAudit(demo, "Changed tier", "Sensory Room to Tier 2", new Date("2026-11-02T10:00:00Z"));
  ok(au.audit.length === 1 && au.audit[0].who === "Activity Director" && demo.audit.length === 0, "changes are written to the audit trail");
  // dates
  ok(F.monthDays("2026-11").length === 30 && F.monthDays("2028-02").length === 29 && F.monthDays("2026-13").length === 0, "month days");
  ok(F.weekOf("2026-11-01").start === "2026-10-26" && F.weekOf("2026-11-02").start === "2026-11-02" && F.shiftMonth("2026-12", 1) === "2027-01", "weeks start on Monday");
  for (const m of ["2026-02", "2026-11", "2027-02", "2026-08"]){
    const grid = F.monthGrid(m), flat = grid.flat();
    ok(grid.length >= 4 && grid.length <= 6 && grid.every(w => w.length === 7 && F.weekday(w[0].date) === 1) && flat.filter(d => d.inMonth).length === F.monthDays(m).length, m + ": the grid is whole weeks from Monday");
  }
  ok(F.fmtTime("14:30") === "2:30 PM" && F.fmtTime("00:05") === "12:05 AM", "times read as clock times");
  // the month, filled in one click
  const wing = demo.wings[0], month = "2026-11", days = F.monthDays(month);
  const t0 = Date.now(), plan = F.autoPopulate({ v:1, wing:wing.id, month, slots:[] }, wing, { seed:"a" }), fillMs = Date.now() - t0;
  const perDay = d => F.isWeekend(d) ? wing.cadence.weekend.length : wing.cadence.weekday.length;
  const expect = days.reduce((n, d) => n + perDay(d), 0);
  const tierOf = new Map(wing.groups.map(g => [g.id, g.acuity]));
  const checkPlan = (p, tag, fresh) => {
    for (const g of wing.groups){
      const mine = p.slots.filter(s => s.group === g.id), b = F.balance(p, [g.id]);
      ok(mine.length === expect, `${tag} ${g.name}: ${mine.length} sessions, expected ${expect}`);
      ok(b.spread <= 1 && b.covered === days.length, `${tag} ${g.name}: pillars within one session of each other (${J(b.counts)}), every day covered`);
      ok(days.every(d => { const ps = mine.filter(s => s.date === d).map(s => s.pillar); return new Set(ps).size === ps.length; }), `${tag} ${g.name}: never the same pillar twice in a day`);
      ok(mine.every(s => F.fitsTier(s.activity, tierOf.get(s.group))), `${tag} ${g.name}: every activity calibrated for the group's tier`);
      for (const r of F.recommend(g.acuity)){
        if (!fresh || r.recommended.length < 2) continue;       // a locked session can pin the same activity next to one
        const seq = mine.filter(s => s.pillar === r.pillar.id).map(s => s.activity);
        ok(seq.every((a, i) => !i || a !== seq[i - 1]), `${tag} ${g.name} ${r.pillar.id}: an activity is not repeated back to back when another fits`);
      }
    }
  };
  checkPlan(plan, "fill", true);
  ok(J(F.autoPopulate({ v:1, wing:wing.id, month, slots:[] }, wing, { seed:"a" })) === J(plan) && J(F.autoPopulate({ v:1, wing:wing.id, month, slots:[] }, wing, { seed:"b" }).slots.map(s => s.activity)) !== J(plan.slots.map(s => s.activity)), "the same seed fills the same month; another seed, another month");
  ok(F.planIssues(plan, wing).length === 0, "a filled month has nothing to flag");
  // calming pillars late in the day
  const late = F.normalizeWing({ id:"w-late", name:"Late", groups:[{ id:"g1", acuity:2 }, { id:"g2", acuity:4 }], cadence:{ weekday:["09:30", "16:30"], weekend:["09:30", "16:30"] } });
  const lp = F.autoPopulate({ v:1, wing:"w-late", month, slots:[] }, late, { seed:"x" }), lateS = lp.slots.filter(s => s.time === "16:30");
  const calm = lateS.filter(s => ["music", "coloring", "words"].includes(s.pillar)).length;
  ok(calm > lateS.length - calm, `late sessions lean calming: ${calm} of ${lateS.length}`);
  // three a day: the day's pillars are balanced first, then the calming ones go last
  const three = F.normalizeWing({ id:"w-3", name:"Three", groups:[{ id:"g1", acuity:2 }, { id:"g2", acuity:1 }], cadence:{ weekday:["10:00", "14:30", "16:15"], weekend:[] } });
  const tp = F.autoPopulate({ v:1, wing:"w-3", month, slots:[] }, three, { seed:"t" }), last = tp.slots.filter(s => s.time === "16:15");
  const calm3 = last.filter(s => ["music", "coloring", "words"].includes(s.pillar)).length, first3 = tp.slots.filter(s => s.time === "10:00"), energy = first3.filter(s => ["movement", "numbers", "letters"].includes(s.pillar)).length;
  ok(calm3 >= last.length * 0.8 && energy >= first3.length * 0.6 && three.groups.every(g => F.balance(tp, [g.id]).spread <= 1), `three a day: ${calm3} of ${last.length} late sessions calming, ${energy} of ${first3.length} morning ones energizing, still balanced`);
  // locked sessions stay; other groups untouched
  const locked = plan.slots.filter((s, i) => i % 9 === 0).map(s => Object.assign({}, s, { locked:true }));
  const withLocks = Object.assign({}, plan, { slots:plan.slots.map(s => locked.find(l => l.id === s.id) || s) });
  const refill = F.autoPopulate(withLocks, wing, { seed:"c" });
  ok(locked.every(l => refill.slots.some(s => J(s) === J(l))), "every locked session is kept exactly");
  checkPlan(refill, "refill");
  const one = F.autoPopulate(withLocks, wing, { seed:"d", groups:["g-sensory"] });
  ok(J(one.slots.filter(s => s.group === "g-garden")) === J(withLocks.slots.filter(s => s.group === "g-garden")), "filling one group leaves the others as they were");
  ok(F.clearUnlocked(withLocks).slots.length === locked.length && F.clearUnlocked(withLocks, ["g-sensory"]).slots.every(s => s.locked || s.group === "g-garden"), "clearing keeps locked sessions");
  // moves and swaps
  const a = plan.slots.find(s => s.group === "g-sensory" && s.date === "2026-11-02" && s.time === "10:00"), b2 = plan.slots.find(s => s.group === "g-sensory" && s.date === "2026-11-04" && s.time === "10:00");
  const mv = F.moveSlot(plan, a.id, "2026-11-04", undefined, true);
  const a2 = mv.plan.slots.find(s => s.id === a.id), b3 = mv.plan.slots.find(s => s.id === b2.id);
  ok(mv.swapped && mv.swapped.id === b2.id && a2.date === "2026-11-04" && b3.date === "2026-11-02" && a2.locked && b3.locked && mv.plan.slots.length === plan.slots.length, "moving onto a group's session swaps the two, and locks both");
  ok(F.moveSlot(plan, a.id, "2026-12-01").plan === plan && F.moveSlot(plan, a.id, a.date).plan === plan && F.moveSlot(plan, "nope", "2026-11-03").plan === plan, "moves outside the month, onto itself or of nothing change nothing");
  const mt = F.moveSlot(plan, a.id, "2026-11-03", "11:15");
  ok(!mt.swapped && mt.plan.slots.find(s => s.id === a.id).time === "11:15" && !mt.plan.slots.find(s => s.id === a.id).locked, "a move to a free time just moves");
  // editing a session
  const clash = Object.assign({}, a, { date:b2.date });
  ok(F.updateSlot(plan, clash) === plan && F.clashOf(plan, clash).id === b2.id, "an edit onto the group's other session is refused");
  ok(F.updateSlot(plan, Object.assign({}, a, { activity:"not-real" })) === plan && F.updateSlot(plan, Object.assign({}, a, { date:"2026-11-31" })) === plan, "bad activities and days are refused");
  const added = F.updateSlot(plan, { id:"s-new1", date:"2026-11-02", time:"19:00", group:"g-sensory", pillar:"numbers", activity:"lyric-sheet", locked:true, note:"Bring the song cards. ".repeat(20) });
  const ns = added.slots.find(s => s.id === "s-new1");
  ok(added.slots.length === plan.slots.length + 1 && ns.pillar === "music" && ns.note.length === 140 && ns.locked, "adding a session: its pillar follows its activity, notes are bounded");
  ok(F.removeSlot(added, "s-new1").slots.length === plan.slots.length, "removing a session");
  // a changed tier shows up as sessions to look at again
  const moved = F.normalizeWing(Object.assign({}, wing, { groups:wing.groups.map(g => g.id === "g-sensory" ? Object.assign({}, g, { acuity:1 }) : g) }));
  const issues = F.planIssues(plan, moved);
  ok(issues.length > 0 && issues.every(i => i.kind === "tier" && plan.slots.find(s => s.id === i.slot).group === "g-sensory"), "after a tier change the sessions that no longer fit are flagged");
  const lockOne = Object.assign({}, plan, { slots:plan.slots.map(s => s.id === issues[0].slot ? Object.assign({}, s, { locked:true }) : s) });
  const rc = F.recalibrate(lockOne, moved);
  ok(rc.changed === issues.length - 1 && F.planIssues(rc.plan, moved).map(i => i.slot).join() === issues[0].slot, "recalibrating swaps every unlocked session that no longer fits, and leaves the locked one: " + rc.changed + " of " + issues.length);
  ok(rc.plan.slots.every((s, i) => { const o = lockOne.slots.find(x => x.id === s.id); return o && o.date === s.date && o.time === s.time && o.pillar === s.pillar && o.group === s.group; }) && J(F.balance(rc.plan).counts) === J(F.balance(plan).counts), "recalibrating keeps every day, time and pillar, so the balance too");
  ok(F.demoFacility().example === true && F.normalizeFacility({}).example === false && F.normalizeFacility({ example:"yes" }).example === false, "the example community is marked as such");
  const dup = F.updateSlot(plan, { id:"s-dup", date:a.date, time:"19:00", group:a.group, pillar:a.pillar, activity:a.activity, locked:false, note:"" });
  ok(F.planIssues(dup, wing).some(i => i.kind === "repeat" && i.slot === "s-dup"), "a pillar twice in a day is flagged");
  // plans read back from storage are checked
  const np = F.normalizePlan({ slots:plan.slots.concat([Object.assign({}, a, { id:"s-x1" }), Object.assign({}, a, { id:"s-x2", date:"2026-10-31" }), Object.assign({}, a, { id:"s-x3", activity:"zzz", time:"08:00" }), Object.assign({}, a, { id:"s-x4", group:"g-gone", time:"08:00" })]) }, wing.id, month, wing.groups.map(g => g.id));
  ok(np.slots.length === plan.slots.length, "stored plans drop duplicates, other months, unknown activities and removed groups: " + np.slots.length);
  // a week's packets
  const wk = F.weekOf("2026-11-09"), master = F.weekPackets(wing, plan.slots, wk.start, "master"), each = F.weekPackets(wing, plan.slots, wk.start, "each");
  const weekSessions = wk.days.reduce((n, d) => n + perDay(d), 0);
  ok(master.length === 2 && master.every(p => p.sessions.length === weekSessions && p.pages === 1 + weekSessions), "a week's master packets: a cover and a page per session, per group");
  ok(each.every(p => p.pages === 1 + weekSessions * p.group.size && p.tier.tier === p.group.acuity), "copies for every participant");
  ok(F.weekPackets(wing, plan.slots, "2026-12-14", "master").length === 0, "a week with nothing scheduled prints nothing");
  // exports
  ok(F.toCSV([["=SUM(A1)", "a,b", 'say "hi"', -5, "+1", "line\nbreak"]]) === `'=SUM(A1),"a,b","say ""hi""",-5,'+1,"line\nbreak"\r\n`, "CSV: quoted, and formulas neutralized: " + J(F.toCSV([["=SUM(A1)", "a,b", 'say "hi"', -5, "+1", "line\nbreak"]])));
  const longName = "Sing-along; Café classics, with \\ everyone \u2615 ".repeat(4);
  const ics = F.toICS([{ uid:"s-1", date:"2026-11-02", time:"23:50", minutes:30, summary:longName, description:"Line one\nLine two", category:"Music" }], "Memory Care West, November", new Date("2026-11-01T08:00:00Z"));
  const phys = ics.split("\r\n");
  ok(ics.endsWith("\r\n") && phys[0] === "BEGIN:VCALENDAR" && phys.includes("END:VCALENDAR") && phys.every(l => new TextEncoder().encode(l).length <= 75), "iCalendar: CRLF lines of at most 75 octets");
  const unfolded = ics.replace(/\r\n /g, "");
  ok(unfolded.includes("DTSTART:20261102T235000") && unfolded.includes("DTEND:20261103T002000") && unfolded.includes("DTSTAMP:20261101T080000Z") && unfolded.includes("UID:s-1@cognicopia.local"), "iCalendar: times, a session that ends after midnight, the stamp and uid");
  const BS = String.fromCharCode(92), icsText = t => t.split(BS).join(BS + BS).split(";").join(BS + ";").split(",").join(BS + ",");
  ok(unfolded.includes("SUMMARY:" + icsText(longName)) && unfolded.includes("DESCRIPTION:Line one" + BS + "nLine two") && unfolded.includes("X-WR-CALNAME:Memory Care West" + BS + ", November"), "iCalendar: text escaped and folded without losing a character");
  // a big community fills quickly
  const huge = F.normalizeWing({ id:"w-big", name:"Big", groups:Array.from({ length:12 }, (_, k) => ({ id:"g" + k, name:"Group " + k, acuity:1 + k % 4, size:20 })), cadence:{ weekday:["09:00", "11:00", "14:00", "16:00"], weekend:["09:00", "11:00", "14:00", "16:00"] } });
  const t1 = Date.now(), hp = F.autoPopulate({ v:1, wing:"w-big", month:"2026-12", slots:[] }, huge, { seed:"z" }), bigMs = Date.now() - t1;
  ok(hp.slots.length === 12 * 31 * 4 && hp.slots.length <= F.LIMITS.slots && huge.groups.every(g => F.balance(hp, [g.id]).spread <= 1), "12 groups, 4 sessions a day, 31 days: " + hp.slots.length + " sessions, balanced");
  ok(bigMs < 1000, "filling 1,488 sessions took " + bigMs + " ms");
  sandbox.__facStats = `a month for 2 groups in ${fillMs} ms, 1,488 sessions in ${bigMs} ms`;
});

/* 9. Academy: the catalog, lesson timing, progress, the knowledge check, certificates, records and printed pages. */
group("academy", () => {
  const A = sandbox.CogniAcademy;
  ok(A && typeof A.complete === "function", "CogniAcademy is not loaded");
  const J = x => JSON.stringify(x), pro = A.MODULES.filter(m => m.track === "pro"), fam = A.MODULES.filter(m => m.track === "family");
  // the catalog
  ok(pro.length >= 6 && fam.length >= 5 && new Set(A.MODULES.map(m => m.id)).size === A.MODULES.length, `catalog: ${pro.length} masterclasses, ${fam.length} family guides, unique ids`);
  ok(["Running Structured Reminiscence Circles", "Managing Sundowning Agitation", "Safe Movement Therapy in Wheelchairs"].every(t => pro.some(m => m.title === t)), "the three requested masterclasses are there");
  for (const m of A.MODULES){
    ok(m.chapters.length >= 3 && m.chapters.every(c => c.title && c.slide && c.say.length >= 2 && c.points.length >= 1 && c.slide.length <= 110), `${m.id}: chapters with titles, slides, narration and key points`);
    ok(m.instructor.name && m.instructor.focus && /^[A-Z]{2,3}$/.test(m.instructor.initials) && m.art && m.audience.every(a => A.AUDIENCES[a]) && m.topics.every(t => A.TOPICS[t]), `${m.id}: instructor badge, art, audiences and topics`);
    ok(m.video === null || (m.video && typeof m.video.src === "string"), `${m.id}: video is null or a local file`);
  }
  for (const m of pro){
    ok(m.quiz.length >= 5 && m.quiz.every(q => q.q && q.why && q.options.length >= 3 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length && new Set(q.options).size === q.options.length), `${m.id}: a knowledge check of ${m.quiz.length} questions, each with one right answer and an explanation`);
    ok(new Set(m.quiz.map(q => q.answer)).size >= 2, `${m.id}: the right answers are not always in the same place`);
    ok(m.tryThis.length && m.avoid.length && m.reflect.length && m.sources.length, `${m.id}: try this, avoid, reflect and sources for the companion guide`);
  }
  ok(fam.every(m => !m.quiz.length && m.toolkits.length && m.toolkits.every(id => A.toolkitOf(id))), "family guides have no quiz and link to toolkits that exist");
  ok(A.TOOLKITS.length >= 4 && A.TOOLKITS.every(t => t.sections.length >= 3 && t.sections.every(s => s.heading && (s.items || s.checks || s.lines || s.text))), "toolkits have sections to print");
  const bad = []; A.allText().forEach(t => A.LANGUAGE.forEach(r => { const hit = t.match(r.re); if (hit) bad.push(r.id + ": " + hit[0]); }));
  ok(bad.length === 0, "dignity-first language throughout: " + bad.slice(0, 5).join(", "));
  // lesson timing
  for (const m of A.MODULES){
    const c = A.cues(m), secs = A.lessonSeconds(m), t = A.minutes(m);
    ok(c.every((q, i) => !i || Math.abs(q.start - (c[i - 1].start + c[i - 1].dur)) < 0.11) && c.filter(q => q.title).length === m.chapters.length && Math.abs(secs - (c[c.length - 1].start + c[c.length - 1].dur)) < 0.11, `${m.id}: a continuous timeline with one title card a chapter`);
    ok(m.track === "pro" ? t.total % 5 === 0 && t.total >= secs / 60 + m.quiz.length : t.total <= 5 && secs <= 180, `${m.id}: training time ${t.total} min (lesson ${A.clock(secs)})`);
  }
  ok(A.clock(125) === "2:05" && A.spoken(65) === "1 minute 5 seconds" && A.spoken(0) === "0 seconds" && A.hoursText(75) === "1 h 15 min" && A.hoursText(720) === "12 h", "time formats");
  // learners
  let a = A.normalizeAcademy(null);
  ok(a.learners.length === 1 && a.active === a.learners[0].id, "there is always someone to learn as");
  let r = A.addLearner(a, "  Maria\u0007  Lopez ", "cna"); a = r.academy;
  const maria = r.id;
  ok(a.active === maria && A.learnerOf(a, maria).name === "Maria Lopez" && A.learnerOf(a, maria).role === "cna", "a learner is added, cleaned and made active");
  a = A.updateLearner(a, maria, "Maria López", "nurse"); ok(A.learnerOf(a, maria).role === "nurse" && A.learnerOf(a, maria).name === "Maria López", "a learner is renamed and given a role");
  a = A.updateLearner(a, maria, "Maria López", "cna");
  ok(A.removeLearner(A.normalizeAcademy(null), "l-me").learners.length === 1, "the last learner cannot be removed");
  // coverage, the knowledge check, completion
  const m = A.moduleOf("reminiscence-circles"), c = A.cues(m);
  ok(A.readiness(m, A.progressOf(a, maria, m.id)).missing.length === 2, "nothing done: both steps missing");
  ok(!A.complete(a, maria, m.id).ok, "completion is refused before the lesson and the check");
  const most = c.map(q => q.i).filter(i => i < c.length - 6);
  a = A.markPlayed(a, maria, m.id, most);
  const cov = A.coverage(m, A.progressOf(a, maria, m.id));
  ok(cov < A.WATCHED && cov > 0.5, `played through all but the last six lines: ${Math.round(cov * 100)}% is not yet watched`);
  a = A.markPlayed(a, maria, m.id, c.map(q => q.i).concat([999, -1, 2.5]));
  ok(A.coverage(m, A.progressOf(a, maria, m.id)) === 1 && A.progressOf(a, maria, m.id).played.length === c.length, "played through: 100%, and impossible lines are ignored");
  const right = m.quiz.map(q => q.answer), g5 = A.grade(m, right), g4 = A.grade(m, right.map((x, i) => i ? x : (x + 1) % 3)), g3 = A.grade(m, right.map((x, i) => i < 2 ? (x + 1) % 3 : x)), gNone = A.grade(m, []);
  ok(g5.passed && g5.score === 1 && g4.passed && Math.abs(g4.score - 0.8) < 1e-9 && !g3.passed && !gNone.passed && gNone.right === 0, "the knowledge check: 5/5 and 4/5 pass, 3/5 does not, unanswered is wrong");
  a = A.recordQuiz(a, maria, m.id, g3, new Date("2026-09-01T10:00:00Z"));
  ok(!A.readiness(m, A.progressOf(a, maria, m.id)).ready && A.progressOf(a, maria, m.id).quizAttempts === 1, "a failed attempt is counted and does not unlock completion");
  a = A.recordQuiz(a, maria, m.id, g4, new Date("2026-09-02T10:00:00Z"));
  a = A.recordQuiz(a, maria, m.id, g3, new Date("2026-09-03T10:00:00Z"));
  const pq = A.progressOf(a, maria, m.id);
  ok(pq.quizAttempts === 3 && Math.abs(pq.quizBest - 0.8) < 1e-9 && pq.quizPassedAt.startsWith("2026-09-02"), "best score and the first pass are kept");
  let done = A.complete(a, maria, m.id, new Date("2026-09-04T15:30:00Z")); a = done.academy;
  const pd = A.progressOf(a, maria, m.id);
  ok(done.ok && pd.completedAt.startsWith("2026-09-04") && pd.minutes === A.minutes(m).total && /^CA-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(pd.cert), "completed, with training minutes and a certificate ID: " + pd.cert);
  ok(A.complete(a, maria, m.id, new Date("2026-12-01T00:00:00Z")).academy === a, "completing again changes nothing");
  // a family guide: watching is enough, and there is no certificate
  const f = A.moduleOf("family-late-day");
  a = A.markRead(a, maria, f.id); done = A.complete(a, maria, f.id, new Date("2026-09-05T09:00:00Z")); a = done.academy;
  ok(done.ok && A.progressOf(a, maria, f.id).cert === "" && A.certificateFor(a, maria, f.id, "") === null, "a family guide completes once read, without a certificate");
  // certificates
  const ids = new Set([A.certificateId("l-a", "m1", "2026-01-01T00:00:00Z"), A.certificateId("l-b", "m1", "2026-01-01T00:00:00Z"), A.certificateId("l-a", "m2", "2026-01-01T00:00:00Z"), A.certificateId("l-a", "m1", "2026-01-02T00:00:00Z")]);
  ok(ids.size === 4 && A.certificateId("l-a", "m1", "2026-01-01T00:00:00Z") === A.certificateId("l-a", "m1", "2026-01-01T00:00:00Z"), "certificate IDs are stable and differ by learner, module and date");
  const cert = A.certificateFor(a, maria, m.id, "Maple Grove Senior Living");
  ok(cert && cert.learner === "Maria López" && cert.module === m.title && cert.minutes === pd.minutes && cert.approval === "", "a certificate carries the learner, the module and the time");
  const found = A.findCertificate(a, pd.cert.toLowerCase());
  ok(found && found.learner.id === maria && found.module.id === m.id && A.findCertificate(a, "CA-0000-0000") === null, "a certificate ID is found on this computer, and a wrong one is not");
  const withApproval = A.setApproval(a, "Approved for 0.25 contact hours by Example State Board, approval no. 12345 (example only)");
  ok(A.certificateFor(withApproval, maria, m.id, "").approval.startsWith("Approved for") && /not accredited/.test(A.NOT_ACCREDITED), "the certificate uses the facility's approval statement when there is one");
  // records
  const rec = A.yearRecord(a, maria, 2026);
  ok(rec.minutes === pd.minutes + A.progressOf(a, maria, f.id).minutes && rec.completed.length === 2 && A.yearRecord(a, maria, 2025).completed.length === 0, "a year's record adds up the training minutes");
  ok(A.years(a, new Date("2027-03-01T00:00:00Z")).join() === "2027,2026", "years with records, newest first");
  let b = A.addLearner(a, "=HYPERLINK(\"x\")", "cna").academy;
  const rows = A.recordRows(b, 2026);
  ok(rows.length === 3 && rows[0][0] === "Learner" && A.toCSV([["=cmd", "a,b", -5]]) === `'=cmd,"a,b",-5\r\n`, "records as rows; CSV neutralizes formulas");
  // stored records are checked
  const n = A.normalizeAcademy({ learners:[{ id:"x", name:"A" }, { id:"x", name:"B", role:"wizard" }], active:"nobody", progress:{ x:{ "reminiscence-circles":{ played:[0, 1, 1, 9999, "2"], quizBest:7, cert:"FAKE", completedAt:"soon" }, "no-such-module":{} } }, approval:"y".repeat(900) });
  const np = n.progress.x["reminiscence-circles"];
  ok(n.learners.length === 2 && n.learners[0].id !== n.learners[1].id && n.learners[1].role === "other-staff" && n.active === "x" && J(np.played) === "[0,1,2]" && np.quizBest === 1 && np.cert === "" && np.completedAt === "" && !n.progress.x["no-such-module"] && n.approval.length === 300,
    "stored records are cleaned: ids, roles, lines played, scores, certificate IDs, dates, unknown modules, the approval statement");
  // printed pages, with an approximate line breaker (the page uses the real font's widths)
  const approx = (text, width, size, bold) => { const cw = size * (bold ? 0.56 : 0.52), max = Math.max(1, Math.floor(width / cw)), out = []; let cur = "";
    String(text).split(/\s+/).filter(Boolean).forEach(wd => { while (wd.length > max){ if (cur){ out.push(cur); cur = ""; } out.push(wd.slice(0, max)); wd = wd.slice(max); } if ((cur ? cur + " " + wd : wd).length > max){ out.push(cur); cur = wd; } else cur = cur ? cur + " " + wd : wd; });
    if (cur || !out.length) out.push(cur); return out; };
  const width = o => String(o.text).length * (o.size || 11) * (o.bold ? 0.56 : 0.52);
  const inBounds = (pg, L) => pg.ops.every(o => o.t !== "text" || (o.align === "right" ? o.x - width(o) >= L - 1 : o.align === "center" ? o.x - width(o) / 2 >= L - 1 && o.x + width(o) / 2 <= pg.w - L + 1 : o.x >= L - 1 && o.x + width(o) <= pg.w - L + 1));
  let guidePages = 0;
  for (const mm of A.MODULES){
    const pages = A.layout(A.guideBlocks(mm), approx, mm.title);
    guidePages += pages.length;
    ok(pages.every(pg => inBounds(pg, 54) && pg.ops.every(o => o.y >= 54 && o.y <= 792 - 20)), `${mm.id}: guide text inside the margins on all ${pages.length} pages`);
    ok(pages.every((pg, i) => pg.ops.some(o => o.t === "text" && o.text === `Page ${i + 1} of ${pages.length}`)), `${mm.id}: every page numbered`);
    ok(pages.every(pg => { const body = pg.ops.filter(o => o.t === "text" && o.y < 792 - 54); const last = body[body.length - 1]; return !last || !(last.size === 14 && last.bold); }), `${mm.id}: no page ends with a heading`);
  }
  for (const t of A.TOOLKITS){ const pages = A.layout(A.toolkitBlocks(t), approx, t.title); ok(pages.length <= 2 && pages.every(pg => inBounds(pg, 54)), `${t.id}: toolkit on ${pages.length} page(s), inside the margins`); }
  // A heading never ends a page, and writing lines never start one without their heading, whatever the
  // font's widths: every guide and toolkit laid out with narrower and wider line breakers.
  const endsWithHeading = pg => { const body = pg.ops.filter(o => o.y < 792 - 54), last = body[body.length - 1]; return !!last && last.t === "text" && last.size === 14 && !!last.bold; };
  const startsWithLines = (pg, i) => i > 0 && (pg.ops[0] || {}).t === "rule" && pg.ops[0].y < 792 - 54;
  const scaled = f => (text, width, size, bold) => approx(text, width * f, size, bold);
  for (const f of [0.8, 0.9, 1, 1.1, 1.2]) for (const [id, blocks, title] of A.MODULES.map(mm => [mm.id, A.guideBlocks(mm), mm.title]).concat(A.TOOLKITS.map(t => [t.id, A.toolkitBlocks(t), t.title]))){
    const pages = A.layout(blocks, scaled(f), title);
    ok(!pages.some(endsWithHeading) && !pages.some(startsWithLines), `${id} (widths × ${f}): no heading ends a page, no page starts with writing lines`);
  }
  const overlaps = pg => { const t = pg.ops.filter(o => o.t === "text").map(o => ({ top:o.y - o.size * 0.8, bottom:o.y + o.size * 0.25, left:o.align === "center" ? o.x - width(o) / 2 : o.align === "right" ? o.x - width(o) : o.x, right:(o.align === "center" ? o.x - width(o) / 2 : o.align === "right" ? o.x - width(o) : o.x) + width(o) }));
    for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++){ const p = t[i], q = t[j]; if (p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom) return true; } return false; };
  const longest = pro.slice().sort((x, y) => y.title.length - x.title.length)[0];
  for (const [name, approval] of [["Maria López", ""], ["Bartholomew Alexander Montgomery-Fitzgerald the Third of Springfield", ""], ["Bartholomew Alexander Montgomery-Fitzgerald the Third of Springfield", "z".repeat(40) + " " + "Approved by an example board ".repeat(9)]]){
    const pg = A.certificatePage({ id:"CA-7K2M-9QXP", learner:name, role:A.ROLES.cna, module:longest.title, completed:"2026-09-04T15:30:00Z", minutes:15, score:0.8, facility:"The Very Long Named Senior Living Community of Springfield", approval }, approx);
    ok(pg.w === 792 && pg.h === 612 && inBounds(pg, 40) && pg.ops.every(o => o.t !== "text" || (o.y > 40 && o.y < 572)) && !overlaps(pg), `certificate (${name.length}-character name${approval ? ", long approval" : ""}): inside the frame, nothing overlapping`);
  }
  const calls = []; const doc = new Proxy({}, { get:(o, k) => (...args) => { calls.push(k); } });
  A.draw(doc, A.layout(A.guideBlocks(m), approx, m.title)[0]);
  ok(calls.includes("text") && calls.includes("setFont") && calls.includes("line"), "pages draw as text and lines");
  sandbox.__acadStats = `${pro.length} masterclasses, ${fam.length} family guides, ${guidePages} guide pages`;
});

/* ---------- 10. Clinical Science & Research Center (researchCenter.ts) ---------- */
group("researchCenter", () => {
  const R = sandbox.CogniResearch;
  ok(R && typeof R.boardPages === "function", "CogniResearch is not loaded");
  // content integrity: every citation resolves, every reference is used, every document is complete
  const bad = R.problems();
  ok(bad.length === 0, "content problems: " + bad.slice(0, 5).join("; "));
  ok(R.DOCS.length >= 10 && R.REFS.length >= 30, `library: ${R.DOCS.length} documents, ${R.REFS.length} references`);
  ["research", "whitepaper", "case", "regulation"].forEach(t => ok(R.DOCS.some(d => d.type === t), "a document of type " + t));
  R.LEVEL_ORDER.forEach(l => ok(R.DOCS.some(d => d.level === l), "a document rated " + l));
  // the two subjects the request named
  const eeg = R.docOf("pattern-drawing-eeg"), lv = R.docOf("low-vision-print");
  ok(eeg && R.refsOf(eeg).indexOf("usman2024") >= 0 && R.refsOf(eeg).indexOf("lin2026") >= 0, "the Zentangle EEG summary cites both EEG studies");
  ok(lv && ["wcag22", "aph_lp", "rubin1989", "owsley2007"].every(k => R.refsOf(lv).indexOf(k) >= 0), "the low-vision whitepaper cites WCAG, APH, Rubin & Legge and Owsley");
  // honesty: composites labeled, sources on every figure, limits on every document, no hype
  R.DOCS.forEach(d => {
    ok(d.takeaways.length >= 3 && d.takeaways.length <= 6 && d.limits.length >= 2 && d.practice.length >= 2, `${d.slug}: takeaways, practice and limits`);
    ok(d.type !== "case" || (d.level === "illustrative" && /composite/.test(d.scenario || "") && /no outcome data/.test(d.scenario || "")), `${d.slug}: a case scenario says it is a composite with no outcome data`);
    d.figures.forEach(f => ok(R.citeKeys(f.cite).length > 0, `${d.slug}: the figure "${f.value}" has a source`));
    const all = R.docTexts(d).join(" \n ");
    ok(!/\b(clinically proven|guaranteed?|miracle|breakthrough|cures?)\b/i.test(all), `${d.slug}: no hype words`);
    const proven = [...all.matchAll(/\bproven\b/gi)].every(m => /\b(no|not|never)\b[^.]{0,40}$/i.test(all.slice(Math.max(0, m.index - 48), m.index)));
    ok(proven, `${d.slug}: "proven" appears only in a negation`);
    ok(/[“"]rewires the brain[”"]/.test(all) || !/rewires the brain/i.test(all), `${d.slug}: "rewires the brain" only as a quoted example of what not to say`);
  });
  // citations: AMA style, short forms, order of first citation
  ok(R.formatRef(R.refOf("usman2024")) === "Usman M, Jung TP, Hsin DY, Lin CL. The effect of Zentangle on cognitive focus, emotional well-being, and stress levels: a neural perspective. Brain and Behavior. 2024;14(8):e3628. doi:10.1002/brb3.3628", "AMA format: " + R.formatRef(R.refOf("usman2024")));
  ok(R.formatRef(R.refOf("spector2003")).indexOf("Spector A, Thorgrimsen L, Woods B, et al. ") === 0, "seven authors print as three and et al");
  ok(R.formatRef(R.refOf("zhuo2025")).indexOf("Zhuo X, Yan Y, Lin R, et al. ") === 0, "a partial author list prints et al");
  ok(R.shortRef(R.refOf("usman2024")) === "Usman et al., 2024" && R.shortRef(R.refOf("chan2024")) === "Chan & Lo, 2024" && R.shortRef(R.refOf("strang2024")) === "Strang, 2024" && R.shortRef(R.refOf("owsley2007")) === "Owsley et al., 2007" && R.shortRef(R.refOf("nice2018")) === "NICE, 2018",
    "short citations");
  R.REFS.forEach(r => ok((!r.doi || /^10\.\d{4,9}\/\S+$/.test(r.doi)) && (!r.url || /^https:\/\//.test(r.url)) && r.title && (r.year || r.url), `${r.id}: a well-formed reference`));
  ok(JSON.stringify(R.citeKeys("a [@x; @y] b [@z]")) === '["x","y","z"]' && R.plain("Read [[low-vision-print|this]] now. [@x]") === "Read this now.", "citation and link markup");
  const first = R.refsOf(eeg);
  ok(first[0] === "usman2024" && first[1] === "lin2026", "references are numbered in the order they are first cited");
  // the board packet: the license price as the site states it, and only the facility's own figures otherwise
  const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), price = /const PRICE\s*=\s*"\$([\d.]+) a year"/.exec(idx);
  ok(price && Number(price[1]) === R.PRICE_PER_BUILDING, "the packet's price matches the site's: " + (price && price[1]));
  const w = R.worksheet(R.normalizeBoard({ buildings: 2, residents: "120", hoursNow: "10", hoursWith: "4", hourlyCost: "$24.50" }));
  ok(w.annualCost === 259.98 && w.perResidentMonth === 0.18 && w.hoursFreedWeek === 6 && w.hoursFreedYear === 312 && w.valueYear === 7644 && w.net === 7384.02, "worksheet: " + JSON.stringify(w));
  const blank = R.worksheet(R.normalizeBoard({}));
  ok(blank.annualCost === 129.99 && blank.perResidentMonth === null && blank.hoursFreedYear === null && blank.valueYear === null && blank.net === null, "a blank worksheet invents nothing");
  ok(R.worksheet(R.normalizeBoard({ hoursNow: 3, hoursWith: 5 })).hoursFreedWeek === 0, "more hours with the tool never reads as negative time");
  const n = R.normalizeBoard({ facility: "x".repeat(300), buildings: 0, residents: 999999, hourlyCost: -4, meeting: "2026-13-45", hoursNow: "abc" });
  ok(n.facility.length === 80 && n.buildings === 1 && n.residents === 5000 && n.hourlyCost === null && n.meeting === "" && n.hoursNow === null, "board input is cleaned: " + JSON.stringify(n).slice(0, 120));
  ok(R.boardFileName(R.normalizeBoard({ facility: "Oak: North/South" })) === "Cognicopia board packet - Oak - NorthSouth.pdf", "a file name every computer accepts");
  // the packet's layout, with an approximate line breaker (the page uses the real font's widths)
  const approx = (text, width, size, bold) => { const cw = size * (bold ? 0.56 : 0.52), max = Math.max(1, Math.floor(width / cw)), out = []; let cur = "";
    String(text).split(/\s+/).filter(Boolean).forEach(wd => { while (wd.length > max){ if (cur){ out.push(cur); cur = ""; } out.push(wd.slice(0, max)); wd = wd.slice(max); } if ((cur ? cur + " " + wd : wd).length > max){ out.push(cur); cur = wd; } else cur = cur ? cur + " " + wd : wd; });
    if (cur || !out.length) out.push(cur); return out; };
  const width = o => String(o.text).length * (o.size || 10.5) * (o.bold ? 0.56 : 0.52);
  const SAFE = /^[\x20-\x7E -ÿ–—‘’“”•…−×÷≈≤≥§]*$/;   // what the embedded Atkinson Hyperlegible draws
  let packetPages = 0;
  for (const scale of [0.85, 1, 1.15]){
    for (const input of [R.normalizeBoard({}), R.normalizeBoard({ facility: "The Very Long Named Senior Living Community of Springfield Heights", preparedBy: "Bartholomew Alexander Montgomery-Fitzgerald", role: "Director of Life Enrichment and Resident Engagement", meeting: "2026-11-12", buildings: 3, residents: 420, hoursNow: 18, hoursWith: 6.5, hourlyCost: 31.75 })]){
      const pages = R.boardPages(input, (t, wd, sz, b) => approx(t, wd * scale, sz, b));
      packetPages = Math.max(packetPages, pages.length);
      ok(pages.length >= 7 && pages.length <= 12, `packet (widths × ${scale}): ${pages.length} pages`);
      const texts = pages.reduce((a, p) => a.concat(p.ops.filter(o => o.t === "text")), []);
      ok(texts.every(o => SAFE.test(o.text)), `packet (widths × ${scale}): every character is one the font draws: ` + texts.filter(o => !SAFE.test(o.text)).map(o => o.text).slice(0, 2).join(" | "));
      if (scale <= 1){   // a breaker that claims more room than the font has (× 1.15) overflows by design; it tests page breaks only
        ok(pages.every(p => p.ops.every(o => o.t !== "text" || (o.y > 0 && o.y <= p.h - 30 && (o.align === "right" ? o.x - width(o) >= 50 : o.x >= 50 && o.x + width(o) <= p.w - 50)))), `packet (widths × ${scale}): text inside the margins`);
        const boxes = p => p.ops.filter(o => o.t === "text").map(o => { const l = o.align === "right" ? o.x - width(o) : o.align === "center" ? o.x - width(o) / 2 : o.x; return { l, r: l + width(o), t: o.y - o.size * 0.8, b: o.y + o.size * 0.22, text: o.text }; });
        const clash = pages.map(boxes).map(bx => { for (let i = 0; i < bx.length; i++) for (let j = i + 1; j < bx.length; j++){ const a = bx[i], c = bx[j]; if (a.l < c.r - 0.5 && c.l < a.r - 0.5 && a.t < c.b - 0.5 && c.t < a.b - 0.5) return a.text + " / " + c.text; } return ""; }).filter(Boolean);
        ok(!clash.length, `packet (widths × ${scale}): no text overlaps other text: ` + clash.slice(0, 2).join(" | "));
      }
      ok(pages.every(p => p.ops.every(o => o.t === "text" || (o.y >= 0 && o.y <= p.h))), `packet (widths × ${scale}): rules and fills on the page`);
      ok(!pages[0].ops.some(o => o.t === "text" && /^Page \d+ of/.test(o.text)) && pages.slice(1).every((p, k) => p.ops.some(o => o.t === "text" && o.text === `Page ${k + 2} of ${pages.length}`)), `packet (widths × ${scale}): the cover has no footer, every other page is numbered`);
      ok(pages.every(p => { const body = p.ops.filter(o => o.t === "text" && o.y < p.h - 60), last = body[body.length - 1]; return !last || !(last.bold && last.size >= 12.5); }), `packet (widths × ${scale}): no page ends with a heading`);
      const all = texts.map(o => o.text).join(" ");
      ok(/Disclosure/.test(all) && /vendor of the tools/.test(all) && /\$129\.99/.test(all), `packet (widths × ${scale}): the price and the vendor's disclosure are printed`);
    }
  }
  const longFoot = R.boardFooter("The Very Long Named Senior Living Community of Springfield Heights", approx);
  ok(approx(longFoot, 612 - 108 - 84, 8.5, false).length === 1 && /Springfield…|Community…|Heights…|of…|Living…|Named…|Senior…|Very…/.test(longFoot) && /Evidence reviewed September 2026$/.test(longFoot), "a long facility name is shortened in the footer: " + longFoot);
  ok(R.boardFooter("", approx) === "Cognicopia board packet · Evidence reviewed September 2026" && R.boardFooter("Maple Grove", approx) === "Cognicopia board packet · Maple Grove · Evidence reviewed September 2026", "a short facility name prints in full in the footer");
  const { refs } = R.boardBlocks(R.normalizeBoard({}));
  ok(refs.length >= 10 && refs.every(k => R.refOf(k)), `the packet cites ${refs.length} references, all real`);
  const calls = []; const docp = new Proxy({}, { get: (o, k) => (...args) => { calls.push(k); } });
  R.draw(docp, R.boardPages(R.normalizeBoard({}), approx)[1]);
  ok(["text", "line", "rect", "setFillColor", "setFont"].every(k => calls.includes(k)), "pages draw as text, lines and fills");
  // the generated pages: one h1, unique ids, and every in-page link and label points at something
  const pagesDir = path.join(ROOT, "resources", "research"), files = ["index.html"].concat(R.DOCS.map(d => d.slug + "/index.html"));
  files.forEach(f => {
    const h = fs.readFileSync(path.join(pagesDir, f), "utf8"), ids = [...h.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]), idSet = new Set(ids);
    ok(ids.length === idSet.size, `${f}: unique ids (${ids.filter((x, i) => ids.indexOf(x) !== i).slice(0, 3).join(", ")})`);
    ok((h.match(/<h1[\s>]/g) || []).length === 1, `${f}: one h1`);
    const targets = [...h.matchAll(/\shref="#([^"]+)"/g)].map(m => m[1]).concat([...h.matchAll(/\saria-(?:labelledby|controls|describedby)="([^"]+)"/g)].reduce((a, m) => a.concat(m[1].split(/\s+/)), []));
    ok(targets.every(t => idSet.has(t) || t === "rcTip"), `${f}: every in-page link and label has a target (${targets.filter(t => !idSet.has(t) && t !== "rcTip").slice(0, 3).join(", ")})`);
    ok([...h.matchAll(/<a [^>]*target="_blank"[^>]*>/g)].every(m => /rel="noopener( noreferrer)?"/.test(m[0])), `${f}: links that open a new tab use rel=noopener`);
  });
  R.DOCS.forEach(d => {
    const h = fs.readFileSync(path.join(pagesDir, d.slug, "index.html"), "utf8");
    ok((h.match(/<li id="ref-\d+">/g) || []).length === R.refsOf(d).length && (h.match(/<section class="rc-sec"/g) || []).length === d.sections.length, `${d.slug}: the page has every reference and section`);
  });
  sandbox.__rcStats = `${R.DOCS.length} research documents, ${R.REFS.length} references, a ${packetPages}-page board packet`;
});

if (fails.length){ console.log(`services check FAILED: ${fails.length} problem(s), ${pass} passed\n  - ` + fails.slice(0, 30).join("\n  - ")); process.exit(1); }
console.log(`services check passed: ${pass} checks (${tscNote}; slowest page ${sandbox.__dveWorst} ms; 300 sealed residents open in ${sandbox.__storeMs} ms; ${sandbox.__remStats}; ${sandbox.__facStats}; ${sandbox.__acadStats}; ${sandbox.__rcStats})`);
