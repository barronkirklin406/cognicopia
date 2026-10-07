import type { ContentItem } from "@/lib/db/models";
import type { CalendarGroup, CalendarSlot } from "@/lib/domain/calendar";
import { formatsOf, FORMAT_LABELS, displayTitle } from "@/lib/domain/formats";
import { timeLabel } from "@/lib/domain/months";
import { trackOf } from "@/lib/domain/stages";
import { ActivityDetails } from "./ActivityDetails";
import { Tag } from "./Tag";

export type Activities = Record<string, ContentItem>;

/** What a session is called: the library's title, or a plain word when the item cannot be found (it may have been withdrawn). */
export const sessionTitle = (slot: CalendarSlot, activities: Activities): string => {
  const item = activities[slot.content_item_id];
  return item ? displayTitle(item) : "An activity";
};

/** What a session is called on paper: the library's own title, without the "Reminiscence:" tag the screen adds. */
export const plainTitle = (slot: CalendarSlot, activities: Activities): string => activities[slot.content_item_id]?.title ?? "An activity";

/** A day's sessions in time order. */
export const sessionsOn = (slots: readonly CalendarSlot[], date: string, groupId?: string): CalendarSlot[] =>
  slots.filter((slot) => slot.date === date && (groupId === undefined || slot.group_id === groupId)).sort((a, b) => a.time.localeCompare(b.time));

/**
 * One day's plan for each stage (or for one): the time, the activity, how long it takes and what
 * kind it is, a one-line cue, and, opened, how to run it for that stage. Used for today on the
 * dashboard and for the day chosen on the calendar, so a day reads the same wherever it is shown.
 * `large` is for today: bigger type, for reading at a glance.
 */
export function DayPlan({
  date,
  groups,
  slots,
  activities,
  only,
  large = false,
  headingLevel = 3,
}: {
  date: string;
  groups: readonly CalendarGroup[];
  slots: readonly CalendarSlot[];
  activities: Activities;
  /** Show just this group, and leave out its heading (the page has already said which). */
  only?: string;
  large?: boolean;
  headingLevel?: 3 | 4;
}) {
  const shown = groups.filter((group) => only === undefined || group.id === only);
  const Heading = headingLevel === 3 ? "h3" : "h4";
  return (
    <div className={`grid gap-4 ${shown.length > 1 ? "lg:grid-cols-3" : ""}`}>
      {shown.map((group) => {
        const sessions = sessionsOn(slots, date, group.id);
        const stage = trackOf(group);
        return (
          <section key={group.id} aria-label={only === undefined ? group.name : undefined} className="grid content-start gap-3">
            {only === undefined ? <Heading className="m-0 font-display text-xl font-bold text-ink">{group.name}</Heading> : null}
            {sessions.length === 0 ? <p className="m-0 text-base text-ink-soft">Nothing is planned for this day.</p> : null}
            <ol className="m-0 grid list-none gap-3 p-0">
              {sessions.map((slot) => {
                const item = activities[slot.content_item_id];
                const minutes = item?.content_payload.minutes;
                return (
                  <li key={slot.id} className="grid gap-2 rounded-xl border-2 border-rule bg-white p-3">
                    <p className="m-0 text-base font-bold text-garden-dark">{timeLabel(slot.time)}</p>
                    <p className={`m-0 font-display font-bold leading-tight text-ink ${large ? "text-2xl" : "text-xl"}`}>{sessionTitle(slot, activities)}</p>
                    {item ? (
                      <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="About this session">
                        {minutes ? (
                          <li>
                            <Tag>{minutes} min</Tag>
                          </li>
                        ) : null}
                        {formatsOf(item).map((format) => (
                          <li key={format}>
                            <Tag>{FORMAT_LABELS[format]}</Tag>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {slot.note ? <p className="m-0 text-base text-ink">{slot.note}</p> : null}
                    {item ? (
                      <details>
                        <summary className="flex min-h-11 cursor-pointer items-center rounded-lg border-2 border-garden-dark px-3 text-base font-bold text-garden-dark hover:bg-tint">How to run it</summary>
                        <div className="mt-3">
                          <ActivityDetails item={item} stage={stage ?? undefined} />
                        </div>
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
