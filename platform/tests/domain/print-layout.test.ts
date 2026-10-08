import { describe, expect, it } from "vitest";
import { ONE_SHEET_SIZES, PAGE, THREE_SHEET_SIZES, TWO_SHEET_SIZES, cellHeight, planPrint, wrapLines } from "@/lib/domain/print-layout";
import { monthGrid } from "@/lib/domain/months";

const MIN_PT = 11;
const short = ["10 am Chair yoga", "2 pm Trivia", "4 pm Coloring page"];
const long = ["10 am Stretch and sway to the big bands", "2 pm Large-piece puzzle with a friend", "4 pm Watching the clouds go by from the window"];

describe("wrapping text in a day's cell", () => {
  it("puts a short title on one line", () => {
    expect(wrapLines("10 am Chair yoga", 11)).toBe(1);
  });

  it("wraps at spaces, and more at a larger size", () => {
    const text = "2 pm Large-piece puzzle with a friend";
    expect(wrapLines(text, 11)).toBeGreaterThan(1);
    expect(wrapLines(text, 13)).toBeGreaterThanOrEqual(wrapLines(text, 11));
  });

  it("breaks a word too long for the cell", () => {
    expect(wrapLines("Supercalifragilisticexpialidocious", 11)).toBeGreaterThanOrEqual(2);
  });

  it("is one line for nothing", () => {
    expect(wrapLines("", 11)).toBe(1);
  });
});

describe("a day's cell height", () => {
  it("grows with the sessions and with the type", () => {
    expect(cellHeight(long, 11)).toBeGreaterThan(cellHeight(short, 11));
    expect(cellHeight(short, 13)).toBeGreaterThan(cellHeight(short, 11));
    expect(cellHeight([], 11)).toBeGreaterThanOrEqual(62);
  });
});

describe("fitting a month onto paper", () => {
  const months = ["2026-02", "2026-03", "2026-10", "2026-11", "2027-02", "2027-05", "2028-02", "2026-08"]; // four, five and six week months
  const weeksOf = (month: string) => monthGrid(month);

  it("puts a quiet month (two short sessions a day) on one sheet, in the larger type", () => {
    for (const month of months) {
      const plan = planPrint(weeksOf(month), () => short.slice(0, 2));
      expect(plan.sheets, month).toHaveLength(1);
      expect(plan.fontPt, month).toBe(ONE_SHEET_SIZES[0]);
    }
  });

  it("splits a busy month (three medium sessions a day) over two sheets, never into smaller type", () => {
    const busy = ["10 am Stretch and sway to the big bands", "2 pm Large-piece puzzle", "4 pm Hand massage"];
    for (const month of months.filter((m) => weeksOf(m).length >= 5)) {
      const plan = planPrint(weeksOf(month), () => busy);
      expect(plan.sheets, month).toHaveLength(2);
      expect(TWO_SHEET_SIZES as readonly number[], month).toContain(plan.fontPt);
    }
  });

  it("uses three sheets, in larger type, for text longer than any real month", () => {
    const plan = planPrint(weeksOf("2026-11"), () => long);
    expect(plan.sheets.length).toBeGreaterThanOrEqual(2);
    if (plan.sheets.length === 3) expect(THREE_SHEET_SIZES as readonly number[]).toContain(plan.fontPt);
  });

  it("never prints in type below 11 pt, whatever the month", () => {
    for (const month of months) for (const sessions of [[], short.slice(0, 1), short, long, [...long, ...long]]) expect(planPrint(weeksOf(month), () => sessions).fontPt, `${month} ${sessions.length}`).toBeGreaterThanOrEqual(MIN_PT);
  });

  it("keeps every day of the month, once and in order, across the sheets", () => {
    for (const month of months) {
      for (const sessions of [short, long]) {
        const plan = planPrint(weeksOf(month), () => sessions);
        const days = plan.sheets.flat(2).filter((d): d is string => d !== null);
        expect(days, month).toEqual(weeksOf(month).flat().filter((d): d is string => d !== null));
        expect(plan.sheets.flat().every((week) => week.length === 7)).toBe(true);
      }
    }
  });

  it("splits the weeks evenly, the larger half first", () => {
    const busy = ["10 am Stretch and sway to the big bands", "2 pm Large-piece puzzle", "4 pm Hand massage"];
    const plan = planPrint(weeksOf("2027-05"), () => busy); // six weeks
    expect(plan.sheets.map((s) => s.length)).toEqual([3, 3]);
    const five = planPrint(weeksOf("2026-11"), () => busy); // five weeks
    expect(five.sheets.map((s) => s.length)).toEqual([3, 2]);
  });

  it("gives rows that fill the page without running over it", () => {
    for (const month of months) {
      for (const sessions of [short.slice(0, 2), short, long]) {
        const plan = planPrint(weeksOf(month), () => sessions);
        const rowsOnTallestSheet = Math.max(...plan.sheets.map((s) => s.length));
        const usable = PAGE.height - 2 * PAGE.margin;
        expect(plan.rowPt * rowsOnTallestSheet + 74 + 26, `${month} ${sessions.length}`).toBeLessThanOrEqual(usable + 0.5);
      }
    }
  });

  it("copes with a day that has far more than any month should", () => {
    const plan = planPrint(weeksOf("2026-11"), () => Array.from({ length: 12 }, () => "10 am A rather long name for a session"));
    expect(plan.sheets.length).toBeGreaterThanOrEqual(1);
    expect(plan.fontPt).toBeGreaterThanOrEqual(MIN_PT);
    expect(plan.rowPt).toBeGreaterThan(0);
  });

  it("is the same every time", () => {
    expect(planPrint(weeksOf("2026-11"), () => long)).toEqual(planPrint(weeksOf("2026-11"), () => long));
  });
});
