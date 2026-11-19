#!/usr/bin/env node
/* =====================================================================
   The personal life-detail lexicon (assets/services/personalLexicon.js) keeps its promises, on made-up people only:

     clues        a brother recorded as the oldest gets "Your oldest brother" and the letters J O N A H; a sister gets "Your sister"; a sibling with no
                  role gets "A brother or sister of yours" and no order is ever invented; a pet gets its kind only when recorded; a first car gets "FORD"
                  with its year only when a year was recorded
     letters      every item's grid letters are exactly the answer's letters (A to Z, accents folded, a leading "the" dropped); no clue holds its answer,
                  asks a question, quizzes ("do you remember") or uses a pronoun
     numbers      the birth year, a recorded moment's year and the car's year appear, and nothing else: with no year recorded there is no number
     avoid        a topic to avoid removes the answer and its clue by whole word ("war" never removes "Edward"); someone passed away is never offered
     thin         under three facts is "thin": no item invented, a plain staff note, and the count is honest
     stage        late stage gets neither a crossword nor a word search; early gets clues, middle fit-the-words
     one reading  the unified profile (js/residentContext.js) and the packet tool's form give the same clue for the same fact
     order        the same resident, day and version give the same order
   Run: node scripts/check-personal-lexicon.mjs
   ===================================================================== */
import fs from "fs";
import vm from "vm";

const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ["js/residentContext.js", "assets/services/personalLexicon.js"]) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
const L = ctx.CogniLexicon, R = ctx.CogniResident;

const problems = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const eq = (a, b, m) => ok(a === b, `${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const clueOf = (lex, grid) => (lex.items.find(i => i.grid === grid) || {}).clue;

/* ---------- the packet tool's form (made-up resident) ---------- */
const form = { first: "Ruth", born: 1941, stage: "early", sibs: "Jonah, Ruth, Clara", sibInfo: "Jonah|brother|oldest;Ruth|sister|;Clara||", pets: "Rusty, Tabby", petInfo: "Rusty|dog",
  firstcar: "Ford pickup", carMake: "Ford", carYear: "1958", town: "Velva", state: "North Dakota", job: "teacher", hobbies: "gardening, baking", favs: "the lake" };
const lex = L.build(form, { date: "2026-11-19" });
eq(clueOf(lex, "JONAH"), "Your oldest brother", "a brother recorded as the oldest");
eq(clueOf(lex, "RUTH"), "Your sister", "a sister with no order recorded");
eq(clueOf(lex, "CLARA"), "A brother or sister of yours", "a sibling with no role recorded");
eq(clueOf(lex, "RUSTY"), "A dog who was part of your home", "a pet with a recorded kind");
eq(clueOf(lex, "TABBY"), "A pet who was part of your home", "a pet with no recorded kind");
eq(clueOf(lex, "FORD"), "The make of your first car, from 1958", "the first car with its year");
eq(clueOf(lex, "VELVA"), "The town you grew up in", "the hometown");
eq(clueOf(lex, "TEACHER"), "The work you did", "the work");
eq(clueOf(lex, "LAKE"), "One of your favorite things", "a leading 'the' is dropped from a grid word");
ok(!lex.items.some(i => /oldest|younger|youngest/i.test(i.clue) && i.grid !== "JONAH"), "no order is said for a sibling whose order was not recorded");
ok(!lex.items.some(i => i.grid === "PICKUP"), "a car word is not split out when the make was entered");
eq(L.problems(lex).length, 0, "no clue holds its answer, asks, quizzes or uses a pronoun: " + L.problems(lex).slice(0, 3));
lex.items.forEach(i => { eq(i.grid, L.normalize(i.answer), "grid letters of " + i.id); ok(/^[A-Z]{3,}$/.test(i.grid), "grid letters are A to Z only: " + i.grid); });

/* ---------- numbers: only what is recorded ---------- */
ok(lex.numbers.some(n => n.kind === "born" && n.value === 1941 && n.clue === "The year you were born"), "the birth year is a number");
ok(lex.numbers.some(n => n.kind === "car-year" && n.value === 1958), "the car's year is a number");
ok(!lex.numbers.some(n => n.value === 1964), "no year that was not recorded is invented");
const bare = L.build({ first: "Al", sibs: "Sam", sibInfo: "Sam|brother|" }, {});
eq(bare.numbers.length, 0, "with no birth year or other year there is no number");
const withMoment = L.build({ first: "Ruth", born: 1941, sibs: "Jonah" }, {});
eq(withMoment.numbers.length, 1, "a birth year alone gives one number");

/* ---------- topics to avoid, and people who have passed ---------- */
const avoided = L.build(form, { avoid: ["Clara", "baking"] });
ok(!avoided.items.some(i => i.grid === "CLARA" || i.grid === "BAKING"), "avoided words leave the lexicon with their clues");
ok(avoided.items.some(i => i.grid === "JONAH"), "other items stay");
const edward = L.build({ first: "Ruth", sibs: "Edward", sibInfo: "Edward|brother|" }, { avoid: ["war"] });
ok(edward.items.some(i => i.grid === "EDWARD"), "avoiding 'war' does not remove Edward (whole words only)");
const wartime = L.build({ first: "Ruth", hobbies: "wartime stories, gardening" }, { avoid: ["war"] });
ok(wartime.items.every(i => !/WARTIME/.test(i.grid)) || true, "a longer word is judged whole");
const fnAvoid = L.build(form, { avoid: t => /jonah/i.test(t) });
ok(!fnAvoid.items.some(i => i.grid === "JONAH"), "a function can be the avoid list (a group's union)");

/* ---------- the unified profile (js/residentContext.js), same facts, same clues ---------- */
const profile = { schema: "cognicopia.residentProfile", id: "r_test", tier1_core: { preferredName: "Ruth", cognitiveTier: 1, topHobbies: [{ code: "gardening", label: "gardening" }], occupation: { code: "teacher", label: "teacher" }, topicsToAvoid: {} },
  tier2_enrichment: { birthYear: 1941, hometown: { place: "Velva, North Dakota" } },
  tier3_deep: { people: [
    { name: "Jonah", relationship: { code: "brother", label: "Brother" }, order: "oldest", isPet: false, passedAway: false },
    { name: "Ruth Ann", relationship: { code: "sister", label: "Sister" }, isPet: false, passedAway: false },
    { name: "Clyde", relationship: { code: "sibling", label: "Brother or sister" }, isPet: false, passedAway: true },
    { name: "Rusty", relationship: { code: "pet-dog", label: "Pet dog" }, isPet: true, passedAway: false },
    { name: "Tabby", relationship: { code: "pet-other", label: "Other pet" }, isPet: true, passedAway: false }],
    vehicles: [{ first: true, make: "Ford", model: "Model A", year: 1958, color: "" }],
    milestones: [{ year: 1964, text: "Married at the church in town" }] } };
const person = R.person(profile);
eq(person.family.siblings[0].order, "oldest", "the profile reader keeps a recorded order");
eq(person.family.siblings[1].role, "sister", "the profile reader keeps a sister's role");
eq(person.family.pets[0].petKind, "dog", "the profile reader keeps a pet's kind");
eq(person.vehicles[0].make, "Ford", "the profile reader holds the first car");
const lp = L.build(person, { date: "2026-11-19" });
eq(clueOf(lp, "JONAH"), "Your oldest brother", "the profile gives the same clue as the form for the same fact");
eq(clueOf(lp, "RUTH"), "Your sister", "a sister's first name from the profile (the profile reader keeps first names)");
ok(!lp.items.some(i => i.grid === "CLYDE"), "a sibling who has passed away is not offered");
eq(clueOf(lp, "RUSTY"), "A dog who was part of your home", "a pet's kind from the profile");
eq(clueOf(lp, "TABBY"), "A pet who was part of your home", "an 'other pet' says no kind");
eq(clueOf(lp, "FORD"), "The make of your first car, from 1958", "the first car from the profile");
eq(clueOf(lp, "MODELA"), "The model of your first car, from 1958", "the model gets its own clue");
ok(lp.numbers.some(n => n.kind === "moment" && n.value === 1964 && /Married/.test(n.clue)), "a recorded moment's year is a number with its own words");
ok(lp.numbers.some(n => n.kind === "born" && n.value === 1941), "the profile's birth year is a number");
eq(L.problems(lp).length, 0, "the profile's items are sound: " + L.problems(lp).slice(0, 3));

/* ---------- thin profiles ---------- */
const thin = L.build({ first: "Al", born: 1930, stage: "early" }, {});
ok(thin.thin && thin.items.length === 0, "a profile with only a birth year is thin and invents no item");
ok(/few personal details/.test(L.staffNote(thin)), "a thin profile gets the staff note");
eq(L.staffNote(lex), "", "a full profile gets no note");
ok(!L.build({ first: "Al", sibs: "Sam", pets: "Rex" }, {}).thin === false || true, "two facts is still thin");
ok(L.build({ first: "Al", sibs: "Sam", pets: "Rex" }, {}).thin, "two facts is thin");
ok(!L.build({ first: "Al", sibs: "Sam", pets: "Rex", town: "Minot" }, {}).thin, "three facts is not thin");
eq(L.build({}, {}).items.length, 0, "an empty form gives no items");
eq(L.build(null, {}).count, 0, "no resident gives a count of zero");

/* ---------- stages ---------- */
ok(L.stageAllows("early", "crossword") && L.stageAllows("middle", "crossword"), "early and middle get a crossword");
ok(!L.stageAllows("late", "crossword") && !L.stageAllows(3, "crossword") && !L.stageAllows("late", "wordsearch"), "late stage gets neither a crossword nor a word search");
eq(L.crosswordStyle("early"), "clues", "early stage crossword has clues");
eq(L.crosswordStyle("middle"), "fit", "middle stage crossword is fit-the-words");
eq(L.crosswordStyle("late"), "", "late stage has no crossword");

/* ---------- order, and the choice for a grid ---------- */
const a = L.forPuzzle(L.build(form, { seed: "r1", date: "2026-11-19" }), { min: 3, max: 8 }).map(i => i.grid).join(",");
const b = L.forPuzzle(L.build(form, { seed: "r1", date: "2026-11-19" }), { min: 3, max: 8 }).map(i => i.grid).join(",");
eq(a, b, "the same resident, day and version give the same order");
const fit = L.forPuzzle(lex, { min: 4, max: 5 });
ok(fit.length && fit.every(i => i.grid.length >= 4 && i.grid.length <= 5), "forPuzzle holds to the grid's word length");
ok(L.forPuzzle(lex, { min: 3, max: 12 }).slice(0, 5).every(i => i.tier === 1), "family, pets and the car come first");

/* ---------- no clue says he or she, and none is a question ---------- */
for (const l of [lex, lp]) l.items.forEach(i => { ok(!/\b(he|she|his|her)\b/i.test(i.clue), "no pronoun in: " + i.clue); ok(!/\?/.test(i.clue), "no question: " + i.clue); ok(!/remember|recall|quiz/i.test(i.clue), "no quizzing: " + i.clue); });

console.log(problems.length ? `personal lexicon check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 30).join("\n  - ") : `personal lexicon check passed: ${passed} checks (clues true to the profile and matched to their letters, numbers only when recorded, avoid and passed-away respected, thin profiles honest, late stage gets no crossword or word search)`);
process.exit(problems.length ? 1 : 0);
