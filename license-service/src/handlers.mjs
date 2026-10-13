/* =====================================================================
   The three web addresses this service answers, written against the
   standard Request and Response so the same code runs on Netlify,
   Cloudflare Workers and Vercel:

     POST /api/licenses/webhook   Stripe calls this when someone pays. It checks the
                         call really came from Stripe, reads the payment back
                         from Stripe, makes the license key and emails it to
                         the address the buyer gave at checkout.
     POST /api/licenses/redeem    activate.html on the static site calls this with the
                         checkout reference Stripe sent the buyer back with,
                         and shows the key on screen as well.
     GET  /api/licenses/health which settings are present (names only, never values).

   Settings (the host's environment; real values never go in the repository):
     STRIPE_RESTRICTED_KEY   a Stripe key that can only READ checkout sessions and subscriptions
     STRIPE_WEBHOOK_SECRET   whsec_..., from the webhook endpoint's page in Stripe
     STRIPE_PRICE_MONTHLY, STRIPE_PRICE_ANNUAL   the two price ids
     LICENSE_SIGNING_KEY     the private key (PEM) that signs license keys
     RESEND_API_KEY          the email service's key
     EMAIL_FROM              for example  Cognicopia <licenses@cognicopia.org>
     EMAIL_REPLY_TO          optional, for example cognicopia@outlook.com
     SITE_URL                default https://cognicopia.org
     LICENSE_ALLOWED_ORIGINS default https://cognicopia.org (comma separated)
   A missing setting breaks only what needs it, and the answer names the setting, never a value.
   ===================================================================== */
import { CHECKOUT_REFERENCE, ServiceError, licenseFromSession, redeemCheckout } from "./redeem.mjs";
import { licenseEmail, sendEmail } from "./email.mjs";
import { retrieveCheckoutSession, verifyStripeSignature } from "./stripe.mjs";

const SETTINGS = ["STRIPE_RESTRICTED_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_MONTHLY", "STRIPE_PRICE_ANNUAL", "LICENSE_SIGNING_KEY", "RESEND_API_KEY", "EMAIL_FROM"];
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });
const problem = (status, code, message, headers) => json(status, { error: { code, message } }, headers);
const get = (env, name) => (env && typeof env[name] === "string" ? env[name].trim() : "");

/** Throws a 503 that names the missing setting. */
function need(env, ...names) {
  const out = {};
  for (const n of names) {
    out[n] = get(env, n);
    if (!out[n]) throw new ServiceError(503, "not_set_up", `This service is not set up yet: ${n} is missing.`);
  }
  return out;
}
const prices = (env) => ({ monthly: get(env, "STRIPE_PRICE_MONTHLY"), annual: get(env, "STRIPE_PRICE_ANNUAL") });
const siteUrl = (env) => get(env, "SITE_URL") || "https://cognicopia.org";
const origins = (env) => (get(env, "LICENSE_ALLOWED_ORIGINS") || "https://cognicopia.org").split(",").map((s) => s.trim()).filter(Boolean);

function fail(error) {
  if (error instanceof ServiceError || (error && typeof error.status === "number" && typeof error.code === "string")) return problem(error.status, error.code, error.message);
  console.error("license-service: unexpected error");                    // no detail: a message could carry a value
  return problem(500, "server_error", "Something went wrong on our side.");
}

/* ---------- /api/licenses/redeem ---------- */
const hits = new Map();
export function takeTry(key, now = Date.now(), limit = 10, windowMs = 60_000) {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) { hits.set(key, recent); return false; }
  recent.push(now); hits.set(key, recent);
  if (hits.size > 5000) for (const [k, list] of hits) if (list.every((t) => now - t >= windowMs)) hits.delete(k);
  return true;
}
const clientAddress = (request) => (request.headers.get("x-nf-client-connection-ip") || request.headers.get("cf-connecting-ip") || (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown");
const cors = (origin, allowed) => (origin && allowed.includes(origin)
  ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "600", Vary: "Origin" }
  : { Vary: "Origin" });

export async function handleRedeem(request, env, deps = {}) {
  try {
    const allowed = origins(env), origin = request.headers.get("origin"), headers = cors(origin, allowed);
    if (request.method === "OPTIONS") return new Response(null, { status: headers["Access-Control-Allow-Origin"] ? 204 : 403, headers });
    if (request.method !== "POST") return problem(405, "method_not_allowed", "Use POST.", headers);
    if (origin && !headers["Access-Control-Allow-Origin"]) return problem(403, "forbidden_origin", "This request came from a site that may not use it.", headers);
    if (!takeTry(clientAddress(request), deps.now?.().getTime?.())) return problem(429, "rate_limited", "Too many tries. Please wait a few minutes.", headers);
    let body = null;
    try { body = await request.json(); } catch { /* handled below */ }
    const reference = body && typeof body.session_id === "string" ? body.session_id : "";
    if (!reference || reference.length > 300) return problem(422, "invalid", "Send the checkout reference as session_id.", headers);
    const s = need(env, "STRIPE_RESTRICTED_KEY", "STRIPE_PRICE_MONTHLY", "STRIPE_PRICE_ANNUAL", "LICENSE_SIGNING_KEY");
    const done = await redeemCheckout({ stripeKey: s.STRIPE_RESTRICTED_KEY, signingKey: s.LICENSE_SIGNING_KEY, prices: prices(env), fetch: deps.fetch, now: deps.now }, reference);
    return json(200, { license_key: done.licenseKey, facility_name: done.facilityName, tier: done.tier, expires_at: done.expiresAt }, headers);
  } catch (error) {
    return fail(error);
  }
}

/* ---------- /api/licenses/webhook ---------- */
const PAID_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

export async function handleWebhook(request, env, deps = {}) {
  try {
    if (request.method !== "POST") return problem(405, "method_not_allowed", "Use POST.");
    const s = need(env, "STRIPE_WEBHOOK_SECRET", "STRIPE_RESTRICTED_KEY", "STRIPE_PRICE_MONTHLY", "STRIPE_PRICE_ANNUAL", "LICENSE_SIGNING_KEY", "RESEND_API_KEY", "EMAIL_FROM");
    const raw = await request.text();
    const now = deps.now ? deps.now().getTime() : Date.now();
    if (!(await verifyStripeSignature(raw, request.headers.get("stripe-signature"), s.STRIPE_WEBHOOK_SECRET, { now }))) {
      return problem(400, "bad_signature", "That did not come from Stripe.");
    }
    let event;
    try { event = JSON.parse(raw); } catch { return problem(400, "bad_json", "That is not a Stripe event."); }
    if (!event || !PAID_EVENTS.has(event.type)) return json(200, { received: true, ignored: true });

    const id = event.data?.object?.id;
    if (typeof id !== "string" || !CHECKOUT_REFERENCE.test(id)) return json(200, { received: true, ignored: true });

    // The event only says WHICH session. What it is, and whether it is paid, is read back from Stripe.
    const session = await retrieveCheckoutSession(id, s.STRIPE_RESTRICTED_KEY, deps.fetch);
    let license;
    try {
      license = await licenseFromSession({ signingKey: s.LICENSE_SIGNING_KEY, prices: prices(env), now: deps.now }, session);
    } catch (error) {
      if (error instanceof ServiceError && (error.code === "not_a_license" || (error.code === "not_paid" && session.payment_status === "unpaid"))) {
        return json(200, { received: true, ignored: true });                // another product, or a bank payment that has not cleared yet (a later event follows)
      }
      throw error;
    }
    const to = session.customer_details?.email || session.customer_email || "";
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      console.error(`license-service: ${id} has no email address to send the key to`);
      return json(200, { received: true, delivered: false, reason: "no_email" });
    }
    const message = licenseEmail({ ...license, siteUrl: siteUrl(env) });
    await sendEmail({ apiKey: s.RESEND_API_KEY, from: s.EMAIL_FROM, replyTo: get(env, "EMAIL_REPLY_TO") || undefined, to, ...message, idempotencyKey: `license-${id}` }, deps.fetch);
    console.log(`license-service: sent the license for ${id}`);
    return json(200, { received: true, delivered: true });
  } catch (error) {
    return fail(error);
  }
}

/* ---------- /api/licenses/health ---------- */
export function handleHealth(env) {
  const settings = {};
  for (const n of SETTINGS) settings[n] = !!get(env, n);
  return json(200, { ok: true, ready: Object.values(settings).every(Boolean), settings });
}

/** One entry for hosts that give a service a single function (Cloudflare Workers, a plain Node server). */
export async function route(request, env, deps) {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  if (path.endsWith("/api/licenses/webhook")) return handleWebhook(request, env, deps);
  if (path.endsWith("/api/licenses/redeem")) return handleRedeem(request, env, deps);
  if (path.endsWith("/api/licenses/health")) return handleHealth(env);
  return problem(404, "not_found", "Nothing is here.");
}
