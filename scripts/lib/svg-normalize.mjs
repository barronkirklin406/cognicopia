/* =====================================================================
   SVG normalizer for coloring subjects (Node built-ins only).

   Reads any reasonable SVG (hand-drawn, Inkscape, Illustrator or a
   stock file) and returns flat line art:
     - every shape (rect, circle, ellipse, line, polyline, polygon, path,
       and <use> copies) becomes one absolute path of M, L, C and Z;
     - every transform (matrix, translate, scale, rotate, skewX, skewY),
       on the shape or any parent group, is applied to the points;
     - arcs and quadratic curves become cubic curves, so the result
       draws the same in a browser, a canvas and a PDF;
     - fills become white (a shape that hides what is behind it), small
       solid black accents stay black, and every other fill, gradient,
       pattern, image, text, filter, mask, clip and style is dropped;
     - every outline is pure black.
   Paths marked class="detail" (or data-detail) are kept as detail lines,
   which the coloring engine leaves out at the late stage.
   ===================================================================== */

/* ---------- a small, forgiving XML reader ---------- */
const ENT = { amp:"&", lt:"<", gt:">", quot:'"', apos:"'" };
const decode = s => String(s).replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e] != null ? ENT[e] : m));

export function parseXml(text){
  const root = { name:"#root", attrs:{}, children:[], text:"" }, stack = [root];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[\s\S]*?(?:\[[\s\S]*?\])?\s*>|<\/\s*([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(text))){
    const top = stack[stack.length - 1];
    if (m[1] != null){ top.text += m[1]; continue; }
    if (m[2]){ for (let i = stack.length - 1; i > 0; i--) if (stack[i].name === m[2]){ stack.length = i; break; } continue; }
    if (m[3]){
      const node = { name:m[3].replace(/^svg:/, ""), attrs:{}, children:[], text:"" };
      const ar = /([\w:.-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g; let a;
      while ((a = ar.exec(m[4] || ""))) node.attrs[a[1]] = decode(a[3] != null ? a[3] : a[4] != null ? a[4] : a[5] != null ? a[5] : "");
      top.children.push(node);
      if (!m[5]) stack.push(node);
      continue;
    }
    if (m[6] != null) top.text += decode(m[6]);
  }
  return root;
}
const findFirst = (n, name) => { if (n.name === name) return n; for (const c of n.children){ const f = findFirst(c, name); if (f) return f; } return null; };

/* ---------- numbers, colors, styles ---------- */
const NUM = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
const nums = s => (String(s || "").match(NUM) || []).map(Number);
const len = (v, ref) => { if (v == null || v === "") return 0; const s = String(v).trim(); const n = parseFloat(s); if (!isFinite(n)) return 0; return /%$/.test(s) && ref ? n / 100 * ref : n; };

const NAMED = { black:[0,0,0], white:[255,255,255], none:null, transparent:null, red:[255,0,0], green:[0,128,0], blue:[0,0,255], gray:[128,128,128], grey:[128,128,128], silver:[192,192,192] };
export function parseColor(v){
  if (v == null) return undefined;
  const s = String(v).trim().toLowerCase();
  if (!s || s === "inherit") return undefined;
  if (s === "none" || s === "transparent") return null;
  if (s.startsWith("url(")) return "paint";                        // a gradient or pattern
  if (s === "currentcolor") return [0, 0, 0];
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m){ let h = m[1]; if (h.length <= 4) h = h.split("").map(c => c + c).join(""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  m = s.match(/^rgba?\(([^)]*)\)$/);
  if (m){ const p = m[1].split(/[\s,\/]+/).filter(Boolean); return p.slice(0, 3).map(x => /%$/.test(x) ? parseFloat(x) * 2.55 : parseFloat(x)); }
  if (NAMED[s] !== undefined) return NAMED[s];
  return [128, 128, 128];                                          // any other named color counts as a color
}
const lightness = c => (Array.isArray(c) ? (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 : 1);

function parseCss(text){
  const rules = [];
  String(text || "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/([^{}]+)\{([^}]*)\}/g, (m, sel, body) => {
    const decl = parseStyle(body);
    sel.split(",").map(s => s.trim()).filter(Boolean).forEach(s => rules.push({ sel:s, decl }));
    return "";
  });
  return rules;
}
function parseStyle(s){
  const out = {};
  String(s || "").split(";").forEach(d => { const i = d.indexOf(":"); if (i > 0) out[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).trim(); });
  return out;
}
function cssFor(node, rules){
  const out = {}, cls = String(node.attrs.class || "").split(/\s+/).filter(Boolean);
  for (const r of rules){
    const s = r.sel;
    const hit = (s[0] === "." && cls.indexOf(s.slice(1)) >= 0) || (s[0] === "#" && node.attrs.id === s.slice(1)) || s === node.name || s === "*";
    if (hit) Object.assign(out, r.decl);
  }
  return out;
}
const INHERIT = ["fill", "stroke", "stroke-width", "fill-rule", "visibility", "display"];

/* ---------- 2D affine transforms: [a, b, c, d, e, f] ---------- */
const I = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
export function parseTransform(s){
  let m = I.slice();
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g; let t;
  while ((t = re.exec(String(s || "")))){
    const v = nums(t[2]); let n = I;
    if (t[1] === "matrix" && v.length >= 6) n = v.slice(0, 6);
    else if (t[1] === "translate") n = [1, 0, 0, 1, v[0] || 0, v[1] || 0];
    else if (t[1] === "scale") n = [v[0] == null ? 1 : v[0], 0, 0, v[1] == null ? (v[0] == null ? 1 : v[0]) : v[1], 0, 0];
    else if (t[1] === "rotate"){
      const r = (v[0] || 0) * Math.PI / 180, c = Math.cos(r), si = Math.sin(r), cx = v[1] || 0, cy = v[2] || 0;
      n = mul(mul([1, 0, 0, 1, cx, cy], [c, si, -si, c, 0, 0]), [1, 0, 0, 1, -cx, -cy]);
    } else if (t[1] === "skewX") n = [1, 0, Math.tan((v[0] || 0) * Math.PI / 180), 1, 0, 0];
    else if (t[1] === "skewY") n = [1, Math.tan((v[0] || 0) * Math.PI / 180), 0, 1, 0, 0];
    m = mul(m, n);
  }
  return m;
}

/* ---------- paths: any SVG path data to absolute M / L / C / Z ---------- */
/* Returns a list of segments: { op:"M"|"L"|"C"|"Z", p:[x,y], c1, c2 } */
export function parsePathData(d){
  const out = [], toks = String(d || "").match(/[MmLlHhVvCcSsQqTtAaZz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) || [];
  let i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0, lc = null, lq = null;
  const num = () => +toks[i++];
  const flag = () => { // arc flags may be written together, as in "a10 10 0 01 20 0"
    const t = toks[i]; if (t.length > 1 && (t[0] === "0" || t[0] === "1") && !/[.eE]/.test(t)){ toks[i] = t.slice(1); return +t[0]; } i++; return +t; };
  while (i < toks.length){
    if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++];
    else if (!cmd) { i++; continue; }
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    if (C === "Z"){ out.push({ op:"Z" }); x = sx; y = sy; lc = lq = null; continue; }
    if (i >= toks.length || /[A-Za-z]/.test(toks[i])) { continue; }
    if (C === "M"){
      x = (rel ? x : 0) + num(); y = (rel ? y : 0) + num(); sx = x; sy = y; out.push({ op:"M", p:[x, y] });
      cmd = rel ? "l" : "L"; lc = lq = null; continue;
    }
    if (C === "L"){ x = (rel ? x : 0) + num(); y = (rel ? y : 0) + num(); out.push({ op:"L", p:[x, y] }); lc = lq = null; continue; }
    if (C === "H"){ x = (rel ? x : 0) + num(); out.push({ op:"L", p:[x, y] }); lc = lq = null; continue; }
    if (C === "V"){ y = (rel ? y : 0) + num(); out.push({ op:"L", p:[x, y] }); lc = lq = null; continue; }
    if (C === "C"){
      const ox = rel ? x : 0, oy = rel ? y : 0;
      const c1 = [ox + num(), oy + num()], c2 = [ox + num(), oy + num()]; x = ox + num(); y = oy + num();
      out.push({ op:"C", c1, c2, p:[x, y] }); lc = c2; lq = null; continue;
    }
    if (C === "S"){
      const ox = rel ? x : 0, oy = rel ? y : 0;
      const c1 = lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y], c2 = [ox + num(), oy + num()]; x = ox + num(); y = oy + num();
      out.push({ op:"C", c1, c2, p:[x, y] }); lc = c2; lq = null; continue;
    }
    if (C === "Q" || C === "T"){
      const ox = rel ? x : 0, oy = rel ? y : 0;
      const q = C === "Q" ? [ox + num(), oy + num()] : (lq ? [2 * x - lq[0], 2 * y - lq[1]] : [x, y]);
      const nx = ox + num(), ny = oy + num();
      out.push({ op:"C", c1:[x + 2 / 3 * (q[0] - x), y + 2 / 3 * (q[1] - y)], c2:[nx + 2 / 3 * (q[0] - nx), ny + 2 / 3 * (q[1] - ny)], p:[nx, ny] });
      x = nx; y = ny; lq = q; lc = null; continue;
    }
    if (C === "A"){
      const rx = num(), ry = num(), rot = num(), large = flag(), sweep = flag();
      const nx = (rel ? x : 0) + num(), ny = (rel ? y : 0) + num();
      arcToCubic(x, y, rx, ry, rot, large, sweep, nx, ny).forEach(s => out.push(s));
      x = nx; y = ny; lc = lq = null; continue;
    }
    i++;                                                             // an unknown token: skip it
  }
  return out;
}

/* SVG elliptical arc to cubic curves (the SVG 1.1 implementation notes, F.6.5) */
export function arcToCubic(x1, y1, rx, ry, rotDeg, large, sweep, x2, y2){
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [{ op:"L", p:[x2, y2] }];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = rotDeg * Math.PI / 180, cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  let lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1){ const s = Math.sqrt(lam); rx *= s; ry *= s; }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = Math.sqrt(Math.max(0, num / den)); if (large === sweep) co = -co;
  const cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
  let t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry), dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
  const segs = Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9), step = dt / segs, k = 4 / 3 * Math.tan(step / 4), out = [];
  const pt = t => [cx + rx * Math.cos(t) * cp - ry * Math.sin(t) * sp, cy + rx * Math.cos(t) * sp + ry * Math.sin(t) * cp];
  const der = t => [-rx * Math.sin(t) * cp - ry * Math.cos(t) * sp, -rx * Math.sin(t) * sp + ry * Math.cos(t) * cp];
  for (let s = 0; s < segs; s++){
    const a = t1 + s * step, b = a + step, pa = pt(a), pb = pt(b), da = der(a), db = der(b);
    out.push({ op:"C", c1:[pa[0] + k * da[0], pa[1] + k * da[1]], c2:[pb[0] - k * db[0], pb[1] - k * db[1]], p:s === segs - 1 ? [x2, y2] : pb });
  }
  return out;
}

/* basic shapes as path segments */
const K = 0.5522847498;
function ellipseSegs(cx, cy, rx, ry){
  return [{ op:"M", p:[cx + rx, cy] },
    { op:"C", c1:[cx + rx, cy + K * ry], c2:[cx + K * rx, cy + ry], p:[cx, cy + ry] },
    { op:"C", c1:[cx - K * rx, cy + ry], c2:[cx - rx, cy + K * ry], p:[cx - rx, cy] },
    { op:"C", c1:[cx - rx, cy - K * ry], c2:[cx - K * rx, cy - ry], p:[cx, cy - ry] },
    { op:"C", c1:[cx + K * rx, cy - ry], c2:[cx + rx, cy - K * ry], p:[cx + rx, cy] }, { op:"Z" }];
}
function shapeSegs(n){
  const a = n.attrs;
  switch (n.name){
    case "path": return parsePathData(a.d);
    case "rect": {
      const x = len(a.x), y = len(a.y), w = len(a.width), h = len(a.height);
      if (w <= 0 || h <= 0) return [];
      let rx = a.rx != null ? len(a.rx) : (a.ry != null ? len(a.ry) : 0), ry = a.ry != null ? len(a.ry) : rx;
      rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
      if (!rx || !ry) return [{ op:"M", p:[x, y] }, { op:"L", p:[x + w, y] }, { op:"L", p:[x + w, y + h] }, { op:"L", p:[x, y + h] }, { op:"Z" }];
      return [{ op:"M", p:[x + rx, y] }, { op:"L", p:[x + w - rx, y] }, ...arcToCubic(x + w - rx, y, rx, ry, 0, 0, 1, x + w, y + ry),
        { op:"L", p:[x + w, y + h - ry] }, ...arcToCubic(x + w, y + h - ry, rx, ry, 0, 0, 1, x + w - rx, y + h),
        { op:"L", p:[x + rx, y + h] }, ...arcToCubic(x + rx, y + h, rx, ry, 0, 0, 1, x, y + h - ry),
        { op:"L", p:[x, y + ry] }, ...arcToCubic(x, y + ry, rx, ry, 0, 0, 1, x + rx, y), { op:"Z" }];
    }
    case "circle": { const r = len(a.r); return r > 0 ? ellipseSegs(len(a.cx), len(a.cy), r, r) : []; }
    case "ellipse": { const rx = len(a.rx), ry = len(a.ry); return rx > 0 && ry > 0 ? ellipseSegs(len(a.cx), len(a.cy), rx, ry) : []; }
    case "line": return [{ op:"M", p:[len(a.x1), len(a.y1)] }, { op:"L", p:[len(a.x2), len(a.y2)] }];
    case "polyline": case "polygon": {
      const v = nums(a.points), out = [];
      for (let i = 0; i + 1 < v.length; i += 2) out.push({ op:i ? "L" : "M", p:[v[i], v[i + 1]] });
      if (n.name === "polygon" && out.length) out.push({ op:"Z" });
      return out;
    }
  }
  return [];
}

/* ---------- geometry helpers ---------- */
function mapSegs(segs, m){
  return segs.map(s => s.op === "Z" ? s : s.op === "C" ? { op:"C", c1:ap(m, s.c1[0], s.c1[1]), c2:ap(m, s.c2[0], s.c2[1]), p:ap(m, s.p[0], s.p[1]) } : { op:s.op, p:ap(m, s.p[0], s.p[1]) });
}
/* the exact box of the drawn curve (cubic extrema, not just control points) */
export function segsBox(segs, box){
  box = box || [Infinity, Infinity, -Infinity, -Infinity];
  const add = (x, y) => { if (x < box[0]) box[0] = x; if (y < box[1]) box[1] = y; if (x > box[2]) box[2] = x; if (y > box[3]) box[3] = y; };
  let cur = null;
  for (const s of segs){
    if (s.op === "Z") continue;
    if (s.op === "C" && cur){
      for (let ax = 0; ax < 2; ax++){
        const p0 = cur[ax], p1 = s.c1[ax], p2 = s.c2[ax], p3 = s.p[ax];
        const a = -p0 + 3 * p1 - 3 * p2 + p3, b = 2 * (p0 - 2 * p1 + p2), c = p1 - p0, ts = [];
        if (Math.abs(a) < 1e-12){ if (Math.abs(b) > 1e-12) ts.push(-c / b); }
        else { const D = b * b - 4 * a * c; if (D >= 0){ const q = Math.sqrt(D); ts.push((-b + q) / (2 * a), (-b - q) / (2 * a)); } }
        ts.filter(t => t > 0 && t < 1).forEach(t => {
          const u = 1 - t, X = u * u * u * cur[0] + 3 * u * u * t * s.c1[0] + 3 * u * t * t * s.c2[0] + t * t * t * s.p[0];
          const Y = u * u * u * cur[1] + 3 * u * u * t * s.c1[1] + 3 * u * t * t * s.c2[1] + t * t * t * s.p[1]; add(X, Y);
        });
      }
    }
    add(s.p[0], s.p[1]); cur = s.p;
  }
  return box;
}
const f2 = v => { const r = Math.round(v * 100) / 100; return (Object.is(r, -0) ? 0 : r).toString(); };
export function segsToD(segs){
  return segs.map(s => s.op === "Z" ? "Z" : s.op === "C" ? `C${f2(s.c1[0])} ${f2(s.c1[1])} ${f2(s.c2[0])} ${f2(s.c2[1])} ${f2(s.p[0])} ${f2(s.p[1])}` : `${s.op}${f2(s.p[0])} ${f2(s.p[1])}`).join("");
}
/* closed: every subpath ends with Z, or returns to where it started */
export function isClosed(segs){
  let start = null, last = null, open = false;
  for (const s of segs){
    if (s.op === "M"){ if (start && last && !(Math.hypot(last[0] - start[0], last[1] - start[1]) < 0.5)) open = true; start = s.p; last = s.p; }
    else if (s.op === "Z"){ last = start; }
    else last = s.p;
  }
  if (start && last && Math.hypot(last[0] - start[0], last[1] - start[1]) >= 0.5) open = true;
  return !open;
}
/* the area a closed path encloses (shoelace over a flattened copy) */
export function segsArea(segs){
  let area = 0, start = null, prev = null;
  const edge = (a, b) => { area += a[0] * b[1] - b[0] * a[1]; };
  for (const s of segs){
    if (s.op === "M"){ if (start && prev) edge(prev, start); start = prev = s.p; }
    else if (s.op === "Z"){ if (start && prev) edge(prev, start); prev = start; }
    else if (s.op === "C" && prev){
      for (let k = 1; k <= 8; k++){ const t = k / 8, u = 1 - t;
        const q = [u * u * u * prev[0] + 3 * u * u * t * s.c1[0] + 3 * u * t * t * s.c2[0] + t * t * t * s.p[0], u * u * u * prev[1] + 3 * u * u * t * s.c1[1] + 3 * u * t * t * s.c2[1] + t * t * t * s.p[1]];
        edge(prev, q); prev = q; }
    } else if (prev){ edge(prev, s.p); prev = s.p; }
  }
  return Math.abs(area / 2);
}

/* ---------- the whole file: shapes with resolved styles ---------- */
export function extractShapes(svgText){
  const doc = parseXml(svgText), svg = findFirst(doc, "svg");
  if (!svg) throw new Error("not an SVG file");
  const css = []; (function collectStyles(n){ if (n.name === "style") css.push(...parseCss(n.text)); n.children.forEach(collectStyles); })(svg);
  const ids = {}; (function index(n){ if (n.attrs && n.attrs.id) ids[n.attrs.id] = n; n.children.forEach(index); })(svg);
  // the viewBox, so a file drawn with an offset viewBox still lands right
  let base = I.slice();
  const shapes = [], skipped = new Set();
  const SKIP = new Set(["defs", "clipPath", "mask", "linearGradient", "radialGradient", "pattern", "filter", "symbol", "marker", "title", "desc", "metadata", "style", "script", "foreignObject", "switch"]);
  const DROP = new Set(["image", "text", "tspan", "textPath"]);
  function walk(n, m, inh, depth){
    if (depth > 40) return;
    const own = Object.assign({}, cssFor(n, css));
    INHERIT.concat(["opacity", "fill-opacity", "stroke-opacity"]).forEach(k => { if (n.attrs[k] != null) own[k] = own[k] != null && /!important/.test(own[k]) ? own[k] : n.attrs[k]; });
    Object.assign(own, parseStyle(n.attrs.style));
    const st = Object.assign({}, inh);
    INHERIT.forEach(k => { if (own[k] != null) st[k] = String(own[k]).replace(/!important/, "").trim(); });
    st.detail = inh.detail || /(^|\s)detail(\s|$)/.test(n.attrs.class || "") || n.attrs["data-detail"] === "1" || n.attrs["data-detail"] === "true";
    st.keep = inh.keep || n.attrs["data-keep"] === "1";                // never left out at the late stage (an eye)
    if (st.display === "none" || st.visibility === "hidden" || parseFloat(own.opacity) === 0) return;
    if (n.attrs["data-bg"] === "1") return;                          // the page background a processed file carries
    const mm = n.attrs.transform ? mul(m, parseTransform(n.attrs.transform)) : m;
    if (DROP.has(n.name)){ skipped.add(n.name); return; }
    if (SKIP.has(n.name) && depth > 0) { if (n.name !== "title" && n.name !== "desc" && n.name !== "metadata" && n.name !== "style" && n.name !== "defs") skipped.add(n.name); return; }
    if (n.name === "use"){
      const ref = ids[String(n.attrs.href || n.attrs["xlink:href"] || "").replace(/^#/, "")];
      if (ref){ const um = mul(mm, [1, 0, 0, 1, len(n.attrs.x), len(n.attrs.y)]); if (ref.name === "symbol") ref.children.forEach(c => walk(c, um, st, depth + 1)); else walk(ref, um, st, depth + 1); }
      return;
    }
    if (n.name === "svg" && depth > 0){
      const vb = nums(n.attrs.viewBox), w = len(n.attrs.width), h = len(n.attrs.height);
      let nm = mul(mm, [1, 0, 0, 1, len(n.attrs.x), len(n.attrs.y)]);
      if (vb.length === 4 && w && h) nm = mul(nm, [w / vb[2], 0, 0, h / vb[3], -vb[0] * w / vb[2], -vb[1] * h / vb[3]]);
      n.children.forEach(c => walk(c, nm, st, depth + 1)); return;
    }
    if (["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"].indexOf(n.name) >= 0){
      const segs = mapSegs(shapeSegs(n), mm);
      if (segs.length) shapes.push({ segs, fill:parseColor(st.fill == null ? "black" : st.fill), stroke:parseColor(st.stroke == null ? "none" : st.stroke),
        strokeWidth:st["stroke-width"] != null ? len(st["stroke-width"]) * Math.sqrt(Math.abs(mm[0] * mm[3] - mm[1] * mm[2])) : 1, detail:!!st.detail, keep:!!st.keep, kind:n.name });
      return;
    }
    n.children.forEach(c => walk(c, mm, st, depth + 1));
  }
  const vb = nums(svg.attrs.viewBox);
  if (vb.length === 4) base = [1, 0, 0, 1, -vb[0], -vb[1]];
  walk(svg, base, { fill:"black", stroke:"none" }, 0);
  return { shapes, root:svg.attrs, skipped:[...skipped] };
}

/* ---------- normalize to coloring line art in a fixed box ---------- */
export const BOX = { w:800, h:600, pad:40 };
export const STROKE = { main:4, detail:3 };
/* Fills: white stays white (it hides what is behind it), so does any
   light or colored fill; a dark fill becomes a black accent only while
   it is small (an eye, a button), otherwise it turns into a white area
   with an outline, because a large black block cannot be colored. */
export function normalize(svgText, o = {}){
  const box = Object.assign({}, BOX, o.box || {});
  const { shapes, root, skipped } = extractShapes(svgText);
  if (!shapes.length) throw new Error("the file has no shapes to draw");
  let bb = [Infinity, Infinity, -Infinity, -Infinity];
  shapes.forEach(s => segsBox(s.segs, bb));
  const bw = bb[2] - bb[0], bh = bb[3] - bb[1];
  if (!(bw > 0 && bh > 0)) throw new Error("the drawing has no size");
  const k = Math.min((box.w - 2 * box.pad) / bw, (box.h - 2 * box.pad) / bh);
  const m = [k, 0, 0, k, (box.w - bw * k) / 2 - bb[0] * k, (box.h - bh * k) / 2 - bb[1] * k];
  const total = bw * bh * k * k, notes = [];
  const out = shapes.map(s => {
    const segs = mapSegs(s.segs, m), closed = isClosed(segs);
    const fc = s.fill, sc = s.stroke;
    let fill = "none";
    if (fc === "paint" || (Array.isArray(fc) && closed)){
      const dark = Array.isArray(fc) && lightness(fc) < 0.25;
      if (dark && segsArea(segs) < total * 0.004) fill = "#000";
      else fill = "#fff";
      if (Array.isArray(fc) && !dark && lightness(fc) < 0.98 && fc.join() !== "255,255,255") notes.push("color fill made white");
    }
    if (fc === "paint") notes.push("gradient or pattern removed");
    if (sc === "paint" || (Array.isArray(sc) && sc.join() !== "0,0,0")) notes.push("stroke color made black");
    // a shape with neither a visible fill nor a stroke in the source still gets an outline
    return { d:segsToD(segs), fill, detail:s.detail, keep:s.keep, closed, area:closed ? segsArea(segs) : 0 };
  });
  return { paths:out, root, skipped, notes:[...new Set(notes)], scale:k, sourceBox:bb };
}

/* the processed file: flat, black outlines, a fixed viewBox and its metadata */
export function toProcessedSvg(norm, meta){
  const box = BOX, esc = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const attrs = Object.entries(meta).filter(([, v]) => v != null && v !== "").map(([k, v]) => ` data-${k}="${esc(Array.isArray(v) ? v.join(",") : v)}"`).join("");
  const body = norm.paths.map(p => `  <path d="${p.d}" fill="${p.fill}" stroke="#000" stroke-width="${p.detail ? STROKE.detail : STROKE.main}" stroke-linecap="round" stroke-linejoin="round"${p.detail ? ' data-detail="1"' : ""}/>`).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box.w} ${box.h}" width="${box.w}" height="${box.h}" data-cg-processed="1"${attrs}>\n  <title>${esc(meta.title || "")}</title>\n  <rect width="${box.w}" height="${box.h}" fill="#fff" data-bg="1"/>\n${body}\n</svg>\n`;
}
