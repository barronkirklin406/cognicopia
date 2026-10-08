import type { ReactNode } from "react";

/** The top of a planning page: one large heading, and one plain sentence on what the page is for. */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="grid gap-1 print:hidden">
      <h1 className="m-0 font-display text-3xl font-bold leading-tight text-ink">{title}</h1>
      {children ? <p className="m-0 text-lg text-ink-soft">{children}</p> : null}
    </header>
  );
}
