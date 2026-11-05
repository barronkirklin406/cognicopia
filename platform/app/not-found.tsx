import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

/**
 * An address that leads nowhere. Our own page rather than Next.js's default one, because the default carries
 * an inline style block, which this site's Content-Security-Policy refuses (it would show unstyled).
 */
export default function NotFound() {
  return (
    <main id="main" className="narrow stack">
      <h1>We could not find that page</h1>
      <p>The address may have been typed wrongly, or the page may have moved.</p>
      <p>
        <Link className="btn" href="/dashboard">
          Go to your home page
        </Link>
      </p>
    </main>
  );
}
