-- =====================================================================
-- Cognicopia platform. Migration 2 of 3: a guard against resident-level data.
--
-- activity_calendars.generated_data is JSON that facility staff can write
-- through the Data API, so the database itself, not just our application
-- code, must refuse the obvious shapes of protected health information.
--
-- WHAT THIS DOES
--   Rejects a calendar whose JSON has a KEY that names a resident or a
--   health or identity field: "residents", "patient_name", "firstName",
--   "dob", "diagnosis", "medications", "ssn", "roomNumber" and so on.
--   It checks keys at every depth, inside arrays too.
--
-- WHAT THIS CANNOT DO
--   It cannot read free text. A resident's name typed into a "note" value
--   passes. This is one layer of several (see docs/saas-platform-architecture.md):
--   the application validates calendars against a strict schema, the screen
--   warns staff, and the service agreement disclaims PHI. Treat this as a
--   tripwire for mistakes, not as proof that a document is clean.
--
-- KEEPING THE LIST IN STEP
--   The same two lists are in lib/domain/phi-guard.ts. A test runs both
--   against the same keys and fails if they disagree. To change the lists,
--   change both and add a migration that re-creates this function.
-- =====================================================================

-- The keys in a JSON document that look like resident or health data.
--
-- A key is judged two ways:
--   1. Words. "residentName", "resident_name" and "Resident Name" all split
--      into the words resident + name, and "resident" is on the list.
--      Matching whole words means "residential" and "bedtime" are not caught.
--   2. The whole key with its separators removed, for names that are only
--      identifying together: "first_name" and "firstName" both become firstname.
create or replace function private.jsonb_phi_keys(doc jsonb)
returns text[]
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  with recursive walk (key, node, depth) as (
    select null::text, doc, 0
    union all
    select child.key, child.value, w.depth + 1
    from walk w
    cross join lateral (
      select o.key, o.value
        from jsonb_each(case when jsonb_typeof(w.node) = 'object' then w.node else '{}'::jsonb end) o
      union all
      select null::text, a.value
        from jsonb_array_elements(case when jsonb_typeof(w.node) = 'array' then w.node else '[]'::jsonb end) a
    ) child
    -- Stop expanding at depth 16 so a deeply nested document cannot make this
    -- expensive. The depth limit on the table rejects such a document anyway.
    where w.depth < 16
  )
  select coalesce(array_agg(distinct w.key order by w.key), '{}'::text[])
  from walk w
  where w.key is not null
    and (
      regexp_split_to_array(
        lower(regexp_replace(w.key, '([a-z0-9])([A-Z])', '\1 \2', 'g')),
        '[^a-z0-9]+'
      ) && array[
        'resident', 'residents',
        'patient', 'patients',
        'ssn', 'mrn', 'dob',
        'diagnosis', 'diagnoses',
        'medication', 'medications', 'prescription', 'prescriptions',
        'allergy', 'allergies',
        'physician',
        'birthday', 'birthdays',
        'insurance', 'medicare', 'medicaid',
        'email', 'phone', 'telephone', 'address',
        'guardian', 'surname', 'nickname'
      ]
      or regexp_replace(lower(w.key), '[^a-z0-9]', '', 'g') = any (array[
        'firstname', 'lastname', 'middlename', 'fullname', 'maidenname',
        'givenname', 'familyname', 'preferredname', 'legalname',
        'dateofbirth', 'birthdate', 'birthday', 'birthdays',
        'socialsecurity', 'socialsecuritynumber',
        'medicalrecord', 'medicalrecordnumber', 'healthrecord', 'healthrecordnumber',
        'roomnumber', 'bednumber', 'emergencycontact', 'nextofkin'
      ])
    )
$$;

comment on function private.jsonb_phi_keys(jsonb) is
  'Returns the keys of a JSON document (at any depth) that name a resident or a health or identity field. Empty when none do. A tripwire, not a guarantee: it cannot read free text.';

-- Execution is not restricted on purpose. A CHECK constraint is evaluated as
-- the role that writes the row, and this function only reads its argument.

alter table public.activity_calendars
  -- No more than 11 levels deep. Real calendars are about 4 deep.
  add constraint activity_calendars_generated_data_shallow
    check (not jsonb_path_exists(generated_data, 'strict $.**{12 to last}')),
  add constraint activity_calendars_generated_data_no_phi_keys
    check (private.jsonb_phi_keys(generated_data) = '{}'::text[]);
