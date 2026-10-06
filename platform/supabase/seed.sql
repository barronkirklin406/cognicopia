-- =====================================================================
-- Development seed: a small shared activity library.
--
-- `supabase db reset` runs this after the migrations. It is sample content for
-- building the screens, not the production library, which is loaded by
-- Cognicopia through the service role. It holds no people and no resident data.
--
-- The payloads follow lib/domain/content.ts (schema_version 1). A test
-- (tests/db/seed.test.ts) checks every one of them against that schema. The
-- `generator` names are the activity ids the facility planner already uses
-- (src/services/facilityPlanner.ts).
-- =====================================================================

insert into public.content_items (id, title, category, dementia_stage, content_payload) values
  ('5eed0000-0000-4000-8000-000000000001', 'Sing-along classics', 'music', 'universal',
   '{"schema_version":1,"summary":"Public-domain classics in very large type to sing together.","minutes":20,"group_friendly":true,"sensory":true,"template":{"generator":"lyric-sheet","params":{}}}'),
  ('5eed0000-0000-4000-8000-000000000002', 'Chair yoga', 'movement', 'universal',
   '{"schema_version":1,"summary":"Gentle seated stretches, led from the front of the room.","minutes":20,"group_friendly":true,"sensory":true,"template":{"generator":"chair-yoga","params":{}}}'),
  ('5eed0000-0000-4000-8000-000000000003', 'Large-print word search', 'word', 'early',
   '{"schema_version":1,"summary":"A 12 or 15 square word search with the words listed beneath it.","minutes":20,"group_friendly":false,"sensory":false,"template":{"generator":"search-large","params":{}}}'),
  ('5eed0000-0000-4000-8000-000000000004', 'Guided word search', 'word', 'middle',
   '{"schema_version":1,"summary":"A small 8 square word search; the first letter of each word is boxed.","minutes":15,"group_friendly":false,"sensory":false,"template":{"generator":"search-guided","params":{}}}'),
  ('5eed0000-0000-4000-8000-000000000005', 'Line tracing', 'movement', 'late',
   '{"schema_version":1,"summary":"Thick paths to trace with a finger or a marker: fine motor, one at a time.","minutes":15,"group_friendly":false,"sensory":true,"template":{"generator":"line-tracing","params":{}}}'),
  ('5eed0000-0000-4000-8000-000000000006', 'Coloring page', 'cognicopia-coloring', 'universal',
   '{"schema_version":1,"summary":"Bold adult line art; the detail of the picture follows the stage.","minutes":30,"group_friendly":true,"sensory":true,"template":{"generator":"cognicopia-coloring","params":{}}}'),
  ('5eed0000-0000-4000-8000-000000000007', 'Number ladders', 'numbers', 'early',
   '{"schema_version":1,"summary":"Counting on by 1s, 2s, 5s and 10s.","minutes":15,"group_friendly":false,"sensory":false,"template":{"generator":"number-ladder","params":{}}}'),
  ('5eed0000-0000-4000-8000-000000000008', 'Letter tracing', 'letters', 'late',
   '{"schema_version":1,"summary":"Very large letters to trace: tactile and calm.","minutes":15,"group_friendly":false,"sensory":true,"template":{"generator":"letter-tracing","params":{}}}'),
  ('5eed0000-0000-4000-8000-000000000009', 'Orientation board', 'multisensory', 'universal',
   '{"schema_version":1,"summary":"A giant-type board for the day, the date and the weather.","minutes":10,"group_friendly":true,"sensory":true,"template":{"generator":"orientation-board","params":{}}}'),
  ('5eed0000-0000-4000-8000-000000000010', 'Memory lane', 'word', 'universal',
   '{"schema_version":1,"summary":"Reminiscence prompts with no right or wrong answers.","minutes":30,"group_friendly":true,"sensory":false,"template":{"generator":"memory-lane","params":{}}}')
on conflict (id) do nothing;
