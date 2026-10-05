/* =====================================================================
   A small vector PDF writer for Node scripts (no dependencies): US Letter
   pages, filled and stroked paths, and centred text in the standard
   Helvetica faces. It offers the subset of the jsPDF drawing interface
   that CogniCore.toPDF() uses (setDrawColor, setFillColor, setLineWidth,
   setLineCap, setLineJoin, moveTo, lineTo, curveTo, close, fill, stroke,
   fillStroke), with the same top-left origin in points, so a page drawn
   for the browser's PDF draws the same way here.
   Node built-ins only.
   ===================================================================== */
import zlib from "zlib";

/* Advance widths (1/1000 em) of the standard Helvetica faces, codes 32-126. */
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
  1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
  333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HELV_B = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,
  975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,
  333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
/* the few typographic characters our text uses, in WinAnsi */
const WINANSI = { "’":0x92, "‘":0x91, "“":0x93, "”":0x94, "•":0x95, "–":0x96, "—":0x97, "·":0xb7, "é":0xe9 };
const EXTRA_W = { 0x91:222, 0x92:222, 0x93:333, 0x94:333, 0x95:350, 0x96:556, 0x97:1000, 0xb7:278, 0xe9:556 };
const FONTS = { normal:"F1", bold:"F2", italic:"F3" };
const n = v => (Math.round(v * 100) / 100).toString();

export class PdfDoc {
  constructor(o = {}){
    this.w = o.width || 612; this.h = o.height || 792; this.pages = []; this.info = {};
    this.font = "normal"; this.size = 12; this.addPage();
  }
  addPage(){ this.cur = []; this.pages.push(this.cur); this.path = false; return this; }
  _op(s){ this.cur.push(s); }
  setProperties(p){ Object.assign(this.info, p); return this; }
  setDrawColor(r, g, b){ this._op(`${n(r / 255)} ${n(g / 255)} ${n(b / 255)} RG`); return this; }
  setFillColor(r, g, b){ this._op(`${n(r / 255)} ${n(g / 255)} ${n(b / 255)} rg`); return this; }
  setTextColor(r, g, b){ this.textColor = [r, g, b]; return this; }
  setLineWidth(w){ this._op(`${n(w)} w`); return this; }
  setLineCap(c){ this._op(`${c === "round" ? 1 : c === "square" ? 2 : 0} J`); return this; }
  setLineJoin(j){ this._op(`${j === "round" ? 1 : j === "bevel" ? 2 : 0} j`); return this; }
  moveTo(x, y){ this._op(`${n(x)} ${n(this.h - y)} m`); return this; }
  lineTo(x, y){ this._op(`${n(x)} ${n(this.h - y)} l`); return this; }
  curveTo(x1, y1, x2, y2, x, y){ this._op(`${n(x1)} ${n(this.h - y1)} ${n(x2)} ${n(this.h - y2)} ${n(x)} ${n(this.h - y)} c`); return this; }
  close(){ this._op("h"); return this; }
  fill(){ this._op("f"); return this; }
  stroke(){ this._op("S"); return this; }
  fillStroke(){ this._op("B"); return this; }
  line(x1, y1, x2, y2){ return this.moveTo(x1, y1).lineTo(x2, y2).stroke(); }
  setFont(_family, style){ this.font = FONTS[style] ? style : "normal"; return this; }
  setFontSize(pt){ this.size = pt; return this; }
  _codes(str){
    const out = [];
    for (const ch of String(str)){ const c = ch.charCodeAt(0); if (c >= 32 && c <= 126) out.push(c); else if (WINANSI[ch]) out.push(WINANSI[ch]); else out.push(63); }
    return out;
  }
  getTextWidth(str){
    const W = this.font === "bold" ? HELV_B : HELV;
    return this._codes(str).reduce((s, c) => s + (c >= 32 && c <= 126 ? W[c - 32] : EXTRA_W[c] || 556), 0) * this.size / 1000;
  }
  /* split text into lines no wider than maxWidth (points) */
  splitTextToSize(str, maxWidth){
    const words = String(str).split(/\s+/).filter(Boolean), lines = []; let cur = "";
    words.forEach(w => { const t = cur ? cur + " " + w : w; if (this.getTextWidth(t) <= maxWidth || !cur) cur = t; else { lines.push(cur); cur = w; } });
    if (cur) lines.push(cur);
    return lines;
  }
  text(str, x, y, o = {}){
    const w = this.getTextWidth(str), x0 = o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x;
    const esc = this._codes(str).map(c => c === 40 || c === 41 || c === 92 ? "\\" + String.fromCharCode(c) : c > 126 ? "\\" + c.toString(8).padStart(3, "0") : String.fromCharCode(c)).join("");
    const col = this.textColor || [0, 0, 0];
    this._op(`BT ${n(col[0] / 255)} ${n(col[1] / 255)} ${n(col[2] / 255)} rg /${FONTS[this.font]} ${n(this.size)} Tf ${n(x0)} ${n(this.h - y)} Td (${esc}) Tj ET 0 0 0 rg`);
    return this;
  }
  /* the finished file */
  output(){
    const objs = [], add = s => { objs.push(s); return objs.length; };
    const catalog = add(null), pagesObj = add(null);
    const fonts = ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique"].map(name => add(`<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`));
    const kids = this.pages.map(ops => {
      const data = zlib.deflateSync(Buffer.from(ops.join("\n"), "latin1"));
      const content = add({ stream:data });
      return add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${this.w} ${this.h}] /Resources << /Font << /F1 ${fonts[0]} 0 R /F2 ${fonts[1]} 0 R /F3 ${fonts[2]} 0 R >> >> /Contents ${content} 0 R >>`);
    });
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
    objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + " 0 R").join(" ")}] /Count ${kids.length} >>`;
    const pdfStr = s => "(" + String(s).replace(/[\\()]/g, m => "\\" + m).replace(/[^\x20-\x7e]/g, "?") + ")";
    const info = add(`<< /Producer (Cognicopia) ${this.info.title ? "/Title " + pdfStr(this.info.title) : ""} ${this.info.subject ? "/Subject " + pdfStr(this.info.subject) : ""} >>`);
    const parts = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")], offsets = [];
    let len = parts[0].length;
    objs.forEach((o, i) => {
      offsets.push(len);
      const head = Buffer.from(`${i + 1} 0 obj\n`, "latin1");
      const body = typeof o === "string" ? Buffer.from(o + "\nendobj\n", "latin1")
        : Buffer.concat([Buffer.from(`<< /Length ${o.stream.length} /Filter /FlateDecode >>\nstream\n`, "latin1"), o.stream, Buffer.from("\nendstream\nendobj\n", "latin1")]);
      parts.push(head, body); len += head.length + body.length;
    });
    const xref = [`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`].concat(offsets.map(o => String(o).padStart(10, "0") + " 00000 n \n")).join("");
    parts.push(Buffer.from(xref + `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${len}\n%%EOF\n`, "latin1"));
    return Buffer.concat(parts);
  }
}
