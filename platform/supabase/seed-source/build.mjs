import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ACTIVITIES, PROMPTS } from "./items.mjs";

// Writes ../seed.sql from the items in ./items.mjs:  npm run seed:build
// tests/db/seed-source.test.ts fails if the two are out of step.

export function buildSeedSql() {
  const all = [...ACTIVITIES, ...PROMPTS];
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const idFor = (n) => `5eed0000-0000-4000-8000-${String(n).padStart(12, "0")}`;

  const rows = all.map((item, i) => {
    const payload = { schema_version: 1, ...item.payload };
    // keep key order stable and readable
    const { summary, minutes, group_friendly, sensory, ...rest } = payload;
    const ordered = { schema_version: 1, summary, ...(minutes !== undefined ? { minutes } : {}), ...(group_friendly !== undefined ? { group_friendly } : {}), ...(sensory !== undefined ? { sensory } : {}), ...Object.fromEntries(Object.entries(rest).filter(([k]) => k !== "schema_version")) };
    return `  (${q(idFor(i + 1))}, ${q(item.title)}, ${q(item.category)}, ${q(item.stage)},\n   ${q(JSON.stringify(ordered))})`;
  });

  return `-- =====================================================================
-- Development seed: a shared activity library to build and test the screens with.
--
-- \`supabase db reset\` runs this after the migrations. It is sample content, not the
-- production library, which is loaded by Cognicopia through the service role. It holds no
-- people and no resident data.
--
-- What is in it (${all.length} items):
--   activities     movement, music, games, printable sheets, sensory activities and coloring
--                  pages, for every stage, with the themes each fits;
--   trivia         short sets of familiar sayings, songs and everyday facts, with answers;
--   reminiscence   ${PROMPTS.length} conversation starters, ten for each decade from the 1940s to the 1970s,
--                  each with the senses it draws on and what to say next.
--
-- The payloads follow lib/domain/content.ts (schema_version 1). A test
-- (tests/db/seed.test.ts) checks every one of them against that schema, and another checks
-- the wording of the prompts. The \`generator\` names are the activity ids the facility
-- planner already uses (src/services/facilityPlanner.ts).
--
-- This file is written by a script from a table of items: edit supabase/seed-source/items.mjs and
-- run \`npm run seed:build\` (in platform/) rather than editing the SQL by hand. A test fails if the two
-- are out of step.
-- =====================================================================

insert into public.content_items (id, title, category, dementia_stage, content_payload) values
${rows.join(",\n")}
on conflict (id) do nothing;
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = new URL("../seed.sql", import.meta.url);
  writeFileSync(target, buildSeedSql());
  console.log(`wrote ${fileURLToPath(target)}`);
}
