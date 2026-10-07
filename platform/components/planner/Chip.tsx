import type { ReactNode } from "react";

/**
 * A filter chip: a button that is either chosen or not. Large (at least 44 px tall, with room
 * between chips), high contrast, and never colour alone: a chosen chip is filled and carries a
 * tick, and a screen reader hears "pressed". A count says what choosing it would show.
 */
export function Chip({
  pressed,
  onClick,
  count,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  /** How many items choosing this chip would show. */
  count?: number;
  children: ReactNode;
}) {
  const empty = count === 0 && !pressed;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={[
        "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-4 py-1.5 font-[inherit] text-base font-bold leading-tight",
        pressed ? "border-garden-dark bg-garden-dark text-white hover:bg-paper" : "border-ink-soft bg-white text-ink hover:bg-tint",
        empty ? "opacity-70" : "",
      ].join(" ")}
    >
      {pressed ? <span aria-hidden="true">✓</span> : null}
      <span>{children}</span>
      {count !== undefined ? (
        <span className={`rounded-full px-2 text-sm ${pressed ? "bg-white text-ink" : "bg-tint text-ink"}`}>
          {count}
          <span className="sr-only"> shown</span>
        </span>
      ) : null}
    </button>
  );
}
