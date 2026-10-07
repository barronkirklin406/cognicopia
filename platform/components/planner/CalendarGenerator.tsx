"use client";

import { useActionState, useId, useMemo, useState } from "react";
import { saveGeneratedCalendarAction } from "@/app/calendar/actions";
import { Alert } from "@/components/Alert";
import { FormAlerts, SubmitButton } from "@/components/forms";
import { emptyState } from "@/lib/auth/state";
import type { ContentItem } from "@/lib/db/models";
import { generateCalendar, newSeed, toGeneratorItem, type Plan } from "@/lib/domain/calendar-generator";
import { monthLabel } from "@/lib/domain/months";
import { STAGES, type TrackStage } from "@/lib/domain/stages";
import { themeLabel } from "@/lib/domain/themes";
import { CalendarView } from "./CalendarView";
import { Chip } from "./Chip";
import { ChipGroup } from "./ChipGroup";
import { ThemePicker, type ThemeChoice } from "./ThemePicker";

/**
 * The one-click month planner. Choose a month and a theme (and, if you like, the stages and how
 * many sessions a day) and a full month appears, drawn from the activity library; "Mix it up"
 * makes another from the same choices; "Save" keeps it for the facility. The preview is made here,
 * in the browser, by the same pure function the server uses; the server is sent only the choices
 * and the seed of the mix, and makes the calendar itself, so what is saved is what was shown.
 */
export function CalendarGenerator({
  library,
  months,
  savedMonths,
  initialMonth,
  initialSeed,
  facilityName,
}: {
  library: ContentItem[];
  months: string[];
  /** Months that already have a saved calendar: saving one of these replaces it. */
  savedMonths: string[];
  initialMonth: string;
  initialSeed: string;
  facilityName: string;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [theme, setTheme] = useState<ThemeChoice>("none");
  const [stages, setStages] = useState<TrackStage[]>(STAGES.map((s) => s.id));
  const [perDay, setPerDay] = useState<2 | 3>(3);
  const [seed, setSeed] = useState(initialSeed);
  const [state, formAction, pending] = useActionState(saveGeneratedCalendarAction, emptyState);
  const monthId = useId();

  const plan: Plan = useMemo(() => ({ month, theme, stages, perDay, seed }), [month, theme, stages, perDay, seed]);
  const generatorItems = useMemo(() => library.map(toGeneratorItem), [library]);
  const made = useMemo(() => generateCalendar(plan, generatorItems), [plan, generatorItems]);
  const activities = useMemo(() => Object.fromEntries(library.map((item) => [item.id, item])), [library]);

  const replaces = savedMonths.includes(month);
  const toggleStage = (stage: TrackStage) =>
    setStages((current) => {
      const next = current.includes(stage) ? current.filter((s) => s !== stage) : STAGES.map((s) => s.id).filter((id) => id === stage || current.includes(id));
      return next.length > 0 ? next : current; // at least one stage is always chosen
    });

  return (
    <div className="grid gap-6">
      <section aria-label="Plan the month" className="grid gap-5 rounded-xl border-2 border-rule bg-white p-4">
        <div className="grid gap-1 sm:max-w-sm">
          <label htmlFor={monthId} className="text-base font-bold">
            Month
          </label>
          <select
            id={monthId}
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="min-h-11 w-full rounded-lg border-2 border-ink-soft bg-white px-3 py-2 font-[inherit] text-base text-ink"
          >
            {months.map((value) => (
              <option key={value} value={value}>
                {monthLabel(value)}
                {savedMonths.includes(value) ? " (already saved)" : ""}
              </option>
            ))}
          </select>
        </div>

        <ThemePicker value={theme} onChange={setTheme} />

        <ChipGroup label="Stages to plan for" note={stages.length === 1 ? "At least one stage is always chosen." : undefined}>
          {STAGES.map((stage) => (
            <Chip key={stage.id} pressed={stages.includes(stage.id)} onClick={() => toggleStage(stage.id)}>
              {stage.label}
            </Chip>
          ))}
        </ChipGroup>

        <ChipGroup label="Sessions each day">
          {([2, 3] as const).map((count) => (
            <Chip key={count} pressed={perDay === count} onClick={() => setPerDay(count)}>
              {count === 2 ? "Two a day" : "Three a day"}
            </Chip>
          ))}
        </ChipGroup>

        <div>
          <button
            type="button"
            onClick={() => setSeed(newSeed())}
            className="min-h-11 cursor-pointer rounded-lg border-2 border-garden-dark bg-white px-5 font-[inherit] text-base font-bold text-garden-dark hover:bg-tint"
          >
            Mix it up
          </button>
          <span className="ml-3 text-base text-ink-soft">Makes a different month from the same choices.</span>
        </div>
      </section>

      <section aria-label="Preview" className="grid gap-4">
        <h2 className="m-0 font-display text-2xl font-bold text-ink">
          Preview: {monthLabel(month)}
          {theme !== "none" ? `, ${themeLabel(theme)}` : ""}
        </h2>
        {made.ok ? (
          <>
            <p role="status" aria-live="polite" className="m-0 text-lg font-bold text-ink">
              {made.stats.sessions} sessions across {made.data.groups.length} {made.data.groups.length === 1 ? "stage" : "stages"}, using {made.stats.distinct} different activities
              {theme !== "none" ? `. ${made.stats.themed} of them (${Math.round((made.stats.themed / made.stats.sessions) * 100)}%) fit the ${themeLabel(theme)} theme` : ""}.
            </p>
            {made.stats.skipped.length > 0 ? (
              <Alert tone="warn">The library has nothing for {made.stats.skipped.map((s) => STAGES.find((x) => x.id === s)?.label ?? s).join(" or ")} yet, so it is left out.</Alert>
            ) : null}
            <CalendarView key={plan.stages.join("-")} month={month} data={made.data} activities={activities} mode="preview" />
          </>
        ) : (
          <Alert tone="warn">{made.message}</Alert>
        )}
      </section>

      <form action={formAction} className="sticky bottom-0 z-10 grid gap-3 rounded-xl border-2 border-garden-dark bg-white p-4 shadow-lg print:hidden">
        <input type="hidden" name="month" value={month} />
        <input type="hidden" name="theme" value={theme} />
        {stages.map((stage) => (
          <input key={stage} type="hidden" name="stages" value={stage} />
        ))}
        <input type="hidden" name="perDay" value={perDay} />
        <input type="hidden" name="seed" value={seed} />

        <FormAlerts state={state} />
        {replaces ? <Alert tone="warn">A calendar for {monthLabel(month)} is already saved. Saving this one replaces it.</Alert> : null}
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton
            pending={pending}
            pendingText="Saving…"
            className="min-h-11 cursor-pointer rounded-lg border-2 border-garden-dark bg-garden-dark px-6 font-[inherit] text-base font-bold text-white hover:bg-paper disabled:cursor-not-allowed disabled:opacity-70"
          >
            {replaces ? `Replace the saved calendar for ${monthLabel(month)}` : `Save the calendar for ${monthLabel(month)}`}
          </SubmitButton>
          <span className="text-base text-ink-soft">{facilityName}</span>
        </div>
      </form>
    </div>
  );
}
