import { useId } from "react";
import { THEMES, type ThemeId } from "@/lib/domain/themes";

export type ThemeChoice = ThemeId | "none";

/**
 * The theme of a month, as large radio cards: "Spring", "1950s nostalgia", "Aviation" and the rest,
 * each with a line on what it brings, and "No theme" for a mix of everything. Native radio buttons,
 * so the arrow keys move between them and a screen reader says "1 of 14"; the chosen card is
 * filled and ticked, never colour alone.
 */
export function ThemePicker({ value, onChange }: { value: ThemeChoice; onChange: (theme: ThemeChoice) => void }) {
  const name = useId();
  const options: { id: ThemeChoice; label: string; blurb: string }[] = [{ id: "none", label: "No theme", blurb: "A mix of everything in the library" }, ...THEMES];
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-2 p-0 text-base font-bold text-ink">Theme for the month</legend>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <label key={option.id} className="block cursor-pointer">
            <input type="radio" name={name} value={option.id} checked={value === option.id} onChange={() => onChange(option.id)} className="peer sr-only" />
            <span className="grid h-full min-h-11 gap-0.5 rounded-xl border-2 border-ink-soft bg-white p-3 text-ink hover:bg-tint peer-checked:border-garden-dark peer-checked:bg-garden-dark peer-checked:text-white peer-focus-visible:outline-4 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-garden-dark">
              <span className="text-base font-bold">
                {value === option.id ? <span aria-hidden="true">✓ </span> : null}
                {option.label}
              </span>
              <span className="text-sm leading-snug">{option.blurb}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
