import { describe, expect, it, vi } from "vitest";
import { cancelInviteFlow, changeRoleFlow, inviteFlow, refreshBillingFlow, removeMemberFlow, renameFacilityFlow } from "@/lib/admin/flows";
import type { Db } from "@/lib/data/db";

/** What the admin pages' forms do, with recording stand-ins for the signed-in user's database client and for Stripe. */

type Result = { data?: unknown; error?: { code?: string; message?: string } | null };

function fakeDb(result: Result) {
  const calls: [string, unknown[]][] = [];
  const settled = { data: null, error: null, ...result };
  const chain: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "then") return (resolve: (v: unknown) => void) => resolve(settled);
        return (...args: unknown[]) => {
          calls.push([prop, args]);
          return chain;
        };
      },
    },
  );
  return {
    calls,
    db: {
      from: (table: string) => {
        calls.push(["from", [table]]);
        return chain;
      },
      rpc: (name: string, args: unknown) => {
        calls.push(["rpc", [name, args]]);
        return Promise.resolve(settled);
      },
    } as unknown as Db,
  };
}

const APP = "https://app.cognicopia.org";
const SECRET = "ab".repeat(32);
const UUID = "5c6a0000-0000-4000-8000-0000000000aa";

describe("inviteFlow", () => {
  it("makes an invitation and hands back the link to share, once", async () => {
    const { db, calls } = fakeDb({ data: SECRET });
    const result = await inviteFlow(db, { email: " New@Maple.example ", role: "staff" }, APP);
    expect(calls).toEqual([["rpc", ["create_facility_invite", { p_email: "new@maple.example", p_role: "staff" }]]]);
    expect(result).toEqual({
      state: {
        message: "Invitation created. Share this link with the person; it works once and lasts 7 days. It only works for new@maple.example.",
        link: `${APP}/join?token=${SECRET}`,
      },
    });
  });

  it("makes one tied to no address when the email is left empty", async () => {
    const { db, calls } = fakeDb({ data: SECRET });
    const result = await inviteFlow(db, { email: "", role: "admin" }, APP);
    expect(calls).toEqual([["rpc", ["create_facility_invite", { p_role: "admin" }]]]);
    expect(result).toMatchObject({ state: { link: `${APP}/join?token=${SECRET}` } });
    expect(JSON.stringify(result)).not.toMatch(/only works for/);
  });

  it("checks the email and role before asking the database", async () => {
    const { db, calls } = fakeDb({ data: SECRET });
    expect(await inviteFlow(db, { email: "not an email", role: "staff" }, APP)).toMatchObject({
      state: { fieldErrors: { email: expect.any(String) }, values: { email: "not an email" } },
    });
    expect(await inviteFlow(db, { email: "", role: "owner" }, APP)).toMatchObject({ state: { fieldErrors: { role: expect.any(String) } } });
    expect(calls).toEqual([]);
  });

  it("says in plain words when the person is already on the team, and when there are too many open invitations", async () => {
    expect(await inviteFlow(fakeDb({ error: { code: "CG002" } }).db, { email: "bob@maple.example", role: "staff" }, APP)).toMatchObject({
      state: { error: "That person is already on your team." },
    });
    expect(await inviteFlow(fakeDb({ error: { code: "54000" } }).db, { email: "", role: "staff" }, APP)).toMatchObject({
      state: { error: expect.stringMatching(/too many open invitations/) },
    });
  });

  it("shows no link when it failed", async () => {
    const result = await inviteFlow(fakeDb({ error: { code: "42501" } }).db, { email: "", role: "staff" }, APP);
    expect(result).toMatchObject({ state: { error: expect.any(String) } });
    expect(JSON.stringify(result)).not.toMatch(/join\?token/);
  });

  it.each([undefined, null, 7, {}])("copes with a form that sent %j", async (value) => {
    expect(await inviteFlow(fakeDb({ data: SECRET }).db, { email: value, role: value }, APP)).toMatchObject({ state: { error: expect.any(String) } });
  });
});

describe("cancelInviteFlow", () => {
  it("cancels an open invitation", async () => {
    const { db, calls } = fakeDb({ data: [{ id: UUID }] });
    expect(await cancelInviteFlow(db, { id: UUID })).toMatchObject({ state: { message: expect.stringMatching(/no longer works/) } });
    expect(calls).toContainEqual(["eq", ["id", UUID]]);
  });

  it("says so when there was nothing to cancel (already used), and refuses an id that is not one", async () => {
    expect(await cancelInviteFlow(fakeDb({ data: [] }).db, { id: UUID })).toMatchObject({ state: { error: expect.stringMatching(/already have been used/) } });
    const { db, calls } = fakeDb({ data: [] });
    expect(await cancelInviteFlow(db, { id: "'; drop table facility_invites; --" })).toMatchObject({ state: { error: expect.any(String) } });
    expect(calls).toEqual([]);
  });
});

describe("changeRoleFlow", () => {
  it("promotes and demotes", async () => {
    expect(await changeRoleFlow(fakeDb({ data: [{ id: UUID }] }).db, { id: UUID, role: "admin" })).toEqual({ state: { message: "They are now an admin." } });
    expect(await changeRoleFlow(fakeDb({ data: [{ id: UUID }] }).db, { id: UUID, role: "staff" })).toEqual({ state: { message: "They are now staff." } });
  });

  it("explains that a facility must keep an admin, in the database's words made plain", async () => {
    expect(await changeRoleFlow(fakeDb({ error: { code: "CG001" } }).db, { id: UUID, role: "staff" })).toMatchObject({
      state: { error: expect.stringMatching(/at least one admin/) },
    });
  });

  it("refuses a role that does not exist, or an id that is not one, without asking the database", async () => {
    const { db, calls } = fakeDb({ data: [{ id: UUID }] });
    expect(await changeRoleFlow(db, { id: UUID, role: "owner" })).toMatchObject({ state: { error: expect.any(String) } });
    expect(await changeRoleFlow(db, { id: "abc", role: "admin" })).toMatchObject({ state: { error: expect.any(String) } });
    expect(calls).toEqual([]);
  });

  it("says no when the database allowed nothing (the caller is not an admin)", async () => {
    expect(await changeRoleFlow(fakeDb({ data: [] }).db, { id: UUID, role: "admin" })).toMatchObject({ state: { error: expect.stringMatching(/do not have access/) } });
  });
});

describe("removeMemberFlow", () => {
  it("removes a member", async () => {
    expect(await removeMemberFlow(fakeDb({ data: [{ id: UUID }] }).db, { id: UUID })).toMatchObject({ state: { message: expect.stringMatching(/removed/) } });
  });

  it("will not remove the last admin", async () => {
    expect(await removeMemberFlow(fakeDb({ error: { code: "CG001" } }).db, { id: UUID })).toMatchObject({ state: { error: expect.stringMatching(/at least one admin/) } });
  });

  it("refuses an id that is not one", async () => {
    const { db, calls } = fakeDb({ data: [] });
    expect(await removeMemberFlow(db, { id: 42 })).toMatchObject({ state: { error: expect.any(String) } });
    expect(calls).toEqual([]);
  });
});

describe("renameFacilityFlow", () => {
  it("renames the facility, trimmed, and shows the new name", async () => {
    const { db, calls } = fakeDb({ data: [{ id: "f1" }] });
    expect(await renameFacilityFlow(db, { facility_name: "  Maple Court East " }, "f1")).toEqual({
      state: { message: "The facility's name has been updated.", values: { facility_name: "Maple Court East" } },
    });
    expect(calls).toContainEqual(["update", [{ facility_name: "Maple Court East" }]]);
    expect(calls).toContainEqual(["eq", ["id", "f1"]]);
  });

  it.each(["", "   ", "x".repeat(121), undefined, 5])("refuses the name %j without asking the database", async (name) => {
    const { db, calls } = fakeDb({ data: [{ id: "f1" }] });
    expect(await renameFacilityFlow(db, { facility_name: name }, "f1")).toMatchObject({ state: { fieldErrors: { facility_name: expect.any(String) } } });
    expect(calls).toEqual([]);
  });
});

describe("refreshBillingFlow", () => {
  const stripeWith = (list: ReturnType<typeof vi.fn>) => ({ subscriptions: { list } }) as never;
  const sub = { id: "sub_1", status: "active", created: 1, customer: "cus_1", cancel_at_period_end: false, items: { data: [] } };

  it("checks Stripe and reports that the status is up to date", async () => {
    const list = vi.fn(async () => ({ data: [sub] }));
    const rpc = vi.fn(async () => ({ data: "applied", error: null }));
    const result = await refreshBillingFlow({ stripe: stripeWith(list), admin: { rpc } as unknown as Db }, { stripe_customer_id: "cus_1" });
    expect(result).toMatchObject({ state: { message: expect.stringMatching(/up to date/) } });
    expect(list).toHaveBeenCalledWith({ customer: "cus_1", status: "all", limit: 20 });
  });

  it("says there is nothing to check for a facility that has never started a subscription, without calling Stripe", async () => {
    const list = vi.fn();
    const result = await refreshBillingFlow({ stripe: stripeWith(list), admin: {} as Db }, { stripe_customer_id: null });
    expect(result).toMatchObject({ state: { message: expect.stringMatching(/nothing to check/) } });
    expect(list).not.toHaveBeenCalled();
  });

  it("explains an unlinked billing account, and a Stripe outage, without technical words", async () => {
    const rpc = vi.fn(async () => ({ data: "unlinked", error: null }));
    const list = vi.fn(async () => ({ data: [sub] }));
    expect(await refreshBillingFlow({ stripe: stripeWith(list), admin: { rpc } as unknown as Db }, { stripe_customer_id: "cus_1" })).toMatchObject({
      state: { error: expect.stringMatching(/contact support/) },
    });

    const down = vi.fn(async () => {
      throw Object.assign(new Error("connect ECONNREFUSED 1.2.3.4:443"), { type: "StripeConnectionError" });
    });
    const outage = await refreshBillingFlow({ stripe: stripeWith(down), admin: {} as Db }, { stripe_customer_id: "cus_1" });
    expect(outage).toEqual({ state: { error: "We could not reach the billing service. Try again in a moment." } });
    expect(JSON.stringify(outage)).not.toMatch(/ECONNREFUSED|1\.2\.3\.4/);
  });
});
