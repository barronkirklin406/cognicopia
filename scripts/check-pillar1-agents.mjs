#!/usr/bin/env node
/* =====================================================================
   js/pillar1-production-agents.js (Agents 5 to 9), in Node.

     variations   one request at L1, L2 and L3: three tiers, each easier than the one before, all pass the audit
     formats      individual, group and express; overrides are used, strangers ignored and listed; express reads
                  nothing personal; a facility's [[tokens]] are filled and none is left; branding is attached safely
     seasons      the season from the date (both hemispheres); holidays on the right days (Thanksgiving, Easter,
                  Mother's Day...); gentle and religious days only when asked; a pack makes working requests
     bulk         one failure never stops the run; cancel, progress and a cap work; a blocked sheet is left out of
                  the printable stack; no error message is copied into a result
     line art     the specification asks for black on white, closed outlines, 3 pt lines, 3:4; the checker accepts a
                  good SVG and refuses gray, thin lines, open shapes, gradients, transparency and a wrong page shape
     pipeline     the five agents plug into the orchestrator, answer the ping, and mark each sheet's analysis
   ===================================================================== */
import { createOrchestrator, assetText } from "../js/agent-orchestrator.js";
import { ClinicalAuditAgent } from "../js/clinical-audit-agent.js";
import { registerReminiscence } from "../js/reminiscence-engine.js";
import { registerPillar1, VariationAgent, FormatAgent, SeasonalPackAgent, BulkCompiler, LineArtPromptArchitect, injectTokens, hasMarkers, difficultyOf, seasonOf, easterOf, HOLIDAYS, LEVELS, CUSTOM_TOKENS, LINE_ART, PILLAR1_AGENTS } from "../js/pillar1-production-agents.js";

let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const make = () => { const o = registerReminiscence(createOrchestrator().use(new ClinicalAuditAgent())); const a = registerPillar1(o, { now: () => new Date(2026, 10, 10) }); return { o, a }; };
const { o, a } = make();
const peggy = { preferredName: "Peggy", formativeEra: "1938", ailmentTier: 1, hobbies: "gardening, old radio music", petNames: "Biscuit", familyNames: "Susan", spouse: "Walter", pastCareer: "schoolteacher", hometown: "Cedar Falls, Iowa" };
const day = (y, m, d) => new Date(y, m - 1, d);

/* ---------- 5. variations ---------- */
const v = await a.variation.generate(o, { profile: peggy, options: { template: "reminiscence" } });
ok(v.order.join() === "L1,L2,L3" && [1, 2, 3].every((t, i) => v["L" + t].tier === t), "L1, L2 and L3 are tiers 1, 2 and 3");
ok(v.monotonic && v.scores.L1 > v.scores.L2 && v.scores.L2 > v.scores.L3, `each level is easier than the one before (${JSON.stringify(v.scores)})`);
ok(["L1", "L2", "L3"].every((k) => v[k].audit.status === "pass" && /Peggy/.test(assetText(v[k].asset))) && v.L1.asset.pages.resident.fontPt < v.L3.asset.pages.resident.fontPt, "every level passes the audit, keeps the resident's name, and the latest level has the biggest print");
const one = await a.variation.generate(o, { profile: peggy }, ["L2"]);
ok(one.order.join() === "L2" && one.L2.tier === 2, "one level can be asked for alone");
let threw = false; try { await a.variation.generate(o, { profile: peggy }, ["L9"]); } catch (e) { threw = e instanceof RangeError; }
ok(threw && LEVELS.L1 === 1, "an unknown level is refused with a plain error");
ok(difficultyOf(null) >= 0 && difficultyOf({}) >= 0, "difficulty of nothing is a harmless number");

/* ---------- 6. formats, overrides, tokens ---------- */
const fa = a.format;
const ind = await fa.make(o, "individual", peggy, { tier: 2, concept: "Garden afternoon", template: "reminiscence", bogus: 1, alsoBogus: 2 });
ok(ind.mode === "individual" && ind.tier === 2 && /Peggy/.test(assetText(ind.asset)) && ind.ignoredOverrides.join() === "bogus,alsoBogus", "an individual sheet uses the tier override and lists the overrides it ignored");
const grp = await fa.make(o, "group", [peggy, Object.assign({}, peggy, { preferredName: "Harold", petNames: "Rex", ailmentTier: 3 })], { template: "reminiscence" });
ok(grp.mode === "group" && grp.tier === 3 && !/Peggy|Harold|Biscuit|Rex/.test(JSON.stringify(grp.asset)), "a group sheet takes the gentlest level and carries no one's name");
const exp = await fa.make(o, "express", Object.assign({}, peggy, { ailmentTier: 2 }), {});
ok(exp.mode === "express" && !/Peggy|Biscuit|Walter|Cedar/.test(JSON.stringify(exp.asset)) && exp.tier === 2, "an express sheet reads nothing personal, even when given a resident");
let bad = []; for (const [f, w] of [["nonsense", peggy], ["group", [peggy]], ["individual", null]]) { try { fa.buildRequest(f, w); bad.push(f); } catch (e) { if (!(e instanceof RangeError)) bad.push(f + "?"); } }
ok(bad.length === 0, "an unknown format, a group of one and an individual with nobody are each refused (" + bad.join(",") + ")");
const av = await fa.make(o, "individual", peggy, { avoid: "Biscuit, radio", template: "reminiscence" });
ok(!/biscuit|radio/i.test(JSON.stringify(av.asset)), "an avoid override keeps those words off the page");
/* tokens */
const o2 = registerReminiscence(createOrchestrator().use(new ClinicalAuditAgent())); registerPillar1(o2);
o2.registerLocalTemplate("welcome", (ctx) => { const base = o2.generator.template("default")(ctx); base.title = "[[facility]] Memory Sheet for [[season]]"; base.pages.caregiver.notes.push("Ask [[director]] about [[unit]] and [[nothing]]."); return base; });
const tk = await o2.execute({ profile: peggy, options: { template: "welcome" }, tokens: { facility: "Maple Grove", season: "autumn", director: "Dana", unit: "the east wing", evil: "x" }, branding: { facilityName: "Maple Grove", headerText: "Activities", logoDataUrl: "data:image/png;base64,AAAA" } });
ok(/Maple Grove Memory Sheet for autumn/.test(tk.asset.title) && /Ask Dana about the east wing and\./.test(JSON.stringify(tk.asset.pages.caregiver.notes)) && !hasMarkers(tk.asset), "[[tokens]] are filled from the request and none is left, an unknown one becomes nothing");
const tk2 = await o2.execute({ profile: peggy, options: { template: "welcome" } });
ok(/Our community Memory Sheet for this time of year/i.test(tk2.asset.title) && !hasMarkers(tk2.asset) && !/[{}]/.test(assetText(tk2.asset)), "with no values given, each token takes a neutral phrase");
ok(tk.asset.branding && tk.asset.branding.facilityName === "Maple Grove" && tk.asset.branding.logoDataUrl === "data:image/png;base64,AAAA", "branding is attached to the sheet");
const tk3 = await o2.execute({ profile: peggy, branding: { facilityName: "<b>X</b>", logoDataUrl: "javascript:alert(1)" } });
ok(tk3.asset.branding.logoDataUrl === "" && !/[<>]/.test(tk3.asset.branding.facilityName), "a logo that is not an image data URL is dropped and markup in a name is removed");
ok(CUSTOM_TOKENS.includes("facility") && injectTokens({ a: ["[[date]]"], grid: ["[[date]]"] }, { date: "Nov 10" }).a[0] === "Nov 10" && injectTokens({ grid: ["[[date]]"] }, {}).grid[0] === "[[date]]", "token injection leaves a word-search grid alone");

/* ---------- 7. seasons and holidays ---------- */
ok([[1, "winter"], [4, "spring"], [7, "summer"], [10, "autumn"], [12, "winter"], [3, "spring"], [9, "autumn"]].every(([m, s]) => seasonOf(day(2026, m, 15)) === s), "the season comes from the month");
ok(seasonOf(day(2026, 7, 15), "south") === "winter" && seasonOf(day(2026, 1, 15), "south") === "summer" && ["winter", "spring", "summer", "autumn"].includes(seasonOf(null)) && ["winter", "spring", "summer", "autumn"].includes(seasonOf("junk")), "the southern hemisphere is the other way round, and a bad date falls back to today");
const iso = (d) => d.toISOString().slice(0, 10), h = (id, y) => iso(HOLIDAYS.find((x) => x.id === id).when(y));
ok(h("thanksgiving", 2026) === "2026-11-26" && h("thanksgiving", 2025) === "2025-11-27" && h("mothers-day", 2026) === "2026-05-10" && h("fathers-day", 2026) === "2026-06-21" && h("memorial-day", 2026) === "2026-05-25" && h("new-year", 2027) === "2027-01-01", "movable holidays fall on the right days");
ok(iso(easterOf(2025)) === "2025-04-20" && iso(easterOf(2026)) === "2026-04-05" && iso(easterOf(2027)) === "2027-03-28" && iso(easterOf(2030)) === "2030-04-21", "Easter is computed correctly for four years");
const sp = a.seasonal;
const up = sp.upcoming(day(2026, 11, 10)); ok(up.length === 1 && up[0].id === "thanksgiving" && up[0].inDays === 16, "ten days into November, Thanksgiving is the next holiday, 16 days away");
ok(sp.upcoming(day(2026, 11, 4)).length === 0 && sp.upcoming(day(2026, 11, 4), { windowDays: 30 })[0].id === "thanksgiving", "outside the window it is not offered, a wider window finds it");
ok(sp.upcoming(day(2026, 5, 1)).length === 0 && sp.upcoming(day(2026, 5, 1), { includeGentle: true })[0].id === "mothers-day", "Mother's Day, which can stir strong feelings, appears only when staff ask");
ok(!sp.upcoming(day(2026, 3, 30)).some((x) => x.id === "easter") && sp.upcoming(day(2026, 3, 30), { includeReligious: true }).some((x) => x.id === "easter") && !sp.upcoming(day(2026, 12, 20)).some((x) => x.id === "christmas") && sp.upcoming(day(2026, 12, 20), { includeReligious: true }).some((x) => x.id === "christmas"), "religious days appear only when staff ask");
ok(sp.upcoming(day(2026, 12, 29)).some((x) => x.id === "new-year" && x.date === "2027-01-01"), "a holiday in early January is found from late December");
const cust = sp.upcoming(day(2026, 11, 10), { customHolidays: [{ name: "Founders Day", date: "2026-11-12", words: "quilt, tea", notes: "A day to remember the neighborhood." }, { name: "", date: "2026-11-12" }, { name: "Bad", date: "nope" }] });
ok(cust.some((x) => x.name === "Founders Day" && x.inDays === 2 && x.words.includes("QUILT")) && cust.length === 2, "a facility's own holiday is added, and a broken one is ignored");
const pack = sp.assemblePack({ date: day(2026, 11, 10), count: 4 });
ok(pack.season === "autumn" && pack.items.length === 4 && pack.requests.length === 4 && pack.items[0].kind === "holiday" && pack.items[0].label === "Thanksgiving" && pack.items.slice(1).every((i) => i.kind === "season"), "a pack for ten days before Thanksgiving starts with it and fills the rest from the season");
ok(new Set(pack.items.map((i) => i.label)).size === 4 && new Set(pack.requests.map((r) => r.deep.variant)).size === 4, "no two sheets in a pack share a title or a version");
const made = await Promise.all(pack.requests.map((r) => o.execute(Object.assign({}, r, { profile: peggy }))));
ok(made.every((r) => r.audit.status !== "blocked" && !hasMarkers(r.asset) && !/[{}]/.test(assetText(r.asset))) && /HARVEST|TURKEY|PIE|FAMILY/.test(JSON.stringify(made[0].asset.pages.resident.blocks.find((b) => b.type === "wordsearch").words)), "each sheet in the pack passes the audit and its word search uses the holiday's words");
const viaReq = await o.execute({ profile: { formativeEra: "1950s", ailmentTier: 1 }, mode: "express", options: { template: "reminiscence" }, seasonal: { date: "2026-04-10" } });
ok(viaReq.mode === "express" && /BLOOM|TULIP|ROBIN|GARDEN|SEEDS|RAIN|KITE|PICNIC/.test(JSON.stringify(viaReq.asset.pages.resident.blocks.find((b) => b.type === "wordsearch").words)), "a request that names a season gets that season's words, even for an express sheet");
const grpSeason = await o.execute({ mode: "group", profiles: [{ formativeEra: "1950s", ailmentTier: 1, hobbies: "gardening" }, { formativeEra: "1950s", ailmentTier: 2, hobbies: "gardening" }], options: { template: "reminiscence" }, seasonal: { date: "2026-12-05" } });
ok(grpSeason.mode === "group" && /SNOW|SCARF|COCOA|WOOL|QUILT|HEARTH|MITTENS|CANDLE|LIGHTS|MUSIC/.test(JSON.stringify(grpSeason.asset.pages.resident.blocks.find((b) => b.type === "wordsearch").words)), "a group sheet may use a season's words");
const avoidSeason = await o.execute({ profile: Object.assign({}, peggy, { avoid: "harvest, pie, turkey" }), options: { template: "reminiscence" }, seasonal: { date: "2026-11-10" } });
ok(!/harvest|turkey|\bpie\b/i.test(JSON.stringify(avoidSeason.asset)), "a seasonal word on the keep-off list is left out");
let t4 = false; try { sp.assemblePack({ date: "not a date" }); } catch (e) { t4 = e instanceof RangeError; }
ok(t4 && sp.assemblePack({ date: day(2026, 1, 20), count: 99 }).items.length === 8 && sp.assemblePack({ date: day(2026, 1, 20), count: 0 }).items.length === 4 && sp.assemblePack({ date: day(2026, 1, 20), count: -3 }).items.length === 1, "a bad date is refused, the pack size is kept between 1 and 8 (none given means four)");

/* ---------- 8. bulk ---------- */
const bulk = a.bulk, reqs = Array.from({ length: 9 }, (_, i) => ({ profile: Object.assign({}, peggy, { preferredName: "Resident" + i }), options: { template: "reminiscence" } }));
reqs.splice(3, 0, { mode: "bogus" });
o.registerLocalTemplate("overclaim", (ctx) => { const b = o.generator.template("default")(ctx); b.pages.caregiver.notes.push("This guarantees a cure and is HIPAA compliant."); return b; });
reqs.splice(5, 0, { profile: peggy, options: { template: "overclaim" } });
const prog = []; const res = await bulk.compile(o, reqs, { onProgress: (p) => { prog.push(p.done); if (p.done === 2) throw new Error("a broken callback"); } });
ok(res.summary.requested === 11 && res.summary.attempted === 11 && res.summary.failed === 1 && res.summary.blocked === 1 && res.summary.made === 10 && res.summary.pass + res.summary.fixed + res.summary.blocked === 10, `a bad request fails alone and a blocked sheet is counted (${JSON.stringify(res.summary)})`);
ok(prog.length === 11 && prog[10] === 11 && res.items.every((x, i) => x.index === i), "progress is reported for every sheet in order, even when the callback breaks");
ok(res.items[3].ok === false && res.items[3].error === "this sheet could not be made" && !/bogus/.test(JSON.stringify(res.items[3])), "a failure is a plain line with no detail copied in");
const st = bulk.printStack(res.items);
ok(st.sheets === 9 && st.pages === 27 && st.left_out === 2 && (st.html.match(/data-page="resident"/g) || []).length === 9 && !/guarantees a cure/.test(st.html), "the printable stack holds nine sheets of three pages; the blocked and the failed are left out");
let n = 0; const cancelled = await bulk.compile(o, reqs, { shouldCancel: () => n++ >= 3 });
ok(cancelled.summary.cancelled && cancelled.items.length === 3, "a run can be cancelled part-way and keeps what it made");
const capped = await new BulkCompiler({ max: 4 }).compile(o, reqs); ok(capped.items.length === 4 && capped.summary.skipped === 7, "a cap on the run is kept and the rest is reported as skipped");
const empty = await bulk.compile(o, null); ok(empty.items.length === 0 && empty.summary.requested === 0 && bulk.printStack(null).sheets === 0, "no requests, or nothing at all, is a harmless empty run");

/* ---------- 9. line art ---------- */
const la = a.lineArt, spec = la.spec({ subject: "a teapot", tier: 3 });
ok(/pure black lines on a pure white background/.test(spec.prompt) && /closed outline/.test(spec.prompt) && /3:4/.test(spec.prompt) && /gray/.test(spec.negativePrompt) && /childish/.test(spec.negativePrompt) && spec.rules.minStrokePt === 3 && spec.rules.closedOutlines && spec.aspect === "3:4" && spec.viewBox === "0 0 600 800", "the specification asks for black on white, closed outlines, 3 pt lines and a 3:4 page, and refuses gray and childish art");
ok(la.spec({ tier: 1 }).rules.maxShapes > la.spec({ tier: 2 }).rules.maxShapes && la.spec({ tier: 2 }).rules.maxShapes > la.spec({ tier: 3 }).rules.maxShapes && la.spec({ tier: 3 }).rules.minShapePx > la.spec({ tier: 1 }).rules.minShapePx, "later stages get fewer, larger shapes");
ok(/piano/.test(la.subjectFor({ preferences: ["old radio music"], anchors: [], career: "" })) && /sunflowers/.test(la.subjectFor({ preferences: ["gardening"], anchors: [], career: "" })) && !/sunflowers/.test(la.subjectFor({ preferences: ["gardening"], anchors: [], career: "" }, ["sunflowers"])) && la.subjectFor({ preferences: [], anchors: [], career: "" }).length > 5, "the subject comes from their interests, honors the keep-off list, and has a default");
const good = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800"><rect x="100" y="100" width="400" height="300" fill="#fff" stroke="#000" stroke-width="4"/><circle cx="300" cy="500" r="80" fill="none" stroke="#000" stroke-width="3pt"/><path d="M100 600 L300 700 L500 600 Z" fill="#ffffff" stroke="black" stroke-width="5" stroke-linejoin="round"/></svg>`;
ok(la.checkSvg(good).ok && la.checkSvg(good).shapes === 3, "a good SVG (black and white, 4 px and 3 pt lines, closed shapes, 3:4) passes");
const variants = [["gray fill", good.replace('fill="#fff"', 'fill="#888"')], ["named color", good.replace('stroke="#000" stroke-width="4"', 'stroke="red" stroke-width="4"')], ["thin line", good.replace('stroke-width="4"', 'stroke-width="2"')], ["no width", good.replace(' stroke-width="4"', "")], ["open path", good.replace(" Z", "")], ["a line element", good.replace("</svg>", '<line x1="0" y1="0" x2="50" y2="50" stroke="#000" stroke-width="4"/></svg>')], ["gradient", good.replace("</svg>", '<defs><linearGradient id="g"/></defs></svg>')], ["transparency", good.replace('fill="#fff"', 'fill="#fff" fill-opacity="0.5"')], ["an image", good.replace("</svg>", '<image href="x.png"/></svg>')], ["wrong page", good.replace("0 0 600 800", "0 0 800 800")], ["no viewBox", good.replace(' viewBox="0 0 600 800"', "")], ["not an svg", "<html></html>"], ["no shapes", '<svg viewBox="0 0 600 800"></svg>']];
const missed = variants.filter(([, svg]) => la.checkSvg(svg).ok).map(([n]) => n);
ok(missed.length === 0, "the checker refuses every one of 13 faults (missed: " + missed.join(", ") + ")");
ok(la.checkSvg(null).ok === false && la.checkSvg(undefined).problems.length > 0 && LINE_ART.minStrokePx === 4, "nothing at all is refused without an error");

/* ---------- pipeline ---------- */
const ids = o.integrity();
ok(ids.ok && PILLAR1_AGENTS.every((n) => o.agents().some((x) => x.name === n)) && ids.pings.every((p) => p.ok), "the five agents are registered and answer the ping");
const trace = await o.execute({ profile: peggy, options: { template: "reminiscence", tier: 3 } });
ok(trace.analysis.level === "L3" && trace.analysis.levelName === "severe" && trace.analysis.lineArt && trace.analysis.lineArt.detail.maxShapes === 4 && trace.analysis.reminiscence, "each sheet's analysis records its level and its line-art subject");
let t5 = false; try { registerPillar1(null); } catch (e) { t5 = e instanceof TypeError; }
ok(t5, "registering with no orchestrator is refused");
ok(a.variation instanceof VariationAgent && a.format instanceof FormatAgent && a.seasonal instanceof SeasonalPackAgent && a.lineArt instanceof LineArtPromptArchitect && a.bulk instanceof BulkCompiler, "the five agents are the five classes");

if (problems.length) { console.error("pillar 1 check FAILED: " + problems.length + " problem(s), " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("pillar 1 check passed: " + passed + " checks (levels, formats and overrides, token injection, seasons and holidays, bulk runs, line-art specification and checker, orchestrator wiring)");
