import { describe, expect, it, vi } from "vitest";
import { checkRate, clientIp, POLICIES, subjectKey, tooManyTries, waitInWords, type HitCounter } from "@/lib/security/rate-limit";

/** The rules of rate limiting, with a stand-in counter: no clock, no database. */

function counter(limits: Record<string, { allowed: boolean; retryAfter?: number }> = {}) {
  const seen: { key: string; windowSeconds: number; max: number }[] = [];
  const hit: HitCounter["hit"] = async (key, windowSeconds, max) => {
    seen.push({ key, windowSeconds, max });
    const answer = Object.entries(limits).find(([part]) => key.includes(`:${part}:`));
    return { allowed: answer ? answer[1].allowed : true, retryAfter: answer?.[1].retryAfter ?? 30 };
  };
  return { seen, counter: { hit } as HitCounter };
}

describe("checkRate", () => {
  it("counts every rule of the policy that has a subject, with that rule's window and limit", async () => {
    const { seen, counter: c } = counter();
    expect(await checkRate(c, "sign-in", { ip: "203.0.113.9", account: "Bob@Maple.example" })).toEqual({ allowed: true });
    expect(seen).toHaveLength(2);
    expect(seen.map((s) => [s.windowSeconds, s.max])).toEqual(POLICIES["sign-in"].map((r) => [r.windowSeconds, r.max]));
  });

  it("skips a rule whose subject is not known, and counts the rest", async () => {
    const { seen, counter: c } = counter();
    await checkRate(c, "sign-in", { account: "bob@maple.example" });
    await checkRate(c, "sign-in", { ip: "  ", account: null });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.key).toMatch(/^sign-in:account:/);
  });

  it("refuses when any rule refuses, reports the longest wait, and still counts the other rules", async () => {
    const { seen, counter: c } = counter({ ip: { allowed: false, retryAfter: 40 }, account: { allowed: false, retryAfter: 200 } });
    expect(await checkRate(c, "sign-in", { ip: "203.0.113.9", account: "a@b.example" })).toEqual({ allowed: false, retryAfter: 200 });
    expect(seen).toHaveLength(2);
  });

  it("refuses on one rule alone", async () => {
    const { counter: c } = counter({ account: { allowed: false, retryAfter: 90 } });
    expect(await checkRate(c, "forgot-password", { ip: "203.0.113.9", account: "a@b.example" })).toEqual({ allowed: false, retryAfter: 90 });
  });

  it("never puts an email address or a network address into a key", async () => {
    const { seen, counter: c } = counter();
    await checkRate(c, "sign-up", { ip: "203.0.113.9", account: "Bob@Maple.example" });
    for (const { key } of seen) {
      expect(key).not.toMatch(/bob|maple|203\.0\.113/i);
      expect(key.length).toBeLessThan(80);
    }
  });

  it("gives the same key for the same account however it was typed, and different keys for different ones", () => {
    expect(subjectKey("sign-in", "account", " Bob@Maple.example ")).toBe(subjectKey("sign-in", "account", "bob@maple.example"));
    expect(subjectKey("sign-in", "account", "bob@maple.example")).not.toBe(subjectKey("sign-in", "account", "alice@maple.example"));
    expect(subjectKey("sign-in", "account", "x")).not.toBe(subjectKey("sign-up", "account", "x"));
    expect(subjectKey("sign-in", "account", "x")).not.toBe(subjectKey("sign-in", "ip", "x"));
  });

  describe("when the counter itself fails", () => {
    const broken: HitCounter = { hit: async () => Promise.reject(new Error("connection to db.internal:5432 refused, password=hunter2")) };

    it("lets the try through by default, and logs the kind of failure only", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(await checkRate(broken, "sign-in", { account: "a@b.example" })).toEqual({ allowed: true });
      expect(JSON.stringify(log.mock.calls)).toContain("Error");
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/hunter2|db\.internal|a@b/);
      log.mockRestore();
    });

    it("turns the try away when asked to fail closed (anything that sends email)", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(await checkRate(broken, "invite-email", { facility: "f1" }, { failClosed: true })).toEqual({ allowed: false, retryAfter: 60 });
      log.mockRestore();
    });
  });
});

describe("the policies", () => {
  it("are tighter for what sends email than for signing in", () => {
    const account = (name: keyof typeof POLICIES) => POLICIES[name].find((r) => r.by === "account")!;
    expect(account("sign-up").max).toBeLessThan(account("sign-in").max);
    expect(account("forgot-password").max).toBeLessThanOrEqual(3);
  });

  it("all fit what the database accepts: windows up to a day, limits up to 100000", () => {
    for (const rules of Object.values(POLICIES)) {
      for (const rule of rules) {
        expect(rule.windowSeconds).toBeGreaterThanOrEqual(1);
        expect(rule.windowSeconds).toBeLessThanOrEqual(86400);
        expect(rule.max).toBeGreaterThanOrEqual(1);
        expect(rule.max).toBeLessThanOrEqual(100000);
      }
    }
  });
});

describe("what the form says", () => {
  it.each([
    [1, "a minute"],
    [90, "a minute"],
    [91, "about 2 minutes"],
    [600, "about 10 minutes"],
    [3200, "about 54 minutes"],
    [3300, "about an hour"],
    [3400, "about an hour"],
    [5400, "about an hour"],
    [7300, "about 3 hours"],
  ])("a wait of %i seconds is %s", (seconds, words) => {
    expect(waitInWords(seconds)).toBe(words);
  });

  it("is polite, says how long, and does not say whose count it was", () => {
    expect(tooManyTries(600)).toBe("Too many tries. Please wait about 10 minutes and try again.");
    expect(tooManyTries(600)).not.toMatch(/ip|address|account|email/i);
  });
});

describe("clientIp", () => {
  const h = (value: string | null) => ({ get: (name: string) => (name === "x-forwarded-for" ? value : null) });

  it("takes the last entry, which only the host's own proxy can set", () => {
    expect(clientIp(h("6.6.6.6, 203.0.113.9"))).toBe("203.0.113.9");
    expect(clientIp(h("203.0.113.9"))).toBe("203.0.113.9");
  });

  it("copes with a port on IPv4, IPv6 and spaces", () => {
    expect(clientIp(h("203.0.113.9:51234"))).toBe("203.0.113.9");
    expect(clientIp(h(" 2001:db8::1 "))).toBe("2001:db8::1");
  });

  it.each([null, "", "unknown", "not an address", "999.1.1.1", "203.0.113.9, <script>"])("ignores %j", (value) => {
    expect(clientIp(h(value))).toBeUndefined();
  });

  it("reads another header when told to (behind a CDN that sets its own)", () => {
    const headers = { get: (name: string) => (name === "cf-connecting-ip" ? "198.51.100.7" : "6.6.6.6") };
    expect(clientIp(headers, "cf-connecting-ip")).toBe("198.51.100.7");
  });
});
