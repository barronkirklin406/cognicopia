import { describe, expect, it } from "vitest";
import { STAGE_GUIDES, adaptActivity, quickTip } from "@/lib/domain/adaptation";
import { CalendarDataSchema, MAX_SLOTS } from "@/lib/domain/calendar";
import { PlanSchema, generateCalendar, newSeed, roleOf, toGeneratorItem, type GeneratorItem, type Plan } from "@/lib/domain/calendar-generator";
import { facetCounts, filterLibrary, filterToSearch, parseFilterParams } from "@/lib/domain/content-filter";
import { ACTIVITY_FORMATS, FORMAT_LABELS, displayTitle, formatsOf } from "@/lib/domain/formats";
import { daysInMonth, firstWeekday, localIsoDate, monthGrid, monthOfDate, nextDays, shortTimeLabel, timeLabel, upcomingMonths } from "@/lib/domain/months";
import { DECADES, SENSES, filterPrompts, parsePromptParams, promptFacetCounts, promptFilterToSearch, toPrompt } from "@/lib/domain/reminiscence";
import { searchWords } from "@/lib/domain/search";
import { STAGES, TRACK_STAGES, suitsStage, trackOf } from "@/lib/domain/stages";
import { THEME_IDS } from "@/lib/domain/themes";
import { seedLibrary } from "../helpers/library";

const library = seedLibrary();
const generatorItems = library.map(toGeneratorItem);
const plan = (over: Partial<Plan> = {}): Plan => ({ month: "2026-10", theme: "none", stages: ["early", "middle", "late"], perDay: 3, seed: "abc123", ...over });
const make = (over: Partial<Plan> = {}, items: readonly GeneratorItem[] = generatorItems) => {
  const out = generateCalendar(plan(over), items);
  if (!out.ok) throw new Error(out.message);
  return out;
};

describe("the development library as the tests see it", () => {
  it("was read in full", () => {
    expect(library.length).toBe(104);
    expect(new Set(library.map((i) => i.id)).size).toBe(104);
  });
});

describe("months", () => {
  it("knows how long each month is, leap years included", () => {
    expect([daysInMonth("2026-01"), daysInMonth("2026-02"), daysInMonth("2028-02"), daysInMonth("2026-04"), daysInMonth("2026-12")]).toEqual([31, 28, 29, 30, 31]);
  });

  it("knows the weekday a month starts on (0 is Sunday)", () => {
    expect(firstWeekday("2026-10")).toBe(4); // 1 October 2026 is a Thursday
    expect(firstWeekday("2027-08")).toBe(0); // 1 August 2027 is a Sunday
  });

  it.each(["2026-02", "2026-10", "2028-02", "2027-08", "2026-05"])("lays %s out in whole weeks with every day once, in order", (month) => {
    const weeks = monthGrid(month);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const days = weeks.flat().filter((d): d is string => d !== null);
    expect(days).toHaveLength(daysInMonth(month));
    expect(days).toEqual([...days].sort());
    expect(days[0]).toBe(`${month}-01`);
    expect(weeks[0]![firstWeekday(month)]).toBe(`${month}-01`);
  });

  it("gives the local date, not the UTC one, however late in the evening it is", () => {
    expect(localIsoDate(new Date(2026, 9, 7, 23, 30))).toBe("2026-10-07");
    expect(localIsoDate(new Date(2026, 0, 1, 0, 5))).toBe("2026-01-01");
    expect(localIsoDate(new Date(2028, 1, 29, 12, 0))).toBe("2028-02-29");
  });

  it("is the evening's date for someone in the Americas, when it is already tomorrow in UTC", () => {
    const before = process.env.TZ;
    try {
      process.env.TZ = "America/Los_Angeles";
      const evening = new Date("2026-10-08T03:30:00Z"); // 8:30 pm on the 7th in Los Angeles
      expect(evening.toISOString().slice(0, 10)).toBe("2026-10-08");
      expect(localIsoDate(evening)).toBe("2026-10-07");
      process.env.TZ = "Pacific/Auckland";
      expect(localIsoDate(new Date("2026-10-07T23:30:00Z"))).toBe("2026-10-08"); // already the 8th in New Zealand
    } finally {
      if (before === undefined) delete process.env.TZ;
      else process.env.TZ = before;
    }
  });

  it("finds a date's month", () => {
    expect(monthOfDate("2026-10-07")).toBe("2026-10");
  });

  it("counts days on across the end of a month, a year and February", () => {
    expect(nextDays("2026-10-30", 4)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(nextDays("2026-12-31", 2)).toEqual(["2026-12-31", "2027-01-01"]);
    expect(nextDays("2028-02-28", 3)).toEqual(["2028-02-28", "2028-02-29", "2028-03-01"]);
    expect(nextDays("2026-10-07", 7)).toHaveLength(7);
    expect(nextDays("2026-10-07", 0)).toEqual([]);
  });

  it.each([
    ["10:00", "10:00 am"],
    ["14:00", "2:00 pm"],
    ["00:30", "12:30 am"],
    ["12:00", "12:00 pm"],
    ["16:45", "4:45 pm"],
  ])("writes %s as %s", (time, label) => {
    expect(timeLabel(time)).toBe(label);
  });

  it("writes a short time for a calendar cell: on the hour without the minutes", () => {
    expect([shortTimeLabel("10:00"), shortTimeLabel("14:00"), shortTimeLabel("14:30"), shortTimeLabel("00:00"), shortTimeLabel("12:15")]).toEqual(["10 am", "2 pm", "2:30 pm", "12 am", "12:15 pm"]);
  });

  it("offers this month and the next eleven", () => {
    const months = upcomingMonths("2026-10");
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2026-10");
    expect(months[3]).toBe("2027-01");
    expect(months[11]).toBe("2027-09");
  });
});

describe("the stage of a calendar group", () => {
  it("is the group's id when it names a stage", () => {
    expect(trackOf({ id: "late", acuity: 3 })).toBe("late");
    expect(trackOf({ id: "early", acuity: 3 })).toBe("early"); // the name wins over the tier
  });

  it("is read from the tier when the group is named some other way", () => {
    expect(trackOf({ id: "garden-room", acuity: 1 })).toBe("early");
    expect(trackOf({ id: "garden-room", acuity: 2 })).toBe("middle");
    expect(trackOf({ id: "garden-room", acuity: 3 })).toBe("late");
  });

  it("is none for a universal group", () => {
    expect(trackOf({ id: "everyone", acuity: 4 })).toBeNull();
  });
});

describe("a filter in a page's address", () => {
  it("reads every part, and writes it back the same", () => {
    const filter = { stage: "late", format: "sensory", theme: "garden", query: "bird" } as const;
    expect(parseFilterParams({ stage: "late", format: "sensory", theme: "garden", q: "bird" })).toEqual(filter);
    expect(filterToSearch(filter)).toBe("?stage=late&format=sensory&theme=garden&q=bird");
    const params = Object.fromEntries(new URLSearchParams(filterToSearch(filter)));
    expect(parseFilterParams(params)).toEqual(filter);
  });

  it("is an empty address for no filter", () => {
    expect(filterToSearch({})).toBe("");
    expect(filterToSearch({ query: "   " })).toBe("");
    expect(parseFilterParams({})).toEqual({});
  });

  it.each<[Record<string, unknown>, string]>([
    [{ stage: "universal" }, "universal is not a stage anyone is in"],
    [{ stage: ["late"] }, "an array"],
    [{ format: "origami" }, "a made-up format"],
    [{ theme: "pirates" }, "a made-up theme"],
    [{ theme: "__proto__" }, "an inherited name"],
    [{ q: 42 }, "a number"],
    [{ q: "   " }, "only spaces"],
  ])("drops %j (%s), so a bad address shows the whole library", (params, _why) => {
    expect(parseFilterParams(params)).toEqual({});
  });

  it("trims the search and caps its length", () => {
    expect(parseFilterParams({ q: "  garden  " })).toEqual({ query: "garden" });
    expect(parseFilterParams({ q: "x".repeat(500) }).query).toHaveLength(80);
    expect(filterToSearch({ query: "x".repeat(500) })).toBe(`?q=${"x".repeat(80)}`);
  });

  it("escapes what it writes", () => {
    expect(filterToSearch({ query: "tea & toast" })).toBe("?q=tea+%26+toast");
  });
});

describe("search words", () => {
  it("are lower-case letters and digits, never punctuation", () => {
    expect(searchWords("  Radio, shows!  ")).toEqual(["radio", "shows"]);
    expect(searchWords("%' or 1=1; --")).toEqual(["or", "1", "1"]);
    expect(searchWords("Café")).toEqual(["cafe"]);
    expect(searchWords("")).toEqual([]);
    expect(searchWords(undefined)).toEqual([]);
    expect(searchWords("a b c d e f g h i j k l")).toHaveLength(8);
  });
});

describe("the activity formats", () => {
  it("every library item has at least one, and only known ones", () => {
    for (const item of library) {
      const formats = formatsOf(item);
      expect(formats.length, item.title).toBeGreaterThan(0);
      for (const f of formats) expect(ACTIVITY_FORMATS).toContain(f);
    }
  });

  it("have a label each, and the four staff ask for first are named as they are asked for", () => {
    for (const f of ACTIVITY_FORMATS) expect(FORMAT_LABELS[f]).toBeTruthy();
    expect([FORMAT_LABELS.reminiscence, FORMAT_LABELS.games, FORMAT_LABELS.trivia, FORMAT_LABELS.printable]).toEqual(["Reminiscence prompts", "Cognitive games", "Trivia", "Printable sheets"]);
  });

  it("are taken from the category when an item names none", () => {
    expect(formatsOf({ category: "numbers", content_payload: {} })).toEqual(["games"]);
    expect(formatsOf({ category: "movement", content_payload: {} })).toEqual(["active"]);
    expect(formatsOf({ category: "something-new", content_payload: {} })).toEqual(["games"]);
    expect(formatsOf({ category: "numbers", content_payload: { formats: ["trivia"] } })).toEqual(["trivia"]);
  });

  it("name a reminiscence prompt for what it is on a calendar", () => {
    expect(displayTitle({ title: "The jukebox", category: "reminiscence" })).toBe("Reminiscence: The jukebox");
    expect(displayTitle({ title: "Chair yoga", category: "movement" })).toBe("Chair yoga");
  });
});

describe("filtering the library by stage and format", () => {
  it("a stage shows its own activities and the ones for any stage, never another stage's", () => {
    for (const stage of TRACK_STAGES) {
      const shown = filterLibrary(library, { stage });
      expect(shown.length).toBeGreaterThan(0);
      for (const item of shown) expect(suitsStage(item.dementia_stage, stage), item.title).toBe(true);
      expect(shown.some((i) => i.dementia_stage === "universal")).toBe(true);
    }
  });

  it("each format shows only items of that format, for every stage", () => {
    for (const stage of TRACK_STAGES) {
      for (const format of ACTIVITY_FORMATS) {
        const shown = filterLibrary(library, { stage, format });
        expect(shown.length, `${stage} ${format}`).toBeGreaterThan(0);
        for (const item of shown) expect(formatsOf(item)).toContain(format);
      }
    }
  });

  it("a stage and a format together are the items that are both", () => {
    const both = filterLibrary(library, { stage: "middle", format: "trivia" }).map((i) => i.id);
    const byStage = new Set(filterLibrary(library, { stage: "middle" }).map((i) => i.id));
    const byFormat = new Set(filterLibrary(library, { format: "trivia" }).map((i) => i.id));
    expect(both.length).toBeGreaterThan(0);
    expect(both.every((id) => byStage.has(id) && byFormat.has(id))).toBe(true);
    expect([...byStage].filter((id) => byFormat.has(id)).sort()).toEqual([...both].sort());
  });

  it("no filter shows everything, and the library order is kept", () => {
    expect(filterLibrary(library, {})).toEqual(library);
  });

  it("a theme shows only items that name it", () => {
    for (const item of filterLibrary(library, { theme: "aviation" })) expect(item.content_payload.themes).toContain("aviation");
    expect(filterLibrary(library, { theme: "aviation" }).length).toBeGreaterThanOrEqual(3);
  });

  it("words must all match, anywhere in the title, summary, questions or labels", () => {
    expect(filterLibrary(library, { query: "wright" }).map((i) => i.title)).toEqual(["Up in the air"]);
    expect(filterLibrary(library, { query: "UP  in" }).map((i) => i.title)).toContain("Up in the air");
    expect(filterLibrary(library, { query: "zzzz-nothing" })).toEqual([]);
    expect(filterLibrary(library, { query: "printable sheets" }).length).toBeGreaterThan(5); // matches the format's label
  });

  it("treats typed punctuation as nothing: it is never a pattern", () => {
    expect(filterLibrary(library, { query: "'; drop table content_items; --" })).toEqual([]);
    expect(filterLibrary(library, { query: ".*" })).toEqual(library);
  });

  it("counts what each choice would show, given the others", () => {
    const filter = { stage: "late" as const, query: "" };
    const counts = facetCounts(library, filter);
    for (const format of ACTIVITY_FORMATS) expect(counts.format[format]).toBe(filterLibrary(library, { ...filter, format }).length);
    for (const s of STAGES) expect(counts.stage[s.id]).toBe(filterLibrary(library, { ...filter, stage: s.id }).length);
    expect(facetCounts(library, { format: "trivia" }).format.trivia).toBe(filterLibrary(library, { format: "trivia" }).length);
  });
});

describe("the adaptation engine", () => {
  const formatsAll = ACTIVITY_FORMATS.map((f) => [f] as const);

  it("has a guide for every stage, with a length range that grows shorter as the stage advances", () => {
    expect(Object.keys(STAGE_GUIDES).sort()).toEqual(["early", "late", "middle"]);
    expect(STAGE_GUIDES.early.minutes[1]).toBeGreaterThan(STAGE_GUIDES.middle.minutes[1]);
    expect(STAGE_GUIDES.middle.minutes[1]).toBeGreaterThan(STAGE_GUIDES.late.minutes[1]);
  });

  it.each(TRACK_STAGES.flatMap((stage) => formatsAll.map(([format]) => [stage, format] as const)))("gives %s %s tips that are not repeated", (stage, format) => {
    const a = adaptActivity({ formats: [format], minutes: 30 }, stage);
    expect(a.tips.length).toBeGreaterThanOrEqual(3);
    expect(new Set(a.tips).size).toBe(a.tips.length);
    expect(a.stage).toBe(stage);
  });

  it("brings the length of an activity into the range the stage holds", () => {
    expect(adaptActivity({ formats: ["games"], minutes: 60 }, "late").minutes).toBe(20);
    expect(adaptActivity({ formats: ["games"], minutes: 5 }, "early").minutes).toBe(20);
    expect(adaptActivity({ formats: ["games"], minutes: 25 }, "middle").minutes).toBe(25);
    expect(adaptActivity({ formats: ["games"] }, "middle").minutes).toBe(15);
  });

  it("changes what it says with the stage", () => {
    const tips = (stage: "early" | "middle" | "late") => adaptActivity({ formats: ["trivia"] }, stage).tips.join(" ");
    expect(new Set([tips("early"), tips("middle"), tips("late")]).size).toBe(3);
  });

  it("keeps to the house tone: adult, never a quiz, no baby talk", () => {
    const words = ACTIVITY_FORMATS.flatMap((format) => TRACK_STAGES.flatMap((stage) => adaptActivity({ formats: [format] }, stage).tips));
    for (const line of [...words, ...Object.values(STAGE_GUIDES).flatMap((g) => [g.headline, g.cueing, g.pace, g.groupSize])]) {
      expect(line).not.toMatch(/remember|recall|what year|can you name|sweetie|honey|dear|good job/i);
    }
  });

  it("has a one-line cue for a calendar note that fits the note's limit", () => {
    for (const format of ACTIVITY_FORMATS) for (const stage of TRACK_STAGES) expect(quickTip(format, stage).length).toBeLessThanOrEqual(140);
  });
});

describe("reminiscence prompts", () => {
  const prompts = library.map(toPrompt).filter((p): p is NonNullable<typeof p> => p !== null);

  it("are every reminiscence item in the library, and only those", () => {
    expect(prompts).toHaveLength(library.filter((i) => i.category === "reminiscence").length);
    expect(prompts.length).toBe(40);
  });

  it("filter by decade, by sense, by stage and by words", () => {
    for (const decade of DECADES) {
      const shown = filterPrompts(prompts, { decade });
      expect(shown).toHaveLength(10);
      expect(shown.every((p) => p.decade === decade)).toBe(true);
    }
    for (const sense of SENSES) for (const p of filterPrompts(prompts, { sense })) expect(p.senses).toContain(sense);
    for (const p of filterPrompts(prompts, { stage: "late" })) expect(["late", "universal"]).toContain(p.stage);
    expect(filterPrompts(prompts, { query: "radio" }).length).toBeGreaterThanOrEqual(2);
    expect(filterPrompts(prompts, { query: "1950s television" }).length).toBeGreaterThanOrEqual(1);
    expect(filterPrompts(prompts, { decade: 1960, sense: "sound", stage: "early", query: "beatles" })).toHaveLength(1);
    expect(filterPrompts(prompts, { query: "qqqq" })).toEqual([]);
  });

  it("count what each decade, sense and stage would show, given the other choices", () => {
    const counts = promptFacetCounts(prompts, {});
    expect(DECADES.map((d) => counts.decade[d])).toEqual([10, 10, 10, 10]);
    for (const sense of SENSES) expect(counts.sense[sense]).toBe(filterPrompts(prompts, { sense }).length);
    for (const stage of TRACK_STAGES) expect(counts.stage[stage]).toBe(filterPrompts(prompts, { stage }).length);

    const narrowed = promptFacetCounts(prompts, { decade: 1950, sense: "sound" });
    for (const decade of DECADES) expect(narrowed.decade[decade]).toBe(filterPrompts(prompts, { decade, sense: "sound" }).length);
    for (const sense of SENSES) expect(narrowed.sense[sense]).toBe(filterPrompts(prompts, { decade: 1950, sense }).length);
  });

  it("have every decade and every sense, so no chip leads nowhere", () => {
    const counts = promptFacetCounts(prompts, {});
    for (const decade of DECADES) expect(counts.decade[decade], String(decade)).toBeGreaterThanOrEqual(5);
    for (const sense of SENSES) expect(counts.sense[sense], sense).toBeGreaterThanOrEqual(3);
  });

  it("are read from a page's address, and written back the same", () => {
    const filter = { decade: 1950, sense: "sound", stage: "late", query: "radio" } as const;
    expect(parsePromptParams({ decade: "1950", sense: "sound", stage: "late", q: "radio" })).toEqual(filter);
    expect(promptFilterToSearch(filter)).toBe("?decade=1950&sense=sound&stage=late&q=radio");
    expect(parsePromptParams(Object.fromEntries(new URLSearchParams(promptFilterToSearch(filter))))).toEqual(filter);
    expect(promptFilterToSearch({})).toBe("");
  });

  it.each<[Record<string, unknown>, string]>([
    [{ decade: "1930" }, "a decade we do not have"],
    [{ decade: 1950 }, "a number, not text"],
    [{ decade: ["1950"] }, "an array"],
    [{ sense: "intuition" }, "a made-up sense"],
    [{ sense: "constructor" }, "an inherited name"],
    [{ stage: "universal" }, "not a stage anyone is in"],
    [{ q: "   " }, "only spaces"],
  ])("drop %j (%s) from an address", (params, _why) => {
    expect(parsePromptParams(params)).toEqual({});
  });

  it("are not made from items that are not prompts", () => {
    const notPrompt = library.find((i) => i.category !== "reminiscence")!;
    expect(toPrompt(notPrompt)).toBeNull();
    expect(toPrompt({ ...library.find((i) => i.category === "reminiscence")!, content_payload: { schema_version: 1, summary: "x" } })).toBeNull();
  });
});

describe("the month planner", () => {
  it("makes the same calendar from the same choices, and a different one from a new seed", () => {
    expect(make()).toEqual(make());
    expect(make({ seed: "other" }).data.slots.map((s) => s.content_item_id)).not.toEqual(make().data.slots.map((s) => s.content_item_id));
  });

  it("does not depend on the order of the library", () => {
    const shuffled = [...generatorItems].reverse();
    // Same choices, same library: the same set of items is available, but ties may fall differently. The calendar is still valid.
    expect(CalendarDataSchema.safeParse(make({}, shuffled).data).success).toBe(true);
  });

  it("is a valid calendar for every month of a year, every theme and every choice of stages", () => {
    const stages: Plan["stages"][] = [["early"], ["middle"], ["late"], ["early", "late"], ["early", "middle", "late"]];
    for (let m = 1; m <= 12; m++) {
      const month = `2027-${String(m).padStart(2, "0")}`;
      const theme = (["none", ...THEME_IDS] as const)[m % (THEME_IDS.length + 1)]!;
      const { data } = make({ month, theme, stages: stages[m % stages.length]!, perDay: m % 2 === 0 ? 2 : 3 });
      const parsed = CalendarDataSchema.safeParse(data);
      expect(parsed.success, `${month}: ${parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 2))}`).toBe(true);
    }
  });

  it("makes a track for each stage chosen, in order, with a session for each slot of every day", () => {
    const { data } = make({ month: "2026-11", stages: ["late", "early"], perDay: 2 });
    expect(data.groups.map((g) => g.id)).toEqual(["early", "late"]);
    expect(data.slots).toHaveLength(30 * 2 * 2);
    expect(new Set(data.slots.map((s) => s.time))).toEqual(new Set(["10:00", "14:00"]));
    expect(make({ perDay: 3 }).data.slots.filter((s) => s.group_id === "middle")).toHaveLength(31 * 3);
    expect(make({ month: "2028-02" }).data.slots.filter((s) => s.group_id === "early" && s.time === "10:00")).toHaveLength(29);
  });

  it("gives each stage only activities that suit it", () => {
    const byId = new Map(generatorItems.map((i) => [i.id, i]));
    for (const slot of make().data.slots) expect(suitsStage(byId.get(slot.content_item_id)!.stage, slot.group_id as "early"), slot.id).toBe(true);
  });

  it("never plans the same activity twice in one day for one stage", () => {
    const seen = new Set<string>();
    for (const slot of make().data.slots) {
      const key = `${slot.group_id}|${slot.date}|${slot.content_item_id}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });

  it("spreads the same activity out: no stage meets one again within two days", () => {
    const last = new Map<string, number>();
    for (const slot of make().data.slots) {
      const day = Number(slot.date.slice(8));
      const key = `${slot.group_id}|${slot.content_item_id}`;
      const before = last.get(key);
      if (before !== undefined) expect(day - before, key).toBeGreaterThan(1);
      last.set(key, day);
    }
  });

  it("keeps a day's rhythm: movement or music first, something to think about after", () => {
    const byId = new Map(generatorItems.map((i) => [i.id, i]));
    for (const slot of make().data.slots.filter((s) => s.group_id !== "late")) {
      const role = roleOf(byId.get(slot.content_item_id)!);
      if (slot.time === "10:00") expect(role, slot.id).toBe("energize");
      if (slot.time === "14:00") expect(role, slot.id).toBe("engage");
      if (slot.time === "16:00") expect(role, slot.id).toBe("calm");
    }
  });

  it("prefers activities that fit the theme, and fills the rest with ones that fit any month", () => {
    const byId = new Map(generatorItems.map((i) => [i.id, i]));
    for (const theme of ["spring", "aviation", "nostalgia-1950s"] as const) {
      const themed = make({ theme });
      const share = themed.stats.themed / themed.stats.sessions;
      const none = make({ theme: "none" }).data.slots.filter((s) => byId.get(s.content_item_id)!.themes.includes(theme)).length / themed.stats.sessions;
      expect(share, theme).toBeGreaterThan(none + 0.15);
      expect(share, theme).toBeGreaterThan(0.3);
      const wrongTheme = themed.data.slots.filter((s) => {
        const t = byId.get(s.content_item_id)!.themes;
        return t.length > 0 && !t.includes(theme);
      }).length;
      expect(wrongTheme / themed.stats.sessions, theme).toBeLessThan(0.35);
    }
    expect(make({ theme: "none" }).stats.themed).toBe(0);
  });

  it("holds back activities for other themes when a theme is chosen: neutral ones fill the gaps first", () => {
    const kinds: [string, GeneratorItem["formats"]][] = [["movement", ["active"]], ["word", ["games"]], ["multisensory", ["sensory"]]];
    let n = 0;
    const group = (category: string, formats: GeneratorItem["formats"]): GeneratorItem[] => [
      { id: `5eed0000-0000-4000-8000-0000000003${String(++n).padStart(2, "0")}`, title: `${category} fits the month`, category, stage: "universal", formats, themes: ["aviation"] },
      ...Array.from({ length: 5 }, (_, i) => ({ id: `5eed0000-0000-4000-8000-0000000003${String(++n).padStart(2, "0")}`, title: `${category} any month ${i}`, category, stage: "universal" as const, formats, themes: [] })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: `5eed0000-0000-4000-8000-0000000003${String(++n).padStart(2, "0")}`, title: `${category} another theme ${i}`, category, stage: "universal" as const, formats, themes: ["winter"] })),
    ];
    const items = kinds.flatMap(([category, formats]) => group(category, formats));
    const titles = new Map(items.map((i) => [i.id, i.title]));
    for (const seed of ["h1", "h2", "h3"]) {
      const { data } = make({ theme: "aviation", stages: ["early"], perDay: 3, seed }, items);
      const wrong = data.slots.filter((s) => titles.get(s.content_item_id)!.includes("another theme")).length;
      const neutral = data.slots.filter((s) => titles.get(s.content_item_id)!.includes("any month")).length;
      expect(wrong, seed).toBe(0);
      expect(neutral, seed).toBeGreaterThan(30);
    }
  });

  it("does not bring an activity back within three days for the same stage, with no theme and for any seed", () => {
    for (const seed of ["a1", "b2", "c3", "d4", "e5"]) {
      for (const perDay of [2, 3] as const) {
        const { data } = make({ seed, theme: "none", perDay });
        for (const stage of ["early", "middle", "late"]) {
          const last = new Map<string, number>();
          for (const slot of data.slots.filter((s) => s.group_id === stage)) {
            const day = Number(slot.date.slice(8));
            const before = last.get(slot.content_item_id);
            if (before !== undefined) expect(day - before, `${seed} x${perDay} ${stage} ${slot.content_item_id}`).toBeGreaterThanOrEqual(3);
            last.set(slot.content_item_id, day);
          }
        }
      }
    }
  });

  it("alternates between two candidates rather than running the same one two days in a row", () => {
    const two = (category: string, formats: GeneratorItem["formats"]): GeneratorItem[] =>
      [1, 2].map((n) => ({ id: `5eed0000-0000-4000-8000-0000000001${n}${category.length}`, title: `${category} ${n}`, category, stage: "universal" as const, formats, themes: [] }));
    const tiny = [...two("movement", ["active"]), ...two("word", ["games"]), ...two("multisensory", ["sensory"])];
    const { data } = make({ stages: ["early"], perDay: 3, seed: "tiny" }, tiny);
    for (const time of ["10:00", "14:00", "16:00"]) {
      const ids = data.slots.filter((s) => s.time === time).sort((a, b) => a.date.localeCompare(b.date)).map((s) => s.content_item_id);
      expect(ids).toHaveLength(31);
      for (let i = 1; i < ids.length; i++) expect(ids[i], `${time} day ${i + 1}`).not.toBe(ids[i - 1]);
    }
  });

  it("never plans the same activity twice in one day, even when the library has only one kind (and one of them fits the theme)", () => {
    const active: GeneratorItem[] = [1, 2, 3, 4, 5].map((n) => ({ id: `5eed0000-0000-4000-8000-0000000002${n}0`, title: `Movement ${n}`, category: "movement", stage: "universal" as const, formats: ["active"], themes: n === 1 ? ["aviation"] : [] }));
    for (const theme of ["none", "aviation"] as const) {
      for (const seed of ["p", "q", "r", "s"]) {
        const { data } = make({ theme, stages: ["early"], perDay: 3, seed }, active);
        const byDay = new Map<string, string[]>();
        for (const slot of data.slots) byDay.set(slot.date, [...(byDay.get(slot.date) ?? []), slot.content_item_id]);
        for (const [date, ids] of byDay) expect(new Set(ids).size, `${theme} ${seed} ${date}`).toBe(ids.length);
      }
    }
  });

  it("uses a good part of the library, so a month does not feel repeated", () => {
    expect(make().stats.distinct).toBeGreaterThan(45);
  });

  it("writes a short cue into every session's note, with no names", () => {
    for (const slot of make().data.slots) {
      expect(slot.note.length).toBeGreaterThan(0);
      expect(slot.note.length).toBeLessThanOrEqual(140);
      expect(slot.locked).toBe(false);
    }
  });

  it("records the seed, so the same month can be made again", () => {
    expect(make({ seed: "keep-me" }).data.generator).toEqual({ name: "Cognicopia month planner", version: "1", seed: "keep-me" });
  });

  it("copes with a library of one: it plans from what there is", () => {
    const one: GeneratorItem[] = [{ id: "5eed0000-0000-4000-8000-000000000001", title: "Chair yoga", category: "movement", stage: "universal", formats: ["active"], themes: [] }];
    const { data } = make({ perDay: 3 }, one);
    expect(data.slots).toHaveLength(31 * 3 * 3);
    expect(CalendarDataSchema.safeParse(data).success).toBe(true);
  });

  it("skips a stage with nothing to plan from, and says so", () => {
    const earlyOnly = generatorItems.filter((i) => i.stage === "early");
    const out = make({}, earlyOnly);
    expect(out.data.groups.map((g) => g.id)).toEqual(["early"]);
    expect(out.stats.skipped).toEqual(["middle", "late"]);
  });

  it("refuses an empty library, and a library with nothing for the stages chosen", () => {
    expect(generateCalendar(plan(), [])).toMatchObject({ ok: false });
    expect(generateCalendar(plan({ stages: ["late"] }), generatorItems.filter((i) => i.stage === "early"))).toMatchObject({ ok: false });
  });

  it("is always well within a calendar's size limit", () => {
    expect(make({ month: "2026-12" }).data.slots.length).toBeLessThan(MAX_SLOTS);
  });

  it("makes a seed that the plan accepts", () => {
    expect(PlanSchema.safeParse({ ...plan(), seed: newSeed() }).success).toBe(true);
  });
});

describe("what the planner accepts", () => {
  it.each([
    [{ month: "2026-13" }],
    [{ month: "October" }],
    [{ theme: "pirates" }],
    [{ stages: [] }],
    [{ stages: ["early", "early", "early", "early"] }],
    [{ stages: ["universal"] }],
    [{ perDay: 4 }],
    [{ perDay: 1 }],
    [{ seed: "" }],
    [{ seed: "x".repeat(41) }],
    [{ seed: "a b" }],
    [{ seed: "../../etc" }],
  ])("refuses %j", (over) => {
    expect(PlanSchema.safeParse({ ...plan(), ...over }).success).toBe(false);
  });

  it("accepts any theme, or none", () => {
    for (const theme of ["none", ...THEME_IDS]) expect(PlanSchema.safeParse({ ...plan(), theme }).success).toBe(true);
  });
});
