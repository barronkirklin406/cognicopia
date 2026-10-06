import type { PGlite } from "@electric-sql/pglite";

/**
 * Two facilities with their people, a calendar each, and a little content.
 * Fixed ids keep the tests readable. Nothing here is a real person.
 */

/** Accounts (auth.users ids). */
export const U = {
  alice: "a11ce000-0000-4000-8000-000000000001", // admin of facility A
  bob: "b0b00000-0000-4000-8000-000000000002", // staff of facility A
  carol: "ca401000-0000-4000-8000-000000000003", // admin of facility B
  dave: "da7e0000-0000-4000-8000-000000000004", // staff of facility B
  erin: "e4110000-0000-4000-8000-000000000005", // confirmed email, belongs to no facility yet
  frank: "f4a40000-0000-4000-8000-000000000006", // email not confirmed
  gina: "91a00000-0000-4000-8000-000000000007", // anonymous sign-in: no email at all
} as const;

/** Facilities. */
export const F = {
  a: "fac00000-0000-4000-8000-00000000000a", // Maple Court
  b: "fac00000-0000-4000-8000-00000000000b", // Birch Manor
} as const;

/** Calendars, one per facility, both for 2026-10. */
export const C = {
  a: "ca1e0000-0000-4000-8000-00000000000a",
  b: "ca1e0000-0000-4000-8000-00000000000b",
} as const;

/** Content items. */
export const K = {
  early: "c0de0000-0000-4000-8000-000000000001",
  universal: "c0de0000-0000-4000-8000-000000000002",
  late: "c0de0000-0000-4000-8000-000000000003",
} as const;

export const EMPTY_CALENDAR = JSON.stringify({ schema_version: 1, month: "2026-10", groups: [], slots: [] });

export async function seedFixtures(db: PGlite): Promise<void> {
  await db.exec(`
    insert into auth.users (id, email, email_confirmed_at, is_anonymous) values
      ('${U.alice}', 'alice@maple.example', now(), false),
      ('${U.bob}',   'bob@maple.example',   now(), false),
      ('${U.carol}', 'carol@birch.example', now(), false),
      ('${U.dave}',  'dave@birch.example',  now(), false),
      ('${U.erin}',  'Erin@Cedar.example',  now(), false),
      ('${U.frank}', 'frank@elm.example',   null,  false),
      ('${U.gina}',  null,                  null,  true);

    insert into public.facilities (id, facility_name, subscription_status, stripe_customer_id) values
      ('${F.a}', 'Maple Court', 'active',   'cus_maple1'),
      ('${F.b}', 'Birch Manor', 'trialing', 'cus_birch1');

    insert into public.facility_users (id, facility_id, email, role) values
      ('${U.alice}', '${F.a}', 'alice@maple.example',  'admin'),
      ('${U.bob}',   '${F.a}', 'bob@maple.example',    'staff'),
      ('${U.carol}', '${F.b}', 'carol@birch.example',  'admin'),
      ('${U.dave}',  '${F.b}', 'dave@birch.example',   'staff');

    insert into public.activity_calendars (id, facility_id, month_year, generated_data) values
      ('${C.a}', '${F.a}', '2026-10', '${EMPTY_CALENDAR}'::jsonb),
      ('${C.b}', '${F.b}', '2026-10', '${EMPTY_CALENDAR}'::jsonb);

    insert into public.content_items (id, title, category, dementia_stage, content_payload) values
      ('${K.early}',     'Seasonal word search', 'word',     'early',     '{"schema_version":1,"summary":"A word search."}'),
      ('${K.universal}', 'Sing-along',           'music',    'universal', '{"schema_version":1,"summary":"Songs to sing together."}'),
      ('${K.late}',      'Line tracing',         'movement', 'late',      '{"schema_version":1,"summary":"Thick paths to trace."}');
  `);
}
