import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMENTIA_STAGES } from "@/lib/db/models";
import { CONTENT_CATEGORIES, parseContentPayload } from "@/lib/domain/content";
import { createDb } from "./harness";

/** The development seed loads, and every item in it is valid by the application's own rules. */

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
    expect(rows[0]?.n).toBe(10);
  });

  it("is safe to run twice", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    await db.exec(readFileSync(path.join(import.meta.dirname, "../../supabase/seed.sql"), "utf8"));
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.content_items");
    expect(rows[0]?.n).toBe(10);
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
});
