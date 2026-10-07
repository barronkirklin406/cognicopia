/**
 * What kind of activity an item is, for filtering. An item can be more than one (a word
 * search is a game and a printable sheet). The first four are the ones staff ask for most;
 * movement and sensory activities are the rest of a day's rhythm.
 */
export const ACTIVITY_FORMATS = ["reminiscence", "games", "trivia", "printable", "active", "sensory"] as const;
export type ActivityFormat = (typeof ACTIVITY_FORMATS)[number];

export const FORMAT_LABELS: Record<ActivityFormat, string> = {
  reminiscence: "Reminiscence prompts",
  games: "Cognitive games",
  trivia: "Trivia",
  printable: "Printable sheets",
  active: "Movement & music",
  sensory: "Sensory",
};

export const isFormat = (value: unknown): value is ActivityFormat => (ACTIVITY_FORMATS as readonly unknown[]).includes(value);

/** What an item with no `formats` of its own is taken to be, by its category. */
const FROM_CATEGORY: Record<string, ActivityFormat[]> = {
  "cognicopia-coloring": ["printable"],
  numbers: ["games"],
  word: ["games"],
  letters: ["printable"],
  movement: ["active"],
  music: ["active"],
  multisensory: ["sensory"],
  reminiscence: ["reminiscence"],
  trivia: ["trivia"],
};

export function formatsOf(item: { category: string; content_payload: { formats?: readonly ActivityFormat[] } }): ActivityFormat[] {
  const own = item.content_payload.formats;
  if (own && own.length > 0) return [...own];
  return FROM_CATEGORY[item.category] ?? ["games"];
}

/** What to call an item on a calendar or a list: a reminiscence prompt is named for what it is. */
export const displayTitle = (item: { title: string; category: string }): string => (item.category === "reminiscence" ? `Reminiscence: ${item.title}` : item.title);

const CATEGORY_LABELS: Record<string, string> = {
  "cognicopia-coloring": "Coloring pages",
  numbers: "Number games",
  word: "Word games",
  letters: "Letter practice",
  movement: "Movement",
  music: "Music",
  multisensory: "Sensory activities",
  reminiscence: "Reminiscence prompts",
  trivia: "Trivia",
};

/** What to call a category on a heading: the ones we know by name, any other made readable ("road-trips" is "Road trips"). */
export function categoryLabel(slug: string): string {
  return Object.hasOwn(CATEGORY_LABELS, slug) ? CATEGORY_LABELS[slug]! : slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}
