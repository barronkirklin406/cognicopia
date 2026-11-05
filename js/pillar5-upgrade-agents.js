/* Cognicopia Pillar 5: next-generation prototypes (Agents 26 to 30).

     26  VoiceAssistant            hands-free navigation and note taking, only where speech stays on this device
     27  P2PSyncPrototype          browser-to-browser sync over WebRTC, with a passphrase, no server, and resident data off by default
     28  JourneyForecaster         which activities a resident is likely to enjoy next, from their own engagement log
     29  PluginArchitect           a registry for add-on modules: manifests, permissions, no network, no audit powers
     30  SystemAuditor             checks that all 30 agents are present and in the right order, and that a sheet still comes out right

   These are prototypes. Three decisions belong to the owner, and each defaults to the safe answer:
     voice      browsers usually send speech to an online service. The assistant refuses to listen unless the browser confirms on-device
                recognition, or a person explicitly allows the online service (allowCloud) and is told what that means.
     sync       sending a resident's details to another device would break "no resident data leaves the device". Sync carries only
                facility settings and ids-only logs unless allowResidentData is set on purpose.
     forecast   a forecast is a pattern in what staff recorded, not a prediction about a person's health.
   Nothing here uses a server. Wiring everything together is createSuite(). */

import { CognicopiaAgent, createOrchestrator, validateAsset, assetText, STAGES, VERSION as CORE_VERSION } from "./agent-orchestrator.js";
import { ClinicalAuditAgent } from "./clinical-audit-agent.js";
import { PrintPreviewAgent } from "./print-preview-modal.js";
import { registerReminiscence } from "./reminiscence-engine.js";
import { registerPillar1 } from "./pillar1-production-agents.js";
import { registerPillar2, CONCEPTS, memoryStorage } from "./pillar2-functionality-agents.js";
import { registerPillar3, PrivacySentinel } from "./pillar3-qa-agents.js";
import { registerPillar4, sha256Hex } from "./pillar4-maintenance-agents.js";

export const VERSION = "1.0.0";
const clip = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const enc = (s) => new TextEncoder().encode(s);
const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));

/* ---------- 26. voice ---------- */
export const HUB_NAMES = Object.freeze(["Today", "Studio", "Activity Packets", "Facility", "Academy", "Resources", "Contact"]);
const HUB_LOOKUP = Object.freeze({ today: "Today", studio: "Studio", "activity packets": "Activity Packets", "activity packet": "Activity Packets", packets: "Activity Packets", facility: "Facility", academy: "Academy", resources: "Resources", contact: "Contact" });
export function parseCommand(text) {
  const t = String(text == null ? "" : text).trim().replace(/[.!?]+$/, ""), l = t.toLowerCase(); let m;
  if (!l) return { intent: "none" };
  if ((m = /^(?:go to|open|show|take me to)(?: the)? (today|studio|activity packets?|packets|facility|academy|resources|contact)$/.exec(l))) return { intent: "navigate", target: HUB_LOOKUP[m[1]] };
  if (/^(?:preview|show)(?: the)? (?:packet|preview)$/.test(l)) return { intent: "preview" };
  if (/^(?:make|create|print)(?: the)? packet$/.test(l)) return { intent: "make-packet", needsConfirm: true };
  if (/^(?:read|show)(?: me)?(?: the)?(?: last| latest| recent)? notes?$/.test(l)) return { intent: "read-notes" };
  if ((m = /^(?:new note|note|add a note|add note|take a note|write a note)(?:[:,]| that)?\s*(.*)$/i.exec(t))) return m[1].trim() ? { intent: "note", text: clip(m[1], 500) } : { intent: "note-start" };
  if (/^(?:yes|confirm|go ahead)$/.test(l)) return { intent: "confirm" };
  if (/^(?:stop|stop listening|cancel|never mind|no)$/.test(l)) return { intent: "stop" };
  if (/^(?:help|what can i say)$/.test(l)) return { intent: "help" };
  return { intent: "unknown", text: clip(t, 80) };
}
export class VoiceAssistant extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "VoiceAssistant", stage: "preview", role: "Next-gen: voice navigation and note assistant (on-device speech only)", capabilities: ["navigate", "dictate-note", "read-notes"], ...o }); this.hub = o.hub || null; this.sentinel = new PrivacySentinel(); this.handlers = o.handlers || {}; this.residentId = o.residentId || null; this.allowCloud = !!o.allowCloud; this.pending = null; this.rec = null; this.now = o.now || (() => Date.now()); this.confirmMs = o.confirmMs || 10000; this.noteMode = false; }
  async handle(ctx) { return ctx; }
  /* What this browser can do, and whether speech would stay on this device. */
  async support(win) {
    const w = win || (typeof window !== "undefined" ? window : null), SR = w && (w.SpeechRecognition || w.webkitSpeechRecognition), out = { recognition: !!SR, local: "unknown", synthesis: !!(w && w.speechSynthesis), canListen: false, reason: "" };
    if (!SR) { out.reason = "this browser has no speech recognition"; return out; }
    try { if (typeof SR.available === "function") { const a = await SR.available({ langs: ["en-US"], processLocally: true }); out.local = a === "available" || a === "readily" ? true : a === "downloadable" || a === "after-download" ? "downloadable" : false; } } catch (e) { out.local = "unknown"; }
    if (out.local === true) { out.canListen = true; out.reason = "speech is recognized on this device"; }
    else if (out.local === "downloadable") out.reason = "on-device recognition needs a one-time language download first";
    else out.reason = "this browser cannot confirm that speech stays on this device, and most browsers send it to an online service";
    if (!out.canListen && this.allowCloud) { out.canListen = true; out.cloud = true; out.reason += ". Online recognition was allowed by staff, so what is said is sent to the browser's speech service."; }
    return out;
  }
  async start(win) {
    const caps = await this.support(win); if (!caps.canListen) return { ok: false, reason: caps.reason, capabilities: caps };
    const w = win || window, SR = w.SpeechRecognition || w.webkitSpeechRecognition, rec = new SR(); rec.lang = "en-US"; rec.continuous = true; rec.interimResults = false; if (!caps.cloud) { try { rec.processLocally = true; } catch (e) { /* not settable */ } }
    rec.onresult = (e) => { for (let i = e.resultIndex || 0; i < e.results.length; i++) if (e.results[i].isFinal) this.hear(e.results[i][0].transcript); };
    rec.onerror = () => { this.rec = null; }; rec.onend = () => { this.rec = null; };
    this.rec = rec; rec.start(); return { ok: true, cloud: !!caps.cloud, capabilities: caps };
  }
  stop() { try { if (this.rec) this.rec.stop(); } catch (e) { /* already stopped */ } this.rec = null; this.pending = null; this.noteMode = false; return true; }
  /* One thing said. Returns what was done, so a screen (or a test) can show it. */
  async hear(text) {
    const cmd = this.noteMode && !/^(stop|cancel)/i.test(String(text).trim()) ? { intent: "note", text: clip(text, 500) } : parseCommand(text), h = this.handlers;
    if (cmd.intent !== "confirm" && this.pending && cmd.intent !== "stop") this.pending = null;
    switch (cmd.intent) {
      case "navigate": if (h.navigate) await h.navigate(cmd.target); return { done: "navigate", target: cmd.target };
      case "preview": if (h.preview) await h.preview(); return { done: "preview" };
      case "make-packet": this.pending = { intent: "make-packet", at: this.now() }; return { done: "ask", say: "Make the packet now? Say yes to confirm." };
      case "confirm": { const p = this.pending; this.pending = null; if (p && this.now() - p.at <= this.confirmMs) { if (h.makePacket) await h.makePacket(); return { done: "make-packet" }; } return { done: "nothing", say: "There is nothing to confirm." }; }
      case "note-start": this.noteMode = true; return { done: "listening-for-note", say: "Go ahead. Say stop when you are done." };
      case "note": { this.noteMode = false; return this.saveNote(cmd.text); }
      case "read-notes": { const notes = this.hub && this.residentId ? this.hub.notes(this.residentId, { last: 3 }).map((n) => n.text) : []; if (h.speak) await h.speak(notes.join(". ")); return { done: "read-notes", notes: notes.length }; }
      case "stop": this.stop(); return { done: "stop" };
      case "help": return { done: "help", say: "You can say: go to Today, preview the packet, make the packet, add a note, read the notes, or stop." };
      case "none": return { done: "nothing" };
      default: return { done: "unknown", say: "I did not understand that." };
    }
  }
  /* A dictated note: identifiers are removed first, then it is kept with the resident's other notes on this device. */
  saveNote(text) {
    if (!this.hub || !this.residentId) return { done: "no-resident", say: "Choose a resident before adding a note." };
    const r = this.sentinel.redact(text); try { this.hub.addNote(this.residentId, r.text); } catch (e) { return { done: "failed", say: "The note could not be saved." }; }
    return { done: "note", removed: r.findings.map((f) => f.kind), say: r.findings.length ? "Saved, with a personal identifier left out." : "Saved." };
  }
  speak(text, win) { const w = win || (typeof window !== "undefined" ? window : null); if (!w || !w.speechSynthesis || !w.SpeechSynthesisUtterance) return false; const voices = w.speechSynthesis.getVoices ? w.speechSynthesis.getVoices() : [], local = voices.find((v) => v.localService); if (voices.length && !local) return false; const u = new w.SpeechSynthesisUtterance(clip(text, 400)); if (local) u.voice = local; u.rate = 0.9; w.speechSynthesis.speak(u); return true; }
}

/* ---------- 27. peer-to-peer sync ---------- */
const SYNC_COLLECTIONS = Object.freeze({ presets: (k) => k.startsWith("preset:"), branding: (k) => k === "branding", feedback: (k) => k === "feedback", engagement: (k) => k === "log", profiles: (k) => k === "index" || k.startsWith("p:") });
export const SYNC_DEFAULT = Object.freeze(["presets", "branding", "feedback", "engagement"]);
const MAX_MSG = 1000000, MAX_ENTRIES = 500;
export class P2PSyncPrototype extends CognicopiaAgent {
  /* o.rtc: () => RTCPeerConnection (injected for tests); o.storage: the adapter whose keys are shared */
  constructor(o = {}) {
    super({ name: "P2PSyncPrototype", stage: "preview", role: "Next-gen: WebRTC facility sync prototype (opt-in, encrypted, no server)", capabilities: ["offer", "answer", "sync"], ...o });
    this.store = o.storage || memoryStorage(); this.rtcFactory = o.rtc || (typeof RTCPeerConnection !== "undefined" ? () => new RTCPeerConnection({ iceServers: [] }) : null);
    this.collections = (o.collections || SYNC_DEFAULT).filter((c) => SYNC_COLLECTIONS[c]); this.allowResidentData = !!o.allowResidentData; this.collections = this.allowResidentData ? [...new Set([...this.collections, "profiles"])] : this.collections.filter((c) => c !== "profiles");   // profiles are in only when staff chose to send resident data
    this.iterations = o.iterations || 210000; this.now = o.now || (() => Date.now()); this.state = "idle"; this.key = null; this.pc = null; this.channel = null; this.sendSeq = 0; this.recvSeq = 0; this.authed = false; this.log = []; this.onChange = o.onChange || null;
  }
  async handle(ctx) { return ctx; }
  note(m) { this.log.push(clip(m, 120)); if (this.log.length > 50) this.log.shift(); }
  meta() { try { return JSON.parse(this.store.get("sync:meta") || "{}"); } catch (e) { return {}; } }
  /* Stamp a key as just changed here, so the newer copy wins when two devices differ. */
  touch(key) { const m = this.meta(); m[key] = this.now(); this.store.set("sync:meta", JSON.stringify(m)); }
  allowed(key) { return this.collections.some((c) => SYNC_COLLECTIONS[c](key)) && !key.startsWith("sync:") && !key.startsWith("bak:"); }
  entries() { const m = this.meta(); return this.store.keys().filter((k) => this.allowed(k)).slice(0, MAX_ENTRIES).map((k) => ({ k, v: this.store.get(k), ts: m[k] || 0 })).filter((e) => e.v != null); }
  async deriveKey(pass, salt) { const s = crypto.subtle; return s.deriveKey({ name: "PBKDF2", salt, iterations: this.iterations, hash: "SHA-256" }, await s.importKey("raw", enc(pass), "PBKDF2", false, ["deriveKey"]), { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]); }
  async seal(obj) { const seq = ++this.sendSeq, iv = crypto.getRandomValues(new Uint8Array(12)), ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc(String(seq)) }, this.key, enc(JSON.stringify(obj))); return JSON.stringify({ n: seq, iv: b64(iv), ct: b64(new Uint8Array(ct)) }); }
  async open(text) { if (String(text).length > MAX_MSG) throw new Error("too large"); const m = JSON.parse(text); if (!(Number.isInteger(m.n) && m.n > this.recvSeq)) throw new Error("replayed or out of order"); const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(m.iv), additionalData: enc(String(m.n)) }, this.key, unb64(m.ct)); this.recvSeq = m.n; return JSON.parse(new TextDecoder().decode(pt)); }
  /* Step 1, on the first device. Returns text to carry to the second device by hand (a message, a QR code, a note). It holds no passphrase. */
  async createOffer(passphrase) {
    this.requirePassphrase(passphrase); if (!this.rtcFactory) throw new Error("this browser has no WebRTC");
    const salt = crypto.getRandomValues(new Uint8Array(16)); this.key = await this.deriveKey(passphrase, salt); this.pc = this.rtcFactory(); this.wire(this.pc.createDataChannel("cognicopia-sync"));
    await this.pc.setLocalDescription(await this.pc.createOffer()); await this.gathered(); this.state = "offered";
    return JSON.stringify({ cognicopiaSync: 1, kind: "offer", salt: b64(salt), iterations: this.iterations, sdp: this.pc.localDescription.sdp, sdpType: this.pc.localDescription.type });
  }
  /* Step 2, on the second device. Returns the answer text to carry back. */
  async acceptOffer(text, passphrase) {
    this.requirePassphrase(passphrase); let o; try { o = JSON.parse(text); } catch (e) { throw new Error("that is not a sync offer"); } if (!o || o.cognicopiaSync !== 1 || o.kind !== "offer" || !o.sdp || !o.salt) throw new Error("that is not a sync offer");
    this.iterations = Math.max(1000, Math.min(1000000, Number(o.iterations) || this.iterations)); this.key = await this.deriveKey(passphrase, unb64(o.salt)); this.pc = this.rtcFactory(); this.pc.ondatachannel = (e) => this.wire(e.channel);
    await this.pc.setRemoteDescription({ type: o.sdpType || "offer", sdp: o.sdp }); await this.pc.setLocalDescription(await this.pc.createAnswer()); await this.gathered(); this.state = "answered";
    return JSON.stringify({ cognicopiaSync: 1, kind: "answer", sdp: this.pc.localDescription.sdp, sdpType: this.pc.localDescription.type });
  }
  /* Step 3, back on the first device. */
  async acceptAnswer(text) { let a; try { a = JSON.parse(text); } catch (e) { throw new Error("that is not a sync answer"); } if (!a || a.kind !== "answer" || !a.sdp || !this.pc) throw new Error("that is not a sync answer"); await this.pc.setRemoteDescription({ type: a.sdpType || "answer", sdp: a.sdp }); this.state = "connecting"; return true; }
  requirePassphrase(p) { if (typeof p !== "string" || p.length < 8) throw new RangeError("the passphrase needs at least 8 characters"); }
  gathered() { const pc = this.pc; if (pc.iceGatheringState === "complete") return Promise.resolve(); return new Promise((res) => { const done = () => res(); const t = setTimeout(done, 4000); pc.addEventListener && pc.addEventListener("icegatheringstatechange", () => { if (pc.iceGatheringState === "complete") { clearTimeout(t); done(); } }); if (!pc.addEventListener) { clearTimeout(t); res(); } }); }
  wire(ch) {
    this.channel = ch;
    ch.onopen = async () => { this.state = "open"; try { await this.send({ t: "hello", nonce: b64(crypto.getRandomValues(new Uint8Array(8))) }); } catch (e) { this.fail("could not greet"); } };
    ch.onmessage = async (e) => { try { const m = await this.open(e.data); if (m.t === "hello") { this.authed = true; this.state = "connected"; this.note("connected"); await this.syncNow(); } else if (m.t === "state" && this.authed) { const r = this.applyRemote(m.entries); await this.send({ t: "ack", applied: r.applied }); this.note("applied " + r.applied); } else if (m.t === "ack" && this.authed) this.note("peer applied " + m.applied); } catch (err) { this.fail("a message could not be opened: wrong passphrase or changed data"); } };
    ch.onclose = () => { if (this.state !== "failed") this.state = "closed"; };
  }
  fail(why) { this.note(why); this.authed = false; this.state = "failed"; try { this.channel && this.channel.close(); } catch (e) { /* already closed */ } }
  async send(obj) { if (!this.channel || this.channel.readyState !== "open") throw new Error("not connected"); this.channel.send(await this.seal(obj)); }
  async syncNow() { if (!this.authed) throw new Error("not connected with the right passphrase"); const e = this.entries(); await this.send({ t: "state", entries: e }); return { sent: e.length }; }
  /* Merge what the other device sent. Only allowed collections, only plain strings, the newer copy wins, a tie goes to the larger value so both devices agree. */
  applyRemote(entries) {
    const list = Array.isArray(entries) ? entries.slice(0, MAX_ENTRIES) : [], m = this.meta(); let applied = 0, skipped = 0;
    for (const e of list) {
      if (!e || typeof e.k !== "string" || typeof e.v !== "string" || e.k.length > 80 || e.v.length > 500000 || !this.allowed(e.k)) { skipped++; continue; }
      const ts = Number(e.ts) || 0, mine = this.store.get(e.k), myTs = m[e.k] || 0;
      if (mine === e.v) continue;
      if (mine == null || ts > myTs || (ts === myTs && e.v > mine)) { this.store.set(e.k, e.v); m[e.k] = ts; applied++; } else skipped++;
    }
    this.store.set("sync:meta", JSON.stringify(m)); if (applied && typeof this.onChange === "function") { try { this.onChange(applied); } catch (err) { /* a listener never breaks the sync */ } } return { applied, skipped };
  }
  close() { try { this.channel && this.channel.close(); } catch (e) { /* closed */ } try { this.pc && this.pc.close(); } catch (e) { /* closed */ } this.state = "closed"; this.key = null; this.authed = false; }
}

/* ---------- 28. journey forecaster ---------- */
const DAY = 86400000;
const slope = (ys) => { const n = ys.length; if (n < 2) return 0; const mx = (n - 1) / 2, my = ys.reduce((s, y) => s + y, 0) / n; let num = 0, den = 0; ys.forEach((y, i) => { num += (i - mx) * (y - my); den += (i - mx) * (i - mx); }); return den ? num / den : 0; };
const conf = (n) => (n >= 8 ? "high" : n >= 3 ? "medium" : "low");
export class JourneyForecaster extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "JourneyForecaster", stage: "analyze", role: "Next-gen: predictive resident journey forecaster (a pattern in staff records, not a health prediction)", capabilities: ["forecast", "journey"], ...o }); this.logger = o.logger || null; this.now = o.now || (() => new Date()); this.halfLifeDays = o.halfLifeDays || 14; }
  async handle(ctx) { const id = ctx.request && ctx.request.residentId; if (!id || !this.logger) return ctx; const rows = this.logger.forResident(id, { days: 120 }); if (!rows.length) return ctx; const f = this.forecast(rows); ctx.analysis = Object.assign({}, ctx.analysis, { forecast: { confidence: f.confidence, next: f.concepts.slice(0, 3).map((c) => c.concept), review: f.review.flag } }); return ctx; }
  /* entries: [{ at, concept, engagement 0..3, timeOfDay? }]. Recent entries count more (half-life in days); each estimate is pulled toward the resident's own average when there are few entries. */
  forecast(entries, o = {}) {
    const rows = (Array.isArray(entries) ? entries : []).map((e) => ({ t: new Date(e && e.at).getTime(), c: clip(e && e.concept, 60), v: Number(e && e.engagement), d: e && e.timeOfDay })).filter((r) => r.c && Number.isFinite(r.t) && r.v >= 0 && r.v <= 3).sort((a, b) => a.t - b.t);
    const now = (o.now instanceof Date ? o.now : this.now()).getTime(), n = rows.length;
    if (!n) return { entries: 0, confidence: "low", concepts: [], bestTime: null, review: { flag: false }, note: "There are no entries yet. Log how activities go and a pattern will appear." , honest: HONEST };
    const w = (r) => Math.pow(0.5, Math.max(0, now - r.t) / (this.halfLifeDays * DAY)), all = rows.reduce((s, r) => s + r.v * w(r), 0) / rows.reduce((s, r) => s + w(r), 0), K = 2;
    const group = (key) => { const m = new Map(); rows.forEach((r) => { const k = r[key]; if (!k) return; (m.get(k) || m.set(k, []).get(k)).push(r); }); return [...m.entries()].map(([k, rs]) => { const sw = rs.reduce((s, r) => s + w(r), 0), sv = rs.reduce((s, r) => s + r.v * w(r), 0), exp = (sv + K * all) / (sw + K); return { key: k, expected: Math.round(exp * 100) / 100, n: rs.length, trend: rs.length >= 4 ? (slope(rs.map((r) => r.v)) > 0.1 ? "up" : slope(rs.map((r) => r.v)) < -0.1 ? "down" : "steady") : "not enough entries", confidence: conf(rs.length) }; }); };
    const concepts = group("c").map((g) => ({ concept: g.key, expected: g.expected, n: g.n, trend: g.trend, confidence: g.confidence })).sort((a, b) => b.expected - a.expected || b.n - a.n);
    const times = group("d").sort((a, b) => b.expected - a.expected), best = times[0] ? { timeOfDay: times[0].key, expected: times[0].expected, confidence: times[0].confidence } : null;
    let review = { flag: false }; if (n >= 8) { const last = rows.slice(-4), prev = rows.slice(-8, -4), mean = (a) => a.reduce((s, r) => s + r.v, 0) / a.length, drop = mean(prev) - mean(last); if (drop >= 0.75) review = { flag: true, previous: Math.round(mean(prev) * 100) / 100, recent: Math.round(mean(last) * 100) / 100, message: "Engagement has been lower over the last few entries. It may be worth talking it over with the care team." }; }
    return { entries: n, confidence: conf(n), average: Math.round(all * 100) / 100, concepts, bestTime: best, review, honest: HONEST, note: n < 3 ? "Only a few entries so far, so these are early guesses." : "" };
  }
  /* A week-by-week picture, newest last. */
  journey(entries) { const rows = (Array.isArray(entries) ? entries : []).map((e) => ({ t: new Date(e && e.at).getTime(), v: Number(e && e.engagement), c: clip(e && e.concept, 60) })).filter((r) => Number.isFinite(r.t) && r.v >= 0 && r.v <= 3).sort((a, b) => a.t - b.t); if (!rows.length) return []; const start = rows[0].t, weeks = new Map(); rows.forEach((r) => { const k = Math.floor((r.t - start) / (7 * DAY)); (weeks.get(k) || weeks.set(k, []).get(k)).push(r); }); return [...weeks.entries()].sort((a, b) => a[0] - b[0]).map(([k, rs]) => ({ week: k + 1, from: new Date(start + k * 7 * DAY).toISOString().slice(0, 10), entries: rs.length, average: Math.round(rs.reduce((s, r) => s + r.v, 0) / rs.length * 100) / 100, best: rs.slice().sort((a, b) => b.v - a.v)[0].c })); }
  /* Concept suggestions that combine the forecast with the library, skipping what was tried too little to judge. */
  suggest(entries, o = {}) { const f = this.forecast(entries, o), known = new Map(CONCEPTS.map((c) => [c.title.toLowerCase(), c])), tried = new Set(f.concepts.map((c) => c.concept.toLowerCase())); const likely = f.concepts.filter((c) => c.expected >= 1.8).slice(0, 3).map((c) => ({ concept: c.concept, why: "enjoyed in " + c.n + " of the recorded sessions (expected " + c.expected + " of 3)", confidence: c.confidence })); const fresh = CONCEPTS.filter((c) => !tried.has(c.title.toLowerCase())).slice(0, 2).map((c) => ({ concept: c.title, why: "not tried yet, a gentle one to offer", confidence: "low" })); return { likely, fresh, review: f.review, honest: HONEST, known: known.size }; }
}
const HONEST = "A pattern in what staff recorded. It is not a prediction about anyone's health.";

/* ---------- 29. plugin architect ---------- */
export const HOST_API = "1.0.0";
export const PERMISSIONS = Object.freeze(["templates:register", "agents:register", "presets:register", "concepts:register", "notes:read"]);
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const cmp = (a, b) => { const x = SEMVER.exec(a), y = SEMVER.exec(b); if (!x || !y) return 0; for (let i = 1; i <= 3; i++) if (+x[i] !== +y[i]) return +x[i] - +y[i]; return 0; };
const CORE_NAMES = new Set(["GenerationAgent", "ClinicalAuditAgent", "PrintPreviewAgent", "ReminiscenceAgent"]);
export function validateManifest(m) {
  const errors = [], x = m && typeof m === "object" ? m : {};
  if (!/^[a-z][a-z0-9-]{2,39}$/.test(String(x.id || ""))) errors.push("id must be 3 to 40 lowercase letters, digits or hyphens, starting with a letter");
  if (!clip(x.name, 60)) errors.push("a plugin needs a name"); if (!SEMVER.test(String(x.version || ""))) errors.push("version must look like 1.2.3");
  const need = String(x.hostApi || ""), mm = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(need); if (!mm) errors.push("hostApi must look like ^1.0.0"); else if (+mm[1] !== +SEMVER.exec(HOST_API)[1] || cmp(HOST_API, need.slice(1)) < 0) errors.push("this plugin needs host API " + need + " and this is " + HOST_API);
  if (!Array.isArray(x.permissions) || x.permissions.some((p) => !PERMISSIONS.includes(p))) errors.push("permissions must be drawn from: " + PERMISSIONS.join(", "));
  if (x.network !== false) errors.push("a plugin must declare network: false; no plugin may use the network");
  if (x.requires != null && (!Array.isArray(x.requires) || x.requires.some((r) => !/^[a-z][a-z0-9-]{2,39}$/.test(String(r))))) errors.push("requires must be a list of plugin ids");
  return { ok: errors.length === 0, errors };
}
/* A best-effort look at source text for things a plugin may not do. It is a tripwire, not a sandbox: add-ons must still come from a source you trust. */
const RISKY = [[/\bfetch\s*\(/, "fetch"], [/\bXMLHttpRequest\b/, "XMLHttpRequest"], [/\bWebSocket\b/, "WebSocket"], [/\bEventSource\b/, "EventSource"], [/\bsendBeacon\b/, "sendBeacon"], [/\bimportScripts\b/, "importScripts"], [/\bimport\s*\(/, "dynamic import"], [/\beval\s*\(/, "eval"], [/\bnew\s+Function\b/, "new Function"], [/\bdocument\s*\.\s*cookie\b/, "document.cookie"], [/\b(?:local|session)Storage\b/, "direct storage"], [/\bindexedDB\b/, "indexedDB"], [/\bwindow\s*\.\s*open\b/, "window.open"], [/\bRTCPeerConnection\b/, "RTCPeerConnection"], [/<script\b/i, "a script tag"], [/https?:\/\//, "a web address"]];
export function scanSource(src) { const t = String(src == null ? "" : src), findings = RISKY.filter(([re]) => re.test(t)).map(([, n]) => n); return { ok: findings.length === 0, findings, note: "A tripwire, not a sandbox." }; }
export class PluginArchitect extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "PluginArchitect", stage: "preview", role: "Next-gen: modular plugin ecosystem architect", capabilities: ["register", "enable", "disable", "permissions"], ...o }); this.orch = o.orchestrator || null; this.plugins = new Map(); this.presets = new Map(); this.concepts = new Map(); this.notesReader = o.notes || null; this.events = []; }
  async handle(ctx) { return ctx; }
  attach(orchestrator) { this.orch = orchestrator; return this; }
  note(m) { this.events.push(clip(m, 160)); if (this.events.length > 100) this.events.shift(); }
  /* plugin: { manifest, setup(api), source? }. source, if given, is scanned. Nothing runs until enable(). */
  register(plugin) {
    const v = validateManifest(plugin && plugin.manifest); if (!v.ok) return { ok: false, errors: v.errors };
    if (typeof plugin.setup !== "function") return { ok: false, errors: ["a plugin needs a setup function"] };
    const id = plugin.manifest.id; if (this.plugins.has(id)) return { ok: false, errors: ["a plugin with id " + id + " is already registered"] };
    if (plugin.source != null) { const sc = scanSource(plugin.source); if (!sc.ok) return { ok: false, errors: ["the source uses things plugins may not: " + sc.findings.join(", ")] }; }
    this.plugins.set(id, { plugin, state: "registered", added: { templates: [], agents: [], presets: [], concepts: [] }, error: "" }); return { ok: true, id };
  }
  /* Dependencies first, in a stable order; a missing dependency or a cycle is reported, not guessed at. */
  order(ids) {
    const list = ids || [...this.plugins.keys()], out = [], state = {}, problems = [];
    const visit = (id, trail) => { if (state[id] === 2) return; if (state[id] === 1) { problems.push("a cycle: " + [...trail, id].join(" -> ")); return; } const rec = this.plugins.get(id); if (!rec) { problems.push("a plugin is needed but not registered: " + id); return; } state[id] = 1; for (const r of rec.plugin.manifest.requires || []) visit(r, [...trail, id]); state[id] = 2; out.push(id); };
    list.slice().sort().forEach((id) => visit(id, [])); return { order: out, problems };
  }
  api(rec) {
    const id = rec.plugin.manifest.id, perms = new Set(rec.plugin.manifest.permissions), need = (p) => { if (!perms.has(p)) throw new Error("this plugin does not have the " + p + " permission"); };
    return Object.freeze({
      registerTemplate: (name, fn) => { need("templates:register"); if (!/^[a-z][a-z0-9-]{1,30}$/.test(String(name)) || typeof fn !== "function") throw new Error("a template needs a plain name and a function"); const full = id + ":" + name, base = this.orch.generator.template("default"); this.orch.registerLocalTemplate(full, (ctx) => { try { return fn(ctx); } catch (e) { this.note(id + ": template " + name + " failed, the default was used"); return base(ctx); } }); rec.added.templates.push(full); return full; },
      registerAgent: (agent) => { need("agents:register"); if (!(agent instanceof CognicopiaAgent)) throw new Error("an agent must extend CognicopiaAgent"); if (!STAGES.includes(agent.stage) || agent.stage === "audit") throw new Error("a plugin agent may be in the analyze, generate or preview stage, never the audit stage"); if (CORE_NAMES.has(agent.name) || this.orch.registry.has(agent.name)) throw new Error("an agent named " + agent.name + " already exists"); this.orch.use(agent); rec.added.agents.push(agent.name); return agent.name; },
      registerPreset: (name, preset) => { need("presets:register"); const k = id + ":" + clip(name, 30).toLowerCase().replace(/[^a-z0-9-]+/g, "-"); this.presets.set(k, { label: clip(preset && preset.label || name, 60), deep: preset && preset.deep || {}, tier: null, note: "From the " + id + " plugin." }); rec.added.presets.push(k); return k; },
      registerConcept: (c) => { need("concepts:register"); if (!c || !/^[a-z][a-z0-9-]{2,40}$/.test(String(c.id)) || !clip(c.title, 60)) throw new Error("a concept needs an id and a title"); const k = id + ":" + c.id; this.concepts.set(k, { id: k, title: clip(c.title, 60), needs: Array.isArray(c.needs) ? c.needs.slice(0, 3).map(String) : [], calm: !!c.calm, minutes: Math.max(5, Math.min(60, Number(c.minutes) || 15)), group: c.group !== false }); rec.added.concepts.push(k); return k; },
      readNotes: (residentId, o) => { need("notes:read"); return this.notesReader ? this.notesReader(residentId, o) : []; },
      log: (m) => this.note(id + ": " + m), hostApi: HOST_API
    });
  }
  enable(id) {
    const rec = this.plugins.get(id); if (!rec) return { ok: false, error: "no such plugin" }; if (rec.state === "enabled") return { ok: true, already: true }; if (!this.orch) return { ok: false, error: "no orchestrator attached" };
    for (const r of rec.plugin.manifest.requires || []) { const d = this.plugins.get(r); if (!d || d.state !== "enabled") return { ok: false, error: "needs the " + r + " plugin to be enabled first" }; }
    try { rec.plugin.setup(this.api(rec)); rec.state = "enabled"; rec.error = ""; this.note("enabled " + id); return { ok: true }; }
    catch (e) { this.undo(rec); rec.state = "failed"; rec.error = clip(e && e.message, 120); this.note("failed " + id + ": " + rec.error); return { ok: false, error: rec.error }; }
  }
  undo(rec) { for (const a of rec.added.agents) this.orch.registry.delete(a); for (const t of rec.added.templates) this.orch.generator.templates.delete(t); for (const p of rec.added.presets) this.presets.delete(p); for (const c of rec.added.concepts) this.concepts.delete(c); rec.added = { templates: [], agents: [], presets: [], concepts: [] }; }
  disable(id) { const rec = this.plugins.get(id); if (!rec) return { ok: false, error: "no such plugin" }; for (const o of this.plugins.values()) if (o.state === "enabled" && (o.plugin.manifest.requires || []).includes(id)) return { ok: false, error: "the " + o.plugin.manifest.id + " plugin needs this one" }; this.undo(rec); rec.state = "registered"; this.note("disabled " + id); return { ok: true }; }
  enableAll() { const { order, problems } = this.order(), results = {}; for (const id of order) results[id] = this.enable(id); return { results, problems }; }
  list() { return [...this.plugins.entries()].map(([id, r]) => ({ id, name: r.plugin.manifest.name, version: r.plugin.manifest.version, state: r.state, error: r.error, permissions: r.plugin.manifest.permissions.slice(), added: JSON.parse(JSON.stringify(r.added)) })); }
}

/* ---------- 30. system auditor ---------- */
export const ROSTER = Object.freeze([
  [1, "GenerationAgent", "core"], [2, "ClinicalAuditAgent", "core"], [3, "PrintPreviewAgent", "core"], [4, "ReminiscenceAgent", "core"],
  [5, "VariationAgent", "p1"], [6, "FormatAgent", "p1"], [7, "SeasonalPackAgent", "p1"], [8, "BulkCompiler", "p1"], [9, "LineArtPromptArchitect", "p1"],
  [10, "ProfileHub", "p2"], [11, "NoteAnalyzer", "p2"], [12, "DeepCustomizationAgent", "p2"], [13, "DifficultyCalibrator", "p2"], [14, "BrandingCoordinator", "p2"], [15, "EngagementLogger", "p2"],
  [16, "PrivacySentinel", "p3"], [17, "CustomizationValidator", "p3"], [18, "AccessibilityChecker", "p3"], [19, "FeedbackCategorizer", "p3"], [20, "ClientCommsAssistant", "p3"],
  [21, "OfflineCacheManager", "p4"], [22, "ProfileIntegritySentinel", "p4"], [23, "DomCompatibilityTester", "p4"], [24, "PerformanceProfiler", "p4"], [25, "LicenseStateMonitor", "p4"],
  [26, "VoiceAssistant", "p5"], [27, "P2PSyncPrototype", "p5"], [28, "JourneyForecaster", "p5"], [29, "PluginArchitect", "p5"], [30, "SystemAuditor", "p5"]
]);
/* The pipeline as drawn: notes and profiles, then analysis and recommendation, then generators, then the zero-PII and dignity checks, then the offline engine and the preview. */
const FLOW = Object.freeze([["ProfileHub", "NoteAnalyzer"], ["NoteAnalyzer", "GenerationAgent"], ["FormatAgent", "ClinicalAuditAgent"], ["ClinicalAuditAgent", "PrivacySentinel"], ["PrivacySentinel", "PrintPreviewAgent"]]);
export class SystemAuditor extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "SystemAuditor", stage: "preview", role: "Next-gen: system diagnostic and integration auditor (agent 30)", capabilities: ["roster", "order", "smoke", "privacy"], ...o }); this.orch = o.orchestrator || null; }
  async handle(ctx) { return ctx; }
  attach(orchestrator) { this.orch = orchestrator; return this; }
  /* Run every check. smoke: the request for the test sheet. Returns { ok, issues, roster, order, smoke, breaker, stages }. */
  async run(o = {}) {
    const orch = this.orch, issues = []; if (!orch) return { ok: false, issues: ["no orchestrator attached"], roster: null };
    const names = orch.agents().map((a) => a.name), have = new Set(names);
    const missing = ROSTER.filter(([, n]) => !have.has(n)).map(([i, n]) => i + " " + n), extra = names.filter((n) => !ROSTER.some(([, r]) => r === n));
    if (missing.length) issues.push("missing agents: " + missing.join(", "));
    const dup = names.filter((n, i) => names.indexOf(n) !== i); if (dup.length) issues.push("duplicate agent names: " + dup.join(", "));
    const integ = orch.integrity(); for (const p of integ.pings) if (!p.ok) issues.push("an agent did not answer: " + p.name);
    for (const s of integ.stages) if (!s.covered && (s.stage === "generate" || s.stage === "audit")) issues.push("no agent in the " + s.stage + " stage");
    /* order: each arrow of the flow must hold, by position in the registry (per stage order is the order they were added) */
    const pos = (n) => names.indexOf(n), stageRank = (n) => { const a = orch.agents().find((x) => x.name === n); return a ? STAGES.indexOf(a.stage) : -1; }, order = [];
    for (const [a, b] of FLOW) { if (!have.has(a) || !have.has(b)) { order.push({ from: a, to: b, ok: false, why: "one of them is missing" }); continue; } const ra = stageRank(a), rb = stageRank(b), ok = ra < rb || (ra === rb && pos(a) < pos(b)); order.push({ from: a, to: b, ok }); if (!ok) issues.push(a + " should run before " + b); }
    /* a sheet still comes out right, and nothing reached the network while it was made */
    const attempts = []; let guard = null; try { const ps = new PrivacySentinel(); if (typeof window !== "undefined") guard = ps.installNetworkGuard(window); } catch (e) { guard = null; }
    const req = o.smoke || { profile: { preferredName: "Test Resident", formativeEra: "1950s", ailmentTier: 2, hobbies: "gardening" }, options: { template: "reminiscence" } };
    let smoke = { ok: false }; try { const t0 = Date.now(), r = await orch.execute(req); smoke = { ok: r.ok !== false && validateAsset(r.asset).length === 0 && r.audit.status !== "blocked" && !/[{}]|\[\[/.test(assetText(r.asset)), status: r.audit.status, source: r.source, ms: Date.now() - t0, pages: ["resident", "caregiver", "sensory"].every((k) => r.asset.pages[k]) }; if (!smoke.ok) issues.push("the test sheet did not come out right (audit: " + r.audit.status + ")"); } catch (e) { issues.push("the test sheet could not be made"); }
    if (guard) { attempts.push(...guard.attempts()); guard.restore(); } if (attempts.length) issues.push("the page called another host while a sheet was made: " + [...new Set(attempts.map((a) => a.host))].join(", "));
    const breaker = integ.breaker; if (breaker === "open") issues.push("the online-provider circuit breaker is open, so every sheet is made locally");
    return { ok: issues.length === 0, issues, roster: { expected: ROSTER.length, registered: names.length, missing, extra, duplicates: dup }, order, smoke, breaker, stages: integ.stages.map((s) => s.stage + ":" + s.agents.length), network: { attempts: attempts.length }, coreVersion: CORE_VERSION };
  }
  /* The pipeline in words, with the agents that are present at each step. */
  diagram() {
    const has = (n) => (this.orch && this.orch.agents().some((a) => a.name === n)), mark = (n) => (has(n) ? n : n + " (missing)");
    return ["Notes and profiles: " + mark("ProfileHub"), "  -> Analyzer and recommender: " + ["NoteAnalyzer", "JourneyForecaster", "DifficultyCalibrator"].map(mark).join(", "), "  -> Generators and variable injection: " + ["GenerationAgent", "ReminiscenceAgent", "FormatAgent"].map(mark).join(", "), "  -> Zero-PII and dignity: " + ["ClinicalAuditAgent", "PrivacySentinel", "AccessibilityChecker"].map(mark).join(", "), "  -> Offline engine and print preview: " + ["OfflineCacheManager", "PrintPreviewAgent"].map(mark).join(", ")].join("\n");
  }
}

/* ---------- wiring ---------- */
export const PILLAR5_AGENTS = Object.freeze(["VoiceAssistant", "P2PSyncPrototype", "JourneyForecaster", "PluginArchitect", "SystemAuditor"]);
export function registerPillar5(orchestrator, o = {}) {
  if (!orchestrator || typeof orchestrator.use !== "function") throw new TypeError("registerPillar5 needs an orchestrator");
  const agents = { voice: new VoiceAssistant(o.voice || {}), sync: new P2PSyncPrototype(o.sync || {}), forecaster: new JourneyForecaster(o.forecaster || {}), plugins: new PluginArchitect({ orchestrator, ...(o.plugins || {}) }), auditor: new SystemAuditor({ orchestrator }) };
  Object.values(agents).forEach((a) => orchestrator.use(a));
  return agents;
}
/* All thirty agents, in the order the pipeline needs: audit first, then the engine, then the pillars, then the preview. */
export function createSuite(o = {}) {
  const orchestrator = createOrchestrator(o.orchestrator || {}), storage = o.storage || memoryStorage();
  orchestrator.use(new ClinicalAuditAgent()); registerReminiscence(orchestrator);
  const p1 = registerPillar1(orchestrator, o.p1 || {}), p2 = registerPillar2(orchestrator, Object.assign({ storage }, o.p2 || {})), p3 = registerPillar3(orchestrator, o.p3 || {});
  const p4 = registerPillar4(orchestrator, Object.assign({ storage }, o.p4 || {}));
  const p5 = registerPillar5(orchestrator, { forecaster: Object.assign({ logger: p2.engagement }, o.p5 && o.p5.forecaster), voice: Object.assign({ hub: p2.hub }, o.p5 && o.p5.voice), sync: Object.assign({ storage }, o.p5 && o.p5.sync), plugins: Object.assign({ notes: (id, x) => p2.hub.notes(id, x) }, o.p5 && o.p5.plugins) });
  orchestrator.use(new PrintPreviewAgent());
  return { orchestrator, storage, agents: Object.assign({}, p1, p2, p3, p4, p5) };
}
export { sha256Hex };
