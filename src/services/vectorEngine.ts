/* =====================================================================
   COGNICOPIA DYNAMIC VECTOR ENGINE (DVE)
   The client-side pipeline that prepares any line drawing for a
   resident's cognitive tier before it prints:

     1. parses the SVG into a syntax tree (its own parser: no regular-
        expression surgery and no DOM, so it runs the same in the browser,
        in a worker and in Node);
     2. sets every line to the tier's weight (the stroke policy below),
        with round caps and joins so heavy lines never spike or notch;
     3. simplifies over-detailed paths with Ramer-Douglas-Peucker;
     4. for Tier 3, drops secondary details under 0.05 sq in, which read as
        visual noise to a person in the later stages;
     5. lays out the page: US Letter, 0.5 in outer margin, 0.75 in inner
        gutter on the hole-punch side (mirrored for two-sided printing);
     6. draws the optional therapeutic color legends at the foot of a page.

   Stroke policy, in CSS pixels at the printed size (96 px = 1 in,
   1 px = 0.75 pt):
       Tier 1   1.33x to 2.0x           4 to 4.5 px  (prints at 4 px = 3 pt)
       Tier 2   2.0x to 2.5x            5 to 7 px    (6 px)
       Tier 3   3.5x to 4.0x            9 to 12 px   (10.5 px)
   The base line is the drawing's own main line (2 to 3 px); the tier
   multiplies it, and the result always lands inside the tier's range, so
   no line prints thinner than 4 px (3 pt), the clinical floor. The CogniCore line-art engine (assets/cognicore/lineart.js)
   prints with the same numbers, so library pages and imported drawings
   match line for line.

   Built into assets/services/vectorEngine.js, a plain browser script that
   sets globalThis.CogniVectorEngine, by scripts/build-services.mjs.
   It touches no network, storage or page: it only turns text into text.
   @global CogniVectorEngine
   ===================================================================== */

export const VERSION = "1.0.0";

/* ---------- 1. Tiers and the stroke policy ---------- */
export type Tier = 1 | 2 | 3;
export interface Range { readonly min: number; readonly max: number; }
export interface StrokePolicy {
  readonly tier: Tier;
  readonly label: string;
  readonly multiplier: Range;
  readonly px: Range & { readonly target: number };
  readonly detailPx: number;
  readonly simplifyPx: number;
  readonly dropDetailsSqIn: number;
}
export const PX_PER_IN = 96;
export const PT_PER_PX = 0.75;
export const BASE_LINE_PX: Range = { min: 2, max: 3 };
export const STROKE_POLICY: Readonly<Record<Tier, StrokePolicy>> = {
  1: { tier: 1, label: "Tier 1 - High Detail", multiplier: { min: 1, max: 2 }, px: { min: 4, max: 4.5, target: 4 }, detailPx: 4, simplifyPx: .35, dropDetailsSqIn: 0 },
  2: { tier: 2, label: "Tier 2 - Guided Focus", multiplier: { min: 2, max: 2.5 }, px: { min: 5, max: 7, target: 6 }, detailPx: 5, simplifyPx: .6, dropDetailsSqIn: 0 },
  3: { tier: 3, label: "Tier 3 - Single Focal / Sensory", multiplier: { min: 3.5, max: 4 }, px: { min: 9, max: 12, target: 10.5 }, detailPx: 9, simplifyPx: 1, dropDetailsSqIn: .05 }
};
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const isTier = (t: unknown): t is Tier => t === 1 || t === 2 || t === 3;

/* The line widths a tier prints with, from the drawing's own base line
   (px at the printed size; null when the drawing has no lines to go by). */
export interface TierLines { basePx: number; multiplier: number; linePx: number; detailPx: number; linePt: number; detailPt: number; }
export function tierLines(tier: Tier, measuredBasePx: number | null = null): TierLines {
  const p = STROKE_POLICY[tier];
  const basePx = clamp(measuredBasePx == null || !(measuredBasePx > 0) ? BASE_LINE_PX.max : measuredBasePx, BASE_LINE_PX.min, BASE_LINE_PX.max);
  const multiplier = clamp(p.px.target / basePx, p.multiplier.min, p.multiplier.max);
  const linePx = round3(clamp(basePx * multiplier, p.px.min, p.px.max));
  const detailPx = round3(Math.min(linePx, p.detailPx));
  return { basePx: round3(basePx), multiplier: round3(multiplier), linePx, detailPx, linePt: round3(linePx * PT_PER_PX), detailPt: round3(detailPx * PT_PER_PX) };
}

/* ---------- 2. The SVG syntax tree ---------- */
export interface SvgElement { type: "element"; name: string; attrs: Record<string, string>; children: SvgNode[]; }
export interface SvgText { type: "text"; value: string; }
export interface SvgComment { type: "comment"; value: string; }
export interface SvgCData { type: "cdata"; value: string; }
export type SvgNode = SvgElement | SvgText | SvgComment | SvgCData;

export class SvgParseError extends Error {
  readonly offset: number;
  constructor(message: string, offset: number){ super(message + " (at character " + offset + ")"); this.name = "SvgParseError"; this.offset = offset; }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };
function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m: string, e: string): string => {
    if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENTITIES[e] ?? m;
  });
}
const escAttr = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* Parse SVG source into a tree rooted at its <svg> element. */
export function parseSvg(source: string): SvgElement {
  const s = String(source);
  let i = 0;
  const stack: SvgElement[] = [];
  let root: SvgElement | null = null;
  const add = (n: SvgNode): void => { const top = stack[stack.length - 1]; if (top) top.children.push(n); };
  while (i < s.length){
    const lt = s.indexOf("<", i);
    if (lt < 0){ add({ type: "text", value: s.slice(i) }); break; }
    if (lt > i) add({ type: "text", value: s.slice(i, lt) });
    if (s.startsWith("<!--", lt)){
      const end = s.indexOf("-->", lt + 4);
      if (end < 0) throw new SvgParseError("unclosed comment", lt);
      add({ type: "comment", value: s.slice(lt + 4, end) }); i = end + 3; continue;
    }
    if (s.startsWith("<![CDATA[", lt)){
      const end = s.indexOf("]]>", lt + 9);
      if (end < 0) throw new SvgParseError("unclosed CDATA section", lt);
      add({ type: "cdata", value: s.slice(lt + 9, end) }); i = end + 3; continue;
    }
    if (s.startsWith("<?", lt)){
      const end = s.indexOf("?>", lt + 2);
      if (end < 0) throw new SvgParseError("unclosed processing instruction", lt);
      i = end + 2; continue;
    }
    if (s.startsWith("<!", lt)){                       // DOCTYPE, possibly with an internal subset
      let j = lt + 2, depth = 0;
      for (; j < s.length; j++){ const c = s[j]; if (c === "[") depth++; else if (c === "]") depth--; else if (c === ">" && depth <= 0) break; }
      if (j >= s.length) throw new SvgParseError("unclosed declaration", lt);
      i = j + 1; continue;
    }
    if (s[lt + 1] === "/"){
      const end = s.indexOf(">", lt);
      if (end < 0) throw new SvgParseError("unclosed end tag", lt);
      const name = s.slice(lt + 2, end).trim();
      const open = stack.pop();
      if (!open || open.name !== name) throw new SvgParseError(`</${name}> does not close <${open ? open.name : "nothing"}>`, lt);
      i = end + 1; continue;
    }
    // a start tag: name, attributes, maybe self-closing
    let j = lt + 1;
    while (j < s.length && !/[\s/>]/.test(s[j])) j++;
    const name = s.slice(lt + 1, j);
    if (!name) throw new SvgParseError("a tag with no name", lt);
    const attrs: Record<string, string> = {};
    for (;;){
      while (j < s.length && /\s/.test(s[j])) j++;
      if (j >= s.length) throw new SvgParseError(`unclosed <${name}>`, lt);
      if (s[j] === ">" || (s[j] === "/" && s[j + 1] === ">")) break;
      let k = j;
      while (k < s.length && !/[\s=/>]/.test(s[k])) k++;
      const an = s.slice(j, k);
      if (!an) throw new SvgParseError(`a bad attribute in <${name}>`, j);
      j = k;
      while (j < s.length && /\s/.test(s[j])) j++;
      if (s[j] === "="){
        j++;
        while (j < s.length && /\s/.test(s[j])) j++;
        const q = s[j];
        if (q === "\"" || q === "'"){
          const end = s.indexOf(q, j + 1);
          if (end < 0) throw new SvgParseError(`an unclosed value for ${an}`, j);
          attrs[an] = decodeEntities(s.slice(j + 1, end)); j = end + 1;
        } else {
          let e = j; while (e < s.length && !/[\s>]/.test(s[e]) && !(s[e] === "/" && s[e + 1] === ">")) e++;
          attrs[an] = decodeEntities(s.slice(j, e)); j = e;
        }
      } else attrs[an] = "";
    }
    const selfClosing = s[j] === "/";
    i = j + (selfClosing ? 2 : 1);
    const el: SvgElement = { type: "element", name, attrs, children: [] };
    if (!stack.length){
      if (root) throw new SvgParseError("more than one root element", lt);
      root = el;
    } else add(el);
    if (!selfClosing) stack.push(el);
  }
  if (stack.length) throw new SvgParseError(`<${stack[stack.length - 1].name}> is never closed`, s.length);
  if (!root || root.name !== "svg") throw new SvgParseError("the root element is not <svg>", 0);
  return root;
}

/* Back to text. Attributes keep their order; elements without children close themselves. */
export function serializeSvg(node: SvgNode): string {
  if (node.type === "text") return node.value;
  if (node.type === "comment") return "<!--" + node.value + "-->";
  if (node.type === "cdata") return "<![CDATA[" + node.value + "]]>";
  const a = Object.keys(node.attrs).map(k => ` ${k}="${escAttr(node.attrs[k])}"`).join("");
  if (!node.children.length) return `<${node.name}${a}/>`;
  return `<${node.name}${a}>${node.children.map(serializeSvg).join("")}</${node.name}>`;
}

/* ---------- 3. Styles, transforms and geometry ---------- */
export function parseStyle(style: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  String(style || "").split(";").forEach(kv => { const c = kv.indexOf(":"); if (c > 0) out[kv.slice(0, c).trim().toLowerCase()] = kv.slice(c + 1).trim(); });
  return out;
}
/* A presentation value: the style attribute wins over the plain attribute. */
export function presentation(el: SvgElement, prop: string): string | undefined {
  const st = parseStyle(el.attrs.style);
  return st[prop] ?? el.attrs[prop];
}
/* Set a presentation value as a plain attribute and take it out of style="". */
export function setPresentation(el: SvgElement, prop: string, value: string | null): void {
  if (el.attrs.style){
    const st = parseStyle(el.attrs.style);
    if (prop in st){ delete st[prop]; const rest = Object.keys(st).map(k => k + ":" + st[k]).join(";"); if (rest) el.attrs.style = rest; else delete el.attrs.style; }
  }
  if (value == null) delete el.attrs[prop]; else el.attrs[prop] = value;
}

export type Matrix = [number, number, number, number, number, number];
export type Point = [number, number];
export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
export function multiply(p: Matrix, m: Matrix): Matrix {
  return [p[0] * m[0] + p[2] * m[1], p[1] * m[0] + p[3] * m[1], p[0] * m[2] + p[2] * m[3], p[1] * m[2] + p[3] * m[3], p[0] * m[4] + p[2] * m[5] + p[4], p[1] * m[4] + p[3] * m[5] + p[5]];
}
export const applyMatrix = (m: Matrix, p: Point): Point => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
export const matrixScale = (m: Matrix): number => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
export function parseTransform(t: string | undefined): Matrix {
  let m: Matrix = IDENTITY;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let x: RegExpExecArray | null;
  while ((x = re.exec(String(t || "")))){
    const a = x[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let n: Matrix;
    if (x[1] === "matrix") n = [a[0], a[1], a[2], a[3], a[4], a[5]];
    else if (x[1] === "translate") n = [1, 0, 0, 1, a[0] || 0, a[1] || 0];
    else if (x[1] === "scale") n = [a[0], 0, 0, a[1] ?? a[0], 0, 0];
    else if (x[1] === "rotate"){
      const r = (a[0] || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), cx = a[1] || 0, cy = a[2] || 0;
      n = multiply(multiply([1, 0, 0, 1, cx, cy], [c, s, -s, c, 0, 0]), [1, 0, 0, 1, -cx, -cy]);
    }
    else if (x[1] === "skewX") n = [1, 0, Math.tan((a[0] || 0) * Math.PI / 180), 1, 0, 0];
    else n = [1, Math.tan((a[0] || 0) * Math.PI / 180), 0, 1, 0, 0];
    m = multiply(m, n);
  }
  return m;
}

export interface Subpath { points: Point[]; closed: boolean; }

function arcPoints(x1: number, y1: number, rx: number, ry: number, phi: number, large: number, sweep: number, x2: number, y2: number): Point[] {
  if (!rx || !ry) return [[x2, y2]];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const p = phi * Math.PI / 180, cp = Math.cos(p), sp = Math.sin(p);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  const lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
  if (lam > 1){ rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = Math.sqrt(Math.max(0, num / den)); if (large === sweep) co = -co;
  const cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number): number => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(4, Math.ceil(Math.abs(dt) / (Math.PI / 16))), out: Point[] = [];
  for (let k = 1; k <= n; k++){ const t = t1 + dt * k / n; out.push([cx + rx * Math.cos(t) * cp - ry * Math.sin(t) * sp, cy + rx * Math.cos(t) * sp + ry * Math.sin(t) * cp]); }
  return out;
}

/* Path data into polylines (curves flattened into `steps` segments each). */
export function flattenPath(d: string, steps = 12): Subpath[] {
  const tok = String(d || "").match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
  const subs: Subpath[] = [];
  let cur: Subpath | null = null, i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0;
  let lc: Point | null = null, lq: Point | null = null;
  const num = (): number => +tok[i++];
  const flag = (): number => { const v = tok[i]; if (/^[01]{2,}/.test(v)){ tok[i] = v.slice(1); return +v[0]; } i++; return +v; };
  const start = (): void => { cur = { points: [[x, y]], closed: false }; subs.push(cur); };
  const to = (p: Point): void => { if (!cur) start(); (cur as Subpath).points.push(p); };
  const cubic = (p0: Point, p1: Point, p2: Point, p3: Point): void => {
    for (let k = 1; k <= steps; k++){ const t = k / steps, u = 1 - t; to([u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0], u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]]); }
  };
  while (i < tok.length){
    if (/[a-z]/i.test(tok[i])) cmd = tok[i++];
    else if (!cmd){ i++; continue; }
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === "Z"){ if (cur){ (cur as Subpath).closed = true; x = sx; y = sy; } cur = null; lc = lq = null; continue; }
    if (i >= tok.length || /[a-z]/i.test(tok[i])) continue;
    if (C === "M"){ x = ox + num(); y = oy + num(); sx = x; sy = y; start(); cmd = rel ? "l" : "L"; lc = lq = null; }
    else if (C === "L"){ x = ox + num(); y = oy + num(); to([x, y]); lc = lq = null; }
    else if (C === "H"){ x = ox + num(); to([x, y]); lc = lq = null; }
    else if (C === "V"){ y = oy + num(); to([x, y]); lc = lq = null; }
    else if (C === "C"){ const c1: Point = [ox + num(), oy + num()], c2: Point = [ox + num(), oy + num()], p: Point = [ox + num(), oy + num()]; cubic([x, y], c1, c2, p); lc = c2; lq = null; x = p[0]; y = p[1]; }
    else if (C === "S"){ const c1: Point = lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y], c2: Point = [ox + num(), oy + num()], p: Point = [ox + num(), oy + num()]; cubic([x, y], c1, c2, p); lc = c2; lq = null; x = p[0]; y = p[1]; }
    else if (C === "Q" || C === "T"){
      const q: Point = C === "Q" ? [ox + num(), oy + num()] : lq ? [2 * x - lq[0], 2 * y - lq[1]] : [x, y], p: Point = [ox + num(), oy + num()];
      cubic([x, y], [x + 2 / 3 * (q[0] - x), y + 2 / 3 * (q[1] - y)], [p[0] + 2 / 3 * (q[0] - p[0]), p[1] + 2 / 3 * (q[1] - p[1])], p); lq = q; lc = null; x = p[0]; y = p[1];
    }
    else if (C === "A"){ const rx = num(), ry = num(), phi = num(), fa = flag(), fs = flag(), p: Point = [ox + num(), oy + num()]; arcPoints(x, y, rx, ry, phi, fa, fs, p[0], p[1]).forEach(to); x = p[0]; y = p[1]; lc = lq = null; }
    else i++;
  }
  return subs.filter(sp => sp.points.length > 1);
}
const numAttr = (el: SvgElement, k: string): number => { const v = parseFloat(el.attrs[k] ?? ""); return Number.isFinite(v) ? v : 0; };
/* The outline of any drawable element, in its own units; null if it draws nothing. */
export function shapeSubpaths(el: SvgElement): Subpath[] | null {
  switch (el.name){
    case "path": return flattenPath(el.attrs.d || "");
    case "rect": { const x = numAttr(el, "x"), y = numAttr(el, "y"), w = numAttr(el, "width"), h = numAttr(el, "height"); return w > 0 && h > 0 ? [{ points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], closed: true }] : null; }
    case "circle": case "ellipse": {
      const cx = numAttr(el, "cx"), cy = numAttr(el, "cy"), rx = el.name === "circle" ? numAttr(el, "r") : numAttr(el, "rx"), ry = el.name === "circle" ? rx : numAttr(el, "ry");
      if (!(rx > 0) || !(ry > 0)) return null;
      const pts: Point[] = []; for (let k = 0; k < 48; k++){ const a = k / 48 * 2 * Math.PI; pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
      return [{ points: pts, closed: true }];
    }
    case "line": return [{ points: [[numAttr(el, "x1"), numAttr(el, "y1")], [numAttr(el, "x2"), numAttr(el, "y2")]], closed: false }];
    case "polyline": case "polygon": {
      const n = String(el.attrs.points || "").split(/[\s,]+/).filter(Boolean).map(Number), pts: Point[] = [];
      for (let k = 0; k + 1 < n.length; k += 2) pts.push([n[k], n[k + 1]]);
      return pts.length > 1 ? [{ points: pts, closed: el.name === "polygon" }] : null;
    }
    default: return null;
  }
}
/* Signed area (shoelace); positive for clockwise in screen coordinates. */
export function polygonArea(pts: Point[]): number {
  let a = 0; for (let k = 0; k < pts.length; k++){ const p = pts[k], q = pts[(k + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}
/* Point in polygon (even-odd). */
function inside(p: Point, poly: Point[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
/* The inked area of a shape made of several rings: a ring inside an odd
   number of others is a hole, whichever way it was drawn. */
export function netArea(subs: Subpath[]): number {
  const closed = subs.filter(sp => sp.points.length > 2);
  let total = 0;
  closed.forEach((sp, k) => {
    const depth = closed.reduce((n, o, j) => n + (j !== k && Math.abs(polygonArea(o.points)) > Math.abs(polygonArea(sp.points)) && inside(sp.points[0], o.points) ? 1 : 0), 0);
    total += (depth % 2 ? -1 : 1) * Math.abs(polygonArea(sp.points));
  });
  return Math.abs(total);
}
export function pathLength(sp: Subpath): number {
  let L = 0; const p = sp.points;
  for (let k = 1; k < p.length; k++) L += Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]);
  if (sp.closed && p.length > 2) L += Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]);
  return L;
}

/* Ramer-Douglas-Peucker: the fewest points that stay within epsilon of the line. */
export function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length < 3 || !(epsilon > 0)) return points.slice();
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length){
    const [a, b] = stack.pop() as [number, number];
    const A = points[a], B = points[b], dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
    let far = -1, best = epsilon;
    for (let k = a + 1; k < b; k++){
      const P = points[k];
      const d = L ? Math.abs(dy * P[0] - dx * P[1] + B[0] * A[1] - B[1] * A[0]) / L : Math.hypot(P[0] - A[0], P[1] - A[1]);
      if (d > best){ best = d; far = k; }
    }
    if (far >= 0){ keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return points.filter((_p, k) => keep[k] === 1);
}
/* A closed ring simplified as a ring: split at its farthest point so both halves keep their shape. */
function rdpSubpath(sp: Subpath, eps: number): Subpath {
  if (!sp.closed || sp.points.length < 4) return { points: rdp(sp.points, eps), closed: sp.closed };
  const p = sp.points; let far = 0, best = -1;
  for (let k = 1; k < p.length; k++){ const d = Math.hypot(p[k][0] - p[0][0], p[k][1] - p[0][1]); if (d > best){ best = d; far = k; } }
  const a = rdp(p.slice(0, far + 1), eps), b = rdp(p.slice(far).concat([p[0]]), eps);
  const pts = a.concat(b.slice(1, -1));
  return { points: pts.length >= 3 ? pts : p.slice(), closed: true };
}
const fmt = (n: number): string => { const r = Math.round(n * 100) / 100; return String(Object.is(r, -0) ? 0 : r); };
export function subpathsToD(subs: Subpath[]): string {
  return subs.map(sp => "M" + sp.points.map(p => fmt(p[0]) + " " + fmt(p[1])).join(" L") + (sp.closed ? " Z" : "")).join(" ");
}
function round3(n: number): number { return Math.round(n * 1000) / 1000; }

/* ---------- 4. Colors ---------- */
const NAMED: Record<string, [number, number, number]> = { black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255], gray: [128, 128, 128], grey: [128, 128, 128], silver: [192, 192, 192], yellow: [255, 255, 0], orange: [255, 165, 0], purple: [128, 0, 128], brown: [165, 42, 42], navy: [0, 0, 128] };
/* A paint value as RGB, "none", "paint-server" (a gradient or pattern) or null (not set). */
export function parsePaint(v: string | undefined): [number, number, number] | "none" | "paint-server" | null {
  if (v == null) return null;
  const s = v.trim().toLowerCase();
  if (!s || s === "inherit") return null;
  if (s === "none" || s === "transparent") return "none";
  if (s.startsWith("url(")) return "paint-server";
  if (s === "currentcolor") return [0, 0, 0];
  if (NAMED[s]) return NAMED[s];
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16)];
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(s);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  m = /^rgba?\(([^)]*)\)$/.exec(s);
  if (m){ const c = m[1].split(/[\s,/]+/).filter(Boolean).map(x => x.endsWith("%") ? parseFloat(x) * 2.55 : +x); return [c[0] || 0, c[1] || 0, c[2] || 0]; }
  return [0, 0, 0];
}
const lightness = (c: [number, number, number]): number => .299 * c[0] + .587 * c[1] + .114 * c[2];

/* ---------- 5. The pipeline ---------- */
export interface DveOptions {
  /** the detail tier: how much is simplified and dropped */
  tier: Tier;
  /** the line-weight tier, when it differs from the detail tier (low vision) */
  strokeTier?: Tier;
  /** printed width of the drawing in inches; default: the SVG's width in inches, else 6 */
  printWidthIn?: number;
  /** simplify over-detailed paths (default true) */
  simplify?: boolean;
  /** RDP tolerance in px at the printed size (default by tier: 0.35, 0.6, 1) */
  simplifyTolerancePx?: number;
  /** drop closed details smaller than this many square inches (default: 0.05 at Tier 3, else none) */
  dropDetailsBelowSqIn?: number;
  /** make every paint pure black or white (default true) */
  normalizeColors?: boolean;
}
export interface DveReport {
  tier: Tier; strokeTier: Tier; printWidthIn: number; pxPerUnit: number;
  measuredBasePx: number | null; lines: TierLines;
  strokedElements: number; thickenedFills: number; recolored: number;
  simplifiedPaths: number; pointsBefore: number; pointsAfter: number;
  droppedDetails: number; ms: number;
}
export interface DveResult { svg: string; ast: SvgElement; report: DveReport; }

const SKIP = new Set(["defs", "clipPath", "mask", "symbol", "marker", "pattern", "style", "title", "desc", "metadata", "linearGradient", "radialGradient", "filter", "script", "foreignObject"]);
const DRAWABLE = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
interface Drawable {
  el: SvgElement; parent: SvgElement; m: Matrix; scale: number;
  stroke: [number, number, number] | "none" | "paint-server"; strokeWidth: number;
  fill: [number, number, number] | "none" | "paint-server";
  subs: Subpath[];
}
const now = (): number => (globalThis.performance && typeof globalThis.performance.now === "function") ? globalThis.performance.now() : Date.now();
function lengthIn(v: string | undefined): number | null {
  const m = /^\s*([0-9.]+)\s*(in|pt|px|mm|cm|pc)?\s*$/i.exec(String(v || ""));
  if (!m) return null;
  const n = parseFloat(m[1]), u = (m[2] || "px").toLowerCase();
  return u === "in" ? n : u === "pt" ? n / 72 : u === "mm" ? n / 25.4 : u === "cm" ? n / 2.54 : u === "pc" ? n / 6 : n / PX_PER_IN;
}
export function viewBoxOf(root: SvgElement): [number, number, number, number] {
  const vb = String(root.attrs.viewBox || "").split(/[\s,]+/).filter(Boolean).map(Number);
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) return [vb[0], vb[1], vb[2], vb[3]];
  const w = parseFloat(root.attrs.width || "") || 600, h = parseFloat(root.attrs.height || "") || 800;
  return [0, 0, w, h];
}

interface Container { el: SvgElement; scale: number; }
/* Groups carry paint and opacity their children inherit: make those pure too. */
function normalizeContainer(el: SvgElement): boolean {
  let changed = false;
  const f = parsePaint(presentation(el, "fill")), s = parsePaint(presentation(el, "stroke"));
  if (f != null && f !== "none"){ const next = Array.isArray(f) && lightness(f) < 60 ? "#000" : "#fff"; if (presentation(el, "fill") !== next){ setPresentation(el, "fill", next); changed = true; } }
  if (s != null && s !== "none" && presentation(el, "stroke") !== "#000"){ setPresentation(el, "stroke", "#000"); changed = true; }
  for (const k of ["opacity", "fill-opacity", "stroke-opacity"]) if (presentation(el, k) != null){ setPresentation(el, k, null); changed = true; }
  return changed;
}
function collect(root: SvgElement, containers: Container[] = []): Drawable[] {
  const out: Drawable[] = [];
  const walk = (el: SvgElement, m: Matrix, stroke: Drawable["stroke"], sw: number, fill: Drawable["fill"]): void => {
    for (const n of el.children){
      if (n.type !== "element" || SKIP.has(n.name)) continue;
      const disp = presentation(n, "display"), vis = presentation(n, "visibility");
      if (disp === "none" || vis === "hidden") continue;
      const nm = n.attrs.transform ? multiply(m, parseTransform(n.attrs.transform)) : m;
      const s = parsePaint(presentation(n, "stroke")) ?? stroke, f = parsePaint(presentation(n, "fill")) ?? fill;
      const swv = presentation(n, "stroke-width"), w = swv != null && swv !== "" && Number.isFinite(parseFloat(swv)) ? parseFloat(swv) : sw;
      if (DRAWABLE.has(n.name)){
        const subs = shapeSubpaths(n);
        if (subs && subs.length) out.push({ el: n, parent: el, m: nm, scale: matrixScale(nm), stroke: s, strokeWidth: w, fill: f, subs });
      } else { containers.push({ el: n, scale: matrixScale(nm) }); walk(n, nm, s, w, f); }
    }
  };
  walk(root, IDENTITY, "none", 1, [0, 0, 0]);
  return out;
}
/* Weighted median: half the weight lies on each side. */
function weightedMedian(pairs: Array<[number, number]>): number | null {
  const v = pairs.filter(p => p[1] > 0 && Number.isFinite(p[0])).sort((a, b) => a[0] - b[0]);
  const total = v.reduce((t, p) => t + p[1], 0);
  if (!total) return null;
  let acc = 0; for (const p of v){ acc += p[1]; if (acc >= total / 2) return p[0]; }
  return v[v.length - 1][0];
}
const isInk = (c: Drawable["fill"]): boolean => Array.isArray(c) && lightness(c) < 60;

/* Run the whole pipeline on one drawing. */
export function transformSvg(source: string, options: DveOptions): DveResult {
  const t0 = now();
  if (!isTier(options.tier)) throw new Error("tier must be 1, 2 or 3");
  const tier = options.tier, strokeTier: Tier = isTier(options.strokeTier) ? options.strokeTier : tier, policy = STROKE_POLICY[tier];
  const root = parseSvg(source);
  const vb = viewBoxOf(root);
  const printWidthIn = options.printWidthIn && options.printWidthIn > 0 ? options.printWidthIn : (lengthIn(root.attrs.width) || 6);
  const pxPerUnit = printWidthIn * PX_PER_IN / vb[2], inPerUnit = printWidthIn / vb[2];
  const containers: Container[] = [];
  let items = collect(root, containers);
  const report: DveReport = { tier, strokeTier, printWidthIn, pxPerUnit: round3(pxPerUnit), measuredBasePx: null, lines: tierLines(strokeTier),
    strokedElements: 0, thickenedFills: 0, recolored: 0, simplifiedPaths: 0, pointsBefore: 0, pointsAfter: 0, droppedDetails: 0, ms: 0 };

  /* a. pure black and white */
  if (options.normalizeColors !== false){
    for (const c of containers.concat([{ el: root, scale: 1 }])) if (normalizeContainer(c.el)) report.recolored++;
    for (const d of items){
      let changed = false;
      if (d.fill !== "none"){
        const next = isInk(d.fill) ? "#000" : "#fff";
        if (presentation(d.el, "fill") !== next){ setPresentation(d.el, "fill", next); changed = true; }
        d.fill = next === "#000" ? [0, 0, 0] : [255, 255, 255];
      }
      if (d.stroke !== "none"){
        if (presentation(d.el, "stroke") !== "#000"){ setPresentation(d.el, "stroke", "#000"); changed = true; }
        d.stroke = [0, 0, 0];
      }
      for (const k of ["opacity", "fill-opacity", "stroke-opacity"]) if (presentation(d.el, k) != null){ setPresentation(d.el, k, null); changed = true; }
      if (changed) report.recolored++;
    }
  }

  /* b. Tier 3: drop small secondary details */
  const dropBelow = options.dropDetailsBelowSqIn ?? policy.dropDetailsSqIn;
  if (dropBelow > 0){
    const keep: Drawable[] = [];
    for (const d of items){
      const sqIn = (u: number): number => u * d.scale * d.scale * inPerUnit * inPerUnit;
      const closed = d.subs.every(sp => sp.closed) && d.el.name !== "line" && d.el.name !== "polyline";
      let drop = false;
      if (closed){
        const area = sqIn(netArea(d.subs));
        drop = isInk(d.fill) ? area < Math.min(dropBelow, .005) : area < dropBelow;          // solid accents (eyes, knobs) stay unless they are specks
      } else {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        d.subs.forEach(sp => sp.points.forEach(p => { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }));
        const len = d.subs.reduce((t, sp) => t + pathLength(sp), 0) * d.scale * inPerUnit;
        drop = sqIn((x1 - x0) * (y1 - y0)) < dropBelow && len < .6;                          // a short squiggle
      }
      if (drop){ d.parent.children = d.parent.children.filter(c => c !== d.el); report.droppedDetails++; }
      else keep.push(d);
    }
    items = keep;
  }

  /* c. simplify over-detailed paths (auto-traced drawings) */
  if (options.simplify !== false){
    const tolPx = options.simplifyTolerancePx ?? policy.simplifyPx;
    for (const d of items){
      if (d.el.name !== "path" && d.el.name !== "polyline" && d.el.name !== "polygon") continue;
      const pts = d.subs.reduce((t, sp) => t + sp.points.length, 0);
      report.pointsBefore += pts;
      const lenPx = d.subs.reduce((t, sp) => t + pathLength(sp), 0) * d.scale * pxPerUnit;
      const curvy = d.el.name === "path" && /[CcSsQqTtAa]/.test(d.el.attrs.d || "");
      const micro = pts > 400 || (!curvy && pts > 8 && lenPx / pts < 1.5);                  // many points, or segments under 1.5 px
      if (!micro){ report.pointsAfter += pts; continue; }
      const eps = tolPx / (pxPerUnit * d.scale);
      const next = d.subs.map(sp => rdpSubpath(sp, eps));
      const after = next.reduce((t, sp) => t + sp.points.length, 0);
      if (after < pts * .8){
        if (d.el.name === "path") d.el.attrs.d = subpathsToD(next);
        else d.el.attrs.points = next[0].points.map(p => fmt(p[0]) + "," + fmt(p[1])).join(" ");
        d.subs = next; report.simplifiedPaths++; report.pointsAfter += after;
      } else report.pointsAfter += pts;
    }
  }

  /* d. line weight for the tier */
  const stroked = items.filter(d => d.stroke !== "none" && d.strokeWidth > 0);
  const inkFills = items.filter(d => isInk(d.fill) && !(d.stroke !== "none" && d.strokeWidth > 0));
  let base = weightedMedian(stroked.map(d => [d.strokeWidth * d.scale * pxPerUnit, d.subs.reduce((t, sp) => t + pathLength(sp), 0) * d.scale] as [number, number]));
  const fillThickness = (d: Drawable): number => {
    const area = netArea(d.subs), per = d.subs.reduce((t, sp) => t + pathLength(sp), 0);
    return per ? 2 * area / per * d.scale * pxPerUnit : 0;                                  // a band's thickness is about 2 x area / perimeter
  };
  if (base == null && inkFills.length) base = weightedMedian(inkFills.map(d => [fillThickness(d), netArea(d.subs)] as [number, number]));
  report.measuredBasePx = base == null ? null : round3(base);
  const lines = tierLines(strokeTier, base);
  report.lines = lines;
  for (const d of stroked){
    const wPx = d.strokeWidth * d.scale * pxPerUnit;
    const target = base != null && wPx < base * .85 ? lines.detailPx : lines.linePx;       // thinner-than-main lines are interior detail
    setPresentation(d.el, "stroke-width", fmt3(target / (d.scale * pxPerUnit)));
    setPresentation(d.el, "stroke-linecap", "round");
    setPresentation(d.el, "stroke-linejoin", "round");
    report.strokedElements++;
  }
  for (const c of containers) if (presentation(c.el, "stroke-width") != null) setPresentation(c.el, "stroke-width", fmt3(lines.linePx / (c.scale * pxPerUnit)));   // what children inherit
  if (!stroked.length) for (const d of inkFills){
    const th = fillThickness(d);
    if (th > 0 && th < lines.linePx * .95){                                                // grow drawn-as-fill lines with a matching outline
      setPresentation(d.el, "stroke", "#000");
      setPresentation(d.el, "stroke-width", fmt3((lines.linePx - th) / (d.scale * pxPerUnit)));
      setPresentation(d.el, "stroke-linejoin", "round");
      report.thickenedFills++;
    }
  }
  setPresentation(root, "stroke-linecap", "round");
  setPresentation(root, "stroke-linejoin", "round");
  report.ms = round3(now() - t0);
  return { svg: serializeSvg(root), ast: root, report };
}
function fmt3(n: number): string { return String(Math.round(n * 1000) / 1000); }

/* ---------- 6. Page layout: US Letter with a binding gutter ---------- */
export const PAGE = {
  widthIn: 8.5, heightIn: 11, outerMarginIn: .5, innerGutterIn: .75, topMarginIn: .5, bottomMarginIn: .5,
  holes: { diameterIn: .3125, fromEdgeIn: .375, centersIn: [1.25, 5.5, 9.75] }
} as const;
export interface Box { x: number; y: number; w: number; h: number; }
export interface PageFrame {
  unit: "in" | "pt"; width: number; height: number; gutterSide: "left" | "right";
  margins: { left: number; right: number; top: number; bottom: number };
  content: Box; holes: Array<{ cx: number; cy: number; r: number }>;
}
/* The printable frame of one page. Single-sided: the gutter (and the
   three-ring holes) is always on the left. Two-sided: odd pages have it on
   the left and even pages on the right, so it is always the bound edge. */
export function pageFrame(options: { pageNumber?: number; duplex?: boolean; unit?: "in" | "pt" } = {}): PageFrame {
  const k = options.unit === "pt" ? 72 : 1, page = options.pageNumber && options.pageNumber > 0 ? options.pageNumber : 1;
  const gutterSide: "left" | "right" = options.duplex && page % 2 === 0 ? "right" : "left";
  const left = (gutterSide === "left" ? PAGE.innerGutterIn : PAGE.outerMarginIn) * k, right = (gutterSide === "left" ? PAGE.outerMarginIn : PAGE.innerGutterIn) * k;
  const top = PAGE.topMarginIn * k, bottom = PAGE.bottomMarginIn * k, width = PAGE.widthIn * k, height = PAGE.heightIn * k;
  const holeX = (gutterSide === "left" ? PAGE.holes.fromEdgeIn : PAGE.widthIn - PAGE.holes.fromEdgeIn) * k;
  return {
    unit: options.unit === "pt" ? "pt" : "in", width, height, gutterSide, margins: { left, right, top, bottom },
    content: { x: left, y: top, w: width - left - right, h: height - top - bottom },
    holes: PAGE.holes.centersIn.map(c => ({ cx: holeX, cy: c * k, r: PAGE.holes.diameterIn / 2 * k }))
  };
}
/* The largest box of the given aspect (width / height, 3:4 by default)
   inside the content area, after space kept above and below, centered. */
export function fitArt(frame: PageFrame, options: { aspect?: number; reserveTop?: number; reserveBottom?: number } = {}): Box {
  const aspect = options.aspect && options.aspect > 0 ? options.aspect : .75;
  const top = options.reserveTop || 0, bottom = options.reserveBottom || 0;
  const availW = frame.content.w, availH = Math.max(0, frame.content.h - top - bottom);
  let w = availW, h = w / aspect;
  if (h > availH){ h = availH; w = h * aspect; }
  return { x: frame.content.x + (availW - w) / 2, y: frame.content.y + top + (availH - h) / 2, w, h };
}

/* ---------- 7. Therapeutic color legends ----------
   A strip at the foot of the page, outside the picture, suggesting colors
   for the person coloring and whoever sits with them. Off by default; the
   picture itself always stays pure black on white. */
export type LegendMode = "off" | "anxiety-reduction" | "high-contrast";
export interface Swatch { readonly name: string; readonly hex: string; }
export interface Legend { readonly mode: Exclude<LegendMode, "off">; readonly title: string; readonly note: string; readonly swatches: readonly Swatch[]; }
export const LEGENDS: Readonly<Record<Exclude<LegendMode, "off">, Legend>> = {
  "anxiety-reduction": { mode: "anxiety-reduction", title: "Calming colors", note: "Soft blues and greens, for a quiet, settled mood.",
    swatches: [{ name: "Sky blue", hex: "#8FC1E3" }, { name: "Lake blue", hex: "#5B9BD5" }, { name: "Seafoam", hex: "#93D3C1" }, { name: "Sage", hex: "#A9C5A0" }, { name: "Fern", hex: "#6FA878" }] },
  "high-contrast": { mode: "high-contrast", title: "High-contrast colors", note: "Bright yellow next to deep navy is the easiest pair to see.",
    swatches: [{ name: "Lemon yellow", hex: "#FFE500" }, { name: "Marigold", hex: "#FFB000" }, { name: "Navy", hex: "#0A2463" }, { name: "Cobalt", hex: "#0047AB" }] }
};
export const LEGEND_MODES: readonly LegendMode[] = ["off", "anxiety-reduction", "high-contrast"];
export const legendHeightIn = (mode: LegendMode): number => mode === "off" ? 0 : .75;
const escText = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/* The note in two lines, split at the space nearest the middle. */
function twoLines(t: string): [string, string] {
  if (t.length <= 30) return [t, ""];
  let best = -1;
  for (let k = 0; k < t.length; k++) if (t[k] === " " && (best < 0 || Math.abs(k - t.length / 2) < Math.abs(best - t.length / 2))) best = k;
  return best < 0 ? [t, ""] : [t.slice(0, best), t.slice(best + 1)];
}
/* Where things sit in the strip, in points: the same for SVG and PDF. */
function legendLayout(mode: Exclude<LegendMode, "off">, w: number): { h: number; cell: number; left: number; box: number } {
  return { h: legendHeightIn(mode) * 72, left: 160, cell: (w - 164) / LEGENDS[mode].swatches.length, box: 22 };
}
/* The legend as an SVG strip widthIn wide (its height is legendHeightIn). */
export function legendSvg(mode: LegendMode, widthIn: number): string {
  if (mode === "off") return "";
  const L = LEGENDS[mode], W = Math.round(widthIn * 72), G = legendLayout(mode, W), H = Math.round(G.h), note = twoLines(L.note);
  const font = 'font-family="Atkinson Hyperlegible, Arial, sans-serif" fill="#000"';
  const cells = L.swatches.map((sw, k) => {
    const cx = G.left + k * G.cell + G.cell / 2;
    return `<rect x="${fmt(cx - G.box / 2)}" y="7" width="${G.box}" height="${G.box}" rx="4" fill="${sw.hex}" stroke="#000" stroke-width="1.5"/>` +
      `<text x="${fmt(cx)}" y="45" font-size="11" text-anchor="middle" ${font}>${escText(sw.name)}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" class="dve-legend" data-legend="${mode}" viewBox="0 0 ${W} ${H}" width="${fmt(widthIn)}in" height="${fmt(legendHeightIn(mode))}in" role="img" aria-label="${escText(L.title)}: ${escText(L.swatches.map(sw => sw.name).join(", "))}">` +
    `<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="6" fill="#fff" stroke="#000" stroke-width="1.5"/>` +
    `<text x="10" y="19" font-size="13" font-weight="700" ${font}>${escText(L.title)}</text>` +
    `<text x="10" y="33" font-size="9.5" ${font}>${escText(note[0])}</text><text x="10" y="45" font-size="9.5" ${font}>${escText(note[1])}</text>` +
    cells + "</svg>";
}
/* The minimal jsPDF surface the legend needs. */
export interface PdfLike {
  setFillColor(r: number, g: number, b: number): unknown;
  setDrawColor(r: number, g: number, b: number): unknown;
  setLineWidth(w: number): unknown;
  roundedRect(x: number, y: number, w: number, h: number, rx: number, ry: number, style: string): unknown;
  setFontSize(size: number): unknown;
  setFont?(family: string, style: string): unknown;
  setTextColor?(r: number, g: number, b: number): unknown;
  text(text: string, x: number, y: number, options?: Record<string, unknown>): unknown;
}
const hexRgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
/* Draw the legend into a PDF at x, y (points), w wide. Returns the height used. */
export function drawLegendPdf(doc: PdfLike, mode: LegendMode, x: number, y: number, w: number, font = "helvetica"): number {
  if (mode === "off") return 0;
  const L = LEGENDS[mode], G = legendLayout(mode, w), note = twoLines(L.note);
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(1.5); doc.setFillColor(255, 255, 255);
  doc.roundedRect(x + .75, y + .75, w - 1.5, G.h - 1.5, 6, 6, "FD");
  if (doc.setTextColor) doc.setTextColor(0, 0, 0);
  if (doc.setFont) doc.setFont(font, "bold");
  doc.setFontSize(13); doc.text(L.title, x + 10, y + 19);
  if (doc.setFont) doc.setFont(font, "normal");
  doc.setFontSize(9.5); doc.text(note[0], x + 10, y + 33); if (note[1]) doc.text(note[1], x + 10, y + 45);
  L.swatches.forEach((sw, k) => {
    const cx = x + G.left + k * G.cell + G.cell / 2, c = hexRgb(sw.hex);
    doc.setFillColor(c[0], c[1], c[2]); doc.setLineWidth(1.5);
    doc.roundedRect(cx - G.box / 2, y + 7, G.box, G.box, 4, 4, "FD");
    doc.setFontSize(11); doc.text(sw.name, cx, y + 45, { align: "center" });
  });
  doc.setFillColor(255, 255, 255);
  return G.h;
}

/* The legend as a column beside the picture, where a 3:4 picture leaves
   width unused on a Letter page, so switching it on never shrinks the art.
   widthIn about 1.2 in; the column is as tall as its content (legendColumnHeightIn). */
export const LEGEND_COLUMN_WIDTH_IN = 1.25;
/* Break text into lines of at most maxChars characters, at spaces. */
export function wrapText(text: string, maxChars: number): string[] {
  const out: string[] = []; let line = "";
  for (const w of String(text).split(/\s+/).filter(Boolean)){
    if (line && (line + " " + w).length > maxChars){ out.push(line); line = w; } else line = line ? line + " " + w : w;
  }
  if (line) out.push(line);
  return out;
}
function columnLayout(mode: Exclude<LegendMode, "off">, widthIn: number): { w: number; titleLines: string[]; noteLines: string[]; rowH: number; top: number; h: number } {
  const L = LEGENDS[mode], w = widthIn * 72, titleLines = wrapText(L.title, 13), noteLines = wrapText(L.note, 17), rowH = 38;
  const top = 12 + titleLines.length * 15 + 6;
  return { w, titleLines, noteLines, rowH, top, h: top + L.swatches.length * rowH + 4 + noteLines.length * 12 + 12 };
}
export const legendColumnHeightIn = (mode: LegendMode, widthIn = LEGEND_COLUMN_WIDTH_IN): number => mode === "off" ? 0 : columnLayout(mode, widthIn).h / 72;
export function legendColumnSvg(mode: LegendMode, widthIn = LEGEND_COLUMN_WIDTH_IN): string {
  if (mode === "off") return "";
  const L = LEGENDS[mode], G = columnLayout(mode, widthIn), W = Math.round(G.w), H = Math.round(G.h);
  const font = 'font-family="Atkinson Hyperlegible, Arial, sans-serif" fill="#000"';
  const title = G.titleLines.map((t, k) => `<text x="${W / 2}" y="${24 + k * 15}" font-size="12.5" font-weight="700" text-anchor="middle" ${font}>${escText(t)}</text>`).join("");
  const rows = L.swatches.map((sw, k) => {
    const y = G.top + k * G.rowH;
    return `<rect x="${fmt(W / 2 - 12)}" y="${fmt(y)}" width="24" height="20" rx="4" fill="${sw.hex}" stroke="#000" stroke-width="1.5"/>` +
      `<text x="${W / 2}" y="${fmt(y + 32)}" font-size="10.5" text-anchor="middle" ${font}>${escText(sw.name)}</text>`;
  }).join("");
  const ny = G.top + L.swatches.length * G.rowH + 12;
  const note = G.noteLines.map((t, k) => `<text x="${W / 2}" y="${fmt(ny + k * 12)}" font-size="9" text-anchor="middle" ${font}>${escText(t)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" class="dve-legend" data-legend="${mode}" viewBox="0 0 ${W} ${H}" width="${fmt(widthIn)}in" height="${fmt(H / 72)}in" role="img" aria-label="${escText(L.title)}: ${escText(L.swatches.map(sw => sw.name).join(", "))}">` +
    `<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="6" fill="#fff" stroke="#000" stroke-width="1.5"/>` + title + rows + note + "</svg>";
}
export function drawLegendColumnPdf(doc: PdfLike, mode: LegendMode, x: number, y: number, widthIn = LEGEND_COLUMN_WIDTH_IN, font = "helvetica"): number {
  if (mode === "off") return 0;
  const L = LEGENDS[mode], G = columnLayout(mode, widthIn), cx = x + G.w / 2;
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(1.5); doc.setFillColor(255, 255, 255);
  doc.roundedRect(x + .75, y + .75, G.w - 1.5, G.h - 1.5, 6, 6, "FD");
  if (doc.setTextColor) doc.setTextColor(0, 0, 0);
  if (doc.setFont) doc.setFont(font, "bold");
  doc.setFontSize(12.5); G.titleLines.forEach((t, k) => doc.text(t, cx, y + 24 + k * 15, { align: "center" }));
  if (doc.setFont) doc.setFont(font, "normal");
  L.swatches.forEach((sw, k) => {
    const ry = y + G.top + k * G.rowH, c = hexRgb(sw.hex);
    doc.setFillColor(c[0], c[1], c[2]); doc.setLineWidth(1.5);
    doc.roundedRect(cx - 12, ry, 24, 20, 4, 4, "FD");
    doc.setFontSize(10.5); doc.text(sw.name, cx, ry + 32, { align: "center" });
  });
  const ny = y + G.top + L.swatches.length * G.rowH + 12;
  doc.setFontSize(9); G.noteLines.forEach((t, k) => doc.text(t, cx, ny + k * 12, { align: "center" }));
  doc.setFillColor(255, 255, 255);
  return G.h;
}

/* ---------- 8. Any SVG into a PDF, as vectors ----------
   Draws an SVG (a library page, an imported drawing, a DVE result) into a
   jsPDF document at x, y (points), widthPt wide, keeping every path a
   vector: curves are flattened finely (well under a printer dot) and each
   shape is filled and stroked as the SVG says. Only black, white and
   none are drawn; that is all a coloring page may contain. */
export interface PdfPathLike {
  setDrawColor(r: number, g: number, b: number): unknown;
  setFillColor(r: number, g: number, b: number): unknown;
  setLineWidth(w: number): unknown;
  setLineCap?(cap: string): unknown;
  setLineJoin?(join: string): unknown;
  moveTo(x: number, y: number): unknown;
  lineTo(x: number, y: number): unknown;
  close(): unknown;
  stroke(): unknown;
  fill(): unknown;
  fillStroke(): unknown;
  fillEvenOdd?(): unknown;
  fillStrokeEvenOdd?(): unknown;
}
export function drawSvgPdf(doc: PdfPathLike, source: string | SvgElement, x: number, y: number, widthPt: number): { paths: number; ms: number } {
  const t0 = now();
  const root = typeof source === "string" ? parseSvg(source) : source, vb = viewBoxOf(root);
  const k = widthPt / vb[2], base: Matrix = [k, 0, 0, k, x - vb[0] * k, y - vb[1] * k];
  if (doc.setLineCap) doc.setLineCap("round");
  if (doc.setLineJoin) doc.setLineJoin("round");
  let paths = 0;
  const walk = (el: SvgElement, m: Matrix, stroke: Drawable["stroke"], sw: number, fill: Drawable["fill"], rule: string): void => {
    for (const n of el.children){
      if (n.type !== "element" || SKIP.has(n.name)) continue;
      if (presentation(n, "display") === "none" || presentation(n, "visibility") === "hidden") continue;
      const nm = n.attrs.transform ? multiply(m, parseTransform(n.attrs.transform)) : m;
      const s = parsePaint(presentation(n, "stroke")) ?? stroke, f = parsePaint(presentation(n, "fill")) ?? fill;
      const swv = presentation(n, "stroke-width"), w = swv != null && swv !== "" && Number.isFinite(parseFloat(swv)) ? parseFloat(swv) : sw;
      const r = presentation(n, "fill-rule") || rule;                 // inherited, like the paints
      if (!DRAWABLE.has(n.name)){ walk(n, nm, s, w, f, r); continue; }
      const subs = shapeSubpaths(n);
      if (!subs || !subs.length) continue;
      const doFill = Array.isArray(f), doStroke = Array.isArray(s) && w > 0;
      if (!doFill && !doStroke) continue;
      for (const sp of subs){
        const p0 = applyMatrix(nm, sp.points[0]);
        doc.moveTo(p0[0], p0[1]);
        for (let q = 1; q < sp.points.length; q++){ const p = applyMatrix(nm, sp.points[q]); doc.lineTo(p[0], p[1]); }
        if (sp.closed) doc.close();
      }
      const ink = (c: [number, number, number]): number => lightness(c) < 128 ? 0 : 255;
      if (doFill){ const v = ink(f as [number, number, number]); doc.setFillColor(v, v, v); }
      if (doStroke){ const v = ink(s as [number, number, number]); doc.setDrawColor(v, v, v); doc.setLineWidth(w * matrixScale(nm)); }
      const evenOdd = r === "evenodd" && !!doc.fillEvenOdd && !!doc.fillStrokeEvenOdd;   // rings keep their holes
      if (doFill && doStroke){ if (evenOdd) doc.fillStrokeEvenOdd!(); else doc.fillStroke(); }
      else if (doFill){ if (evenOdd) doc.fillEvenOdd!(); else doc.fill(); }
      else doc.stroke();
      paths++;
    }
  };
  walk(root, base, "none", 1, [0, 0, 0], presentation(root, "fill-rule") || "nonzero");
  doc.setFillColor(255, 255, 255); doc.setDrawColor(0, 0, 0);
  return { paths, ms: round3(now() - t0) };
}
