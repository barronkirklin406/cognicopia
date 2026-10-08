import { readFileSync } from "node:fs";
import path from "node:path";
import type { ContentItem } from "@/lib/db/models";

/**
 * The development library (supabase/seed.sql) as content items, for tests that want a
 * realistic library without a database. The seed is generated, one item per tuple:
 *   ('<id>', '<title>', '<category>', '<stage>',
 *    '<json payload>')
 * with a quote written as two.
 */
export function seedLibrary(): ContentItem[] {
  const sql = readFileSync(path.join(import.meta.dirname, "../../supabase/seed.sql"), "utf8");
  const text = (value: string) => value.replace(/''/g, "'");
  const tuple = /\('([0-9a-f-]{36})', '((?:[^']|'')*)', '([a-z-]+)', '(early|middle|late|universal)',\s*'((?:[^']|'')*)'\)/g;
  const items: ContentItem[] = [];
  for (const m of sql.matchAll(tuple)) {
    items.push({
      id: m[1]!,
      title: text(m[2]!),
      category: m[3]!,
      dementia_stage: m[4] as ContentItem["dementia_stage"],
      content_payload: JSON.parse(text(m[5]!)),
      created_at: "2026-01-01T00:00:00Z",
    });
  }
  return items;
}
