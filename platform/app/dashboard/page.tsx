import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/Alert";
import { Badge } from "@/components/Badge";
import { RenewalPrompt } from "@/components/RenewalPrompt";
import { Shell } from "@/components/Shell";
import { requireMember } from "@/lib/access/guards";
import { pageNotice } from "@/lib/auth/messages";
import { first, type SearchParams } from "@/lib/auth/params";
import { grantsAccess, summarize } from "@/lib/domain/subscription";

export const metadata: Metadata = { title: "Home" };

/** Drawn for each request: it depends on who is signed in. */
export const dynamic = "force-dynamic";

/**
 * Where everyone lands after signing in. What it offers follows the person's role:
 * staff get the library and the calendar; admins also get the team, billing and
 * settings. When the subscription does not grant access, the tools say so, and an
 * admin is shown the way to put it right.
 */
export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, membership } = await requireMember("/dashboard");
  const notice = pageNotice(first((await searchParams).notice));
  const { facility, role } = membership;
  const isAdmin = role === "admin";
  const open = grantsAccess(facility.subscription_status);
  const summary = summarize(facility.subscription_status);

  return (
    <Shell session={{ user, membership }} current="/dashboard">
      <div className="stack">
        <h1>{facility.facility_name}</h1>
        {notice ? <Alert tone="info">{notice}</Alert> : null}
        {!open ? <RenewalPrompt status={facility.subscription_status} isAdmin={isAdmin} compact /> : null}

        <h2>Your tools</h2>
        <div className="grid">
          <Link className="card stack" href="/library">
            <h3>Activity library</h3>
            <p>Browse activities by stage and category.</p>
            {!open ? <Badge tone="warn">Subscription needed</Badge> : null}
          </Link>
          <Link className="card stack" href="/calendar">
            <h3>Calendar</h3>
            <p>See the month's plan for each group.</p>
            {!open ? <Badge tone="warn">Subscription needed</Badge> : null}
          </Link>
        </div>

        {isAdmin ? (
          <>
            <h2>Managing your facility</h2>
            <div className="grid">
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
                <p>Your facility's name.</p>
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </Shell>
  );
}
