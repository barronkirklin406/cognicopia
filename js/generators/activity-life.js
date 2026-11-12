/* =====================================================================
   The life pages: twelve kinds of page about one person.

   Each is a page of several items (kind "blocks", js/generators/coloring-pipeline.js) made from what the saved
   profile holds, read once by js/residentContext.js and handed in as profile.person. Where the profile is
   silent a page falls back to something any life has, or leaves room to write it in; nothing is guessed about
   a person, and a town's own landmarks are never invented.

     lifestory    My life story: the dated moments of a life in order (their own milestones when the profile has them)
     generations  Family across the generations: parents, me, brothers and sisters, children, grandchildren
     whoswho      Who's who: a frame, a name and how they are related, for the people who are living
     mytrade      My work: the tools of their trade and what each is for
     hometown     Where I come from: the town by name, and the sights and tastes of its region
     songs        Songs of my years: title, artist and year from the years they were 15 to 25
     twenty       The year I turned twenty: what was new, and the sayings of the day
     thennow      Then and now: the old thing and what does its job today
     myday        My day: the steps of a morning and an evening
     dish         A dish I made: what goes in and how it is made (their own dish when the profile has one)
     comfort      What I would like: a few large choices to point to
     wordplay     Word play: two words that make one, a story with gaps, a word ladder

   Every page keeps the studio's rules: the stage decides how much a page holds, nothing quizzes or talks down,
   a topic to avoid stays out (a person the profile says to leave out is left out), and a song's words are never
   printed here. Data: js/generators/activity-life-data.js. Works in the browser and in Node. No network, no storage.
   ===================================================================== */
(function (root) {
  "use strict";
  var E = root.CognicopiaActivityEngine, D = root.CognicopiaLifeData;
  if (!E || !E.register || !D) return;
  var K = E.kit, HOME = "Goal: ";

  /* ---------- helpers ---------- */
  var NOBODY = { name: "", born: 0, youth: null, turnedTwenty: 0, decadeAtTwenty: 0, stage: 0, work: { code: "", label: "", vocation: "", text: "" },
    hometown: { place: "", town: "", state: "", region: "", regionCode: "" },
    family: { partner: [], children: [], grandchildren: [], greatGrandchildren: [], siblings: [], parents: [], otherFamily: [], friends: [], pets: [], others: [], all: [] },
    music: { genres: [], artists: [], favoriteSong: "" }, hobbies: [], interests: [], milestones: [], dish: { name: "", ingredients: [], steps: [] }, comforts: [] };
  var who = function (P) { return P.person || NOBODY; };
  var fewer = function (P) { return K.DEXTERITY[P.dexterity].fewer; };
  var ok = function (t, P) { return !K.avoided(t, P.avoid) && !K.toneProblems(t).length; };
  var keep = function (list, P) { return list.filter(function (x) { return ok(Array.isArray(x) ? x.join(" ") : x, P); }); };
  var take = function (list, n) { return list.slice(0, Math.max(0, n)); };
  var rotate = function (list, by) { if (!list.length) return []; var k = ((by % list.length) + list.length) % list.length; return list.slice(k).concat(list.slice(0, k)); };
  var lower = function (s) { return String(s).charAt(0).toLowerCase() + String(s).slice(1); };
  var names = function (list) { var n = list.slice(0, 3); return n.length < 2 ? n.join("") : n.slice(0, -1).join(", ") + " and " + n[n.length - 1] + (list.length > 3 ? " and the others" : ""); };
  /* a name is a name: it is kept off a page only when the profile says to leave that person out, never for how it sounds
     (a daughter called Honey or a dog called Dear belongs on the page) */
  var people = function (list, P) { return (list || []).filter(function (x) { return x && x.name && !K.avoided(x.name, P.avoid); }); };
  var living = function (list, P) { return people(list, P).filter(function (x) { return !x.passed; }); };
  var sheet = function (module, title, subtitle, blocks, staffNote, more) {
    var sh = { module: module, kind: "blocks", title: title, subtitle: subtitle, blocks: blocks.filter(Boolean), staffNote: HOME + staffNote };
    if (more) Object.keys(more).forEach(function (k) { sh[k] = more[k]; });
    return sh;
  };
  /* how many of something a page holds: more early, fewer late, fewer again for a hand with little control */
  var amount = function (P, early, middle, late) { return K.cut(Math.max(late == null ? 2 : Math.min(2, late), (P.stage === 1 ? early : P.stage === 2 ? middle : late == null ? middle : late) - fewer(P)), P, 2); };
  /* is a whole topic on the list of things to avoid? (the profile's ticked topics arrive as their words) */
  var topicAvoided = function (code, P) { var R = root.CogniResident, ws = R && R.AVOID_TOPIC_WORDS[code]; return !!ws && ws.every(function (w) { return P.avoid.indexOf(w) >= 0; }); };

  /* is this drawing in the coloring library? (a page only asks for a picture that exists) */
  var drawn = function (id) { var M = root.CognicopiaColoringManifest; try { return !!(id && M && M.assets && M.assets().some(function (x) { return x.id === id; })); } catch (e) { return false; } };

  /* ---------- 1. my life story ---------- */
  var WORK_LINE = { homemaker: "Made a home and raised a family", farmer: "Worked the land as a farmer", mechanic: "Worked as a mechanic", teacher: "Worked as a teacher", nurse: "Worked as a nurse",
    doctor: "Worked as a doctor or in health care", office: "Worked in an office", secretary: "Worked as a secretary", bookkeeper: "Kept the books and accounts", factory: "Worked at the factory",
    trades: "Worked in the building trades", carpenter: "Worked as a carpenter", electrician: "Worked in the electrical and plumbing trades", driver: "Worked as a driver", railroad: "Worked on the railroad",
    postal: "Worked for the post office", shop: "Kept a shop", shopkeeper: "Kept a shop", business: "Ran a business", engineer: "Worked as an engineer", cook: "Worked in the kitchen",
    seamstress: "Worked with needle and thread", "police-fire": "Worked in the police or fire service", military: "Served in the military", clergy: "Worked for the church" };
  function workLine(w, P) {
    var line = WORK_LINE[w.work.code] || WORK_LINE[P.vocation] || "";
    if (!line && w.work.label && w.work.code === "other") line = "Worked as " + (/^[aeiou]/i.test(w.work.label) ? "an " : "a ") + lower(w.work.label);
    return line && ok(line, P) ? line : "";
  }
  function placeLine(w) { return w.hometown.town ? w.hometown.town + (w.hometown.state ? ", " + w.hometown.state : "") : ""; }
  function lifeMoments(P) {
    var w = who(P), born = P.born || w.born, out = [], place = placeLine(w), fam = w.family;
    var own = w.milestones.filter(function (m) { return ok(m.text, P); });
    if (own.length >= 2) return { own: true, items: own.slice().sort(function (a, b) { return (a.year || 9999) - (b.year || 9999); }) };
    if (born) out.push({ year: born, text: "Born" + (place && ok(place, P) ? " in " + place : "") });
    else if (place && ok(place, P)) out.push({ year: 0, text: "Grew up in " + place });
    var wl = workLine(w, P); if (wl) out.push({ year: 0, text: wl });
    var mate = people(fam.partner, P)[0]; if (mate) out.push({ year: 0, text: (mate.relation === "spouse" ? "Married " : "Shared life with ") + mate.first });
    var kids = people(fam.children, P); if (kids.length) out.push({ year: 0, text: "Raised " + names(kids.map(function (x) { return x.first; })) });
    var grand = people(fam.grandchildren, P); if (grand.length) out.push({ year: 0, text: "Grandparent to " + names(grand.map(function (x) { return x.first; })) });
    return { own: false, items: out };
  }
  function lifestorySheets(P, r, count) {
    var out = [], life = lifeMoments(P), talk = K.shuffle(keep(D.LIFE_TALK, P), r), most = amount(P, 6, 4);
    for (var s = 0; s < count; s++) {
      var known = life.items.length >= 2, starters = take(rotate(talk, s * 2), P.stage === 1 ? (life.items.length > 4 ? 1 : 2) : 1);
      out.push(known
        ? sheet("lifestory", "My life story", life.own ? "The years, in order" : "Some of the story so far", [
            { kind: "moments", items: take(life.items, most) }, { kind: "starters", items: starters }],
            "a life in order, to read together and add to. " + (life.own ? "These moments were entered in the resident's profile. " : "These lines come from the resident's profile; add dated milestones there to make the page fuller. ") + "Read one line, then wait: the story that follows is the point, and any order they tell it in is welcome.", { personal: true })
        : sheet("lifestory", "My life story", "The chapters, in my own words", [
            { kind: "prompt", text: "Every life has its chapters.", sub: "Tell me yours, one at a time." },
            { kind: "starters", items: take(rotate(D.LIFE_CHAPTERS, s), amount(P, 4, 3)) }],
            "the chapters any life has, to fill in together. Write what the resident says in their own words. Saving a birth year, a hometown and family in their profile fills this page in next time.", { personal: false }));
    }
    return out;
  }

  /* ---------- 2. family across the generations ---------- */
  function generationsSheets(P, r, count) {
    var w = who(P), fam = w.family, first = function (x) { return x.first; }, out = [], talk = K.shuffle(keep(D.FAMILY_TALK, P), r);
    var me = [P.name || w.name || "Me"].concat(people(fam.partner, P).map(first));
    var rows = [
      { label: "My parents", names: people(fam.parents, P).map(first), blanks: 2 },
      { label: P.name || w.name ? "Me" + (me.length > 1 ? " and my " + (people(fam.partner, P)[0].relation === "spouse" ? "husband or wife" : "partner") : "") : "Me", names: me, blanks: 0 },
      { label: "My brothers and sisters", names: people(fam.siblings, P).map(first), blanks: 2 },
      { label: ok("My children", P) ? "My children" : "My sons and daughters", names: people(fam.children, P).map(first), blanks: 3 },   // "children" may itself be a topic to avoid
      { label: "My grandchildren", names: people(fam.grandchildren, P).concat(people(fam.greatGrandchildren, P)).map(first), blanks: 3 }
    ];
    if (P.stage !== 1) rows.splice(2, 1);                                 // the middle stage keeps to the line of descent
    var known = fam.all.length > 0;
    for (var s = 0; s < count; s++) out.push(sheet("generations", "My family", "Across the generations", [
      { kind: "tiers", items: rows.map(function (x) { return { label: x.label, names: take(x.names, 4), more: Math.max(0, x.names.length - 4), blanks: x.names.length ? 0 : x.blanks }; }) },
      P.stage === 1 ? { kind: "starters", items: take(rotate(talk, s), 1) } : null],
      "the family, one generation to a row. " + (known ? "The names come from the resident's profile; an empty box is a name to add together. " : "No family is in the resident's profile yet, so the boxes are there to write in. ") + "Say each name aloud and leave time for the stories; a name that will not come is simply left for later.", { personal: known }));
    return out;
  }

  /* ---------- 3. who's who ---------- */
  var RELATION = { spouse: "Married to me", partner: "My partner", son: "My son", daughter: "My daughter", grandchild: "My grandchild", "great-grandchild": "My great-grandchild", sibling: "My brother or sister",
    parent: "My mother or father", "other-family": "Family", friend: "My friend", neighbor: "My neighbor", "pet-dog": "My dog", "pet-cat": "My cat", "pet-other": "My pet" };
  function whoswhoSheets(P, r, count) {
    var w = who(P), fam = w.family, per = P.stage === 1 ? 6 : P.stage === 2 ? 4 : 2, out = [], talk = K.shuffle(keep(D.WHO_TALK, P), r);
    var order = living(fam.partner, P).concat(living(fam.children, P), living(fam.grandchildren, P), living(fam.greatGrandchildren, P), living(fam.siblings, P), living(fam.otherFamily, P), living(fam.friends, P), living(fam.pets, P), living(fam.others, P));
    if (P.stage !== 3 && fewer(P)) per -= 2;
    per = Math.max(2, per);
    for (var s = 0; s < count; s++) {
      var mine = order.slice(s * per, s * per + per);
      if (!mine.length && order.length) mine = take(rotate(order, s), per);
      if (mine.length && mine.length < per && order.length >= per) mine = mine.concat(order.slice(0, per - mine.length));   // a last page that would be short is filled from the top of the list
      /* a person's sealed picture, when the page that asked has opened it (profile.person.photos: the picture's name -> its data) */
      var pics = w.photos || {};
      var frames = mine.length ? mine.map(function (x) { return { name: x.name, sub: RELATION[x.relation] || x.relationLabel || "", photo: (x.photo && pics[x.photo]) || "" }; })
        : Array.apply(null, Array(per)).map(function () { return { name: "", sub: "", hint: "A photo or a name" }; });
      out.push(sheet("whoswho", P.stage === 3 ? "My people" : "The people in my life", mine.length ? "Who is who" : "A page to fill in together", [
        { kind: "frames", items: frames }, P.stage === 3 ? null : { kind: "starters", items: take(rotate(talk, s), 1) }],
        "the people a visit might bring, each with a name and how they belong. " + (mine.length ? "The names come from the resident's profile (only people who are living are shown here). A photo saved in the profile is printed in its frame; an empty frame is for one taped in. " : "No one is in the resident's profile yet: tape in photos and write the names together. ") + "Use it before a visit and during one. Say who each person is; never ask the resident to say it.", { personal: mine.length > 0 }));
    }
    return out;
  }

  /* ---------- 4. my work ---------- */
  function mytradeSheets(P, r, count) {
    /* a trade that is itself a topic the resident avoids (nursing for someone who avoids illness and hospitals, driving for
       someone who avoids the subject of driving) is not opened up: the page asks about a working life in general */
    var TOPIC_OF = { nurse: "medical", driver: "driving" };
    var T = TOPIC_OF[P.vocation] && topicAvoided(TOPIC_OF[P.vocation], P) ? null : D.TRADES[P.vocation], out = [];
    for (var s = 0; s < count; s++) {
      if (!T) {
        out.push(sheet("mytrade", "My work", "The work of a lifetime", [
          { kind: "prompt", text: rotate(keep(D.WORK_TALK, P), s)[0] || "Tell me about the work you did.", sub: "Any part of it is welcome." },
          { kind: "starters", items: take(rotate(["The work I did was", "What I liked about it was", "The people I worked with were"], s), amount(P, 2, 1)) }],
          "talking about a working life. Choosing the resident's former work in their profile (or in the form) turns this into a page about the tools of their own trade.", { personal: false }));
        continue;
      }
      var tools = K.shuffle(keep(T.tools, P), r), talk = rotate(keep(T.talk, P), s), n = amount(P, 5, 3), mine = take(tools, n), title = "My work: " + T.place;
      if (s % 2 === 0) {
        var right = K.shuffle(mine.map(function (x) { return x[1]; }), r);
        out.push(sheet("mytrade", title, "The tools, and what each one does", [
          talk[0] ? { kind: "prompt", text: talk[0] } : null,
          { kind: "pairs", label: "Draw a line from each tool to its job", left: mine.map(function (x) { return x[0]; }), right: right }],
          "the tools of the resident's own trade. They know this better than anyone here: let them teach it. A line drawn anywhere is a reason to talk, not a mark to correct.",
          { personal: true, keyLines: mine.map(function (x) { return x[0] + ": " + x[1]; }) }));
      } else {
        out.push(sheet("mytrade", title, "The tools of the work", [
          { kind: "list", label: "Tick the ones you used", items: mine.map(function (x) { return x[0]; }) },
          { kind: "starters", items: take(rotate(["The tool I reached for most was", "The hardest part of the job was", "The best part of the job was"], s), 1) }],
          "the tools of the resident's own trade. Read each one aloud; a nod, a story or a correction is all welcome.", { personal: true }));
      }
    }
    return out;
  }

  /* ---------- 5. where I come from ---------- */
  function regionOf(w) {
    if (D.REGIONS[w.hometown.regionCode]) return w.hometown.regionCode;
    var st = String(w.hometown.state || "").trim().toLowerCase(), code = "";
    if (st) Object.keys(D.STATES).forEach(function (c) { if (!code && D.STATES[c].some(function (x) { return x.toLowerCase() === st; })) code = c; });
    if (!code && root.CogniReminiscence && w.hometown.place) { try { var p = root.CogniReminiscence.placeOf(w.hometown.place); if (p && p.region && D.REGIONS[p.region.code]) code = p.region.code; } catch (e) { /* the place stays unplaced */ } }
    return code;
  }
  function hometownSheets(P, r, count) {
    var w = who(P), town = w.hometown.town && ok(w.hometown.town, P) ? w.hometown.town : "", code = regionOf(w), bits = D.REGIONS[code] || D.ANYWHERE, out = [];
    var sights = K.shuffle(keep(bits.sights, P), r), tastes = K.shuffle(keep(bits.tastes, P), r), talk = K.shuffle(keep(D.HOME_TALK, P), r), n = P.stage === 3 ? 2 : amount(P, 4, 4);
    for (var s = 0; s < count; s++) {
      var food = s % 2 === 1 && tastes.length >= 2, options = take(rotate(food ? tastes : sights, s), n);
      out.push(sheet("hometown", town || "Where I come from", town ? "Where I come from" : "The place I grew up", [
        { kind: "prompt", text: town ? "Tell me about " + town + "." : "Tell me about the place you grew up.", sub: P.stage === 3 ? "" : "Any part of it is welcome." },
        { kind: "choices", label: food ? "Which of these would you like on the table?" : "Which of these feels like home?", options: options },
        P.stage === 1 ? { kind: "starters", items: take(rotate(talk, s), 1) } : null],
        "the place the resident comes from. " + (town ? "The town's name is from their profile; " : "No hometown is in their profile yet; ") + (D.REGIONS[code] ? "the sights and tastes are well-known ones of that part of the country, not of the town itself. " : "the choices are ones any hometown has. ") + "Circle whatever they choose and ask about it. There is no right choice.",
        { personal: !!town }));
    }
    return out;
  }

  /* ---------- 6. songs of my years ---------- */
  function songsFor(P) {
    var w = who(P), born = P.born || w.born, from = born ? born + 15 : P.decade, to = born ? born + 25 : P.decade + 9;
    var all = ((root.CogniReminiscence && root.CogniReminiscence.SONGS) || []).concat(D.SONGS).filter(function (s) {
      return s.year > 1900 && ok(s.title + " " + s.artist, P) && !(s.avoid || []).some(function (c) { return topicAvoided(c, P); });
    });
    var pick = function (pad) { return all.filter(function (s) { return s.year >= from - pad && s.year <= to + pad; }); };
    var list = pick(0); if (list.length < 4) list = pick(4); if (list.length < 4) list = pick(10);
    var fav = w.music.artists.map(function (a) { return a.toLowerCase(); });
    return { from: from, to: to, songs: list, favorite: function (s) { return fav.some(function (a) { return a && s.artist.toLowerCase().indexOf(a) >= 0; }); } };
  }
  function songsSheets(P, r, count) {
    var S = songsFor(P), pool = K.shuffle(S.songs, r), out = [], line = function (s) { return s.title + ", " + s.artist + " (" + s.year + ")"; };
    pool = pool.filter(S.favorite).concat(pool.filter(function (s) { return !S.favorite(s); }));
    var n = amount(P, 5, 4), span = S.from + " to " + S.to;
    for (var s = 0; s < count; s++) {
      var mine = take(rotate(pool, s * n), P.stage === 3 ? 1 : n);
      if (!mine.length) break;
      out.push(P.stage === 3
        ? sheet("songs", "A song of my years", String(mine[0].year), [{ kind: "prompt", text: mine[0].title, sub: mine[0].artist + ". Let's listen together." }],
            "one song from the years the resident was young. Play it if you can, and simply be there: humming, tapping or a still, listening face are all taking part.", { personal: !!(P.born || who(P).born) })
        : sheet("songs", "Songs of my years", span, [
            { kind: "list", label: "Tick the ones you would like to hear", items: mine.map(line) },
            { kind: "starters", items: take(rotate(["A song I never tire of is", "A song we danced to was", "The radio was always tuned to"], s), 1) }],
            "songs from the years the resident was 15 to 25, when music tends to stay with a person. Play one if you can. Titles, artists and years are printed; a song's words are not, because these songs are still in copyright.", { personal: !!(P.born || who(P).born) }));
    }
    return out;
  }

  /* ---------- 7. the year I turned twenty ---------- */
  function twentySheets(P, r, count) {
    var w = who(P), born = P.born || w.born, year = born ? born + 20 : P.decade + 5, decade = Math.max(1940, Math.min(1980, Math.floor(year / 10) * 10)), out = [];
    var EV = (E.PUBLIC_DOMAIN && E.PUBLIC_DOMAIN.events) || [], near = function (pad) { return EV.filter(function (e) { return Math.abs(e.y - year) <= pad && ok(e.t, P); }); };
    var events = near(3); if (events.length < 3) events = near(6); if (events.length < 3) events = near(10);
    events = events.slice().sort(function (a, b) { return a.y - b.y; });
    var says = K.shuffle(keep(D.SAYINGS[decade] || [], P), r), nE = amount(P, 4, 3), nS = amount(P, 4, 3);
    for (var s = 0; s < count; s++) {
      var mine = take(rotate(says, s * nS), nS), ev = take(rotate(events, s), nE).sort(function (a, b) { return a.y - b.y; });
      var blocks = [{ kind: "moments", items: ev.map(function (e) { return { year: e.y, text: e.t }; }) }];
      if (P.stage === 1 && mine.length >= 2) blocks.push({ kind: "pairs", label: "Sayings of the day: draw a line to what each one meant", left: mine.map(function (x) { return x[0]; }), right: K.shuffle(mine.map(function (x) { return x[1]; }), r) });
      else if (mine.length) blocks.push({ kind: "list", label: "Sayings of the day", items: mine.map(function (x) { return "“" + x[0] + "” meant " + x[1]; }) });
      out.push(sheet("twenty", born ? "The year I turned twenty" : "When I was about twenty", born ? String(year) : "The " + decade + "s", blocks,
        "the world as it was when the resident was about twenty. Read a line and ask what they were doing then; say a saying aloud and enjoy it together. " + (born ? "" : "A birth year in the profile sets this page to their own year. "),
        { personal: !!born, keyLines: P.stage === 1 ? mine.map(function (x) { return x[0] + ": " + x[1]; }) : null }));
    }
    return out;
  }

  /* ---------- 8. then and now ---------- */
  function thennowSheets(P, r, count) {
    var pool = K.shuffle(keep(D.THEN_NOW.map(function (x) { return [x[0], x[1], x[2]]; }), P), r), n = amount(P, 5, 3), out = [];
    for (var s = 0; s < count; s++) {
      var mine = take(rotate(pool, s * n), n), withPic = mine.filter(function (x) { return drawn(x[2]); })[0];
      out.push(sheet("thennow", "Then and now", "Draw a line from the old to the new", [
        withPic && P.stage === 1 ? { kind: "picture", pic: withPic[2], caption: withPic[0] } : null,
        { kind: "pairs", left: mine.map(function (x) { return x[0]; }), right: K.shuffle(mine.map(function (x) { return x[1]; }), r) },
        !withPic || P.stage !== 1 ? { kind: "starters", items: take(rotate(D.THEN_TALK, s), 1) } : null],
        "everyday things as they were and as they are. The old thing is the one the resident knows best: ask how it worked, who used it, where it stood in the house.",
        { personal: false, keyLines: mine.map(function (x) { return x[0] + ": " + x[1]; }) }));
    }
    return out;
  }

  /* ---------- 9. my day ---------- */
  function mydaySheets(P, r, count) {
    var out = [], parts = ["morning", "evening"];
    for (var s = 0; s < count; s++) {
      var part = parts[s % 2], day = D.DAY[part], steps = keep(day.steps, P), n = Math.max(3, (P.stage === 2 ? 5 : 3) - fewer(P)), pickSteps = steps.length > n ? [steps[0]].concat(take(rotate(steps.slice(1, -1), Math.floor(s / 2)), n - 2).sort(function (a, b) { return steps.indexOf(a) - steps.indexOf(b); }), [steps[steps.length - 1]]) : steps;
      out.push(sheet("myday", day.title, "One step at a time", [
        drawn(day.pic) ? { kind: "picture", pic: day.pic } : null,
        { kind: "steps", items: pickSteps },
        P.stage === 2 && !fewer(P) && !drawn(day.pic) ? { kind: "choices", label: part === "morning" ? "This morning I would like" : "This evening I would like", options: take(keep(D.DAY_CHOICES[part], P), 4) } : null],
        "the steps of a " + part + ", in order, to follow together. Point to one step at a time and do it side by side; the resident sets the pace. Keep the same page by the bed so the order becomes familiar.", { personal: false }));
    }
    return out;
  }

  /* ---------- 10. a dish I made ---------- */
  function dishSheets(P, r, count) {
    var w = who(P), code = regionOf(w), own = w.dish && w.dish.name && ok(w.dish.name, P) ? w.dish : null, out = [];
    var usable = D.DISHES.filter(function (d) { return ok(d.name + " " + d.ingredients.join(" ") + " " + d.steps.join(" "), P); });
    var local = K.shuffle(usable.filter(function (d) { return d.regions.indexOf(code) >= 0; }), r), rest = K.shuffle(usable.filter(function (d) { return d.regions.indexOf(code) < 0; }), r);
    var list = (own ? [own] : []).concat(local, rest), nI = amount(P, 5, 4), nS = amount(P, 4, 3);
    for (var s = 0; s < count && s < list.length; s++) {
      var d = list[s], mine = d === own, ing = keep(d.ingredients || [], P), steps = keep(d.steps || [], P);
      out.push(sheet("dish", d.name, mine ? "A dish from my own kitchen" : "What goes in, and how it is made", [
        ing.length >= 2 ? { kind: "list", label: "What goes in", items: take(ing, nI) } : { kind: "write", label: "What goes in", lines: 2 },
        steps.length >= 2 ? { kind: "steps", label: "How it is made", items: take(steps, nS) } : { kind: "write", label: "How it is made", lines: P.stage === 1 ? 3 : 2 },
        P.stage === 1 && ing.length >= 2 && steps.length >= 2 ? { kind: "starters", items: take(rotate(D.DISH_TALK, s), 1) } : null],
        (mine ? "the resident's own dish, from their profile. " : "a dish many kitchens knew" + (d.regions.indexOf(code) >= 0 ? ", at home in the part of the country they come from. " : ". ")) + "Cooking is remembered in the hands: ask them to show a step, or to say what they would do differently. Their way is the right way.",
        { personal: mine }));
    }
    return out;
  }

  /* ---------- 11. what I would like ---------- */
  function comfortSheets(P, r, count) {
    var w = who(P), mine = keep(w.comforts || [], P), groups = (mine.length >= 2 ? [{ label: "Things I like", options: mine, own: true }] : []).concat(D.COMFORTS), out = [], n = P.stage === 3 ? 2 : fewer(P) ? 3 : 4;
    for (var s = 0; s < count; s++) {
      var g = groups[s % groups.length], turn = Math.floor(s / groups.length), options = take(rotate(keep(g.options, P), turn * n), n);
      if (options.length < 2) continue;
      out.push(sheet("comfort", "What I would like", g.label, [{ kind: "choices", cols: 1, options: options }],
        "a way to choose without having to find the words. Hold the page where it is easy to see, name each choice slowly and wait: a look, a reach or a nod is an answer. Then do the thing they chose." + (g.own ? " These are the resident's own likes, from their profile." : ""),
        { personal: !!g.own }));
    }
    return out;
  }

  /* ---------- 12. word play ---------- */
  function ideaFor(kind, P) {
    var w = who(P), fam = w.family;
    if (kind === "person") { var p = living(fam.children, P).concat(living(fam.grandchildren, P), living(fam.siblings, P), living(fam.friends, P))[0]; return p ? p.first : ""; }
    if (kind === "pet") { var pet = living(fam.pets, P)[0]; return pet ? pet.first : ""; }
    if (kind === "place") return w.hometown.town && ok(w.hometown.town, P) ? w.hometown.town : "";
    if (kind === "song") return w.music.favoriteSong && ok(w.music.favoriteSong, P) ? w.music.favoriteSong : "";
    return "";
  }
  function ladderFor(P, r, turn) {
    var w = who(P), mine = (P.interests || []).concat(P.vocation ? [P.vocation] : [], (w.hobbies || []).map(function (h) { return String(h).toLowerCase(); }), (w.interests || []).map(function (h) { return String(h).toLowerCase(); }));
    var usable = D.LADDERS.filter(function (l) { return l.rungs.every(function (x) { return ok(x[0] + " " + x[1], P); }); });
    var own = usable.filter(function (l) { return l.tags.some(function (t) { return mine.some(function (m) { return m === t || m.indexOf(t) === 0; }); }); });
    var order = own.concat(K.shuffle(usable.filter(function (l) { return own.indexOf(l) < 0; }), r));
    return order.length ? { ladder: order[turn % order.length], own: own.indexOf(order[turn % order.length]) >= 0 } : null;
  }
  function wordplaySheets(P, r, count) {
    var out = [], kinds = P.stage === 1 ? ["compound", "story", "ladder"] : ["compound"], comp = K.shuffle(keep(D.COMPOUNDS, P), r), stories = K.shuffle(D.STORIES.filter(function (st) { return ok(st.title + " " + st.text, P); }), r), n = amount(P, 5, 3);
    for (var s = 0; s < count; s++) {
      var kind = kinds[s % kinds.length], turn = Math.floor(s / kinds.length);
      if (kind === "story" && !stories.length) kind = "compound";
      if (kind === "compound") {
        var mine = take(rotate(comp, turn * n), n);
        out.push(sheet("wordplay", "Two words make one", "Draw a line to join them", [
          { kind: "pairs", left: mine.map(function (x) { return x[0].toUpperCase(); }), right: K.shuffle(mine.map(function (x) { return x[1].toUpperCase(); }), r) },
          { kind: "write", label: "One more that comes to mind", lines: P.stage === 1 ? 1 : 2 }],
          "two small words that join into one. Say the pair aloud together when it clicks. More than one joining can make a real word; any real word is welcome.",
          { personal: false, keyLines: mine.map(function (x) { return (x[0] + x[1]).toUpperCase(); }) }));
      } else if (kind === "story") {
        var st = stories[turn % stories.length], personal = false;
        var blanks = st.blanks.map(function (b) { var idea = ideaFor(b[1], P); if (idea) personal = true; return b[0] + (idea ? ", perhaps " + idea : ""); });
        out.push(sheet("wordplay", st.title, "Choose the words first, then read the story", [
          { kind: "blanks", items: blanks }, { kind: "prompt", text: st.text }],
          "a story with gaps, for a laugh. Ask for each word and write it on its line, then read the story aloud with the words in. The sillier the better; nothing here has a right answer.", { personal: personal }));
      } else {
        var L = ladderFor(P, r, turn);
        if (!L) { s--; kinds = ["compound"]; continue; }
        out.push(sheet("wordplay", "Word ladder", "Change one letter on each step", [{ kind: "ladder", rungs: L.ladder.rungs.map(function (x) { return { word: x[0], clue: x[1] }; }) }],
          "a ladder of words: each step changes one letter of the word above it, and the clue says what the new word is. Work down together. " + (L.own ? "This ladder ends on a word from the resident's own interests." : ""),
          { personal: L.own, keyLines: L.ladder.rungs.map(function (x) { return x[0]; }) }));
      }
    }
    return out;
  }

  E.register("lifestory",   { code: "LS", label: "My life story",                 stages: [1, 2],    build: lifestorySheets,   max: function () { return 3; } });
  E.register("generations", { code: "FG", label: "Family across the generations", stages: [1, 2],    build: generationsSheets, max: function () { return 2; } });
  E.register("whoswho",     { code: "WW", label: "Who's who",                     stages: [1, 2, 3], build: whoswhoSheets,     max: function () { return 3; } });
  E.register("mytrade",     { code: "MW", label: "My work and its tools",         stages: [1, 2],    build: mytradeSheets,     max: function () { return 4; } });
  E.register("hometown",    { code: "HT", label: "Where I come from",             stages: [1, 2, 3], build: hometownSheets,    max: function () { return 4; } });
  E.register("songs",       { code: "SG", label: "Songs of my years",             stages: [1, 2, 3], build: songsSheets,       max: function () { return 4; } });
  E.register("twenty",      { code: "TW", label: "The year I turned twenty",      stages: [1, 2],    build: twentySheets,      max: function () { return 3; } });
  E.register("thennow",     { code: "TN", label: "Then and now",                  stages: [1, 2],    build: thennowSheets,     max: function () { return 4; } });
  E.register("myday",       { code: "MD", label: "My day, step by step",          stages: [2, 3],    build: mydaySheets,       max: function () { return 4; } });
  E.register("dish",        { code: "DS", label: "A dish I made",                 stages: [1, 2],    build: dishSheets,        max: function () { return 6; } });
  E.register("comfort",     { code: "CF", label: "What I would like",             stages: [2, 3],    build: comfortSheets,     max: function () { return 5; } });
  E.register("wordplay",    { code: "WP", label: "Word play",                     stages: [1, 2],    build: wordplaySheets,    max: function () { return 6; } });

  /* which of these pages a person's profile can make its own, best first: the suggested packet leans on them */
  E.lifePagesFor = function (profile) {
    var P = E.normalize(profile), w = who(P), fam = w.family, out = [];
    var has = { born: !!(P.born || w.born), town: !!w.hometown.town, family: fam.all.length > 0, work: !!D.TRADES[P.vocation], dish: !!(w.dish && w.dish.name), comforts: (w.comforts || []).length >= 2, milestones: (w.milestones || []).length >= 2 };
    var want = P.stage === 1 ? [["lifestory", has.milestones || has.born], ["generations", has.family], ["mytrade", has.work], ["hometown", has.town], ["songs", has.born], ["twenty", has.born], ["dish", has.dish], ["whoswho", has.family]]
      : P.stage === 2 ? [["whoswho", has.family], ["songs", has.born], ["hometown", has.town], ["mytrade", has.work], ["lifestory", has.milestones || has.born], ["dish", has.dish], ["comfort", has.comforts]]
      : [["whoswho", has.family], ["comfort", true], ["songs", has.born], ["hometown", has.town]];
    want.forEach(function (x) { if (x[1]) out.push(x[0]); });
    return out;
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
