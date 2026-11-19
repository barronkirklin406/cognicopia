/* The hybrid sheets (hand-written source with no TypeScript; edit this file directly. It is listed in HAND_WRITTEN in
   scripts/build-services.mjs, so npm run services never builds or overwrites it).

   One sheet that does several things at once: a bold picture to trace or color, plus a line to sing, a few things to talk about, a feel to
   think of, or three pairs to match. compose() only chooses and returns plain data; the packet tool draws it (index.html: the Quick packet's
   hybrid page and the main packet's), so the words, the picture and the staff tips are decided in one place.

   Every choice goes through CogniBanks.pick and CogniVariety.take, so a sheet differs from the last one and nothing comes back until the
   pool has been through. A resident's birth year picks entries from their formative years (born + 7 to + 28); with none, the sheet mixes
   decades. Nothing here quizzes: the lines are invitations, a matching page shows its pairs to staff on the staff sheet, and the tips
   (for the person beside the resident) go on the Staff Companion Sheet, never on the resident's page.

   compose({ R, born, decades, stage, layout, avoid, library }) -> { layout, title, subtitle, instruction, art, items, lyric, pairs, closing, tips, facts }
   LAYOUTS lists the layout ids and titles; TIPS holds the tips for each. */
(function (root) {
  "use strict";
  var LAYOUTS = {
    "trace-sing":  { title: "Trace and Sing" },
    "trace-talk":  { title: "Trace and Talk" },
    "match-color": { title: "Match and Color" },
    "look-hold":   { title: "Look, Hold and Talk" },
    "hum-along":   { title: "Hum Along" },
    "look-back":   { title: "A Look Back" }
  };
  var ORDER = Object.keys(LAYOUTS);

  /* two or three tips for each layout, for the person beside the resident: one-on-one, hand-under-hand tracing, a small group */
  var TIPS = {
    "trace-sing": [
      "One to one: sing slowly and stop before the last word. A hum or a nod is a good answer.",
      "Tracing: use hand-under-hand. Rest your hand beneath theirs and let them lead.",
      "Group: hum the tune together, then pass the page and trace a part each."],
    "trace-talk": [
      "One to one: read the line aloud, then wait. Any memory, even a small one, is welcome.",
      "Tracing: use hand-under-hand. Rest your hand beneath theirs and follow at their pace.",
      "Group: read the line aloud and let each person say what they liked."],
    "match-color": [
      "One to one: say each pair together first, then ask for a line. Any line counts.",
      "Coloring: offer a fat marker and let them choose. Hand-under-hand helps a tired grip.",
      "Group: match the pairs aloud together, then color side by side."],
    "look-hold": [
      "One to one: bring a real one or a picture, let them hold it, and follow where they take it.",
      "Tracing: use hand-under-hand to follow the outline, then rest the hand on the real thing.",
      "Group: pass the object around and let each person say one word about how it feels."],
    "hum-along": [
      "One to one: hum the first bars and wait. Humming, tapping and swaying all count.",
      "Tracing: use hand-under-hand to follow the outline in time with the tune.",
      "Group: sing one song through together, then let someone choose the next."],
    "look-back": [
      "One to one: read one line, then wait. Let go of any line that does not land.",
      "Tracing: use hand-under-hand to follow the outline while you talk.",
      "Group: read the lines aloud and let each person say which one they like best."]
  };

  function lib(o) {
    if (o.library) return o.library;
    try { var C = root.CognicopiaColoring; return C && C.designs ? C.designs() : []; } catch (e) { return []; }
  }
  var VINTAGE = /^(vintage-americana|nostalgic-heritage|home-everyday|classic-vehicles)$/, PATTERN = /^(bold-easy-patterns|zentangle-mandalas)$/;
  var TIER = { early: 1, middle: 2, late: 3 };

  function artFor(o, R, entry, wantPattern) {
    var L = lib(o), V = root.CogniVariety, tier = TIER[o.stage] || 2;
    if (!L.length) return null;
    var by = {}; L.forEach(function (d) { by[d.id] = d; });
    var avoid = o.avoid || function () { return false; };
    if (entry && entry.art && by[entry.art] && !avoid(by[entry.art].title)) return { id: entry.art, title: by[entry.art].title, tier: tier, cat: by[entry.art].cat };
    var pool = L.filter(function (d) { return (wantPattern ? PATTERN : VINTAGE).test(d.cat || "") && !avoid(d.title + " " + (d.tags || []).join(" ")); });
    if (!pool.length) pool = L.filter(function (d) { return !avoid(d.title); });
    if (!pool.length) return null;
    var d = V ? V.take(pool, "id", R, 1, { pool: "hybrid-art" })[0] : R.pick(pool);
    return { id: d.id, title: d.title, tier: tier, cat: d.cat };
  }

  function shuffledOther(list, R) {
    var right = list.slice();
    for (var t = 0; t < 40; t++) { right = R.shuffle(right.slice()); if (right.every(function (w, i) { return w !== list[i]; })) return right; }
    return list.map(function (_, i) { return list[(i + 1) % list.length]; });
  }

  function compose(o) {
    o = o || {};
    var R = o.R, B = root.CogniBanks, stage = TIER[o.stage] ? o.stage : "middle";
    var layout = LAYOUTS[o.layout] ? o.layout : (R.pick(ORDER)), L = LAYOUTS[layout];
    var late = stage === "late", n = late ? 1 : 2;
    var base = { R: R, born: o.born, decades: o.decades, avoid: o.avoid };
    var spec = { layout: layout, title: L.title, stage: stage, subtitle: "", instruction: "", art: null, items: [], lyric: null, pairs: null, closing: "", tips: TIPS[layout].slice(), facts: [] };
    var grab = function (themes, k, pool) { var got = B.pick(Object.assign({}, base, { themes: themes, n: k, pool: pool || layout })); got.forEach(function (e) { spec.facts.push(e.id); }); return got; };

    if (layout === "trace-sing") {
      var ly = grab(["lyric"], 1)[0];
      spec.subtitle = "Trace the picture, then sing along.";
      spec.instruction = "Follow the line with your finger or a thick marker. Then sing the song together.";
      spec.lyric = { lead: ly.lead, end: ly.end };
      spec.art = artFor(o, R, null, false);
      spec.closing = "Sing it again, as softly or as loudly as you like.";
    } else if (layout === "trace-talk") {
      var tk = grab(["movie", "star", "tv", "radio"], late ? 1 : 2, "trace-talk");
      spec.subtitle = "Trace the picture, then talk about it.";
      spec.instruction = "Follow the line with your finger or a thick marker. " + (o.born || (o.decades && o.decades.length) ? "Here is something from the years you were growing up." : "Here is something from years gone by.");
      spec.items = tk.map(function (e) { return { text: B.line(e) }; });
      spec.art = artFor(o, R, null, false);
      spec.closing = "Tell us about one you liked.";
    } else if (layout === "match-color") {
      var pr = grab(["pair"], late ? 3 : stage === "early" ? 4 : 3);
      var left = pr.map(function (e) { return e.pair[0]; }), right = pr.map(function (e) { return e.pair[1]; });
      spec.subtitle = "Match the pairs, then color the picture.";
      spec.instruction = "Draw a line from each word to the one that goes with it. Then color the picture any way you like.";
      spec.pairs = { left: left, right: shuffledOther(right, R), answers: pr.map(function (e) { return e.pair.join(" and "); }) };
      spec.art = artFor(o, R, null, true);
      spec.closing = "";
    } else if (layout === "look-hold") {
      var hh = B.pick(Object.assign({}, base, { themes: ["household"], n: 1, pool: "look-hold", filter: function (e) { return !!e.art; } }))[0]; spec.facts.push(hh.id);
      spec.subtitle = "Look at the picture and think how it feels.";
      spec.instruction = "Trace the outline, then read the line together.";
      spec.items = [{ text: hh.t, sub: hh.x }];
      spec.art = artFor(o, R, hh, false);
      spec.closing = "If you have one nearby, hold it. Tell us what you notice.";
    } else if (layout === "hum-along") {
      var sg = grab(["music", "band"], late ? 2 : 3, "hum-along");
      spec.subtitle = "Hum along with a song from your years.";
      spec.instruction = "Trace the picture while you listen. Hum or tap along with any of these.";
      spec.items = sg.map(function (e) { return { text: B.line(e) }; });
      spec.art = artFor(o, R, null, false);
      spec.closing = "Choose one to hum together.";
    } else {
      var lb = grab(["milestone", "trivia", "place", "slogan"], late ? 2 : 3, "look-back");
      spec.subtitle = "Some things from years gone by.";
      spec.instruction = "Trace the picture while we read these together.";
      spec.items = lb.map(function (e) { return { text: B.line(e) }; });
      spec.art = artFor(o, R, null, false);
      spec.closing = "Tell us what comes to mind.";
    }
    if (spec.facts.some(function (id) { return /^slo-/.test(id); })) spec.review = true;
    return spec;
  }

  /* every word on the resident's page, flattened (for the checks and the avoid filter) */
  function text(spec) {
    var out = [spec.title, spec.subtitle, spec.instruction, spec.closing];
    if (spec.lyric) out.push(spec.lyric.lead + " " + spec.lyric.end);
    (spec.items || []).forEach(function (i) { out.push(i.text, i.sub || ""); });
    if (spec.pairs) out.push(spec.pairs.left.join(" "), spec.pairs.right.join(" "));
    return out.join(" ").replace(/\s+/g, " ").trim();
  }

  var api = { LAYOUTS: LAYOUTS, ORDER: ORDER, TIPS: TIPS, compose: compose, text: text };
  root.CogniHybrid = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
