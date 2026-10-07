import type { ContentItem } from "@/lib/db/models";
import { formatsOf } from "@/lib/domain/formats";
import type { TrackStage } from "@/lib/domain/stages";
import { AdaptationNotes, stagesToExplain } from "./AdaptationNotes";

/**
 * How to run an activity: suggestions for the stage of the people in the room (the adaptation
 * engine), what to have ready, the steps, the trivia answers, and what to say if a conversation
 * slows. Shared by the library's cards and a calendar's days, so both say the same thing.
 */
export function ActivityDetails({ item, stage }: { item: ContentItem; stage?: TrackStage | undefined }) {
  const payload = item.content_payload;
  const formats = formatsOf(item);
  return (
    <div className="grid gap-3">
      <AdaptationNotes item={{ ...(payload.minutes !== undefined ? { minutes: payload.minutes } : {}), formats }} stages={stagesToExplain(stage, item.dementia_stage)} />

      {payload.materials && payload.materials.length > 0 ? (
        <section aria-label="What to have ready">
          <h4 className="m-0 mb-1 font-display text-base font-bold">Have ready</h4>
          <ul className="m-0 list-disc space-y-1 pl-5 text-base">
            {payload.materials.map((material) => (
              <li key={material}>{material}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {payload.steps && payload.steps.length > 0 ? (
        <section aria-label="Steps">
          <h4 className="m-0 mb-1 font-display text-base font-bold">Steps</h4>
          <ol className="m-0 list-decimal space-y-1 pl-5 text-base">
            {payload.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      ) : null}

      {payload.questions && payload.questions.length > 0 ? (
        <section aria-label="Questions and answers">
          <h4 className="m-0 mb-1 font-display text-base font-bold">Questions, with the answer to read out</h4>
          <ol className="m-0 list-decimal space-y-2 pl-5 text-base">
            {payload.questions.map((entry) => (
              <li key={entry.q}>
                {entry.q} <strong className="block text-good-ink">Answer: {entry.a}</strong>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {payload.follow_ups && payload.follow_ups.length > 0 ? (
        <section aria-label="If the conversation slows">
          <h4 className="m-0 mb-1 font-display text-base font-bold">If the conversation slows</h4>
          <ul className="m-0 list-disc space-y-1 pl-5 text-base">
            {payload.follow_ups.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
