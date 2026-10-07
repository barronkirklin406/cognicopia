import { parseContentPayload, stagesFor } from "@/lib/domain/content";
import type { ContentItem, ContentItemRow, DementiaStage } from "@/lib/db/models";
import type { Db } from "./db";
import { DataError, fromDbError } from "./errors";

export interface ContentFilter {
  /** Items that suit this stage, including the "universal" ones. */
  stage?: DementiaStage;
  category?: string;
  /** At most this many (default 100, never more than 1000: the planning screens load the whole library). */
  limit?: number;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

function toItem(row: ContentItemRow): ContentItem {
  const payload = parseContentPayload(row.content_payload);
  // The library is written by us. A bad payload is our bug: fail loudly, not quietly.
  if (!payload.ok) throw new DataError(500, "stored_data_invalid", "A library item could not be read.");
  return { ...row, content_payload: payload.data };
}

/** The shared activity library, filtered by the database and ordered by category, then title. */
export async function listContent(db: Db, filter: ContentFilter = {}): Promise<ContentItem[]> {
  let query = db
    .from("content_items")
    .select("*")
    .order("category", { ascending: true })
    .order("title", { ascending: true })
    .limit(Math.min(Math.max(filter.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT));

  if (filter.stage) query = query.in("dementia_stage", stagesFor(filter.stage));
  if (filter.category) query = query.eq("category", filter.category);

  const { data, error } = await query;
  if (error) throw fromDbError(error);
  return data.map(toItem);
}

/** Titles for some library items, by id: to show what a calendar's sessions are. Items the caller may not see are simply missing. */
export async function contentTitles(db: Db, ids: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].slice(0, 500);
  if (unique.length === 0) return new Map();
  const { data, error } = await db.from("content_items").select("id, title").in("id", unique);
  if (error) throw fromDbError(error);
  return new Map(data.map((row) => [row.id, row.title]));
}

/** Whole library items by id: what a calendar's sessions are, with how to run them. Items the caller may not see are simply missing. */
export async function contentByIds(db: Db, ids: readonly string[]): Promise<Map<string, ContentItem>> {
  const unique = [...new Set(ids)].slice(0, 500);
  if (unique.length === 0) return new Map();
  const { data, error } = await db.from("content_items").select("*").in("id", unique);
  if (error) throw fromDbError(error);
  return new Map(data.map((row) => [row.id, toItem(row)]));
}
