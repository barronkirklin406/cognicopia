import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** scripts/mail-check.mjs, run as a person would run it: what it says for a missing setting, a wrong From, and a server that cannot do TLS. */

const SCRIPT = path.join(import.meta.dirname, "../../scripts/mail-check.mjs");

function run(env: Record<string, string>, args: string[] = []): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], { env: { PATH: process.env.PATH ?? "", ...env } as unknown as NodeJS.ProcessEnv, cwd: path.dirname(SCRIPT) });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
}

const OUTLOOK = { SMTP_HOST: "smtp-mail.outlook.com", SMTP_PORT: "587", SMTP_USER: "Cognicopia@outlook.com", SMTP_PASS: "the-secret-app-password", SMTP_FROM: "Cognicopia <Cognicopia@outlook.com>" };

describe("npm run mail:check", () => {
  it("says emailing is off when there is no host, and exits 2", async () => {
    const r = await run({});
    expect(r.code).toBe(2);
    expect(r.out).toContain("SMTP_HOST is not set");
  });

  it("names a missing password and never prints it", async () => {
    const r = await run({ ...OUTLOOK, SMTP_PASS: "" });
    expect(r.code).toBe(2);
    expect(r.out).toContain("SMTP_PASS is not set");
  });

  it("refuses an Outlook From that is not the signed-in account, before any connection", async () => {
    const r = await run({ ...OUTLOOK, SMTP_FROM: "Cognicopia <no-reply@cognicopia.org>" });
    expect(r.code).toBe(2);
    expect(r.out).toContain("SMTP_FROM must be the same address as SMTP_USER");
    expect(r.out).not.toContain("the-secret-app-password");
  });

  it("refuses a server that cannot do TLS, says so in words, and never prints the password", async () => {
    const received: string[] = [];
    const server = net.createServer((socket) => {
      socket.write("220 plain.test ESMTP\r\n");
      socket.on("data", (chunk) => {
        const line = chunk.toString();
        received.push(line);
        if (/^EHLO/i.test(line)) socket.write("250-plain.test\r\n250 AUTH PLAIN\r\n"); // no STARTTLS
        else if (/^QUIT/i.test(line)) socket.end("221 bye\r\n");
        else socket.write("250 ok\r\n");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as net.AddressInfo;
    try {
      const r = await run({ SMTP_HOST: "127.0.0.1", SMTP_PORT: String(port), SMTP_USER: "u@x.example", SMTP_PASS: "the-secret-app-password", SMTP_FROM: "u@x.example" });
      expect(r.code).toBe(1);
      expect(r.out).toContain("did not offer an encrypted connection");
      expect(r.out).not.toContain("the-secret-app-password");
      expect(received.join("")).not.toMatch(/AUTH/i);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("is wired to npm as mail:check", async () => {
    const pkg = (await import("../../package.json", { with: { type: "json" } })).default as { scripts: Record<string, string> };
    expect(pkg.scripts["mail:check"]).toContain("scripts/mail-check.mjs");
  });
});
