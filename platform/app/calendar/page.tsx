import type { Metadata } from "next";
import Link from "next/link";
import { RenewalPrompt } from "@/components/RenewalPrompt";
import { Shell } from "@/components/Shell";
import { requirePremium } from "@/lib/access/guards";
import { first, type SearchParams } from "@/lib/auth/params";
import { getCalendar } from "@/lib/data/calendars";
import { contentTitles } from "@/lib/data/content";
import { MonthSchema } from "@/lib/domain/calendar";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/domain/months";

export const metadata: Metadata = { title: "Calendar" };

/** Drawn for each request: it depends on who is signed in. */
export const dynamic = "force-dynamic";

const dateLabel = (date: string) => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

/**
 * The month's calendar: a premium tool, guarded like the library. The page shows
 * what has been planned. Making a plan (the scheduling engine) is the next piece of work.
 */
export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const access = await requirePremium("/calendar");
  const session = { user: access.user, membership: access.membership };

  if (access.blocked) {
    return (
      <Shell session={session} current="/calendar">
        <div className="stack">
          <h1>Calendar</h1>
          <RenewalPrompt status={access.membership.facility.subscription_status} isAdmin={access.membership.role === "admin"} />
        </div>
      </Shell>
    );
  }

  const asked = MonthSchema.safeParse(first((await searchParams).month));
  const month = asked.success ? asked.data : currentMonth();
  const calendar = await getCalendar(access.db, month);
  const slots = [...(calendar?.generated_data.slots ?? [])].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const groups = new Map((calendar?.generated_data.groups ?? []).map((group) => [group.id, group.name]));
  const titles = await contentTitles(access.db, slots.map((slot) => slot.content_item_id));

  return (
    <Shell session={session} current="/calendar">
      <div className="stack">
        <h1>Calendar: {monthLabel(month)}</h1>
        <nav className="row between" aria-label="Choose a month">
          <Link className="btn secondary" href={`/calendar?month=${shiftMonth(month, -1)}`}>
            ← {monthLabel(shiftMonth(month, -1))}
          </Link>
          <Link className="btn secondary" href={`/calendar?month=${shiftMonth(month, 1)}`}>
            {monthLabel(shiftMonth(month, 1))} →
          </Link>
        </nav>

        {!calendar ? (
          <p>There is no calendar for {monthLabel(month)} yet.</p>
        ) : slots.length === 0 ? (
          <p>This month's calendar has no sessions yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Sessions planned for {monthLabel(month)}</caption>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">Time</th>
                  <th scope="col">Group</th>
                  <th scope="col">Activity</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={slot.id}>
                    <td>{dateLabel(slot.date)}</td>
                    <td>{slot.time}</td>
                    <td>{groups.get(slot.group_id) ?? "A group"}</td>
                    <td>{titles.get(slot.content_item_id) ?? "An activity"}</td>
                    <td>{slot.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
