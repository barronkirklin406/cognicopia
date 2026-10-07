import type { NextConfig } from "next";

/**
 * Headers sent with every response. They are plain defences that cost nothing:
 *
 *   X-Frame-Options and frame-ancestors   no other site may put this one in a frame (the billing and
 *                                          team pages must not be clickjackable)
 *   Referrer-Policy: no-referrer          an invitation link carries a secret in its address; it must
 *                                          never be passed on to another site in a Referer header
 *   X-Content-Type-Options                the browser takes a file for what it is sent as
 *   form-action 'self', base-uri, object  forms can post only here; nothing can re-point links or embed plugins
 *   Strict-Transport-Security             browsers use https for a year (in production only)
 *
 * A full Content-Security-Policy for scripts is a next step (it needs nonces, which Next.js can
 * add per request); this one is the part that needs none.
 */
const security = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: security }];
  },
};

export default config;
