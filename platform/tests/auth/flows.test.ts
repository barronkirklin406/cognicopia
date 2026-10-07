import { describe, expect, it, vi } from "vitest";
import { acceptInviteFlow, createFacilityFlow, forgotPasswordFlow, resetPasswordFlow, signInFlow, signUpFlow } from "@/lib/auth/flows";
import { describeAuthError, pageError, pageNotice, teamNotice } from "@/lib/auth/messages";
import type { Db } from "@/lib/data/db";

/**
 * What each form does, with a stand-in for Supabase Auth that records what it is
 * asked. The things proved: input is checked first; the answers are ours; an
 * address's account is never confirmed or denied; "next" cannot leave the site;
 * a password never comes back; and a failure never leaks Supabase's own words.
 */

type AuthResult = { data?: unknown; error?: { code?: string; status?: number; message?: string } | null };

function fakeAuth(results: Partial<Record<"signInWithPassword" | "signUp" | "resetPasswordForEmail" | "updateUser" | "getUser", AuthResult>> = {}) {
  const fn = (name: keyof typeof results, fallback: AuthResult) => vi.fn(async (..._args: unknown[]) => ({ data: {}, error: null, ...fallback, ...(results[name] ?? {}) }));
  const auth = {
    signInWithPassword: fn("signInWithPassword", {}),
    signUp: fn("signUp", {}),
    resetPasswordForEmail: fn("resetPasswordForEmail", {}),
    updateUser: fn("updateUser", {}),
    getUser: fn("getUser", { data: { user: { id: "u1" } } }),
  };
  return { db: { auth } as unknown as Db, auth };
}

const GOOD_PASSWORD = "correct horse battery";
const APP = "https://app.cognicopia.org";

describe("signInFlow", () => {
  it("signs in with the address, trimmed and in lower case, and goes to the dashboard by default", async () => {
    const { db, auth } = fakeAuth();
    const result = await signInFlow(db, { email: "  Alice@Maple.EXAMPLE ", password: GOOD_PASSWORD, next: "" });
    expect(result).toEqual({ to: "/dashboard" });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "alice@maple.example", password: GOOD_PASSWORD });
  });

  it("goes on to where the person was headed, if that is a page on this site", async () => {
    expect(await signInFlow(fakeAuth().db, { email: "a@b.example", password: "x", next: "/library" })).toEqual({ to: "/library" });
    expect(await signInFlow(fakeAuth().db, { email: "a@b.example", password: "x", next: "/admin/billing?checkout=success" })).toEqual({ to: "/admin/billing?checkout=success" });
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/api/stripe/portal", "/auth/callback?code=1"])(
    "never goes on to %s: it goes to the dashboard",
    async (next) => {
      expect(await signInFlow(fakeAuth().db, { email: "a@b.example", password: "x", next })).toEqual({ to: "/dashboard" });
    },
  );

  it("checks the input before asking Supabase anything, and keeps the email for the form", async () => {
    const { db, auth } = fakeAuth();
    const result = await signInFlow(db, { email: "not an email", password: "", next: "" });
    expect(result).toMatchObject({ state: { fieldErrors: { email: "Enter a valid email address.", password: "Enter your password." }, values: { email: "not an email" } } });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("does not insist on today's password rules to sign in", async () => {
    const { db, auth } = fakeAuth();
    expect(await signInFlow(db, { email: "a@b.example", password: "short", next: "" })).toEqual({ to: "/dashboard" });
    expect(auth.signInWithPassword).toHaveBeenCalled();
  });

  it.each([undefined, null, 42, {}, []])("copes with a form that sent %j", async (value) => {
    expect(await signInFlow(fakeAuth().db, { email: value, password: value, next: value })).toMatchObject({ state: { fieldErrors: expect.any(Object) } });
  });

  it("says the same thing for a wrong password and an unknown address, in our own words, with no password in the answer", async () => {
    const { db } = fakeAuth({ signInWithPassword: { error: { code: "invalid_credentials", status: 400, message: "Invalid login credentials for user a@b.example" } } });
    const result = await signInFlow(db, { email: "a@b.example", password: "hunter2hunter2", next: "" });
    expect(result).toEqual({ state: { error: "The email or password is not right. Check them and try again.", values: { email: "a@b.example" } } });
    expect(JSON.stringify(result)).not.toMatch(/hunter2|Invalid login credentials/);
  });

  it("tells someone whose address is not confirmed to confirm it", async () => {
    const { db } = fakeAuth({ signInWithPassword: { error: { code: "email_not_confirmed" } } });
    const result = await signInFlow(db, { email: "a@b.example", password: "x", next: "" });
    expect(result).toMatchObject({ state: { error: expect.stringMatching(/Confirm your email/) } });
  });

  it("says when to wait, on a rate limit", async () => {
    const { db } = fakeAuth({ signInWithPassword: { error: { status: 429, message: "x" } } });
    expect(await signInFlow(db, { email: "a@b.example", password: "x", next: "" })).toMatchObject({ state: { error: expect.stringMatching(/Too many attempts/) } });
  });
});

describe("signUpFlow", () => {
  it("signs up, asks for the email link to come back through the callback, and tells the person to look in their inbox", async () => {
    const { db, auth } = fakeAuth();
    const result = await signUpFlow(db, { email: "New@Maple.example", password: GOOD_PASSWORD, next: "/onboarding" }, APP);
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "new@maple.example",
      password: GOOD_PASSWORD,
      options: { emailRedirectTo: `${APP}/auth/callback?next=%2Fonboarding` },
    });
    expect(result).toMatchObject({ state: { message: expect.stringContaining("new@maple.example") } });
    expect(result).not.toHaveProperty("to"); // not signed in until the address is confirmed
  });

  it("the link can only lead back to a page on this site", async () => {
    const { db, auth } = fakeAuth();
    await signUpFlow(db, { email: "a@b.example", password: GOOD_PASSWORD, next: "https://evil.example" }, APP);
    expect((auth.signUp.mock.calls[0]?.[0] as any).options.emailRedirectTo).toBe(`${APP}/auth/callback?next=%2Fdashboard`);
  });

  it.each([
    ["a short password", "short"],
    ["eleven characters", "elevenchars"],
    ["a password over 72 characters", "x".repeat(73)],
    ["no password", ""],
  ])("refuses %s before asking Supabase, and asks for no password back", async (_label, password) => {
    const { db, auth } = fakeAuth();
    const result = await signUpFlow(db, { email: "a@b.example", password, next: "" }, APP);
    expect(result).toMatchObject({ state: { fieldErrors: { password: expect.any(String) }, values: { email: "a@b.example" } } });
    expect(JSON.stringify(result)).not.toContain(password || "\u0000");
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("accepts a password of exactly 12 and exactly 72 characters", async () => {
    for (const password of ["x".repeat(12), "y".repeat(72)]) {
      const { db, auth } = fakeAuth();
      await signUpFlow(db, { email: "a@b.example", password, next: "" }, APP);
      expect(auth.signUp).toHaveBeenCalledTimes(1);
    }
  });

  it("gives the same answer when the address already has an account: Supabase sends no error, and nor do we", async () => {
    const fresh = await signUpFlow(fakeAuth().db, { email: "a@b.example", password: GOOD_PASSWORD, next: "" }, APP);
    const existing = await signUpFlow(fakeAuth({ signUp: { data: { user: { identities: [] } } } }).db, { email: "a@b.example", password: GOOD_PASSWORD, next: "" }, APP);
    expect(existing).toEqual(fresh);
  });

  it("explains a weak password, and a rate limit, in our words", async () => {
    expect(await signUpFlow(fakeAuth({ signUp: { error: { code: "weak_password" } } }).db, { email: "a@b.example", password: GOOD_PASSWORD, next: "" }, APP)).toMatchObject({
      state: { error: expect.stringMatching(/too weak/) },
    });
    expect(await signUpFlow(fakeAuth({ signUp: { error: { code: "over_email_send_rate_limit" } } }).db, { email: "a@b.example", password: GOOD_PASSWORD, next: "" }, APP)).toMatchObject({
      state: { error: expect.stringMatching(/Wait a few minutes/) },
    });
  });
});

describe("forgotPasswordFlow", () => {
  it("asks for a reset link that comes back through the callback to the reset page", async () => {
    const { db, auth } = fakeAuth();
    const result = await forgotPasswordFlow(db, { email: " A@B.example " }, APP);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("a@b.example", { redirectTo: `${APP}/auth/callback?next=%2Freset-password` });
    expect(result).toMatchObject({ state: { message: expect.stringMatching(/If that address has an account/) } });
  });

  it("answers the same whether or not the address has an account, and whatever Supabase says about it", async () => {
    const ok = await forgotPasswordFlow(fakeAuth().db, { email: "a@b.example" }, APP);
    for (const error of [{ code: "user_not_found", status: 400 }, { code: "email_address_invalid", status: 400 }, { status: 500 }, { code: "unexpected_failure" }]) {
      expect(await forgotPasswordFlow(fakeAuth({ resetPasswordForEmail: { error } }).db, { email: "a@b.example" }, APP), JSON.stringify(error)).toEqual(ok);
    }
  });

  it("says when to wait, on a rate limit: that does not reveal anything", async () => {
    const result = await forgotPasswordFlow(fakeAuth({ resetPasswordForEmail: { error: { status: 429 } } }).db, { email: "a@b.example" }, APP);
    expect(result).toMatchObject({ state: { error: expect.stringMatching(/Wait a few minutes/) } });
  });

  it("checks the address first", async () => {
    const { db, auth } = fakeAuth();
    expect(await forgotPasswordFlow(db, { email: "nope" }, APP)).toMatchObject({ state: { fieldErrors: { email: expect.any(String) } } });
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe("resetPasswordFlow", () => {
  it("changes the password for the person signed in by the recovery link, and goes to the dashboard with a notice", async () => {
    const { db, auth } = fakeAuth();
    expect(await resetPasswordFlow(db, { password: GOOD_PASSWORD, confirm: GOOD_PASSWORD })).toEqual({ to: "/dashboard?notice=password-updated" });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: GOOD_PASSWORD });
  });

  it("refuses two passwords that differ, or one that is too short, without asking Supabase", async () => {
    const { db, auth } = fakeAuth();
    expect(await resetPasswordFlow(db, { password: GOOD_PASSWORD, confirm: "something else entirely" })).toMatchObject({ state: { fieldErrors: { confirm: "The two passwords do not match." } } });
    expect(await resetPasswordFlow(db, { password: "short", confirm: "short" })).toMatchObject({ state: { fieldErrors: { password: expect.any(String) } } });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("refuses to change anything when no one is signed in (the link was not used, or has expired)", async () => {
    const { db, auth } = fakeAuth({ getUser: { data: { user: null } } });
    expect(await resetPasswordFlow(db, { password: GOOD_PASSWORD, confirm: GOOD_PASSWORD })).toMatchObject({ state: { error: expect.stringMatching(/session has ended/) } });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("explains a new password that is the same as the old one", async () => {
    const { db } = fakeAuth({ updateUser: { error: { code: "same_password" } } });
    expect(await resetPasswordFlow(db, { password: GOOD_PASSWORD, confirm: GOOD_PASSWORD })).toMatchObject({ state: { error: expect.stringMatching(/different from your current/) } });
  });

  it("never puts a password in what it hands back", async () => {
    const result = await resetPasswordFlow(fakeAuth().db, { password: GOOD_PASSWORD, confirm: "mismatch mismatch" });
    expect(JSON.stringify(result)).not.toContain(GOOD_PASSWORD);
  });
});

// ---------------------------------------------------------------------

/** A stand-in for the signed-in user's database client, for the two flows that call the database. */
function rpcDb(result: { data?: unknown; error?: { code?: string; message?: string } | null }) {
  const rpc = vi.fn(async (..._args: unknown[]) => ({ data: null, error: null, ...result }));
  return { db: { rpc } as unknown as Db, rpc };
}

describe("createFacilityFlow", () => {
  it("creates the facility, and sends its new admin to choose a plan", async () => {
    const { db, rpc } = rpcDb({ data: "facility-1" });
    expect(await createFacilityFlow(db, { facility_name: "  Maple Court  " })).toEqual({ to: "/admin/billing?welcome=1" });
    expect(rpc).toHaveBeenCalledWith("create_facility", { p_facility_name: "Maple Court" });
  });

  it.each(["", "   ", "x".repeat(121), undefined, 7])("refuses the name %j before asking the database", async (name) => {
    const { db, rpc } = rpcDb({ data: "x" });
    expect(await createFacilityFlow(db, { facility_name: name })).toMatchObject({ state: { fieldErrors: { facility_name: expect.any(String) } } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends someone who already has a facility to the dashboard, not an error", async () => {
    expect(await createFacilityFlow(rpcDb({ error: { code: "CG002" } }).db, { facility_name: "Maple" })).toEqual({ to: "/dashboard" });
  });

  it("asks someone whose email is not confirmed to confirm it", async () => {
    expect(await createFacilityFlow(rpcDb({ error: { code: "CG003" } }).db, { facility_name: "Maple" })).toMatchObject({
      state: { error: expect.stringMatching(/Confirm your email/), values: { facility_name: "Maple" } },
    });
  });

  it("keeps what was typed, and says nothing technical, when something unexpected fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await createFacilityFlow(rpcDb({ error: { code: "XX000", message: "relation facilities is broken" } }).db, { facility_name: "Maple" });
    expect(result).toEqual({ state: { error: "Something went wrong.", values: { facility_name: "Maple" } } });
  });
});

describe("acceptInviteFlow", () => {
  const TOKEN = "cd".repeat(32);

  it("joins the facility, and goes to the dashboard with a notice", async () => {
    const { db, rpc } = rpcDb({ data: "facility-1" });
    expect(await acceptInviteFlow(db, { token: ` ${TOKEN} ` })).toEqual({ to: "/dashboard?notice=joined" });
    expect(rpc).toHaveBeenCalledWith("accept_facility_invite", { p_token: TOKEN });
  });

  it.each(["", "abc", "A".repeat(64), undefined, null, 7])("refuses a link that is not one (%j), without asking the database", async (token) => {
    const { db, rpc } = rpcDb({ data: "x" });
    expect(await acceptInviteFlow(db, { token })).toMatchObject({ state: { error: expect.stringMatching(/not valid/) } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["CG004", /no longer valid/],
    ["CG005", /different email address/],
    ["CG002", /already belongs to a facility/],
    ["CG003", /Confirm your email/],
  ])("explains %s in plain words", async (code, message) => {
    expect(await acceptInviteFlow(rpcDb({ error: { code } }).db, { token: TOKEN })).toMatchObject({ state: { error: expect.stringMatching(message) } });
  });
});

describe("what a page may show from the address bar", () => {
  it("only wording of ours, looked up by a fixed key", () => {
    expect(pageError("callback")).toMatch(/could not be used in this browser/);
    expect(pageError("callback")).toMatch(/try signing in/);
    expect(pageError("link_expired")).toMatch(/expired/);
    expect(pageNotice("admins-only")).toMatch(/admins/);
    expect(pageNotice("joined")).toMatch(/joined/);
    expect(pageNotice("password-updated")).toMatch(/password/);
    expect(teamNotice("invite-cancelled")).toMatch(/no longer works/);
    expect(teamNotice("member-removed")).toMatch(/removed/);
  });

  it("each page has its own list: a team notice means nothing on the sign-in page, and the other way round", () => {
    expect(pageNotice("invite-cancelled")).toBeNull();
    expect(pageNotice("member-removed")).toBeNull();
    expect(teamNotice("admins-only")).toBeNull();
    expect(teamNotice("joined")).toBeNull();
  });

  it("an unknown key shows nothing, and text from the address never appears", () => {
    for (const key of ["<script>alert(1)</script>", "", "unknown", undefined, null, 7, ["callback"], { callback: 1 }]) {
      expect(pageError(key), String(key)).toBeNull();
      expect(pageNotice(key), String(key)).toBeNull();
      expect(teamNotice(key), String(key)).toBeNull();
    }
  });

  it("a key the list merely inherits finds nothing either", () => {
    for (const key of ["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf"]) {
      expect(pageError(key), key).toBeNull();
      expect(pageNotice(key), key).toBeNull();
      expect(teamNotice(key), key).toBeNull();
    }
  });
});

describe("describeAuthError", () => {
  it("is generic about anything it does not know, and never repeats Supabase's message", () => {
    const failure = describeAuthError({ code: "some_new_code", message: "User a@b.example not found in table auth.users" });
    expect(failure.message).toBe("Something went wrong. Please try again.");
    expect(JSON.stringify(failure)).not.toMatch(/auth\.users|a@b/);
  });

  it("copes with nothing at all", () => {
    expect(describeAuthError(null).message).toMatch(/Something went wrong/);
    expect(describeAuthError({}).code).toBe("unknown");
  });
});
