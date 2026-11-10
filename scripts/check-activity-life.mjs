#!/usr/bin/env node
/* =====================================================================
   The life pages: twelve kinds of page about one person
   (js/generators/activity-life.js, js/generators/activity-life-data.js).

     data       every trade, region, saying, dish, story and ladder is the right shape, an adult's words, and true to
                its own rules (a ladder changes one letter a rung; a story has a gap for every number; a picture a page
                asks for is in the library; the states of a region are all there, once)
     pages      every kind, at every stage it is made for, for three kinds of hand, with a full profile and with none:
                pages are made, pass the page rules (3:4, black and white, type floors, 32 pt titles, no empty band,
                nothing too full), stay calm by the facility validator's measure, and carry a note for staff
     personal   a made-up resident's pages say what her profile says: her birth year and town, her work, her family by
                generation, the songs of the years she was 15 to 25, the year she turned twenty, the sights of her
                region; someone who has passed away is not on the visitor's page; a person the profile says to leave
                out is left out everywhere
     no guess   with no profile the same pages still work, with room to write, and claim nothing about the person
     songs      a song is named by title, artist and year; no page here prints a song's words
     avoid      with several topics to avoid, no page carries a word of them
     wiring     the Studio page loads the files, they are kept for offline use, the validator knows each kind
   Made-up people only. Node built-ins only. Run: node scripts/check-activity-life.mjs
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const ctx = vm.createContext({ console }); ctx.globalThis = ctx; ctx.window = ctx;
const FILES = ["assets/coloring/subjects.bundle.js", "src/services/ColoringManifest.js", "src/engine/ColoringEngine.js", "src/engine/DescribeCreate.js", "assets/services/reminiscenceEngine.js", "js/residentContext.js",
  "js/generators/activity-engine.js", "js/generators/coloring-pipeline.js", "js/generators/activity-modules.js", "js/generators/activity-pages.js", "js/generators/activity-life-data.js", "js/generators/activity-life.js", "js/utils/facility-validator.js"];
for (const f of FILES) vm.runInContext(read(f), ctx, { filename: f });
const E = ctx.CognicopiaActivityEngine, PL = ctx.CognicopiaColoringPipeline, FV = ctx.CognicopiaFacilityValidator, R = ctx.CogniResident, D = ctx.CognicopiaLifeData, RE = ctx.CogniReminiscence, M = ctx.CognicopiaColoringManifest;
M.loadSync();
let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const LIFE = ["lifestory", "generations", "whoswho", "mytrade", "hometown", "songs", "twenty", "thennow", "myday", "dish", "comfort", "wordplay"];
const DEX = ["steady", "limited", "minimal"];
const quiz = /do you remember|remember when|can you (?:tell|name|recall)|what year|who is this|quiz|\btest\b|correct|wrong|sweetie|honey|\bdear\b|good job|well done/i;
const strings = v => typeof v === "string" ? [v] : typeof v === "number" ? [String(v)] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];
const textOf = pg => pg.ops.filter(o => o.t === "text" && o.role !== "code").map(o => o.str).join(" | ");
const pagesOf = sh => PL.sheetPages(sh, "full").pages;

/* ---------- a made-up resident ---------- */
const profileOf = (o = {}) => ({ schema: R.SCHEMA, version: 2, id: "res-dot",
  tier1_core: { preferredName: "Dorothy", cognitiveTier: 1, occupation: { code: "teacher", label: "Teacher" }, topHobbies: [{ code: "gardening", label: "Gardening" }, { code: "baking", label: "Baking" }],
    topicsToAvoid: { topics: o.topics || [], eras: [], people: o.avoidPeople || "", places: "", other: "" } },
  tier2_enrichment: { birthYear: o.born || 1938, hometown: { place: o.place == null ? "Scobey, Montana" : o.place }, music: { genres: [{ code: "country", label: "Country" }], artists: ["Patsy Cline"], favoriteSong: "Tennessee Waltz" } },
  tier3_deep: { notes: "", milestones: o.milestones || [], signatureDish: o.dish || {}, comforts: o.comforts || [],
    people: [{ name: "Harold Lee", relationship: { code: "spouse", label: "Husband or wife" }, passedAway: true }, { name: "Sarah Lee", relationship: { code: "daughter", label: "Daughter" } },
      { name: "Tom Lee", relationship: { code: "son", label: "Son" } }, { name: "Ben", relationship: { code: "grandchild", label: "Grandchild" } },
      { name: "June", relationship: { code: "sibling", label: "Brother or sister" } }, { name: "Buster", relationship: { code: "pet-dog", label: "Pet dog" }, isPet: true }] } });
const dot = (stage, dexterity = "steady", o = {}) => { const person = R.person(profileOf(o)); return { stage, dexterity, name: "Dorothy", born: person.born, vocation: o.vocation == null ? "teacher" : o.vocation, interests: "gardening, baking", avoid: [...person.avoid.names, ...person.avoid.people].join(", "), person }; };
const nobody = (stage, dexterity = "steady") => ({ stage, dexterity, decade: 1950 });
const gen = (profile, module, count = 6, seed = 1) => E.generate(profile, { module, count, seed });
/* what a set of sheets says, as written (a line that wraps on the page is still one line here) */
const said = sh => [sh.title, sh.subtitle].concat(strings((sh.blocks || []).filter(b => b.kind !== "staff"))).join(" | ");
const all = (profile, module, count, seed) => gen(profile, module, count, seed).sheets.map(said).join(" || ");

/* =================================================== the data =================================================== */
ok(D && E && PL && FV && R && RE, "the life data, the engines, the validator, the resident reader and the reminiscence engine loaded");
const everyString = strings(D);
ok(everyString.length > 700, `the data was read (${everyString.length} lines of text)`);
ok(everyString.every(t => !E.toneProblems(t).length && !quiz.test(t)), "nothing in the data quizzes or talks down: " + everyString.filter(t => E.toneProblems(t).length || quiz.test(t)).slice(0, 3).join(" / "));
ok(everyString.every(t => t === t.trim() && !/ {2}/.test(t)), "no stray spaces in the data");

/* trades: the Studio's ten kinds of work */
const VOC = ["farmer", "teacher", "nurse", "cook", "mechanic", "secretary", "carpenter", "driver", "shopkeeper", "seamstress"];
ok(JSON.stringify(Object.keys(D.TRADES).sort()) === JSON.stringify(VOC.slice().sort()), "there is a trade for each of the Studio's ten kinds of work");
for (const v of VOC) { const t = D.TRADES[v] || { tools: [], talk: [] };
  ok(t.tools.length >= 6 && t.tools.every(x => x.length === 2 && x[0] && x[1]) && new Set(t.tools.map(x => x[0])).size === t.tools.length, `${v}: six tools or more, each with what it is for, none twice`);
  ok(t.talk.length >= 3 && t.place && t.worker, `${v}: a place, a name for the worker and three things to talk about`); }

/* regions */
const REG = Object.keys(D.REGIONS);
ok(REG.every(c => RE.REGIONS.some(r => r.code === c)) && REG.length === 10, "the ten regions are the reminiscence engine's own (all but the one for another country)");
for (const c of REG) ok(D.REGIONS[c].sights.length >= 5 && D.REGIONS[c].tastes.length >= 3 && Array.isArray(D.STATES[c]) && D.STATES[c].length >= 2, `${c}: five sights, three tastes and its states`);
const codes = Object.values(D.STATES).flat().filter(x => /^[A-Z]{2}$/.test(x));
ok(codes.length === 51 && new Set(codes).size === 51, `every state and the District of Columbia is in one region, once (${codes.length} codes)`);
ok(Object.values(D.STATES).flat().length === new Set(Object.values(D.STATES).flat().map(x => x.toLowerCase())).size, "no state or province is in two regions");
ok(D.ANYWHERE.sights.length >= 5 && D.ANYWHERE.tastes.length >= 3, "there is a set of sights for a place that is not placed");

/* songs: title, artist and year only, and enough for every year a resident might have been young in */
ok(D.SONGS.length >= 12 && D.SONGS.every(s => s.title && s.artist && s.year >= 1973 && s.year <= 1989 && Object.keys(s).sort().join() === "artist,title,year"), "the later songs are a title, an artist and a year between 1973 and 1989, and nothing else");
const allSongs = RE.SONGS.concat(D.SONGS).filter(s => s.year > 1900);
for (const born of [1920, 1925, 1930, 1935, 1940, 1945, 1950, 1955, 1960]) ok(allSongs.filter(s => s.year >= born + 15 - 4 && s.year <= born + 25 + 4).length >= 4, `born ${born}: four songs or more from the years they were 15 to 25`);

/* sayings, then and now, a day, dishes, comforts */
ok(JSON.stringify(Object.keys(D.SAYINGS)) === JSON.stringify(["1940", "1950", "1960", "1970", "1980"]) && Object.values(D.SAYINGS).every(l => l.length >= 5 && l.every(x => x.length === 2 && x[0] && x[1])), "five decades of sayings, five or more to a decade, each with what it meant");
ok(D.THEN_NOW.length >= 20 && D.THEN_NOW.every(x => x.length === 3 && x[0] && x[1]) && new Set(D.THEN_NOW.map(x => x[0])).size === D.THEN_NOW.length, "twenty or more old things, each with what does its job now, none twice");
const assetIds = new Set(M.assets().map(a => a.id));
ok(D.THEN_NOW.filter(x => x[2]).length >= 5 && D.THEN_NOW.every(x => !x[2] || assetIds.has(x[2])), "a drawing a then-and-now pair names is in the coloring library");
ok(["morning", "evening"].every(k => D.DAY[k].steps.length >= 5 && assetIds.has(D.DAY[k].pic) && D.DAY_CHOICES[k].length >= 4), "a morning and an evening, five steps or more each, and their drawings are in the library");
ok(D.DISHES.length >= 12 && D.DISHES.every(d => d.name && d.ingredients.length === 5 && d.steps.length === 4 && d.regions.every(c => D.REGIONS[c])), "twelve dishes or more: five things that go in, four steps, and regions that exist");
ok(D.COMFORTS.length >= 5 && D.COMFORTS.every(g => g.label && g.options.length === 4), "five kinds of comfort, four choices each");

/* word play */
ok(D.COMPOUNDS.length >= 30 && D.COMPOUNDS.every(x => /^[a-z]+$/.test(x[0]) && /^[a-z]+$/.test(x[1])) && new Set(D.COMPOUNDS.map(x => x.join(""))).size === D.COMPOUNDS.length, "thirty or more pairs of words that join, none twice");
for (const st of D.STORIES) { const nums = (st.text.match(/\((\d)\)/g) || []).map(x => Number(x[1]));
  ok(st.blanks.length === 5 && JSON.stringify(nums) === JSON.stringify([1, 2, 3, 4, 5]) && st.blanks.every(b => b[0] && ["", "person", "place", "song", "pet"].includes(b[1])), `the story "${st.title}" has a gap for each of its five numbers, in order`); }
const WORDS = new Set(JSON.parse(read("src/pcg/data/activities/words.json")).map ? JSON.parse(read("src/pcg/data/activities/words.json")).map(w => String(w.word || w).toUpperCase()) : Object.values(JSON.parse(read("src/pcg/data/activities/words.json"))).flat().map(w => String(w.word || w).toUpperCase()));
for (const l of D.LADDERS) { const ws = l.rungs.map(x => x[0]);
  const oneLetter = ws.every((w, i) => !i || (w.length === ws[i - 1].length && [...w].filter((ch, k) => ch !== ws[i - 1][k]).length === 1));
  ok(ws.length >= 4 && oneLetter && l.rungs.every((x, i) => /^[A-Z]{4}$/.test(x[0]) && (i === 0 ? x[1] === "" : x[1].length > 4)) && new Set(ws).size === ws.length, `the ladder ${ws.join(" > ")} changes one letter a rung and has a clue for every step`);
  ok(ws.every(w => WORDS.has(w)), `every word of the ladder ${ws.join(" > ")} is in the word list the packet engine uses`); }
ok(D.LADDERS.length >= 15 && D.LADDERS.some(l => !l.tags.length), "fifteen ladders or more, and one that belongs to no pastime");

/* =================================================== the pages =================================================== */
const mods = E.modules();
ok(LIFE.every(id => mods.some(m => m.id === id)) && mods.length >= 24, `the twelve kinds are registered beside the others (${mods.length} kinds of page in all)`);
{
  const seen = new Set(); let clash = 0;
  for (const m of mods.filter(x => x.id !== "coloring")) { const st = (m.stages || [1])[0], code = gen(nobody(st), m.id, 1, 5).code.split("-")[1]; if (LIFE.includes(m.id)) { if (seen.has(code) || code.length !== 2) clash++; seen.add(code); } }
  ok(clash === 0 && seen.size === 12, "each of the twelve has two letters of its own in the page code, so two kinds are never told apart only by luck");
}
let made = 0, bad = 0, notCalm = 0, noNote = 0, worstBand = 0, leastWhite = 1; const firstBad = [];
for (const id of LIFE) { const meta = mods.find(m => m.id === id);
  for (const stage of meta.stages) for (const dexterity of DEX) for (const seed of [1, 7, 99]) for (const whom of ["dot", "nobody"]) {
    const r = gen(whom === "dot" ? dot(stage, dexterity) : nobody(stage, dexterity), id, 6, seed), tag = `${id} stage ${stage} ${dexterity} ${whom}`;
    ok(r.sheets.length >= 1 && r.sheets.length <= 6, `${tag}: ${r.sheets.length} sheets`);
    ok(r.problems.length === 0, `${tag}: ${r.problems.slice(0, 2).join("; ")}`);
    for (const sh of r.sheets) {
      if (sh.kind !== "blocks" || !/^Goal: /.test(sh.staffNote || "") || sh.module !== id) noNote++;
      for (const pg of pagesOf(sh)) { made++;
        const v = PL.validate(pg), fv = FV.validatePage(pg, { stage });
        if (v.length) { bad++; if (firstBad.length < 4) firstBad.push(tag + ": " + v[0]); }
        if (!fv.whitespace.ok) { notCalm++; if (firstBad.length < 4) firstBad.push(tag + ": only " + Math.round(fv.whitespace.ratio * 100) + " percent empty"); }
        worstBand = Math.max(worstBand, PL.blankBand(pg)); leastWhite = Math.min(leastWhite, fv.whitespace.ratio);
        if (quiz.test(textOf(pg))) { bad++; if (firstBad.length < 4) firstBad.push(tag + ": quizzes"); }
      }
    }
  }
}
ok(made > 1500, `every kind was made at every stage, for three kinds of hand, with a profile and without (${made} pages)`);
ok(bad === 0, `every page passes the page rules (${bad} do not: ${firstBad.join(" / ")})`);
ok(notCalm === 0, `every page stays calm by the facility validator's measure (${notCalm} do not; the fullest leaves ${Math.round(leastWhite * 100)} percent empty)`);
ok(worstBand <= PL.BLANK_MAX, `no page leaves a large band empty (the tallest is ${worstBand} px)`);
ok(noNote === 0, `every sheet is a page of several items with a note for staff (${noNote} are not)`);
/* a stage a kind is not made for gets nothing, and says so */
ok(gen(nobody(3), "lifestory").sheets.length === 0 && gen(nobody(3), "lifestory").notFitting && gen(nobody(1), "comfort").notFitting, "a kind made for other stages makes nothing at this one and says so");
/* a different seed gives different pages where there is something to vary */
{ let varied = 0; for (const id of LIFE) { const st = mods.find(m => m.id === id).stages[0]; if (JSON.stringify(gen(dot(st), id, 3, 1).sheets.map(s => s.blocks)) !== JSON.stringify(gen(dot(st), id, 3, 2).sheets.map(s => s.blocks))) varied++; }
  ok(varied >= 8, `"Try different pages" changes the page for most kinds (${varied} of 12)`); }
ok(JSON.stringify(gen(dot(1), "hometown", 3, 4).sheets) === JSON.stringify(gen(dot(1), "hometown", 3, 4).sheets), "the same profile and seed make the same pages every time");

/* =================================================== personal =================================================== */
/* my life story */
{ const t = all(dot(1), "lifestory", 1);
  ok(/1938/.test(t) && /Born in Scobey, Montana/.test(t) && /Worked as a teacher/.test(t) && /Married Harold/.test(t) && /Raised Sarah and Tom/.test(t) && /Grandparent to Ben/.test(t), `her life story says what her profile says (${t.slice(0, 160)})`);
  ok(gen(dot(1), "lifestory", 1).sheets[0].personal === true && gen(nobody(1), "lifestory", 1).sheets[0].personal === false, "a page knows whether it came from a profile");
  const n = all(nobody(1), "lifestory", 1);
  ok(/Every life has its chapters/.test(n) && /Where I was born/.test(n) && !/Scobey|Dorothy|teacher|1938/.test(n), "with no profile the page offers the chapters any life has and claims nothing");
  const own = all(dot(1, "steady", { milestones: [{ year: 1960, text: "Began teaching in Scobey" }, { year: 1957, text: "Finished college in Bozeman" }, { year: 1962, text: "Married Harold" }] }), "lifestory", 1);
  ok(own.indexOf("1957") < own.indexOf("1960") && own.indexOf("1960") < own.indexOf("1962") && /Finished college in Bozeman/.test(own) && !/Worked as a teacher/.test(own) && /The years, in order/.test(own), "milestones entered in the profile are used as written, in order of year"); }
/* family across the generations */
{ const t = all(dot(1), "generations", 1);
  ok(["Dorothy", "Harold", "June", "Sarah", "Tom", "Ben"].every(n => t.includes(n)) && /My parents/.test(t) && /My grandchildren/.test(t) && /husband or wife/.test(t), `the family page holds each generation by name (${t.slice(0, 140)})`);
  const pg = pagesOf(gen(dot(1), "generations", 1).sheets[0])[0], boxes = pg.ops.filter(o => o.t === "rect").length;
  ok(boxes >= 8, `a generation with nobody in the profile still has boxes to write in (${boxes} boxes on the page)`);
  const n = all(nobody(1), "generations", 1);
  ok(/My parents/.test(n) && /My children/.test(n) && !/Sarah|Harold/.test(n), "with no profile the family page is boxes to fill in together");
  ok(!/brothers and sisters/.test(all(dot(2), "generations", 1)), "the middle stage keeps to the line of descent (no row for brothers and sisters)"); }
/* who's who */
{ const t = all(dot(1), "whoswho", 1);
  ok(["Sarah Lee", "Tom Lee", "Ben", "June", "Buster"].every(n => t.includes(n)) && /My daughter/.test(t) && /My dog/.test(t), `who's who shows the people in her life and how each belongs (${t.slice(0, 140)})`);
  ok(!/Harold/.test(all(dot(1), "whoswho", 3)) && !/Harold/.test(all(dot(3), "whoswho", 3)), "someone who has passed away is not on a page made for visits");
  const late = gen(dot(3), "whoswho", 3).sheets;
  ok(late.every(sh => sh.blocks.find(b => b.kind === "frames").items.length === 2) && late.length === 3 && new Set(late.map(sh => sh.blocks[0].items[0].name)).size === 3, "the late stage shows two people to a page, and the next page shows the next two");
  ok(/A photo or a name/.test(all(nobody(2), "whoswho", 1)), "with no profile the frames are there to fill in"); }
/* a person the profile says to leave out is left out everywhere */
{ const p = dot(1, "steady", { avoidPeople: "Tom" }); let found = "";
  for (const id of ["lifestory", "generations", "whoswho", "wordplay"]) if (/\bTom\b/.test(all(p, id, 6))) found += id + " ";
  ok(found === "", `a loved one the profile says to leave out appears on no page (${found || "none"})`);
  ok(/Sarah/.test(all(p, "lifestory", 1)) && /Sarah Lee/.test(all(p, "whoswho", 1)), "and the others are still there"); }
/* a name is a name: one that sounds like a word the tone rules refuse still belongs on the page */
{ const prof = profileOf(); prof.tier3_deep.people = [{ name: "Honey Test", relationship: { code: "daughter", label: "Daughter" } }, { name: "Dear", relationship: { code: "pet-dog", label: "Pet dog" }, isPet: true }];
  const person = R.person(prof), p = { stage: 1, dexterity: "steady", name: "Dorothy", born: 1938, vocation: "teacher", person };
  const life = gen(p, "lifestory", 1), whoIs = gen(p, "whoswho", 1), fam = gen(p, "generations", 1);
  ok(/Raised Honey/.test(said(life.sheets[0])) && /Honey Test/.test(said(whoIs.sheets[0])) && /Dear/.test(said(whoIs.sheets[0])) && /Honey/.test(said(fam.sheets[0])), "a daughter called Honey and a dog called Dear are on her pages");
  ok(life.problems.length === 0 && whoIs.problems.length === 0 && fam.problems.length === 0, `and their names are not mistaken for baby talk (${life.problems.concat(whoIs.problems, fam.problems).slice(0, 2).join("; ")})`);
  ok(E.toneProblems("Good job, honey").length === 1 && E.validate([{ title: "Good job, honey", blocks: [] }], E.normalize(p)).length >= 1, "while the same word in Cognicopia's own sentence is still refused"); }
/* my work */
{ const r = gen(dot(1), "mytrade", 2), t = r.sheets.map(said).join(" || ");
  ok(/My work: the classroom/.test(t) && /Chalk|Globe|Grade book|Pointer|Red pencil|Hand bell/.test(t), "a teacher's work page is about the classroom and its tools");
  const pairs = r.sheets[0].blocks.find(b => b.kind === "pairs"), uses = Object.fromEntries(D.TRADES.teacher.tools);
  ok(pairs && pairs.left.every(x => uses[x]) && JSON.stringify(pairs.right.slice().sort()) === JSON.stringify(pairs.left.map(x => uses[x]).sort()) && r.sheets[0].keyLines.every(k => { const [a, b] = k.split(": "); return uses[a] === b; }), "the jobs on the right are the jobs of the tools on the left, and the key for staff pairs them truly");
  for (const v of VOC) ok(gen(Object.assign(dot(1), { vocation: v }), "mytrade", 2).sheets.every(sh => sh.title === "My work: " + D.TRADES[v].place && sh.personal), `${v}: the work page is about ${D.TRADES[v].place}`);
  const g = all(Object.assign(dot(1), { vocation: "" }), "mytrade", 1);
  ok(/My work/.test(g) && !/classroom|Chalk/.test(g), "with no work chosen the page asks about a working life and names no trade"); }
/* where I come from */
{ const r = gen(dot(1), "hometown", 2), sights = D.REGIONS["mountain-west"].sights, tastes = D.REGIONS["mountain-west"].tastes;
  ok(r.sheets[0].title === "Scobey" && /Tell me about Scobey\./.test(said(r.sheets[0])), "her hometown page is titled with the town and asks about it by name");
  ok(r.sheets[0].blocks.find(b => b.kind === "choices").options.every(o => sights.includes(o)) && r.sheets[1].blocks.find(b => b.kind === "choices").options.every(o => tastes.includes(o)), "its choices are the sights, then the tastes, of the Mountain West");
  ok(gen(dot(1, "steady", { place: "Scobey, MT" }), "hometown", 1).sheets[0].blocks.find(b => b.kind === "choices").options.every(o => sights.includes(o)), "a state written as two letters places the town the same way");
  ok(gen(dot(1, "steady", { place: "Duluth, Minnesota" }), "hometown", 1).sheets[0].blocks.find(b => b.kind === "choices").options.every(o => D.REGIONS.midwest.sights.includes(o)), "a town in Minnesota gets the Midwest's sights");
  const n = gen(nobody(1), "hometown", 1).sheets[0];
  ok(n.title === "Where I come from" && n.personal === false && n.blocks.find(b => b.kind === "choices").options.every(o => D.ANYWHERE.sights.includes(o)), "with no hometown the page asks about the place they grew up and offers what any hometown has");
  ok(gen(dot(3), "hometown", 1).sheets[0].blocks.find(b => b.kind === "choices").options.length === 2, "the late stage offers two choices"); }
/* songs of my years */
{ const r = gen(dot(1), "songs", 4), items = r.sheets.flatMap(sh => (sh.blocks.find(b => b.kind === "list") || { items: [] }).items);
  ok(r.sheets[0].subtitle === "1953 to 1963" && items.length >= 8, `her songs are from 1953 to 1963 (${r.sheets[0].subtitle}, ${items.length} listed)`);
  ok(items.every(x => /^.+, .+ \((19\d\d)\)$/.test(x)), "each is a title, an artist and a year");
  ok(items.every(x => { const y = Number(/\((\d{4})\)$/.exec(x)[1]); return y >= 1949 && y <= 1967; }), "and each year is one she was young in");
  ok(/Patsy Cline/.test(r.sheets[0].blocks.find(b => b.kind === "list").items[0]), `a favorite artist from her profile leads the list (${r.sheets[0].blocks.find(b => b.kind === "list").items[0]})`);
  const late = gen(dot(3), "songs", 2).sheets[0];
  ok(late.blocks.length === 1 && late.blocks[0].kind === "prompt" && /Let's listen together/.test(late.blocks[0].sub), "the late stage is one song, to listen to together");
  /* a song's words are never printed by these pages: every line of the list is a title, an artist and a year, and none of the
     song lines the Studio does print elsewhere (the public-domain ones) turns up here */
  const leads = E.PUBLIC_DOMAIN.lyrics.map(l => String(l[0]).toLowerCase()); let words = 0;
  for (const stage of [1, 2, 3]) for (const seed of [1, 2, 3]) { const t = all(dot(stage), "songs", 4, seed).toLowerCase(); if (leads.some(l => t.includes(l))) words++; }
  ok(leads.length >= 8 && words === 0 && items.every(x => x.length < 90), "no page prints a song's words, only its title, artist and year");
  /* a song tied to a topic to avoid is left out for a resident who avoids that topic */
  let seen = false; for (const seed of [1, 2, 3, 4, 5, 6]) if (/Boogie Woogie Bugle Boy/.test(all(dot(1, "steady", { born: 1921 }), "songs", 4, seed))) seen = true;
  let leaked = false; for (const seed of [1, 2, 3, 4, 5, 6]) if (/Boogie Woogie Bugle Boy/.test(all(dot(1, "steady", { born: 1921, topics: [{ code: "war", label: "War and combat" }] }), "songs", 4, seed))) leaked = true;
  ok(seen && !leaked, "a wartime song appears for someone born in 1921, and not when war is a topic to avoid"); }
/* the year I turned twenty */
{ const r = gen(dot(1), "twenty", 2), sh = r.sheets[0], says = Object.fromEntries(D.SAYINGS[1950]);
  ok(sh.title === "The year I turned twenty" && sh.subtitle === "1958", `her page is for 1958 (${sh.subtitle})`);
  ok(sh.blocks[0].kind === "moments" && sh.blocks[0].items.length >= 3 && sh.blocks[0].items.every(e => Math.abs(e.year - 1958) <= 6) && sh.blocks[0].items.every((e, i, a) => !i || a[i - 1].year <= e.year), "the news is from within a few years of it, in order");
  const pr = sh.blocks.find(b => b.kind === "pairs");
  ok(pr && pr.left.every(x => says[x]) && JSON.stringify(pr.right.slice().sort()) === JSON.stringify(pr.left.map(x => says[x]).sort()), "the sayings are the 1950s', each with its own meaning somewhere on the right");
  const n = gen(nobody(1), "twenty", 1).sheets[0];
  ok(n.title === "When I was about twenty" && n.subtitle === "The 1950s" && n.personal === false, "with no birth year the page is about the decade chosen and does not claim a year"); }
/* then and now */
{ const r = gen(nobody(1), "thennow", 3), now = Object.fromEntries(D.THEN_NOW.map(x => [x[0], x[1]]));
  ok(r.sheets.every(sh => { const p = sh.blocks.find(b => b.kind === "pairs"); return p.left.every(x => now[x]) && JSON.stringify(p.right.slice().sort()) === JSON.stringify(p.left.map(x => now[x]).sort()); }), "each old thing's new thing is somewhere on the right");
  ok(r.sheets.every(sh => sh.blocks.filter(b => b.kind === "picture").every(b => assetIds.has(b.pic))), "a picture on the page is a finished drawing from the library");
  let pic = 0; for (const seed of [1, 2, 3, 4, 5, 6]) if (gen(nobody(1), "thennow", 3, seed).sheets.some(sh => sh.blocks.some(b => b.kind === "picture"))) pic++;
  ok(pic >= 3, `an early page often carries the drawing of the old thing (${pic} of 6 sets)`); }
/* my day */
{ const r = gen(nobody(2), "myday", 2), order = k => D.DAY[k].steps;
  ok(r.sheets[0].title === "My morning" && r.sheets[1].title === "My evening", "a morning page, then an evening page");
  for (const [i, k] of [[0, "morning"], [1, "evening"]]) { const steps = r.sheets[i].blocks.find(b => b.kind === "steps").items;
    ok(steps.every((s, j) => order(k).includes(s) && (!j || order(k).indexOf(steps[j - 1]) < order(k).indexOf(s))) && steps[0] === order(k)[0] && steps[steps.length - 1] === order(k)[order(k).length - 1], `the ${k}'s steps are in the day's own order, first to last`); }
  ok(gen(nobody(3), "myday", 1).sheets[0].blocks.find(b => b.kind === "steps").items.length === 3, "the late stage has three steps"); }
/* a dish I made */
{ const own = { name: "Rhubarb pie", ingredients: "rhubarb, sugar, flour, butter", steps: ["Roll the crust", "Fill with rhubarb", "Bake until it bubbles"] };
  const r = gen(dot(1, "steady", { dish: own }), "dish", 2), t = said(r.sheets[0]);
  ok(r.sheets[0].title === "Rhubarb pie" && r.sheets[0].personal === true && /A dish from my own kitchen/.test(t) && /Fill with rhubarb/.test(t), "her own dish from her profile is the first page, in her own steps");
  ok(r.sheets[1].personal === false && D.DISHES.some(d => d.name === r.sheets[1].title), "the next page is a dish many kitchens knew");
  ok(D.DISHES.filter(d => d.regions.includes("mountain-west")).map(d => d.name).includes(gen(dot(1), "dish", 1).sheets[0].title), "with no dish in the profile, a dish at home in her part of the country comes first");
  const bare = gen(dot(1, "steady", { dish: { name: "Aunt May's soup" } }), "dish", 1).sheets[0];
  ok(bare.title === "Aunt May's soup" && bare.blocks.filter(b => b.kind === "write").length === 2, "a dish known only by name leaves lines to write what goes in and how it is made"); }
/* what I would like */
{ const r = gen(dot(2, "steady", { comforts: [{ code: "a", label: "The porch swing" }, { code: "b", label: "Peppermint tea" }, { code: "c", label: "The radio on low" }] }), "comfort", 2);
  ok(r.sheets[0].subtitle === "Things I like" && r.sheets[0].blocks[0].options.includes("The porch swing") && r.sheets[0].personal, "her own comforts from her profile are the first page");
  ok(D.COMFORTS.some(g => g.label === r.sheets[1].subtitle), "then the kinds of comfort anyone might choose");
  ok(gen(nobody(3), "comfort", 5).sheets.every(sh => sh.blocks.length === 1 && sh.blocks[0].options.length === 2), "the late stage is two large choices and nothing else on the page"); }
/* word play */
{ const r = gen(dot(1), "wordplay", 6), kinds = r.sheets.map(sh => sh.blocks[0].kind);
  ok(kinds.includes("pairs") && kinds.includes("blanks") && kinds.includes("ladder"), `an early packet turns between joining words, a story with gaps and a ladder (${kinds.join(", ")})`);
  const ladder = r.sheets.find(sh => sh.blocks[0].kind === "ladder"), last = ladder.blocks[0].rungs.slice(-1)[0].word;
  ok(["BAKE", "CAKE", "ROSE"].includes(last) && ladder.personal === true, `a gardener who bakes gets a ladder that ends on a word of her own (${last})`);
  const story = r.sheets.find(sh => sh.blocks[0].kind === "blanks");
  ok(story.blocks[0].items.some(x => /perhaps (Sarah|Scobey|Tennessee Waltz|Buster)/.test(x)) && /\(1\)/.test(story.blocks[1].text), `a story's gaps offer ideas from her own life (${story.blocks[0].items.join("; ")})`);
  const joined = new Set(D.COMPOUNDS.map(x => (x[0] + x[1]).toUpperCase())), comp = r.sheets.find(sh => sh.blocks[0].kind === "pairs");
  ok(comp.keyLines.every(k => joined.has(k)) && comp.blocks[0].left.length === comp.blocks[0].right.length, "the key for staff lists the joined words");
  ok(gen(nobody(2), "wordplay", 4).sheets.every(sh => sh.blocks[0].kind === "pairs" && sh.blocks[0].left.length === 3), "the middle stage keeps to joining three pairs of words"); }

/* =================================================== topics to avoid =================================================== */
{ const topics = ["water", "storms", "medical", "children", "religion", "money", "driving"].map(c => ({ code: c, label: c })), words = R.avoidWords({ topics }), hit = R.avoidMatcher(words);
  let leaks = 0, checked = 0; const first = [];
  for (const id of LIFE) for (const stage of mods.find(m => m.id === id).stages) for (const seed of [1, 7]) {
    const p = dot(stage, "steady", { topics }); p.vocation = id === "mytrade" ? "nurse" : "teacher";
    const r = gen(p, id, 6, seed); if (r.problems.length) { leaks++; if (first.length < 3) first.push(id + ": " + r.problems[0]); }
    for (const sh of r.sheets) for (const pg of pagesOf(sh)) for (const op of pg.ops) if (op.t === "text" && op.role !== "code" && op.role !== "staff") { checked++; const h = hit(op.str); if (h.length) { leaks++; if (first.length < 3) first.push(id + ": " + op.str); } }
  }
  ok(checked > 2000 && leaks === 0, `with seven topics to avoid, none of their ${words.length} words is on any page (${checked} lines read; ${leaks} leaks: ${first.join(" / ")})`);
  ok(gen(Object.assign(dot(1, "steady", { topics: [{ code: "medical", label: "m" }] }), { vocation: "nurse" }), "mytrade", 1).sheets[0].blocks.every(b => !JSON.stringify(b).match(/Stethoscope|Thermometer/)), "a nurse who avoids medical topics gets no stethoscope on her work page"); }

/* =================================================== the suggested packet =================================================== */
ok(JSON.stringify(E.lifePagesFor(dot(1))) === JSON.stringify(["lifestory", "generations", "mytrade", "hometown", "songs", "twenty", "whoswho"]), `an early profile with a birth year, a town, work and family suggests the pages it can make its own (${E.lifePagesFor(dot(1)).join(", ")})`);
ok(E.lifePagesFor(nobody(1)).length === 0 && E.lifePagesFor(nobody(2)).length === 0 && JSON.stringify(E.lifePagesFor(nobody(3))) === JSON.stringify(["comfort"]), "with no profile nothing personal is suggested (the late stage's comfort page needs no profile)");
ok(E.lifePagesFor(dot(3)).slice(0, 2).join() === "whoswho,comfort" && E.lifePagesFor(dot(3)).every(id => mods.find(m => m.id === id).stages.includes(3)), "a late profile is offered only pages made for the late stage");

/* =================================================== wiring =================================================== */
{ const html = read("activity-studio.html"), order = ["js/residentContext.js", "assets/services/reminiscenceEngine.js", "js/generators/activity-engine.js", "js/generators/coloring-pipeline.js", "js/generators/activity-modules.js", "js/generators/activity-pages.js", "js/generators/activity-life-data.js", "js/generators/activity-life.js", "components/packet-generator-ui.js"];
  const at = order.map(f => html.indexOf('<script src="' + f + '">'));
  ok(at.every(i => i > 0) && at.every((i, k) => !k || at[k - 1] < i), "the Studio page loads the files in the order they need each other");
  const sw = read("sw.js"), po = read("js/utils/print-optimizer.js");
  ok(["js/generators/activity-life-data.js", "js/generators/activity-life.js", "assets/services/reminiscenceEngine.js"].every(f => sw.includes('"' + f + '"') && po.includes('"' + f + '"')), "the service worker and the Studio's offline list keep the new files");
  ok(LIFE.every(id => FV.DOMAIN[id]), "the facility validator knows which kind of engagement each is");
  for (const f of ["js/generators/activity-life-data.js", "js/generators/activity-life.js"]) ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB|https?:\/\//i.test(read(f)), f + " reaches no network and keeps nothing");
}

console.log(problems.length ? `life pages check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 40).join("\n  - ")
  : `life pages check passed: ${passed} checks (twelve kinds of page about one person: ${made} pages at every stage and hand, with a profile and without; the data; what a profile makes personal; topics and people left out; no song words; offline)`);
process.exit(problems.length ? 1 : 0);
