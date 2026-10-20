/* =====================================================================
   Checks for the shared Voice kit (js/voiceKit.js) with a stand-in for the
   browser's speech: which voices are used and in what order, that a voice
   that streams from a server is never used, the pace and pitch, the pauses
   between pieces, voices that arrive late, and that nothing reaches out.
   Exit 0 = pass.
   ===================================================================== */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const V = (name, lang = "en-US", local = true, extra = {}) => Object.assign({ name, lang, localService: local, voiceURI: name, default: false }, extra);

function boot(voices, o = {}) {
  const spoken = [], listeners = {}, timers = [];
  let list = voices.slice();
  const synth = {
    getVoices: () => list, cancel: () => { spoken.push("cancel"); },
    speak: u => { spoken.push(u); if (o.autoEnd !== false) setImmediate(() => u.onend && u.onend()); },
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); }
  };
  const store = {};
  const win = {
    speechSynthesis: synth, SpeechSynthesisUtterance: function (t) { this.text = t; },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    document: { getElementById: () => null, createElement: () => ({}), head: {}, body: {} },
    AudioContext: undefined
  };
  const ctx = vm.createContext({ window: win, globalThis: win, setTimeout: (f, ms) => { timers.push(ms); return setTimeout(f, Math.min(ms, 1)); }, clearTimeout, setInterval: () => 0, clearInterval: () => {}, setImmediate, console });
  vm.runInContext(read("js/voiceKit.js"), ctx);
  return { K: win.CogniVoice, spoken, setVoices: v => { list = v; (listeners.voiceschanged || []).forEach(f => f()); }, store, timers, win };
}
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---------- which voices, in what order ---------- */
const device = [
  V("Microsoft David Desktop - English (United States)"), V("Samantha"), V("Zarvox"), V("Fred"), V("Google US English", "en-US", false),
  V("Microsoft Aria Online (Natural) - English (United States)", "en-US", false), V("Ava (Premium)", "en-US"), V("Daniel (Enhanced)", "en-GB"),
  V("Siri Voice 2", "en-US"), V("Amelie", "fr-CA"), V("eSpeak English", "en"), V("Microsoft Jenny Natural", "en-US")
];
{
  const { K } = boot(device);
  const names = K.voices().map(v => v.name);
  ok(!names.includes("Google US English") && !names.includes("Microsoft Aria Online (Natural) - English (United States)"), "a voice that streams from a server is never used (the words could carry a first name)");
  ok(!names.includes("Zarvox") && !names.includes("Fred") && !names.some(n => /eSpeak/i.test(n)), "novelty and old synthesizer voices are dropped");
  ok(!names.includes("Amelie"), "only English voices");
  eq(names[0], "Microsoft Jenny Natural", "a voice named Natural comes first");
  ok(names.indexOf("Ava (Premium)") < names.indexOf("Samantha") && names.indexOf("Samantha") < names.indexOf("Microsoft David Desktop - English (United States)"), "premium before a plain modern name, and the old desktop voice last");
  ok(K.best().name === "Microsoft Jenny Natural", "best() is the top of the list");
  K.setVoice("Samantha"); ok(K.best().name === "Samantha", "the voice a person chose is kept");
  K.setVoice("No Such Voice"); ok(K.best().name === "Microsoft Jenny Natural", "a chosen voice that is gone falls back to the best one");
  K.setHifi(false); eq(K.best().name, "Microsoft David Desktop - English (United States)", "with High-Fidelity off the device's own first local English voice is used, as before");
}

/* ---------- voices that arrive late (iPad Safari) ---------- */
{
  const b = boot([]);
  eq(b.K.voices().length, 0, "no voices at first");
  let heard = 0; b.K.onVoices(() => { heard++; });
  b.setVoices([V("Ava (Premium)"), V("Samantha")]);
  eq(b.K.voices().map(v => v.name), ["Ava (Premium)", "Samantha"], "voices that arrive on voiceschanged are read");
  ok(heard >= 1, "listeners are told when the list fills");
}

/* ---------- pieces and pauses ---------- */
{
  const { K } = boot(device);
  const s = K.segments("Good morning, Dorothy. Shall we begin... when you are ready? Mr. Smith is here: please sit.");
  eq(s.map(x => x.text), ["Good morning, Dorothy.", "Shall we begin...", "when you are ready?", "Mr. Smith is here:", "please sit."], "cut at commas, full stops, ellipses and colons, but not after Mr.");
  eq(s.map(x => x.gap), [320, 480, 320, 200, 0], "a short gap after a comma, a longer one after a full stop and the longest after an ellipsis; none after the last");
  eq(K.segments("Yes, please.").map(x => x.text), ["Yes, please."], "a very short piece is not chopped");
  eq(K.segments("It costs 3.5 dollars today.").length, 1, "a decimal point is not a sentence end");
  eq(K.segments("   ").length, 0, "nothing to say, nothing spoken");
}

/* ---------- pace and pitch ---------- */
{
  const b = boot(device);
  b.K.speak("Hello there, friend. Welcome.");
  await wait(60);
  const us = b.spoken.filter(x => typeof x === "object");
  ok(us.length === 2, `two pieces were spoken (${us.length})`);
  ok(us.every(u => u.rate === 0.90 && u.pitch === 1.0), "Natural pace is 0.90 and pitch is 1.0");
  ok(us.every(u => u.voice && u.voice.name === "Microsoft Jenny Natural" && u.lang === "en-US"), "the best voice is used");
  ok(b.timers.some(ms => ms === 320), "a pause was scheduled after the full stop");
  b.K.setRate("slow"); eq(b.K.rate(), 0.78, "Slow is 0.78"); b.K.setRate("normal"); eq(b.K.rate(), 1.0, "Normal is 1.0"); b.K.setRate("bogus"); eq(b.K.rate(), 1.0, "an unknown pace changes nothing");
  eq(b.K.PACES.map(p => p.label), ["Slow", "Natural", "Normal"], "the three paces");
  ok(/cognicopia_voice/.test(Object.keys(b.store).join()) && !/Dorothy/.test(JSON.stringify(b.store)), "only the voice and pace are stored, nothing about a person");
  const n = b.spoken.length; b.K.speak("One. Two. Three."); b.K.stop(); await wait(30);
  ok(b.spoken.filter(x => typeof x === "object").length <= n + 1, "stop() ends a queue at once");
}

/* ---------- the sample and the files ---------- */
{
  const { K } = boot(device);
  eq(K.SAMPLE, "Welcome to today’s activity.", "the test sentence");
}
const kit = read("js/voiceKit.js");
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|importScripts/.test(strip(kit)), "the voice kit makes no network request");
ok(!/https?:\/\//.test(strip(kit)), "and holds no web address");
for (const f of ["tablet.html", "index.html", "builder.html"]) ok(/<script src="js\/voiceKit\.js"><\/script>/.test(read(f)), `${f} loads the voice kit`);
ok(read("sw.js").includes('"js/voiceKit.js"'), "the voice kit is saved for offline use");
ok(/CogniVoice/.test(read("js/tablet.js")) && /id="tbVoice"/.test(read("tablet.html")), "the Tablet toolbar has Voice settings");
ok(/CogniVoice/.test(read("index.html")) && /data-voice/.test(read("index.html")), "Tablet Interactive Mode has Voice settings");
ok(/data-pl="vset"/.test(read("builder.html")) && /High-Fidelity Voice/.test(read("builder.html")), "the Academy has Voice settings and the High-Fidelity switch");

console.log(problems.length ? `voice kit check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ") : `voice kit check passed: ${passed} checks (local voices only, ranking, late voices, pace and pitch, pauses, nothing leaving the device)`);
process.exit(problems.length ? 1 : 0);
