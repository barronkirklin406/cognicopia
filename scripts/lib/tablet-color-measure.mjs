/* =====================================================================
   How many shapes can be colored in each library picture, as the tablet's Color a Picture finds them.
   It draws every picture at the two detail levels the tablet uses (tiers 2 and 3) in a real browser and counts the shapes
   with the tablet's own finder (CognicopiaTablet.regions), leaving out the page outside the picture.

     node scripts/measure-tablet-color.mjs         prints the pictures too sparse to offer (js/tabletBanks.js COLOR_SKIP)

   scripts/check-tablet-ui.mjs uses the same measurement to prove that list is current. No network: the page is served from this
   repository on a local port.
   ===================================================================== */
export const MIN_SHAPES = 3, MAX_SHAPES = 90;

/* page: a browser page with tablet.html open. Returns { id: { 2: shapes, 3: shapes } } for every picture in the library. */
export async function measure(page) {
  return page.evaluate(async () => {
    await new Promise(ok => { if (window.CognicopiaColoring) return ok(); const s = document.createElement("script"); s.src = "assets/cognicopia-coloring/cognicopia-coloring.js"; s.onload = ok; document.head.appendChild(s); });
    const C = window.CognicopiaColoring, T = window.CognicopiaTablet, out = {};
    for (const d of C.designs()) {
      out[d.id] = { cat: d.cat, sensitive: !!(d.sensitive && d.sensitive.length) };
      for (const tier of [2, 3]) {
        const svg = C.toSVG(C.render(d.id, tier), { standalone: true, widthIn: 6.25, label: "" });
        const im = new Image(); await new Promise((ok, no) => { im.onload = ok; im.onerror = no; im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
        const cv = document.createElement("canvas"); cv.width = 600; cv.height = 800; const g = cv.getContext("2d", { willReadFrequently: true });
        g.fillStyle = "#fff"; g.fillRect(0, 0, 600, 800); g.drawImage(im, 0, 0, 600, 800);
        const r = T.regions(g.getImageData(0, 0, 600, 800).data, 600, 800, 700);
        out[d.id][tier] = r.count - (r.bg ? 1 : 0);
      }
    }
    return out;
  });
}
/* the pictures the tablet offers (the engine leaves out mandalas and anything marked sensitive) that have fewer shapes than MIN_SHAPES at either level */
export const sparse = m => Object.keys(m).filter(id => m[id].cat !== "zentangle-mandalas" && !m[id].sensitive && Math.min(m[id][2], m[id][3]) < MIN_SHAPES).sort();
