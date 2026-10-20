#!/usr/bin/env node
/* =====================================================================
   Checks for the resident profile engine, in Node. Built-ins only; nothing is fetched. Part of npm test.

     1. the tracking record (assets/services/residentTracker.js): a hostile or foreign record becomes a clean one; the stage maps to
        the tiers the clinical matrix uses; a day has three parts and each reads still to do, packet made, done or chose another
        time; entries are bounded, kept 90 days, refused when they name anyone, and a Shift board entry is kept once; a packet made
        is noted by day and part of the day
     2. the suggested tier: it starts from the stage (else the profile), moves one step at most, needs enough recent sessions, says
        why in plain words, and always says it is only a suggestion
     3. the staff companion (assets/services/staffCompanion.js): cover, facilitation and calming pages; the alias and never a name;
        four cues for each tier; every sentence passes the dignity rules; the focus and the time follow the activities
     4. the same words as the Shift board (participation and moods), and no network in either service
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0; const problems = [];
const ok = (cond, msg) => { if (cond) passed++; else problems.push(msg); };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

function load(file, global, extra = {}){
  const ctx = vm.createContext(Object.assign({ console, Date, Math, JSON, Object, Array, String, Number, RegExp, Map, Set, Error, Intl, parseInt, parseFloat, isFinite, isNaN, Uint8Array }, extra));
  ctx.globalThis = ctx;
  vm.runInContext(read(file).replace(/typeof globalThis !== "undefined" \? globalThis : this/, "globalThis"), ctx, { filename: file });
  return ctx[global];
}
const T = load("assets/services/residentTracker.js", "CogniTracker");
const S = load("assets/services/staffCompanion.js", "CogniStaffCompanion");
const D = load("assets/services/dailyOps.js", "CogniDailyOps");

const TODAY = "2026-10-20", NOW = new Date(2026, 9, 20, 14, 30);   // an afternoon
const day = n => { const d = new Date(2026, 9, 20 - n, 12); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

/* ---------- 1. the record ---------- */
{
  eq(T.normalize(null, "r1", TODAY), T.blank("r1"), "nothing stored reads as a blank record");
  eq(T.normalize({ schema: "something.else", stage: "5" }, "r1", TODAY), T.blank("r1"), "a foreign record is never read");
  eq(T.normalize("not an object", "r1", TODAY).log, [], "a string is not a record");
  const hostile = T.normalize({ schema: T.SCHEMA, stage: "9", stageDay: "soon", days: { "not-a-day": {}, [TODAY]: { morning: { state: "exploded", text: "<b>hi</b>" + "x".repeat(200) } } },
    log: [null, 5, { day: TODAY, slot: "noon", participation: "joined" }, { day: TODAY, slot: "morning", participation: "joined", activity: "<script>x</script>Music", mood: "furious", note: "n".repeat(500), pillar: "chess" }],
    packets: [{ day: TODAY, slot: "evening", pillars: ["words", "chess"], names: ["A", 5], minutes: 99999 }] }, "r1", TODAY);
  ok(hostile.stage === "" && hostile.stageDay === "", "a stage that is not 1 to 7 is dropped");
  ok(Object.keys(hostile.days).length === 1, "a day that is not a date is dropped");
  ok(hostile.days[TODAY].morning.state === "open" && hostile.days[TODAY].morning.text.length <= 60 && !/</.test(hostile.days[TODAY].morning.text), "a part of the day with a bad state reads still to do, and its words are bounded and clean");
  ok(hostile.log.length === 1 && hostile.log[0].mood === "" && hostile.log[0].pillar === "" && hostile.log[0].note.length <= 160 && !/[<>]/.test(hostile.log[0].activity), "a log entry keeps only what it understands");
  ok(hostile.packets.length === 1 && hostile.packets[0].pillars.join() === "words" && hostile.packets[0].minutes <= 600, "a packet note keeps real pillars and a bounded time");

  /* stages and tiers: the clinical matrix's own mapping */
  eq(["1", "2", "3", "4", "5", "6", "7"].map(s => T.tierOfStage(s)), [1, 1, 1, 1, 2, 3, 3], "GDS 1 to 4 is Tier 1, 5 is Tier 2, 6 and 7 are Tier 3");
  eq(T.tierOfStage("8"), 0, "an unknown stage maps to no tier");
  eq(T.stageLabel("5"), "GDS 5", "a stage reads as GDS plus its number");
  eq(T.stageLabel(""), "Not recorded", "no stage reads as not recorded");
  const st = T.setStage(T.blank("r1"), "6", NOW); ok(st.stage === "6" && st.stageDay === TODAY, "setting a stage notes the day");
  ok(T.setStage(T.setStage(T.blank("r1"), "6", NOW), "12", NOW).stage === "6", "a bad stage changes nothing");
  ok(T.setStage(T.setStage(T.blank("r1"), "6", NOW), "", NOW).stage === "", "a stage can be cleared");
  eq(["08:00", "11:59", "12:00", "16:59", "17:00", "22:10", "", "x"].map(T.slotOfTime), ["morning", "morning", "afternoon", "afternoon", "evening", "evening", "afternoon", "afternoon"], "a time falls in a part of the day");

  /* the day */
  let t = T.blank("r1");
  eq(T.daySummary(t, TODAY).map(s => s.state), ["open", "open", "open"], "a new day is all still to do");
  t = T.setSlot(t, TODAY, "morning", "done", "Orientation board", NOW);
  t = T.setSlot(t, TODAY, "afternoon", "bogus", "x", NOW); ok(t.days[TODAY].afternoon.state === "open", "a bad state changes nothing");
  ok(/Morning: done \(Orientation board\)/.test(T.daySentence(t, TODAY)) && /Afternoon: still to do/.test(T.daySentence(t, TODAY)), "the day reads as a sentence");

  /* entries */
  const good = { activity: "Singing together", pillar: "music", participation: "engaged", mood: "calm", note: "Hummed along the whole time", slot: "afternoon" };
  let r = T.addEntry(T.blank("r1"), good, NOW, ["Margaret", "Peggy"]);
  ok(r.entry && r.entry.day === TODAY && r.entry.participation === "engaged" && r.track.log.length === 1, "an entry is kept with today's date");
  eq(T.daySummary(r.track, TODAY)[1].state, "done", "taking part marks that part of the day done");
  const declined = T.addEntry(T.blank("r1"), Object.assign({}, good, { participation: "declined" }), NOW);
  eq(T.daySummary(declined.track, TODAY)[1].state, "skipped", "choosing another time marks it so, never failed");
  ok(!T.addEntry(T.blank("r1"), { participation: "joined" }, NOW).entry, "an entry needs to say what the activity was");
  ok(!T.addEntry(T.blank("r1"), { activity: "Music" }, NOW).entry, "an entry needs how they took part");
  const named = T.addEntry(T.blank("r1"), Object.assign({}, good, { note: "Margaret loved it" }), NOW, ["Margaret"]);
  ok(!named.entry && /name/i.test(named.problems.join(" ")), "a note that names the resident is refused, and says why");
  ok(!T.addEntry(T.blank("r1"), Object.assign({}, good, { activity: "Peggy's song" }), NOW, ["Peggy"]).entry, "a name in the activity words is refused too");
  ok(T.addEntry(T.blank("r1"), Object.assign({}, good, { note: "Margarita was not mentioned" }), NOW, ["Margaret"]).entry, "a different word that only starts the same is fine");
  const pillars = T.pillarsDone(r.track, TODAY, 7); ok(pillars.length === 6 && pillars.find(p => p.id === "music").count === 1, "the six areas are counted over a week");
  ok(T.removeEntry(r.track, r.entry.id, NOW).log.length === 0, "an entry can be removed");
  /* a Shift board entry is kept once */
  const eng = { id: "e1", day: TODAY, time: "09:15", activity: "Chair yoga", participation: "joined", mood: "restless", note: "Needed a break" };
  let s = T.fromShift(T.blank("r1"), eng, NOW); s = T.fromShift(s, eng, NOW);
  ok(s.log.length === 1 && s.log[0].source === "shift" && s.log[0].slot === "morning", "a Shift board entry is kept once, in the right part of the day");
  /* a packet made */
  let pk = T.notePacket(T.blank("r1"), { pillars: ["words", "music", "chess"], names: ["Memory lane", "Finish the saying"], minutes: 45 }, NOW);
  ok(pk.packets.length === 1 && pk.packets[0].slot === "afternoon" && pk.packets[0].pillars.join() === "words,music", "a packet made is noted by day and part of the day");
  eq(T.daySummary(pk, TODAY)[1].state, "ready", "that part of the day reads packet made");
  pk = T.addEntry(pk, good, NOW).track; eq(T.daySummary(pk, TODAY)[1].state, "done", "taking part then settles it as done");
  pk = T.notePacket(pk, { pillars: ["words"], names: ["X"], minutes: 10 }, NOW); eq(T.daySummary(pk, TODAY)[1].state, "done", "a second packet never undoes a part of the day that is done");
  /* the limits */
  let big = T.blank("r1");
  for (let i = 0; i < 450; i++) big.log.push({ id: "x" + i, day: TODAY, slot: "morning", activity: "a", pillar: "", participation: "joined", mood: "", note: "", source: "record", ref: "", at: new Date(2026, 9, 20, 8, 0, i % 60).toISOString() });
  big = T.addEntry(big, good, NOW).track; ok(big.log.length <= 400, "the log is capped (" + big.log.length + ")");
  const old = T.normalize({ schema: T.SCHEMA, log: [{ day: "2026-01-01", slot: "morning", participation: "joined", activity: "old" }, { day: TODAY, slot: "morning", participation: "joined", activity: "new" }] }, "r1", TODAY);
  eq(old.log.map(e => e.activity), ["new"], "an entry older than 90 days is dropped");
}

/* ---------- 2. the suggested tier ---------- */
{
  const mk = (rows) => { let t = T.blank("r1"); rows.forEach((r, i) => { t.log.push({ id: "s" + i, day: day(Math.floor(i / 2)), slot: "afternoon", activity: "A" + i, pillar: "", participation: r[0], mood: r[1] || "", note: "", source: "record", ref: "", at: "2026-10-20T10:00:0" + (i % 10) }); }); return t; };
  const steady = Array(6).fill(["joined", "calm"]), unsettled = Array(6).fill(["joined", "restless"]), quiet = Array(6).fill(["watched", "tired"]), strong = Array(6).fill(["engaged", "happy"]);
  let g = T.suggestTier(T.blank("r1"), 2, TODAY);
  ok(g.tier === 2 && !g.changed && /Nothing has been recorded/.test(g.reasons.join(" ")), "with nothing recorded the profile's tier stands, and it says nothing has been recorded");
  ok(g.note === T.SUGGESTION_NOTE && /never changes anything by itself/.test(g.note), "every suggestion says it is only a suggestion");
  g = T.suggestTier(T.setStage(mk(steady), "5", NOW), 3, TODAY); ok(g.tier === 2 && g.changed && g.base === 2, "the stage sets the base: GDS 5 against a Tier 3 profile suggests Tier 2");
  ok(/GDS 5 is recorded/.test(g.reasons[0]), "and the first reason names the stage");
  g = T.suggestTier(mk(unsettled), 2, TODAY); ok(g.tier === 3 && g.changed && /restlessness/.test(g.reasons.join(" ")), "steady unsettled moods suggest one step more support, and say so");
  g = T.suggestTier(mk(quiet), 1, TODAY); ok(g.tier === 2, "watching or choosing another time most of the time suggests one step more support");
  g = T.suggestTier(mk(strong), 3, TODAY); ok(g.tier === 2 && /a little more detail/.test(g.reasons.join(" ")), "joining in fully and settled suggests one step more detail");
  g = T.suggestTier(mk(strong), 1, TODAY); ok(g.tier === 1 && !g.changed, "nobody is suggested below Tier 1");
  g = T.suggestTier(mk(unsettled), 3, TODAY); ok(g.tier === 3 && /most supported tier/.test(g.reasons.join(" ")), "nobody is suggested above Tier 3, and the calming steps are pointed to");
  g = T.suggestTier(mk(steady.slice(0, 3)), 2, TODAY); ok(g.tier === 2 && /too few/.test(g.reasons.join(" ")), "three sessions are too few to suggest a change");
  g = T.suggestTier(mk(Array(5).fill(["engaged", "happy"]).concat([["joined", "anxious"]])), 3, TODAY); ok(g.tier === 3, "one unsettled session among settled ones stops a step toward more detail");
  g = T.suggestTier(mk(steady), 2, TODAY); ok(g.tier === 2 && /no reason to change/.test(g.reasons.join(" ")), "steady, settled sessions give no reason to change");
  ok(["1", "2", "3"].every(x => { const s = T.suggestTier(T.blank("r1"), x, TODAY); return s.tier >= 1 && s.tier <= 3; }), "a tier is always 1 to 3");
  ok(T.suggestTier(T.blank("r1"), "banana", TODAY).tier === 2, "an unreadable profile tier reads as Tier 2");
}

/* ---------- 3. the staff companion ---------- */
{
  const acts = [{ name: "Memory lane", pillar: "words", minutes: 30 }, { name: "Coloring page", pillar: "coloring", minutes: 20 }, { name: "Beanbag targets", pillar: "movement", minutes: 20 }];
  const input = { alias: "Resident 302-B", day: TODAY, time: "13:30", stage: "5", tier: 2, activities: acts, avoid: ["war", "hospital"], comforts: ["Glenn Miller", "gardening"], facility: "Maple Grove" };
  const pages = S.build(input);
  eq(pages.map(p => p.kind), ["cover", "facilitation", "calm"], "three pages: cover, facilitation and calming");
  const cover = pages[0], facts = Object.fromEntries(cover.facts);
  ok(facts.Resident === "Resident 302-B" && /Tuesday, October 20, 2026/.test(facts.Date) && facts.Time === "1:30 PM", "the cover carries the alias, the date and the time");
  ok(/GDS 5 · Tier 2 \(guided\)/.test(facts["Stage and support"]), "and the stage with its tier");
  ok(/Reminiscence and language/.test(facts["Main focus"]) && /Visual and spatial|Movement/.test(facts["Main focus"]), "the main focus follows the minutes given to each area");
  eq(facts["About how long"], "About 70 minutes", "the time is the sum of the activities");
  ok(S.build(Object.assign({}, input, { stage: "" }))[0].facts[3][1].indexOf("not recorded") > 0, "with no stage, the cover says so and takes the tier from the profile");
  for (const tier of [1, 2, 3]) {
    const f = S.build(Object.assign({}, input, { tier }))[1], cues = f.groups[0].items;
    ok(cues.length === 4, `Tier ${tier}: four verbal cues (${cues.length})`);
    ok(f.groups.some(g => /errorless/i.test(g.heading)) && f.groups.some(g => /Person-centred/.test(g.heading)), `Tier ${tier}: validation and errorless learning are there`);
  }
  ok(S.CUES[1].join() !== S.CUES[3].join(), "each tier has its own cues");
  const calm = pages[2], calmText = JSON.stringify(calm);
  ok(/war and hospital/.test(calmText) && /Glenn Miller and gardening/.test(calmText), "the calming page carries what to steer around and what comforts, from the profile");
  ok(/call the nurse/.test(calmText) && /Shift board/.test(calmText), "and says what to do if anyone may be unsafe and where to write what helped");
  ok(/evening/.test(JSON.stringify(S.build(Object.assign({}, input, { time: "17:30" }))[2])) && /daytime/.test(calmText), "the orientation sentence follows the time of day");
  ok(/nothing to steer around/.test(JSON.stringify(S.build(Object.assign({}, input, { avoid: [] }))[2])), "no avoid list reads as nothing to steer around");
  /* never a name */
  ok(!/Margaret/.test(JSON.stringify(S.build(Object.assign({}, input, { alias: "Resident 302-B" })))), "no resident name is on any page");
  ok(S.build(Object.assign({}, input, { alias: "" }))[0].facts[0][1] === "Resident", "a missing alias reads as Resident");
  ok(S.build(Object.assign({}, input, { activities: [] }))[0].groups[0].items[0] === "No pages chosen yet.", "an empty packet still makes a cover");
  /* dignity: the clinical matrix's own lint, over every sentence */
  const CM = load("src/engine/ClinicalMatrix.js", "CognicopiaClinicalMatrix", { window: {} });
  const lint = CM && CM.dignity && CM.dignity.lint;
  if (lint) {
    const bad = []; for (const tier of [1, 2, 3]) for (const time of ["10:00", "16:30"]) S.sentences(S.build(Object.assign({}, input, { tier, time }))).forEach(x => { const r = lint(x); if (r && (r.length || r.ok === false)) bad.push(x + " :: " + JSON.stringify(r)); });
    ok(bad.length === 0, "every sentence passes the dignity rules: " + bad.slice(0, 3).join(" | "));
  } else {
    const BAD = /\b(wrong|incorrect|failed?|mistake|stupid|quiz|test(ing)? (them|your)|do you remember|remember when|try to remember|baby|sweetie|dearie|score)\b/i;
    const bad = S.sentences(pages).filter(x => BAD.test(x.replace(/Never say “wrong” or “not quite”\./, "")));
    ok(bad.length === 0, "no quizzing, testing or childish words: " + bad.slice(0, 3).join(" | "));
  }
}

/* ---------- 4. the same words as the Shift board, and no network ---------- */
{
  eq(T.PARTICIPATION.map(p => p.id + ":" + p.label), D.PARTICIPATION.map(p => p.id + ":" + p.label), "the four ways of taking part are the Shift board's own words");
  eq(T.MOODS.map(m => m.id + ":" + m.label + ":" + m.flag), D.MOODS.map(m => m.id + ":" + m.label + ":" + m.flag), "the moods are the Shift board's own words");
  ok(D.MOODS.some(m => m.id === "distracted" && m.flag) && D.MOODS.some(m => m.id === "overstimulated" && m.flag), "distracted and overstimulated are moods the next shift is told about");
  const NET = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket\b|new\s+EventSource\b|importScripts\s*\(/;
  for (const f of ["residentTracker", "staffCompanion"]) {
    ok(!NET.test(read("assets/services/" + f + ".js")), `${f}.js makes no network request`);
    ok(!/https?:\/\//.test(read("src/services/" + f + ".ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")), `${f}.ts names no outside address in its code`);
  }
}

console.log(problems.length ? `resident engine check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 40).join("\n  - ") : `resident engine check passed: ${passed} checks (the tracking record, the suggested tier, the staff companion, and the Shift board's own words)`);
process.exit(problems.length ? 1 : 0);
