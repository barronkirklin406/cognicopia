import type { CalendarData, CalendarGroup, CalendarSlot } from "./calendar";
import { shiftDay } from "./months";

/**
 * What the dashboard needs from the saved calendars, and no more. "Today" is the date on the wall
 * where the person is, which only their browser knows, but it is never more than a day away from
 * the server's date, so the server sends a window around its own date (a day either side, and a
 * week ahead) and the browser picks today and the week out of it. That keeps the page small,
 * however many months are saved, and never shows the wrong day near midnight.
 */
export interface PlanWindow {
  groups: CalendarGroup[];
  slots: CalendarSlot[];
}

/** How far the window reaches: from a day before the server's date to a week and a day after it. */
export const WINDOW_BEFORE = 1;
export const WINDOW_AFTER = 8;

export function windowAround(serverToday: string): { from: string; to: string } {
  return { from: shiftDay(serverToday, -WINDOW_BEFORE), to: shiftDay(serverToday, WINDOW_AFTER) };
}

/** The slots from `from` to `to` (both included) across the saved calendars, in time order, with the groups they belong to. */
export function planWindow(calendars: ReadonlyMap<string, CalendarData>, from: string, to: string): PlanWindow {
  const groups = new Map<string, CalendarGroup>();
  const slots: CalendarSlot[] = [];
  for (const calendar of calendars.values()) {
    for (const group of calendar.groups) if (!groups.has(group.id)) groups.set(group.id, group);
    for (const slot of calendar.slots) if (slot.date >= from && slot.date <= to) slots.push(slot);
  }
  const used = new Set(slots.map((slot) => slot.group_id));
  slots.sort((a, b) => `${a.date} ${a.time} ${a.group_id}`.localeCompare(`${b.date} ${b.time} ${b.group_id}`));
  return { groups: [...groups.values()].filter((group) => used.has(group.id)), slots };
}

/** The months (of those given) that have a calendar with something planned in it, in order. */
export function plannedMonths(calendars: ReadonlyMap<string, CalendarData>): string[] {
  return [...calendars.entries()].filter(([, calendar]) => calendar.slots.length > 0).map(([month]) => month).sort();
}
