import type { FacilityRole } from "@/lib/db/models";
import { INVITE_DAYS } from "@/lib/domain/invite";

/**
 * The invitation email, as a pure function: facility, role and link go in; a subject, a plain-text body and
 * an HTML body come out. Nothing here sends anything (lib/email/mailer.ts does) or reads a setting.
 *
 * ZERO PHI. An invitation names the facility and the role, never a resident. The link is the invitation's
 * secret, so it appears once in each body and nowhere else; it is not put in the subject.
 *
 * Plain words for busy people: who invited them, what they can do, what to click, how long it lasts, and what
 * to do if the email was not meant for them. Every value from outside is escaped for HTML, and the subject has
 * its control characters taken out so a facility name can never add a header.
 */

export interface InviteEmailInput {
  facilityName: string;
  role: FacilityRole;
  /** The whole invitation address, as lib/domain/invite.ts makes it. */
  link: string;
  /** The address the invitation is tied to. It is the address the email goes to. */
  email: string;
}

export interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** One line, no control characters (a line break in a subject could add a header), trimmed and not too long. */
const oneLine = (value: string): string => value.replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 120);

const ROLE_SENTENCE: Record<FacilityRole, { what: string; can: string }> = {
  staff: { what: "a member of staff", can: "use the activity library and the calendar tools" },
  admin: { what: "an admin", can: "use the activity library and the calendar tools, and manage the team, the settings and billing" },
};

export function buildInviteEmail(input: InviteEmailInput): BuiltEmail {
  const facility = oneLine(input.facilityName) || "a facility";
  const role = ROLE_SENTENCE[input.role];
  const subject = `You are invited to join ${facility} on Cognicopia`;

  const text = [
    `You have been invited to join ${facility} on Cognicopia as ${role.what}.`,
    "",
    `You will be able to ${role.can}.`,
    "",
    "To accept, open this address, then sign in or create your own account:",
    input.link,
    "",
    `The link works once and lasts ${INVITE_DAYS} days. It only works for ${input.email}.`,
    "",
    "If you were not expecting this, you can ignore this email. Nothing happens unless the link is opened.",
    "",
    "Cognicopia plans activities for groups. It never asks for, or stores, anything about a resident.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background:#ffffff;color:#111111;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.5">
<div style="max-width:560px;margin:0 auto">
<h1 style="font-size:24px;line-height:1.3;margin:0 0 16px">You are invited to join ${escapeHtml(facility)}</h1>
<p style="margin:0 0 16px">You have been invited to join <strong>${escapeHtml(facility)}</strong> on Cognicopia as ${escapeHtml(role.what)}. You will be able to ${escapeHtml(role.can)}.</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(input.link)}" style="display:inline-block;background:#1b4d3e;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:8px">Accept the invitation</a></p>
<p style="margin:0 0 16px">If the button does not work, copy this address into your browser:<br><a href="${escapeHtml(input.link)}" style="color:#1b4d3e;word-break:break-all">${escapeHtml(input.link)}</a></p>
<p style="margin:0 0 16px">The link works once and lasts ${INVITE_DAYS} days. It only works for ${escapeHtml(input.email)}.</p>
<p style="margin:0 0 16px">If you were not expecting this, you can ignore this email. Nothing happens unless the link is opened.</p>
<p style="margin:0;font-size:16px;color:#333333">Cognicopia plans activities for groups. It never asks for, or stores, anything about a resident.</p>
</div>
</body>
</html>`;

  return { subject, text, html };
}
