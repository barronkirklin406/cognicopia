"use client";

import type { ReactNode } from "react";
import { flushSync } from "react-dom";

/**
 * Opens the browser's print dialog. `before` runs first and is drawn to the page before the dialog
 * opens (a calendar chooses which stages to print there), so the printout is what was asked for.
 */
export function PrintButton({ children, before, variant = "primary" }: { children: ReactNode; before?: () => void; variant?: "primary" | "secondary" }) {
  const look = variant === "primary" ? "border-garden-dark bg-garden-dark text-white hover:bg-paper" : "border-garden-dark bg-white text-garden-dark hover:bg-tint";
  return (
    <button
      type="button"
      onClick={() => {
        if (before) flushSync(before);
        window.print();
      }}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border-2 px-5 font-[inherit] text-base font-bold ${look} print:hidden`}
    >
      {children}
    </button>
  );
}
