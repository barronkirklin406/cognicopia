import type { Metadata } from "next";
import { CalendarGenerator } from "@/components/planner/CalendarGenerator";
import { PageHeader } from "@/components/planner/PageHeader";
import { RenewalPrompt } from "@/components/RenewalPrompt";
import { Shell } from "@/components/Shell";
import { requirePremium } from "@/lib/access/guards";
import { first, type SearchParams } from "@/lib/auth/params";
import { getCalendarsForMonths } from "@/lib/data/calendars";
import { listContent } from "@/lib/data/content";
import { MonthSchema } from "@/lib/domain/calendar";
import { newSeed } from "@/lib/domain/calendar-generator";
import { currentMonth, upcomingMonths } from "@/lib/domain/months";

export const metadata: Metadata = { title: "Plan a month" };

/** Drawn for each request: it depends on who is signed in, and the first mix is new each time. */
export const dynamic = "force-dynamic";

/**
 * The one-click month planner: a premium tool. The library goes to the browser, which makes the
 * preview; saving sends only the choices, and the server makes the calendar itself.
 */
export default async function GenerateCalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const access = await requirePremium("/calendar/generate");
  const session = { user: access.user, membership: access.membership };

  if (access.blocked) {
    return (
      <Shell session={session} current="/calendar">
        <div className="stack">
          <h1>Plan a month</h1>
          <RenewalPrompt status={access.membership.facility.subscription_status} isAdmin={access.membership.role === "admin"} />
        </div>
      </Shell>
    );
  }

  const months = upcomingMonths(currentMonth(), 12);
  const asked = MonthSchema.safeParse(first((await searchParams).month));
  const initialMonth = asked.success && months.includes(asked.data) ? asked.data : months[0]!;
  const [library, saved] = await Promise.all([listContent(access.db, { limit: 1000 }), getCalendarsForMonths(access.db, months)]);

  return (
    <Shell session={session} current="/calendar">
      <div className="grid gap-6">
        <PageHeader title="Plan a month">Choose a month and a theme. Cognicopia fills every day with a few sessions for each stage, drawn from the library. Mix it up until it feels right, then save it.</PageHeader>
        {library.length === 0 ? (
          <p className="m-0 text-lg">The activity library is empty, so there is nothing to plan from yet.</p>
        ) : (
          <CalendarGenerator
            library={library}
            months={months}
            savedMonths={[...saved.keys()]}
            initialMonth={initialMonth}
            initialSeed={newSeed()}
            facilityName={access.membership.facility.facility_name}
          />
        )}
      </div>
    </Shell>
  );
}
