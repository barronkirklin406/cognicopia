#!/usr/bin/env node
/* =====================================================================
   The condition setting on a resident's profile ("Diagnosis / clinical adaptation", tier1_core.adaptation) is read by the Activity Page Studio's
   engine, by Daily engagement (which builds its card through the same engine) and by the reminiscence engine, not only by the profile and the
   packet tool (js/residentContext.js ADAPTATION_RULES). Made-up resident only, in node:

     none         no setting: pages are made as before, with no errorless cue and no change of stage or spacing
     late_stage   a profile at stage 1 gets the late-stage pages (stage 3)
     lewy / vasc  open spacing by default (fewer things on a page), unless staff chose otherwise (an explicit roomy:false stands)
     ftd          no word play page and no "sayings of the day" on any page, so nothing needs abstract thinking
     korsakoff    songs from the later part of the years they were 7 to 28 (born + 21 to + 28) and the errorless cue for staff on every page; the
                  reminiscence engine's remembered years are the same later part
     errorless    the errorless cue for staff on every page
     never        no condition's name is printed on a page the resident reads
   Run: node scripts/check-adaptation-tools.mjs   (node built-ins only)
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const ctx = vm.createContext({ console }); ctx.globalThis = ctx; ctx.window = ctx;
const FILES = ["assets/coloring/subjects.bundle.js", "src/services/ColoringManifest.js", "src/engine/ColoringEngine.js", "src/engine/DescribeCreate.js", "assets/services/eraWindow.js", "assets/services/reminiscenceEngine.js", "js/residentContext.js",
  "js/generators/activity-engine.js", "js/generators/coloring-pipeline.js", "js/generators/activity-modules.js", "js/generators/activity-pages.js", "js/generators/activity-life-data.js", "js/generators/activity-life.js", "js/utils/facility-validator.js"];
for (const f of FILES) vm.runInContext(read(f), ctx, { filename: f });
const E = ctx.CognicopiaActivityEngine, R = ctx.CogniResident, RE = ctx.CogniReminiscence, M = ctx.CognicopiaColoringManifest;
M.loadSync();
let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

const BORN = 1938;
const profileOf = code => ({ schema: R.SCHEMA, version: 2, id: "res-ad",
  tier1_core: { preferredName: "Pat", cognitiveTier: 1, adaptation: code ? { code, label: R.person({ tier1_core: { adaptation: { code } } }).adaptation.label } : null, occupation: { code: "teacher", label: "Teacher" }, topHobbies: [{ code: "gardening", label: "Gardening" }],
    topicsToAvoid: { topics: [], eras: [], people: "", places: "", other: "" } },
  tier2_enrichment: { birthYear: BORN, hometown: { place: "Velva, North Dakota" }, music: { genres: [], artists: [], favoriteSong: "" } },
  tier3_deep: { notes: "", milestones: [], signatureDish: {}, comforts: [], people: [] } });
const prof = (code, extra) => { const person = R.person(profileOf(code)); return Object.assign({ stage: 1, dexterity: "steady", name: "Pat", born: person.born, vocation: "teacher", person }, extra || {}); };
const strings = v => typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];
const CUE = /Errorless learning: say the answer together with the question/;
const readerText = sh => strings([sh.title, sh.subtitle, (sh.blocks || []).filter(b => b.kind !== "staff")]).join(" | ");
const items = sh => (sh.blocks || []).reduce((n, b) => n + (Array.isArray(b.items) ? b.items.length : Array.isArray(b.options) ? b.options.length : 0), 0);

ok(R.ADAPTATION_RULES && ["lewy_body", "vascular", "ftd", "korsakoff", "late_stage", "errorless"].every(c => R.ADAPTATION_RULES[c] && R.ADAPTATION_RULES[c].note), "every one of the six settings has its rule and a plain note");

/* none */
const none = E.generate(prof(""), { module: "hometown", count: 2, seed: 4 });
ok(none.stage === 1 && none.profile.roomy === false && none.sheets.every(sh => !CUE.test(sh.staffNote || "")), "no setting: stage 1, normal spacing, no errorless cue");

/* late stage */
const late = E.generate(prof("late_stage"), { module: "hometown", count: 2, seed: 4 });
ok(late.stage === 3 && late.sheets.every(sh => sh.stage === 3), "late-stage setting: a stage 1 profile gets the late-stage pages");

/* Lewy body and vascular */
for (const code of ["lewy_body", "vascular"]) {
  const a = E.generate(prof(code), { module: "wordgrid", count: 1, seed: 6 }), b = E.generate(prof(""), { module: "wordgrid", count: 1, seed: 6 });
  ok(a.profile.roomy === true && a.sheets.every(sh => sh.roomy === true), `${code}: open spacing is the default`);
  ok(items(a.sheets[0]) <= items(b.sheets[0]), `${code}: no more things on the page than without the setting (${items(a.sheets[0])} and ${items(b.sheets[0])})`);
  const own = E.generate(prof(code, { roomy: false }), { module: "hometown", count: 1, seed: 6 });
  ok(own.profile.roomy === false, `${code}: staff turning open spacing off is respected`);
}

/* frontotemporal */
const ftd = E.generate(prof("ftd"), { module: "wordplay", count: 3, seed: 5 });
ok(ftd.sheets.length === 0, "frontotemporal: no word play page");
const tw = E.generate(prof("ftd"), { module: "twenty", count: 2, seed: 5 }), tw0 = E.generate(prof(""), { module: "twenty", count: 2, seed: 5 });
ok(tw0.sheets.some(sh => /Sayings of the day/.test(strings(sh.blocks).join(" "))) && tw.sheets.every(sh => !/Sayings of the day/.test(strings(sh.blocks).join(" "))), "frontotemporal: no \"sayings of the day\" (they are there without the setting)");

/* Korsakoff */
const kor = E.generate(prof("korsakoff"), { module: "songs", count: 2, seed: 3 });
const years = kor.sheets.flatMap(sh => strings((sh.blocks || []).filter(b => b.kind === "list")).map(x => { const m = /\((\d{4})\)$/.exec(x); return m ? +m[1] : 0; }).filter(Boolean));
ok(years.length >= 4 && years.every(y => y >= BORN + 21 && y <= BORN + 28), `Korsakoff: songs from the later part of the years they were young (${BORN + 21} to ${BORN + 28}): ${years.join(", ")}`);
ok(kor.sheets.every(sh => CUE.test(sh.staffNote || "")), "Korsakoff: the errorless cue is on every page, for staff");
const deck = RE.deck(profileOf("korsakoff"), { count: 4, seed: "x" });
ok(deck.person.bump[0] === BORN + 21 && deck.person.bump[1] === BORN + 28, `Korsakoff: the reminiscence engine's remembered years are the later part (${deck.person.bump})`);
ok(RE.deck(profileOf(""), { count: 4, seed: "x" }).person.bump[0] === BORN + 7, "no setting: the whole window, born + 7 to + 28");

/* errorless learning */
const err = E.generate(prof("errorless"), { module: "hometown", count: 2, seed: 4 });
ok(err.sheets.every(sh => CUE.test(sh.staffNote || "")), "errorless learning: the cue is on every page, for staff");

/* a condition's name is never on a page the resident reads */
const NAMES = /Lewy|frontotemporal|vascular|Korsakoff|errorless|late-stage multi-sensory/i;
for (const code of ["lewy_body", "ftd", "vascular", "korsakoff", "late_stage", "errorless"])
  for (const mod of ["hometown", "songs", "twenty", "lifestory", "myday"]) {
    const g = E.generate(prof(code), { module: mod, count: 2, seed: 2 });
    for (const sh of g.sheets) if (NAMES.test(readerText(sh))) problems.push(`${code}/${mod}: a condition's name is on a page the resident reads: ${readerText(sh).match(NAMES)[0]}`);
  }
passed++;

console.log(problems.length ? `adaptation tools check FAILED: ${problems.length} problem(s)\n  - ` + problems.join("\n  - ") : `adaptation tools check passed: ${passed} checks (the six settings in the Studio engine, Daily engagement's engine and the reminiscence engine)`);
process.exit(problems.length ? 1 : 0);
