import { z } from "zod";
import type { Enums } from "@/lib/db/database.types";
import { ACTIVITY_FORMATS } from "./formats";
import { DECADES, SENSES } from "./reminiscence";
import { type ParseResult, invalid } from "./result";
import { THEME_IDS } from "./themes";

/**
 * The shared activity library (the content_items table).
 *
 * `category` is a lowercase slug. The database only checks that it is one, so
 * the list can grow without a migration. These are the ones the Packet Builder
 * and the facility planner use today (src/services/facilityPlanner.ts).
 */
export const CONTENT_CATEGORIES = [
  "cognicopia-coloring",
  "numbers",
  "word",
  "letters",
  "movement",
  "music",
  "multisensory",
  "reminiscence",
  "trivia",
] as const;
export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

/** The same rule as the database's content_items_category_slug constraint. */
export const CATEGORY_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const CONTENT_PAYLOAD_VERSION = 1 as const;

/**
 * What goes in content_items.content_payload, version 1.
 *
 * Provisional: it holds what the facility planner's activity catalog holds
 * today (a summary, a length, whether it suits a group, whether it is
 * sensory) plus a `template` that names the generator able to draw the
 * activity and its settings. It is versioned, and strict on purpose, so a
 * change of shape is a deliberate new version rather than a drift.
 */
export const ContentPayloadSchema = z.strictObject({
  schema_version: z.literal(CONTENT_PAYLOAD_VERSION),
  /** One sentence for staff browsing the library. */
  summary: z.string().trim().min(1).max(500),
  /** A typical session length. */
  minutes: z.number().int().min(5).max(180).optional(),
  /** Suits a group led by a facilitator. */
  group_friendly: z.boolean().optional(),
  /** Leads with touch, sound or movement rather than reading. */
  sensory: z.boolean().optional(),
  materials: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  steps: z.array(z.string().trim().min(1).max(400)).max(30).optional(),
  /** What kind of activity it is, for filtering. Left out, it is taken from the category (lib/domain/formats.ts). */
  formats: z.array(z.enum(ACTIVITY_FORMATS)).min(1).max(3).optional(),
  /** The calendar themes it fits (lib/domain/themes.ts). None: it fits any month. */
  themes: z.array(z.enum(THEME_IDS)).max(6).optional(),
  /** Reminiscence prompts: the decade it is set in, and the senses it draws on. */
  decade: z.union([z.literal(DECADES[0]), z.literal(DECADES[1]), z.literal(DECADES[2]), z.literal(DECADES[3])]).optional(),
  senses: z.array(z.enum(SENSES)).min(1).max(3).optional(),
  /** Reminiscence prompts: what to say next. Invitations, not tests. */
  follow_ups: z.array(z.string().trim().min(1).max(200)).max(6).optional(),
  /** Trivia: questions with the answer to read out. */
  questions: z.array(z.strictObject({ q: z.string().trim().min(1).max(200), a: z.string().trim().min(1).max(120) })).max(12).optional(),
  /** The generator that draws this activity, and its settings. */
  template: z
    .strictObject({
      generator: z.string().min(1).max(60),
      params: z.record(z.string(), z.json()),
    })
    .optional(),
});

export type ContentPayload = z.infer<typeof ContentPayloadSchema>;

export function parseContentPayload(input: unknown): ParseResult<ContentPayload> {
  const parsed = ContentPayloadSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return invalid(
    "The content payload is not valid.",
    parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  );
}

type DementiaStage = Enums<"dementia_stage">;

/**
 * The stages whose items suit a group at `stage`: that stage, and the
 * "universal" items that suit any. Asking for "universal" returns only those.
 */
export function stagesFor(stage: DementiaStage): DementiaStage[] {
  return stage === "universal" ? ["universal"] : [stage, "universal"];
}
