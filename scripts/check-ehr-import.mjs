#!/usr/bin/env node
/* js/ehr-import.js in Node, with made-up residents only: the two export styles, the column guess, the columns that are never used, first names only,
   wing and room tags, scores to a starting tier, update-versus-add, and what is written. */
await import("../assets/services/censusImport.js");
import * as E from "../js/ehr-import.js";
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const pcc = `Resident Name,Room/Bed,Unit,Care Level,BIMS,DOB,SSN,MRN,Primary Diagnosis,Admit Date,Responsible Party Phone,Hobbies
"Testwell, Dorothy A.",101-A,Memory Care A,Moderate,9,03/14/1936,000-00-0000,A123456,F03.90,2023-02-01,555-0100,gardening; baking
"Testwell, Walter",102-B,Memory Care A,,14,1/2/1941,000-00-0001,A123457,I10,2022-06-11,555-0101,fishing; baseball
"Example, Rose",201,Assisted Living B,GDS 5,,,,,,,,knitting
"Sample, June",202,Assisted Living B,,4,1/1/1930,,,,,,
`;
const t = E.read(pcc);
ok(t.ok && t.headers.length === 12 && t.rows.length === 4, "a PointClickCare-style CSV is read (" + t.rows.length + " residents)");
ok(E.detectSystem(t.headers) === "pointclickcare", "the system is guessed from the column names (" + E.detectSystem(t.headers) + ")");
const m = E.suggest(t.headers, "pointclickcare"), F = m.fields;
ok(F.name === 0 && F.room === 1 && F.wing === 2 && F.tier === 3 && F.score === 4 && F.birth === 5 && F.interests === 11, "name, room, unit, care level, score, birth date and hobbies are matched (" + JSON.stringify(F) + ")");
const ig = m.ignored.map((x) => x.header);
ok(["SSN", "MRN", "Primary Diagnosis", "Responsible Party Phone", "Admit Date"].every((h) => ig.includes(h)) && !ig.includes("Resident Name"), "SSN, record number, diagnosis, family phone and admit date are ignored (" + ig.join(", ") + ")");
ok(!Object.values(F).some((i) => ig.includes(t.headers[i])), "no ignored column is also mapped to a field");
const pv = E.preview(t, m, { existing: [] });
ok(pv.ok && pv.counts.add === 4 && pv.analysis.rows.map((r) => r.preferredName).join() === "Dorothy,Walter,Rose,June", "four residents would be added, by first name only (" + (pv.analysis.rows || []).map((r) => r.preferredName) + ")");
ok(!JSON.stringify(pv.analysis.rows).match(/Testwell|Example|Sample|000-00|A123456|F03|555-01|03\/14/), "no last name, number, diagnosis, phone or full birth date reaches the profile rows");
ok(pv.analysis.rows[0].wing === "Memory Care A" && pv.analysis.rows[0].unit === "101-A" && pv.analysis.rows[2].wing === "Assisted Living B", "wing and room tags come from the Unit and Room/Bed columns");
ok(pv.analysis.rows.map((r) => r.tier).join() === "2,1,2,3" && pv.report.tiersFromScore === 2 && pv.report.noTier === 0, "care level and GDS give tier 2; BIMS 14 gives 1 and BIMS 4 gives 3 ("  + pv.analysis.rows.map((r) => r.tier) + ")");
ok(pv.report.lastNamesDropped && pv.report.datesReduced && pv.report.wings.join() === "Assisted Living B,Memory Care A" && pv.report.rooms === 4, "the report says last names were dropped, dates reduced to a year, and lists both wings");
ok(pv.analysis.rows[0].birthYear === 1936 && pv.analysis.rows[0].decades.length > 0, "only the birth year is kept, and it gives the life era");
const alias = E.preview(t, m, { nameMode: "alias" });
ok(alias.analysis.rows.every((r) => /^Resident /.test(r.preferredName)) && alias.report.lastNamesDropped, "alias-only mode keeps no name at all");
const wn = E.preview(t, m, { wingNames: { "memory care a": "Memory Care Unit A" }, defaultWing: "Main Building" });
ok(wn.report.wings.includes("Memory Care Unit A") && !wn.report.wings.includes("Memory Care A"), "a wing can be renamed to the facility's own name");
const noWing = E.suggest(["Name", "Room"], "other"); const nw = E.preview({ headers: ["Name", "Room"], rows: [["Ann Lee", "5"]] }, noWing, { defaultWing: "North" });
ok(nw.analysis.rows[0].wing === "North" && nw.analysis.rows[0].preferredName === "Ann", "a file with no unit column takes the wing chosen for the whole import");

const mat = `Resident,Apartment,Neighborhood,Level of Care,MoCA,Date of Birth,Insurance Number,Emergency Contact
Mr. Harold Sampleton,12,The Meadows,Memory Care,12,1938-05-02,Z9,Jan
Betty Sampleton,14,The Meadows,,21,1940-09-09,Z8,Tom
`;
const t2 = E.read(mat), m2 = E.suggest(t2.headers, E.detectSystem(t2.headers));
ok(E.detectSystem(t2.headers) === "matrixcare" && m2.fields.wing === 2 && m2.fields.room === 1 && m2.fields.name === 0, "a MatrixCare-style export is recognised and its neighborhood becomes the wing (" + E.detectSystem(t2.headers) + ")");
ok(m2.ignored.map((x) => x.header).sort().join() === "Emergency Contact,Insurance Number", "insurance and emergency contact are ignored");
const p2 = E.preview(t2, m2, {});
ok(p2.analysis.rows.map((r) => r.preferredName).join() === "Harold,Betty" && p2.analysis.rows.map((r) => r.tier).join() === "2,1", "titles are dropped, and a MoCA of 12 gives Tier 2 while 21 gives Tier 1 (" + p2.analysis.rows.map((r) => r.tier) + ")");

ok(E.firstNameOf("Smith, Mary Ann") === "Mary" && E.firstNameOf("Mrs. Mary Smith") === "Mary" && E.firstNameOf("mary") === "Mary" && E.firstNameOf("") === "", "first names come out of Last, First and First Last forms");
ok(E.tierFromScore("moca", 18) === 1 && E.tierFromScore("moca", 17) === 2 && E.tierFromScore("moca", 9) === 3 && E.tierFromScore("bims", "13") === 1 && E.tierFromScore("bims", 7) === 3 && E.tierFromScore("mmse", 99) === 0 && E.tierFromScore("mmse", "n/a") === 0, "score bands give a starting tier, and out-of-range or missing scores give none");

/* writing and updating */
const saved = new Map(); const wrote = E.apply(pv.items, [], (id, p) => saved.set(id, p));
ok(wrote.added === 4 && wrote.updated === 0 && saved.size === 4 && [...saved.values()].every((p) => p.schema === "cognicopia.residentProfile" && p.tier1_core.wing), "four profiles are written, each with its wing");
ok(![...saved.values()].some((p) => /Testwell|Example|Sample|000-00|F03/.test(JSON.stringify(p))), "nothing sensitive is in a saved profile");
const existing = [...saved.values()], again = E.preview(t, m, { existing });
ok(again.counts.update === 4 && again.counts.add === 0, "importing the same file again updates the same residents (no duplicates)");
const skip = E.preview(t, m, { existing, mode: "skip" }); ok(skip.counts.update === 0 && skip.counts.skip === 4, "the 'leave existing alone' choice skips them");
ok(E.apply(again.items, existing, () => { throw new Error("full"); }).failed === 4, "a full or blocked store is counted, not thrown");

/* bad files */
ok(!E.read("").ok && !E.read("Name,Room").ok && !E.read("Name,Room\n,,\n").ok && !E.read("x".repeat(2100000)).ok, "an empty file, a header with no residents and an oversized file are each refused with a plain message");
ok(!E.preview({ headers: ["Foo"], rows: [["a"]] }, E.suggest(["Foo"], "other"), {}).ok, "with no name or room column the wizard asks for one");
const json = E.read(JSON.stringify([{ "Resident Name": "Doe, Pat", Room: "7", Unit: "East" }])); ok(json.ok && E.preview(json, E.suggest(json.headers, "other")).analysis.rows[0].wing === "East", "a JSON export works the same way");
const big = "Name,Room\n" + Array.from({ length: 2100 }, (_, i) => "A B," + i).join("\n"); const rb = E.read(big); ok(rb.ok && rb.truncated && rb.rows.length === 2000, "a very long list is cut at 2,000 residents and says so");
const inj = E.preview({ headers: ["Name", "Room", "Unit"], rows: [["<b>Zed</b> Q", "1;\"2", "=cmd|' /c calc'!A0"]] }, E.suggest(["Name", "Room", "Unit"], "other"), {});
ok(inj.ok && !/[<>]/.test(JSON.stringify(inj.analysis.rows)), "markup in a cell is stripped");

if (problems.length) { console.error("EHR import check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("EHR import check passed: " + passed + " checks (system guess, column match, ignored columns, first names only, wing and room tags, scores to tiers, update versus add, bad files)");
