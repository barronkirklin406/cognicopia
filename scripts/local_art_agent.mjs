#!/usr/bin/env node
/* =====================================================================
   Cognicopia local art agent: coloring-page masters made from words, on
   this computer only. Nothing it is given (a description, a prompt, a
   picture) is sent anywhere: the picture engines run here, the Python
   pieces refuse every connection but one to this computer, and this file
   makes no network request at all.

     npm run art:doctor                     is this computer ready? (add -- --selftest to prove the model route works)
     npm run art:setup                      once: the model route's Python environment and one picture model
                                            (the only step that downloads anything; nothing about Cognicopia is sent)
     npm run art:make -- --only sunflower   make a master for one library design, from the owner's description
     npm run art:make -- --all              every library design (geometric patterns are kept as drawn)
     npm run art:make -- --prompt "a teapot on a lace cloth" --id teapot-lace --category home-everyday
     npm run art:library                    review the current library against the standards, and what to upgrade

   The picture engines, chosen per picture with --engine (default auto):
     comfyui     ComfyUI running on this computer (127.0.0.1:8188): an SDXL checkpoint it has, or FLUX with --workflow flux
     diffusers   a model downloaded by art:setup, run by scripts/local_art/generate.py
     procedural  the library's own code-drawn picture, exactly (quilts, mandalas, patterns): exported, never traced
     folder      pictures made in any program on this computer: --from <folder>, named <design-id>*.png
     standin     test pictures drawn from the library (for checking the workflow without a model)
     auto        geometric patterns: procedural; everything else: comfyui if it answers, else diffusers

   For each picture: the owner's words in the clinical prompt wrapper (and the dignity filter); several
   candidates; each cleaned to a pure black-and-white 3:4 master (1800 x 2400, 300 dpi, lines at the
   3 pt floor) and run through the library ingest's own checks in a dry run; the best one is kept; when
   none passes, the words are adjusted for what failed and a new round is made. The chosen master and its
   sidecar go to assets/coloring/_inbox/ for the usual review (npm run coloring:ingest, coloring:review,
   --approve); every candidate, its checks and the vector tiers go to assets/coloring/_review/agent/.

   Options for make: --engine, --candidates 4, --rounds 2, --fresh (new seeds), --steps, --cfg, --width 864
   --height 1152, --checkpoint, --workflow <file, or flux>, --port, --from, --inbox, --review, --keep-best, --dry-run.
   Settings live in ~/.cognicopia/art-agent.json (COGNICOPIA_HOME moves it), never in the repository.
   Node built-ins only (plus Python for the comfyui and diffusers engines).
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";
import { spawnSync, execFileSync } from "child_process";
import { loadCognicopiaColoring, ROOT } from "./lib/cognicopia-coloring.mjs";
import { shapesFromRender, createBitmap, paint } from "./lib/raster.mjs";
import { encodeBitPNG, encodeRGBPNG } from "./lib/png.mjs";
import { standInGray } from "./lib/standins.mjs";
import { renderArt } from "./lib/tiers.mjs";
import { readArt } from "./lib/art.mjs";
import * as LA from "./lib/local-art.mjs";

const args = process.argv.slice(2);
const cmd = args[0] && !args[0].startsWith("--") ? args[0] : "help";
const opt = (name, def) => { const i = args.indexOf("--" + name); return i < 0 ? def : (args[i + 1] !== undefined && !args[i + 1].startsWith("--") ? args[i + 1] : true); };
const has = name => args.includes("--" + name);
const abs = f => path.isAbsolute(f) ? f : path.join(ROOT, f);
const rel = f => { const r = path.relative(ROOT, f); return r.startsWith("..") || path.isAbsolute(r) ? f : r.split(path.sep).join("/"); };
const today = () => new Date().toISOString().slice(0, 10);
const say = s => process.stdout.write(s + "\n");

const HOME = process.env.COGNICOPIA_HOME ? path.resolve(process.env.COGNICOPIA_HOME) : path.join(os.homedir(), ".cognicopia");
const CONFIG = path.join(HOME, "art-agent.json");
const PY_DIR = path.join(ROOT, "scripts", "local_art");
const readConfig = () => { try { return JSON.parse(fs.readFileSync(CONFIG, "utf8")); } catch (e){ return {}; } };
const writeConfig = c => { fs.mkdirSync(HOME, { recursive: true }); fs.writeFileSync(CONFIG, JSON.stringify(c, null, 1) + "\n"); };
const cfg = readConfig();

/* ---------- Python on this computer ---------- */
const venvPython = dir => process.platform === "win32" ? path.join(dir, "Scripts", "python.exe") : path.join(dir, "bin", "python");
function pyVersion(cmdv){
  try {
    const r = spawnSync(cmdv[0], [...cmdv.slice(1), "--version"], { encoding: "utf8", timeout: 20000 });
    const m = /Python (\d+)\.(\d+)\.(\d+)/.exec((r.stdout || "") + (r.stderr || ""));
    return m ? { cmd: cmdv, version: m.slice(1).join("."), minor: +m[2], major: +m[1] } : null;
  } catch (e){ return null; }
}
function systemPython(){
  const tries = process.platform === "win32" ? [["py", "-3"], ["python"], ["python3"]] : [["python3"], ["python"]];
  for (const t of tries){ const v = pyVersion(t); if (v && v.major === 3) return v; }
  return null;
}
function modelPython(){ const p = cfg.python && fs.existsSync(cfg.python) ? pyVersion([cfg.python]) : null; return p; }
/* Run one of the Python pieces; it is told it is offline and never goes through a proxy. */
function runPy(py, script, pargs, o = {}){
  const env = Object.assign({}, process.env, { HF_HUB_OFFLINE: "1", TRANSFORMERS_OFFLINE: "1", HF_HUB_DISABLE_TELEMETRY: "1", DO_NOT_TRACK: "1", PYTHONDONTWRITEBYTECODE: "1", NO_PROXY: "127.0.0.1,localhost,::1", no_proxy: "127.0.0.1,localhost,::1", PYTHONIOENCODING: "utf-8" }, o.env || {});
  return spawnSync(py.cmd[0], [...py.cmd.slice(1), path.join(PY_DIR, script), ...pargs], { encoding: "utf8", timeout: o.timeout || 3600000, env, stdio: o.inherit ? "inherit" : "pipe", maxBuffer: 64 * 1024 * 1024 });
}
const lastJson = out => { const l = String(out || "").trim().split("\n").filter(x => x.trim().startsWith("{")).pop(); try { return l ? JSON.parse(l) : null; } catch (e){ return null; } };

/* ---------- what is ready ---------- */
const comfyOpts = () => ({ port: +(opt("port") !== undefined && opt("port") !== true ? opt("port") : (cfg.comfyui && cfg.comfyui.port) || 8188) });
/* a ComfyUI workflow in its API format: --workflow <file>, or --workflow flux for the FLUX.1 schnell graph kept in scripts/local_art/workflows */
const WORKFLOWS = { flux: "flux1-schnell.json", "flux1-schnell": "flux1-schnell.json" };
function workflowFile(){
  const w = opt("workflow") && opt("workflow") !== true ? String(opt("workflow")) : (cfg.comfyui && cfg.comfyui.workflow) || "";
  if (!w) return "";
  return WORKFLOWS[w] ? path.join(PY_DIR, "workflows", WORKFLOWS[w]) : path.resolve(w);
}
let readyCache = null;
function readiness(){
  if (readyCache) return readyCache;
  const sys = systemPython(), mp = modelPython(), out = { python: sys, guard: null, comfyui: null, model: null };
  if (sys){
    out.guard = lastJson(runPy(sys, "generate.py", ["--guard-selftest"], { timeout: 60000 }).stdout);
    out.comfyui = lastJson(runPy(sys, "comfyui.py", ["--check", "--port", String(comfyOpts().port)], { timeout: 60000 }).stdout);
  }
  if (mp){ const r = lastJson(runPy(mp, "generate.py", ["--check", "--model-dir", (cfg.model && cfg.model.dir) || ""], { timeout: 300000 }).stdout); out.model = r; out.modelPython = mp; }
  out.comfyuiReady = !!(out.comfyui && out.comfyui.reachable && ((out.comfyui.checkpoints || []).length || workflowFile()));
  out.diffusersReady = !!(out.model && out.model.model && out.model.model.ready && out.model.packages && out.model.packages.diffusers && out.model.packages.torch);
  return (readyCache = out);
}

/* ---------- doctor ---------- */
function doctor(){
  const r = readiness(), lines = [], nodeOk = +process.versions.node.split(".")[0] >= 20;
  const row = (ok, what, detail) => lines.push(`  ${ok ? "ready  " : "not yet"}  ${what}${detail ? ": " + detail : ""}`);
  row(nodeOk, "Node", process.versions.node + (nodeOk ? "" : " (20 or newer is needed)"));
  row(!!r.python, "Python", r.python ? `${r.python.version} (${r.python.cmd.join(" ")})` : "not found; install Python 3.10 or newer from python.org");
  row(!!(r.guard && r.guard.ok), "Offline guard", r.guard ? (r.guard.ok ? "outside addresses refused, this computer allowed" : JSON.stringify(r.guard)) : "needs Python");
  row(r.comfyuiReady, "ComfyUI on this computer", r.comfyui ? (r.comfyui.reachable ? `answering at 127.0.0.1:${r.comfyui.port}${r.comfyui.version ? " (version " + r.comfyui.version + ")" : ""}, models: ${(r.comfyui.checkpoints || []).join(", ") || "none yet"}` : `not answering at 127.0.0.1:${comfyOpts().port}`) : "needs Python");
  const pk = r.model && r.model.packages;
  row(!!(pk && pk.torch && pk.diffusers), "Picture-model packages", pk ? Object.entries(pk).map(([k, v]) => `${k} ${v || "missing"}`).join(", ") : "not installed (npm run art:setup)");
  row(!!(r.model && r.model.model && r.model.model.ready), "Picture model on disk", r.model && r.model.model && r.model.model.ready ? `${(r.model.model.download || {}).repo || r.model.model.dir}` : "none yet (npm run art:setup)");
  if (r.model && r.model.device) row(true, "Model device", r.model.device + (r.model.device === "cpu" ? " (no graphics card found: expect several minutes per picture)" : r.model.device_name ? ` (${r.model.device_name}, ${r.model.device_memory_gb} GB)` : ""));
  row(true, "Procedural renderer", "draws the library's own patterns exactly");
  let self = null;
  if (has("selftest")){
    const mp = r.modelPython;
    self = mp ? lastJson(runPy(mp, "selftest.py", [], { timeout: 1800000 }).stdout) : { ok: false, error: "the picture-model packages are not installed (npm run art:setup)" };
    row(!!(self && self.ok), "Model route self-test", self && self.ok ? `a tiny model made here drew ${self.images} pictures through generate.py in ${self.seconds} s, with the network refused` : (self && self.error) || "did not run");
  }
  const engines = ["procedural", r.comfyuiReady && "comfyui", r.diffusersReady && "diffusers", "folder", "standin"].filter(Boolean);
  if (has("json")){ say(JSON.stringify({ readiness: r, engines, selftest: self })); return; }
  say("Cognicopia local art agent: is this computer ready?\n" + lines.join("\n"));
  say(`\nEngines ready now: ${engines.join(", ")}.`);
  const next = !r.python ? "Install Python 3.10 or newer from python.org, then run npm run art:doctor again."
    : r.comfyuiReady || r.diffusersReady ? "Make a first master: npm run art:make -- --only sunflower"
    : "Either start ComfyUI on this computer with a model in it, or run npm run art:setup once to install a picture model. Then run npm run art:doctor again.";
  say("Next step: " + next);
}

/* ---------- setup (the one step that downloads) ---------- */
function setup(){
  const sys = systemPython();
  if (!sys || sys.minor < 10){ say("Python 3.10 or newer is needed for the picture-model route. Install it from python.org, then run npm run art:setup again." + (sys ? ` (found ${sys.version})` : "")); process.exitCode = 1; return; }
  const venv = path.resolve(String(opt("venv") && opt("venv") !== true ? opt("venv") : path.join(HOME, "art-venv")));
  say("This is the one step of the local art agent that uses the internet: it installs Python packages and downloads one picture model.\nIt sends nothing about Cognicopia, a resident or a picture. Afterwards every step runs with the network refused.\n");
  if (!fs.existsSync(venvPython(venv))){
    say(`1. Making a Python environment for the agent in ${venv}`);
    const r = spawnSync(sys.cmd[0], [...sys.cmd.slice(1), "-m", "venv", venv], { stdio: "inherit" });
    if (r.status !== 0){ say("Could not make the Python environment."); process.exitCode = 1; return; }
  } else say(`1. The Python environment is already in ${venv}`);
  const py = { cmd: [venvPython(venv)] };
  say("2. Installing the picture-model packages (this can take a while the first time: torch is large)");
  let r = spawnSync(py.cmd[0], ["-m", "pip", "install", "--disable-pip-version-check", "-r", path.join(PY_DIR, "requirements.txt")], { stdio: "inherit" });
  if (r.status !== 0){ say("The packages did not install. The messages above say why."); process.exitCode = 1; return; }
  say("3. Proving the packages work: a tiny model made here draws two pictures with the network refused");
  const self = lastJson(runPy(py, "selftest.py", [], { timeout: 1800000 }).stdout);
  if (!self || !self.ok){ say("The self-test did not pass: " + JSON.stringify(self)); process.exitCode = 1; return; }
  say(`   passed in ${self.seconds} s`);
  const c = Object.assign({}, cfg, { python: py.cmd[0], venv, setup_at: today() });
  if (!has("no-model")){
    const repo = String(opt("model") && opt("model") !== true ? opt("model") : "stabilityai/stable-diffusion-xl-base-1.0");
    const dest = path.join(String(opt("models-dir") && opt("models-dir") !== true ? path.resolve(String(opt("models-dir"))) : path.join(HOME, "models")), repo.replace(/[^A-Za-z0-9._-]+/g, "--"));
    say(`4. Downloading the picture model ${repo} to ${dest} (several gigabytes, once)`);
    r = spawnSync(py.cmd[0], [path.join(PY_DIR, "fetch_model.py"), "--repo", repo, "--dest", dest], { stdio: "inherit" });
    if (r.status !== 0){ say("The model did not download. The messages above say why."); writeConfig(c); process.exitCode = 1; return; }
    let meta = {}; try { meta = JSON.parse(fs.readFileSync(path.join(dest, "cognicopia-model.json"), "utf8")); } catch (e){}
    c.model = { repo, dir: dest, variant: meta.variant || null };
    say("   Read the model's license (in that folder) before using its pictures commercially.");
  } else say("4. No model downloaded (--no-model). Use ComfyUI, or run npm run art:setup again without --no-model.");
  writeConfig(c);
  say(`\nDone. Settings saved in ${CONFIG}. Next: npm run art:doctor`);
}

/* ---------- the library, its words and its pictures ---------- */
let LIB = null;
const lib = () => LIB || (LIB = loadCognicopiaColoring({ art: false }));
const ownerWords = () => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/coloring_owner_prompts.json"), "utf8")).designs || {}; } catch (e){ return {}; } };
/* the Packet Builder's own matcher, to find the library design closest to new words (for the stand-in engine) */
function closestDesign(words){
  const { C, P } = lib(), ctx = vm.createContext({ setTimeout, clearTimeout, Promise, Uint8Array, Uint8ClampedArray, Uint32Array, Math, Date });
  ctx.globalThis = ctx; ctx.CognicopiaColoring = C; ctx.CognicopiaColoringPrompts = P;
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js/coloringAgent.js"), "utf8"), ctx);
  const m = ctx.CognicopiaColoringAgent.find(words);
  return m.length ? m[0].id : null;
}
/* The library page exactly as drawn in code, at a tier, as a 1-bit 1800 x 2400 master at 300 dpi. */
function exactMaster(id, tier){
  const { C } = lib(), r = C.render(id, tier || 1);
  const bmp = paint(createBitmap(1800, 2400), shapesFromRender(C, r, { widthIn: 6, dpi: 300 }));
  return encodeBitPNG(bmp, 300);
}
const exactSvg = (id, tier) => { const { C } = lib(); return C.toSVG(C.render(id, tier), { standalone: true, widthIn: 6 }); };

/* ---------- picture engines: each returns [{ seed, png }] or throws an Error with a plain message ---------- */
const tmpDir = tag => fs.mkdtempSync(path.join(os.tmpdir(), "cognicopia-art-" + tag + "-"));
function viaPython(script, py, request){
  const dir = tmpDir("engine"), reqFile = path.join(dir, "request.json");
  request.out_dir = path.join(dir, "out");
  fs.writeFileSync(reqFile, JSON.stringify(request));
  const p = runPy(py, script, ["--request", reqFile]);
  let res = null; try { res = JSON.parse(fs.readFileSync(path.join(request.out_dir, "result.json"), "utf8")); } catch (e){}
  if (!res || !res.ok) throw new Error((res && res.error) || ("the picture engine stopped: " + String(p.stderr || "").trim().split("\n").slice(-1)[0]));
  const out = res.images.map(im => ({ seed: im.seed, png: fs.readFileSync(path.join(request.out_dir, im.file)), seconds: im.seconds }));
  out.notes = res.notes || []; out.label = res.checkpoint || res.pipeline || "";
  fs.rmSync(dir, { recursive: true, force: true });
  return out;
}
const SIZE = () => ({ width: +(opt("width") > 0 ? opt("width") : 864), height: +(opt("height") > 0 ? opt("height") : 1152) });
const ENGINES = {
  comfyui(job, prompt, negative, seeds){
    const sys = systemPython(); if (!sys) throw new Error("Python is not installed on this computer (python.org)");
    const c = cfg.comfyui || {};
    if (workflowFile() && !fs.existsSync(workflowFile())) throw new Error(`there is no workflow file at ${workflowFile()}`);
    return viaPython("comfyui.py", sys, Object.assign({ host: "127.0.0.1", port: comfyOpts().port, checkpoint: String(opt("checkpoint") && opt("checkpoint") !== true ? opt("checkpoint") : c.checkpoint || ""),
      workflow: workflowFile(), prompt, negative, seeds,
      steps: +(opt("steps") || c.steps || 30), cfg: +(opt("cfg") || c.cfg || 7), sampler: c.sampler || "euler", scheduler: c.scheduler || "normal", timeout_s: 1800 }, SIZE()));
  },
  diffusers(job, prompt, negative, seeds){
    const mp = modelPython(); if (!mp || !cfg.model) throw new Error("no picture model is set up on this computer (npm run art:setup)");
    return viaPython("generate.py", mp, Object.assign({ model_dir: cfg.model.dir, variant: cfg.model.variant || null, prompt, negative, seeds,
      steps: +(opt("steps") || 30), guidance: +(opt("cfg") || 7), device: String(opt("device") && opt("device") !== true ? opt("device") : "auto") }, SIZE()));
  },
  folder(job, prompt, negative, seeds){
    const dir = opt("from"); if (!dir || dir === true) throw new Error("the folder engine needs --from <folder>");
    const d = path.resolve(String(dir)), re = new RegExp("^" + job.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([-_. ].*)?\\.png$", "i");
    const files = fs.existsSync(d) ? fs.readdirSync(d).filter(f => re.test(f)).sort() : [];
    if (!files.length) throw new Error(`no pictures named ${job.id}*.png in ${d}`);
    return files.map((f, i) => ({ seed: i + 1, png: fs.readFileSync(path.join(d, f)), file: f }));
  },
  standin(job, prompt, negative, seeds, round){
    const id = job.lib ? job.id : closestDesign(job.subject);
    if (!id) throw new Error("the stand-in engine draws library designs only, and nothing in the library is close to these words");
    const bad = +(opt("standin-bad-rounds") || 0) >= round;
    return seeds.map(seed => {
      const g = standInGray(id, { seed, wobble: 1.5 + seed % 3, vary: .25, noise: 30 + seed % 40, pt: 1.4 + (seed % 4) * .4, size: 864 });
      if (seed % 2 === 0) for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++){ const e = Math.min(x, y, g.w - 1 - x, g.h - 1 - y); if (e >= 14 && e <= 18) g.gray[y * g.w + x] = 20; }
      if (bad) for (let y = Math.floor(g.h * .15); y < g.h * .85; y++) for (let x = Math.floor(g.w * .1); x < g.w * .9; x++) g.gray[y * g.w + x] = 30;   // a large dark area: fails
      const rgb = new Uint8Array(g.w * g.h * 3); for (let i = 0; i < g.gray.length; i++) rgb.fill(g.gray[i], i * 3, i * 3 + 3);
      return { seed, png: encodeRGBPNG({ w: g.w, h: g.h, rgb }) };
    });
  }
};
function chooseEngine(job, wanted){
  if (wanted === "procedural" || (wanted === "auto" && job.lib && LA.GEOMETRIC.includes(job.category))) return "procedural";
  if (wanted !== "auto") return wanted;
  const r = readiness();
  if (r.comfyuiReady) return "comfyui";
  if (r.diffusersReady) return "diffusers";
  return null;
}
const licenseNote = engine => {
  if (engine === "diffusers" && cfg.model) return `Made with ${cfg.model.repo} on this computer: read its license (in ${cfg.model.dir}) before approving for commercial use.`;
  if (engine === "comfyui") return "Made with ComfyUI on this computer: check the license of the model it used before approving for commercial use.";
  if (engine === "folder") return "Made in another program on this computer: record that program's and model's license before approving.";
  if (engine === "standin") return "A test picture drawn from the library design: not for the library.";
  return null;
};

/* ---------- the library ingest's checks, in a dry run ---------- */
function dryRunChecks(inbox){
  const root = tmpDir("root");
  try {
    const out = execFileSync(process.execPath, [path.join(ROOT, "scripts", "ingest_coloring_assets.mjs"), "--inbox", inbox, "--root", root, "--dry-run", "--json"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
    const recs = {};
    out.split("\n").filter(l => l.startsWith("{")).forEach(l => { const r = JSON.parse(l); recs[path.basename(r.source.file)] = r; });
    return recs;
  } catch (e){
    const recs = {};
    String(e.stdout || "").split("\n").filter(l => l.startsWith("{")).forEach(l => { const r = JSON.parse(l); recs[path.basename(r.source.file)] = r; });
    return recs;
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

/* ---------- make ---------- */
const INBOX = () => abs(String(opt("inbox") && opt("inbox") !== true ? opt("inbox") : "assets/coloring/_inbox"));
const REVIEW = () => abs(String(opt("review") && opt("review") !== true ? opt("review") : "assets/coloring/_review/agent"));
function jobs(){
  const { C, P } = lib(), words = ownerWords();
  const prompt = opt("prompt");
  if (prompt && prompt !== true){
    const category = String(opt("category") || "");
    if (!C.CAT[category]) throw new Error(`a new picture needs --category, one of: ${C.CATEGORIES.map(c => c.id).join(", ")}`);
    const id = String(opt("id") && opt("id") !== true ? opt("id") : P.slug(prompt)), title = String(opt("title") && opt("title") !== true ? opt("title") : String(prompt).replace(/^(a|an|the)\s+/i, "").replace(/\b\w/g, ch => ch.toUpperCase()));
    if (C.design(id)) return [{ id, title: C.design(id).title, category: C.design(id).cat, subject: String(prompt), lib: true }];
    return [{ id, title, category, subject: String(prompt), lib: false }];
  }
  let list = [];
  if (has("all")) list = C.designs();
  else if (opt("category") && opt("category") !== true) list = C.designs().filter(d => d.cat === opt("category"));
  else if (opt("only") && opt("only") !== true) list = String(opt("only")).split(",").map(s => s.trim()).filter(Boolean).map(id => { const d = C.design(id); if (!d) throw new Error(`${id} is not a library design (see npm run art:library)`); return d; });
  else throw new Error("say which pictures: --only <design-id>, --category <id>, --all, or --prompt \"words\" --id <new-id> --category <id>");
  return list.map(d => ({ id: d.id, title: d.title, category: d.cat, subject: (words[d.id] && words[d.id].subject) || P.subjectFor(d), lib: true }));
}
function svgTiers(rec, dir, title){
  const { C } = lib(), out = [];
  for (const t of [1, 2, 3]){
    try { const svg = C.toSVG(renderArt(rec.items, t, { title, fit: rec.fit, pad: rec.pad }), { standalone: true, widthIn: 6, label: title + ", a picture to color" }); fs.writeFileSync(path.join(dir, `tier-${t}.svg`), svg); out.push(`tier-${t}.svg`); }
    catch (e){ /* a tier that cannot be drawn is simply not shown */ }
  }
  return out;
}

async function makeOne(job, wanted){
  const { P } = lib(), revRoot = REVIEW(), rev = path.join(revRoot, job.id);
  fs.rmSync(rev, { recursive: true, force: true }); fs.mkdirSync(rev, { recursive: true });
  const engine = chooseEngine(job, wanted);
  const summary = { id: job.id, title: job.title, category: job.category, engine: engine || "none", subject: job.subject, prompt: "", status: "", candidates: [], chosen: null, made: today() };
  const finish = () => { fs.writeFileSync(path.join(rev, "summary.json"), JSON.stringify(summary, null, 1)); return summary; };
  if (!engine){ summary.status = "no engine"; summary.message = "No picture engine is ready on this computer: start ComfyUI with a model in it, or run npm run art:setup. npm run art:doctor shows what is missing."; return finish(); }
  if (engine === "procedural"){
    if (!job.lib){ summary.status = "not drawn"; summary.message = "The procedural renderer draws the library's own designs; a new subject needs ComfyUI or a local model."; return finish(); }
    fs.writeFileSync(path.join(rev, "exact-tier-1.png"), exactMaster(job.id, 1));
    summary.svgs = [1, 2, 3].map(t => { fs.writeFileSync(path.join(rev, `tier-${t}.svg`), exactSvg(job.id, t)); return `${job.id}/tier-${t}.svg`; });
    summary.status = "kept as drawn";
    summary.message = "Exact geometry drawn in code, already vector at every tier: kept as it is (no master made). The exact 1800 x 2400 page and its three tiers are here to look at.";
    summary.candidates = [{ name: "exact", pass: true, score: "", why: "drawn in code at the tier weights", clean: `${job.id}/exact-tier-1.png` }];
    summary.chosen = "exact";
    return finish();
  }
  const hits = P.dignityCheck([job.subject, job.title].join(" "));
  if (hits.length){ summary.status = "words set aside"; summary.message = `The words use ${hits.map(h => `"${h.term}"`).join(", ")}, which the dignity filter sets aside. Describe the picture in plain adult words.`; return finish(); }
  if (engine === "standin" && !(opt("inbox") && opt("inbox") !== true)) summary.reviewOnly = true;             // test pictures never go to the real inbox
  const n = Math.max(1, Math.min(12, +(opt("candidates") || 4))), rounds = Math.max(1, Math.min(5, +(opt("rounds") || 2)));
  const base = has("fresh") ? Date.now() % 1000000000 : LA.hashSeed(job.id);
  const keepEdge = !!job.lib && LA.designHasEdge(lib().C, job.id);              // a quilt's outer seam is the design, not a drawn border
  let hints = [], label = "";
  for (let round = 1; round <= rounds; round++){
    const prompt = LA.wrapPrompt(job.subject, hints);
    summary.prompt = prompt;
    const seeds = Array.from({ length: n }, (_, i) => (base + round * 1009 + i * 7919) % 2147483647);
    let raws;
    try { raws = await ENGINES[engine](job, prompt, LA.NEGATIVE, seeds, round); }
    catch (e){ summary.status = "engine stopped"; summary.message = e.message; break; }
    label = raws.label || label;
    const inbox = tmpDir("inbox"), round_ = [];
    raws.forEach((raw, i) => {
      const name = `r${round}c${i + 1}`, c = { name, round, seed: raw.seed, prompt, file: raw.file || null };
      try { fs.writeFileSync(path.join(rev, `raw-${name}.png`), LA.thumbnail(raw.png)); c.raw = `${job.id}/raw-${name}.png`; } catch (e){ /* an unreadable picture still gets its sentence below */ }
      const cl = LA.cleanCandidate(raw.png, { allowBorder: LA.GEOMETRIC.includes(job.category), keepEdge });
      if (cl.error){ c.error = cl.error; c.code = cl.code; if (cl.png){ fs.writeFileSync(path.join(rev, `master-${name}.png`), cl.png); c.clean = `${job.id}/master-${name}.png`; c.fixes = cl.fixes; } }
      else {
        fs.writeFileSync(path.join(rev, `master-${name}.png`), cl.png); c.clean = `${job.id}/master-${name}.png`; c.fixes = cl.fixes; c.notes = cl.notes; c.lines = cl.lines; c.ink = +cl.ink.toFixed(4); c._png = cl.png;
        fs.writeFileSync(path.join(inbox, `${job.id}--${name}.png`), cl.png);
        fs.writeFileSync(path.join(inbox, `${job.id}--${name}.json`), JSON.stringify({ title: job.title, category: job.category, job_id: job.id }));
      }
      round_.push(c);
    });
    const recs = round_.some(c => c._png) ? dryRunChecks(inbox) : {};
    fs.rmSync(inbox, { recursive: true, force: true });
    for (const c of round_){
      const rec = recs[`${job.id}--${c.name}.png`];
      if (rec){ Object.assign(c, LA.scoreRecord(rec)); c._rec = rec; c.checks = rec.checks.map(k => ({ id: k.id, result: k.result, detail: k.detail })); }
      else Object.assign(c, { pass: false, fails: [c.code || "traced-faithfully"], score: -1000, why: c.error || "the checks could not read this picture" });
    }
    summary.candidates.push(...round_);
    if (round_.some(c => c.pass)) break;
    const best = round_[LA.pickBest(round_)] || {};
    hints = LA.hintsFor([...(best.fails || []), ...round_.map(c => c.code).filter(Boolean), ...round_.filter(c => (c.fixes || []).some(f => /border/.test(f))).map(() => "frame")]);
  }
  summary.engine = engine + (label ? ` (${label})` : "");
  const bi = LA.pickBest(summary.candidates), best = summary.candidates[bi];
  if (best && best._rec) summary.svgs = svgTiers(best._rec, rev, job.title).map(f => `${job.id}/${f}`);
  if (best && (best.pass || has("keep-best")) && best._png){
    summary.chosen = best.name;
    if (summary.reviewOnly || has("dry-run")) summary.status = best.pass ? "passes (review only)" : "best kept (review only)";
    else {
      const inbox = INBOX(); fs.mkdirSync(inbox, { recursive: true });
      fs.writeFileSync(path.join(inbox, job.id + ".png"), best._png);
      const side = { job_id: job.id, title: job.title, category: job.category, generator: "local:" + summary.engine, prompt: best.prompt, license: licenseNote(engine), author: "Cognicopia local art agent, on this computer",
        agent: { engine, seed: best.seed, round: best.round, candidates: summary.candidates.length, score: best.score, passed: best.pass, fixes: best.fixes, negative: LA.NEGATIVE, made: today() } };
      if (!job.lib) side.subject = job.subject;
      fs.writeFileSync(path.join(inbox, job.id + ".json"), JSON.stringify(side, null, 1));
      summary.status = best.pass ? "master in the inbox" : "best kept in the inbox (did not pass)";
      summary.inbox = rel(path.join(inbox, job.id + ".png"));
    }
  } else if (!summary.status) { summary.status = "no candidate passed"; summary.message = `None of ${summary.candidates.length} candidates passed the checks. Try again with --fresh, more --candidates, or new words.`; }
  summary.candidates.forEach(c => { delete c._png; delete c._rec; });
  return finish();
}
function writeIndex(){
  const dir = REVIEW();
  if (!fs.existsSync(dir)) return null;
  const all = fs.readdirSync(dir).map(d => path.join(dir, d, "summary.json")).filter(f => fs.existsSync(f)).map(f => JSON.parse(fs.readFileSync(f, "utf8"))).sort((a, b) => a.id < b.id ? -1 : 1);
  fs.writeFileSync(path.join(dir, "index.html"), LA.reviewPage(all, today()));
  return path.join(dir, "index.html");
}
async function make(){
  let list;
  try { list = jobs(); } catch (e){ say(e.message); process.exitCode = 1; return; }
  const wanted = String(opt("engine") && opt("engine") !== true ? opt("engine") : cfg.engine || "auto");
  if (!["auto", ...Object.keys(ENGINES), "procedural"].includes(wanted)){ say(`Unknown engine ${wanted}: auto, comfyui, diffusers, procedural, folder or standin.`); process.exitCode = 1; return; }
  const counts = {}; const t0 = Date.now();
  for (const job of list){
    const s = await makeOne(job, wanted);
    counts[s.status] = (counts[s.status] || 0) + 1;
    const best = s.candidates.find(c => c.name === s.chosen);
    say(`${s.status.padEnd(26)} ${job.id.padEnd(30)} ${s.engine}${best && best.why ? " · " + best.why : ""}${s.message ? "\n" + " ".repeat(27) + s.message : ""}`);
  }
  const index = writeIndex();
  say(`\n${list.length} picture(s) in ${Math.round((Date.now() - t0) / 1000)} s: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ")}.`);
  if (index) say(`Every candidate and why one was chosen: ${rel(index)} (open it in a browser).`);
  if (counts["master in the inbox"] || counts["best kept in the inbox (did not pass)"]) say("Next: npm run coloring:ingest, then npm run coloring:review, then approve or reject each one (docs/line-art-pipeline.md).");
  if (list.length && Object.keys(counts).every(k => ["no engine", "engine stopped", "no candidate passed", "words set aside", "not drawn"].includes(k))) process.exitCode = 1;
}

/* ---------- library: how the current pictures stand, and what to upgrade ---------- */
function library(){
  const { C } = lib(), cat = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/cognicopia_coloring_catalog.json"), "utf8"));
  const std = Object.fromEntries(cat.standards.tiers.map(t => [t.tier, t]));
  const inbox = INBOX(), rows = [];
  for (const d of C.designs()){
    const assets = cat.assets.filter(a => a.design_id === d.id).sort((a, b) => a.tier - b.tier), problems = [];
    for (const a of assets){
      const m = a.metrics || {}, s = std[a.tier];
      if (a.stroke_pt < 3) problems.push(`Tier ${a.tier} lines ${a.stroke_pt} pt`);
      if (m.tiny_regions > s.max_tiny_regions) problems.push(`Tier ${a.tier}: ${m.tiny_regions} areas under ${s.min_region_sq_in} sq in`);
      if (m.subject_fill < .45) problems.push(`Tier ${a.tier}: subject fills ${Math.round(m.subject_fill * 100)}%`);
      if (m.ink_coverage > .35) problems.push(`Tier ${a.tier}: ${Math.round(m.ink_coverage * 100)}% ink`);
      if (a.aspect_ratio !== "3:4") problems.push(`Tier ${a.tier} is not 3:4`);
    }
    const art = readArt(ROOT, d.id), geometric = LA.GEOMETRIC.includes(d.cat);
    rows.push({ id: d.id, title: d.title, category: d.cat, source: d.source === "traced" ? "traced art (approved)" : "drawn in code",
      route: geometric ? "keep: exact geometric pattern, already vector" : "upgrade: make a master with a local picture engine",
      meets_standards: !problems.length, problems, tiers: assets.map(a => ({ tier: a.tier, stroke_pt: a.stroke_pt, regions: a.metrics.regions, smallest_sq_in: a.metrics.smallest_region_sq_in, ink: a.metrics.ink_coverage, fill: a.metrics.subject_fill, svg: a.svg_path })),
      agent: art ? `ingested: ${art.review.status}` : fs.existsSync(path.join(inbox, d.id + ".png")) ? "master waiting in the inbox" : "not started" });
  }
  const dir = abs(String(opt("out") && opt("out") !== true ? opt("out") : "assets/coloring/_review/library")); fs.mkdirSync(dir, { recursive: true });
  const up_ = path.relative(dir, ROOT).split(path.sep).join("/");
  fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify({ made: today(), designs: rows.length, rows }, null, 1));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Coloring library review</title>
<style>body{margin:0;padding:24px;font:15px/1.5 system-ui,sans-serif;color:#1a202c;background:#fbf7f1}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
article{background:#fff;border:1px solid #ddd1ba;border-radius:12px;padding:10px}img{display:block;width:100%;aspect-ratio:3/4;background:#fff;border:1px solid #eee}h2{font-size:15px;margin:8px 0 2px}p{margin:2px 0;font-size:13px;color:#3d4a45}.bad{color:#732f19}</style></head><body>
<h1>Coloring library review</h1><p>${rows.length} designs, three tiers each, measured against the print standards (lines at least 3 pt, areas large enough for the tier, the subject filling the page, no large dark areas, 3:4). ${rows.filter(r => r.meets_standards).length} meet them all. ${rows.filter(r => /^keep/.test(r.route)).length} are exact geometric patterns, kept as drawn; ${rows.filter(r => /^upgrade/.test(r.route)).length} can be upgraded with a local picture engine.</p>
<div class="g">${rows.map(r => `<article><img src="${esc(up_ ? up_ + "/" : "")}${esc(r.tiers[0].svg)}" alt="${esc(r.title)}, Tier 1"><h2>${esc(r.title)}</h2><p>${esc(r.id)} &middot; ${esc(r.source)}</p><p>${esc(r.route)}</p><p>${r.tiers.map(t => `T${t.tier}: ${t.regions} areas, ${t.stroke_pt} pt`).join(" &middot; ")}</p><p class="${r.meets_standards ? "" : "bad"}">${r.meets_standards ? "Meets the print standards" : esc(r.problems.join("; "))}</p><p>Agent: ${esc(r.agent)}</p></article>`).join("")}</div></body></html>`;
  fs.writeFileSync(path.join(dir, "index.html"), html);
  const up = rows.filter(r => /^upgrade/.test(r.route));
  say(`Coloring library: ${rows.length} designs (${rows.length * 3} pages).`);
  say(`  Meet the measured print standards: ${rows.filter(r => r.meets_standards).length} of ${rows.length}${rows.some(r => !r.meets_standards) ? " (see the report for the rest)" : ""}.`);
  say(`  Exact geometric patterns, kept as drawn: ${rows.length - up.length}.`);
  say(`  To upgrade with a local picture engine: ${up.length} (${up.filter(r => r.agent === "not started").length} not started, ${up.filter(r => /inbox/.test(r.agent)).length} waiting in the inbox, ${up.filter(r => /^ingested/.test(r.agent)).length} ingested).`);
  say(`Report: ${rel(path.join(dir, "index.html"))} and report.json. To upgrade them all: npm run art:make -- --all`);
  if (has("json")) say(JSON.stringify({ designs: rows.length, meet: rows.filter(r => r.meets_standards).length, keep: rows.length - up.length, upgrade: up.length }));
}

/* ---------- run ---------- */
if (cmd === "doctor") doctor();
else if (cmd === "setup") setup();
else if (cmd === "make") await make();
else if (cmd === "library") library();
else { const src = fs.readFileSync(new URL(import.meta.url), "utf8").split("\n"); say(src.slice(2, src.findIndex(l => l.includes("==== */"))).map(l => l.replace(/^ {3}/, "")).join("\n")); }
