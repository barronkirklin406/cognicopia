"use client";

/**
 * Anything unexpected on a page lands here, instead of a blank screen or a stack
 * trace. It says nothing technical: what went wrong is logged on the server.
 */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="narrow stack">
      <h1>Something went wrong</h1>
      <p>We could not show this page. Nothing you entered has been lost or changed. Try again, and if it keeps happening, contact support.</p>
      <p>
        <button type="button" className="btn" onClick={() => reset()}>
          Try again
        </button>
      </p>
    </main>
  );
}
