#!/usr/bin/env node
/**
 * Checks the outgoing mail settings against the real mail server, without sending anything unless asked.
 *
 *   npm run mail:check                          reads SMTP_* from the environment (and .env.local, if there is one)
 *   npm run mail:check -- --send me@x.example   also sends one short test message to that address
 *
 * It connects, upgrades to TLS, signs in, and says in plain words what happened. The password is never
 * printed, and nothing about a resident exists here. Exit code 0: it works. 1: the server said no, or could
 * not be reached. 2: a setting is missing or wrong.
 *
 * Run it where the password lives (your own computer with .env.local, or the host's console), never by pasting
 * the password anywhere else.
 */
import nodemailer from "nodemailer";

const env = (name) => (process.env[name] ?? "").trim();
const say = (line) => console.log(line);
const stop = (code, line) => {
  console.error(line);
  process.exit(code);
};

const MICROSOFT_HOST = /(^|\.)(outlook|office365|hotmail|live)\.com$/i;

const host = env("SMTP_HOST");
if (!host) stop(2, "SMTP_HOST is not set, so emailing is off. Nothing to check.");
const port = Number(env("SMTP_PORT") || 587);
const secure = env("SMTP_SECURE") ? env("SMTP_SECURE") === "true" : port === 465;
const user = env("SMTP_USER");
const pass = process.env.SMTP_PASS ?? "";
const from = env("SMTP_FROM");

const problems = [];
if (!/^[A-Za-z0-9.-]+$/.test(host)) problems.push("SMTP_HOST must be a host name");
if (!Number.isInteger(port) || port < 1 || port > 65535) problems.push("SMTP_PORT must be a number from 1 to 65535");
if (!from) problems.push("SMTP_FROM is not set");
if (Boolean(user) !== Boolean(pass)) problems.push(user ? "SMTP_PASS is not set (SMTP_USER and SMTP_PASS go together)" : "SMTP_USER is not set (SMTP_USER and SMTP_PASS go together)");
if (MICROSOFT_HOST.test(host) && user && from) {
  const address = (/<([^<>]+)>/.exec(from)?.[1] ?? from).trim().toLowerCase();
  if (address !== user.toLowerCase()) problems.push("SMTP_FROM must be the same address as SMTP_USER on Outlook (Microsoft sends only as the account that signed in)");
}
if (problems.length) stop(2, ["The settings need fixing:", ...problems.map((p) => `  - ${p}`)].join("\n"));

say(`Checking ${host}:${port} (${secure ? "TLS from the first byte" : "STARTTLS"}), signing in as ${user || "nobody (no sign-in)"}.`);

const transport = nodemailer.createTransport({
  host,
  port,
  secure,
  requireTLS: !secure,
  ...(user ? { auth: { user, pass } } : {}),
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 10_000,
  disableFileAccess: true,
  disableUrlAccess: true,
});

/** What went wrong, in words, from the kind of failure only (the server's own text can name accounts). */
function explain(error) {
  const code = error && typeof error === "object" ? String(error.code ?? "") : "";
  const message = error && typeof error === "object" ? String(error.message ?? "") : "";
  if (code === "EAUTH") {
    return [
      "The server refused the sign-in.",
      "  Check SMTP_USER (the full address) and SMTP_PASS.",
      ...(MICROSOFT_HOST.test(host)
        ? [
            "  On Outlook, an account with two-step verification needs an app password, not the normal one.",
            "  Microsoft has been ending password sign-in for mail programs on personal Outlook.com accounts. If a correct",
            "  app password is still refused, this account can no longer be used with a password, and the answer is a",
            "  different mail service (or a Microsoft 365 account set up for it), not a code change.",
          ]
        : []),
    ].join("\n");
  }
  if (code === "ETLS" || /STARTTLS|\bTLS\b|\bSSL\b/i.test(message)) {
    return "The server did not offer an encrypted connection, so nothing was sent. Cognicopia never signs in or sends over an unencrypted connection. Check the port (587 for STARTTLS, 465 for TLS from the start).";
  }
  if (["ETIMEDOUT", "ESOCKET", "ECONNECTION", "ECONNREFUSED", "ENOTFOUND", "EDNS"].includes(code)) {
    return `The server could not be reached (${code}). Check SMTP_HOST and SMTP_PORT, and that this computer or host may connect out on that port.`;
  }
  if (code === "EENVELOPE" || code === "EMESSAGE") return `The server refused the message (${code}). Check SMTP_FROM and the address sent to.`;
  return `The check failed (${code || "no code"}).`;
}

try {
  await transport.verify();
  say("Connected, encrypted and signed in. The settings work.");
} catch (error) {
  stop(1, explain(error));
}

const sendIndex = process.argv.indexOf("--send");
if (sendIndex !== -1) {
  const to = process.argv[sendIndex + 1] ?? "";
  if (!/^[^@\s]+@[^@\s]+$/.test(to)) stop(2, "Give an address to send to:  npm run mail:check -- --send you@example.com");
  try {
    await transport.sendMail({ from, to, subject: "Cognicopia mail check", text: "This is a test message from Cognicopia's mail check. Nothing else is needed." });
    say(`A test message was sent to ${to}. Check that inbox (and its spam folder).`);
  } catch (error) {
    stop(1, explain(error));
  }
}
