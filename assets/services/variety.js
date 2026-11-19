/* The variety memory (hand-written source with no TypeScript; edit this file directly. It is listed in HAND_WRITTEN in
   scripts/build-services.mjs, so npm run services never builds or overwrites it).

   Why: a packet made from the same resident and the same day used to come out the same, and a click that asked for "another" could
   hand back something printed a minute ago. This module gives every click its own seed and remembers, in this browser only, which items
   of each pool were used lately, so nothing comes back until the rest of the pool has had its turn.

   What is kept: the ids of the items used (short text such as "mv-1942-casablanca"), a pool name, and the last seed. Never a name, a
   resident, a profile or anything typed. It lives in localStorage under cognicopia_variety, is never sent anywhere, and falls back to
   memory for the visit when storage is blocked. clear() forgets it (the Settings button and the packet tool's footer call it).

   clickSeed()                      a fresh integer for this click; never equal to the one before it
   take(pool, ids, rng, n, opts)    n different items from pool (ids = a function item -> id, or the string name of the id field),
                                    never one used lately while an unused one remains; with the pool spent a new cycle starts and the
                                    quarter used most recently stays out of its first picks, so a seam never repeats an item
   used(name)  /  clear()           the ids kept for a pool / forget everything */
(function (root) {
  "use strict";
  var KEY = "cognicopia_variety", memory = {}, last = 0, counter = 0;

  function store() { try { return root.localStorage || null; } catch (e) { return null; } }
  function read() {
    var raw = null, s = store();
    try { raw = s ? s.getItem(KEY) : null; } catch (e) { raw = null; }
    if (raw == null) raw = memory[KEY] || null;
    var o = null;
    try { o = raw ? JSON.parse(raw) : null; } catch (e) { o = null; }
    return o && typeof o === "object" && o.pools && typeof o.pools === "object" ? o : { v: 1, pools: {}, last: 0 };
  }
  function write(o) {
    var raw = JSON.stringify(o), s = store();
    memory[KEY] = raw;
    try { if (s) s.setItem(KEY, raw); } catch (e) { /* full or blocked: it is kept for this visit */ }
  }

  function entropy() {
    try {
      if (root.crypto && root.crypto.getRandomValues) { var a = new Uint32Array(1); root.crypto.getRandomValues(a); return a[0] >>> 0; }
    } catch (e) { /* use the clock below */ }
    var t = (root.performance && root.performance.now ? root.performance.now() : 0) * 1000;
    return ((Date.now() % 4294967296) ^ Math.floor(t) ^ Math.imul(++counter, 2654435761)) >>> 0;
  }
  function clickSeed() {
    var o = read(), s = entropy();
    for (var i = 0; i < 8 && (s === last || s === o.last); i++) s = entropy();
    if (s === last || s === o.last) s = (s + 1) >>> 0;
    last = s; o.last = s; write(o);
    return s;
  }

  function idOf(ids, item) { return typeof ids === "function" ? ids(item) : item && item[ids || "id"]; }

  /* n different items, fresh first. R is any generator with pick(list) and shuffle(list). The ids picked are recorded at once, so two
     pools used in one packet cannot hand out the same item twice. */
  function take(pool, ids, R, n, opts) {
    opts = opts || {};
    var name = opts.pool || "default", o = read(), list = Array.isArray(o.pools[name]) ? o.pools[name].slice() : [];
    var ofPool = {}; pool.forEach(function (it) { ofPool[idOf(ids, it)] = 1; });
    list = list.filter(function (id) { return ofPool[id]; });                 // forget ids that left the pool
    var seen = {}; list.forEach(function (id) { seen[id] = 1; });
    var fresh = pool.filter(function (it) { return !seen[idOf(ids, it)]; }), out = [];
    if (!fresh.length && pool.length) {
      /* the pool is spent: a new cycle, keeping the quarter used most recently out of the first picks */
      var keep = Math.floor(list.length / 4), tail = list.slice(list.length - keep);
      list = tail; seen = {}; tail.forEach(function (id) { seen[id] = 1; });
      fresh = pool.filter(function (it) { return !seen[idOf(ids, it)]; });
    }
    var order = R.shuffle(fresh.slice());
    for (var i = 0; i < order.length && out.length < n; i++) out.push(order[i]);
    if (out.length < n) {                                                     // a pool smaller than n: the used ones, oldest first
      var rest = pool.filter(function (it) { return out.indexOf(it) < 0; });
      rest.sort(function (a, b) { return list.indexOf(idOf(ids, a)) - list.indexOf(idOf(ids, b)); });
      for (var j = 0; j < rest.length && out.length < n; j++) out.push(rest[j]);
    }
    if (opts.record !== false) {
      out.forEach(function (it) { var id = idOf(ids, it); list = list.filter(function (x) { return x !== id; }); list.push(id); });
      o.pools[name] = list.slice(-Math.max(8, pool.length));
      write(o);
    }
    return out;
  }
  function used(name) { var l = read().pools[name]; return Array.isArray(l) ? l.slice() : []; }
  function clear() {
    memory = {};
    var s = store(); try { if (s) s.removeItem(KEY); } catch (e) { /* nothing to remove */ }
  }

  var api = { KEY: KEY, clickSeed: clickSeed, take: take, used: used, clear: clear };
  root.CogniVariety = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
