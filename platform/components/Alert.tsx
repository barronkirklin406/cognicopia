import type { ReactNode } from "react";

/**
 * A message, in one of three tones. A problem is announced to screen readers as
 * soon as it appears (role="alert"); good news and information politely
 * (role="status"). The tone is never colour alone: the border and the wording say it too.
 */
export function Alert({ tone = "info", title, children }: { tone?: "info" | "warn" | "bad"; title?: string; children?: ReactNode }) {
  return (
    <div className={`alert ${tone}`} role={tone === "bad" ? "alert" : "status"}>
      {title ? <strong>{title}</strong> : null}
      {children}
    </div>
  );
}
