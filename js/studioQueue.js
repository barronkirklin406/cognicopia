/* Studio pages in the Packet Builder's packet queue (hand-written; loaded by activity-studio.html and builder.html).

   The Activity Page Studio makes finished pages (each an SVG, as the Studio prints them). "Add to the packet" there puts those pages in the same queue the
   Packet Builder prints from (the sealed store's "cgb_queue"), for the resident chosen in the Studio, once or in copies. A queued Studio page keeps its own
   finished SVG, so it prints exactly as it was seen and needs no engine to be rebuilt; the queue's other pages are unchanged. Nothing is sent anywhere.
   Adding spends no free packet: printing the packet does, as it always has.

   In the Studio and on Daily engagement:   CogniStudioQueue.add(svgs, { residentName, copies })  -> how many pages were added (a Studio page or a Daily card)
                    CogniStudioQueue.addCircle(html, { })  -> the group circle's leader script (a staff page)
   In the builder:  ACTIVITY is registered with the other activities (it is hidden from the menus) and draws one queued page as one sheet, inside the 0.5 in
                    margins and the 0.75 in binding gutter, with no staff tip or foot on it. A tab that already has the Packet Builder open keeps its own list
                    until it is reloaded; the page says so. */
(function (root) {
  "use strict";
  if (root.CogniStudioQueue) return;
  var KEY = "cgb_queue", ID = "studio-page-queued", MAX_COPIES = 6;
  var CSS = ".sheet.sheet-gc{display:block;padding:.5in .5in .5in .75in;color:#000;background:#fff}.sheet-gc .cg-staff-sheet{font:16pt/1.3 \"Atkinson Hyperlegible\",sans-serif;color:#000}.sheet-gc .cg-staff-sheet h1{margin:0 0 8pt;font:700 28pt/1.1 \"Fraunces\",serif;border-bottom:2.5pt solid #000;padding-bottom:6pt}.sheet-gc .cg-staff-sheet h3{margin:10pt 0 2pt;font-size:18pt}.sheet-gc .cg-staff-sheet p,.sheet-gc .cg-staff-sheet li{margin:0;font-size:16pt}.sheet-gc .cg-calm-avoid{border:2pt solid #000;padding:4pt 8pt;margin-top:8pt}.sheet-gc .cg-calm-kick{margin:0;font-weight:700;text-transform:uppercase}.sheet.sheet-zg{display:block;padding:.5in .5in .5in .75in}.q-item .thumb .lp-sheet ~ .lp-sheet{display:none}.sheet-gc .cg-calm-lede{margin:6pt 0}.sheet-gc .cg-calm-protocol{margin-top:10pt}.sheet-gc .cg-calm-foot{margin-top:10pt;font-size:12pt}.sheet-gc ul{margin:0;padding-left:.25in}.sheet-zg .zg-svg{width:7.25in;height:9.66in;overflow:hidden}.sheet-zg .zg-svg > svg{display:block;width:100%;height:100%}";
  function ensureCss() {
    if (typeof document === "undefined" || document.getElementById("zg-sheet-css")) return;
    var st = document.createElement("style"); st.id = "zg-sheet-css"; st.textContent = CSS; (document.head || document.documentElement).appendChild(st);
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function storage() {
    var ss = root.CogniSecureStore; if (ss && ss.storage) return ss.storage;
    try { return root.localStorage; } catch (e) { return null; }
  }

  var ACTIVITY = {
    id: ID, name: "Studio page", themed: false, hidden: true,
    desc: "A finished page from the Activity Page Studio, kept exactly as it was made.",
    icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>',
    plan: function (cfg, rng, count) { var out = [], i; for (i = 0; i < count; i++) out.push("studio#" + i); return out; },
    generate: function (cfg, rng, id) {
      ensureCss(); var o = cfg.opts || {}, svg = String(o.svg || "");
      return { layout: "cc", sheet: '<section class="sheet sheet-zg" data-shell="1" aria-label="' + String(o.title || "Studio page").replace(/"/g, "") + '"><div class="zg-svg">' + svg + "</div></section>",
        title: String(o.title || "Studio page"), instructions: "", html: "", signature: "sq#" + String(o.sig || id) };
    }
  };

  /* the group circle's leader script (js/groupCircle.js): one staff page of HTML. It is a staff document, so a packet made only of staff pages never asks for
     or spends a free packet (builder.html reads ACTIVITY.staff). Its styles are the shared sheet's (.cg-staff-sheet in css/styles.css). */
  var CIRCLE = {
    id: "group-circle-queued", name: "Group circle script", themed: false, hidden: true, staff: true,
    desc: "A leader's script for a small group, from Daily engagement. A staff page.",
    icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="6" r="1.5"/><circle cx="17.5" cy="14" r="1.5"/><circle cx="6.5" cy="14" r="1.5"/></svg>',
    plan: function (cfg, rng, count) { var out = [], i; for (i = 0; i < count; i++) out.push("circle#" + i); return out; },
    generate: function (cfg, rng, id) {
      ensureCss(); var o = cfg.opts || {};
      return { layout: "cc", sheet: '<section class="sheet sheet-gc" data-shell="1" aria-label="Group circle script">' + String(o.html || "") + "</section>",
        title: String(o.title || "Group circle script"), instructions: "", html: "", signature: "gc#" + String(o.sig || id) };
    }
  };

  /* Calm now (js/calmNow.js): one staff page for one resident, HTML from CogniCalmNow.sheetHtml. A staff document, like the circle's script. */
  var CALM = {
    id: "calm-now-queued", name: "Calm now card", themed: false, hidden: true, staff: true,
    desc: "What is already known about a resident, for the person sitting with them when they are upset. A staff page.",
    icon: CIRCLE.icon,
    plan: CIRCLE.plan,
    generate: function (cfg, rng, id) {
      ensureCss(); var o = cfg.opts || {};
      return { layout: "cc", sheet: '<section class="sheet sheet-gc" data-shell="1" aria-label="Calm now card">' + String(o.html || "") + "</section>",
        title: String(o.title || "Calm now card"), instructions: "", html: "", signature: "cn#" + String(o.sig || id) };
    }
  };
  /* a planner or a journal (the Packet Builder's own books): the finished pages, as the book made them, kept as one queue item. Every page keeps its own
     margins, gutter and page number; the queue prints them in pure black and white like every other page of a packet. */
  var BOOK = {
    id: "book-pages-queued", name: "Planner or journal pages", themed: false, hidden: true,
    desc: "Pages of a 12-month life planner or a life journal, kept as they were made.",
    icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 3v18M12 8h5M12 12h5"/></svg>',
    plan: function (cfg, rng, count) { var out = [], i; for (i = 0; i < count; i++) out.push("book#" + i); return out; },
    generate: function (cfg, rng, id) {
      ensureCss(); var o = cfg.opts || {}, pages = (o.pages || []).map(String);
      if (pages.length && pages[0].indexOf('data-shell="1"') < 0) pages[0] = pages[0].replace(/<section /, '<section data-shell="1" ');      // the book's own pages carry no engine tip or foot
      return { layout: "cc", sheet: pages.join(""), title: String(o.title || "Planner or journal pages"), instructions: "", html: "", signature: "bk#" + String(o.sig || id) };
    }
  };

  /* queue items for one activity: opts is the list of each page's own options; o: { residentName, copies (1 to 6), date, era } */
  function push(activityId, optsList, o) {
    o = o || {}; var ls = storage(); if (!ls || !optsList || !optsList.length) return 0;
    var live = root.CogniStudioQueue && root.CogniStudioQueue.bridge;               // the Packet Builder, when this page is the Packet Builder: its own list is the live one
    var copies = Math.max(1, Math.min(MAX_COPIES, o.copies | 0 || 1)), list = [], now = new Date(), day = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
    var cur = []; try { cur = JSON.parse(ls.getItem(KEY) || "[]") || []; } catch (e) { cur = []; }
    optsList.forEach(function (op, i) {
      for (var c = 0; c < copies; c++) {
        var seed = (Math.floor(Math.random() * 2147483000) + 1) >>> 0;
        list.push({ uid: uid(), activityId: activityId, batchSeed: seed, count: 1, index: 0,
          cfg: { residentName: String(o.residentName || "").slice(0, 40), date: o.date || day, difficulty: "moderate", era: o.era || "", opts: Object.assign({}, op, { sig: i + "-" + c + "-" + seed }) } });
      }
    });
    if (live) { try { live(list); } catch (e) { return 0; } return list.length; }
    try { ls.setItem(KEY, JSON.stringify(cur.concat(list))); } catch (e) { return 0; }
    if (root.CogniSecureStore && root.CogniSecureStore.flush) { try { root.CogniSecureStore.flush(); } catch (e) { /* the store saves on its own timer too */ } }
    return list.length;
  }
  /* svgs: the finished pages (strings: a Studio page, a Daily card); o: { residentName, copies, titles (optional, one per page) } */
  function add(svgs, o) { o = o || {}; return push(ID, (svgs || []).map(function (svg, i) { return { svg: svg, title: (o.titles && o.titles[i]) || "Studio page" }; }), o); }
  /* a Calm now card (HTML from CogniCalmNow.sheetHtml); o: { residentName, title } */
  function addCalm(html, o) { o = Object.assign({}, o, { copies: 1 }); return push(CALM.id, [{ html: html, title: o.title || "Calm now card" }], o); }
  /* a planner's or journal's pages (each an HTML string); o: { residentName, title, copies } */
  function addBook(pages, o) { o = o || {}; return push(BOOK.id, [{ pages: pages, title: o.title || "Planner or journal pages" }], o); }
  /* the group circle script (HTML from CogniGroupCircle.pageHtml) */
  function addCircle(html, o) { o = Object.assign({}, o, { copies: 1 }); return push(CIRCLE.id, [{ html: html, title: o.title || "Group circle script" }], o); }

  root.CogniStudioQueue = { ACTIVITY: ACTIVITY, CIRCLE: CIRCLE, CALM: CALM, BOOK: BOOK, add: add, addCircle: addCircle, addCalm: addCalm, addBook: addBook, bridge: null, KEY: KEY, MAX_COPIES: MAX_COPIES };
  if (typeof module !== "undefined" && module.exports) module.exports = root.CogniStudioQueue;
})(typeof window !== "undefined" ? window : globalThis);
