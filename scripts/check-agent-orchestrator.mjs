#!/usr/bin/env node
/* =====================================================================
   js/agent-orchestrator.js, in Node (no browser needed).

     modes        express works with no data at every tier; individual puts the
                  resident's own details in; group uses only what residents share
                  and the gentlest tier, and names no one
     sheets       always valid (three pages, the three steps in order, a safety
                  notice), print type 18 pt or more, no brace left, nothing that
                  tests or corrects, and the same input gives the same sheet
     breaker      a provider that is slow (past the limit), fails, answers badly or
                  answers undignified text is replaced at once by the local sheet;
                  after three failures it is not even called until the cool-down
                  ends, then one probe decides; the default limit is 2,500 ms
     privacy      the prompt a provider gets holds no name, hometown, career or note;
                  the diagnostic record holds only tier, timings, source and the
                  offline state
   ===================================================================== */
import { createOrchestrator, CircuitBreaker, CognicopiaAgent, DiagnosticLog, GenerationAgent, normalizeProfile, normalizeTier, substitute, dignityProblems, validateAsset, assetText, sharedThemes, LLM_TIMEOUT_MS, MODES, STAGES } from "../js/agent-orchestrator.js";

let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MARGARET = { preferredName: "Margaret", formativeEra: "1950s", ailmentTier: 2, preferences: ["gardening", "old radio music"], caregiverNotes: "Showed interest in old radio music today. Mild agitation during afternoon visual tasks.", familyNames: ["Walter", "Susan"], spouse: "Walter", petNames: ["Biscuit"], pastCareer: "schoolteacher", hometown: "Cedar Falls", nostalgiaAnchors: ["Sunday radio programs"] };
const SECRETS = ["Margaret", "Walter", "Susan", "Biscuit", "schoolteacher", "Cedar Falls", "agitation"];
const goodAsset = (title = "A sheet for {name}") => ({ title, pages: { resident: { heading: "h", blocks: [{ type: "prompts", title: "t", items: ["Tell me about {hometown}."] }] }, caregiver: { steps: [{ order: 1, label: "Visual Cue", text: "Show the picture." }, { order: 2, label: "Verbal Anchor", text: "Say one warm sentence." }, { order: 3, label: "Validation Statement", text: "That sounds like it mattered." }], safetyNotice: "Affirm the resident's lived reality; never debate historical facts." }, sensory: { items: [{ sense: "Sound", text: "A soft tune." }] } } });

/* ---------- profiles and tokens ---------- */
ok(normalizeTier("early") === 1 && normalizeTier("Moderate") === 2 && normalizeTier(3) === 3 && normalizeTier("nonsense") === 2 && normalizeTier(undefined, 3) === 3, "tier names and numbers are understood, and a bad value takes the fallback");
const messy = normalizeProfile({ preferredName: "  Ann\u0007\u0000  ", formativeEra: 1938, ailmentTier: "late", familyNames: "Tom, tom, Ruth; ", petNames: 42, caregiverNotes: "x".repeat(9000), hometown: { bad: true }, pastCareer: null });
ok(messy.name === "Ann" && messy.era === "1950s" && messy.tier === 3 && messy.family.length === 2 && messy.notes.length === 4000, "a messy profile is cleaned: control characters, a birth year turned into an era, duplicates, a cap on long notes");
ok(normalizeProfile(undefined).hasData === 0 && normalizeProfile("text").hasData === 0 && normalizeProfile([]).tier === 2, "no profile, a string or an array is an empty profile, not an error");
ok(substitute("Hello {name}, and {pets}. {nothing}", { name: "Ann" }) === "Hello Ann, and your pets. ", "a token with no value takes a neutral phrase; an unknown token vanishes; no brace is left");

/* ---------- the three modes ---------- */
const o = createOrchestrator();
for (const tier of [1, 2, 3]) {
  const r = await o.execute({ mode: "express", options: { tier } });
  const text = assetText(r.asset);
  ok(r.ok && r.mode === "express" && r.tier === tier && r.source === "local" && r.diagnostics.reason === "no_provider", `express tier ${tier}: answered locally with nothing known`);
  ok(validateAsset(r.asset).length === 0 && r.asset.pages.resident.fontPt >= 18 && !/[{}]/.test(text) && dignityProblems(text).length === 0, `express tier ${tier}: a valid, large-print, brace-free, dignified sheet`);
  ok(r.asset.pages.caregiver.safetyNotice === "Affirm the resident's lived reality; never debate historical facts.", `express tier ${tier}: the safety notice is printed`);
}
ok((await o.execute({ mode: "express", options: { tier: 3 } })).asset.pages.resident.fontPt === 24 && (await o.execute({ mode: "express", options: { tier: 1 } })).asset.pages.resident.fontPt === 18, "print size grows with the tier (18, 20, 24 pt)");
const ind = await o.execute({ mode: "individual", profile: MARGARET });
const indText = assetText(ind.asset);
ok(ind.ok && ind.mode === "individual" && indText.includes("Margaret") && /Biscuit|Cedar Falls|schoolteacher|Sunday radio/.test(indText), "individual: the resident's own details are on the sheet");
ok(!/[{}]/.test(indText) && dignityProblems(indText).length === 0 && validateAsset(ind.asset).length === 0, "individual: no brace, nothing that tests, a valid sheet");
ok(/unease|quiet/i.test(indText), "individual: a note about agitation makes the staff page recommend a quiet room");
ok(JSON.stringify((await o.execute({ mode: "individual", profile: MARGARET })).asset) === JSON.stringify(ind.asset), "the same input gives the same sheet");
ok((await o.execute({ profile: MARGARET })).mode === "individual" && (await o.execute({})).mode === "express" && (await o.execute({ profiles: [MARGARET, { ...MARGARET, preferredName: "Joan" }] })).mode === "group", "with no mode given: a rich profile is individual, nothing is express, two profiles are a group");
const exp = await o.execute({ mode: "express", profile: MARGARET, options: { tier: 2 } });
ok(!/Margaret|Biscuit|Cedar Falls/.test(assetText(exp.asset)), "express ignores personal details even when a profile is passed");

const JOAN = { preferredName: "Joan", formativeEra: "1950s", ailmentTier: 3, preferences: ["gardening"], hometown: "Dayton", petNames: ["Rex"], pastCareer: "nurse" };
const BOB = { preferredName: "Bob", formativeEra: "1950s", ailmentTier: 1, preferences: ["gardening", "baseball"], hometown: "Akron", nostalgiaAnchors: ["Sunday radio programs"] };
const grp = await o.execute({ mode: "group", profiles: [MARGARET, JOAN, BOB] });
const gText = assetText(grp.asset);
ok(grp.ok && grp.mode === "group" && grp.tier === 3, "group: planned for the gentlest tier present, so everyone can take part");
ok(!/Margaret|Joan|Bob|Biscuit|Rex|Cedar Falls|Dayton|Akron|schoolteacher|nurse/.test(gText), "group: no resident's name or private detail is on the shared sheet");
ok(sharedThemes([normalizeProfile(MARGARET), normalizeProfile(JOAN), normalizeProfile(BOB)]).some((s) => s.kind === "interest" && s.key === "gardening" && s.count === 3) && /garden/i.test(gText), "group: a shared interest (gardening, all three) is found and used");
ok((await o.execute({ mode: "group", profiles: [MARGARET] })).mode === "individual", "a group of one is treated as one resident");
ok((await o.execute({ mode: "bogus" })).ok === false, "an unknown mode is refused, not guessed");

/* ---------- the breaker, with the provider failing in every way ---------- */
ok(LLM_TIMEOUT_MS === 2500 && new CircuitBreaker().timeoutMs === 2500, "the default limit is 2,500 ms");
const make = (llm, bo = {}) => createOrchestrator({ llm, breaker: new CircuitBreaker({ timeoutMs: 60, cooldownMs: 1000, ...bo }) });
let t = Date.now(); let r = await make(() => sleep(400)).execute({ mode: "express" });
ok(r.source === "local" && r.diagnostics.reason === "timeout" && Date.now() - t < 300 && validateAsset(r.asset).length === 0, `a slow provider: answered from the local sheet at about the limit (${Date.now() - t} ms)`);
r = await make(() => { throw new Error("offline"); }).execute({ mode: "express" });
ok(r.source === "local" && r.diagnostics.reason === "error", "a provider that throws: answered locally");
r = await make(() => Promise.reject(new Error("503"))).execute({ mode: "express" });
ok(r.source === "local" && r.diagnostics.reason === "error", "a provider that rejects: answered locally");
r = await make(() => "not json").execute({ mode: "express" });
ok(r.source === "local" && r.diagnostics.reason === "invalid_response", "an unreadable answer: answered locally");
r = await make(() => ({ title: "x", pages: {} })).execute({ mode: "express" });
ok(r.source === "local" && r.diagnostics.reason === "invalid_response", "an answer missing the three steps or the safety notice: answered locally");
const rude = goodAsset(); rude.pages.resident.blocks[0].items = ["Do you remember what year it was? Try again."];
r = await make(() => rude).execute({ mode: "express" });
ok(r.source === "local" && r.diagnostics.reason === "dignity_failed", "an answer that tests or corrects is thrown away");
r = await make(() => JSON.stringify(goodAsset())).execute({ mode: "individual", profile: MARGARET });
ok(r.source === "llm" && r.diagnostics.reason === "" && r.asset.title === "A sheet for Margaret" && assetText(r.asset).includes("Cedar Falls"), "a good provider is used, and the names are put back here from tokens");

/* three failures open the breaker: no call, no wait, until the cool-down; then one probe */
let calls = 0, clockMs = 0;
const flaky = () => { calls++; throw new Error("down"); };
const oc = createOrchestrator({ llm: flaky, breaker: new CircuitBreaker({ timeoutMs: 50, failureThreshold: 3, cooldownMs: 5000, now: () => clockMs }) });
for (let i = 0; i < 3; i++) await oc.execute({ mode: "express" });
ok(calls === 3 && oc.generator.breaker.state() === "open", "after three failures in a row the breaker is open");
t = Date.now(); r = await oc.execute({ mode: "express" });
ok(calls === 3 && r.source === "local" && r.diagnostics.reason === "breaker_open" && r.diagnostics.breaker === "open" && Date.now() - t < 50, "open: the provider is not called and the local sheet comes straight back");
clockMs = 5001; ok(oc.generator.breaker.state() === "half-open", "after the cool-down the breaker allows one probe");
oc.generator.llm = () => { calls++; return JSON.stringify(goodAsset()); };
r = await oc.execute({ mode: "express" });
ok(calls === 4 && r.source === "llm" && oc.generator.breaker.state() === "closed", "a good probe closes the breaker again");
const never = createOrchestrator({ llm: () => { calls++; return JSON.stringify(goodAsset()); } });
const before = calls; for (let i = 0; i < 3; i++) await never.execute({ mode: "express" });
ok(calls === before + 3, "a healthy provider is called every time");
const noLlm = createOrchestrator(); t = Date.now(); await noLlm.execute({ mode: "express" });
ok(Date.now() - t < 50 && noLlm.generator.breaker.state() === "closed", "with no provider at all there is no wait of any kind");

/* ---------- privacy ---------- */
let seenPrompt = "", seenSystem = "";
await make((req) => { seenPrompt = req.prompt; seenSystem = req.system; return JSON.stringify(goodAsset()); }).execute({ mode: "individual", profile: MARGARET, concept: "radio afternoon" });
ok(SECRETS.every((s) => !(seenPrompt + seenSystem).includes(s)) && /\{name\}/.test(seenPrompt), "the prompt a provider receives holds no name, hometown, career or note: only tokens");
ok(/1950s/.test(seenPrompt) && /music|gardening/.test(seenPrompt), "the prompt does carry the era and broad interest categories");
const dlog = new DiagnosticLog(); const logged = dlog.record({ v: 1, at: new Date().toISOString(), mode: "individual", tier: 2, source: "local", reason: "", offline: false, breaker: "closed", durationMs: 4.6, name: "Margaret", note: "agitation", stages: [{ stage: "generate", agent: "GenerationAgent", ms: 1, ok: true, name: "Margaret" }, { stage: "x", agent: "Margaret Smith", ms: 1, ok: true }] });
ok(!JSON.stringify(logged).match(/Margaret|agitation|Smith/) && logged.tier === 2 && logged.durationMs === 5 && logged.offline === false, "the log keeps only whitelisted metadata: a name, a note or a free-text agent name cannot get in");
const full = await o.execute({ mode: "individual", profile: MARGARET });
ok(SECRETS.every((s) => !JSON.stringify(full.diagnostics).includes(s)) && full.diagnostics.tier === 2 && Number.isFinite(full.diagnostics.durationMs) && typeof full.diagnostics.offline === "boolean" && full.diagnostics.source === "local", "a real request's diagnostics hold the tier, the duration, the source and the offline state, and nothing of the resident");
const stored = {}; const slog = new DiagnosticLog({ storage: { setItem: (k, v) => { stored[k] = v; } } }); slog.record({ v: 1, tier: 1, mode: "express" });
ok(typeof stored.cognicopia_agent_diag === "string" && !/Margaret/.test(stored.cognicopia_agent_diag), "the log can be kept in local storage, metadata only");
const offlineO = createOrchestrator({ offline: () => true }); ok((await offlineO.execute({ mode: "express" })).diagnostics.offline === true, "the offline state is recorded");
const failingStore = new DiagnosticLog({ storage: { setItem: () => { throw new Error("quota"); } } }); ok(!!failingStore.record({ v: 1, tier: 2 }), "a full or blocked storage does not break logging");

/* ---------- agents and stages ---------- */
class Stub extends CognicopiaAgent { constructor(stage, name) { super({ name, stage }); } async handle(ctx) { ctx.seen = (ctx.seen || []).concat(this.name); if (this.stage === "analyze") ctx.analysis = { from: this.name }; if (this.stage === "audit") ctx.audit = { status: "pass", problems: [] }; return ctx; } }
const wired = createOrchestrator(); wired.use(new Stub("analyze", "AnalyzerStub")).use(new Stub("audit", "AuditStub"));
const wr = await wired.execute({ mode: "express" });
ok(wr.analysis && wr.analysis.from === "AnalyzerStub" && wr.audit.status === "pass" && wr.diagnostics.stages.map((s) => s.stage).join() === "generate,analyze,audit".split(",").sort((a, b) => STAGES.indexOf(a) - STAGES.indexOf(b)).join(), "agents plug into their stage and run in pipeline order: analyze, generate, audit");
ok(wr.diagnostics.stages.length === 3 && wr.diagnostics.stages.every((s) => s.ok), "each stage's agent and timing are in the diagnostics");
ok(wired.integrity().ok && wired.integrity().stages.find((s) => s.stage === "audit").covered, "the integrity report shows every stage covered and every agent answering");
ok(!createOrchestrator().integrity().stages.find((s) => s.stage === "audit").covered && (await createOrchestrator().execute({ mode: "express" })).audit.status === "not_run", "with no audit agent the result says the audit was not run, instead of pretending it passed");
let threw = 0; try { createOrchestrator().use({ name: "x", stage: "audit" }); } catch (e) { threw++; } try { createOrchestrator().use(new Stub("nowhere", "Bad")); } catch (e) { threw++; }
ok(threw === 2, "an object that is not an agent, or an agent for an unknown stage, is refused");
class Boom extends Stub { async handle() { throw new Error("agent crashed"); } }
const crash = createOrchestrator().use(new Boom("analyze", "BoomAnalyzer")).use(new Boom("audit", "BoomAudit"));
const cr = await crash.execute({ mode: "express" });
ok(cr.ok && validateAsset(cr.asset).length === 0 && cr.audit.status === "not_run" && cr.diagnostics.stages.some((s) => s.agent === "BoomAudit" && s.ok === false), "an agent that crashes cannot stop the sheet; a crashed audit is reported as not run");
class Gen2 extends GenerationAgent { constructor() { super({}); this.name = "CustomGenerator"; } }
const swapped = createOrchestrator().use(new Gen2()); ok(swapped.agentsFor("generate").length === 2, "a second generator is added beside the built-in one");
const custom = createOrchestrator().registerLocalTemplate("mine", () => goodAsset("Custom {name}")); const cx = await custom.execute({ mode: "individual", profile: MARGARET, options: { template: "mine" } });
ok(cx.asset.title === "Custom Margaret" && cx.source === "local", "a registered local template is used by name, with tokens filled");
ok(new CognicopiaAgent().role.length > 10 && /dignif|safe/i.test(new CognicopiaAgent().goal) && /Never correct/.test(new CognicopiaAgent().systemPrompt) && /Validation Statement/.test(new CognicopiaAgent().systemPrompt), "the base agent carries a geriatric-care role, goal and system prompt");
ok(JSON.stringify(MODES) === JSON.stringify({ INDIVIDUAL: "individual", GROUP: "group", EXPRESS: "express" }), "three modes are exported");

/* speed: a sheet is instant */
t = performance.now(); for (let i = 0; i < 200; i++) await o.execute({ mode: "individual", profile: MARGARET }); const per = (performance.now() - t) / 200;
ok(per < 5, `a local sheet takes under 5 ms (${per.toFixed(2)} ms)`);

if (problems.length) { console.error("agent orchestrator check FAILED: " + problems.length + " problem(s), " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("agent orchestrator check passed: " + passed + " checks (three modes, valid dignified sheets, the 2,500 ms breaker with every failure kind, no name in a prompt or a log, agents and stages)");
