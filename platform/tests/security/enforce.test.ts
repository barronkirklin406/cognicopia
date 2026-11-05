import { afterEach, describe, expect, it, vi } from "vitest";

/** The server's one call: "may this person try this now?" The request's headers and the database are stand-ins. */

let forwarded: string | null = "203.0.113.9";
vi.mock("next/headers", () => ({ headers: async () => ({ get: (name: string) => (name === "x-forwarded-for" ? forwarded : null) }) }));

const rpc = vi.fn();
let adminBroken = false;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (adminBroken) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY=secret-value");
    return { rpc };
  },
}));

const { enforceRate, databaseCounter } = await import("@/lib/security/enforce");

afterEach(() => {
  rpc.mockReset();
  forwarded = "203.0.113.9";
  adminBroken = false;
  vi.unstubAllEnvs();
});

const allow = { data: [{ allowed: true, hits: 1, retry_after: 600 }], error: null };
const refuse = { data: [{ allowed: false, hits: 99, retry_after: 600 }], error: null };

describe("enforceRate", () => {
  it("lets a try through when the counter allows it, counting the address and the account", async () => {
    rpc.mockResolvedValue(allow);
    expect(await enforceRate("sign-in", { account: "bob@maple.example" })).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(2);
    const keys = rpc.mock.calls.map(([name, args]) => `${name} ${args.p_key}`);
    expect(keys[0]).toMatch(/^rate_limit_hit sign-in:ip:/);
    expect(keys[1]).toMatch(/^rate_limit_hit sign-in:account:/);
    expect(JSON.stringify(rpc.mock.calls)).not.toMatch(/203\.0\.113|bob|maple/);
  });

  it("turns a try away with words, when the counter says no", async () => {
    rpc.mockResolvedValue(refuse);
    expect(await enforceRate("sign-in", { account: "bob@maple.example" })).toEqual({ error: "Too many tries. Please wait about 10 minutes and try again." });
  });

  it("still limits the account when the caller's address is not known", async () => {
    forwarded = null;
    rpc.mockResolvedValue(refuse);
    expect(await enforceRate("sign-in", { account: "bob@maple.example" })).toMatchObject({ error: expect.stringContaining("Too many tries") });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("reads the header named in CLIENT_IP_HEADER", async () => {
    vi.stubEnv("CLIENT_IP_HEADER", "x-forwarded-for");
    rpc.mockResolvedValue(allow);
    await enforceRate("invite-link");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("lets a try through when the database cannot be reached, and says nothing technical", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: "08006", message: "connection failure to 10.0.0.5" } });
    expect(await enforceRate("sign-in", { account: "a@b.example" })).toBeNull();
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/10\.0\.0\.5|a@b/);
    log.mockRestore();
  });

  it("lets a try through when the service role is not set, without logging the setting's value", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    adminBroken = true;
    expect(await enforceRate("sign-in", { account: "a@b.example" })).toBeNull();
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret-value");
    log.mockRestore();
  });

  it("turns a try away, in plain words, when it must fail closed and cannot count", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    adminBroken = true;
    expect(await enforceRate("invite-email", { facility: "f1" }, { failClosed: true })).toEqual({ error: "This could not be done right now. Please try again in a few minutes." });
    adminBroken = false;
    rpc.mockResolvedValue({ data: null, error: { code: "08006" } });
    expect(await enforceRate("invite-email", { facility: "f1" }, { failClosed: true })).toMatchObject({ error: expect.stringContaining("Too many tries") });
    log.mockRestore();
  });
});

describe("databaseCounter", () => {
  it("asks the database function for one key, and turns its row into an answer", async () => {
    const counter = databaseCounter({ rpc } as never);
    rpc.mockResolvedValue({ data: [{ allowed: false, hits: 4, retry_after: 12 }], error: null });
    expect(await counter.hit("k", 600, 3)).toEqual({ allowed: false, retryAfter: 12 });
    expect(rpc).toHaveBeenCalledWith("rate_limit_hit", { p_key: "k", p_window_seconds: 600, p_max: 3 });
  });

  it("fails, rather than guessing, when the database gives no answer", async () => {
    const counter = databaseCounter({ rpc } as never);
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(counter.hit("k", 600, 3)).rejects.toThrow();
  });
});
