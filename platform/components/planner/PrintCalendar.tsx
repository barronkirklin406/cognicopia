import type { CSSProperties } from "react";
import type { CalendarSlot } from "@/lib/domain/calendar";
import { WEEKDAY_NAMES, monthGrid, monthLabel, shortTimeLabel } from "@/lib/domain/months";
import { planPrint } from "@/lib/domain/print-layout";
import { plainTitle, sessionsOn, type Activities } from "./DayPlan";

/**
 * One stage's month as it comes off the printer: one landscape letter sheet (or two, or three,
 * when the month is too busy for one at a readable size: lib/domain/print-layout.ts decides, and
 * says so in the sheet's title). Pure black on white, thick lines, no backgrounds, type of 11 pt
 * or more, bold times. The page itself (landscape letter, 0.4 in margins) is set by the
 * .print-calendar rule in app/globals.css. It is only there on paper: the screen shows the grid.
 */
export function PrintCalendar({
  month,
  groupId,
  groupName,
  slots,
  activities,
  facilityName,
  firstOnPaper,
}: {
  month: string;
  groupId: string;
  groupName: string;
  slots: readonly CalendarSlot[];
  activities: Activities;
  facilityName?: string | undefined;
  /** The very first sheet of the printout: every other sheet starts a new page. */
  firstOnPaper: boolean;
}) {
  const lines = (date: string) => sessionsOn(slots, date, groupId).map((slot) => `${shortTimeLabel(slot.time)} ${plainTitle(slot, activities)}`);
  const plan = planPrint(monthGrid(month), lines);
  const heading = `${groupName}: ${monthLabel(month)}`;

  return (
    <>
      {plan.sheets.map((weeks, index) => {
        const title = plan.sheets.length > 1 ? `${heading} (${index + 1} of ${plan.sheets.length})` : heading;
        return (
          <section key={index} className={`print-calendar ${firstOnPaper && index === 0 ? "" : "break-before-page"}`}>
            <table className="w-full table-fixed border-collapse border-[3px] border-black text-black" style={{ fontSize: `${plan.fontPt}pt` } as CSSProperties}>
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr>
                  <th colSpan={7} className="border-[3px] border-black px-2 py-1 text-left text-[20pt] font-bold leading-tight text-black">
                    <span className="flex items-baseline justify-between gap-4">
                      <span>{title}</span>
                      {facilityName ? <span className="text-[12pt] font-normal">{facilityName}</span> : null}
                    </span>
                  </th>
                </tr>
                <tr>
                  {WEEKDAY_NAMES.map((name) => (
                    <th key={name} scope="col" className="border-[3px] border-black px-1 py-1 text-center text-[12pt] font-bold leading-tight text-black">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => (
                  <tr key={week.find((d) => d !== null) ?? "blank"} style={{ height: `${plan.rowPt}pt` }}>
                    {week.map((date, column) =>
                      date === null ? (
                        <td key={`blank-${column}`} className="border-[3px] border-black" />
                      ) : (
                        <td key={date} className="border-[3px] border-black p-[5pt] align-top">
                          <p className="m-0 text-[16pt] font-bold leading-none text-black">{Number(date.slice(8))}</p>
                          <ol className="m-0 mt-[3pt] list-none p-0">
                            {sessionsOn(slots, date, groupId).map((slot) => (
                              <li key={slot.id} className="mb-[2pt] leading-[1.15] text-black">
                                <span className="font-bold">{shortTimeLabel(slot.time)}</span> {plainTitle(slot, activities)}
                              </li>
                            ))}
                          </ol>
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="m-0 mt-[6pt] text-[11pt] leading-tight text-black">Activities are suggestions: adapt them to the people in the room.</p>
          </section>
        );
      })}
    </>
  );
}
