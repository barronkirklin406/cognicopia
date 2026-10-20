/* =====================================================================
   How many shapes can be colored in each library picture, as the tablet's Color a Picture finds them.
   It draws every picture the way each stage draws it (the stage's level of detail and line weight, then the engine's extra bold
   lines inside the big shapes, then one level less detail if there are still too many to color) in a real browser, and counts the
   shapes with the tablet's own finder (CognicopiaTablet.regions), leaving out the page outside the picture.

     node scripts/measure-tablet-color.mjs         prints the pictures too sparse to offer (js/tabletBanks.js COLOR_SKIP)

   scripts/check-tablet-ui.mjs uses the same measurement to prove that list is current. No network: the page is served from this
   repository on a local port.
   ===================================================================== */
export const MIN_SHAPES = 3, MAX_SHAPES = 90;

/* page: a browser page with tablet.html open. Returns { id: { cat, sensitive, early, middle, late } } for every picture in the library,
   each stage a count of shapes. */
export async function measure(page) {
  return page.evaluate(async () => {
    await new Promise(ok => { if (window.CognicopiaColoring) return ok(); const s = document.createElement("script"); s.src = "assets/cognicopia-coloring/cognicopia-coloring.js"; s.onload = ok; document.head.appendChild(s); });
    const C = window.CognicopiaColoring, T = window.CognicopiaTablet, out = {};
    const count = async (id, tier, look) => {
      const svg = C.toSVG(C.render(id, tier), { standalone: true, widthIn: 6.25, label: "", weight: look.weight });
      const im = new Image(); await new Promise((ok, no) => { im.onload = ok; im.onerror = no; im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
      const cv = document.createElement("canvas"); cv.width = 600; cv.height = 800; const g = cv.getContext("2d", { willReadFrequently: true });
      g.fillStyle = "#fff"; g.fillRect(0, 0, 600, 800); g.drawImage(im, 0, 0, 600, 800);
      const px = g.getImageData(0, 0, 600, 800); T.enrich(px.data, 600, 800, look.enrich);
      const r = T.regions(px.data, 600, 800, 700); return r.count - (r.bg ? 1 : 0);
    };
    for (const d of C.designs()) {
      out[d.id] = { cat: d.cat, sensitive: !!(d.sensitive && d.sensitive.length) };
      for (const st of ["early", "middle", "late"]) {
        const look = T.STAGES[st].color; let tier = look.tier, n = await count(d.id, tier, look);
        while (n > T.MAX_SHAPES && tier < 3) n = await count(d.id, ++tier, look);
        out[d.id][st] = n;
      }
    }
    return out;
  });
}
/* the pictures the tablet offers (the engine leaves out mandalas and anything marked sensitive) that have fewer shapes than MIN_SHAPES at any stage */
export const sparse = m => Object.keys(m).filter(id => m[id].cat !== "zentangle-mandalas" && !m[id].sensitive && Math.min(m[id].early, m[id].middle, m[id].late) < MIN_SHAPES).sort();
