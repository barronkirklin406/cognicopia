import { describe, expect, it } from "vitest";
import type { AccessContext, FacilityBilling } from "@/lib/access/context";
import { decideApi, decidePage, landingFor } from "@/lib/access/policy";
import { SUBSCRIPTION_STATUSES, type FacilityRole, type SubscriptionStatus } from "@/lib/db/models";
import { grantsAccess } from "@/lib/domain/subscription";

const facility = (status: SubscriptionStatus): FacilityBilling => ({
  id: "f1",
  facility_name: "Maple Court",
  subscription_status: status,
  stripe_customer_id: "cus_1",
  stripe_subscription_id: "sub_1",
  subscription_interval: "year",
  subscription_current_period_end: "2027-10-06T00:00:00Z",
  subscription_cancel_at_period_end: false,
});
const member = (role: FacilityRole, status: SubscriptionStatus): AccessContext => ({
  user: { id: "u1", email: "u1@maple.example" },
  membership: { role, facility: facility(status) },
});
const noFacility: AccessContext = { user: { id: "u2", email: "u2@x.example" }, membership: null };

describe("pages: who goes where", () => {
  it("sends someone who is not signed in to sign in, remembering where they were going", () => {
    expect(decidePage(null, {}, "/library")).toEqual({ kind: "redirect", to: "/login?next=%2Flibrary" });
    expect(decidePage(null, { admin: true }, "/admin/billing")).toEqual({ kind: "redirect", to: "/login?next=%2Fadmin%2Fbilling" });
    expect(decidePage(null, {}, "/dashboard")).toEqual({ kind: "redirect", to: "/login" });
  });

  it("sends a signed-in person with no facility to set one up, whatever the page needs", () => {
    for (const need of [{}, { admin: true }, { premium: true }, { admin: true, premium: true }]) {
      expect(decidePage(noFacility, need, "/library"), JSON.stringify(need)).toEqual({ kind: "redirect", to: "/onboarding" });
    }
  });

  it("lets any member into a page that needs only a facility, whatever the subscription", () => {
    for (const role of ["admin", "staff"] as const) {
      for (const status of SUBSCRIPTION_STATUSES) expect(decidePage(member(role, status), {}, "/dashboard").kind, `${role} ${status}`).toBe("ok");
    }
  });

  it("keeps staff out of admin pages and sends them to the dashboard, with a notice", () => {
    for (const status of SUBSCRIPTION_STATUSES) {
      expect(decidePage(member("staff", status), { admin: true }, "/admin/billing")).toEqual({
        kind: "redirect",
        to: "/dashboard?notice=admins-only",
      });
      expect(decidePage(member("admin", status), { admin: true }, "/admin/billing").kind, status).toBe("ok");
    }
  });

  it("lets a premium page through only when the subscription grants access", () => {
    for (const role of ["admin", "staff"] as const) {
      for (const status of SUBSCRIPTION_STATUSES) {
        const decision = decidePage(member(role, status), { premium: true }, "/library");
        expect(decision.kind, `${role} ${status}`).toBe(grantsAccess(status) ? "ok" : "subscription_required");
      }
    }
  });

  it("a blocked premium page is not a redirect: the page shows the renewal prompt in place", () => {
    const decision = decidePage(member("staff", "past_due"), { premium: true }, "/library");
    expect(decision.kind).toBe("subscription_required");
    if (decision.kind === "subscription_required") expect(decision.ctx.membership.facility.subscription_status).toBe("past_due");
  });

  it("checks the role before the subscription: staff on an admin-only premium page are sent away, not asked to pay", () => {
    expect(decidePage(member("staff", "canceled"), { admin: true, premium: true }, "/x").kind).toBe("redirect");
  });

  it("hands the page the person and their facility", () => {
    const decision = decidePage(member("admin", "active"), {}, "/dashboard");
    expect(decision.kind).toBe("ok");
    if (decision.kind === "ok") expect(decision.ctx.membership.facility.facility_name).toBe("Maple Court");
  });
});

describe("landingFor", () => {
  it("is sign-in, then facility set-up, then the dashboard", () => {
    expect(landingFor(null)).toBe("/login");
    expect(landingFor(noFacility)).toBe("/onboarding");
    expect(landingFor(member("staff", "active"))).toBe("/dashboard");
    expect(landingFor(member("admin", "canceled"))).toBe("/dashboard");
  });
});

describe("routes: what to answer", () => {
  it("401 when no one is signed in", () => {
    expect(decideApi(null, {})).toMatchObject({ kind: "denied", status: 401, code: "unauthenticated" });
  });

  it("403 no_facility for a signed-in person who belongs to none", () => {
    expect(decideApi(noFacility, {})).toMatchObject({ kind: "denied", status: 403, code: "no_facility" });
  });

  it("403 forbidden when staff ask for an admin route", () => {
    expect(decideApi(member("staff", "active"), { admin: true })).toMatchObject({ kind: "denied", status: 403, code: "forbidden" });
    expect(decideApi(member("admin", "active"), { admin: true }).kind).toBe("ok");
  });

  it("402 subscription_required for a premium route when the subscription does not grant access, saying why", () => {
    for (const status of SUBSCRIPTION_STATUSES) {
      const asAdmin = decideApi(member("admin", status), { premium: true });
      const asStaff = decideApi(member("staff", status), { premium: true });
      if (grantsAccess(status)) {
        expect(asAdmin.kind, status).toBe("ok");
        expect(asStaff.kind, status).toBe("ok");
      } else {
        expect(asAdmin, status).toMatchObject({ kind: "denied", status: 402, code: "subscription_required", extra: { subscription_status: status, can_manage_billing: true } });
        expect(asStaff, status).toMatchObject({ kind: "denied", status: 402, code: "subscription_required", extra: { subscription_status: status, can_manage_billing: false } });
      }
    }
  });

  it("tells an admin to open billing, and staff to ask an admin", () => {
    const admin = decideApi(member("admin", "past_due"), { premium: true });
    const staff = decideApi(member("staff", "past_due"), { premium: true });
    expect(admin.kind === "denied" && admin.message).toMatch(/billing/i);
    expect(staff.kind === "denied" && staff.message).toMatch(/ask a facility admin/i);
  });

  it("passes everything a route without special needs, to any member", () => {
    for (const status of SUBSCRIPTION_STATUSES) expect(decideApi(member("staff", status), {}).kind, status).toBe("ok");
  });
});
