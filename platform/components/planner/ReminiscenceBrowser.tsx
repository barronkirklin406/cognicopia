"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { DECADES, SENSES, SENSE_LABELS, decadeLabel, filterPrompts, promptFacetCounts, promptFilterToSearch, type Decade, type Prompt, type PromptFilter, type Sense } from "@/lib/domain/reminiscence";
import { STAGES, type TrackStage } from "@/lib/domain/stages";
import { Chip } from "./Chip";
import { ChipGroup } from "./ChipGroup";
import { PrintButton } from "./PrintButton";
import { PromptCard } from "./PromptCard";
import { StageFilter } from "./StageFilter";

/** The filter in words, for the line that says what is on the page and for the printed sheet's heading. */
export function describePromptFilter(filter: PromptFilter): string {
  const parts: string[] = [];
  if (filter.decade !== undefined) parts.push(decadeLabel(filter.decade));
  if (filter.sense) parts.push(SENSE_LABELS[filter.sense]);
  if (filter.stage) parts.push(STAGES.find((s) => s.id === filter.stage)?.label ?? filter.stage);
  if (filter.query?.trim()) parts.push(`matching "${filter.query.trim()}"`);
  return parts.join(", ");
}

/**
 * The reminiscence library: conversation starters for a one-to-one visit or a group circle,
 * sorted by the decade they belong to (1940s to 1970s) and the sense that brings them back
 * (sight, sound, smell, taste, touch), by stage, or by a few words. Filtered in the browser as
 * people tap, with the address kept in step so a filtered view can be shared, and the number
 * showing announced after every change. The Print button prints what is showing as cue cards.
 */
export function ReminiscenceBrowser({ prompts, initial }: { prompts: Prompt[]; initial: PromptFilter }) {
  const [decade, setDecade] = useState<Decade | undefined>(initial.decade);
  const [sense, setSense] = useState<Sense | undefined>(initial.sense);
  const [stage, setStage] = useState<TrackStage | undefined>(initial.stage);
  const [query, setQuery] = useState(initial.query ?? "");
  const searchRef = useRef<HTMLInputElement>(null);
  const searchId = useId();

  const deferredQuery = useDeferredValue(query);
  const filter: PromptFilter = useMemo(
    () => ({ ...(decade !== undefined ? { decade } : {}), ...(sense ? { sense } : {}), ...(stage ? { stage } : {}), ...(deferredQuery.trim() ? { query: deferredQuery } : {}) }),
    [decade, sense, stage, deferredQuery],
  );
  const results = useMemo(() => filterPrompts(prompts, filter), [prompts, filter]);
  const counts = useMemo(() => promptFacetCounts(prompts, filter), [prompts, filter]);

  useEffect(() => {
    const next = `${window.location.pathname}${promptFilterToSearch(filter)}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, "", next);
  }, [filter]);

  const filtering = decade !== undefined || Boolean(sense) || Boolean(stage) || Boolean(query.trim());
  const about = describePromptFilter(filter);
  const reset = () => {
    setDecade(undefined);
    setSense(undefined);
    setStage(undefined);
    setQuery("");
    searchRef.current?.focus();
  };

  return (
    <div className="grid gap-6">
      <details className="rounded-xl border-2 border-rule bg-white print:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-base font-bold text-garden-dark">Using these prompts</summary>
        <div className="grid gap-3 border-t-2 border-rule-soft p-4 text-base text-ink md:grid-cols-2">
          <section aria-label="One to one">
            <h2 className="m-0 mb-1 font-display text-lg font-bold">On a one-to-one visit</h2>
            <ul className="m-0 list-disc space-y-1 pl-5">
              <li>Sit at eye level and offer the opening line as an invitation, then wait. Silence is part of the conversation.</li>
              <li>Follow the person&rsquo;s lead. If they move to another memory, go with them.</li>
              <li>Bring the object, scent or song when there is one: the senses often say more than words.</li>
            </ul>
          </section>
          <section aria-label="Group circle">
            <h2 className="m-0 mb-1 font-display text-lg font-bold">In a group circle</h2>
            <ul className="m-0 list-disc space-y-1 pl-5">
              <li>Read the opening line once, then pass the object round. Anyone may pass it on without speaking.</li>
              <li>Welcome every contribution, and join them up: &ldquo;That reminds me of what was just shared.&rdquo;</li>
              <li>Keep it to one prompt for twenty to thirty minutes, and end on a song or a warm word.</li>
            </ul>
          </section>
        </div>
      </details>

      <section aria-label="Filter the prompts" className="grid gap-4 rounded-xl border-2 border-rule bg-white p-4 print:hidden">
        <ChipGroup label="Decade">
          {DECADES.map((value) => (
            <Chip key={value} pressed={decade === value} count={counts.decade[value]} onClick={() => setDecade(decade === value ? undefined : value)}>
              {decadeLabel(value)}
            </Chip>
          ))}
        </ChipGroup>
        <ChipGroup label="Sense that brings it back">
          {SENSES.map((value) => (
            <Chip key={value} pressed={sense === value} count={counts.sense[value]} onClick={() => setSense(sense === value ? undefined : value)}>
              {SENSE_LABELS[value]}
            </Chip>
          ))}
        </ChipGroup>
        <StageFilter value={stage} onChange={setStage} counts={counts.stage} label="Stage of the people in the room" />

        <div className="grid gap-1">
          <label htmlFor={searchId} className="text-base font-bold">
            Search
          </label>
          <input
            ref={searchRef}
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="A song, a place, a thing in the kitchen"
            autoComplete="off"
            maxLength={80}
            className="min-h-11 w-full rounded-lg border-2 border-ink-soft bg-white px-3 py-2 font-[inherit] text-base text-ink"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" aria-live="polite" className="m-0 text-lg font-bold text-ink">
            {results.length === 0 ? "No prompts match." : `Showing ${results.length} of ${prompts.length} ${results.length === 1 ? "prompt" : "prompts"}${about ? `: ${about}` : ""}`}
          </p>
          <div className="flex flex-wrap gap-3">
            {filtering ? (
              <button
                type="button"
                onClick={reset}
                className="min-h-11 cursor-pointer rounded-lg border-2 border-garden-dark bg-white px-4 font-[inherit] text-base font-bold text-garden-dark hover:bg-tint"
              >
                Clear all filters
              </button>
            ) : null}
            {results.length > 0 ? <PrintButton variant="secondary">Print these prompts</PrintButton> : null}
          </div>
        </div>
      </section>

      {results.length === 0 ? (
        <div className="rounded-xl border-2 border-gold bg-warn-tint p-4 text-base text-ink print:hidden">
          <p className="m-0 font-bold">Nothing matches these choices.</p>
          <p className="m-0 mt-1">Take one choice away, or clear them all, to see more.</p>
        </div>
      ) : null}

      <section aria-label="Prompts" className="grid gap-4">
        {/* Only on paper: what the sheet is, since the filters above are not printed. */}
        <header className="hidden print:block">
          <h2 className="m-0 text-2xl font-bold text-black">Reminiscence prompts{about ? `: ${about}` : ""}</h2>
          <p className="m-0 mt-1 text-base text-black">Cognicopia. Offer each opening line as an invitation, and follow the person&rsquo;s lead.</p>
        </header>
        <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2 print:gap-3">
          {results.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} />
          ))}
        </div>
      </section>
    </div>
  );
}
