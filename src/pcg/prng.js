/* =====================================================================
   Cognicopia PCG: the seeded random layer.

   Nothing in the procedural engine uses the browser's own random function. Every choice comes
   from here, from a seed made of the resident's first name and the date,
   so the same resident on the same day always gets the same packet, and
   the next morning's packet is built from a different seed.

   The generator
     cyrb128 turns any text into four 32-bit numbers, and sfc32 turns those
     into a stream of numbers between 0 and 1 (both public domain, by bryc;
     sfc32 passes PractRand and runs in a few nanoseconds). Every page of a
     packet draws from its own stream, forked from the day's seed by name,
     so changing how one page is built never moves another page.

   The daily seed
     name + local date (+ a version number when a second packet for the same
     day is wanted). The day is counted from the calendar date in the
     resident's own time zone, never from a timestamp, so a clock change or
     a trip across midnight UTC cannot move it.

   Seeded rotation (what "fresh" means here)
     Chance alone cannot promise that tomorrow differs from today: a random
     pick repeats about one day in N. Instead each choice that must not
     repeat (the featured item, its companion, the surprise from a
     neighboring interest) walks a shuffled cycle of its pool, one step a
     day. The cycle is re-shuffled when it runs out, and the seam between
     two cycles is mended so an item is never used again within a quarter of
     a cycle of its last use: never the next day, and in a pool of 40 never
     within 11 days. Every item comes up once per cycle. The day number is
     the only state, so there is nothing to store and no history to lose:
     regenerate at 2 PM and the answer is the same as at 8 AM; tomorrow's
     answer is already decided.

   Runs in the browser (window.CognicopiaPCG.prng) and in Node (vm).
   ===================================================================== */
(function (root) {
  "use strict";
  var PCG = root.CognicopiaPCG = root.CognicopiaPCG || {};
  var DAY_MS = 86400000;

  /* ---------- text keys ---------- */
  /* Accents folded, lower case, letters and digits in single spaces. */
  function fold(str){
    var s = String(str == null ? "" : str);
    if (s.normalize) s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/^ +| +$/g, "");
  }
  /* "Margaret", " margaret ", "MARGARET" and "Margarét" are the same resident. */
  function nameKey(first){ return fold(first) || "friend"; }

  /* ---------- the generator ---------- */
  function cyrb128(str){
    var h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762, i, k;
    for (i = 0; i < str.length; i++){
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1;
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  }
  function sfc32(a, b, c, d){
    return function(){
      a |= 0; b |= 0; c |= 0; d |= 0;
      var t = (a + b | 0) + d | 0;
      d = d + 1 | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = (c << 21 | c >>> 11);
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function hash32(str){ return cyrb128(String(str))[0]; }
  function seedInt(str){ return cyrb128(String(str))[1] || 1; }

  /* A stream from a seed. fork(label) is an independent stream from the same seed. */
  function create(seed){
    var key = String(seed), h = cyrb128(key), next = sfc32(h[0], h[1], h[2], h[3]), i;
    for (i = 0; i < 15; i++) next();
    var api = {
      seed: key,
      next: next,
      int: function(n){ return n > 0 ? Math.floor(next() * n) : 0; },
      range: function(a, b){ return a + api.int(b - a + 1); },
      chance: function(p){ return next() < p; },
      pick: function(arr){ return arr.length ? arr[api.int(arr.length)] : undefined; },
      shuffle: function(arr){
        var c = arr.slice(), j, t;
        for (var k = c.length - 1; k > 0; k--){ j = api.int(k + 1); t = c[k]; c[k] = c[j]; c[j] = t; }
        return c;
      },
      sample: function(arr, k){ return api.shuffle(arr).slice(0, Math.max(0, k)); },
      weighted: function(arr, weightOf){
        var total = 0, w = arr.map(function(x){ var v = Math.max(0, +weightOf(x) || 0); total += v; return v; });
        if (!total) return api.pick(arr);
        var r = next() * total;
        for (var k = 0; k < arr.length; k++){ r -= w[k]; if (r < 0) return arr[k]; }
        return arr[arr.length - 1];
      },
      fork: function(label){ return create(key + "/" + label); }
    };
    return api;
  }

  /* ---------- dates ---------- */
  var pad2 = function(n){ return (n < 10 ? "0" : "") + n; };
  var isDate = function(v){ return Object.prototype.toString.call(v) === "[object Date]"; };
  /* A calendar day from a Date (its local parts), "YYYY-MM-DD", {y,m,d}, or nothing (today). */
  function dateParts(d){
    var y, m, dd, mm;
    if (d == null) d = new Date();
    if (typeof d === "string"){
      mm = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
      if (!mm) throw new Error("A date looks like 2026-10-06.");
      y = +mm[1]; m = +mm[2]; dd = +mm[3];
    } else if (isDate(d)){
      if (isNaN(d.getTime())) throw new Error("That date is not a real date.");
      y = d.getFullYear(); m = d.getMonth() + 1; dd = d.getDate();
    } else if (typeof d === "object" && d.y){ y = +d.y; m = +d.m; dd = +d.d; }
    else if (typeof d === "number" && isFinite(d)) return fromDay(Math.floor(d));
    else throw new Error("Unrecognized date.");
    var day = Math.floor(Date.UTC(y, m - 1, dd) / DAY_MS), back = fromDay(day);
    if (back.y !== y || back.m !== m || back.d !== dd) throw new Error("That date does not exist.");
    return { y: y, m: m, d: dd, iso: y + "-" + pad2(m) + "-" + pad2(dd), day: day };
  }
  /* The calendar date of a day number (days since 1970-01-01). */
  function fromDay(day){
    var t = new Date(day * DAY_MS), y = t.getUTCFullYear(), m = t.getUTCMonth() + 1, d = t.getUTCDate();
    return { y: y, m: m, d: d, iso: y + "-" + pad2(m) + "-" + pad2(d), day: day };
  }
  function addDays(parts, n){ return fromDay(parts.day + n); }
  function today(){ return dateParts(new Date()); }

  /* "walter|2026-10-06", or "walter|2026-10-06|v2" for a second packet that day. */
  function dailySeed(first, date, variant){
    var p = dateParts(date), v = variant | 0;
    return nameKey(first) + "|" + p.iso + (v > 0 ? "|v" + v : "");
  }

  /* ---------- seeded rotation ---------- */
  var cache = new Map();
  function rawPerm(key, c, n){
    var ck = key + "#" + c + "#" + n, hit = cache.get(ck);
    if (hit) return hit;
    var a = new Array(n), i;
    for (i = 0; i < n; i++) a[i] = i;
    a = create(ck).shuffle(a);
    if (cache.size > 3000) cache.clear();
    cache.set(ck, a);
    return a;
  }
  /* The cycle's order, mended at the seam. The first h items of a cycle are
     swapped with items from its middle if they were among the last h of the
     cycle before (h is a quarter of the pool, at least 1), so an item never
     comes back sooner than h + 1 days after it was last used. Only the head
     and the middle are ever touched, never the last h items, so the tail of
     any cycle is exactly what its raw shuffle says and no cycle has to be
     computed from another's repairs. */
  function cyclePerm(key, c, n){
    var p = rawPerm(key, c, n), h = n >= 3 ? Math.max(1, Math.floor(n / 4)) : 0;
    if (c > 0 && h){
      var tail = new Set(rawPerm(key, c - 1, n).slice(n - h)), mid = [], i, ci = 0, t;
      p = p.slice();
      for (i = h; i < n - h; i++) if (!tail.has(p[i])) mid.push(i);
      for (i = 0; i < h; i++) if (tail.has(p[i]) && ci < mid.length){ t = p[i]; p[i] = p[mid[ci]]; p[mid[ci]] = t; ci++; }
    }
    return p;
  }
  /* Which of n things to use on day `pos`. Every item comes up once in each
     cycle of n days, an item is never used again within a quarter of a cycle
     of its last use, and day d and day d+1 never agree (for n of at least 2). */
  function rotationIndex(key, n, pos){
    if (n <= 1) return 0;
    pos = Math.floor(pos);
    if (n === 2) return (((pos + (hash32(key) & 1)) % 2) + 2) % 2;
    var c = Math.floor(pos / n), at = ((pos % n) + n) % n;
    return cyclePerm(key, c, n)[at];
  }
  /* k different things for one day, taken from the same walk: day d uses
     steps d*k to d*k+k-1, skipping any repeat where two cycles meet. */
  function rotationWindow(key, n, k, pos){
    var out = [], seen = {}, step = Math.floor(pos) * k, guard = 0;
    k = Math.min(k, n);
    while (out.length < k && guard++ < n * 3){
      var i = rotationIndex(key, n, step++);
      if (!seen[i]){ seen[i] = 1; out.push(i); }
    }
    return out;
  }

  PCG.prng = {
    fold: fold, nameKey: nameKey, cyrb128: cyrb128, sfc32: sfc32, hash32: hash32, seedInt: seedInt, create: create,
    dateParts: dateParts, fromDay: fromDay, addDays: addDays, today: today, dailySeed: dailySeed,
    rotationIndex: rotationIndex, rotationWindow: rotationWindow
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
