#!/usr/bin/env node
/* The Studio extras in Node: regional climate seasons, holiday stress-trigger exclusions, names and pets found in a journal note, the 90-day progress
   report (pages and the vector PDF drawing calls), index cards and their QR codes, and the KDP hardcover padding. The browser side is
   scripts/check-studio-extras-ui.mjs. */
import * as C from "../js/studio-core.js";
import { reportPages, reportPdf, graphSvg, pointsFor, SERIES } from "../js/tracking-report.js";
import { indexCardPages, soundFor, SOUNDS, audioPath, INDEX_CARDS } from "../js/deck-formats.js";
import { qrMatrix } from "../js/qr.js";
import { compile, KDP } from "../js/legacy-book.js";
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k), get length() { return m.size; }, key: (i) => [...m.keys()][i] }; };

/* climate */
ok(C.climateSeason("cold", 1).season === "Long winter" && C.climateSeason("cold", 4).season === "Thaw and spring" && C.climateSeason("temperate", 1) === null, "a cold climate names its long winter and its thaw; temperate leaves the four seasons alone");
ok(C.climateSeason("cold", 1, "south").season !== "Long winter" && C.climateSeason("cold", 7, "south").season === "Long winter", "in the southern hemisphere the seasons turn over");
const s0 = mem(); let plan = C.defaultPlan(2027); plan = C.applyOptions(plan, { climate: "tropical" });
ok(plan.climate === "tropical" && plan.months["01"].season === "Dry season" && plan.months["07"].season === "Rainy season", "choosing tropical rewrites the month seasons to dry and rainy");
const edited = C.applyOptions(Object.assign({}, plan, { months: Object.assign({}, plan.months, { "02": Object.assign({}, plan.months["02"], { season: "Our own words" }) }) }), { climate: "cold" });
ok(edited.months["02"].season === "Our own words", "a season the director typed is never overwritten by a climate change");
ok(C.applyOptions(plan, { climate: "nonsense" }).climate !== "nonsense", "an unknown climate is refused");

/* stress exclusions */
const withHol = C.defaultPlan(2027); const holMonths = Object.entries(withHol.months).filter(([, m]) => m.milestone);
ok(holMonths.length >= 5, "the default plan puts a holiday in several months (" + holMonths.length + ")");
const all = Object.keys(C.STRESS_TAGS), cleared = C.applyOptions(withHol, { exclusions: all });
const left = Object.values(cleared.months).filter((m) => m.milestone).map((m) => m.milestone);
ok(Object.values(cleared.months).filter((m) => m.milestone).length < holMonths.length, "excluding every stress tag removes holidays from the plan (" + holMonths.length + " to " + left.length + ")");
const loudOnly = C.applyOptions(withHol, { exclusions: ["loud"] });
ok(!Object.values(loudOnly.months).some((m) => /Independence|New Year/.test(m.milestone)), "excluding loud celebrations removes Independence Day and New Year");
ok(Object.values(loudOnly.months).some((m) => /Thanksgiving/.test(m.milestone)), "other holidays stay when only one tag is chosen");
const pre = C.premap(cleared, new Date(2027, 0, 1), 12);
ok(pre.planner.bundles.length > 0 && !pre.planner.bundles.some((b) => /Independence|New Year|Memorial|Mother|Father/.test(b.concept + b.theme)), "the pre-mapped bundles carry none of the excluded holidays");
ok(C.premap(C.applyOptions(C.defaultPlan(2027), { climate: "desert" }), new Date(2027, 0, 1), 12).planner.bundles.some((b) => b.words.includes("CACTUS") || b.words.includes("SAGE")), "pre-mapped bundles use the climate's words");

/* names and pets */
const t = "Her granddaughter Lily visited with the dog named Biscuit, and her son Tom brought Walter the cat. She asked about her neighbor Edna.";
const m = C.extractMentions(t, []);
ok(m.people.map((x) => x.name).sort().join() === "Edna,Lily,Tom" && m.pets.map((x) => x.name).sort().join() === "Biscuit,Walter", "people and pets are picked out of a note (" + JSON.stringify(m) + ")");
ok(C.extractMentions("The nurse and The Dog barked. Her friend Monday came. In April we went.", []).people.every((x) => !/Monday|April/.test(x.name)), "days and months are not taken for names");
ok(C.extractMentions(t, ["lily", "biscuit"]).people.every((x) => x.name !== "Lily") && C.extractMentions(t, ["lily"]).pets.some((x) => x.name === "Biscuit"), "names already known are skipped");
const store = mem(); store.setItem(C.KEYS.profile + "r1", JSON.stringify({ schema: "cognicopia.residentProfile", id: "r1", tier1_core: { preferredName: "Peg" }, tier3_deep: { people: [{ name: "Tom", relationship: { code: "son", label: "Son" } }] } }));
const a1 = C.applyMentions(store, "r1", m), prof = JSON.parse(store.getItem(C.KEYS.profile + "r1"));
ok(a1.added.length === 4 && a1.skipped === 1 && prof.tier3_deep.people.length === 5 && prof.tier3_deep.people.filter((x) => x.isPet).length === 2 && prof.tier3_deep.people.filter((x) => x.foundInJournal).length === 4, "new names are added to the profile, marked as found in a note; Tom is not duplicated");
ok(C.applyMentions(store, "r1", m).added.length === 0, "running it twice adds nothing");
ok(C.applyMentions(store, "nobody", m).added.length === 0, "a resident with no profile is left alone");

/* report */
const today = new Date("2026-11-10T12:00:00");
const entries = ["2026-08", "2026-09", "2026-10", "2026-11"].map((mo, i) => C.normalizeEntry({ month: mo, stage: "middle", engagement: 1 + i, frustration: 3 - i, fatigue: i % 3, triggers: ["Noise"], note: "Month " + mo }));
const pages = reportPages({ name: "Margaret", entries, today, facility: "Maple Grove" });
ok(pages.length === 2 && pages.every((p) => /class="sheet tr-sheet"/.test(p.html)) && /Page 1 of 2/.test(pages[0].html) && /Page 2 of 2/.test(pages[1].html) && /Margaret/.test(pages[0].html), "the report is two pages with page numbers and the resident's name");
const svg = graphSvg(entries, today, 3);
ok((svg.match(/<polyline/g) || []).length === 3 && /stroke-dasharray/.test(svg) && !/fill="#[0-9a-f]{3,6}"(?<!#000)(?<!#fff)/i.test(svg.replace(/#000|#fff/g, "")), "the 90-day graph has three lines, told apart by dashes and markers, in black and white only");
ok(pointsFor(entries, today, 3).length === 3 && pointsFor(entries, today, 12).length === 12 && SERIES.length === 3, "the graph covers 3 months, and the year view covers 12");
ok(/\bnot an assessment\b/i.test(pages[1].html), "the report says it is not an assessment");
const calls = []; const spy = new Proxy({}, { get: (_, k) => (...a) => { calls.push([k, ...a]); return spy; } });
spy.splitTextToSize = (s) => [String(s)]; calls.length = 0;
reportPdf(new Proxy({ splitTextToSize: (s) => [String(s)] }, { get: (o, k) => (k in o ? o[k] : (...a) => { calls.push([String(k), ...a]); }) }), { name: "Margaret", entries, today });
ok(calls.filter((c) => c[0] === "line").length >= 8 && calls.some((c) => c[0] === "circle") && calls.some((c) => c[0] === "rect") && calls.some((c) => c[0] === "triangle") && calls.some((c) => c[0] === "text" && c[1] === "Margaret"), "the PDF is drawn with lines, markers and text (vector), not a picture");
let thrown = null; try { reportPages({}); reportPages(null); graphSvg([], today, 3); reportPdf(new Proxy({ splitTextToSize: (s) => [String(s)] }, { get: (o, k) => (k in o ? o[k] : () => {}) }), { entries: [] }); } catch (e) { thrown = e; }
ok(!thrown, "a resident with nothing logged still gives a report (" + (thrown && thrown.message) + ")");

/* index cards and QR */
const cards = [{ kind: "era", title: "The radio years", invite: "What music was playing at home?" }, { kind: "work", title: "A first job", invite: "Tell me about the work you did." }, { kind: "place", title: "The farm", invite: "What grew near the house?" }];
for (const size of ["4x6", "5x7"]) {
  const pg = indexCardPages(cards, { size, tier: 2 });
  ok(pg.length === 6 && pg[0].role === "front" && pg[1].role === "back" && pg.every((p) => p.w === INDEX_CARDS[size].w && p.h === INDEX_CARDS[size].h), size + " cards: a front and a back page for each card, each the size of the card");
  ok(pg.filter((p) => p.role === "front").every((p) => /<svg class="qr"/.test(p.html) && /dk-resp/.test(p.html) && new RegExp(INDEX_CARDS[size].cls).test(p.html)), size + " fronts carry a QR code and the response row");
}
ok(indexCardPages(cards, { size: "4x6", back: false }).length === 3 && !/<svg class="qr"/.test(indexCardPages(cards, { size: "4x6", qr: false })[0].html), "the back and the QR code can each be left off");
ok(indexCardPages(null).length === 0 && indexCardPages(cards, { size: "9x9" }).every((p) => p.w === 4), "no cards gives no pages; an unknown size falls back to 4 x 6");
ok(soundFor(cards[0]).id === "guitar" && soundFor(cards[1]).id === "train" && soundFor(cards[2]).id === "bird" && SOUNDS.every((s) => /^[a-z]+$/.test(s.id)), "each card is given a sound that suits it");
ok(audioPath("train") === "builder.html#/audio/train" && audioPath("../x<y>") === "builder.html#/audio/xy", "the QR address is site-relative and cannot be bent");
ok(qrMatrix(audioPath("train")).length <= 29, "the code is small enough to scan from a printed card");

/* KDP */
const src = { profile: async () => ({ tier1_core: { preferredName: "Margaret" }, tier2_enrichment: { birthYear: 1938 } }), keeper: async () => ({ entries: [{ date: "2026-10-20", kind: "journal", title: "Garden", text: "I planted the beans by the fence.", share: true }] }), journal: async () => ({ entries: [] }), tracking: async () => ({ entries: [] }), engagement: async () => [] };
const book = await compile(src, "r1", { today, kdp: true, relation: "Mom" });
ok(!book.empty && book.pages.length >= KDP.minPages && book.pages.length % 2 === 0 && book.pages.length <= KDP.maxPages, "the hardcover edition has at least " + KDP.minPages + " pages and an even count (" + book.pages.length + ")");
ok(book.pages.every((p) => /lb-kdp/.test(p.html)) && book.pages.filter((p) => p.role === "family").length === book.meta.kdp.familyPages && book.meta.kdp.familyPages > 0 && /Photograph/.test(book.pages.find((p) => p.role === "family").html), "the added pages are family message and photograph pages, each marked for the 8.25 x 11 in page");
ok(KDP.trimIn[0] === 8.25 && KDP.trimIn[1] === 11 && KDP.bleedIn === 0.125 && KDP.insideIn >= 0.75 && book.meta.gutterIn === KDP.insideIn, "the trim is 8.25 x 11 in with a 0.125 in bleed allowance and a gutter of at least 0.75 in");
const plain = await compile(src, "r1", { today });
ok(!plain.pages.some((p) => /lb-kdp/.test(p.html)) && plain.pages.length < KDP.minPages, "the ordinary book is unchanged");

if (problems.length) { console.error("studio extras check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("studio extras check passed: " + passed + " checks (climate seasons, stress exclusions, names and pets, progress report, index cards and QR, KDP padding)");
