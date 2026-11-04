#!/usr/bin/env node
/* =====================================================================
   Checks for the Coloring Agent (js/coloringAgent.js) and how the Packet
   Builder carries it. Everything that needs no canvas runs here, against
   the real coloring library; scripts/check-coloringagent-ui.mjs runs the
   canvas, the screen and the downloads in a real browser.

     - the clinical prompt wrapper is the owner's words, exactly
     - a person's words are checked with the library's dignity filter, and every sentence the
       agent can say is plain and passes that filter itself
     - a description finds its picture by meaning: each of the 150 titles finds itself, and the
       owner's own 150 descriptions find theirs; an avoid-topic never comes back
     - the random page covers every category, repeats nothing lately, honors a category and the avoid list
     - the black-and-white filter is the stated formula (0.34 R + 0.5 G + 0.16 B under 200 is black),
       exact at the boundary, counts clear pixels as paper, and leaves no gray
     - the PNG gets its dpi (a pHYs chunk with a good checksum) and nothing else changes
     - a source that is slow, fails or returns something unusable never stops the page: the next is
       tried, the person is told in plain words, and a raw error message never reaches them
     - the module makes no network request and touches no storage, and the builder loads it,
       caches it for offline use and shows its tab

   Node built-ins only. Run: node scripts/check-coloringagent.mjs
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import zlib from "zlib";
import { loadCognicopiaColoring, ROOT } from "./lib/cognicopia-coloring.mjs";

let pass = 0; const fails = [];
const ok = (cond, msg) => { if (cond) pass++; else fails.push(msg); };
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const SRC = read("js/coloringAgent.js");
const { C, P } = loadCognicopiaColoring();
const designs = C.designs();

/* the agent in a sandbox that has the real library and prompt filter, and no browser */
function load(extra = {}, withLibrary = true){
  const ctx = vm.createContext(Object.assign({ console, setTimeout, clearTimeout, Promise, Uint8Array, Uint8ClampedArray, Uint32Array, Math, Date }, extra));
  ctx.globalThis = ctx;
  if (withLibrary){ ctx.CognicopiaColoring = C; ctx.CognicopiaColoringPrompts = P; }
  vm.runInContext(SRC, ctx);
  return ctx.CognicopiaColoringAgent;
}
const A = load();
const lcg = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const rejects = async (p, code, msg) => { try { await p; fails.push(msg + " (it resolved)"); } catch (e){ ok(e && e.code === code && !!e.friendly, `${msg} (code ${e && e.code}, want ${code})`); return e; } };

/* 1. the clinical prompt wrapper: the owner's words, exactly */
const PREFIX = "Minimalist bold-and-easy adult coloring book page of ";
const SUFFIX = ", thick pure-black vector outlines, clean uncrowded composition, large fillable areas, solid pure white background, zero shading, zero gray tones, high contrast, 3:4 aspect ratio";
ok(A.PREFIX === PREFIX && A.SUFFIX === SUFFIX, "the wrapper's prefix and suffix are the owner's words, character for character");
ok(A.buildPrompt("A vintage rocking chair on a porch") === PREFIX + "a vintage rocking chair on a porch" + SUFFIX, "the wrapper reads naturally around a sentence that starts with A");
ok(A.buildPrompt("  the barn quilt.  ") === PREFIX + "the barn quilt" + SUFFIX, "spaces and a closing full stop are tidied");
ok(A.buildPrompt("The Barn Quilt") === PREFIX + "The Barn Quilt" + SUFFIX, "a title keeps its capitals");
ok(A.buildPrompt("a “windmill”\n on a  farm") === PREFIX + "a “windmill” on a farm" + SUFFIX, "line breaks and double spaces become single spaces");
ok(/zero gray tones/.test(A.buildPrompt("x tractor")) && /3:4 aspect ratio$/.test(A.buildPrompt("x tractor")), "the wrapped prompt asks for no gray and 3:4");

/* 2. a person's words are checked, and everything the agent says is plain */
ok(A.checkSubject("").code === "empty" && A.checkSubject("ab").code === "empty" && A.checkSubject("   ").code === "empty", "nothing, or too little, is asked to be described");
ok(A.checkSubject("x".repeat(121)).code === "long" && A.checkSubject("x".repeat(120)).ok, "120 characters is the limit");
const cute = A.checkSubject("a cute kitty");
ok(!cute.ok && cute.code === "adult" && /cute/.test(cute.message) && /plain adult words/.test(cute.message), "a childish word is set aside, named, and the person is told what to do instead");
ok(A.checkSubject("Do you remember the old farm").code === "adult", "a memory-quiz phrase is set aside by the same filter");
ok(A.checkSubject("a rocking chair on a porch").ok && A.checkSubject("“tractor”").subject === "tractor", "plain words pass, quotes are trimmed");
ok(designs.every(d => A.checkSubject(d.title).ok), "all 150 titles pass the check");
const OWNER = JSON.parse(read("src/data/coloring_owner_prompts.json")).designs;
ok(Object.keys(OWNER).length === designs.length && designs.every(d => A.checkSubject(OWNER[d.id].subject.slice(0, 120)).ok), "the owner's 150 descriptions pass the check");
const SAY = A.SAY, said = Object.keys(SAY).map(k => SAY[k]);
ok(said.length >= 12 && said.every(t => !P.dignityCheck(t).length), "every sentence the agent can say passes the dignity filter");
ok(said.every(t => !/\b(api|timeout|timed out|canvas|exception|undefined|null|typeerror|fetch|http|server|json|error code)\b/i.test(t)), "none of them uses a technical word");
ok(said.every(t => /[.?]$/.test(t) && t.length < 190), "each is a short whole sentence");
ok(A.describeError(new Error("HTTP 500 boom")) === SAY.generic && A.describeError(null) === SAY.generic, "a raw error is never shown: the plain generic sentence is");

/* 3. finding a picture by meaning */
let self = 0, top1 = 0, top3 = 0;
for (const d of designs){
  const t = A.find(d.title); if (t.length && t[0].id === d.id) self++;
  const o = A.find(OWNER[d.id].subject);
  if (o.length && o[0].id === d.id) top1++;
  if (o.slice(0, 3).some(m => m.id === d.id)) top3++;
}
ok(self === designs.length, `each of the ${designs.length} titles finds its own picture first (${self})`);
ok(top3 >= Math.ceil(designs.length * 0.95), `the owner's descriptions find their picture in the first three (${top3} of ${designs.length}; want 95%)`);
ok(top1 >= Math.ceil(designs.length * 0.85), `and first (${top1} of ${designs.length}; want 85%)`);
[["A vintage rocking chair on a porch", "rocking-chair"], ["tulips in a vase", "tulips-vase"], ["the farm tractor", "farm-tractor"], ["a puppy", "faithful-dog"], ["an airplane", "biplane"],
  ["grandfather clock", "grandfather-clock"], ["Roses", "garden-rose"], ["a sleeping kitten", "sleeping-cat"], ["fishing", "gone-fishing"], ["lighthouse by the sea", "lighthouse"]]
  .forEach(([q, id]) => { const m = A.find(q); ok(m.length && m[0].id === id, `"${q}" finds ${id} first (got ${m.length ? m[0].id : "nothing"})`); });
ok(!A.find("xyzzy plugh").length && !A.find("vintage").length && !A.find("a the of").length && !A.find("").length, "gibberish, an era word alone, and only small words find nothing");
ok(A.find("a sedan").length > 0 && !A.find("a sedan", { avoid: ["driving"] }).length, "a picture on the avoid list is never offered");
ok(JSON.stringify(A.find("flower")) === JSON.stringify(A.find("flowers")) && JSON.stringify(A.find("rose")) === JSON.stringify(A.find("roses")), "plurals find the same pictures");
ok(A.find("quilt").length >= 8 && A.find("quilt").every((m, i, a) => !i || a[i - 1].score >= m.score), "a general word finds several, best first");

/* 4. the random page */
const CATS = A.CATEGORIES;
ok(CATS.length === 7 && ["Vintage Americana", "Botanical", "Nostalgic Home Objects", "Classic Vehicles", "Simple Zentangles"].every(l => CATS.some(c => c.label === l)), "the owner's five categories are there, with two more from the library");
ok(CATS.every(c => c.cats.length && c.cats.every(id => designs.some(d => d.cat === id))) && designs.every(d => CATS.some(c => c.cats.indexOf(d.cat) >= 0)), "every category has pictures and every picture belongs to one");
{
  A.forgetRecent();
  const rng = lcg(11), seen = {}, ids = [], bad = [];
  for (let i = 0; i < 420; i++){
    const r = A.random({ rng, avoid: ["driving"] }), d = C.design(r.designId), c = CATS.filter(x => x.id === r.category.id)[0];
    seen[c.id] = (seen[c.id] || 0) + 1; ids.push(r.designId);
    if (!d || c.cats.indexOf(d.cat) < 0) bad.push("outside its category: " + r.designId);
    if (d && d.sensitive.indexOf("driving") >= 0) bad.push("on the avoid list: " + r.designId);
    if (r.subject !== d.title.toLowerCase() || r.title !== d.title) bad.push("subject " + r.designId);
  }
  ok(!bad.length, "random pages stay in their category, off the avoid list: " + bad.slice(0, 3).join("; "));
  ok(CATS.every(c => seen[c.id] > 20), "every category comes up often: " + JSON.stringify(seen));
  let repeats = 0; for (let i = 0; i < ids.length; i++) for (let j = Math.max(0, i - 12); j < i; j++) if (ids[j] === ids[i]) repeats++;
  ok(repeats === 0, `no picture comes back within twelve pages (${repeats} repeats)`);
  A.forgetRecent(); const a = [], b = [];
  const r1 = lcg(5), r2 = lcg(5); for (let i = 0; i < 20; i++) a.push(A.random({ rng: r1 }).designId); A.forgetRecent(); for (let i = 0; i < 20; i++) b.push(A.random({ rng: r2 }).designId);
  ok(a.join() === b.join() && new Set(a).size > 12, "the same seed gives the same pages, and they differ from one another");
}
{
  A.forgetRecent();
  const rng = lcg(3);
  CATS.forEach(c => { for (let i = 0; i < 25; i++){ const r = A.random({ rng, category: c.id }), d = C.design(r.designId); if (!d || c.cats.indexOf(d.cat) < 0) { fails.push(`${c.id}: ${r.designId} is outside the category`); break; } } });
  const vehicles = designs.filter(d => d.cat === "classic-vehicles"), codes = [...new Set(vehicles.flatMap(d => d.sensitive))];
  let err = null; try { A.random({ category: "classic-vehicles", avoid: codes.concat(vehicles.every(d => d.sensitive.length) ? [] : ["__none__"]) }); } catch (e){ err = e; }
  const allCovered = vehicles.every(d => d.sensitive.some(x => codes.indexOf(x) >= 0));
  ok(allCovered ? (err && err.code === "avoided" && !!err.friendly) : true, "when everything in a category is on the avoid list, the agent says so in plain words");
  ok(A.random({ rng: lcg(1), category: "no-such-category" }).designId.length > 0, "an unknown category is the same as every category");
}

/* 5. the black-and-white filter */
const lum = (r, g, b) => 0.34 * r + 0.5 * g + 0.16 * b;
{
  const px = [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 0, 255], [255, 255, 255, 255], [0, 0, 0, 255], [200, 200, 200, 255], [199, 199, 199, 255], [255, 230, 0, 255], [255, 255, 255, 0], [0, 0, 0, 128], [0, 0, 0, 10]];
  const want = [0, 0, 0, 255, 255, 0, 255, 0, 255, 255, 0, 255];
  const data = new Uint8ClampedArray(px.flat()), st = A.thresholdPixels(data);
  ok(want.every((v, i) => data[i * 4] === v && data[i * 4 + 1] === v && data[i * 4 + 2] === v && data[i * 4 + 3] === 255), "red, green, blue, yellow, the boundary at 200, a clear pixel and a half-clear black land on the right side");
  ok(st.pixels === 12 && st.black === want.filter(v => !v).length && Math.abs(st.blackShare - want.filter(v => !v).length / 12) < 1e-12, "the count of black pixels is reported");
  const rnd = lcg(99), n = 40000, big = new Uint8ClampedArray(n * 4), ref = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < big.length; i++) big[i] = Math.floor(rnd() * 256);
  for (let i = 0; i < n; i++){ big[i * 4 + 3] = 255; const l = lum(big[i * 4], big[i * 4 + 1], big[i * 4 + 2]), v = l < 200 ? 0 : 255; ref[i * 4] = ref[i * 4 + 1] = ref[i * 4 + 2] = v; ref[i * 4 + 3] = 255; }
  ok(A.impure(big) > n / 2, "random colors are not pure (the detector sees them)");
  A.thresholdPixels(big);
  let diff = 0; for (let i = 0; i < big.length; i++) if (big[i] !== ref[i]) diff++;
  ok(diff === 0 && A.impure(big) === 0, `40,000 random pixels match the formula exactly and none is gray (${diff} differ)`);
  const ramp = new Uint8ClampedArray(256 * 4); for (let g = 0; g < 256; g++) ramp.set([g, g, g, 255], g * 4);
  const rs = A.thresholdPixels(ramp);
  ok(rs.black === 200 && ramp[199 * 4] === 0 && ramp[200 * 4] === 255, "a ramp of 256 grays: 0 to 199 print black, 200 to 255 print white");
  const t2 = new Uint8ClampedArray([150, 150, 150, 255, 180, 180, 180, 255]); A.thresholdPixels(t2, 160);
  ok(t2[0] === 0 && t2[4] === 255, "the threshold can be given (160)");
  ok(A.THRESHOLD === 200, "the default threshold is 200");
}
{
  // how thin the thinnest lines print: 3 pt at 6 in wide and 300 dpi is 12.5 px
  const W = 1800, H = 2400, mk = bar => { const d = new Uint8ClampedArray(W * H * 4).fill(255); for (let x0 = 100; x0 < W - 100; x0 += 120) for (let y = 0; y < H; y++) for (let x = x0; x < x0 + bar; x++) d[(y * W + x) * 4] = d[(y * W + x) * 4 + 1] = d[(y * W + x) * 4 + 2] = 0; return d; };
  const good = A.lineStats(mk(13), W, H, 6), thin = A.lineStats(mk(6), W, H, 6);
  ok(good && Math.abs(good.pt - 3.12) < 0.05, `13 px lines measure 3.1 pt at 6 in wide (${good && good.pt})`);
  ok(thin && thin.pt < 1.6, `6 px lines measure under 1.6 pt, so they would be reported (${thin && thin.pt})`);
  ok(A.lineStats(new Uint8ClampedArray(W * H * 4).fill(255), W, H, 6) === null, "a blank page has no lines to measure");
}

/* 6. the PNG gets its dpi */
{
  const crc = b => typeof zlib.crc32 === "function" ? zlib.crc32(b) >>> 0 : (() => { let c, t = [], x = 0xFFFFFFFF; for (let n = 0; n < 256; n++){ c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xFFFFFFFF) >>> 0; })();
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const png = (w, h) => { const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; const raw = Buffer.alloc((w + 1) * h, 255); for (let y = 0; y < h; y++) raw[y * (w + 1)] = 0;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]); };
  const parse = b => { const out = []; let at = 8; while (at < b.length){ const len = b.readUInt32BE(at), type = b.toString("latin1", at + 4, at + 8), data = b.subarray(at + 8, at + 8 + len), c = b.readUInt32BE(at + 8 + len); out.push({ type, data, good: crc(b.subarray(at + 4, at + 8 + len)) === c }); at += 12 + len; } return out; };
  const src = png(8, 6), got = Buffer.from(A.withDpi(src, 300)), cs = parse(got);
  ok(got.length === src.length + 21 && cs.map(c => c.type).join() === "IHDR,pHYs,IDAT,IEND" && cs.every(c => c.good), "a pHYs chunk is added after the header, every chunk's checksum is good");
  const ph = cs[1].data;
  ok(ph.readUInt32BE(0) === 11811 && ph.readUInt32BE(4) === 11811 && ph[8] === 1, "300 dpi is 11811 pixels per metre, both ways, in metres");
  ok(Buffer.from(A.withDpi(got, 300)).equals(got), "doing it twice changes nothing");
  ok(Buffer.from(A.withDpi(Buffer.from("not a png at all, just some text bytes to be safe"), 300)).toString() === "not a png at all, just some text bytes to be safe", "bytes that are not a PNG come back as they were");
  ok(zlib.inflateSync(cs[2].data).length === 6 * 9, "the picture data itself is untouched");
}

/* 7. the chain of picture sources */
const fakeClean = (log = []) => src => { log.push(src); return Promise.resolve({ blob: { size: 1 }, dataUrl: "data:image/png;base64,AA==", width: 1800, height: 2400, dpi: 300, printWidthIn: 6, printHeightIn: 8,
  stats: { pure: true, ratio: .75, blackShare: .08, lineMinPt: 3.1, thinLines: false } }); };
{
  const seen = [], r = await A.generate({ subject: "A vintage rocking chair on a porch", tier: 3 }, { clean: fakeClean(seen) });
  ok(r.ok && r.provider === "library" && r.designId === "rocking-chair" && r.title === "The Rocking Chair" && r.tier === 3 && !r.notes.length, "a typed description gives its picture from the library, at the tier asked");
  ok(r.prompt === PREFIX + "a vintage rocking chair on a porch" + SUFFIX && r.subject === "A vintage rocking chair on a porch", "and the clinical wrapper around the person's words");
  ok(r.categoryId === "nostalgic-heritage" && r.category === "Nostalgic Heritage" && r.dpi === 300 && r.width === 1800 && r.height === 2400, "with its category and print numbers");
  const svg = String(seen[0]);
  ok(/^<svg /.test(svg) && /width="6in" height="8in"/.test(svg) && /viewBox="0 0 600 800"/.test(svg), "the picture handed to the filter is a standalone SVG, 6 x 8 in, 3:4");
  const colors = [...svg.matchAll(/(?:fill|stroke)="([^"]*)"/g)].map(m => m[1].toLowerCase());
  ok(colors.length > 3 && colors.every(c => ["#000", "#fff", "none", "#ffffff", "#000000"].indexOf(c) >= 0) && !/opacity|gradient|filter=/.test(svg), "and it is black, white and nothing else, with no gradients or transparency");
  const w = t => +(/<g [^>]*stroke-width="([0-9.]+)"/.exec(String(t)) || [])[1];
  const s1 = [], s3 = []; await A.generate({ designId: "farm-tractor", subject: "the farm tractor", tier: 1 }, { clean: fakeClean(s1) }); await A.generate({ designId: "farm-tractor", subject: "the farm tractor", tier: 3 }, { clean: fakeClean(s3) });
  ok(w(s3[0]) > w(s1[0]) * 2, "a higher tier draws heavier lines");
  const rr = await A.generate({ designId: "farm-tractor", subject: "the farm tractor", tier: 2 }, { clean: fakeClean() });
  ok(rr.designId === "farm-tractor" && rr.tier === 2, "the same picture can be drawn again at another tier by its id");
}
{
  const r = await A.generate({ random: true, category: "botanical", rng: lcg(8), tier: 1 }, { clean: fakeClean() });
  const d = C.design(r.designId);
  ok(d && d.cat === "botanical-garden" && r.category === "Botanical" && r.categoryId === "botanical-garden" && r.prompt === PREFIX + d.title.toLowerCase() + SUFFIX, "a random page from a category, with its wrapper");
}
await rejects(A.generate({ subject: "a cute kitty" }, { clean: fakeClean() }), "adult", "childish words are refused before anything is drawn");
await rejects(A.generate({ subject: "" }, { clean: fakeClean() }), "empty", "nothing typed is asked about");
await rejects(A.generate({ subject: "xyzzy plugh" }, { clean: fakeClean() }), "nomatch", "words that fit nothing say so");
{
  const e = await rejects(A.generate({ subject: "the sunday sedan", avoid: ["driving"] }, { clean: fakeClean() }), "avoided", "a picture that fits but is on the avoid list says so");
  ok(e && /avoid/.test(e.friendly), "in words that name the list");
}
{
  const noLib = load({}, false);
  await rejects(noLib.generate({ subject: "a rocking chair" }, { clean: fakeClean() }), "nolib", "with no library loaded the agent says so in plain words");
  await rejects(noLib.generate({ random: true }, { clean: fakeClean() }), "nolib", "and so does the random page");
}
{
  const t0 = Date.now(), slow = () => new Promise(() => {});
  const r = await A.generate({ subject: "a rocking chair", tier: 2 }, { providers: [slow, "library"], timeoutMs: 40, clean: fakeClean() });
  ok(r.ok && r.provider === "library" && r.notes.length === 1 && r.notes[0] === SAY.fellback && Date.now() - t0 < 2000, "a source that never answers is set aside after its time limit and the library is used, with a plain note");
  const r2 = await A.generate({ subject: "a rocking chair" }, { providers: [() => { throw new Error("HTTP 500 boom"); }, () => Promise.reject(new Error("socket hang up")), "library"], timeoutMs: 40, clean: fakeClean() });
  ok(r2.ok && r2.provider === "library" && r2.notes.length === 1 && !JSON.stringify(r2.notes).match(/500|boom|socket/), "sources that fail are skipped, and their raw errors never reach the person");
  const e = await rejects(A.generate({ subject: "a rocking chair" }, { providers: [slow], timeoutMs: 30, clean: fakeClean() }), "slow", "when the only source is too slow, the page says so");
  ok(e && e.friendly === SAY.slow, "in the plain sentence, nothing lost");
  const e2 = await rejects(A.generate({ subject: "a rocking chair" }, { providers: [() => { throw new Error("boom: internal detail"); }], clean: fakeClean() }), "generic", "when every source fails the error is the plain generic one");
  ok(e2 && e2.friendly === SAY.generic && !/boom|internal/.test(e2.friendly), "and carries no raw detail");
  let calls = 0;
  const r3 = await A.generate({ subject: "a rocking chair" }, { providers: [() => ({ svg: "<svg/>", title: "First" }), "library"], clean: src => ++calls === 1 ? Promise.reject(Object.assign(new Error("x"), { code: "blank", friendly: SAY.blank })) : fakeClean()(src) });
  ok(r3.provider === "library" && calls === 2 && r3.notes[0] === SAY.fellback, "a picture that cannot be cleaned counts as a failed source, and the next is tried");
  const r4 = await A.generate({ subject: "a rocking chair" }, { providers: [() => ({ blob: { size: 5 }, title: "Elsewhere" })], clean: fakeClean() });
  ok(r4.provider === "custom" && r4.title === "Elsewhere" && r4.designId === "", "any function that returns a picture works as a source");
  const r5 = await A.generate({ subject: "a rocking chair" }, { providers: ["no-such-source", "library"], clean: fakeClean() });
  ok(r5.provider === "library", "an unknown source name is skipped");
  let order = []; const B = load();
  B.registerProvider("elsewhere", () => { order.push("elsewhere"); throw new Error("down"); }, true);
  const r6 = await B.generate({ subject: "a rocking chair" }, { clean: fakeClean() });
  ok(order.join() === "elsewhere" && r6.provider === "library" && r6.notes.length === 1, "a registered source goes first, and when it is down the library still gives the page");
}
{
  const e = await rejects(A.clean("<svg/>"), "canvas", "cleaning with no canvas says so in plain words");
  ok(e && !/canvas/i.test(e.friendly), "without the word canvas");
}

/* 8. the module touches no network, address or storage */
{
  const NET = { "fetch()": /\bfetch\s*\(/, XMLHttpRequest: /XMLHttpRequest/, sendBeacon: /sendBeacon/, WebSocket: /\bWebSocket\b/, EventSource: /\bEventSource\b/, "an address": /https?:\/\//i, "a dynamic import": /\bimport\s*\(/, importScripts: /importScripts/,
    localStorage: /localStorage/, sessionStorage: /sessionStorage/, IndexedDB: /indexedDB/i, cookies: /document\.cookie/, "the page address": /\blocation\b/, serviceWorker: /serviceWorker/, "a worker": /new\s+Worker\b/ };
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [what, re] of Object.entries(NET)) ok(!re.test(code), "the agent contains " + what);
  ok(!/pollinations|replicate\.com|flux|openai|huggingface/i.test(code), "the agent names no online picture maker");
}

/* 9. print numbers */
ok(A.OUT_W / A.OUT_H === 0.75 && A.OUT_W === 1800 && A.OUT_H === 2400, "the page is 3:4, 1800 x 2400 px");
ok(A.PRINT_W_IN === 6 && A.OUT_W / A.PRINT_W_IN === 300 && A.DPI === 300, "that is 6 x 8 in at 300 dpi");
ok(A.PRINT_W_IN <= 8.5 - 0.5 - 0.75 && A.PRINT_W_IN * 4 / 3 <= 11 - 1, "and it fits inside the margins and the binding gutter of a US Letter page (7.25 x 10 in)");
ok(A.MIN_LINE_PT === 3, "the clinical floor it warns about is 3 pt");

/* 10. how the builder carries it */
{
  const b = read("builder.html"), sw = read("sw.js");
  const tag = b.indexOf('<script src="js/coloringAgent.js"></script>');
  ok(tag > b.indexOf('<script src="assets/cognicopia-coloring/cognicopia-coloring.js"></script>') && tag > 0 && tag < b.indexOf('<script id="cc-ui">'), "the builder loads the agent after the coloring library and before the coloring screen");
  ok(sw.indexOf('"js/coloringAgent.js"') > 0, "the service worker keeps it for offline use");
  ok(/id="ccTabMk"[^>]*>Describe a page</.test(b) && /Generate random clinical page/.test(b) && /Download print-ready PNG/.test(b) && /id="ccMkAdd"/.test(b) && /Add to packet/.test(b), "the screen has the tab, the random button, the PNG button and Add to packet");
  ok(/class="cc-spin"/.test(b) && /prefers-reduced-motion:reduce\)\{\.cc-spin\{animation:none\}/.test(b), "a spinner shows while a page is made, and stops moving for people who ask for less motion");
  ok(/if \(!isLicensed\(\) && genCount\(\) >= FREE_RUNS\)\{ openGate\(\); return; \}\s*\n\s*agent\(\)\.download/.test(b), "a saved PNG counts against the free packets like a PDF");
  ok(fs.existsSync(path.join(ROOT, "docs/coloring-agent.md")), "the guide for the agent exists");
  const doc = fs.existsSync(path.join(ROOT, "docs/coloring-agent.md")) ? read("docs/coloring-agent.md") : "";
  ok(doc.indexOf("{" + "{") < 0 && doc.indexOf("{" + "%") < 0, "the guide has no Liquid openers");
}

if (fails.length){ console.log(`coloring agent check FAILED: ${fails.length} problem(s), ${pass} passed\n  - ` + fails.slice(0, 30).join("\n  - ")); process.exit(1); }
console.log(`coloring agent check passed: ${pass} checks (the wrapper, the words, matching on ${designs.length} pictures, random pages, the black-and-white filter, the PNG, the chain of sources, and nothing leaves the computer)`);
