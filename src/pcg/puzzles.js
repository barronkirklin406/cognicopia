/* =====================================================================
   Cognicopia PCG: the puzzle makers.

   wordSearch(words, cfg, rng, safety)
     Puts the words on a size x size grid in the directions the stage allows
     (early: across, down and both diagonals, 15 x 15; middle: across and
     down, 8 x 8; late: across only, 6 x 6) and fills the rest with letters.
     No word is ever placed backward. Afterward the grid is scanned in all
     eight directions and any filler letter that spells a word on the
     blocklist, or a second copy of a word being searched for, or repeats a
     letter three times running, is replaced, so the only words a person can
     find are the ones on the list and no run of filler looks like a mistake.

   crossword(entries, cfg, rng)
     An intersecting crossword built greedily: the longest word goes across
     the middle, each next word is placed where it crosses the most letters
     already down and keeps the grid compact, with the usual rules (no two
     parallel words touching, no accidental words). It tries several orders
     and keeps the best. The result is numbered and cropped to what is used.

   Everything is drawn from the rng it is given, so the same seed gives the
   same puzzle. Runs in the browser (window.CognicopiaPCG.puzzles) and Node.
   ===================================================================== */
(function (root) {
  "use strict";
  var PCG = root.CognicopiaPCG = root.CognicopiaPCG || {};
  var EIGHT = [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 0], [0, -1], [-1, -1], [-1, 1]];

  /* ---------- word search ---------- */
  function wordSearch(words, cfg, rng, safety){
    var size = cfg.size, dirs = cfg.dirs, alphabet = safety.filler.alphabet, block = new Set(safety.blocklist);
    var grid = [], mine = [], r, c, i;
    for (r = 0; r < size; r++){ grid.push(new Array(size).fill("")); mine.push(new Array(size).fill(false)); }
    var order = words.slice().sort(function(a, b){ return b.length - a.length || (a < b ? -1 : a > b ? 1 : 0); });
    var placed = [], dropped = [];
    /* the cells a reading covers, as one key: a word that reads the same backward is one reading, not two */
    function cellsKey(r0, c0, dx, dy, len){ var k = [], j; for (j = 0; j < len; j++) k.push((r0 + dy * j) * 100 + (c0 + dx * j)); return k.sort(function(x, y){ return x - y; }).join(","); }
    /* every place a word reads on the grid as it stands, any of eight ways */
    function readings(w){
      var out = {}, sr, sc;
      EIGHT.forEach(function(d){
        for (sr = 0; sr < size; sr++) for (sc = 0; sc < size; sc++){
          var j = 0;
          while (j < w.length){ var rr = sr + d[1] * j, cc = sc + d[0] * j; if (rr < 0 || rr >= size || cc < 0 || cc >= size || grid[rr][cc] !== w.charAt(j)) break; j++; }
          if (j === w.length) out[cellsKey(sr, sc, d[0], d[1], w.length)] = 1;
        }
      });
      return Object.keys(out);
    }
    /* words crossing may spell a second copy of a word on the list; none is allowed */
    function clean(){ return placed.every(function(p){ return readings(p.word).length === 1; }); }
    order.forEach(function(w){
      var opts = [];
      dirs.forEach(function(d){
        var dx = d[0], dy = d[1];
        for (r = 0; r < size; r++) for (c = 0; c < size; c++){
          var er = r + dy * (w.length - 1), ec = c + dx * (w.length - 1);
          if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
          var overlap = 0, ok = true;
          for (i = 0; i < w.length; i++){
            var cur = grid[r + dy * i][c + dx * i];
            if (cur){ if (cur !== w.charAt(i)){ ok = false; break; } overlap++; }
          }
          if (ok && overlap < w.length) opts.push({ r: r, c: c, dx: dx, dy: dy, overlap: overlap });
        }
      });
      for (var tries = 0; opts.length && tries < 40; tries++){
        var o = rng.weighted(opts, function(x){ return x.overlap === 0 ? 1 : x.overlap === 1 ? 1.4 : 0.6; });
        var before = [];
        for (i = 0; i < w.length; i++){ before.push([grid[o.r + o.dy * i][o.c + o.dx * i], mine[o.r + o.dy * i][o.c + o.dx * i]]); grid[o.r + o.dy * i][o.c + o.dx * i] = w.charAt(i); mine[o.r + o.dy * i][o.c + o.dx * i] = true; }
        placed.push({ word: w, r: o.r, c: o.c, dx: o.dx, dy: o.dy });
        if (clean()) return;
        placed.pop();
        for (i = 0; i < w.length; i++){ grid[o.r + o.dy * i][o.c + o.dx * i] = before[i][0]; mine[o.r + o.dy * i][o.c + o.dx * i] = before[i][1]; }
        opts.splice(opts.indexOf(o), 1);
      }
      dropped.push(w);
    });
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (!grid[r][c]) grid[r][c] = alphabet.charAt(rng.int(alphabet.length));

    /* the filler cells that spell something that must not be there */
    var targets = {}, maxLen = 3;
    placed.forEach(function(p){ targets[p.word] = p; if (p.word.length > maxLen) maxLen = p.word.length; });
    block.forEach(function(w){ if (w.length > maxLen) maxLen = w.length; });
    function scan(){
      var bad = {}, any = false, sr, sc;
      for (sr = 0; sr < size; sr++) for (sc = 0; sc < size; sc++) EIGHT.forEach(function(d){
        var s = "", cells = [], k, rr, cc;
        for (k = 0; k < maxLen; k++){
          rr = sr + d[1] * k; cc = sc + d[0] * k;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) break;
          s += grid[rr][cc]; cells.push([rr, cc]);
          if (k < 2) continue;
          var wrong = block.has(s) || (k === 2 && s.charAt(0) === s.charAt(1) && s.charAt(1) === s.charAt(2));   /* three of a kind in a row looks like a printing error */
          if (!wrong && targets[s]){
            var t = targets[s];
            wrong = cellsKey(sr, sc, d[0], d[1], s.length) !== cellsKey(t.r, t.c, t.dx, t.dy, s.length);
          }
          if (wrong) cells.forEach(function(p){ if (!mine[p[0]][p[1]]){ bad[p[0] + "," + p[1]] = p; any = true; } });
        }
      });
      return any ? Object.keys(bad).map(function(k){ return bad[k]; }) : [];
    }
    for (var pass = 0; pass < 80; pass++){
      var cells = scan();
      if (!cells.length) break;
      cells.forEach(function(p){ grid[p[0]][p[1]] = alphabet.charAt(rng.int(alphabet.length)); });
    }
    return { size: size, rows: grid.map(function(row){ return row.join(""); }), placed: placed, dropped: dropped };
  }

  /* every place a word reads in the directions given (for checking a grid) */
  function findWord(rows, word, dirs){
    var size = rows.length, out = [], r, c;
    dirs.forEach(function(d){
      for (r = 0; r < size; r++) for (c = 0; c < size; c++){
        var i = 0;
        while (i < word.length){
          var rr = r + d[1] * i, cc = c + d[0] * i;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size || rows[rr].charAt(cc) !== word.charAt(i)) break;
          i++;
        }
        if (i === word.length) out.push({ r: r, c: c, dx: d[0], dy: d[1] });
      }
    });
    return out;
  }

  /* ---------- crossword ---------- */
  function tryBuild(entries, size, rng, max){
    var grid = [], across = [], down = [], placed = [], r, c;
    for (r = 0; r < size; r++){ grid.push(new Array(size).fill("")); across.push(new Array(size).fill(false)); down.push(new Array(size).fill(false)); }
    var inb = function(rr, cc){ return rr >= 0 && cc >= 0 && rr < size && cc < size; };
    var box = null;
    function canPlace(w, r0, c0, dir){
      var dr = dir, dc = 1 - dir, len = w.length, er = r0 + dr * (len - 1), ec = c0 + dc * (len - 1), i;
      if (r0 < 0 || c0 < 0 || er >= size || ec >= size) return -1;
      if (inb(r0 - dr, c0 - dc) && grid[r0 - dr][c0 - dc]) return -1;
      if (inb(er + dr, ec + dc) && grid[er + dr][ec + dc]) return -1;
      var cross = 0;
      for (i = 0; i < len; i++){
        var rr = r0 + dr * i, cc = c0 + dc * i, cur = grid[rr][cc];
        if (cur){
          if (cur !== w.charAt(i)) return -1;
          if ((dir === 0 ? across : down)[rr][cc]) return -1;
          cross++;
        } else {
          if (inb(rr + dc, cc + dr) && grid[rr + dc][cc + dr]) return -1;
          if (inb(rr - dc, cc - dr) && grid[rr - dc][cc - dr]) return -1;
        }
      }
      return cross;
    }
    function put(e, r0, c0, dir){
      var dr = dir, dc = 1 - dir, i;
      for (i = 0; i < e.word.length; i++){
        grid[r0 + dr * i][c0 + dc * i] = e.word.charAt(i);
        (dir === 0 ? across : down)[r0 + dr * i][c0 + dc * i] = true;
      }
      var r1 = r0 + dr * (e.word.length - 1), c1 = c0 + dc * (e.word.length - 1);
      box = box ? [Math.min(box[0], r0), Math.min(box[1], c0), Math.max(box[2], r1), Math.max(box[3], c1)] : [r0, c0, r1, c1];
      placed.push({ word: e.word, clue: e.clue, ref: e.ref, r: r0, c: c0, dir: dir });
    }
    var first = entries[0];
    if (first.word.length > size) return { placed: placed, crossings: 0, area: 0, grid: grid, box: box };
    put(first, Math.floor(size / 2), Math.floor((size - first.word.length) / 2), 0);
    var crossings = 0, mid = (size - 1) / 2;
    for (var n = 1; n < entries.length; n++){
      if (max && placed.length >= max) break;
      var e = entries[n], opts = [];
      for (r = 0; r < size; r++) for (c = 0; c < size; c++){
        if (!grid[r][c]) continue;
        for (var i = 0; i < e.word.length; i++){
          if (e.word.charAt(i) !== grid[r][c]) continue;
          for (var dir = 0; dir < 2; dir++){
            var r0 = r - dir * i, c0 = c - (1 - dir) * i, x = canPlace(e.word, r0, c0, dir);
            if (x < 1) continue;
            var nb = [Math.min(box[0], r0), Math.min(box[1], c0), Math.max(box[2], r0 + dir * (e.word.length - 1)), Math.max(box[3], c0 + (1 - dir) * (e.word.length - 1))];
            var grow = (nb[2] - nb[0] + 1) * (nb[3] - nb[1] + 1) - (box[2] - box[0] + 1) * (box[3] - box[1] + 1);
            var dist = Math.abs(r0 + dir * (e.word.length - 1) / 2 - mid) + Math.abs(c0 + (1 - dir) * (e.word.length - 1) / 2 - mid);
            opts.push({ r: r0, c: c0, dir: dir, x: x, score: x * 10 - grow * 0.6 - dist * 0.25 });
          }
        }
      }
      if (!opts.length) continue;
      opts.sort(function(a, b){ return b.score - a.score || a.r - b.r || a.c - b.c || a.dir - b.dir; });
      var o = opts[Math.min(opts.length - 1, rng.int(Math.min(3, opts.length)))];
      put(e, o.r, o.c, o.dir); crossings += o.x;
    }
    return { placed: placed, crossings: crossings, area: box ? (box[2] - box[0] + 1) * (box[3] - box[1] + 1) : 0, grid: grid, box: box };
  }

  function crossword(entries, cfg, rng){
    var size = cfg.size, target = cfg.target, best = null, a;
    var usable = entries.filter(function(e){ return e.word.length >= 3 && e.word.length <= size; });
    if (usable.length < 3) return null;
    for (a = 0; a < (cfg.attempts || 30); a++){
      var r = rng.fork("cw" + a);
      /* one of the three longest words goes first; the rest follow longest first, ties broken by the shuffle */
      var shuffled = r.shuffle(usable);
      var byLen = shuffled.slice().sort(function(x, y){ return y.word.length - x.word.length; });
      var lead = byLen[r.int(Math.min(3, byLen.length))];
      var rest = shuffled.filter(function(x){ return x !== lead; }).sort(function(x, y){ return y.word.length - x.word.length; });
      var res = tryBuild([lead].concat(rest), size, r, cfg.max);
      var score = res.placed.length * 100 + res.crossings * 10 - res.area * 0.2;
      if (!best || score > best.score){ best = { res: res, score: score }; }
      if (best.res.placed.length >= target && a >= 3) break;
    }
    var res2 = best.res, box = res2.box;
    if (!box || res2.placed.length < 3) return null;
    var rows = box[2] - box[0] + 1, cols = box[3] - box[1] + 1;
    var cells = [], rr, cc;
    for (rr = 0; rr < rows; rr++){ var line = ""; for (cc = 0; cc < cols; cc++) line += res2.grid[box[0] + rr][box[1] + cc] || "."; cells.push(line); }
    var entriesOut = res2.placed.map(function(p){ return { word: p.word, clue: p.clue, ref: p.ref || null, r: p.r - box[0], c: p.c - box[1], dir: p.dir === 0 ? "A" : "D" }; });
    /* standard numbering: row by row, a cell starting an across or a down word takes the next number */
    var filled = function(r0, c0){ return r0 >= 0 && c0 >= 0 && r0 < rows && c0 < cols && cells[r0].charAt(c0) !== "."; };
    var n = 0, numbers = {};
    for (rr = 0; rr < rows; rr++) for (cc = 0; cc < cols; cc++){
      if (!filled(rr, cc)) continue;
      var sa = !filled(rr, cc - 1) && filled(rr, cc + 1), sd = !filled(rr - 1, cc) && filled(rr + 1, cc);
      if (sa || sd){ n++; numbers[rr + "," + cc] = n; }
    }
    entriesOut.forEach(function(e){ e.num = numbers[e.r + "," + e.c]; });
    entriesOut.sort(function(x, y){ return x.num - y.num || (x.dir < y.dir ? -1 : 1); });
    return { rows: rows, cols: cols, cells: cells, entries: entriesOut, crossings: res2.crossings, dropped: usable.length - res2.placed.length };
  }

  /* a crossword is sound when every run of two or more letters is one of its words */
  function checkCrossword(cw){
    var problems = [], rows = cw.rows, cols = cw.cols, r, c;
    var cell = function(r0, c0){ return r0 >= 0 && c0 >= 0 && r0 < rows && c0 < cols ? cw.cells[r0].charAt(c0) : "."; };
    var runs = [];
    for (r = 0; r < rows; r++){ var s = "", sc = 0; for (c = 0; c <= cols; c++){ var ch = c < cols ? cell(r, c) : "."; if (ch !== "."){ if (!s) sc = c; s += ch; } else { if (s.length > 1) runs.push({ w: s, r: r, c: sc, dir: "A" }); s = ""; } } }
    for (c = 0; c < cols; c++){ var t = "", sr = 0; for (r = 0; r <= rows; r++){ var ch2 = r < rows ? cell(r, c) : "."; if (ch2 !== "."){ if (!t) sr = r; t += ch2; } else { if (t.length > 1) runs.push({ w: t, r: sr, c: c, dir: "D" }); t = ""; } } }
    runs.forEach(function(run){
      if (!cw.entries.some(function(e){ return e.word === run.w && e.r === run.r && e.c === run.c && e.dir === run.dir; })) problems.push("an unplanned word " + run.w + " at " + run.r + "," + run.c);
    });
    cw.entries.forEach(function(e){
      for (var i = 0; i < e.word.length; i++) if (cell(e.r + (e.dir === "D" ? i : 0), e.c + (e.dir === "A" ? i : 0)) !== e.word.charAt(i)) { problems.push(e.word + " is not where it says"); break; }
    });
    var nums = cw.entries.map(function(e){ return e.num; });
    if (nums.some(function(x){ return !x; })) problems.push("an entry has no number");
    return problems;
  }

  PCG.puzzles = { wordSearch: wordSearch, findWord: findWord, crossword: crossword, checkCrossword: checkCrossword, EIGHT: EIGHT };
})(typeof globalThis !== "undefined" ? globalThis : this);
