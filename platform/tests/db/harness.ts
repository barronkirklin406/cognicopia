import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

/**
 * A real Postgres, in process, with the real migrations applied.
 *
 * The migrations are run exactly as written, on top of supabase-shim.sql
 * (which stands in for the parts of Supabase they rely on). Each test then
 * acts as a particular user inside a transaction that is rolled back, so tests
 * cannot affect each other.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
// COGNICOPIA_MIGRATIONS_DIR lets a script point the tests at a modified copy of the migrations,
// to check that the tests really do fail when a policy is weakened.
export const MIGRATIONS_DIR = process.env.COGNICOPIA_MIGRATIONS_DIR ?? path.join(ROOT, "supabase/migrations");

export const migrationFiles = (): string[] =>
  readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

export async function createDb(options: { seed?: boolean } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.waitReady;
  await db.exec(readFileSync(path.join(import.meta.dirname, "supabase-shim.sql"), "utf8"));
  for (const file of migrationFiles()) {
    await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
  if (options.seed) {
    await db.exec(readFileSync(path.join(ROOT, "supabase/seed.sql"), "utf8"));
  }
  return db;
}

// ---------------------------------------------------------------------
// Acting as someone
// ---------------------------------------------------------------------

export type Actor =
  | { kind: "anon" }
  | { kind: "user"; id: string; email?: string }
  | { kind: "service" }
  | { kind: "owner" }; // the migration runner: a superuser, for setting up and inspecting

export const anon: Actor = { kind: "anon" };
export const service: Actor = { kind: "service" };
export const owner: Actor = { kind: "owner" };
export const user = (id: string, email?: string): Actor => ({ kind: "user", id, email });

export interface Failure {
  code: string;
  message: string;
  /** The constraint that was violated, when the error names one. */
  constraint?: string;
}

/** What a statement did: the rows it returned, and how many it changed. */
export interface Outcome {
  rows: Record<string, unknown>[];
  affected: number;
}

export interface Session {
  /** Run a statement; a database error fails the test. */
  run(sql: string, params?: unknown[]): Promise<Outcome>;
  /** The rows of a query. */
  rows<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** The first column of the first row. */
  value<T = unknown>(sql: string, params?: unknown[]): Promise<T>;
  /** Run a statement that is expected to fail; returns the error, or null if it succeeded. */
  fails(sql: string, params?: unknown[]): Promise<Failure | null>;
  /** Carry on in the same transaction as someone else (to see one person's change as another). */
  become(actor: Actor): Promise<void>;
}

function asFailure(e: unknown): Failure {
  const err = e as { code?: string; message?: string; constraint?: string };
  return { code: String(err.code ?? ""), message: String(err.message ?? e), constraint: err.constraint };
}

async function assume(db: PGlite, actor: Actor): Promise<void> {
  await db.exec("reset role");
  if (actor.kind === "anon") {
    await db.exec("set local role anon");
  } else if (actor.kind === "service") {
    await db.exec("set local role service_role");
  } else if (actor.kind === "user") {
    await db.exec("set local role authenticated");
    const claims = { sub: actor.id, role: "authenticated", ...(actor.email ? { email: actor.email } : {}) };
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
  }
}

/**
 * Run `fn` as `actor`, inside a transaction that is always rolled back.
 * A signed-in user gets the role "authenticated" and JWT claims, as PostgREST
 * would set them, so auth.uid() works.
 */
export async function as<T>(db: PGlite, actor: Actor, fn: (s: Session) => Promise<T>): Promise<T> {
  await db.exec("begin");
  try {
    await assume(db, actor);

    const run = async (sql: string, params?: unknown[]): Promise<Outcome> => {
      const r = await db.query(sql, params as never);
      return { rows: r.rows as Record<string, unknown>[], affected: r.affectedRows ?? 0 };
    };

    const session: Session = {
      run,
      rows: async <R>(sql: string, params?: unknown[]) => (await run(sql, params)).rows as R[],
      value: async <V>(sql: string, params?: unknown[]) => {
        const row = (await run(sql, params)).rows[0];
        return (row ? Object.values(row)[0] : undefined) as V;
      },
      fails: async (sql: string, params?: unknown[]) => {
        // A failed statement aborts the transaction. A savepoint lets the test carry on.
        await db.exec("savepoint expected_failure");
        try {
          await run(sql, params);
          await db.exec("release savepoint expected_failure");
          return null;
        } catch (e) {
          await db.exec("rollback to savepoint expected_failure");
          return asFailure(e);
        }
      },
      become: (next: Actor) => assume(db, next),
    };

    return await fn(session);
  } finally {
    await db.exec("rollback");
  }
}
