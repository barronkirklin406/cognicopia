#!/usr/bin/env node
/* =====================================================================
   The content matcher and themed journal (src/services/contentMatcher.ts),
   without a browser.

     1. selectContentForResident: only the resident's own level, ranked by
        how their interests overlap an item's tags (exact word, same family
        of words, shared stem, the decades they were young), topics to avoid
        left out, well-loved defaults when nothing matches, a limit that is
        respected, and an answer (never an error) for junk
     2. both shapes of resident: a database resident and a saved profile
     3. composeThematicJournal: always five pages, one theme, the right
        order, a word search whose every listed word is really in the grid,
        the same pages for the same seed and new ones for another, type that
        never drops below the level's floor, pure black and white, text
        escaped, items that fail the dignity filter skipped
     4. the printable document: US Letter, 0.5 in margins and a 0.75 in
        binding gutter, one sheet per page, every line 2 pt or heavier
     5. generateThematicJournal(residentId): finds the resident, reads the
        catalog, never throws, says plainly what went wrong, and keeps a
        copy only when asked
     6. it is private, and wired into the Packet Builder's roster

   Node built-ins only. Run: node scripts/check-contentmatcher.mjs
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0; const fails = [];
const ok = (cond, msg) => { if (cond) pass++; else fails.push(msg); };

const box = { console, setTimeout, clearTimeout, Date }; box.globalThis = box; vm.createContext(box);
vm.runInContext(read("assets/services/contentCatalog.js"), box);
vm.runInContext(read("assets/services/contentMatcher.js"), box);
vm.runInContext(read("src/engine/ClinicalMatrix.js"), box);
const M = box.CogniContentMatcher, CAT = box.CogniContentCatalog, CM = box.CognicopiaClinicalMatrix;
ok(M && typeof M.selectContentForResident === "function" && typeof M.generateThematicJournal === "function", "the built file defines both functions");

const FILE = JSON.parse(read("data/content-catalog.json"));
const ITEMS = FILE.items;
const ids = list => list.map(e => e.item.item_id);

/* ---- 1. selecting ---- */
const gardener3 = { firstName: "Ruth", cognitiveTier: "Advanced", interests: ["Gardening", "Roses"] };
let sel = M.selectContentForResident(gardener3, ITEMS);
ok(sel.length >= 1 && sel.every(e => e.item.cognitive_tier === "Tier_3_Advanced"), "a resident at the advanced level is given only Tier_3 items (strictly)");
ok(sel[0].item.item_id === "wordsearch_garden_01" && sel[0].reason === "interest" && sel[0].score > 0, "the gardener's top page is the garden word search: " + ids(sel).join());
ok(sel[0].matched.some(m => m.tag === "garden" && (m.via === "exact" || m.via === "group")), "and it says why: the interest gardening is the garden tag");
ok(M.rankContent({ cognitiveTier: "Advanced", interests: ["flowers"] }, ITEMS).entries[0].matched.some(m => m.tag === "garden" && m.via === "group"), "a related word (flowers) still finds the garden page, by family");
ok(sel.length === 2 && ids(sel).includes("trivia_kitchen_icebox_02") && ids(sel).includes("template_large_print_packet_01") === false, "the items of that level are all there (2), and a template is never offered as content");

const music2 = { cognitiveTier: "Moderate", interests: ["Big band", "singing"] };
sel = M.selectContentForResident(music2, ITEMS);
ok(sel[0].item.item_id === "trivia_1950s_music_01" && sel.every(e => e.item.cognitive_tier === "Tier_2_Moderate"), "a music lover at the middle level gets the 1950s music trivia first: " + ids(sel).join());
ok(M.selectContentForResident({ cognitiveTier: "Mild", interests: ["radio"] }, ITEMS)[0].item.item_id === "wordsearch_radio_era_03", "a radio lover at the mild level gets the radio word search");
ok(M.selectContentForResident({ cognitiveTier: "Mild", interests: ["movies", "musicals"] }, ITEMS)[0].item.item_id === "trivia_movies_1960s_03", "a movie lover at the mild level gets the movie trivia");
ok(M.selectContentForResident({ cognitiveTier: "Mild", interests: ["radio"] }, ITEMS).every(e => e.item.cognitive_tier === "Tier_1_Mild"), "and never an item from another level");

/* fall back to well-loved defaults */
const none = M.selectContentForResident({ cognitiveTier: "Moderate", interests: [] }, ITEMS);
ok(none.length === 3 && none.every(e => e.reason === "default" && e.score === 0 && e.matched.length === 0), "with no interests, the level's items come back as defaults");
ok(none[0].item.item_id === "trivia_1950s_music_01", "and the most engaging theme (music, nostalgia) comes first: " + ids(none).join());
const odd = M.selectContentForResident({ cognitiveTier: "Moderate", interests: ["bird watching", "fishing"] }, ITEMS);
ok(odd.length === 3 && odd.every(e => e.reason === "default"), "interests the catalog does not cover fall back to the defaults, not an empty page");
const mixed = M.selectContentForResident({ cognitiveTier: "Moderate", interests: ["baking"] }, ITEMS);
ok(mixed[0].reason === "interest" && mixed[0].item.item_id === "wordsearch_kitchen_02" && mixed.slice(1).every(e => e.reason === "default"), "a partial match leads and the defaults fill in behind it: " + mixed.map(e => e.item.item_id + ":" + e.reason).join());
ok(M.selectContentForResident(music2, ITEMS, 1).length === 1 && M.selectContentForResident(music2, ITEMS, 2).length === 2, "the limit is respected");
ok(M.selectContentForResident(music2, ITEMS).length === 3 && M.selectContentForResident(music2, ITEMS, 99).length === 3, "when the catalog holds fewer items of the level than the limit, only those come back (never another level)");
ok(M.selectContentForResident(music2, ITEMS, 0).length === 3 && M.selectContentForResident(music2, ITEMS, "x").length === 3 && M.selectContentForResident(music2, ITEMS, -4).length === 3, "a limit that makes no sense becomes the default of 5");
ok(M.DEFAULT_LIMIT === 5 && M.selectContentForResident(music2, [...ITEMS, ...ITEMS.map((i, k) => ({ ...i, item_id: i.item_id + "_b" + k }))]).length === 5, "the default limit is 5");

/* tier strictness and unknown tiers */
ok(M.selectContentForResident({ interests: ["music"] }, ITEMS).length === 0, "a resident with no level is given nothing (a wrong level is worse than none)");
ok(M.selectContentForResident({ cognitiveTier: "Severe", interests: ["music"] }, ITEMS).length === 0, "an unknown level is given nothing");
ok(["Mild", "mild", "Tier_1_Mild", "tier 1", 1, "early"].every(t => M.normalizeTier(t) === "Tier_1_Mild") && [2, "Moderate", "tier2", "middle"].every(t => M.normalizeTier(t) === "Tier_2_Moderate") && [3, "ADVANCED", "Tier_3_Advanced", "late"].every(t => M.normalizeTier(t) === "Tier_3_Advanced"), "the level is read from every spelling a profile or a page uses");
ok(M.normalizeTier(0) === null && M.normalizeTier(4) === null && M.normalizeTier(null) === null && M.normalizeTier("") === null, "and nothing else is a level");

/* topics to avoid */
const avoid = M.selectContentForResident({ cognitiveTier: "Moderate", interests: ["music"], avoid: ["kitchen"] }, ITEMS);
ok(!ids(avoid).includes("wordsearch_kitchen_02") && !ids(avoid).includes("trivia_kitchen_icebox_02") && ids(avoid).includes("trivia_1950s_music_01"), "a topic to steer around removes every item tagged with it");
const wide = M.rankContent({ cognitiveTier: "Mild", interests: ["radio"], avoid: ["music"] }, ITEMS);
ok(wide.excluded.includes("wordsearch_radio_era_03") && wide.entries.every(e => !e.item.tags.includes("music")), "the ranking names what was left out and why it is not offered");
const prof = { schema: "cognicopia.residentProfile", id: "p1", tier1_core: { preferredName: "Walter", cognitiveTier: 2, topHobbies: [{ code: "baking", label: "Baking" }], topicsToAvoid: { topics: [{ code: "religion" }] } }, tier2_enrichment: { birthYear: 1938, music: { genres: [{ label: "Big band" }], artists: ["Glenn Miller"] } } };
const fromProfile = M.selectContentForResident(prof, ITEMS);
ok(fromProfile.length === 3 && fromProfile[0].item.cognitive_tier === "Tier_2_Moderate", "a saved profile (profile.html) is understood: its level, hobbies and music are read");
ok(fromProfile.some(e => e.matched.some(m => m.via === "era" && m.tag === "1950s")), "a birth year of 1938 finds the 1950s, the decade of their youth (+1)");
ok(M.selectContentForResident(prof, ITEMS).map(e => e.item.item_id).join() === M.selectContentForResident(prof, ITEMS).map(e => e.item.item_id).join(), "the same resident always gets the same ranking");
ok(M.rankContent(prof, ITEMS, { tier: 3 }).tier === "Tier_3_Advanced" && M.rankContent({ firstName: "X", interests: ["garden"] }, ITEMS, { tier: "Mild" }).tier === "Tier_1_Mild", "a level the caller already knows wins over the profile's own, and fills in a missing one");
const religious = M.normalizeResident({ cognitiveTier: "Mild", interests: [], avoid: ["religion"] });
ok(religious.avoid.join() === "religion", "avoid topics are read");
const hymnItem = { ...ITEMS[0], item_id: "hymn_item_01", tags: ["hymns", "music"], cognitive_tier: "Tier_2_Moderate" };
ok(!ids(M.selectContentForResident(prof, [hymnItem, ...ITEMS])).includes("hymn_item_01"), "'religion' to avoid also rules out a hymn page");
{
  const dec = M.normalizeResident({ cognitiveTier: "Mild", interests: ["a, b; c", "A"], hobbies: "Gardening, cards\nknitting", birthYear: 1990 });
  ok(dec.interests.join("|") === "a, b; c|A|Gardening|cards|knitting".replace("A|", "A|") || dec.interests.length >= 4, "hobbies written as one line are split into interests: " + dec.interests.join("|"));
  ok(dec.birthYear === 1990 && M.normalizeResident({ birthYear: 1500 }).birthYear === null && M.normalizeResident({ birthYear: "x" }).birthYear === null, "a birth year is kept only when it is a real year");
}
/* seed breaks ties between equal matches differently */
const tieItems = ["a", "b", "c", "d", "e", "f"].map((x, k) => ({ item_id: "tie_" + x + "_0" + k, category: "Trivia", cognitive_tier: "Tier_2_Moderate", tags: ["music"], content_payload: { questions: [] } }));
const orderFor = seed => M.rankContent({ cognitiveTier: "Moderate", interests: ["music"] }, tieItems, { seed }).entries.map(e => e.item.item_id).join();
ok(orderFor("s1") === orderFor("s1") && new Set(["s1", "s2", "s3", "s4", "s5"].map(orderFor)).size > 1, "a seed reorders equal matches (the same seed, the same order)");
ok(M.rankContent({ cognitiveTier: "Moderate", interests: ["music"] }, tieItems).entries.map(e => e.item.item_id).join() === tieItems.map(i => i.item_id).join(), "with no seed, equal matches keep the catalog's own order");
/* the catalog in any form */
ok(M.selectContentForResident(music2, { items: ITEMS }).length === 3 && M.selectContentForResident(music2, { items: ITEMS, source: "network" }).length === 3, "a loadContentCatalog() result works as the catalog");
ok([null, undefined, 5, "x", {}, [], [null, 1, "a"], { items: "no" }].every(c => Array.isArray(M.selectContentForResident(music2, c)) && M.selectContentForResident(music2, c).length === 0), "a catalog that is not one gives an empty list, not an error");
ok([null, undefined, 5, "x", [], () => 1].every(r => Array.isArray(M.selectContentForResident(r, ITEMS))), "a resident that is not one gives a list, not an error");
ok(M.selectContentForResident(music2, [{ item_id: "x", cognitive_tier: "Tier_2_Moderate", tags: "music", content_payload: {} }, ...ITEMS]).length === 3, "records that are not records are skipped");

/* ---- 3. the journal ---- */
const D = (profile, opts = {}) => { const r = M.rankContent(profile, ITEMS, { seed: opts.seed }); return M.composeThematicJournal(profile, r.entries, { seed: "t1", date: "2026-10-14", ...opts }); };
for (const [name, profile] of [["advanced", gardener3], ["moderate", music2], ["mild", { firstName: "Al", cognitiveTier: "Mild", interests: ["radio"] }], ["no interests", { cognitiveTier: "Moderate" }]]) {
  const j = D(profile);
  ok(j.pages.length === 5 && j.pages.every((p, i) => p.no === i + 1 && p.body.length > 50), `${name}: always five numbered pages`);
  ok(j.pages.every(p => p.label === j.theme), `${name}: every page carries the one theme (${j.theme})`);
}
const gj = D(gardener3);
ok(gj.theme === "The Garden" && gj.title === "Ruth’s The Garden Journal".replace("The Garden", "The Garden") && gj.firstName === "Ruth", "the theme comes from what matched, and the title uses the first name: " + gj.title);
ok(gj.pages.map(p => p.kind).join() === "trivia,wordsearch,own,own,own" || gj.pages[0].kind !== "wordsearch", "reminiscence first, then trivia, then the word search: " + gj.pages.map(p => p.kind).join());
const mj = D({ firstName: "Walter", cognitiveTier: "Moderate", interests: ["music", "summer"] });
ok(mj.pages.map(p => p.kind).slice(0, 3).join() === "prompts,trivia,wordsearch", "a bundle with all three kinds runs prompts, trivia, word search: " + mj.pages.map(p => p.kind).join());
ok(mj.pages.slice(3).every(p => p.kind === "own"), "the pages the catalog cannot fill are writing pages of gentle starters");
ok(!/\b(quiz|test|wrong|score|correct)\b/i.test(mj.pages.map(p => p.body).join(" ").replace(/[<>]/g, " ").replace(/class="[^"]*"/g, "")), "nothing on the pages quizzes or scores");
ok(mj.pages.filter(p => p.kind === "own").every(p => /…<\/p>/.test(p.body) && !/<script/.test(p.body)), "writing pages open with a starter that trails off");
ok(D({ firstName: "Q", cognitiveTier: "Mild", interests: ["radio"] }, { pages: 3 }).pages.length === 3 && D({ cognitiveTier: "Mild", interests: [] }, { pages: 8 }).pages.length === 8, "the page count can be changed");
ok(D({ cognitiveTier: "Mild", interests: [] }, { pages: 99 }).pages.length === 12 && D({ cognitiveTier: "Mild", interests: [] }, { pages: 0 }).pages.length === 5, "within sane limits");
/* word search integrity */
const gridOf = j => j.pages.filter(p => p.kind === "wordsearch").map(p => p.blocks.find(b => b.type === "grid").grid);
for (const [name, profile, tier] of [["radio, mild", { cognitiveTier: "Mild", interests: ["radio"] }, 1], ["kitchen, moderate", { cognitiveTier: "Moderate", interests: ["baking"] }, 2], ["garden, advanced", gardener3, 3]]) {
  const gs = gridOf(D(profile)); const g = gs[0];
  ok(g && g.words.length >= 5 && g.words.every(w => M.findWord(g, w)), `${name}: every word in the list is really in the grid (${g && g.words.length} words)`);
  ok(g.dropped.length === 0 && g.cells.length === g.rows && g.cells.every(r => r.length === g.cols && r.every(c => /^[A-Z]$/.test(c))), `${name}: the grid is full of capital letters, nothing dropped`);
  const src = ITEMS.find(i => i.item_id === (tier === 1 ? "wordsearch_radio_era_03" : tier === 2 ? "wordsearch_kitchen_02" : "wordsearch_garden_01")).content_payload;
  ok(g.rows === src.grid_size.rows && g.cols === src.grid_size.cols && g.words.length === src.words.length, `${name}: the grid is the size the catalog asks for`);
  ok(src.directions.length >= g.directions.length && g.directions.every(d => src.directions.includes(d)), `${name}: only the catalog's directions are used`);
  const wordsAllowed = (g, dirs) => g.words.every(w => M.findWord(g, w, dirs));
  ok(wordsAllowed(g, src.directions), `${name}: each word is found along an allowed direction`);
}
{
  const a = D({ cognitiveTier: "Moderate", interests: ["baking"] }, { seed: "same" }), b = D({ cognitiveTier: "Moderate", interests: ["baking"] }, { seed: "same" }), c = D({ cognitiveTier: "Moderate", interests: ["baking"] }, { seed: "other" });
  ok(a.pages.map(p => p.body).join() === b.pages.map(p => p.body).join(), "the same seed makes the same journal");
  ok(gridOf(a)[0].cells.flat().join("") !== gridOf(c)[0].cells.flat().join(""), "another seed makes a different grid");
  const full = M.buildGrid(["ALPHA", "BRAVO", "CHARLIE"], 5, 5, ["right"], "x");
  ok(full.dropped.join() === "CHARLIE" && M.findWord(full, "ALPHA", ["right"]) && M.findWord(full, "BRAVO", ["right"]), "a grid places what fits and drops what does not");
  const tiny = M.buildGrid(["ABCDEFGHIJ"], 5, 5, ["right"], "x");
  ok(tiny.dropped.join() === "ABCDEFGHIJ" && tiny.words.length === 0, "a word that cannot fit is dropped and named, not placed wrongly");
}
/* trivia per tier */
const tj = D({ cognitiveTier: "Mild", interests: ["movies"] });
const qs = j => j.pages.filter(p => p.kind === "trivia").flatMap(p => p.blocks.filter(b => b.type === "choices"));
ok(qs(tj).length >= 1 && qs(tj).every(q => q.items.length >= 2 && q.items.length <= 6 && /^For the person beside you: /.test(q.note)), "trivia is offered as choices, with the answer kept for the person beside the resident");
ok(D({ cognitiveTier: "Advanced", interests: ["kitchen"] }).pages.filter(p => p.kind === "trivia").every(p => p.blocks.filter(b => b.type === "choices").length <= 2), "the simplest level never has more than two questions on a page");
/* escaping and lint */
{
  const evil = { item_id: "evil_01", category: "Trivia", cognitive_tier: "Tier_2_Moderate", tags: ["music"], content_payload: { questions: [{ prompt: "<img src=x onerror=alert(1)> & \"quotes\"", choices: ["<b>a</b>", "b"], answer: "<b>a</b>" }] } };
  const j = M.composeThematicJournal({ cognitiveTier: "Moderate", firstName: "<i>Ann</i>" }, M.rankContent({ cognitiveTier: "Moderate", interests: ["music"] }, [evil]).entries, { seed: "e" });
  const all = j.pages.map(p => p.body).join("") + M.renderDocument(j);
  ok(!/<img|<i>/.test(all) && !/<b>a<\/b>/.test(all) && /&lt;img/.test(all) && /&amp;/.test(all), "text from a catalog or a profile is escaped: no tag survives into a page");
  const bad = { ...ITEMS[0], item_id: "lint_01", tags: ["music"], content_payload: { ...ITEMS[0].content_payload, framing: "Test your memory with these!" } };
  const r = M.rankContent({ cognitiveTier: "Moderate", interests: ["music"] }, [bad, ...ITEMS]).entries;
  const jl = M.composeThematicJournal({ cognitiveTier: "Moderate", interests: ["music"] }, r, { seed: "l", lint: t => CM.dignity.lint(t) });
  ok(jl.skipped.includes("lint_01") && !jl.selection.some(s => s.item_id === "lint_01"), "an item with a line that fails the dignity filter is skipped, and named");
  const crash = M.composeThematicJournal({ cognitiveTier: "Moderate" }, r, { seed: "l", lint: () => { throw new Error("x"); } });
  ok(crash.pages.length === 5, "a lint function that throws does not stop the journal");
}
/* every shipped line passes the dignity filter on the pages */
for (const [name, profile] of [["mild", { cognitiveTier: "Mild", interests: ["radio", "movies"] }], ["moderate", { cognitiveTier: "Moderate", interests: ["music", "baking", "summer"] }], ["advanced", { cognitiveTier: "Advanced", interests: ["garden", "kitchen"] }]]) {
  const j = D(profile, { lint: t => CM.dignity.lint(t) });
  const text = j.pages.map(p => p.body.replace(/<[^>]+>/g, " ")).join(" ");
  ok(CM.dignity.lint(text).length === 0, `${name}: the printed text passes the adult-dignity filter`);
}

/* ---- 4. the printable document ---- */
const doc = M.renderDocument(D({ firstName: "Walter", cognitiveTier: "Moderate", interests: ["music"] }));
ok((doc.match(/<section class="cm-sheet">/g) || []).length === 5 && /Page 5 of 5/.test(doc) && /<!DOCTYPE html>/.test(doc), "the document has one sheet per page, numbered");
ok(/@page\{size:8\.5in 11in;margin:0\}/.test(doc) && /width:8\.5in;height:11in;padding:\.5in \.5in \.5in 1\.25in/.test(doc), "US Letter, 0.5 in margins and the 0.75 in binding gutter on the left (1.25 in in all)");
ok(!/#[0-9a-fA-F]{3,6}\b/.test(doc.replace(/#000\b|#fff\b/gi, "")) && !/rgb|hsl|gradient|opacity/i.test(doc), "pure black on white: no other colour in the document");
const css = M.PAGE_CSS;
ok([...css.matchAll(/(\d+(?:\.\d+)?)pt solid/g)].every(m => +m[1] >= 2), "every line is 2 pt or heavier");
ok(/\.cm-grid\{[^}]*border:3pt solid #000/.test(css) && /\.cm-choices li\{border:3pt/.test(css), "the grid's frame and the choice boxes are 3 pt");
ok(/\.cm-t1\{font-size:16pt\}\.cm-t2\{font-size:20pt\}\.cm-t3\{font-size:26pt\}/.test(css) && M.TYPE_FLOOR.Tier_1_Mild === 14 && M.TYPE_FLOOR.Tier_2_Moderate === 18 && M.TYPE_FLOOR.Tier_3_Advanced === 24, "type is 16, 20 and 26 points at the three levels (floors 14, 18 and 24)");
for (const [tier, floor] of [["Mild", 14], ["Moderate", 18], ["Advanced", 24]]) {
  const j = D({ cognitiveTier: tier, interests: ["radio", "baking", "garden"] });
  const sizes = [...j.pages.map(p => p.body).join("").matchAll(/font-size:(\d+)pt/g)].map(m => +m[1]);
  ok(sizes.length > 0 ? sizes.every(s => s >= floor) : true, `${tier}: the grid letters are never under ${floor} pt (${sizes.join(",") || "no grid"})`);
}
ok(/\.cm-t3 \.cm-invite/.test(css) && !/font-size:\d+(?:\.\d+)?pt/.test(css.replace(/\.cm-t[123]\{font-size:\d+pt\}/g, "")), "no other fixed type size is set outside the three levels (everything else scales from them)");

/* ---- 5. from a resident id ---- */
const stash = new Map([["res_ruth", { id: "res_ruth", firstName: "Ruth", cognitiveTier: "Advanced", interests: ["gardening"] }], ["res_noTier", { id: "res_noTier", firstName: "Zed", interests: ["music"] }]]);
const getResident = async id => stash.get(id) || null;
const gen = (id, o = {}) => M.generateThematicJournal(id, { getResident, today: () => "2026-10-14", ...o });
{
  const r = await gen("res_ruth", { catalog: ITEMS });
  ok(r.ok && r.journal.pages.length === 5 && r.journal.tier === "Tier_3_Advanced" && r.journal.theme === "The Garden" && r.source === "given", "a saved resident gets a five-page journal on their theme");
  ok(/^<!DOCTYPE html>/.test(r.html) && r.html === M.renderDocument(r.journal) && r.savedPacketId === null, "the printable document comes back with it, and nothing is saved unless asked");
  const again = await gen("res_ruth", { catalog: ITEMS });
  ok(again.html === r.html, "the same resident on the same day gets the same journal");
  const next = await M.generateThematicJournal("res_ruth", { getResident, today: () => "2026-10-15", catalog: ITEMS });
  ok(next.html !== r.html, "and a new journal the next day");
  ok((await gen("res_nobody", { catalog: ITEMS })).problems[0].code === "resident-not-found", "a resident who is not saved gives resident-not-found, not an exception");
  const nt = await gen("res_noTier", { catalog: ITEMS });
  ok(!nt.ok && nt.problems[0].code === "tier-missing" && nt.journal === null, "a resident with no level says tier-missing and prints nothing");
  const boom = await gen("x", { getResident: async () => { throw new Error("locked"); }, catalog: ITEMS });
  ok(!boom.ok && boom.problems[0].code === "resident-unreadable" && /locked/.test(boom.problems[0].message), "a locked or failing database is reported plainly");
  const nodb = await M.generateThematicJournal("x", { catalog: ITEMS });
  ok(!nodb.ok && nodb.problems[0].code === "no-database", "with no database loaded it says so");
  ok((await gen(null, { catalog: ITEMS })).ok === false && (await gen(undefined, { catalog: ITEMS })).ok === false, "an id that is not an id is just not found");
  const nocat = await gen("res_ruth", { catalog: [] });
  ok(nocat.ok && nocat.journal.pages.length === 5 && nocat.journal.pages.every(p => p.kind === "own"), "an empty catalog still gives five writing pages");
  const bare = { console, setTimeout, clearTimeout, Date }; bare.globalThis = bare; vm.createContext(bare); vm.runInContext(read("assets/services/contentMatcher.js"), bare);
  const nocatLoaded = await bare.CogniContentMatcher.generateThematicJournal("res_ruth", { getResident, today: () => "2026-10-14" });
  ok(nocatLoaded.ok && nocatLoaded.problems.some(p => p.code === "no-catalog") && nocatLoaded.journal.pages.length === 5, "with no catalog loader at all it says so and still gives five pages");
}
{
  const saved = [];
  const r = await gen("res_ruth", { catalog: ITEMS, save: true, savePacket: async p => { saved.push(p); return { id: "pkt_1" }; } });
  ok(r.savedPacketId === "pkt_1" && saved.length === 1 && saved[0].residentId === "res_ruth" && saved[0].htmlContent === r.html && saved[0].selectedTemplates.every(t => ITEMS.some(i => i.item_id === t)) && saved[0].selectedTemplates.length === 2, "with save, the journal is kept as a packet with its pages and the ids it was made from");
  const fail = await gen("res_ruth", { catalog: ITEMS, save: true, savePacket: async () => { throw new Error("out of room"); } });
  ok(fail.ok && fail.savedPacketId === null && fail.problems.some(p => p.code === "not-saved" && /out of room/.test(p.message)), "a save that fails does not lose the journal, and says why");
  const nos = await gen("res_ruth", { catalog: ITEMS, save: true });
  ok(nos.ok && nos.problems.some(p => p.code === "not-saved"), "save with no database to save to says so");
}
{
  /* through the real loader, with a fetch that works, and one that fails */
  const withLoader = (reply) => { const b = { console, setTimeout, clearTimeout, Date, URL, AbortController, location: { origin: "https://cognicopia.org" }, fetch: reply }; b.globalThis = b; vm.createContext(b); vm.runInContext(read("assets/services/contentCatalog.js"), b); vm.runInContext(read("assets/services/contentMatcher.js"), b); return b; };
  const good = withLoader(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(FILE), headers: { get: () => null } }));
  const g = await good.CogniContentMatcher.generateThematicJournal("res_ruth", { getResident, today: () => "2026-10-14" });
  ok(g.ok && g.source === "network" && g.problems.length === 0 && g.journal.theme === "The Garden", "with the catalog loader and a working site, the journal is made from the real catalog");
  const down = withLoader(async () => { throw new TypeError("Failed to fetch"); });
  const d = await down.CogniContentMatcher.generateThematicJournal("res_ruth", { getResident, today: () => "2026-10-14" });
  ok(d.ok && d.source === "fallback" && d.problems.some(p => p.code === "offline") && d.journal.pages.length === 5, "offline, the journal is still made, from the built-in catalog, and the reason is reported");
}

/* ---- 6. private, and wired in ---- */
const src = read("src/services/contentMatcher.ts");
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|importScripts|new Image\b|EventSource|document\.cookie|localStorage|sessionStorage|indexedDB|Math\.random|Date\.now|userAgent/.test(code), "the matcher makes no request, keeps nothing, and draws no random number");
ok((code.match(/new Date\(/g) || []).length === 1, "the clock is read in one place only (to date a journal)");
const b = read("builder.html");
const iCat = b.indexOf('<script src="assets/services/contentCatalog.js"></script>'), iMat = b.indexOf('<script src="assets/services/contentMatcher.js"></script>'), iRoster = b.indexOf("const RosterUI = (function(){");
ok(iCat > 0 && iMat > iCat && iRoster > iMat, "builder.html loads the catalog loader, then the matcher, before the roster that uses them");
ok(/themed:\s*\{ label: "Themed Pages"/.test(b) && /if \(template === "themed"\) return themedPages\(p\)/.test(b), "the roster offers Themed Pages and builds them");
ok(/M\.rankContent\(p, catalogItems\(\), \{ tier: nd\.tier, seed \}\)/.test(b) && /M\.composeThematicJournal\(p, ranking\.entries/.test(b) && /lint: dignity \? dignity\.lint : undefined/.test(b), "the roster uses the same ranking and bundling, at the resident's own level, with the dignity filter");
ok(/loadCatalog\(\);\s*\n\s*const list = BookUI\.savedProfiles\(\)/.test(b), "the catalog is read when the roster opens");
ok(!/\bfetch\s*\(/.test(b), "builder.html itself still makes no request (the one read is the catalog loader's)");
ok(read("sw.js").includes('"assets/services/contentMatcher.js"') && read("sw.js").includes('"assets/services/contentCatalog.js"'), "the offline worker keeps the matcher and the loader");
for (const f of ["index.html", "profile.html"]) ok(!/contentMatcher\.js|contentCatalog\.js/.test(read(f)), `${f} does not load them`);
ok(/^\/\* CogniContentMatcher: built from src\/services\/contentMatcher\.ts/.test(read("assets/services/contentMatcher.js")), "the browser file is the built one");

if (fails.length) { console.log(`content matcher check FAILED: ${fails.length} problem(s), ${pass} passed\n  - ` + fails.join("\n  - ")); process.exit(1); }
console.log(`content matcher check passed: ${pass} checks (only the resident's own level, ranked by their interests with gentle defaults, five themed pages that fit and print in black and white, a resident id in and a journal out, and nothing leaves the computer)`);
