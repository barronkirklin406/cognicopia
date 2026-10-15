#!/usr/bin/env node
/* =====================================================================
   Checks for the local art agent (scripts/local_art_agent.mjs, its parts
   in scripts/lib/local-art.mjs and the Python pieces in scripts/local_art/).
   No picture model and no internet: the picture engines are replaced by
   test pictures drawn from the library, a pretend ComfyUI that answers on
   this computer, and a folder of pictures.

     - the words: the clinical prompt wrapper is the Packet Builder's own, the refining hints pass
       the dignity filter, and words the filter sets aside never reach an engine
     - the cleaning: a gray, thin-lined picture becomes a 1-bit 1800 x 2400 master at 300 dpi with
       lines at the 3 pt floor; a drawn border comes off and a quilt's grid stays; blank and dark
       pictures are refused in plain words
     - the choosing: passing candidates win, a failing round's words gain the hints for what failed
     - every route end to end into temporary folders: test pictures, a folder of pictures, the
       library's exact patterns (kept as drawn), ComfyUI on this computer (the job's graph, the
       progress connection opened first, the picture fetched, an error said plainly, a FLUX workflow
       filled in), and no engine at all; the master and its sidecar then go through the real ingest
       and review sheet
     - nothing leaves the computer: the Node agent imports no network module, the Python pieces put
       the offline guard in first and the guard refuses an outside address, ComfyUI must be on this
       computer, the one download step is only in setup, and the website never loads any of it
     - the library review measures all 150 designs

   Needs Python 3 for the ComfyUI and guard parts (skipped with a notice where it is missing).
   Node built-ins only. Run: node scripts/check-local-art.mjs
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import http from "http";
import crypto from "crypto";
import { execFile, spawnSync } from "child_process";
import { loadCognicopiaColoring, ROOT } from "./lib/cognicopia-coloring.mjs";
import { encodeRGBPNG, decodePNG } from "./lib/png.mjs";
import { standInGray } from "./lib/standins.mjs";
import * as LA from "./lib/local-art.mjs";

let pass = 0; const fails = [], notes = [];
const ok = (cond, msg) => { if (cond) pass++; else fails.push(msg); };
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const { C, P } = loadCognicopiaColoring({ art: false });
const T0 = Date.now();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "cognicopia-check-art-"));
const HOME = path.join(TMP, "home"); fs.mkdirSync(HOME);                 // no settings: no model is set up
const AGENT = path.join(ROOT, "scripts", "local_art_agent.mjs");
const PY = (() => { for (const c of process.platform === "win32" ? ["py", "python", "python3"] : ["python3", "python"]){ const r = spawnSync(c, ["--version"], { encoding: "utf8" }); if (r.status === 0 && /Python 3/.test(r.stdout + r.stderr)) return c; } return null; })();
const PYENV = Object.assign({}, process.env, { PYTHONDONTWRITEBYTECODE: "1" });

/* the agent, run as the owner runs it, without blocking this process (the pretend ComfyUI below must keep answering) */
function agent(args, env = {}){
  return new Promise(resolve => execFile(process.execPath, [AGENT, ...args], { env: Object.assign({}, process.env, { COGNICOPIA_HOME: HOME }, env), maxBuffer: 64 * 1024 * 1024, timeout: 600000 },
    (err, stdout, stderr) => resolve({ code: err ? (typeof err.code === "number" ? err.code : 1) : 0, out: String(stdout), err: String(stderr) })));
}
const summary = (rev, id) => { try { return JSON.parse(fs.readFileSync(path.join(rev, id, "summary.json"), "utf8")); } catch (e){ return null; } };
/* width, height, bit depth, color type and dots per inch of a PNG */
function pngInfo(buf){
  const out = { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), depth: buf[24], type: buf[25], dpi: null };
  for (let o = 8; o < buf.length - 12;){ const n = buf.readUInt32BE(o), t = buf.toString("latin1", o + 4, o + 8); if (t === "pHYs" && buf[o + 16] === 1) out.dpi = Math.round(buf.readUInt32BE(o + 8) * .0254); o += 12 + n; }
  return out;
}
const isMaster = buf => { const i = pngInfo(buf); return i.w === 1800 && i.h === 2400 && i.depth === 1 && i.type === 0 && i.dpi === 300; };
const grayPNG = g => { const rgb = new Uint8Array(g.w * g.h * 3); for (let i = 0; i < g.gray.length; i++) rgb.fill(g.gray[i], i * 3, i * 3 + 3); return encodeRGBPNG({ w: g.w, h: g.h, rgb }); };
const testPicture = (id, seed, o = {}) => grayPNG(standInGray(id, Object.assign({ seed, wobble: 1.5, vary: .25, noise: 30, pt: 1.4, size: 864 }, o)));

/* ---------- the words ---------- */
{
  const src = read("js/coloringAgent.js");
  const lit = name => { const m = new RegExp(name + '\\s*=\\s*"([^"]*)"').exec(src); return m ? m[1] : null; };
  ok(lit("PREFIX") === LA.PREFIX && lit("SUFFIX") === LA.SUFFIX, "the agent's prompt wrapper is the Packet Builder's Describe a page wrapper, word for word");
  ok(LA.PREFIX === "Minimalist bold-and-easy adult coloring book page of ", "the prefix is the owner's");
  const w = LA.wrapPrompt("A sunflower in a clay pot.", ["fewer details, larger simple shapes"]);
  ok(w === LA.PREFIX + "a sunflower in a clay pot, fewer details, larger simple shapes" + LA.SUFFIX, "the subject sits between the prefix and the suffix, tidied, with any hints before the suffix: " + w);
  ok(LA.wrapPrompt("The Model T") === LA.PREFIX + "The Model T" + LA.SUFFIX, "a proper name keeps its capital");
  ok(JSON.stringify(LA.hintsFor(["area-size", "area-size", "fills-page", "unknown"])) === JSON.stringify([LA.HINTS["area-size"], LA.HINTS["fills-page"]]), "each failed check adds its hint once, and an unknown one adds nothing");
  ok(Object.values(LA.HINTS).every(h => !P.dignityCheck(h).length) && !P.dignityCheck(LA.wrapPrompt("a teapot", Object.values(LA.HINTS))).length, "every refining hint passes the dignity filter");
  ok(/childish/.test(LA.NEGATIVE) && /gray/.test(LA.NEGATIVE) && /border/.test(LA.NEGATIVE) && LA.NEGATIVE.split(",").length <= 30, "the words to keep out name color, gray, borders and childish pictures, and stay short");
  ok(LA.hashSeed("sunflower") === LA.hashSeed("sunflower") && LA.hashSeed("sunflower") !== LA.hashSeed("sunflowers"), "a design's seeds are the same every run, and differ between designs");
}

/* ---------- the cleaning ---------- */
{
  const g = standInGray("rocking-chair", { seed: 3, wobble: 1.5, vary: .25, noise: 40, pt: 1.2, size: 864 });
  const cl = LA.cleanCandidate(grayPNG(g));
  ok(!cl.error && isMaster(Buffer.from(cl.png)), "a gray picture with thin lines becomes a 1-bit 1800 x 2400 master at 300 dpi: " + (cl.error || JSON.stringify(pngInfo(Buffer.from(cl.png || [])))));
  ok(cl.lines && cl.lines.px >= LA.FLOOR_PX * .95, `its thinnest lines reach the ${LA.FLOOR_PT} pt floor (${cl.lines && cl.lines.pt} pt)`);
  ok(cl.fixes && cl.fixes.some(f => /thickened/.test(f)), "and the fixes say the lines were thickened");
  const img = decodePNG(Buffer.from(cl.png)); ok(img.gray.every(v => v === 0 || v === 255), "the master is pure black and white");
  ok(cl.bmp.px.every((v, i) => !v || (i % 1800 > 40 && i % 1800 < 1760)), "nothing touches the page's side edges");
  const blank = LA.cleanCandidate(grayPNG({ w: 300, h: 400, gray: new Uint8Array(300 * 400).fill(250) }));
  const dark = LA.cleanCandidate(grayPNG({ w: 300, h: 400, gray: new Uint8Array(300 * 400).fill(20) }));
  ok(blank.code === "blank" && /nearly blank/.test(blank.error) && dark.code === "dark" && /mostly dark/.test(dark.error), "blank and dark pictures are refused in plain words");
  ok(LA.cleanCandidate(Buffer.from("not a picture")).code === "blank", "something that is not a picture is refused, not crashed on");
  /* a border drawn round the page comes off; a quilt's grid that reaches the edges stays */
  const f = standInGray("sunflower", { seed: 2, wobble: 1, vary: .2, noise: 20, pt: 3, size: 864 });
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++){ const e = Math.min(x, y, f.w - 1 - x, f.h - 1 - y); if (e >= 14 && e <= 18) f.gray[y * f.w + x] = 20; }
  const framed = LA.cleanCandidate(grayPNG(f));
  ok(!framed.error && framed.frames === 1 && !LA.hasBorder(framed.bmp) && framed.fixes.some(x => /border/.test(x)), "a border drawn round the page is taken off: " + (framed.error || framed.frames));
  ok(LA.designHasEdge(C, "quilt-ohio-star") && LA.designHasEdge(C, "mandala-doily") && !LA.designHasEdge(C, "rocking-chair") && !LA.designHasEdge(C, "sunflower"), "a design whose own drawing has an edge round the page (a quilt's outer seam) is known from the library");
  const quilt = testPicture("quilt-ohio-star", 1, { pt: 3, noise: 0, wobble: 0 }), kept = LA.cleanCandidate(quilt, { allowBorder: true, keepEdge: true }), lost = LA.cleanCandidate(quilt, { allowBorder: true });
  ok(!kept.error && kept.frames === 0 && !kept.fixes.some(x => /border/.test(x)) && lost.frames === 1, "and its edge is kept, where the border remover alone would have taken it");
  const q = LA.binarize(testPicture("quilt-ohio-star", 1, { pt: 3, noise: 0, wobble: 0 })), before = q.bin.px.reduce((n, v) => n + v, 0);
  LA.removeFrame(q.bin);
  ok(q.bin.px.reduce((n, v) => n + v, 0) >= before * .8, "the border remover takes only the edge, never the drawing inside it");
  const color = new Uint8Array(200 * 260 * 3).fill(255); for (let i = 0; i < 200 * 60; i++){ color[(200 * 100 + i) * 3] = 200; color[(200 * 100 + i) * 3 + 1] = 30; color[(200 * 100 + i) * 3 + 2] = 30; }
  const colored = LA.cleanCandidate(encodeRGBPNG({ w: 200, h: 260, rgb: color }));
  ok((colored.notes || []).some(n => /color in/.test(n)), "a colored picture is noted as having color");
  const ls = LA.lineStats({ w: 100, h: 100, px: new Uint8Array(100 * 100).map((_, i) => (i % 100) >= 40 && (i % 100) < 52 ? 1 : 0) }, 100 / 300);
  ok(ls && ls.px === 12 && Math.abs(ls.pt - 2.88) < .01, "line widths are measured in points at the page's size");
}

/* ---------- the choosing ---------- */
{
  const rec = (fails, regions, fill, xor, near) => ({ checks: [...fails.map(id => ({ id, result: "fail" })), { id: "closed-shapes", result: "fail" }, { id: "subject-recognizable", result: "ask" }], tiers: { 1: { regions, subject_fill: fill } }, fidelity: { xor_share: xor }, trace: { near_ends: near } });
  const a = LA.scoreRecord(rec([], 40, .7, .01, 2)), b = LA.scoreRecord(rec([], 140, .3, .05, 20)), c = LA.scoreRecord(rec(["area-size"], 45, .8, 0, 0));
  ok(a.pass && b.pass && !c.pass && c.fails.join() === "area-size", "a candidate passes when none of the measured checks fails (closed-shapes and the human checks do not decide)");
  ok(a.score > b.score && LA.pickBest([c, b, a]) === 2 && LA.pickBest([c, null]) === 0 && LA.pickBest([]) === -1, "passing wins, then the clearer page; an empty round chooses nothing");
  ok(/40 areas at Tier 1, subject fills 70%/.test(a.why) && /fails area-size/.test(c.why), "the reason is written for a person");
  const page = LA.reviewPage([{ id: "x", title: "<script>alert(1)</script>", engine: "standin", status: "passes", prompt: "p", chosen: "r1c1", candidates: [{ name: "r1c1", round: 1, seed: 1, pass: true, score: 900, why: "ok" }] }], "2026-01-01");
  ok(page.indexOf("<script>alert") < 0 && page.indexOf("&lt;script&gt;") > 0, "the review page shows words as words, never as code");
}

/* ---------- a pretend ComfyUI on this computer ---------- */
function fakeComfy(){
  const jobs = [], sockets = new Map(), history = {}, pictures = {}, state = { drop: false };
  let n = 0;
  const frame = (op, payload) => { const b = Buffer.from(payload); const head = b.length < 126 ? Buffer.from([0x80 | op, b.length]) : Buffer.from([0x80 | op, 126, b.length >> 8, b.length & 255]); return Buffer.concat([head, b]); };
  const send = (cid, obj) => { const s = sockets.get(cid); if (s && !s.destroyed) s.write(frame(1, JSON.stringify(obj))); };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://127.0.0.1"), json = (o, code = 200) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    if (u.pathname === "/system_stats") return json({ system: { comfyui_version: "0.0-check" } });
    if (u.pathname === "/object_info/CheckpointLoaderSimple") return json({ CheckpointLoaderSimple: { input: { required: { ckpt_name: [["lineart-test.safetensors", "other.safetensors"]] } } } });
    if (u.pathname.startsWith("/history/")){ const id = u.pathname.slice(9); return json(history[id] ? { [id]: history[id] } : {}); }
    if (u.pathname === "/view"){ const p = pictures[u.searchParams.get("filename")]; if (!p || u.searchParams.get("type") !== "output") return json({ error: "no such picture" }, 404); res.writeHead(200, { "Content-Type": "image/png" }); return res.end(p); }
    if (u.pathname === "/prompt" && req.method === "POST"){
      let body = ""; req.on("data", d => body += d); req.on("end", () => {
        const q = JSON.parse(body), id = "job-" + (++n), graph = q.prompt;
        const seed = Object.values(graph).map(x => x.inputs && x.inputs.seed).find(v => v !== undefined);
        jobs.push({ id, graph, client_id: q.client_id, socketFirst: sockets.has(q.client_id) });
        json({ prompt_id: id, number: n, node_errors: {} });
        setTimeout(() => {
          if (state.drop){ const s = sockets.get(q.client_id); if (s) s.destroy(); }              // the progress connection drops mid-job
          send(q.client_id, { type: "executing", data: { node: "3", prompt_id: id } });
          const s = sockets.get(q.client_id); if (s && !s.destroyed) s.write(frame(2, Buffer.from([0, 0, 0, 1, 9, 9, 9])));     // a preview picture
          send(q.client_id, { type: "progress", data: { value: 1, max: 2, prompt_id: id } });
          if (JSON.stringify(graph).includes("check-make-it-fail")){
            send(q.client_id, { type: "execution_error", data: { prompt_id: id, exception_message: "out of memory (a check)" } });
            history[id] = { outputs: {}, status: { status_str: "error" } };
            return;
          }
          const name = `cognicopia_${String(n).padStart(5, "0")}_.png`;
          pictures[name] = testPicture("sunflower", Number(seed) % 97 + 1);
          history[id] = { outputs: { 9: { images: [{ filename: name, subfolder: "", type: "output" }, { filename: "preview.png", subfolder: "", type: "temp" }] } }, status: { status_str: "success" } };
          send(q.client_id, { type: "executing", data: { node: null, prompt_id: id } });
        }, 40);
      });
      return;
    }
    json({ error: "not here" }, 404);
  });
  server.on("upgrade", (req, socket) => {
    const u = new URL(req.url, "http://127.0.0.1");
    if (u.pathname !== "/ws"){ socket.destroy(); return; }
    const accept = crypto.createHash("sha1").update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    socket.on("error", () => {}); socket.on("data", () => {});
    sockets.set(u.searchParams.get("clientId"), socket);
    socket.write(frame(1, JSON.stringify({ type: "status", data: { status: { exec_info: { queue_remaining: 0 } }, sid: u.searchParams.get("clientId") } })));
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve({ port: server.address().port, jobs, state, close: () => { sockets.forEach(s => s.destroy()); server.close(); } })));
}
/* a port where nothing answers */
const closedPort = () => new Promise(resolve => { const s = http.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); }); });

/* ---------- every route, end to end ---------- */
const geometric = C.designs().find(d => LA.GEOMETRIC.includes(d.cat));
const lines = [];
{
  /* test pictures with a bad first round: refined, then a master and its sidecar in the inbox */
  const inbox = path.join(TMP, "inbox"), rev = path.join(TMP, "review");
  const r = await agent(["make", "--only", "rocking-chair", "--engine", "standin", "--candidates", "2", "--rounds", "2", "--standin-bad-rounds", "1", "--inbox", inbox, "--review", rev]);
  const s = summary(rev, "rocking-chair") || { candidates: [] };
  const r1 = s.candidates.filter(c => c.round === 1), r2 = s.candidates.filter(c => c.round === 2);
  ok(r.code === 0 && s.status === "master in the inbox", "test pictures: a master reaches the inbox: " + (s.status || r.out + r.err));
  ok(r1.length === 2 && r1.every(c => !c.pass && c.code === "dark") && r2.length === 2 && r2.some(c => c.pass), "a round where every candidate fails is followed by a new round, which passes");
  ok(r2.length && r2[0].prompt.includes(LA.HINTS.dark) && !r1[0].prompt.includes(LA.HINTS.dark), "the new round's words carry the hint for what failed");
  const png = fs.existsSync(path.join(inbox, "rocking-chair.png")) ? fs.readFileSync(path.join(inbox, "rocking-chair.png")) : Buffer.alloc(40);
  ok(isMaster(png), "the master is 1-bit, 1800 x 2400, 300 dpi: " + JSON.stringify(pngInfo(png)));
  let side = {}; try { side = JSON.parse(fs.readFileSync(path.join(inbox, "rocking-chair.json"), "utf8")); } catch (e){}
  ok(side.job_id === "rocking-chair" && side.category === C.design("rocking-chair").cat && side.generator === "local:standin" && side.prompt.startsWith(LA.PREFIX) && /not for the library/.test(side.license || ""), "the sidecar names the design, its category, the engine, the words and the license note");
  ok(side.agent && side.agent.engine === "standin" && side.agent.round === 2 && side.agent.passed === true && side.agent.candidates === 4 && side.agent.negative === LA.NEGATIVE && Array.isArray(side.agent.fixes) && /^\d{4}-\d\d-\d\d$/.test(side.agent.made), "and records the seed, round, score, fixes and date of the chosen candidate");
  ok(fs.existsSync(path.join(rev, "index.html")) && ["tier-1.svg", "tier-2.svg", "tier-3.svg"].every(f => fs.existsSync(path.join(rev, "rocking-chair", f))) && s.candidates.every(c => !c.raw || fs.existsSync(path.join(rev, c.raw))), "the review page, every candidate's picture and the three vector tiers are written");
  /* the real ingest and the review sheet take the master as they take any other */
  const root = path.join(TMP, "root"), out = path.join(TMP, "sheets"); fs.mkdirSync(root);
  const ing = spawnSync(process.execPath, [path.join(ROOT, "scripts/ingest_coloring_assets.mjs"), "--inbox", inbox, "--root", root], { encoding: "utf8" });
  const artFile = path.join(root, "src", "data", "coloring_art", "rocking-chair.json");
  let art = {}; try { art = JSON.parse(fs.readFileSync(artFile, "utf8")); } catch (e){}
  ok(ing.status === 0 && art.review && art.review.status === "needs-review" && art.source && art.source.generator === "local:standin" && art.source.prompt === side.prompt, "the library ingest takes the master and holds it for a person to review: " + (ing.stderr || "").slice(0, 200));
  const sheet = spawnSync(process.execPath, [path.join(ROOT, "scripts/review_coloring_art.mjs"), "--root", root, "--out", out, "--id", "rocking-chair"], { encoding: "utf8" });
  ok(sheet.status === 0 && fs.readdirSync(out).some(f => f.endsWith(".html")), "and its review sheet is written");
  lines.push("test pictures");
}
{
  /* new words, test pictures without --inbox: the closest library design is drawn, and nothing goes to the real inbox */
  const rev = path.join(TMP, "review-new"), realInbox = path.join(ROOT, "assets/coloring/_inbox/porch-rocker.png"), had = fs.existsSync(realInbox);
  const r = await agent(["make", "--prompt", "a wooden rocking chair on a quiet porch", "--id", "porch-rocker", "--category", "home-everyday", "--engine", "standin", "--candidates", "1", "--rounds", "1", "--review", rev]);
  const s = summary(rev, "porch-rocker") || {};
  ok(r.code === 0 && s.reviewOnly && /review only/.test(s.status) && fs.existsSync(realInbox) === had, "test pictures for new words stay on the review page and never reach the real inbox: " + (s.status || r.out));
  ok(s.prompt === LA.wrapPrompt("a wooden rocking chair on a quiet porch"), "a new picture's words are wrapped like any other");
  const r2 = await agent(["make", "--prompt", "a teapot", "--id", "teapot-x", "--category", "not-a-category", "--engine", "standin"]);
  ok(r2.code === 1 && /needs --category, one of: .*home-everyday/.test(r2.out), "a new picture without a real category is stopped with the list of categories");
}
{
  /* the dignity filter: words it sets aside never reach an engine */
  const rev = path.join(TMP, "review-dignity"), inbox = path.join(TMP, "inbox-dignity");
  const r = await agent(["make", "--prompt", "a cute teddy bear for the kids", "--id", "bear", "--category", "home-everyday", "--engine", "standin", "--inbox", inbox, "--review", rev]);
  const s = summary(rev, "bear") || {};
  ok(r.code === 1 && s.status === "words set aside" && /"cute"/.test(s.message) && /plain adult words/.test(s.message) && !s.candidates.length && !fs.existsSync(inbox), "words the dignity filter sets aside are refused before any picture is made, and the person is told why");
}
{
  /* the library's exact patterns: kept as drawn, without a picture engine */
  const rev = path.join(TMP, "review-geo"), port = await closedPort();
  const r = await agent(["make", "--only", geometric.id, "--review", rev, "--port", String(port)]);
  const s = summary(rev, geometric.id) || {};
  const exact = path.join(rev, geometric.id, "exact-tier-1.png");
  ok(r.code === 0 && s.engine === "procedural" && s.status === "kept as drawn", `a geometric pattern (${geometric.id}) is kept as drawn on the automatic route: ` + (s.status || r.out));
  ok(fs.existsSync(exact) && isMaster(fs.readFileSync(exact)) && [1, 2, 3].every(t => /<svg[\s\S]*<\/svg>/.test(fs.readFileSync(path.join(rev, geometric.id, `tier-${t}.svg`), "utf8"))), "its exact page is written at 1800 x 2400, 300 dpi, with its three vector tiers");
  lines.push("procedural");
}
{
  /* a folder of pictures made in another program */
  const from = path.join(TMP, "from"), rev = path.join(TMP, "review-folder"), inbox = path.join(TMP, "inbox-folder"); fs.mkdirSync(from);
  fs.writeFileSync(path.join(from, "rocking-chair-a.png"), testPicture("rocking-chair", 5, { pt: 3 }));
  fs.writeFileSync(path.join(from, "rocking-chair_b.png"), testPicture("rocking-chair", 6, { pt: 3 }));
  fs.writeFileSync(path.join(from, "rocking-chairs.png"), testPicture("sunflower", 1));                  // another design's name: not taken
  const r = await agent(["make", "--only", "rocking-chair", "--engine", "folder", "--from", from, "--rounds", "1", "--inbox", inbox, "--review", rev]);
  const s = summary(rev, "rocking-chair") || { candidates: [] };
  ok(r.code === 0 && s.status === "master in the inbox" && s.candidates.length === 2 && s.candidates.every(c => /^rocking-chair[-_]/.test(c.file)), "a folder of pictures: the ones named for the design are cleaned, checked and the best kept: " + (s.status || r.out));
  const none = await agent(["make", "--only", "sunflower", "--engine", "folder", "--from", from, "--review", rev]);
  ok(none.code === 1 && /no pictures named sunflower\*\.png/.test(none.out), "a design with no pictures in the folder is said plainly");
  lines.push("folder");
}
{
  /* no engine at all: said plainly, with the next step */
  const rev = path.join(TMP, "review-none"), port = await closedPort();
  const r = await agent(["make", "--only", "sunflower", "--review", rev, "--port", String(port)]);
  const s = summary(rev, "sunflower") || {};
  ok(r.code === 1 && s.status === "no engine" && /npm run art:doctor/.test(s.message) && !/Error|Traceback|undefined/.test(r.out), "with no picture engine ready, the agent says so plainly and names the next step");
  const d = await agent(["doctor", "--json", "--port", String(port)]);
  let dj = {}; try { dj = JSON.parse(d.out.trim().split("\n").pop()); } catch (e){}
  ok(d.code === 0 && JSON.stringify(dj.engines) === JSON.stringify(["procedural", "folder", "standin"]), "the doctor lists the engines that are ready: " + JSON.stringify(dj.engines));
  if (PY) ok(dj.readiness && dj.readiness.guard && dj.readiness.guard.ok && dj.readiness.comfyui && dj.readiness.comfyui.reachable === false, "and, with Python, that the offline guard works and ComfyUI is not answering");
  const h = await agent([]);
  ok(/npm run art:doctor/.test(h.out) && /npm run art:make/.test(h.out) && !/import /.test(h.out), "with no command, the agent prints its own short guide");
}
if (PY){
  /* ComfyUI on this computer */
  const fake = await fakeComfy();
  try {
    const inbox = path.join(TMP, "inbox-comfy"), rev = path.join(TMP, "review-comfy");
    const r = await agent(["make", "--only", "sunflower", "--candidates", "2", "--rounds", "1", "--port", String(fake.port), "--inbox", inbox, "--review", rev]);
    const s = summary(rev, "sunflower") || { candidates: [] };
    ok(r.code === 0 && /^comfyui \(lineart-test\.safetensors\)$/.test(s.engine) && s.status === "master in the inbox", "ComfyUI on this computer: chosen on the automatic route, and its pictures make a master: " + (s.engine + " " + s.status + " " + r.out + r.err).slice(0, 300));
    const g = (fake.jobs[0] || {}).graph || {};
    const kind = t => Object.values(g).find(x => x.class_type === t) || { inputs: {} };
    const texts = Object.values(g).filter(x => x.class_type === "CLIPTextEncode").map(x => x.inputs.text);
    ok(fake.jobs.length === 2 && fake.jobs.every(j => j.socketFirst), "one job per candidate, each with its progress connection opened before the job was handed over");
    ok(kind("CheckpointLoaderSimple").inputs.ckpt_name === "lineart-test.safetensors" && texts[0] === s.prompt && texts[1] === LA.NEGATIVE, "the job uses ComfyUI's first model, the wrapped words and the words to keep out");
    ok(kind("EmptyLatentImage").inputs.width === 864 && kind("EmptyLatentImage").inputs.height === 1152 && kind("EmptyLatentImage").inputs.width * 4 === kind("EmptyLatentImage").inputs.height * 3, "the canvas is 3:4");
    ok(fake.jobs.map(j => Object.values(j.graph).find(x => x.class_type === "KSampler").inputs.seed).join() === s.candidates.map(c => c.seed).join(), "each candidate's seed is the seed ComfyUI was given");
    let side = {}; try { side = JSON.parse(fs.readFileSync(path.join(inbox, "sunflower.json"), "utf8")); } catch (e){}
    ok(side.generator === "local:comfyui (lineart-test.safetensors)" && /check the license of the model/.test(side.license), "the sidecar names ComfyUI's model and asks for its license to be checked");
    /* FLUX through the workflow kept in the repository, and an error said plainly */
    fake.jobs.length = 0; fake.state.drop = true;
    const rf = await agent(["make", "--only", "sunflower", "--candidates", "1", "--rounds", "1", "--port", String(fake.port), "--workflow", "flux", "--review", path.join(TMP, "review-flux"), "--inbox", path.join(TMP, "inbox-flux")]);
    const fg = (fake.jobs[0] || {}).graph || {}, ks = Object.values(fg).find(x => x.class_type === "KSampler") || { inputs: {} }, lat = Object.values(fg).find(x => x.class_type === "EmptySD3LatentImage") || { inputs: {} };
    ok(rf.code === 0 && Object.values(fg).some(x => x.class_type === "UNETLoader") && typeof ks.inputs.seed === "number" && lat.inputs.width === 864 && lat.inputs.height === 1152 && Object.values(fg).some(x => x.class_type === "CLIPTextEncode" && x.inputs.text.startsWith(LA.PREFIX)) && !JSON.stringify(fg).includes("%"), "--workflow flux sends the FLUX graph with the words, seed and 3:4 size filled in, and a progress connection that drops mid-job is not a failure (ComfyUI is asked instead): " + rf.out.slice(0, 200));
    fake.state.drop = false;
    const wf = path.join(TMP, "fail.json"); fs.writeFileSync(wf, JSON.stringify({ 1: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "check-make-it-fail" } }, 2: { class_type: "KSampler", inputs: { seed: "%SEED%" } }, 3: { class_type: "CLIPTextEncode", inputs: { text: "%PROMPT%" } } }));
    const re = await agent(["make", "--only", "sunflower", "--candidates", "1", "--rounds", "1", "--port", String(fake.port), "--workflow", wf, "--engine", "comfyui", "--review", path.join(TMP, "review-err")]);
    const se = summary(path.join(TMP, "review-err"), "sunflower") || {};
    ok(re.code === 1 && se.status === "engine stopped" && /ComfyUI stopped with an error: out of memory \(a check\)/.test(se.message), "an error inside ComfyUI is passed on in plain words: " + (se.message || re.out));
    lines.push("ComfyUI");
  } finally { fake.close(); }
  /* the Python pieces */
  const g = spawnSync(PY, [path.join(ROOT, "scripts/local_art/generate.py"), "--guard-selftest"], { encoding: "utf8", env: PYENV });
  let gj = {}; try { gj = JSON.parse(g.stdout.trim().split("\n").pop()); } catch (e){}
  ok(g.status === 0 && gj.ok && Object.entries(gj).filter(([k]) => k !== "ok" && k !== "this computer").every(([, v]) => v === "refused") && gj["this computer"] === "allowed", "the offline guard refuses outside addresses, outside names and other kinds of connection, and allows this computer: " + g.stdout.slice(0, 300));
  const away = spawnSync(PY, [path.join(ROOT, "scripts/local_art/comfyui.py"), "--check", "--host", "example.org"], { encoding: "utf8", env: PYENV });
  let aj = {}; try { aj = JSON.parse(away.stdout); } catch (e){}
  ok(aj.reachable === false && /must run on this computer/.test(aj.error || ""), "ComfyUI is only ever asked for on this computer: " + away.stdout.slice(0, 200));
  const files = fs.readdirSync(path.join(ROOT, "scripts/local_art")).filter(f => f.endsWith(".py")).map(f => path.join(ROOT, "scripts/local_art", f));
  const comp = spawnSync(PY, ["-c", "import ast,sys\nfor f in sys.argv[1:]: ast.parse(open(f, encoding='utf-8').read(), f)", ...files], { encoding: "utf8", env: PYENV });
  ok(comp.status === 0, "every Python piece is valid Python: " + comp.stderr.slice(0, 300));
  ok(!fs.existsSync(path.join(ROOT, "scripts/local_art/__pycache__")), "running the Python pieces leaves no cache files in the repository");
} else notes.push("Python 3 is not installed here, so the ComfyUI route and the offline guard were not run (the rest was)");

/* ---------- nothing leaves the computer ---------- */
{
  const agentSrc = read("scripts/local_art_agent.mjs"), libSrc = read("scripts/lib/local-art.mjs");
  const imports = s => [...s.matchAll(/^import .* from "([^"]+)";/gm)].map(m => m[1]);
  ok(imports(agentSrc).every(m => ["fs", "os", "path", "vm", "child_process"].includes(m) || m.startsWith("./lib/")) && imports(libSrc).every(m => m.startsWith("./")), "the Node agent imports no network module: " + imports(agentSrc).join(", "));
  ok(![agentSrc, libSrc].some(s => /\bfetch\(|XMLHttpRequest|WebSocket|require\(["'](https?|net|dgram|tls)["']\)|from ["'](https?|net|dgram|tls|node:https?|node:net)["']/.test(s)), "and makes no request of its own");
  ok((agentSrc.match(/fetch_model\.py/g) || []).length === 1 && agentSrc.indexOf("fetch_model.py") > agentSrc.indexOf("function setup()") && agentSrc.indexOf("fetch_model.py") < agentSrc.indexOf("/* ---------- the library, its words"), "the one download step (fetch_model.py) is run only by setup");
  for (const f of ["generate.py", "comfyui.py", "selftest.py"]){
    const s = read("scripts/local_art/" + f), guard = s.indexOf("\ninstall_guard()"), first = Math.min(...["\ndef ", "\nclass "].map(k => { const i = s.indexOf(k); return i < 0 ? Infinity : i; }));
    ok(guard > 0 && guard < first && !/^\s*(import|from) (torch|diffusers|transformers|huggingface_hub)/m.test(s.slice(0, guard)), `${f} puts the offline guard in before anything else runs`);
  }
  const gen = read("scripts/local_art/generate.py"), cf = read("scripts/local_art/comfyui.py");
  ok(/"local_files_only": True/.test(gen) && /ProxyHandler\(\{\}\)/.test(cf) && /if not is_local\(host\)/.test(cf), "the model is read from its folder only, and ComfyUI is reached directly, on this computer only");
  ok(!/Export \(API\)/.test(cf), "the ComfyUI notes name no menu item");
  const site = ["index.html", "builder.html", "profile.html", "sw.js"].map(read).join("\n");
  ok(!/local_art|local-art/.test(site), "the website never loads the local art agent");
  const ig = read(".gitignore");
  ok(/\*\.safetensors/.test(ig) && /\*\.ckpt/.test(ig) && /__pycache__/.test(ig) && /^\/assets\/coloring\/_review\/$/m.test(ig), "model weights, Python caches and the review pages are never committed");
  const pkg = JSON.parse(read("package.json"));
  ok(["doctor", "setup", "make", "library"].every(c => pkg.scripts["art:" + c] === "node scripts/local_art_agent.mjs " + c), "npm run art:doctor, art:setup, art:make and art:library run the agent");
  const req = read("scripts/local_art/requirements.txt");
  ok(["torch", "diffusers", "transformers", "accelerate", "safetensors", "huggingface_hub"].every(p => new RegExp("^" + p + ">=[\\d.]+,<\\d+$", "m").test(req)), "the model route's packages are listed with version ranges");
  let flux = {}; try { flux = JSON.parse(read("scripts/local_art/workflows/flux1-schnell.json")); } catch (e){}
  const ids = new Set(Object.keys(flux)), links = Object.values(flux).flatMap(n => Object.values(n.inputs || {}).filter(v => Array.isArray(v)));
  ok(ids.size >= 8 && links.every(l => ids.has(l[0])) && Object.values(flux).some(n => n.class_type === "SaveImage") && JSON.stringify(flux).includes("%PROMPT%") && JSON.stringify(flux).includes("%SEED%"), "the FLUX workflow is whole: every link points at a node, and it has the words, the seed and a save");
  const doc = fs.existsSync(path.join(ROOT, "docs/local-art-agent.md")) ? read("docs/local-art-agent.md") : "";
  ok(doc.length > 2000 && /npm run art:doctor/.test(doc) && /No description, prompt, picture or resident detail leaves your computer/.test(doc) && /What was tested, and what was not/.test(doc), "the owner's guide exists");
  ok(doc.indexOf("{" + "{") < 0 && doc.indexOf("{" + "%") < 0 && !/HIPAA compliant/i.test(doc), "the guide has no Liquid openers and makes no compliance claim");
}

/* ---------- the library review ---------- */
{
  const out = path.join(TMP, "library");
  const r = await agent(["library", "--json", "--out", out]);
  let j = {}; try { j = JSON.parse(r.out.trim().split("\n").pop()); } catch (e){}
  const rep = fs.existsSync(path.join(out, "report.json")) ? JSON.parse(fs.readFileSync(path.join(out, "report.json"), "utf8")) : { rows: [] };
  ok(r.code === 0 && j.designs === C.designs().length && j.keep + j.upgrade === j.designs && j.keep === C.designs().filter(d => LA.GEOMETRIC.includes(d.cat)).length, "the library review covers every design, and keeps exactly the geometric ones: " + JSON.stringify(j));
  ok(rep.rows.length === j.designs && rep.rows.every(x => x.tiers.length === 3 && Array.isArray(x.problems) && x.meets_standards === !x.problems.length), "each design is measured at all three tiers, with its problems named");
  ok(fs.existsSync(path.join(out, "index.html")), "and the review page is written");
}

fs.rmSync(TMP, { recursive: true, force: true });
if (fails.length){ console.log(`local art agent check FAILED: ${fails.length} problem(s), ${pass} passed\n  - ` + fails.slice(0, 30).join("\n  - ")); process.exit(1); }
console.log(`local art agent check passed: ${pass} checks in ${Math.round((Date.now() - T0) / 1000)} s (the words, the cleaning, the choosing, the routes: ${lines.join(", ")}, the real ingest, nothing leaving the computer, and the library review)${notes.length ? "\n  note: " + notes.join("; ") : ""}`);
