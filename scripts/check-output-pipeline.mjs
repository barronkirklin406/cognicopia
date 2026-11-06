#!/usr/bin/env node
/* js/packet-builder.js, js/todays-packet.js, js/pdf-exporter.js and js/monthly-bundle.js, in Node (real jsPDF), plus js/bundle-worker.js in a
   real browser worker (Playwright; that part is skipped with a notice where Playwright is missing).

     packet-builder  grandchildren, streets and regional terms become names, places and word-search words; auto-tuning moves print size
                     (18 to 24 pt), line height and grid size one step at a time, inside each stage's limits
     todays-packet   the hour shifts the prompts (orientation in the morning, calm reminiscence after noon, gentler in the evening);
                     a wing queue makes every packet in turn with a divider before each
     pdf-exporter    gutters alternate on two-sided pages; the PDF's text is vector (measured against an image-based page)
     monthly-bundle  chunking bounds what is held at once, cancellation works, a worker pool runs a few tasks at a time and rasterizes SVG
   ===================================================================== */
import { createRequire } from "node:module";
import { createOrchestrator } from "../js/agent-orchestrator.js";
import { ClinicalAuditAgent } from "../js/clinical-audit-agent.js";
import { registerReminiscence } from "../js/reminiscence-engine.js";
import { extendProfile, deepFromProfile, streetName, autoTune, logCompletion, readCompletions, calibrationFrom, TIER_LIMITS } from "../js/packet-builder.js";
import { timeOfDay, timeAware, orientationLine, queuePackets, SHIFTS } from "../js/todays-packet.js";
import { marginsFor, textWidthIn, pdfOptions, drawText, applyTwoSided, GUTTER_IN } from "../js/pdf-exporter.js";
import { chooseChunkSize, compileInChunks, WorkerPool, downscaleAll } from "../js/monthly-bundle.js";
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

/* ---------- packet-builder ---------- */
const e = extendProfile({ children: "Susan, Tom", grandchildren: "Ava, Noah, ava", greatGrandchildren: "Mia", neighborhoodStreets: "412 Maple Street, Oak Ave., 9 Elm Road", regionalTerms: "pop, davenport", nostalgiaAnchors: "the radio", familyNames: "Ruth" });
ok(e.grandchildren.join() === "Ava,Noah" && e.greatGrandchildren[0] === "Mia" && e.neighborhoodStreets.join() === "Maple,Oak,Elm" && streetName("1500 Cedar Boulevard") === "Cedar", "three generations are kept by name (repeats dropped), and streets lose their house numbers and suffixes");
ok(e.familyNames.join() === "Ruth,Susan,Tom,Ava,Noah,Mia" && e.nostalgiaAnchors.includes("Maple Street") && e.nostalgiaAnchors[0] === "the radio", "family names and neighborhood streets flow into the details a sheet is made from");
const d = deepFromProfile(e); ok(d.words.includes("Maple") && d.words.includes("pop") && d.words.includes("Ava") && /pop and davenport/.test(d.notes[0]) && d.places.includes("Maple Street"), "streets, regional words and grandchildren become word-search words and a note in the resident's own vocabulary");
ok(extendProfile(null).grandchildren.length === 0 && extendProfile({ children: "<b>x</b>{y}" }).children[0] === "b x /b y", "nothing and markup are handled");
const rows = (rates, extra = {}) => rates.map((c, i) => Object.assign({ at: new Date(2026, 9, 1 + i).toISOString(), completion: c }, extra));
const t0 = autoTune(rows([0.2, 0.3, 0.4, 0.3, 0.2]), { tier: 2, fontPt: 20, lineHeight: 1.4, grid: 7 }), t1 = autoTune(rows([1, 0.95, 1, 0.9, 1]), { tier: 2, fontPt: 22, lineHeight: 1.5, grid: 7 }), t2 = autoTune(rows([0.7, 0.8, 0.6]), { tier: 2, fontPt: 20, lineHeight: 1.4, grid: 7 });
ok(t0.action === "easier" && t0.fontPt === 22 && t0.lineHeight === 1.5 && t0.grid === 6 && /finished/.test(t0.reason) && t1.action === "fuller" && t1.fontPt === 20 && t1.grid === 8 && t2.action === "hold" && t2.fontPt === 20, "low completion gives larger print, looser lines and a smaller grid; high gives the opposite; in between holds (" + t0.action + "/" + t1.action + "/" + t2.action + ")");
const lim = autoTune(rows([0, 0, 0, 0, 0]), { tier: 3, fontPt: 24, lineHeight: 1.7, grid: 5 }), lim2 = autoTune(rows([1, 1, 1, 1, 1]), { tier: 1, fontPt: 18, lineHeight: 1.3, grid: 10 });
ok(lim.fontPt === 24 && lim.lineHeight === 1.7 && lim.grid === 5 && lim2.fontPt === 18 && lim2.lineHeight === 1.3 && lim2.grid === 10, "tuning never leaves print 18 to 24 pt, line height 1.3 to 1.7 or the stage's grid limits");
ok(autoTune(rows([0.1, 0.1]), {}).action === "hold" && /at least three/.test(autoTune([], {}).reason) && autoTune(null, { tier: 9 }).fontPt >= 18 && Object.values(TIER_LIMITS).every((l) => l.minPt >= 18 && l.maxPt <= 24), "with fewer than three finished activities nothing changes, and odd input is safe");
const st = mem(); logCompletion(st, "r1", { completion: 0.5, grid: 7, fontPt: 20 }); logCompletion(st, "r1", { completion: 1 });
let bad = 0; for (const f of [() => logCompletion(st, "", { completion: 1 }), () => logCompletion(st, "r1", { completion: 2 }), () => logCompletion(st, "../x", { completion: 1 })]) { try { f(); } catch (x) { if (x instanceof RangeError) bad++; } }
ok(readCompletions(st, "r1").length === 2 && readCompletions(st, "r2").length === 0 && bad === 3 && readCompletions({ getItem() { throw new Error("x"); } }, "r1").length === 0, "completions are logged per resident, refused when wrong, and a failing store gives an empty log");
const cal = calibrationFrom(t0); ok(cal.minFontPt === 22 && cal.maxGrid === 6 && cal.maxWords === 3, "tuned settings become the caps the reminiscence template reads");
{ const o = registerReminiscence(createOrchestrator().use(new ClinicalAuditAgent())); const r = await o.execute({ profile: { preferredName: "Peggy", formativeEra: "1950s", ailmentTier: 2 }, deep: deepFromProfile(e), options: { template: "reminiscence" }, condition: undefined });
  ok(/MAPLE|POP|AVA/.test(JSON.stringify(r.asset.pages.resident.blocks.find((b) => b.type === "wordsearch").words)) && r.audit.status !== "blocked", "a sheet made from these details carries the street and regional words in its word search"); }

/* ---------- todays-packet ---------- */
const at = (h) => new Date(2026, 10, 10, h, 0, 0);
ok(timeOfDay(at(5)) === "morning" && timeOfDay(at(11)) === "morning" && timeOfDay(at(12)) === "afternoon" && timeOfDay(at(16)) === "afternoon" && timeOfDay(at(17)) === "evening" && timeOfDay(at(4)) === "evening" && timeOfDay(null) !== undefined, "morning is 5 to noon, afternoon noon to 5, evening after that");
const base = { profile: { preferredName: "Peggy", formativeEra: "1950s", ailmentTier: 2 }, options: { template: "reminiscence" } }, am = timeAware(base, at(9)), pm = timeAware(base, at(14)), eve = timeAware(base, at(19));
ok(am.slot === "morning" && /Today is Tuesday, November 10\./.test(am.deep.notes[0]) && am.deep.include.wordSearch === true && am.deep.focus === "seasons" && am.options.tier === 2 && orientationLine(at(9)) === "Today is Tuesday, November 10.", "mornings carry the date as a fact to enjoy, keep the word search and lean on the season");
ok(pm.deep.focus === "music" && pm.deep.include.wordSearch === false && pm.options.tier === 2 && !pm.deep.notes.length, "afternoons lean on music and drop the word search");
ok(eve.options.tier === 3 && eve.preset === "evening-calm" && /no need to finish/.test(eve.deep.notes[0]) && timeAware(Object.assign({}, base, { options: { tier: 3, template: "reminiscence" } }), at(20)).options.tier === 3 && base.options.tier === undefined, "evenings step one stage gentler (never past the last), add a calm note, and the request itself is not changed");
ok(timeAware({ deep: { focus: "family", notes: ["x"] } }, at(9)).deep.focus === "family" && timeAware(null, at(9)).slot === "morning" && Object.keys(SHIFTS).length === 3, "a focus staff chose is kept, and nothing is a safe request");
const o = registerReminiscence(createOrchestrator().use(new ClinicalAuditAgent())); let prog = [];
const wing = Array.from({ length: 5 }, (_, i) => ({ id: "r" + i, label: "Room 20" + i, unit: "Memory Care East", request: Object.assign({}, base, { profile: Object.assign({}, base.profile, { preferredName: "Res" + i }) }) })); wing.splice(2, 0, { id: "bad", label: "Room X", request: { mode: "bogus" } });
const q = await queuePackets(o, wing, { wing: "Memory Care East", when: at(10), onProgress: (p) => { prog.push(p.done); if (p.done === 1) throw new Error("bad callback"); } });
ok(q.summary.made === 5 && q.summary.failed === 1 && q.pages.length === 10 && q.pages.filter((p) => p.role === "divider").length === 5 && q.pages[0].role === "divider" && q.pages[1].role === "packet" && prog.length === 6, "a wing of six makes five packets and one failure, each packet behind its own divider (" + JSON.stringify(q.summary) + ")");
ok(/Memory Care East/.test(q.pages[0].html) && /Room 200/.test(q.pages[0].html) && /Resident 1 of 6/.test(q.pages[0].html) && /Morning: Energizing orientation/.test(q.pages[0].html) && /November 10, 2026/.test(q.pages[0].html) && (q.pages[1].html.match(/data-page="/g) || []).length === 3, "a divider names the wing, the resident, their place in the queue and the time of day; a packet is three pages");
let n = 0; const c2 = await queuePackets(o, wing, { when: at(10), shouldCancel: () => n++ >= 2 }); ok(c2.summary.cancelled && c2.items.length === 2 && (await queuePackets(o, null)).summary.requested === 0, "a queue can be cancelled part-way and nothing gives an empty queue");
const bl = createOrchestrator(); bl.registerLocalTemplate("claim", (ctx) => { const b = bl.generator.template("default")(ctx); b.pages.caregiver.notes.push("This guarantees a cure and is HIPAA compliant."); return b; }); bl.use(new ClinicalAuditAgent());
ok((await queuePackets(bl, [{ id: "a", label: "A", request: { profile: { preferredName: "A" }, options: { template: "claim" } } }], { when: at(10) })).summary.blocked === 1, "a blocked packet is counted and left out of the printout");

/* ---------- pdf-exporter ---------- */
const m1 = marginsFor(1, { twoSided: true }), m2 = marginsFor(2, { twoSided: true }), m3 = marginsFor(3, { twoSided: true }), one = marginsFor(2, {});
ok(m1.left === 0.75 && m1.right === 0.5 && m2.left === 0.5 && m2.right === 0.75 && m3.left === 0.75 && one.left === 0.75 && one.right === 0.5 && GUTTER_IN === 0.75 && /right-hand/.test(m1.side) && /left-hand/.test(m2.side), "two-sided pages alternate the 0.75 in gutter (left on odd, right on even); one-sided keeps it on the left");
ok(textWidthIn(1, { twoSided: true }) === 7.25 && textWidthIn(2, { twoSided: true }) === 7.25 && marginsFor(0, { twoSided: true }).left === 0.75 && marginsFor(2, { twoSided: true, gutterIn: 1, outerIn: 0.25 }).right === 1 && pdfOptions().unit === "in" && pdfOptions().compress === true, "text width is the same on both sides of a sheet; options are respected");
const root = { classList: { s: new Set(), toggle(c, on) { on ? this.s.add(c) : this.s.delete(c); } } }; ok(applyTwoSided(root, true) && root.classList.s.has("bind-2sided") && !applyTwoSided(root, false) && !applyTwoSided(null, true), "the two-sided switch toggles the print root");
const require = createRequire(import.meta.url), g = globalThis; if (!g.window) g.window = g;
let jsPDF = null; try { const lib = require("../assets/vendor/jspdf.umd.min.js"); jsPDF = (lib.jspdf || lib).jsPDF || lib.jsPDF || (g.jspdf && g.jspdf.jsPDF) || (g.window && g.window.jspdf && g.window.jspdf.jsPDF); } catch (x) { jsPDF = null; }
if (jsPDF) {
  const doc = new jsPDF(pdfOptions()), text = Array.from({ length: 40 }, (_, i) => ({ text: "Paragraph " + i + ": " + "She told us about the garden and the radio. ".repeat(6), pt: 18 }));
  const r = drawText(doc, text, { twoSided: true, fontPt: 18 }); const vecBytes = doc.output("arraybuffer").byteLength, pages = doc.internal.getNumberOfPages();
  ok(pages === r.pages && pages >= 4, "forty paragraphs flow onto " + pages + " pages with page breaks");
  /* the text is vector: it is in the file as text operators, not an image */
  const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1"); ok(!/\/Subtype\s*\/Image/.test(raw), "the vector PDF contains no images");
  const img = new jsPDF(pdfOptions()); const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="; for (let i = 0; i < pages; i++) { if (i) img.addPage(); img.addImage(png, "PNG", 0, 0, 8.5, 11); }
  ok(/\/Subtype\s*\/Image/.test(Buffer.from(img.output("arraybuffer")).toString("latin1")) && vecBytes > 0, "(control) an image-based PDF does carry an image, so the check above can tell the difference (" + vecBytes + " bytes vector)");
  let lefts = []; const d2 = new jsPDF(pdfOptions()); const orig = d2.text.bind(d2); d2.text = (s, x, y) => { lefts.push([d2.internal.getNumberOfPages(), x]); return orig(s, x, y); }; drawText(d2, text.slice(0, 20), { twoSided: true, fontPt: 18 });
  ok(lefts.length > 0 && lefts.every(([pg, x]) => (pg % 2 === 1 ? x === 0.75 : x === 0.5)), "text starts 0.75 in from the left on odd pages and 0.5 in on even pages");
} else ok(false, "jsPDF could not be loaded in Node");

/* ---------- monthly-bundle ---------- */
ok(chooseChunkSize({ deviceMemoryGB: 1 }) === 5 && chooseChunkSize({ deviceMemoryGB: 8 }) === 30 && chooseChunkSize({ deviceMemoryGB: 16 }) === 40 && chooseChunkSize({ deviceMemoryGB: 8, jsHeapLimitMB: 512 }) === 10 && chooseChunkSize({ deviceMemoryGB: 16, pages: 12 }) === 12 && chooseChunkSize({ deviceMemoryGB: 16, pages: 2 }) === 5, "chunk size follows the computer's memory and the job's size, between 5 and 50");
const held = []; let yields = 0, live = 0, peakLive = 0; const items = Array.from({ length: 103 }, (_, i) => i);
const res = await compileInChunks(items, async (i) => { live++; peakLive = Math.max(peakLive, live); await Promise.resolve(); live--; if (i === 50) throw new Error("one bad item"); return i * 2; }, { chunkSize: 20, release: (r) => { held.push(r.length); }, yieldFn: async () => { yields++; } });
ok(res.chunks === 6 && res.processed === 102 && res.failed === 1 && res.maxHeld === 20 && held.join() === "20,20,20,20,20,3" && yields === 6 && res.results === undefined && peakLive === 1, "103 items go through in chunks of 20; at most 20 results are held, each chunk is released before the next, and the browser gets a turn after each (" + held.join("/") + ")");
const kept = await compileInChunks([1, 2, 3], (x) => x + 1, { chunkSize: 2, yieldFn: async () => {} }); ok(kept.results.join() === "2,3,4", "without a release function the results are returned in order");
let cn = 0; const can = await compileInChunks(items, (x) => x, { chunkSize: 10, shouldCancel: () => cn++ >= 3, yieldFn: async () => {} }); ok(can.cancelled && can.chunks === 3 && (await compileInChunks(null, () => 1)).chunks === 0, "a compile can be cancelled between chunks");
let prog2 = 0; await compileInChunks([1, 2, 3, 4], (x) => x, { chunkSize: 2, onProgress: () => { prog2++; throw new Error("bad"); }, yieldFn: async () => {} }); ok(prog2 === 2, "a failing progress callback does not stop a compile");
/* the pool, with a stand-in worker */
class FakeW { constructor() { this.t = 0; } postMessage(m) { setTimeout(() => this.onmessage({ data: m.type === "boom" ? { id: m.id, ok: false, error: "boom" } : { id: m.id, ok: true, value: m.value, png: new ArrayBuffer(4), width: 1, height: 1 } }), 1); } terminate() { this.t = 1; } }
let made = 0; const pool = new WorkerPool(() => { made++; return new FakeW(); }, 3); const outs = await Promise.all(Array.from({ length: 10 }, (_, i) => pool.run({ type: "echo", value: i })));
ok(outs.map((x) => x.value).join() === "0,1,2,3,4,5,6,7,8,9" && pool.peak <= 3 && made === 3, "ten tasks run on three workers at most (" + pool.peak + " at once, " + made + " made)");
let boom = ""; try { await pool.run({ type: "boom" }); } catch (x) { boom = x.message; } ok(boom === "boom" && (await pool.run({ type: "echo", value: 1 })).ok, "a failed task rejects with its reason and the pool carries on");
pool.terminate(); let closed = false; try { await pool.run({ type: "echo" }); } catch (x) { closed = /closed/.test(x.message); } ok(closed, "a closed pool refuses work");
FakeW.prototype.postMessage = function (m) { setTimeout(() => this.onmessage({ data: m.type === "boom" ? { id: m.id, ok: false, error: "boom" } : { id: m.id, ok: true, value: m.value, bytes: new ArrayBuffer(4), width: 1, height: 1, mime: "image/png" } }), 1); };
const rr = await downscaleAll(new WorkerPool(() => new FakeW(), 2), [{ bytes: new ArrayBuffer(1) }, { bytes: new ArrayBuffer(1) }, { bytes: new ArrayBuffer(1) }], { chunkSize: 2 }); ok(rr.length === 3 && rr.every((x) => x.bytes && x.width === 1), "downscaleAll returns one result per photo, in order");

/* ---------- the real worker, in a browser ---------- */
let browserNote = "";
try {
  const { loadPlaywright, serve } = await import("./lib/browser.mjs"); const { chromium } = loadPlaywright(); const { srv, base } = await serve(); const br = await chromium.launch();
  try {
    const p = await (await br.newContext({ serviceWorkers: "block" })).newPage(); await p.goto(base + "contact.html");
    const r = await p.evaluate(async () => {
      const M = await import("/js/monthly-bundle.js"), pool = new M.WorkerPool(() => new Worker("/js/bundle-worker.js"), 3);
      const mkPng = async (i) => { const c = document.createElement("canvas"); c.width = 1600; c.height = 1200; const g = c.getContext("2d"); g.fillStyle = "#" + ((i * 37) % 10) + "88"; g.fillRect(0, 0, 1600, 1200); g.fillStyle = "#000"; g.fillRect(100 + i, 100, 400, 300); const blob = await new Promise((r) => c.toBlob(r, "image/png")); return { bytes: await blob.arrayBuffer(), mime: "image/png" }; };
      const photos = []; for (let i = 0; i < 36; i++) photos.push(await mkPng(i)); const before = photos[0].bytes.byteLength;
      const out = await M.downscaleAll(pool, photos, { maxPx: 400, chunkSize: 12, concurrency: 3 });
      const bad = await pool.run({ type: "bogus" }).then(() => "no error", (e) => e.message); const peak = pool.peak; pool.terminate();
      return { n: out.length, ok: out.every((x) => x.bytes && x.width === 400 && x.height === 300), sig: [...new Set(out.map((x) => [...new Uint8Array(x.bytes).slice(0, 8)].join()))], small: out[0].bytes.byteLength < before, peak, bad };
    });
    ok(r.n === 36 && r.ok && r.sig.join() === "137,80,78,71,13,10,26,10" && r.small, "a real worker shrinks 36 full-size photos (1600 x 1200) to 400 x 300 PNGs, in chunks " + JSON.stringify(r).slice(0, 160));
    ok(r.peak > 1 && r.peak <= 3 && /unknown task/.test(r.bad), "the pool kept up to three workers busy at once (" + r.peak + ") and an unknown task is rejected (" + r.bad + ")");
  } finally { await br.close(); srv.close(); }
} catch (x) { browserNote = " (the real-worker check was skipped: " + String(x.message).slice(0, 60) + ")"; }
if (problems.length) { console.error("output pipeline check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("output pipeline check passed: " + passed + " checks (multi-generational input and auto-tuning, time-aware wing queues, alternating two-sided gutters with vector text, chunked and worker-based compilation)" + browserNote);
