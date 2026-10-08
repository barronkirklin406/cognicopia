import { z } from "zod";
import type { ContentItem, DementiaStage } from "@/lib/db/models";
import { quickTip } from "./adaptation";
import { MAX_SLOTS, MonthSchema, type CalendarData, type CalendarGroup, type CalendarSlot } from "./calendar";
import { formatsOf, type ActivityFormat } from "./formats";
import { daysInMonth, isoDay } from "./months";
import { STAGES, TRACK_STAGES, suitsStage, type TrackStage } from "./stages";
import { THEME_IDS, type ThemeId } from "./themes";

/**
 * The one-click month planner: a month, a theme and the stages to plan for go in, and a
 * full month of structured days comes out, drawn from the activity library.
 *
 * Deterministic: the same library, month, theme, stages and seed always give the same
 * calendar, so the preview a director sees is what the server saves, and "mix it up" is
 * just a new seed. Pure: no clock, no network, no database.
 *
 * Each stage is a track (a "group" in the calendar), and each day has two or three
 * sessions in a rhythm that suits the day:
 *   10:00  energize  movement or music, to start the day
 *   14:00  engage    a game, trivia or a printable sheet
 *   16:00  calm      reminiscence, sensory or coloring, for the late afternoon
 * An activity is only used for a stage it suits (made for it, or for any), the same one is
 * not repeated within a few days, themed activities are preferred, and an activity without
 * a theme fills the gaps. Nothing here knows a resident: a calendar plans groups.
 */

export const SLOT_ROLES = ["energize", "engage", "calm"] as const;
export type SlotRole = (typeof SLOT_ROLES)[number];

const SLOT_PLAN: readonly { role: SlotRole; time: string }[] = [
  { role: "energize", time: "10:00" },
  { role: "engage", time: "14:00" },
  { role: "calm", time: "16:00" },
];

export const SLOT_ROLE_LABELS: Record<SlotRole, string> = { energize: "Morning, to get moving", engage: "Afternoon, to think", calm: "Late afternoon, to settle" };

/** What an activity is for, in the rhythm of a day. */
export function roleOf(item: { category: string; formats: readonly ActivityFormat[] }): SlotRole {
  if (item.formats.includes("active")) return "energize";
  if (item.formats.includes("reminiscence") || item.formats.includes("sensory") || item.category === "cognicopia-coloring") return "calm";
  return "engage";
}

/** What the generator needs to know about a library item. */
export interface GeneratorItem {
  id: string;
  title: string;
  category: string;
  stage: DementiaStage;
  formats: ActivityFormat[];
  themes: string[];
  minutes?: number;
}

export function toGeneratorItem(item: ContentItem): GeneratorItem {
  const formats = formatsOf(item);
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    stage: item.dementia_stage,
    formats,
    themes: [...(item.content_payload.themes ?? [])],
    ...(item.content_payload.minutes !== undefined ? { minutes: item.content_payload.minutes } : {}),
  };
}

/** What a director chooses. Also what the server is sent: it makes the calendar itself from this. */
export const PlanSchema = z.object({
  month: MonthSchema,
  theme: z.union([z.literal("none"), z.enum(THEME_IDS)]),
  stages: z.array(z.enum(TRACK_STAGES)).min(1, "Choose at least one stage.").max(3),
  perDay: z.union([z.literal(2), z.literal(3)]),
  seed: z.string().regex(/^[A-Za-z0-9-]{1,40}$/, "The mix is not valid."),
});
export type Plan = z.infer<typeof PlanSchema>;

export interface PlanStats {
  sessions: number;
  /** Sessions whose activity names the chosen theme. */
  themed: number;
  distinct: number;
  /** Stages with nothing in the library to plan from. */
  skipped: TrackStage[];
}

export type GeneratedCalendar = { ok: true; data: CalendarData; stats: PlanStats } | { ok: false; message: string };

// ---------------------------------------------------------------------
// A small seeded random source: the same seed always rolls the same numbers.
// ---------------------------------------------------------------------

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

/** A new seed for "mix it up". Not part of the pure planner: it asks for randomness. */
export function newSeed(): string {
  const bytes = new Uint8Array(5);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 8);
}

export function generateCalendar(plan: Plan, library: readonly GeneratorItem[]): GeneratedCalendar {
  if (library.length === 0) return { ok: false, message: "The activity library is empty, so there is nothing to plan from." };

  const theme: ThemeId | null = plan.theme === "none" ? null : plan.theme;
  const plans = SLOT_PLAN.slice(0, plan.perDay);
  const days = daysInMonth(plan.month);
  const groups: CalendarGroup[] = [];
  const slots: CalendarSlot[] = [];
  const skipped: TrackStage[] = [];
  const used = new Set<string>();
  let themed = 0;

  for (const info of STAGES.filter((s) => plan.stages.includes(s.id))) {
    const pool = library.filter((item) => suitsStage(item.stage, info.id));
    if (pool.length === 0) {
      skipped.push(info.id);
      continue;
    }
    groups.push({ id: info.id, name: info.label, acuity: info.acuity });

    const roll = random(hash(`${plan.seed}|${plan.month}|${plan.theme}|${info.id}|${plan.perDay}`));
    const lastUsed = new Map<string, number>();
    const previousDay = new Map<SlotRole, GeneratorItem>();

    for (let day = 1; day <= days; day++) {
      const date = isoDay(plan.month, day);
      const today = new Set<string>();
      let previousCategory = "";

      plans.forEach(({ role, time }, index) => {
        const ofRole = pool.filter((item) => roleOf(item) === role);
        const candidates = (ofRole.length > 0 ? ofRole : pool).filter((item) => !today.has(item.id));
        const choices = candidates.length > 0 ? candidates : pool;
        const gap = clamp(Math.floor(choices.length / 2), 1, 6);

        let best = choices[0]!;
        let bestScore = -Infinity;
        for (const item of choices) {
          let score = roll();
          if (theme) {
            if (item.themes.includes(theme)) score += 3;
            else if (item.themes.length === 0) score += 0.4;
            else score -= 1.5;
          }
          const last = lastUsed.get(item.id);
          if (last !== undefined && day - last < gap) {
            // A themed month may bring a fitting activity back a little sooner than an
            // unthemed one: with a small themed set, strict spacing would crowd the theme out.
            const eager = theme && item.themes.includes(theme) ? 0.6 : 1;
            score -= (2 + (gap - (day - last)) * 1.2) * eager;
          }
          if (item.category === previousCategory) score -= 0.8;
          if (previousDay.get(role)?.id === item.id) score -= 1;
          if (score > bestScore) {
            best = item;
            bestScore = score;
          }
        }

        lastUsed.set(best.id, day);
        today.add(best.id);
        previousDay.set(role, best);
        previousCategory = best.category;
        used.add(best.id);
        if (theme && best.themes.includes(theme)) themed += 1;
        slots.push({
          id: `${info.id}-${date.slice(5)}-${index + 1}`,
          date,
          time,
          group_id: info.id,
          content_item_id: best.id,
          locked: false,
          note: quickTip(best.formats[0] ?? "games", info.id),
        });
      });
    }
  }

  if (groups.length === 0) return { ok: false, message: "The library has nothing for the stages chosen." };
  if (slots.length > MAX_SLOTS) return { ok: false, message: "That is more sessions than a calendar can hold." };

  return {
    ok: true,
    data: { schema_version: 1, month: plan.month, groups, slots, generator: { name: "Cognicopia month planner", version: "1", seed: plan.seed } },
    stats: { sessions: slots.length, themed, distinct: used.size, skipped },
  };
}
