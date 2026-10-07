import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMENTIA_STAGES } from "@/lib/db/models";
import type { ContentItem } from "@/lib/db/models";
import { roleOf } from "@/lib/domain/calendar-generator";
import { CONTENT_CATEGORIES, parseContentPayload } from "@/lib/domain/content";
import { ACTIVITY_FORMATS, formatsOf } from "@/lib/domain/formats";
import { DECADES, SENSES, toPrompt } from "@/lib/domain/reminiscence";
import { TRACK_STAGES, suitsStage } from "@/lib/domain/stages";
import { THEME_IDS } from "@/lib/domain/themes";
import { createDb } from "./harness";

/** The development seed loads, and every item in it is valid by the application's own rules. */

/** How many items supabase/seed.sql holds (it is generated; this changes when the library does). */
const SEEDED = 104;

let db: PGlite;
beforeAll(async () => {
  db = await createDb({ seed: true });
});
afterAll(async () => {
  await db.close();
});

describe("supabase/seed.sql", () => {
  it("loads sample content", async () => {
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.content_items");
    expect(rows[0]?.n).toBe(SEEDED);
  });

  it("is safe to run twice", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    await db.exec(readFileSync(path.join(import.meta.dirname, "../../supabase/seed.sql"), "utf8"));
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.content_items");
    expect(rows[0]?.n).toBe(SEEDED);
  });

  it("every payload passes the content schema", async () => {
    const { rows } = await db.query<{ title: string; content_payload: unknown }>("select title, content_payload from public.content_items order by title");
    for (const row of rows) {
      const parsed = parseContentPayload(row.content_payload);
      expect(parsed.ok, `${row.title}: ${parsed.ok ? "" : JSON.stringify(parsed.issues)}`).toBe(true);
    }
  });

  it("every category is a known one, and every stage is used", async () => {
    const { rows } = await db.query<{ category: string; dementia_stage: string }>("select category, dementia_stage::text from public.content_items");
    for (const row of rows) expect(CONTENT_CATEGORIES as readonly string[]).toContain(row.category);
    expect([...new Set(rows.map((r) => r.dementia_stage))].sort()).toEqual([...DEMENTIA_STAGES].sort());
  });

  it("holds no people: nothing in it mentions a resident field", async () => {
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from public.content_items where content_payload::text ~* '(resident_|patient|birth|diagnos|medication|ssn)'",
    );
    expect(rows[0]?.n).toBe(0);
  });

  describe("what the planning tools need from the library", () => {
    let items: ContentItem[];
    beforeAll(async () => {
      const { rows } = await db.query<ContentItem>("select id, title, category, dementia_stage, content_payload, created_at from public.content_items order by category, title");
      items = rows;
    });

    it("has enough for every stage to fill a day: three or more of each kind of session", () => {
      for (const stage of TRACK_STAGES) {
        const pool = items.filter((i) => suitsStage(i.dementia_stage, stage));
        for (const role of ["energize", "engage", "calm"] as const) {
          const n = pool.filter((i) => roleOf({ category: i.category, formats: formatsOf(i) }) === role).length;
          expect(n, `${stage} ${role}`).toBeGreaterThanOrEqual(3);
        }
      }
    });

    it("has every kind of activity for every stage, so no filter ever comes up empty", () => {
      for (const stage of TRACK_STAGES) {
        for (const format of ACTIVITY_FORMATS) {
          const n = items.filter((i) => suitsStage(i.dementia_stage, stage) && formatsOf(i).includes(format)).length;
          expect(n, `${stage} ${format}`).toBeGreaterThan(0);
        }
      }
    });

    it("has several activities for every calendar theme", () => {
      for (const theme of THEME_IDS) {
        const n = items.filter((i) => (i.content_payload.themes ?? []).includes(theme)).length;
        expect(n, theme).toBeGreaterThanOrEqual(3);
      }
    });

    it("has trivia that comes with its answers", () => {
      const trivia = items.filter((i) => formatsOf(i).includes("trivia"));
      expect(trivia.length).toBeGreaterThanOrEqual(6);
      for (const item of trivia) expect(item.content_payload.questions?.length ?? 0, item.title).toBeGreaterThan(0);
    });

    describe("reminiscence prompts", () => {
      const prompts = () => items.filter((i) => i.category === "reminiscence");

      it("are complete: a decade, the senses, and what to say next", () => {
        for (const item of prompts()) {
          const prompt = toPrompt(item);
          expect(prompt, item.title).not.toBeNull();
          expect(prompt!.followUps.length, item.title).toBeGreaterThan(0);
        }
      });

      it("cover every decade from the 1940s to the 1970s, and every sense in each", () => {
        for (const decade of DECADES) {
          const inDecade = prompts().map(toPrompt).filter((p) => p?.decade === decade);
          expect(inDecade.length, `${decade}s`).toBeGreaterThanOrEqual(10);
          for (const sense of SENSES) expect(inDecade.some((p) => p!.senses.includes(sense)), `${decade}s ${sense}`).toBe(true);
        }
      });

      it("invite and never quiz: no 'remember', 'what year', 'can you name' or 'do you recall'", () => {
        const text = (i: ContentItem) => [i.title, i.content_payload.summary, ...(i.content_payload.follow_ups ?? [])].join("\n");
        for (const item of prompts()) expect(text(item), item.title).not.toMatch(/remember|recall|what year|can you name|do you know/i);
      });

      it("keep late-stage wording to short comments and either-or choices: a question is only ever a choice between two (a prompt for any stage is shown for late stage too, so it follows the same rule)", () => {
        for (const item of prompts().filter((i) => i.dementia_stage === "late" || i.dementia_stage === "universal")) {
          const { summary, follow_ups = [] } = item.content_payload;
          for (const line of [summary, ...follow_ups]) if (line.includes("?")) expect(line, `${item.title}: ${line}`).toMatch(/ or /);
        }
      });

      it("ask first before offering a taste", () => {
        for (const item of prompts().filter((i) => i.content_payload.senses?.includes("taste"))) {
          expect((item.content_payload.steps ?? []).join(" "), item.title).toMatch(/diet and swallowing/i);
        }
      });
    });
  });
});
