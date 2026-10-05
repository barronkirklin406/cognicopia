/* =====================================================================
   Line-art rasterizer and meter for coloring pages, for Node scripts.
   The drawing and measuring code lives in assets/cognicore/quality.js, so
   the browser (Packet Builder, page generator) and these scripts measure
   with the same file: it turns a drawing into a 1-bit bitmap (the way it
   prints), then measures what a person coloring it meets: the enclosed
   areas to color, the smallest of them in square inches, ink coverage,
   how much of the box the subject fills, the printed line thickness and
   the open white space. Used for the catalog's visual-complexity numbers,
   the tier checks, the page generator and the ingest pipeline.

   A drawing here is a list of shapes in pixel space, painted in order:
     { subpaths:[{ pts:[[x,y],...], closed:true }], fill: 0 | 1 | null, stroke: px }
   fill 0 paints white (hides what is behind), 1 paints black, null none.
   Node built-ins only.
   ===================================================================== */
import { loadCogniCore } from "./cognicore.mjs";

const Q = loadCogniCore().C.quality;
export const createBitmap = Q.createBitmap;
export const paint = Q.paint;
export const measure = Q.measure;
export const strokeStats = Q.strokeStats;
export const measureRender = Q.measureRender;
/* r: CogniCore.render(...) result; the picture printed widthIn wide at dpi. */
export function shapesFromRender(C, r, o){ return Q.shapesFromRender(r, o); }

/* ---------- helpers for the ingest pipeline ---------- */
/* Grow ink by r pixels (a round brush): thickens lines that are too thin. */
export function dilate(bmp, r){
  const { w, h, px } = bmp, out = new Uint8Array(px), offs = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) offs.push([dx, dy]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    if (!px[y * w + x]) continue;
    for (const [dx, dy] of offs){ const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) out[yy * w + xx] = 1; }
  }
  return { w, h, px: out };
}
/* Remove specks: ink blobs smaller than minPx become white, and white holes
   smaller than minPx become ink (both read as noise, not drawing). */
export function despeckle(bmp, minPx){
  const { w, h, px } = bmp, N = w * h, lab = new Int32Array(N), stack = new Int32Array(N);
  for (const val of [1, 0]){
    lab.fill(0); const area = [0], edge = [false]; let id = 0;
    for (let i = 0; i < N; i++){
      if (px[i] !== val || lab[i]) continue;
      id++; let top = 0, a = 0, e = false; stack[top++] = i; lab[i] = id;
      while (top){ const j = stack[--top]; a++; const x = j % w, y = (j / w) | 0;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) e = true;
        if (x > 0 && px[j - 1] === val && !lab[j - 1]){ lab[j - 1] = id; stack[top++] = j - 1; }
        if (x < w - 1 && px[j + 1] === val && !lab[j + 1]){ lab[j + 1] = id; stack[top++] = j + 1; }
        if (y > 0 && px[j - w] === val && !lab[j - w]){ lab[j - w] = id; stack[top++] = j - w; }
        if (y < h - 1 && px[j + w] === val && !lab[j + w]){ lab[j + w] = id; stack[top++] = j + w; }
      }
      area.push(a); edge.push(e);
    }
    for (let i = 0; i < N; i++){ const l = lab[i]; if (l && area[l] <= minPx && !(val === 0 && edge[l])) px[i] = 1 - val; }
  }
  return bmp;
}
