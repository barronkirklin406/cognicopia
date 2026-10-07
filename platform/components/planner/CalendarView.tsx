"use client";

import { useId, useMemo, useState } from "react";
import type { CalendarData } from "@/lib/domain/calendar";
import { dayLabel, monthLabel } from "@/lib/domain/months";
import { CalendarGrid, gridCaption } from "./CalendarGrid";
import { Chip } from "./Chip";
import { ChipGroup } from "./ChipGroup";
import { DayPlan, sessionsOn, type Activities } from "./DayPlan";
import { PrintButton } from "./PrintButton";
import { PrintCalendar } from "./PrintCalendar";

/**
 * A month's calendar, for the stage chosen: the grid (a list of days on a phone), and the day
 * tapped, opened below with how to run each session for that stage. When it is a saved calendar
 * it can be printed, one stage or all of them, one landscape page each, and the printout is a
 * separate plain layout (the print area below) rather than the screen one squeezed onto paper.
 */
export function CalendarView({
  month,
  data,
  activities,
  mode,
  facilityName,
}: {
  month: string;
  data: CalendarData;
  activities: Activities;
  /** A saved calendar can be printed; the generator's preview cannot. */
  mode: "saved" | "preview";
  facilityName?: string;
}) {
  const [groupId, setGroupId] = useState(data.groups[0]?.id ?? "");
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [printing, setPrinting] = useState<string[]>(data.groups.map((g) => g.id));
  const detailId = useId();

  // A different calendar (the generator's next mix) may not have the stage that was chosen.
  const group = data.groups.find((g) => g.id === groupId) ?? data.groups[0];
  const days = useMemo(() => [...new Set(data.slots.filter((s) => s.group_id === group?.id).map((s) => s.date))].sort(), [data.slots, group?.id]);

  if (!group) return <p className="m-0 text-base text-ink">This month has nothing planned yet.</p>;

  const printGroups = data.groups.filter((g) => printing.includes(g.id));
  const label = monthLabel(month);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        {data.groups.length > 1 ? (
          <ChipGroup label="Show the plan for">
            {data.groups.map((g) => (
              <Chip key={g.id} pressed={g.id === group.id} onClick={() => setGroupId(g.id)}>
                {g.name}
              </Chip>
            ))}
          </ChipGroup>
        ) : (
          <h2 className="m-0 font-display text-2xl font-bold text-ink">{group.name}</h2>
        )}

        {mode === "saved" ? (
          <div className="grid gap-1">
            <div className="flex flex-wrap gap-3">
              <PrintButton before={() => setPrinting([group.id])}>Print {data.groups.length > 1 ? group.name : "this calendar"}</PrintButton>
              {data.groups.length > 1 ? (
                <PrintButton variant="secondary" before={() => setPrinting(data.groups.map((g) => g.id))}>
                  Print all stages
                </PrintButton>
              ) : null}
            </div>
            <p className="m-0 text-sm text-ink-soft">Prints in large black type on landscape pages, one stage at a time. In the print dialog, choose Landscape and turn off headers and footers.</p>
          </div>
        ) : null}
      </div>

      <div className="print:hidden">
        <div className="hidden md:block">
          <CalendarGrid month={month} slots={data.slots} activities={activities} groupId={group.id} selected={selected} onSelect={setSelected} caption={`${gridCaption(month, group.name)}. Choose a day to see how to run its sessions.`} />
        </div>

        <div className="md:hidden">
          <h3 className="m-0 mb-3 font-display text-xl font-bold text-ink">{label}</h3>
          <ol className="m-0 grid list-none gap-4 p-0">
            {days.map((date) => (
              <li key={date} className="grid gap-2">
                <h4 className="m-0 font-display text-lg font-bold text-ink">{dayLabel(date)}</h4>
                <DayPlan date={date} groups={data.groups} slots={data.slots} activities={activities} only={group.id} />
              </li>
            ))}
          </ol>
        </div>

        <section aria-labelledby={detailId} className="mt-4 hidden md:block">
          <p role="status" className="sr-only">
            {selected ? `Showing ${dayLabel(selected)}.` : ""}
          </p>
          {selected ? (
            <div className="grid gap-3 rounded-xl border-2 border-garden-dark bg-field p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 id={detailId} className="m-0 font-display text-2xl font-bold text-ink">
                  {dayLabel(selected)}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelected(undefined)}
                  className="min-h-11 cursor-pointer rounded-lg border-2 border-garden-dark bg-white px-4 font-[inherit] text-base font-bold text-garden-dark hover:bg-tint"
                >
                  Close this day
                </button>
              </div>
              <DayPlan date={selected} groups={data.groups} slots={data.slots} activities={activities} only={group.id} headingLevel={4} />
              {sessionsOn(data.slots, selected, group.id).length === 0 ? null : <p className="m-0 text-sm text-ink-soft">These are suggestions. The people in the room and their care plans come first.</p>}
            </div>
          ) : (
            <p id={detailId} className="m-0 text-base text-ink-soft">
              Choose a day to see how to run its sessions.
            </p>
          )}
        </section>
      </div>

      {mode === "saved" ? (
        <div className="hidden print:block">
          {printGroups.map((g, index) => (
            <PrintCalendar key={g.id} month={month} groupId={g.id} groupName={g.name} slots={data.slots} activities={activities} facilityName={facilityName} firstOnPaper={index === 0} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
