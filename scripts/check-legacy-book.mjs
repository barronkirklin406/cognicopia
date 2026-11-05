#!/usr/bin/env node
/* js/legacy-book.js in Node: the 90-day aggregation, the family cover, chapter dividers, gutters that alternate, page-number footers,
   and what is kept out (private entries, identifiers, talking-down wording, anything older than 90 days). */
import { aggregate, compile, coverTitle, paginate, cleanText, CHAPTERS, GUTTER_IN, BOOK_CSS } from "../js/legacy-book.js";
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const today = new Date("2026-11-10T12:00:00");
const day = (n) => new Date(today.getTime() - n * 86400000).toISOString().slice(0, 10);
const deps = {
  profile: async () => ({ tier1_core: { preferredName: "Margaret" }, tier2_enrichment: { birthYear: 1938 } }),
  keeper: async () => ({ entries: [
    { date: day(5), kind: "journal", title: "On the garden", text: "I always planted the beans by the fence. Call me at 555-123-4567.", share: true, by: "Dana" },
    { date: day(20), kind: "coloring", title: "Sunflowers", text: "", design: "sunflower-field", share: true, tier: 2 },
    { date: day(30), kind: "reminiscence", card: "The radio years", text: "We danced in the kitchen to the radio.", share: true },
    { date: day(40), kind: "moment", title: "Visit", text: "Her daughter came and they sang together.", share: true },
    { date: day(12), kind: "journal", title: "Private", text: "Not for the family.", share: false },
    { date: day(120), kind: "journal", title: "Too old", text: "Outside the window.", share: true },
    { date: day(8), kind: "moment", title: "Bad wording", text: "She was naughty and stubborn at lunch.", share: true } ] }),
  journal: async () => ({ entries: [{ at: day(3) + "T10:00:00Z", kind: "calming", text: "Settled when we hummed Amazing Grace." }, { at: day(200) + "T10:00:00Z", kind: "breakthrough", text: "Old one." }] }),
  tracking: async () => ({ entries: [{ month: "2026-10", note: "More relaxed after lunch this month." }, { month: "2025-01", note: "Too old." }] }),
  engagement: async () => [{ at: day(10) + "T09:00:00Z", concept: "Word search: garden words", engagement: 3, note: "Found every word." }, { at: day(11) + "T09:00:00Z", concept: "Music memories", engagement: 3 }]
};
const m = await aggregate(deps, "r1", { today });
ok(m.counts.artwork === 1 && m.counts.reminiscence === 2 && m.counts.puzzles === 1 && m.counts.moments === 2 && m.counts.team === 1 && m.skipped.private === 1 && m.skipped.outsideWindow === 1 && m.range.days === 90, "the 90-day pass keeps only shared entries from the window, and sorts them into chapters " + JSON.stringify(m.counts));
const all = JSON.stringify(m.chapters); ok(!/555-123-4567|Not for the family|Too old|Old one|naughty|stubborn/.test(all), "private, old, identifier and talking-down text never reach the book");
ok(m.resident.name === "Margaret" && m.resident.era === "1950s" && m.chapters.puzzles[0].text === "Found every word." && !m.chapters.puzzles.some((p) => /Music/.test(p.title)), "the resident, the era years and puzzle sessions are found");
const none = await aggregate({}, "r1", { today }); ok(none.total === 0 && none.resident.name === "", "with no readers the pass is empty, not an error");
const flaky = await aggregate({ keeper: async () => { throw new Error("locked"); }, journal: async () => ({ entries: [{ at: day(2) + "T1:00:00Z", text: "Hummed along." }] }) }, "r1", { today }); ok(flaky.counts.moments === 1, "one reader failing does not stop the others");
ok(coverTitle({ name: "Margaret", today }).title === "Margaret’s Autumn Memories & Milestones" && coverTitle({ relation: "Mom", name: "Margaret", today }).title === "Mom’s Autumn Memories & Milestones" && coverTitle({ name: "Jess", today: new Date("2026-01-15") }).title === "Jess’s Winter Memories & Milestones" && coverTitle({ name: "Dolores", today }).title.startsWith("Dolores’s "), "the cover title follows the season and the family's word for them");
const b = await compile(deps, "r1", { today, relation: "Mom", facility: "Maple Grove", message: "We are so glad to know Margaret.\nThank you for visiting." });
const roles = b.pages.map((p) => p.role).join();
ok(roles.startsWith("cover,message,contents,divider") && b.pages.filter((p) => p.role === "divider").length === 5 && b.meta.pageCount === b.pages.length && !b.empty, "the book is a cover, a family message, contents, then a divider before each chapter (" + roles + ")");
ok(/Mom’s Autumn Memories/.test(b.pages[0].html) && /Maple Grove/.test(b.pages[0].html) && /Born 1938/.test(b.pages[0].html) && /1950s years/.test(b.pages[0].html) && /Activities and Life Enrichment/.test(b.pages[0].html), "the cover has the title, institution, birth year, era badge and framing");
ok(b.pages.every((p, i) => p.n === i + 1 && (i % 2 === 0 ? /lb-odd/.test(p.html) : /lb-even/.test(p.html))) && b.pages.slice(1).every((p) => new RegExp("Page " + p.n + " of " + b.pages.length).test(p.html)) && !/Page 1 of/.test(b.pages[0].html), "pages alternate inside and outside gutters, and each has a footer 'Page n of N' (the cover has none)");
const toc = b.pages.find((p) => p.role === "contents").html; ok(CHAPTERS.every((c) => new RegExp(c.title).test(toc)) && b.pages.filter((p) => p.role === "divider").every((p) => new RegExp("<b>" + p.n + "</b>").test(toc)), "the contents lists each chapter with its true page number");
ok(/We are so glad to know Margaret/.test(b.pages[1].html) && !/<script/.test(JSON.stringify(b.pages)), "the family message page carries the note");
ok(GUTTER_IN === 0.75 && /0\.75in/.test(BOOK_CSS), "the binding gutter is 0.75 in");
const hostile = await compile({ keeper: async () => ({ entries: [{ date: day(2), kind: "journal", title: "<img src=x onerror=alert(1)>", text: "<script>alert(1)</script> Hello", share: true }] }) }, "r1", { today, message: "<b>hi</b>" }); ok(!/<script|<img src=x|<b>hi/.test(JSON.stringify(hostile.pages)) && /&lt;script&gt;/.test(JSON.stringify(hostile.pages)), "markup in an entry or the message is shown as text");
const empty = await compile({}, "r1", { today }); ok(empty.empty && empty.pages.length >= 3 && /Nothing has been shared/.test(empty.pages[empty.pages.length - 1].html), "a quarter with nothing shared still compiles, and says so");
const long = await compile({ keeper: async () => ({ entries: Array.from({ length: 40 }, (_, i) => ({ date: day(i + 1), kind: "journal", title: "Entry " + i, text: "word ".repeat(120), share: true })) }) }, "r1", { today });
const reminPages = long.pages.filter((p) => p.chapter === "reminiscence" && p.role === "content"); ok(reminPages.length > 3 && reminPages.every((p) => (p.html.match(/lb-item/g) || []).length <= 6) && long.pages.every((p) => p.n <= long.meta.pageCount), "forty long entries spread over many pages, never crammed onto one");
ok(paginate([]).length === 0 && paginate([{ text: "x".repeat(5000) }]).length === 1 && cleanText("Call 555-123-4567") === "Call [phone removed]" && cleanText("naughty child") === "" , "pagination and cleaning handle empty, huge and unacceptable text");
if (problems.length) { console.error("legacy book check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("legacy book check passed: " + passed + " checks (90-day aggregation, cover, family message, dividers, gutters, footers, safety)");
