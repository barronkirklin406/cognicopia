import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Cognicopia for facilities", template: "%s · Cognicopia" },
  description: "Activity content and monthly planning for memory care facilities.",
  robots: { index: false, follow: false }, // a sign-in portal, not a page to find in search
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to the content
        </a>
        {children}
      </body>
    </html>
  );
}
