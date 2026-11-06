import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Cognicopia for facilities", template: "%s · Cognicopia" },
  description: "Activity content and monthly planning for memory care facilities.",
  robots: { index: false, follow: false }, // a sign-in portal, not a page to find in search
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/**
 * Every page is drawn for each request. The Content-Security-Policy carries a fresh nonce per request
 * (proxy.ts), and a page built ahead of time has none to put on its scripts, so they would not run.
 */
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip print:hidden" href="#main">
          Skip to the content
        </a>
        {children}
      </body>
    </html>
  );
}
