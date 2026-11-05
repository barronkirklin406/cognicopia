import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { U } from "./fixtures";
import { anon, as, createDb, service, user } from "./harness";

/** The counter behind rate limiting: who may use it, how it counts, and that it never answers for anyone else's key. */

let db: PGlite;
beforeAll(async () => {
  db = await createDb();
});
afterAll(async () => {
  await db.close();
});

const hit = "select allowed, hits, retry_after from public.rate_limit_hit($1, $2, $3)";
type Row = { allowed: boolean; hits: number; retry_after: number };

describe("rate_limit_hit", () => {
  it("allows up to the limit and refuses after it, counting every call", async () => {
    await as(db, service, async (s) => {
      const answers = [];
      for (let i = 0; i < 5; i++) answers.push((await s.rows<Row>(hit, ["login:test-a", 3600, 3]))[0]!);
      expect(answers.map((a) => a.allowed)).toEqual([true, true, true, false, false]);
      expect(answers.map((a) => a.hits)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  it("keeps one key's count apart from another's", async () => {
    await as(db, service, async (s) => {
      for (let i = 0; i < 3; i++) await s.rows(hit, ["login:test-b", 3600, 2]);
      expect((await s.rows<Row>(hit, ["login:test-b", 3600, 2]))[0]!.allowed).toBe(false);
      expect((await s.rows<Row>(hit, ["login:test-c", 3600, 2]))[0]).toMatchObject({ allowed: true, hits: 1 });
    });
  });

  it("says how long until the window ends, between one second and the window's length", async () => {
    await as(db, service, async (s) => {
      const [row] = await s.rows<Row>(hit, ["login:test-d", 600, 1]);
      expect(row!.retry_after).toBeGreaterThanOrEqual(1);
      expect(row!.retry_after).toBeLessThanOrEqual(600);
    });
  });

  it("starts again in the next window", async () => {
    await db.exec("reset role");
    const first = await db.query<Row>("select * from public.rate_limit_hit('window:test', 1, 1)");
    const second = await db.query<Row>("select * from public.rate_limit_hit('window:test', 1, 1)");
    // Both calls could land in one window (the second is then refused) or straddle a boundary: wait for a fresh one.
    await new Promise((resolve) => setTimeout(resolve, 2100));
    const later = await db.query<Row>("select * from public.rate_limit_hit('window:test', 1, 1)");
    expect(first.rows[0]!.allowed).toBe(true);
    expect(later.rows[0]).toMatchObject({ allowed: true, hits: 1 });
    expect([true, false]).toContain(second.rows[0]!.allowed);
  });

  it.each([
    ["an empty key", "", 60, 5],
    ["a key over 200 characters", "k".repeat(201), 60, 5],
    ["a window of zero", "k", 0, 5],
    ["a window over a day", "k", 86401, 5],
    ["a limit of zero", "k", 60, 0],
    ["a limit over 100000", "k", 60, 100001],
  ])("refuses %s", async (_name, key, seconds, max) => {
    await as(db, service, async (s) => {
      const failure = await s.fails(hit, [key, seconds, max]);
      expect(failure?.code).toBe("22023");
    });
  });

  it.each([
    ["a signed-out visitor", anon],
    ["a signed-in user", user(U.alice)],
  ])("is not for %s", async (_who, actor) => {
    await as(db, actor, async (s) => {
      const failure = await s.fails(hit, ["login:x", 60, 5]);
      expect(failure?.code).toBe("42501");
    });
  });

  it("keeps the counts out of every role's reach, the server's included: only the function touches the table", async () => {
    await as(db, service, async (s) => {
      for (const role of ["anon", "authenticated", "service_role"]) {
        for (const p of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
          expect(await s.value<boolean>(`select has_table_privilege('${role}', 'private.rate_limits', '${p}')`), `${role} ${p}`).toBe(false);
        }
      }
    });
  });
});
