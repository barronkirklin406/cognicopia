/* The Zentangle Gallery (hand-written; the Packets door's "Zentangle Gallery", route #/zentangle in builder.html).

   The owner's Zen Tangle coloring books, kept exactly as drawn: finely detailed pages, pure black on white, 1656 x 2160 (3:4, lossless WebP) in
   assets/zentangle/<book>/NN.webp with a small gray picture in assets/zentangle/<book>/t/NN.webp. The list of books is assets/zentangle/manifest.json,
   written by scripts/build-zentangle.mjs (npm run zentangle) from the folders. Nothing here is a coloring page "made for" a resident: it is a shelf of
   finished pictures. They are the library's most detailed kind only (a detailed-only exception to its three-step rule, the owner's decision of
   November 20, 2026); for a later-stage resident the Cognicopia Coloring library's simpler pages are the right choice, and the screen says so.

   A page is chosen by a button on its picture (a pressed state with the words "Selected", never color alone). "Print" sets the chosen pages on US Letter
   with the 0.75 in binding gutter and 0.5 in margins, nothing else on the page, and counts as one packet like any other printed pages (BookUI.print).
   The pictures are first read into the page itself, so a print never waits on an image. No request leaves the site. */
(function (root) {
  "use strict";
  if (root.CogniZentangle) return;
  var BASE = "assets/zentangle/", cache = null, css = false;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function pageUrl(slug, n) { return BASE + slug + "/" + pad(n) + ".webp"; }
  function thumbUrl(slug, n) { return BASE + slug + "/t/" + pad(n) + ".webp"; }
  function load() {
    if (cache) return Promise.resolve(cache);
    return fetch(BASE + "manifest.json").then(function (r) { if (!r.ok) throw new Error("manifest"); return r.json(); }).then(function (m) { cache = m; return m; });
  }

  var CSS = ".zg{max-width:1180px;margin:0 auto}.zg h1{margin:0 0 6px}.zg-lead{margin:0 0 14px;max-width:70ch}" +
    ".zg-note{border:1px solid var(--line-2);background:var(--panel);border-radius:var(--radius,14px);padding:12px 16px;margin:0 0 18px;max-width:78ch}" +
    ".zg-group{margin:22px 0 8px;font-size:1.15rem}" +
    ".zg-books{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;list-style:none;margin:0;padding:0}" +
    ".zg-book{display:flex;flex-direction:column;gap:6px;width:100%;min-height:52px;text-align:left;font:inherit;color:var(--text);background:var(--panel);border:2px solid var(--line-2);border-radius:var(--radius,14px);padding:10px;cursor:pointer}" +
    ".zg-book:hover{border-color:var(--accent)}.zg-book:focus-visible,.zg-thumb:focus-visible,.zg-btn:focus-visible{outline:3px solid var(--accent-hi);outline-offset:2px}" +
    ".zg-book img{width:100%;aspect-ratio:3/4;object-fit:cover;background:#fff;border-radius:8px}.zg-book b{font-size:1.05rem}.zg-book small{color:var(--muted)}" +
    ".zg-tag{display:inline-block;border:1px solid var(--warn);color:var(--warn);border-radius:999px;padding:2px 10px;font-size:.85rem;width:max-content}" +
    ".zg-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 16px}" +
    ".zg-btn{min-height:52px;min-width:52px;padding:0 20px;font:inherit;font-weight:700;color:var(--text);background:var(--panel-2);border:2px solid var(--line-2);border-radius:12px;cursor:pointer}" +
    ".zg-btn:hover{border-color:var(--accent)}.zg-btn.zg-primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}.zg-btn[disabled]{opacity:.55;cursor:not-allowed}" +
    ".zg-pages{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;list-style:none;margin:0;padding:0}" +
    ".zg-cell{display:flex;flex-direction:column;gap:6px}.zg-thumb{position:relative;display:block;width:100%;min-height:52px;padding:6px;font:inherit;color:var(--text);background:var(--panel);border:3px solid var(--line-2);border-radius:12px;cursor:pointer}" +
    ".zg-thumb img{display:block;width:100%;aspect-ratio:3/4;object-fit:contain;background:#fff;border-radius:6px}" +
    ".zg-thumb[aria-pressed=true]{border-color:var(--accent-hi);background:var(--accent-deep)}" +
    ".zg-sel{display:block;min-height:1.4em;text-align:center;font-weight:700}" +
    ".zg-cell .zg-btn{min-height:52px;padding:0 10px;font-size:.95rem}" +
    ".zg-dlg{max-width:min(96vw,760px);width:100%;padding:12px;border:2px solid var(--line-2);border-radius:14px;background:var(--panel);color:var(--text)}.zg-dlg img{display:block;width:100%;height:auto;background:#fff;border-radius:6px}" +
    ".zg-dlg::backdrop{background:rgba(0,0,0,.72)}.zg-msg{min-height:1.4em;margin:10px 0 0}" +
    ".zg-copies{display:inline-flex;align-items:center;gap:8px}.zg-copies select{min-height:52px;min-width:72px;font:inherit;color:var(--text);background:var(--panel-2);border:2px solid var(--line-2);border-radius:12px;padding:0 10px}" +
    ".sheet.sheet-zg{display:block;padding:.5in .5in .5in .75in}.sheet-zg img{display:block;width:7.25in;height:10in;object-fit:contain;background:#fff}";

  function ensureCss() {
    if (css || typeof document === "undefined") return;
    var st = document.createElement("style"); st.id = "zg-css"; st.textContent = CSS; document.head.appendChild(st); css = true;
  }

  /* The packet queue's page (hidden from the menus; builder.html registers it). A queued item keeps only the list of picture keys ("book/NN"), so it
     rebuilds exactly when printed. The same picture may be in the list more than once (copies), and pictures of different books may share a list. */
  var ACTIVITY = {
    id: "zentangle-gallery-page", name: "Zentangle coloring page", themed: false, hidden: true,
    desc: "A finished page from the Zentangle Gallery, kept exactly as drawn.",
    icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 8l4-3 4 3M8 12l4-3 4 3M8 16l4-3 4 3"/></svg>',
    plan: function (cfg, rng, count) { var p = ((cfg.opts || {}).pages || []).filter(function (k) { return /^[a-z0-9-]+\/\d\d$/.test(k); }), out = [], i; for (i = 0; i < count; i++) out.push(p[i % Math.max(1, p.length)] || "dogs/01"); return out; },
    generate: function (cfg, rng, id) {
      ensureCss(); var m = /^([a-z0-9-]+)\/(\d\d)$/.exec(String(id)) || [0, "dogs", "01"];
      return { layout: "cc", sheet: '<section class="sheet sheet-zg" data-shell="1" aria-label="Zentangle coloring page"><img alt="" src="' + BASE + m[1] + "/" + m[2] + '.webp"></section>',
        title: "Zentangle coloring page", instructions: "", html: "", signature: "zg#" + id };
    }
  };

  function sheet(dataUrl) {
    /* one page: the picture alone, inside the 0.5 in margins and the 0.75 in binding gutter, black on white */
    return { html: '<section class="lp-sheet lp-recto zg-sheet" style="padding-top:.5in;padding-bottom:.5in"><img alt="" src="' + dataUrl + '" style="display:block;width:100%;height:100%;object-fit:contain"></section>' };
  }
  function toDataUrl(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(url); return r.blob(); }).then(function (b) {
      return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = rej; fr.readAsDataURL(b); });
    });
  }

  function groupsOf(m) {
    var order = [], by = {};
    m.books.forEach(function (b) { if (!by[b.group]) { by[b.group] = []; order.push(b.group); } by[b.group].push(b); });
    return order.map(function (g) { return { name: g, books: by[g] }; });
  }

  function render(view, arg, deps) {
    deps = deps || {};
    ensureCss();
    view.innerHTML = '<div class="zg"><h1 tabindex="-1">Zentangle Gallery</h1><p class="zg-lead" role="status">Loading the books…</p></div>';
    load().then(function (m) {
      var book = arg ? m.books.filter(function (b) { return b.slug === arg; })[0] : null;
      if (book) renderBook(view, m, book, deps); else renderShelf(view, m);
      var h = view.querySelector("h1"); if (h) h.focus({ preventScroll: true });
    }).catch(function () {
      view.innerHTML = '<div class="zg"><h1 tabindex="-1">Zentangle Gallery</h1><p class="zg-lead">The books could not be loaded. Reload the page and try again.</p></div>';
    });
  }

  function renderShelf(view, m) {
    var total = m.books.reduce(function (n, b) { return n + b.pages; }, 0);
    view.innerHTML = '<div class="zg"><h1 tabindex="-1">Zentangle Gallery</h1>' +
      '<p class="zg-lead">' + m.books.length + ' coloring books, ' + total + ' finished pictures, kept exactly as they were drawn. Choose a book, choose the pages, and print them.</p>' +
      '<p class="zg-note"><b>About these pictures.</b> They are finely detailed: the most detailed kind of page, drawn for people who enjoy small spaces and a long, quiet session. For a resident who needs larger areas and bolder lines, use Cognicopia Coloring, which has three levels of the same picture. Printing the pages counts as one packet.</p>' +
      groupsOf(m).map(function (g) {
        return '<h2 class="zg-group">' + esc(g.name) + '</h2><ul class="zg-books">' + g.books.map(function (b) {
          return '<li><button type="button" class="zg-book" data-zg-book="' + esc(b.slug) + '"><img src="' + thumbUrl(b.slug, 1) + '" alt="" loading="lazy" width="240" height="320">' +
            '<b>' + esc(b.title) + '</b><small>' + b.pages + ' pages</small>' + (b.note ? '<span class="zg-tag">' + esc(b.note) + '</span>' : '') + '</button></li>';
        }).join("") + '</ul>';
      }).join("") + '</div>';
    view_on(view, function (e) {
      var b = e.target.closest && e.target.closest("[data-zg-book]"); if (b) location.hash = "#/zentangle/" + encodeURIComponent(b.dataset.zgBook);
    });
  }

  function view_on(view, fn) {
    if (view._zg) view.removeEventListener("click", view._zg);
    view._zg = fn; view.addEventListener("click", fn);
  }

  function renderBook(view, m, book, deps) {
    var picked = {}, n = book.pages, busy = false;
    function count() { return Object.keys(picked).length; }
    function paint() {
      var c = count();
      view.querySelectorAll("[data-zg-pg]").forEach(function (b) {
        var on = !!picked[b.dataset.zgPg]; b.setAttribute("aria-pressed", String(on));
        var s = b.parentNode.querySelector(".zg-sel"); if (s) s.textContent = on ? "Selected" : "";
      });
      var p = view.querySelector("[data-zg-print]"); if (p) { p.disabled = !c || busy; p.textContent = c ? "Print " + c + (c === 1 ? " page" : " pages") : "Print the chosen pages"; }
      var ad = view.querySelector("[data-zg-add]"); if (ad) { ad.disabled = !c; ad.textContent = c ? "Add " + c + (c === 1 ? " page" : " pages") + " to the packet" : "Add the chosen pages to the packet"; }
      var cl = view.querySelector("[data-zg-clear]"); if (cl) cl.disabled = !c;
    }
    var cells = ""; for (var i = 1; i <= n; i++) {
      cells += '<li class="zg-cell"><button type="button" class="zg-thumb" data-zg-pg="' + i + '" aria-pressed="false" aria-label="Page ' + i + ' of ' + n + '"><img src="' + thumbUrl(book.slug, i) + '" alt="" loading="lazy" width="240" height="320"></button>' +
        '<span class="zg-sel" aria-hidden="true"></span><button type="button" class="zg-btn" data-zg-look="' + i + '">Look closer</button></li>';
    }
    view.innerHTML = '<div class="zg"><p><a href="#/zentangle" class="zg-btn" style="display:inline-flex;align-items:center;text-decoration:none">All books</a></p>' +
      '<h1 tabindex="-1">' + esc(book.title) + '</h1><p class="zg-lead">' + n + ' pages, exactly as drawn. Press a picture to choose it; press it again to take it back.</p>' +
      (book.note ? '<p class="zg-note"><b>' + esc(book.note) + '.</b> ' + esc(book.why || "") + '</p>' : "") +
      '<div class="zg-bar"><button type="button" class="zg-btn" data-zg-all>Choose every page</button><button type="button" class="zg-btn" data-zg-clear disabled>Clear</button>' +
      '<button type="button" class="zg-btn zg-primary" data-zg-add disabled>Add the chosen pages to the packet</button>' +
      '<label class="zg-copies" for="zgCopies">Copies of each <select id="zgCopies">' + [1, 2, 3, 4, 5, 6].map(function (n) { return '<option value="' + n + '">' + n + '</option>'; }).join("") + '</select></label>' +
      '<button type="button" class="zg-btn" data-zg-print disabled>Print the chosen pages</button></div><p class="zg-msg" role="status" id="zgMsg"></p>' +
      '<ul class="zg-pages">' + cells + '</ul><dialog class="zg-dlg" id="zgDlg" aria-label="One page, larger"><img alt="" id="zgBig"><p style="margin:10px 0 0"><button type="button" class="zg-btn" data-zg-close>Close</button></p></dialog></div>';
    view_on(view, function (e) {
      var t = e.target.closest ? e.target.closest("button") : null; if (!t) return;
      if (t.dataset.zgPg) { var k = t.dataset.zgPg; if (picked[k]) delete picked[k]; else picked[k] = 1; paint(); return; }
      if (t.hasAttribute("data-zg-all")) { for (var j = 1; j <= n; j++) picked[j] = 1; paint(); return; }
      if (t.hasAttribute("data-zg-clear")) { picked = {}; paint(); return; }
      if (t.dataset.zgLook) { var d = view.querySelector("#zgDlg"), im = view.querySelector("#zgBig"); im.src = pageUrl(book.slug, +t.dataset.zgLook); d.showModal(); d.querySelector("[data-zg-close]").focus(); return; }
      if (t.hasAttribute("data-zg-close")) { view.querySelector("#zgDlg").close(); return; }
      if (t.hasAttribute("data-zg-add")) {
        var keys = Object.keys(picked).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return book.slug + "/" + pad(k); }), sel = view.querySelector("#zgCopies"), copies = Math.max(1, Math.min(6, +(sel && sel.value) || 1));
        var made = deps.queue ? deps.queue(keys, copies) : 0, am = view.querySelector("#zgMsg");
        am.textContent = made ? "Added " + made + (made === 1 ? " page" : " pages") + " to the packet. You can keep adding pages from this book or another, then open the packet to print them all together." : "";
        if (made && deps.openPacket) { var ob = document.createElement("button"); ob.type = "button"; ob.className = "zg-btn"; ob.textContent = "Open the packet"; ob.addEventListener("click", deps.openPacket); am.appendChild(document.createTextNode(" ")); am.appendChild(ob); }
        return;
      }
      if (t.hasAttribute("data-zg-print")) {
        var list = Object.keys(picked).map(Number).sort(function (a, b) { return a - b; }); if (!list.length || busy) return;
        busy = true; paint(); var msg = view.querySelector("#zgMsg"); msg.textContent = "Getting " + list.length + (list.length === 1 ? " page" : " pages") + " ready…";
        Promise.all(list.map(function (k) { return toDataUrl(pageUrl(book.slug, k)); })).then(function (urls) {
          var print = deps.print || (root.BookUI && root.BookUI.print);
          var okp = print ? print(urls.map(sheet), "Zentangle " + book.title + " (" + list.length + (list.length === 1 ? " page)" : " pages)")) : false;
          msg.textContent = okp ? "Sent to the printer window." : "";
        }).catch(function () { msg.textContent = "A page could not be read. Reload and try again."; }).then(function () { busy = false; paint(); });
      }
    });
    paint();
  }

  root.CogniZentangle = { render: render, ACTIVITY: ACTIVITY, sheet: sheet, pageUrl: pageUrl, thumbUrl: thumbUrl };
  if (typeof module !== "undefined" && module.exports) module.exports = root.CogniZentangle;
})(typeof window !== "undefined" ? window : globalThis);
