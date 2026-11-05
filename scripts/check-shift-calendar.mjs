#!/usr/bin/env node
/* =====================================================================
   The Shift board calendar's staffing logic (js/shift-calendar.js), without a browser.
   Dates and weeks, the record (clean initials, no duplicates, a damaged record is an empty one), changes with words for
   the person, coverage and the dementia-trained count, doubles, the staffing insight (what it counts and when it says
   "not enough records yet"), the pairing suggestions and when a flag is raised, the printed week, the locked file.
   Run: node scripts/check-shift-calendar.mjs
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const box = { console }; box.globalThis = box; vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/shift-calendar.js"), "utf8"), box);
const C = box.CogniShiftCal;
const problems = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

/* days and weeks */
ok(C.isDay("2026-11-05") && !C.isDay("2026-02-30") && !C.isDay("2026-13-01") && !C.isDay("x") && !C.isDay(null), "a real day is a day; a made-up one is not");
ok(C.addDays("2026-12-31", 1) === "2027-01-01" && C.addDays("2026-03-01", -1) === "2026-02-28", "adding days crosses months and years");
ok(C.weekStart("2026-11-05") === "2026-11-01" && C.weekDays("2026-11-05").join() === "2026-11-01,2026-11-02,2026-11-03,2026-11-04,2026-11-05,2026-11-06,2026-11-07", "weeks start on Sunday");
const grid = C.monthGrid("2026-11-05");
ok(grid.length === 42 && grid[0].day === "2026-11-01" && grid[0].inMonth && grid.filter(x => x.inMonth).length === 30, "a month grid is six weeks and marks the month's own days");
ok(C.addMonths("2026-01-31", 1) === "2026-02-01" && C.monthLabel("2026-11-05") === "November 2026" && /^Nov 1 to 7, 2026$/.test(C.weekLabel("2026-11-05")) && C.dayLong("2026-11-05") === "Thursday, November 5, 2026", "the labels read in words");

/* the record */
let cal = C.emptyCalendar();
for (const [i, r, s] of C.sampleStaff()) { cal = C.addStaff(cal, { initials: i, role: r, skills: s }); ok(!cal.error, "sample staff " + i + " can be added"); }
ok(cal.staff.length === 8, "eight fictional sample staff");
ok(C.addStaff(cal, { initials: "ab" }).error && C.addStaff(cal, { initials: "123" }).error && C.addStaff(cal, { initials: "" }).error, "duplicate, empty and non-letter initials are refused in words");
ok(cal.staff.every(s => /^[A-Z]{1,4}$/.test(s.initials)), "initials are letters, up to four, in capitals");
const id = i => cal.staff.find(s => s.initials === i).id, D = "2026-11-05";
const garbage = C.normalize({ staff: [{ id: "x", initials: "AB" }, { id: "abcdef1234", initials: "q!r$" }, null, 5], slots: { bad: {}, "2026-11-05|day": { staff: ["nope"] }, "2026-02-30|day": { staff: [] } } });
ok(garbage.staff.length === 1 && garbage.staff[0].initials === "QR" && !Object.keys(garbage.slots).length, "a damaged record becomes a clean one, never a crash");
ok(C.normalize("not an object").staff.length === 0 && C.normalize(null).staff.length === 0, "nothing at all is an empty calendar");
ok(JSON.stringify(C.normalize(JSON.parse(JSON.stringify(cal)))) === JSON.stringify(cal), "a calendar survives being saved and read");

/* planning, coverage and doubles */
for (const i of ["AB", "CD", "EF", "LM"]) cal = C.assign(cal, D, "day", id(i));
let c = C.coverage(cal, D, "day");
ok(c.level === "full" && c.assigned === 4 && c.specialists === 2 && c.gap === 0 && c.specialistGap === 0, "four on the day shift, two trained: full");
ok(C.coverage(cal, D, "evening").level === "empty" && !C.coverage(cal, D, "evening").planned, "an unplanned shift is empty and says so");
cal = C.assign(cal, D, "evening", id("LM")); cal = C.assign(cal, D, "evening", id("QR"));
c = C.coverage(cal, D, "evening");
ok(c.level === "open" && c.gap === 1 && c.specialistGap === 1, "two of three, none trained: open, one person and one trained person short");
ok(C.assign(cal, D, "evening", id("LM")).error && C.assign(cal, "bad", "day", id("LM")).error && C.assign(cal, D, "day", "nobody").error, "the same person twice, a bad day and an unknown person are refused");
ok(C.doubles(cal, D).length === 1 && C.doubles(cal, D)[0].staff.initials === "LM" && C.doubles(cal, D)[0].shifts.join() === "day,evening", "a double is named, not blocked");
ok(C.dayCoverage(cal, D).level === "open" && C.dayCoverage(cal, D).openShifts === 2 && C.dayCoverage(cal, "2026-11-06").level === "none", "a day is open when a shift is short, none when nothing is planned");
const swapped = C.swap(cal, D, "evening", id("QR"), id("NP"));
ok(!swapped.error && C.coverage(swapped, D, "evening").specialists === 1 && C.swap(cal, D, "evening", id("QR"), id("QR")).error, "a swap changes who is on, and swapping someone for themselves says no");
ok(C.coverage(C.removeStaff(cal, id("LM")), D, "day").assigned === 3 && !C.staffById(C.removeStaff(cal, id("LM")), id("LM")), "removing a person takes them off every shift");
const night = C.setSlotNeed(cal, D, "night", { staff: 5, specialists: 2 });
ok(C.needOf(night, D, "night").staff === 5 && C.needOf(night, "2026-11-06", "night").staff === 2 && C.needOf(C.setSlotNeed(night, D, "night", null), D, "night").staff === 2, "a day can ask for more than the usual, and go back");
ok(C.setNeeds(cal, "day", { staff: 9, specialists: 2 }).needs.day.staff === 9 && C.needOf(C.setNeeds(cal, "day", { staff: 99 }), D, "day").staff === 4, "the usual needs change; nonsense falls back to what was there");
const cp = C.copyWeek(cal, D, "2026-11-12");
ok(C.coverage(cp, "2026-11-12", "day").assigned === 4 && C.coverage(cp, "2026-11-12", "evening").assigned === 2 && C.coverage(cal, "2026-11-12", "day").assigned === 0, "a week's people copy to the next week without touching the first");

/* the staffing insight: counts of what staff recorded */
const eng = [], mk = (day, shift, time, res, part, mood) => eng.push({ day, shift, time, resident: res, participation: part, mood });
for (let k = 0; k < 8; k++) mk("2026-10-" + String(10 + k).padStart(2, "0"), "evening", "16:" + (10 + k), k % 2 ? "Maple 2" : "Rm 302", k < 5 ? "joined" : "declined", k < 5 ? "restless" : "calm");
for (let k = 0; k < 7; k++) mk("2026-10-" + String(10 + k).padStart(2, "0"), "day", "10:00", "Maple 2", "engaged", "happy");
const ins = C.insight(eng);
ok(ins.byShift.evening.level === "high" && ins.byShift.day.level === "low" && ins.byShift.night.level === "unknown" && ins.enough && ins.peakHour === 16 && ins.total === 15, "evening counts as high, day as low, night as unknown; the busiest hour is read from the times");
ok(C.insight([]).enough === false && C.insight([]).byShift.day.level === "unknown" && C.insight(null).total === 0 && C.insight([{ shift: "x" }, null]).total === 0, "with no records it says it does not know, and bad records are ignored");
const few = []; for (let k = 0; k < 5; k++) few.push({ day: "2026-10-1" + k, shift: "evening", time: "16:00", resident: "A", participation: "declined", mood: "restless" });
ok(C.insight(few).byShift.evening.level === "unknown", "five records are too few to call anything high");
ok(C.dayPressure(eng, D).evening.level === "high" && C.dayPressure(eng, D).evening.basis === "all", "a day with too few of its own weekday's records uses all days, and says so");

/* the pairings and the flag */
let sg = C.suggest(cal, D, "evening", eng);
ok(sg.level === "high" && sg.flags.length === 1 && /No dementia-trained/.test(sg.flags[0]) && sg.pairs.length >= 1 && sg.pairs[0].staff === null, "a high shift with nobody trained is flagged, and the pairs say nobody trained is on");
const withNP = C.assign(cal, D, "evening", id("NP"));
sg = C.suggest(withNP, D, "evening", eng);
ok(sg.pairs[0].staff && sg.pairs[0].staff.initials === "NP" && /records on this shift show/.test(sg.pairs[0].why) && sg.pairs[0].skills.indexOf("Dementia") >= 0, "the dementia-trained person is suggested for the resident whose records most often show distress");
ok(C.suggest(cal, D, "day", eng).flags.length === 0 && C.suggest(cal, D, "night", eng).pairs.length === 0, "a calm shift and an unknown one raise no flag and suggest no pairs");
ok(!/forecast|predict|AI\b|artificial/i.test(JSON.stringify(sg)), "what it says is a count of records, never a prediction or a claim of intelligence");
ok(C.topResidents(eng, "evening").every(r => r.alias && r.flagged >= 2), "only residents with at least two flagged records on a shift are named, by alias");

/* the tile, the printed week, the file */
const tile = C.dayTile(withNP, D, eng);
ok(tile.coverage.level === "open" && tile.highShifts.indexOf("evening") >= 0, "a day tile carries coverage and the shifts with high distress");
const wk = C.weekTable(cal, D);
ok(wk.length === 7 && wk[4].day === D && wk[4].cells[0].initials.length === 4 && wk[4].cells[1].gap === 1 && wk[0].dow === "Sunday", "the printed week has seven days, three shifts each, initials and gaps");
ok(C.readBackup(C.backupFile(cal)).calendar.staff.length === 8 && C.readBackup({}).error && C.readBackup(null).error, "the locked file round-trips and a stranger's file is refused in words");
const src = fs.readFileSync(path.join(ROOT, "js/shift-calendar.js"), "utf8");
ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB|document\./.test(src), "the logic stores nothing, touches no page and makes no network request");

if (problems.length) { console.error(`shift calendar check FAILED: ${problems.length} problem(s), ${passed} passed`); problems.forEach(m => console.error("  - " + m)); process.exit(1); }
console.log(`shift calendar check passed: ${passed} checks (weeks, the record, planning, coverage, doubles, the staffing insight, pairings and flags, the printed week, the locked file)`);
