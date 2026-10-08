import { DataError } from "@/lib/data/errors";

/**
 * A setting the server needs is missing or malformed. It carries the NAMES of
 * the variables, never their values, so it is safe to log and to show in a
 * developer's terminal. A route turns it into a 503: the feature is not set up
 * yet, which is not the caller's fault.
 */
export class ConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(`Missing or invalid environment variable(s): ${missing.join(", ")}. See .env.example.`);
    this.name = "ConfigError";
    this.missing = missing;
  }
}

/**
 * What Stripe's SDK throws, turned into something a caller can be told. Stripe's
 * own message is neither returned nor logged: it can name ids and parameters.
 * Only the error's class and code are logged by handleError.
 *
 * Detected by the error's `type` string ("StripeInvalidRequestError" and so on)
 * rather than by importing Stripe, so this file stays free of it.
 */
export function isStripeError(error: unknown): error is { type: string; code?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof (error as { type: unknown }).type === "string" &&
    (error as { type: string }).type.startsWith("Stripe")
  );
}

export function fromStripeError(error: { type: string }): DataError {
  switch (error.type) {
    case "StripeRateLimitError":
    case "RateLimitError":
      return new DataError(429, "rate_limited", "Too many requests. Try again in a moment.");
    case "StripeConnectionError":
      return new DataError(503, "billing_unavailable", "We could not reach the billing service. Try again in a moment.");
    case "StripeAuthenticationError":
    case "StripePermissionError":
      return new DataError(502, "billing_misconfigured", "Billing is not set up correctly. Please contact support.");
    default:
      return new DataError(502, "billing_error", "We could not complete that with the billing service. Please try again, or contact support if it continues.");
  }
}
