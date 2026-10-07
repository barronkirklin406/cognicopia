import { useId, type ReactNode } from "react";

/** A labelled row of chips. The label is visible and names the group for a screen reader. */
export function ChipGroup({ label, children, note }: { label: string; children: ReactNode; note?: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="grid gap-2">
      <p id={id} className="m-0 text-base font-bold text-ink">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
      {note ? <p className="m-0 text-base text-ink-soft">{note}</p> : null}
    </div>
  );
}
