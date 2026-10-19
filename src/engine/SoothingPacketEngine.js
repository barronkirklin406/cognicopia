/* =====================================================================
   Cognicopia Soothing Packet Engine.

   Builds a fresh calming packet of one to three pages, on the spot, from
   the soothing library (SoothingContent.js, SoothingArt.js), for the Instant
   Soothe button and for any other generator that wants one.

   The caregiver gives two things:
     stage   mild / early, moderate / mid, or acute / late
     theme   nature, heritage, music, or a mix
   and the engine does the rest.

   Two steps, so a packet can be replayed exactly:
     choose(o)    decides what goes in: how many pages, which kinds, and which
                  prompt, picture, puzzle and path, from a seed and the list of
                  what was printed lately (o.history). It never repeats a thing
                  that is on the list while there is anything else to pick from;
                  when a pool runs short it takes the one used longest ago.
                  The result is a small plan, which is plain data.
     compose(plan) draws the plan: one page model for each page, held to the
                  stage's rules in ClinicalMatrix.js (type 24 pt bold at the
                  late stage, 18 pt at the others; lines no thinner than the
                  stage's floor; black on white; inside the 0.5 in margin;
                  the adult-dignity filter), with the header, the clinical
                  tip and "Page X of Y" of the shell.
   The same plan always draws the same pages; two different seeds draw two
   different packets.

   What each stage gets
     early   a reminiscence invitation with a historical fact and two things
             to talk about, a calming word search or words to circle, a
             detailed picture or a path to trace
     middle  a simple invitation, a bold picture or a wide path, and now and
             then a guided puzzle
     late    one subject to a page: a very wide path or one bold picture to
             trace, and one large cue to talk about, with a line for the breath

   Runs in the browser (window.CognicopiaSoothingEngine) and in Node (vm).
   It makes no request, reads no clock (the date comes from the caller),
   uses no storage and never calls the browser's own random function.
   ===================================================================== */
(function (root) {
  "use strict";
  var VERSION = "1.0.0";
  var CM = root.CognicopiaClinicalMatrix, CA = root.CognicopiaClinicalActivities, PCG = root.CognicopiaPCG || {};
  var Art = root.CognicopiaSoothingArt, C = root.CognicopiaSoothingContent;
  if (!CM || !CA || !CA.kit) throw new Error("Load src/engine/ClinicalMatrix.js and ClinicalActivities.js before SoothingPacketEngine.js.");
  if (!PCG.prng) throw new Error("Load src/pcg/prng.js before SoothingPacketEngine.js.");
  if (!Art || !C) throw new Error("Load SoothingArt.js and SoothingContent.js before SoothingPacketEngine.js.");
  var kit = CA.kit, SH = CM.SHELL;
  var MAX_ATTEMPTS = 30;
  var RES_MIN = 18;                                   // the smallest a resident-facing line is, at any stage

  var STAGE_ALIAS = { mild: "early", early: "early", "mild / early": "early", moderate: "middle", mid: "middle", middle: "middle", "moderate / mid": "middle", acute: "late", late: "late", advanced: "late", "acute / late": "late" };
  function stageOf(v) { var k = String(v == null ? "" : v).toLowerCase().trim(); return STAGE_ALIAS[k] || CM.stageOf(v); }
  var THEME_IDS = ["nature", "heritage", "music"];
  function themeOf(v) { return C.THEMES[v] && v !== "mix" ? v : "mix"; }
  var LEVEL = { early: "detailed", middle: "simple", late: "bold" };
  var POOLS = ["prompts", "motifs", "puzzles", "paths", "grounding", "tips"];
  var cap = function (s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); };

  /* ---------- what is allowed in, and what was used lately ---------- */
  function avoider(list) {
    var res = [].concat(list || []).map(function (w) { return String(w || "").toLowerCase().trim(); }).filter(function (w) { return w.length >= 3; })
      .map(function (w) { return new RegExp("(^|[^a-z0-9])" + w.replace(/[^a-z0-9]+/g, "[^a-z0-9]+") + "s?([^a-z0-9]|$)", "i"); });
    return function (text) { text = String(text); for (var i = 0; i < res.length; i++) if (res[i].test(text)) return true; return false; };
  }
  var hay = {
    prompts: function (p) { return [p.title, p.text, p.cue, p.fact, p.tags.join(" ")].join(" "); },
    motifs: function (m) { return m.name; },
    puzzles: function (p) { return [p.title].concat(p.words || [], p.items || [], (p.pairs || []).map(function (q) { return q.stem + " " + q.answer; })).join(" "); },
    paths: function (p) { return p.name; }
  };
  function overlaps(era, win) { return era[0] <= win[1] && era[1] >= win[0]; }

  /* n different things from a pool, never one from the recent list while a fresh one remains; with the pool run dry, the one used longest ago */
  function pick(pool, hist, R, n, weightOf) {
    var at = {}, i;
    (hist || []).forEach(function (id, k) { at[id] = k; });
    var fresh = pool.filter(function (it) { return at[it.id] == null; }), out = [];
    while (out.length < n && fresh.length) {
      var it = weightOf ? R.weighted(fresh, weightOf) : R.pick(fresh);
      out.push(it); fresh = fresh.filter(function (x) { return x !== it; });
    }
    if (out.length < n) {
      var stale = pool.filter(function (x) { return out.indexOf(x) < 0; }).sort(function (a, b) { return at[a.id] - at[b.id]; });
      while (out.length < n && stale.length) {
        var head = stale.slice(0, Math.max(1, Math.ceil(stale.length * 0.3))), s = R.pick(head);
        out.push(s); stale = stale.filter(function (x) { return x !== s; });
      }
    }
    void i;
    return out;
  }

  /* ---------- choosing ---------- */
  function planKinds(stage, R, want) {
    var n = want ? Math.max(1, Math.min(3, want | 0)) : stage === "late" ? R.weighted([1, 2], function (k) { return k === 1 ? 0.2 : 0.8; }) : stage === "middle" ? R.weighted([2, 3], function (k) { return k === 2 ? 0.6 : 0.4; }) : R.weighted([2, 3], function (k) { return k === 2 ? 0.3 : 0.7; });
    var settle = R.pick(["path", "motif"]), types;
    /* a single page asked for (one version in a packet): any kind the stage suits, so a set of single pages is varied */
    if (n === 1 && want) {
      var kinds = stage === "late" ? { prompt: 0.25, path: 0.375, motif: 0.375 } : stage === "middle" ? { prompt: 0.3, path: 0.25, motif: 0.25, puzzle: 0.2 } : { prompt: 0.3, puzzle: 0.35, motif: 0.15, path: 0.2 };
      return [R.weighted(Object.keys(kinds), function (k) { return kinds[k]; })];
    }
    if (stage === "late") { n = Math.min(n, 2); types = n === 1 ? [settle] : [settle, "prompt"]; }
    else if (stage === "middle") types = n === 1 ? [settle] : n === 2 ? [settle, "prompt"] : [settle, "prompt", "puzzle"];
    else types = n === 1 ? ["prompt"] : n === 2 ? ["prompt", R.weighted(["puzzle", "motif", "path"], function (k) { return k === "puzzle" ? 0.5 : 0.25; })] : ["prompt", "puzzle", settle];
    return types;
  }
  function searchOk() { return !!(PCG.puzzles && PCG.matrix && PCG.matrix.data && PCG.puzzles.wordSearch); }

  /* One thing from pool, never one from the recent list while a fresh one is to be had. With a mixed theme, "to be had" reaches past
     the page's own theme (wide) before it comes back to the one used longest ago; with a chosen theme it never leaves it. */
  function pickIn(pool, wide, hist, R, weightOf) {
    var at = {};
    (hist || []).forEach(function (id, k) { at[id] = k; });
    var fresh = function (it) { return at[it.id] == null; };
    if (wide && !pool.some(fresh)) { var wf = wide.filter(fresh); if (wf.length) return pick(wf, hist, R, 1, weightOf)[0]; }
    return pick(pool, hist, R, 1, weightOf)[0];
  }

  function choose(o) {
    o = o || {};
    var stage = stageOf(o.stage), theme = themeOf(o.theme), seed = String(o.seed == null ? "soothe" : o.seed), mix = theme === "mix";
    var R = PCG.prng.create("soothe/" + VERSION + "/" + seed + "/" + stage + "/" + theme), hist = o.history || {}, bad = avoider(o.avoid);
    var era = o.era && o.era.length === 2 ? [+o.era[0], +o.era[1]] : null;
    var types = planKinds(stage, R.fork("kinds"), o.count);
    /* a theme for each page: the one chosen, or three different ones for a mix */
    var themes = mix ? R.fork("themes").shuffle(THEME_IDS) : null;
    var used = { prompts: [], motifs: [], puzzles: [], paths: [], grounding: [], tips: [] };
    var recent = function (name) { var at = {}; (hist[name] || []).forEach(function (id) { at[id] = 1; }); return function (it) { return !at[it.id]; }; };
    var items = types.map(function (type, i) {
      var th = mix ? themes[i % 3] : theme, code = C.CODE_OF[th], Ri = R.fork("item" + i + type);
      var item = { type: type, theme: th, seed: seed + "/" + i + "/" + type };
      var isNew = function (name) { return function (x) { return used[name].indexOf(x.id) < 0; }; };
      if (type === "prompt") {
        var wide = C.PROMPTS.filter(function (p) { return !bad(hay.prompts(p)) && isNew("prompts")(p); });
        var pool = wide.filter(function (p) { return p.themes.indexOf(code) >= 0 && (th !== "heritage" || overlaps(p.era, C.THEMES.heritage.eras)); });
        if (!pool.length) pool = wide;
        var pr = pickIn(pool, mix ? wide : null, hist.prompts, Ri, function (p) { return (stage === "early" && p.fact ? 3 : 1) * (era && overlaps(p.era, era) ? 3 : 1); });
        item.id = pr.id; used.prompts.push(pr.id);
      } else if (type === "motif") {
        var mw = Art.MOTIFS.filter(function (m) { return !bad(hay.motifs(m)) && isNew("motifs")(m); });
        var mp = mw.filter(function (m) { return m.themes.indexOf(code) >= 0; });
        if (!mp.length) mp = Art.MOTIFS.filter(function (m) { return !bad(hay.motifs(m)); });
        var mo = pickIn(mp, mix ? mw : null, hist.motifs, Ri); item.id = mo.id; used.motifs.push(mo.id);
      } else if (type === "path") {
        var pw = Art.PATHS.filter(function (p) { return !bad(hay.paths(p)) && isNew("paths")(p); });
        var pp = pw.filter(function (p) { return p.themes.indexOf(code) >= 0; });
        if (!pp.length) pp = Art.PATHS;
        var pa = pickIn(pp, mix ? pw : null, hist.paths, Ri); item.id = pa.id; used.paths.push(pa.id);
      } else {
        /* the kind of puzzle: one that still has something new in it, if any has */
        var allowed = C.PUZZLES.filter(function (p) { return !bad(hay.puzzles(p)) && isNew("puzzles")(p); });
        var inTheme = function (kind) { return allowed.filter(function (p) { return p.kind === kind && p.themes.indexOf(code) >= 0; }); };
        var fresh = recent("puzzles"), kindsOf = ["search", "likes", "finish"].filter(function (k) { return k !== "search" || searchOk(); });
        var open = kindsOf.filter(function (k) { return (mix ? allowed.filter(function (p) { return p.kind === k; }) : inTheme(k)).some(fresh); });
        var usable = open.length ? open : kindsOf.filter(function (k) { return inTheme(k).length; });
        if (!usable.length) usable = kindsOf;
        var kind = Ri.weighted(usable, function (k) { return k === "search" ? 0.4 : k === "likes" ? 0.35 : 0.25; });
        var zp = inTheme(kind);
        if (!zp.length) zp = allowed.filter(function (p) { return p.kind === kind; });
        if (!zp.length) zp = allowed.filter(function (p) { return p.kind !== "search"; });
        var zu = pickIn(zp, mix ? allowed.filter(function (p) { return p.kind === kind; }) : null, hist.puzzles, Ri); item.id = zu.id; used.puzzles.push(zu.id);
      }
      /* the line for the breath at the foot of the page */
      var gp = C.GROUNDING.filter(function (g) { return used.grounding.indexOf(g.id) < 0; });
      var gl = pick(gp, hist.grounding, Ri.fork("g"), 1)[0]; item.grounding = gl.id; used.grounding.push(gl.id);
      return item;
    });
    /* a tip for each page, none the same */
    items.forEach(function (it, i) {
      var tp = C.TIPS.filter(function (t) { return used.tips.indexOf(t.id) < 0; });
      var t = pick(tp, hist.tips, R.fork("tip" + i), 1)[0]; it.tip = t.id; used.tips.push(t.id);
    });
    return { v: VERSION, stage: stage, theme: theme, seed: seed, items: items, used: used };
  }

  /* ---------- lookups ---------- */
  var byId = function (list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; };
  var promptOf = function (id) { return byId(C.PROMPTS, id); };
  var motifOf = function (id) { return byId(Art.MOTIFS, id); };
  var pathOf = function (id) { return byId(Art.PATHS, id); };
  var puzzleOf = function (id) { return byId(C.PUZZLES, id); };
  var groundOf = function (id) { return byId(C.GROUNDING, id); };
  var tipOf = function (id) { return byId(C.TIPS, id); };

  /* "The 1950s", "The 1940s to the 1960s", or "Through the years" for a prompt's window */
  function eraText(era) {
    var a = Math.floor(Math.max(era[0], 1901) / 10) * 10, b = Math.floor(Math.min(era[1], 1989) / 10) * 10;
    if (a === b) return "The " + a + "s";
    if (b - a <= 20) return "The " + a + "s to the " + b + "s";
    return "Through the years";
  }

  /* ---------- the pages ---------- */
  function newSheet(kind, stage) { return kit.sheet(kind, stage, {}); }
  var linesHeight = function (n, size, lead) { return n ? (n - 1) * lead + Math.round(size * 0.32) + size * 0.8 : 0; };

  function head(sh, title, instruction) {
    var size = sh.fitSize(title, sh.F.w, sh.T.title, "title", true);
    if (size == null) { sh.fail("the title \"" + title + "\" is wider than the page"); return sh.F.y + 60; }
    return sh.head(title, instruction);
  }
  /* a line of breath at the foot, centered; returns the y of its top */
  function foot(sh, text, stage) {
    var size = stage === "late" ? 28 : stage === "middle" ? 24 : 22, bold = stage === "late", maxW = sh.F.w - 20;
    var lines = sh.wrap(text, maxW, size, bold), lead = Math.round(size * 1.3), top = sh.bottom - (lines.length - 1) * lead - Math.round(size * 0.35);
    lines.forEach(function (l, i) { sh.text(l, sh.cx, top + i * lead, size, { role: "body", bold: bold, align: "center" }); });
    return top - Math.round(size * 0.95);
  }

  function pagePrompt(sh, item, plan, ctx) {
    var st = sh.stage, S = sh.S, T = sh.T, F = sh.F, p = promptOf(item.id), R = ctx.rng, g = groundOf(item.grounding);
    var late = st === "late", title = late ? p.cue : p.title;
    var top = head(sh, title, C.INSTRUCTIONS.prompt[st]);
    if (late) {
      var size = 32, lead = 44, lines = sh.wrap(p.text, F.w - 24, size, true);
      while (lines.length > 7 && size > 28) { size -= 2; lead = Math.round(size * 1.38); lines = sh.wrap(p.text, F.w - 24, size, true); }
      var block = (lines.length - 1) * lead, y0 = top + ((sh.bottom - 60) - top - block) / 2 + size * 0.3;
      lines.forEach(function (l, i) { sh.text(l, sh.cx, y0 + i * lead, size, { role: "body", bold: true, align: "center" }); });
      foot(sh, g.short, st);
      sh.meta = { id: "soothe-prompt", title: title, instruction: "", topic: p.title, answers: [], key: { prompt: p.id } };
      return;
    }
    var psize = st === "early" ? 26 : 30, plead, plines, pad = 24;
    do { plead = Math.round(psize * 1.32); plines = sh.wrap(p.text, F.w - 40 - pad * 2, psize, false); psize -= 2; } while (plines.length > 5 && psize >= (st === "early" ? 22 : 24));
    psize += 2;
    var boxH = pad * 2 + (plines.length - 1) * plead + Math.round(psize * 0.9);
    /* the things to talk about, from the senses the prompt touches */
    var follows = [], senses = p.senses.slice(), want = st === "early" ? 2 : 1;
    senses = R.shuffle(senses);
    senses.forEach(function (s) { if (follows.length < want && C.FOLLOW[s]) follows.push(C.FOLLOW[s]); });
    if (follows.length < want) follows.push(C.FOLLOW[R.pick(["people", "place", "feeling"])]);
    follows = follows.filter(function (f, i) { return follows.indexOf(f) === i; }).slice(0, want);
    var fsize = st === "early" ? 24 : 26, flead = Math.round(fsize * 1.4);
    var chipText = eraText(p.era), csize = st === "early" ? 22 : 24, cw = sh.width(chipText, csize, true) + 44, chipH = 42;
    var factLines = [], fh = 0, fs = 20;
    if (st === "early" && p.fact) {
      factLines = sh.wrap("Did you know? " + p.fact, F.w - 60, fs, false); fh = factLines.length * Math.round(fs * 1.35) + 30;
    }
    var gap = 22, total = chipH + gap + boxH + (follows.length ? gap + follows.length * flead : 0) + (fh ? gap + fh : 0);
    var room = (sh.bottom - 14 - top) - total;
    if (room < 0) { sh.fail("the prompt page does not fit (" + Math.round(-room) + " pt over)"); return; }
    /* what is left is a space to jot a word or draw in, if the person likes */
    var respH = room - gap * 2 >= 150 ? Math.min(room - gap * 2, 330) : 0, y = top + (respH ? gap * 0.5 : room * 0.3);
    sh.rect(sh.cx - cw / 2, y, cw, chipH, { r: chipH / 2, w: S.stroke.rule, fill: "#fff", role: "rule" });
    sh.text(chipText, sh.cx, y + chipH / 2 + csize * 0.34, csize, { role: "label", bold: true, align: "center" });
    y += chipH + gap;
    sh.rect(F.x + 12, y, F.w - 24, boxH, { r: 18, w: S.stroke.rule, fill: "#fff", role: "rule" });
    plines.forEach(function (l, i) { sh.text(l, sh.cx, y + pad + psize * 0.82 + i * plead, psize, { role: "body", align: "center" }); });
    y += boxH;
    follows.forEach(function (f, i) { sh.text(f, sh.cx, y + gap + fsize * 0.9 + i * flead, fsize, { role: "body", align: "center" }); });
    if (follows.length) y += gap + follows.length * flead;
    if (respH) {
      var ry = y + gap, rh = Math.min(respH, (fh ? sh.bottom - 8 - fh - gap : sh.bottom - 14) - ry);
      if (rh >= 120) {
        sh.rect(F.x + 12, ry, F.w - 24, rh, { r: 18, w: S.stroke.rule, fill: "#fff", role: "rule" });
        sh.text("Write or draw here, if you like.", F.x + 34, ry + 36, 20, { role: "label" });
      }
    }
    if (fh) {
      var fy = sh.bottom - 8 - fh;
      sh.rect(F.x + 12, fy, F.w - 24, fh, { r: 14, w: S.stroke.rule, fill: "#fff", role: "rule" });
      factLines.forEach(function (l, i) { sh.text(l, F.x + 30, fy + 28 + i * Math.round(fs * 1.35), fs, { role: "body" }); });
    }
    sh.meta = { id: "soothe-prompt", title: title, instruction: C.INSTRUCTIONS.prompt[st], topic: p.title, answers: [], key: { prompt: p.id } };
    void T;
  }

  function pageMotif(sh, item, plan, ctx) {
    var st = sh.stage, S = sh.S, F = sh.F, m = motifOf(item.id), g = groundOf(item.grounding);
    var top = head(sh, m.name, C.INSTRUCTIONS.motif[st]);
    var bottom = foot(sh, st === "late" ? g.short : g.text, st);
    var box = { x: F.x + 6, y: top + 4, w: F.w - 12, h: bottom - top - 8 };
    var paths = m.draw(ctx.rng.fork("draw"), LEVEL[st]);
    sh.picture(paths, box, { w: S.stroke.art, role: "subject" });
    sh.meta = { id: "soothe-motif", title: m.name, instruction: C.INSTRUCTIONS.motif[st], topic: m.name.toLowerCase(), answers: [], key: { motif: m.id } };
  }

  var LANE = { early: 17, middle: 23, late: 30 };
  function pagePath(sh, item, plan, ctx) {
    var st = sh.stage, S = sh.S, F = sh.F, def = pathOf(item.id), g = groundOf(item.grounding), hw = LANE[st];
    var top = head(sh, def.name, C.INSTRUCTIONS.path[st]);
    var line = def.rhythm ? C.RHYTHM[0] : C.RHYTHM[1 + (ctx.rng.int(2))];
    var bottom = foot(sh, st === "late" ? line.short : line.text, st);
    var inset = hw + 10, area = { x: F.x + inset, y: top + 6 + inset, w: F.w - 2 * inset, h: bottom - top - 12 - 2 * inset };
    if (area.w < 120 || area.h < 120) { sh.fail("no room for the path"); return; }
    /* a path that runs across is turned to run down a tall page, so it uses the whole sheet */
    var turn = !!def.across && area.h > area.w * 1.1;
    var res = Art.buildPath(def, function () { return ctx.rng.fork("path"); }, turn ? area.h : area.w, turn ? area.w : area.h, hw);
    if (!res) { sh.fail("the path " + def.id + " does not fit a lane " + hw * 2 + " pt wide"); return; }
    var pts = res.pts.map(function (q) { return turn ? [q[1] + area.x, q[0] + area.y] : [q[0] + area.x, q[1] + area.y]; });
    var lane = Art.laneOutline(pts, hw, res.closed);
    lane.d.forEach(function (d) { sh.path(d, { fill: "#fff", w: S.stroke.motor, role: "motor" }); });
    var r = Math.max(20, hw * 0.9), size = st === "late" ? 24 : 18;
    var a = pts[0], b = pts[pts.length - 1];
    sh.circle(a[0], a[1], r, { fill: "#000", w: S.stroke.rule, role: "rule" });
    sh.text("GO", a[0], a[1] + size * 0.34, size, { role: "label", bold: true, align: "center", color: "#fff" });
    if (!res.closed) {
      sh.circle(b[0], b[1], r, { fill: "#000", w: S.stroke.rule, role: "rule" });
      sh.text("END", b[0], b[1] + size * 0.34, size, { role: "label", bold: true, align: "center", color: "#fff" });
    }
    sh.meta = { id: "soothe-path", title: def.name, instruction: C.INSTRUCTIONS.path[st], topic: def.name.toLowerCase(), answers: [], key: { path: def.id, ease: res.ease, closed: res.closed } };
  }

  var SEARCH_DIRS = { early: [[1, 0], [0, 1], [1, 1], [1, -1]], middle: [[1, 0], [0, 1]] };
  function pageSearch(sh, item, plan, ctx, z) {
    var st = sh.stage, S = sh.S, T = sh.T, F = sh.F, R = ctx.rng;
    if (!searchOk()) { sh.fail("the word search needs the procedural engine"); return; }
    var size = st === "early" ? 12 : 8, count = st === "early" ? 9 : 5, maxLen = st === "early" ? 10 : 7, words = [];
    R.shuffle(z.words.filter(function (w) { return w.length >= 3 && w.length <= maxLen; })).forEach(function (w) {
      if (words.length < count && !words.some(function (x) { return x.indexOf(w) >= 0 || w.indexOf(x) >= 0; })) words.push(w);
    });
    if (words.length < count) { sh.fail("too few words for the word search"); return; }
    var grid = PCG.puzzles.wordSearch(words, { size: size, dirs: SEARCH_DIRS[st] }, R.fork("grid"), PCG.matrix.data().safety);
    if (grid.dropped.length) { sh.fail("could not place " + grid.dropped.join(", ")); return; }
    var title = "Word Search: " + z.title, top = head(sh, title, C.INSTRUCTIONS.search[st]);
    var cols = st === "early" ? 3 : 2, colW = F.w / cols, longest = words.slice().sort(function (a, b) { return b.length - a.length; })[0];
    var wsize = sh.fitSize(longest, colW - 10, st === "early" ? 20 : 22, "word", false);
    if (wsize == null || wsize < RES_MIN) { sh.fail("the word list does not fit its columns"); return; }
    var rows = Math.ceil(words.length / cols), lead = Math.round(wsize * 1.45);
    var firstBase = sh.bottom - 10 - (rows - 1) * lead - Math.round(wsize * 0.25), listTop = firstBase - Math.round(wsize * 0.85);
    words.slice().sort().forEach(function (w, i) {
      var c = Math.floor(i / rows), r = i % rows;
      sh.text(w, F.x + c * colW + 4, firstBase + r * lead, wsize, { role: "word" });
    });
    var avail = listTop - 12 - top, cell = Math.floor(Math.min(F.w / size, avail / size)), gw = cell * size;
    var ls = Math.min(T.cell + (st === "early" ? 6 : 0), Math.floor(cell * 0.66));
    if (ls < RES_MIN) { sh.fail("the grid cells are too small for " + RES_MIN + " pt letters (" + cell + " pt cells)"); return; }
    var gx = sh.cx - gw / 2, gy = top;
    sh.rect(gx, gy, gw, gw, { w: S.stroke.rule, fill: "#fff", role: "rule" });
    grid.rows.forEach(function (row, r) {
      for (var c = 0; c < size; c++) sh.text(row.charAt(c), gx + c * cell + cell / 2, gy + r * cell + cell / 2 + ls * 0.35, ls, { role: "cell", bold: true, align: "center" });
    });
    if (st === "middle") grid.placed.forEach(function (p) { sh.rect(gx + p.c * cell + 2, gy + p.r * cell + 2, cell - 4, cell - 4, { r: 5, w: S.stroke.rule, role: "rule" }); });
    sh.meta = { id: "soothe-search", title: title, instruction: C.INSTRUCTIONS.search[st], topic: z.title.toLowerCase(), size: size, words: words,
      answers: grid.placed.map(function (p) { return p.word + " (row " + (p.r + 1) + ", column " + (p.c + 1) + ")"; }), key: { puzzle: z.id } };
  }

  function pageLikes(sh, item, plan, ctx, z) {
    var st = sh.stage, S = sh.S, F = sh.F, R = ctx.rng;
    var n = st === "early" ? 8 : 6, items = R.shuffle(z.items).slice(0, n), top = head(sh, z.title, C.INSTRUCTIONS.likes[st]);
    var cols = 2, rows = Math.ceil(items.length / cols), gapX = 20, gapY = 20, bottom = sh.bottom - 10;
    var bw = (F.w - 12 - gapX) / cols, bh = Math.min(96, ((bottom - top - 12) - (rows - 1) * gapY) / rows);
    if (bh < 56) { sh.fail("the boxes are too short"); return; }
    var y0 = top + 12 + Math.max(0, ((bottom - top - 12) - (rows * bh + (rows - 1) * gapY)) / 2);
    items.forEach(function (t, i) {
      var c = i % cols, r = Math.floor(i / cols), x = F.x + 6 + c * (bw + gapX), y = y0 + r * (bh + gapY);
      sh.rect(x, y, bw, bh, { r: 16, w: S.stroke.rule, fill: "#fff", role: "rule" });
      var size = sh.fitSize(t, bw - 24, st === "early" ? 26 : 28, "choice", false);
      if (size == null || size < RES_MIN) { sh.fail("\"" + t + "\" is wider than its box"); return; }
      sh.text(t, x + bw / 2, y + bh / 2 + size * 0.34, size, { role: "choice", align: "center" });
    });
    sh.meta = { id: "soothe-likes", title: z.title, instruction: C.INSTRUCTIONS.likes[st], topic: z.title.toLowerCase(), answers: ["There is no right or wrong choice; every word is a good one."], key: { puzzle: z.id } };
  }

  function pageFinish(sh, item, plan, ctx, z) {
    var st = sh.stage, S = sh.S, F = sh.F, R = ctx.rng;
    var n = st === "early" ? 5 : 4, nopt = st === "early" ? 3 : 2, pairs = R.shuffle(z.pairs).slice(0, n), top = head(sh, z.title, C.INSTRUCTIONS.finish[st]);
    var gapY = 14, bottom = sh.bottom - 8, rh = Math.min(104, ((bottom - top - 8) - (n - 1) * gapY) / n);
    if (rh < 60) { sh.fail("the rows are too short"); return; }
    var stemW = 190, ow = (F.w - stemW - 8) / nopt - 10, y0 = top + 8;
    pairs.forEach(function (p, i) {
      var y = y0 + i * (rh + gapY), opts = R.shuffle([p.answer].concat(p.others.slice(0, nopt - 1)));
      var ssize = sh.fitSize(p.stem, stemW - 10, 26, "body", false);
      if (ssize == null || ssize < RES_MIN) { sh.fail("\"" + p.stem + "\" is wider than its space"); return; }
      sh.text(p.stem, F.x + 4, y + rh / 2 + ssize * 0.34, ssize, { role: "body" });
      opts.forEach(function (w, k) {
        var x = F.x + stemW + k * (ow + 10), osize = sh.fitSize(w, ow - 16, 24, "choice", false);
        if (osize == null || osize < RES_MIN) { sh.fail("\"" + w + "\" is wider than its box"); return; }
        sh.rect(x, y + 4, ow, rh - 8, { r: 14, w: S.stroke.rule, fill: "#fff", role: "rule" });
        sh.text(w, x + ow / 2, y + rh / 2 + osize * 0.34, osize, { role: "choice", align: "center" });
      });
    });
    sh.meta = { id: "soothe-finish", title: z.title, instruction: C.INSTRUCTIONS.finish[st], topic: z.title.toLowerCase(), answers: pairs.map(function (p) { return p.stem + " " + p.answer; }), key: { puzzle: z.id } };
  }

  function pagePuzzle(sh, item, plan, ctx) {
    var z = puzzleOf(item.id);
    if (z.kind === "search") return pageSearch(sh, item, plan, ctx, z);
    if (z.kind === "likes") return pageLikes(sh, item, plan, ctx, z);
    return pageFinish(sh, item, plan, ctx, z);
  }
  var MAKERS = { prompt: pagePrompt, motif: pageMotif, path: pagePath, puzzle: pagePuzzle };
  var ACTIVITY = { prompt: "talk", motif: "silhouette", path: "pathtrace", search: "wordsearch", likes: "matching", finish: "choose-ending" };

  /* every resident-facing line is at least 18 pt, and 24 pt bold at the late stage */
  function problemsOf(page, stage) {
    var out = CM.validatePage(page, stage), staff = CM.STAFF_ROLES;
    page.texts.forEach(function (t) {
      if (staff.indexOf(t.role) < 0 && t.role !== "number" && t.role !== "mark" && t.size < RES_MIN - 1e-9) out.push("the text \"" + String(t.text).slice(0, 24) + "\" is " + t.size + " pt, under " + RES_MIN + " pt");
    });
    return out;
  }

  /* ---------- composing ---------- */
  function composePage(item, plan, i, ctx, n) {
    var stage = plan.stage, last = "", attempt;
    for (attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      var rng = PCG.prng.create("soothe/page/" + VERSION + "/" + item.seed + "/" + stage + "#" + attempt), sh = newSheet("soothe-" + item.type, stage);
      try { MAKERS[item.type](sh, item, plan, { rng: rng, attempt: attempt }); }
      catch (e) { last = e && e.message ? e.message : String(e); continue; }
      var probs = sh.problems(), body = sh.model();
      if (!probs.length && body.items.length + body.texts.length > 0) {
        var probsBody = problemsOf(body, stage);
        if (!probsBody.length) return { page: body, attempts: attempt + 1 };
        probs = probsBody;
      }
      last = probs[0] || "the page is empty";
    }
    throw new Error("The " + item.type + " page (" + item.id + ") could not be laid out for the " + stage + " stage: " + last);
  }

  function tipText(item, plan, page, ctx, used) {
    var t = tipOf(item.tip), kindKey = item.type === "puzzle" ? puzzleOf(item.id).kind : item.type, act = ACTIVITY[kindKey];
    /* the first page carries the calming tip; the others take a tip from the clinical rulebook for their kind of page when it has one */
    if (ctx.i > 0 && act) {
      var c = CM.cue({ stage: plan.stage, activity: act, rng: PCG.prng.create("soothe/cue/" + item.seed), name: ctx.name, page: ctx.i + 1, topic: page.meta && page.meta.topic, used: used });
      if (c && used.indexOf(c.raw) < 0) { used.push(c.raw); return { text: c.text, id: "cm:" + c.fw }; }
    }
    used.push(t.text);
    return { text: t.text, id: t.id };
  }

  /* compose(plan, ctx) -> a packet: { stage, theme, seed, pages: [{ kind, id, title, page, full, tip }], used }
     ctx: { name, date (YYYY-MM-DD), wing } */
  function compose(plan, ctx) {
    ctx = ctx || {};
    var stage = plan.stage, n = plan.items.length, pages = [], usedTips = [], day = ctx.date || PCG.prng.today().iso;
    plan.items.forEach(function (item, i) {
      var made = composePage(item, plan, i, ctx, n), tip = tipText(item, plan, made.page, { i: i, name: ctx.name }, usedTips);
      var full = CA.withShell(made.page, { name: ctx.name || "", date: day, wing: ctx.wing || "", page: i + 1, pages: n, tip: tip.text, stageLabel: C.STAGE_LABEL[stage] });
      var probs = CM.validatePage(full, stage);
      if (probs.length) throw new Error("The shell broke a rule on page " + (i + 1) + ": " + probs[0]);
      pages.push({ kind: item.type, id: item.id, title: made.page.meta.title, theme: item.theme, page: made.page, full: full, tip: tip.text, tipId: tip.id, attempts: made.attempts });
    });
    return { engine: VERSION, stage: stage, stageLabel: C.STAGE_LABEL[stage], theme: plan.theme, themeLabel: C.THEMES[plan.theme].label, seed: plan.seed, date: day, name: ctx.name || "", pages: pages, used: plan.used, plan: plan };
  }

  /* generate(o) -> a packet. o: { stage, theme, seed, history, era, avoid, count, name, date, wing }.
     If a choice cannot be drawn (rare), the next seed makes another. */
  function generate(o) {
    o = o || {};
    var last = "", k;
    for (k = 0; k < 6; k++) {
      var plan = choose(Object.assign({}, o, { seed: String(o.seed == null ? "soothe" : o.seed) + (k ? "~" + k : "") }));
      try { return compose(plan, o); } catch (e) { last = e && e.message ? e.message : String(e); }
    }
    throw new Error("A calming packet could not be made: " + last);
  }

  /* the content, with the counts the checks and the pickers use */
  function counts() {
    return { prompts: C.PROMPTS.length, motifs: Art.MOTIFS.length, puzzles: C.PUZZLES.length, paths: Art.PATHS.length, grounding: C.GROUNDING.length, tips: C.TIPS.length };
  }

  root.CognicopiaSoothingEngine = Object.freeze({
    VERSION: VERSION, POOLS: POOLS, stageOf: stageOf, themeOf: themeOf, choose: choose, compose: compose, generate: generate, counts: counts,
    pick: pick, eraText: eraText, avoider: avoider, RES_MIN: RES_MIN
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
