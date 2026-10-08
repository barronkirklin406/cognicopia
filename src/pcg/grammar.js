/* =====================================================================
   Cognicopia PCG: the grammar matrices.

   A template is a sentence with slots:
     "Tell me about a time you had to fix a {part} on {a_item}."
   The slots are filled from the item being talked about, so one template
   times every part of every item gives thousands of different sentences:
     {item} {a_item} {the_item} {item_pl}      the item (name, with a/an,
                                               with "the", plural)
     {item2} {a_item2} {the_item2} {item2_pl}  a second item, for comparisons
     {part} {part2} {a_part}                   its parts (part2 differs from part)
     {color} {sight} {sound} {touch} {smell}   what it looks, sounds, feels and
                                               smells like
     {decade} {fact}                           when it was everyday; a true fact
     {name} {they} {them} {their} {they_seem}  the resident (and the verb that
                                               agrees with "she", "he" or "they")
     {page} {word} {moment} {sense_cue}        facts about today's packet
     {praise} {outing}                         any pool in grammar.json
   A capital first letter in a slot capitalizes what fills it.

   A template can only be used where it makes sense: its presume level must
   not exceed what the profile supports for the item, its kinds must include
   the item's kind, and every slot it names must have something to fill it.
   Whatever comes out is checked against the dignity rules in safety.json;
   a sentence that breaks one is never returned.

   Runs in the browser (window.CognicopiaPCG.grammar) and in Node (vm).
   ===================================================================== */
(function (root) {
  "use strict";
  var PCG = root.CognicopiaPCG = root.CognicopiaPCG || {};
  var P = PCG.prng;
  if (!P) throw new Error("Load prng.js before grammar.js.");

  /* ---------- small English ---------- */
  function article(word){
    var w = String(word).trim().toLowerCase();
    if (/^(uni|use|usu|ubiq|eu|one|once)/.test(w)) return "a";
    if (/^(hour|honest|heir|honor)/.test(w)) return "an";
    return /^[aeiou]/.test(w) ? "an" : "a";
  }
  function pluralize(it){
    if (it.plural) return it.plural;
    var parts = it.name.split(" "), last = parts.pop(), p;
    if (/(s|x|z|ch|sh)$/i.test(last)) p = last + "es";
    else if (/[^aeiou]y$/i.test(last)) p = last.slice(0, -1) + "ies";
    else p = last + "s";
    return parts.concat([p]).join(" ");
  }
  var PRONOUN = {
    she: { they: "she", them: "her", their: "her", are: "is", plural: false },
    he: { they: "he", them: "him", their: "his", are: "is", plural: false },
    they: { they: "they", them: "them", their: "their", are: "are", plural: true }
  };
  var MODAL = /^(would|will|can|could|should|might|may|must)$/;
  function conjugate(pr, verb){
    if (verb === "are") return pr.they + " " + pr.are;
    if (MODAL.test(verb) || pr.plural) return pr.they + " " + verb;
    var v = /(s|x|z|ch|sh)$/.test(verb) ? verb + "es" : /[^aeiou]y$/.test(verb) ? verb.slice(0, -1) + "ies" : verb + "s";
    return pr.they + " " + v;
  }
  var wordCount = function(t){ var s = String(t).trim(); return s ? s.split(/\s+/).length : 0; };
  function tidy(s){
    s = s.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  var capFirst = function(s){ return s.charAt(0).toUpperCase() + s.slice(1); };

  /* ---------- the dignity rules ---------- */
  var LINT = new WeakMap();
  function linter(data){
    var l = LINT.get(data);
    if (!l){ l = data.safety.banned.map(function(b){ return { id: b.id, re: new RegExp(b.pattern, b.flags || "") }; }); LINT.set(data, l); }
    return l;
  }
  /* the id of the first rule a text breaks, or "" */
  function lint(text, data){
    var rules = linter(data || PCG.matrix.data()), s = String(text);
    for (var i = 0; i < rules.length; i++) if (rules[i].re.test(s)) return rules[i].id;
    return "";
  }

  /* ---------- slots ---------- */
  var SLOT = /\{([A-Za-z0-9_]+)\}/g;
  var ITEM1 = /^(item|a_item|the_item|item_pl)$/, ITEM2 = /^(item2|a_item2|the_item2|item2_pl)$/;
  var SENSE = /^(color|sight|sound|touch|smell)$/;
  var slotCache = {};
  function slotsOf(text){
    if (slotCache[text]) return slotCache[text];
    var out = [], m, seen = {};
    SLOT.lastIndex = 0;
    while ((m = SLOT.exec(text))){ var k = m[1].toLowerCase(); if (!seen[k]){ seen[k] = 1; out.push(k); } }
    return (slotCache[text] = out);
  }
  function decadeOf(it, era, ix){
    var ds = ix.itemDecades.get(it.id);
    if (!ds || !ds.length) return null;
    var best = ds[0], bw = -1;
    ds.forEach(function(d){ var w = era && era.known ? era.weights[d] : 0; if (w > bw){ bw = w; best = d; } });
    return ix.tags.get(best).label;
  }

  /* The things a template may need. `env` = { data, ix, era, pronoun, name, extra }. */
  function available(slots, it, it2, env){
    for (var i = 0; i < slots.length; i++){
      var k = slots[i];
      if (ITEM1.test(k)){ if (!it) return false; }
      else if (ITEM2.test(k)){ if (!it2) return false; }
      else if (k === "part" || k === "a_part"){ if (!it || it.parts.length < 1) return false; }
      else if (k === "part2"){ if (!it || it.parts.length < 2) return false; }
      else if (SENSE.test(k)){ if (!it || !it.senses[k] || !it.senses[k].length) return false; }
      else if (k === "decade"){ if (!it || !decadeOf(it, env.era, env.ix)) return false; }
      else if (k === "fact"){ if (!it || !it.facts || !it.facts.length) return false; }
      else if (k === "name"){ if (!env.name) return false; }
      else if (k === "they" || k === "them" || k === "their" || /^they_[a-z]+$/.test(k)){ /* always */ }
      else if (k === "page" || k === "word" || k === "moment" || k === "sense_cue" || k === "anchor"){ if (!env.extra || env.extra[k] == null || env.extra[k] === "") return false; }
      else if (!env.data.grammar.pools[k]) return false;
    }
    return true;
  }
  /* Can this template be used for this item, at this level of assumption? */
  function usable(tpl, it, it2, level, env){
    if (tpl.presume != null && tpl.presume > level) return false;
    if (it && tpl.kinds && tpl.kinds.indexOf("*") < 0 && tpl.kinds.indexOf(it.kind) < 0) return false;
    return available(slotsOf(tpl.text), it, it2, env);
  }
  function eligible(list, it, it2, level, env){
    return list.filter(function(t){ return usable(t, it, it2, level, env); });
  }

  /* One expansion: the choices (which part, which color) are drawn from rng and
     remembered, so a slot used twice in a template says the same thing. */
  function expand(text, it, it2, env, rng){
    var memo = {}, pr = PRONOUN[env.pronoun] || PRONOUN.they, ok = true;
    function pickSense(k){ var a = it.senses[k]; return a[rng.int(a.length)]; }
    function resolve(k){
      if (Object.prototype.hasOwnProperty.call(memo, k)) return memo[k];
      var v = null, m;
      switch (k){
        case "item": v = it && it.name; break;
        case "a_item": v = it && article(it.name) + " " + it.name; break;
        case "the_item": v = it && "the " + it.name; break;
        case "item_pl": v = it && pluralize(it); break;
        case "item2": v = it2 && it2.name; break;
        case "a_item2": v = it2 && article(it2.name) + " " + it2.name; break;
        case "the_item2": v = it2 && "the " + it2.name; break;
        case "item2_pl": v = it2 && pluralize(it2); break;
        case "part": v = it && it.parts[rng.int(it.parts.length)]; break;
        case "part2": { var p1 = resolve("part"); var rest = it.parts.filter(function(x){ return x !== p1; }); v = rest[rng.int(rest.length)]; break; }
        case "a_part": { var pp = resolve("part"); v = article(pp) + " " + pp; break; }
        case "decade": v = it && decadeOf(it, env.era, env.ix); break;
        case "fact": v = it && it.facts[rng.int(it.facts.length)]; break;
        case "name": v = env.name; break;
        case "they": v = pr.they; break;
        case "them": v = pr.them; break;
        case "their": v = pr.their; break;
        case "page": case "word": case "moment": case "sense_cue": case "anchor": v = env.extra && env.extra[k] != null ? String(env.extra[k]) : null; break;
        default:
          if (SENSE.test(k)) v = it && it.senses[k] && it.senses[k].length ? pickSense(k) : null;
          else if ((m = /^they_([a-z]+)$/.exec(k))) v = conjugate(pr, m[1]);
          else if (env.data.grammar.pools[k]) v = rng.pick(env.data.grammar.pools[k]);
      }
      memo[k] = v == null ? null : String(v);
      return memo[k];
    }
    var out = String(text).replace(SLOT, function(whole, name){
      var v = resolve(name.toLowerCase());
      if (v == null || v === ""){ ok = false; return ""; }
      return name.charAt(0) !== name.charAt(0).toLowerCase() ? capFirst(v) : v;
    });
    return ok ? tidy(out) : null;
  }

  /* How many different sentences a template can make for an item (the
     product of the choices in its slots): the grammar's own multiplier. */
  function fills(tpl, it, it2, env){
    var n = 1, slots = slotsOf(tpl.text), pools = env.data.grammar.pools;
    slots.forEach(function(k){
      if (k === "part" || k === "a_part") n *= it.parts.length;
      else if (k === "part2") n *= Math.max(1, it.parts.length - 1);
      else if (SENSE.test(k)) n *= it.senses[k].length;
      else if (k === "fact") n *= it.facts.length;
      else if (pools[k]) n *= pools[k].length;
    });
    return n;
  }

  PCG.grammar = {
    article: article, pluralize: pluralize, wordCount: wordCount, tidy: tidy, lint: lint, slotsOf: slotsOf, decadeOf: decadeOf,
    available: available, usable: usable, eligible: eligible, expand: expand, fills: fills, PRONOUN: PRONOUN, conjugate: conjugate
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
