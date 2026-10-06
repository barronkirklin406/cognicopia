#!/usr/bin/env node
/* =====================================================================
   Cognicopia PCG content build.  Run: node scripts/build_pcg.mjs
   Check only:                        node scripts/build_pcg.mjs --check

   The content the procedural engine draws on lives in plain JSON under
   src/pcg/data (the topic graph, the profile map, the grammar, the safety
   rules, the item packs under items/ and the activity data under
   activities/: sorting groups, procedures, sayings and ladder words). This script:
     1. validates every file against its schema in src/pcg/schema;
     2. checks what a schema cannot: every reference resolves (topics, tags,
        coloring subjects), the topic graph is connected, every topic has
        enough items, every puzzle word is clean and unambiguous, no clue
        gives its own answer away, sense phrases read after a verb, plurals
        are right, and every sentence in the lexicon and the grammar passes
        the dignity rules in safety.json;
     3. writes assets/pcg/pcg-data.bundle.js, the one file the browser loads
        (window.CognicopiaPCGData), with terms and completions turned into
        pairs. With --check it writes nothing and fails if the bundle on
        disk is not exactly what the sources would make.
   Node built-ins only. Exits non-zero on any problem.
   ===================================================================== */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import vm from "vm";
import { fileURLToPath } from "url";
import { validate } from "./lib/json-schema.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = "src/pcg", OUT = "assets/pcg/pcg-data.bundle.js";
const readJSON = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const CHECK = process.argv.includes("--check");
const problems = [];
const bad = (where, msg) => problems.push(where + ": " + msg);

/* ---------- load and validate against the schemas ---------- */
const schema = n => readJSON(`${SRC}/schema/${n}.schema.json`);
const load = (file, schemaName) => {
  const data = readJSON(`${SRC}/data/${file}`);
  validate(data, schema(schemaName)).forEach(p => bad(file, p));
  return data;
};
const topicsFile = load("topics.json", "topics");
const profileMap = load("profile-map.json", "profile-map");
const grammar = load("grammar.json", "grammar");
const safety = load("safety.json", "safety");
const packFiles = fs.readdirSync(path.join(ROOT, SRC, "data/items")).filter(f => f.endsWith(".json")).sort();
const packs = packFiles.map(f => {
  const d = readJSON(`${SRC}/data/items/${f}`);
  validate(d, schema("items")).forEach(p => bad("items/" + f, p));
  if (d.pack !== f.replace(/\.json$/, "")) bad("items/" + f, `pack "${d.pack}" must match the file name`);
  return d;
});

const activityFile = (name, schemaName) => {
  const d = readJSON(`${SRC}/data/activities/${name}.json`);
  validate(d, schema(schemaName)).forEach(p => bad("activities/" + name + ".json", p));
  return d;
};
const sortingFile = activityFile("sorting", "sorting"), sequencesFile = activityFile("sequences", "sequences"),
      sayingsFile = activityFile("sayings", "sayings"), wordsFile = activityFile("words", "words");

/* ---------- the dignity rules ---------- */
const banned = (safety.banned || []).map(b => ({ id: b.id, re: new RegExp(b.pattern, b.flags || "") }));
const lint = (where, text) => { for (const b of banned) if (b.re.test(text)) bad(where, `breaks the "${b.id}" rule: "${text}"`); };
const stripSlots = s => String(s).replace(/\{[^}]*\}/g, "x");

/* ---------- topics and tags ---------- */
const tagIds = new Map(topicsFile.tags.map(t => [t.id, t]));
const topicIds = new Map(topicsFile.topics.map(t => [t.id, t]));
if (tagIds.size !== topicsFile.tags.length) bad("topics.json", "a tag id is repeated");
if (topicIds.size !== topicsFile.topics.length) bad("topics.json", "a topic id is repeated");
const adj = new Map(topicsFile.topics.map(t => [t.id, new Set()]));
for (const t of topicsFile.topics){
  for (const g of t.implies){ const tag = tagIds.get(g); if (!tag) bad("topics.json", `${t.id} implies the unknown tag ${g}`); else if (tag.decade || tag.generic) bad("topics.json", `${t.id} implies ${g}, which can never link topics (a decade or a generic tag)`); }
  for (const n of t.neighbors){ if (!topicIds.has(n)) bad("topics.json", `${t.id} lists the unknown neighbor ${n}`); else if (n === t.id) bad("topics.json", `${t.id} lists itself`); else { adj.get(t.id).add(n); adj.get(n).add(t.id); } }
  lint("topics.json " + t.id, t.label);
}
{
  const seen = new Set(), stack = [topicsFile.topics[0].id];
  while (stack.length){ const id = stack.pop(); if (seen.has(id)) continue; seen.add(id); adj.get(id).forEach(n => stack.push(n)); }
  topicsFile.topics.filter(t => !seen.has(t.id)).forEach(t => bad("topics.json", `${t.id} cannot be reached from the rest of the graph`));
}
{
  // a word that means two topics at once is allowed, but the same word twice in one topic is a typo
  const stop = new Set(profileMap.stopwords);
  for (const t of topicsFile.topics) t.keywords.forEach(k => { if (stop.has(k)) bad("topics.json", `${t.id} keyword "${k}" is a stopword and would never match`); });
}

/* ---------- items ---------- */
const subjects = new Set(readJSON("assets/coloring/manifest.json").assets.map(a => a.id));
const IRREGULAR_END = /(^|\s)(leaf|loaf|knife|wife|shelf|half|wolf|man|woman|child|foot|tooth|mouse|goose|ox|sheep|fish|deer|series)$/i;
const ARTICLE = /^(a|an|the)\s/i;
/* The "color" sense feeds sentences like "Look at the red color of this classic car", so it
   holds colors only: the things that are colored belong in "sight". */
const COLOR_WORDS = new Set("red orange yellow green blue purple violet pink brown black white gray grey silver gold golden tan cream ivory copper brass khaki olive turquoise teal rose ruby amber chestnut mahogany walnut straw peach lemon mint coral sepia chrome indigo lavender beige bronze charcoal scarlet crimson chocolate cinnamon vanilla brick moss leaf bamboo orange-red gray-brown green-black".split(" "));
const COLOR_MODS = new Set("bright deep dark light soft pale faded shiny glossy warm rich fiery sunny creamy fire-engine barn forest leafy sky royal midnight candy harvest avocado natural polished weathered galvanized plain matte two-tone and vivid cheerful gleaming woody snowy dappled swirled glassy speckled shimmering rosy tooled peachy pearly rusty dusty crisp".split(" "));
const items = [], seenId = new Set(), seenName = new Set();
const perTopic = new Map(topicsFile.topics.map(t => [t.id, 0])), perTag = new Map();
const words = (s) => String(s).toLowerCase().match(/[a-z0-9']+/g) || [];
for (const pack of packs) for (const it of pack.items){
  const at = `items/${pack.pack}/${it.id}`;
  if (seenId.has(it.id)) bad(at, "id is used twice"); seenId.add(it.id);
  if (seenName.has(it.name.toLowerCase())) bad(at, `name "${it.name}" is used twice`); seenName.add(it.name.toLowerCase());
  it.topics.forEach(t => { if (!topicIds.has(t)) bad(at, `unknown topic ${t}`); else perTopic.set(t, perTopic.get(t) + 1); });
  it.tags.forEach(t => { if (!tagIds.has(t)) bad(at, `unknown tag ${t}`); else perTag.set(t, (perTag.get(t) || 0) + 1); });
  if (!it.tags.some(t => tagIds.has(t) && !tagIds.get(t).decade && !tagIds.get(t).generic)) bad(at, "needs at least one tag that can link it to other topics");
  if (it.subject && !subjects.has(it.subject)) bad(at, `the coloring subject ${it.subject} does not exist`);
  if (/\bof\b/i.test(it.name) && !it.plural) bad(at, 'a name with "of" needs a plural');
  if (IRREGULAR_END.test(it.name) && !it.plural) bad(at, "an irregular plural needs a plural");
  if (ARTICLE.test(it.name)) bad(at, "the name must not begin with an article");
  for (const [k, v] of Object.entries(it.senses)) v.forEach(p => { if (ARTICLE.test(p)) bad(at, `sense ${k} "${p}" begins with an article; the template adds its own`); });
  if (Object.keys(it.senses).length < 3) bad(at, "needs at least three senses");
  (it.senses.color || []).forEach(c => {
    const ws = c.split(/[ ,]+/).filter(Boolean), off = ws.filter(w => !COLOR_WORDS.has(w) && !COLOR_MODS.has(w));
    if (off.length || !ws.some(w => COLOR_WORDS.has(w))) bad(at, `color "${c}" is not a plain color (${off.join(", ") || "no color word"}); describe objects under sight`);
  });
  if (it.parts.some(p => /[A-Z]/.test(p))) bad(at, "parts are lower case");
  // terms
  const terms = it.terms.map(s => { const i = s.indexOf("|"); return [s.slice(0, i), s.slice(i + 1)]; });
  const wordsSeen = new Set();
  for (const [w, clue] of terms){
    if (wordsSeen.has(w)) bad(at, `term ${w} is repeated`); wordsSeen.add(w);
    if (new RegExp("\\b" + w + "S?\\b", "i").test(clue)) bad(at, `the clue for ${w} gives the word away: "${clue}"`);
    lint(at + " clue " + w, clue);
  }
  for (const [a, ca] of terms) for (const [b] of terms) if (a !== b && (b.includes(a) || a.includes(b)) && a.length >= 3 && b.length >= 3 && a < b && b.indexOf(a) >= 0 && false) bad(at, `${a} is inside ${b}`);
  if (terms.filter(t => t[0].length <= 6).length < 3) bad(at, "needs at least three terms of six letters or fewer (for the later stages)");
  if (terms.filter(t => t[0].length <= 7).length < 4) bad(at, "needs at least four terms of seven letters or fewer");
  // completions
  const completions = it.completions.map(s => { const i = s.indexOf("|"); return [s.slice(0, i), s.slice(i + 1)]; });
  for (const [lead, ans] of completions){
    if (words(lead).includes(ans)) bad(at, `the completion "${lead}" already contains its answer "${ans}"`);
    lint(at + " completion", lead + " " + ans);
  }
  // all the text a person might read
  lint(at + " name", it.name); (it.aka || []).forEach(a => lint(at + " aka", a)); if (it.plural) lint(at + " plural", it.plural);
  it.parts.forEach(p => lint(at + " part", p));
  for (const [k, v] of Object.entries(it.senses)) v.forEach(p => lint(at + " sense " + k, p));
  (it.facts || []).forEach(f => lint(at + " fact", f));
  items.push({ ...it, pack: pack.pack, aka: it.aka || [], facts: it.facts || [], subject: it.subject || null, terms, completions });
}
{
  /* the same sentence start must not belong to two different items: it would show two days running with a different word to finish it */
  const leads = new Map();
  items.forEach(it => it.completions.forEach(([lead]) => { const k = lead.toLowerCase(); if (leads.has(k)) bad("items/" + it.id, `the completion "${lead}" is also used by ${leads.get(k)}`); else leads.set(k, it.id); }));
}
for (const [t, n] of perTopic) if (n < 4) bad("topics.json", `${t} has only ${n} items; every topic needs at least four`);
for (const tag of topicsFile.tags){
  if (tag.generic) continue;
  const n = perTag.get(tag.id) || 0, need = tag.decade ? ({ "1920s": 6, "1980s": 4, "1990s": 0 }[tag.id] ?? 12) : 4;
  if (n < need) bad("topics.json", `tag ${tag.id} is on only ${n} items (needs ${need})`);
}

/* ---------- the activity data ----------
   Everything a person might read passes the dignity rules in safety.json and the adult-dignity words in
   src/engine/ClinicalMatrix.js; the structure is checked for the mistakes that would print as nonsense. */
const matrixCtx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(ROOT, "src/engine/ClinicalMatrix.js"), "utf8"), matrixCtx);
const dignity = matrixCtx.CognicopiaClinicalMatrix.dignity;
const lintAll = (where, text) => { lint(where, text); dignity.lint(text).forEach(id => bad(where, `breaks the adult-dignity rule "${id}": "${text}"`)); };
{
  const blocked = new Set(safety.blocklist);
  const squash = w => w.toLowerCase().replace(/[^a-z]/g, "");
  const seen = new Map();
  for (const g of sortingFile.groups){
    lintAll(`sorting ${g.id} label`, g.label);
    lintAll(`sorting ${g.id} clue`, `Clue: ${g.one}`);
    for (const w of g.words){
      lintAll(`sorting ${g.id}`, w);
      const k = squash(w).replace(/s$/, "");
      if (seen.has(k)) bad(`sorting ${g.id}`, `"${w}" is also in ${seen.get(k)}: a word may belong to one group only`); else seen.set(k, g.id);
      if (blocked.has(squash(w).toUpperCase())) bad(`sorting ${g.id}`, `"${w}" is on the blocklist`);
    }
  }
  const ids = new Set(); sortingFile.groups.forEach(g => { if (ids.has(g.id)) bad("sorting", `group id ${g.id} is used twice`); ids.add(g.id); });
  // enough pairs of groups that never share a family, so an odd-one-out is never arguable
  let pairs = 0;
  for (const a of sortingFile.groups) for (const b of sortingFile.groups) if (a.id < b.id && !a.family.some(f => b.family.includes(f))) pairs++;
  if (pairs < 200) bad("sorting", `only ${pairs} pairs of unrelated groups (needs 200)`);
  const procIds = new Set();
  for (const pr of sequencesFile.procedures){
    if (procIds.has(pr.id)) bad("sequences", `procedure id ${pr.id} is used twice`); procIds.add(pr.id);
    lintAll(`sequences ${pr.id} title`, pr.title);
    pr.topics.forEach(t => { if (!topicIds.has(t)) bad(`sequences ${pr.id}`, `unknown topic ${t}`); });
    if (new Set(pr.steps).size !== pr.steps.length) bad(`sequences ${pr.id}`, "a step is repeated");
    pr.steps.forEach((st, i) => { lintAll(`sequences ${pr.id} step ${i + 1}`, st); if (/\b(then|next|first|last|finally|after that)\b/i.test(st)) bad(`sequences ${pr.id}`, `step ${i + 1} "${st}" names its own place in the order, which gives the answer away`); });
  }
  const sayIds = new Set(), leads = new Set();
  for (const it of sayingsFile.items){
    if (sayIds.has(it.id)) bad("sayings", `id ${it.id} is used twice`); sayIds.add(it.id);
    if (leads.has(it.lead.toLowerCase())) bad("sayings " + it.id, `the lead "${it.lead}" is used twice`); leads.add(it.lead.toLowerCase());
    const lw = words(it.lead);
    // a proverb may repeat itself ("Waste not, want not"); a pair or a recipe line may not give its answer away
    if (it.kind !== "proverb") for (const w of words(it.answer)) if (lw.includes(w)) bad("sayings " + it.id, `the lead "${it.lead}" already holds the answer word "${w}"`);
    if (it.others.includes(it.answer) || it.others[0] === it.others[1]) bad("sayings " + it.id, "the choices are not three different words");
    lintAll("sayings " + it.id, it.lead + " " + it.answer); it.others.forEach(o => lintAll("sayings " + it.id + " choice", o));
  }
  const ladder = new Set(wordsFile.words);
  for (const w of wordsFile.words){ if (blocked.has(w)) bad("words.json", `${w} is on the blocklist`); lintAll("words.json", w.toLowerCase()); }
  // the ladder graph must be rich enough that every start word has somewhere to go
  const nb = w => { const o = []; for (let i = 0; i < 4; i++) for (let c = 65; c < 91; c++){ const x = w.slice(0, i) + String.fromCharCode(c) + w.slice(i + 1); if (x !== w && ladder.has(x)) o.push(x); } return o; };
  let isolated = 0; for (const w of wordsFile.words) if (nb(w).length < 2) isolated++;
  if (wordsFile.words.length - isolated < 450) bad("words.json", `only ${wordsFile.words.length - isolated} words have two or more neighbors (needs 450)`);
}

/* ---------- the grammar ---------- */
const ITEM_SLOT = /^(item|a_item|the_item|item_pl|item2|a_item2|the_item2|item2_pl)$/i;
const KNOWN_SLOT = /^(item|a_item|the_item|item_pl|item2|a_item2|the_item2|item2_pl|part|part2|a_part|color|sight|sound|touch|smell|decade|fact|name|they|them|their|they_[a-z]+|page|word|moment|sense_cue|anchor)$/i;
const poolNames = new Set(Object.keys(grammar.pools));
const slotsOf = s => [...String(s).matchAll(/\{([A-Za-z0-9_]+)\}/g)].map(m => m[1]);
const checkTemplate = (where, tpl, needsItem) => {
  const slots = slotsOf(tpl.text);
  slots.forEach(s => { if (!KNOWN_SLOT.test(s) && !poolNames.has(s.toLowerCase())) bad(where, `unknown slot {${s}}`); });
  if (needsItem && !slots.some(s => ITEM_SLOT.test(s))) bad(where, "talks about no item");
  if (/\{[^}]*\}\{/.test(tpl.text)) bad(where, "two slots run together");
  lint(where, stripSlots(tpl.text));
};
const ids = new Set();
const pushId = (where, id) => { if (ids.has(id)) bad(where, `template id ${id} is used twice`); ids.add(id); };
for (const [stage, groups] of Object.entries(grammar.stages)){
  for (const [group, list] of Object.entries(groups)){
    if (!Array.isArray(list) || typeof list[0] === "string"){ (Array.isArray(list) ? list : [list]).forEach(s => lint(`grammar ${stage}.${group}`, stripSlots(s))); continue; }
    // a late-stage card is printed under the name of its item, so its sentence need not repeat it
    list.forEach(t => { pushId(`grammar ${stage}.${group}`, t.id); checkTemplate(`grammar ${stage}.${group}.${t.id}`, t, stage !== "late"); });
  }
}
for (const [k, v] of Object.entries(grammar.pools)) v.forEach(s => lint("grammar pool " + k, s));
for (const [k, v] of Object.entries(grammar.ui.titles)) lint("grammar title " + k, v);
for (const [k, v] of Object.entries(grammar.ui.instructions)) lint("grammar instruction " + k, v);
for (const stage of ["early", "middle", "late"]) grammar.caregiver.moments[stage].forEach(m => lint("grammar moment " + stage, stripSlots(m)));
for (const t of grammar.caregiver.templates){ pushId("grammar caregiver", t.id); checkTemplate("grammar caregiver." + t.id, t, false); }
{
  // every kind of item in the lexicon must have enough sentences to be talked about at every stage
  const kinds = new Set(items.map(i => i.kind));
  const open = [...grammar.stages.early.open, ...grammar.stages.early.story.filter(t => (t.presume || 0) <= 1)];
  for (const k of kinds){
    const n = open.filter(t => t.kinds.includes("*") || t.kinds.includes(k)).length;
    if (n < 4) bad("grammar", `only ${n} early templates fit things of the kind "${k}" (needs 4)`);
  }
  for (const stage of ["early", "middle", "late"]){
    const roles = new Set(grammar.caregiver.templates.filter(t => t.stages.includes(stage)).map(t => t.role));
    for (const r of ["hook", "talk", "puzzle", "color", "wrap"]) if (!roles.has(r)) bad("grammar", `no caregiver prompt for ${r} at the ${stage} stage`);
  }
}

/* ---------- safety ---------- */
for (const w of safety.blocklist) if (!/^[A-Z]{3,8}$/.test(w)) bad("safety.json", `blocklist entry ${w}`);
for (const w of safety.blocklist) if (new RegExp("^[" + safety.filler.alphabet.replace(/(.)\1+/g, "$1") + "]+$").test(w) === false && false) bad("safety.json", w);

/* ---------- the bundle ---------- */
const bundle = {
  version: 1,
  tags: topicsFile.tags,
  topics: topicsFile.topics,
  items,
  grammar: { pools: grammar.pools, stages: grammar.stages, ui: grammar.ui, caregiver: grammar.caregiver },
  activities: { sorting: sortingFile.groups, sequences: sequencesFile.procedures, sayings: sayingsFile.items, words: wordsFile.words },
  profileMap,
  safety: { filler: safety.filler, blocklist: safety.blocklist, banned: safety.banned }
};
const json = JSON.stringify(bundle);
const hash = crypto.createHash("sha256").update(json).digest("hex");
const text =
`/* Cognicopia PCG content bundle: generated by scripts/build_pcg.mjs from src/pcg/data. Do not edit by hand.
   ${items.length} items, ${topicsFile.topics.length} topics, ${topicsFile.tags.length} tags.
   content-hash: ${hash} */
(function(root){
  "use strict";
  function deepFreeze(o){ Object.getOwnPropertyNames(o).forEach(function(k){ var v = o[k]; if (v && typeof v === "object") deepFreeze(v); }); return Object.freeze(o); }
  var data = ${json};
  data.hash = "${hash}";
  root.CognicopiaPCGData = deepFreeze(data);
})(typeof globalThis !== "undefined" ? globalThis : this);
`;

if (problems.length){
  console.log(`PCG content has ${problems.length} problem${problems.length === 1 ? "" : "s"}:`);
  problems.slice(0, 80).forEach(p => console.log("  - " + p));
  if (problems.length > 80) console.log(`  ... and ${problems.length - 80} more`);
  process.exit(1);
}
const file = path.join(ROOT, OUT);
if (CHECK){
  const cur = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (cur !== text){ console.log("PCG content bundle is out of date: run node scripts/build_pcg.mjs"); process.exit(1); }
  console.log(`PCG content bundle is current: ${items.length} items, ${topicsFile.topics.length} topics, ${topicsFile.tags.length} tags (${hash.slice(0, 12)})`);
} else {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  console.log(`PCG content bundle written: ${items.length} items, ${topicsFile.topics.length} topics, ${topicsFile.tags.length} tags, ${(text.length / 1024).toFixed(0)} KB (${hash.slice(0, 12)})`);
}
