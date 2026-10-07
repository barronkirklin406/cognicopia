import { describe, expect, it } from "vitest";
import { isProtectedPath, isSignedOutOnly, loginPath, safeNext } from "@/lib/auth/paths";

describe("safeNext: where sign-in may lead", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/library", "/library"],
    ["/calendar?month=2026-10", "/calendar?month=2026-10"],
    ["/admin/billing?checkout=success", "/admin/billing?checkout=success"],
    ["/join?token=" + "a".repeat(64), "/join?token=" + "a".repeat(64)],
    ["/library#top", "/library"], // the fragment is not for the server
  ])("keeps the path %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    ["another site", "https://evil.example/phish"],
    ["a protocol-relative address", "//evil.example/phish"],
    ["a backslash trick", "/\\evil.example"],
    ["a backslash trick, doubled", "\\\\evil.example"],
    ["a slash then backslash", "/\\/evil.example"],
    ["a script", "javascript:alert(1)"],
    ["a data address", "data:text/html,<script>alert(1)</script>"],
    ["a tab inside the slashes", "/\t/evil.example"],
    ["a newline", "/dashboard\nSet-Cookie: x=1"],
    ["a carriage return", "/dashboard\r\nLocation: https://evil.example"],
    ["a null byte", "/dashboard\u0000"],
    ["no leading slash", "dashboard"],
    ["an empty string", ""],
    ["an API route", "/api/stripe/portal"],
    ["the API root", "/api"],
    ["the auth callback", "/auth/callback?code=1"],
    ["something very long", "/" + "a".repeat(600)],
  ])("falls back to the dashboard for %s", (_label, input) => {
    expect(safeNext(input)).toBe("/dashboard");
  });

  it.each([null, undefined])("falls back for %s", (input) => {
    expect(safeNext(input)).toBe("/dashboard");
  });

  it("uses the fallback it is given", () => {
    expect(safeNext("https://evil.example", "/onboarding")).toBe("/onboarding");
  });

  it("does not let an encoded slash or dot-dot climb out of the site", () => {
    // These stay on this site whatever a browser does with them.
    for (const input of ["/%2F/evil.example", "/%2Fevil.example", "/../../evil.example", "/library/../../evil.example"]) {
      const result = safeNext(input);
      expect(result.startsWith("/"), input).toBe(true);
      expect(result.startsWith("//"), input).toBe(false);
    }
  });

  it("every result is a path on this site", () => {
    const attempts = ["/a", "//a", "/\\a", "https://a", "/a?b=https://c", "/a/%2e%2e/b", "/ ", "/%00"];
    for (const input of attempts) {
      const url = new URL(safeNext(input), "https://app.example");
      expect(url.origin, input).toBe("https://app.example");
    }
  });
});

describe("loginPath", () => {
  it("is the plain sign-in page when there is nowhere to go back to", () => {
    expect(loginPath()).toBe("/login");
    expect(loginPath("/dashboard")).toBe("/login");
  });

  it("remembers where the person was going, encoded", () => {
    expect(loginPath("/library")).toBe("/login?next=%2Flibrary");
    expect(loginPath("/calendar?month=2026-10")).toBe("/login?next=%2Fcalendar%3Fmonth%3D2026-10");
  });

  it("will not remember an unsafe place", () => {
    expect(loginPath("https://evil.example")).toBe("/login");
    expect(loginPath("//evil.example")).toBe("/login");
    expect(loginPath("/api/stripe/portal")).toBe("/login");
  });
});

describe("which pages need a signed-in person", () => {
  it.each(["/dashboard", "/dashboard/anything", "/onboarding", "/admin", "/admin/billing", "/admin/team", "/library", "/calendar", "/calendar/2026-10"])(
    "%s does",
    (path) => expect(isProtectedPath(path)).toBe(true),
  );

  it.each(["/", "/login", "/signup", "/forgot-password", "/reset-password", "/join", "/auth/callback", "/api/stripe/webhook", "/administrator", "/libraryx", "/calendars"])(
    "%s does not",
    (path) => expect(isProtectedPath(path)).toBe(false),
  );

  it("the sign-in pages are for people who are signed out", () => {
    for (const path of ["/", "/login", "/signup", "/forgot-password"]) expect(isSignedOutOnly(path), path).toBe(true);
    for (const path of ["/dashboard", "/join", "/reset-password", "/auth/callback"]) expect(isSignedOutOnly(path), path).toBe(false);
  });

  it("a person with a recovery or invitation link is not bounced away", () => {
    // /reset-password and /join are reached WITH a session, so they must not be 'signed out only'.
    expect(isSignedOutOnly("/reset-password")).toBe(false);
    expect(isSignedOutOnly("/join")).toBe(false);
  });
});
