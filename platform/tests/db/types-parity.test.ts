import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Constants, type Database, type Tables, type TablesInsert } from "@/lib/db/database.types";
import { COLUMNS } from "@/lib/db/models";
import { createDb } from "./harness";

/**
 * The TypeScript types describe the database that the migrations build. This
 * file is what keeps that true: it compares the types' columns, which columns
 * are optional to insert, which can be null, the enum values and the functions
 * against the real migrated database. Change a migration without the types and
 * this fails.
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
type NullableKeys<T> = { [K in keyof T]-?: null extends T[K] ? K : never }[keyof T];

/** The columns a row may omit on insert: the ones with a default, and the nullable ones. */
const INSERT_OPTIONAL = {
  facilities: [
    "id",
    "subscription_status",
    "stripe_customer_id",
    "stripe_subscription_id",
    "subscription_interval",
    "subscription_current_period_end",
    "subscription_cancel_at_period_end",
    "subscription_synced_at",
    "created_at",
  ],
  facility_users: ["role", "created_at"],
  facility_invites: ["id", "email", "role", "created_by", "created_at", "accepted_at", "accepted_by"],
  content_items: ["id", "created_at"],
  activity_calendars: ["id", "created_at"],
} as const satisfies { [T in TableName]: readonly (keyof TablesInsert<T>)[] };

// If a list above stops matching its Insert type, these stop compiling.
export type _FacilitiesInsert = Assert<Equal<OptionalKeys<TablesInsert<"facilities">>, (typeof INSERT_OPTIONAL.facilities)[number]>>;
export type _FacilityUsersInsert = Assert<Equal<OptionalKeys<TablesInsert<"facility_users">>, (typeof INSERT_OPTIONAL.facility_users)[number]>>;
export type _FacilityInvitesInsert = Assert<Equal<OptionalKeys<TablesInsert<"facility_invites">>, (typeof INSERT_OPTIONAL.facility_invites)[number]>>;
export type _ContentItemsInsert = Assert<Equal<OptionalKeys<TablesInsert<"content_items">>, (typeof INSERT_OPTIONAL.content_items)[number]>>;
export type _ActivityCalendarsInsert = Assert<Equal<OptionalKeys<TablesInsert<"activity_calendars">>, (typeof INSERT_OPTIONAL.activity_calendars)[number]>>;

/** The columns that may be null, as the Row types say. The database is checked against the same list below. */
const NULLABLE = [
  ["facilities", "stripe_customer_id"],
  ["facilities", "stripe_subscription_id"],
  ["facilities", "subscription_current_period_end"],
  ["facilities", "subscription_interval"],
  ["facilities", "subscription_synced_at"],
  ["facility_invites", "accepted_at"],
  ["facility_invites", "accepted_by"],
  ["facility_invites", "created_by"],
  ["facility_invites", "email"],
] as const;

export type _NullableFacilities = Assert<
  Equal<NullableKeys<Tables<"facilities">>, Extract<(typeof NULLABLE)[number], readonly ["facilities", string]>[1]>
>;
export type _NullableFacilityInvites = Assert<
  Equal<NullableKeys<Tables<"facility_invites">>, Extract<(typeof NULLABLE)[number], readonly ["facility_invites", string]>[1]>
>;
export type _NullableOthers = Assert<
  Equal<NullableKeys<Tables<"facility_users"> | Tables<"content_items"> | Tables<"activity_calendars">>, never>
>;

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

  it("the columns typed `| null` are exactly the ones that allow null", async () => {
    const nullable = await db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
        where table_schema = 'public' and is_nullable = 'YES' order by 1, 2`,
    );
    expect(nullable.rows.map((r) => [r.table_name, r.column_name])).toEqual(NULLABLE.map((pair) => [...pair]));
  });

  it("the JSON columns are jsonb and the ids are uuid", async () => {
    const types = await db.query<{ table_name: string; column_name: string; data_type: string }>(
      `select table_name, column_name, data_type from information_schema.columns
        where table_schema = 'public'
          and (data_type = 'jsonb' or column_name in ('id', 'facility_id', 'created_by', 'accepted_by'))
        order by 1, 2`,
    );
    for (const row of types.rows) {
      const expected = row.column_name === "content_payload" || row.column_name === "generated_data" ? "jsonb" : "uuid";
      expect(row.data_type, `${row.table_name}.${row.column_name}`).toBe(expected);
    }
  });

  it("timestamps are timestamptz everywhere, and month_year is text", async () => {
    const types = await db.query<{ column_name: string; data_type: string }>(
      `select column_name, data_type from information_schema.columns
        where table_schema = 'public'
          and (column_name = 'created_at' or column_name = 'month_year' or column_name = 'expires_at'
               or column_name = 'accepted_at' or column_name = 'subscription_current_period_end'
               or column_name = 'subscription_synced_at')`,
    );
    expect(types.rows.length).toBeGreaterThan(6);
    for (const row of types.rows) {
      expect(row.data_type, row.column_name).toBe(row.column_name === "month_year" ? "text" : "timestamp with time zone");
    }
  });

  it("the billing flag is a boolean, and the Stripe ids and interval are text", async () => {
    const types = await db.query<{ column_name: string; data_type: string }>(
      `select column_name, data_type from information_schema.columns
        where table_schema = 'public' and table_name = 'facilities'
          and column_name in ('subscription_cancel_at_period_end', 'stripe_customer_id', 'stripe_subscription_id', 'subscription_interval')
        order by 1`,
    );
    expect(types.rows).toEqual([
      { column_name: "stripe_customer_id", data_type: "text" },
      { column_name: "stripe_subscription_id", data_type: "text" },
      { column_name: "subscription_cancel_at_period_end", data_type: "boolean" },
      { column_name: "subscription_interval", data_type: "text" },
    ]);
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

// ---------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------

type FunctionName = keyof Database["public"]["Functions"];
type FunctionArgs<K extends FunctionName> = Database["public"]["Functions"][K]["Args"];

/** Each function the Data API exposes: its arguments (required, or optional because they have a default) and what it returns. */
const FUNCTIONS = {
  accept_facility_invite: { args: { p_token: "required" }, result: "uuid" },
  apply_stripe_subscription: {
    args: {
      p_customer_id: "required",
      p_observed_at: "required",
      p_subscription_id: "required",
      p_status: "required",
      p_interval: "optional",
      p_current_period_end: "optional",
      p_cancel_at_period_end: "optional",
    },
    result: "text",
  },
  create_facility: { args: { p_facility_name: "required" }, result: "uuid" },
  create_facility_invite: { args: { p_email: "optional", p_role: "optional" }, result: "text" },
  preview_facility_invite: {
    args: { p_token: "required" },
    result: "TABLE(facility_name text, role facility_role, email_locked boolean, email_matches boolean)",
  },
} as const satisfies { [K in FunctionName]: { args: { [A in keyof FunctionArgs<K>]-?: "required" | "optional" }; result: string } };

// The argument names match the types' (satisfies, above), and so does which are optional:
type MarkedOptional<A> = { [K in keyof A]: A[K] extends "optional" ? K : never }[keyof A];
export type _FunctionArgsOptionality = Assert<
  Equal<
    { [K in FunctionName]: MarkedOptional<(typeof FUNCTIONS)[K]["args"]> },
    { [K in FunctionName]: OptionalKeys<FunctionArgs<K>> }
  >
>;

describe("functions", () => {
  it("the database exposes exactly the functions the types name", async () => {
    const names = await db.query<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1`,
    );
    expect(names.rows.map((r) => r.proname)).toEqual(Object.keys(FUNCTIONS).sort());
  });

  it.each(Object.entries(FUNCTIONS))("%s: same arguments, same optionality, same result", async (name, expected) => {
    const [fn] = (
      await db.query<{ args: string; result: string }>(
        `select pg_get_function_arguments(p.oid) as args, pg_get_function_result(p.oid) as result
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = $1`,
        [name],
      )
    ).rows;
    expect(fn, name).toBeDefined();

    // "p_email text DEFAULT NULL::text, p_role facility_role DEFAULT 'staff'::facility_role"
    const actual = Object.fromEntries(
      (fn?.args ?? "").split(/,\s+(?=p_)/).map((piece) => [piece.split(" ")[0], / DEFAULT /i.test(piece) ? "optional" : "required"]),
    );
    expect(actual).toEqual(expected.args);
    expect(fn?.result).toBe(expected.result);
  });
});
