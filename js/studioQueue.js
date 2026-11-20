/* Studio pages in the Packet Builder's packet queue (hand-written; loaded by activity-studio.html and builder.html).

   The Activity Page Studio makes finished pages (each an SVG, as the Studio prints them). "Add to the packet" there puts those pages in the same queue the
   Packet Builder prints from (the sealed store's "cgb_queue"), for the resident chosen in the Studio, once or in copies. A queued Studio page keeps its own
   finished SVG, so it prints exactly as it was seen and needs no engine to be rebuilt; the queue's other pages are unchanged. Nothing is sent anywhere.
   Adding spends no free packet: printing the packet does, as it always has.

   In the Studio:   CogniStudioQueue.add(svgs, { residentName, copies })  -> how many pages were added
   In the builder:  ACTIVITY is registered with the other activities (it is hidden from the menus) and draws one queued page as one sheet, inside the 0.5 in
                    margins and the 0.75 in binding gutter, with no staff tip or foot on it. A tab that already has the Packet Builder open keeps its own list
                    until it is reloaded; the page says so. */
(function (root) {
  "use strict";
  if (root.CogniStudioQueue) return;
  var KEY = "cgb_queue", ID = "studio-page-queued", MAX_COPIES = 6;
  var CSS = ".sheet.sheet-zg{display:block;padding:.5in .5in .5in .75in}.sheet-zg .zg-svg{width:7.25in;height:9.66in;overflow:hidden}.sheet-zg .zg-svg > svg{display:block;width:100%;height:100%}";
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

  /* svgs: the finished pages (strings); o: { residentName, copies (1 to 6), titles (optional, one per page), date, era } */
  function add(svgs, o) {
    o = o || {}; var ls = storage(); if (!ls || !svgs || !svgs.length) return 0;
    var copies = Math.max(1, Math.min(MAX_COPIES, o.copies | 0 || 1)), list = [], now = new Date(), day = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
    var cur = []; try { cur = JSON.parse(ls.getItem(KEY) || "[]") || []; } catch (e) { cur = []; }
    svgs.forEach(function (svg, i) {
      for (var c = 0; c < copies; c++) {
        var seed = (Math.floor(Math.random() * 2147483000) + 1) >>> 0;
        list.push({ uid: uid(), activityId: ID, batchSeed: seed, count: 1, index: 0,
          cfg: { residentName: String(o.residentName || "").slice(0, 40), date: o.date || day, difficulty: "moderate", era: o.era || "", opts: { svg: svg, title: (o.titles && o.titles[i]) || "Studio page", sig: i + "-" + c + "-" + seed } } });
      }
    });
    try { ls.setItem(KEY, JSON.stringify(cur.concat(list))); } catch (e) { return 0; }
    if (root.CogniSecureStore && root.CogniSecureStore.flush) { try { root.CogniSecureStore.flush(); } catch (e) { /* the store saves on its own timer too */ } }
    return list.length;
  }

  root.CogniStudioQueue = { ACTIVITY: ACTIVITY, add: add, KEY: KEY, MAX_COPIES: MAX_COPIES };
  if (typeof module !== "undefined" && module.exports) module.exports = root.CogniStudioQueue;
})(typeof window !== "undefined" ? window : globalThis);
