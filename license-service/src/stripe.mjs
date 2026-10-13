/* =====================================================================
   The two things this service needs from Stripe, with no library:
     - read one checkout session (a plain HTTPS request with a read-only key)
     - check that a webhook really came from Stripe (an HMAC of the body)
   ===================================================================== */
const enc = new TextEncoder();

function hexToBytes(hex) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/**
 * Stripe-Signature looks like  t=1700000000,v1=<hex>,v1=<hex>.  The signed text is  "<t>.<raw body>"  with
 * HMAC-SHA256 under the endpoint's signing secret (whsec_...). A body older than `tolerance` seconds is refused,
 * so a captured request cannot be replayed later. Returns true or false; never throws.
 */
export async function verifyStripeSignature(rawBody, header, secret, { now = Date.now(), tolerance = 300 } = {}) {
  try {
    if (!header || !secret) return false;
    const parts = String(header).split(",").map((p) => p.trim().split("="));
    const t = parts.find(([k]) => k === "t")?.[1];
    const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
    if (!t || !/^\d+$/.test(t) || sigs.length === 0) return false;
    if (Math.abs(now / 1000 - Number(t)) > tolerance) return false;
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    for (const hex of sigs) {
      const bytes = hexToBytes(hex);
      if (bytes && (await crypto.subtle.verify("HMAC", key, bytes, enc.encode(`${t}.${rawBody}`)))) return true;   // verify() compares in constant time
    }
    return false;
  } catch {
    return false;
  }
}

/** Read one checkout session, with its subscription and line items. `fetchImpl` is injectable for tests. */
export async function retrieveCheckoutSession(id, apiKey, fetchImpl = fetch, base = "https://api.stripe.com") {
  const url = `${base}/v1/checkout/sessions/${encodeURIComponent(id)}?expand[]=subscription&expand[]=line_items`;
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  let body = null;
  try { body = await res.json(); } catch { /* an empty or non-JSON answer is handled below */ }
  if (res.status === 404 || body?.error?.code === "resource_missing") { const e = new Error("No payment was found for that reference."); e.status = 404; e.code = "not_found"; throw e; }
  if (!res.ok || !body) { const e = new Error("Stripe could not be reached."); e.status = 502; e.code = "stripe_unavailable"; throw e; }
  return body;
}
