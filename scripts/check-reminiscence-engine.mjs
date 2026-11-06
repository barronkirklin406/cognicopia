#!/usr/bin/env node
/* =====================================================================
   js/reminiscence-engine.js, in Node.

     word search   every listed word is really in the grid, across or down; the same seed gives
                   the same grid and another seed a different one; the random fill never spells
                   an unwelcome word; odd input (accents, digits, too long, repeats) is handled
     matching      pairs are used once, the right column is never left in the same order, and
                   nothing on the keep-off list appears
     fun to know   every era has notes; none of them asks a question or tests anyone
     asset         the three parts (memory sheet, three-step protocol, safety notice) pass the
                   clinical audit in every tier, era and amount of detail, and fit one page
     privacy       staff notes reach page 2 only; a group sheet carries no private detail; the
                   keep-off list holds for every deep field
     settings      odd deep input is cleaned (braces and markup stripped, lengths capped)
     pipeline      the template and the agent plug into the orchestrator and answer the ping
   ===================================================================== */
import { createOrchestrator, assetText, dignityProblems, validateAsset } from "../js/agent-orchestrator.js";
import { ClinicalAuditAgent, SAFETY_NOTICE, auditText } from "../js/clinical-audit-agent.js";
import { buildWordSearch, findInGrid, isSquareGrid, matchingItems, sparksFor, ERA_SPARKS, normalizeDeep, registerReminiscence, buildRequest, reminiscenceTemplate, estimateBlocksPx, PAGE_BUDGET_PX, toLetters, seeded, FOCUS, TEMPLATE_NAME } from "../js/reminiscence-engine.js";

let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

/* ---------- the word search ---------- */
const words = ["Biscuit", "Susan", "gardening", "schoolteacher", "Cedar", "radio", "hymns"];
let findable = true, clean = true, tried = 0;
for (const size of [6, 8, 10]) for (let s = 0; s < 40; s++) {
  const ws = buildWordSearch(words, { size, seed: "s" + s, max: size === 6 ? 4 : size === 8 ? 5 : 6 }); tried++;
  if (!ws.words.length || !ws.words.every((w) => findInGrid(ws.grid, w)) || ws.grid.length !== size || !ws.grid.every((r) => r.length === size && /^[A-Z]+$/.test(r))) findable = false;
  if (ws.words.some((w) => w.length > size)) findable = false;
}
ok(findable && tried === 120, "every listed word is in the grid (across or down), every row is full and capital letters, over 120 grids");
let squares = true;
for (let n = 1; n <= 30; n++) { const g = buildWordSearch(["radio", "garden", "Biscuit", "Susan", "hymns", "orchard"], { size: n, seed: "q" + n, max: 6 }); if (!isSquareGrid(g.grid) || g.size !== n || !g.words.every((w) => findInGrid(g.grid, w))) squares = false; }
ok(squares && !isSquareGrid(["AB", "C"]) && !isSquareGrid(["ABC", "DEF"]) && !isSquareGrid([]) && isSquareGrid(["A"]), "a word search is always as many columns as rows, at every size from 1 x 1 to 30 x 30");
const a1 = buildWordSearch(words, { size: 8, seed: "x" }), a2 = buildWordSearch(words, { size: 8, seed: "x" }), a3 = buildWordSearch(words, { size: 8, seed: "y" });
ok(JSON.stringify(a1) === JSON.stringify(a2), "the same seed gives the same grid");
ok(JSON.stringify(a1.grid) !== JSON.stringify(a3.grid), "another seed gives a different grid");
ok(a1.placed.every((p) => p.dir === "across" || p.dir === "down"), "words run only across or down, never backward or diagonal");
const odd = buildWordSearch(["Zoë", "12345", "ab", "Café", "café", "THE-END", "supercalifragilistic", "", null, "rose"], { size: 8, seed: "o" });
ok(odd.words.includes("CAFE") && odd.words.includes("ROSE") && odd.words.includes("THEEND") && !odd.words.includes("AB") && odd.words.filter((w) => w === "CAFE").length === 1, "accents are folded, digits and short words dropped, repeats collapsed (" + odd.words.join(",") + ")");
ok(buildWordSearch([], { size: 6 }).words.length === 0 && buildWordSearch(undefined, { size: 6 }).grid.length === 6, "no words still gives a full grid and no error");
/* no unwelcome word in the fill, in either direction */
const BAD = ["ASS", "SEX", "DIE", "KILL", "DEAD", "DEATH", "HELL", "WAR", "GUN", "JAIL", "SICK", "HATE", "FEAR", "BOMB", "OLD", "SAD", "BAD", "CRY", "ILL", "PAIN"];
let badFound = 0, grids = 0;
for (let s = 0; s < 300; s++) {
  const ws = buildWordSearch(["RADIO", "SONG", "HOME"], { size: s % 2 ? 6 : 8, seed: "b" + s }); grids++;
  const n = ws.grid.length, lines = [...ws.grid, ...Array.from({ length: n }, (_, c) => ws.grid.map((r) => r[c]).join(""))];
  const locked = new Set(); ws.placed.forEach((p) => { for (let k = 0; k < p.word.length; k++) locked.add((p.row + (p.dir === "down" ? k : 0)) * n + p.col + (p.dir === "across" ? k : 0)); });
  lines.forEach((l, li) => BAD.forEach((w) => { for (const s2 of [l, [...l].reverse().join("")]) { const at = s2.indexOf(w); if (at < 0) continue;
    const rev = s2 !== l; const cells = []; for (let k = 0; k < w.length; k++) { const i = rev ? n - 1 - (at + k) : at + k; cells.push(li < n ? li * n + i : i * n + (li - n)); }
    if (!cells.every((c) => locked.has(c))) badFound++; } }));
}
ok(grids === 300 && badFound === 0, `300 grids: the random fill never spells an unwelcome word (${badFound} found)`);
ok(findInGrid(["CAT"], "cat") && findInGrid(["C", "A", "T"], "cat") === true && !findInGrid(["CXT"], "cat") && !findInGrid([], "cat"), "findInGrid reads across and down");

/* ---------- matching ---------- */
let pairOk = true;
for (let s = 0; s < 60; s++) {
  const m = matchingItems(4, { seed: s, pool: ["kitchen", "garden", "craft", "tools", "home", "mixed"][s % 6] });
  const lefts = m.items.map((i) => i.left), rights = m.items.map((i) => i.right);
  if (m.items.length !== 4 || new Set([...lefts, ...rights]).size !== 8) pairOk = false;
  if ([...m.rightOrder].sort().join("|") !== [...rights].sort().join("|") || m.rightOrder.every((r, i) => r === rights[i])) pairOk = false;
}
ok(pairOk, "four pairs, no word used twice, the right column is the same words in a different order, 60 sets");
const noSalt = matchingItems(6, { seed: 1, pool: "kitchen", fine: (t) => !/salt|pepper/i.test(t) });
ok(noSalt.items.length === 6 && !noSalt.items.some((i) => /salt|pepper/i.test(i.left + i.right)), "a word on the keep-off list is left out of the pairs");

/* ---------- fun to know ---------- */
const sparkAll = Object.values(ERA_SPARKS).flat();
ok(["1940s", "1950s", "1960s", "1970s", "1980s", "mixed"].every((e) => ERA_SPARKS[e] && ERA_SPARKS[e].length >= 5), "every era has at least five notes");
const pairWords = []; for (let sd = 0; sd < 40; sd++) ["kitchen", "garden", "craft", "tools", "home", "mixed"].forEach((pool) => matchingItems(6, { seed: sd, pool }).items.forEach((i) => pairWords.push(i.left, i.right)));
ok(pairWords.every((w) => w && dignityProblems(w).length === 0 && auditText(w).text === w), "no word in any pair is changed by the dignity audit (" + new Set(pairWords).size + " words)");
ok(sparkAll.every((s) => !/\?/.test(s) && /[.]$/.test(s) && dignityProblems(s).length === 0), "no note asks a question or tests anyone (" + sparkAll.length + " notes)");
ok(sparksFor("1950s", 2, { seed: 1 }).length === 2 && sparksFor("2000s", 2, { seed: 1 }).every((s) => ERA_SPARKS.mixed.includes(s)) && sparksFor("1950s", 0).length === 0, "notes come from the era, an unknown era falls back to the general ones");
ok(sparksFor("1950s", 5, { seed: 1, fine: (s) => !/television/i.test(s) }).every((s) => !/television/i.test(s)), "a note on the keep-off list is left out");
ok(/radio|music|song|record|jukebox/i.test(sparksFor("1960s", 1, { seed: 3, focus: "music" })[0]), "a music focus puts music notes first");

/* ---------- deep settings ---------- */
const d = normalizeDeep({ focus: "nonsense", music: "  Patsy Cline,{name}, <b>x</b>,Patsy Cline ", foods: ["pie", "pie", "coffee"], staffNotes: "a\n\n{b}\nc\nd\ne\nf", words: "x".repeat(500), variant: "7", include: { sparks: false } });
ok(d.focus === "mixed" && d.music.length === 3 && !d.music.some((m) => /[{}<>]/.test(m)) && d.foods.length === 2, "odd input is cleaned: unknown focus, braces and markup stripped, repeats dropped");
ok(d.staffNotes.length === 4 && d.words[0].length <= 24 && d.variant === 7 && d.include.sparks === false && d.include.wordSearch === true && d.include.matching === true, "staff notes capped at four, long words capped, variant kept, unspecified parts stay on");
ok(JSON.stringify(normalizeDeep(null)) === JSON.stringify(normalizeDeep(undefined)) && normalizeDeep("junk").include.wordSearch === true && normalizeDeep({ variant: -4 }).variant === 0 && normalizeDeep({ variant: 99999 }).variant === 999, "null, text and out-of-range numbers all give safe settings");
ok(Object.keys(FOCUS).length === 6 && seeded("a")() === seeded("a")() && seeded("a")() !== seeded("b")(), "the seeded source repeats for one seed and differs for another");
ok(toLetters("Zoë-1 Œ") === "ZOE", "toLetters folds accents and drops everything else");

/* ---------- the three-part asset, through the orchestrator and the audit ---------- */
const orch = () => registerReminiscence(createOrchestrator().use(new ClinicalAuditAgent()));
const o = orch();
const ids = o.integrity();
ok(ids.ok && ids.pings.every((p) => p.ok) && ids.stages.find((s) => s.stage === "analyze").covered && o.agents().some((a) => a.name === "ReminiscenceAgent"), "the engine's agent answers the ping and the analyze stage is covered");
const profiles = [
  { preferredName: "Peggy", formativeEra: "1938", ailmentTier: 1, hobbies: "gardening, old radio music", petNames: "Biscuit", familyNames: "Susan, Tom", spouse: "Walter", pastCareer: "schoolteacher", hometown: "Cedar Falls, Iowa", nostalgiaAnchors: "Sunday radio programs" },
  { preferredName: "Harold", formativeEra: "1946", ailmentTier: 2, hobbies: "fishing", pastCareer: "carpenter", hometown: "Duluth" },
  { preferredName: "Ruth", formativeEra: "1952", ailmentTier: 3, nostalgiaAnchors: "a quilt" },
  { formativeEra: "1960s", ailmentTier: 2 }, { ailmentTier: 3 }
];
const deepSets = [undefined, { music: "Patsy Cline", foods: "apple pie", places: "the farm", words: "orchard, piano", staffNotes: "Prefers the window seat\nEnjoys a cardigan", focus: "music" }, { include: { wordSearch: false } }, { include: { sparks: false, matching: false } }, { include: { wordSearch: false, sparks: false, matching: false } },
  { music: "a very long song title ".repeat(6), foods: "a very long food name that goes on ".repeat(4), places: "a place with a very long name ".repeat(4), words: "extraordinarily, wonderfully, magnificent", focus: "home" }];
let total = 0; const bad = [];
for (const prof of profiles) for (const deep of deepSets) for (const variant of [0, 3]) {
  const r = await o.execute(buildRequest(prof, Object.assign({}, deep, { variant }))); total++;
  const a = r.asset, t = assetText(a), tag = `${prof.preferredName || "-"}/${prof.ailmentTier}/${JSON.stringify(deep || {}).slice(0, 30)}/${variant}`;
  const res = a.pages.resident, steps = a.pages.caregiver.steps;
  const fits = estimateBlocksPx(res.blocks, res.fontPt * 96 / 72) <= PAGE_BUDGET_PX;
  const problemsHere = [];
  if (r.audit.status !== "pass") problemsHere.push("audit " + r.audit.status + " (the engine's own wording needed repair: " + JSON.stringify((r.audit.fixes || []).slice(0, 2)) + ")");
  const wsq = res.blocks.find((b) => b.type === "wordsearch"); if (wsq && !isSquareGrid(wsq.grid)) problemsHere.push("grid is not square");
  if (validateAsset(a).length) problemsHere.push("invalid: " + validateAsset(a).join(";"));
  if (/[{}]/.test(t)) problemsHere.push("brace");
  if (a.pages.caregiver.safetyNotice !== SAFETY_NOTICE) problemsHere.push("notice");
  if (steps.map((s) => s.label).join("|") !== "Visual Cue|Verbal Anchor|Validation Statement") problemsHere.push("steps");
  if (!fits) problemsHere.push("does not fit one page");
  if (!(res.fontPt >= 18)) problemsHere.push("font");
  if (dignityProblems(t).length) problemsHere.push("dignity: " + dignityProblems(t)[0]);
  if (problemsHere.length) bad.push(tag + " " + problemsHere.join(", "));
}
ok(total === 60 && bad.length === 0, `${total} sheets across tiers, details and settings pass the audit, keep the three steps and the notice, and fit one page (${bad.slice(0, 3).join(" | ")})`);

const full = await o.execute(buildRequest(profiles[0], deepSets[1]));
const blocksOf = (r) => r.asset.pages.resident.blocks.map((b) => b.type);
ok(["wordsearch", "prompts", "matching"].every((t) => blocksOf(full).includes(t)), "the memory sheet carries a word search, notes from their years and things that go together (" + blocksOf(full).join(",") + ")");
for (const tier of [1, 2, 3]) {
  const rr = await o.execute(buildRequest(Object.assign({}, profiles[0], { ailmentTier: tier }), { music: "Patsy Cline", foods: "apple pie" })), ty = blocksOf(rr);
  ok(["wordsearch", "prompts", "matching"].every((t) => ty.includes(t)) && rr.audit.status === "pass", `stage ${tier} keeps all three parts on the one page (${ty.join(",")})`);
}
const wsb = full.asset.pages.resident.blocks.find((b) => b.type === "wordsearch");
ok(wsb && wsb.words.every((w) => findInGrid(wsb.grid, w)) && wsb.words.includes("BISCUIT") && wsb.words.length >= 4, "the word search holds their own words (" + (wsb && wsb.words.join(",")) + ") and every word is findable");
const resText = JSON.stringify(full.asset.pages.resident), cg = full.asset.pages.caregiver;
ok(cg.notes.some((n) => /window seat/.test(n)) && !/window seat|cardigan/.test(resText) && !/window seat/.test(JSON.stringify(full.asset.pages.sensory)), "staff notes appear on page 2 only");
ok(full.asset.pages.sensory.items.some((i) => i.sense === "Sound" && /Patsy Cline/.test(i.text)) && full.asset.pages.sensory.items.some((i) => i.sense === "Smell" && /apple pie/.test(i.text) && /No tasting/.test(i.text)), "their music and kitchen scent reach page 3, with no tasting unless the care plan allows it");
const labels = full.asset.customization.map((c) => c.label + ":" + c.value);
ok(labels.some((l) => /Favorite music:Patsy Cline/.test(l)) && labels.some((l) => /Word search:/.test(l)) && labels.some((l) => /Staff notes:/.test(l)) && labels.some((l) => /Resident name:Peggy/.test(l)), "the preview's summary chips list what reached the sheet (" + labels.join("; ") + ")");
ok(/Peggy/.test(cg.steps[1].text) && cg.steps.map((s) => s.order).join("") === "123", "the verbal anchor uses their name and the steps are numbered");
const t3 = await o.execute(buildRequest(profiles[2], undefined));
ok(t3.asset.pages.resident.fontPt >= 24 && /here with you/.test(t3.asset.pages.caregiver.steps[2].text), "the latest stage gets the largest print and the gentlest validation");
const flagsOff = await o.execute(buildRequest(profiles[1], { include: { wordSearch: false, sparks: false, matching: false } }));
ok(flagsOff.asset.pages.resident.blocks.length > 0 && !blocksOf(flagsOff).includes("wordsearch"), "with every part switched off the plain conversation sheet still stands");

/* keep-off list */
const kept = await o.execute(buildRequest(Object.assign({}, profiles[0], { avoid: "Biscuit, radio, television, Walter" }), { music: "Patsy Cline", foods: "apple pie", places: "the farm" }));
const keptText = JSON.stringify(kept.asset);
ok(!/biscuit|radio|television|walter/i.test(keptText), "nothing on the keep-off list is printed, in any part");
const keptDeep = await o.execute(buildRequest(Object.assign({}, profiles[0], { avoid: "Patsy Cline, apple pie" }), { music: "Patsy Cline", foods: "apple pie" }));
ok(!/patsy|apple pie/i.test(JSON.stringify(keptDeep.asset)), "a deep field on the keep-off list is left out too");

/* group */
const grp = await o.execute(Object.assign(buildRequest(null, { music: "Patsy Cline", foods: "apple pie", places: "the farm", staffNotes: "Peggy is anxious", words: "Biscuit" }), { mode: "group", profiles: [{ preferredName: "Peggy", formativeEra: "1950s", ailmentTier: 1, hobbies: "gardening", petNames: "Biscuit" }, { preferredName: "Harold", formativeEra: "1950s", ailmentTier: 2, hobbies: "gardening" }] }));
const grpText = JSON.stringify(grp.asset);
ok(grp.mode === "group" && !/Peggy|Harold|Biscuit|Patsy|apple pie|the farm|anxious/.test(grpText) && grp.audit.status !== "blocked", "a group sheet carries no one's name or private detail, and no staff note");

/* provider output is not touched by the template; the template alone is deterministic */
const ctxA = { request: { deep: { music: "x" } }, mode: "individual", tier: 2, profile: o.generator ? undefined : undefined };
const one = await o.execute(buildRequest(profiles[0], deepSets[1])), two = await o.execute(buildRequest(profiles[0], deepSets[1])), other = await o.execute(buildRequest(profiles[0], Object.assign({}, deepSets[1], { variant: 5 })));
const grid = (r) => JSON.stringify((r.asset.pages.resident.blocks.find((b) => b.type === "wordsearch") || {}).grid);
ok(grid(one) === grid(two) && grid(one) !== grid(other), "the same settings give the same sheet, and 'a different version' gives a different one");
ok(typeof reminiscenceTemplate === "function" && TEMPLATE_NAME === "reminiscence" && buildRequest({ preferredName: "A" }, {}).options.template === TEMPLATE_NAME && buildRequest(null, null).profile && buildRequest({}, {}, { options: { tier: 2 } }).options.tier === 2, "buildRequest names the engine's template and keeps other options");
let threw = false; try { registerReminiscence(null); } catch (e) { threw = e instanceof TypeError; }
ok(threw, "registering with no orchestrator is refused with a plain error");
/* an old, empty request still works */
const empty = await o.execute({ options: { template: TEMPLATE_NAME } });
ok(empty.ok && empty.audit.status !== "blocked" && !/[{}]/.test(assetText(empty.asset)), "an empty request still makes a valid general sheet");

if (problems.length) { console.error("reminiscence engine check FAILED: " + problems.length + " problem(s), " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("reminiscence engine check passed: " + passed + " checks (word search, matching, notes from their years, deep settings, the three-part asset in 60 sheets, privacy and the keep-off list, orchestrator wiring)");
