/* PDF export rules: binding gutters for one-sided and two-sided printing, and vector-first PDF output.

   Two-sided binder pages alternate their inside margin: the right-hand (odd) page has the 0.75 in gutter on its left, the left-hand (even)
   page on its right, so the holes of a 3-ring binder never touch the text on either side of a sheet. One-sided keeps the gutter on the left.

   The PDF is built with jsPDF text calls (doc.text), so every letter is a vector glyph and the file stays small; a picture is added as an
   image only when there is no vector form of it. html2pdf and html2canvas are not used: they turn a page into one big raster. */

export const GUTTER_IN = 0.75, OUTER_IN = 0.5, TOP_IN = 0.75, BOTTOM_IN = 0.75;
/* pageNumber counts from 1. Returns margins in inches. */
export function marginsFor(pageNumber, o = {}) {
  const g = Number.isFinite(o.gutterIn) ? o.gutterIn : GUTTER_IN, out = Number.isFinite(o.outerIn) ? o.outerIn : OUTER_IN, odd = Math.max(1, Math.floor(pageNumber) || 1) % 2 === 1;
  const left = !o.twoSided || odd ? g : out, right = !o.twoSided || odd ? out : g;
  return { left, right, top: o.topIn == null ? TOP_IN : o.topIn, bottom: o.bottomIn == null ? BOTTOM_IN : o.bottomIn, side: o.twoSided ? (odd ? "right-hand page" : "left-hand page") : "single-sided" };
}
export const textWidthIn = (pageNumber, o = {}, pageW = 8.5) => { const m = marginsFor(pageNumber, o); return pageW - m.left - m.right; };
/* Options for new jsPDF(...): inches, Letter, compressed streams, only the fonts used. */
export const pdfOptions = (o = {}) => ({ unit: "in", format: "letter", orientation: "portrait", compress: o.compress !== false, putOnlyUsedFonts: true, precision: 4 });
/* Toggle the printed page's alternating gutters (the CSS is in css/styles.css under .bind-2sided). */
export function applyTwoSided(root, on) { if (!root || !root.classList) return false; root.classList.toggle("bind-2sided", !!on); return !!on; }

/* Draw a block of text as vector glyphs. lines: strings or { text, pt, bold }. Returns { pages, y } where y is where the next block would start. */
export function drawText(doc, blocks, o = {}) {
  const font = o.font || "helvetica", lh = o.lineHeight || 1.4; let page = o.startPage || doc.internal.getNumberOfPages(), y = o.startY == null ? marginsFor(page, o).top : o.startY, pages = 1;
  for (const b of Array.isArray(blocks) ? blocks : []) {
    const blk = typeof b === "string" ? { text: b } : b, pt = blk.pt || o.fontPt || 18;
    doc.setFont(font, blk.bold ? "bold" : "normal"); doc.setFontSize(pt);
    const m = () => marginsFor(page, o), width = () => 8.5 - m().left - m().right, step = (pt / 72) * lh;
    for (const line of doc.splitTextToSize(String(blk.text == null ? "" : blk.text), width())) {
      if (y + step > 11 - m().bottom) { doc.addPage(); page = doc.internal.getNumberOfPages(); pages++; y = m().top; }
      doc.text(line, m().left, y + pt / 72); y += step;
    }
    y += step * 0.4;
  }
  return { pages, y, page };
}
