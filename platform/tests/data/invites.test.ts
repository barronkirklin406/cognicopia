import { describe, expect, it } from "vitest";
import type { Db } from "@/lib/data/db";
import { fromDbError } from "@/lib/data/errors";
import { acceptInvite, cancelInvite, createInvite, listInvites, previewInvite } from "@/lib/data/invites";
import { listMembers, removeMember, renameFacility, setMemberRole } from "@/lib/data/team";

/** The invitation and team functions, against a recording stand-in for the signed-in user's client. */

type Result = { data?: unknown; error?: { code?: string; message?: string } | null };

function fakeDb(result: Result) {
  const calls: [string, unknown[]][] = [];
  const settled = { data: null, error: null, ...result };
  const chain: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "then") return (resolve: (v: unknown) => void) => resolve(settled);
        return (...args: unknown[]) => {
          calls.push([prop, args]);
          return chain;
        };
      },
    },
  );
  const db = {
    from: (table: string) => {
      calls.push(["from", [table]]);
      return chain;
    },
    rpc: (name: string, args: unknown) => {
      calls.push(["rpc", [name, args]]);
      return Promise.resolve(settled);
    },
  } as unknown as Db;
  return { db, calls };
}

const SECRET = "ab".repeat(32);

describe("createInvite", () => {
  it("asks for an invitation and returns the secret", async () => {
    const { db, calls } = fakeDb({ data: SECRET });
    expect(await createInvite(db, { email: "new@example.com", role: "staff" })).toBe(SECRET);
    expect(calls).toEqual([["rpc", ["create_facility_invite", { p_email: "new@example.com", p_role: "staff" }]]]);
  });

  it("leaves the email out when there is none", async () => {
    const { db, calls } = fakeDb({ data: SECRET });
    await createInvite(db, { email: null, role: "admin" });
    expect(calls).toEqual([["rpc", ["create_facility_invite", { p_role: "admin" }]]]);
  });

  it.each([
    ["42501", 403, "forbidden"],
    ["CG002", 409, "already_member"],
    ["54000", 409, "too_many_invites"],
    ["28000", 401, "unauthenticated"],
  ])("reports %s as %i %s", async (code, status, name) => {
    const error = await createInvite(fakeDb({ error: { code, message: "x" } }).db, { email: null, role: "staff" }).catch((e: unknown) => e);
    expect(error).toMatchObject({ status, code: name });
  });

  it("refuses an answer that is not a secret", async () => {
    await expect(createInvite(fakeDb({ data: "" }).db, { email: null, role: "staff" })).rejects.toMatchObject({ status: 500 });
    await expect(createInvite(fakeDb({ data: null }).db, { email: null, role: "staff" })).rejects.toMatchObject({ status: 500 });
  });
});

describe("listInvites", () => {
  it("names its columns, so the hash of a secret is never asked for, and shows the newest first", async () => {
    const { db, calls } = fakeDb({ data: [{ id: "i1" }] });
    expect(await listInvites(db)).toEqual([{ id: "i1" }]);
    expect(calls).toContainEqual(["from", ["facility_invites"]]);
    const [, [columns]] = calls.find(([name]) => name === "select") as [string, [string]];
    expect(columns).toBe("id, email, role, created_at, expires_at, accepted_at");
    expect(columns).not.toMatch(/token|\*/);
    expect(calls).toContainEqual(["order", ["created_at", { ascending: false }]]);
  });
});

describe("cancelInvite", () => {
  it("deletes one invitation by id, and says whether it did", async () => {
    const found = fakeDb({ data: [{ id: "i1" }] });
    expect(await cancelInvite(found.db, "i1")).toBe(true);
    expect(found.calls).toContainEqual(["eq", ["id", "i1"]]);
    expect(await cancelInvite(fakeDb({ data: [] }).db, "i1")).toBe(false);
  });
});

describe("previewInvite", () => {
  it("shows what the secret is for", async () => {
    const preview = { facility_name: "Maple Court", role: "staff", email_locked: false, email_matches: true };
    const { db, calls } = fakeDb({ data: [preview] });
    expect(await previewInvite(db, SECRET)).toEqual(preview);
    expect(calls).toEqual([["rpc", ["preview_facility_invite", { p_token: SECRET }]]]);
  });

  it("is null for a secret that is unknown, used or expired", async () => {
    expect(await previewInvite(fakeDb({ data: [] }).db, SECRET)).toBeNull();
  });
});

describe("acceptInvite", () => {
  it("joins the facility and returns its id", async () => {
    const { db, calls } = fakeDb({ data: "facility-1" });
    expect(await acceptInvite(db, SECRET)).toBe("facility-1");
    expect(calls).toEqual([["rpc", ["accept_facility_invite", { p_token: SECRET }]]]);
  });

  it.each([
    ["CG004", 410, "invite_invalid"],
    ["CG005", 403, "invite_wrong_email"],
    ["CG002", 409, "already_member"],
    ["CG003", 403, "email_not_confirmed"],
    ["28000", 401, "unauthenticated"],
  ])("reports %s as %i %s", async (code, status, name) => {
    const error = await acceptInvite(fakeDb({ error: { code, message: "x" } }).db, SECRET).catch((e: unknown) => e);
    expect(error).toMatchObject({ status, code: name });
  });
});

describe("the messages for the invitation errors", () => {
  it("say what to do, in plain words, without naming a table or a function", () => {
    for (const code of ["CG004", "CG005", "54000"]) {
      const { message } = fromDbError({ code, message: "raw database text about facility_invites" });
      expect(message.length).toBeGreaterThan(20);
      expect(message).not.toMatch(/facility_invites|function|constraint|sql/i);
    }
  });
});

describe("team", () => {
  it("lists the members with the columns it needs, oldest first", async () => {
    const { db, calls } = fakeDb({ data: [{ id: "u1" }] });
    expect(await listMembers(db)).toEqual([{ id: "u1" }]);
    const [, [columns]] = calls.find(([name]) => name === "select") as [string, [string]];
    expect(columns).toBe("id, email, role, created_at");
    expect(calls).toContainEqual(["order", ["created_at", { ascending: true }]]);
  });

  it("changes a role, and says 403 when the database allowed nothing (the caller is not an admin)", async () => {
    const ok = fakeDb({ data: [{ id: "u1" }] });
    await setMemberRole(ok.db, "u1", "admin");
    expect(ok.calls).toContainEqual(["update", [{ role: "admin" }]]);
    expect(ok.calls).toContainEqual(["eq", ["id", "u1"]]);
    await expect(setMemberRole(fakeDb({ data: [] }).db, "u1", "admin")).rejects.toMatchObject({ status: 403 });
  });

  it("refuses to demote the last admin, in the database's words made plain (409)", async () => {
    const error = await setMemberRole(fakeDb({ error: { code: "CG001", message: "A facility must keep at least one admin." } }).db, "u1", "staff").catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 409, code: "last_admin" });
  });

  it("removes a member, and says 403 when nothing was allowed", async () => {
    await removeMember(fakeDb({ data: [{ id: "u1" }] }).db, "u1");
    await expect(removeMember(fakeDb({ data: [] }).db, "u1")).rejects.toMatchObject({ status: 403 });
    await expect(removeMember(fakeDb({ error: { code: "CG001" } }).db, "u1")).rejects.toMatchObject({ status: 409, code: "last_admin" });
  });

  it("renames the facility", async () => {
    const { db, calls } = fakeDb({ data: [{ id: "f1" }] });
    await renameFacility(db, "f1", "Maple Court East");
    expect(calls).toContainEqual(["update", [{ facility_name: "Maple Court East" }]]);
    await expect(renameFacility(fakeDb({ data: [] }).db, "f1", "x")).rejects.toMatchObject({ status: 403 });
    await expect(renameFacility(fakeDb({ error: { code: "23514" } }).db, "f1", " ")).rejects.toMatchObject({ status: 422 });
  });
});
