/* The Week Builder's logic (hand-written, no TypeScript; listed in HAND_WRITTEN in scripts/build-services.mjs, so npm run services never overwrites it).

   For one wing and one week it decides, for each resident and each day, which one to three pages to print, and it lists them as a Staff Run Sheet
   (room, name or alias, day, the page titles, and boxes to tick: Offered, Took part, Watched, Declined). It draws nothing and stores nothing: the
   Facility Portal (builder.html) hands it the residents it has read and prints what this module plans.

     a day's theme   Monday music, Tuesday words, Wednesday movement, Thursday numbers and letters, Friday coloring; a second or third page of a day
                     takes another of the six pillars of the Facility Portal, so a resident's day is never two of one kind
     the resident    the activity must suit their level (the Facility Portal's tiers 1 to 3), must not touch a topic they avoid (whole words), and the
                     late stage never gets a word search or a scramble; a page already chosen this week is not chosen again while another fits
     the same week   the same residents, week and settings always plan the same pages; the next week's dates give a different, equally steady plan
     thin data       "X of 8 facts" is carried through so the sheet can say who needs a little more asked of the family; nothing is invented
   The page titles are the Packet Builder's own activity names. Runs in the browser (window.CogniWeek) and in Node (vm). No request, no storage. */
(function (root) {
  "use strict";
  if (root.CogniWeek) return;
  var DAYS = [
    { n: 1, short: "Mon", long: "Monday" }, { n: 2, short: "Tue", long: "Tuesday" }, { n: 3, short: "Wed", long: "Wednesday" },
    { n: 4, short: "Thu", long: "Thursday" }, { n: 5, short: "Fri", long: "Friday" }
  ];
  var THEME = {
    1: { pillar: "music", label: "Music" }, 2: { pillar: "words", label: "Words" }, 3: { pillar: "movement", label: "Movement" },
    4: { pillar: "numbers", label: "Numbers and letters" }, 5: { pillar: "coloring", label: "Coloring" }
  };
  var SECOND = ["coloring", "words", "music", "movement", "letters", "numbers"];
  var LATE_NO = ["word-search", "scramble", "letter-scramble"];            // late stage gets no word search or crossword-style page
  var BOXES = ["Offered", "Took part", "Watched", "Declined"];
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  function parse(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "")); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function addDays(s, n) { var d = parse(s) || new Date(); d.setDate(d.getDate() + n); return iso(d); }
  function mondayOf(s) { var d = parse(s) || new Date(); d.setHours(12); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); }
  function nextWeek(s) { return addDays(mondayOf(s), 7); }
  function datesFor(start, days) {
    var mon = mondayOf(start), want = (days && days.length ? days : [1, 2, 3, 4, 5]).filter(function (n) { return n >= 1 && n <= 5; });
    return want.sort().map(function (n) { return { n: n, date: addDays(mon, n - 1), short: DAYS[n - 1].short, long: DAYS[n - 1].long }; });
  }
  function hash(str) { var h = 2166136261, i; str = String(str); for (i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* the n-th weekday of a month, and the last one */
  function nth(y, m, dow, k) { var d = new Date(y, m, 1, 12); d.setDate(1 + ((dow - d.getDay() + 7) % 7) + (k - 1) * 7); return iso(d); }
  function lastDow(y, m, dow) { var d = new Date(y, m + 1, 0, 12); d.setDate(d.getDate() - ((d.getDay() - dow + 7) % 7)); return iso(d); }
  function easter(y) {                                                  // the usual computus: Western Easter Sunday
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return y + "-" + pad(mo) + "-" + pad(da);
  }
  /* holidays and seasonal days that fall in the week, as suggestions for the person making it (never put on a page without them choosing) */
  function holidays(start) {
    var mon = mondayOf(start), y = +mon.slice(0, 4), out = [], list = [];
    [y - 1, y, y + 1].forEach(function (yy) {
      list.push([yy + "-01-01", "New Year's Day", "A fresh start: songs of the year, hopes and traditions."],
        [yy + "-02-14", "Valentine's Day", "Cards, hearts and the people they love."],
        [yy + "-03-17", "St. Patrick's Day", "Green, music and a little luck."],
        [easter(yy), "Easter", "Spring flowers, baskets and a Sunday best."],
        [nth(yy, 4, 0, 2), "Mother's Day", "Mothers and the things they taught."],
        [lastDow(yy, 4, 1), "Memorial Day", "A quiet day of remembering; only for residents who welcome it."],
        [yy + "-07-04", "Fourth of July", "Parades, picnics and flags."],
        [nth(yy, 8, 1, 1), "Labor Day", "Work they did and were proud of."],
        [yy + "-10-31", "Halloween", "Pumpkins and autumn."],
        [yy + "-11-11", "Veterans Day", "Only for residents whose profile says military service is a welcome topic."],
        [nth(yy, 10, 4, 4), "Thanksgiving", "Family tables, favorite dishes and thankfulness."],
        [yy + "-12-25", "Christmas", "Carols, cards and home."]);
    });
    list.forEach(function (h) { for (var k = 0; k < 7; k++) if (addDays(mon, k) === h[0]) out.push({ date: h[0], name: h[1], idea: h[2] }); });
    return out;
  }

  /* one activity of a pillar for a resident, fresh-first through the week; null when nothing fits */
  function pickActivity(o) {
    var late = o.stageKey === "late", tier = Math.max(1, Math.min(3, o.tier | 0 || 2));
    var pool = (o.catalog || []).filter(function (a) {
      return a.pillar === o.pillar && a.tiers.indexOf(tier) >= 0 && (!o.have || o.have[a.id]) && !(late && LATE_NO.indexOf(a.id) >= 0) && !(o.avoidTest && o.avoidTest([a.name, a.why].join(" ")));
    });
    if (!pool.length) return null;
    var fresh = pool.filter(function (a) { return o.taken.indexOf(a.id) < 0; }), from = fresh.length ? fresh : pool;
    return from[hash(o.seed) % from.length];
  }

  /* o: { residents: [{ id, name, alias, room, tier (1-3), stageKey, avoidTest (text -> true when it must stay off), facts (0-8), adaptation }],
          start (any date in the week), days ([1..5]), perDay (1-3), catalog (the Facility Portal's activities), have ({ id: true } for the ones this page can make) } */
  function plan(o) {
    o = o || {};
    var dates = datesFor(o.start, o.days), per = Math.max(1, Math.min(3, o.perDay | 0 || 1)), rows = [], total = 0;
    (o.residents || []).slice().sort(function (a, b) {
      var ra = String(a.room || ""), rb = String(b.room || "");
      return ra === rb ? String(a.alias || a.name || "").localeCompare(String(b.alias || b.name || "")) : ra.localeCompare(rb, undefined, { numeric: true });
    }).forEach(function (r) {
      var taken = [], days = dates.map(function (d) {
        var pages = [], used = [];
        for (var i = 0; i < per; i++) {
          var pillar = i === 0 ? THEME[d.n].pillar : SECOND[(hash(r.id + "|" + d.date + "|" + i) + i) % SECOND.length], guard = 0;
          while (used.indexOf(pillar) >= 0 && guard++ < 8) pillar = SECOND[(SECOND.indexOf(pillar) + 1) % SECOND.length];
          var a = pickActivity({ catalog: o.catalog, have: o.have, tier: r.tier, pillar: pillar, seed: [r.id, d.date, i, pillar].join("|"), taken: taken, stageKey: r.stageKey, avoidTest: r.avoidTest });
          if (!a) { /* nothing of that pillar fits this resident: try the day's theme, then any pillar */
            for (var k = 0; k < SECOND.length && !a; k++) if (used.indexOf(SECOND[k]) < 0) a = pickActivity({ catalog: o.catalog, have: o.have, tier: r.tier, pillar: SECOND[k], seed: [r.id, d.date, i, "any" + k].join("|"), taken: taken, stageKey: r.stageKey, avoidTest: r.avoidTest });
          }
          if (a) { used.push(a.pillar); taken.push(a.id); pages.push({ activityId: a.id, name: a.name, pillar: a.pillar, minutes: a.minutes, seed: hash([r.id, d.date, a.id, i].join("|")) }); }
        }
        total += pages.length;
        return { date: d.date, n: d.n, short: d.short, long: d.long, pages: pages };
      });
      rows.push({ id: r.id, name: r.name, alias: r.alias, room: r.room || "", tier: r.tier, stageKey: r.stageKey, facts: r.facts == null ? null : r.facts, adaptation: r.adaptation || "", days: days, count: days.reduce(function (n, d) { return n + d.pages.length; }, 0) });
    });
    return { start: mondayOf(o.start), dates: dates, perDay: per, rows: rows, total: total, themes: dates.map(function (d) { return { date: d.date, n: d.n, label: THEME[d.n].label }; }), holidays: holidays(o.start) };
  }

  /* the Staff Run Sheet: one line for each resident and day (day by day, in room order, so a walk down the hall follows the page), with the boxes to tick */
  function runSheetRows(p, name) {
    var out = [];
    p.dates.forEach(function (d) {
      p.rows.forEach(function (r) {
        var day = r.days.filter(function (x) { return x.date === d.date; })[0];
        if (day && day.pages.length) out.push({ date: d.date, day: d.long, short: d.short, room: r.room, who: typeof name === "function" ? name(r) : (r.alias || r.name || ""), titles: day.pages.map(function (x) { return x.name; }) });
      });
    });
    return out;
  }
  function chunk(list, n) { var out = [], i; for (i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out; }

  root.CogniWeek = { DAYS: DAYS, THEME: THEME, BOXES: BOXES, LATE_NO: LATE_NO, mondayOf: mondayOf, nextWeek: nextWeek, addDays: addDays, datesFor: datesFor, holidays: holidays, pickActivity: pickActivity, plan: plan, runSheetRows: runSheetRows, chunk: chunk, hash: hash };
  if (typeof module !== "undefined" && module.exports) module.exports = root.CogniWeek;
})(typeof window !== "undefined" ? window : globalThis);
