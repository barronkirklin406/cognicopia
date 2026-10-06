import { readFileSync } from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PHI_KEY_COMPACT, PHI_KEY_WORDS, findPhiKeys, isPhiKey } from "@/lib/domain/phi-guard";
import { MIGRATIONS_DIR, createDb } from "./harness";

/**
 * The same tripwire is written twice: in SQL (the database enforces it) and in
 * TypeScript (the application refuses early, with a good message). If the two
 * ever disagree, a document could pass one and fail the other. This runs both
 * on thousands of keys and on random nested documents and demands the same answer.
 */

let db: PGlite;
beforeAll(async () => {
  db = await createDb();
});
afterAll(async () => {
  await db.close();
});

/** A small deterministic random generator, so a failure can be reproduced. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FRAGMENTS = [
  ...PHI_KEY_WORDS,
  "first", "last", "name", "birth", "date", "day", "of", "room", "bed", "number", "social", "security", "medical",
  "record", "health", "next", "kin", "emergency", "contact", "full", "middle", "maiden", "given", "family", "preferred",
  "legal", "group", "slot", "note", "time", "id", "wing", "size", "count", "type", "home", "work", "item", "data",
  "month", "residential", "bedtime", "phonetic", "roommate", "x", "a", "b", "c1", "2", "42",
];

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
const STYLES: ((parts: string[]) => string)[] = [
  (p) => p.join("_"),
  (p) => p.join("-"),
  (p) => p.join(""),
  (p) => p.join(" "),
  (p) => p.join("."),
  (p) => p.map((w, i) => (i === 0 ? w : cap(w))).join(""), // camelCase
  (p) => p.map(cap).join(""), // PascalCase
  (p) => p.join("_").toUpperCase(),
  (p) => p.map(cap).join(" "),
  (p) => p.join("__"),
  (p) => `_${p.join("_")}_`,
];

function corpus(): string[] {
  const next = rng(20261006);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)] as T;
  const keys = new Set<string>();
  // every listed word and compact key, in every style
  for (const base of [...PHI_KEY_WORDS, ...PHI_KEY_COMPACT]) for (const style of STYLES) keys.add(style([base]));
  // the compact keys written as separate words
  keys.add("first_name").add("firstName").add("date_of_birth").add("dateOfBirth").add("next_of_kin").add("room_number");
  // thousands of random combinations
  for (let i = 0; i < 4000; i++) {
    const n = 1 + Math.floor(next() * 4);
    const parts = Array.from({ length: n }, () => pick(FRAGMENTS));
    keys.add(pick(STYLES)(parts));
  }
  return [...keys];
}

describe("the two lists", () => {
  /** The quoted words of an array literal in the migration's function. */
  const listFromMigration = (opening: RegExp): string[] => {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, "20261006120100_phi_guard.sql"), "utf8");
    const start = sql.search(opening);
    expect(start, `${opening} in the migration`).toBeGreaterThan(-1);
    const body = sql.slice(start, sql.indexOf("]", start));
    return [...body.matchAll(/'([a-z0-9]+)'/g)].map((m) => m[1] as string);
  };

  it("the words in the migration are exactly the words in TypeScript", () => {
    expect(listFromMigration(/&& array\[/).sort()).toEqual([...PHI_KEY_WORDS].sort());
  });

  it("the compact keys in the migration are exactly the compact keys in TypeScript", () => {
    expect(listFromMigration(/= any \(array\[/).sort()).toEqual([...PHI_KEY_COMPACT].sort());
  });
});

describe("one key at a time", () => {
  it("TypeScript and SQL give the same answer for every key", async () => {
    const keys = corpus();
    expect(keys.length).toBeGreaterThan(3000);

    const sql = await db.query<{ k: string; phi: boolean }>(
      "select k, cardinality(private.jsonb_phi_keys(jsonb_build_object(k, 1))) > 0 as phi from unnest($1::text[]) as k",
      [keys],
    );
    expect(sql.rows.length).toBe(keys.length);

    const disagreements = sql.rows.filter((r) => r.phi !== isPhiKey(r.k)).map((r) => ({ key: r.k, sql: r.phi, ts: isPhiKey(r.k) }));
    expect(disagreements).toEqual([]);

    // The test is not vacuous: the corpus has plenty of both kinds.
    const refused = sql.rows.filter((r) => r.phi).length;
    expect(refused).toBeGreaterThan(500);
    expect(keys.length - refused).toBeGreaterThan(500);
  });

  it("every listed word and compact key is refused, in every style", () => {
    for (const base of [...PHI_KEY_WORDS, ...PHI_KEY_COMPACT]) {
      for (const style of STYLES) expect(isPhiKey(style([base])), style([base])).toBe(true);
    }
  });
});

describe("whole documents", () => {
  /** A random JSON document of at most `budget` nodes, sometimes a long narrow chain so depth is exercised. */
  function randomDoc(next: () => number, depth: number, keys: string[], budget: { n: number }): unknown {
    const roll = next();
    if (budget.n <= 0 || depth > 19 || roll < 0.2) return roll < 0.08 ? null : roll < 0.14 ? "text" : 1;
    budget.n -= 1;
    const width = depth < 3 ? 1 + Math.floor(next() * 3) : next() < 0.8 ? 1 : 2; // wide near the top, narrow below
    if (roll < 0.5) return Array.from({ length: width }, () => randomDoc(next, depth + 1, keys, budget));
    const out: Record<string, unknown> = {};
    for (let i = 0; i < width; i++) out[keys[Math.floor(next() * keys.length)] as string] = randomDoc(next, depth + 1, keys, budget);
    return out;
  }

  it("TypeScript and SQL find the same keys in 300 random nested documents", async () => {
    const next = rng(77);
    const keys = corpus();
    const docs = Array.from({ length: 300 }, () => randomDoc(next, 0, keys, { n: 120 }));
    let withKeys = 0;
    for (const doc of docs) {
      const sql = (await db.query<{ found: string[] }>("select private.jsonb_phi_keys($1::jsonb) as found", [JSON.stringify(doc)])).rows[0]?.found ?? [];
      const ts = findPhiKeys(doc);
      expect([...sql].sort(), JSON.stringify(doc).slice(0, 200)).toEqual([...ts].sort());
      if (ts.length > 0) withKeys++;
    }
    expect(withKeys).toBeGreaterThan(30);
  });

  it("both look 16 levels down and no further", async () => {
    const nest = (levels: number) => `${'{"a":'.repeat(levels)}{"dob":1}${"}".repeat(levels)}`;
    for (const [levels, found] of [[15, true], [16, false]] as const) {
      const sql = (await db.query<{ found: string[] }>("select private.jsonb_phi_keys($1::jsonb) as found", [nest(levels)])).rows[0]?.found ?? [];
      expect(sql.length > 0, `SQL, ${levels} levels`).toBe(found);
      expect(findPhiKeys(JSON.parse(nest(levels))).length > 0, `TypeScript, ${levels} levels`).toBe(found);
    }
  });
});
