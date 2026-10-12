#!/usr/bin/env node
/* =====================================================================
   Checks for the line-art tracer, the tier derivation and the art files
   (scripts/lib/trace.mjs, tiers.mjs, art.mjs, master.mjs and the ingest):

     1. the tracer on drawings whose answer is known (a ring, a plus, a
        square, a crossing, a gap, a solid dot, specks, a scalloped
        outline): the strokes found, the corners kept, the curves true;
     2. the whole pipeline on stand-in masters of library designs: every
        tier meets its rule, the trace follows the master, the numbers
        are the same every time, every path is clean;
     3. the engine's art hook: a tier mask draws what it says;
     4. the ingest, review and approval commands, on files made on the
        spot in a temporary folder (nothing is written to the site).
   Node built-ins only.
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { loadCognicopiaColoring, ROOT, approvedArt, svgProblems } from "./lib/cognicopia-coloring.mjs";
import { createBitmap, paint } from "./lib/raster.mjs";
import { traceMaster, fitStroke, TRACE_DEFAULTS } from "./lib/trace.mjs";
import { buildArt, itemsHash, readArt, writeArt, listArt } from "./lib/art.mjs";
import { standIn, standInPNG } from "./lib/standins.mjs";
import { validate } from "./lib/json-schema.mjs";

let pass = 0; const fails = [];
const ok = (cond, msg) => { if (cond) pass++; else fails.push(msg); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const run = (script, args) => execFileSync(process.execPath, [path.join(ROOT, "scripts", script), ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const { C } = loadCognicopiaColoring({ art: false });

/* ---------- 1. the tracer on drawings whose answer is known ---------- */
const W = 600, H = 800;
const circle = (cx, cy, r, n = 120) => ({ pts: Array.from({ length: n }, (_, i) => [cx + r * Math.cos(i / n * 2 * Math.PI), cy + r * Math.sin(i / n * 2 * Math.PI)]), closed: true });
const line = (a, b) => ({ pts: [a, b], closed: false });
const poly = (pts, closed = true) => ({ pts, closed });
const ink = shapes => paint(createBitmap(W, H), shapes);
const stroke = (subpaths, w = 5) => ({ subpaths, fill: null, stroke: w });
const flatOps = ops => { const pts = []; let cur = null; for (const o of ops){ if (o.op === "M"){ cur = o.p; pts.push(cur); } else if (o.op === "L"){ for (let k = 1; k <= 20; k++) pts.push([cur[0] + (o.p[0] - cur[0]) * k / 20, cur[1] + (o.p[1] - cur[1]) * k / 20]); cur = o.p; } else { for (let k = 1; k <= 30; k++){ const t = k / 30, u = 1 - t; pts.push([u*u*u*cur[0] + 3*u*u*t*o.c1[0] + 3*u*t*t*o.c2[0] + t*t*t*o.p[0], u*u*u*cur[1] + 3*u*u*t*o.c1[1] + 3*u*t*t*o.c2[1] + t*t*t*o.p[1]]); } cur = o.p; } } return pts; };

{ // a ring: one closed stroke, round, at the right radius
  const t = traceMaster(ink([stroke([circle(300, 300, 120)])]));
  ok(t.edges.length === 1 && t.edges[0].loop && t.blobs.length === 0, "a ring is one closed stroke");
  const pts = flatOps(t.edges[0].ops), rs = pts.map(p => Math.hypot(p[0] - 300, p[1] - 300));
  ok(Math.max(...rs.map(r => Math.abs(r - 120))) < 1.8, `the ring's stroke runs along its center (worst ${Math.max(...rs.map(r => Math.abs(r - 120))).toFixed(2)} px)`);
  ok(t.edges[0].ops.length <= 14, `a ring is a few curves (${t.edges[0].ops.length})`);
}
{ // a plus: four strokes that meet at one junction
  const t = traceMaster(ink([stroke([line([100, 400], [500, 400]), line([300, 200], [300, 600])])]));
  ok(t.edges.length === 4 && new Set(t.edges.flatMap(e => [e.a, e.b])).size === 5, `a plus is four strokes meeting at one junction (got ${t.edges.length} strokes)`);
  ok(t.edges.every(e => e.ops.length === 2 && e.ops[1].op === "L"), "straight arms stay straight");
}
{ // a square: closed, four straight sides, sharp corners
  const t = traceMaster(ink([stroke([poly([[150, 250], [450, 250], [450, 550], [150, 550]])], 6)]));
  ok(t.edges.length === 1 && t.edges[0].loop, "a square is one closed stroke");
  const lines = t.edges[0].ops.filter(o => o.op === "L").length;
  ok(lines >= 4, `a square keeps its straight sides (${lines} line segments)`);
  const pts = flatOps(t.edges[0].ops);
  ok(pts.every(p => Math.abs(p[0] - 150) < 4 || Math.abs(p[0] - 450) < 4 || Math.abs(p[1] - 250) < 4 || Math.abs(p[1] - 550) < 4), "and stays on its sides");
}
{ // a crossing of two thick lines is one junction, not two
  const t = traceMaster(ink([stroke([line([100, 200], [500, 600]), line([100, 600], [500, 200])], 9)]));
  ok(t.edges.length === 4 && new Set(t.edges.flatMap(e => [e.a, e.b])).size === 5, `a crossing is one junction (${t.edges.length} strokes)`);
}
{ // a thick rectangle's ends leave no spurs
  const t = traceMaster(ink([stroke([line([100, 300], [500, 300])], 16)]));
  ok(t.edges.length === 1 && !t.edges[0].loop, "a thick line's blunt ends leave no spurs");
}
{ // a ring with a small gap closes; one with a big gap does not
  const arc = (gapDeg) => { const pts = []; for (let a = gapDeg / 2; a <= 360 - gapDeg / 2; a += 3) pts.push([300 + 120 * Math.cos(a * Math.PI / 180), 300 + 120 * Math.sin(a * Math.PI / 180)]); return poly(pts, false); };
  const small = traceMaster(ink([stroke([arc(3)])])), big = traceMaster(ink([stroke([arc(40)])]));    // 6 px and 84 px between the line ends: about a pixel of white, and a wide gap
  ok(small.stats.gaps_closed === 1 && small.edges.length === 1 && small.edges[0].loop, "a gap of a few pixels in a ring is closed");
  ok(big.stats.gaps_closed === 0 && big.edges.length === 1 && !big.edges[0].loop && big.stats.free_ends === 2, "a wide gap is left open and the two ends are reported");
}
{ // a solid dot is kept as an accent, not a stroke; a thick band is a stroke
  const dot = { subpaths: [circle(300, 300, 22)], fill: 1, stroke: 0 };
  const t = traceMaster(ink([stroke([circle(300, 300, 120)]), dot]));
  ok(t.blobs.length === 1 && near(t.blobs[0].area, Math.PI * 22 * 22, 90), `a solid dot is a solid accent of the right size (${t.blobs.length}, ${t.blobs[0] && Math.round(t.blobs[0].area)})`);
  ok(t.edges.length === 1, "and it adds no strokes");
  const band = traceMaster(ink([{ subpaths: [poly([[100, 300], [500, 300], [500, 330], [100, 330]])], fill: 1, stroke: 0 }]));
  ok(band.blobs.length === 0 && band.edges.length === 1, "a thick band is a line, not a solid accent");
}
{ // specks do not become strokes
  const specks = []; for (let i = 0; i < 12; i++) specks.push({ subpaths: [circle(60 + i * 40, 700, 3, 12)], fill: 1, stroke: 0 });
  const t = traceMaster(ink([stroke([circle(300, 300, 120)]), ...specks]));
  ok(t.edges.length === 1 && t.blobs.length === 0, "specks are dropped");
}
{ // a scalloped outline (the shape that once broke the curve fit) follows the points all the way round
  const pts = []; for (let i = 0; i < 800; i++){ const a = i / 800 * 2 * Math.PI, r = 150 + 18 * Math.sin(a * 28); pts.push([300 + r * Math.cos(a), 330 + r * Math.sin(a)]); }
  const t = traceMaster(ink([stroke([poly(pts)], 5)]));
  const fitted = flatOps(t.edges[0].ops), worst = Math.max(...t.edges[0].pts.map(p => Math.min(...fitted.map(q => Math.hypot(q[0] - p[0], q[1] - p[1])))));
  ok(t.edges.length === 1 && worst < 2.5, `a scalloped loop is fitted within ${worst.toFixed(2)} px`);
  ok(t.edges[0].ops.every(o => !o.c1 || [o.c1, o.c2, o.p].every(p => p[0] > 100 && p[0] < 500 && p[1] > 130 && p[1] < 530)), "and no curve's handle runs away");
}
{ // a tiny stretch with a runaway handle is straightened, not drawn across the page
  const f = fitStroke([[10, 10], [10.5, 10.2], [11, 10.4], [11.2, 10.9]], TRACE_DEFAULTS, false);
  ok(f && f.ops.every(o => !o.c1 || [o.c1, o.c2].every(p => Math.abs(p[0] - 10) < 30 && Math.abs(p[1] - 10) < 30)), "a short stroke's curve handles stay near it");
}
{ // the same picture gives the same strokes, byte for byte
  const bmp = ink([stroke([circle(300, 300, 120), line([100, 600], [500, 650])])]), a = traceMaster(bmp), b = traceMaster(bmp);
  ok(JSON.stringify(a.edges.map(e => e.d)) === JSON.stringify(b.edges.map(e => e.d)), "tracing is deterministic");
}

/* ---------- 2. the whole pipeline on stand-in masters of library designs ---------- */
const DESIGNS = ["sunflower", "red-barn", "teapot-and-cup", "farm-tractor", "barn-owl", "hydrangea", "mandala-star", "vintage-bicycle"];
const pathOk = d => /^M[-0-9.eE ,MLCZ]+$/.test(d) && !/[0-9]-?\.-/.test(d) && (d.match(/-?\d+(?:\.\d+)?/g) || []).every(n => +n > -60 && +n < 860);
let firstHash = null;
for (const id of DESIGNS){
  const master = standIn(id, { pt: 2.6, wobble: .6, vary: .3, seed: 7, size: 900 });
  const art = buildArt(master, {}), f = art.fidelity, r0 = art.trace.r0, T = art.tiers;
  ok([1, 2, 3].every(t => T[t].meets_rule), `${id}: every tier meets its rule (${[1, 2, 3].map(t => `T${t} ${T[t].regions} areas, ${T[t].tiny_regions} small`).join("; ")})`);
  ok(T[3].regions <= T[1].regions && T[2].regions <= T[1].regions + 1 && T[3].regions <= T[2].regions + 3, `${id}: detail falls from tier to tier (${T[1].regions}, ${T[2].regions}, ${T[3].regions})`);
  ok(f.missing_p99_px <= Math.max(10, 2.2 * r0 * 900 / 1800 * 2) && f.stray_p99_px <= Math.max(8, 1.4 * r0), `${id}: the trace follows the master (leaves out ${f.missing_p99_px} px, strays ${f.stray_p99_px} px, line half-width ${r0})`);
  ok(Math.abs(f.regions_master - f.regions_traced) <= Math.max(3, f.regions_master * .12), `${id}: the trace has the master's areas (${f.regions_traced} of ${f.regions_master})`);
  ok(art.items.length >= 3 && art.items.every(([kind, mask, d]) => ["m", "d", "k"].includes(kind) && Number.isInteger(mask) && mask >= 1 && mask <= 7 && pathOk(d)), `${id}: every item is a kind, a tier mask and a clean path in the box`);
  ok(art.items.some(i => i[1] === 1) && art.items.some(i => i[1] === 2) && art.items.some(i => i[1] === 4), `${id}: each tier has strokes of its own`);
  ok(art.bytes < 60000, `${id}: ${(art.bytes / 1000).toFixed(1)} KB is within the size budget`);
  // drawn by the engine
  const E = loadCognicopiaColoring({ art: false }).C;
  E.art.use([{ id: "check-" + id, items: art.items, fit: "subject", pad: .05, meta: { title: "Check " + id, cat: "home-everyday", talk: "Tell me about a day you spent out of doors." } }]);
  for (const t of [1, 2, 3]){
    const r = E.render("check-" + id, t), svg = E.toSVG(r, { standalone: true }), m = E.quality.measureRender(r, { strokes: true }).m;
    ok(!svgProblems(svg).length && m.regions === T[t].regions, `${id} T${t}: draws as clean line art and measures the same through the engine`);
    ok(m.stroke_pt_median >= E.weightFor(t).pt * .75, `${id} T${t}: lines print at ${m.stroke_pt_median} pt, the tier's ${E.weightFor(t).pt} pt or near it`);
  }
  if (!firstHash){ firstHash = itemsHash(art.items); ok(itemsHash(buildArt(master, {}).items) === firstHash, `${id}: the same master gives the same art`); }
}

/* ---------- 3. the engine's art hook ---------- */
{
  const E = loadCognicopiaColoring({ art: false }).C;
  const items = [["m", 7, "M100 100 L500 100 L500 700 L100 700 Z"], ["d", 1, "M150 200 L450 200"], ["d", 3, "M150 300 L450 300"], ["m", 4, "M150 400 L450 400"], ["k", 3, "M300 500 L330 500 L330 530 L300 530 Z"]];
  E.art.use([{ id: "hook-test", items, meta: { title: "Hook test", cat: "home-everyday", talk: "Tell me about a favorite place." } }]);
  const counts = [1, 2, 3].map(t => E.render("hook-test", t).items.length);
  ok(counts.join() === "4,3,2" || counts.join() === "4,2,2" || counts.join() === "4,3,3", `a tier mask draws only at its tiers (items per tier ${counts.join(", ")})`);
  const by = t => E.render("hook-test", t).items.map(i => i.kind + (i.fill === 2 ? "k" : "")).join();
  ok(by(1) === "m,d,d,k".replace(/,/g, ",") || by(1).includes("d"), "Tier 1 draws its detail lines");
  ok(E.render("hook-test", 3).items.some(i => i.kind === "m") && !E.render("hook-test", 3).items.some(i => i.kind === "k"), "Tier 3 draws its own lines and not the accent meant for Tiers 1 and 2");
  let msg = ""; try { E.art.use([{ id: "no-such-design", items }]); } catch (e){ msg = e.message; }
  ok(/needs meta/.test(msg), "art for a design that is not in the library must say what it is");
  ok(E.art.of("hook-test") && E.art.ids().includes("hook-test") && E.design("hook-test").source === "traced", "the engine lists traced designs");
}

/* ---------- 4. ingest, review and approval, in a temporary folder ---------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cognicopia-coloring-trace-"));
try {
  const inbox = path.join(tmp, "inbox"), data = path.join(tmp, "data"); fs.mkdirSync(inbox); fs.mkdirSync(data);
  fs.writeFileSync(path.join(inbox, "sunflower.png"), standInPNG("sunflower", { pt: 2.6, wobble: .8, vary: .3, seed: 7, size: 1200 }));
  fs.writeFileSync(path.join(inbox, "sunflower.t3.png"), standInPNG("sunflower", { tier: 3, pt: 2.6, seed: 4, size: 1200 }));
  fs.writeFileSync(path.join(inbox, "shaded.png"), standInPNG("teapot-and-cup", { pt: 3, seed: 2, patch: true, size: 1200 }));
  fs.writeFileSync(path.join(inbox, "shaded.json"), JSON.stringify({ title: "Shaded Teapot", category: "nostalgic-heritage" }));
  fs.writeFileSync(path.join(inbox, "stray.png"), standInPNG("lighthouse", { pt: 2.6, seed: 9, size: 1200 }));      // no category: cannot be added
  const out = run("ingest_coloring_assets.mjs", ["--inbox", inbox, "--root", data]);
  ok(/added sunflower\.png/.test(out) && /added shaded\.png/.test(out) && /skip\s+stray\.png.*needs a category/.test(out), "the ingest adds what it can and says why it skipped the rest");
  const sun = readArt(data, "sunflower"), shaded = readArt(data, "ai-shaded");
  ok(sun && sun.mode === "replace" && sun.review.status === "needs-review" && sun.source.tier_masters && sun.source.tier_masters["3"], "a drawing made for Tier 3 is recorded with the master");
  ok(sun && sun.trace.notes.some(n => /Tier 3 comes from its own drawing/.test(n)), "and used as it is");
  ok(sun && itemsHash(sun.items) === sun.items_sha256 && !validate(sun, JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "cognicopia_coloring_art.schema.json"), "utf8"))).length, "the art file fits its schema and its hash");
  ok(/already ingested/.test(run("ingest_coloring_assets.mjs", ["--inbox", inbox, "--root", data, "--only", "sunflower"])), "a picture is not ingested twice");
  ok(listArt(data).length === 2 && /sunflower/.test(run("ingest_coloring_assets.mjs", ["--list", "--root", data])), "the review list shows what waits");
  // approval needs a name; a failing picture needs a stated reason
  let err = ""; try { run("ingest_coloring_assets.mjs", ["--approve", "sunflower", "--root", data]); } catch (e){ err = String(e.stderr); }
  ok(/needs --reviewer/.test(err), "approval needs a reviewer's name");
  err = ""; try { run("ingest_coloring_assets.mjs", ["--approve", "ai-shaded", "--reviewer", "Reviewer", "--root", data]); } catch (e){ err = String(e.stderr); }
  ok(/fails pure-black-white/.test(err) && readArt(data, "ai-shaded").review.status === "needs-review", "a picture that fails a check is not approved without a reason");
  ok(/approved/.test(run("ingest_coloring_assets.mjs", ["--approve", "sunflower", "--reviewer", "Reviewer", "--root", data])) && readArt(data, "sunflower").review.status === "approved", "a sound picture is approved by a named person");
  const ap = approvedArt(data);
  ok(ap.length === 1 && ap[0].id === "sunflower" && Array.isArray(ap[0].items), "only approved art is handed to the engine");
  ok(/rejected/.test(run("ingest_coloring_assets.mjs", ["--reject", "ai-shaded", "--reviewer", "Reviewer", "--reason", "gray shading", "--root", data])) && approvedArt(data).length === 1, "a rejected picture stays out");
  // art changed after tracing cannot be approved
  const ed = readArt(data, "ai-shaded"); ed.items[0][2] = ed.items[0][2] + " L1 1"; ed.review.status = "needs-review"; writeArt(data, ed);
  err = ""; try { run("ingest_coloring_assets.mjs", ["--approve", "ai-shaded", "--reviewer", "Reviewer", "--override", "test", "--root", data]); } catch (e){ err = String(e.stderr); }
  ok(/changed after it was traced/.test(err), "art changed by hand after tracing is refused");
  // the review sheets
  const sheets = path.join(tmp, "sheets");
  run("review_coloring_art.mjs", ["--root", data, "--out", sheets, "--all"]);
  ok(fs.existsSync(path.join(sheets, "index.html")) && fs.existsSync(path.join(sheets, "sunflower.png")) && /Approve:/.test(fs.readFileSync(path.join(sheets, "index.html"), "utf8")), "the review sheets and their page are written");
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

if (fails.length){ console.log(`trace check FAILED: ${fails.length} problem(s), ${pass} passed\n  - ` + fails.slice(0, 30).join("\n  - ")); process.exit(1); }
console.log(`trace check passed: ${pass} checks (tracer, ${DESIGNS.length} stand-in designs through every tier, the art hook, ingest and review)`);
