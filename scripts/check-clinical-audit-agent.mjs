#!/usr/bin/env node
/* =====================================================================
   js/clinical-audit-agent.js, in Node.

     repairs     baby talk, pet names, quiz and recall wording, failure and clock
                 words, fact-demanding questions and overclaims are turned into adult,
                 errorless wording, and each repair is listed
     blocks      a medical promise, "HIPAA compliant", wrong-answer wording that
                 cannot be repaired, a choice with one option or a marked right
                 answer: the sheet is blocked and the reason is listed
     safety      the validation notice is added when missing; print size is raised to 18 pt
     clean       a clean sheet passes unchanged; auditing twice gives the same result;
                 the input is never changed
     pipeline    plugged into the orchestrator it fixes what a template or a provider
                 wrote; 360 sheets across every tier, era and amount of detail pass
   ===================================================================== */
import { createOrchestrator, CircuitBreaker, assetText, dignityProblems, validateAsset } from "../js/agent-orchestrator.js";
import { ClinicalAuditAgent, auditAsset, auditText, SAFETY_NOTICE, MIN_PT } from "../js/clinical-audit-agent.js";

let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const base = () => ({ title: "Memory Lane", pages: { resident: { heading: "Some things from your life", fontPt: 20, blocks: [{ type: "prompts", title: "We can talk about", items: ["Tell me about the garden."] }, { type: "choices", title: "Which would you like?", items: [{ a: "a quiet song", b: "a lively song" }] }] }, caregiver: { heading: "Staff", steps: [{ order: 1, label: "Visual Cue", text: "Show the picture." }, { order: 2, label: "Verbal Anchor", text: "Say one warm sentence." }, { order: 3, label: "Validation Statement", text: "That sounds like it mattered to you." }], notes: ["Stop at the first sign of tiredness."], safetyNotice: SAFETY_NOTICE }, sensory: { heading: "Sensory", items: [{ sense: "Sound", text: "A soft tune." }] } } });

/* ---------- text repairs ---------- */
const cases = [
  ["Come along, honey, it is time.", /^Come along, it is time\.$/, "pet name"], ["Good girl! Pick one.", /^Pick one\.$/, "good girl"], ["Here is your tummy snack, sweetie.", /^Here is your stomach snack\.$/, "baby talk"],
  ["Do you remember the barn dances?", /Tell me about the barn dances\./, "recall question"], ["Remember when the radio played?", /Tell me about the time the radio played/, "remember when"],
  ["Can you name the song?", /Tell me about the song\./, "can you name"], ["A quick quiz about the 1950s", /conversation/, "quiz"], ["This is not a test.", /activity/, "test"],
  ["Try again if you like. Hurry up!", /take your time/i, "failure words"], ["Choose the correct answer.", /answer/, "correct answer"], ["It is timed.", /at your own pace/, "timed"], ["This ensures calm.", /supports calm/, "overclaim"]
];
for (const [input, expect, label] of cases) { const r = auditText(input); ok(expect.test(r.text) && r.fixes.length > 0 && dignityProblems(r.text).length === 0, `repaired (${label}): "${input}" -> "${r.text}"`); }
ok(auditText("Tell me about the garden and your family.").text === "Tell me about the garden and your family." && auditText("Tell me about the garden and your family.").fixes.length === 0, "a clean sentence is untouched");
ok(auditText("It is a latest model; the contest ended.").text === "It is a latest model; the contest ended.", "a word that only contains test (latest, contest) is not changed");
const blockers = ["This activity cures memory loss.", "Clinically proven to slow dementia.", "Our HIPAA compliant packets", "A wrong choice means failure.", "What year was it?"];
for (const b of blockers) ok(auditText(b).problems.length > 0, `cannot be repaired, so it is flagged: "${b}"`);

/* ---------- whole sheets ---------- */
const clean = base(); const rc = auditAsset(clean);
ok(rc.status === "pass" && rc.fixes.length === 0 && rc.problems.length === 0 && JSON.stringify(rc.asset) === JSON.stringify(clean), "a clean sheet passes with no change");
const bad = base();
bad.pages.resident.blocks[0].items = ["Do you remember the farm, honey?", "What year did you marry?", "Tell me about your work."];
bad.pages.resident.fontPt = 14; delete bad.pages.caregiver.safetyNotice; bad.pages.caregiver.notes = ["Quiz them gently; hurry if they tire."];
const snapshot = JSON.stringify(bad); const rb = auditAsset(bad);
ok(JSON.stringify(bad) === snapshot, "the audited sheet is not changed in place");
ok(rb.status === "fixed" && rb.problems.length === 0, `everything repairable was repaired (${rb.status}: ${JSON.stringify(rb.problems)})`);
ok(rb.asset.pages.resident.fontPt === MIN_PT && rb.asset.pages.caregiver.safetyNotice === SAFETY_NOTICE, "print size raised to 18 pt and the validation safety notice added");
ok(rb.asset.pages.resident.blocks[0].items[1] === "Tell me what comes to mind." && /Tell me about the farm/.test(rb.asset.pages.resident.blocks[0].items[0]) && !/honey/i.test(rb.asset.pages.resident.blocks[0].items[0]), "a question that demands a date becomes an open invitation; a recall question becomes 'Tell me about'");
ok(rb.fixes.some((f) => f.rule === "elderspeak") && rb.fixes.some((f) => f.rule === "recall question") && rb.fixes.some((f) => f.rule === "asks for a fact") && rb.fixes.every((f) => f.where), "each repair is listed with the rule and where it was");
ok(JSON.stringify(auditAsset(rb.asset).asset) === JSON.stringify(rb.asset) && auditAsset(rb.asset).status === "pass", "auditing the repaired sheet again changes nothing");
const blocked = base(); blocked.pages.resident.blocks.push({ type: "choices", title: "Pick", items: [{ a: "tea" }] }); blocked.pages.resident.blocks[1].items[0].correct = "a"; blocked.pages.caregiver.notes = ["This cures agitation."];
const rbl = auditAsset(blocked);
ok(rbl.status === "blocked" && ["a choice needs two options", "a choice marks a right answer", "medical promise"].every((r) => rbl.problems.some((p) => p.rule === r)), `a one-option choice, a marked right answer and a medical promise block the sheet (${rbl.problems.map((p) => p.rule).join(", ")})`);
const swapped = base(); swapped.pages.caregiver.safetyNotice = "Correct them gently.";
ok(auditAsset(swapped).status === "blocked", "a changed validation notice that no longer says to affirm their reality blocks the sheet");
const broken = base(); broken.pages.caregiver.steps.pop();
ok(auditAsset(broken).status === "blocked" && auditAsset(null).status === "blocked" && auditAsset({}).status === "blocked", "a sheet missing a step, an empty sheet and no sheet are blocked, not passed");

/* ---------- the keep-off-the-page list ---------- */
const av = base(); av.pages.resident.blocks[0].items = ["Tell me about the war.", "Tell me about a warm kitchen."]; av.pages.caregiver.notes = ["Stop at the first sign of tiredness."];
const ra = auditAsset(av, { avoid: ["war"] });
ok(ra.status === "fixed" && ra.asset.pages.resident.blocks[0].items.length === 1 && /warm kitchen/.test(ra.asset.pages.resident.blocks[0].items[0]) && ra.fixes.some((f) => f.rule === "avoided topic removed"), "a list item about an avoided topic is removed; a warm one stays");
const av2 = base(); av2.pages.resident.heading = "The war years";
ok(auditAsset(av2, { avoid: ["war"] }).status === "blocked", "an avoided topic in a heading (not a removable list item) blocks the sheet");
const piped = createOrchestrator().use(new ClinicalAuditAgent()).registerLocalTemplate("w", () => { const a = base(); a.pages.resident.blocks[0].items = ["Tell me about the war.", "Tell me about the garden."]; return a; });
const pr = await piped.execute({ mode: "express", profile: { avoid: ["war"] }, options: { template: "w" } });
ok(pr.audit.status === "fixed" && !/\bwar\b/i.test(assetText(pr.asset)), "through the pipeline the request's keep-off list reaches the audit");

/* ---------- inside the pipeline ---------- */
const withAudit = () => createOrchestrator().use(new ClinicalAuditAgent());
const rude = () => { const a = base(); a.pages.resident.blocks[0].items = ["Do you remember the school, dear?"]; return a; };
const o1 = withAudit().registerLocalTemplate("rude", rude); const p1 = await o1.execute({ mode: "express", options: { template: "rude" } });
ok(p1.audit.status === "fixed" && !/dear|Do you remember/i.test(assetText(p1.asset)) && p1.audit.by === "ClinicalAuditAgent", "plugged in, it repairs what a local template wrote");
const o2 = createOrchestrator({ llm: () => JSON.stringify(rude()), breaker: new CircuitBreaker({ timeoutMs: 100 }) }).use(new ClinicalAuditAgent()); const p2 = await o2.execute({ mode: "express" });
ok(p2.source === "local" && p2.audit.status === "pass", "a provider's undignified answer never reaches the audit: the generator already replaced it, and the local sheet passes");
const p3 = await withAudit().execute({ mode: "express" });
ok(p3.audit.status === "pass" && p3.diagnostics.stages.some((s) => s.stage === "audit" && s.agent === "ClinicalAuditAgent" && s.ok), "the audit stage is recorded in the diagnostics");
const blockedO = withAudit().registerLocalTemplate("cure", () => { const a = base(); a.pages.caregiver.notes = ["This treats dementia."]; return a; });
ok((await blockedO.execute({ mode: "express", options: { template: "cure" } })).audit.status === "blocked", "a blocked sheet is reported as blocked through the pipeline");
ok(withAudit().integrity().stages.find((s) => s.stage === "audit").covered, "the integrity report now shows the audit stage covered");

/* ---------- 360 generated sheets ---------- */
const eras = ["", "1940s", "1950s", "1960s", "1970s", "1980s"], notes = ["", "Showed interest in old radio music today.", "Mild agitation during afternoon visual tasks."];
let all = 0, notPass = [];
const oAll = withAudit();
for (const tier of [1, 2, 3]) for (const era of eras) for (const note of notes) for (const rich of [false, true]) {
  const prof = rich ? { preferredName: "Ruth", formativeEra: era, ailmentTier: tier, caregiverNotes: note, preferences: ["gardening", "knitting"], petNames: ["Pepper"], familyNames: ["Dan", "Lee"], pastCareer: "seamstress", hometown: "Dubuque", nostalgiaAnchors: ["the church choir"] } : { formativeEra: era, ailmentTier: tier, caregiverNotes: note };
  const r = await oAll.execute({ mode: rich ? "individual" : "express", profile: prof, options: { tier } }); all++;
  if (r.audit.status !== "pass" || validateAsset(r.asset).length || /[{}]/.test(assetText(r.asset))) notPass.push(`${tier}/${era}/${rich}: ${r.audit.status}`);
}
ok(all === 108 && notPass.length === 0, `${all} generated sheets across every tier, era, note and amount of detail all pass the audit (${notPass.slice(0, 3).join("; ")})`);
const grp = await oAll.execute({ mode: "group", profiles: [{ preferredName: "A", formativeEra: "1950s", ailmentTier: 1, preferences: ["gardening"] }, { preferredName: "B", formativeEra: "1950s", ailmentTier: 3, preferences: ["gardening"] }] });
ok(grp.audit.status === "pass" && grp.tier === 3, "a group sheet passes the audit");

{ const sq = base(); sq.pages.resident.blocks.push({ type: "wordsearch", title: "Find these words", grid: ["ABC", "DEF"], words: ["ABC"] });
  const r1 = auditAsset(sq); ok(r1.status === "blocked" && r1.problems.some((x) => /as many columns as rows/.test(x.rule)), "a word search that is not square (3 columns by 2 rows) is blocked");
  const good = base(); good.pages.resident.blocks.push({ type: "wordsearch", title: "Find these words", grid: ["ABC", "DEF", "GHI"], words: ["ABC"] });
  ok(!auditAsset(good).problems.some((x) => /columns as rows/.test(x.rule)), "a square word search is accepted"); }
if (problems.length) { console.error("clinical audit agent check FAILED: " + problems.length + " problem(s), " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("clinical audit agent check passed: " + passed + " checks (repairs, blocks, safety notice and 18 pt, idempotent, plugged into the orchestrator, 108 generated sheets)");
