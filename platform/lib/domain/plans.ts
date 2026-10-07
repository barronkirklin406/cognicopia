import { z } from "zod";

/**
 * The plans a facility can subscribe to. Safe to import anywhere, including
 * client components: it holds no price ids and no keys. Which Stripe price each
 * plan maps to is a server setting (STRIPE_PRICE_MONTHLY, STRIPE_PRICE_ANNUAL),
 * so a browser can only ever ask for a plan by name, never for an arbitrary price.
 *
 * To add a tier, add its id here, a price variable in lib/env.server.ts and
 * .env.example, and a line in PRICE_VARIABLES.
 */

export const PLAN_IDS = ["monthly", "annual"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export const PlanSchema = z.enum(PLAN_IDS);

export interface Plan {
  id: PlanId;
  name: string;
  interval: "month" | "year";
  description: string;
}

export const PLANS: readonly Plan[] = [
  { id: "monthly", name: "Monthly", interval: "month", description: "Billed every month. Cancel any time." },
  { id: "annual", name: "Annual", interval: "year", description: "Billed once a year." },
];
