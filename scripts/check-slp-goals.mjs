#!/usr/bin/env node
/* js/slp-goals.js in Node, with made-up notes: MoCA and MMSE totals and sub-scores read from a note, suggested CPT codes (never 97124), what is
   stored (never the note's text), goal targets and progress, and the one-page summary. */
await import("../assets/services/slpClinicalService.js");
import * as S from "../js/slp-goals.js";
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), dump: () => [...m.values()].join("\n") }; };
const note1 = `Session 3/4. Administered MoCA today, total 18/30. Visuospatial/executive 3/5, naming 3/3, attention 4/6, language 2/3, abstraction 1/2, delayed recall 2/5, orientation 5/6. 45 minutes direct one-on-one.`;
const p1 = S.parseNote(note1);
ok(p1.instrument === "moca" && p1.total.got === 18 && p1.total.max === 30, "the MoCA total is read (" + JSON.stringify(p1.total) + ")");
ok(JSON.stringify(Object.fromEntries(Object.entries(p1.domains).map(([k, v]) => [k, v.got]))) === JSON.stringify({ visuoexec: 3, naming: 3, attention: 4, language: 2, abstraction: 1, recall: 2, orientation: 5 }), "all seven MoCA sub-scores are read (" + JSON.stringify(p1.domains) + ")");
ok(p1.minutes === 45 && p1.test, "the minutes and the testing are noticed");
const note2 = "MMSE 22/30. Orientation 8/10, registration 3/3, attention and calculation 3/5, recall 1/3, language 7/9. Skilled cognitive treatment, 38 min. Worked on memory strategies and word-finding.";
const p2 = S.parseNote(note2);
ok(p2.instrument === "mmse" && p2.total.got === 22 && p2.domains.orientation.got === 8 && p2.domains.attention.got === 3 && p2.domains.recall.got === 1 && p2.domains.language.got === 7 && p2.domains.registration.got === 3, "an MMSE note is read: total and the five domains (" + JSON.stringify(p2.domains) + ")");
ok(p2.minutes === 38 && p2.cognitive && p2.language && !p2.test, "a treatment note is told apart from a testing note");
const p3 = S.parseNote("moca 20. naming 5/3 attention 9"); ok(p3.total.got === 20 && !p3.domains.naming && !p3.domains.attention && p3.found.some((f) => /skipped/.test(f)), "a sub-score above what its domain is worth is left out and named (" + p3.found.join("; ") + ")");
ok(S.parseNote("").instrument === null && S.parseNote(null).total === null && S.parseNote("Patient did well today, 30 minutes.").minutes === 30, "an empty note, or one with no test, gives no scores");
ok(Object.keys(S.parseNote("MoCA 20. Orientation: 5 minutes of practice.").domains).length === 0, "'5 minutes' is not read as a score");

/* codes */
const c1 = S.suggestCodes(p1); ok(c1.length === 1 && c1[0].code === "96125" && c1[0].summary.length > 20, "a testing note suggests 96125, with a plain summary (" + c1.map((c) => c.code) + ")");
const c2 = S.suggestCodes(p2); ok(c2.map((c) => c.code + "x" + c.units).join() === "97129x1,97130x2,92507x1", "38 minutes of cognitive and speech-language work are 3 timed units: 97129 once, 97130 twice, and 92507 (" + c2.map((c) => c.code + "x" + c.units) + ")");
ok(S.unitsFor(7) === 0 && S.unitsFor(8) === 1 && S.unitsFor(22) === 1 && S.unitsFor(23) === 2 && S.unitsFor(37) === 2 && S.unitsFor(38) === 3 && S.unitsFor(53) === 4, "units follow the 8-minute rule");
ok(S.suggestCodes(S.parseNote("Group cognitive session, 45 min.")).some((c) => c.code === "92508") && !S.suggestCodes(S.parseNote("Group cognitive session, 45 min.")).some((c) => c.code === "97129"), "a group session suggests 92508, not the one-on-one codes");
const c4 = S.suggestCodes(S.parseNote("Cognitive strategy training, no time recorded.")); ok(c4.length === 1 && /no minutes/.test(c4[0].why), "with no minutes the page says so rather than guessing units");
ok(![c1, c2, c4].flat().some((c) => c.code === "97124") && S.suggestCodes(null).length === 0, "97124 (massage) is never suggested");

/* the record */
const store = mem();
const e1 = S.saveEntry(store, "r1", { date: "2026-09-01", instrument: "moca", total: p1.total, domains: p1.domains, minutes: 45, codes: [{ code: "96125", units: 1 }, { code: "97124", units: 1 }], goals: [{ domain: "recall", target: 4, note: "Recall 4 of 5 with one cue" }] });
ok(e1.codes.length === 1 && e1.codes[0].code === "96125", "a code that is not on the list is dropped from the record");
S.saveEntry(store, "r1", { date: "2026-10-15", instrument: "moca", total: { got: 21 }, domains: { recall: { got: 3 }, orientation: { got: 6 }, naming: { got: 3 } }, goals: [] });
S.saveEntry(store, "r1", { date: "2026-11-20", instrument: "moca", total: { got: 23 }, domains: { recall: { got: 4 }, orientation: { got: 6 } }, goals: [] });
S.saveEntry(store, "r1", { date: "2026-10-01", instrument: "mmse", total: { got: 22 }, domains: p2.domains });
ok(!/Administered|direct one-on-one|treatment|word-finding/.test(store.dump()), "none of the note's words are stored");
const log = S.readLog(store, "r1"), pr = S.progress(log, "moca"), rec = pr.domains.find((d) => d.id === "recall");
ok(log.entries.length === 4 && pr.dates.join() === "2026-09-01,2026-10-15,2026-11-20" && pr.total.first === 18 && pr.total.latest === 23 && pr.total.change === 5, "the MoCA record is in date order with first, latest and change (" + JSON.stringify(pr.total) + ")");
ok(rec.first === 2 && rec.latest === 4 && rec.change === 2 && rec.target === 4 && rec.met === true, "the recall goal of 4 is met when the latest score is 4 (" + JSON.stringify({ f: rec.first, l: rec.latest, t: rec.target, m: rec.met }) + ")");
ok(S.progress(log, "mmse").total.latest === 22 && S.progress(log, "mmse").dates.length === 1 && S.progress(log, "mmse").total.change === null, "the MMSE record is kept apart from the MoCA record");
ok(S.weakest(e1, 2).map((d) => d.id).join() === "recall,visuoexec" || S.weakest(e1, 2)[0].id === "recall", "the weakest domains are found by their share of the points (" + S.weakest(e1, 3).map((d) => d.id + ":" + d.share.toFixed(2)) + ")");
let err = ""; try { S.saveEntry(store, "r1", { instrument: "moca" }); } catch (e) { err = e.message; } ok(/total or at least one/.test(err), "an empty entry is refused with a plain message");
try { S.saveEntry(store, "", { total: { got: 5 } }); err = ""; } catch (e) { err = e.message; } ok(/resident/.test(err), "an entry with no resident is refused");
ok(S.readLog({ getItem: () => "{not json" }, "r1").entries.length === 0 && S.readLog({ getItem: () => { throw new Error("x"); } }, "r1").entries.length === 0, "a damaged record reads as empty");
ok(S.normalizeEntry({ total: { got: 99 }, domains: { recall: { got: 9 } } }).total === null && !S.normalizeEntry({ domains: { recall: { got: 9 } } }).domains.recall, "impossible scores are not accepted");

/* the page */
const html = S.summaryPage({ who: "Resident 204", facility: "Maple Grove", log, instrument: "moca", preparedBy: "A. Therapist" });
ok(/class="sheet slp-sheet"/.test(html) && /Resident 204/.test(html) && /Recall|recall/.test(html) && /not an assessment/.test(html) && !/97124/.test(html), "the summary page names the resident, shows the scores and says it is not an assessment");
ok(/Page 1 of 1/.test(html) && /\(met\)/.test(html), "the page is one page and marks a goal that is met");
ok(!/<script/i.test(S.summaryPage({ who: "<script>x</script>", log })), "markup in a name is escaped");

if (problems.length) { console.error("SLP goals check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("SLP goals check passed: " + passed + " checks (MoCA and MMSE notes, code suggestions, what is stored, goals and progress, summary page)");
