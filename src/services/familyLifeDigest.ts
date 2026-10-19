/* =====================================================================
   COGNICOPIA FAMILY LIFE DIGEST
   A one-page, family-facing summary of a completed engagement session.
   Staff pick observation tags, may add a short note, and may include
   biographical focus points from the resident's local profile. The page
   is planned here and drawn with jsPDF in the browser. Nothing is sent
   anywhere. Notes stay in session memory unless the host page saves them
   to the resident's encrypted profile.

   Built into assets/services/familyLifeDigest.js (globalThis.CogniFamilyDigest) by
   scripts/build-services.mjs.
   @global CogniFamilyDigest
   ===================================================================== */

export const VERSION = "1.1.0";
export const HEADER = "Cognicopia — Resident Engagement Digest";
export const FOOTER = "Generated locally via Cognicopia.org — Zero-Cloud Privacy Guarantee.";
export const MAX_NOTES_CHARS = 280;

/** Letter page in points: 0.75 in binding gutter, 0.5 in other margins. */
export const PAGE = { w: 612, h: 792, left: 54, right: 36, top: 36, bottom: 36 } as const;

export const OBSERVATION_TAGS: readonly { id: string; label: string }[] = [
  { id: "engaged-warmly", label: "Engaged warmly during 1950s history prompts" },
  { id: "smiled-audio", label: "Smiled while listening to vintage audio" },
  { id: "strong-recall", label: "Demonstrated strong recall regarding hometown memories" },
  { id: "calm-attentive", label: "Calm and attentive during quiet focus" },
  { id: "shared-stories", label: "Shared personal stories about family or work" },
  { id: "showed-pride", label: "Showed pride in past accomplishments" },
  { id: "connected-visually", label: "Connected visually with pictures and photos" },
  { id: "comfortable-rhythm", label: "Comfortable with the session's pace and rhythm" }
];

const INK: [number, number, number] = [0, 0, 0];
const GREEN: [number, number, number] = [27, 56, 43];
const GOLD: [number, number, number] = [197, 160, 89];
const WHITE: [number, number, number] = [255, 255, 255];
const MUTED: [number, number, number] = [26, 32, 44];

export type Split = (text: string, width: number, size: number, bold: boolean) => string[];

export interface DigestInput {
  residentId: string;
  sessionDate: string | number;
  activityType: string;
  observationTags: string[];
  customNotes?: string;
  includeBioFocus: boolean;
  staffInitials?: string;
}

/** Family-facing fields only. No cognitive tier, diagnosis or unit. */
export interface ResidentDigestData {
  firstName: string;
  hometown?: string;
  pastOccupation?: string;
  hobbies?: string;
  interests?: string[];
}

export interface Op {
  t: "text" | "rule" | "box" | "fill";
  x: number; y: number;
  x2?: number; y2?: number;
  w?: number; h?: number;
  text?: string; size?: number; bold?: boolean;
  rgb?: [number, number, number];
  lw?: number;
  align?: "left" | "center" | "right";
}
export interface PdfPage { w: number; h: number; ops: Op[]; }

export interface DigestResult {
  dataUrl: string;
  filename: string;
}

function cleanText(v: unknown, max: number): string {
  const s = String(v == null ? "" : v);
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function pick(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && v && "label" in (v as object)) return String((v as { label?: unknown }).label || "");
  if (typeof v === "object" && v && "place" in (v as object)) return String((v as { place?: unknown }).place || "");
  return "";
}

function labels(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list.map(pick).map(s => s.trim()).filter(Boolean);
}

export function formatDate(dateInput: string | number): string {
  let date: Date;
  if (typeof dateInput === "number") date = new Date(dateInput);
  else if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) date = new Date(dateInput + "T00:00:00");
  else date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function defaultSplit(text: string, width: number, size: number, bold: boolean): string[] {
  const factor = size * (bold ? 0.56 : 0.52);
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  words.forEach(w => {
    const next = cur ? cur + " " + w : w;
    if (next.length * factor <= width || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  });
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export function digestFilename(firstName: string, dateLabel: string): string {
  const safeName = cleanText(firstName, 30).replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "Resident";
  const datePart = cleanText(dateLabel, 40).replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "session";
  return "Cognicopia_Digest_" + safeName + "_" + datePart + ".pdf";
}

/**
 * Map a saved Resident Activity Profile to family-facing digest fields.
 * Clinical, unit and avoid-list details stay out.
 */
export function residentFromProfile(p: unknown): ResidentDigestData {
  const r = p && typeof p === "object" ? p as Record<string, unknown> : {};
  const t1 = r.tier1_core && typeof r.tier1_core === "object" ? r.tier1_core as Record<string, unknown> : {};
  const t2 = r.tier2_enrichment && typeof r.tier2_enrichment === "object" ? r.tier2_enrichment as Record<string, unknown> : {};
  const hometown = pick(t2.hometown);
  const music = t2.music && typeof t2.music === "object" ? t2.music as Record<string, unknown> : {};
  const interests = labels(t2.activityPreferences).concat(labels(music.genres)).concat(labels(music.artists));
  const unique = interests.filter((x, i) => interests.indexOf(x) === i).slice(0, 6);
  return {
    firstName: cleanText(t1.preferredName || "Resident", 50) || "Resident",
    hometown: hometown ? cleanText(hometown, 80) : "",
    pastOccupation: cleanText(pick(t1.occupation) || pick(t1.primaryVocation), 80),
    hobbies: labels(t1.topHobbies).slice(0, 6).join(", "),
    interests: unique
  };
}

export function validateDigestInput(input: Partial<DigestInput>): string | null {
  if (!input || typeof input !== "object") return "Session details are required.";
  if (!input.residentId || typeof input.residentId !== "string") return "A resident is required.";
  if (!input.sessionDate) return "A session date is required.";
  if (!input.activityType || typeof input.activityType !== "string" || !cleanText(input.activityType, 100)) return "An activity type is required.";
  if (input.customNotes && String(input.customNotes).length > MAX_NOTES_CHARS) return "Custom notes must be " + MAX_NOTES_CHARS + " characters or less.";
  if (input.observationTags && !Array.isArray(input.observationTags)) return "Observation tags must be a list.";
  return null;
}

export function tagLabel(id: string): string {
  const tag = OBSERVATION_TAGS.find(t => t.id === id);
  return tag ? tag.label : "";
}

export function planDigest(input: DigestInput, resident: ResidentDigestData, split?: Split): PdfPage {
  const wrap = split || defaultSplit;
  const { w, h, left, right, top } = PAGE;
  const contentW = w - left - right;
  const ops: Op[] = [];
  const text = (t: string, x: number, y: number, size: number, o: Partial<Op> = {}): void => {
    ops.push(Object.assign({ t: "text", x, y, text: t, size, rgb: INK }, o) as Op);
  };
  let y = top + 18;
  ops.push({ t: "fill", x: 0, y: 0, w, h: 78, rgb: GREEN });
  ops.push({ t: "fill", x: 0, y: 78, w, h: 6, rgb: GOLD });
  text(HEADER, left, 42, 16, { bold: true, rgb: WHITE });
  const dateStr = formatDate(input.sessionDate) || "Session date not recorded";
  text("Session date: " + dateStr, left, 62, 11, { rgb: WHITE });

  y = 110;
  const name = cleanText(resident.firstName, 50) || "Resident";
  text(name, left, y, 18, { bold: true, rgb: GREEN });
  y += 22;
  text("A note for family about today's engagement.", left, y, 11, { rgb: MUTED });
  y += 20;
  ops.push({ t: "rule", x: left, y, x2: left + contentW, y2: y, lw: 1.25, rgb: GOLD });
  y += 22;

  const heading = (label: string): void => {
    text(label, left, y, 12, { bold: true, rgb: GREEN });
    y += 16;
  };
  const para = (body: string, size: number, bold = false): void => {
    wrap(body, contentW, size, bold).forEach(ln => { text(ln, left, y, size, { bold, rgb: INK }); y += size * 1.35; });
    y += 8;
  };

  heading("Activity");
  para(cleanText(input.activityType, 100) || "Engagement session", 12);

  heading("Observations");
  const tags = (input.observationTags || []).map(tagLabel).filter(Boolean);
  if (!tags.length) para("Staff recorded this session without extra observation tags.", 11);
  else {
    tags.forEach(label => {
      const lines = wrap(label, contentW - 16, 11, false);
      lines.forEach((ln, i) => {
        if (i === 0) text("•", left, y, 11);
        text(ln, left + 14, y, 11);
        y += 15;
      });
    });
    y += 8;
  }

  heading("Care notes");
  const notes = input.customNotes ? cleanText(input.customNotes, MAX_NOTES_CHARS) : "";
  para(notes || "No additional notes.", 11);

  if (input.includeBioFocus) {
    heading("Biographical focus points");
    const bits: string[] = [];
    if (resident.hometown) bits.push("Hometown: " + cleanText(resident.hometown, 80));
    if (resident.pastOccupation) bits.push("Work: " + cleanText(resident.pastOccupation, 80));
    if (resident.hobbies) bits.push("Hobbies: " + cleanText(resident.hobbies, 200));
    if (resident.interests && resident.interests.length) bits.push("Interests: " + cleanText(resident.interests.slice(0, 5).join(", "), 200));
    if (!bits.length) para("No biographical details are on this computer for this resident.", 11);
    else bits.forEach(line => para(line, 11));
  }

  const footerY = h - 28;
  ops.push({ t: "rule", x: left, y: footerY - 14, x2: left + contentW, y2: footerY - 14, lw: 0.8, rgb: GOLD });
  text(FOOTER, w / 2, footerY, 8, { rgb: MUTED, align: "center" });
  if (input.staffInitials) {
    text("Recorded by: " + cleanText(input.staffInitials, 30), left + contentW, footerY - 18, 9, { rgb: MUTED, align: "right" });
  }

  /* Keep a single page: drop body lines that would collide with the footer. */
  const floor = footerY - 28;
  const kept = ops.filter(o => o.t !== "text" || o.y < floor || o.y >= footerY - 20);
  return { w, h, ops: kept };
}

export function draw(doc: { setFont: Function; setFontSize: Function; setTextColor: Function; setDrawColor: Function; setFillColor: Function; setLineWidth: Function; text: Function; line: Function; rect: Function }, page: PdfPage): void {
  for (const o of page.ops){
    const c = o.rgb || INK;
    if (o.t === "text"){
      doc.setFont("helvetica", o.bold ? "bold" : "normal");
      doc.setFontSize(o.size || 11);
      doc.setTextColor(c[0], c[1], c[2]);
      doc.text(String(o.text || ""), o.x, o.y, { align: o.align || "left" });
    } else if (o.t === "rule"){
      doc.setDrawColor(c[0], c[1], c[2]);
      doc.setLineWidth(o.lw || 1);
      doc.line(o.x, o.y, o.x2 == null ? o.x : o.x2, o.y2 == null ? o.y : o.y2);
    } else if (o.t === "box"){
      doc.setDrawColor(c[0], c[1], c[2]);
      doc.setLineWidth(o.lw || 1);
      doc.rect(o.x, o.y, o.w || 0, o.h || 0, "S");
    } else {
      doc.setFillColor(c[0], c[1], c[2]);
      doc.rect(o.x, o.y, o.w || 0, o.h || 0, "F");
    }
  }
}

/**
 * Build a PDF in browser memory when jsPDF is present (window.jspdf.jsPDF).
 * Host pages should prefer planDigest + draw after loading the local vendor copy.
 */
export async function generateDigest(input: DigestInput, resident: ResidentDigestData): Promise<DigestResult> {
  const err = validateDigestInput(input);
  if (err) throw new Error(err);
  const JsPDF = (globalThis as unknown as { jspdf?: { jsPDF: new (o: object) => Record<string, Function> } }).jspdf?.jsPDF;
  if (!JsPDF) throw new Error("The print library is not loaded.");
  const doc = new JsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const split: Split = (text, width, size, bold) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize ? doc.splitTextToSize(text, width) : defaultSplit(text, width, size, bold);
    return Array.isArray(lines) ? lines : [String(lines)];
  };
  const page = planDigest(input, resident, split);
  draw(doc as unknown as Parameters<typeof draw>[0], page);
  const dateStr = formatDate(input.sessionDate);
  return { dataUrl: String(doc.output("dataurlstring")), filename: digestFilename(resident.firstName, dateStr) };
}
