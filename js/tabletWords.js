/* =====================================================================
   Cognicopia Tablet Activities: words and letters.

   Word Search, Crossword, Spell It and Finish the Saying. Each registers
   itself with the kit (js/tabletKit.js) and is started by the screen
   (js/tablet.js) with a root element, the choices, and an api.

   Big letters and big targets (72 px on a tablet), calm feedback, and a
   way through for everyone: a letter that is not the one floats back with
   a soft note, the right place glows after a quiet moment, and Finish for
   me completes the activity. Nothing is scored or timed.
   ===================================================================== */
(function () {
  "use strict";
  var Kit = window.CognicopiaTabletKit, T = window.CognicopiaTablet, Art = window.CognicopiaTabletArt;
  if (!Kit || !T) return;
  var h = Kit.h, esc = Kit.esc, reduced = Kit.reduced, cap = Kit.cap;
  var $ = function (id) { return document.getElementById(id); };
  var tbt = function () { return parseFloat(getComputedStyle($("tb")).getPropertyValue("--tbt")) || 72; };
  var BACKSPACE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5h11v14H9l-6-7z"/><path d="M12 9l5 6M17 9l-5 6"/></svg>';

  /* a keyboard of large keys, letters in order so nothing has to be learned */
  function keyboard(onLetter, onBack) {
    var kb = h("div", "tb-kb"); kb.setAttribute("role", "group"); kb.setAttribute("aria-label", "Letters");
    Kit.LETTERS.forEach(function (L) { var b = h("button", "tb-key", L); b.type = "button"; b.setAttribute("data-k", L); kb.appendChild(b); });
    var back = h("button", "tb-key wide", BACKSPACE + "<span>Back</span>"); back.type = "button"; back.setAttribute("data-k", "BACK"); back.setAttribute("aria-label", "Take back a letter"); kb.appendChild(back);
    kb.addEventListener("click", function (e) { var b = e.target.closest("[data-k]"); if (!b) return; var k = b.getAttribute("data-k"); if (k === "BACK") onBack(); else onLetter(k); });
    return kb;
  }
  function wordKeys(onLetter, onBack) {
    return function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); onLetter(e.key.toUpperCase()); }
      else if (e.key === "Backspace") { e.preventDefault(); onBack(); }
    };
  }

  /* ===================== WORD SEARCH ===================== */
  function wordSearch(root, o, api) {
    var prefs = api.prefs, sizeNow = prefs.grid || 0, ws = null, found = {}, pending = null, down = null, moved = false, path = [], nFound = 0, colorIx = 0;
    var split = h("div", "tb-split tb-wssplit"), grid = h("div", "tb-grid"), side = h("div", "tb-side tb-wsside");
    var msgEl = h("p", "tb-msg", ""); msgEl.id = "tbWsMsg";
    function fitSize() {
      var a = api.area(), per = tbt() + 3;
      return Math.max(3, Math.min(6, Math.floor((a.w - 20) / per)));
    }
    function make() {
      ws = T.wordSearch({ stage: o.stage, topic: o.topic, seed: o.seed, avoid: o.avoid, size: sizeNow || 0, fit: { size: fitSize() } });
      if (!ws) { root.innerHTML = '<p class="tb-big">No puzzle this time. Choose Next.</p>'; return false; }
      api.used([ws.pack]); return true;
    }
    if (!make()) return;
    var n = ws.size, cellAt = function (rc) { return grid.querySelector('[data-r="' + rc[0] + '"][data-c="' + rc[1] + '"]'); };

    function build() {
      n = ws.size; found = {}; pending = null; down = null; path = []; nFound = 0; colorIx = 0;
      grid.innerHTML = ""; grid.style.setProperty("--n", n);
      grid.setAttribute("role", "grid"); grid.setAttribute("aria-label", "Letter grid, " + n + " by " + n + ". Slide along a word, or tap its first letter, then its last.");
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
        var cell = h("div", "tb-cell", ws.rows[r].charAt(c)); cell.setAttribute("role", "gridcell"); cell.setAttribute("data-r", r); cell.setAttribute("data-c", c); grid.appendChild(cell);
      }
      side.innerHTML = '<h3 class="tb-h">' + esc(ws.topicLabel) + '</h3><p class="tb-sub">Find these words</p><ul class="tb-words">' +
        ws.words.map(function (w) { return '<li><button type="button" class="tb-wd" data-w="' + w + '"><span class="tb-tick" aria-hidden="true"></span><span>' + w + "</span></button></li>"; }).join("") +
        '</ul><div class="tb-sizer" role="group" aria-label="Grid size"><button type="button" class="tb-btn" data-grid="-1" aria-label="A smaller grid">−</button><span id="tbGridN">' + n + " × " + n + '</span><button type="button" class="tb-btn" data-grid="1" aria-label="A bigger grid">+</button></div>';
      /* at the smallest or largest grid the matching button rests */
      side.querySelector('[data-grid="-1"]').disabled = n <= 3; side.querySelector('[data-grid="1"]').disabled = n >= Math.min(6, fitSize());
      msgEl.textContent = "Slide your finger along a word, or tap its first letter and then its last letter.";
      api.progress("0 of " + ws.words.length + " found"); size();
    }
    side.appendChild(h("div", "")); split.appendChild(grid); split.appendChild(side); root.appendChild(split); root.appendChild(msgEl);
    function size() {
      var a = api.area(), portrait = a.w < a.h * 1.1, side_w = portrait ? 0 : 330, gw = a.w - side_w - (portrait ? 0 : 24), gh = portrait ? a.h - 360 : a.h - 70;
      var cell = Math.floor(Math.min(gw / n, gh / n)) - 3;
      grid.style.setProperty("--cell", Math.max(tbt(), Math.min(120, cell)) + "px");
    }
    var fromPoint = function (x, y) { var e = document.elementFromPoint(x, y); e = e && e.closest ? e.closest(".tb-cell") : null; return e && grid.contains(e) ? [+e.getAttribute("data-r"), +e.getAttribute("data-c")] : null; };
    function line(p, q) {
      var dr = q[0] - p[0], dc = q[1] - p[1];
      if (!dr && !dc) return [p];
      var k = Math.round(Math.atan2(dr, dc) / (Math.PI / 4)), sr = Math.round(Math.sin(k * Math.PI / 4)), sc = Math.round(Math.cos(k * Math.PI / 4)), len = Math.max(Math.abs(dr), Math.abs(dc)), out = [];
      for (var i = 0; i <= len; i++) { var rr = p[0] + sr * i, cc = p[1] + sc * i; if (rr < 0 || cc < 0 || rr >= n || cc >= n) break; out.push([rr, cc]); }
      return out;
    }
    function paint(p) {
      Array.prototype.forEach.call(grid.querySelectorAll(".is-sel"), function (x) { x.classList.remove("is-sel"); });
      (p || []).forEach(function (rc) { var e = cellAt(rc); if (e) { e.classList.remove("is-fade"); e.classList.add("is-sel"); } });
      path = p || [];
    }
    function mark(rc) { Array.prototype.forEach.call(grid.querySelectorAll(".is-start"), function (x) { x.classList.remove("is-start"); }); if (rc) { var e = cellAt(rc); if (e) e.classList.add("is-start"); } }
    function wordCells(p) { var out = [], k; for (k = 0; k < p.word.length; k++) out.push([p.r + p.dy * k, p.c + p.dx * k]); return out; }
    function tryWord(p) {
      var letters = p.map(function (rc) { return ws.rows[rc[0]].charAt(rc[1]); }).join(""), back = letters.split("").reverse().join(""), hit = null;
      ws.words.forEach(function (w) { if (!hit && !found[w] && (w === letters || w === back)) hit = w; });
      if (hit) {
        found[hit] = true; nFound++; var cls = "f" + (colorIx++ % 7);
        p.forEach(function (rc) { var e = cellAt(rc); if (e) e.classList.add(cls); });
        paint([]);
        var li = side.querySelector('[data-w="' + hit + '"]'); li.classList.add("is-found"); li.querySelector(".tb-tick").textContent = "✓";
        api.progress(nFound + " of " + ws.words.length + " found");
        msgEl.textContent = api.praise(); api.live("Found " + hit + ". " + nFound + " of " + ws.words.length + ".");
        if (nFound === ws.words.length) api.cheer("You found them all!", "New word search"); else api.chime(false);
      } else {
        var cs = p.map(cellAt).filter(function (e) { return e && !/ f\d/.test(" " + e.className); });
        cs.forEach(function (e) { e.classList.add("is-fade"); e.classList.remove("is-sel"); });
        api.later(function () { cs.forEach(function (e) { e.classList.remove("is-fade"); }); }, 650);
        path = []; api.soft(); msgEl.textContent = "Keep looking. Slide along a whole word.";
      }
    }
    function tap(rc) {
      if (!pending) { pending = rc; mark(rc); paint([rc]); return; }
      if (pending[0] === rc[0] && pending[1] === rc[1]) { pending = null; mark(null); paint([]); return; }
      var p = line(pending, rc); pending = null; mark(null); paint(p); tryWord(p);
    }
    grid.addEventListener("pointerdown", function (e) {
      api.unlock(); var rc = fromPoint(e.clientX, e.clientY); if (!rc) return;
      e.preventDefault(); try { grid.setPointerCapture(e.pointerId); } catch (x) { /* mouse or old browser */ }
      down = rc; moved = false; if (!pending) paint([rc]);
    });
    grid.addEventListener("pointermove", function (e) {
      if (!down) return;
      var rc = fromPoint(e.clientX, e.clientY); if (!rc) return;
      if (rc[0] !== down[0] || rc[1] !== down[1]) { moved = true; if (pending) { pending = null; mark(null); } }
      if (moved) paint(line(down, rc));
    });
    grid.addEventListener("pointerup", function () {
      if (!down) return;
      var s = down; down = null;
      if (moved) tryWord(path.length ? path : [s]); else tap(s);
    });
    grid.addEventListener("pointercancel", function () { down = null; paint([]); });
    /* a word in the list: its letters glow, so the person can see where to look */
    function showWord(w) {
      var p = ws.placed.filter(function (x) { return x.word === w; })[0]; if (!p) return;
      wordCells(p).forEach(function (rc) { var e = cellAt(rc); if (e) Kit.glow(e, 3600); });
      msgEl.textContent = "Look for " + w + ". Its letters are glowing."; api.live(msgEl.textContent);
    }
    side.addEventListener("click", function (e) {
      var b = e.target.closest("[data-w]"); if (b) { api.unlock(); if (!found[b.getAttribute("data-w")]) { showWord(b.getAttribute("data-w")); api.speak(b.getAttribute("data-w").toLowerCase()); } return; }
      var g = e.target.closest("[data-grid]"); if (!g || g.disabled) return;
      sizeNow = Math.max(3, Math.min(6, n + (+g.getAttribute("data-grid")))); prefs.grid = sizeNow; api.savePrefs();
      o.seed = T.newSeed(); if (make()) build();
    });
    api.onResize(size);
    build();
    api.say(function () { var left = ws.words.filter(function (w) { return !found[w]; }); return left.length ? "Find these words. " + left.map(function (w) { return w.toLowerCase(); }).join(". ") + "." : "You found every word. Lovely!"; });
    api.hint(function () {
      var left = ws.placed.filter(function (p) { return !found[p.word]; }); if (!left.length) return;
      showWord(left[Math.floor(Math.random() * left.length)].word);
    });
    api.assist(function () {
      ws.placed.filter(function (p) { return !found[p.word]; }).forEach(function (p, k) { api.later(function () { if (!found[p.word]) tryWord(wordCells(p)); }, 520 * k); });
    });
    api.debug(function () { return { size: n, placed: ws.placed, words: ws.words, found: Object.keys(found), pack: ws.pack, cell: function (r2, c2) { var b = cellAt([r2, c2]).getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; } }; });
  }

  /* ===================== CROSSWORD ===================== */
  function crossword(root, o, api) {
    var cw = null, typed = {}, done = {}, sel = { r: 0, c: 0, dir: "A" }, cellsEl = {}, wrap = h("div", "tb-cwwrap"), grid = h("div", "tb-cw"), panel = h("div", "tb-cwpanel");
    var key = function (r, c) { return r + "," + c; };
    /* beside the keyboard on a wide screen, above it (the keyboard docked at the bottom) on a narrow one; the grid gets what is left */
    function layoutFor(a) {
      var t = tbt(), per = t + 3, side = a.w >= 940 && a.w >= a.h * 1.15;
      if (side) return { side: true, n: Math.max(5, Math.min(6, Math.floor(Math.min(a.w * 0.5, 7 * 80) / per), Math.floor(a.h / per))), gw: Math.min(a.w * 0.5, 7 * 80), gh: a.h };
      var cols = Math.max(4, Math.floor((a.w + 8) / (t + 8))), rows = Math.ceil(27 / cols), panelH = 96 + (t + 12) + rows * (t + 8) + 36, gh = a.h - panelH - 14;
      return { side: false, n: Math.max(5, Math.min(6, Math.floor((a.w - 20) / per), Math.floor(gh / per))), gw: a.w, gh: gh };
    }
    cw = T.crossword({ stage: o.stage, topic: o.topic, seed: o.seed, avoid: o.avoid, fit: { size: layoutFor(api.area()).n } });
    if (!cw) { root.innerHTML = '<p class="tb-big">No puzzle this time. Choose Next.</p>'; return; }
    api.used([cw.topic]);
    var filled = function (r, c) { return r >= 0 && c >= 0 && r < cw.rows && c < cw.cols && cw.cells[r].charAt(c) !== "."; };
    var entryCells = function (e) { var out = []; for (var k = 0; k < e.word.length; k++) out.push([e.r + (e.dir === "D" ? k : 0), e.c + (e.dir === "A" ? k : 0)]); return out; };
    var entryAt = function (r, c, dir) { return cw.entries.filter(function (e) { return e.dir === dir && entryCells(e).some(function (p) { return p[0] === r && p[1] === c; }); })[0] || null; };
    var cur2 = function () { return entryAt(sel.r, sel.c, sel.dir); };
    grid.style.setProperty("--cols", cw.cols); grid.setAttribute("role", "grid"); grid.setAttribute("aria-label", "Crossword, " + cw.rows + " rows by " + cw.cols + " columns");
    var numAt = {}; cw.entries.forEach(function (e) { numAt[key(e.r, e.c)] = e.num; });
    for (var r = 0; r < cw.rows; r++) for (var c = 0; c < cw.cols; c++) {
      if (!filled(r, c)) { grid.appendChild(h("div", "tb-blank")); continue; }
      var b = h("button", "tb-cwc", (numAt[key(r, c)] ? "<i>" + numAt[key(r, c)] + "</i>" : "") + '<span class="L"></span>'); b.type = "button"; b.setAttribute("data-r", r); b.setAttribute("data-c", c);
      b.setAttribute("aria-label", "Row " + (r + 1) + ", column " + (c + 1)); grid.appendChild(b); cellsEl[key(r, c)] = b;
    }
    var clue = h("div", "tb-clue tb-glass", ""), nav = h("div", "tb-row"), kb;
    nav.innerHTML = '<button type="button" class="tb-btn" data-cwn="-1"><span aria-hidden="true">◀</span> Clue</button><button type="button" class="tb-btn" id="tbCwHint"><span aria-hidden="true">💡</span> A letter</button><button type="button" class="tb-btn" data-cwn="1">Clue <span aria-hidden="true">▶</span></button>';
    function size() {
      var L = layoutFor(api.area()), cell = Math.floor(Math.min(L.gw / cw.cols, L.gh / cw.rows)) - 3;
      grid.style.setProperty("--cell", Math.max(tbt(), Math.min(84, cell)) + "px");
      wrap.classList.toggle("is-side", L.side);
    }
    function refresh() {
      var e = cur2(), inWord = {}; if (e) entryCells(e).forEach(function (p) { inWord[key(p[0], p[1])] = 1; });
      var doneCell = {}; cw.entries.forEach(function (en) { if (done[en.num + en.dir]) entryCells(en).forEach(function (p) { doneCell[key(p[0], p[1])] = 1; }); });
      Object.keys(cellsEl).forEach(function (k) {
        var el = cellsEl[k]; el.querySelector(".L").textContent = typed[k] || "";
        el.classList.toggle("is-word", !!inWord[k]); el.classList.toggle("is-done", !!doneCell[k]); el.classList.toggle("is-cur", k === key(sel.r, sel.c));
      });
      clue.innerHTML = e ? "<b>" + e.num + " " + (e.dir === "A" ? "Across" : "Down") + ":</b> " + esc(e.clue) + "<small>" + e.word.length + " letters</small>" : "Tap a square";
      api.progress(Object.keys(done).length + " of " + cw.entries.length + " words");
    }
    function select(r2, c2, dir) {
      sel.r = r2; sel.c = c2;
      if (dir) sel.dir = dir;
      if (!entryAt(r2, c2, sel.dir)) sel.dir = sel.dir === "A" ? "D" : "A";
      refresh(); var e = cur2(); if (e) api.live(e.num + " " + (e.dir === "A" ? "across" : "down") + ". " + e.clue + ". " + e.word.length + " letters.");
      var el = cellsEl[key(r2, c2)]; if (el && el.scrollIntoView && !reduced()) { try { el.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (x) { /* fine */ } }
    }
    function check() {
      var all = true;
      cw.entries.forEach(function (e) {
        var ok = entryCells(e).every(function (p, k) { return typed[key(p[0], p[1])] === e.word.charAt(k); });
        if (ok && !done[e.num + e.dir]) { done[e.num + e.dir] = true; api.chime(false); api.live(e.word + " is right."); }
        if (!ok) all = false;
      });
      refresh();
      if (all) api.cheer("The crossword is finished!", "New crossword");
    }
    function next(dirn) {
      var order = cw.entries, e = cur2(), ix = e ? order.indexOf(e) : -1; ix = (ix + dirn + order.length) % order.length;
      var n2 = order[ix]; select(n2.r, n2.c, n2.dir);
    }
    function type(L) {
      var e = cur2(); if (!e) return;
      typed[key(sel.r, sel.c)] = L; api.tick();
      var cs = entryCells(e), at = cs.findIndex(function (p) { return p[0] === sel.r && p[1] === sel.c; });
      if (at < cs.length - 1) { sel.r = cs[at + 1][0]; sel.c = cs[at + 1][1]; }
      check();
    }
    function back() {
      var e = cur2(); if (!e) return;
      if (typed[key(sel.r, sel.c)]) { delete typed[key(sel.r, sel.c)]; refresh(); return; }
      var cs = entryCells(e), at = cs.findIndex(function (p) { return p[0] === sel.r && p[1] === sel.c; });
      if (at > 0) { sel.r = cs[at - 1][0]; sel.c = cs[at - 1][1]; delete typed[key(sel.r, sel.c)]; }
      refresh();
    }
    grid.addEventListener("click", function (e) {
      var b = e.target.closest(".tb-cwc"); if (!b) return; api.unlock();
      var r2 = +b.getAttribute("data-r"), c2 = +b.getAttribute("data-c");
      if (r2 === sel.r && c2 === sel.c && entryAt(r2, c2, sel.dir === "A" ? "D" : "A")) select(r2, c2, sel.dir === "A" ? "D" : "A"); else select(r2, c2);
    });
    kb = keyboard(type, back);
    panel.appendChild(clue); panel.appendChild(nav); panel.appendChild(kb);
    wrap.appendChild(grid); wrap.appendChild(panel); root.appendChild(wrap);
    nav.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cwn]"); if (b) { next(+b.getAttribute("data-cwn")); return; }
      if (e.target.closest("#tbCwHint")) {
        var en = cur2(); if (!en) return;
        var cs = entryCells(en), p = cs.filter(function (q) { return typed[key(q[0], q[1])] !== en.word.charAt(cs.indexOf(q)); })[0];
        if (p) { sel.r = p[0]; sel.c = p[1]; typed[key(p[0], p[1])] = en.word.charAt(cs.indexOf(p)); check(); }
      }
    });
    var keyEl = function (L) { return kb.querySelector('[data-k="' + L + '"]'); };
    api.onKey(wordKeys(type, back)); size(); api.onResize(size);
    select(cw.entries[0].r, cw.entries[0].c, cw.entries[0].dir);
    api.say(function () { var e = cur2(); return e ? e.num + " " + (e.dir === "A" ? "across" : "down") + ". " + e.clue + ". " + e.word.length + " letters." : ""; });
    api.hint(function () {
      var e = cur2() || cw.entries[0], cs = entryCells(e), p = cs.filter(function (q) { return typed[key(q[0], q[1])] !== e.word.charAt(cs.indexOf(q)); })[0];
      if (!p) { var open = cw.entries.filter(function (x) { return !done[x.num + x.dir]; })[0]; if (open) select(open.r, open.c, open.dir); return; }
      select(p[0], p[1], e.dir); Kit.glow(cellsEl[key(p[0], p[1])], 3600); Kit.glow(keyEl(e.word.charAt(cs.indexOf(p))), 3600);
    });
    api.assist(function () {
      cw.entries.filter(function (e) { return !done[e.num + e.dir]; }).forEach(function (e, n) {
        api.later(function () { entryCells(e).forEach(function (p, k) { typed[key(p[0], p[1])] = e.word.charAt(k); }); check(); }, 450 * n);
      });
    });
    api.debug(function () { return { cw: cw, typed: typed, done: done, set: cw.topic, cell: function (r2, c2) { var b2 = cellsEl[key(r2, c2)].getBoundingClientRect(); return [b2.left + b2.width / 2, b2.top + b2.height / 2]; } }; });
  }

  /* ---------- letter blocks: the heart of Spell It and of spelling a saying ----------
     The letters of a word, scrambled, as large blocks. Tap a block and it hops into the next place; or drag it to any place. A block that is
     not right for the place floats back with a soft note and a kind sentence; only the right letter ever stays. host holds the puzzle;
     o: { given: letters already in place, say(text), onDone(), api } */
  function letterBlocks(host, word, seed, o) {
    var api = o.api, slots = h("div", "tb-slots"), tray = h("div", "tb-tray"), placed = 0, finished = false, given = o.given || 0;
    var rng = window.CognicopiaPCG.prng.create(seed + "/" + word), order = word.split("").map(function (L, k) { return k; }), mix = rng.shuffle(order), tries = 0;
    while (word.length > 1 && mix.every(function (v, i) { return v === i; }) && tries++ < 8) mix = rng.shuffle(order);
    slots.setAttribute("role", "group"); slots.setAttribute("aria-label", word.length + " letters");
    word.split("").forEach(function (L, k) { var s = h("div", "tb-slot", ""); s.setAttribute("data-need", L); s.setAttribute("data-s", k); slots.appendChild(s); });
    mix.forEach(function (k) { if (k < given) return; var t = h("button", "tb-tile", word.charAt(k)); t.type = "button"; t.setAttribute("data-l", word.charAt(k)); t.setAttribute("aria-label", "Letter " + word.charAt(k)); tray.appendChild(t); });
    for (var g = 0; g < given; g++) { var gs = slots.children[g]; gs.textContent = word.charAt(g); gs.classList.add("is-given", "is-filled"); placed++; }
    host.appendChild(slots); host.appendChild(tray);
    var emptySlots = function () { return Array.prototype.filter.call(slots.children, function (s) { return !s.classList.contains("is-filled"); }); };
    var firstEmpty = function () { return emptySlots()[0] || null; };
    function lightNext() { Array.prototype.forEach.call(slots.children, function (s) { s.classList.remove("is-next"); }); var f = firstEmpty(); if (f) f.classList.add("is-next"); }
    function put(tile, slot, ms) {
      Kit.settle(tile, function () { slot.appendChild(tile); }, ms);
      tile.classList.add("is-placed"); tile.disabled = true; slot.classList.add("is-filled"); placed++; lightNext();
      api.chime(false); api.busy();
      if (placed === word.length) { finished = true; if (o.onDone) o.onDone(); }
    }
    function miss(tile, slot) {
      api.soft(); api.busy();
      if (o.say) o.say("Not that one for this place. Try another letter.");
    }
    var drag = Kit.dragger(host, {
      pick: function (t) { var b = t.closest ? t.closest(".tb-tile") : null; return b && !b.classList.contains("is-placed") ? b : null; },
      targets: function () { return emptySlots(); },
      drop: function (tile, slot) { if (finished) return false; if (slot.getAttribute("data-need") === tile.getAttribute("data-l")) { put(tile, slot, 360); return true; } miss(tile, slot); return false; },
      tap: function (tile) {
        if (finished) return; api.unlock(); var slot = firstEmpty(); if (!slot) return;
        if (slot.getAttribute("data-need") === tile.getAttribute("data-l")) put(tile, slot, 420);
        else { Kit.bob(tile); miss(tile, slot); }
      }
    });
    lightNext();
    return {
      slots: slots, tray: tray, done: function () { return finished; },
      /* the tile that belongs in the first empty place (for the hint) */
      nextTile: function () { var s = firstEmpty(); if (!s) return null; return Array.prototype.filter.call(tray.children, function (t) { return !t.classList.contains("is-placed") && t.getAttribute("data-l") === s.getAttribute("data-need"); })[0] || null; },
      nextSlot: firstEmpty,
      /* finish the word for the person, a letter at a time */
      fill: function (gap, then) {
        var list = emptySlots();
        list.forEach(function (s, k) {
          api.later(function () {
            var t = Array.prototype.filter.call(tray.children, function (x) { return !x.classList.contains("is-placed") && x.getAttribute("data-l") === s.getAttribute("data-need"); })[0];
            if (t && !s.classList.contains("is-filled")) put(t, s, 340);
          }, gap * k);
        });
        if (then) api.later(then, gap * list.length + 500);
      }
    };
  }

  /* ===================== SPELL IT ===================== */
  function spell(root, o, api) {
    var sp = T.spellIt(o), items = sp.items, ix = 0, blocks = null, assisted = false;
    if (!items.length) { root.innerHTML = '<p class="tb-big">No words this time. Choose Next.</p>'; return; }
    api.used(items.map(function (i) { return i.word; }));
    var stageBox = h("div", "tb-spell"), pic = h("div", "tb-pic-card tb-glass"), clue = h("p", "tb-clueline", ""), play = h("div", "tb-spellplay"), msg = h("p", "tb-msg", ""), row = h("div", "tb-row");
    row.innerHTML = '<button type="button" class="tb-btn go" id="tbSpNext" hidden>Next word <span aria-hidden="true">▶</span></button>';
    stageBox.appendChild(pic); stageBox.appendChild(clue); stageBox.appendChild(play); stageBox.appendChild(msg); stageBox.appendChild(row); root.appendChild(stageBox);
    function show() {
      var it = items[ix]; play.innerHTML = ""; $("tbSpNext").hidden = true;
      pic.innerHTML = Art.img(it.art, { label: "A picture to spell: " + it.clue });
      clue.textContent = it.clue; msg.textContent = "Tap a letter, or slide it into place.";
      blocks = letterBlocks(play, it.word, o.seed + "/" + ix, { given: it.given, api: api, say: function (t) { msg.textContent = t; api.live(t); }, onDone: finishWord });
      api.progress("Word " + (ix + 1) + " of " + items.length);
      api.say(function () { return it.clue + ". It has " + it.word.length + " letters."; });
    }
    function finishWord() {
      var it = items[ix]; msg.textContent = api.praise() + " " + cap(it.word) + "."; api.live(msg.textContent);
      pic.classList.add("is-happy"); api.later(function () { pic.classList.remove("is-happy"); }, 1200);
      api.speak(it.word.toLowerCase());
      if (assisted) return;
      if (ix === items.length - 1) api.later(function () { api.cheer("All the words are spelled!", "New words"); }, 1700); else $("tbSpNext").hidden = false;
    }
    row.addEventListener("click", function (e) { if (e.target.closest("#tbSpNext")) { ix++; show(); } });
    api.onKey(wordKeys(function (L) { var t = blocks && blocks.nextTile(); if (t && t.getAttribute("data-l") === L) t.click(); }, function () { /* a placed letter stays: only the right letter ever does */ }));
    show();
    api.hint(function () {
      if (blocks.done()) { Kit.glow($("tbSpNext"), 3600); return; }
      var t = blocks.nextTile(), s = blocks.nextSlot(); if (t) Kit.glow(t, 3600); if (s) Kit.glow(s, 3600);
    });
    api.assist(function () {
      assisted = true;
      blocks.fill(300, function () { api.cheer("All the words are spelled!", "New words"); });
    });
    api.debug(function () { return { word: items[ix].word, art: items[ix].art, index: ix, count: items.length, placed: blocks.slots.querySelectorAll(".is-filled").length, finished: blocks.done() }; });
  }

  /* ===================== FINISH THE SAYING ===================== */
  function saying(root, o, api) {
    var S = T.sayings(o).items, ix = 0, answered = false, misses = 0, speller = null;
    api.used(S.map(function (s) { return s.id; }));
    var big = h("p", "tb-big", ""), opts = h("div", "tb-opts"), spellBox = h("div", "tb-spellplay"), msg = h("p", "tb-msg", ""), nav = h("div", "tb-row");
    nav.innerHTML = '<button type="button" class="tb-btn" id="tbSyHelp">Help me spell it</button><button type="button" class="tb-btn go" id="tbSyNext" hidden>Next <span aria-hidden="true">▶</span></button>';
    [big, opts, spellBox, msg, nav].forEach(function (x) { root.appendChild(x); });
    var single = function (s) { return /^[a-z]+$/i.test(s.answer) && s.answer.length <= 9; };
    function show() {
      var s = S[ix]; answered = false; misses = 0; speller = null; spellBox.innerHTML = ""; spellBox.hidden = true; opts.hidden = false;
      big.innerHTML = esc(s.lead) + ' <span class="tb-blank-slot">&nbsp;</span>';
      opts.innerHTML = s.options.map(function (t, k) { return '<button type="button" class="tb-opt" data-o="' + k + '">' + esc(t) + "</button>"; }).join("");
      msg.textContent = "Choose the word that finishes it."; $("tbSyNext").hidden = true; $("tbSyHelp").hidden = !single(s); api.progress("Saying " + (ix + 1) + " of " + S.length);
      api.say(function () { return s.lead + " blank. Is it " + s.options.join(", or ") + "?"; });
    }
    function solved(viaSpelling) {
      var s = S[ix]; answered = true;
      big.innerHTML = esc(s.lead) + " <u>" + esc(s.answer) + "</u>";
      Array.prototype.forEach.call(opts.children, function (x) { x.disabled = true; if (x.textContent === s.answer) x.classList.add("is-right"); });
      $("tbSyHelp").hidden = true; msg.textContent = api.praise(); if (!viaSpelling) api.chime(false); api.live(msg.textContent + " " + s.lead + " " + s.answer);
      api.speak((s.lead + " " + s.answer).toLowerCase());
      if (ix === S.length - 1) api.later(function () { api.cheer("All done. Lovely work!", "More sayings"); }, 1500); else $("tbSyNext").hidden = false;
    }
    opts.addEventListener("click", function (e) {
      var b = e.target.closest("[data-o]"); if (!b || answered || b.disabled) return; api.unlock(); api.busy();
      var s = S[ix], pick = s.options[+b.getAttribute("data-o")];
      if (pick === s.answer) { solved(false); return; }
      /* not that one: it softly steps back, and the person tries another; after two, the right one glows */
      misses++; b.disabled = true; b.classList.add("is-nope"); api.soft(); msg.textContent = "Good thought. Try another."; api.live(msg.textContent);
      if (misses >= 2) Array.prototype.forEach.call(opts.children, function (x) { if (x.textContent === s.answer) Kit.glow(x, 4000); });
    });
    nav.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.id === "tbSyNext") { ix++; show(); return; }
      if (b.id === "tbSyHelp" && !answered) {
        var s = S[ix]; opts.hidden = true; spellBox.hidden = false; spellBox.innerHTML = ""; b.hidden = true; msg.textContent = "Spell the word. Tap a letter.";
        speller = letterBlocks(spellBox, s.answer.toUpperCase(), o.seed + "/sy" + ix, { given: 0, api: api, say: function (t) { msg.textContent = t; api.live(t); }, onDone: function () { solved(true); } });
      }
    });
    show();
    api.hint(function () {
      if (answered) { Kit.glow($("tbSyNext"), 3600); return; }
      if (speller) { var t = speller.nextTile(), sl = speller.nextSlot(); if (t) Kit.glow(t, 3600); if (sl) Kit.glow(sl, 3600); return; }
      Array.prototype.forEach.call(opts.children, function (x) { if (x.textContent === S[ix].answer) Kit.glow(x, 3600); });
    });
    api.assist(function () {
      ix = S.length - 1; show();
      var right = Array.prototype.filter.call(opts.children, function (x) { return x.textContent === S[ix].answer; })[0]; if (right) right.click();
    });
    api.debug(function () { return { item: S[ix], index: ix, count: S.length, misses: misses, spelling: !!speller, id: S[ix].id }; });
  }

  Kit.register({ id: "wordsearch", group: 0, order: 1, title: "Word Search", blurb: "Slide a finger along a hidden word.",
    icon: '<rect x="8" y="8" width="48" height="48" rx="6"/><path d="M20 8v48M32 8v48M44 8v48M8 20h48M8 32h48M8 44h48"/><path d="M14 50 50 14" stroke-width="7"/>', start: wordSearch });
  Kit.register({ id: "crossword", group: 0, order: 2, title: "Crossword", blurb: "Tap a square, then tap letters on the big keyboard.",
    icon: '<rect x="8" y="8" width="48" height="48"/><path d="M8 24h48M8 40h48M24 8v48M40 8v48"/><rect x="24" y="24" width="16" height="16"/>', start: crossword });
  Kit.register({ id: "spell", group: 0, order: 3, title: "Spell It", blurb: "A picture, and letter blocks to put in order.",
    icon: '<path d="M8 52h14M25 52h14M42 52h14"/><path d="M14 38 22 12l8 26M17 28h10"/><path d="M40 12h14M47 12v26"/>', start: spell });
  Kit.register({ id: "saying", group: 0, order: 4, title: "Finish the Saying", blurb: "Choose the word that completes it.",
    icon: '<path d="M8 10h48v32H28L16 54V42H8z"/><path d="M18 22h28M18 31h18"/>', start: saying });
})();
