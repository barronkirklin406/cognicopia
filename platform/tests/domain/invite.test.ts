import { describe, expect, it } from "vitest";
import { CreateInviteSchema, InviteTokenSchema, inviteLink, inviteState } from "@/lib/domain/invite";

describe("CreateInviteSchema", () => {
  it("takes an email, trimmed and in lower case, and a role", () => {
    expect(CreateInviteSchema.parse({ email: "  New.Person@Example.COM ", role: "staff" })).toEqual({ email: "new.person@example.com", role: "staff" });
  });

  it("an empty email means an invitation not tied to an address", () => {
    expect(CreateInviteSchema.parse({ email: "", role: "admin" })).toEqual({ email: null, role: "admin" });
    expect(CreateInviteSchema.parse({ email: "   ", role: "staff" })).toEqual({ email: null, role: "staff" });
  });

  it.each(["not-an-email", "two@@x.example", "spa ce@x.example", "@x.example", "a@", `${"a".repeat(250)}@x.example`])("refuses the email %j", (email) => {
    expect(CreateInviteSchema.safeParse({ email, role: "staff" }).success).toBe(false);
  });

  it.each(["owner", "", "ADMIN", null, undefined, 7])("refuses the role %j", (role) => {
    expect(CreateInviteSchema.safeParse({ email: "", role }).success).toBe(false);
  });

  it("offers only the two roles there are", () => {
    for (const role of ["admin", "staff"]) expect(CreateInviteSchema.safeParse({ email: "", role }).success).toBe(true);
  });
});

describe("InviteTokenSchema", () => {
  it("accepts the secret a link carries, even with spaces or a newline around it", () => {
    const token = "0123456789abcdef".repeat(4);
    expect(InviteTokenSchema.parse(token)).toBe(token);
    expect(InviteTokenSchema.parse(`  ${token}\n`)).toBe(token);
  });

  it.each(["", "abc", "A".repeat(64), "g".repeat(64), "a".repeat(63), "a".repeat(65), "a".repeat(32) + " " + "a".repeat(31), null, undefined, 7])("refuses %j", (value) => {
    expect(InviteTokenSchema.safeParse(value).success).toBe(false);
  });
});

describe("inviteLink", () => {
  it("is the app's address and the secret, and nothing else", () => {
    const token = "ab".repeat(32);
    expect(inviteLink("https://app.cognicopia.org", token)).toBe(`https://app.cognicopia.org/join?token=${token}`);
  });
});

describe("inviteState", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("is open until it expires, used once accepted, and expired after", () => {
    expect(inviteState({ accepted_at: null, expires_at: "2026-10-12T00:00:00Z" }, now)).toBe("open");
    expect(inviteState({ accepted_at: null, expires_at: "2026-10-10T11:59:59Z" }, now)).toBe("expired");
    expect(inviteState({ accepted_at: null, expires_at: "2026-10-10T12:00:00Z" }, now)).toBe("expired");
    expect(inviteState({ accepted_at: "2026-10-09T00:00:00Z", expires_at: "2026-10-12T00:00:00Z" }, now)).toBe("used");
    expect(inviteState({ accepted_at: "2026-10-09T00:00:00Z", expires_at: "2026-10-01T00:00:00Z" }, now)).toBe("used"); // used wins
  });
});
