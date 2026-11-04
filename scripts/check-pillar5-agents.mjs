#!/usr/bin/env node
/* =====================================================================
   js/pillar5-upgrade-agents.js (Agents 26 to 30), in Node. (Real WebRTC and the Today page: scripts/check-pillar5-ui.mjs.)

     voice      commands are understood; listening is refused unless speech stays on the device; a dictated note loses its
                identifiers; making a packet needs a spoken confirmation that expires
     sync       two devices with the same passphrase converge on the newest copy; a wrong passphrase gets nothing; a replayed
                or tampered message is refused; resident data does not travel unless asked for; messages are encrypted
     forecast   recent sessions count more, thin evidence is pulled toward the resident's average and called low confidence,
                a sustained drop raises a review flag, and every result says it is not a health prediction
     plugins    manifests, permissions, no network, no audit powers, dependency order, rollback on failure
     auditor    all 30 agents present in the right order, a test sheet that still comes out right, and a diagram
   ===================================================================== */
import { createOrchestrator, assetText } from "../js/agent-orchestrator.js";
import { memoryStorage } from "../js/pillar2-functionality-agents.js";
import { ClinicalAuditAgent } from "../js/clinical-audit-agent.js";
import { CognicopiaAgent } from "../js/agent-orchestrator.js";
import { createSuite, parseCommand, VoiceAssistant, P2PSyncPrototype, JourneyForecaster, PluginArchitect, SystemAuditor, validateManifest, scanSource, ROSTER, HOST_API, PERMISSIONS, SYNC_DEFAULT, HUB_NAMES, PILLAR5_AGENTS, registerPillar5 } from "../js/pillar5-upgrade-agents.js";

let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- 26. voice ---------- */
const P = parseCommand;
ok(P("Go to Today").target === "Today" && P("open the activity packets.").target === "Activity Packets" && P("show Resources").intent === "navigate" && P("take me to the facility").target === "Facility" && P("go to nowhere").intent === "unknown" && HUB_NAMES.length === 7, "navigation commands map to the six hubs and Contact, and an unknown place is not guessed");
ok(P("preview the packet").intent === "preview" && P("make the packet").needsConfirm === true && P("Note: she liked the hymns").text === "she liked the hymns" && P("add a note that he was calm").text === "he was calm" && P("add a note").intent === "note-start" && P("read the last notes").intent === "read-notes" && P("stop listening").intent === "stop" && P("what can I say").intent === "help" && P("yes").intent === "confirm" && P("").intent === "none" && P(null).intent === "none" && P("blah blah").intent === "unknown", "preview, make, note, read, stop, help and confirm are all understood");
const win = (SR) => ({ SpeechRecognition: SR, speechSynthesis: {} });
const mkSR = (avail) => { const S = function () { S.last = this; this.start = () => { this.started = true; }; this.stop = () => { this.stopped = true; }; }; if (avail !== undefined) S.available = async () => avail; return S; };
const va0 = new VoiceAssistant();
ok((await va0.support({})).recognition === false && !(await va0.support({})).canListen && (await va0.support(win(mkSR()))).canListen === false && /cannot confirm that speech stays on this device/.test((await va0.support(win(mkSR()))).reason), "with no speech recognition, or no proof that it is on-device, listening is refused and the reason is plain");
ok((await va0.support(win(mkSR("available")))).canListen === true && (await va0.support(win(mkSR("downloadable")))).canListen === false && /download/.test((await va0.support(win(mkSR("downloadable")))).reason) && (await va0.support(win(mkSR("unavailable")))).local === false && (await va0.support(win(Object.assign(mkSR(), { available: async () => { throw new Error("x"); } })))).local === "unknown", "on-device recognition that is available can listen; one that needs a download, is unavailable or fails cannot");
const cloud = new VoiceAssistant({ allowCloud: true }), cc = await cloud.support(win(mkSR()));
ok(cc.canListen && cc.cloud && /sent to the browser's speech service/.test(cc.reason), "online recognition works only when staff allow it, and says that speech is sent");
const S1 = mkSR("available"), started = await va0.start(win(S1)); ok(started.ok && S1.last.started && S1.last.processLocally === true && S1.last.continuous && va0.stop() && S1.last.stopped, "listening starts with on-device processing asked for, and stops");
const refused = await new VoiceAssistant().start(win(mkSR())); ok(refused.ok === false && !/undefined/.test(refused.reason), "start is refused when speech might leave the device");
const hubStore = memoryStorage(); const suite = createSuite({ storage: hubStore }); const hub = suite.agents.hub, rid = hub.save("Room 4", { preferredName: "Peggy" });
const calls = []; let clock = 1000; const v = new VoiceAssistant({ hub, residentId: rid, now: () => clock, handlers: { navigate: (t) => calls.push("nav:" + t), preview: () => calls.push("preview"), makePacket: () => calls.push("make"), speak: (t) => calls.push("say:" + t) } });
await v.hear("go to today"); await v.hear("preview the packet"); ok(calls.join() === "nav:Today,preview", "spoken navigation and preview call the page's handlers");
const ask = await v.hear("make the packet"); ok(ask.done === "ask" && !calls.includes("make"), "making a packet asks first and does nothing yet");
await v.hear("yes"); ok(calls.includes("make"), "saying yes within the time makes it");
calls.length = 0; await v.hear("make the packet"); clock += 11000; const late = await v.hear("yes"); ok(late.done === "nothing" && !calls.includes("make"), "a confirmation that comes too late is ignored");
await v.hear("make the packet"); await v.hear("go to studio"); const lost = await v.hear("yes"); ok(lost.done === "nothing" && !calls.includes("make"), "saying something else first cancels the pending confirmation");
await v.hear("add a note"); const n1 = await v.hear("Call Dana at 555-123-4567 she was calm today"); ok(n1.done === "note" && n1.removed.includes("phone") && hub.notes(rid).pop().text === "Call Dana at [phone removed] she was calm today" && /left out/.test(n1.say), "dictating a note takes out the identifier and keeps the rest with the resident's notes");
const n2 = await v.hear("note: enjoyed the garden"); ok(n2.done === "note" && hub.notes(rid).length === 2, "a one-breath note is saved too");
await v.hear("read the notes"); ok(calls.some((c) => c.startsWith("say:") && /enjoyed the garden/.test(c)), "reading notes speaks the latest ones");
ok((await new VoiceAssistant({ hub }).hear("note: x")).done === "no-resident" && (await v.hear("sing me a song")).done === "unknown" && (await v.hear("help")).say.includes("go to Today") && (await v.hear("stop")).done === "stop", "a note with no resident chosen, an unknown phrase, help and stop are each answered");
const synth = { speechSynthesis: { getVoices: () => [{ localService: false }], speak: () => {} }, SpeechSynthesisUtterance: function () {} }; ok(va0.speak("hello", synth) === false, "text is not spoken through an online-only voice");
let spoke = 0; ok(va0.speak("hello", { speechSynthesis: { getVoices: () => [{ localService: true }], speak: () => spoke++ }, SpeechSynthesisUtterance: function () {} }) === true && spoke === 1 && va0.speak("x", {}) === false, "a device voice is used, and with no speech support nothing happens");

/* ---------- 27. sync ---------- */
const reg = new Map(); let nid = 1; const wire = [];
class FakeCh { constructor() { this.readyState = "connecting"; } send(d) { if (this.readyState !== "open") throw new Error("closed"); wire.push(d); const p = this.peer; setTimeout(() => p.onmessage && p.onmessage({ data: d }), 0); } close() { if (this.readyState !== "closed") { this.readyState = "closed"; this.onclose && this.onclose(); } } }
class FakePC { constructor() { this.id = nid++; reg.set(this.id, this); this.iceGatheringState = "complete"; } createDataChannel() { this.dc = new FakeCh(); return this.dc; } async createOffer() { return { type: "offer", sdp: "fake:" + this.id }; } async createAnswer() { return { type: "answer", sdp: "fake:" + this.id }; } async setLocalDescription(d) { this.localDescription = d; }
  async setRemoteDescription(d) { if (d.type !== "answer") return; const a = this, b = reg.get(Number(d.sdp.split(":")[1])), chA = a.dc, chB = new FakeCh(); chA.peer = chB; chB.peer = chA; b.ondatachannel && b.ondatachannel({ channel: chB }); setTimeout(() => { chA.readyState = chB.readyState = "open"; chA.onopen && chA.onopen(); chB.onopen && chB.onopen(); }, 0); } close() {} }
const mkSync = (store, o = {}) => new P2PSyncPrototype(Object.assign({ storage: store, rtc: () => new FakePC(), iterations: 1000 }, o));
async function pair(a, b, pa = "shared passphrase", pb = "shared passphrase") { const offer = await a.createOffer(pa), answer = await b.acceptOffer(offer, pb); await a.acceptAnswer(answer); await sleep(120); return { offer, answer }; }
const A = memoryStorage(), B = memoryStorage(); A.set("preset:tuesday", JSON.stringify({ label: "A" })); A.set("branding", JSON.stringify({ facilityName: "New Name" })); A.set("sync:meta", JSON.stringify({ branding: 2000 })); B.set("branding", JSON.stringify({ facilityName: "Old Name" })); B.set("sync:meta", JSON.stringify({ branding: 1000 })); B.set("preset:wednesday", JSON.stringify({ label: "B" }));
A.set("p:r_secret", JSON.stringify({ id: "r_secret", alias: "Room 1", profile: { preferredName: "Peggy" }, notes: [] })); A.set("index", JSON.stringify(["r_secret"]));
const sa = mkSync(A), sb = mkSync(B); wire.length = 0; const { offer, answer } = await pair(sa, sb);
ok(sa.state === "connected" && sb.state === "connected" && sa.authed && sb.authed, "two devices with the same passphrase connect and each proves it knows it");
ok(JSON.parse(B.get("branding")).facilityName === "New Name" && JSON.parse(A.get("branding")).facilityName === "New Name" && B.get("preset:tuesday") && A.get("preset:wednesday"), "the newer branding wins on both, and each device gains the other's presets");
ok(B.get("p:r_secret") === null && B.get("index") === null && !wire.some((w) => /Peggy|r_secret/.test(w)), "no resident profile travelled: the default is facility settings only");
ok(wire.length >= 4 && wire.every((w) => { const m = JSON.parse(w); return m.n && m.iv && m.ct && !/preset|branding|facilityName|Tuesday/.test(w); }), "every message on the wire is encrypted: no setting appears in it");
ok(!/passphrase|shared/.test(offer + answer) && JSON.parse(offer).kind === "offer" && JSON.parse(answer).kind === "answer", "the offer and the answer carry no passphrase");
const sys = sa.meta(); ok(sys.branding === 2000 && SYNC_DEFAULT.join() === "presets,branding,feedback,engagement", "sync keeps a timestamp for each key it has taken");
/* wrong passphrase */
const C = memoryStorage(), D = memoryStorage(); C.set("preset:x", "1"); const sc = mkSync(C), sd = mkSync(D); await pair(sc, sd, "right passphrase", "wrong passphrase");
ok(sd.state === "failed" && !sd.authed && D.get("preset:x") === null && sd.log.some((l) => /wrong passphrase/.test(l)), "a device with the wrong passphrase fails to open the greeting and receives nothing");
/* resident data only on purpose */
const E = memoryStorage(), F = memoryStorage(); E.set("p:r_1", "v1"); E.set("index", "[]");
const se = mkSync(E, { allowResidentData: true }), sf = mkSync(F, { allowResidentData: true }); await pair(se, sf); ok(F.get("p:r_1") === "v1" && se.collections.includes("profiles"), "resident profiles travel only when both devices are set to allow it");
const g = mkSync(memoryStorage(), { collections: ["profiles", "presets"] }); ok(!g.collections.includes("profiles") && g.collections.includes("presets"), "asking for profiles without allowResidentData is quietly refused");
/* merge rules */
const M = memoryStorage(), sm = mkSync(M); M.set("preset:a", "old"); sm.touch("preset:a");
const ts = sm.meta()["preset:a"];
const r1 = sm.applyRemote([{ k: "preset:a", v: "older", ts: ts - 10 }, { k: "preset:b", v: "new", ts: 5 }, { k: "p:r_1", v: "x", ts: 9 }, { k: 5, v: "x" }, { k: "preset:c", v: 7 }, { k: "preset:" + "z".repeat(100), v: "x" }, { k: "sync:meta", v: "{}" }, { k: "bak:1", v: "x" }, null, { k: "preset:a", v: "newer", ts: ts + 10 }]);
ok(M.get("preset:a") === "newer" && M.get("preset:b") === "new" && M.get("p:r_1") === null && M.get("preset:c") === null && r1.applied === 2 && r1.skipped >= 7, "the newer copy wins, and disallowed keys, non-text values, long keys and the sync bookkeeping are skipped (" + r1.applied + " applied, " + r1.skipped + " skipped)");
M.set("preset:t", "aaa"); const tie = sm.applyRemote([{ k: "preset:t", v: "bbb", ts: 0 }]); ok(M.get("preset:t") === "bbb" && tie.applied === 1 && sm.applyRemote([{ k: "preset:t", v: "aaa", ts: 0 }]).applied === 0, "a tie goes to the larger value, so both devices settle on the same one");
ok(sm.applyRemote(null).applied === 0 && sm.applyRemote("x").applied === 0 && sm.applyRemote(Array.from({ length: 600 }, (_, i) => ({ k: "preset:" + i, v: "x", ts: 1 }))).applied === 500, "nothing, text and an oversized list are handled; at most 500 entries are read");
/* replay and tamper */
const tx = mkSync(memoryStorage()), rx = mkSync(memoryStorage()); const key = await tx.deriveKey("some passphrase", new Uint8Array(16)); tx.key = rx.key = key;
const msg = await tx.seal({ t: "x" }); ok((await rx.open(msg)).t === "x", "a sealed message opens with the same key");
let replay = false; try { await rx.open(msg); } catch (e) { replay = /replayed/.test(e.message); } let tamper = false; try { const m = JSON.parse(await tx.seal({ t: "y" })); m.ct = m.ct.replace(/.$/, m.ct.endsWith("A") ? "B" : "A"); await rx.open(JSON.stringify(m)); } catch (e) { tamper = true; } let big = false; try { await rx.open("x".repeat(1000001)); } catch (e) { big = /too large/.test(e.message); }
let swap = false; try { const m = JSON.parse(await tx.seal({ t: "z" })); m.n += 5; await rx.open(JSON.stringify(m)); } catch (e) { swap = true; }
ok(replay && tamper && big && swap, "a replayed message, a changed message, an oversized message and a renumbered message are each refused");
/* setup errors */
let e1 = 0; for (const f of [() => mkSync(memoryStorage()).createOffer("short"), () => mkSync(memoryStorage(), { rtc: null }).createOffer("long enough pass"), () => mkSync(memoryStorage()).acceptOffer("junk", "long enough pass"), () => mkSync(memoryStorage()).acceptOffer(JSON.stringify({ cognicopiaSync: 1, kind: "answer" }), "long enough pass"), () => mkSync(memoryStorage()).acceptAnswer("junk")]) { try { await f(); } catch (e) { e1++; } }
ok(e1 === 5, "a short passphrase, no WebRTC, a text that is not an offer or an answer are each refused with an error");
sa.close(); ok(sa.state === "closed" && sa.key === null && !sa.authed, "closing wipes the key");
let heard = 0; const H = memoryStorage(), sh = mkSync(H, { onChange: (n) => { heard += n; throw new Error("bad listener"); } }); sh.applyRemote([{ k: "preset:q", v: "1", ts: 1 }]); ok(heard === 1 && H.get("preset:q") === "1", "a failing change listener does not break the merge");

/* ---------- 28. forecaster ---------- */
const NOW = new Date("2026-11-10T12:00:00Z"), day = (d) => new Date(NOW.getTime() - d * 86400000).toISOString();
const jf = new JourneyForecaster({ now: () => NOW });
const entries = [[40, "Music memories", 3, "morning"], [30, "Music memories", 3, "morning"], [25, "Folding towels", 1, "afternoon"], [20, "Music memories", 2, "morning"], [15, "Flowers", 2, "afternoon"], [10, "Folding towels", 1, "afternoon"], [6, "Music memories", 3, "morning"], [3, "Flowers", 3, "morning"], [1, "Folding towels", 0, "evening"]].map(([d, c, e, t]) => ({ at: day(d), concept: c, engagement: e, timeOfDay: t }));
const f = jf.forecast(entries);
ok(f.entries === 9 && f.confidence === "high" && f.concepts[0].concept === "Music memories" && f.concepts[0].expected > f.concepts[f.concepts.length - 1].expected && f.concepts.find((c) => c.concept === "Folding towels").expected < 1.6 && f.bestTime.timeOfDay === "morning", "the activity that has gone best, and the best time of day, come first (" + f.concepts.map((c) => c.concept + " " + c.expected).join(", ") + ")");
ok(f.honest === "A pattern in what staff recorded. It is not a prediction about anyone's health." && jf.forecast([]).honest === f.honest, "every forecast says it is not a health prediction");
const thin = jf.forecast([{ at: day(1), concept: "Bingo", engagement: 3, timeOfDay: "morning" }, { at: day(2), concept: "Music", engagement: 1 }]);
ok(thin.confidence === "low" && thin.concepts.find((c) => c.concept === "Bingo").expected < 3 && thin.concepts.find((c) => c.concept === "Bingo").expected > 1.5 && /early guesses/.test(thin.note), "one enthusiastic session is pulled toward the resident's average and labelled low confidence");
const old = jf.forecast([{ at: day(200), concept: "Old", engagement: 3 }, { at: day(200), concept: "Old", engagement: 3 }, { at: day(1), concept: "New", engagement: 3 }, { at: day(1), concept: "New", engagement: 3 }, { at: day(1), concept: "Other", engagement: 0 }]);
ok(old.concepts[0].concept !== "Other", "recent sessions count more than old ones (half-life 14 days)");
const declining = [3, 3, 3, 2, 3, 1, 1, 0, 1].map((v, i) => ({ at: day(30 - i * 3), concept: "Music", engagement: v, timeOfDay: "morning" })), dr = jf.forecast(declining);
ok(dr.review.flag && /care team/.test(dr.review.message) && !/diagnos|dementia|decline in/i.test(dr.review.message) && !jf.forecast(entries).review.flag && !jf.forecast(declining.slice(0, 5)).review.flag, "a sustained drop suggests talking it over with the care team, without a medical claim, and not before there are 8 entries");
ok(f.concepts.find((c) => c.concept === "Music memories").trend !== "not enough entries" && jf.forecast(entries.slice(0, 3)).concepts.every((c) => c.trend === "not enough entries"), "a trend needs at least four entries of one activity");
ok(jf.forecast(null).entries === 0 && jf.forecast([{ at: "nonsense", concept: "x", engagement: 2 }, { at: day(1), concept: "", engagement: 2 }, { at: day(1), concept: "y", engagement: 9 }, null]).entries === 0, "junk entries are ignored");
const jr = jf.journey(entries); ok(jr.length >= 5 && jr[0].week === 1 && jr.every((w) => w.entries >= 1 && w.average >= 0 && w.average <= 3) && jf.journey([]).length === 0, "the journey is a week-by-week list with entries, average and best activity");
const sg = jf.suggest(entries); ok(sg.likely[0].concept === "Music memories" && sg.fresh.length === 2 && !sg.fresh.some((x) => /music memories|folding/i.test(x.concept)) && sg.honest === f.honest, "suggestions are what went well plus a couple of things not yet tried");
const eng = suite.agents.engagement; for (const e of entries) eng.log({ residentId: rid, concept: e.concept, engagement: e.engagement, timeOfDay: e.timeOfDay, at: new Date(e.at) });
suite.agents.forecaster.now = () => NOW; const piped = await suite.orchestrator.execute({ residentId: rid, profile: { preferredName: "Peggy" }, options: { template: "reminiscence" } });
ok(piped.analysis.forecast && piped.analysis.forecast.next[0] === "Music memories" && ["low", "medium", "high"].includes(piped.analysis.forecast.confidence), "in the pipeline a resident's forecast is added to the analysis");

/* ---------- 29. plugins ---------- */
const man = (o) => Object.assign({ id: "calm-pack", name: "Calm pack", version: "1.0.0", hostApi: "^1.0.0", permissions: ["templates:register"], network: false }, o);
ok(validateManifest(man()).ok && !validateManifest(man({ id: "X" })).ok && !validateManifest(man({ version: "1" })).ok && !validateManifest(man({ hostApi: "^2.0.0" })).ok && !validateManifest(man({ hostApi: "1.0.0" })).ok && !validateManifest(man({ permissions: ["network"] })).ok && !validateManifest(man({ network: true })).ok && !validateManifest(man({ network: undefined })).ok && !validateManifest(man({ requires: ["Bad Id"] })).ok && !validateManifest(null).ok && !validateManifest(man({ name: " " })).ok, "a manifest needs a good id, a version, a compatible host API, listed permissions, and network: false");
ok(validateManifest(man({ hostApi: "^1.9.0" })).errors.some((x) => /needs host API/.test(x)) && HOST_API === "1.0.0" && PERMISSIONS.every((p) => !/network/.test(p)), "a plugin that needs a newer host is refused, and no permission is about the network");
ok(scanSource("const x = 1;").ok && ["fetch('/x')", "new XMLHttpRequest()", "new WebSocket(u)", "navigator.sendBeacon(u)", "eval('1')", "new Function('a')", "import('x')", "document.cookie", "localStorage.setItem()", "window.open()", "see https://example.com", "importScripts('x')", "new RTCPeerConnection()"].every((s) => !scanSource(s).ok), "source that uses the network, eval, storage or a web address is caught by the tripwire (13 cases)");
const o = createOrchestrator().use(new ClinicalAuditAgent()); const pa = new PluginArchitect({ orchestrator: o, notes: (id) => ["a note for " + id] }); const calmTemplate = (ctx) => { const b = o.generator.template("default")(ctx); b.title = "Calm sheet"; return b; };
class DemoAgent extends CognicopiaAgent { constructor() { super({ name: "DemoAgent", stage: "analyze" }); } async handle(ctx) { ctx.analysis = Object.assign({}, ctx.analysis, { demo: true }); return ctx; } }
const calm = { manifest: man({ permissions: ["templates:register", "agents:register", "presets:register", "concepts:register", "notes:read"] }), setup(api) { api.registerTemplate("calm", calmTemplate); api.registerAgent(new DemoAgent()); api.registerPreset("Quiet Hour", { label: "Quiet hour", deep: { focus: "music" } }); api.registerConcept({ id: "hum-along", title: "Hum along", needs: ["music"], calm: true, minutes: 10 }); api.log("ready " + api.readNotes("x")[0]); } };
ok(pa.register(calm).ok && !pa.register(calm).ok && /already registered/.test(pa.register(calm).errors[0]) && !pa.register({ manifest: man({ id: "no-setup" }) }).ok && !pa.register({ manifest: man({ id: "bad-src" }), setup() {}, source: "fetch('/x')" }).ok && /may not/.test(pa.register({ manifest: man({ id: "bad-src2" }), setup() {}, source: "fetch('/x')" }).errors[0]), "a plugin is registered once, needs a setup function, and its source is scanned");
ok(pa.list()[0].state === "registered" && !o.agents().some((a) => a.name === "DemoAgent"), "nothing runs until the plugin is enabled");
ok(pa.enable("calm-pack").ok && o.agents().some((a) => a.name === "DemoAgent") && pa.presets.has("calm-pack:quiet-hour") && pa.concepts.has("calm-pack:hum-along") && pa.events.some((e) => /ready a note for x/.test(e)), "enabling runs setup: the template, agent, preset and concept are added under the plugin's own name");
const viaPlugin = await o.execute({ profile: { preferredName: "Peggy" }, options: { template: "calm-pack:calm" } }); ok(viaPlugin.asset.title === "Calm sheet" && viaPlugin.analysis.demo === true, "the plugin's template and agent take part in a sheet");
ok(pa.disable("calm-pack").ok && !o.agents().some((a) => a.name === "DemoAgent") && !pa.presets.has("calm-pack:quiet-hour") && (await o.execute({ profile: { preferredName: "Peggy" }, options: { template: "calm-pack:calm" } })).asset.title !== "Calm sheet", "disabling removes everything it added, and its template falls back to the default");
/* permissions and limits */
const mkp = (id, setup, perms = ["templates:register"], extra = {}) => Object.assign({ manifest: man({ id, permissions: perms }), setup }, extra);
const tryEnable = (p) => { const x = pa.register(p); return x.ok ? pa.enable(p.manifest.id) : x; };
ok(/permission/.test(tryEnable(mkp("noperm", (api) => api.registerAgent(new DemoAgent()), ["templates:register"])).error) && /permission/.test(tryEnable(mkp("noperm2", (api) => api.readNotes("x"), ["templates:register"])).error), "a call without its permission is refused");
class AuditLike extends CognicopiaAgent { constructor() { super({ name: "SneakyAudit", stage: "audit" }); } async handle(ctx) { ctx.audit = { status: "pass", fixes: [], problems: [] }; return ctx; } }
ok(/never the audit stage/.test(tryEnable(mkp("sneaky", (api) => api.registerAgent(new AuditLike()), ["agents:register"])).error) && !o.agents().some((a) => a.name === "SneakyAudit"), "a plugin can never add an agent to the audit stage");
class Impostor extends CognicopiaAgent { constructor() { super({ name: "ClinicalAuditAgent", stage: "analyze" }); } }
ok(/already exists/.test(tryEnable(mkp("impostor", (api) => api.registerAgent(new Impostor()), ["agents:register"])).error) && /extend CognicopiaAgent/.test(tryEnable(mkp("notagent", (api) => api.registerAgent({ name: "x", stage: "analyze" }), ["agents:register"])).error), "a plugin cannot take a core agent's name, and must really extend the agent base");
const fail = tryEnable(mkp("halfway", (api) => { api.registerPreset("p1", {}); api.registerAgent(new (class extends CognicopiaAgent { constructor() { super({ name: "HalfAgent", stage: "analyze" }); } })()); throw new Error("setup broke"); }, ["presets:register", "agents:register"]));
ok(!fail.ok && /setup broke/.test(fail.error) && !o.agents().some((a) => a.name === "HalfAgent") && !pa.presets.has("halfway:p1") && pa.list().find((p) => p.id === "halfway").state === "failed", "a plugin whose setup fails is rolled back completely and marked failed");
tryEnable(mkp("boomer", (api) => api.registerTemplate("boom", () => { throw new Error("template broke"); }))); const boom = await o.execute({ profile: { preferredName: "Peggy" }, options: { template: "boomer:boom" } }); ok(boom.audit.status !== "blocked" && boom.asset.pages.resident.blocks.length > 0 && pa.events.some((e) => /template boom failed/.test(e)), "a template that throws falls back to the default sheet");
tryEnable(mkp("overclaimer", (api) => api.registerTemplate("claim", (ctx) => { const b = o.generator.template("default")(ctx); b.pages.caregiver.notes.push("This guarantees a cure and is HIPAA compliant."); return b; }))); const oc = await o.execute({ profile: { preferredName: "Peggy" }, options: { template: "overclaimer:claim" } }); ok(oc.audit.status === "blocked", "a plugin's template that over-promises is blocked by the core audit, which no plugin can replace or switch off");
/* dependencies */
const pb = new PluginArchitect({ orchestrator: createOrchestrator() }); const order = [];
const dep = (id, requires) => ({ manifest: man({ id, requires, permissions: [] }), setup() { order.push(id); } });
pb.register(dep("plug-c", ["plug-b"])); pb.register(dep("plug-b", ["plug-a"])); pb.register(dep("plug-a")); const all = pb.enableAll();
ok(order.join() === "plug-a,plug-b,plug-c" && Object.values(all.results).every((r) => r.ok) && all.problems.length === 0, "dependencies are enabled first, whatever order they were registered in");
ok(/needs this one/.test(pb.disable("plug-a").error) && pb.disable("plug-c").ok && pb.disable("plug-b").ok && pb.disable("plug-a").ok, "a plugin that others need cannot be disabled until they are");
const pc = new PluginArchitect({ orchestrator: createOrchestrator() }); pc.register(dep("cyc-a", ["cyc-b"])); pc.register(dep("cyc-b", ["cyc-a"])); pc.register(dep("lonely", ["ghost-x"]));
const cr = pc.order(); ok(cr.problems.some((p) => /a cycle/.test(p)) && cr.problems.some((p) => /not registered: ghost-x/.test(p)), "a cycle and a missing dependency are reported, not guessed at");
ok(/needs the ghost-x plugin/.test(pc.enable("lonely").error) && pc.enable("nope").ok === false && new PluginArchitect().enable("x").ok === false, "enabling with a missing dependency or no orchestrator is refused");

/* ---------- 30. auditor and suite ---------- */
const s2 = createSuite({ storage: memoryStorage() }), aud = s2.agents.auditor, rep = await aud.run();
ok(ROSTER.length === 30 && ROSTER.map((r) => r[0]).join() === Array.from({ length: 30 }, (_, i) => i + 1).join() && new Set(ROSTER.map((r) => r[1])).size === 30, "the roster lists thirty agents, numbered 1 to 30, each once");
ok(rep.ok && rep.roster.registered === 30 && rep.roster.missing.length === 0 && rep.roster.extra.length === 0 && rep.order.every((x) => x.ok) && rep.smoke.ok && rep.smoke.pages && rep.network.attempts === 0, `all 30 agents are present, the pipeline order holds and a test sheet comes out right (${rep.issues.join("; ") || "no issues"})`);
ok(s2.orchestrator.integrity().ok && s2.orchestrator.agents().length === 30 && PILLAR5_AGENTS.every((n) => s2.orchestrator.agents().some((a) => a.name === n)), "createSuite registers exactly thirty agents and the orchestrator's integrity check passes");
s2.orchestrator.registry.delete("PrivacySentinel"); s2.orchestrator.registry.delete("VoiceAssistant"); const rep2 = await aud.run();
ok(!rep2.ok && rep2.issues.some((i) => /missing agents: 16 PrivacySentinel, 26 VoiceAssistant/.test(i)) && rep2.order.some((x) => !x.ok), "taking two agents away is reported by number and name, and the broken pipeline step is shown");
const s3 = createSuite({ storage: memoryStorage() }), a3 = s3.agents.auditor; s3.orchestrator.registry.delete("NoteAnalyzer"); s3.orchestrator.registry.set("NoteAnalyzer", s3.agents.analyzer); const r3 = await a3.run();
ok(r3.order.find((x) => x.from === "NoteAnalyzer" && x.to === "GenerationAgent").ok && r3.roster.missing.length === 0, "an agent in the analyze stage runs before the generator even when it was re-added last");
const bare = new SystemAuditor({ orchestrator: createOrchestrator() }); const br = await bare.run(); ok(!br.ok && br.roster.missing.length > 20 && (await new SystemAuditor().run()).issues[0] === "no orchestrator attached", "a bare orchestrator reports what is missing, and no orchestrator is a plain issue");
const dg = a3.diagram(); ok(/Notes and profiles: ProfileHub/.test(dg) && /NoteAnalyzer, JourneyForecaster, DifficultyCalibrator/.test(dg) && /PrivacySentinel/.test(dg) && /PrintPreviewAgent$/.test(dg) && !/missing/.test(dg) && /\(missing\)/.test(bare.attach(createOrchestrator()).diagram()), "the diagram shows the pipeline with each step's agents, and marks any that are missing");
const sheet = await s2.orchestrator.execute({ profile: { preferredName: "Peggy", formativeEra: "1938", ailmentTier: 2 }, condition: "vascular", preset: "music-first", seasonal: { date: "2026-11-10" }, options: { template: "reminiscence" } }); ok(sheet.audit.status === "pass" && !/[{}]|\[\[/.test(assetText(sheet.asset)) && sheet.analysis.calibration && sheet.analysis.preset && sheet.analysis.season, "one request through the whole suite uses condition, preset and season together and still passes");
let t = false; try { registerPillar5(null); } catch (e) { t = e instanceof TypeError; } ok(t, "registering with no orchestrator is refused");

if (problems.length) { console.error("pillar 5 check FAILED: " + problems.length + " problem(s), " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("pillar 5 check passed: " + passed + " checks (voice commands and the on-device rule, encrypted sync, forecasts, plugins, the 30-agent audit)");
