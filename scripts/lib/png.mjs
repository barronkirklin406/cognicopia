/* =====================================================================
   PNG reading and writing with Node's own zlib, for the coloring ingest
   pipeline: reads what image generators produce (8- and 16-bit gray,
   gray+alpha, RGB, RGBA and palette, plain or interlaced) and writes
   1-bit black-and-white line art with its print resolution recorded.
   ===================================================================== */
import zlib from "zlib";

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf){ let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data){
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/* Decode to { w, h, gray: Uint8Array (0 black .. 255 white, alpha blended on
   white), dpi, colorFraction: the share of pixels with visible color } */
export function decodePNG(buf){
  if (!Buffer.isBuffer(buf) || buf.length < 8 || !buf.subarray(0, 8).equals(SIG)) throw new Error("not a PNG file");
  let pos = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0, palette = null, trns = null, dpi = 0; const idat = [];
  while (pos + 8 <= buf.length){
    const len = buf.readUInt32BE(pos), type = buf.toString("ascii", pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR"){ w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12]; }
    else if (type === "PLTE") palette = data;
    else if (type === "tRNS") trns = data;
    else if (type === "pHYs" && data[8] === 1) dpi = Math.round(data.readUInt32BE(0) * .0254);
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (!w || !h) throw new Error("PNG has no image header");
  const chans = { 0:1, 2:3, 3:1, 4:2, 6:4 }[ctype];
  if (!chans) throw new Error("unsupported PNG color type " + ctype);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = Math.max(1, (chans * depth) >> 3);
  const out = new Uint8Array(w * h);
  const sample = (row, x, c) => {                        // one channel of pixel x in an unfiltered row, scaled to 0..255
    if (depth === 8) return row[x * chans + c];
    if (depth === 16) return row[(x * chans + c) * 2];
    const per = 8 / depth, byte = row[Math.floor(x / per)], shift = (per - 1 - (x % per)) * depth, v = (byte >> shift) & ((1 << depth) - 1);
    return ctype === 3 ? v : Math.round(v * 255 / ((1 << depth) - 1));
  };
  let colored = 0;
  const toGray = (row, x) => {
    let r, g, b, a = 255;
    if (ctype === 3){ const i = sample(row, x, 0); r = palette[i * 3]; g = palette[i * 3 + 1]; b = palette[i * 3 + 2]; if (trns && i < trns.length) a = trns[i]; }
    else if (ctype === 0 || ctype === 4){ r = g = b = sample(row, x, 0); if (ctype === 4) a = sample(row, x, 1); }
    else { r = sample(row, x, 0); g = sample(row, x, 1); b = sample(row, x, 2); if (ctype === 6) a = sample(row, x, 3); }
    if (a > 128 && Math.max(r, g, b) - Math.min(r, g, b) > 48) colored++;
    const lum = .299 * r + .587 * g + .114 * b;
    return Math.round((lum * a + 255 * (255 - a)) / 255);   // transparent areas read as white paper
  };
  const unfilter = (data, off, pw, ph, emit) => {
    const stride = Math.ceil(pw * chans * depth / 8);
    let prev = new Uint8Array(stride), p = off;
    for (let y = 0; y < ph; y++){
      const ft = data[p++], row = new Uint8Array(data.subarray(p, p + stride)); p += stride;
      for (let i = 0; i < stride; i++){
        const a = i >= bpp ? row[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
        if (ft === 1) row[i] = (row[i] + a) & 255;
        else if (ft === 2) row[i] = (row[i] + b) & 255;
        else if (ft === 3) row[i] = (row[i] + ((a + b) >> 1)) & 255;
        else if (ft === 4){ const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); row[i] = (row[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
      }
      for (let x = 0; x < pw; x++) emit(x, y, toGray(row, x));
      prev = row;
    }
    return p;
  };
  if (!interlace) unfilter(raw, 0, w, h, (x, y, v) => { out[y * w + x] = v; });
  else {
    const passes = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];
    let off = 0;
    for (const [x0, y0, dx, dy] of passes){
      const pw = Math.ceil((w - x0) / dx), ph = Math.ceil((h - y0) / dy);
      if (pw <= 0 || ph <= 0) continue;
      off = unfilter(raw, off, pw, ph, (x, y, v) => { out[(y0 + y * dy) * w + x0 + x * dx] = v; });
    }
  }
  return { w, h, gray: out, dpi, colorFraction: +(colored / (w * h)).toFixed(4) };
}

/* Encode a 1-bit bitmap ({ w, h, px } with 1 = black) as a black-and-white
   PNG, with its print resolution (pHYs) set to dpi. */
export function encodeBitPNG(bmp, dpi){
  const { w, h, px } = bmp, stride = Math.ceil(w / 8), raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++){
    const o = y * (stride + 1); raw[o] = 0;
    for (let x = 0; x < w; x++) if (!px[y * w + x]) raw[o + 1 + (x >> 3)] |= 0x80 >> (x & 7);   // 1 = white in a 1-bit gray PNG
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 1; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const phys = Buffer.alloc(9), ppm = Math.round((dpi || 300) / .0254); phys.writeUInt32BE(ppm, 0); phys.writeUInt32BE(ppm, 4); phys[8] = 1;
  return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("pHYs", phys), chunk("IDAT", zlib.deflateSync(raw, { level:9 })), chunk("IEND", Buffer.alloc(0))]);
}

/* Encode an 8-bit RGB image ({ w, h, rgb: Uint8Array }) for debug pictures. */
export function encodeRGBPNG(img){
  const { w, h, rgb } = img, raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++){ raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
