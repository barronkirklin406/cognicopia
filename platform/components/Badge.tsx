import type { SubscriptionSummary } from "@/lib/domain/subscription";

/** A short label with a tone. The words carry the meaning; the colour only adds to it. */
export function Badge({ tone = "neutral", children }: { tone?: SubscriptionSummary["tone"]; children: React.ReactNode }) {
  return <span className={`badge ${tone === "neutral" ? "" : tone}`.trim()}>{children}</span>;
}
