import { describe, expect, it } from "vitest";
import { DataError, fromDbError } from "@/lib/data/errors";

describe("fromDbError", () => {
  it.each([
    ["28000", 401, "unauthenticated"],
    ["PGRST301", 401, "unauthenticated"],
    ["42501", 403, "forbidden"],
    ["CG001", 409, "last_admin"],
    ["CG002", 409, "already_member"],
    ["CG003", 403, "email_not_confirmed"],
    ["23505", 409, "conflict"],
    ["23503", 409, "conflict"],
    ["PGRST116", 404, "not_found"],
    ["22P02", 422, "invalid"],
    ["22023", 422, "invalid"],
    ["22007", 422, "invalid"],
    ["23514", 422, "invalid"],
  ])("%s becomes %i %s", (code, status, name) => {
    const error = fromDbError({ code, message: "x" });
    expect(error).toBeInstanceOf(DataError);
    expect([error.status, error.code]).toEqual([status, name]);
  });

  it("recognises the resident-key guard, the size limit and the depth limit by constraint name", () => {
    const check = (constraint: string) =>
      fromDbError({ code: "23514", message: `new row for relation "activity_calendars" violates check constraint "${constraint}"` });
    expect([check("activity_calendars_generated_data_no_phi_keys").status, check("activity_calendars_generated_data_no_phi_keys").code]).toEqual([422, "phi_keys"]);
    expect([check("activity_calendars_generated_data_size").status, check("activity_calendars_generated_data_size").code]).toEqual([413, "too_large"]);
    expect([check("activity_calendars_generated_data_shallow").status, check("activity_calendars_generated_data_shallow").code]).toEqual([422, "too_deep"]);
    expect(check("facilities_facility_name_length").code).toBe("invalid");
  });

  it("turns anything unrecognised into a plain 500", () => {
    for (const code of ["XX000", "58P01", "", undefined, null]) {
      const error = fromDbError({ code, message: "boom" });
      expect([error.status, error.code]).toEqual([500, "internal"]);
    }
  });

  it("never passes the database's message or details on, so a row cannot leak", () => {
    const secret = 'Failing row contains (Margaret, room 12, {"note": "new medication"})';
    for (const code of ["23514", "23505", "42501", "XX000", "22P02", "23503"]) {
      const error = fromDbError({ code, message: secret, details: secret, hint: secret });
      expect(error.message, code).not.toMatch(/Margaret|room 12|medication|Failing row/);
      expect(JSON.stringify(error.issues ?? []), code).not.toMatch(/Margaret/);
    }
  });

  it("the guard's message tells the user what to do without echoing their data", () => {
    const error = fromDbError({ code: "23514", message: 'violates check constraint "activity_calendars_generated_data_no_phi_keys"', details: 'Failing row contains (..."residentName"...)' });
    expect(error.message).toMatch(/resident or health information/);
    expect(error.message).not.toMatch(/residentName/);
  });
});
