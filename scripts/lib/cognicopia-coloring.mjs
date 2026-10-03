/* =====================================================================
   Cognicopia Coloring for Node: loads the browser line-art engine, its designs, the
   packs and the prompt engine (assets/cognicopia-coloring/*) into a sandbox, the
   same files the Packet Builder runs, so every script checks and writes
   exactly what prints. Node built-ins only.
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SRC_DIR = path.join(ROOT, "assets", "cognicopia-coloring");

/* The engine source files, in load order. The browser bundle is these
   files joined in this order (scripts/generate_coloring_manifest.js). */
export function sourceFiles(){
  const designs = fs.readdirSync(path.join(SRC_DIR, "designs")).filter(f => f.endsWith(".js")).sort().map(f => "designs/" + f);
  return ["lineart.js", ...designs, "packs.js", "prompts.js"];
}

let cached = null;
export function loadCognicopiaColoring(){
  if (cached) return cached;
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const f of sourceFiles()) vm.runInContext(fs.readFileSync(path.join(SRC_DIR, f), "utf8"), sandbox, { filename: "assets/cognicopia-coloring/" + f });
  cached = { C: sandbox.CognicopiaColoring, P: sandbox.CognicopiaColoringPrompts };
  return cached;
}

/* Visual complexity bands for the catalog and the filters, by the number
   of areas there are to color on the printed page. */
export const BANDS = [
  { id:"simple", label:"Simple: up to 12 areas to color", max_regions:12 },
  { id:"moderate", label:"Moderate: 13 to 40 areas", max_regions:40 },
  { id:"detailed", label:"Detailed: more than 40 areas", max_regions:null }
];
export const complexityOf = regions => (BANDS.find(b => b.max_regions == null || regions <= b.max_regions) || BANDS[BANDS.length - 1]).id;

/* What keeps an SVG from being pure black line art on white: any color or
   gray, gradient, pattern, filter, raster image, mask, transparency or
   text (a <title> for screen readers is fine). */
export function svgProblems(svg){
  const out = [];
  const body = svg.replace(/<title>[\s\S]*?<\/title>/gi, "");
  const colors = [...body.matchAll(/(?:fill|stroke|stop-color|color)\s*[:=]\s*"?\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]+)/g)].map(m => m[1].toLowerCase());
  const bad = colors.filter(c => !["#000", "#000000", "#fff", "#ffffff", "black", "white", "none", "currentcolor"].includes(c));
  if (bad.length) out.push("colors other than black and white: " + [...new Set(bad)].join(", "));
  if (/<(lineargradient|radialgradient|pattern|filter|image|mask|text|foreignobject)\b/i.test(body)) out.push("a gradient, pattern, filter, image, mask or text element");
  if (/opacity\s*[:=]/i.test(body)) out.push("transparency");
  return out;
}
