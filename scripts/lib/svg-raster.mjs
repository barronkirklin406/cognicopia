/* =====================================================================
   SVG line art into shapes, for the coloring ingest pipeline. Reads the
   drawing parts of an SVG file (path, rect, circle, ellipse, line,
   polyline, polygon, nested <g> with transforms and inherited fill and
   stroke, style="" declarations) and flattens them into polylines in the
   SVG's own units, so a picture from any vector tool can be measured with
   the same rasterizer as the CogniCore engine and re-written as clean,
   pure black-and-white paths.

   Anything a coloring page must not rely on (<use>, <image>, <text>,
   gradients, patterns, filters, masks, clip paths, CSS classes) is
   reported, not drawn. Node built-ins only.
   ===================================================================== */

/* ---------- colors ---------- */
const NAMED = { black:[0, 0, 0], white:[255, 255, 255], red:[255, 0, 0], green:[0, 128, 0], blue:[0, 0, 255], gray:[128, 128, 128], grey:[128, 128, 128],
  silver:[192, 192, 192], yellow:[255, 255, 0], orange:[255, 165, 0], purple:[128, 0, 128], brown:[165, 42, 42], pink:[255, 192, 203] };
export function parseColor(v){
  if (v == null) return undefined;
  v = String(v).trim().toLowerCase();
  if (!v || v === "inherit") return undefined;
  if (v === "none" || v === "transparent") return null;
  if (v === "currentcolor") return [0, 0, 0];
  if (NAMED[v]) return NAMED[v];
  let m = /^#([0-9a-f]{3})$/.exec(v);
  if (m) return [...m[1]].map(c => parseInt(c + c, 16));
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(v);
  if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  m = /^rgba?\(([^)]*)\)$/.exec(v);
  if (m) return m[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3).map(x => x.endsWith("%") ? Math.round(parseFloat(x) * 2.55) : +x);
  if (/^url\(/.test(v)) return "paint-server";
  return [0, 0, 0];
}
const lum = c => .299 * c[0] + .587 * c[1] + .114 * c[2];
const isGrayOrColor = c => Array.isArray(c) && !((c[0] === 0 && c[1] === 0 && c[2] === 0) || (c[0] === 255 && c[1] === 255 && c[2] === 255));

/* ---------- transforms ---------- */
const I = [1, 0, 0, 1, 0, 0];
const mul = (p, m) => [p[0] * m[0] + p[2] * m[1], p[1] * m[0] + p[3] * m[1], p[0] * m[2] + p[2] * m[3], p[1] * m[2] + p[3] * m[3], p[0] * m[4] + p[2] * m[5] + p[4], p[1] * m[4] + p[3] * m[5] + p[5]];
export const apply = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
function parseTransform(s){
  let m = I.slice();
  for (const t of String(s || "").matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)){
    const a = t[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let n;
    if (t[1] === "matrix") n = a.slice(0, 6);
    else if (t[1] === "translate") n = [1, 0, 0, 1, a[0] || 0, a[1] || 0];
    else if (t[1] === "scale") n = [a[0], 0, 0, a[1] == null ? a[0] : a[1], 0, 0];
    else if (t[1] === "rotate"){
      const r = (a[0] || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), cx = a[1] || 0, cy = a[2] || 0;
      n = mul(mul([1, 0, 0, 1, cx, cy], [c, s, -s, c, 0, 0]), [1, 0, 0, 1, -cx, -cy]);
    }
    else if (t[1] === "skewX") n = [1, 0, Math.tan((a[0] || 0) * Math.PI / 180), 1, 0, 0];
    else n = [1, Math.tan((a[0] || 0) * Math.PI / 180), 0, 1, 0, 0];
    m = mul(m, n);
  }
  return m;
}

/* ---------- path data ---------- */
function arcToPts(x1, y1, rx, ry, phi, fa, fs, x2, y2){
  if (!rx || !ry) return [[x2, y2]];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const p = phi * Math.PI / 180, cp = Math.cos(p), sp = Math.sin(p);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  const lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
  if (lam > 1){ rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = Math.sqrt(Math.max(0, num / den)); if (fa === fs) co = -co;
  const cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(4, Math.ceil(Math.abs(dt) / (Math.PI / 16))), out = [];
  for (let i = 1; i <= n; i++){ const t = t1 + dt * i / n; out.push([cx + rx * Math.cos(t) * cp - ry * Math.sin(t) * sp, cy + rx * Math.cos(t) * sp + ry * Math.sin(t) * cp]); }
  return out;
}
/* Path data to subpaths [{ pts, closed }] in the path's own units. */
export function pathToSubpaths(d){
  const tok = String(d || "").match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
  const subs = []; let cur = null, i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0, lc = null, lq = null;
  const num = () => +tok[i++];
  const flag = () => { const v = tok[i]; if (/^[01]{2,}/.test(v)){ tok[i] = v.slice(1); return +v[0]; } i++; return +v; };
  const start = () => { cur = { pts:[[x, y]], closed:false }; subs.push(cur); };
  const to = p => { if (!cur) start(); cur.pts.push(p); };
  const bez = (p0, p1, p2, p3) => { for (let k = 1; k <= 12; k++){ const t = k / 12, u = 1 - t; to([u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0], u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]]); } };
  while (i < tok.length){
    if (/[a-z]/i.test(tok[i])) cmd = tok[i++];
    else if (!cmd) { i++; continue; }
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === "Z"){ if (cur){ cur.closed = true; x = sx; y = sy; } cur = null; lc = lq = null; continue; }
    if (i >= tok.length || /[a-z]/i.test(tok[i])) continue;
    if (C === "M"){ x = ox + num(); y = oy + num(); sx = x; sy = y; start(); cmd = rel ? "l" : "L"; lc = lq = null; }
    else if (C === "L"){ x = ox + num(); y = oy + num(); to([x, y]); lc = lq = null; }
    else if (C === "H"){ x = ox + num(); to([x, y]); lc = lq = null; }
    else if (C === "V"){ y = oy + num(); to([x, y]); lc = lq = null; }
    else if (C === "C"){ const c1 = [ox + num(), oy + num()], c2 = [ox + num(), oy + num()], p = [ox + num(), oy + num()]; bez([x, y], c1, c2, p); lc = c2; lq = null; x = p[0]; y = p[1]; }
    else if (C === "S"){ const c1 = lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y], c2 = [ox + num(), oy + num()], p = [ox + num(), oy + num()]; bez([x, y], c1, c2, p); lc = c2; lq = null; x = p[0]; y = p[1]; }
    else if (C === "Q" || C === "T"){
      const q = C === "Q" ? [ox + num(), oy + num()] : lq ? [2 * x - lq[0], 2 * y - lq[1]] : [x, y], p = [ox + num(), oy + num()];
      bez([x, y], [x + 2 / 3 * (q[0] - x), y + 2 / 3 * (q[1] - y)], [p[0] + 2 / 3 * (q[0] - p[0]), p[1] + 2 / 3 * (q[1] - p[1])], p); lq = q; lc = null; x = p[0]; y = p[1];
    }
    else if (C === "A"){ const rx = num(), ry = num(), phi = num(), fa = flag(), fs = flag(), p = [ox + num(), oy + num()]; arcToPts(x, y, rx, ry, phi, fa, fs, p[0], p[1]).forEach(to); x = p[0]; y = p[1]; lc = lq = null; }
    else i++;
  }
  return subs.filter(s => s.pts.length > 1 || s.closed);
}

/* ---------- the document ---------- */
const attrsOf = s => { const a = {}; for (const m of s.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) a[m[1]] = m[2] != null ? m[2] : m[3]; return a; };
const styleOf = s => { const o = {}; String(s || "").split(";").forEach(kv => { const i = kv.indexOf(":"); if (i > 0) o[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); }); return o; };
const SKIP_INSIDE = new Set(["defs", "clipPath", "mask", "symbol", "style", "title", "desc", "metadata", "pattern", "marker", "linearGradient", "radialGradient", "filter"]);
const len = (v, ref) => { if (v == null || v === "") return 0; const n = parseFloat(v); return String(v).trim().endsWith("%") ? n / 100 * ref : n; };

/* Parse an SVG file. Returns the viewBox, the shapes in viewBox units (each
   { subpaths, fill:[r,g,b]|null, stroke:[r,g,b]|null, strokeWidth }) and
   notes on anything that is not plain black-and-white line art. */
export function parseSVG(text){
  const notes = new Set(), shapes = [];
  const svgTag = /<svg\b([^>]*)>/i.exec(text);
  if (!svgTag) throw new Error("not an SVG file");
  const sa = attrsOf(svgTag[1]);
  let vb = (sa.viewBox || "").split(/[\s,]+/).filter(Boolean).map(Number);
  if (vb.length !== 4 || !(vb[2] > 0) || !(vb[3] > 0)) vb = [0, 0, len(sa.width, 0) || 600, len(sa.height, 0) || 800];
  const stack = [{ m:I, fill:[0, 0, 0], stroke:null, sw:1, skip:0, hidden:false }];
  const body = text.slice(svgTag.index + svgTag[0].length);
  for (const t of body.matchAll(/<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|<!--[\s\S]*?-->/g)){
    if (!t[2]) continue;
    const close = t[1] === "/", tag = t[2], self = t[4] === "/" || /\/\s*$/.test(t[3]);
    const top = stack[stack.length - 1];
    if (close){ if (stack.length > 1) stack.pop(); continue; }
    const a = attrsOf(t[3]), st = Object.assign({}, a, styleOf(a.style));
    if (/^(linearGradient|radialGradient|pattern|filter|mask|clipPath|image|text|use|foreignObject)$/.test(tag)) notes.add("uses <" + tag + ">");
    if (a.class) notes.add("relies on CSS classes");
    for (const k of ["opacity", "fill-opacity", "stroke-opacity"]) if (st[k] != null && parseFloat(st[k]) < 1) notes.add("uses transparency");
    const hidden = top.hidden || st.display === "none" || st.visibility === "hidden";
    const node = {
      m:a.transform ? mul(top.m, parseTransform(a.transform)) : top.m,
      fill:st.fill !== undefined ? parseColor(st.fill) : top.fill,
      stroke:st.stroke !== undefined ? parseColor(st.stroke) : top.stroke,
      sw:st["stroke-width"] !== undefined ? len(st["stroke-width"], vb[2]) : top.sw,
      skip:top.skip + (SKIP_INSIDE.has(tag) ? 1 : 0), hidden
    };
    if (node.fill === undefined) node.fill = top.fill;
    if (node.stroke === undefined) node.stroke = top.stroke;
    if (!node.skip && !hidden){
      let subs = null;
      if (tag === "path") subs = pathToSubpaths(a.d);
      else if (tag === "rect"){ const x = len(a.x, vb[2]), y = len(a.y, vb[3]), w = len(a.width, vb[2]), hh = len(a.height, vb[3]); if (w > 0 && hh > 0) subs = [{ pts:[[x, y], [x + w, y], [x + w, y + hh], [x, y + hh]], closed:true }]; }
      else if (tag === "circle" || tag === "ellipse"){
        const cx = len(a.cx, vb[2]), cy = len(a.cy, vb[3]), rx = tag === "circle" ? len(a.r, vb[2]) : len(a.rx, vb[2]), ry = tag === "circle" ? rx : len(a.ry, vb[3]);
        if (rx > 0 && ry > 0){ const pts = []; for (let k = 0; k < 64; k++){ const q = k / 64 * 2 * Math.PI; pts.push([cx + rx * Math.cos(q), cy + ry * Math.sin(q)]); } subs = [{ pts, closed:true }]; }
      }
      else if (tag === "line") subs = [{ pts:[[len(a.x1, vb[2]), len(a.y1, vb[3])], [len(a.x2, vb[2]), len(a.y2, vb[3])]], closed:false }];
      else if (tag === "polyline" || tag === "polygon"){
        const n = String(a.points || "").split(/[\s,]+/).filter(Boolean).map(Number), pts = [];
        for (let k = 0; k + 1 < n.length; k += 2) pts.push([n[k], n[k + 1]]);
        if (pts.length > 1) subs = [{ pts, closed:tag === "polygon" }];
      }
      if (subs && subs.length){
        [node.fill, node.stroke].forEach(c => { if (c === "paint-server") notes.add("fills with a gradient or pattern"); else if (isGrayOrColor(c)) notes.add("uses gray or color"); });
        const scale = Math.sqrt(Math.abs(node.m[0] * node.m[3] - node.m[1] * node.m[2])) || 1;
        shapes.push({
          subpaths:subs.map(s => ({ pts:s.pts.map(p => apply(node.m, p)), closed:s.closed })),
          fill:Array.isArray(node.fill) ? node.fill : null, stroke:Array.isArray(node.stroke) ? node.stroke : null,
          strokeWidth:(node.sw || 0) * scale
        });
      }
    }
    if (!self) stack.push(node);                 // popped by its closing tag
  }
  return { viewBox:vb, shapes, notes:[...notes] };
}

/* The bounding box of parsed shapes (viewBox units), strokes included. */
export function shapesBBox(shapes){
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of shapes){
    const r = s.stroke ? s.strokeWidth / 2 : 0;
    for (const sp of s.subpaths) for (const p of sp.pts){ x0 = Math.min(x0, p[0] - r); y0 = Math.min(y0, p[1] - r); x1 = Math.max(x1, p[0] + r); y1 = Math.max(y1, p[1] + r); }
  }
  return x1 < x0 ? null : { x0, y0, x1, y1 };
}

/* Map parsed shapes into a w x h pixel box (3:4) so the drawing's bounding
   box fits with a margin, centered. Near-black fills stay black, other
   fills turn white, visible strokes turn black with at least minStrokePx.
   Returns rasterizer shapes (scripts/lib/raster.mjs) and the mapping used. */
export function fitShapes(parsed, w, h, { margin = .05, minStrokePx = 0 } = {}){
  const bb = shapesBBox(parsed.shapes);
  if (!bb) return { shapes:[], k:1, ox:0, oy:0 };
  const bw = Math.max(1e-6, bb.x1 - bb.x0), bh = Math.max(1e-6, bb.y1 - bb.y0);
  const k = Math.min(w * (1 - 2 * margin) / bw, h * (1 - 2 * margin) / bh);
  const ox = (w - bw * k) / 2 - bb.x0 * k, oy = (h - bh * k) / 2 - bb.y0 * k;
  const shapes = parsed.shapes.map(s => ({
    subpaths:s.subpaths.map(sp => ({ pts:sp.pts.map(p => [ox + p[0] * k, oy + p[1] * k]), closed:sp.closed })),
    // line art: near-black fills are ink, every other fill is paper to color;
    // any visible stroke is a line
    fill:s.fill ? (lum(s.fill) < 60 ? 1 : 0) : null,
    stroke:s.stroke && lum(s.stroke) < 230 ? Math.max(minStrokePx, s.strokeWidth * k) : 0
  }));
  return { shapes, k, ox, oy };
}

/* Write fitted shapes back out as a clean SVG: a 600 x 800 box, absolute
   M/L/Z paths, pure #000 and #fff, round joins. pxPerUnit converts the
   pixel box used by fitShapes into the 600-unit box. */
export function shapesToSVG(shapes, { w, h, title = "A picture to color", widthIn }){
  const k = 600 / w, f = n => String(Math.round(n * k * 10) / 10);
  const body = shapes.map(s => {
    const d = s.subpaths.map(sp => "M" + sp.pts.map(p => f(p[0]) + " " + f(p[1])).join(" L") + (sp.closed ? " Z" : "")).join(" ");
    const fill = s.fill === 1 ? "#000" : s.fill === 0 ? "#fff" : "none";
    const stroke = s.stroke > 0 ? ` stroke="#000" stroke-width="${f(s.stroke)}"` : ' stroke="none"';
    return `<path fill="${fill}"${stroke} d="${d}"/>`;
  }).join("");
  const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const size = widthIn ? ` width="${widthIn}in" height="${Math.round(widthIn / .75 * 1000) / 1000}in"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 600 ${Math.round(600 * h / w)}"${size} role="img" aria-label="${esc(title)}, a picture to color"><title>${esc(title)}</title>` +
    `<rect width="600" height="${Math.round(600 * h / w)}" fill="#fff"/><g stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>\n`;
}
