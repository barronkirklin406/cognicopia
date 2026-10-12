/* =====================================================================
   Line-art masters, for Node scripts: a picture from an image generator,
   a scanner or an illustrator (PNG of any kind, or SVG) made into the
   clean black-and-white bitmap the tracer reads: pure ink on paper, the
   drawing cropped, centered on a 3:4 page with a margin, specks gone.
   The master is 6 x 8 in at 300 DPI (1800 x 2400 pixels); everything
   after this works in that space (scripts/lib/trace.mjs).
   Node built-ins only.
   ===================================================================== */
import { decodePNG } from "./png.mjs";
import { createBitmap, paint, despeckle } from "./raster.mjs";
import { parseSVG, fitShapes } from "./svg-raster.mjs";

export const CANVAS = { dpi: 300, widthIn: 6, heightIn: 8, w: 1800, h: 2400, margin: .05 };

/* The threshold between ink and paper (Otsu), kept between 60 and 200 of 255. */
export function otsu(gray){
  const hist = new Float64Array(256); for (const v of gray) hist[v]++;
  const total = gray.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, t = 128;
  for (let i = 0; i < 256; i++){
    wB += hist[i]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best){ best = between; t = i; }
  }
  return Math.min(200, Math.max(60, t + 1));
}

/* The share of the page in mid grays: shading, soft gradients, gray fills. */
export function grayShare(gray){ let n = 0; for (const v of gray) if (v > 70 && v < 185) n++; return n / gray.length; }

export function inkBox(bmp){
  const { w, h, px } = bmp; let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[y * w + x]){ if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/* Resample the gray picture's box into a w x h canvas (3:4), centered with a
   margin, then threshold: area averaging when shrinking, bilinear when growing. */
export function placeGray(src, box, w, h, margin, thr){
  const bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1;
  const k = Math.min(w * (1 - 2 * margin) / bw, h * (1 - 2 * margin) / bh);
  const ox = (w - bw * k) / 2, oy = (h - bh * k) / 2, out = createBitmap(w, h), inv = 1 / k;
  const at = (x, y) => (x < 0 || y < 0 || x >= src.w || y >= src.h) ? 255 : src.gray[y * src.w + x];
  for (let y = 0; y < h; y++){
    const sy = (y + .5 - oy) * inv + box.y0 - .5;
    for (let x = 0; x < w; x++){
      const sx = (x + .5 - ox) * inv + box.x0 - .5;
      let v;
      if (inv > 1){                                           // shrinking: average the source pixels under this one
        let s = 0, n = 0; const r = inv / 2;
        for (let yy = Math.floor(sy - r + .5); yy <= Math.floor(sy + r + .5); yy++) for (let xx = Math.floor(sx - r + .5); xx <= Math.floor(sx + r + .5); xx++){ s += at(xx, yy); n++; }
        v = s / n;
      } else {
        const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
        v = at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
      }
      if (v < thr) out.px[y * w + x] = 1;
    }
  }
  return out;
}

/**
 * Make a master from a file's bytes.
 * input: { png: Buffer } or { svg: string }.
 * Returns { bmp, notes, fixes, srcSize, format } or { error } when there is no drawing.
 *   notes  what is wrong with the picture itself (color, gray shading, text elements...)
 *   fixes  what was done to it
 */
export function prepareMaster(input){
  const { w: W, h: H } = CANVAS, notes = [], fixes = [];
  if (input.png){
    const img = decodePNG(input.png);
    if (img.colorFraction > .002) notes.push(`color in ${(img.colorFraction * 100).toFixed(1)}% of the picture`);
    const gs = grayShare(img.gray);
    if (gs > .03) notes.push(`gray shading in ${(gs * 100).toFixed(1)}% of the picture`);
    const thr = otsu(img.gray);
    const bin = createBitmap(img.w, img.h); for (let i = 0; i < img.gray.length; i++) if (img.gray[i] < thr) bin.px[i] = 1;
    despeckle(bin, Math.max(4, Math.round(img.w * img.h * 2e-6)));
    const box = inkBox(bin);
    if (!box) return { error: "no drawing found" };
    const bmp = placeGray(img, box, W, H, CANVAS.margin, thr);
    fixes.push(`thresholded at ${thr} (Otsu) to pure black and white`, "cropped to the drawing and centered on a 3:4 page");
    if (Math.abs(img.w / img.h - .75) > .02) fixes.push(`reframed from ${img.w} x ${img.h} (${(img.w / img.h).toFixed(2)}) to 3:4`);
    despeckle(bmp, Math.round(CANVAS.dpi * CANVAS.dpi * .0004)); fixes.push("removed specks and pinholes");
    return { bmp, notes, fixes, srcSize: [img.w, img.h], format: "png" };
  }
  const parsed = parseSVG(input.svg);
  parsed.notes.forEach(n => notes.push(n));
  const fit = fitShapes(parsed, W, H, { margin: CANVAS.margin, minStrokePx: 12 });
  const bmp = paint(createBitmap(W, H), fit.shapes);
  if (!bmp.px.some(v => v)) return { error: "no drawing found" };
  despeckle(bmp, Math.round(CANVAS.dpi * CANVAS.dpi * .0004));
  fixes.push("fills set to white (or black where they were near-black) and every line to pure black", "cropped to the drawing and centered on a 3:4 page", "removed specks and pinholes");
  return { bmp, notes, fixes, srcSize: [parsed.viewBox[2], parsed.viewBox[3]], format: "svg" };
}
