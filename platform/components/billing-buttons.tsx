"use client";

import { useActionState, useState } from "react";
import { refreshBillingAction } from "@/app/admin/actions";
import { emptyState } from "@/lib/auth/state";
import { PLANS, type PlanId } from "@/lib/domain/plans";
import { isStripeUrl } from "@/lib/domain/stripe-url";
import { Alert } from "./Alert";
import { FormAlerts, SubmitButton } from "./forms";

/**
 * The buttons that take an admin to Stripe. They ask our own API for a one-time
 * address (Checkout, or the billing portal) and go there. The address is only
 * followed if it really is on stripe.com.
 */

async function goToStripe(path: string, body: unknown): Promise<string | null> {
  try {
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data: unknown = await response.json().catch(() => null);
    const url = (data as { url?: unknown } | null)?.url;
    if (response.ok && isStripeUrl(url)) {
      window.location.assign(url);
      return null;
    }
    const message = (data as { error?: { message?: unknown } } | null)?.error?.message;
    return typeof message === "string" ? message : "Something went wrong. Please try again.";
  } catch {
    return "We could not reach the server. Check your connection and try again.";
  }
}

/** One button per plan. */
export function PlanButtons({ ids }: { ids?: readonly PlanId[] }) {
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const plans = PLANS.filter((plan) => !ids || ids.includes(plan.id));

  async function choose(plan: PlanId) {
    setBusy(plan);
    setError(null);
    const problem = await goToStripe("/api/stripe/checkout", { plan });
    if (problem) {
      setError(problem);
      setBusy(null);
    } // on success the browser is leaving for Stripe
  }

  return (
    <div className="stack">
      {error ? <Alert tone="bad">{error}</Alert> : null}
      <div className="grid">
        {plans.map((plan) => (
          <div key={plan.id} className="card stack">
            <h3>{plan.name}</h3>
            <p className="muted">{plan.description}</p>
            <button type="button" className="btn" disabled={busy !== null} aria-busy={busy === plan.id || undefined} onClick={() => choose(plan.id)}>
              {busy === plan.id ? "Opening checkout…" : `Choose ${plan.name.toLowerCase()}`}
            </button>
          </div>
        ))}
      </div>
      <p className="small muted">You will pay on Stripe's secure page. We never see your card.</p>
    </div>
  );
}

/** Opens the Stripe billing portal: card, invoices, plan, cancel. */
export function PortalButton({ children = "Manage billing in Stripe", secondary = false }: { children?: React.ReactNode; secondary?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setBusy(true);
    setError(null);
    const problem = await goToStripe("/api/stripe/portal", {});
    if (problem) {
      setError(problem);
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {error ? <Alert tone="bad">{error}</Alert> : null}
      <button type="button" className={`btn${secondary ? " secondary" : ""}`} disabled={busy} aria-busy={busy || undefined} onClick={open}>
        {busy ? "Opening billing…" : children}
      </button>
    </div>
  );
}

/** "Check my payment status": ask Stripe now, instead of waiting to be told. */
export function RefreshForm() {
  const [state, formAction, pending] = useActionState(refreshBillingAction, emptyState);
  return (
    <form action={formAction} className="stack">
      <FormAlerts state={state} />
      <SubmitButton pending={pending} pendingText="Checking…" className="btn secondary">
        Check my payment status
      </SubmitButton>
    </form>
  );
}
