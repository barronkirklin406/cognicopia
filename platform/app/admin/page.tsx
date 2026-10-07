import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Shell } from "@/components/Shell";
import { requireAdmin } from "@/lib/access/guards";
import { summarize } from "@/lib/domain/subscription";

export const metadata: Metadata = { title: "Managing your facility" };

/** Drawn for each request: it depends on who is signed in. */
export const dynamic = "force-dynamic";

/** For admins (Activity Directors): the team, the subscription and the settings. Staff are sent back to their home page. */
export default async function AdminHomePage() {
  const { user, membership } = await requireAdmin("/admin");
  const summary = summarize(membership.facility.subscription_status);
  return (
    <Shell session={{ user, membership }} current="/admin">
      <div className="stack">
        <h1>Managing {membership.facility.facility_name}</h1>
        <div className="grid">
          <Link className="card stack" href="/admin/team">
            <h2>Team</h2>
            <p>Invite people, and choose who is an admin.</p>
          </Link>
          <Link className="card stack" href="/admin/billing">
            <h2>Billing</h2>
            <p>
              <Badge tone={summary.tone}>{summary.label}</Badge>
            </p>
            <p>Your plan, invoices and payment method.</p>
          </Link>
          <Link className="card stack" href="/admin/settings">
            <h2>Settings</h2>
            <p>Your facility's name.</p>
          </Link>
        </div>
      </div>
    </Shell>
  );
}
