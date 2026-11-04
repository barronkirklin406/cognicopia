#!/usr/bin/env node
/* =====================================================================
   js/pillar2-functionality-agents.js (Agents 10 to 15), in Node.

     hub          profiles and notes are saved, listed, capped and removed; a broken or blocked store never throws
     analyzer     mood, interests, sensory leanings, things to keep off the page and likes are read from notes;
                  a suggestion is only ever to be gentler; recommendations follow the mood; in the pipeline the
                  words from the notes come off the sheet
     deep         suggestions from the notes, built-in and facility presets, a preset in the pipeline
     calibrator   Alzheimer's, vascular, Lewy body, frontotemporal and Korsakoff each cap what a sheet asks for;
                  the sheet says it is not a diagnosis; an unknown condition changes nothing
     branding     a name, a header and an image logo; a logo that is not an image, or is too big, is refused;
                  a saved brand is applied only when a request has none; logos reduce to black and white
     engagement   entries by id only, summaries, trends, a facility view and a CSV that cannot run in a spreadsheet
   ===================================================================== */
import { createOrchestrator, assetText } from "../js/agent-orchestrator.js";
import { ClinicalAuditAgent } from "../js/clinical-audit-agent.js";
import { registerReminiscence } from "../js/reminiscence-engine.js";
import { registerPillar1 } from "../js/pillar1-production-agents.js";
import { registerPillar2, ProfileHub, NoteAnalyzer, DeepCustomizationAgent, DifficultyCalibrator, BrandingCoordinator, EngagementLogger, memoryStorage, webStorage, thresholdPixels, PRESETS, CONDITIONS, CONCEPTS, CALIBRATION_NOTE, ENGAGEMENT, PILLAR2_AGENTS } from "../js/pillar2-functionality-agents.js";

let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
let clock = new Date("2026-11-10T09:00:00Z"); const now = () => new Date(clock);
const advance = (days, hours = 0) => { clock = new Date(clock.getTime() + days * 86400000 + hours * 3600000); };
const peggy = { preferredName: "Peggy", formativeEra: "1938", ailmentTier: 1, hobbies: "gardening", petNames: "Biscuit", spouse: "Walter", pastCareer: "schoolteacher", hometown: "Cedar Falls, Iowa" };

/* ---------- 10. hub ---------- */
const store = memoryStorage(), hub = new ProfileHub({ storage: store, now });
const id = hub.save("Room 12", peggy);
ok(/^r_[a-z0-9]{10}$/.test(id) && hub.list().length === 1 && hub.list()[0].alias === "Room 12" && hub.get(id).profile.preferredName === "Peggy", "a profile is saved under an alias and read back");
ok(hub.save("Room 12 (new)", Object.assign({}, peggy, { hobbies: "knitting" }), id) === id && hub.list().length === 1 && hub.get(id).profile.hobbies[0] === "knitting" && hub.get(id).created === hub.get(id).created, "saving again with the id updates the same profile");
advance(0, 1); hub.addNote(id, "Smiled and sang along."); advance(0, 5); hub.addNote(id, "Restless late in the afternoon.");
ok(hub.notes(id).length === 2 && hub.notes(id, { last: 1 })[0].text === "Restless late in the afternoon." && hub.list()[0].notes === 2, "notes are kept in order and the latest can be asked for");
let t1 = 0; for (const f of [() => hub.save("", peggy), () => hub.addNote("nope", "x"), () => hub.addNote(id, "   "), () => hub.toRequest("nope")]) { try { f(); } catch (e) { if (e instanceof RangeError) t1++; } }
ok(t1 === 4, "an empty alias, a note for nobody, an empty note and a request for nobody are each refused plainly");
for (let i = 0; i < 230; i++) hub.addNote(id, "note " + i + " " + "x".repeat(600));
ok(hub.notes(id).length === 200 && hub.notes(id).every((n) => n.text.length <= 500) && hub.notes(id)[199].text.startsWith("note 229"), "notes are capped at 200 and 500 characters, keeping the newest");
const req = hub.toRequest(id, { options: { template: "reminiscence" } });
ok(req.residentId === id && /note 229/.test(req.profile.caregiverNotes) && req.options.template === "reminiscence", "a request is made from a saved profile with its recent notes");
const hub2 = new ProfileHub({ storage: store }); ok(hub2.get(id) && hub2.list().length === 1, "another hub on the same storage sees the same profiles");
store.set("p:" + id, "{not json"); ok(hub2.get(id) === null && hub2.list().length === 0, "a damaged record is treated as missing, not as an error");
hub.remove(id); ok(hub.list().length === 0 && hub.get(id) === null, "a profile can be removed");
const many = new ProfileHub({ storage: memoryStorage() }); let capped = false; try { for (let i = 0; i < 501; i++) many.save("r" + i, {}); } catch (e) { capped = e instanceof RangeError; } ok(capped && many.list().length === 500, "the hub holds up to 500 profiles");
/* web storage */
const fake = (() => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i], getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), m }; })();
const ws = webStorage(fake, "t_"); ws.set("a", "1"); ws.set("b", "2"); fake.setItem("other", "x");
ok(ws.get("a") === "1" && ws.keys().sort().join() === "a,b" && fake.m.has("t_a") && !ws.keys().includes("other"), "web storage keeps to its prefix");
const blocked = webStorage({ getItem() { throw new Error("blocked"); }, setItem() { throw new Error("full"); }, removeItem() { throw new Error("x"); }, get length() { throw new Error("x"); }, key() { throw new Error("x"); } }, "t_");
ok(blocked.get("a") === null && blocked.set("a", "1") === false && blocked.keys().length === 0 && webStorage(null).get("a") === null, "a blocked or full store gives a plain answer, never an exception");
ok(new ProfileHub({ storage: blocked }).list().length === 0, "a hub on a blocked store still starts");

/* ---------- 11. analyzer ---------- */
const an = new NoteAnalyzer();
const a1 = an.analyze("Peggy was tearful and restless in the late afternoon. She doesn't like loud noises. She loves old hymns and the piano. Upset by the war movie.", { tier: 1 });
ok(a1.mood === "unsettled" && a1.sundowning && a1.interests.includes("music") && a1.sensory.includes("sound") && a1.suggestedTier === 2, `an unsettled afternoon is read as unsettled, sundowning, music and sound, and a gentler level is suggested (${a1.mood}, ${a1.suggestedTier})`);
ok(a1.avoidCandidates.includes("loud noises") && a1.avoidCandidates.includes("war movie") && a1.likes.includes("old hymns"), "things to keep off the page and things they love are lifted from the sentences (" + a1.avoidCandidates.join("|") + " / " + a1.likes.join("|") + ")");
const a2 = an.analyze("Smiled and sang along, enjoyed the flowers in the garden. Calm and content.", { tier: 2 });
ok(a2.mood === "settled" && a2.suggestedTier === null && a2.interests.includes("gardening") && a2.interests.includes("music") && !a2.sundowning, "a good day is settled and no change is suggested");
ok(an.analyze("", {}).mood === "unknown" && an.analyze(null).interests.length === 0 && an.analyze("x".repeat(100000)).mood === "unknown" && an.analyze("tearful restless", { tier: 3 }).suggestedTier === null, "no notes is unknown, huge text is handled, and the gentlest level is never pushed further");
ok(/not an assessment/.test(a1.note), "the reading says it is not an assessment");
const rec1 = an.recommend(a1), rec2 = an.recommend(a2), rec3 = an.recommend(an.analyze("Tired and sleepy, dozing", { tier: 2 }));
ok(CONCEPTS.length === 11 && rec1.length === 11 && rec1[0].id === "music-memories" && rec1.slice(0, 3).every((r) => CONCEPTS.find((c) => c.id === r.id).calm), "an unsettled time with a love of music puts music and other calm activities first");
ok(rec2.slice(0, 2).some((r) => r.id === "garden-hands") && rec3.slice(0, 3).every((r) => r.minutes <= 15), "interests lead on a good day and a low-energy day gets short activities");
ok(an.recommend(null).length === 11 && an.recommend({}).every((r) => r.reason), "recommending from nothing still gives a gentle all-round list");
const o = registerReminiscence(createOrchestrator().use(new ClinicalAuditAgent())); registerPillar1(o); const storage = memoryStorage(); const p2 = registerPillar2(o, { storage, now });
const piped = await o.execute({ profile: Object.assign({}, peggy, { caregiverNotes: "Tearful in the late afternoon. Upset by the war movie. Loves old hymns." }), options: { template: "reminiscence" } });
ok(piped.analysis.notes && piped.analysis.notes.appliedAvoid.includes("war movie") && piped.analysis.notes.suggestedTier === 2 && !/war movie/i.test(JSON.stringify(piped.asset)) && piped.analysis.notes.interests.includes("music"), "in the pipeline a topic from the notes is applied to the keep-off list and recorded");
const noApply = await o.execute({ profile: Object.assign({}, peggy, { caregiverNotes: "Upset by the war movie." }), analyzeNotes: { applyAvoid: false } });
ok(noApply.analysis.notes.appliedAvoid.length === 0, "applying the notes' keep-off words can be turned off");

/* ---------- 12. deep customization ---------- */
const dc = p2.deep, sug = dc.suggest(a1);
ok(sug.deep.focus === "music" && sug.deep.music.includes("old hymns") && sug.preset === "evening-calm" && sug.deep.include.wordSearch === false, "suggestions follow the notes: music first, and a calm sheet for an unsettled time");
ok(dc.suggest(a2).deep.focus === "music" && dc.suggest(a2).preset === null && dc.suggest(null).deep.focus === "mixed", "a settled day suggests the full sheet, and nothing at all is a mixed focus");
ok(Object.keys(PRESETS).length === 5 && dc.preset("evening-calm").label === "Evening calm" && dc.preset("nope") === null, "five built-in presets, and an unknown one is simply missing");
const key = dc.savePreset("Tuesday Music Hour!", { focus: "music", include: { wordSearch: false } });
ok(key === "tuesday-music-hour" && dc.preset(key).deep.focus === "music", "a facility preset is saved under a clean name");
let t2 = 0; for (const f of [() => dc.savePreset("", {}), () => dc.savePreset("evening-calm", {})]) { try { f(); } catch (e) { if (e instanceof RangeError) t2++; } } ok(t2 === 2, "an empty name and a built-in name are refused");
const viaPreset = await o.execute({ profile: peggy, preset: "evening-calm", options: { template: "reminiscence" } });
ok(viaPreset.analysis.preset.found && !viaPreset.asset.pages.resident.blocks.some((b) => b.type === "wordsearch") && viaPreset.asset.pages.resident.blocks.some((b) => b.type === "matching"), "a preset in a request turns the word search off and keeps the pairs");
const over = await o.execute({ profile: peggy, preset: "evening-calm", deep: { include: { wordSearch: true } }, options: { template: "reminiscence" } });
ok(over.asset.pages.resident.blocks.some((b) => b.type === "wordsearch"), "what staff set in the request wins over the preset");
const missing = await o.execute({ profile: peggy, preset: "no-such", options: { template: "reminiscence" } }); ok(missing.analysis.preset.found === false && missing.audit.status !== "blocked", "an unknown preset is noted and the sheet is made anyway");

/* ---------- 13. calibrator ---------- */
const cb = p2.calibrator;
ok(["Alzheimer's", "alzheimers", "AD"].every((c) => cb.calibrate(c, 2).condition === "alzheimers") && cb.calibrate("Vascular dementia").condition === "vascular" && cb.calibrate("Lewy body dementia").condition === "lewy" && cb.calibrate("FTD").condition === "ftd" && cb.calibrate("Frontotemporal").condition === "ftd" && cb.calibrate("Korsakoff syndrome").condition === "korsakoff" && cb.calibrate("flu") === null && cb.calibrate(null) === null, "condition names are forgiving, and an unknown one is null");
ok(Object.keys(CONDITIONS).length === 5 && cb.calibrate("lewy").maxGrid === 6 && cb.calibrate("lewy").minFontPt === 24 && cb.calibrate("vascular").maxPairs === 3 && cb.calibrate("korsakoff").guidance[0].includes("do not correct") && cb.calibrate("lewy").guidance[1] === CALIBRATION_NOTE, "each condition has its own caps, and every one says it is not a diagnosis");
const lewy = await o.execute({ profile: Object.assign({}, peggy, { ailmentTier: 1 }), condition: "Lewy body dementia", options: { template: "reminiscence" } });
const ws1 = lewy.asset.pages.resident.blocks.find((b) => b.type === "wordsearch"), m1 = lewy.asset.pages.resident.blocks.find((b) => b.type === "matching"), sp1 = lewy.asset.pages.resident.blocks.find((b) => b.type === "prompts");
ok(ws1 && ws1.grid.length <= 6 && ws1.words.length <= 4 && (!m1 || m1.items.length <= 3) && (!sp1 || sp1.items.length <= 2) && lewy.asset.pages.resident.fontPt >= 24 && lewy.audit.status === "pass", `a Lewy body sheet has a small grid (${ws1 && ws1.grid.length}), few words, larger print (${lewy.asset.pages.resident.fontPt} pt) and passes the audit`);
ok(/Busy patterns/.test(JSON.stringify(lewy.asset.pages.caregiver.notes)) && /not a diagnosis/.test(JSON.stringify(lewy.asset.pages.caregiver.notes)) && lewy.analysis.calibration.label === "Lewy body dementia", "the staff page carries the guidance and says it is not a diagnosis");
const plain = await o.execute({ profile: Object.assign({}, peggy, { ailmentTier: 1 }), options: { template: "reminiscence" } });
ok(plain.asset.pages.resident.blocks.find((b) => b.type === "wordsearch").grid.length === 8 && !/not a diagnosis/.test(JSON.stringify(plain.asset)), "with no condition named the sheet is unchanged");
const kor = await o.execute({ profile: peggy, condition: "korsakoff", options: { template: "reminiscence" } }); ok(/do not correct/.test(JSON.stringify(kor.asset.pages.caregiver.notes)) && kor.audit.status === "pass", "Korsakoff guidance tells staff not to correct, and the audit accepts it");
const unk = await o.execute({ profile: peggy, condition: "nonsense", options: { template: "reminiscence" } }); ok(unk.analysis.calibration.found === false && unk.audit.status === "pass", "an unknown condition is noted and changes nothing");
let allCond = true; for (const c of Object.keys(CONDITIONS)) for (const tier of [1, 2, 3]) { const r = await o.execute({ profile: Object.assign({}, peggy, { ailmentTier: tier }), condition: c, options: { template: "reminiscence" } }); if (r.audit.status !== "pass" || /[{}]/.test(assetText(r.asset))) allCond = false; }
ok(allCond, "all five conditions at all three stages pass the audit");

/* ---------- 14. branding ---------- */
const br = p2.branding, png = "data:image/png;base64,iVBORw0KGgo=";
ok(br.get() === null, "no brand is saved to start with");
br.clear(); const s1 = br.set({ facilityName: "Maple <b>Grove</b>", headerText: "Activities {x}", logoDataUrl: png });
ok(s1.ok && !/[<>{}]/.test(s1.branding.facilityName + s1.branding.headerText) && s1.branding.logoDataUrl === png && br.get().facilityName.startsWith("Maple"), "a name, a header and an image logo are saved with markup and braces removed");
const bad = [["javascript:alert(1)"], ["data:image/svg+xml;base64,PHN2Zz4="], ["data:text/html;base64,AAAA"], ["data:image/png;base64," + "A".repeat(400001)]].map(([u]) => br.set({ facilityName: "X", logoDataUrl: u }));
ok(bad.every((r) => r.ok && r.branding.logoDataUrl === "" && r.problems.length === 1), "a logo that is not a PNG, JPEG, GIF or WebP, or is too large, is dropped with a reason and the name still saves");
ok(br.set({}).ok === false && br.set(null).problems[0] === "nothing to save" && br.set({ logoDataUrl: "bad" }).ok === false, "nothing to save is refused");
br.set({ facilityName: "Maple Grove", headerText: "Activities", logoDataUrl: png });
const withB = await o.execute({ profile: peggy }); ok(withB.asset.branding && withB.asset.branding.facilityName === "Maple Grove" && withB.analysis.branding.applied, "a saved brand is applied to a request that has none");
const ownB = await o.execute({ profile: peggy, branding: { facilityName: "Other Place" } }); ok(ownB.asset.branding.facilityName === "Other Place", "a request's own branding wins");
br.clear(); const noB = await o.execute({ profile: peggy }); ok(!noB.asset.branding && br.get() === null, "a cleared brand is no longer applied");
const px = thresholdPixels(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 128, 128, 128, 255, 200, 200, 200, 255, 0, 0, 0, 0, 0, 0, 0, 128, 255, 0, 0, 255, 0, 0, 255, 255]));
ok([0, 255, 0, 255, 255, 0, 0, 0].every((v, i) => px[i * 4] === v) && px.every((v, i) => (i % 4 === 3 ? v === 255 : v === 0 || v === 255)), "logo pixels become pure black or pure white: dark stays black, light and transparent become white, half-transparent black is dark enough to stay black");

/* ---------- 15. engagement ---------- */
const eng = p2.engagement; clock = new Date("2026-11-10T09:00:00Z");
for (const [d, c, e, t] of [[0, "Music memories", 3, "morning"], [1, "Music memories", 3, "morning"], [2, "Folding towels", 1, "afternoon"], [3, "Flowers", 2, "morning"], [4, "Folding towels", 0, "evening"], [5, "Music memories", 3, "evening"]]) { eng.log({ residentId: "r_abc", concept: c, engagement: e, timeOfDay: t, minutes: 15, at: new Date(clock.getTime() + d * 86400000) }); }
eng.log({ residentId: "r_xyz", concept: "Flowers", engagement: 2, at: new Date(clock.getTime() + 6 * 86400000) }); advance(8);
const sm = eng.summary("r_abc");
ok(sm.entries === 6 && sm.average === 2 && sm.best[0].concept === "Music memories" && sm.best[0].average === 3 && sm.times[0].timeOfDay === "morning", `a summary gives the average, the activities that went best and the best time (${sm.average}, ${sm.best[0].concept})`);
ok(sm.trend === "steady" || sm.trend === "up" || sm.trend === "down", "a trend is reported once there are enough entries (" + sm.trend + ")");
ok(eng.summary("nobody").entries === 0 && eng.summary("nobody").trend === "not enough entries yet" && eng.summary("r_abc", { days: 5 }).entries === 3, "no entries is a harmless empty summary, and a window of days is honored");
const fac = eng.facility(); ok(fac.entries === 7 && fac.residents === 2 && fac.average > 0 && Object.keys(fac.perDay).length === 7, "the facility view counts entries and residents by day");
let t3 = 0; for (const f of [() => eng.log({}), () => eng.log({ residentId: "a", concept: "x", engagement: 4 }), () => eng.log({ residentId: "a", concept: "x", engagement: 1.5 }), () => eng.log({ residentId: "a", concept: "", engagement: 1 })]) { try { f(); } catch (e) { if (e instanceof RangeError) t3++; } } ok(t3 === 4 && Object.keys(ENGAGEMENT).length === 4, "an entry with no resident, a bad scale or no activity is refused");
eng.log({ residentId: "r_abc", concept: "=HYPERLINK(\"http://x\")", engagement: 2, note: "line one, \"quoted\"\nline two" });
const csv = eng.exportCsv({ residentId: "r_abc" }); ok(csv.split("\n")[0] === "date,resident_id,activity,engagement,minutes,time_of_day,note" && /'=HYPERLINK/.test(csv) && /"line one, ""quoted"" line two"/.test(csv) && !/r_xyz/.test(csv), "the CSV is ids only, quotes commas and quotation marks, and defuses a formula");
ok(!/Peggy|Room 12|Biscuit/.test(storage.get("log") || ""), "the engagement log holds no name");
const histo = await o.execute({ residentId: "r_abc", profile: peggy, options: { template: "reminiscence" } }); ok(histo.analysis.history && histo.analysis.history.entries >= 1 && histo.analysis.history.best[0] === "Music memories", "in the pipeline a resident's history is added to the analysis for the recommender");
eng.clear("r_abc"); ok(eng.summary("r_abc").entries === 0 && eng.facility().residents === 1, "one resident's log can be cleared");

/* ---------- pipeline ---------- */
const ids = o.integrity();
ok(ids.ok && PILLAR2_AGENTS.every((n) => o.agents().some((x) => x.name === n)) && ids.pings.every((p) => p.ok), "the six agents are registered and answer the ping");
ok(p2.hub instanceof ProfileHub && p2.analyzer instanceof NoteAnalyzer && p2.deep instanceof DeepCustomizationAgent && p2.calibrator instanceof DifficultyCalibrator && p2.branding instanceof BrandingCoordinator && p2.engagement instanceof EngagementLogger, "the six agents are the six classes");
const hubId = p2.hub.save("Bay 3", peggy); p2.hub.addNote(hubId, "Restless and tearful; upset by sirens.");
const fromHub = await o.execute(p2.hub.toRequest(hubId, { options: { template: "reminiscence" } }));
ok(fromHub.analysis.hub.found && fromHub.analysis.notes.appliedAvoid.includes("sirens") && fromHub.audit.status === "pass", "a request made from the hub is analyzed with its notes in one run");
let t6 = false; try { registerPillar2(null); } catch (e) { t6 = e instanceof TypeError; } ok(t6, "registering with no orchestrator is refused");
ok(CONCEPTS.every((c) => c.id && c.title && c.minutes > 0), "every activity concept is complete");

if (problems.length) { console.error("pillar 2 check FAILED: " + problems.length + " problem(s), " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("pillar 2 check passed: " + passed + " checks (hub and storage, note analysis, recommendations, presets, five conditions, branding and logos, engagement log, orchestrator wiring)");
