/* =====================================================================
   The local art agent's own parts, for Node scripts: everything between
   "a picture came back from the picture engine" and "a master is in the
   inbox", none of which needs a picture model or the network.

     words      the clinical prompt wrapper (the same words as the Packet
                Builder's Describe a page tab), the words to keep out, and
                the hints a refining round adds for what went wrong;
     cleaning   a candidate made pure black and white with the owner's
                brightness rule (0.34 R + 0.5 G + 0.16 B under 200 is ink),
                a drawn border removed, cropped and centered on a 3:4 page
                of 1800 x 2400 (6 x 8 in at 300 dpi), and lines brought up
                to the 3 pt floor;
     scoring    the library ingest's own checks (run on each candidate in
                a dry run) turned into pass or fail and a score, so the
                best candidate wins and a failing round knows what to fix;
     the review page that shows every candidate and why one was chosen.

   scripts/local_art_agent.mjs drives them. Node built-ins only.
   ===================================================================== */
import { decodePNG, encodeBitPNG, encodeRGBPNG } from "./png.mjs";
import { prepareMaster, CANVAS } from "./master.mjs";
import { createBitmap, dilate, despeckle, paint, shapesFromRender } from "./raster.mjs";

/* ---------- the words ---------- */
export const PREFIX = "Minimalist bold-and-easy adult coloring book page of ";
export const SUFFIX = ", thick pure-black vector outlines, clean uncrowded composition, large fillable areas, solid pure white background, zero shading, zero gray tones, high contrast, 3:4 aspect ratio";
/* what the picture model is asked to leave out (kept short: most models read about 77 tokens) */
export const NEGATIVE = "color, gray, shading, gradient, photograph, texture, cross-hatching, sketchy lines, thin lines, tiny details, clutter, text, letters, numbers, watermark, signature, border, frame, cartoon face, childish, cute, blurry, noise";
/* what a refining round adds for each failed check */
export const HINTS = {
  "area-size": "fewer details, larger simple shapes",
  "fills-page": "close-up, the subject fills the page",
  "solid-black": "outlines only, no solid black areas",
  "pure-black-white": "pure line art, no shading",
  "traced-faithfully": "clean continuous unbroken lines",
  "closed-shapes": "every shape fully closed",
  "file-size": "simple drawing, fewer lines",
  "frame": "no border, no frame",
  "blank": "bold clear drawing of the whole subject",
  "dark": "white background, outlines only"
};
/* the library categories drawn best by the procedural renderer: exact geometry, already vector */
export const GEOMETRIC = ["bold-easy-patterns", "zentangle-mandalas"];

export function wrapPrompt(subject, hints){
  const s = String(subject || "").replace(/\s+/g, " ").trim().replace(/[.,;:!?]+$/, "").replace(/^(A|An|The)\s+(?=[a-z])/, m => m.toLowerCase());
  const extra = (hints || []).filter(Boolean);
  return PREFIX + s + (extra.length ? ", " + extra.join(", ") : "") + SUFFIX;
}
export function hintsFor(fails){ return [...new Set((fails || []).map(f => HINTS[f]).filter(Boolean))]; }
export function hashSeed(text){ let h = 2166136261; for (const ch of String(text)){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 1000000000; }

/* ---------- cleaning ---------- */
export const BRIGHTNESS = [.34, .5, .16], THRESHOLD = 200;
export const FLOOR_PT = 3, FLOOR_PX = FLOOR_PT / 72 * CANVAS.dpi;          // 3 pt at 300 dpi: 12.5 px
export const DOT_PX = Math.round(.002 * CANVAS.dpi * CANVAS.dpi);              // a stray dot or pinhole: under 0.002 sq in (180 px), too small to be drawing or to color

/* A picture's bytes as ink (1) and paper (0) at its own size, with the owner's brightness rule. */
export function binarize(png){
  const img = decodePNG(png, { weights: BRIGHTNESS }), bin = createBitmap(img.w, img.h);
  let gray = 0;
  for (let i = 0; i < img.gray.length; i++){ const v = img.gray[i]; if (v < THRESHOLD) bin.px[i] = 1; if (v > 70 && v < 185) gray++; }
  return { bin, w: img.w, h: img.h, colorFraction: img.colorFraction, grayShare: gray / img.gray.length };
}

/* Remove a drawn border: an ink piece that spans nearly the whole picture and lies almost entirely in a thin band along its
   edges (a frame drawn around the page). A drawing that reaches the edges, like a quilt's grid, has ink inside and stays.
   Returns how many were removed. */
export function removeFrame(bin){
  const { w, h, px } = bin, N = w * h, seen = new Uint8Array(N), stack = new Int32Array(N), band = Math.max(4, Math.round(Math.min(w, h) * .06));
  let removed = 0;
  for (let i = 0; i < N; i++){
    if (!px[i] || seen[i]) continue;
    let top = 0, n = 0, inner = 0, x0 = w, y0 = h, x1 = 0, y1 = 0; const members = [];
    stack[top++] = i; seen[i] = 1;
    while (top){
      const j = stack[--top], x = j % w, y = (j / w) | 0; n++; members.push(j);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (Math.min(x, y, w - 1 - x, h - 1 - y) > band) inner++;
      if (x > 0 && px[j - 1] && !seen[j - 1]){ seen[j - 1] = 1; stack[top++] = j - 1; }
      if (x < w - 1 && px[j + 1] && !seen[j + 1]){ seen[j + 1] = 1; stack[top++] = j + 1; }
      if (y > 0 && px[j - w] && !seen[j - w]){ seen[j - w] = 1; stack[top++] = j - w; }
      if (y < h - 1 && px[j + w] && !seen[j + w]){ seen[j + w] = 1; stack[top++] = j + w; }
    }
    if (x1 - x0 + 1 >= w * .9 && y1 - y0 + 1 >= h * .9 && inner <= n * .02){ for (const j of members) px[j] = 0; removed++; }
  }
  return removed;
}

/* Does the drawing still have a border round it? Ink along at least 85% of each of the four sides of the drawing's own box. */
export function hasBorder(bmp){
  const { w, h, px } = bmp; let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[y * w + x]){ if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return false;
  const t = Math.max(3, Math.round(Math.min(x1 - x0, y1 - y0) * .01)), cover = (n, test) => { let c = 0; for (let k = 0; k < n; k++) if (test(k)) c++; return c / n; };
  const rowInk = (k, ys) => ys.some(y => px[y * w + x0 + k]), colInk = (k, xs) => xs.some(x => px[(y0 + k) * w + x]);
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const top = range(y0, y0 + t), bottom = range(y1 - t, y1), left = range(x0, x0 + t), right = range(x1 - t, x1);
  return [cover(x1 - x0 + 1, k => rowInk(k, top)), cover(x1 - x0 + 1, k => rowInk(k, bottom)), cover(y1 - y0 + 1, k => colInk(k, left)), cover(y1 - y0 + 1, k => colInk(k, right))].every(v => v >= .85);
}

/* Does a library design's own drawing have an edge round the page (a quilt's outer seam, a window's frame)? Then a candidate's
   edge is part of the picture: it is kept, not taken for a drawn border. C is the coloring library. */
export function designHasEdge(C, id){
  const bmp = paint(createBitmap(450, 600), shapesFromRender(C, C.render(id, 1), { widthIn: 6, dpi: 75 }));
  const copy = { w: bmp.w, h: bmp.h, px: Uint8Array.from(bmp.px) };
  return removeFrame(copy) > 0 || hasBorder(bmp);
}

/* The thinnest lines, measured the way the Packet Builder's agent does: the lower tenth of the ink runs across every
   third row and column. { px, pt } on a page widthIn inches wide, or null when there is no ink. */
export function lineStats(bmp, widthIn = CANVAS.widthIn){
  const { w, h, px } = bmp, hist = new Uint32Array(256); let total = 0, run = 0;
  const bump = () => { hist[run > 255 ? 255 : run]++; total++; run = 0; };
  for (let y = 1; y < h; y += 3){ run = 0; for (let x = 0; x < w; x++){ if (px[y * w + x]) run++; else if (run) bump(); } if (run) bump(); }
  for (let x = 1; x < w; x += 3){ run = 0; for (let y = 0; y < h; y++){ if (px[y * w + x]) run++; else if (run) bump(); } if (run) bump(); }
  if (!total) return null;
  const want = Math.ceil(total * .1); let acc = 0, len = 1;
  for (; len < 255; len++){ acc += hist[len]; if (acc >= want) break; }
  return { px: len, pt: Math.round(len / (w / widthIn) * 72 * 100) / 100 };
}

/* A candidate picture made into a print master: { png (1-bit, 1800 x 2400, 300 dpi), bmp, notes, fixes, lines, ink } or { error, code }.
   o.allowBorder: an edge round the drawing is no fault (geometric patterns); o.keepEdge: the design's own edge, never removed. */
export function cleanCandidate(png, o = {}){
  let b;
  try { b = binarize(png); } catch (e){ return { error: "the picture could not be read: " + e.message, code: "blank" }; }
  const notes = [], fixes = [`made pure black and white (brightness 0.34 R + 0.5 G + 0.16 B under ${THRESHOLD} is ink)`];
  if (b.colorFraction > .002) notes.push(`color in ${(b.colorFraction * 100).toFixed(1)}% of the picture`);
  if (b.grayShare > .03) notes.push(`gray shading in ${(b.grayShare * 100).toFixed(1)}% of the picture`);
  const share = b.bin.px.reduce((n, v) => n + v, 0) / (b.w * b.h);
  if (share < .002) return { error: "the picture is nearly blank", code: "blank", notes };
  if (share > .45) return { error: "the picture is mostly dark", code: "dark", notes };
  const frames = o.keepEdge ? 0 : removeFrame(b.bin);
  if (frames) fixes.push(`removed ${frames === 1 ? "a drawn border" : frames + " drawn borders"}`);
  const prep = prepareMaster({ png: encodeBitPNG(b.bin, 300) });
  if (prep.error) return { error: prep.error, code: "blank", notes };
  fixes.push("cropped to the drawing and centered on a 3:4 page, 1800 x 2400 (6 x 8 in at 300 dpi)", "removed specks and pinholes");
  let bmp = despeckle(prep.bmp, DOT_PX), lines = lineStats(bmp);
  fixes.push("removed stray dots and filled pinholes smaller than 0.002 sq in (about 1.3 mm across)");
  if (lines && lines.px < FLOOR_PX * .95){
    const r = Math.ceil((FLOOR_PX - lines.px) / 2);
    bmp = dilate(bmp, r); lines = lineStats(bmp);
    fixes.push(`thickened the lines by ${r * 2} px to reach the ${FLOOR_PT} pt floor`);
  }
  const ink = bmp.px.reduce((n, v) => n + v, 0) / (bmp.w * bmp.h);
  if (!o.allowBorder && !o.keepEdge && hasBorder(bmp)) return { error: "the drawing has a border round it that could not be taken off", code: "frame", notes, png: encodeBitPNG(bmp, 300), fixes };
  return { png: encodeBitPNG(bmp, 300), bmp, notes, fixes, lines, ink, frames };
}

/* A small gray copy of a picture for the review page (about 300 px wide), as PNG bytes. */
export function thumbnail(png, width = 300){
  const img = decodePNG(png), k = Math.max(1, Math.round(img.w / width)), w = Math.floor(img.w / k), h = Math.floor(img.h / k), rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    let s = 0; for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) s += img.gray[(y * k + dy) * img.w + x * k + dx];
    rgb.fill(Math.round(s / (k * k)), (y * w + x) * 3, (y * w + x) * 3 + 3);
  }
  return encodeRGBPNG({ w, h, rgb });
}

/* ---------- scoring ---------- */
const AUTO = ["pure-black-white", "area-size", "fills-page", "traced-faithfully", "solid-black", "file-size", "dignity-words"];
/* One candidate's ingest record (a dry run) as { pass, fails, score, why }. A candidate passes when none of the ingest's measured checks
   fails; among passing candidates the score prefers a clear subject that fills the page, areas a person can color, few open ends and a
   faithful trace. */
export function scoreRecord(rec){
  const fails = (rec.checks || []).filter(c => c.result === "fail" && AUTO.includes(c.id)).map(c => c.id);
  const t1 = (rec.tiers || {})["1"] || {}, f = rec.fidelity || {}, near = (rec.trace || {}).near_ends || 0;
  const regions = t1.regions || 0, fill = Math.min(t1.subject_fill || 0, .92);
  let score = 1000 - 250 * fails.length;
  score -= Math.min(60, Math.abs(regions - 45));                      // a page with roughly 20 to 70 areas suits most people best
  score += 120 * fill - 400 * (f.xor_share || 0) - 4 * Math.min(near, 25);
  return { pass: !fails.length, fails, score: Math.round(score), why: `${regions} areas at Tier 1, subject fills ${Math.round((t1.subject_fill || 0) * 100)}%, ${near} open line end(s)${fails.length ? "; fails " + fails.join(", ") : ""}` };
}
/* The index of the best candidate: passing first, then the highest score. */
export function pickBest(scored){
  let best = -1;
  scored.forEach((s, i) => { if (!s) return; if (best < 0) { best = i; return; } const b = scored[best]; if ((s.pass && !b.pass) || (s.pass === b.pass && s.score > b.score)) best = i; });
  return best;
}

/* ---------- the review page ---------- */
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
/* summaries: [{ id, title, engine, status, prompt, chosen, candidates: [{ name, round, seed, pass, score, why, notes, fixes, raw, clean }] }] */
export function reviewPage(summaries, when){
  const card = s => `<section class="d" id="${esc(s.id)}"><h2>${esc(s.title)} <small>${esc(s.id)} &middot; ${esc(s.engine)} &middot; ${esc(s.status)}</small></h2>
    <p class="w">${esc(s.prompt || "")}</p>${s.message ? `<p class="m">${esc(s.message)}</p>` : ""}
    <div class="row">${(s.candidates || []).map(c => `<figure class="${c.name === s.chosen ? "chosen" : ""} ${c.pass ? "ok" : "no"}">
      ${c.raw ? `<img src="${esc(c.raw)}" alt="what the engine made">` : ""}${c.clean ? `<img src="${esc(c.clean)}" alt="cleaned master">` : ""}
      <figcaption><b>${esc(c.name)}${c.name === s.chosen ? " (chosen)" : ""}</b> ${c.pass ? "passes" : "does not pass"} &middot; score ${esc(c.score)}<br>${esc(c.why || c.error || "")}${(c.fixes || []).length ? `<br><i>${esc(c.fixes.join("; "))}</i>` : ""}</figcaption></figure>`).join("")}</div>
    ${s.svgs && s.svgs.length ? `<p class="v">Vector tiers of the chosen picture: ${s.svgs.map(v => `<a href="${esc(v)}">${esc(v.split("/").pop())}</a>`).join(" &middot; ")}</p>` : ""}</section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local art agent: review</title>
<style>body{margin:0;padding:24px;font:16px/1.5 system-ui,sans-serif;color:#1a202c;background:#fbf7f1}h1{font-size:24px}h2{font-size:18px;margin:0 0 4px}small{color:#56615d;font-weight:400}
.d{background:#fff;border:1px solid #ddd1ba;border-radius:12px;padding:16px;margin:0 0 16px}.w{color:#3d4a45;font-size:14px}.m{color:#732f19}.row{display:flex;flex-wrap:wrap;gap:12px}
figure{margin:0;width:230px;border:2px solid #ddd1ba;border-radius:10px;padding:8px;background:#fff}figure.chosen{border-color:#1b382b;box-shadow:0 0 0 2px #1b382b}figure.no{opacity:.8}
figure img{display:block;width:100%;aspect-ratio:3/4;object-fit:contain;background:#fff;border:1px solid #eee;margin:0 0 6px}figcaption{font-size:13px}</style></head><body>
<h1>Local art agent: review</h1><p>Made on this computer${when ? " on " + esc(when) : ""}. Each picture shows what the engine made and the cleaned master beside it. The chosen master is in <code>assets/coloring/_inbox/</code>; next run <code>npm run coloring:ingest</code> and <code>npm run coloring:review</code>, then approve or reject each one.</p>
${summaries.map(card).join("\n")}</body></html>`;
}
