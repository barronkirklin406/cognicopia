import "server-only";
import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/env.server";

/**
 * The Stripe client, and the narrow slice of it the billing code uses.
 *
 * `StripeApi` lists only the calls this app makes. The billing functions take
 * one as an argument, so they can be tested with a stand-in and never reach the
 * network, and so it is plain what the app can ask Stripe to do.
 */
export type StripeApi = {
  customers: Pick<Stripe["customers"], "create">;
  checkout: { sessions: Pick<Stripe["checkout"]["sessions"], "create"> };
  billingPortal: { sessions: Pick<Stripe["billingPortal"]["sessions"], "create"> };
  subscriptions: Pick<Stripe["subscriptions"], "list">;
  webhooks: Pick<Stripe["webhooks"], "constructEvent">;
};

interface DevelopmentBase {
  /** The address as a whole, used to tell whether it changed. */
  base: string;
  options: { host: string; port: number; protocol: "http" | "https" };
}

/**
 * For local testing only: STRIPE_API_BASE (say http://localhost:12111) points the
 * client at a stand-in Stripe server, so a browser test can run checkout without
 * a real account. It is ignored in production, so a stray variable can never send
 * live billing traffic somewhere else, and anything that is not a plain http(s)
 * address is ignored too.
 */
function developmentBase(): DevelopmentBase | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  const raw = process.env.STRIPE_API_BASE?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    const protocol = url.protocol === "https:" ? "https" : "http";
    return {
      base: url.origin,
      options: { host: url.hostname, port: Number(url.port || (protocol === "https" ? 443 : 80)), protocol },
    };
  } catch {
    return undefined;
  }
}

let cached: { key: string; base: string | undefined; client: Stripe } | undefined;

/**
 * The shared Stripe client, made on first use (not at import, so a build does not
 * need the key). It uses the API version this version of the library was written
 * for. Network calls are retried twice, and give up after 20 seconds.
 */
export function getStripe(): Stripe {
  const key = getStripeSecretKey();
  const development = developmentBase();
  if (cached?.key !== key || cached.base !== development?.base) {
    cached = {
      key,
      base: development?.base,
      client: new Stripe(key, {
        maxNetworkRetries: 2,
        timeout: 20_000,
        appInfo: { name: "cognicopia-platform", version: "0.1.0" },
        ...(development ? development.options : {}),
      }),
    };
  }
  return cached.client;
}
