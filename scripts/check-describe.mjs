#!/usr/bin/env node
/* =====================================================================
   Describe & Create (src/engine/DescribeCreate.js): a coloring page from a few words.
     the choice    the words choose the finished drawing they name ("grandfather clock", "Chevy truck", "steam train"), through what
                   it is a kind of (a pickup is a truck), never through a tag it merely carries (the butterfly's "flower", the
                   sailboat's "lake"); a subject the drawings do not have gets the closest one, said to be the closest
                   (a tiger lily: a flower)
     honesty       every answer names the words it used and the words it could not draw, says a page is the subject on its own,
                   and says that no maker's name or badge is drawn when a make is named
     care          words that are not for a coloring page in care are refused gently; the resident's topics to avoid are never
                   crossed, and when they rule out the only fit the answer says so; nothing on the page quizzes
     the page      made by the hybrid engine at every stage, with no problem from its own validate(); the same words make the same
                   page, and "another look" changes only the page, not the subject
     offline       the module reads no network and keeps nothing (no fetch, XMLHttpRequest or storage in its source)
   Node built-ins only. Run: node scripts/check-describe.mjs
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const ctx = vm.createContext({ console }); ctx.globalThis = ctx; ctx.window = ctx;
for (const f of ["assets/coloring/subjects.bundle.js", "src/services/ColoringManifest.js", "src/engine/ColoringEngine.js", "src/engine/DescribeCreate.js"]) vm.runInContext(read(f), ctx, { filename: f });
const D = ctx.CognicopiaDescribe, M = ctx.CognicopiaColoringManifest;
M.loadSync();
let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const pick = (t, o) => D.choose(t, o || {});

/* ---------- the choice ---------- */
const truck = pick("a 1957 Chevy truck parked on a prairie dirt road");
ok(truck.ok && truck.asset.id === "1950s_pickup_truck" && !truck.exact, "“a 1957 Chevy truck on a prairie dirt road” chooses the 1950s pickup truck, called the closest: the drawing is a pickup, not a Chevy");
ok(pick("a pickup truck").exact && pick("a steam train").exact && !pick("a jukebox at the diner").drawnFrom.includes("diner"), "a pickup truck and a steam train are drawn as asked; the diner around a jukebox is not claimed");
ok(["prairie", "dirt", "road"].every(w => truck.notDrawn.indexOf(w) >= 0), "and says the prairie, the dirt and the road are not drawn");
ok(/No maker’s name or badge is drawn/.test(D.explain(truck)), "and that no maker's badge is drawn");
const clock = pick("a classic grandfather clock in a cozy parlor");
ok(clock.ok && clock.asset.id === "grandfather_clock" && clock.exact && clock.notDrawn.indexOf("parlor") >= 0, "“a grandfather clock in a cozy parlor” chooses the grandfather clock, not the cozy cat, and leaves out the parlor");
const lily = pick("a detailed close-up of a tiger lily in bloom");
const flowers = M.assets().filter(a => (a.tags || []).indexOf("flower") >= 0 && a.category === "nature").map(a => a.id);
ok(lily.ok && !lily.exact && flowers.indexOf(lily.asset.id) >= 0, `a tiger lily, which no drawing shows, gets the closest flower (${lily.ok ? lily.asset.id : lily.reason}), never the butterfly that only carries a flower tag`);
ok(/There is no drawing of exactly that yet/.test(D.explain(lily)), "and says it is the closest, not the thing asked for");
const sail = pick("a sailboat on the lake");
ok(sail.ok && sail.asset.id === "sailboat" && sail.drawnFrom.indexOf("lake") < 0 && sail.notDrawn.indexOf("lake") >= 0, "the lake, a tag of the sailboat, is not claimed as drawn");
[["a steam train crossing a bridge", "steam_locomotive"], ["our old dog by the fire", "sitting_dog"], ["a cardinal in the snow", "cardinal"], ["a horse in a field", "horse"],
 ["mother's teapot", "teapot"], ["a jukebox at the diner", "jukebox"], ["an old typewriter", "typewriter"], ["a hummingbird", "hummingbird"], ["a farm tractor", "farm_tractor"]]
  .forEach(([t, id]) => { const c = pick(t); ok(c.ok && c.asset.id === id, `“${t}” chooses ${id} (${c.ok ? c.asset.id : c.reason})`); });
ok(pick("a tracktor in the feild").ok && pick("a tracktor in the feild").asset.id === "farm_tractor", "a misspelling (“tracktor”) still finds the tractor");

/* ---------- care ---------- */
["a gun", "a skull", "a soldier in the war", "a hospital bed"].forEach(t => { const c = pick(t); ok(!c.ok && c.reason === "topic", `“${t}” is refused gently`); });
ok(/calm and familiar/.test(D.explain(pick("a gun"))), "with a suggestion of what to try instead");
ok(!pick("").ok && pick("").reason === "empty" && !pick("asdf qwerty").ok && pick("asdf qwerty").reason === "no-subject", "empty words and words that name nothing are answered plainly");
const avoided = pick("a pickup truck", { avoid: ["driving"] });
ok(!avoided.ok && avoided.reason === "avoided" && /avoid/.test(D.explain(avoided)), "when the topics to avoid rule out the only fit (driving), the answer says so and makes no truck");
ok(!pick("a pickup truck", { filter: a => a.category !== "vehicles" }).ok, "a host page's own rule (the packet tool's avoid filter) is kept");
const lateOnly = pick("a 1957 family sedan", { stage: "late" });
ok(!lateOnly.ok || (lateOnly.asset.dementiaStageCompatibility || []).indexOf("late") >= 0, "a drawing is only chosen for a stage it suits");

/* ---------- the page ---------- */
let pages = 0, bad = [];
for (const t of ["a 1957 Chevy truck", "a grandfather clock", "a tiger lily", "a cardinal", "a sailboat", "a teapot"]) for (const stage of ["early", "middle", "late"]) {
  const out = D.create(t, { stage, name: "Ruth" });
  if (!out.page) { if (!(out.choice && out.choice.reason)) bad.push(t + " at " + stage + ": no page and no reason"); continue; }
  pages++; if (out.problems.length) bad.push(t + " at " + stage + ": " + out.problems.join("; "));
  const words = out.page.texts.map(x => x.text).join(" ");
  if (/\bdo you remember\b|\bremember when\b|\bcan you name\b|\bwhat year\b/i.test(words)) bad.push(t + " at " + stage + ": the page quizzes");
}
ok(pages >= 15 && !bad.length, `every described page passes the hybrid engine's own checks at every stage (${pages} pages)` + (bad.length ? ": " + bad.slice(0, 3).join(" | ") : ""));
const a1 = D.create("a cardinal in winter", { stage: "middle" }), a2 = D.create("a cardinal in winter", { stage: "middle" }), a3 = D.create("a cardinal in winter", { stage: "middle", variant: 1 });
ok(a1.page.meta.code === a2.page.meta.code, "the same words make the same page (" + a1.page.meta.code + ")");
ok(a3.page.meta.code !== a1.page.meta.code && a3.page.meta.id === a1.page.meta.id, "another look changes the page but keeps the subject");
ok(a1.page.items.every(it => !it.fill || /^(#fff|#ffffff|#000|#000000|none|white|black)$/i.test(it.fill)), "the page is black and white only: no gray fill");

/* ---------- offline ---------- */
const src = read("src/engine/DescribeCreate.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
ok(!/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|navigator\.sendBeacon|WebSocket/.test(src), "the module asks the network for nothing and keeps nothing");
ok(D.MAX === 160 && D.interpret("x".repeat(500)).text.length === 160, "a description is cut to 160 characters");

console.log(problems.length ? `describe check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `describe check passed: ${passed} checks (the words choose the drawing they name, the closest is called the closest, unused words are named, refusals and topics to avoid, every page passes the engine's checks at every stage, offline)`);
process.exit(problems.length ? 1 : 0);
