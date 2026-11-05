/* =====================================================================
   Stand-in masters, for Node scripts and tests: a library design drawn
   the way an image generator might hand it over, at 300 DPI on a 6 x 8 in
   canvas: lines of one weight, a little wander and variation in them, an
   anti-aliased edge, and (on request) specks, pinholes, a gray patch or
   a break in a line. The tracer and the ingest are tested on these
   because the right answer is known: the design they were drawn from.
   Node built-ins only.
   ===================================================================== */
import { createBitmap, paint, shapesFromRender } from "./raster.mjs";
import { encodeRGBPNG } from "./png.mjs";
import { loadCognicopiaColoring } from "./cognicopia-coloring.mjs";

function rng(seed){ let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * A design as a gray picture: { w, h, gray: Uint8Array (0 black .. 255 white) }.
 * o: tier (which tier of the design to draw, default 1), pt (line weight at 6 in wide, default 2.6),
 *    wobble (px of wander), vary (0..1, how much each line's weight varies), seed, noise (specks and pinholes),
 *    patch (a gray patch, like shading), gap (cut a gap of this many px in the longest line), size (width in px, default 1800).
 */
export function standInGray(id, o = {}){
  const { C } = loadCognicopiaColoring({ art: false });
  const tier = o.tier || 1, W = o.size || 1800, H = Math.round(W / .75), S = 2, dpi = W / 6, R = rng(o.seed || 1), pt = o.pt || 2.6, wob = o.wobble || 0;
  const r = C.render(id, tier);
  C.WEIGHTS.__t = { id: "__t", pt, detailPt: pt, px: pt / .75 };
  const shapes = shapesFromRender(C, r, { widthIn: 6, dpi: dpi * S, weight: "__t" });
  delete C.WEIGHTS.__t;
  const f1 = (.012 + R() * .01) / S, f2 = (.012 + R() * .01) / S, p1 = R() * 6, p2 = R() * 6;
  for (const s of shapes){
    if (o.vary) s.stroke = s.stroke * (1 + (R() - .5) * o.vary);
    if (wob) for (const sp of s.subpaths) sp.pts = sp.pts.map(p => [p[0] + wob * S * Math.sin(p[1] * f1 + p1), p[1] + wob * S * Math.sin(p[0] * f2 + p2)]);
  }
  if (o.gap){                                         // break the longest open stroke in two, leaving a gap of o.gap px
    let best = null, bestLen = 0;
    for (const s of shapes) if (s.stroke > 0) for (const sp of s.subpaths){ let L = 0; for (let i = 1; i < sp.pts.length; i++) L += Math.hypot(sp.pts[i][0] - sp.pts[i - 1][0], sp.pts[i][1] - sp.pts[i - 1][1]); if (L > bestLen){ bestLen = L; best = sp; } }
    if (best){
      const n = best.pts.length, mid = n >> 1, a = best.pts.slice(0, mid), b = best.pts.slice(mid);
      const cut = (pts, atEnd) => { // pull the end back by o.gap / 2 px (in supersampled pixels)
        let need = o.gap * S / 2; const q = pts.slice();
        while (q.length > 2 && need > 0){ const e = atEnd ? q[q.length - 1] : q[0], f = atEnd ? q[q.length - 2] : q[1], d = Math.hypot(e[0] - f[0], e[1] - f[1]); if (d <= need){ need -= d; atEnd ? q.pop() : q.shift(); } else { const t = need / d; if (atEnd) q[q.length - 1] = [e[0] + (f[0] - e[0]) * t, e[1] + (f[1] - e[1]) * t]; else q[0] = [e[0] + (f[0] - e[0]) * t, e[1] + (f[1] - e[1]) * t]; need = 0; } }
        return q;
      };
      best.pts = cut(a, true); best.closed = false;
      const owner = shapes.find(s => s.subpaths.includes(best));
      owner.subpaths.push({ pts: cut(b, false), closed: false }); owner.fill = owner.fill === 1 ? 0 : owner.fill;
    }
  }
  const big = paint(createBitmap(W * S, H * S), shapes);
  const gray = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
    let s = 0; for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) s += big.px[(y * S + dy) * W * S + x * S + dx];
    let v = 255 - Math.round(255 * s / (S * S));
    if (o.patch && x > W * .3 && x < W * .6 && y > H * .3 && y < H * .5 && v > 200) v = 140;
    gray[y * W + x] = v;
  }
  if (o.noise){
    for (let n = 0; n < o.noise; n++){
      const x = 5 + Math.floor(R() * (W - 10)), y = 5 + Math.floor(R() * (H - 10)), rad = 1 + Math.floor(R() * 3), v = R() < .5 ? 0 : 255;
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (dx * dx + dy * dy <= rad * rad) gray[(y + dy) * W + x + dx] = v;
    }
  }
  return { w: W, h: H, gray };
}

/* The same as a 1-bit master bitmap (ink = 1), as the ingest would hand it to the tracer. */
export function standIn(id, o = {}){
  const g = standInGray(id, o), bmp = createBitmap(g.w, g.h);
  for (let i = 0; i < g.gray.length; i++) if (g.gray[i] < 128) bmp.px[i] = 1;
  return bmp;
}

/* The same as a PNG file's bytes. */
export function standInPNG(id, o = {}){
  const g = standInGray(id, o), rgb = new Uint8Array(g.w * g.h * 3);
  for (let i = 0; i < g.gray.length; i++) rgb.fill(g.gray[i], i * 3, i * 3 + 3);
  return encodeRGBPNG({ w: g.w, h: g.h, rgb });
}
