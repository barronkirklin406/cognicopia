import { describe, expect, it } from "vitest";
import type { CalendarData, CalendarSlot } from "@/lib/domain/calendar";
import { WINDOW_AFTER, WINDOW_BEFORE, plannedMonths, planWindow, windowAround } from "@/lib/domain/dashboard";
import { shiftDay } from "@/lib/domain/months";

const ID = "5eed0000-0000-4000-8000-000000000001";
const slot = (group: string, date: string, time: string): CalendarSlot => ({ id: `${group}-${date}-${time}`, date, time, group_id: group, content_item_id: ID, locked: false, note: "" });
const calendar = (month: string, groups: string[], slots: CalendarSlot[]): CalendarData => ({
  schema_version: 1,
  month,
  groups: groups.map((id) => ({ id, name: id, acuity: 1 as const })),
  slots,
});

describe("shiftDay", () => {
  it("moves by days across the end of a month, a year and a leap February", () => {
    expect(shiftDay("2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDay("2028-02-28", 1)).toBe("2028-02-29");
    expect(shiftDay("2026-10-07", 0)).toBe("2026-10-07");
    expect(shiftDay("2026-10-07", 30)).toBe("2026-11-06");
  });
});

describe("the dashboard's window", () => {
  it("reaches a day before the server's date and a week and a day after it", () => {
    expect(windowAround("2026-10-07")).toEqual({ from: "2026-10-06", to: "2026-10-15" });
    expect([WINDOW_BEFORE, WINDOW_AFTER]).toEqual([1, 8]);
  });

  it("covers the browser's today wherever the person is: UTC-12 to UTC+14 is never more than a day from UTC", () => {
    const { from, to } = windowAround("2026-10-07");
    for (const today of ["2026-10-06", "2026-10-07", "2026-10-08"]) {
      expect(today >= from && shiftDay(today, 6) <= to, today).toBe(true); // today and the six days after it
    }
  });

  it("takes only the slots inside it, across two months, in time order", () => {
    const october = calendar("2026-10", ["early"], [slot("early", "2026-10-30", "14:00"), slot("early", "2026-10-30", "10:00"), slot("early", "2026-10-31", "10:00"), slot("early", "2026-10-02", "10:00")]);
    const november = calendar("2026-11", ["early"], [slot("early", "2026-11-01", "10:00"), slot("early", "2026-11-09", "10:00"), slot("early", "2026-11-20", "10:00")]);
    const { slots } = planWindow(
      new Map([
        ["2026-10", october],
        ["2026-11", november],
      ]),
      "2026-10-30",
      "2026-11-08",
    );
    expect(slots.map((s) => `${s.date} ${s.time}`)).toEqual(["2026-10-30 10:00", "2026-10-30 14:00", "2026-10-31 10:00", "2026-11-01 10:00"]);
  });

  it("keeps each group once, and only the groups that have a session in the window", () => {
    const october = calendar("2026-10", ["early", "late"], [slot("early", "2026-10-07", "10:00")]);
    const { groups } = planWindow(new Map([["2026-10", october]]), "2026-10-06", "2026-10-15");
    expect(groups.map((g) => g.id)).toEqual(["early"]);

    const both = planWindow(
      new Map([
        ["2026-10", calendar("2026-10", ["early"], [slot("early", "2026-10-31", "10:00")])],
        ["2026-11", calendar("2026-11", ["early", "middle"], [slot("early", "2026-11-01", "10:00"), slot("middle", "2026-11-01", "10:00")])],
      ]),
      "2026-10-30",
      "2026-11-02",
    );
    expect(both.groups.map((g) => g.id)).toEqual(["early", "middle"]);
  });

  it("is empty when nothing is saved", () => {
    expect(planWindow(new Map(), "2026-10-06", "2026-10-15")).toEqual({ groups: [], slots: [] });
  });

  it("lists the months that have something planned, in order", () => {
    const planned = new Map([
      ["2026-11", calendar("2026-11", ["early"], [slot("early", "2026-11-01", "10:00")])],
      ["2026-10", calendar("2026-10", ["early"], [slot("early", "2026-10-01", "10:00")])],
      ["2026-12", calendar("2026-12", [], [])],
    ]);
    expect(plannedMonths(planned)).toEqual(["2026-10", "2026-11"]);
  });
});
