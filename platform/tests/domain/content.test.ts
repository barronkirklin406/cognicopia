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

  it.each([
    ["no summary", { schema_version: 1 }],
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
