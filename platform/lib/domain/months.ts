/**
 * Months as 'YYYY-MM' text, like the calendar tables use. All in UTC, so the
 * month shown never slips with the reader's time zone.
 */

export function currentMonth(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/** The month `delta` months from `month`: shiftMonth("2026-12", 1) is "2027-01". */
export function shiftMonth(month: string, delta: number): string {
  const [year, number] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** "October 2026". */
export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}
