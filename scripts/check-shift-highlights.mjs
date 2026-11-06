#!/usr/bin/env node
/* js/shift-highlights.js in Node, with a made-up board (aliases only): Instant Soothe and engagement are picked out, outcomes are read from the
   recorded mood, a busy shift is capped so the page stays one sheet, wings stay apart, and nothing is invented. */
await import("../assets/services/dailyOps.js");
import * as H from "../js/shift-highlights.js";
const D = globalThis.CogniDailyOps;
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const now = new Date("2026-11-10T15:00:00"), day = "2026-11-10";
let board = D.emptyBoard(), n = 0;
const eng = (resident, activity, participation, mood, time, wing, note = "") => { const r = D.makeEngagement({ by: "AB", resident, activity, participation, mood, day, time, shift: "day", wing, note }, now); if (!r.entry) throw new Error(r.problems.join()); board = D.withEngagement(board, r.entry); n++; };
const note = (kind, about, text, wing) => { const r = D.makeNote({ by: "AB", kind, about, text, day, time: "10:00", shift: "day", wing }, now); if (!r.note) throw new Error(r.problems.join()); board = D.withNote(board, r.note); };
eng("Resident 101-A", "Instant Soothe, garden pictures", "joined", "calm", "13:10", "Memory Care A", "Settled after ten minutes with tea.");
eng("Resident 102-B", "Instant Soothe", "watched", "restless", "14:20", "Memory Care A");
eng("Resident 103-C", "Calming page", "watched", "", "14:40", "Memory Care A");
eng("Resident 104-D", "Music memories", "engaged", "happy", "10:30", "Memory Care A");
eng("Resident 105-E", "Word search", "engaged", "content", "11:00", "Assisted Living B");
eng("Resident 106-F", "Crossword", "joined", "anxious", "11:30", "Memory Care A", "Hard to settle before lunch.");
note("watch", "Resident 102-B", "Pacing after the visitor left.", "Memory Care A");
note("worked", "Resident 101-A", "Enjoyed the garden pictures with a cup of tea.", "Memory Care A");
board = D.withTask(board, D.makeTask({ by: "AB", what: "Bring the music cart to the lounge", about: "Memory Care A", for: "CD", day, shift: "day" }, now).task);
const h = H.build(board, { day, shift: "day", now });
ok(h.soothe.length === 3 && h.soothe.map((s) => s.outcome).join() === "settled,still unsettled,not recorded", "Instant Soothe and calming uses are listed with their outcome from the mood (" + h.soothe.map((s) => s.outcome) + ")");
ok(h.totals.soothe === 3 && h.totals.settled === 1, "one of three is counted as settled");
ok(h.engaged.map((e) => e.resident).join() === "Resident 104-D,Resident 105-E" && !h.engaged.some((e) => /Soothe/.test(e.activity)), "fully engaged residents are listed apart from the calming uses");
ok(h.watch.length === 3 && h.watch.some((w) => /Anxious/.test(w.text) && /lunch/.test(w.text)) && h.watch.some((w) => /Pacing/.test(w.text)) && h.watch.some((w) => /Restless/.test(w.text)), "restless and anxious moods and the keep-an-eye-on note are gathered (" + h.watch.length + ")");
ok(h.worked.length === 1 && h.open.length === 1 && /music cart/.test(h.open[0].text), "what worked and the open task are carried over");
const wing = H.build(board, { day, shift: "day", wing: "Assisted Living B", now }); ok(wing.engaged.length === 1 && wing.soothe.length === 0 && wing.watch.length === 0, "one wing's page holds only that wing's residents");
const html = H.page(h, { facility: "Maple Grove", wing: "Memory Care A", initials: "AB" });
ok((html.match(/class="sheet /g) || []).length === 1 && /Page 1 of 1/.test(html) && /Instant Soothe and calming approaches/.test(html) && /1 of 3 calming approaches recorded as settled/.test(html), "the page is one sheet and says how many calming approaches settled");
ok(/sh-settled/.test(html) && /sh-still-unsettled/.test(html) && /sh-not-recorded/.test(html), "each calming use carries its outcome");
ok(/not an assessment/.test(html) && !/[<>]\s*script/i.test(html), "the page says it is not an assessment");
for (let i = 0; i < 20; i++) eng("Resident 3" + String(i).padStart(2, "0"), i % 2 ? "Instant Soothe" : "Bingo", "engaged", i % 2 ? "anxious" : "happy", "12:" + String(i).padStart(2, "0"), "Memory Care A", "x".repeat(150));
const big = H.build(board, { day, shift: "day", now }), bh = H.page(big, {});
ok(big.soothe.length === H.LIMITS.soothe && big.more.soothe > 0 && big.engaged.length === H.LIMITS.engaged && big.more.engaged > 0 && /and \d+ more on the full handoff sheet/.test(bh), "a busy shift is capped, and the rest is counted (" + JSON.stringify(big.more) + ")");
ok(big.totals.soothe === 13 && big.totals.engaged > 6, "the totals still count everything");
ok(!/x{130}/.test(bh), "a long note is shortened");
ok(H.page(H.build(D.emptyBoard(), { day, shift: "all", now }), {}).includes("None recorded on this shift.") && H.page(H.build(null, { day, now }), {}).includes("No open tasks."), "an empty shift gives an honest empty page");
ok(H.SOOTHE_RE.test("Instant Soothe") && H.SOOTHE_RE.test("sundowning walk") && !H.SOOTHE_RE.test("Music memories") && !H.SOOTHE_RE.test("Word search"), "the calming words are matched");
if (problems.length) { console.error("shift highlights check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("shift highlights check passed: " + passed + " checks (Instant Soothe outcomes, engagement, wings, the one-page cap, empty shifts)");
