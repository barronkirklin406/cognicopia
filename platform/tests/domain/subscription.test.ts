import { describe, expect, it } from "vitest";
import { SUBSCRIPTION_STATUSES } from "@/lib/db/models";
import { ACCESS_STATUSES, canStartCheckout, formatDate, grantsAccess, periodLine, summarize } from "@/lib/domain/subscription";

describe("grantsAccess", () => {
  it.each([
    ["trialing", true],
    ["active", true],
    ["past_due", false],
    ["unpaid", false],
    ["canceled", false],
    ["paused", false],
    ["incomplete", false],
    ["incomplete_expired", false],
  ] as const)("%s -> %s", (status, expected) => {
    expect(grantsAccess(status)).toBe(expected);
  });

  it("covers every status Stripe has, and exactly the two that open the tools", () => {
    expect(SUBSCRIPTION_STATUSES.filter(grantsAccess).sort()).toEqual([...ACCESS_STATUSES].sort());
  });
});

describe("canStartCheckout", () => {
  it("is only for a facility with no live subscription: a second one would bill it twice", () => {
    expect(SUBSCRIPTION_STATUSES.filter(canStartCheckout).sort()).toEqual(["canceled", "incomplete", "incomplete_expired"]);
  });

  it("is never true for a status that grants access, or for one in trouble (those use the portal)", () => {
    for (const status of ["trialing", "active", "past_due", "unpaid", "paused"] as const) expect(canStartCheckout(status), status).toBe(false);
  });
});

describe("summarize: what to tell a facility", () => {
  it.each(SUBSCRIPTION_STATUSES)("%s has a label, a headline and plain advice", (status) => {
    const s = summarize(status);
    expect(s.label.length).toBeGreaterThan(0);
    expect(s.headline.length).toBeGreaterThan(5);
    expect(s.detail.length).toBeGreaterThan(10);
    expect(["good", "warn", "bad", "neutral"]).toContain(s.tone);
  });

  it("asks for nothing when access is granted, and always says what to do otherwise", () => {
    for (const status of SUBSCRIPTION_STATUSES) {
      expect(summarize(status).nextStep === "none", status).toBe(grantsAccess(status));
    }
  });

  it("sends a failed payment to the portal, and an ended or missing subscription to the plans", () => {
    for (const status of ["past_due", "unpaid", "paused"] as const) expect(summarize(status).nextStep, status).toBe("update_payment");
    for (const status of ["canceled", "incomplete", "incomplete_expired"] as const) expect(summarize(status).nextStep, status).toBe("choose_plan");
  });

  it("the way back matches how a new subscription can start: choosing a plan is possible exactly when Checkout is", () => {
    for (const status of SUBSCRIPTION_STATUSES) {
      expect(summarize(status).nextStep === "choose_plan", status).toBe(canStartCheckout(status));
    }
  });

  it("reassures a lapsed facility that its team and saved calendars are safe", () => {
    for (const status of ["past_due", "unpaid", "canceled"] as const) expect(summarize(status).detail).toMatch(/team and your saved calendars/);
  });

  it("never blames the facility", () => {
    for (const status of SUBSCRIPTION_STATUSES) expect(summarize(status).detail, status).not.toMatch(/\b(you failed|your fault|delinquent|default)\b/i);
  });
});

describe("formatDate", () => {
  it("writes a date in words, in UTC so the day never slips with the reader's time zone", () => {
    expect(formatDate("2027-10-06T00:00:00Z")).toBe("October 6, 2027");
    expect(formatDate("2027-10-06T23:59:59Z")).toBe("October 6, 2027");
    expect(formatDate("2027-01-01T00:30:00+05:00")).toBe("December 31, 2026");
  });

  it.each([null, undefined, "", "not a date"])("is null for %j", (value) => {
    expect(formatDate(value)).toBeNull();
  });
});

describe("periodLine", () => {
  const base = { currentPeriodEnd: "2027-10-06T12:00:00Z", cancelAtPeriodEnd: false, interval: "year" as string | null };

  it("says when an active plan renews, naming the plan", () => {
    expect(periodLine({ ...base, status: "active" })).toBe("Annual plan. Renews on October 6, 2027.");
    expect(periodLine({ ...base, status: "active", interval: "month" })).toBe("Monthly plan. Renews on October 6, 2027.");
    expect(periodLine({ ...base, status: "active", interval: null })).toBe("Plan. Renews on October 6, 2027.");
  });

  it("says when access ends, if the subscription is set to end", () => {
    expect(periodLine({ ...base, status: "active", cancelAtPeriodEnd: true })).toBe(
      "Your subscription ends on October 6, 2027. You keep full access until then.",
    );
  });

  it("says when a trial ends", () => {
    expect(periodLine({ ...base, status: "trialing" })).toBe("The trial ends on October 6, 2027.");
  });

  it("says nothing without a date, or when the facility is not subscribed", () => {
    expect(periodLine({ ...base, status: "active", currentPeriodEnd: null })).toBeNull();
    for (const status of ["past_due", "canceled", "incomplete"] as const) expect(periodLine({ ...base, status })).toBeNull();
  });
});
