import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/billing/stripe";
import { getLicenseConfig } from "@/lib/env.server";
import { handleError, issuesOf, problem, readJson } from "@/lib/http";
import { RateLimiter } from "@/lib/licenses/rate-limit";
import { redeemCheckout, type RedeemDeps } from "@/lib/licenses/redeem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ session_id: z.string().min(1).max(300) });

/** Ten tries a minute from one address: a buyer needs one. */
const limiter = new RateLimiter(10, 60_000);

const clientAddress = (request: Request): string =>
  (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

/** The headers that let the static site's activate.html read the answer. Only a listed site gets them. */
function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  return origin && allowed.includes(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "600", Vary: "Origin" }
    : { Vary: "Origin" };
}

/** The browser's check before it sends the JSON. */
export async function OPTIONS(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const headers = corsHeaders(origin, getLicenseConfig().allowedOrigins);
    return new NextResponse(null, { status: headers["Access-Control-Allow-Origin"] ? 204 : 403, headers });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/licenses/redeem  { "session_id": "cs_live_..." }
 *   -> { "license_key": "COG1....", "facility_name", "tier", "expires_at" }
 *
 * Public on purpose, and the only thing it can do is turn a PAID Stripe checkout for one of our two
 * prices into a signed license key (lib/licenses/redeem.ts). It reads nothing from the database and holds
 * no resident information: the key carries a business name and two dates. Called from activate.html on
 * the static site, and only by a page on LICENSE_ALLOWED_ORIGINS. Errors are { error: { code, message } }:
 * not_paid (402), not_found (404), rate_limited (429), not_a_license (422).
 */
export async function POST(request: Request) {
  try {
    const config = getLicenseConfig();
    const origin = request.headers.get("origin");
    const cors = corsHeaders(origin, config.allowedOrigins);
    if (origin && !cors["Access-Control-Allow-Origin"]) return problem(403, "forbidden_origin", "This request came from a site that may not use it.");
    const reply = (response: NextResponse) => {
      for (const [name, value] of Object.entries(cors)) response.headers.set(name, value);
      response.headers.set("Cache-Control", "no-store");
      return response;
    };

    if (!limiter.take(clientAddress(request))) return reply(problem(429, "rate_limited", "Too many tries. Please wait a few minutes."));
    const body = Body.safeParse(await readJson(request));
    if (!body.success) return reply(problem(422, "invalid", "Send the checkout reference as session_id.", issuesOf(body.error)));

    try {
      const deps: RedeemDeps = { stripe: getStripe() as unknown as RedeemDeps["stripe"], signingKey: config.signingKey, prices: config.prices };
      const done = await redeemCheckout(deps, body.data.session_id);
      return reply(NextResponse.json({ license_key: done.licenseKey, facility_name: done.facilityName, tier: done.tier, expires_at: done.expiresAt }));
    } catch (error) {
      return reply(handleError(error));
    }
  } catch (error) {
    return handleError(error);
  }
}
