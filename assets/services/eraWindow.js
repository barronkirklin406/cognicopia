/* The one era rule (hand-written source with no TypeScript; edit this file directly. It is listed in HAND_WRITTEN in scripts/build-services.mjs,
   so npm run services never builds or overwrites it).

   A person's formative years are the years they were 7 to 28: birth year + 7 to birth year + 28 (.claude/skills/cognicopia-clinical-dignity,
   "Era facts come from the exact birth year"). An event or a fact belongs on a page only if its years fall inside that window, and a childhood
   fact also needs the person to have been old enough to meet it. Every tool asks this module, so the packet tool, the Activity Page Studio,
   the reminiscence engine and the Packet Builder cannot drift apart again.

   windowFor(by)          the window and its three parts: childhood by+7..by+12, teen years by+13..by+20, young adult by+21..by+28
   inWindow(year, by)     is one year inside it
   overlaps(from, to, by) does a span of years (an event that lasted) touch it
   decadesFor(by)         the decades (1940, 1950, ...) that touch it, the one nearest its middle first
   datedOk(text, by)      false when the text names a dated event (ration books, the Beatles, the moon landing) whose years do not touch it;
                          true for everything else, so general flavor words stay
   Years are whole numbers; an unknown birth year returns null / true and the caller keeps its own fallback. */
(function(root){
  "use strict";
  var FROM = 7, TO = 28;

  function num(by){ by = Number(by); return isFinite(by) && by > 1800 ? Math.floor(by) : 0; }
  function windowFor(by){
    by = num(by); if (!by) return null;
    return { from: by + FROM, to: by + TO, childhood: [by + 7, by + 12], teen: [by + 13, by + 20], young: [by + 21, by + 28] };
  }
  function inWindow(year, by){
    var w = windowFor(by); year = Number(year);
    return !!w && isFinite(year) && year >= w.from && year <= w.to;
  }
  function overlaps(from, to, by){
    var w = windowFor(by); if (!w) return false;
    from = Number(from); to = Number(to == null ? from : to);
    return isFinite(from) && isFinite(to) && from <= w.to && to >= w.from;
  }
  function decadesFor(by){
    var w = windowFor(by); if (!w) return [];
    var mid = (w.from + w.to) / 2, out = [];
    for (var d = Math.floor(w.from / 10) * 10; d <= w.to; d += 10) out.push(d);
    return out.sort(function(a, b){ return Math.abs(a + 5 - mid) - Math.abs(b + 5 - mid); });
  }

  /* Dated events the packet's decade lists mention, with the years they were part of everyday life. A line that names one is kept only for a
     person whose window touches those years: a woman born in 1946 does not meet ration books at 8. Only events that clearly end or begin
     are listed; "the radio was the center of the living room" is not, because it does not date a person. */
  var DATED = [
    [/\bration(s|ing| books?)?\b|victory garden/i, 1942, 1947],
    [/\bV-?[EJ] day\b|pearl harbor|\bwar bonds?\b/i, 1941, 1946],
    [/bread lines?|\bthe depression\b|dust bowl/i, 1930, 1940],
    [/newsreel/i, 1930, 1967],
    [/television sets? (were )?arriving|first television|black-and-white television/i, 1948, 1962],
    [/sputnik|space race/i, 1957, 1972],
    [/moon landing|apollo/i, 1966, 1975],
    [/the beatles|beatlemania/i, 1963, 1971],
    [/motown/i, 1960, 1975],
    [/vietnam|civil rights/i, 1955, 1975],
    [/kennedy/i, 1960, 1964],
    [/\bmtv\b|video stores?|arcades?|mixtapes?/i, 1980, 1995],
    [/disco/i, 1974, 1981],
    [/sock hops?/i, 1948, 1965],
    [/jitterbug|big band|swing (and|music|orchestra|dancing)/i, 1936, 1950]
  ];
  function datedOk(text, by){
    var w = windowFor(by); if (!w) return true;
    var t = String(text || "");
    for (var i = 0; i < DATED.length; i++) if (DATED[i][0].test(t) && !(DATED[i][1] <= w.to && DATED[i][2] >= w.from)) return false;
    return true;
  }

  var api = { FROM: FROM, TO: TO, windowFor: windowFor, inWindow: inWindow, overlaps: overlaps, decadesFor: decadesFor, datedOk: datedOk, DATED: DATED };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CogniEra = Object.freeze(api);
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
