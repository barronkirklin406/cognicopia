import type { CalendarSlot } from "@/lib/domain/calendar";
import { WEEKDAY_NAMES, dayLabel, monthGrid, monthLabel, shortTimeLabel } from "@/lib/domain/months";
import { sessionTitle, sessionsOn, type Activities } from "./DayPlan";

/**
 * A month as a table, for the screen: the weekdays across the top, a row for each week, and in each
 * day the sessions planned, with their times. It is a real table (the weekday headers label every
 * column). Each day is a large button that chooses the day, to show how to run its sessions.
 * The printed calendar is a separate layout (PrintCalendar), not this one squeezed onto paper.
 */
export function CalendarGrid({
  month,
  slots,
  activities,
  groupId,
  selected,
  onSelect,
  caption,
}: {
  month: string;
  slots: readonly CalendarSlot[];
  activities: Activities;
  groupId: string;
  selected?: string | undefined;
  onSelect?: (date: string) => void;
  /** Read by screen readers, as the table's name. */
  caption: string;
}) {
  const weeks = monthGrid(month);
  return (
    <table className="w-full table-fixed border-collapse border-2 border-ink-soft bg-white text-ink">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {WEEKDAY_NAMES.map((name) => (
            <th key={name} scope="col" className="border-2 border-ink-soft bg-tint px-1 py-2 text-center text-base font-bold text-ink">
              <abbr title={name} className="no-underline">
                {name.slice(0, 3)}
              </abbr>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week.find((d) => d !== null) ?? "blank"}>
            {week.map((date, column) =>
              date === null ? (
                <td key={`blank-${column}`} className="border-2 border-rule-soft bg-field" />
              ) : (
                <td key={date} className="h-px border-2 border-rule p-0 align-top">
                  <DayButton date={date} slots={sessionsOn(slots, date, groupId)} activities={activities} isSelected={selected === date} onSelect={onSelect} />
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DayButton({
  date,
  slots,
  activities,
  isSelected,
  onSelect,
}: {
  date: string;
  slots: readonly CalendarSlot[];
  activities: Activities;
  isSelected: boolean;
  onSelect: ((date: string) => void) | undefined;
}) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={() => onSelect?.(date)}
      className={`block h-full min-h-32 w-full cursor-pointer p-2 text-left font-[inherit] text-ink ${isSelected ? "bg-tint outline-4 -outline-offset-4 outline-garden-dark" : "bg-white hover:bg-tint"}`}
    >
      <span className="sr-only">{dayLabel(date)}. </span>
      <span aria-hidden="true" className="block text-xl font-bold leading-none">
        {Number(date.slice(8))}
      </span>
      {slots.map((slot) => (
        <span key={slot.id} className="mt-1 block text-sm leading-tight">
          <span className="font-bold">{shortTimeLabel(slot.time)}</span> {sessionTitle(slot, activities)}
        </span>
      ))}
      {slots.length === 0 ? <span className="mt-1 block text-sm text-ink-soft">Nothing planned</span> : null}
    </button>
  );
}

/** "Early stage: October 2026", for a grid's name. */
export const gridCaption = (month: string, groupName: string): string => `${groupName}: ${monthLabel(month)}`;
