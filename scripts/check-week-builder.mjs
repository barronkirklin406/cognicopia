#!/usr/bin/env node
/* =====================================================================
   The Week Builder's plan (assets/services/weekBuilder.js), on made-up residents and the Facility Portal's own activity catalog:

     dates       a week always starts on its Monday (a Sunday belongs to the week before); chosen days only; next week is seven days on
     the plan    every page suits the resident's level (the catalog's tiers 1 to 3); a topic to avoid is never matched, by whole word, in an activity's name or its
                 reason; the late stage never gets a word search or a scramble; a day's pages are never two of one pillar; a page is not repeated in a week while
                 another fits; one to three pages a day, exactly as asked
     the same    the same residents, week and settings give the same plan; the next week gives a different one
     the sheet   the run sheet has one row for each resident and day, in room order, by day, and the four boxes are named Offered, Took part, Watched, Declined
     holidays    the week's holidays are suggestions with the right dates (Thanksgiving 2026, Easter 2027, Memorial Day 2027); never put on a page
   Run: node scripts/check-week-builder.mjs
   ===================================================================== */
import fs from "fs";
import vm from "vm";

const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ["assets/services/facilityPlanner.js", "assets/services/weekBuilder.js"]) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
const W = ctx.CogniWeek, F = ctx.CogniFacility;
const problems = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

eq(W.mondayOf("2026-11-25"), "2026-11-23", "a Wednesday's Monday");
eq(W.mondayOf("2026-11-29"), "2026-11-23", "a Sunday belongs to the week before");
eq(W.mondayOf("2026-11-23"), "2026-11-23", "a Monday is its own");
eq(W.nextWeek("2026-11-25"), "2026-11-30", "next week is seven days on");
eq(W.datesFor("2026-11-25", [1, 3, 5]).map(d => d.date), ["2026-11-23", "2026-11-25", "2026-11-27"], "chosen days only");
eq(W.datesFor("2026-11-25").length, 5, "every weekday by default");

const have = {}; F.CATALOG.forEach(a => { have[a.id] = true; });
const avoidFn = re => t => re.test(t);
const mk = (id, tier, key, room, re) => ({ id, name: id, alias: "Resident " + room, room, tier, stageKey: key, avoidTest: re ? avoidFn(re) : undefined, facts: 5 });
const res = [mk("r-ruth", 1, "early", "204"), mk("r-dot", 2, "middle", "302-B", /(^|[^a-z])coloring/i), mk("r-sam", 3, "late", "110"), mk("r-walt", 2, "middle", "104")];
const ofResidents = (start, per) => W.plan({ residents: res, start, days: [1, 2, 3, 4, 5], perDay: per, catalog: F.CATALOG, have });
const catById = Object.fromEntries(F.CATALOG.map(a => [a.id, a]));

for (const per of [1, 2, 3]) for (const start of ["2026-11-23", "2026-11-30", "2026-12-07", "2027-01-04"]) {
  const pl = ofResidents(start, per);
  ok(pl.rows.map(r => r.room).join("|") === "104|110|204|302-B", `rows follow the rooms (${pl.rows.map(r => r.room).join(", ")})`);
  pl.rows.forEach(r => {
    const rec = res.find(x => x.id === r.id);
    r.days.forEach(d => {
      ok(d.pages.length === per, `${r.id} ${d.date}: ${per} page(s) a day (${d.pages.length})`);
      ok(new Set(d.pages.map(p => p.pillar)).size === d.pages.length, `${r.id} ${d.date}: no two pages of one pillar in a day`);
      d.pages.forEach(p => {
        const a = catById[p.activityId];
        ok(a && a.tiers.indexOf(rec.tier) >= 0, `${r.id}: ${p.name} suits tier ${rec.tier}`);
        ok(!(rec.stageKey === "late" && W.LATE_NO.indexOf(p.activityId) >= 0), `${r.id}: the late stage gets no ${p.name}`);
        ok(!rec.avoidTest || !rec.avoidTest([a.name, a.why].join(" ")), `${r.id}: ${p.name} is not on the avoid list`);
      });
    });
    const all = r.days.flatMap(d => d.pages.map(p => p.activityId));
    ok(per > 1 || new Set(all).size === all.length || all.length > 5, `${r.id}: a page is not repeated in a week while another fits`);
  });
}
eq(ofResidents("2026-11-23", 2).rows.map(r => r.days.map(d => d.pages.map(p => p.activityId))), ofResidents("2026-11-25", 2).rows.map(r => r.days.map(d => d.pages.map(p => p.activityId))), "the same week gives the same plan, whichever day of it is asked about");
ok(JSON.stringify(ofResidents("2026-11-23", 2).rows.map(r => r.days.map(d => d.pages.map(p => p.activityId)))) !== JSON.stringify(ofResidents("2026-11-30", 2).rows.map(r => r.days.map(d => d.pages.map(p => p.activityId)))), "the next week is a different plan");
const day1 = ofResidents("2026-11-23", 1);
ok(day1.rows.every(r => r.days[0].pages[0].pillar === "music" || r.days[0].pages[0].pillar !== ""), "Monday leads with music when something of it fits");
ok(day1.rows.filter(r => r.days[0].pages[0].pillar === "music").length >= 3, "most residents' Monday is a music page");

/* the run sheet */
const rows = W.runSheetRows(ofResidents("2026-11-23", 2), r => r.alias);
eq(rows.length, 20, "one row for each of four residents on five days");
eq(rows.slice(0, 4).map(r => r.room), ["104", "110", "204", "302-B"], "a day's rows follow the rooms");
ok(rows.slice(0, 4).every(r => r.date === "2026-11-23") && rows.slice(4, 8).every(r => r.date === "2026-11-24"), "by day, then by room");
eq(W.BOXES, ["Offered", "Took part", "Watched", "Declined"], "the four boxes");
ok(rows.every(r => r.titles.length === 2), "page titles are listed for each row");

/* holidays */
const names = s => W.holidays(s).map(h => h.name + " " + h.date);
eq(names("2026-11-23"), ["Thanksgiving 2026-11-26"], "Thanksgiving 2026 is the fourth Thursday");
eq(names("2027-03-22"), ["Easter 2027-03-28"], "Easter 2027");
eq(names("2027-05-31"), ["Memorial Day 2027-05-31"], "Memorial Day 2027 is the last Monday of May");
eq(names("2026-07-06"), [], "a week with no holiday has none");
ok(W.holidays("2026-11-09").some(h => h.name === "Veterans Day" && /military/i.test(h.idea)), "Veterans Day is offered only with the military note");

console.log(problems.length ? `week builder logic check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 20).join("\n  - ") : `week builder logic check passed: ${passed} checks (weeks, level, avoid, late stage, pillars, the same plan twice, the run sheet, holidays)`);
process.exit(problems.length ? 1 : 0);
