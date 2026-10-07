import { describe, expect, it } from "vitest";
import { loadAccessContext, toFacilityBilling } from "@/lib/access/context";
import type { Db } from "@/lib/data/db";
import { DataError } from "@/lib/data/errors";

/** A stand-in for the Supabase client: who the session belongs to, and the one membership row. */
function fakeDb(options: {
  user?: { id: string; email?: string | null } | null;
  authError?: boolean;
  row?: unknown;
  dbError?: { code: string; message: string };
}) {
  const calls: [string, unknown[]][] = [];
  const chain: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop: string) {
        return (...args: unknown[]) => {
          calls.push([prop, args]);
          if (prop === "maybeSingle") return Promise.resolve({ data: options.row ?? null, error: options.dbError ?? null });
          return chain;
        };
      },
    },
  );
  const db = {
    auth: {
      getUser: async () =>
        options.user && !options.authError
          ? { data: { user: options.user }, error: null }
          : { data: { user: null }, error: options.authError ? { message: "invalid jwt" } : null },
    },
    from: (table: string) => {
      calls.push(["from", [table]]);
      return chain;
    },
  } as unknown as Db;
  return { db, calls };
}

const facility = {
  id: "f1",
  facility_name: "Maple Court",
  subscription_status: "active",
  stripe_customer_id: "cus_1",
  stripe_subscription_id: "sub_1",
  subscription_interval: "year",
  subscription_current_period_end: "2027-10-06T00:00:00Z",
  subscription_cancel_at_period_end: false,
};

describe("loadAccessContext", () => {
  it("is null when no one is signed in, and reads nothing from the database", async () => {
    const { db, calls } = fakeDb({ user: null });
    expect(await loadAccessContext(db)).toBeNull();
    expect(calls).toEqual([]);
  });

  it("is null when Supabase Auth refuses the session", async () => {
    expect(await loadAccessContext(fakeDb({ user: { id: "u1" }, authError: true }).db)).toBeNull();
  });

  it("asks Supabase Auth, not the cookie, who this is, then reads the membership and facility in one query", async () => {
    const { db, calls } = fakeDb({ user: { id: "u1", email: "a@maple.example" }, row: { role: "admin", facility } });
    const ctx = await loadAccessContext(db);
    expect(ctx).toEqual({ user: { id: "u1", email: "a@maple.example" }, membership: { role: "admin", facility } });
    expect(calls.filter(([name]) => name === "from")).toEqual([["from", ["facility_users"]]]);
    expect(calls).toContainEqual(["eq", ["id", "u1"]]);
    const [, [columns]] = calls.find(([name]) => name === "select") as [string, [string]];
    expect(columns).toMatch(/facility:facilities\(.*subscription_status.*stripe_customer_id/);
    expect(columns).not.toMatch(/token|password|secret/i);
  });

  it("has no membership for a signed-in person who belongs to no facility", async () => {
    const ctx = await loadAccessContext(fakeDb({ user: { id: "u2", email: "b@x.example" }, row: null }).db);
    expect(ctx).toEqual({ user: { id: "u2", email: "b@x.example" }, membership: null });
  });

  it("copes with an account that has no email", async () => {
    const ctx = await loadAccessContext(fakeDb({ user: { id: "u3" }, row: null }).db);
    expect(ctx?.user.email).toBeNull();
  });

  it("accepts the facility as a one-element list", async () => {
    const ctx = await loadAccessContext(fakeDb({ user: { id: "u1" }, row: { role: "staff", facility: [facility] } }).db);
    expect(ctx?.membership?.facility.facility_name).toBe("Maple Court");
  });

  it("treats a membership whose facility cannot be read as no facility", async () => {
    const ctx = await loadAccessContext(fakeDb({ user: { id: "u1" }, row: { role: "staff", facility: null } }).db);
    expect(ctx?.membership).toBeNull();
  });

  it("reports a database failure as a DataError, without its message", async () => {
    const { db } = fakeDb({ user: { id: "u1" }, dbError: { code: "42501", message: "permission denied for table facility_users" } });
    await expect(loadAccessContext(db)).rejects.toBeInstanceOf(DataError);
    await expect(loadAccessContext(db)).rejects.toMatchObject({ status: 403 });
  });
});

describe("toFacilityBilling", () => {
  it("keeps the billing view of a facility row and nothing else", () => {
    const row = {
      id: "f1",
      facility_name: "Maple Court",
      subscription_status: "past_due",
      stripe_customer_id: "cus_1",
      stripe_subscription_id: "sub_1",
      subscription_interval: "year",
      subscription_current_period_end: "2027-01-01T00:00:00Z",
      subscription_cancel_at_period_end: true,
      subscription_synced_at: "2026-10-06T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
    } as const;
    expect(toFacilityBilling(row)).toEqual({
      id: "f1",
      facility_name: "Maple Court",
      subscription_status: "past_due",
      stripe_customer_id: "cus_1",
      stripe_subscription_id: "sub_1",
      subscription_interval: "year",
      subscription_current_period_end: "2027-01-01T00:00:00Z",
      subscription_cancel_at_period_end: true,
    });
  });
});
