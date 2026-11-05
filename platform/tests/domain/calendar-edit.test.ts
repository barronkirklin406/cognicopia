import { describe, expect, it } from "vitest";
import { CalendarDataSchema, parseCalendarData, type CalendarData } from "@/lib/domain/calendar";
import { applyEdit, SlotEditSchema } from "@/lib/domain/calendar-edit";
import { generateCalendar, toGeneratorItem, type Plan } from "@/lib/domain/calendar-generator";
import { seedLibrary } from "../helpers/library";

const library = seedLibrary().map(toGeneratorItem);
const plan: Plan = { month: "2026-11", theme: "none", stages: ["early", "middle", "late"], perDay: 3, seed: "abc123" };
const made = () => {
  const r = generateCalendar(plan, library);
  if (!r.ok) throw new Error(r.message);
  return r;
};
const month = made().data;
const first = month.slots[0]!;
const other = library.find((i) => i.id !== first.content_item_id)!;

describe("hand edits", () => {
  it("swaps the activity, pins the session, and leaves everything else exactly as it was", () => {
    const r = applyEdit(month, { action: "swap", slot_id: first.id, content_item_id: other.id }, { swapNote: "A new tip." });
    expect(r.ok && r.changed).toBe(true);
    if (!r.ok) return;
    const slot = r.data.slots.find((s) => s.id === first.id)!;
    expect(slot).toMatchObject({ content_item_id: other.id, locked: true, note: "A new tip.", date: first.date, time: first.time, group_id: first.group_id });
    expect(r.data.slots.filter((s) => s.id !== first.id)).toEqual(month.slots.filter((s) => s.id !== first.id));
    expect(r.data.groups).toEqual(month.groups);
    expect(CalendarDataSchema.safeParse(r.data).success).toBe(true);
    expect(month.slots[0]).toEqual(first); // the original calendar is not changed
  });

  it("keeps the note staff wrote when no new tip is given, and says nothing changed for the same activity", () => {
    const r = applyEdit(month, { action: "swap", slot_id: first.id, content_item_id: other.id });
    expect(r.ok && r.data.slots.find((s) => s.id === first.id)!.note).toBe(first.note);
    const same = applyEdit(month, { action: "swap", slot_id: first.id, content_item_id: first.content_item_id });
    expect(same).toMatchObject({ ok: true, changed: false });
  });

  it("pins and unpins, and says so when there is nothing to do", () => {
    const pinned = applyEdit(month, { action: "pin", slot_id: first.id });
    expect(pinned).toMatchObject({ ok: true, changed: true });
    if (!pinned.ok) return;
    expect(pinned.data.slots.find((s) => s.id === first.id)!.locked).toBe(true);
    expect(applyEdit(pinned.data, { action: "pin", slot_id: first.id })).toMatchObject({ ok: true, changed: false });
    const back = applyEdit(pinned.data, { action: "unpin", slot_id: first.id });
    expect(back).toMatchObject({ ok: true, changed: true });
    expect(applyEdit(month, { action: "unpin", slot_id: first.id })).toMatchObject({ ok: true, changed: false });
  });

  it("changes a note, tidying the spaces, and refuses one over 140 characters", () => {
    const r = applyEdit(month, { action: "note", slot_id: first.id, note: "  Use   the big\nprint cards.  " });
    expect(r.ok && r.data.slots.find((s) => s.id === first.id)!.note).toBe("Use the big print cards.");
    expect(SlotEditSchema.safeParse({ action: "note", slot_id: first.id, note: "x".repeat(141) }).success).toBe(false);
    expect(SlotEditSchema.safeParse({ action: "note", slot_id: first.id, note: "x".repeat(140) }).success).toBe(true);
  });

  it("takes a session out, and a session that is not there is a plain refusal", () => {
    const r = applyEdit(month, { action: "remove", slot_id: first.id });
    expect(r.ok && r.data.slots.length).toBe(month.slots.length - 1);
    expect(r.ok && r.data.slots.some((s) => s.id === first.id)).toBe(false);
    expect(applyEdit(month, { action: "pin", slot_id: "nope-01-01-9" })).toMatchObject({ ok: false, code: "not_found" });
  });

  it("accepts only what a session has: an extra field, an unknown action or a resident-looking field is refused", () => {
    expect(SlotEditSchema.safeParse({ action: "pin", slot_id: first.id, resident: "Margaret" }).success).toBe(false);
    expect(SlotEditSchema.safeParse({ action: "rename", slot_id: first.id }).success).toBe(false);
    expect(SlotEditSchema.safeParse({ action: "swap", slot_id: first.id, content_item_id: "not-a-uuid" }).success).toBe(false);
    expect(SlotEditSchema.safeParse({ action: "pin", slot_id: "has space" }).success).toBe(false);
  });

  it("an edited month still passes the same check the database door uses", () => {
    const r = applyEdit(month, { action: "swap", slot_id: first.id, content_item_id: other.id });
    expect(r.ok && parseCalendarData("2026-11", r.data).ok).toBe(true);
  });
});

describe("planning a month again keeps what was pinned", () => {
  const pinnedMonth = (() => {
    const slots = month.slots.map((s) => (s.id === first.id ? { ...s, content_item_id: other.id, locked: true, note: "Staff chose this." } : s));
    return { ...month, slots } satisfies CalendarData;
  })();
  const pinned = pinnedMonth.slots.filter((s) => s.locked);

  it("puts a pinned session back exactly as it was, in its own seat, even with a different seed", () => {
    const r = generateCalendar({ ...plan, seed: "zzz999" }, library, { pinned });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.slots.find((s) => s.id === first.id)).toEqual(pinnedMonth.slots.find((s) => s.id === first.id));
    expect(r.stats).toMatchObject({ pinnedKept: 1, pinnedDropped: 0 });
    expect(r.data.slots).toHaveLength(month.slots.length);
    expect(CalendarDataSchema.safeParse(r.data).success).toBe(true);
  });

  it("is still deterministic, and unpinned sessions change with the seed", () => {
    const a = generateCalendar({ ...plan, seed: "zzz999" }, library, { pinned });
    const b = generateCalendar({ ...plan, seed: "zzz999" }, library, { pinned });
    expect(a).toEqual(b);
    if (!a.ok) return;
    expect(a.data.slots.filter((s) => !s.locked).map((s) => s.content_item_id)).not.toEqual(month.slots.filter((s) => s.id !== first.id).map((s) => s.content_item_id));
  });

  it("plans the days around a pinned session as if it had been chosen: the same activity does not sit right next to it", () => {
    const r = generateCalendar({ ...plan, seed: "q1" }, library, { pinned });
    if (!r.ok) throw new Error(r.message);
    const day = Number(first.date.slice(8));
    const nextDate = `2026-11-${String(day + 1).padStart(2, "0")}`;
    const sameSeatNext = r.data.slots.find((s) => s.group_id === first.group_id && s.date === nextDate && s.time === first.time);
    expect(sameSeatNext?.content_item_id).not.toBe(other.id);
  });

  it("ignores a slot that is not pinned, and with nothing pinned gives the very same month as before", () => {
    const loose = generateCalendar(plan, library, { pinned: month.slots });
    expect(loose).toEqual(generateCalendar(plan, library));
    expect(generateCalendar(plan, library, {})).toEqual(generateCalendar(plan, library, { pinned: [] }));
  });

  it("drops a pinned session whose stage is not planned this time, and counts it", () => {
    const r = generateCalendar({ ...plan, stages: ["middle"] }, library, { pinned });
    if (!r.ok) throw new Error(r.message);
    const stageOfFirst = first.group_id;
    expect(r.data.slots.some((s) => s.group_id === stageOfFirst)).toBe(stageOfFirst === "middle");
    expect(r.stats.pinnedKept + r.stats.pinnedDropped).toBe(1);
    expect(r.stats.pinnedDropped).toBe(stageOfFirst === "middle" ? 0 : 1);
  });

  it("keeps a pinned session at a time this plan does not use (two a day over a month that had three)", () => {
    const evening = month.slots.find((s) => s.time === "16:00")!;
    const lock = { ...evening, locked: true };
    const r = generateCalendar({ ...plan, perDay: 2 }, library, { pinned: [lock] });
    if (!r.ok) throw new Error(r.message);
    expect(r.data.slots.find((s) => s.id === evening.id)).toEqual(lock);
    expect(r.stats.pinnedKept).toBe(1);
    expect(CalendarDataSchema.safeParse(r.data).success).toBe(true);
  });

  it("drops a pinned session from another month", () => {
    const stray = { ...first, id: "early-12-01-1", date: "2026-12-01", locked: true };
    const r = generateCalendar(plan, library, { pinned: [stray] });
    if (!r.ok) throw new Error(r.message);
    expect(r.data.slots.some((s) => s.id === stray.id)).toBe(false);
    expect(r.stats.pinnedDropped).toBe(1);
  });
});
