import { afterEach, describe, expect, it, vi } from "vitest";
import { getSmtpConfig } from "@/lib/env.server";
import { ConfigError } from "@/lib/errors";

/** The outgoing mail settings: off when SMTP_HOST is unset, strict once it is set, and reported by name, never by value. */

const NAMES = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"];
const GOOD = { SMTP_HOST: "smtp.example.com", SMTP_FROM: "Cognicopia <no-reply@cognicopia.org>" };
const setAll = (env: Record<string, string | undefined>) => {
  for (const name of NAMES) {
    vi.stubEnv(name, env[name] as string);
    if (env[name] === undefined) delete process.env[name];
  }
};
const missing = (): string[] => {
  try {
    getSmtpConfig();
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return (error as ConfigError).missing;
  }
  throw new Error("expected a ConfigError");
};

afterEach(() => vi.unstubAllEnvs());

describe("getSmtpConfig", () => {
  it.each([undefined, "", "   "])("is off when SMTP_HOST is %j, whatever else is set", (host) => {
    setAll({ SMTP_HOST: host, SMTP_FROM: "x@y.example", SMTP_USER: "u" });
    expect(getSmtpConfig()).toBeUndefined();
  });

  it("starts on port 587, upgrading to TLS, with no sign-in unless one is given", () => {
    setAll(GOOD);
    expect(getSmtpConfig()).toEqual({ host: "smtp.example.com", port: 587, secure: false, auth: undefined, from: GOOD.SMTP_FROM });
  });

  it("uses TLS from the first byte on port 465, unless told otherwise", () => {
    setAll({ ...GOOD, SMTP_PORT: "465" });
    expect(getSmtpConfig()?.secure).toBe(true);
    setAll({ ...GOOD, SMTP_PORT: "465", SMTP_SECURE: "false" });
    expect(getSmtpConfig()?.secure).toBe(false);
    setAll({ ...GOOD, SMTP_PORT: "2465", SMTP_SECURE: "true" });
    expect(getSmtpConfig()?.secure).toBe(true);
  });

  it("takes a sign-in when both halves are given", () => {
    setAll({ ...GOOD, SMTP_USER: "mailer", SMTP_PASSWORD: "s3cret" });
    expect(getSmtpConfig()?.auth).toEqual({ user: "mailer", pass: "s3cret" });
  });

  it("refuses half a sign-in, naming the missing half", () => {
    setAll({ ...GOOD, SMTP_USER: "mailer" });
    expect(missing()).toEqual(["SMTP_PASSWORD"]);
    setAll({ ...GOOD, SMTP_PASSWORD: "s3cret" });
    expect(missing()).toEqual(["SMTP_USER"]);
  });

  it("needs a From line once a host is set", () => {
    setAll({ SMTP_HOST: "smtp.example.com" });
    expect(missing()).toEqual(["SMTP_FROM"]);
  });

  it.each([["SMTP_PORT", "0"], ["SMTP_PORT", "70000"], ["SMTP_PORT", "smtp"], ["SMTP_SECURE", "yes"], ["SMTP_HOST", "smtp.example.com/evil"], ["SMTP_HOST", "a b"], ["SMTP_FROM", "a@b.example\r\nBcc: c@d.example"]])(
    "refuses %s = %j",
    (name, value) => {
      setAll({ ...GOOD, [name]: value });
      expect(missing()).toEqual([name]);
    },
  );

  it("never puts a value in the error", () => {
    setAll({ ...GOOD, SMTP_USER: "mailer", SMTP_PASSWORD: "hunter2-the-password", SMTP_PORT: "nope" });
    try {
      getSmtpConfig();
    } catch (error) {
      expect(String((error as Error).message)).not.toContain("hunter2");
      expect(String((error as Error).message)).toContain("SMTP_PORT");
    }
  });
});
