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
  await F.removePassphrase(P);
  const H = page(shared), hs = await H.ready();
  ok(hs.state === "open" && !hs.passphrase && H.storage.getItem("cognicopia_resident_r2") !== null, "passphrase removed: back to the device key, nothing lost");
  // no IndexedDB or Web Crypto: plain localStorage, and it says so
  const U = page({ idb:undefined, ls:fakeLocalStorage() }), us = await U.ready();
  U.storage.setItem("cognicopia_resident_x", "{}");
  ok(us.state === "unavailable" && !us.encrypted && U.storage.getItem("cognicopia_resident_x") === "{}", "falls back to localStorage when it cannot encrypt");
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
  vm.runInContext(fs.readFileSync(path.join(ROOT, "assets", "cognicore", "cognicore.js"), "utf8"), cc);
  const designs = new Set(cc.CogniCore.designs().map(d => d.id)), songIds = new Set(R.SONGS.map(x => x.id));
  ok(songIds.size === R.SONGS.length, "song ids are unique");
  const texts = [];
  for (const t of R.TOPICS){
    ok(t.invite.length === 3 && t.invite.every(Boolean), t.id + ": three invitations");
    ok(t.starters.length >= 4 && t.simple.length >= 3, t.id + ": at least 4 starters and 3 tier-3 lines");
    ok(t.simple.filter(x => x !== t.invite[2]).length >= 3, t.id + ": 3 tier-3 lines besides the invitation");
    ok(t.art.length && t.art.every(a => designs.has(a)), t.id + ": art from the CogniCore library: " + t.art.filter(a => !designs.has(a)));
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



if (fails.length){ console.log(`services check FAILED: ${fails.length} problem(s), ${pass} passed\n  - ` + fails.slice(0, 30).join("\n  - ")); process.exit(1); }
console.log(`services check passed: ${pass} checks (${tscNote}; slowest page ${sandbox.__dveWorst} ms; 300 sealed residents open in ${sandbox.__storeMs} ms; ${sandbox.__remStats})`);
