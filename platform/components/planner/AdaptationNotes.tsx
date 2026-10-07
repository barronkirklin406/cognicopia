import { adaptActivity } from "@/lib/domain/adaptation";
import type { ActivityFormat } from "@/lib/domain/formats";
import type { TrackStage } from "@/lib/domain/stages";
import { STAGES } from "@/lib/domain/stages";

/**
 * How to run an activity for a stage: how long, how big a group, and what to do differently.
 * These are practice suggestions, not prescriptions (lib/domain/adaptation.ts says why), so the
 * heading says "suggestions" and a care plan always comes first.
 */
export function AdaptationNotes({ item, stages }: { item: { minutes?: number; formats: readonly ActivityFormat[] }; stages: readonly TrackStage[] }) {
  return (
    <div className="grid gap-3">
      {stages.map((stage) => {
        const notes = adaptActivity(item, stage);
        return (
          <section key={stage} aria-label={`Suggestions for ${notes.stageLabel}`} className="rounded-lg border-2 border-rule bg-field p-3">
            <h4 className="m-0 mb-1 font-display text-base font-bold text-ink">
              {notes.stageLabel}: {notes.headline}
            </h4>
            <p className="m-0 mb-2 text-base text-ink-soft">
              About {notes.minutes} minutes. {notes.groupSize}
            </p>
            <ul className="m-0 list-disc space-y-1 pl-5 text-base text-ink">
              {notes.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** The stages to show notes for: the one asked for, else the one the activity is made for, else all three. */
export function stagesToExplain(asked: TrackStage | undefined, own: string): TrackStage[] {
  if (asked) return [asked];
  const made = STAGES.find((s) => s.id === own);
  return made ? [made.id] : STAGES.map((s) => s.id);
}
