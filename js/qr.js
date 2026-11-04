/* A small offline QR code encoder: byte mode, error correction level M, versions 1 to 10 (up to 213 bytes). No network, no library.
   qrMatrix(text) -> array of rows of booleans (true = dark). qrSvg(text, opts) -> an SVG string of black squares on white with the
   4-module quiet zone. Used for the codes printed on conversation cards, which point at audio that plays on the device itself. */

const ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];       // level M, versions 1..10
const BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const rawModules = (v) => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
const dataCodewords = (v) => Math.floor(rawModules(v) / 8) - ECC_PER_BLOCK[v] * BLOCKS[v];
export const MAX_BYTES = (() => { let m = 0; for (let v = 1; v <= 10; v++) { const bits = dataCodewords(v) * 8 - 4 - (v < 10 ? 8 : 16); m = Math.max(m, Math.floor(bits / 8)); } return m; })();

/* Reed-Solomon over GF(256), polynomial 0x11D */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const gmul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function rsGenerator(deg) { let g = [1]; for (let i = 0; i < deg; i++) { const n = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j++) { n[j] ^= g[j]; n[j + 1] ^= gmul(g[j], EXP[i]); } g = n; } return g; }
function rsRemainder(data, deg) { const gen = rsGenerator(deg), res = new Array(deg).fill(0); for (const b of data) { const f = b ^ res.shift(); res.push(0); if (f) for (let i = 0; i < deg; i++) res[i] ^= gmul(gen[i + 1], f); } return res; }

function bitsFor(text) {
  const bytes = [...new TextEncoder().encode(String(text))], v = (() => { for (let v = 1; v <= 10; v++) if (bytes.length <= Math.floor((dataCodewords(v) * 8 - 4 - (v < 10 ? 8 : 16)) / 8)) return v; return 0; })();
  if (!v) throw new RangeError("too much text for a QR code here (" + bytes.length + " bytes; the limit is " + MAX_BYTES + ")");
  const bits = []; const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach((b) => put(b, 8));
  const cap = dataCodewords(v) * 8; put(0, Math.min(4, cap - bits.length)); while (bits.length % 8) bits.push(0);
  for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
  const cw = []; for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  return { v, cw };
}
function interleave(v, data) {
  const nb = BLOCKS[v], ecl = ECC_PER_BLOCK[v], raw = Math.floor(rawModules(v) / 8), numShort = nb - (raw % nb), shortLen = Math.floor(raw / nb), blocks = [];
  for (let i = 0, k = 0; i < nb; i++) { const len = shortLen - ecl + (i < numShort ? 0 : 1), d = data.slice(k, k + len); k += len; blocks.push({ d, e: rsRemainder(d, ecl) }); }
  const out = []; for (let i = 0; i < shortLen - ecl + 1; i++) blocks.forEach((b) => { if (i < b.d.length) out.push(b.d[i]); }); for (let i = 0; i < ecl; i++) blocks.forEach((b) => out.push(b.e[i]));
  return out;
}
function build(v, codewords, mask) {
  const size = 17 + 4 * v, m = Array.from({ length: size }, () => new Array(size).fill(false)), fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark, isFn = true) => { if (x >= 0 && y >= 0 && x < size && y < size) { m[y][x] = dark; if (isFn) fn[y][x] = true; } };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4); } };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  if (v >= 2) { const n = Math.floor(v / 7) + 2, step = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, pos = [6]; for (let p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0))) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
  const drawFormat = (msk) => { const data = (0 << 3) | msk; let rem = data; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537); const bits = ((data << 10) | rem) ^ 0x5412, bit = (i) => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i)); set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8)); for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i)); for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i)); set(8, size - 8, true); };
  drawFormat(0);
  if (v >= 7) { let rem = v; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25); const bits = (v << 12) | rem; for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3), b = Math.floor(i / 3), d = ((bits >>> i) & 1) !== 0; set(a, b, d); set(b, a, d); } }
  let bi = 0; const total = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) { if (right === 6) right = 5; for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) { const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert; if (!fn[y][x] && bi < total) { m[y][x] = ((codewords[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0; bi++; } } }
  const maskFn = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0, (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0][mask];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && maskFn(x, y)) m[y][x] = !m[y][x];
  drawFormat(mask); return m;
}
function penalty(m) {
  const n = m.length; let p = 0, dark = 0;
  for (let pass = 0; pass < 2; pass++) for (let a = 0; a < n; a++) { let run = 1; const get = (i) => (pass ? m[i][a] : m[a][i]); for (let i = 1; i < n; i++) { if (get(i) === get(i - 1)) { run++; if (i === n - 1 && run >= 5) p += 3 + run - 5; } else { if (run >= 5) p += 3 + run - 5; run = 1; } }
    const line = []; for (let i = 0; i < n; i++) line.push(get(i) ? 1 : 0); const s = line.join(""); for (const pat of ["10111010000", "00001011101"]) { let at = s.indexOf(pat); while (at >= 0) { p += 40; at = s.indexOf(pat, at + 1); } } }
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
  for (const r of m) for (const c of r) if (c) dark++; p += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10; return p;
}
export function qrMatrix(text) {
  const { v, cw } = bitsFor(text), data = interleave(v, cw); let best = null, bestP = Infinity;
  for (let mask = 0; mask < 8; mask++) { const m = build(v, data, mask), p = penalty(m); if (p < bestP) { bestP = p; best = m; } }
  return best;
}
/* An SVG of the code: one path of dark squares on white, with the required 4-module quiet zone around it. scale is pixels per module. */
export function qrSvg(text, o = {}) {
  const m = qrMatrix(text), n = m.length, q = 4, sc = Math.max(1, Math.min(20, o.scale || 4)), d = [];
  for (let y = 0; y < n; y++) { let x = 0; while (x < n) { if (m[y][x]) { let e = x; while (e < n && m[y][e]) e++; d.push(`M${x + q} ${y + q}h${e - x}v1h${-(e - x)}z`); x = e; } else x++; } }
  const label = String(o.label || "QR code").replace(/[<>&"]/g, " ").slice(0, 80), px = (n + 2 * q) * sc;
  return `<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 2 * q} ${n + 2 * q}" width="${px}" height="${px}" role="img" aria-label="${label}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff" data-bw="white"/><path d="${d.join("")}" fill="#000"/></svg>`;
}
