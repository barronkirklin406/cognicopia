import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The proxy: it renews a session that is about to expire, and turns away (politely)
 * people who are not signed in. A stand-in for Supabase's server client lets each
 * test decide what the token check says, and whether it renews the session.
 */

const getClaims = vi.fn();
let cookieHandlers: { getAll: () => { name: string; value: string }[]; setAll: (c: any[], h: Record<string, string>) => void } | undefined;
const createServerClient = vi.fn((_url: string, _key: string, options: { cookies: typeof cookieHandlers }) => {
  cookieHandlers = options.cookies;
  return { auth: { getClaims } };
});
vi.mock("@supabase/ssr", () => ({ createServerClient: (...args: unknown[]) => (createServerClient as any)(...args) }));

const { proxy, config } = await import("@/proxy");

const SESSION = "sb-abcdefgh-auth-token=base64-session-value";
const request = (path: string, cookie?: string) => new NextRequest(`https://app.example${path}`, cookie ? { headers: { cookie } } : undefined);
const location = (response: Response) => response.headers.get("location");
const signedIn = () => getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } }, error: null });
const signedOut = () => getClaims.mockResolvedValue({ data: null, error: { message: "invalid jwt" } });

beforeEach(() => {
  vi.resetAllMocks();
  createServerClient.mockImplementation((_url, _key, options) => {
    cookieHandlers = options.cookies;
    return { auth: { getClaims } };
  });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
});
afterEach(() => vi.unstubAllEnvs());

describe("no session cookie", () => {
  it.each(["/dashboard", "/library", "/calendar", "/calendar/generate", "/reminiscence", "/admin", "/admin/billing", "/onboarding"])("%s goes to sign in, and never asks Supabase anything", async (path) => {
    const response = await proxy(request(path));
    expect(response.status).toBe(307);
    expect(location(response)).toBe(`https://app.example/login${path === "/dashboard" ? "" : `?next=${encodeURIComponent(path)}`}`);
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("remembers the query too, so a person comes back to exactly where they were headed", async () => {
    expect(location(await proxy(request("/calendar?month=2026-10")))).toBe("https://app.example/login?next=%2Fcalendar%3Fmonth%3D2026-10");
  });

  it.each(["/", "/login", "/signup", "/forgot-password", "/reset-password", "/join", "/auth/callback"])("%s is open to anyone, and is simply let through", async (path) => {
    const response = await proxy(request(path));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("a cookie that is not a session (a code verifier, an unrelated one) is not a session", async () => {
    for (const cookie of ["sb-abcdefgh-auth-token-code-verifier=xyz", "theme=dark", "sb-abc-refresh=1", "other-auth-token=1"]) {
      const response = await proxy(request("/library", cookie));
      expect(response.status, cookie).toBe(307);
      expect(createServerClient).not.toHaveBeenCalled();
    }
  });
});

describe("with a session cookie", () => {
  it("lets a signed-in person through to a protected page", async () => {
    signedIn();
    const response = await proxy(request("/library", SESSION));
    expect(response.status).toBe(200);
    expect(location(response)).toBeNull();
    expect(getClaims).toHaveBeenCalledTimes(1);
  });

  it("recognises a session split across cookies", async () => {
    signedIn();
    expect((await proxy(request("/library", "sb-abcdefgh-auth-token.0=aaa; sb-abcdefgh-auth-token.1=bbb"))).status).toBe(200);
    expect(createServerClient).toHaveBeenCalledTimes(1);
  });

  it("sends someone whose token is no good to sign in, as it would anyone not signed in", async () => {
    signedOut();
    const response = await proxy(request("/admin/billing", SESSION));
    expect(response.status).toBe(307);
    expect(location(response)).toBe("https://app.example/login?next=%2Fadmin%2Fbilling");
  });

  it("treats a failure to check the token as not signed in, and never lets a protected page through on a guess", async () => {
    getClaims.mockRejectedValue(new Error("network down"));
    expect((await proxy(request("/library", SESSION))).status).toBe(307);
  });

  it("sends a signed-in person away from the sign-in pages, to the dashboard", async () => {
    signedIn();
    for (const path of ["/", "/login", "/signup", "/forgot-password"]) {
      const response = await proxy(request(path, SESSION));
      expect(response.status, path).toBe(307);
      expect(location(response), path).toBe("https://app.example/dashboard");
    }
  });

  it("does NOT bounce a signed-in person away from /reset-password or /join: they arrive there signed in, on purpose", async () => {
    signedIn();
    for (const path of ["/reset-password", "/join?token=" + "a".repeat(64)]) {
      const response = await proxy(request(path, SESSION));
      expect(response.status, path).toBe(200);
      expect(location(response), path).toBeNull();
    }
  });

  it("lets a signed-out person with a stale cookie reach the public pages", async () => {
    signedOut();
    expect((await proxy(request("/login", SESSION))).status).toBe(200);
  });
});

describe("renewing the session", () => {
  it("puts the cookies Supabase asks for on the response, with the no-cache headers that must go with them", async () => {
    getClaims.mockImplementation(async () => {
      cookieHandlers!.setAll([{ name: "sb-abcdefgh-auth-token", value: "renewed", options: { path: "/", httpOnly: true, sameSite: "lax" } }], {
        "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
      });
      return { data: { claims: { sub: "u1" } }, error: null };
    });
    const response = await proxy(request("/library", SESSION));
    expect(response.cookies.get("sb-abcdefgh-auth-token")?.value).toBe("renewed");
    expect(response.cookies.get("sb-abcdefgh-auth-token")?.httpOnly).toBe(true);
    expect(response.headers.get("cache-control")).toBe("private, no-cache, no-store, must-revalidate, max-age=0");
  });

  it("hands the renewed session to the page about to be drawn, as well as to the browser", async () => {
    getClaims.mockImplementation(async () => {
      cookieHandlers!.setAll([{ name: "sb-abcdefgh-auth-token", value: "renewed" }], {});
      return { data: { claims: { sub: "u1" } }, error: null };
    });
    const req = request("/library", SESSION);
    await proxy(req);
    expect(req.cookies.get("sb-abcdefgh-auth-token")?.value).toBe("renewed");
  });

  it("keeps the cookie changes on a redirect too: a session that has just been cleared must stay cleared", async () => {
    getClaims.mockImplementation(async () => {
      cookieHandlers!.setAll([{ name: "sb-abcdefgh-auth-token", value: "", options: { maxAge: 0, path: "/" } }], { "Cache-Control": "private, no-store" });
      return { data: null, error: { message: "refresh token already used" } };
    });
    const response = await proxy(request("/library", SESSION));
    expect(response.status).toBe(307);
    expect(response.cookies.get("sb-abcdefgh-auth-token")?.value).toBe("");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("is configured with the cookies of the request", async () => {
    signedIn();
    await proxy(request("/library", `${SESSION}; theme=dark`));
    expect(createServerClient).toHaveBeenCalledWith("http://127.0.0.1:54321", "anon-key", expect.anything());
    expect(cookieHandlers!.getAll().map((c) => c.name).sort()).toEqual(["sb-abcdefgh-auth-token", "theme"]);
  });
});

describe("when Supabase is not configured", () => {
  it("lets a request with a session cookie through rather than failing, so the page can explain", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const response = await proxy(request("/library", SESSION));
    expect(response.status).toBe(200);
    expect(createServerClient).not.toHaveBeenCalled();
  });
});

describe("what it covers", () => {
  const pattern = new RegExp(`^${config.matcher[0]}$`);

  it.each(["/", "/login", "/dashboard", "/admin/billing", "/library", "/calendar", "/calendar/generate", "/reminiscence", "/join", "/auth/callback", "/reset-password"])("runs for the page %s", (path) => {
    expect(pattern.test(path), path).toBe(true);
  });

  it.each(["/api/stripe/webhook", "/api/calendars", "/api/stripe/checkout", "/_next/static/chunks/app.js", "/_next/image", "/favicon.ico", "/logo.svg", "/fonts/a.woff2", "/fonts/AtkinsonHyperlegible-Bold.ttf", "/robots.txt"])(
    "does not run for %s: the Stripe webhook has no session, other APIs answer for themselves, assets need nothing",
    (path) => {
      expect(pattern.test(path), path).toBe(false);
    },
  );
});
