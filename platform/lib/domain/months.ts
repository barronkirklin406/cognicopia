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

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** How many days the month has (leap years included). */
export function daysInMonth(month: string): number {
  const [year, number] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, number, 0)).getUTCDate();
}

/** The weekday the month starts on, 0 for Sunday. */
export function firstWeekday(month: string): number {
  return new Date(`${month}-01T00:00:00Z`).getUTCDay();
}

/** "2026-10" and 7 give "2026-10-07". */
export const isoDay = (month: string, day: number): string => `${month}-${String(day).padStart(2, "0")}`;

/** The month as weeks of seven, Sunday first: a date for each day in it, and null for the blanks around. */
export function monthGrid(month: string): (string | null)[][] {
  const cells: (string | null)[] = [...Array<null>(firstWeekday(month)).fill(null)];
  for (let day = 1; day <= daysInMonth(month); day++) cells.push(isoDay(month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** "Wednesday, October 7". */
export function dayLabel(date: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

/** The year and month choices a calendar can be made for: this month and the next eleven. */
export function upcomingMonths(from: string = currentMonth(), count = 12): string[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(from, i));
}

/** The date on the wall where the person is, as "2026-10-07": local time, unlike currentMonth() (UTC). A page that says "today" uses this, in the browser. */
export function localIsoDate(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The month a date is in: "2026-10-07" is in "2026-10". */
export const monthOfDate = (date: string): string => date.slice(0, 7);

/** `count` dates in a row from `date`, crossing into the next month where needed: nextDays("2026-10-30", 3) is the 30th, the 31st and "2026-11-01". */
export function nextDays(date: string, count: number): string[] {
  const start = new Date(`${date}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) => new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10));
}

/** "14:00" is "2:00 pm". */
export function timeLabel(time: string): string {
  const [hours, minutes] = time.split(":").map(Number) as [number, number];
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "am" : "pm"}`;
}

/** The date `delta` days from `date` (negative for earlier): shiftDay("2026-11-01", -1) is "2026-10-31". */
export const shiftDay = (date: string, delta: number): string => new Date(new Date(`${date}T00:00:00Z`).getTime() + delta * 86_400_000).toISOString().slice(0, 10);

/** "10:00" is "10 am" and "14:30" is "2:30 pm": the short form for a calendar cell, where space is tight. */
export const shortTimeLabel = (time: string): string => timeLabel(time).replace(":00", "");
