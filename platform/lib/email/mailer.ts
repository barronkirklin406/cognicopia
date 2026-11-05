import "server-only";
import nodemailer from "nodemailer";
import { getSmtpConfig, type SmtpConfig } from "@/lib/env.server";
import { ConfigError } from "@/lib/errors";

/**
 * Sending email, as narrowly as the app needs. A `Mailer` has one method; the invitation flow takes one as an
 * argument, so it is tested with a stand-in and never reaches a mail server, the same way the billing code takes
 * a slice of Stripe. Only this file knows the mail library.
 *
 * Nothing the server says back is shown to a person: a mail server's refusal can name addresses and accounts.
 * A failure is logged by its kind only, and the caller says in plain words that the email did not go.
 */
export interface Mailer {
  send(message: { to: string; subject: string; text: string; html: string }): Promise<void>;
}

/** A mail server that is slow or silent must not hold a page open: every step is given a few seconds. */
const TIMEOUT_MS = 10_000;

export function createSmtpMailer(config: SmtpConfig): Mailer {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    // A sign-in or an invitation link must never cross the network unencrypted: refuse a server that cannot upgrade.
    requireTLS: !config.secure,
    ...(config.auth ? { auth: config.auth } : {}),
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
    // The text is final: no tracking pixels, no rewriting of links.
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return {
    async send(message) {
      await transport.sendMail({ from: config.from, to: message.to, subject: message.subject, text: message.text, html: message.html });
    },
  };
}

let cached: { key: string; mailer: Mailer } | undefined;

/**
 * The configured mailer, or null when emailing is not set up (SMTP_HOST unset) or is set up wrongly. A wrong
 * setting is logged by name, never by value, and the feature stays off: an admin can still share the link.
 */
export function getMailer(): Mailer | null {
  let config: SmtpConfig | undefined;
  try {
    config = getSmtpConfig();
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    console.error("[mail] not configured:", error.missing.join(", "));
    return null;
  }
  if (!config) return null;
  const key = JSON.stringify(config);
  if (cached?.key !== key) cached = { key, mailer: createSmtpMailer(config) };
  return cached.mailer;
}
