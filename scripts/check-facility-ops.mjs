#!/usr/bin/env node
/* =====================================================================
   Checks for the facility operations services, in Node. Built-ins only; nothing is fetched. Part of npm test.

     1. privacy: the services that handle resident details (and every service they ship beside) make no network request: no fetch,
        XMLHttpRequest, sendBeacon, WebSocket, EventSource, importScripts or image/script URL to another site; the pages that use them
        load them from this site only and the service worker caches them
     2. census import: CSV (quotes, line breaks inside quotes, a byte-order mark, comma, semicolon, tab and pipe) and JSON; columns
        matched by name; tier from words, "Tier 2", GDS and FAST; life eras; interests matched to the profile's list; last names and
        full birth dates never kept; the plan (add, update, leave out) within a wing, never across wings; profiles that carry every
        field the rest of the product reads
     3. wings: a roster is one wing's residents; an unassigned resident is its own group
     4. export privacy: aliases replace names (an ambiguous name becomes "a resident"), "remove" also takes out rooms, towns, family
        names, notes and, in text, titled names, e-mail, phone numbers and dates; "keep" changes nothing; the original is never changed
     5. engagement and SBAR: records are normalized and bounded; the summary is arithmetic; the sheet is by alias; one wing's sheet
        never holds another's; an empty board still makes a sheet; old boards (no engagements, no wings) open unchanged
     6. SLP templates and EHR text: three domains, their goals and tasks, the codes usually considered (group sessions use 92508),
        plain-ASCII text that carries only what was recorded, the retired G0515 and the functional-reporting note
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

function load(file, global){
  const ctx = vm.createContext({ console, Date, Math, JSON, Object, Array, String, Number, RegExp, Map, Set, Error, Intl, parseInt, parseFloat, isFinite, isNaN, Uint8Array });
  ctx.globalThis = ctx;
  vm.runInContext(read(file).replace(/typeof globalThis !== "undefined" \? globalThis : this/, "globalThis"), ctx, { filename: file });
  return ctx[global];
}
const C = load("assets/services/censusImport.js", "CogniCensus");
const P = load("assets/services/privacyExport.js", "CogniPrivacy");
const D = load("assets/services/dailyOps.js", "CogniDailyOps");
const K = load("assets/services/slpClinicalService.js", "CogniClinical");

/* ---------- 1. privacy ---------- */
{
  const NET_CALLS = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket\b|new\s+EventSource\b|importScripts\s*\(/, NET = new RegExp(NET_CALLS.source + "|navigator\\.serviceWorker\\.register");
  for (const f of ["censusImport", "privacyExport", "dailyOps", "slpClinicalService", "facilityPlanner", "secureStore", "localDb"]) {
    ok(!NET.test(read("assets/services/" + f + ".js")), `${f}.js makes no network request`);
    ok(!/https?:\/\//.test(read("src/services/" + f + ".ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")), `${f}.ts names no outside address in its code`);
  }
  /* the audit of every storage handler: any file of the site that touches localStorage, sessionStorage or IndexedDB sends nothing anywhere */
  const SKIP = new Set([".git", "node_modules", "platform", "out", "license-service", "scripts", ".next"]), found = [];
  const walk = dir => { for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) { if (SKIP.has(e.name)) continue; const rel = path.posix.join(dir, e.name); if (e.isDirectory()) walk(rel); else if (/\.(html|js|ts)$/.test(e.name)) found.push(rel); } };
  walk("");
  const stores = found.filter(f => /indexedDB|localStorage|sessionStorage/.test(read(f)));
  ok(stores.length >= 30, `the audit found the storage handlers (${stores.length} files)`);
  const GUARDS = new Set(["resources/quality-standards/index.html", "resources/clinical-alignment/index.html"]);   // these pages replace fetch and XMLHttpRequest with refusals
  for (const f of stores) {
    const t = read(f).replace(/<script id="pdf(lib|font)">[\s\S]*?<\/script>/g, "");
    ok(GUARDS.has(f) || !NET_CALLS.test(t), `${f} touches browser storage and makes no network request`);
  }
  const builder = read("builder.html"), index = read("index.html"), sw = read("sw.js");
  for (const f of ["censusImport", "privacyExport"]) {
    ok(builder.includes(`<script src="assets/services/${f}.js"></script>`), `builder.html loads ${f}.js from this site`);
    ok(sw.includes(`"assets/services/${f}.js"`), `sw.js caches ${f}.js, so the module works offline`);
  }
  ok(index.includes('<script src="assets/services/privacyExport.js"></script>'), "index.html loads privacyExport.js");
  ok(/no analytics|No telemetry/i.test(builder) && /performance\.getEntriesByType\("resource"\)/.test(builder), "Settings carries the zero-telemetry statement and counts the page's own requests");
}

/* ---------- 2. census import ---------- */
const csv = '﻿Alias;Preferred Name;Last Name;Care Level (GDS);Life Era;Hobbies;Unit;Room;DOB\r\n"Resident 101-A";Dorothy;Smith;GDS 5;"1940s-1950s";"gardening; church choir, quilting";Memory Care Unit A;101-A;3/4/1938\r\n;Walter;Jones;3;40s;"fishing, Crosswords\nbird watching";Memory Care Unit A;102B;\r\nR103;;;Severe;1960s to 1980s;line dancing;Assisted Living B;;1951\r\n;;;;;;;;\r\nR104;Pat;;??;1920s;;MCU A;;';
const a = C.analyze(csv);
eq([a.format, a.problem, a.rows.length], ["csv", "", 4], "a messy semicolon CSV with a BOM, quotes, a line break in a cell and a blank row reads as four residents");
eq(a.rows.map(r => r.tier), [2, 1, 3, 2], "tiers: GDS 5 is Tier 2, GDS 3 is Tier 1, Severe is Tier 3, unreadable is Tier 2");
ok(a.rows[3].tierGiven === false && a.rows[3].notes.some(n => /not recognised/.test(n)), "an unreadable tier says so and is not claimed as given");
eq(a.rows[0].decades, ["1940s", "1950s"], "a decade range");
eq(a.rows[1].decades, ["1940s"], "a short decade (40s)");
eq(a.rows[2].decades, ["1960s", "1970s", "1980s"], "a range in words");
ok(a.rows[3].notes.some(n => /1920s/.test(n)), "a decade outside the supported ones is reported, not silently dropped");
ok(a.rows[0].hobbies.map(h => h.code).includes("faith") && a.rows[0].hobbies.map(h => h.code).includes("singing"), "church choir matches both faith and singing");
ok(a.rows[1].hobbies.map(h => h.code).includes("word-puzzles") && a.rows[1].hobbies.map(h => h.code).includes("birds"), "interests split on commas and line breaks");
eq([a.rows[0].birthYear, a.rows[2].birthYear], [1938, 1951], "a full date of birth is kept as a year only");
ok(a.droppedLastNames && a.droppedDates, "the import says last names and full dates were not kept");
eq([a.rows[0].wing, a.rows[0].unit], ["Memory Care Unit A", "101-A"], "wing and room are different columns");
ok(a.mapping.fields.tier === 3 && a.mapping.fields.wing === 6 && a.mapping.fields.unit === 7, "headers matched by name");
for (const [raw, header, want] of [["Tier 2", "", 2], ["Moderate", "", 2], ["Mild", "", 1], ["Advanced", "", 3], ["6a", "FAST", 3], ["7", "GDS", 3], ["4", "gds", 1], ["3", "Tier", 3], ["1", "Acuity", 1], ["Early", "", 1], ["Late stage", "", 3]])
  eq(C.tierFrom(raw, header).tier, want, `tier "${raw}" under "${header}"`);
eq(C.tierFrom("", "").tier, null, "an empty tier is not invented");
const j = C.analyze(JSON.stringify({ residents: [{ alias: "X1", name: "Ann", tier: "Tier 3", era: ["1950s"], interests: ["cooking", "birds"], wing: "B" }] }));
eq([j.format, j.rows[0].tier, j.rows[0].decades, j.rows[0].hobbies.map(h => h.code), j.rows[0].wing], ["json", 3, ["1950s"], ["cooking", "birds"], "B"], "a JSON census");
ok(C.analyze("").problem && C.analyze("a,b\n1,2").problem && C.analyze("{nope").problem, "an empty file, a file with no name column and broken JSON each say what is wrong");
ok(C.analyze("x".repeat(2100000)).problem, "a file over 2 MB is refused");
eq(C.analyze("Alias,Tier\n" + Array.from({ length: 2005 }, (_, i) => "R" + i + ",1").join("\n")).truncated, true, "more than 2,000 rows is read in part and says so");
const existing = [{ id: "res-1", tier1_core: { preferredName: "Dorothy", alias: "Resident 101-A", wing: "Memory Care Unit A" } }, { id: "res-9", tier1_core: { preferredName: "Walter", wing: "Assisted Living B" } }];
const plan = C.plan(a.rows, existing);
eq(plan.map(p => p.action), ["update", "add", "add", "add"], "the plan: Dorothy is updated, Walter in another wing is a new resident, never merged across wings");
eq(C.plan(a.rows, existing, "skip")[0].action, "skip", "leave existing residents as they are");
eq(C.plan(C.analyze("Alias,Wing\nA1,X\nA1,X\nA1,Y").rows, []).map(p => p.action), ["add", "duplicate", "add"], "the same alias twice in a wing is a repeat; in another wing it is not");
const prof = C.toProfile(a.rows[0], "res-new", new Date("2026-10-20T00:00:00Z"), null);
eq([prof.schema, prof.version, prof.tier1_core.cognitiveTier, prof.tier1_core.wing, prof.tier1_core.alias, prof.tier2_enrichment.meaningfulDecades], ["cognicopia.residentProfile", 2, 2, "Memory Care Unit A", "Resident 101-A", ["1940s", "1950s"]], "a profile from a row");
ok(prof.tier1_core.printNeeds && prof.tier1_core.topicsToAvoid && prof.tier3_deep.people && prof.tier2_enrichment.hometown, "the profile carries the fields the rest of the product reads");
ok(!JSON.stringify(prof).includes("Smith") && !JSON.stringify(prof).includes("1938-"), "a last name and a full date of birth are not in the profile");
const upd = C.toProfile(Object.assign({}, a.rows[0], { tierGiven: false }), "res-1", new Date(), { createdAt: "2026-01-01T00:00:00.000Z", tier1_core: { cognitiveTier: 3, nickname: "Dot" }, tier3_deep: { notes: "loves her sister" } });
eq([upd.tier1_core.cognitiveTier, upd.tier1_core.nickname, upd.tier3_deep.notes.startsWith("loves her sister"), upd.createdAt], [3, "Dot", true, "2026-01-01T00:00:00.000Z"], "an update keeps what the census does not carry");

/* ---------- 3. wings ---------- */
const people = [{ id: "a", tier1_core: { wing: "Memory Care Unit A" } }, { id: "b", tier1_core: { wing: " memory care unit a " } }, { id: "c", tier1_core: { wing: "Assisted Living B" } }, { id: "d", tier1_core: {} }];
eq(C.inWing(people, "Memory Care Unit A").map(p => p.id), ["a", "b"], "a wing is matched without regard to case or spacing");
eq(C.inWing(people, "").map(p => p.id), ["d"], "residents with no wing are their own group");
eq(C.inWing(people, null).length, 4, "no wing chosen shows every resident");
eq(C.wingsIn(people).wings.map(w => [w.name, w.count]), [["Assisted Living B", 1], ["Memory Care Unit A", 2]], "the wings found, with their counts");

/* ---------- 4. export privacy ---------- */
const profs = [{ id: "r1", tier1_core: { preferredName: "Dorothy Ann", nickname: "Dot", alias: "Resident 101-A", unitNumber: "101-A" }, tier2_enrichment: { birthYear: 1938, hometown: { place: "Fargo, ND" } }, tier3_deep: { notes: "loves her sister Jean", people: [{ name: "Jean", relationship: { code: "sister" } }] } },
  { id: "r2", tier1_core: { preferredName: "Dorothy", unitNumber: "102-B" } }];
const text = "Dot was calm after lunch. Dorothy Ann's tea; call Mrs. Alvarez at 701-555-0123 or a@b.org on 3/4/2026.";
const t1 = P.scrubText(text, profs, "alias").text;
ok(!/Dot\b|Dorothy Ann/.test(t1) && t1.includes("Resident 101-A's tea") && t1.includes("Mrs. Alvarez"), "aliases replace names and possessives, and leave a title the profiles do not know");
const t2 = P.scrubText(text, profs, "remove").text;
ok(!/Alvarez|555-0123|a@b\.org|3\/4\/2026/.test(t2), "remove also takes out a titled name, a phone number, an e-mail address and a date");
eq(P.scrubText(text, profs, "keep").text, text, "keep changes nothing");
eq(P.scrubText("Dorothy came", profs, "alias").text, "a resident came", "two residents who share a name become \"a resident\", never guessed between");
const orig = JSON.stringify(profs[0]), s1 = P.scrubProfile(profs[0], "remove");
eq(JSON.stringify(profs[0]), orig, "scrubbing never changes the original");
eq([s1.tier1_core.preferredName, s1.tier1_core.nickname, s1.tier1_core.unitNumber, s1.tier2_enrichment.birthYear, s1.tier2_enrichment.birthDecade, s1.tier2_enrichment.hometown.place, s1.tier3_deep.notes, s1.tier3_deep.people[0].name], ["Resident 101-A", "", "", undefined, "1930s", "", "", ""], "remove: alias, no room, a decade for a birth year, no town, no notes, no family names");
eq(P.scrubProfile(profs[0], "alias").tier1_core.unitNumber, "101-A", "aliases only: the room stays");
eq(P.levelOf("nonsense"), "alias", "an unknown choice is the careful one");
ok(P.choiceHtml("x", "remove").includes('value="remove" checked') && P.choiceHtml("x", "alias").split('type="radio"').length === 4, "the choice is three radio buttons with the current one checked");

/* ---------- 5. engagement and SBAR ---------- */
const now = new Date("2026-10-20T10:00:00");
const mk = i => D.makeEngagement(Object.assign({ day: "2026-10-20", time: "10:30", by: "MR", wing: "Memory Care Unit A" }, i), now).entry;
let board = D.emptyBoard();
board = D.withEngagement(board, mk({ resident: "Resident 101-A", activity: "Music circle", participation: "engaged", mood: "happy" }));
board = D.withEngagement(board, mk({ resident: "Resident 102-B", activity: "Music circle", participation: "watched", mood: "restless", note: "left after ten minutes" }));
board = D.withEngagement(board, mk({ resident: "Resident 102-B", activity: "Garden pictures", participation: "joined", mood: "calm" }));
board = D.withEngagement(board, Object.assign({}, mk({ resident: "Resident 201-A", activity: "Music circle", participation: "joined" }), { wing: "Assisted Living B", id: "e-other" }));
board = D.withNote(board, D.makeNote({ day: "2026-10-20", time: "11:00", kind: "watch", about: "Resident 102-B", text: "Restless after lunch; quiet music helped.", by: "MR", wing: "Memory Care Unit A" }, now).note);
board = D.withNote(board, D.makeNote({ day: "2026-10-20", time: "11:05", kind: "worked", about: "Resident 101-A", text: "Enjoyed the garden pictures.", by: "MR", wing: "Assisted Living B" }, now).note);
board = D.withTask(board, D.makeTask({ day: "2026-10-20", what: "Set up the music cart", by: "MR", wing: "Memory Care Unit A" }, now).task);
eq(D.makeEngagement({ day: "2026-10-20", by: "MR", resident: "R1", activity: "x", participation: "bogus" }, now).entry, null, "an engagement needs a valid way of taking part");
eq(D.makeEngagement({ day: "2026-10-20", by: "", resident: "R1", activity: "x", participation: "joined" }, now).problems[0], "Choose your initials first.", "an engagement needs initials");
const sb = D.sbar(board, "2026-10-20", "day", now, "Memory Care Unit A");
eq(sb.rows.map(r => [r.resident, r.levelLabel, r.flagged]), [["Resident 101-A", "Fully engaged", []], ["Resident 102-B", "Joined in", ["restless"]]], "the summary by resident: arithmetic of what was recorded");
ok(sb.situation[0].startsWith("2 residents have activity records") && /1 fully engaged, 1 joined in, 0 watched or listened, 0 chose another time/.test(sb.situation[0]), "the situation counts the levels");
ok(/Resident 102-B \(restless\)/.test(sb.situation[1]), "a mood to keep an eye on names the alias and the mood");
eq(sb.activities, ["Music circle: 2 residents, 1 joined in or more", "Garden pictures: 1 resident, 1 joined in or more"], "background: activities held, with counts");
const html = D.sbarPages(sb, { facility: "Maple Grove", today: "2026-10-20" }).join("");
ok(!/201-A|Assisted Living B/.test(html) && /Memory Care Unit A/.test(html), "one wing's sheet never holds another's residents or notes");
ok(/SBAR shift handoff/.test(html) && /S · Situation/.test(html) && /A · Assessment/.test(html) && /R · Recommendation/.test(html) && /Set up the music cart/.test(html), "the sheet has S, B, A and R and the open task");
eq(D.sbarPages(sb, { facility: "", today: "2026-10-20" }).length, 1, "a typical shift is one page");
ok(D.sbar(board, "2026-10-20", "day", now, "No such wing").empty && D.sbarPages(D.sbar(D.emptyBoard(), "2026-10-20", "day", now, null), { facility: "", today: "2026-10-20" }).length === 1, "an empty board still makes a one-page sheet");
const big = Array.from({ length: 60 }, (_, i) => mk({ resident: "Resident " + (300 + i), activity: "Music circle", participation: "joined", note: "x ".repeat(30) }));
let bb = D.emptyBoard(); big.forEach((e, i) => { bb = D.withEngagement(bb, Object.assign({}, e, { id: "big" + i })); });
ok(D.sbarPages(D.sbar(bb, "2026-10-20", "day", now, "Memory Care Unit A"), { facility: "", today: "2026-10-20" }).length >= 2, "a heavy shift runs to more pages rather than being cut off");
const old = D.normalizeBoard({ schema: "cognicopia.dailyOps", version: 1, keepDays: 14, staff: ["MR"], notes: [{ id: "n1", day: "2026-10-19", shift: "day", time: "09:00", kind: "pass", about: "", text: "Hello", by: "MR" }], tasks: [] });
eq([old.engagements, old.notes[0].wing], [[], ""], "an old board (no engagements, no wings) opens unchanged");
const pr = D.prune(D.setKeepDays(board, 7), "2026-12-01").board;
eq(pr.engagements.length, 0, "retention removes old engagement records with the notes");
const m1 = D.mergeBoards(D.emptyBoard(), board);
eq(m1.board.engagements.length, board.engagements.length, "a backup brings the engagement records across");
eq(D.engagementsFor(board, "2026-10-20", "day", "Memory Care Unit A").length, 3, "the board lists one wing's records only");

/* ---------- 6. SLP templates and EHR text ---------- */
eq(K.DOMAINS.map(d => d.id), ["auditory", "expressive", "executive"], "three domains");
ok(K.DOMAINS.every(d => d.goals.length >= 5 && d.tasks.length >= 5 && d.materials.length && d.codes.length && d.starters.S && d.starters.A && d.starters.P), "each domain has goals, tasks, materials, codes and starters");
ok(K.DOMAINS.every(d => d.goals.every(g => /^The resident will /.test(g)) && !d.goals.some(g => /\b(is unable|cannot|poor|deficit|refus|combative|non-?complian)/i.test(g))), "goals are written as what the resident will do, in plain words");
eq(K.domainCodes(["auditory", "executive"], "individual").map(c => c.code), ["92507", "97129", "97130"], "codes usually considered for two domains");
eq(K.domainCodes(["expressive"], "group").map(c => c.code), ["92508"], "a group session uses the group code");
eq(K.domainCodes(["executive"], "group").map(c => c.code), [], "the cognitive codes are one-on-one: none for a group");
eq(K.normalizeSession({ domains: ["auditory", "bogus", "auditory", "executive"] }).domains, ["auditory", "executive"], "domains are cleaned");
const sess = K.normalizeSession({ date: "2026-10-20", minutes: 30, clinician: "J. Lee", credentials: "CCC-SLP", domains: ["auditory", "executive"], goals: [K.DOMAINS[0].goals[0]], subjective: "Pleasant. “Ready” today – smiled", measures: [{ task: "One-step directions", trials: 10, correct: 8, cue: "minimal" }], codes: [{ code: "92507", units: 1 }, { code: "97129", units: 1 }, { code: "97130", units: 1 }] });
const parts = K.ehrParts(sess, { staging: { date: "2026-09-02", gds: "5", fast: "", recordedBy: "MD", note: "" } }, "Resident 101-A");
const txt = K.ehrText(parts);
ok(/^[\t\n\r\x20-\x7E]*$/.test(txt), "the EHR text is plain ASCII: no curly quotes, dashes or symbols a record could garble");
ok(txt.includes('"Ready" today - smiled') && txt.includes("Resident: Resident 101-A") && txt.includes("- One-step directions: 8 of 10 trials (80%), minimal cues."), "it carries what was recorded, with the arithmetic of the numbers");
ok(txt.includes("A (Assessment)\nNot recorded.") && txt.includes("92507 x1") && txt.includes("Focus: Auditory comprehension; Executive function") && txt.includes("GDS 5"), "an empty section says Not recorded; codes, focus and staging are carried");
ok(!/\b(improv|decline|regress|deteriorat|progress(ed|ing)?|should|recommend)/i.test(txt.replace(K.DOMAINS[0].goals[0], "")), "nothing was added that the clinician did not write");
ok(K.ascii("café “q” – a·b × …") === 'cafe "q" - a|b x ...', "ascii folding");
ok(K.checkSession(K.normalizeSession({ date: "2026-10-20", minutes: 30, clinician: "x", subjective: "[unfilled]", codes: [{ code: "G0515", units: 2 }] })).some(c => /blank/.test(c.text)) && K.checkSession(K.normalizeSession({ date: "2026-10-20", minutes: 30, clinician: "x", subjective: "ok", codes: [{ code: "G0515", units: 1 }] })).some(c => /Retired/.test(c.text)), "unfilled template blanks and the retired G0515 are flagged");
ok(K.checkSession(K.normalizeSession({ date: "2026-10-20", minutes: 45, clinician: "x", subjective: "ok", codes: [{ code: "97129", units: 3 }] })).some(c => /97130/.test(c.text)), "97129 is one unit; further time is 97130");
ok(/functional-reporting/.test(K.FUNCTIONAL_G_NOTE) && /2019/.test(K.FUNCTIONAL_G_NOTE), "the reference says functional-reporting G-codes ended in 2019");
const clin = read("builder.html");
ok(/\["all", "Copy the whole note"\]/.test(clin) && /data-copy="\$\{k\}"/.test(clin) && /navigator\.clipboard/.test(clin) && /clEhrNames/.test(clin), "the Session Notes screen can copy the whole note or one section, for the resident as chosen");

console.log(problems.length ? `facility operations check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 40).join("\n  - ") + (problems.length > 40 ? `\n  ... and ${problems.length - 40} more` : "")
  : `facility operations check passed: ${passed} checks (no network in the services; the census import, wings, export privacy, engagement records and the SBAR sheet, the SLP templates and EHR text)`);
process.exit(problems.length ? 1 : 0);
