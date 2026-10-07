/**
 * Fitting a month onto paper. A printed calendar is one landscape letter page for each stage, so a
 * month with three sessions a day and long titles cannot simply be squeezed: the type would drop
 * below what is comfortable to read on a wall. Instead each month is planned onto sheets:
 *
 *   - the largest type that lets the whole month fit one sheet (12 pt, then 11 pt), or else
 *   - two sheets (the weeks split evenly, rows the same height on both) in 13 pt, 12 pt, then 11 pt, or
 *     for text longer than any real month, three sheets in 14 pt, 13 pt, then 12 pt.
 *
 * The type is never below 11 pt. Text width is estimated generously (half an em a character, a
 * little more than the typeface's real average of 0.47), so a plan that fits on paper here fits in
 * the printer. Pure and deterministic, so the same month prints the same way, and it is tested.
 */

export const PAGE = {
  /** Letter, landscape, in points. */
  width: 792,
  height: 612,
  /** The page margin set in app/globals.css (0.4 in). */
  margin: 28.8,
} as const;

/** Above the grid (title and weekday rows) and below it (the footnote), in points. */
const CHROME = { header: 74, footnote: 26 };
const CELL = { padding: 10, border: 5, gapBetweenSessions: 2, dateLine: 20, minRow: 62 };

/** In points, the type sizes tried in turn for one, two and three sheets. */
export const ONE_SHEET_SIZES = [12, 11] as const;
export const TWO_SHEET_SIZES = [13, 12, 11] as const;
export const THREE_SHEET_SIZES = [14, 13, 12] as const;
const EM_PER_CHAR = 0.5;
const LINE_HEIGHT = 1.15;

export interface PrintPlan {
  /** For each sheet, the weeks on it (each a list of seven days: a date, or null for a blank). */
  sheets: (string | null)[][][];
  /** The type size for sessions, in points. */
  fontPt: number;
  /** The height of every row, in points. */
  rowPt: number;
}

/** The inside of a day's cell, in points. */
const cellTextWidth = (): number => (PAGE.width - 2 * PAGE.margin) / 7 - CELL.padding - CELL.border;

/** How many lines text takes in a cell, wrapping at spaces (a word longer than a line breaks anyway). */
export function wrapLines(text: string, fontPt: number): number {
  const perLine = Math.max(4, Math.floor(cellTextWidth() / (fontPt * EM_PER_CHAR)));
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (word.length > perLine) {
      // A long word starts a fresh line and wraps through as many as it needs.
      const extra = Math.ceil(word.length / perLine);
      lines += (used > 0 ? 1 : 0) + extra - 1;
      used = word.length % perLine || perLine;
      continue;
    }
    const need = used === 0 ? word.length : used + 1 + word.length;
    if (need > perLine) {
      lines += 1;
      used = word.length;
    } else {
      used = need;
    }
  }
  return lines;
}

/** How tall a day's cell needs to be, in points, for these sessions (each a line of text such as "10 am Chair yoga"). */
export function cellHeight(sessions: readonly string[], fontPt: number): number {
  const text = sessions.reduce((sum, session) => sum + wrapLines(session, fontPt) * fontPt * LINE_HEIGHT, 0);
  return Math.max(CELL.minRow, CELL.dateLine + CELL.padding + text + Math.max(0, sessions.length - 1) * CELL.gapBetweenSessions);
}

const gridHeight = (): number => PAGE.height - 2 * PAGE.margin - CHROME.header - CHROME.footnote;

/** Plan a month onto sheets. `sessionsOn(date)` gives the lines of text a day will print. */
export function planPrint(weeks: (string | null)[][], sessionsOn: (date: string) => string[]): PrintPlan {
  const need = (size: number) => weeks.map((week) => Math.max(...week.map((date) => (date ? cellHeight(sessionsOn(date), size) : CELL.minRow))));
  const available = gridHeight();

  for (const size of ONE_SHEET_SIZES) {
    const rows = need(size);
    if (rows.reduce((a, b) => a + b, 0) <= available) return { sheets: [weeks], fontPt: size, rowPt: Math.min(available / weeks.length, 135) };
  }

  const split = (count: number) => {
    const perSheet = Math.ceil(weeks.length / count);
    const sheets: (string | null)[][][] = [];
    for (let i = 0; i < weeks.length; i += perSheet) sheets.push(weeks.slice(i, i + perSheet));
    return { perSheet, sheets };
  };
  const attempts = [
    { count: 2, sizes: TWO_SHEET_SIZES, cap: 160 },
    { count: 3, sizes: THREE_SHEET_SIZES, cap: 200 },
  ];
  for (const { count, sizes, cap } of attempts) {
    const { perSheet, sheets } = split(count);
    for (const size of sizes) {
      if (Math.max(...need(size)) * perSheet <= available) return { sheets, fontPt: size, rowPt: Math.min(available / perSheet, cap) };
    }
  }
  // Longer text than any month should have: three sheets, with rows as tall as they need.
  const { sheets } = split(3);
  const size = THREE_SHEET_SIZES[2];
  return { sheets, fontPt: size, rowPt: Math.max(...need(size)) };
}
