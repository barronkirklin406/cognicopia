import type { ContentItem } from "@/lib/db/models";
import { searchWords } from "./search";
import { themeLabel } from "./themes";
import { TRACK_STAGES, isTrackStage, suitsStage, type TrackStage } from "./stages";

/**
 * Reminiscence prompts: conversation starters for a one-to-one visit or a group circle,
 * each tied to a decade and to the senses it draws on. They are ordinary library items
 * (category "reminiscence"), so the subscription gate and the stage filter apply to them
 * like any other activity.
 *
 * Wording is checked by a test: a prompt invites ("Tell me about...", "What was...like?"),
 * it never tests memory ("Do you remember...", "What year...", "Can you name...").
 */
export const DECADES = [1940, 1950, 1960, 1970] as const;
export type Decade = (typeof DECADES)[number];
export const decadeLabel = (decade: number): string => `${decade}s`;

export const SENSES = ["sight", "sound", "smell", "taste", "touch"] as const;
export type Sense = (typeof SENSES)[number];
export const SENSE_LABELS: Record<Sense, string> = { sight: "Sight", sound: "Sound", smell: "Smell", taste: "Taste", touch: "Touch" };

/** A reminiscence item laid out for a conversation. */
export interface Prompt {
  id: string;
  topic: string;
  opener: string;
  followUps: string[];
  decade: Decade;
  senses: Sense[];
  stage: ContentItem["dementia_stage"];
  themes: string[];
  materials: string[];
  steps: string[];
  minutes: number | undefined;
}

/** Null for an item that is not a complete prompt (no decade, or no senses). */
export function toPrompt(item: ContentItem): Prompt | null {
  const p = item.content_payload;
  if (item.category !== "reminiscence" || p.decade === undefined || !p.senses || p.senses.length === 0) return null;
  return {
    id: item.id,
    topic: item.title,
    opener: p.summary,
    followUps: p.follow_ups ?? [],
    decade: p.decade,
    senses: [...p.senses],
    stage: item.dementia_stage,
    themes: [...(p.themes ?? [])],
    materials: [...(p.materials ?? [])],
    steps: [...(p.steps ?? [])],
    minutes: p.minutes,
  };
}

export interface PromptFilter {
  decade?: Decade;
  sense?: Sense;
  stage?: TrackStage;
  query?: string;
}

/** The prompts that fit every filter given. Search looks at the topic, the opener, the follow-ups, the themes and the decade. */
export function filterPrompts(prompts: readonly Prompt[], filter: PromptFilter): Prompt[] {
  const words = searchWords(filter.query);
  return prompts.filter((prompt) => {
    if (filter.decade !== undefined && prompt.decade !== filter.decade) return false;
    if (filter.sense !== undefined && !prompt.senses.includes(filter.sense)) return false;
    if (filter.stage !== undefined && !suitsStage(prompt.stage, filter.stage)) return false;
    if (words.length === 0) return true;
    const haystack = [prompt.topic, prompt.opener, ...prompt.followUps, ...prompt.materials, decadeLabel(prompt.decade), ...prompt.senses, ...prompt.themes.map(themeLabel)].join(" ").toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

export interface PromptFacetCounts {
  decade: Record<Decade, number>;
  sense: Record<Sense, number>;
  stage: Record<TrackStage, number>;
}

/** How many prompts each decade, sense and stage would show, given the other choices as they are now: a chip can say "Smell (4)". */
export function promptFacetCounts(prompts: readonly Prompt[], filter: PromptFilter): PromptFacetCounts {
  const decade = Object.fromEntries(DECADES.map((d) => [d, filterPrompts(prompts, { ...filter, decade: d }).length])) as Record<Decade, number>;
  const sense = Object.fromEntries(SENSES.map((s) => [s, filterPrompts(prompts, { ...filter, sense: s }).length])) as Record<Sense, number>;
  const stage = Object.fromEntries(TRACK_STAGES.map((s) => [s, filterPrompts(prompts, { ...filter, stage: s }).length])) as Record<TrackStage, number>;
  return { decade, sense, stage };
}

const MAX_QUERY = 80;

/** A prompt filter read from a page's address (?decade=1950&sense=sound&stage=late&q=radio). Anything that is not one of ours is dropped. */
export function parsePromptParams(params: { decade?: unknown; sense?: unknown; stage?: unknown; q?: unknown }): PromptFilter {
  const decade = typeof params.decade === "string" ? DECADES.find((d) => String(d) === params.decade) : undefined;
  const sense = typeof params.sense === "string" ? SENSES.find((s) => s === params.sense) : undefined;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, MAX_QUERY) : "";
  return {
    ...(decade !== undefined ? { decade } : {}),
    ...(sense !== undefined ? { sense } : {}),
    ...(isTrackStage(params.stage) ? { stage: params.stage } : {}),
    ...(query ? { query } : {}),
  };
}

/** The address query for a prompt filter, or "" when nothing is chosen: the other half of parsePromptParams. */
export function promptFilterToSearch(filter: PromptFilter): string {
  const params = new URLSearchParams();
  if (filter.decade !== undefined) params.set("decade", String(filter.decade));
  if (filter.sense) params.set("sense", filter.sense);
  if (filter.stage) params.set("stage", filter.stage);
  if (filter.query?.trim()) params.set("q", filter.query.trim().slice(0, MAX_QUERY));
  const text = params.toString();
  return text ? `?${text}` : "";
}
