import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/Alert";
import { CalendarView } from "@/components/planner/CalendarView";
import { PageHeader } from "@/components/planner/PageHeader";
import { RenewalPrompt } from "@/components/RenewalPrompt";
import { Shell } from "@/components/Shell";
import { requirePremium } from "@/lib/access/guards";
import { calendarNotice } from "@/lib/auth/messages";
import { first, type SearchParams } from "@/lib/auth/params";
import { getCalendar } from "@/lib/data/calendars";
import { contentByIds } from "@/lib/data/content";
import { MonthSchema } from "@/lib/domain/calendar";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/domain/months";

export const metadata: Metadata = { title: "Calendar" };

/** Drawn for each request: it depends on who is signed in. */
export const dynamic = "force-dynamic";

const navBase = "inline-flex min-h-11 items-center rounded-lg border-2 border-garden-dark px-4 text-base font-bold no-underline";
const navQuiet = `${navBase} bg-white text-garden-dark hover:bg-tint`;
const navMain = `${navBase} bg-garden-dark text-white hover:bg-paper`;

/**
 * The month's calendar: a premium tool, guarded like the library. It shows what has been planned,
 * stage by stage, with how to run each day's sessions, and prints it as one landscape page for each
 * stage. "Plan this month" opens the generator, which makes and saves a month in one click.
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

  const params = await searchParams;
  const asked = MonthSchema.safeParse(first(params.month));
  const month = asked.success ? asked.data : currentMonth();
  const notice = calendarNotice(first(params.notice));
  const calendar = await getCalendar(access.db, month);
  const data = calendar?.generated_data;
  const activities = data ? Object.fromEntries(await contentByIds(access.db, data.slots.map((slot) => slot.content_item_id))) : {};

  return (
    <Shell session={session} current="/calendar">
      <div className="grid gap-6">
        <PageHeader title={`Calendar: ${monthLabel(month)}`}>Each stage has its own plan. Choose a day to see how to run its sessions, or print the month.</PageHeader>
        {notice ? (
          <div className="print:hidden">
            <Alert tone="info">{notice}</Alert>
          </div>
        ) : null}

        <nav aria-label="Choose a month" className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link className={navQuiet} href={`/calendar?month=${shiftMonth(month, -1)}`}>
            ← {monthLabel(shiftMonth(month, -1))}
          </Link>
          <Link className={navMain} href={`/calendar/generate?month=${month}`}>
            {data && data.slots.length > 0 ? "Plan this month again" : "Plan this month"}
          </Link>
          <Link className={navQuiet} href={`/calendar?month=${shiftMonth(month, 1)}`}>
            {monthLabel(shiftMonth(month, 1))} →
          </Link>
        </nav>

        {data && data.slots.length > 0 ? (
          <CalendarView month={month} data={data} activities={activities} mode="saved" facilityName={access.membership.facility.facility_name} />
        ) : (
          <div className="grid gap-3 rounded-xl border-2 border-rule bg-white p-4 text-ink">
            <p className="m-0 text-lg font-bold">{data ? `${monthLabel(month)} has no sessions yet.` : `There is no calendar for ${monthLabel(month)} yet.`}</p>
            <p className="m-0 text-base">Choose a theme and Cognicopia plans the whole month, with a few sessions each day for every stage.</p>
            <div>
              <Link className={navMain} href={`/calendar/generate?month=${month}`}>
                Plan {monthLabel(month)}
              </Link>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
