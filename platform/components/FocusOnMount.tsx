"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Moves keyboard focus to its content when it appears, so a screen reader reads it out.
 * For the confirmation after a change that redraws the page: the button that was
 * pressed is gone, and without this focus would fall back to the top of the page with
 * no word on whether it worked.
 */
export function FocusOnMount({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div ref={ref} tabIndex={-1} className="focus-target">
      {children}
    </div>
  );
}
