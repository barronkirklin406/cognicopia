import { describe, expect, it } from "vitest";
import { MAX_SLOTS, emptyCalendar, parseCalendarData } from "@/lib/domain/calendar";

const CONTENT = "5eed0000-0000-4000-8000-000000000001";

const valid = () => ({
  schema_version: 1,
  month: "2026-10",
  groups: [
    { id: "g-sensory", name: "Sensory Room", wing: "Memory Care West", acuity: 3, size: 6 },
    { id: "g-garden", name: "Garden Room", acuity: 2, size: 8 },
  ],
  slots: [
    { id: "s1", date: "2026-10-05", time: "10:00", group_id: "g-sensory", content_item_id: CONTENT, locked: false, note: "" },
    { id: "s2", date: "2026-10-05", time: "14:30", group_id: "g-sensory", content_item_id: CONTENT, locked: true, note: "Bring the large print" },
    { id: "s3", date: "2026-10-31", time: "10:00", group_id: "g-garden", content_item_id: CONTENT, locked: false, note: "" },
  ],
  generator: { name: "scheduler", version: "1.0.0", seed: "abc" },
});

const refused = (month: string, input: unknown) => {
  const result = parseCalendarData(month, input);
  expect(result.ok).toBe(false);
  return result as Extract<typeof result, { ok: false }>;
};

describe("parseCalendarData", () => {
  it("accepts a whole calendar", () => {
    const result = parseCalendarData("2026-10", valid());
    expect(result.ok).toBe(true);
  });

  it("accepts a calendar with nothing planned", () => {
    expect(parseCalendarData("2026-10", emptyCalendar("2026-10")).ok).toBe(true);
  });

  it("returns the data cleaned: names trimmed", () => {
    const input = valid();
    input.groups[0]!.name = "  Sensory Room  ";
    const result = parseCalendarData("2026-10", input);
    expect(result.ok && result.data.groups[0]?.name).toBe("Sensory Room");
  });

  describe("zero PHI", () => {
    it("refuses a resident-looking key as its own kind of refusal, before anything else is checked", () => {
      const input = { ...valid(), groups: [{ id: "g", name: "Room", acuity: 2, size: 4, residents: ["r1", "r2"] }] };
      const result = refused("2026-10", input);
      expect(result.code).toBe("phi_keys");
      expect(result.issues).toEqual([{ path: "residents", message: "Looks like resident or health information." }]);
      expect(result.message).toMatch(/resident or health information/);
    });

    it("refuses one buried inside a session", () => {
      const input = valid();
      (input.slots[0] as Record<string, unknown>).residentName = "x";
      expect(refused("2026-10", input).code).toBe("phi_keys");
    });

    it("refuses an unknown field that is not resident-looking, because the schema is strict", () => {
      const input = { ...valid(), extra: 1 };
      const result = refused("2026-10", input);
      expect(result.code).toBe("invalid");
      expect(result.issues.some((i) => /extra/.test(i.message) || i.path === "")).toBe(true);
    });

    it("has no field for a person anywhere in its schema", () => {
      const sample = JSON.stringify(valid());
      expect(sample).not.toMatch(/resident|patient|birth|diagnos|medic|ssn|room_number/i);
    });
  });

  describe("shape", () => {
    it.each([
      ["a missing version", (c: Record<string, unknown>) => delete c.schema_version],
      ["a wrong version", (c: Record<string, unknown>) => (c.schema_version = 2)],
      ["no groups array", (c: Record<string, unknown>) => delete c.groups],
      ["slots that are not a list", (c: Record<string, unknown>) => (c.slots = {})],
    ])("refuses %s", (_label, mutate) => {
      const input = valid() as Record<string, unknown>;
      mutate(input);
      expect(refused("2026-10", input).code).toBe("invalid");
    });

    it("accepts a group with no size: a calendar made from a stage and a theme does not know how many people", () => {
      const input = valid();
      const groups = input.groups.map(({ size: _size, ...rest }) => rest);
      expect(parseCalendarData("2026-10", { ...input, groups }).ok).toBe(true);
    });

    it.each([
      ["a group without a name", (c: ReturnType<typeof valid>) => (c.groups[0]!.name = "  ")],
      ["a group name over 60 characters", (c: ReturnType<typeof valid>) => (c.groups[0]!.name = "x".repeat(61))],
      ["an acuity of 5", (c: ReturnType<typeof valid>) => ((c.groups[0] as Record<string, unknown>).acuity = 5)],
      ["an acuity of 0", (c: ReturnType<typeof valid>) => ((c.groups[0] as Record<string, unknown>).acuity = 0)],
      ["a size of 0", (c: ReturnType<typeof valid>) => (c.groups[0]!.size = 0)],
      ["a size of 61", (c: ReturnType<typeof valid>) => (c.groups[0]!.size = 61)],
      ["a fractional size", (c: ReturnType<typeof valid>) => (c.groups[0]!.size = 4.5)],
      ["a group id with spaces", (c: ReturnType<typeof valid>) => (c.groups[0]!.id = "has space")],
      ["a time of 24:00", (c: ReturnType<typeof valid>) => (c.slots[0]!.time = "24:00")],
      ["a time without a colon", (c: ReturnType<typeof valid>) => (c.slots[0]!.time = "1000")],
      ["a date that does not exist", (c: ReturnType<typeof valid>) => (c.slots[0]!.date = "2026-10-32")],
      ["a note over 140 characters", (c: ReturnType<typeof valid>) => (c.slots[0]!.note = "n".repeat(141))],
      ["a content id that is not a uuid", (c: ReturnType<typeof valid>) => (c.slots[0]!.content_item_id = "chair-yoga")],
      ["a lock that is not a boolean", (c: ReturnType<typeof valid>) => ((c.slots[0] as Record<string, unknown>).locked = "yes")],
    ])("refuses %s", (_label, mutate) => {
      const input = valid();
      mutate(input);
      expect(refused("2026-10", input).code).toBe("invalid");
    });

    it("refuses February 30 and accepts February 29 in a leap year", () => {
      const feb = (date: string, month: string) => ({
        ...emptyCalendar(month),
        groups: [{ id: "g", name: "Room", acuity: 2 as const, size: 4 }],
        slots: [{ id: "s", date, time: "10:00", group_id: "g", content_item_id: CONTENT, locked: false, note: "" }],
      });
      expect(parseCalendarData("2026-02", feb("2026-02-30", "2026-02")).ok).toBe(false);
      expect(parseCalendarData("2028-02", feb("2028-02-29", "2028-02")).ok).toBe(true);
      expect(parseCalendarData("2026-02", feb("2026-02-29", "2026-02")).ok).toBe(false);
    });

    it("refuses more sessions than a month can hold", () => {
      const input = valid();
      input.slots = Array.from({ length: MAX_SLOTS + 1 }, (_, i) => ({
        id: `s${i}`, date: "2026-10-05", time: "10:00", group_id: "g-sensory", content_item_id: CONTENT, locked: false, note: "",
      }));
      expect(refused("2026-10", input).code).toBe("invalid");
    });
  });

  describe("consistency", () => {
    it("refuses a calendar for a different month than the one asked for", () => {
      const result = refused("2026-11", valid());
      expect(result.message).toMatch(/2026-10/);
    });

    it("refuses a session outside the calendar's month", () => {
      const input = valid();
      input.slots[0]!.date = "2026-11-01";
      const result = refused("2026-10", input);
      expect(result.issues).toContainEqual({ path: "slots.0.date", message: "This date is not in 2026-10." });
    });

    it("refuses a session for a group that is not in the calendar", () => {
      const input = valid();
      input.slots[0]!.group_id = "g-nowhere";
      expect(refused("2026-10", input).issues).toContainEqual({ path: "slots.0.group_id", message: "No group has this id." });
    });

    it("refuses two groups with one id, and two sessions with one id", () => {
      const groups = valid();
      groups.groups[1]!.id = "g-sensory";
      expect(refused("2026-10", groups).issues.map((i) => i.path)).toContain("groups.1.id");

      const slots = valid();
      slots.slots[1]!.id = "s1";
      expect(refused("2026-10", slots).issues.map((i) => i.path)).toContain("slots.1.id");
    });

    it("refuses a group with two sessions at one time", () => {
      const input = valid();
      input.slots[1]!.time = "10:00";
      expect(refused("2026-10", input).issues.map((i) => i.path)).toContain("slots.1.time");
    });

    it.each(["2026-13", "2026-1", "", "October"])("refuses the month %j", (month) => {
      expect(refused(month, valid()).issues[0]?.path).toBe("month");
    });

    it("refuses something that is not an object at all", () => {
      for (const input of [null, "text", 7, [], undefined]) expect(parseCalendarData("2026-10", input).ok).toBe(false);
    });
  });
});
