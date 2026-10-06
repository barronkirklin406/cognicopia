import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Constants, type Database, type TablesInsert } from "@/lib/db/database.types";
import { COLUMNS } from "@/lib/db/models";
import { createDb } from "./harness";

/**
 * The TypeScript types describe the database that the migrations build. This
 * file is what keeps that true: it compares the types' columns, which columns
 * are optional to insert, the enum values and the one function against the real
 * migrated database. Change a migration without the types and this fails.
 *
 * Part of the checking is done by the compiler (npm run typecheck): the
 * `Equal` assertions below fail the build if a list drifts from its type.
 */

let db: PGlite;
beforeAll(async () => {
  db = await createDb();
});
afterAll(async () => {
  await db.close();
});

type TableName = keyof Database["public"]["Tables"];
const TABLES = Object.keys(COLUMNS) as TableName[];

// ---- compile-time helpers ----
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type OptionalKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? K : never }[keyof T];

/** The columns a row may omit on insert: the ones with a default, and the nullable ones. */
const INSERT_OPTIONAL = {
  facilities: ["id", "subscription_status", "stripe_customer_id", "created_at"],
  facility_users: ["role", "created_at"],
  content_items: ["id", "created_at"],
  activity_calendars: ["id", "created_at"],
} as const satisfies { [T in TableName]: readonly (keyof TablesInsert<T>)[] };

// If a list above stops matching its Insert type, these stop compiling.
export type _FacilitiesInsert = Assert<Equal<OptionalKeys<TablesInsert<"facilities">>, (typeof INSERT_OPTIONAL.facilities)[number]>>;
export type _FacilityUsersInsert = Assert<Equal<OptionalKeys<TablesInsert<"facility_users">>, (typeof INSERT_OPTIONAL.facility_users)[number]>>;
export type _ContentItemsInsert = Assert<Equal<OptionalKeys<TablesInsert<"content_items">>, (typeof INSERT_OPTIONAL.content_items)[number]>>;
export type _ActivityCalendarsInsert = Assert<Equal<OptionalKeys<TablesInsert<"activity_calendars">>, (typeof INSERT_OPTIONAL.activity_calendars)[number]>>;

describe("tables and columns", () => {
  it("the types list exactly the tables the migrations create", async () => {
    const tables = await db.query<{ tablename: string }>("select tablename from pg_tables where schemaname = 'public' order by 1");
    expect(tables.rows.map((r) => r.tablename)).toEqual([...TABLES].sort());
  });

  it.each(TABLES)("%s: the types list exactly the table's columns", async (table) => {
    const cols = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by column_name",
      [table],
    );
    expect(cols.rows.map((r) => r.column_name)).toEqual(Object.keys(COLUMNS[table]).sort());
  });

  it.each(TABLES)("%s: the columns optional to insert are the ones with a default or that allow null", async (table) => {
    const cols = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = $1
          and (is_nullable = 'YES' or column_default is not null or is_identity = 'YES')
        order by column_name`,
      [table],
    );
    expect(cols.rows.map((r) => r.column_name)).toEqual([...INSERT_OPTIONAL[table]].sort());
  });

  it("only stripe_customer_id may be null: it is the one column typed `| null`", async () => {
    const nullable = await db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
        where table_schema = 'public' and is_nullable = 'YES' order by 1, 2`,
    );
    expect(nullable.rows).toEqual([{ table_name: "facilities", column_name: "stripe_customer_id" }]);
  });

  it("the JSON columns are jsonb and the ids are uuid", async () => {
    const types = await db.query<{ table_name: string; column_name: string; data_type: string }>(
      `select table_name, column_name, data_type from information_schema.columns
        where table_schema = 'public' and (data_type = 'jsonb' or column_name = 'id' or column_name = 'facility_id')
        order by 1, 2`,
    );
    for (const row of types.rows) {
      const expected = row.column_name === "content_payload" || row.column_name === "generated_data" ? "jsonb" : "uuid";
      expect(row.data_type, `${row.table_name}.${row.column_name}`).toBe(expected);
    }
  });

  it("created_at is a timestamptz everywhere, and month_year is text", async () => {
    const types = await db.query<{ column_name: string; data_type: string }>(
      `select column_name, data_type from information_schema.columns
        where table_schema = 'public' and column_name in ('created_at', 'month_year')`,
    );
    for (const row of types.rows) {
      expect(row.data_type, row.column_name).toBe(row.column_name === "created_at" ? "timestamp with time zone" : "text");
    }
  });
});

describe("enums", () => {
  const enums = Object.entries(Constants.public.Enums);

  it("the types list exactly the enums the migrations create", async () => {
    const names = await db.query<{ typname: string }>(
      `select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typtype = 'e' order by 1`,
    );
    expect(names.rows.map((r) => r.typname)).toEqual(enums.map(([name]) => name).sort());
  });

  it.each(enums)("%s: same values, same order", async (name, values) => {
    const labels = await db.query<{ enumlabel: string }>(
      `select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
        where t.typname = $1 order by e.enumsortorder`,
      [name],
    );
    expect(labels.rows.map((r) => r.enumlabel)).toEqual([...values]);
  });
});

// The types name exactly one function: if another is added to Database["public"]["Functions"], this stops compiling.
export type _OnlyCreateFacility = Assert<Equal<keyof Database["public"]["Functions"], "create_facility">>;

describe("functions", () => {
  it("the database exposes exactly one function to the API, and the types name it", async () => {
    const names = await db.query<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1`,
    );
    expect(names.rows.map((r) => r.proname)).toEqual(["create_facility"]);
  });

  it("create_facility takes p_facility_name (text) and returns a uuid, as the types say", async () => {
    const [fn] = (
      await db.query<{ args: string; returns: string }>(
        `select pg_get_function_arguments(p.oid) as args, p.prorettype::regtype::text as returns
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'create_facility'`,
      )
    ).rows;
    expect(fn).toEqual({ args: "p_facility_name text", returns: "uuid" });
  });
});
