#!/usr/bin/env node
/* =====================================================================
   Checks for the Tablet Activities page (tablet.html, js/tabletEngine.js,
   js/tablet.js). The parts that need no browser run here; the touch
   itself (fingers dragging, keyboards tapping) is proved by
   scripts/check-tablet-ui.mjs.

     - every puzzle maker, at every stage and for every topic, makes a sound puzzle: the word
       search holds its words where it says, the crossword has no accidental word, spelling
       words and clues are plain and do not give the answer away, a saying's answer is among its
       choices, a sorted item belongs to its group, an odd one really is odd, steps can be put in
       order and are not already in order, pairs match, every clue and line passes the dignity rules
     - the same seed gives the same puzzle, a new seed a new one
     - stages get gentler: fewer words, larger grids, across-only searches, wider paths
     - the trace rule: walking the line reaches the end; wandering off the line, lifting the finger, turning
       back or jumping ahead never sends the marker back (every shape, every stage, every scene)
     - the sounds: every sound on the Sights and Sounds board has a picture, a name and a line that pass the
       dignity rules; the board and its rounds are made from them
     - the pictures: every picture is well formed and has a name
     - the screen's words are calm: nothing says wrong, test, quiz or easy
     - the page is wired in: scripts in the right order, cached for offline use, in the menu and on
       the front page, in the sitemap; it makes no network request, keeps only the level, topic and
       sound choices, and every activity on the menu has an icon and a screen

   Node built-ins only. Run: node scripts/check-tablet.mjs
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { ROOT } from "./lib/cognicopia-coloring.mjs";
import { HUBS } from "./site-nav.mjs";

let pass = 0; const fails = [];
const ok = (cond, msg) => { if (cond) pass++; else fails.push(msg); };
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

/* the engine in a sandbox with the real puzzle makers and content, and no browser */
const ctx = vm.createContext({ console, Math, Date }); ctx.globalThis = ctx;
for (const f of ["assets/pcg/pcg-data.bundle.js", "src/pcg/prng.js", "src/pcg/matrix.js", "src/pcg/grammar.js", "src/pcg/puzzles.js", "js/tabletSound.js", "js/tabletArt.js", "js/tabletEngine.js"]) vm.runInContext(read(f), ctx, { filename: f });
const T = ctx.CognicopiaTablet, D = ctx.CognicopiaPCGData, G = ctx.CognicopiaPCG.grammar, Z = ctx.CognicopiaPCG.puzzles, Snd = ctx.CognicopiaTabletSound, Art = ctx.CognicopiaTabletArt;
const plain = x => JSON.parse(JSON.stringify(x));          // out of the sandbox, so deep comparisons work
const STAGES = ["early", "middle", "late"], TOPICS = ["", ...T.TOPICS.map(t => t.id)];
const lintOk = s => !G.lint(s, D);
const BLOCK = new Set(D.safety.blocklist);
const wordOk = w => /^[A-Z]+$/.test(w) && !BLOCK.has(w);
const groupOf = {}; D.activities.sorting.forEach(g => g.words.forEach(w => { (groupOf[w] = groupOf[w] || []).push(g.id); }));

ok(T.TOPICS.length === 42 && STAGES.every(s => T.STAGES[s]), "all 42 topics and the three stages are there");

let made = 0;
for (const stage of STAGES) for (const topic of TOPICS) {
  const o = { stage, topic, seed: "check-" + stage + "-" + topic, fit: { size: 9 } }, tag = `${stage}/${topic || "any"}`, c = T.STAGES[stage];
  /* word search */
  const ws = plain(T.wordSearch(o));
  ok(ws && ws.placed.length >= 3 && ws.size <= c.search.size && ws.size <= 9, `${tag}: a word search with at least three words that fits`);
  if (ws) {
    const allowed = c.search.dirs.map(d => d.join());
    ok(ws.placed.every(p => allowed.includes([p.dx, p.dy].join()) && [...p.word].every((ch, k) => ws.rows[p.r + p.dy * k].charAt(p.c + p.dx * k) === ch) && wordOk(p.word)), `${tag}: every search word is where it says, in an allowed direction, and is a plain word`);
    ok(ws.words.length === ws.placed.length && ws.words.length <= c.search.words, `${tag}: the list matches what was placed`);
    ok(ws.rows.length === ws.size && ws.rows.every(r => r.length === ws.size && /^[A-Z]+$/.test(r)), `${tag}: the grid is square and all capital letters`);
  }
  const small = plain(T.wordSearch(Object.assign({}, o, { fit: { size: 6 } })));
  ok(small && small.size <= 6 && small.placed.every(p => p.word.length <= 6), `${tag}: a small screen gets a smaller grid with shorter words`);
  /* crossword */
  const cw = plain(T.crossword(o));
  ok(cw && cw.entries.length >= 3 && cw.rows <= 9 && cw.cols <= 9 && !Z.checkCrossword(cw).length, `${tag}: a sound crossword (no accidental words, fits the screen)`);
  if (cw) ok(cw.entries.every(e => e.clue && lintOk(e.clue) && e.clue.toUpperCase().indexOf(e.word) < 0 && wordOk(e.word) && e.num > 0), `${tag}: crossword clues pass the dignity rules and never contain their answer`);
  /* spell it */
  const sp = plain(T.spellIt(o));
  ok(sp.items.length >= 3 && sp.items.every(i => i.word.length >= c.spell.minLen && i.word.length <= c.spell.maxLen && wordOk(i.word) && lintOk(i.clue) && i.clue.toUpperCase().indexOf(i.word) < 0 && i.given === (c.spell.firstGiven ? 1 : 0)), `${tag}: spelling words fit the stage, with a plain clue, and the first letter is given where the stage calls for it`);
  ok(new Set(sp.items.map(i => i.word)).size === sp.items.length, `${tag}: no spelling word twice`);
  /* sayings */
  const sy = plain(T.sayings(o));
  ok(sy.items.length === c.saying.count && sy.items.every(s => s.options.includes(s.answer) && s.options.length === c.saying.options && new Set(s.options).size === s.options.length && lintOk(s.lead + " " + s.answer)), `${tag}: each saying's answer is among its ${c.saying.options} different choices`);
  /* sort it */
  const so = plain(T.sortIt(o)), sg = D.activities.sorting;
  ok(so.groups.length === 2 && so.groups[0].id !== so.groups[1].id && so.items.length >= c.sort.count - 1 && so.items.every(i => sg.find(g => g.id === so.groups[i.group].id).words.includes(i.word)), `${tag}: every sorted item belongs to the group it is marked for`);
  ok(so.items.every(i => !(groupOf[i.word] || []).includes(so.groups[1 - i.group].id)), `${tag}: no sorted item also fits the other group`);
  /* odd one out */
  const od = plain(T.oddOne(o));
  ok(od.rounds.length === c.odd.rounds && od.rounds.every(r => r.cards.length === 4 && r.cards.filter(x => x.odd).length === 1), `${tag}: odd-one-out rounds have three that go together and one that does not`);
  ok(od.rounds.every(r => { const odd = r.cards.find(x => x.odd).word, same = r.cards.filter(x => !x.odd).map(x => x.word), common = sg.filter(g => same.every(w => g.words.includes(w))); return common.length >= 1 && common.every(g => !g.words.includes(odd)); }), `${tag}: the three that go together share a group and the odd word is not in it`);
  /* put in order */
  const io = plain(T.inOrder(o));
  ok(io.items.length >= 2 && io.items.every(i => i.steps.length >= 3 && i.steps.length <= c.order.maxSteps && i.order.length === i.steps.length && [...i.order].sort().join() === i.steps.map((s, k) => k).join() && i.order.some((v, k) => v !== k) && i.steps.every(lintOk)), `${tag}: steps can be put in order, they are mixed up, and no more than the stage allows`);
  /* match */
  const ma = plain(T.matchUp(o));
  ok(ma.pairs.length >= 3 && ma.pairs.length <= c.match.pairs && new Set(ma.words).size === ma.pairs.length && [...ma.words].sort().join() === ma.pairs.map(p => p.word).sort().join() && [...ma.clues].sort().join() === ma.pairs.map(p => p.clue).sort().join() && ma.pairs.every(p => p.clue.toUpperCase().indexOf(p.word) < 0 && lintOk(p.clue)), `${tag}: matching pairs are all different and complete, and no clue gives its word away`);
  /* sights and sounds */
  const sb = plain(T.soundBoard(o)), ids = Snd.META.map(m => m.id);
  ok(sb.cards.length === c.sounds.cards && new Set(sb.cards.map(k => k.id)).size === sb.cards.length && sb.cards.every(k => ids.includes(k.id) && lintOk(k.name) && lintOk(k.line)), `${tag}: the sound board has ${c.sounds.cards} different sounds, each with a name and a line that pass the dignity rules`);
  ok(sb.targets.length === c.sounds.rounds && new Set(sb.targets).size === sb.targets.length && sb.targets.every(t => sb.cards.some(k => k.id === t)), `${tag}: each "which one is it?" round is about a sound that is on the board, and no sound is asked twice`);
  made++;
}
ok(made === 3 * 43, "every stage and topic was tried (129 combinations)");

/* the same seed, the same puzzle; a new seed, a new one */
{
  const a = { stage: "middle", topic: "farming", seed: "same" }, b = Object.assign({}, a, { seed: "other" });
  for (const k of ["wordSearch", "crossword", "spellIt", "sayings", "sortIt", "oddOne", "inOrder", "matchUp", "soundBoard", "tracePath"]) {
    ok(JSON.stringify(T[k](a)) === JSON.stringify(T[k](a)), `${k}: the same seed gives the same puzzle`);
    if (k !== "tracePath") ok(JSON.stringify(T[k](a)) !== JSON.stringify(T[k](b)), `${k}: another seed gives another`);
  }
  const seeds = new Set(Array.from({ length: 12 }, (_, i) => JSON.stringify(T.wordSearch({ stage: "early", topic: "", seed: "n" + i }).rows)));
  ok(seeds.size >= 11, "twelve seeds give twelve different word searches");
  ok(new Set(Array.from({ length: 12 }, (_, i) => T.tracePath({ stage: "middle", seed: "q" + i }).d)).size >= 4, "twelve seeds give at least four different paths");
}

/* the stages: gentler as they go on */
{
  const s = T.STAGES;
  ok(s.early.search.words > s.middle.search.words && s.middle.search.words > s.late.search.words, "fewer search words at each later stage");
  ok(s.late.search.dirs.every(d => d[1] === 0 || d[0] === 0) && s.late.search.dirs.length === 1 && s.late.search.dirs[0].join() === "1,0", "the late-stage search reads across only");
  ok(s.early.trace.tol < s.middle.trace.tol && s.middle.trace.tol < s.late.trace.tol, "the path gets wider at each later stage");
  ok(s.early.saying.options > s.late.saying.options && s.late.saying.options === 2, "a later stage has fewer choices");
  ok(s.late.cross.size < s.early.cross.size && s.late.cross.target < s.early.cross.target, "the late-stage crossword is smaller");
  ok(s.late.spell.firstGiven && !s.early.spell.firstGiven, "the late stage is given the first letter");
}

/* trace the path: the rule the screen follows. The marker only goes forward, always stays on the line, and is never sent back. */
{
  let paths = 0;
  for (const stage of STAGES) for (const kind of T.SHAPES) {
    const path = plain(T.tracePath({ stage, seed: "p-" + kind + stage, kind })), tol = path.tol, pts = path.pts, tag = `${stage}/${kind}`;
    paths++;
    ok(pts.length > 40 && pts.every(p => p[0] >= 20 && p[0] <= 980 && p[1] >= 20 && p[1] <= 580), `${tag}: the path stays inside the screen with room at the edges`);
    ok(pts.every((p, i) => i === 0 || (Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) <= 7.5 && Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.5)), `${tag}: the points are evenly spaced, no gap a finger could fall through`);
    ok(path.d.startsWith("M") && path.d.split("L").length === pts.length && path.length > 400, `${tag}: the drawn line has every point and is long enough to be worth tracing`);
    /* walking the line, with a little wobble, reaches the end */
    let st = { i: 0 }, last = null;
    const walk = k => { const w = [pts[k][0] + (k % 4 ? 0.5 : -0.5) * tol * 0.5, pts[k][1] + (k % 6 ? 0.4 : -0.4) * tol * 0.5]; last = T.follow(path, st, w, tol); st = { i: last.i }; return last.status === "on" || last.status === "done"; };
    for (let k = 0; k < pts.length; k += 2) if (!walk(k)) break;
    if (last && last.status !== "done") walk(pts.length - 1);
    ok(last && last.status === "done", `${tag}: walking the line with a steady wobble reaches the finish`);
    /* too far from the lane: the emptiest place on the screen. The marker waits where it is. It is not sent back. */
    let far = { d: 0, p: [0, 0] };
    for (let x = 30; x <= 970; x += 20) for (let y = 30; y <= 570; y += 20) { let m = 1e9; for (const q of pts) m = Math.min(m, Math.hypot(q[0] - x, q[1] - y)); if (m > far.d) far = { d: m, p: [x, y] }; }
    const mid = Math.floor(pts.length / 3), off = T.follow(path, { i: mid }, far.p, tol);
    ok(off.status === "away" && off.i === mid, `${tag}: a finger far from the lane leaves the marker where it is (${Math.round(far.d)} units away; the lane reaches ${Math.round(tol * 2.2)})`);
    /* the marker never goes backward, whatever the finger does, and never leaves the line */
    let at = { i: mid }, minI = mid, wander = [pts[mid], far.p, pts[Math.max(0, mid - 30)], pts[Math.max(0, mid - 5)], far.p, pts[mid], pts[Math.min(pts.length - 1, mid + 40)], [0, 0], [1000, 600], pts[Math.max(0, mid - 60)]], monotone = true;
    for (const w of wander) { const r = T.follow(path, at, w, tol); if (r.i < at.i) monotone = false; at = { i: r.i }; }
    ok(monotone && at.i >= minI, `${tag}: turning back, wandering and coming back never moves the marker backward`);
    /* a finger that jumps far ahead carries the marker only a short way */
    const jump = T.follow(path, { i: 0 }, pts[Math.min(pts.length - 1, 90)], tol);
    ok(jump.i <= 24 && jump.status !== "done", `${tag}: a finger that jumps far ahead does not carry the marker with it (it moved ${jump.i} points)`);
    /* a first touch on the marker is fine */
    ok(T.follow(path, { i: 0 }, pts[0], tol).status === "on", `${tag}: resting on the marker is fine`);
    /* the lane is wider for people who need it */
    ok(T.follow(path, { i: mid }, [pts[mid][0] + tol * 1.9, pts[mid][1]], tol).status !== "slipped", `${tag}: a finger well to one side of the line is still on the lane`);
  }
  ok(paths === 3 * T.SHAPES.length, "every shape at every stage was tried");
  ok(T.STAGES.late.trace.kinds.every(k => T.SHAPES.includes(k)), "the late stage only offers shapes that exist");
  /* the three journeys */
  const scenes = Object.keys(T.SCENES);
  ok(scenes.join() === "bee,train,dog" && scenes.every(n => T.SCENES[n].from && T.SCENES[n].to && lintOk(T.SCENES[n].line) && lintOk(T.SCENES[n].arrive) && Art.has(T.SCENES[n].from) && Art.has(T.SCENES[n].to)), "the bee, the train and the dog each have a start, a goal, two kind sentences and a picture for both");
  for (const stage of STAGES) for (const sc of scenes) for (let n = 0; n < 6; n++) {
    const p = plain(T.tracePath({ stage, seed: "scene-" + sc + n, scene: sc }));
    ok(p.scene === sc && !p.closed && T.SCENES[sc].shapes.includes(p.kind) && T.STAGES[stage].trace.kinds.includes(p.kind) && p.from === T.SCENES[sc].from && p.to === T.SCENES[sc].to && Math.hypot(p.start[0] - p.end[0], p.start[1] - p.end[1]) > 150, `${stage}/${sc}/${n}: a scene's path is an open line of a shape that suits it and the stage, with its start and goal apart`);
  }
  ok(new Set(Array.from({ length: 24 }, (_, i) => T.tracePath({ stage: "middle", seed: "any" + i }).scene)).size === 3, "with no scene chosen, the seeds bring all three journeys");
}

/* the sounds: each one has a picture, a name and a line */
{
  const ids = Snd.META.map(m => m.id);
  ok(ids.length >= 6 && new Set(ids).size === ids.length, `the board has ${ids.length} different sounds`);
  for (const need of ["bird", "train", "guitar", "cat", "storm", "bells"]) ok(ids.includes(need), `the board has the ${need} sound`);
  ok(Snd.META.every(m => Art.has(m.id) && m.name && m.line && lintOk(m.name) && lintOk(m.line) && !/\b(scary|loud|noise)\b/i.test(m.line)), "every sound has a picture, a name and a calm line that pass the dignity rules");
  ok(typeof Snd.create === "function" && typeof Snd.render === "function", "the sounds are made on the tablet (a synthesizer, not recordings)");
}

/* the pictures: finished illustrations kept in assets/tablet/, one transparent PNG each */
{
  const ids = Art.ids(), dir = path.join(ROOT, "assets", "tablet"), files = fs.readdirSync(dir).filter(f => /\.png$/.test(f)).sort();
  ok(ids.length >= 14, `${ids.length} pictures are named`);
  ok(ids.every(id => Art.name(id) && lintOk(Art.name(id))), "every picture has a plain name for a screen reader");
  ok(ids.every(id => fs.existsSync(path.join(dir, id + ".png"))), "every picture has its file: " + ids.filter(id => !fs.existsSync(path.join(dir, id + ".png"))).join(", "));
  ok(files.every(f => ids.includes(f.replace(/\.png$/, ""))), "every file in assets/tablet is a named picture, so nothing is left over: " + files.filter(f => !ids.includes(f.replace(/\.png$/, ""))).join(", "));
  const png = id => { const b = fs.readFileSync(path.join(dir, id + ".png")); return { sig: b.subarray(0, 8).toString("hex"), w: b.readUInt32BE(16), h: b.readUInt32BE(20), type: b[25], size: b.length }; };
  const info = ids.map(id => [id, png(id)]);
  ok(info.every(([, i]) => i.sig === "89504e470d0a1a0a" && i.w === 400 && i.h === 400), "every picture is a real 400 by 400 PNG");
  ok(info.every(([, i]) => i.size < 60000), `every picture is light enough to keep for offline use (largest ${Math.max(...info.map(([, i]) => i.size))} bytes)`);
  const sw = read("sw.js");
  ok(ids.every(id => sw.includes('"assets/tablet/' + id + '.png"')), "the service worker keeps every picture for offline use");
  ok(ids.every(id => { const beside = Art.img(id, { size: 64 }), alone = Art.img(id, { label: "" }); return beside.startsWith('<img class="tb-ico" src="assets/tablet/' + id + '.png"') && /alt=""/.test(beside) && alone.includes('alt="' + Art.name(id) + '"'); }), "a picture has no words of its own beside a label, and says its name when it stands alone");
}

/* the screen's own words: calm, never testing, never childish */
const UIFILES = ["js/tablet.js", "js/tabletKit.js", "js/tabletCreate.js", "js/tabletThink.js"];
const html = read("tablet.html"), eng = read("js/tabletEngine.js"), art = read("js/tabletArt.js"), snd = read("js/tabletSound.js");
const strip = src => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");     // the code, without its comments
const raw = Object.fromEntries(UIFILES.map(f => [f, strip(read(f))]));
const ui = UIFILES.map(f => raw[f]).join("\n"), tabletJs = raw["js/tablet.js"];
{
  const strings = [...(ui + "\n" + html).matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map(m => m[1]).filter(x => x.length >= 4).concat([...html.matchAll(/>([^<>{}]{6,})</g)].map(m => m[1]));
  const BAD = /\b(wrong|incorrect|failed?|mistake|stupid|easy|simple|hard|difficult|quiz|test(ing)? your|do you remember|remember when|try to remember|baby|kiddie|cute|sweetie|dearie|good girl|good boy|game over|you lose|score)\b/i;
  const hits = strings.filter(x => BAD.test(x));
  ok(!hits.length, "the screen's words never say wrong, test, quiz, score or easy: " + hits.slice(0, 5).join(" | "));
  const sentences = strings.filter(x => / /.test(x) && /[a-z]{3}/.test(x));
  ok(sentences.length > 40 && sentences.every(x => lintOk(x)), "every sentence on the page passes the dignity rules: " + sentences.filter(x => !lintOk(x)).slice(0, 4).join(" | "));
  ok(/Nearly|Not quite|Keep looking|Good thought|Try another|waiting right here|Listen again/.test(ui) && !/alert\(|confirm\(/.test(ui), "a miss gets a gentle sentence, never an alert box");
  ok(!/new\s+Audio|\.mp3|\.wav|buzz|error sound/i.test(ui + strip(snd)) && /var soft = /.test(tabletJs), "a miss gets a soft rising note, never a buzzer, and no sound is recorded: every one is made on the tablet");
  ok(!/\b(red|#f00\b|#ff0000|#d00\b|crimson|firebrick)\b/i.test(strip(html).replace(/<!--[\s\S]*?-->/g, "").split("<style id=\"cg-nav-css\">")[0]), "the activity styles use no red for a miss");
}

/* the page is wired in */
{
  const order = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]).filter(f => !/^(src\/config\/license|assets\/services\/licenseManager)/.test(f));
  const want = ["assets/pcg/pcg-data.bundle.js", "src/pcg/prng.js", "src/pcg/matrix.js", "src/pcg/grammar.js", "src/pcg/puzzles.js", "assets/services/trialLedger.js", "js/tabletSound.js", "js/tabletArt.js", "js/tabletEngine.js", "js/tabletKit.js", "js/tabletCreate.js", "js/tabletThink.js", "js/tablet.js"];
  ok(JSON.stringify(order) === JSON.stringify(want), "the page loads the puzzle makers, the sounds and pictures, the engine, the kit, the activities and last the screen, in that order: " + order.join(", "));
  ok(order.every(f => fs.existsSync(path.join(ROOT, f))), "every script it names exists");
  ok(!/https?:\/\//.test(html.replace(/https:\/\/cognicopia\.org[^"]*/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/http:\/\/www\.w3\.org\/\d+\/svg/g, "")) || /rel="canonical"/.test(html), "the page names no outside address except its own canonical one");
  const everything = [html, ui, strip(eng), strip(art), strip(snd)].join("\n");
  for (const [what, re] of Object.entries({ "fetch()": /\bfetch\s*\(/, "XMLHttpRequest": /XMLHttpRequest/, "sendBeacon": /sendBeacon/, "a WebSocket": /new\s+WebSocket\b/, "an EventSource": /new\s+EventSource\b/, "a remote script": /<script[^>]+src=["']?(?:https?:)?\/\//i, "a remote stylesheet": /<link(?![^>]*rel="canonical")[^>]+href=["']?(?:https?:)?\/\//i, "an import": /@import\b/, "a remote picture or sound": /(?:src|href)=["']?https?:\/\/(?!cognicopia\.org)/i }))
    ok(!re.test(everything.replace(/https:\/\/cognicopia\.org[^"]*/g, "")), "the tablet page makes no network request: it contains " + what);
  ok(!/sessionStorage|indexedDB|document\.cookie/.test(everything), "nothing is kept in cookies or session storage");
  const keys = [...new Set([...tabletJs.matchAll(/(?:getItem|setItem|removeItem)\(\s*([A-Za-z_"'][^,)]*)/g)].map(m => m[1]))];
  ok(keys.length === 1 && keys[0] === "PREFS_KEY", "the only thing read or written in this browser is the choices (PREFS_KEY): " + keys.join(", "));
  ok(UIFILES.filter(f => f !== "js/tablet.js").every(f => !/localStorage/.test(raw[f])) && !/localStorage/.test(strip(eng) + strip(art) + strip(snd)), "no other file reads or writes anything in this browser");
  ok(/localStorage\.setItem\(PREFS_KEY, JSON\.stringify\(prefs\)\)/.test(tabletJs) && /var PREFS_KEY = "cognicopia_tablet_prefs", prefs = \{ stage: "middle", topic: "", sound: true, speed: 2 \}/.test(tabletJs), "and those choices (level, topic, sound, speed) hold nothing about anyone");
  ok(!/cognicopia_resident|cognicopia_profile|activeResident|qpEngine|CogniSecureStore/.test(ui), "the screen reads no resident or profile storage and asks for no name");
  const sw = read("sw.js");
  ok(["tablet.html", ...want.filter(f => f.startsWith("js/")), "assets/pcg/pcg-data.bundle.js", "assets/cognicopia-coloring/cognicopia-coloring.js", "assets/services/trialLedger.js"].every(f => sw.includes('"' + f + '"')), "the service worker keeps the page, its scripts, the puzzle content and the coloring library for offline use");
  const nav = HUBS.find(h => h.id === "today").items.find(i => i.key === "tablet");
  ok(nav && nav.href === "tablet.html" && nav.label === "Tablet Activities", "the Today menu has a Tablet Activities entry");
  const home = read("index.html"), hero = /<div class="lp-actions">([\s\S]*?)<\/div>/.exec(home);
  ok(hero && /<a class="lp-btn lp-btn-tablet" href="(?:\.\/)?tablet\.html">Tablet Activities<\/a>/.test(hero[1]) && hero[1].indexOf("lp-btn-tablet") < hero[1].indexOf("lp-more"), "the front page's top has a Tablet Activities button beside Make a packet");
  ok(/tablet\.html/.test(read("sitemap.xml")), "the sitemap lists the page");
  ok(/<title>Tablet Activities — Cognicopia<\/title>/.test(html) && /rel="canonical" href="https:\/\/cognicopia\.org\/tablet\.html"/.test(html), "the page has its own title and canonical address");
  ok(fs.existsSync(path.join(ROOT, "docs/tablet-activities.md")), "the guide for the page exists");
  const doc = fs.existsSync(path.join(ROOT, "docs/tablet-activities.md")) ? read("docs/tablet-activities.md") : "";
  ok(doc.indexOf("{" + "{") < 0 && doc.indexOf("{" + "%") < 0 && !/HIPAA compliant/i.test(doc), "the guide has no Liquid openers and makes no compliance claim");
}

/* the menu: every activity has an icon, a screen and a card */
{
  const legacy = [...tabletJs.matchAll(/\["([a-z]+)", ([0-2]), ([1-9]), "([^"]+)", "([^"]+)", ([a-zA-Z]+)\]/g)].map(m => ({ id: m[1], title: m[4], icon: new RegExp("\\n\\s+" + m[1] + ": '<").test(tabletJs), screen: new RegExp("function " + m[6] + "\\(root, o, api\\)").test(tabletJs) }));
  const reg = [];
  for (const f of UIFILES) for (const m of raw[f].matchAll(/Kit\.register\(\{\s*id: "([a-z]+)", group: ([0-2]), order: ([1-9]), title: "([^"]+)"[\s\S]*?icon: '(<[^']+)', start: ([a-zA-Z]+)\s*\}\)/g)) reg.push({ id: m[1], title: m[4], icon: true, screen: new RegExp("function " + m[6] + "\\(root, o, api\\)").test(raw[f]) });
  const ids = legacy.concat(reg);
  ok(ids.length === 13, "the menu has thirteen activities: " + ids.length);
  ok(ids.every(a => a.icon && a.screen), "each has an icon and a screen function: " + ids.filter(a => !(a.icon && a.screen)).map(a => a.id).join(","));
  ok(new Set(ids.map(a => a.title)).size === 13 && new Set(ids.map(a => a.id)).size === 13, "no two have the same name");
  for (const need of ["Word Search", "Trace the Path", "Crossword", "Sights and Sounds"]) ok(ids.some(a => a.title === need), `the menu has ${need}`);
  ok(/data-tap-exempt/.test(html) === false, "no control is marked exempt from the touch floor");
  ok(/--tbt:72px/.test(html) && /@media \(max-width:699px\),\(max-height:599px\)\{\.tb\{--tbt:56px\}\}/.test(html) && /min-height:var\(--tbt/.test(html), "controls are sized from one variable: 72 px on a tablet, 56 px on a phone (never under the 52 px floor)");
  ok(/id="tbAssist"/.test(html) && /id="tbNew"/.test(html) && /id="tbBack"/.test(html) && /id="tbSurprise"/.test(html), "the frame has Finish for me, Next, Home and the menu has Surprise me");
}

if (fails.length) { console.log(`tablet check FAILED: ${fails.length} problem(s), ${pass} passed\n  - ` + fails.slice(0, 30).join("\n  - ")); process.exit(1); }
console.log(`tablet check passed: ${pass} checks (13 activities, 3 stages x 43 topics, every shape's trace rule and journey, the sounds and pictures, the screen's words, offline wiring)`);
