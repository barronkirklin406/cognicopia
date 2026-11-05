import { createHash } from "node:crypto";
import { isIP } from "node:net";

/**
 * Rate limiting, as pure decisions. A policy is a list of rules (so many tries from one place, so many for
 * one account, in a window of time); a counter says how many times a key has been seen. Nothing here reads
 * a request or a database: lib/security/enforce.ts supplies the address and the counter, so every rule below
 * is tested with a stand-in counter and no clock.
 *
 * WHAT IS COUNTED. Each rule counts under a key made of the policy, the kind of subject and a hash of the
 * subject, so the table of counts holds no email address and no network address in the clear.
 *
 * WHAT HAPPENS WHEN THE COUNTER IS DOWN. Sign-in and the like fail OPEN: a broken counter must not lock every
 * facility out, and Supabase's own limits still stand behind these. Anything that can send email fails CLOSED:
 * an unlimited sender is the worse failure.
 */

export type Subject = "ip" | "account" | "facility";

export interface Rule {
  by: Subject;
  /** How many tries a subject gets in one window. */
  max: number;
  windowSeconds: number;
}

export const POLICIES = {
  // A person mistyping a password a few times is normal; a script trying many is not.
  "sign-in": [
    { by: "ip", max: 30, windowSeconds: 600 },
    { by: "account", max: 10, windowSeconds: 900 },
  ],
  // Each of these sends the address an email, so an account's own limit is low: this is how a stranger's inbox gets flooded.
  "sign-up": [
    { by: "ip", max: 10, windowSeconds: 3600 },
    { by: "account", max: 3, windowSeconds: 3600 },
  ],
  "forgot-password": [
    { by: "ip", max: 10, windowSeconds: 3600 },
    { by: "account", max: 3, windowSeconds: 3600 },
  ],
  // The link's secret has 256 bits, so guessing is hopeless; this keeps the page from being used to load the database.
  "invite-link": [{ by: "ip", max: 60, windowSeconds: 600 }],
  // An admin can email invitations. Without a ceiling, a stolen admin session turns this into a spam relay.
  "invite-email": [{ by: "facility", max: 30, windowSeconds: 3600 }],
} as const satisfies Record<string, readonly Rule[]>;

export type PolicyName = keyof typeof POLICIES;

/** Who is asking. Leave a kind out when it is not known; a rule for it is then skipped. */
export type Subjects = Partial<Record<Subject, string | null | undefined>>;

export interface HitAnswer {
  allowed: boolean;
  /** Seconds until the window ends and the key may try again. */
  retryAfter: number;
}

/** Counts one hit for a key and answers whether it is still within its limit. The database supplies the real one. */
export interface HitCounter {
  hit(key: string, windowSeconds: number, max: number): Promise<HitAnswer>;
}

export type Verdict = { allowed: true } | { allowed: false; retryAfter: number };

/** A fixed-length stand-in for a subject: the same input always gives the same key, and the key says nothing about it. */
export function subjectKey(policy: string, by: Subject, value: string): string {
  const digest = createHash("sha256").update(`${by}\u0000${value.trim().toLowerCase()}`).digest("hex").slice(0, 32);
  return `${policy}:${by}:${digest}`;
}

/**
 * Count this try against every rule of the policy that has a subject, and say whether it may go ahead.
 * Every rule is counted even after one has refused, so no counter lags behind what really happened.
 * The longest wait among the refusing rules is the one reported.
 */
export async function checkRate(counter: HitCounter, policy: PolicyName, subjects: Subjects, options: { failClosed?: boolean } = {}): Promise<Verdict> {
  let retryAfter = 0;
  let blocked = false;
  for (const rule of POLICIES[policy] as readonly Rule[]) {
    const subject = subjects[rule.by];
    if (!subject || !subject.trim()) continue;
    try {
      const answer = await counter.hit(subjectKey(policy, rule.by, subject), rule.windowSeconds, rule.max);
      if (!answer.allowed) {
        blocked = true;
        retryAfter = Math.max(retryAfter, answer.retryAfter);
      }
    } catch (error) {
      // Only the kind of failure is kept: the message could name the database.
      console.error(`[rate-limit] the counter failed (${policy}):`, error instanceof Error ? error.name : typeof error);
      if (options.failClosed) {
        blocked = true;
        retryAfter = Math.max(retryAfter, 60);
      }
    }
  }
  return blocked ? { allowed: false, retryAfter: Math.max(1, retryAfter) } : { allowed: true };
}

/** "Please wait a minute", "about 5 minutes", "about an hour": a wait in words a busy person can use. */
export function waitInWords(seconds: number): string {
  if (seconds <= 90) return "a minute";
  if (seconds < 3600 - 300) return `about ${Math.ceil(seconds / 60)} minutes`;
  if (seconds <= 5400) return "about an hour";
  return `about ${Math.ceil(seconds / 3600)} hours`;
}

/** What the form says when it is turned away. It does not say which rule, or whose count. */
export const tooManyTries = (retryAfter: number): string => `Too many tries. Please wait ${waitInWords(retryAfter)} and try again.`;

/**
 * The network address of the caller, from the header the host's proxy sets, or undefined.
 *
 * The header can hold a chain ("client, proxy1, proxy2"); anyone can start the chain with a made-up address,
 * but only the proxies in front of the app add to its END, so the LAST entry is the one a caller cannot
 * choose (with one trusted proxy in front, as on most hosts). Behind a CDN that sets its own single header,
 * name that header in CLIENT_IP_HEADER. A value that is not an address is ignored.
 */
export function clientIp(headers: { get(name: string): string | null }, headerName = "x-forwarded-for"): string | undefined {
  const raw = headers.get(headerName);
  if (!raw) return undefined;
  const last = raw.split(",").at(-1)?.trim();
  // IPv4 may arrive with a port ("1.2.3.4:5678"); an IPv6 address has colons of its own.
  const candidate = last && /^\d+\.\d+\.\d+\.\d+:\d+$/.test(last) ? last.slice(0, last.lastIndexOf(":")) : last;
  return candidate && isIP(candidate) ? candidate : undefined;
}
