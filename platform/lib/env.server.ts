import "server-only";
import { z } from "zod";
import { ConfigError } from "@/lib/errors";
import { PLAN_IDS, type PlanId } from "@/lib/domain/plans";
import { describe } from "./env";

/**
 * Settings only the server may see. Importing this from a client component
 * fails the build, because of "server-only".
 *
 * SUPABASE_SERVICE_ROLE_KEY bypasses row level security. It writes billing
 * columns, loads content and invites staff. Never expose it, and never use it
 * to answer a request on a user's behalf without first checking, in code, that
 * the user may do the thing.
 *
 * Every variable is documented in .env.example. A function here asks only for
 * what its caller needs, so a missing Stripe key breaks billing and nothing else.
 * A missing or malformed variable raises a ConfigError naming the variable, never
 * its value.
 */
const ServerEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof ServerEnv>;

export function getServerEnv(): ServerEnv {
  const parsed = ServerEnv.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!parsed.success) throw new Error(describe(parsed.error));
  return parsed.data;
}

// ---------------------------------------------------------------------
// Reading and checking
// ---------------------------------------------------------------------

/** An empty variable (`NAME=` in .env.local) counts as not set. */
const blank = (value: string | undefined): string | undefined => (value === undefined || value.trim() === "" ? undefined : value.trim());

/** Read the named variables from the environment and check them. Raises a ConfigError naming the bad ones. */
function read<S extends z.ZodRawShape>(shape: S): z.infer<z.ZodObject<S>> {
  const raw = Object.fromEntries(Object.keys(shape).map((name) => [name, blank(process.env[name])]));
  const parsed = z.object(shape).safeParse(raw);
  if (!parsed.success) throw new ConfigError([...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))]);
  return parsed.data;
}

// ---------------------------------------------------------------------
// Where this app lives
// ---------------------------------------------------------------------

const appUrlSchema = z.string().transform((value, ctx) => {
  try {
    const url = new URL(value);
    if (/^https?:$/.test(url.protocol)) return url.origin; // no path, no trailing slash
  } catch {
    // not an address at all: reported below, like any other bad value
  }
  ctx.addIssue({ code: "custom", message: "must be an http or https address" });
  return z.NEVER;
});

/**
 * APP_URL: the address people reach this app at, such as https://app.cognicopia.org.
 * Used to build the links Stripe and the sign-in emails send people back to, and
 * the invitation links admins share. It is never taken from a request header,
 * which a caller could forge.
 */
export function getAppUrl(): string {
  return read({ APP_URL: appUrlSchema }).APP_URL;
}

// ---------------------------------------------------------------------
// Stripe
// ---------------------------------------------------------------------

const stripeKey = z.string().regex(/^(sk|rk)_(test|live)_\S+$/, "must be a Stripe secret or restricted key");
const price = z.string().regex(/^price_\S+$/, "must be a Stripe price id");

/** The Stripe price for each plan. Add a plan to lib/domain/plans.ts and a line here. */
export const PRICE_VARIABLES = {
  monthly: "STRIPE_PRICE_MONTHLY",
  annual: "STRIPE_PRICE_ANNUAL",
} as const satisfies Record<PlanId, string>;

export function getStripeSecretKey(): string {
  return read({ STRIPE_SECRET_KEY: stripeKey }).STRIPE_SECRET_KEY;
}

export interface CheckoutConfig {
  appUrl: string;
  /** The Stripe price id for each plan. */
  prices: Record<PlanId, string>;
  /** A free trial on the new subscription, in days. Undefined for none. */
  trialDays: number | undefined;
}

export function getCheckoutConfig(): CheckoutConfig {
  const env = read({
    APP_URL: appUrlSchema,
    STRIPE_PRICE_MONTHLY: price,
    STRIPE_PRICE_ANNUAL: price,
    STRIPE_TRIAL_DAYS: z.coerce.number().int().min(1).max(90).optional(),
  });
  const prices = Object.fromEntries(PLAN_IDS.map((id) => [id, env[PRICE_VARIABLES[id]]])) as Record<PlanId, string>;
  return { appUrl: env.APP_URL, prices, trialDays: env.STRIPE_TRIAL_DAYS };
}

export interface PortalConfig {
  appUrl: string;
  /** A saved Stripe portal configuration (bpc_...). Undefined: Stripe's default one. */
  configurationId: string | undefined;
}

export function getPortalConfig(): PortalConfig {
  const env = read({
    APP_URL: appUrlSchema,
    STRIPE_PORTAL_CONFIGURATION_ID: z
      .string()
      .regex(/^bpc_\S+$/, "must be a Stripe portal configuration id")
      .optional(),
  });
  return { appUrl: env.APP_URL, configurationId: env.STRIPE_PORTAL_CONFIGURATION_ID };
}

/** STRIPE_WEBHOOK_SECRET (whsec_...): the signing secret of the webhook endpoint. */
export function getWebhookSecret(): string {
  return read({ STRIPE_WEBHOOK_SECRET: z.string().regex(/^whsec_\S+$/, "must be a Stripe webhook signing secret") }).STRIPE_WEBHOOK_SECRET;
}
