import type { ContentItem } from "@/lib/db/models";
import { formatsOf, isFormat, type ActivityFormat, FORMAT_LABELS, ACTIVITY_FORMATS } from "./formats";
import { decadeLabel, SENSE_LABELS } from "./reminiscence";
import { searchWords } from "./search";
import { STAGES, isTrackStage, suitsStage, type TrackStage } from "./stages";
import { isThemeId, themeLabel, type ThemeId } from "./themes";

/**
 * Sorting the library by what staff ask for first: the stage of the people in the room, the
 * kind of activity, a theme, or a few words. Pure, so the same rule runs in the browser
 * (instantly, as someone taps a filter) and in tests.
 */
export interface LibraryFilter {
  stage?: TrackStage;
  format?: ActivityFormat;
  theme?: ThemeId;
  query?: string;
}

/** Everything about an item that a search may match, as one lower-case string. */
function haystack(item: ContentItem): string {
  const p = item.content_payload;
  return [
    item.title,
    p.summary,
    item.category.replace(/-/g, " "),
    ...formatsOf(item).map((f) => FORMAT_LABELS[f]),
    ...(p.themes ?? []).map(themeLabel),
    ...(p.materials ?? []),
    ...(p.follow_ups ?? []),
    ...(p.questions ?? []).flatMap((q) => [q.q, q.a]),
    ...(p.decade ? [decadeLabel(p.decade)] : []),
    ...(p.senses ?? []).map((s) => SENSE_LABELS[s]),
  ]
    .join(" ")
    .toLowerCase();
}

export function matchesFilter(item: ContentItem, filter: LibraryFilter, words: readonly string[] = searchWords(filter.query)): boolean {
  if (filter.stage && !suitsStage(item.dementia_stage, filter.stage)) return false;
  if (filter.format && !formatsOf(item).includes(filter.format)) return false;
  if (filter.theme && !(item.content_payload.themes ?? []).includes(filter.theme)) return false;
  if (words.length === 0) return true;
  const text = haystack(item);
  return words.every((word) => text.includes(word));
}

export function filterLibrary(items: readonly ContentItem[], filter: LibraryFilter): ContentItem[] {
  const words = searchWords(filter.query);
  return items.filter((item) => matchesFilter(item, filter, words));
}

export interface FacetCounts {
  stage: Record<TrackStage, number>;
  format: Record<ActivityFormat, number>;
}

/**
 * How many items each stage and each format would show, given the other filters as they
 * are now. A chip can then say "Trivia (6)", and a choice that would show nothing says so.
 */
export function facetCounts(items: readonly ContentItem[], filter: LibraryFilter): FacetCounts {
  const stage = Object.fromEntries(STAGES.map((s) => [s.id, filterLibrary(items, { ...filter, stage: s.id }).length])) as Record<TrackStage, number>;
  const format = Object.fromEntries(ACTIVITY_FORMATS.map((f) => [f, filterLibrary(items, { ...filter, format: f }).length])) as Record<ActivityFormat, number>;
  return { stage, format };
}

const MAX_QUERY = 80;

/**
 * A filter read from a page's address (?stage=late&format=trivia&theme=aviation&q=garden). Anything
 * that is not one of ours is dropped, so a made-up address shows the library, never an error.
 */
export function parseFilterParams(params: { stage?: unknown; format?: unknown; theme?: unknown; q?: unknown }): LibraryFilter {
  const query = typeof params.q === "string" ? params.q.trim().slice(0, MAX_QUERY) : "";
  return {
    ...(isTrackStage(params.stage) ? { stage: params.stage } : {}),
    ...(isFormat(params.format) ? { format: params.format } : {}),
    ...(isThemeId(params.theme) ? { theme: params.theme } : {}),
    ...(query ? { query } : {}),
  };
}

/** The address query for a filter ("?stage=late&q=garden"), or "" when nothing is chosen: the other half of parseFilterParams. */
export function filterToSearch(filter: LibraryFilter): string {
  const params = new URLSearchParams();
  if (filter.stage) params.set("stage", filter.stage);
  if (filter.format) params.set("format", filter.format);
  if (filter.theme) params.set("theme", filter.theme);
  if (filter.query?.trim()) params.set("q", filter.query.trim().slice(0, MAX_QUERY));
  const text = params.toString();
  return text ? `?${text}` : "";
}
