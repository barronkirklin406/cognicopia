import type { ReactNode } from "react";

/** A short label. The words carry the meaning; the border and fill only add to it. */
export function Tag({ tone = "plain", children }: { tone?: "plain" | "stage" | "warn"; children: ReactNode }) {
  const look = tone === "stage" ? "border-garden-dark bg-tint text-good-ink" : tone === "warn" ? "border-gold bg-warn-tint text-ink" : "border-ink-soft bg-white text-ink";
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border-2 px-3 py-0.5 text-sm font-bold print:border-black print:text-black ${look}`}>{children}</span>;
}
