#!/usr/bin/env node
/* =====================================================================
   Checks for the clinical staging layer in src/engine/ClinicalMatrix.js and how the page makers use it.
   Node built-ins only; nothing is fetched. Part of npm test.

     1. the tiers read as a person reads them: "Tier 2 · Moderate · GDS 5", from the matrix's own numbers
     2. the thirteen core page makers: each has a GDS and FAST range (from the stages it is made for) and a named therapy
     3. the therapy anchor, "[Therapy: Reminiscence | GDS 5]": its shape, and that it is drawn in the foot of every engine page at every
        stage the page is made for, inside the margins, clear of the page number, and the page still passes the matrix's own check;
        a page made without an activity keeps the foot as it always was
     4. avoidance protocols and triggers: topics, military eras, loved ones' names and places become one list of terms; the matcher
        matches whole words (never "war" inside "toward"); a page that mentions a term fails validatePage; and the page makers, asked
        to avoid a word they would have printed, print a page without it (or refuse), at every stage
     5. the low-arousal rules for Sundowning / De-escalation mode, and the soothing engine's pages in that mode (late-stage type, one
        subject, the anchor in the foot, the avoid list honored)
     6. the profile form, the packet tool and the Packet Builder carry the new fields, labels and wiring
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0; const problems = [];
const ok = (cond, msg) => { if (cond) passed++; else problems.push(msg); };
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

const ctx = vm.createContext({ console, Date, Math, JSON, Object, Array, String, Number, RegExp, Map, Set, WeakMap, Error, Intl, parseInt, parseFloat, isFinite, isNaN });
ctx.globalThis = ctx; ctx.window = ctx;
["assets/pcg/pcg-data.bundle.js", "src/pcg/prng.js", "src/pcg/matrix.js", "src/pcg/grammar.js", "src/pcg/puzzles.js", "src/pcg/packet.js",
 "src/engine/ClinicalMatrix.js", "src/services/ColoringManifest.js", "assets/coloring/subjects.bundle.js", "src/engine/ColoringEngine.js", "src/engine/ClinicalActivities.js",
 "src/engine/SoothingArt.js", "src/engine/SoothingContent.js", "src/engine/SoothingPacketEngine.js"]
  .forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
const CM = ctx.CognicopiaClinicalMatrix, CA = ctx.CognicopiaClinicalActivities, SE = ctx.CognicopiaSoothingEngine;
ok(!!CM && !!CA && !!SE, "the matrix, the activity engine and the soothing engine load");
if (!CM || !CA || !SE) { console.error("clinical staging check FAILED: the engines did not load"); process.exit(1); }
const STAGES = ["early", "middle", "late"];

/* ---------- 1. the tiers ---------- */
const TIER = { early: "Tier 1 · Mild · GDS 3–4", middle: "Tier 2 · Moderate · GDS 5", late: "Tier 3 · Advanced · GDS 6–7" };
STAGES.forEach(st => {
  ok(CM.tierLabel(st) === TIER[st], `${st}: the tier reads "${TIER[st]}" (got "${CM.tierLabel(st)}")`);
  ok(CM.tierLabel(st, true).indexOf("FAST " + CM.STAGES[st].fast) > 0, `${st}: the label can carry the FAST stage`);
});
ok(CM.tierLabel("GDS 6") === TIER.late && CM.tierLabel(2) === TIER.middle && CM.tierLabel("mild") === TIER.early, "a stage named by GDS, number or word gets its tier");

/* ---------- 2. the thirteen core page makers ---------- */
ok(CM.CORE_KINDS.length === 13, "there are thirteen core page makers");
const kindsMade = new Set(CA.kinds().map(k => k.id));
CM.CORE_KINDS.forEach(id => {
  const a = CM.entry("builder", id) || CM.entry("packet", id);
  ok(!!a, `${id} is in the matrix`);
  if (!a) return;
  const on = STAGES.filter(s => a.stages[s]);
  const want = { early: "3–4", middle: "5", late: "6–7" };
  const lo = want[on[0]].split("–")[0], hi = want[on[on.length - 1]].split("–").pop(), range = lo === hi ? lo : lo + "–" + hi;
  ok(CM.gdsRange(a) === range, `${id}: GDS ${range} from the stages it is made for (got ${CM.gdsRange(a)})`);
  ok(/^\d(–\d)?$/.test(CM.fastRange(a)), `${id}: has a FAST range (${CM.fastRange(a)})`);
  ok(CM.therapyOf(id, "builder").length > 3, `${id}: names its therapy`);
  ok(kindsMade.has(id) || id === "pathtrace" || id === "maze-motor", `${id}: the engine draws it`);
});
/* every activity the builder or the packet tool lists, except staff pages, names a therapy; staff pages name none */
CM.ACTIVITIES.forEach(a => {
  const t = CM.therapyOf(a.id, a.tools[0]);
  ok(a.domain === "staff" ? t === "" : t.length > 3, `${a.id}: ${a.domain === "staff" ? "a staff page has no therapy anchor" : "has a therapy (" + t + ")"}`);
});

/* ---------- 3. the anchor ---------- */
STAGES.forEach(st => {
  const a = CM.anchorFor("talk", "packet", st);
  ok(a === "[Therapy: Reminiscence | GDS " + CM.STAGES[st].gds + "]", `${st}: the reminiscence anchor is "${a}"`);
});
ok(CM.anchorFor("notes", "packet", "middle") === "", "a staff page has no anchor");
ok(CM.anchorFor("choose-ending", "builder", "middle") === "[Therapy: Validation / Spontaneous Recall | GDS 5]", "a two-part therapy name is kept in full when there is room");
ok(CM.anchorFor("choose-ending", "builder", "middle", { measure: t => t.length * 10, max: 200 }) === "[Therapy: Validation | GDS 5]", "a two-part name is shortened when there is not");
const MEAS = (t, size, bold) => t.length * size * (bold ? 0.56 : 0.5);
let shells = 0;
CM.CORE_KINDS.forEach(id => {
  STAGES.forEach(st => {
    if (!CM.allowed(st, id)) return;
    const gen = CA.tryGenerate(id === "maze-motor" ? "maze" : id, { stage: st, name: "Margaret", date: "2026-10-06", variant: 3 });
    if (!gen.page) return;
    const withA = CA.withShell(gen.page, { name: "Margaret", date: "2026-10-06", wing: "Maple Wing", page: 2, pages: 5, tip: "Clinical Tip: Sit beside them.", activity: id, tool: "builder" });
    const want = CM.anchorFor(id, "builder", st), foot = withA.texts.filter(t => t.role === "footer");
    ok(!!want && withA.anchor === want, `${id}/${st}: the page carries its anchor`);
    const at = foot.find(t => t.text === (withA.anchor || ""));
    ok(!!at && at.align === "right", `${id}/${st}: the anchor is set at the right of the foot`);
    const pg = foot.find(t => /^Page \d+ of \d+$/.test(t.text)), name = foot.find(t => t.text === "Cognicopia");
    if (at && pg && name) {
      const R = 612 - 54, L = 54;
      ok(at.x <= R + 0.6 && at.x - at.w >= L - 0.6, `${id}/${st}: the anchor sits inside the margins`);
      ok(pg.x >= name.x + name.w + 4 && pg.x + pg.w < at.x - at.w - 6, `${id}/${st}: the page number clears the name and the anchor`);
    } else ok(false, `${id}/${st}: the foot has a name, a page number and an anchor`);
    ok(CM.validatePage(withA, st).length === 0, `${id}/${st}: the page with its anchor passes the matrix check (${CM.validatePage(withA, st)[0] || ""})`);
    const plain = CA.withShell(gen.page, { name: "Margaret", date: "2026-10-06", page: 2, pages: 5, tip: "" });
    ok(!plain.anchor && plain.texts.some(t => t.role === "footer" && t.align === "center" && /^Page 2 of 5$/.test(t.text)), `${id}/${st}: without an activity the foot is as it was`);
    shells++;
  });
});
ok(shells >= 29, `the anchor was proved on ${shells} kind and stage pairs`);

/* ---------- 4. avoidance protocols and triggers ---------- */
const terms = CM.avoidTerms({ topics: [{ code: "war" }], eras: ["era-vietnam"], people: "Tom, Aunt Ruth", places: "Normandy; the old farm", other: "sirens" });
["war", "vietnam", "saigon", "tom", "aunt ruth", "normandy", "the old farm", "sirens"].forEach(w => ok(terms.indexOf(w) >= 0, `the avoid list carries "${w}"`));
ok(terms.length === new Set(terms).size && terms.every(t => t === t.toLowerCase() && t.length >= 3), "the avoid list has no duplicates and no short or mixed-case terms");
ok(CM.avoidTerms(["Korea", "korea", "ab"]).join() === "korea", "a plain list of words is accepted, de-duplicated and cleaned");
ok(CM.AVOID_ERAS.length >= 4 && CM.AVOID_ERAS.every(e => e.code && e.label && e.words.length >= 3), "each military era has a code, a label and its words");
const hit = CM.avoidMatcher(["war", "tom", "the old farm", "korea"]);
ok(hit("We walked toward the water").length === 0, 'the matcher does not find "war" inside "toward" or "tom" inside "tomato"');
ok(hit("A tomato and a warm day").length === 0, 'the matcher ignores "tomato" and "warm"');
ok(hit("The War years; Tom's hat; the Old Farm; Korea.").length === 4, "the matcher finds whole words, possessives and phrases, in any case");
ok(hit("two wars").indexOf("war") >= 0, "a plural is found");
const probe = { w: 612, h: 792, stage: "early", frame: { x: 54, y: 54, w: 504, h: 684 }, items: [], texts: [{ text: "Tell me about Tom.", x: 60, y: 200, size: 20, bold: true, role: "body", align: "left" }] };
ok(CM.validatePage(probe, "early").length === 0, "a clean page passes");
ok(CM.validatePage(probe, "early", { avoid: ["tom"] }).some(p => /asked to keep off the page/.test(p)), "a page that names an avoided word fails the page check");
ok(CM.validatePage(probe, "early", { avoid: [] }).length === 0, "an empty avoid list changes nothing");

/* the page makers keep an avoided word off the page, at every stage they are made for */
let avoided = 0, refused = 0;
CM.CORE_KINDS.forEach(id => {
  STAGES.forEach(st => {
    if (!CM.allowed(st, id) || id === "maze-motor") return;
    for (let v = 1; v <= 3; v++) {
      const base = CA.tryGenerate(id, { stage: st, name: "Friend", date: "2026-10-06", variant: v * 11 });
      if (!base.page) continue;
      const words = [].concat(...base.page.texts.filter(t => ["word", "clue", "choice", "cell"].indexOf(t.role) >= 0 && /^[A-Za-z]{5,12}$/.test(t.text)).map(t => [t.text.toLowerCase()]));
      const pick = Array.from(new Set(words)).slice(0, 2);
      pick.forEach(w => {
        const again = CA.tryGenerate(id, { stage: st, name: "Friend", date: "2026-10-06", variant: v * 11, avoid: [w] });
        if (!again.page) { refused++; return; }
        const m = CM.avoidMatcher([w]);
        const text = again.page.texts.filter(t => t.role !== "footer" && t.role !== "header").map(t => t.text).join(" \n ");
        ok(m(text).length === 0, `${id}/${st}: with "${w}" avoided, the page does not print it`);
        avoided++;
      });
    }
  });
});
ok(avoided >= 40, `the engine was held to an avoid list on ${avoided} pages (${refused} refused)`);

/* ---------- 5. the low-arousal rules and the calm pages ---------- */
ok(CM.CALM.stage === "late" && CM.CALM.maxItemsPerPage <= 3 && CM.CALM.prompt === "reminiscence", "the calm rules draw at the late stage, with few things and a reminiscence invitation");
["orientation", "silhouette", "pathtrace", "talk"].forEach(id => ok(CM.calmOk(id), `${id} is a calm page`));
["wordsearch", "search-large", "ladder", "anagram", "mini-sudoku", "money-count", "bingo"].forEach(id => ok(!CM.calmOk(id), `${id} is not a calm page (timed, competing or dense)`));
for (let i = 0; i < 6; i++) {
  const pk = SE.generate({ stage: "late", theme: "heritage", seed: "calm|" + i, count: 1, avoid: ["tom", "korea"], name: "Margaret", date: "2026-10-06", wing: "Maple Wing" });
  const pg = pk.pages[0].full;
  ok(pk.pages.length === 1, "calm mode makes one page for one page");
  ok(CM.validatePage(pg, "late", { avoid: ["tom", "korea"] }).length === 0, `calm page ${i}: late-stage type and lines, nothing avoided (${CM.validatePage(pg, "late", { avoid: ["tom", "korea"] })[0] || ""})`);
  ok(/^\[Therapy: .+ \| GDS 6–7\]$/.test(pg.anchor || ""), `calm page ${i}: carries its anchor "${pg.anchor}"`);
  ok(pg.items.length <= 60, `calm page ${i}: one subject, not a busy page (${pg.items.length} shapes)`);
}

/* ---------- 6. the pages that carry the fields ---------- */
const profile = read("profile.html"), index = read("index.html"), builder = read("builder.html");
ok(/Avoidance Protocols &amp; Triggers/.test(profile), "profile.html names the field Avoidance Protocols & Triggers");
["avoidTopics", "avoidEras", "avoidPeople", "avoidPlaces", "avoidOther"].forEach(n => ok(new RegExp('name="' + n + '"').test(profile), `profile.html has the ${n} control`));
ok(/eras: ticks\("avoidEras"\)/.test(profile) && /people: text\("rapAvoidPeople"\)/.test(profile) && /places: text\("rapAvoidPlaces"\)/.test(profile), "profile.html saves the eras, people and places");
ok(/avoidEras: codes\(/.test(profile) && /avoidPeople:/.test(profile) && /avoidPlaces:/.test(profile), "profile.html brings them back when a profile is opened");
ok(/Tier 1 · Mild · GDS 3–4/.test(profile) && /Tier 2 · Moderate · GDS 5/.test(profile) && /Tier 3 · Advanced · GDS 6–7/.test(profile), "profile.html's tier choices read Tier, name and GDS");
ok(/eras: choices\(av\.eras, BOOK\.avoidEras/.test(index) && /people: str\(av\.people, 120\)/.test(index) && /"avoidEras":\[\["era-wwii"/.test(index), "the packet tool keeps the new fields when it reads a profile");
ok(/CMa\.avoidTerms\(\{ eras: codes\(TA\.eras\), people: TA\.people, places: TA\.places, other: TA\.other \}\)/.test(index), "the packet tool turns them into the avoid list its page makers use");
ok(/Tier 1 · Mild · GDS 3–4 \(FAST 3–4\)/.test(index) && /anchorFor:anchorPlan\(/.test(index) && /function anchorPlan/.test(index), "index.html shows the tier with its GDS and draws the anchor in the foot");
ok(/const tierText = /.test(builder) && /function tierChanges\(/.test(builder) && /id="tierNote"/.test(builder), "builder.html shows the tier with its GDS and says what it changes");
ok(/id="cfgAvoid"/.test(builder) && /id="cfgWho"/.test(builder) && /cfg\.avoid = av/.test(builder) && /mentions\(textOf\(page\)\)/.test(builder), "builder.html has the avoid field, the saved-resident picker and redraws a page that names an avoided word");
ok(/avoid:cfg\.avoid \|\| \[\]/.test(builder) && /activity:def\.kind, tool:"builder"/.test(builder), "builder.html passes the avoid list and the activity to the engine");
ok(/function calmSheetHtml\(/.test(builder) && /CognicopiaSoothingEngine/.test(builder), "builder.html's calm mode draws the soothing engine's page");

console.log(problems.length ? `clinical staging check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 40).join("\n  - ") + (problems.length > 40 ? `\n  ... and ${problems.length - 40} more` : "") : `clinical staging check passed: ${passed} checks (tiers, the thirteen core modules' GDS and therapy, the anchor in ${shells} page foots, avoidance on ${avoided} pages, calm pages, the fields in all three pages)`);
process.exit(problems.length ? 1 : 0);
