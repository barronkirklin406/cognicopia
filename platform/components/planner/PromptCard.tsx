import { SENSE_LABELS, decadeLabel, type Prompt } from "@/lib/domain/reminiscence";
import { stageLabel } from "@/lib/domain/stages";
import { themeLabel } from "@/lib/domain/themes";
import { Tag } from "./Tag";

/**
 * One conversation starter, laid out to be read at a glance during a visit or a circle: the
 * decade and the senses it draws on, the opening line in large type, what to say if the
 * conversation slows, and anything to have in hand. Invitations, never questions with a right
 * answer (the library's tests hold every prompt to that).
 */
export function PromptCard({ prompt }: { prompt: Prompt }) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border-2 border-rule bg-white p-4 text-ink print:break-inside-avoid print:border-black print:p-3 print:text-black">
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="About this prompt">
        <li>
          <Tag tone="stage">{decadeLabel(prompt.decade)}</Tag>
        </li>
        {prompt.senses.map((sense) => (
          <li key={sense}>
            <Tag>{SENSE_LABELS[sense]}</Tag>
          </li>
        ))}
        <li>
          <Tag>{stageLabel(prompt.stage)}</Tag>
        </li>
        {prompt.themes.slice(0, 2).map((theme) => (
          <li key={theme} className="print:hidden">
            <Tag>{themeLabel(theme)}</Tag>
          </li>
        ))}
      </ul>

      <h3 className="m-0 font-display text-xl font-bold leading-tight">{prompt.topic}</h3>

      <p className="m-0 text-xl leading-snug">
        <span className="sr-only">Start with: </span>
        {prompt.opener}
      </p>

      {prompt.followUps.length > 0 ? (
        <section aria-label="If the conversation slows">
          <h4 className="m-0 mb-1 font-display text-base font-bold">If the conversation slows</h4>
          <ul className="m-0 list-disc space-y-1 pl-5 text-base">
            {prompt.followUps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {prompt.materials.length > 0 ? (
        <section aria-label="Have ready">
          <h4 className="m-0 mb-1 font-display text-base font-bold">Have ready</h4>
          <ul className="m-0 list-disc space-y-1 pl-5 text-base">
            {prompt.materials.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {prompt.steps.length > 0 ? (
        <section aria-label="Before you start">
          <h4 className="m-0 mb-1 font-display text-base font-bold">Before you start</h4>
          <ul className="m-0 list-disc space-y-1 pl-5 text-base">
            {prompt.steps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
