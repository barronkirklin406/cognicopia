import { describe, expect, it } from "vitest";
import { PhiKeyError, assertNoPhiKeys, findPhiKeys, isPhiKey } from "@/lib/domain/phi-guard";

describe("isPhiKey", () => {
  it.each(["residents", "resident_name", "residentName", "patient", "first_name", "dob", "dateOfBirth", "ssn", "diagnosis", "medications", "roomNumber", "email", "phoneNumber", "nextOfKin"])(
    "refuses %s",
    (key) => expect(isPhiKey(key)).toBe(true),
  );

  it.each(["name", "note", "group_id", "content_item_id", "wing", "size", "residential", "bedtime", "roommate", "date", "time", "birth"])(
    "accepts %s",
    (key) => expect(isPhiKey(key)).toBe(false),
  );

  it("judges whole words, so a word that merely contains one is fine", () => {
    expect(isPhiKey("presidential")).toBe(false);
    expect(isPhiKey("addressable")).toBe(false);
    expect(isPhiKey("residential_care")).toBe(false);
  });
});

describe("findPhiKeys", () => {
  it("finds nothing in a clean document, in scalars or in null", () => {
    expect(findPhiKeys({ schema_version: 1, slots: [{ id: "a", note: "" }] })).toEqual([]);
    expect(findPhiKeys(null)).toEqual([]);
    expect(findPhiKeys("residents")).toEqual([]);
    expect(findPhiKeys(42)).toEqual([]);
    expect(findPhiKeys([])).toEqual([]);
  });

  it("finds keys at any depth, inside objects and arrays, once each and in order", () => {
    const doc = { ok: 1, dob: 1, nested: [{ deeper: { ssn: 1, list: [[{ dob: 2 }]] } }], residents: [] };
    expect(findPhiKeys(doc)).toEqual(["dob", "residents", "ssn"]);
  });

  it("does not read values", () => {
    expect(findPhiKeys({ note: "Margaret, room 12, takes medication" })).toEqual([]);
  });

  it("looks 16 levels down and no further", () => {
    const nest = (levels: number): unknown => {
      let node: unknown = { dob: 1 };
      for (let i = 0; i < levels; i++) node = { a: node };
      return node;
    };
    expect(findPhiKeys(nest(15))).toEqual(["dob"]);
    expect(findPhiKeys(nest(16))).toEqual([]);
  });
});

describe("assertNoPhiKeys", () => {
  it("passes a clean document", () => {
    expect(() => assertNoPhiKeys({ groups: [], slots: [] })).not.toThrow();
  });

  it("throws a PhiKeyError that names the keys and says what to do", () => {
    try {
      assertNoPhiKeys({ residents: [], x: { dob: 1 } });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PhiKeyError);
      const e = error as PhiKeyError;
      expect(e.keys).toEqual(["dob", "residents"]);
      expect(e.message).toMatch(/resident or health information/);
      expect(e.message).toMatch(/dob, residents/);
    }
  });
});
