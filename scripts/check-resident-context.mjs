#!/usr/bin/env node
/* =====================================================================
   The one reader of a saved resident (js/residentContext.js).

     lists      the words behind each topic and era to avoid are the same lists src/engine/ClinicalMatrix.js holds,
                and avoidWords() gives the same terms as ClinicalMatrix.avoidTerms() for the same profile
     words      whole words only: "war" leaves "warm" and "award" alone and still finds "wars"; "garden" also
                finds "gardening"; a typed topic name ("war", "Korean War") stands for the topic's whole list
     person     a made-up profile comes back flat and complete: the years of youth, stage and GDS, former work,
                hometown, family by generation, those who have passed away marked, music, pastimes, the words to
                avoid, and the optional parts of a life story; an empty profile comes back empty, nothing guessed
     agree      the reminiscence engine's own reader gives the same name, tier, birth year and music for the profile
     studio     the Activity Page Studio's engine uses the same word rule and expands a topic's name
     storage    list, read and the active resident from a storage object; a profile of another kind is not listed
     private    the file opens no storage and reaches no network
   Made-up people only. Node built-ins only. Run: node scripts/check-resident-context.mjs
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const ctx = vm.createContext({ console }); ctx.globalThis = ctx; ctx.window = ctx;
for (const f of ["src/engine/ClinicalMatrix.js", "assets/services/reminiscenceEngine.js", "js/residentContext.js", "js/generators/activity-engine.js"]) vm.runInContext(read(f), ctx, { filename: f });
const R = ctx.CogniResident, CM = ctx.ClinicalMatrix || ctx.CognicopiaClinicalMatrix, RE = ctx.CogniReminiscence, E = ctx.CognicopiaActivityEngine;
let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

ok(R && typeof R.person === "function" && CM && RE && E, "the reader, the clinical matrix, the reminiscence engine and the Studio engine all loaded");

/* ----- the lists ----- */
ok(same(R.AVOID_TOPIC_WORDS, CM.AVOID_TOPIC_WORDS), "the topic word lists are the clinical matrix's, word for word");
ok(same(R.AVOID_ERAS, CM.AVOID_ERAS), "the era word lists are the clinical matrix's, word for word");
ok(Object.keys(R.AVOID_TOPIC_WORDS).concat(R.AVOID_ERAS.map(e => e.code)).every(c => R.AVOID_NAMES[c] && !/,/.test(R.AVOID_NAMES[c])), "every topic and era has a short name with no comma in it");
const AV = { topics: [{ code: "war", label: "War and combat" }, { code: "medical", label: "Illness, hospitals and medical" }], eras: [{ code: "era-korea", label: "Korean War (1950–1953)" }], people: "Tom, Aunt Ruth", places: "the old farm", other: "sirens" };
ok(same(R.avoidWords(AV), CM.avoidTerms(AV)), "avoidWords gives the terms the clinical matrix gives for the same profile");
ok(R.avoidWords(AV).includes("battle") && R.avoidWords(AV).includes("hospital") && R.avoidWords(AV).includes("inchon") && R.avoidWords(AV).includes("aunt ruth") && R.avoidWords(AV).includes("sirens"), "a ticked topic becomes its words; typed names, places and phrases are kept as typed");

/* ----- whole words ----- */
const war = R.avoidMatcher(R.avoidFromText("war"));
ok(war("a warm day").length === 0 && war("an award for the ward").length === 0 && war("toward the hardware store").length === 0, "avoiding war leaves warm, award, ward, toward and hardware alone");
ok(war("the wars").length === 1 && war("An army cot").includes("army") && war("WAR.").length === 1, "and still finds wars, the topic's other words, and a word in capitals or before a full stop");
const g = R.avoidMatcher(["garden", "the farm fire"]);
ok(g("gardening").length === 1 && g("a gardener's hat").length === 1 && g("a garden").length === 1 && g("the  farm fire of 1931").length === 1 && g("gardenia").length === 0, "garden also finds gardening and gardener, a phrase is found across spaces, and gardenia is another word");
const sorted = R.sortAvoidText("war, Korean War, the farm fire, WAR, money");
ok(same(sorted, { topics: ["war", "money"], eras: ["era-korea"], typed: ["the farm fire"] }), "a typed topic or era name is recognised whatever its capitals, once");
ok(R.avoidFromText("Korean War").includes("pusan") && R.avoidFromText("trains").join() === "trains", "a topic's name stands for its whole list; anything else is the word as typed");

/* ----- a made-up person ----- */
const DOT = {
  schema: R.SCHEMA, version: 2, id: "res-dot", pastVocation: "",
  tier1_core: { preferredName: "  Dorothy Ann ", nickname: "Dot", unitNumber: "114-A", wing: "East", cognitiveTier: 2, occupation: { code: "teacher", label: "Teacher" }, primaryVocation: { code: "education", label: "Teaching and schools" },
    topHobbies: [{ code: "gardening", label: "Gardening" }, { code: "baking", label: "Baking" }],
    topicsToAvoid: { topics: [{ code: "medical", label: "Illness, hospitals and medical" }], eras: [{ code: "era-gulf", label: "Gulf, Iraq and Afghanistan wars" }], people: "Tom", places: "", other: "trains" } },
  tier2_enrichment: { birthYear: 1938, hometown: { environment: { code: "small-town", label: "Small town" }, place: "Scobey, Montana" }, region: { code: "mountain", label: "Mountain West" },
    music: { genres: [{ code: "country", label: "Country" }], artists: ["Patsy Cline"], favoriteSong: "Tennessee Waltz" }, meaningfulDecades: [{ code: "1950s", label: "1950s" }] },
  tier3_deep: { notes: "Loves the porch.\nInterests: quilting, the county fair\nWords from their life: Sarah, Buster, Scobey",
    people: [{ name: "Harold Lee", relationship: { code: "spouse", label: "Husband or wife" }, passedAway: true }, { name: "Sarah Lee", relationship: { code: "daughter", label: "Daughter" } },
      { name: "Ben", relationship: { code: "grandchild", label: "Grandchild" } }, { name: "June", relationship: { code: "sibling", label: "Brother or sister" } },
      { name: "Buster", relationship: { code: "pet-dog", label: "Pet dog" }, isPet: true }, { name: "", relationship: { code: "son", label: "Son" } }],
    milestones: [{ year: 1960, text: "Began teaching in Scobey" }, { year: "", text: "" }], signatureDish: { name: "Rhubarb pie", ingredients: "rhubarb, sugar, flour", steps: ["Roll the crust", "Fill and bake"] }, comforts: [{ code: "tea", label: "Warm tea" }] }
};
const d = R.person(DOT);
ok(d.id === "res-dot" && d.name === "Dorothy Ann" && d.nickname === "Dot" && d.room === "114-A" && d.wing === "East", "name, nickname, room and wing");
ok(d.born === 1938 && d.youth.from === 1953 && d.youth.to === 1963 && d.turnedTwenty === 1958 && d.decadeAtTwenty === 1950, `the years they were 15 to 25, and the decade they turned twenty (${JSON.stringify(d.youth)}, ${d.decadeAtTwenty})`);
ok(d.stage === 2 && d.stageName === "middle" && d.gds === "GDS 5", "the stage, its name and its GDS range");
ok(d.work.code === "teacher" && d.work.label === "Teacher" && /teacher/.test(d.work.text) && /education/.test(d.work.text), "former work, with one line of text to search");
ok(d.hometown.town === "Scobey" && d.hometown.state === "Montana" && d.hometown.region === "Mountain West" && d.hometown.environment === "Small town", "the hometown, in parts");
ok(d.family.partner.length === 1 && d.family.partner[0].passed === true && R.present(d.family.partner).length === 0, "the husband is there and marked as having passed away, so a page for a visitor leaves him out");
ok(d.family.children.map(x => x.first).join() === "Sarah" && d.family.grandchildren[0].name === "Ben" && d.family.siblings[0].name === "June" && d.family.pets[0].name === "Buster" && d.family.pets[0].isPet, "children, grandchildren, siblings and pets each in their own generation");
ok(d.family.all.length === 5, "a row with no name is not a person");
ok(d.music.genres.join() === "Country" && d.music.artists.join() === "Patsy Cline" && d.music.favoriteSong === "Tennessee Waltz" && d.decades.join() === "1950s", "music and the decades that matter");
ok(d.hobbies.join() === "Gardening,Baking" && d.interests.join() === "quilting,the county fair" && d.personalWords.join() === "Sarah,Buster,Scobey", "pastimes, and the interests and words the Studio keeps in the notes");
ok(d.avoid.names.join() === "illness and hospitals,Gulf and Iraq wars" && d.avoid.other.join() === "trains" && d.avoid.people.join() === "Tom" && d.avoid.words.includes("surgery") && d.avoid.words.includes("baghdad") && d.avoid.words.includes("tom"), "topics to avoid by short name, and as the words to keep off a page");
ok(d.milestones.length === 1 && d.milestones[0].year === 1960 && d.dish.name === "Rhubarb pie" && d.dish.ingredients.length === 3 && d.dish.steps.length === 2 && d.comforts.join() === "Warm tea", "milestones, a signature dish and comforts when the profile holds them; an empty milestone is dropped");
const plain = JSON.parse(JSON.stringify(DOT)); plain.tier3_deep.notes = "Loves the porch.";
ok(R.person(plain).interests.join() === "Gardening,Baking" && R.person(plain).personalWords.join() === "Harold,Sarah,Ben,June,Buster,Scobey", "with no lines in the notes, interests are the hobbies and the words are first names and the town");

/* nothing is guessed */
const none = R.person({});
ok(none.name === "" && none.born === 0 && none.youth === null && none.stage === 0 && none.gds === "" && none.family.all.length === 0 && none.avoid.words.length === 0 && none.milestones.length === 0 && none.dish.name === "" && none.hometown.town === "", "an empty profile comes back empty");
ok(R.person(null).name === "" && R.person("x").name === "" && R.person({ tier2_enrichment: { birthYear: 3000 } }).born === 0 && R.person({ tier1_core: { cognitiveTier: 9 } }).stage === 0, "a profile that is not one, an impossible year and an unknown tier are refused, not passed on");

/* ----- agreement with the reminiscence engine's reader ----- */
const rp = RE.person(DOT, new Date("2026-11-10T12:00:00Z"));
ok(rp.name === d.name && rp.tier === d.stage && rp.birthYear === d.born && rp.favoriteSong === d.music.favoriteSong && same(rp.artists, d.music.artists), "the reminiscence engine reads the same name, tier, birth year and music");

/* ----- the Studio's engine ----- */
const K = E.kit;
const samples = ["a warm day", "the wars", "gardening gloves", "an award", "army boots", "A battle of wits", "the old farm"];
ok(samples.every(t => K.avoided(t, R.avoidFromText("war, garden")) === (R.avoidMatcher(R.avoidFromText("war, garden"))(t).length > 0)), "the Studio's engine and the reader agree on every sample line");
const P = E.normalize({ stage: 1, avoid: "war, trains" });
ok(P.avoid.includes("battle") && P.avoid.includes("trains") && !P.avoid.includes("war, trains"), "typing a topic's name in the Studio keeps the whole topic off the page");
const gen = E.generate({ stage: 1, decade: 1940, avoid: "war" }, { module: "reminiscence", count: 12, seed: 4 });
ok(gen.sheets.length === 12 && !/\b(war|army|navy|soldier|battle|military|veteran)s?\b/i.test(JSON.stringify(gen.sheets.map(s => s.items))), "twelve 1940s pages made with war avoided carry none of the topic's words");

/* ----- storage ----- */
const store = (() => { const m = new Map(); return { get length() { return m.size; }, key: i => [...m.keys()][i] ?? null, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); } }; })();
store.setItem(R.PREFIX + "res-dot", JSON.stringify(DOT));
store.setItem(R.PREFIX + "res-al", JSON.stringify({ schema: R.SCHEMA, id: "res-al", tier1_core: { preferredName: "Albert" } }));
store.setItem(R.PREFIX + "res-x", JSON.stringify({ schema: "something.else", id: "res-x", tier1_core: { preferredName: "Nobody" } }));
store.setItem(R.PREFIX + "res-blank", JSON.stringify({ schema: R.SCHEMA, id: "res-blank", tier1_core: { preferredName: "  " } }));
store.setItem(R.PREFIX + "res-bad", "{not json");
store.setItem("cognicopia_other", "1"); store.setItem(R.ACTIVE_KEY, "res-dot");
ok(R.list(store).map(p => p.id).join() === "res-al,res-dot", "the list holds the two real residents, by name; another schema, a blank name and a damaged entry are left out");
ok(R.read(store, "res-dot").id === "res-dot" && R.read(store, "res-x") === null && R.read(store, "missing") === null && R.activeId(store) === "res-dot", "one resident is read by id, and the active one is named");
ok(R.list({ get length() { throw new Error("locked"); } }).length === 0 && R.activeId(null) === "", "a locked or missing store lists nobody and does not throw");

/* ----- private ----- */
const src = read("js/residentContext.js");
ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB|https?:\/\//i.test(src), "the reader opens no storage of its own and reaches no network");
ok(!/setItem|removeItem/.test(src), "the reader never writes");

console.log(problems.length ? `resident context check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `resident context check passed: ${passed} checks (one reader of a saved resident: the same avoid lists as the clinical matrix, whole-word matching, a flat person with nothing guessed, agreement with the reminiscence engine and the Studio, no storage or network of its own)`);
process.exit(problems.length ? 1 : 0);
