/* =====================================================================
   The email that carries a license key to the address the buyer gave at
   checkout. Sent through Resend's HTTP API (nothing to install): the
   sender lives in one function, sendEmail, so another provider is a small
   change. The key is in the body of this one message and nowhere else:
   it is never written to a log and never returned by the webhook.
   ===================================================================== */
const TIER_NAME = { monthly_facility: "monthly facility license", annual_facility: "annual facility license", enterprise: "enterprise license" };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dateText = (iso) => { const d = new Date(iso + "T12:00:00Z"); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }); };

/** The message: plain text first (what every mail program shows), and a simple HTML copy. */
export function licenseEmail({ licenseKey, facilityName, tier, expiresAt, siteUrl }) {
  const plan = TIER_NAME[tier] || "facility license";
  const link = `${siteUrl.replace(/\/+$/, "")}/activate.html#license_key=${licenseKey}`;
  const through = dateText(expiresAt);
  const subject = `Your Cognicopia license key for ${facilityName}`;
  const text = [
    "Thank you for choosing Cognicopia.",
    "",
    `Your ${plan} for ${facilityName} is paid through ${through}.`,
    "",
    "YOUR LICENSE KEY",
    licenseKey,
    "",
    "To turn it on: open Cognicopia on any computer in your building, choose \"License Key / Promo\" at the top of the page, paste the key, and choose Activate Access.",
    "Or open this link on that computer and it turns on by itself:",
    link,
    "",
    "The key is checked on the computer itself, so it works with no internet and keeps working after a restart. Use it on every computer in your building.",
    "",
    "Please keep this email. Stripe also sends your payment receipt separately.",
    "",
    "Questions? Reply to this email or write to cognicopia@outlook.com.",
    "Cognicopia, made by BarronCrafts.",
  ].join("\n");
  const html = `<!doctype html><html lang="en"><body style="margin:0;padding:24px;background:#f6f3ec;color:#10241a;font:17px/1.55 Arial,Helvetica,sans-serif">
<div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
<h1 style="margin:0 0 12px;font-size:24px">Thank you for choosing Cognicopia</h1>
<p>Your ${esc(plan)} for <b>${esc(facilityName)}</b> is paid through <b>${esc(through)}</b>.</p>
<p style="margin:20px 0 6px"><b>Your license key</b></p>
<p style="margin:0;padding:14px;background:#eef6f0;border:1px solid #b7e4c7;border-radius:8px;font:14px/1.4 Consolas,Menlo,monospace;word-break:break-all">${esc(licenseKey)}</p>
<p style="margin-top:20px">To turn it on: open Cognicopia on any computer in your building, choose <b>License Key / Promo</b> at the top of the page, paste the key, and choose <b>Activate Access</b>.</p>
<p><a href="${esc(link)}" style="display:inline-block;padding:14px 22px;background:#1b4332;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold">Or press here to turn it on</a></p>
<p>The key is checked on the computer itself, so it works with no internet and keeps working after a restart. Use it on every computer in your building.</p>
<p>Please keep this email. Stripe also sends your payment receipt separately.</p>
<p style="color:#4a5a52;font-size:15px">Questions? Reply to this email or write to cognicopia@outlook.com.<br>Cognicopia, made by BarronCrafts.</p>
</div></body></html>`;
  return { subject, text, html };
}

/** Send one email through Resend. A failure throws, so the webhook answers with an error and Stripe tries again later. */
export async function sendEmail({ apiKey, from, replyTo, to, subject, text, html, idempotencyKey }, fetchImpl = fetch, base = "https://api.resend.com") {
  const res = await fetchImpl(`${base}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: JSON.stringify({ from, to: [to], subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) {
    const e = new Error(`The email service answered ${res.status}.`);
    e.status = 502; e.code = "email_failed";
    throw e;
  }
}
