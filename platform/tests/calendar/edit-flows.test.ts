import { describe, expect, it } from "vitest";
import { editCalendarSlotFlow } from "@/lib/calendar/edit-flows";
import type { Db } from "@/lib/data/db";
import type { CalendarData } from "@/lib/domain/calendar";
import { generateCalendar, toGeneratorItem, type Plan } from "@/lib/domain/calendar-generator";
import { suitsStage, trackOf } from "@/lib/domain/stages";
import type { ContentItem } from "@/lib/db/models";
import { seedLibrary } from "../helpers/library";

/**
 * What a hand edit does on the server, against a stand-in for the signed-in user's database client that
 * remembers one saved month and refuses a save made from an out-of-date copy, as the real update does.
 */

const FACILITY = "f0000000-0000-4000-8000-000000000001";
const library = seedLibrary();
const plan: Plan = { month: "2026-11", theme: "none", stages: ["early", "middle", "late"], perDay: 3, seed: "abc123" };
const generated = generateCalendar(plan, library.map(toGeneratorItem));
if (!generated.ok) throw new Error(generated.message);
const month: CalendarData = generated.data;
const UPDATED = "2026-11-01T10:00:00.000Z";

type Fail = { code?: string; message?: string } | null;

function fakeDb(options: { data?: CalendarData | null; items?: ContentItem[]; updatedAt?: string; updateError?: Fail; readError?: Fail } = {}) {
  const stored = { data: options.data === undefined ? month : options.data, updatedAt: options.updatedAt ?? UPDATED };
  const updates: unknown[] = [];
  const items = options.items ?? library;
  const db = {
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      let patch: { generated_data?: CalendarData } | null = null;
      let ids: string[] = [];
      const row = () => ({ id: "c1", facility_id: FACILITY, month_year: "2026-11", created_at: "2026-10-01T00:00:00Z", updated_at: stored.updatedAt, generated_data: stored.data });
      const chain: Record<string, unknown> = {
        select: () => chain,
        update: (value: { generated_data: CalendarData }) => {
          patch = value;
          updates.push(value);
          return chain;
        },
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return chain;
        },
        in: (_column: string, values: string[]) => {
          ids = values;
          return chain;
        },
        maybeSingle: () => {
          if (table !== "activity_calendars") return Promise.resolve({ data: null, error: null });
          if (patch) {
            if (options.updateError) return Promise.resolve({ data: null, error: options.updateError });
            // Only a save from the copy that is still current goes through, and it moves updated_at on.
            if (filters.updated_at !== stored.updatedAt) return Promise.resolve({ data: null, error: null });
            stored.data = patch.generated_data ?? stored.data;
            stored.updatedAt = "2026-11-01T10:05:00.000Z";
            return Promise.resolve({ data: row(), error: null });
          }
          if (options.readError) return Promise.resolve({ data: null, error: options.readError });
          return Promise.resolve({ data: stored.data ? row() : null, error: null });
        },
        then: (resolve: (v: unknown) => void) => {
          if (table === "content_items") return resolve({ data: items.filter((item) => ids.includes(item.id)), error: null });
          return resolve({ data: null, error: null });
        },
      };
      return chain;
    },
  } as unknown as Db;
  return { db, stored, updates };
}

/** A session, and an activity that would be a different choice for its group's stage and one that would not suit it. */
function pickSlot() {
  for (const slot of month.slots) {
    const group = month.groups.find((g) => g.id === slot.group_id)!;
    const stage = trackOf(group);
    if (!stage) continue;
    const suitable = library.find((i) => i.id !== slot.content_item_id && suitsStage(i.dementia_stage, stage));
    const unsuitable = library.find((i) => !suitsStage(i.dementia_stage, stage));
    if (suitable && unsuitable) return { slot, suitable, unsuitable };
  }
  throw new Error("the seed library has no pair to swap");
}
const { slot, suitable, unsuitable } = pickSlot();
const base = { month: "2026-11", expected: UPDATED, slot_id: slot.id };

describe("editCalendarSlotFlow", () => {
  it("swaps the activity, pins the session, saves once, and moves the version on", async () => {
    const { db, stored, updates } = fakeDb();
    const result = await editCalendarSlotFlow(db, FACILITY, { ...base, action: "swap", content_item_id: suitable.id });
    expect(result).toMatchObject({ state: { message: expect.stringContaining("changed") } });
    expect(updates).toHaveLength(1);
    const saved = stored.data!.slots.find((s) => s.id === slot.id)!;
    expect(saved).toMatchObject({ content_item_id: suitable.id, locked: true });
    expect(stored.updatedAt).not.toBe(UPDATED);
    expect(stored.data!.slots.filter((s) => s.id !== slot.id)).toEqual(month.slots.filter((s) => s.id !== slot.id));
  });

  it("refuses an activity that is not in the library, and saves nothing", async () => {
    const { db, updates } = fakeDb();
    const result = await editCalendarSlotFlow(db, FACILITY, { ...base, action: "swap", content_item_id: "11111111-1111-4111-8111-111111111111" });
    expect(result).toEqual({ state: { error: "That activity is not in the library." } });
    expect(updates).toEqual([]);
  });

  it("refuses an activity made for another stage, and saves nothing", async () => {
    const { db, updates } = fakeDb();
    const result = await editCalendarSlotFlow(db, FACILITY, { ...base, action: "swap", content_item_id: unsuitable.id });
    expect(result).toMatchObject({ state: { error: expect.stringContaining("not made for this stage") } });
    expect(updates).toEqual([]);
  });

  it("refuses a save from an out-of-date copy with words, not codes, and leaves the other person's version alone", async () => {
    const { db, stored, updates } = fakeDb({ updatedAt: "2026-11-01T09:59:00.000Z" });
    const before = stored.data;
    const result = await editCalendarSlotFlow(db, FACILITY, { ...base, action: "pin" });
    expect(result).toMatchObject({ state: { error: expect.stringContaining("Someone else changed this month") } });
    expect(JSON.stringify(result)).not.toMatch(/409|calendar_changed/);
    expect(updates).toHaveLength(1);
    expect(stored.data).toBe(before);
  });

  it("does not save when the edit changes nothing", async () => {
    const { db, updates } = fakeDb();
    const result = await editCalendarSlotFlow(db, FACILITY, { ...base, action: "unpin" });
    expect(result).toMatchObject({ state: { message: expect.stringContaining("not pinned") } });
    expect(updates).toEqual([]);
  });

  it("saves a note tidied of extra spaces, and keeps a note staff wrote when the activity is swapped", async () => {
    const first = fakeDb();
    await editCalendarSlotFlow(first.db, FACILITY, { ...base, action: "note", note: "  Bring   the   photo album  " });
    expect(first.stored.data!.slots.find((s) => s.id === slot.id)!.note).toBe("Bring the photo album");

    const second = fakeDb({ data: first.stored.data, updatedAt: first.stored.updatedAt });
    await editCalendarSlotFlow(second.db, FACILITY, { ...base, expected: first.stored.updatedAt, action: "swap", content_item_id: suitable.id });
    expect(second.stored.data!.slots.find((s) => s.id === slot.id)!.note).toBe("Bring the photo album");
  });

  it("pins, unpins and removes", async () => {
    const pin = fakeDb();
    await editCalendarSlotFlow(pin.db, FACILITY, { ...base, action: "pin" });
    expect(pin.stored.data!.slots.find((s) => s.id === slot.id)!.locked).toBe(true);

    const remove = fakeDb();
    await editCalendarSlotFlow(remove.db, FACILITY, { ...base, action: "remove" });
    expect(remove.stored.data!.slots).toHaveLength(month.slots.length - 1);
    expect(remove.stored.data!.slots.some((s) => s.id === slot.id)).toBe(false);
  });

  it("says so when the session is already gone, or the month has no calendar", async () => {
    const gone = await editCalendarSlotFlow(fakeDb().db, FACILITY, { ...base, slot_id: "no-such-session", action: "pin" });
    expect(gone).toMatchObject({ state: { error: expect.stringContaining("no longer in this month") } });
    const none = await editCalendarSlotFlow(fakeDb({ data: null }).db, FACILITY, { ...base, action: "pin" });
    expect(none).toEqual({ state: { error: "There is no calendar for that month yet." } });
  });

  it.each([
    ["a month that is not a month", { month: "2026-13" }],
    ["no version", { expected: undefined }],
    ["a version that is far too long", { expected: "x".repeat(200) }],
    ["an action that does not exist", { action: "delete-everything" }],
    ["a swap with no activity", { action: "swap", content_item_id: undefined }],
    ["a swap to something that is not an id", { action: "swap", content_item_id: "../../etc/passwd" }],
    ["a note over 140 characters", { action: "note", note: "x".repeat(141) }],
  ])("refuses %s and touches nothing", async (_name, change) => {
    const { db, updates } = fakeDb();
    const result = await editCalendarSlotFlow(db, FACILITY, { ...base, action: "pin", ...change });
    expect(result).toMatchObject({ state: { error: expect.any(String) } });
    expect(updates).toEqual([]);
  });

  it("does not let an edit carry anything beyond the fields a session has", async () => {
    const { db, updates } = fakeDb();
    const result = await editCalendarSlotFlow(db, FACILITY, { ...base, action: "pin", resident_name: "Not allowed" } as never);
    // Extra input keys never reach the schema: only the named fields are read.
    expect(result).toMatchObject({ state: { message: expect.any(String) } });
    expect(JSON.stringify(updates)).not.toContain("resident_name");
  });

  it("reports a refused read or save without showing anything technical", async () => {
    const read = await editCalendarSlotFlow(fakeDb({ readError: { code: "42501", message: "permission denied for table activity_calendars" } }).db, FACILITY, { ...base, action: "pin" });
    expect(read).toMatchObject({ state: { error: expect.any(String) } });
    expect(JSON.stringify(read)).not.toMatch(/42501|permission denied|activity_calendars/);

    const save = await editCalendarSlotFlow(fakeDb({ updateError: { code: "42501", message: 'new row violates row-level security policy for table "activity_calendars"' } }).db, FACILITY, { ...base, action: "pin" });
    expect(save).toMatchObject({ state: { error: expect.any(String) } });
    expect(JSON.stringify(save)).not.toMatch(/row-level|activity_calendars|42501/);
  });

  it("does not show an unexpected failure", async () => {
    const db = {
      from: () => {
        throw new Error("secret connection string postgres://user:pw@host");
      },
    } as unknown as Db;
    const result = await editCalendarSlotFlow(db, FACILITY, { ...base, action: "pin" });
    expect(result).toEqual({ state: { error: "Something went wrong. Please try again." } });
  });
});
