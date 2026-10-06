import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { C, EMPTY_CALENDAR, F, seedFixtures, U } from "./fixtures";
import { as, createDb, owner, service, user } from "./harness";

/**
 * The zero-PHI tripwire on activity_calendars.generated_data (migration 2).
 * It judges KEYS. It cannot read free text, and one test says so out loud.
 */

let db: PGlite;

beforeAll(async () => {
  db = await createDb();
  await seedFixtures(db);
});
afterAll(async () => {
  await db.close();
});

const NO_PHI = "activity_calendars_generated_data_no_phi_keys";
const insert = "insert into public.activity_calendars (facility_id, month_year, generated_data) values ($1, '2026-11', $2::jsonb)";
const keysIn = async (doc: unknown) =>
  as(db, owner, (s) => s.value<string[]>("select private.jsonb_phi_keys($1::jsonb)", [JSON.stringify(doc)]));

describe("keys that name a resident, an identity or a health record are refused", () => {
  const refused = [
    // the resident, and the words for one
    "resident", "residents", "residentName", "resident_name", "Resident Name", "RESIDENT", "residentId", "resident-id",
    "patient", "patients", "patientName",
    // names
    "first_name", "firstName", "FirstName", "first-name", "lastName", "last_name", "middleName", "fullName", "full name",
    "maidenName", "givenName", "familyName", "preferredName", "legalName", "surname", "nickname",
    // birth
    "dob", "DOB", "dateOfBirth", "date_of_birth", "birthDate", "birth_date", "birthdate", "birthday", "birth_day", "birthdays",
    // identifiers
    "ssn", "SSN", "socialSecurity", "socialSecurityNumber", "mrn", "medicalRecord", "medicalRecordNumber", "healthRecordNumber", "roomNumber", "room_number", "bedNumber",
    // health
    "diagnosis", "diagnoses", "medication", "medications", "medication_list", "prescription", "allergy", "allergies", "physician",
    // contact and coverage
    "phone", "phoneNumber", "telephone", "email", "emailAddress", "address", "homeAddress", "guardian",
    "emergencyContact", "emergency_contact", "nextOfKin", "next_of_kin", "insurance", "medicare", "medicaidId",
  ];

  it.each(refused)("refuses %j at the top of a calendar", async (key) => {
    await as(db, service, async (s) => {
      const failure = await s.fails(insert, [F.a, JSON.stringify({ schema_version: 1, [key]: "x" })]);
      expect(failure?.constraint).toBe(NO_PHI);
    });
  });

  it.each(["residents", "dateOfBirth", "diagnosis", "roomNumber", "email"])(
    "refuses %j buried inside objects and lists",
    async (key) => {
      await as(db, service, async (s) => {
        const deep = {
          schema_version: 1,
          groups: [{ id: "g1", name: "Garden Room", meta: { list: [[{ ok: 1 }, { [key]: 1 }]] } }],
          slots: [],
        };
        const failure = await s.fails(insert, [F.a, JSON.stringify(deep)]);
        expect(failure?.constraint).toBe(NO_PHI);
      });
    },
  );

  it("refuses an update that adds such a key to a calendar that was fine", async () => {
    await as(db, user(U.bob), async (s) => {
      const failure = await s.fails("update public.activity_calendars set generated_data = $2::jsonb where id = $1", [
        C.a,
        JSON.stringify({ schema_version: 1, month: "2026-10", groups: [{ id: "g", residents: ["r1"] }], slots: [] }),
      ]);
      expect(failure?.constraint).toBe(NO_PHI);
    });
  });

  it("refuses it for the server and for the database owner too: it is a constraint, not a policy", async () => {
    for (const who of [service, owner]) {
      await as(db, who, async (s) => {
        expect((await s.fails(insert, [F.a, JSON.stringify({ residents: [] })]))?.constraint).toBe(NO_PHI);
      });
    }
  });

  it("is refused through an upsert as well", async () => {
    await as(db, user(U.bob), async (s) => {
      const failure = await s.fails(
        `${insert} on conflict (facility_id, month_year) do update set generated_data = excluded.generated_data`,
        [F.a, JSON.stringify({ patient: "x" })],
      );
      expect(failure?.constraint).toBe(NO_PHI);
    });
  });
});

describe("ordinary calendar keys are accepted", () => {
  const accepted = [
    // the shape of a real calendar
    "schema_version", "month", "groups", "slots", "id", "name", "wing", "acuity", "size", "date", "time", "group_id",
    "content_item_id", "locked", "note", "generator", "version", "seed", "pillar", "activity", "minutes",
    // words that merely contain a listed word do not match: only whole words do
    "residential", "residentialCare", "presidential", "bedtime", "bedtime_routine", "roommate", "addressable", "emailer",
    "phonetic", "dobby", "ssnake", "mrnx", "allergen", "medic", "birthright", "diagnostic",
  ];

  it.each(accepted)("accepts %j", async (key) => {
    await as(db, service, async (s) => {
      expect((await s.run(insert, [F.a, JSON.stringify({ schema_version: 1, [key]: "x" })])).affected).toBe(1);
    });
  });

  it("accepts a whole realistic calendar", async () => {
    const calendar = {
      schema_version: 1,
      month: "2026-11",
      groups: [
        { id: "g-sensory", name: "Sensory Room", wing: "Memory Care West", acuity: 3, size: 6 },
        { id: "g-garden", name: "Garden Room", wing: "Memory Care West", acuity: 2, size: 8 },
      ],
      slots: [
        { id: "s1", date: "2026-11-03", time: "10:00", group_id: "g-sensory", content_item_id: "c0de0000-0000-4000-8000-000000000002", locked: false, note: "" },
      ],
      generator: { name: "scheduler", version: "1.0.0", seed: "abc" },
    };
    await as(db, user(U.alice), async (s) => {
      expect((await s.run(insert, [F.a, JSON.stringify(calendar)])).affected).toBe(1);
    });
  });

  it("does not read VALUES: a name typed into a note passes, which is why the guard is only one of several layers", async () => {
    await as(db, user(U.alice), async (s) => {
      const doc = { schema_version: 1, slots: [{ id: "s1", note: "Margaret in room 12 has a new medication" }] };
      expect((await s.run(insert, [F.a, JSON.stringify(doc)])).affected).toBe(1);
    });
  });
});

describe("private.jsonb_phi_keys()", () => {
  it("returns nothing for a clean document", async () => {
    expect(await keysIn({ schema_version: 1, slots: [{ id: "a" }] })).toEqual([]);
  });

  it("returns each offending key once, in order, at any depth", async () => {
    expect(await keysIn({ b_dob: 1, dob: 2, x: { dob: 3, ssn: [{ ssn: 4 }] }, ok: 5 })).toEqual(["b_dob", "dob", "ssn"]);
  });

  it("copes with scalars, arrays, empty containers and null", async () => {
    expect(await keysIn([])).toEqual([]);
    expect(await keysIn({})).toEqual([]);
    expect(await keysIn([1, "two", null, { residents: 1 }])).toEqual(["residents"]);
    expect(await keysIn("text")).toEqual([]);
    expect(await keysIn(null)).toEqual([]);
  });

  it("returns null for SQL null, so a missing document is not an error", async () => {
    await as(db, owner, async (s) => {
      expect(await s.value("select private.jsonb_phi_keys(null)")).toBeNull();
    });
  });

  it("does not expand beyond 16 levels, so a pathological document cannot make it expensive", async () => {
    const nest = (levels: number, key: string) => `${'{"a":'.repeat(levels)}{"${key}":1}${"}".repeat(levels)}`;
    await as(db, owner, async (s) => {
      // 14 levels down: found. 40 levels down: not looked for (the table's depth limit refuses it instead).
      expect(await s.value("select private.jsonb_phi_keys($1::jsonb)", [nest(14, "dob")])).toEqual(["dob"]);
      expect(await s.value("select private.jsonb_phi_keys($1::jsonb)", [nest(40, "dob")])).toEqual([]);
    });
  });
});

describe("the guard does not interfere with a normal day", () => {
  it("a calendar can be created, replaced and read back", async () => {
    await as(db, user(U.bob), async (s) => {
      await s.run(insert, [F.a, EMPTY_CALENDAR]);
      await s.run("update public.activity_calendars set generated_data = $2::jsonb where facility_id = $1 and month_year = '2026-11'", [
        F.a,
        JSON.stringify({ schema_version: 1, month: "2026-11", groups: [], slots: [], note: "second version" }),
      ]);
      expect(await s.value("select generated_data ->> 'note' from public.activity_calendars where month_year = '2026-11'")).toBe("second version");
    });
  });
});
