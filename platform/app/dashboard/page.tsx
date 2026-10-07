import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/Alert";
import { Badge } from "@/components/Badge";
import { DashboardPlan } from "@/components/planner/DashboardPlan";
import type { Activities } from "@/components/planner/DayPlan";
import { PageHeader } from "@/components/planner/PageHeader";
import { RenewalPrompt } from "@/components/RenewalPrompt";
import { Shell } from "@/components/Shell";
import { requirePremium } from "@/lib/access/guards";
import { pageNotice } from "@/lib/auth/messages";
import { first, type SearchParams } from "@/lib/auth/params";
import { getCalendarsForMonths } from "@/lib/data/calendars";
import { contentByIds } from "@/lib/data/content";
import type { CalendarGroup, CalendarSlot } from "@/lib/domain/calendar";
import { plannedMonths, planWindow, windowAround } from "@/lib/domain/dashboard";
import { monthOfDate, shiftMonth } from "@/lib/domain/months";
import { summarize } from "@/lib/domain/subscription";

export const metadata: Metadata = { title: "Home" };

/** Drawn for each request: it depends on who is signed in. */
export const dynamic = "force-dynamic";

const quickAction = "inline-flex min-h-14 items-center leading-tight justify-center rounded-xl border-2 px-5 py-2 text-center text-lg font-bold no-underline";

/**
 * Where everyone lands after signing in: a calm page for daily planning. Today's plan comes first,
 * then the week ahead and the calendars for the next three months, with the four things an Activity
 * Director reaches for most (plan a month, find an activity, reminiscence prompts, the calendar)
 * one tap away. Admins also get the team, billing and settings, small, underneath. When the
 * subscription does not grant access, the page says so and an admin is shown the way to put it
 * right; the plan itself is a premium tool and is not read.
 */
export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const access = await requirePremium("/dashboard");
  const { user, membership } = access;
  const notice = pageNotice(first((await searchParams).notice));
  const { facility, role } = membership;
  const isAdmin = role === "admin";
  const summary = summarize(facility.subscription_status);

  let plan: { serverToday: string; groups: CalendarGroup[]; slots: CalendarSlot[]; planned: string[]; activities: Activities } | null = null;
  if (!access.blocked) {
    const serverToday = new Date().toISOString().slice(0, 10);
    const current = monthOfDate(serverToday);
    const months = [shiftMonth(current, -1), current, shiftMonth(current, 1), shiftMonth(current, 2)];
    const saved = await getCalendarsForMonths(access.db, months);
    const data = new Map([...saved].map(([month, calendar]) => [month, calendar.generated_data]));
    const { from, to } = windowAround(serverToday);
    const window = planWindow(data, from, to);
    plan = { serverToday, ...window, planned: plannedMonths(data), activities: Object.fromEntries(await contentByIds(access.db, window.slots.map((slot) => slot.content_item_id))) };
  }

  return (
    <Shell session={{ user, membership }} current="/dashboard">
      <div className="grid gap-8">
        <PageHeader title={facility.facility_name}>Today&rsquo;s plan, the week ahead and everything for planning in one place.</PageHeader>
        {notice ? <Alert tone="info">{notice}</Alert> : null}
        {access.blocked ? <RenewalPrompt status={facility.subscription_status} isAdmin={isAdmin} compact /> : null}

        {plan ? (
          <>
            <nav aria-label="Quick actions" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Link href="/calendar/generate" className={`${quickAction} border-garden-dark bg-garden-dark text-white hover:bg-paper`}>
                Plan a month
              </Link>
              <Link href="/library" className={`${quickAction} border-garden-dark bg-white text-garden-dark hover:bg-tint`}>
                Find an activity
              </Link>
              <Link href="/reminiscence" className={`${quickAction} border-garden-dark bg-white text-garden-dark hover:bg-tint`}>
                Reminiscence prompts
              </Link>
              <Link href="/calendar" className={`${quickAction} border-garden-dark bg-white text-garden-dark hover:bg-tint`}>
                Open the calendar
              </Link>
            </nav>
            <DashboardPlan serverToday={plan.serverToday} groups={plan.groups} slots={plan.slots} activities={plan.activities} plannedMonths={plan.planned} />
          </>
        ) : null}

        {isAdmin ? (
          <section aria-labelledby="manage-heading" className="grid gap-3">
            <h2 id="manage-heading" className="m-0 font-display text-xl font-bold text-ink">
              Managing your facility
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link className="card stack" href="/admin/team">
                <h3>Team</h3>
                <p>Invite people, and choose who is an admin.</p>
              </Link>
              <Link className="card stack" href="/admin/billing">
                <h3>Billing</h3>
                <p>
                  <Badge tone={summary.tone}>{summary.label}</Badge>
                </p>
                <p>Your plan, invoices and payment method.</p>
              </Link>
              <Link className="card stack" href="/admin/settings">
                <h3>Settings</h3>
                <p>Your facility&rsquo;s name.</p>
              </Link>
            </div>
          </section>
        ) : null}
      </div>
    </Shell>
  );
}
