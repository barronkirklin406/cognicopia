import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildSeedSql } from "../../supabase/seed-source/build.mjs";

describe("the development seed", () => {
  it("is exactly what supabase/seed-source writes: edit the items and run `npm run seed:build`, not the SQL", () => {
    const committed = readFileSync(path.join(import.meta.dirname, "../../supabase/seed.sql"), "utf8");
    expect(committed === buildSeedSql()).toBe(true);
  });
});
