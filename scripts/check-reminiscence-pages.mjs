#!/usr/bin/env node
/* =====================================================================
   The three reminiscence pages' content (src/engine/ReminiscencePages.js), with the reminiscence engine:
     sensory cards   every conversation topic has an everyday scent with its safety line; each card carries an invitation, things
                     to look at, the engine's thing to hold and its safety note, a scent and a song from the years remembered best
     your years      born first, then the songs and things that were new from about age 10 to 30 in year order, then age 30; the
                     late stage is shorter; the region comes from the hometown
     memory map      six parts of a life (four at the late stage) holding what the form knows, short enough for a box
     care            nothing quizzes (the engine's own tone check), and the avoid list leaves a topic out everywhere
   Node built-ins only. Run: node scripts/check-reminiscence-pages.mjs
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = vm.createContext({ console }); ctx.globalThis = ctx; ctx.window = ctx;
for (const f of ["assets/services/reminiscenceEngine.js", "src/engine/ReminiscencePages.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
const E = ctx.CogniReminiscence, P = ctx.CognicopiaReminiscencePages;
let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const today = new Date(2026, 10, 5);
/* made-up people only */
const ruth = { first: "Ruth", born: "1938", stage: "middle", job: "teacher", town: "Dubuque", state: "Iowa", hobbies: ["gardening", "baking"], favs: ["roses", "coffee"],
  kids: ["Susan", "David"], spouse: "Walter", pets: ["Rusty"], avoid: [], month: "November 2026" };
const avoidFn = words => t => !words.some(w => new RegExp("\\b" + w + "s?\\b", "i").test(String(t)));

/* ---------- scents ---------- */
const missing = E.TOPICS.filter(t => !P.SCENTS[t.id]).map(t => t.id);
ok(!missing.length, "every conversation topic has a scent" + (missing.length ? ": missing " + missing.join(", ") : ""));
ok(Object.values(P.SCENTS).every(s => !/\b(bleach|ammonia|gasoline|petrol|smoke|cigar|alcohol|whiskey|perfume|spray|chemical|oil)\b/i.test(s)), "no scent is a chemical, smoke, alcohol or a spray");
ok(/never to eat/.test(P.SCENT_SAFE) && /allergies/.test(P.SCENT_SAFE), "the scent safety line says smell only, and to check allergies");

/* ---------- sensory cards ---------- */
const s = P.sensory(ruth, { count: 4, today });
ok(s.cards.length === 4 && s.cards.every(c => c.invite && c.look.length && c.hold.prompt && c.hold.safety && c.smell.what && c.smell.safety), "four cards, each with an invitation, things to look at, a thing to hold with its safety note, and a scent with its own");
ok(s.cards.some(c => c.topic === "the-classroom") && s.cards.some(c => c.topic === "in-the-garden"), "the cards come from their own life: a teacher's classroom and a gardener's garden");
ok(s.cards.every(c => !c.song || (c.song.year >= 1938 + 5 && c.song.year <= 1938 + 40)), "each card's song comes from their years");
const noRadio = P.sensory(ruth, { count: 4, today, allowed: avoidFn(["radio"]) });
ok(noRadio.cards.length >= 3 && noRadio.cards.every(c => !/radio/i.test(JSON.stringify(c))), "with radio on the avoid list, no card mentions a radio");

/* ---------- your years ---------- */
const t = P.timeline(ruth, { today });
ok(t.rows[0].head === "Born" && t.rows[0].year === 1938 && t.rows[t.rows.length - 1].year === 1968, "the timeline runs from the year they were born to the year they turned thirty");
const mid = t.rows.slice(1, -1).map(r => r.year);
ok(mid.every((y, i) => i === 0 || y >= mid[i - 1]) && t.rows.slice(2, -1).every(r => r.year >= 1943 && r.year <= 1968), "the songs and things are in year order, inside their years");
ok(t.rows.filter(r => r.kind === "song").length >= 3 && t.place === "Midwest", `there are songs from those years, and the region comes from the hometown (${t.place})`);
const late = P.timeline(Object.assign({}, ruth, { stage: "late" }), { today });
ok(late.rows.length <= 4 && late.rows.length < t.rows.length, "the late stage's timeline is shorter");
ok(t.bump[0] === 1948 && t.bump[1] === 1968, "the years remembered best are about 10 to 30 (1948 to 1968)");

/* ---------- memory map ---------- */
const m = P.memoryMap(ruth);
ok(m.spokes.length === 6 && m.spokes.map(x => x.label).join() === "Home,Work,Family,Friends and pets,Things I enjoy,Favorites", "six parts of a life around their name");
ok(m.spokes[0].known[0] === "Dubuque, Iowa" && m.spokes[2].known.indexOf("Walter") >= 0 && m.spokes[4].known.indexOf("gardening") >= 0, "the map already holds what the form knows");
ok(P.memoryMap(Object.assign({}, ruth, { stage: "late" })).spokes.length === 4, "the late stage has four parts, bigger");
ok(m.spokes.every(x => x.known.every(k => k.length <= 40) && x.known.length <= 2), "what the map holds is short enough for its box");
ok(P.memoryMap(ruth, { allowed: avoidFn(["walter"]) }).spokes[2].known.indexOf("Walter") < 0, "a name on the avoid list stays off the map");
const empty = P.memoryMap({ first: "Ruth", stage: "middle" });
ok(empty.spokes.every(x => Array.isArray(x.known)) && empty.name === "Ruth", "a form with only a name still makes a map, with room to fill in");

/* ---------- care ---------- */
const all = JSON.stringify([s, t, m, late]);
ok(!E.toneProblems(all).length && !/\bdo you remember\b|\bremember when\b|\bwhat year\b/i.test(all), "nothing on the three pages quizzes or talks down (the engine's own tone check)");
ok(P.profileFrom(ruth).tier1_core.cognitiveTier === 2 && P.profileFrom(Object.assign({}, ruth, { stage: "late" })).tier1_core.cognitiveTier === 3 && P.profileFrom(ruth).tier2_enrichment.hometown.place === "Dubuque, Iowa",
  "the packet form becomes the profile the engine reads (stage to tier, hometown)");
const src = fs.readFileSync(path.join(ROOT, "src/engine/ReminiscencePages.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
ok(!/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB/.test(src), "the module asks the network for nothing and keeps nothing");

console.log(problems.length ? `reminiscence pages check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `reminiscence pages check passed: ${passed} checks (sensory cards with safe scents, the years from birth to thirty, the memory map from the form, the avoid list and the tone check)`);
process.exit(problems.length ? 1 : 0);
