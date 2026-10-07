import type { Metadata } from "next";
import { Alert } from "@/components/Alert";
import { Badge } from "@/components/Badge";
import { PlanButtons, PortalButton, RefreshForm } from "@/components/billing-buttons";
import { Shell } from "@/components/Shell";
import { toFacilityBilling, type FacilityBilling } from "@/lib/access/context";
import { requireAdmin } from "@/lib/access/guards";
import { first, type SearchParams } from "@/lib/auth/params";
import { reconcileAndReload } from "@/lib/billing/reconcile";
import { getStripe } from "@/lib/billing/stripe";
import { canStartCheckout, grantsAccess, periodLine, summarize } from "@/lib/domain/subscription";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Billing" };

/** Drawn for each request: it depends on who is signed in. */
export const dynamic = "force-dynamic";

/**
 * Coming back from Stripe (Checkout, or the billing portal), the page does not wait
 * to be told what happened: it asks Stripe now, with the same call the webhook
 * makes, so the person sees their real status straight away. If Stripe cannot be
 * reached, or billing is not set up, the page simply shows what is on record.
 */
async function recheck(facility: FacilityBilling): Promise<FacilityBilling> {
  try {
    const { facility: fresh } = await reconcileAndReload({ stripe: getStripe(), admin: createAdminClient() }, facility);
    return fresh ? toFacilityBilling(fresh) : facility;
  } catch (error) {
    console.error("[billing] could not re-check on returning from Stripe:", error instanceof Error ? error.name : typeof error);
    return facility;
  }
}

export default async function BillingPage({ searchParams }: { searchParams: SearchParams }) {
  const guard = await requireAdmin("/admin/billing");
  const params = await searchParams;
  let facility = guard.membership.facility;

  const returning = first(params.checkout) === "success" || first(params.portal) === "return";
  if (returning && facility.stripe_customer_id) facility = await recheck(facility);

  const summary = summarize(facility.subscription_status);
  const open = grantsAccess(facility.subscription_status);
  const line = periodLine({
    status: facility.subscription_status,
    currentPeriodEnd: facility.subscription_current_period_end,
    cancelAtPeriodEnd: facility.subscription_cancel_at_period_end,
    interval: facility.subscription_interval,
  });
  const checkout = first(params.checkout);

  return (
    <Shell session={{ user: guard.user, membership: { ...guard.membership, facility } }} current="/admin/billing">
      <div className="stack">
        <h1>Billing</h1>

        {first(params.welcome) ? <Alert tone="info">Your facility is set up. Choose a plan to unlock the activity library and the calendar tools.</Alert> : null}
        {checkout === "canceled" ? <Alert tone="info">Checkout was cancelled. You have not been charged.</Alert> : null}
        {checkout === "success" ? (
          open ? (
            <Alert tone="info" title="Thank you">
              <p>Your subscription is active.</p>
            </Alert>
          ) : (
            <Alert tone="warn" title="Waiting for confirmation">
              <p>We are waiting for Stripe to confirm your payment. This usually takes a few seconds. Choose “Check my payment status” below in a moment.</p>
            </Alert>
          )
        ) : null}

        <section className="card stack" aria-labelledby="status-title">
          <div className="row between">
            <h2 id="status-title">{summary.headline}</h2>
            <Badge tone={summary.tone}>{summary.label}</Badge>
          </div>
          <p>{summary.detail}</p>
          {line ? <p className="muted">{line}</p> : null}
        </section>

        {canStartCheckout(facility.subscription_status) ? (
          <section className="stack" aria-labelledby="plans-title">
            <h2 id="plans-title">Choose a plan</h2>
            <PlanButtons />
          </section>
        ) : null}

        {facility.stripe_customer_id ? (
          <section className="stack" aria-labelledby="portal-title">
            <h2 id="portal-title">Manage your billing</h2>
            <p>Update your card, read your invoices, change plan or cancel, in Stripe's secure billing portal.</p>
            <PortalButton secondary={!(summary.nextStep === "update_payment")}>
              {summary.nextStep === "update_payment" ? "Update billing in Stripe" : "Open the billing portal"}
            </PortalButton>
          </section>
        ) : null}

        {facility.stripe_customer_id ? (
          <section className="stack" aria-labelledby="refresh-title">
            <h2 id="refresh-title">Not what you expected?</h2>
            <p>Your status updates by itself within moments of a payment. To check with Stripe right now:</p>
            <RefreshForm />
          </section>
        ) : null}
      </div>
    </Shell>
  );
}
