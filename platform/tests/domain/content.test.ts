import { describe, expect, it } from "vitest";
import { CATEGORY_SLUG, CONTENT_CATEGORIES, parseContentPayload, stagesFor } from "@/lib/domain/content";

describe("parseContentPayload", () => {
  it("accepts a minimal payload and a full one", () => {
    expect(parseContentPayload({ schema_version: 1, summary: "A word search." }).ok).toBe(true);
    expect(
      parseContentPayload({
        schema_version: 1,
        summary: "Songs to sing together.",
        minutes: 20,
        group_friendly: true,
        sensory: true,
        materials: ["Large-print song sheets"],
        steps: ["Hand out the sheets.", "Start with a familiar chorus."],
        template: { generator: "lyric-sheet", params: { era: "1950s", count: 3, nested: { ok: [1, 2, null] } } },
      }).ok,
    ).toBe(true);
  });

  it("accepts the planning fields: formats, themes, a decade and senses, follow-ups, and trivia questions", () => {
    expect(
      parseContentPayload({
        schema_version: 1,
        summary: "Songs on the radio.",
        formats: ["reminiscence", "sensory"],
        themes: ["music", "nostalgia-1950s"],
        decade: 1950,
        senses: ["sound"],
        follow_ups: ["Dancing to it, or just listening?"],
        questions: [{ q: "Which brothers made the first powered flight?", a: "The Wright brothers" }],
      }).ok,
    ).toBe(true);
  });

  it.each([
    ["no summary", { schema_version: 1 }],
    ["no formats listed (leave the field out instead)", { schema_version: 1, summary: "x", formats: [] }],
    ["a format that does not exist", { schema_version: 1, summary: "x", formats: ["origami"] }],
    ["four formats", { schema_version: 1, summary: "x", formats: ["games", "trivia", "printable", "active"] }],
    ["a theme that does not exist", { schema_version: 1, summary: "x", themes: ["pirates"] }],
    ["seven themes", { schema_version: 1, summary: "x", themes: ["spring", "summer", "autumn", "winter", "garden", "music", "aviation"] }],
    ["a decade we have no prompts for", { schema_version: 1, summary: "x", decade: 1930 }],
    ["a decade as text", { schema_version: 1, summary: "x", decade: "1950" }],
    ["no senses listed (leave the field out instead)", { schema_version: 1, summary: "x", senses: [] }],
    ["a sense that does not exist", { schema_version: 1, summary: "x", senses: ["intuition"] }],
    ["four senses", { schema_version: 1, summary: "x", senses: ["sight", "sound", "smell", "taste"] }],
    ["seven follow-ups", { schema_version: 1, summary: "x", follow_ups: Array.from({ length: 7 }, () => "Then?") }],
    ["a follow-up over 200 characters", { schema_version: 1, summary: "x", follow_ups: ["f".repeat(201)] }],
    ["a question without an answer", { schema_version: 1, summary: "x", questions: [{ q: "Which?" }] }],
    ["a question with an extra field", { schema_version: 1, summary: "x", questions: [{ q: "Which?", a: "That", hint: "none" }] }],
    ["thirteen questions", { schema_version: 1, summary: "x", questions: Array.from({ length: 13 }, (_, i) => ({ q: `Q${i}`, a: "A" })) }],
    ["a blank summary", { schema_version: 1, summary: "  " }],
    ["a summary over 500 characters", { schema_version: 1, summary: "s".repeat(501) }],
    ["the wrong version", { schema_version: 2, summary: "x" }],
    ["minutes of 2", { schema_version: 1, summary: "x", minutes: 2 }],
    ["minutes of 200", { schema_version: 1, summary: "x", minutes: 200 }],
    ["fractional minutes", { schema_version: 1, summary: "x", minutes: 12.5 }],
    ["an unknown field", { schema_version: 1, summary: "x", surprise: true }],
    ["a template without a generator", { schema_version: 1, summary: "x", template: { params: {} } }],
    ["more than 30 steps", { schema_version: 1, summary: "x", steps: Array.from({ length: 31 }, () => "step") }],
    ["not an object", ["x"]],
  ])("refuses %s", (_label, input) => {
    expect(parseContentPayload(input).ok).toBe(false);
  });
});

describe("categories", () => {
  it("the known categories are all valid slugs", () => {
    for (const category of CONTENT_CATEGORIES) expect(CATEGORY_SLUG.test(category), category).toBe(true);
  });

  // The same examples the database's content_items_category_slug constraint is tested with.
  it.each(["word", "music", "cognicopia-coloring", "a", "a1-b2-c3"])("accepts %j", (c) => expect(CATEGORY_SLUG.test(c)).toBe(true));
  it.each(["Music", "music ", "a--b", "-a", "a-", "a_b", "", "café"])("refuses %j", (c) => expect(CATEGORY_SLUG.test(c)).toBe(false));
});

describe("stagesFor", () => {
  it("a stage includes the items that suit any stage", () => {
    expect(stagesFor("early")).toEqual(["early", "universal"]);
    expect(stagesFor("middle")).toEqual(["middle", "universal"]);
    expect(stagesFor("late")).toEqual(["late", "universal"]);
  });

  it("asking for universal means only those", () => {
    expect(stagesFor("universal")).toEqual(["universal"]);
  });
});
