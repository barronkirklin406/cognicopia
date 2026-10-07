"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ContentItem } from "@/lib/db/models";
import { facetCounts, filterLibrary, filterToSearch, type LibraryFilter } from "@/lib/domain/content-filter";
import { FORMAT_LABELS, categoryLabel, type ActivityFormat } from "@/lib/domain/formats";
import { STAGES, type TrackStage } from "@/lib/domain/stages";
import { THEMES, isThemeId, themeLabel, type ThemeId } from "@/lib/domain/themes";
import { ActivityCard } from "./ActivityCard";
import { FormatFilter } from "./FormatFilter";
import { StageFilter } from "./StageFilter";

const PAGE_SIZE = 48;

/** The filter in words, for the line that says what is on the page: "Late stage, Trivia, Aviation, matching "tea"". */
export function describeFilter(filter: LibraryFilter): string {
  const parts: string[] = [];
  if (filter.stage) parts.push(STAGES.find((s) => s.id === filter.stage)?.label ?? filter.stage);
  if (filter.format) parts.push(FORMAT_LABELS[filter.format]);
  if (filter.theme) parts.push(themeLabel(filter.theme));
  if (filter.query?.trim()) parts.push(`matching "${filter.query.trim()}"`);
  return parts.join(", ");
}

/**
 * The activity library, sorted by what staff ask for first: the stage of the people in the room,
 * the kind of activity, a theme, or a few words. Everything is filtered in the browser as people
 * tap, so there is no waiting; the address is kept in step (without adding history entries), so a
 * filtered view can be bookmarked or sent to a colleague, and a screen reader is told how many
 * activities are showing after every change.
 */
export function LibraryBrowser({ items, initial }: { items: ContentItem[]; initial: LibraryFilter }) {
  const [stage, setStage] = useState<TrackStage | undefined>(initial.stage);
  const [format, setFormat] = useState<ActivityFormat | undefined>(initial.format);
  const [theme, setTheme] = useState<ThemeId | undefined>(initial.theme);
  const [query, setQuery] = useState(initial.query ?? "");
  const [shown, setShown] = useState(PAGE_SIZE);
  const searchRef = useRef<HTMLInputElement>(null);
  const ids = { search: useId(), theme: useId() };

  const deferredQuery = useDeferredValue(query);
  const filter: LibraryFilter = useMemo(
    () => ({ ...(stage ? { stage } : {}), ...(format ? { format } : {}), ...(theme ? { theme } : {}), ...(deferredQuery.trim() ? { query: deferredQuery } : {}) }),
    [stage, format, theme, deferredQuery],
  );

  const results = useMemo(() => filterLibrary(items, filter), [items, filter]);
  const counts = useMemo(() => facetCounts(items, filter), [items, filter]);

  useEffect(() => {
    const next = `${window.location.pathname}${filterToSearch(filter)}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, "", next);
  }, [filter]);

  const visible = results.slice(0, shown);
  const groups = useMemo(() => {
    const byCategory = new Map<string, ContentItem[]>();
    for (const item of visible) byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item]);
    return [...byCategory.entries()].sort(([a], [b]) => categoryLabel(a).localeCompare(categoryLabel(b)));
  }, [visible]);

  const filtering = Boolean(stage || format || theme || query.trim());
  const reset = () => {
    setStage(undefined);
    setFormat(undefined);
    setTheme(undefined);
    setQuery("");
    setShown(PAGE_SIZE);
    searchRef.current?.focus();
  };
  const change = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setShown(PAGE_SIZE);
  };

  const about = describeFilter(filter);

  return (
    <div className="grid gap-6">
      <section aria-label="Filter the library" className="grid gap-4 rounded-xl border-2 border-rule bg-white p-4 print:hidden">
        <StageFilter value={stage} onChange={change(setStage)} counts={counts.stage} />
        <FormatFilter value={format} onChange={change(setFormat)} counts={counts.format} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1">
            <label htmlFor={ids.search} className="text-base font-bold">
              Search
            </label>
            <input
              ref={searchRef}
              id={ids.search}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setShown(PAGE_SIZE);
              }}
              placeholder="A word, a song, a material"
              autoComplete="off"
              maxLength={80}
              className="min-h-11 w-full rounded-lg border-2 border-ink-soft bg-white px-3 py-2 font-[inherit] text-base text-ink"
            />
          </div>
          <div className="grid gap-1">
            <label htmlFor={ids.theme} className="text-base font-bold">
              Theme
            </label>
            <select
              id={ids.theme}
              value={theme ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                change(setTheme)(isThemeId(value) ? value : undefined);
              }}
              className="min-h-11 w-full rounded-lg border-2 border-ink-soft bg-white px-3 py-2 font-[inherit] text-base text-ink"
            >
              <option value="">Any theme</option>
              {THEMES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" aria-live="polite" className="m-0 text-lg font-bold text-ink">
            {results.length === 0
              ? "No activities match."
              : `Showing ${Math.min(shown, results.length)} of ${results.length} ${results.length === 1 ? "activity" : "activities"}${about ? `: ${about}` : ""}`}
          </p>
          {filtering ? (
            <button
              type="button"
              onClick={reset}
              className="min-h-11 cursor-pointer rounded-lg border-2 border-garden-dark bg-white px-4 font-[inherit] text-base font-bold text-garden-dark hover:bg-tint"
            >
              Clear all filters
            </button>
          ) : null}
        </div>
      </section>

      {results.length === 0 ? (
        <div className="rounded-xl border-2 border-gold bg-warn-tint p-4 text-base text-ink">
          <p className="m-0 font-bold">Nothing matches these choices.</p>
          <p className="m-0 mt-1">Take one choice away, or clear them all, to see more.</p>
        </div>
      ) : null}

      {groups.map(([category, group]) => (
        <section key={category} aria-labelledby={`category-${category}`} className="grid gap-3">
          <h2 id={`category-${category}`} className="m-0 font-display text-2xl font-bold text-ink">
            {categoryLabel(category)}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {group.map((item) => (
              <ActivityCard key={item.id} item={item} stage={stage} />
            ))}
          </div>
        </section>
      ))}

      {results.length > shown ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShown((count) => count + PAGE_SIZE)}
            className="min-h-11 cursor-pointer rounded-lg border-2 border-garden-dark bg-garden-dark px-6 font-[inherit] text-base font-bold text-white hover:bg-paper"
          >
            Show more activities ({results.length - shown} more)
          </button>
        </div>
      ) : null}
    </div>
  );
}
