import net from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSmtpMailer, getMailer } from "@/lib/email/mailer";

/**
 * The mailer: the options it gives the mail library (TLS required, timeouts, no files or URLs read), what it
 * sends, when emailing is off, and one real socket test that a server which cannot do TLS is refused.
 */

const sendMail = vi.fn();
const createTransport = vi.fn((_options: Record<string, unknown>) => ({ sendMail }));
vi.mock("nodemailer", () => ({ default: { createTransport: (options: Record<string, unknown>) => createTransport(options) } }));

const config = { host: "smtp.example.com", port: 587, secure: false, auth: { user: "u", pass: "p" }, from: "Cognicopia <no-reply@cognicopia.org>" };

afterEach(() => {
  vi.unstubAllEnvs();
  sendMail.mockReset();
  createTransport.mockClear();
});

describe("createSmtpMailer", () => {
  it("requires TLS unless the connection is TLS from the start, and never waits long", () => {
    createSmtpMailer(config);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "smtp.example.com", port: 587, secure: false, requireTLS: true, auth: { user: "u", pass: "p" }, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 10_000, disableFileAccess: true, disableUrlAccess: true }),
    );
    createSmtpMailer({ ...config, port: 465, secure: true, auth: undefined });
    const options = createTransport.mock.calls[1]![0];
    expect(options).toMatchObject({ secure: true, requireTLS: false });
    expect(options).not.toHaveProperty("auth");
  });

  it("sends from the configured address to the one address, with a text and an HTML body", async () => {
    sendMail.mockResolvedValue({});
    await createSmtpMailer(config).send({ to: "new@maple.example", subject: "S", text: "T", html: "<p>H</p>" });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith({ from: config.from, to: "new@maple.example", subject: "S", text: "T", html: "<p>H</p>" });
  });

  it("lets the failure through for the caller to report in its own words", async () => {
    sendMail.mockRejectedValue(new Error("550 mailbox unavailable for secret@example.com"));
    await expect(createSmtpMailer(config).send({ to: "a@b.example", subject: "S", text: "T", html: "H" })).rejects.toThrow();
  });
});

describe("getMailer", () => {
  const set = (env: Record<string, string>) => {
    for (const name of ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"]) {
      vi.stubEnv(name, env[name] ?? "");
    }
  };

  it("is null when emailing is not set up", () => {
    set({});
    expect(getMailer()).toBeNull();
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("is null, and says which setting is wrong by name only, when it is set up wrongly", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    set({ SMTP_HOST: "smtp.example.com", SMTP_USER: "u", SMTP_PASSWORD: "", SMTP_FROM: "Cognicopia <no-reply@cognicopia.org>" });
    expect(getMailer()).toBeNull();
    expect(log).toHaveBeenCalledWith("[mail] not configured:", "SMTP_PASSWORD");
    log.mockRestore();
  });

  it("makes one transport for one set of settings, and a new one when they change", () => {
    set({ SMTP_HOST: "smtp.example.com", SMTP_FROM: "Cognicopia <no-reply@cognicopia.org>" });
    const first = getMailer();
    expect(getMailer()).toBe(first);
    expect(createTransport).toHaveBeenCalledTimes(1);
    set({ SMTP_HOST: "smtp.other.example", SMTP_FROM: "Cognicopia <no-reply@cognicopia.org>" });
    expect(getMailer()).not.toBe(first);
    expect(createTransport).toHaveBeenCalledTimes(2);
  });
});

describe("a mail server that cannot do TLS", () => {
  it("is refused: nothing is sent in the clear", async () => {
    vi.doUnmock("nodemailer");
    vi.resetModules();
    const real = await import("@/lib/email/mailer");

    const received: string[] = [];
    const server = net.createServer((socket) => {
      socket.write("220 plain.test ESMTP\r\n");
      socket.on("data", (chunk) => {
        const line = chunk.toString();
        received.push(line);
        if (/^EHLO/i.test(line)) socket.write("250-plain.test\r\n250 AUTH PLAIN\r\n"); // no STARTTLS offered
        else if (/^QUIT/i.test(line)) socket.end("221 bye\r\n");
        else socket.write("250 ok\r\n");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as net.AddressInfo;
    try {
      const mailer = real.createSmtpMailer({ host: "127.0.0.1", port, secure: false, auth: { user: "u", pass: "p" }, from: "a@b.example" });
      await expect(mailer.send({ to: "c@d.example", subject: "S", text: "SECRET-BODY", html: "H" })).rejects.toThrow();
      const sent = received.join("");
      expect(sent).not.toContain("SECRET-BODY");
      expect(sent).not.toMatch(/AUTH/i);
      expect(sent).not.toMatch(/DATA/i);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
