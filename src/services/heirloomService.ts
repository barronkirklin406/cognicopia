/* =====================================================================
   COGNICOPIA HEIRLOOM
   A resident's months, kept for their family:

     - entries staff record as they happen: words the resident wrote or
       said (their journal), a story they shared from a reminiscence card,
       a coloring page they finished (with a photo of it), a moment worth
       keeping. Each is in the resident's own words, exactly as recorded,
       and each can be kept out of what families see;
     - a monthly memory digest: one month's shared entries, laid out for
       Letter paper, to print or to send as a PDF;
     - a hardcover book: a run of months as a print-on-demand interior
       (trim size, bleed, gutter and safe area worked out for the
       printer) and a cover spread sized from the printer's own template.

   Entries are kept in the encrypted store (secureStore.ts) under
   "cognicopia_heirloom_<resident id>"; photos under
   "cognicopia_heirloom_photo_<photo id>", read only when a page needs
   them. This service stores nothing itself: it cleans entries, chooses
   what goes in, and lays pages out as a plan of boxes in inches that the
   Packet Builder draws twice, as HTML for the screen and as a vector PDF.

   Printers change their specifications. The printer profiles hold only
   the well-established facts (0.125 in bleed; KDP adds it to the outside
   edge, top and bottom only), and the cover takes its size from the
   printer's template. Check both against the printer before ordering.

   Built into assets/services/heirloomService.js (globalThis.
   CogniHeirloom) by scripts/build-services.mjs. No network, no storage.
   @global CogniHeirloom
   ===================================================================== */

export const VERSION = "1.0.0";
export const STORE_PREFIX = "cognicopia_heirloom_";
export const PHOTO_PREFIX = "cognicopia_heirloom_photo_";

/* ---------- 1. Entries ---------- */
export type Kind = "journal" | "reminiscence" | "coloring" | "moment";
export const KINDS: readonly { code: Kind; label: string; section: string; }[] = [
  { code: "journal", label: "In their own words", section: "In Their Own Words" },
  { code: "reminiscence", label: "A story they shared", section: "Stories They Shared" },
  { code: "coloring", label: "Something they colored", section: "Their Artwork" },
  { code: "moment", label: "A moment to remember", section: "Moments" }
];
export interface Entry {
  id: string; date: string; kind: Kind; title: string; text: string; by: string; share: boolean;
  card: string;                 // reminiscence: the card's title
  design: string;               // coloring: the Cognicopia Coloring design it was
  tier: 1 | 2 | 3;
  photo: string;                // photo id ("" for none), its width and height in pixels
  photoW: number; photoH: number;
}
export interface Keeper { v: 1; residentId: string; dedication: string; entries: Entry[]; }
const str = (v: unknown, max: number): string => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
const line = (v: unknown, max: number): string => str(v, max).replace(/\s+/g, " ");
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const dateOk = (d: unknown): string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d + "T00:00:00Z")) ? d : "";
/* An entry exactly as recorded, cleaned and bounded: nothing reworded. */
export function normalizeEntry(raw: unknown): Entry {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const kind = KINDS.some(k => k.code === o.kind) ? o.kind as Kind : "moment";
  const t = Number(o.tier), w = Math.round(Number(o.photoW)), h = Math.round(Number(o.photoH));
  const photo = typeof o.photo === "string" && ID.test(o.photo) ? o.photo : "";
  return {
    id: typeof o.id === "string" && ID.test(o.id) ? o.id : "e" + Math.random().toString(36).slice(2, 10),
    date: dateOk(o.date), kind, title: line(o.title, 80), text: str(o.text, 2000), by: line(o.by, 60), share: o.share !== false,
    card: kind === "reminiscence" ? line(o.card, 80) : "", design: kind === "coloring" && typeof o.design === "string" && /^[a-z0-9-]{1,60}$/.test(o.design) ? o.design : "",
    tier: t === 1 || t === 3 ? t : 2,
    photo, photoW: photo && w > 0 && w < 20000 ? w : 0, photoH: photo && h > 0 && h < 20000 ? h : 0
  };
}
export function normalizeKeeper(raw: unknown, residentId: string): Keeper {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const entries = (Array.isArray(o.entries) ? o.entries : []).slice(-2000).map(normalizeEntry).filter(e => e.date && (e.text || e.title || e.photo || e.design));
  return { v: 1, residentId: String(residentId), dedication: str(o.dedication, 600), entries: entries.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0) };
}

/* ---------- 2. Months, digests, books ---------- */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthOf = (date: string): string => date.slice(0, 7);
export const monthLabel = (ym: string): string => { const m = /^(\d{4})-(\d{2})$/.exec(ym); return m ? MONTHS[+m[2] - 1] + " " + m[1] : ym; };
export function dayLabel(date: string): string {
  const d = new Date(date + "T12:00:00Z"); if (isNaN(d.getTime())) return date;
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()] + ", " + MONTHS[d.getUTCMonth()] + " " + d.getUTCDate();
}
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []; let [y, m] = from.split("-").map(Number); const [ty, tm] = to.split("-").map(Number);
  if (!(y > 1900 && m >= 1 && m <= 12 && ty > 1900 && tm >= 1 && tm <= 12)) return out;
  while ((y < ty || (y === ty && m <= tm)) && out.length < 120){ out.push(y + "-" + String(m).padStart(2, "0")); m++; if (m > 12){ m = 1; y++; } }
  return out;
}
export interface Section { kind: Kind; heading: string; entries: Entry[]; }
export interface Month { ym: string; label: string; sections: Section[]; count: number; }
/* One month's shared entries, by kind (their own words first). */
export function digestFor(k: Keeper, ym: string): Month {
  const mine = k.entries.filter(e => e.share && monthOf(e.date) === ym);
  const sections = KINDS.map(kd => ({ kind: kd.code, heading: kd.section, entries: mine.filter(e => e.kind === kd.code) })).filter(s => s.entries.length);
  return { ym, label: monthLabel(ym), sections, count: mine.length };
}
export function bookFor(k: Keeper, from: string, to: string): Month[] { return monthsBetween(from, to).map(ym => digestFor(k, ym)).filter(m => m.count); }

/* ---------- 3. Paper: trims, printers, bleed, gutter ---------- */
export interface Trim { code: string; label: string; w: number; h: number; printers: readonly string[]; }
export const TRIMS: readonly Trim[] = [
  { code: "8.5x11", label: "8.5 × 11 in (US Letter)", w: 8.5, h: 11, printers: ["lulu", "other"] },
  { code: "8.25x11", label: "8.25 × 11 in", w: 8.25, h: 11, printers: ["kdp", "other"] },
  { code: "8.5x8.5", label: "8.5 × 8.5 in (square)", w: 8.5, h: 8.5, printers: ["lulu", "other"] },
  { code: "7x10", label: "7 × 10 in", w: 7, h: 10, printers: ["kdp", "other"] },
  { code: "6x9", label: "6 × 9 in", w: 6, h: 9, printers: ["kdp", "lulu", "other"] }
];
export interface Printer { code: string; label: string; bleed: "outside" | "all"; minPages: number; note: string; }
export const PRINTERS: readonly Printer[] = [
  { code: "kdp", label: "Amazon KDP (hardcover)", bleed: "outside", minPages: 75,
    note: "Interior with bleed: 0.125 in added to the outside edge, the top and the bottom. Check KDP's current hardcover trim sizes and page range, and use the cover template KDP makes for your page count." },
  { code: "lulu", label: "Lulu (hardcover casewrap)", bleed: "all", minPages: 24,
    note: "Interior with bleed: 0.125 in added on all four sides. Check Lulu's current page range, and use the cover template from Lulu's calculator for your page count." },
  { code: "other", label: "Another printer", bleed: "all", minPages: 24,
    note: "0.125 in bleed on all four sides is the common standard. Check your printer's interior specifications and cover template." }
];
export const BLEED_IN = 0.125, SAFE_IN = 0.5;
/* The inside margin grows with the page count so words stay clear of the
   binding: never under 0.75 in, and at least the common minimums
   (0.375 in to 150 pages, 0.5 to 300, 0.625 to 500, 0.75 to 700, 0.875 beyond). */
export function gutterFor(pages: number): number {
  const min = pages <= 150 ? 0.375 : pages <= 300 ? 0.5 : pages <= 500 ? 0.625 : pages <= 700 ? 0.75 : 0.875;
  return Math.max(0.75, min);
}
/* Pages are added (as "Notes and memories" pages) to reach the printer's
   minimum and an even count. */
export function padTo(pages: number, printer: Printer): number { const n = Math.max(pages, printer.minPages); return n % 2 ? n + 1 : n; }
export interface Box { x: number; y: number; w: number; h: number; }
export interface Geometry { pageW: number; pageH: number; trim: Box | null; content: (page: number) => Box; label: string; }
/* The monthly digest: Letter, 0.6 in top and bottom, 0.5 in outside and the 0.75 in punch gutter on the left (one-sided). */
export function letterGeometry(): Geometry {
  return { pageW: 8.5, pageH: 11, trim: null, label: "Letter", content: () => ({ x: 0.75, y: 0.6, w: 7.25, h: 9.8 }) };
}
/* A book page (1-based; odd pages are right-hand pages, bound on their left). */
export function bookGeometry(trim: Trim, printer: Printer, pages: number): Geometry {
  const outside = printer.bleed === "outside", g = gutterFor(pages);
  const pageW = trim.w + (outside ? BLEED_IN : 2 * BLEED_IN), pageH = trim.h + 2 * BLEED_IN;
  const trimX = (page: number): number => outside ? (page % 2 ? 0 : BLEED_IN) : BLEED_IN;
  return {
    pageW, pageH, label: trim.label,
    trim: { x: BLEED_IN, y: BLEED_IN, w: trim.w, h: trim.h },
    content: (page: number) => {
      const tx = trimX(page), right = page % 2 === 1;                // a right-hand page is bound on its left
      const left = right ? g : SAFE_IN, rightM = right ? SAFE_IN : g;
      return { x: tx + left, y: BLEED_IN + SAFE_IN, w: trim.w - left - rightM, h: trim.h - 2 * SAFE_IN };
    }
  };
}
export function trimBoxOf(geo: Geometry, trim: Trim, printer: Printer, page: number): Box {
  const outside = printer.bleed === "outside";
  return { x: outside ? (page % 2 ? 0 : BLEED_IN) : BLEED_IN, y: BLEED_IN, w: trim.w, h: trim.h };
}
/* The cover spread: back, spine and front, from the printer's template
   (full width and height, spine width, and how far the wrap or bleed
   runs past the board). An estimate is offered only as a starting point. */
export interface CoverSpec { width: number; height: number; spine: number; wrap: number; back: Box; spineBox: Box; front: Box; safe: number; }
export function coverEstimate(trim: Trim, pages: number): { spine: number; wrap: number; width: number; height: number } {
  const spine = Math.round((pages * 0.0025 + 0.25) * 1000) / 1000, wrap = 0.75;   // paper plus boards: replace with the printer's numbers
  return { spine, wrap, width: Math.round((2 * trim.w + spine + 2 * wrap) * 1000) / 1000, height: Math.round((trim.h + 2 * wrap) * 1000) / 1000 };
}
export function coverSpec(o: { width: number; height: number; spine: number; wrap: number }): CoverSpec {
  const width = Math.max(4, Math.min(40, +o.width || 0)), height = Math.max(4, Math.min(20, +o.height || 0));
  const spine = Math.max(0, Math.min(4, +o.spine || 0)), wrap = Math.max(0, Math.min(2, +o.wrap || 0));
  const panel = (width - spine) / 2;
  return { width, height, spine, wrap, safe: wrap + 0.375,
    back: { x: 0, y: 0, w: panel, h: height }, spineBox: { x: panel, y: 0, w: spine, h: height }, front: { x: panel + spine, y: 0, w: panel, h: height } };
}

/* ---------- 4. Layout: a plan of boxes, drawn as HTML or PDF ---------- */
export type Item =
  | { t: "text"; x: number; y: number; w: number; h: number; lines: string[]; size: number; bold?: boolean; italic?: boolean; align?: "left" | "center"; lead: number }
  | { t: "art"; x: number; y: number; w: number; h: number; design: string; tier: 1 | 2 | 3 }
  | { t: "photo"; x: number; y: number; w: number; h: number; photo: string }
  | { t: "rule"; x: number; y: number; w: number; h: number }
  | { t: "band"; x: number; y: number; w: number; h: number }
  | { t: "lines"; x: number; y: number; w: number; h: number; gap: number };
export interface PagePlan { items: Item[]; kind: "cover" | "title" | "chapter" | "body" | "notes" | "colophon" | "dedication"; }
/* Text is wrapped by an estimate: Atkinson Hyperlegible averages under
   0.56 em a character, and a line is 1.35 times the size. */
const EM = 0.56, LEAD = 1.35;
export function wrapText(text: string, widthIn: number, sizePt: number): string[] {
  const n = Math.max(8, Math.floor(widthIn * 72 / (sizePt * EM)));
  const out: string[] = [];
  for (const para of String(text).split("\n")){
    if (!para.trim()){ out.push(""); continue; }
    let cur = "";
    for (const w of para.split(/\s+/).filter(Boolean)){
      if (w.length > n){ if (cur) out.push(cur); for (let i = 0; i < w.length; i += n) out.push(w.slice(i, i + n)); cur = ""; continue; }
      if (cur && (cur + " " + w).length > n){ out.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
    }
    if (cur) out.push(cur);
  }
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
}
const leadOf = (size: number): number => size * LEAD / 72;
interface Blk { kind: "text"; text: string; size: number; bold?: boolean; italic?: boolean; align?: "left" | "center"; after: number; }
interface ImgBlk { kind: "art" | "photo"; design?: string; tier?: 1 | 2 | 3; photo?: string; aspect: number; maxW: number; maxH: number; after: number; }
type Block = Blk | ImgBlk;
export interface Sizes { title: number; month: number; heading: number; body: number; small: number; words: number; }
export const DIGEST_SIZES: Sizes = { title: 30, month: 30, heading: 18, body: 13, small: 10, words: 15 };
export const BOOK_SIZES: Sizes = { title: 28, month: 26, heading: 16, body: 12, small: 9, words: 14 };
/* An entry as blocks: in their own words set larger; photos and artwork
   scaled into the page, kept at their proportions. */
function entryBlocks(e: Entry, sz: Sizes, box: Box, photoAspect: number): Block[] {
  const b: Block[] = [{ kind: "text", text: dayLabel(e.date) + (e.by ? " · recorded by " + e.by : ""), size: sz.small, italic: true, after: 0.04 }];
  if (e.kind === "reminiscence" && e.card) b.push({ kind: "text", text: "From the reminiscence card “" + e.card + "”", size: sz.small, after: 0.04 });
  if (e.title) b.push({ kind: "text", text: e.title, size: sz.heading - 2, bold: true, after: 0.06 });
  const maxH = Math.min(box.h * 0.62, 5.6), maxW = Math.min(box.w, 5.2);
  if (e.kind === "coloring" && e.photo) b.push({ kind: "photo", photo: e.photo, aspect: photoAspect, maxW, maxH, after: 0.1 });
  else if (e.kind === "coloring" && e.design) b.push({ kind: "art", design: e.design, tier: e.tier, aspect: 0.75, maxW: Math.min(maxW, 3.6), maxH: Math.min(maxH, 4.8), after: 0.1 });
  if (e.text){
    const words = e.kind === "journal" || e.kind === "reminiscence";
    b.push({ kind: "text", text: words ? "“" + e.text + "”" : e.text, size: words ? sz.words : sz.body, after: 0.1 });
  }
  return b;
}
function place(block: Block, box: Box, y: number): { item: Item; h: number } {
  if (block.kind === "text"){
    const lines = wrapText(block.text, box.w, block.size), lead = leadOf(block.size);
    return { item: { t: "text", x: box.x, y, w: box.w, h: lines.length * lead, lines, size: block.size, bold: block.bold, italic: block.italic, align: block.align || "left", lead }, h: lines.length * lead };
  }
  let w = Math.min(block.maxW, box.w), h = w / block.aspect;
  if (h > block.maxH){ h = block.maxH; w = h * block.aspect; }
  const x = box.x + (box.w - w) / 2;
  return { item: block.kind === "art" ? { t: "art", x, y, w, h, design: block.design!, tier: block.tier || 2 } : { t: "photo", x, y, w, h, photo: block.photo! }, h };
}
/* Flow blocks into pages. An entry stays on one page when it can; a text
   too long for the space left continues on the next page. */
function flow(groups: Block[][], geo: Geometry, first: number, kind: PagePlan["kind"], start?: PagePlan): PagePlan[] {
  const pages: PagePlan[] = []; let page = start || { items: [], kind }, n = first, box = geo.content(n);
  let y = start ? Math.max(box.y, (start as PagePlan & { usedY?: number }).usedY || box.y) : box.y;
  const next = (): void => { pages.push(page); page = { items: [], kind: "body" }; n++; box = geo.content(n); y = box.y; };
  for (const g of groups){
    const heights = g.map(b => place(b, box, 0).h + b.after), total = heights.reduce((a, b) => a + b, 0);
    if (y + total > box.y + box.h && total <= box.h && y > box.y) next();
    for (const b of g){
      if (b.kind === "text"){
        const all = wrapText(b.text, box.w, b.size), lead = leadOf(b.size);
        let i = 0;
        while (i < all.length){
          const fit = Math.floor((box.y + box.h - y + 1e-9) / lead);
          if (fit < 1){ next(); continue; }
          const take = Math.min(all.length - i, fit), lines = all.slice(i, i + take);
          page.items.push({ t: "text", x: box.x, y, w: box.w, h: take * lead, lines, size: b.size, bold: b.bold, italic: b.italic, align: b.align || "left", lead });
          y += take * lead; i += take;
          if (i < all.length) next();
        }
        y += b.after;
      } else {
        let p = place(b, box, y);
        if (y + p.h > box.y + box.h + 1e-9){ if (y > box.y) next(); p = place(b, box, y); }
        if (p.h > box.h){ const s = box.h / p.h; p = place(Object.assign({}, b, { maxH: box.h, maxW: b.maxW * s }), box, y); }
        page.items.push(p.item); y += p.h + b.after;
      }
    }
    y += 0.18;                                                       // space between entries
  }
  pages.push(page);
  (pages[pages.length - 1] as PagePlan & { usedY?: number }).usedY = y;
  return pages;
}
export interface Deps { photoAspect: (photoId: string) => number; }
function chapter(m: Month, geo: Geometry, pageNo: number, sz: Sizes, deps: Deps, opener: boolean): PagePlan[] {
  const box = geo.content(pageNo);
  const head: Item[] = [];
  let y = box.y;
  if (opener){
    const lines = wrapText(m.label, box.w, sz.month), lead = leadOf(sz.month);
    head.push({ t: "text", x: box.x, y, w: box.w, h: lines.length * lead, lines, size: sz.month, bold: true, lead });
    y += lines.length * lead + 0.06;
    const sub = wrapText(m.count + (m.count === 1 ? " thing to remember" : " things to remember"), box.w, sz.small), sl = leadOf(sz.small);
    head.push({ t: "text", x: box.x, y, w: box.w, h: sub.length * sl, lines: sub, size: sz.small, italic: true, lead: sl });
    y += sub.length * sl + 0.08;
    head.push({ t: "rule", x: box.x, y, w: box.w, h: 0 }); y += 0.2;
  }
  const groups: Block[][] = [];
  m.sections.forEach(s => {
    groups.push([{ kind: "text", text: s.heading, size: sz.heading, bold: true, after: 0.12 }]);
    s.entries.forEach(e => groups.push(entryBlocks(e, sz, box, e.photo && e.photoW && e.photoH ? e.photoW / e.photoH : deps.photoAspect(e.photo) || 0.75)));
  });
  // the section heading keeps with its first entry
  const merged: Block[][] = [];
  for (let i = 0; i < groups.length; i++){
    if (groups[i].length === 1 && groups[i][0].kind === "text" && (groups[i][0] as Blk).size === sz.heading && groups[i + 1]){ merged.push(groups[i].concat(groups[i + 1])); i++; }
    else merged.push(groups[i]);
  }
  const start = { items: head, kind: "chapter" as const, usedY: y };
  return flow(merged, geo, pageNo, "chapter", start as PagePlan);
}
export interface DigestInput { residentName: string; facility: string; month: Month; coverDesign: string; coverTier: 1 | 2 | 3; }
/* The monthly digest on Letter paper: a cover, then the month. */
export function planDigest(d: DigestInput, deps: Deps): PagePlan[] {
  const geo = letterGeometry(), box = geo.content(1), sz = DIGEST_SIZES;
  const cover: Item[] = [];
  let y = box.y + 0.4;
  const t1 = wrapText((d.residentName ? d.residentName + "’s " : "") + d.month.label, box.w, sz.title), l1 = leadOf(sz.title);
  cover.push({ t: "text", x: box.x, y, w: box.w, h: t1.length * l1, lines: t1, size: sz.title, bold: true, align: "center", lead: l1 }); y += t1.length * l1 + 0.12;
  const t2 = wrapText("A month of memories" + (d.facility ? " from " + d.facility : ""), box.w, sz.heading), l2 = leadOf(sz.heading);
  cover.push({ t: "text", x: box.x, y, w: box.w, h: t2.length * l2, lines: t2, size: sz.heading, align: "center", lead: l2 }); y += t2.length * l2 + 0.4;
  if (d.coverDesign){ const w = 4.2, h = w / 0.75; cover.push({ t: "art", x: box.x + (box.w - w) / 2, y, w, h, design: d.coverDesign, tier: d.coverTier }); }
  const foot = wrapText(d.month.count + (d.month.count === 1 ? " thing" : " things") + " to remember, in " + (d.residentName ? d.residentName + "’s" : "their") + " own words and work.", box.w, sz.small), lf = leadOf(sz.small);
  cover.push({ t: "text", x: box.x, y: box.y + box.h - foot.length * lf, w: box.w, h: foot.length * lf, lines: foot, size: sz.small, italic: true, align: "center", lead: lf });
  const first: PagePlan = { items: cover, kind: "cover" };
  return [first].concat(chapter(d.month, geo, 2, sz, deps, true));
}
export interface BookInput { residentName: string; facility: string; months: Month[]; dedication: string; title: string; subtitle: string; coverDesign: string; coverTier: 1 | 2 | 3; }
/* The hardcover interior: title page, dedication, a chapter per month
   (each opening on a right-hand page), "Notes and memories" pages to reach
   the printer's minimum and an even count, and a closing page. */
export function planBook(b: BookInput, trim: Trim, printer: Printer, deps: Deps): { pages: PagePlan[]; geometry: Geometry; padded: number; gutter: number } {
  const sz = BOOK_SIZES;
  const build = (total: number): PagePlan[] => {
    const geo = bookGeometry(trim, printer, total), pages: PagePlan[] = [];
    const center = (n: number, text: string, size: number, yFrac: number, opt: { bold?: boolean; italic?: boolean } = {}): Item => {
      const box = geo.content(n), lines = wrapText(text, box.w, size), lead = leadOf(size);
      return { t: "text", x: box.x, y: box.y + box.h * yFrac, w: box.w, h: lines.length * lead, lines, size, align: "center", lead, bold: opt.bold, italic: opt.italic };
    };
    // 1: title page, 2: blank (or dedication on 3)
    const tp: Item[] = [center(1, b.title, sz.title, 0.22, { bold: true })];
    if (b.subtitle) tp.push(center(1, b.subtitle, sz.heading, 0.22 + (wrapText(b.title, geo.content(1).w, sz.title).length * leadOf(sz.title) + 0.2) / geo.content(1).h));
    if (b.coverDesign){ const box = geo.content(1), w = Math.min(box.w * 0.6, 3.2), h = w / 0.75; tp.push({ t: "art", x: box.x + (box.w - w) / 2, y: box.y + box.h * 0.45, w, h: Math.min(h, box.h * 0.5), design: b.coverDesign, tier: b.coverTier }); }
    pages.push({ items: tp, kind: "title" }, { items: [], kind: "body" });
    if (b.dedication){ pages.push({ items: [center(3, b.dedication, sz.words, 0.3, { italic: true })], kind: "dedication" }, { items: [], kind: "body" }); }
    for (const m of b.months){
      if (pages.length % 2 === 1) pages.push({ items: [], kind: "body" });          // chapters open on a right-hand page
      const n = pages.length + 1, band: Item = { t: "band", x: 0, y: 0, w: geo.pageW, h: BLEED_IN + SAFE_IN * 0.7 };   // a soft strip across the top, into the bleed
      const ch = chapter(m, geo, n, sz, deps, true);
      ch[0].items.unshift(band);
      pages.push(...ch);
    }
    return pages;
  };
  let pages = build(printer.minPages), total = padTo(pages.length + 1, printer);
  pages = build(total);                                               // the gutter depends on the final count
  total = padTo(pages.length + 1, printer);
  const geo = bookGeometry(trim, printer, total);
  while (pages.length < total - 1){
    const n = pages.length + 1, box = geo.content(n), size = sz.heading, lead = leadOf(size);
    pages.push({ kind: "notes", items: [{ t: "text", x: box.x, y: box.y, w: box.w, h: lead, lines: ["Notes and memories"], size, bold: true, lead },
      { t: "lines", x: box.x, y: box.y + lead + 0.3, w: box.w, h: box.h - lead - 0.3, gap: 0.42 }] });
  }
  const last = geo.content(total), cl = wrapText("Made with care" + (b.facility ? " by the staff of " + b.facility : "") + " with Cognicopia. Every word and picture here is " + (b.residentName ? b.residentName + "’s" : "theirs") + ".", last.w, sz.small), ll = leadOf(sz.small);
  pages.push({ kind: "colophon", items: [{ t: "text", x: last.x, y: last.y + last.h - cl.length * ll, w: last.w, h: cl.length * ll, lines: cl, size: sz.small, italic: true, align: "center", lead: ll }] });
  return { pages, geometry: geo, padded: total, gutter: gutterFor(total) };
}

/* ---------- 5. Drawing a plan ---------- */
const esc = (t: string): string => String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
export interface HtmlDeps { art: (design: string, tier: 1 | 2 | 3, widthIn: number) => string; photoUrl: (photo: string) => string; }
/* A page as HTML, every box placed in inches (the screen preview and the printed digest). */
export function pageHtml(p: PagePlan, geo: Geometry, deps: HtmlDeps, opts: { guides?: boolean; page?: number } = {}): string {
  const box = (i: Item): string => `left:${i.x.toFixed(4)}in;top:${i.y.toFixed(4)}in;width:${i.w.toFixed(4)}in;height:${Math.max(0, i.h).toFixed(4)}in`;
  const items = p.items.map(i => {
    if (i.t === "text") return `<div class="hl-t" style="${box(i)};font-size:${i.size}pt;line-height:${i.lead.toFixed(4)}in;text-align:${i.align || "left"};${i.bold ? "font-weight:700;" : ""}${i.italic ? "font-style:italic;" : ""}">${i.lines.map(esc).join("\n")}</div>`;                     // real line breaks (white-space: pre), so copied text keeps its spaces
    if (i.t === "art") return `<div class="hl-art" style="${box(i)}">${deps.art(i.design, i.tier, i.w)}</div>`;
    if (i.t === "photo") return `<div class="hl-photo" style="${box(i)}"><img alt="" src="${esc(deps.photoUrl(i.photo))}"></div>`;
    if (i.t === "rule") return `<div class="hl-rule" style="left:${i.x}in;top:${i.y}in;width:${i.w}in"></div>`;
    if (i.t === "band") return `<div class="hl-band" style="${box(i)}"></div>`;
    const n = Math.floor(i.h / i.gap);
    return Array.from({ length: n }, (_, k) => `<div class="hl-rule hl-write" style="left:${i.x}in;top:${(i.y + (k + 1) * i.gap).toFixed(4)}in;width:${i.w}in"></div>`).join("");
  }).join("");
  const guides = opts.guides && geo.trim ? (() => { const c = geo.content(opts.page || 1); return `<div class="hl-guide hl-safe" style="left:${c.x}in;top:${c.y}in;width:${c.w}in;height:${c.h}in"></div>`; })() : "";
  return `<div class="hl-page" style="width:${geo.pageW}in;height:${geo.pageH}in">${items}${guides}</div>`;
}
export interface PdfDocLike {
  setFont(name: string, style: string): unknown; setFontSize(n: number): unknown; setTextColor(r: number, g: number, b: number): unknown;
  text(t: string | string[], x: number, y: number, o?: Record<string, unknown>): unknown; setDrawColor(r: number, g: number, b: number): unknown;
  setFillColor(r: number, g: number, b: number): unknown; setLineWidth(w: number): unknown; line(x1: number, y1: number, x2: number, y2: number): unknown;
  rect(x: number, y: number, w: number, h: number, style?: string): unknown; addImage(data: string, fmt: string, x: number, y: number, w: number, h: number): unknown;
}
export interface PdfDeps { art: (doc: PdfDocLike, design: string, tier: 1 | 2 | 3, xPt: number, yPt: number, wPt: number) => void; photoData: (photo: string) => string | null; font: string; }
/* A page into a PDF (units: points). Text is vector type; line art is vector paths; photos are JPEG. */
export function drawPage(doc: PdfDocLike, p: PagePlan, deps: PdfDeps): number {
  const P = (v: number): number => v * 72;
  let drawn = 0;
  for (const i of p.items){
    if (i.t === "text"){
      doc.setFont(deps.font, i.bold && i.italic ? "bolditalic" : i.bold ? "bold" : i.italic ? "italic" : "normal");
      doc.setFontSize(i.size); doc.setTextColor(0, 0, 0);
      i.lines.forEach((l, k) => { if (!l) return; const base = P(i.y + k * i.lead) + i.size * 0.95;
        doc.text(l, i.align === "center" ? P(i.x + i.w / 2) : P(i.x), base, i.align === "center" ? { align: "center" } : {}); });
    } else if (i.t === "art") deps.art(doc, i.design, i.tier, P(i.x), P(i.y), P(i.w));
    else if (i.t === "photo"){ const d = deps.photoData(i.photo); if (d) doc.addImage(d, "JPEG", P(i.x), P(i.y), P(i.w), P(i.h)); else { doc.setDrawColor(0, 0, 0); doc.setLineWidth(1); doc.rect(P(i.x), P(i.y), P(i.w), P(i.h), "S"); } }
    else if (i.t === "rule"){ doc.setDrawColor(0, 0, 0); doc.setLineWidth(1.5); doc.line(P(i.x), P(i.y), P(i.x + i.w), P(i.y)); }
    else if (i.t === "band"){ doc.setFillColor(232, 240, 235); doc.rect(P(i.x), P(i.y), P(i.w), P(i.h), "F"); doc.setFillColor(255, 255, 255); }
    else { doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.75); const n = Math.floor(i.h / i.gap); for (let k = 1; k <= n; k++) doc.line(P(i.x), P(i.y + k * i.gap), P(i.x + i.w), P(i.y + k * i.gap)); doc.setDrawColor(0, 0, 0); }
    drawn++;
  }
  return drawn;
}
/* The cover spread as a plan of its own: back (dedication), spine (title, turned), front (title, picture). */
export interface CoverPlan { spec: CoverSpec; items: Item[]; spineText: string; }
export function planCover(b: BookInput, spec: CoverSpec): CoverPlan {
  const s = spec.safe, items: Item[] = [], sz = BOOK_SIZES;
  const fx = spec.front.x + s, fw = spec.front.w - 2 * s, bx = spec.back.x + s, bw = spec.back.w - 2 * s;
  const t = wrapText(b.title, fw, sz.title + 6), lt = leadOf(sz.title + 6);
  let y = s + 0.6;
  items.push({ t: "text", x: fx, y, w: fw, h: t.length * lt, lines: t, size: sz.title + 6, bold: true, align: "center", lead: lt }); y += t.length * lt + 0.15;
  if (b.subtitle){ const st = wrapText(b.subtitle, fw, sz.heading + 2), ls = leadOf(sz.heading + 2); items.push({ t: "text", x: fx, y, w: fw, h: st.length * ls, lines: st, size: sz.heading + 2, align: "center", lead: ls }); y += st.length * ls + 0.3; }
  if (b.coverDesign){ const room = spec.height - s - 0.4 - y; const h = Math.min(room, fw / 0.75), w = h * 0.75; if (h > 1) items.push({ t: "art", x: fx + (fw - w) / 2, y, w, h, design: b.coverDesign, tier: b.coverTier }); }
  if (b.dedication){ const d = wrapText(b.dedication, bw, sz.words), ld = leadOf(sz.words); items.push({ t: "text", x: bx, y: s + 1.2, w: bw, h: d.length * ld, lines: d, size: sz.words, italic: true, align: "center", lead: ld }); }
  const f = wrapText((b.facility ? b.facility + " · " : "") + "Made with Cognicopia", bw, sz.small), lf = leadOf(sz.small);
  items.push({ t: "text", x: bx, y: spec.height - s - f.length * lf, w: bw, h: f.length * lf, lines: f, size: sz.small, align: "center", lead: lf });
  return { spec, items, spineText: spec.spine >= 0.25 ? b.title : "" };
}
