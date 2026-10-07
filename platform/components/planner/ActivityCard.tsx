import type { ContentItem } from "@/lib/db/models";
import { formatsOf, FORMAT_LABELS, displayTitle } from "@/lib/domain/formats";
import { stageLabel, type TrackStage } from "@/lib/domain/stages";
import { themeLabel } from "@/lib/domain/themes";
import { ActivityDetails } from "./ActivityDetails";
import { Tag } from "./Tag";

/**
 * One activity: what it is at a glance, and, opened, how to run it for the stage of the people
 * in the room (the adaptation engine), what to have ready, the steps, and the trivia answers.
 * The "How to run it" button is a native <details>: it works from the keyboard, is announced as
 * expanded or collapsed, and needs no script. With a stage chosen, the notes are for that stage.
 */
export function ActivityCard({ item, stage }: { item: ContentItem; stage?: TrackStage | undefined }) {
  const payload = item.content_payload;
  const formats = formatsOf(item);
  return (
    <article className="flex flex-col gap-3 rounded-xl border-2 border-rule bg-white p-4 text-ink print:break-inside-avoid print:border-black">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="m-0 font-display text-xl font-bold leading-tight text-ink">{displayTitle(item)}</h3>
        {payload.minutes ? <span className="whitespace-nowrap text-base font-bold text-ink-soft">{payload.minutes} min</span> : null}
      </div>

      <p className="m-0 text-base text-ink">{payload.summary}</p>

      <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="About this activity">
        <li>
          <Tag tone="stage">{stageLabel(item.dementia_stage)}</Tag>
        </li>
        {formats.map((format) => (
          <li key={format}>
            <Tag>{FORMAT_LABELS[format]}</Tag>
          </li>
        ))}
        {payload.group_friendly === true ? (
          <li>
            <Tag>Group</Tag>
          </li>
        ) : null}
        {payload.group_friendly === false ? (
          <li>
            <Tag>One to one</Tag>
          </li>
        ) : null}
        {(payload.themes ?? []).slice(0, 3).map((theme) => (
          <li key={theme}>
            <Tag>{themeLabel(theme)}</Tag>
          </li>
        ))}
      </ul>

      <details className="print:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border-2 border-garden-dark px-3 text-base font-bold text-garden-dark hover:bg-tint">
          How to run it
        </summary>
        <div className="mt-3">
          <ActivityDetails item={item} stage={stage} />
        </div>
      </details>
    </article>
  );
}
