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
for (const f of ["assets/pcg/pcg-data.bundle.js", "src/pcg/prng.js", "src/pcg/matrix.js", "src/pcg/grammar.js", "src/pcg/puzzles.js", "js/tabletSound.js", "js/tabletArt.js", "js/tabletBanks.js", "js/tabletEngine.js"]) vm.runInContext(read(f), ctx, { filename: f });
const T = ctx.CognicopiaTablet, D = ctx.CognicopiaPCGData, G = ctx.CognicopiaPCG.grammar, Z = ctx.CognicopiaPCG.puzzles, Snd = ctx.CognicopiaTabletSound, Art = ctx.CognicopiaTabletArt, Bank = ctx.CognicopiaTabletBanks;
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
  /* word search: 3 x 3 up to 6 x 6, from a pack */
  const ws = plain(T.wordSearch(o)), NEED = { 3: 2, 4: 3, 5: 4, 6: 5 };
  ok(ws && ws.size >= c.search.sizes[0] && ws.size <= c.search.sizes[1] && ws.placed.length === NEED[ws.size], `${tag}: a word search of the stage's size with ${ws && NEED[ws.size]} words`);
  if (ws) {
    const allowed = c.search.dirs.filter(d => ws.size >= 5 || d[0] === 0 || d[1] === 0).map(d => d.join()), pack = Bank.PACKS.find(p => p.id === ws.pack);
    ok(ws.placed.every(p => allowed.includes([p.dx, p.dy].join()) && [...p.word].every((ch, k) => ws.rows[p.r + p.dy * k].charAt(p.c + p.dx * k) === ch) && wordOk(p.word) && pack.words.includes(p.word) && p.word.length <= ws.size), `${tag}: every search word is from its pack, where it says, in an allowed direction, and fits the grid`);
    ok(ws.words.length === ws.placed.length && ws.rows.length === ws.size && ws.rows.every(r => r.length === ws.size && /^[A-Z]+$/.test(r)), `${tag}: the list matches what was placed, and the grid is square and all capital letters`);
  }
  const small = plain(T.wordSearch(Object.assign({}, o, { fit: { size: 4 } })));
  ok(small && small.size <= 4 && small.placed.every(p => p.word.length <= 4), `${tag}: a small screen gets a smaller grid with shorter words`);
  /* crossword: from a clue set */
  const cw = plain(T.crossword(o));
  ok(cw && cw.entries.length >= 3 && cw.rows <= c.cross.size && cw.cols <= c.cross.size && !Z.checkCrossword(cw).length && Bank.CLUES.some(s => s.id === cw.topic), `${tag}: a sound crossword (no accidental words) from a clue set, no bigger than ${c.cross.size} x ${c.cross.size}`);
  if (cw) ok(cw.entries.every(e => e.clue && lintOk(e.clue) && e.clue.toUpperCase().indexOf(e.word) < 0 && wordOk(e.word) && e.num > 0), `${tag}: crossword clues pass the dignity rules and never contain their answer`);
  /* spell it: a picture, a clue, a word */
  const sp = plain(T.spellIt(o));
  ok(sp.items.length === c.spell.count && sp.items.every(i => i.word.length >= c.spell.minLen && i.word.length <= c.spell.maxLen && wordOk(i.word) && lintOk(i.clue) && i.clue.toUpperCase().indexOf(i.word) < 0 && Art.has(i.art) && i.given === (c.spell.firstGiven ? 1 : 0)), `${tag}: ${c.spell.count} spelling words fit the stage, each with a drawn picture and a plain clue, and the first letter is given where the stage calls for it`);
  ok(new Set(sp.items.map(i => i.word)).size === sp.items.length, `${tag}: no spelling word twice`);
  /* sayings */
  const sy = plain(T.sayings(o));
  ok(sy.items.length === c.saying.count && sy.items.every(s => s.options.includes(s.answer) && s.options.length === c.saying.options && new Set(s.options).size === s.options.length && lintOk(s.lead + " " + s.answer) && s.lead.toLowerCase().indexOf(s.answer.toLowerCase()) < 0), `${tag}: each saying's answer is among its ${c.saying.options} different choices, and the start never gives it away`);
  /* sort it: pictures from two sets that cannot be mistaken for each other */
  const SETS = Bank.SETS, setOf = {}; SETS.forEach(s => s.things.forEach(t => { setOf[t] = s.id; }));
  const famOf = id => SETS.find(x => x.id === id).family, thingWord = a => Bank.OBJECTS.find(x => x.art === a).word;
  const so = plain(T.sortIt(o)), per = Math.ceil(c.sort.count / 2);
  ok(so.groups.length === 2 && so.groups[0].id !== so.groups[1].id && famOf(so.groups[0].id) !== famOf(so.groups[1].id) && so.groups.every(g => Art.has(g.cover) && g.label && g.group), `${tag}: two baskets from sets of different kinds, each with a picture`);
  ok(so.items.length === c.sort.count && new Set(so.items.map(i => i.art)).size === so.items.length && [0, 1].every(g => so.items.filter(i => i.group === g).length === per), `${tag}: ${c.sort.count} different pictures, ${per} for each basket`);
  ok(so.items.every(i => Art.has(i.art) && setOf[i.art] === so.groups[i.group].id && lintOk(i.word) && i.word.toLowerCase() === thingWord(i.art).toLowerCase()), `${tag}: every picture belongs to the basket it is marked for, and is named`);
  /* odd one out: three that go together, one that does not */
  const od = plain(T.oddOne(o));
  ok(od.rounds.length === c.odd.rounds && od.rounds.every(r => r.cards.length === 4 && r.cards.filter(x => x.odd).length === 1), `${tag}: odd-one-out rounds have three that go together and one that does not`);
  ok(od.rounds.every(r => { const odd = r.cards.find(x => x.odd), same = r.cards.filter(x => !x.odd); return same.every(x => setOf[x.art] === r.set) && setOf[odd.art] !== r.set && famOf(setOf[odd.art]) !== famOf(r.set) && r.cards.every(x => Art.has(x.art) && lintOk(x.word)) && new Set(r.cards.map(x => x.art)).size === 4; }), `${tag}: the three share a set, the odd one comes from a set of another kind, and every card has a picture and a name`);
  ok(new Set(od.rounds.map(r => r.set)).size === od.rounds.length, `${tag}: no two rounds are about the same set`);
  /* put in order */
  const io = plain(T.inOrder(o));
  ok(io.items.length >= 2 && io.items.every(i => i.steps.length >= 3 && i.steps.length <= c.order.maxSteps && i.order.length === i.steps.length && [...i.order].sort().join() === i.steps.map((s, k) => k).join() && i.order.some((v, k) => v !== k) && i.steps.every(lintOk)), `${tag}: steps can be put in order, they are mixed up, and no more than the stage allows`);
  ok(io.items.every(i => i.art === "" || Art.has(i.art)), `${tag}: a picture on a job is one that exists`);
  /* match the clue: a picture and the clue that goes with it */
  const ma = plain(T.matchUp(o));
  ok(ma.pairs.length === c.match.pairs && new Set(ma.pairs.map(p => p.art)).size === ma.pairs.length && new Set(ma.pairs.map(p => setOf[p.art])).size === ma.pairs.length && ma.pairs.every(p => p.set === setOf[p.art]), `${tag}: ${c.match.pairs} pictures with clues, each from a different set so no clue can fit two`);
  ok([...ma.pictures].sort().join() === ma.pairs.map(p => p.art).sort().join() && [...ma.clues].sort().join() === ma.pairs.map(p => p.clue).sort().join(), `${tag}: the pictures and the clues are the pairs, mixed up`);
  ok(ma.pairs.every(p => Art.has(p.art) && lintOk(p.clue) && lintOk(p.word) && p.clue.toLowerCase().indexOf(p.word.toLowerCase()) < 0), `${tag}: every clue passes the dignity rules and does not name its picture`);
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
  ok(s.early.search.sizes[0] > s.late.search.sizes[1] - 1 && s.early.search.sizes[1] === 6 && s.late.search.sizes[0] === 3 && s.middle.search.sizes.join() === "4,5", "the word search grows from 3 x 3 (late) to 6 x 6 (early)");
  ok(s.late.search.dirs.length === 1 && s.late.search.dirs[0].join() === "1,0", "the late-stage search reads across only");
  ok(s.early.trace.tol < s.middle.trace.tol && s.middle.trace.tol < s.late.trace.tol, "the path gets wider at each later stage");
  ok(s.early.saying.options > s.late.saying.options && s.late.saying.options === 2, "a later stage has fewer choices");
  ok(s.late.cross.size < s.early.cross.size && s.late.cross.target < s.early.cross.target, "the late-stage crossword is smaller");
  ok(s.late.spell.firstGiven && !s.early.spell.firstGiven && s.late.spell.maxLen < s.early.spell.maxLen, "the late stage is given the first letter, and shorter words");
}

/* the banks: how much there is, and that all of it is plain and kind */
{
  const BL = new Set(D.safety.blocklist), words = s => s.split(/\s+/);
  const counts = plain(T.counts());
  ok(Bank.PACKS.length >= 20 && counts.packs === Bank.PACKS.length, `${Bank.PACKS.length} word-search packs (at least 20)`);
  ok(Bank.PACKS.every(p => p.id && lintOk(p.label) && p.words.length >= 12 && new Set(p.words).size === p.words.length && p.words.every(w => /^[A-Z]{3,6}$/.test(w) && !BL.has(w))), "every pack has at least twelve different plain words of three to six letters, none on the blocklist");
  ok([3, 4, 5, 6].every(sz => Bank.PACKS.filter(p => p.words.filter(w => w.length <= sz).length >= { 3: 2, 4: 3, 5: 4, 6: 5 }[sz]).length >= 12), "at least twelve packs can fill every grid size, 3 x 3 included");
  ok(Bank.CLUES.length >= 50 && counts.clueSets === Bank.CLUES.length, `${Bank.CLUES.length} crossword clue sets (at least 50), ${Bank.CLUES.reduce((m, c) => m + c.entries.length, 0)} clues`);
  ok(Bank.CLUES.every(c => lintOk(c.title) && c.entries.length >= 7 && new Set(c.entries.map(e => e[0])).size === c.entries.length && c.entries.every(([w, cl]) => /^[A-Z]{3,6}$/.test(w) && !BL.has(w) && lintOk(cl) && cl.toUpperCase().indexOf(w) < 0 && cl.length <= 70)), "every clue set has at least seven different answers of three to six letters; every clue passes the dignity rules and does not contain its answer");
  ok(Bank.CLUES.some(c => c.entries.some(e => /___/.test(e[1]))) && Bank.CLUES.filter(c => c.entries.some(e => /___/.test(e[1]))).length >= 10, "at least ten sets finish sayings, such as a dog is man's best ___");
  let sound = 0, total = 0;
  for (const c of Bank.CLUES) for (let k = 0; k < 4; k++) { total++; const cw = T.crossword({ stage: "middle", topic: c.topics[0] || "", seed: c.id + k, fit: { size: 6 } }); if (cw && cw.entries.length >= 3) sound++; }
  ok(sound === total, `every clue set can make crosswords (${sound} of ${total} tries)`);
  const fillers = Bank.CLUES.filter(c => { let okc = 0; for (let k = 0; k < 4; k++) { const entries = c.entries.filter(e => e[0].length <= 5).map(e => ({ word: e[0], clue: e[1] })); const cw = Z.crossword(entries, { size: 5, target: 3, max: 4, attempts: 40 }, ctx.CognicopiaPCG.prng.create("late" + c.id + k)); if (cw && cw.entries.length >= 3 && !Z.checkCrossword(cw).length) okc++; } return okc >= 3; }).length;
  ok(fillers >= Bank.CLUES.length * 0.85, `at least 85% of the clue sets also make a 5 x 5 crossword for the late stage (${fillers} of ${Bank.CLUES.length})`);
  const pool = plain(T.counts());
  ok(pool.sayings >= 100, `${pool.sayings} sayings to finish (at least 100)`);
  const allSay = Bank.SAYINGS.concat(D.activities.sayings);
  ok(Bank.SAYINGS.length >= 40 && Bank.SAYINGS.every(s => lintOk(s.lead + " " + s.answer) && s.others.length === 2 && !s.others.includes(s.answer) && new Set(s.others).size === 2 && s.lead.toLowerCase().indexOf(s.answer.toLowerCase()) < 0 && /^(proverb|song|hymn)$/.test(s.kind) && s.others.every(lintOk)), "the new sayings are proverbs, songs and hymns whose two other choices never fit and whose start never gives the answer away");
  ok(["proverb", "song", "hymn"].every(k => Bank.SAYINGS.some(s => s.kind === k)), "there are proverbs, songs and hymns");
  ok(Bank.OBJECTS.length >= 48 && counts.objects === Bank.OBJECTS.length && Bank.OBJECTS.every(x => Art.has(x.art) && /^[A-Z]{3,6}$/.test(x.word) && !BL.has(x.word) && lintOk(x.clue) && x.clue.toUpperCase().indexOf(x.word) < 0), `${Bank.OBJECTS.length} things to spell (at least 48), each with a drawn picture and a clue that does not give the word away`);
  for (const stage of STAGES) ok(Bank.OBJECTS.filter(x => x.word.length >= T.STAGES[stage].spell.minLen && x.word.length <= T.STAGES[stage].spell.maxLen).length >= 12, `${stage} stage: at least twelve things fit its word lengths`);
  /* nothing in the banks is a quiz about the past, or a pet name */
  ok(![...Bank.PACKS.map(p => p.label), ...Bank.CLUES.map(c => c.title), ...Bank.CLUES.flatMap(c => c.entries.map(e => e[1])), ...Bank.SAYINGS.map(s => s.lead), ...Bank.OBJECTS.map(x => x.clue)].some(t => /\b(remember|recall|forgot|quiz|test|wrong|score|sweetheart|honey|sweetie|baby)\b/i.test(t)), "no bank text asks anyone to remember, tests, scores or uses a pet name");
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

/* things that go together: the sets, the decks, and what a topic or a recent screen changes */
{
  const SETS = Bank.SETS, all = SETS.flatMap(s => s.things);
  ok(SETS.length >= 9 && new Set(SETS.map(s => s.id)).size === SETS.length, `${SETS.length} sets of things that go together`);
  ok(all.length === new Set(all).size && all.every(a => Art.has(a) && Bank.OBJECTS.some(x => x.art === a)), "every picture is in one set only, exists, and has a name and a clue");
  ok(SETS.every(s => s.things.length >= 3 && Art.has(s.cover) && s.things.includes(s.cover)) && SETS.every(s => lintOk(s.label) && lintOk(s.group)), "every set has at least three things, a cover picture and plain words");
  const topicIds = new Set(T.TOPICS.map(t => t.id));
  ok(SETS.every(s => s.topics.length >= 3 && s.topics.every(t => topicIds.has(t))), "every set is chosen by topics that exist");
  const decks = plain(T.oddDecks());
  ok(decks.length >= 50 && new Set(decks.map(d => d.together + "/" + d.apart)).size === decks.length, `${decks.length} different odd-one-out decks, fifty or more`);
  ok(decks.every(d => SETS.find(s => s.id === d.together).things.length >= 3 && SETS.find(s => s.id === d.together).family !== SETS.find(s => s.id === d.apart).family), "every deck sets one set against a set of another kind");
  const seen = new Set(); for (let i = 0; i < 80; i++) T.oddOne({ stage: "early", topic: "", seed: "deck" + i }).rounds.forEach(r => seen.add(r.set + "/" + r.cards.find(x => x.odd).art));
  ok(seen.size >= 30, `eighty early-stage sessions bring ${seen.size} different decks`);
  ok(T.sortIt({ stage: "middle", topic: "farming", seed: "t" }).groups[0].id === "farm" && T.oddOne({ stage: "middle", topic: "farming", seed: "t" }).rounds[0].set === "farm" && T.matchUp({ stage: "middle", topic: "farming", seed: "t" }).pairs.some(p => SETS.find(s => s.id === "farm").things.includes(p.art)), "a topic chooses its own set first");
  ok(T.sortIt({ stage: "middle", topic: "", seed: "t", avoid: ["fruit", "farm", "plants"] }).groups[0].id !== "fruit" && T.oddOne({ stage: "late", topic: "", seed: "t", avoid: ["fruit"] }).rounds[0].set !== "fruit", "what the last screen showed comes last");
}

/* color a picture: four sets of colors, and the shapes found in a picture made of closed outlines */
{
  const hexOf = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  ok(T.PALETTES.length === 4 && new Set(T.PALETTES.map(p => p.id)).size === 4 && new Set(T.PALETTES.map(p => p.name)).size === 4, "four sets of colors, each with its own name");
  for (const p of T.PALETTES) {
    ok(p.colors.length === 8, `${p.id}: eight colors`);
    ok(new Set(p.colors.map(c => c[1])).size === 8 && new Set(p.colors.map(c => c[0])).size === 8, `${p.id}: no color or name repeats`);
    ok(p.colors.every(c => /^#[0-9a-f]{6}$/.test(c[1]) && /^[A-Z][a-z]+( [a-z]+)?$/.test(c[0])), `${p.id}: every color has a plain name and a hex value`);
    let near = 0; for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) { const a = hexOf(p.colors[i][1]), b = hexOf(p.colors[j][1]); if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 24) near++; }
    ok(near === 0, `${p.id}: no two colors are hard to tell apart`);
  }
  const px = (w, h, fn) => { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = fn(x, y) ? 0 : 255, i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } return d; };
  /* a framed page cut in two by a vertical line, with a black blob and a tiny white hole inside the left half */
  const W = 60, H = 80, frame = (x, y) => (x >= 10 && x < 14 && y >= 10 && y < 70) || (x >= 46 && x < 50 && y >= 10 && y < 70) || (y >= 10 && y < 14 && x >= 10 && x < 50) || (y >= 66 && y < 70 && x >= 10 && x < 50);
  const picture = px(W, H, (x, y) => frame(x, y) || (x >= 28 && x < 32 && y >= 10 && y < 70) || (x >= 16 && x < 22 && y >= 30 && y < 36 && !(x >= 18 && x < 20 && y >= 32 && y < 34)));
  const R = T.regions(picture, W, H, 40), at = (x, y) => R.lab[y * W + x];
  ok(R.count === 3 && R.bg === at(2, 2) && at(20, 20) !== at(40, 20) && at(20, 20) > 0 && at(40, 20) > 0 && at(20, 20) !== R.bg, "a framed page cut in two: the outside and the two halves are three shapes");
  ok(R.lab.every(v => v > 0 && v <= R.count), "every point of the page belongs to a shape, so a tap anywhere colors something");
  ok(at(30, 40) === at(20, 40) || at(30, 40) === at(40, 40), "a tap on a line colors the shape beside it");
  ok(at(19, 33) === at(20, 20), "a speck too small to tap joins the shape around it");
  const L = R.boxes[at(20, 20)], Rt = R.boxes[at(40, 20)];
  ok(L[0] <= 14 && L[2] >= 26 && L[2] <= 32 && Rt[0] >= 28 && Rt[2] >= 46 && L[1] <= 14 && L[3] >= 66, "each shape's box covers it and stays on its own side of the line");
  ok(R.areas[at(20, 20)] > 600 && R.areas[at(40, 20)] > 600, "the areas are counted");
  const dark = T.regions(px(30, 30, () => true), 30, 30, 10), blank = T.regions(px(30, 30, () => false), 30, 30, 10);
  ok(dark.count === 0 && blank.count === 1 && blank.bg === 1 && blank.lab.every(v => v === 1), "a page with no space, or with no lines, is handled");
  /* the same picture twice gives the same shapes */
  ok(JSON.stringify(Array.from(T.regions(picture, W, H, 40).lab)) === JSON.stringify(Array.from(R.lab)), "the same picture always gives the same shapes");
  /* which library pictures are offered: all that suit, in a different order for each seed, never a mandala or a sensitive one */
  const designs = Array.from({ length: 30 }, (_, i) => ({ id: "d" + i, cat: i % 5 === 0 ? "zentangle-mandalas" : "animals", sensitive: i % 7 === 3 ? ["war"] : [] }));
  const eligible = designs.filter(d => d.cat !== "zentangle-mandalas" && !d.sensitive.length).map(d => d.id);
  const a = T.designChoices({ seed: "a" }, designs), b = T.designChoices({ seed: "b" }, designs);
  ok(a.length === eligible.length && [...a].sort().join() === [...eligible].sort().join(), "every picture that suits is offered, and no mandala or sensitive one");
  ok(JSON.stringify(a) !== JSON.stringify(b) && JSON.stringify(a) === JSON.stringify(T.designChoices({ seed: "a" }, designs)), "a seed always gives the same order, another seed another");
}

/* the sounds: each one has a picture, a name and a line */
{
  const ids = Snd.META.map(m => m.id);
  ok(ids.length >= 6 && new Set(ids).size === ids.length, `the board has ${ids.length} different sounds`);
  for (const need of ["bird", "train", "guitar", "cat", "storm", "bells"]) ok(ids.includes(need), `the board has the ${need} sound`);
  ok(Snd.META.every(m => Art.has(m.id) && m.name && m.line && lintOk(m.name) && lintOk(m.line) && !/\b(scary|loud|noise)\b/i.test(m.line)), "every sound has a picture, a name and a calm line that pass the dignity rules");
  ok(typeof Snd.create === "function" && typeof Snd.render === "function", "the sounds are made on the tablet (a synthesizer, not recordings)");
}

/* every script the page loads parses (the browser check would otherwise be the first to notice a typo in a screen file) */
for (const f of ["js/tablet.js", "js/tabletKit.js", "js/tabletWords.js", "js/tabletCreate.js", "js/tabletThink.js", "js/tabletBanks.js", "js/tabletArt.js", "js/tabletSound.js", "js/tabletEngine.js"]) {
  let fine = true; try { new vm.Script(fs.readFileSync(path.join(ROOT, f), "utf8"), { filename: f }); } catch (e) { fine = false; console.error(f + ": " + e.message); }
  ok(fine, `${f} is valid script`);
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
const UIFILES = ["js/tablet.js", "js/tabletKit.js", "js/tabletWords.js", "js/tabletCreate.js", "js/tabletThink.js"];
const html = read("tablet.html"), eng = read("js/tabletEngine.js"), art = read("js/tabletArt.js"), snd = read("js/tabletSound.js"), banksJs = read("js/tabletBanks.js");
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
  const want = ["assets/pcg/pcg-data.bundle.js", "src/pcg/prng.js", "src/pcg/matrix.js", "src/pcg/grammar.js", "src/pcg/puzzles.js", "assets/services/trialLedger.js", "js/tabletSound.js", "js/tabletArt.js", "js/tabletBanks.js", "js/tabletEngine.js", "js/tabletKit.js", "js/tabletWords.js", "js/tabletCreate.js", "js/tabletThink.js", "js/tablet.js"];
  ok(JSON.stringify(order) === JSON.stringify(want), "the page loads the puzzle makers, the sounds and pictures, the engine, the kit, the activities and last the screen, in that order: " + order.join(", "));
  ok(order.every(f => fs.existsSync(path.join(ROOT, f))), "every script it names exists");
  ok(!/https?:\/\//.test(html.replace(/https:\/\/cognicopia\.org[^"]*/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/http:\/\/www\.w3\.org\/\d+\/svg/g, "")) || /rel="canonical"/.test(html), "the page names no outside address except its own canonical one");
  const everything = [html, ui, strip(eng), strip(art), strip(snd), strip(banksJs)].join("\n");
  for (const [what, re] of Object.entries({ "fetch()": /\bfetch\s*\(/, "XMLHttpRequest": /XMLHttpRequest/, "sendBeacon": /sendBeacon/, "a WebSocket": /new\s+WebSocket\b/, "an EventSource": /new\s+EventSource\b/, "a remote script": /<script[^>]+src=["']?(?:https?:)?\/\//i, "a remote stylesheet": /<link(?![^>]*rel="canonical")[^>]+href=["']?(?:https?:)?\/\//i, "an import": /@import\b/, "a remote picture or sound": /(?:src|href)=["']?https?:\/\/(?!cognicopia\.org)/i }))
    ok(!re.test(everything.replace(/https:\/\/cognicopia\.org[^"]*/g, "")), "the tablet page makes no network request: it contains " + what);
  ok(!/sessionStorage|indexedDB|document\.cookie/.test(everything), "nothing is kept in cookies or session storage");
  const keys = [...new Set([...tabletJs.matchAll(/(?:getItem|setItem|removeItem)\(\s*([A-Za-z_"'][^,)]*)/g)].map(m => m[1]))];
  ok(keys.length === 1 && keys[0] === "PREFS_KEY", "the only thing read or written in this browser is the choices (PREFS_KEY): " + keys.join(", "));
  ok(UIFILES.filter(f => f !== "js/tablet.js").every(f => !/localStorage/.test(raw[f])) && !/localStorage/.test(strip(eng) + strip(art) + strip(snd) + strip(banksJs)), "no other file reads or writes anything in this browser");
  ok(/localStorage\.setItem\(PREFS_KEY, JSON\.stringify\(prefs\)\)/.test(tabletJs) && /var PREFS_KEY = "cognicopia_tablet_prefs", prefs = \{ stage: "middle", topic: "", sound: true, speed: 2, grid: 0, palette: 0, paper: 0 \}/.test(tabletJs), "and those choices (level, topic, sound, speed, grid size, color set, paper) hold nothing about anyone");
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
