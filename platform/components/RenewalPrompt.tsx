import Link from "next/link";
import type { SubscriptionStatus } from "@/lib/db/models";
import { summarize } from "@/lib/domain/subscription";
import { Badge } from "./Badge";
import { PlanButtons, PortalButton } from "./billing-buttons";

/**
 * What a facility sees in place of a premium tool when its subscription does not
 * grant access. It says what happened in plain words, reassures that nothing has
 * been lost, and puts the way back one click away:
 *
 *   an admin, after a failed payment   a button straight to the Stripe billing portal
 *   an admin, with no live plan        the plans, to start one
 *   anyone else                        who to ask: a facility admin
 *
 * `compact` is for a banner on a page that still works (the dashboard): the same
 * message, with a link to the plans rather than the plans themselves.
 */
export function RenewalPrompt({ status, isAdmin, compact = false }: { status: SubscriptionStatus; isAdmin: boolean; compact?: boolean }) {
  const summary = summarize(status);
  return (
    <section className="card stack" aria-labelledby="renewal-title">
      <div className="row between">
        <h2 id="renewal-title">{summary.headline}</h2>
        <Badge tone={summary.tone}>{summary.label}</Badge>
      </div>
      <p>{isAdmin ? summary.detail : "The activity library and the calendar tools are paused until your facility's subscription is active."}</p>

      {isAdmin ? (
        summary.nextStep === "update_payment" ? (
          <PortalButton>Update billing in Stripe</PortalButton>
        ) : summary.nextStep === "choose_plan" ? (
          compact ? (
            <p>
              <Link className="btn" href="/admin/billing">
                Choose a plan
              </Link>
            </p>
          ) : (
            <PlanButtons />
          )
        ) : null
      ) : (
        <p>
          Please ask a facility admin, usually your Activity Director, to renew it. They can do that from <strong>Billing</strong>. Nothing you or your team have saved has been lost.
        </p>
      )}

      {isAdmin && !compact ? (
        <p className="small">
          <Link href="/admin/billing">See billing details</Link>
        </p>
      ) : null}
    </section>
  );
}
