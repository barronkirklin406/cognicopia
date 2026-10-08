"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { CalendarGroup, CalendarSlot } from "@/lib/domain/calendar";
import { dayLabel, localIsoDate, monthLabel, monthOfDate, nextDays, shiftMonth, timeLabel } from "@/lib/domain/months";
import { DayPlan, sessionTitle, sessionsOn, type Activities } from "./DayPlan";

/** The date on the wall where the person is. Re-read each minute, so a page left open overnight moves to the new day. */
function subscribe(callback: () => void) {
  const timer = window.setInterval(callback, 60_000);
  return () => window.clearInterval(timer);
}
const useToday = (serverToday: string) => useSyncExternalStore(subscribe, () => localIsoDate(), () => serverToday);

const buttonLook = "inline-flex min-h-11 items-center justify-center rounded-lg border-2 px-5 text-center text-base font-bold no-underline";

/**
 * Today and the week ahead, from the saved calendars. "Today" is the browser's own date (the
 * server's date is only what the first draw shows, so nothing flickers and nothing is out of step
 * for the few hours around midnight UTC that fall in the evening in the Americas). If this month
 * has no calendar yet, the page says so and offers to make one.
 */
export function DashboardPlan({
  serverToday,
  groups,
  slots,
  activities,
  plannedMonths,
}: {
  serverToday: string;
  groups: CalendarGroup[];
  slots: CalendarSlot[];
  activities: Activities;
  /** Months that have a calendar with something planned in it. */
  plannedMonths: string[];
}) {
  const today = useToday(serverToday);
  const thisMonth = monthOfDate(today);
  const week = nextDays(today, 7);
  const todays = sessionsOn(slots, today);
  const planned = plannedMonths.includes(thisMonth);

  return (
    <div className="grid gap-8">
      <section aria-labelledby="today-heading" className="grid gap-3">
        <h2 id="today-heading" className="m-0 font-display text-3xl font-bold text-ink">
          Today: {dayLabel(today)}
        </h2>
        {todays.length > 0 ? (
          <DayPlan date={today} groups={groups} slots={slots} activities={activities} large />
        ) : (
          <div className="grid gap-3 rounded-xl border-2 border-rule bg-white p-4 text-ink">
            <p className="m-0 text-lg font-bold">{planned ? "Nothing is planned for today." : `There is no calendar for ${monthLabel(thisMonth)} yet.`}</p>
            <p className="m-0 text-base">{planned ? "You can look at the whole month, or find something in the library." : "Choose a theme and Cognicopia plans the whole month in one click."}</p>
            <div className="flex flex-wrap gap-3">
              <Link href={planned ? `/calendar?month=${thisMonth}` : `/calendar/generate?month=${thisMonth}`} className={`${buttonLook} border-garden-dark bg-garden-dark text-white hover:bg-paper`}>
                {planned ? `Open ${monthLabel(thisMonth)}` : `Plan ${monthLabel(thisMonth)}`}
              </Link>
              <Link href="/library" className={`${buttonLook} border-garden-dark bg-white text-garden-dark hover:bg-tint`}>
                Find an activity
              </Link>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="week-heading" className="grid gap-3">
        <h2 id="week-heading" className="m-0 font-display text-2xl font-bold text-ink">
          The week ahead
        </h2>
        {slots.some((slot) => week.includes(slot.date)) ? (
          <ol className="m-0 grid list-none gap-3 p-0">
            {week.map((date) => (
              <li key={date} className="grid gap-2 rounded-xl border-2 border-rule bg-white p-3 md:grid-cols-[11rem_1fr] md:items-start">
                <h3 className="m-0 font-display text-lg font-bold text-ink">{date === today ? `Today, ${dayLabel(date).split(", ")[1]}` : dayLabel(date)}</h3>
                <div className={`grid gap-2 ${groups.length > 1 ? "lg:grid-cols-3" : ""}`}>
                  {groups.map((group) => {
                    const sessions = sessionsOn(slots, date, group.id);
                    return (
                      <div key={group.id} className="grid content-start gap-1">
                        {groups.length > 1 ? <p className="m-0 text-base font-bold text-garden-dark">{group.name}</p> : null}
                        {sessions.length === 0 ? <p className="m-0 text-base text-ink-soft">Nothing planned</p> : null}
                        <ul className="m-0 list-none space-y-1 p-0">
                          {sessions.map((slot) => (
                            <li key={slot.id} className="text-base text-ink">
                              <span className="font-bold">{timeLabel(slot.time)}</span> {sessionTitle(slot, activities)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="m-0 text-base text-ink-soft">No sessions are planned for the next seven days.</p>
        )}
      </section>

      <section aria-labelledby="months-heading" className="grid gap-3">
        <h2 id="months-heading" className="m-0 font-display text-2xl font-bold text-ink">
          Your calendars
        </h2>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-3">
          {[0, 1, 2].map((offset) => {
            const month = shiftMonth(thisMonth, offset);
            const has = plannedMonths.includes(month);
            return (
              <li key={month} className="grid content-between gap-3 rounded-xl border-2 border-rule bg-white p-3">
                <div>
                  <p className="m-0 font-display text-lg font-bold text-ink">{monthLabel(month)}</p>
                  <p className="m-0 text-base font-bold text-ink-soft">{has ? "✓ Planned" : "Not planned yet"}</p>
                </div>
                <Link
                  href={has ? `/calendar?month=${month}` : `/calendar/generate?month=${month}`}
                  className={`${buttonLook} ${has ? "border-garden-dark bg-white text-garden-dark hover:bg-tint" : "border-garden-dark bg-garden-dark text-white hover:bg-paper"}`}
                >
                  {has ? "Open" : "Plan this month"}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
