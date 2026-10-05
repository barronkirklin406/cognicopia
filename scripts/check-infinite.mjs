#!/usr/bin/env node
/* =====================================================================
   Checks for the infinite page generator (assets/cognicore/infinite.js,
   assets/cognicore/generators/*.js, scripts/generate_infinite_pages.mjs):
     - pages are deterministic: a seed or a page code always makes the
       same page; codes round-trip;
     - every template and every page's words pass the dignity filter and
       the banned-subject list; the resident's avoid list is honored;
     - a broad sample of pages, every theme at every tier, is drawn and
       checked, and almost all pass on the first draw;
     - a batch returns the pages asked for, all passing, none repeated;
     - every page is black and white only, 3:4, lines at least 3 pt;
     - the command line writes SVG, 300 DPI PNG, a PDF packet, prompts
       and a manifest; and its image-generator path fetches from an
       endpoint (a local stand-in here) and hands the pictures to the
       ingest pipeline.
   Node built-ins only.
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import http from "http";
import { execFileSync, spawn } from "child_process";
import { loadCogniCore, ROOT, svgProblems } from "./lib/cognicore.mjs";
import { createBitmap, paint, shapesFromRender } from "./lib/raster.mjs";
import { encodeBitPNG, decodePNG } from "./lib/png.mjs";

let checks = 0, fails = 0;
const ok = (cond, msg) => { checks++; if (!cond){ fails++; console.error("FAIL " + msg); } };
const { C, P } = loadCogniCore();
const I = C.infinite;
ok(I && I.version, "the generator loads");

/* ---------- determinism and codes ---------- */
const a = I.spec({ seed:"same", tier:2, theme:"garden-tools" }), b = I.spec({ seed:"same", tier:2, theme:"garden-tools" });
ok(JSON.stringify(a) === JSON.stringify(b), "the same seed makes the same page");
ok(I.parse(a.code) && I.parse(a.code).sig === a.sig, "a page code makes the same page again: " + a.code);
ok(I.parse("9ZZ-ABC") === null && I.parse("") === null && I.parse("2NV-") === null, "bad page codes are refused");
ok(I.render(a).items.map(it => it.d).join() === I.render(I.parse(a.code)).items.map(it => it.d).join(), "the same code draws the same lines");
I.THEMES.forEach(t => ok(/^[A-Z]{2}$/.test(t.code) && C.CAT[t.cat], `theme ${t.id} has a code and a library category`));
ok(new Set(I.THEMES.map(t => t.code)).size === I.THEMES.length, "theme codes are unique");
I.THEMES.forEach(t => t.families.forEach(f => ok(I.FAMILIES[f[0]], `theme ${t.id}: family ${f[0]} is loaded`)));

/* ---------- words: templates, dignity, banned subjects, avoid lists ---------- */
ok(I.TEMPLATES.length === 10, "ten prompt templates");
I.TEMPLATES.forEach(t => {
  ok(/\{subject\}/.test(t.text) && /\{setting\}/.test(t.text) && /\{composition_style\}/.test(t.text), `template ${t.id} has {subject}, {setting} and {composition_style}`);
  ok(!P.dignityCheck(t.text).length && !I.bannedIn(t.text).length, `template ${t.id} passes the dignity filter`);
});
Object.values(I.FAMILIES).forEach(f => ok(I.TEMPLATE[f.template], `family ${f.id} uses a known template`));
ok(I.bannedIn("a cartoon dragon").length === 2 && !I.bannedIn("a garden trowel").length, "banned subject words are caught");
ok(I.guard(Object.assign({}, a, { title:"A cute little teapot" })).some(p => /dignity/.test(p)), "the dignity filter screens a page's words");
const carPage = I.spec({ seed:"car", tier:2, theme:"vehicles" });
ok(I.guard(carPage, { avoid:["driving"] }).some(p => /avoid list/.test(p)), "a page on the resident's avoid list is refused");
const noCars = I.batch({ seed:"avoid", count:6, tier:2, themes:["vehicles", "garden-tools"], avoid:["driving"], measure:false });
ok(noCars.pages.length && noCars.pages.every(p => p.spec.family !== "classic-car"), "a batch for a resident who avoids driving has no cars");

/* ---------- a broad sample: every theme, every tier ---------- */
const PER = +(process.env.INFINITE_SAMPLE || 8);
let drawn = 0, passed = 0;
const firstDraw = {};
for (const th of I.THEMES) for (let i = 0; i < PER; i++) for (const t of [1, 2, 3]){
  const sp = I.spec({ seed:I.hashSeed("sample-" + th.id + "-" + i), tier:t, theme:th.id }), r = I.render(sp), ck = I.check(sp, r, {});
  drawn++; if (ck.ok) passed++;
  const f = firstDraw[sp.family] = firstDraw[sp.family] || [0, 0]; f[0]++; if (ck.ok) f[1]++;
  ok(!P.dignityCheck([sp.title, sp.talk, sp.slots.subject, sp.slots.setting].join(" ")).length, `${sp.code}: words pass the dignity filter`);
  ok(r.items.every(it => !it.fill || /Z\s*$/.test(it.d.trim())), `${sp.code}: every filled shape is closed`);
}
ok(passed / drawn >= .9, `at least 90% of first drafts pass every check (${passed} of ${drawn})`);
Object.entries(firstDraw).forEach(([k, v]) => ok(v[1] / v[0] >= .8, `${k}: at least 80% of first drafts pass (${v[1]} of ${v[0]})`));

/* ---------- batches ---------- */
for (const t of [1, 2, 3]){
  const bt = I.batch({ seed:"check-batch", count:18, tier:t });
  ok(bt.pages.length === 18, `Tier ${t}: a batch of 18 returns 18 pages (${bt.pages.length})`);
  ok(new Set(bt.pages.map(p => p.spec.sig)).size === bt.pages.length, `Tier ${t}: no page repeats`);
  ok(new Set(bt.pages.map(p => p.spec.key)).size >= 14, `Tier ${t}: the batch spreads its subjects (${new Set(bt.pages.map(p => p.spec.key)).size} kinds)`);
  bt.pages.forEach(p => {
    const svg = C.toSVG(p.r, { widthIn:C.pageLayout({ tier:t, title:true, caption:true }).artW, standalone:true });
    ok(p.check.ok, `${p.spec.code}: passes every check`);
    ok(!svgProblems(svg).length, `${p.spec.code}: black and white only`);
    ok(/viewBox="0 0 600 800"/.test(svg), `${p.spec.code}: 3:4`);
    ok(C.weightFor(t).pt >= 3 && Math.max(C.MIN_LINE_PT, C.weightFor(t).detailPt) >= 3, `${p.spec.code}: lines at least 3 pt`);
    ok(p.check.report.looseEnds === 0, `${p.spec.code}: no loose line ends`);
  });
  const again = I.batch({ seed:"check-batch", count:18, tier:t, measure:false });
  ok(again.pages.map(p => p.spec.code).join() === bt.pages.map(p => p.spec.code).join(), `Tier ${t}: the same seed makes the same batch`);
}
const one = I.batch({ seed:"themes", count:6, tier:2, themes:["homes"] });
ok(one.pages.every(p => p.spec.theme === "homes"), "a batch keeps to the themes asked for");

/* ---------- the command line ---------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-infinite-"));
const cli = path.join(ROOT, "scripts", "generate_infinite_pages.mjs");
const out1 = path.join(tmp, "batch");
execFileSync(process.execPath, [cli, "--count", "4", "--tier", "3", "--seed", "check", "--out", out1], { stdio:"pipe" });
const files = fs.readdirSync(out1);
ok(files.filter(f => f.endsWith(".svg")).length === 4 && files.filter(f => f.endsWith(".png")).length === 4, "the command line writes 4 SVGs and 4 PNGs");
ok(fs.readFileSync(path.join(out1, "packet.pdf")).slice(0, 8).toString() === "%PDF-1.4", "the command line writes a PDF packet");
const pdfText = fs.readFileSync(path.join(out1, "packet.pdf"), "latin1");
ok((pdfText.match(/\/Type \/Page\b/g) || []).length === 4, "the PDF has one page per picture");
const man = JSON.parse(fs.readFileSync(path.join(out1, "manifest.json"), "utf8"));
ok(man.pages.length === 4 && man.pages.every(p => p.checks.passed && p.checks.after_writing.length === 0), "every page in the manifest passed its checks");
const png = decodePNG(fs.readFileSync(path.join(out1, man.pages[0].files.png)));
ok(png.dpi === 300 && Math.abs(png.w / png.h - .75) < .002, `the PNG is 300 DPI and 3:4 (${png.w} x ${png.h} at ${png.dpi})`);
ok(png.colorFraction === 0 && png.gray.every(v => v === 0 || v === 255), "the PNG is pure black and white");
const jobs = fs.readFileSync(path.join(out1, "prompts.jsonl"), "utf8").trim().split("\n").map(l => JSON.parse(l));
ok(jobs.length === 4 && jobs.every(j => /Bold black-and-white coloring page for older adults/.test(j.positive) && j.prompts.midjourney.includes("--ar 3:4")), "the prompts are written for every page");
const out2 = path.join(tmp, "codes");
execFileSync(process.execPath, [cli, "--codes", man.pages.map(p => p.code).join(","), "--out", out2, "--no-png", "--no-pdf"], { stdio:"pipe" });
ok(fs.readFileSync(path.join(out2, fs.readdirSync(out2).filter(f => f.endsWith(".svg"))[0]), "utf8") === fs.readFileSync(path.join(out1, man.pages[0].files.svg), "utf8"), "printing by page code makes the same file again");

/* the image-generator path, against a stand-in endpoint on this machine */
const sample = I.batch({ seed:"stand-in", count:1, tier:2, measure:false }).pages[0];
const bmp = paint(createBitmap(768, 1152), shapesFromRender(C, sample.r, { widthIn:768 / 150, dpi:150, weight:"thick" }));
const b64 = encodeBitPNG(bmp, 150).toString("base64");
let asked = 0, body = "";
const server = http.createServer((req, res) => { let s = ""; req.on("data", d => { s += d; }); req.on("end", () => { asked++; body = s; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ data:[{ b64_json:b64 }] })); }); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const out3 = path.join(tmp, "http");
const run = await new Promise(resolve => {
  const p = spawn(process.execPath, [cli, "--backend", "http", "--count", "2", "--tier", "2", "--seed", "stand-in", "--out", out3, "--ingest-dry-run"],
    { env:Object.assign({}, process.env, { COGNICOPIA_IMAGE_API_URL:`http://127.0.0.1:${server.address().port}/v1/images/generations`, COGNICOPIA_IMAGE_API_KEY:"test" }) });
  let o = ""; p.stdout.on("data", d => { o += d; }); p.stderr.on("data", d => { o += d; }); p.on("close", code => resolve({ code, o }));
});
server.close();
ok(run.code === 0, "the image-generator path runs: " + run.o.slice(-300));
ok(asked === 2 && /coloring page for older adults/.test(JSON.parse(body).prompt) && JSON.parse(body).size === "1024x1536", "it sends one strict prompt per page");
ok(fs.readdirSync(path.join(out3, "inbox")).filter(f => f.endsWith(".png")).length === 2, "it saves each picture to the inbox");
ok(/check\s+gen-/.test(run.o) && /dry run, nothing written/.test(run.o), "it hands the pictures to the ingest pipeline for checking");
fs.rmSync(tmp, { recursive:true, force:true });

console.log(fails ? `\ninfinite pages check FAILED: ${fails} of ${checks}` : `infinite pages check passed: ${checks} checks (${drawn} sample pages, ${passed} passed on the first draw)`);
process.exit(fails ? 1 : 0);
