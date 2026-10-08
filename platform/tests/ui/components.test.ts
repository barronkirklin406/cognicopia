import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActivityCard } from "@/components/planner/ActivityCard";
import { CalendarGenerator } from "@/components/planner/CalendarGenerator";
import { CalendarGrid } from "@/components/planner/CalendarGrid";
import { CalendarView } from "@/components/planner/CalendarView";
import { Chip } from "@/components/planner/Chip";
import { DashboardPlan } from "@/components/planner/DashboardPlan";
import { DayPlan } from "@/components/planner/DayPlan";
import { FormatFilter } from "@/components/planner/FormatFilter";
import { LibraryBrowser, describeFilter } from "@/components/planner/LibraryBrowser";
import { PrintCalendar } from "@/components/planner/PrintCalendar";
import { PromptCard } from "@/components/planner/PromptCard";
import { ReminiscenceBrowser } from "@/components/planner/ReminiscenceBrowser";
import { StageFilter } from "@/components/planner/StageFilter";
import { ThemePicker } from "@/components/planner/ThemePicker";
import type { ContentItem } from "@/lib/db/models";
import { generateCalendar, toGeneratorItem, type Plan } from "@/lib/domain/calendar-generator";
import { daysInMonth } from "@/lib/domain/months";
import { toPrompt } from "@/lib/domain/reminiscence";
import { THEMES } from "@/lib/domain/themes";
import { seedLibrary } from "../helpers/library";

/**
 * The planning components, drawn to static markup the way the server draws them. No browser: what
 * is checked is what a screen reader and a printer are given (names, roles, states, text, the
 * structure of a table), and that no component puts Liquid-like braces or a resident's name on a page.
 * The behaviour in a real browser is covered by the scratch end-to-end run described in the README.
 */
const html = (element: ReactElement) => renderToStaticMarkup(element);
const library = seedLibrary();
const byId = Object.fromEntries(library.map((item) => [item.id, item])) as Record<string, ContentItem>;
const item = (title: string) => library.find((i) => i.title === title)!;
const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;

const plan: Plan = { month: "2026-11", theme: "aviation", stages: ["early", "middle", "late"], perDay: 3, seed: "fixed" };
const made = generateCalendar(plan, library.map(toGeneratorItem));
if (!made.ok) throw new Error("the test library should make a calendar");
const data = made.data;

describe("a filter chip", () => {
  it("is a button that says whether it is chosen, with a tick and a count that a screen reader can read", () => {
    const on = html(h(Chip, { pressed: true, count: 6, onClick: () => {}, children: "Trivia" }));
    expect(on).toContain('type="button"');
    expect(on).toContain('aria-pressed="true"');
    expect(on).toContain("✓");
    expect(on).toContain('<span class="sr-only"> shown</span>');
    const off = html(h(Chip, { pressed: false, onClick: () => {}, children: "Trivia" }));
    expect(off).toContain('aria-pressed="false"');
    expect(off).not.toContain("✓");
  });

  it("is at least 44 px tall and uses a visible border, not colour alone", () => {
    const markup = html(h(Chip, { pressed: false, onClick: () => {}, children: "Trivia" }));
    expect(markup).toContain("min-h-11");
    expect(markup).toContain("border-2");
  });

  it("dims, but does not disable, a choice that would show nothing", () => {
    const markup = html(h(Chip, { pressed: false, count: 0, onClick: () => {}, children: "Trivia" }));
    expect(markup).toContain("opacity-70");
    expect(markup).not.toContain("disabled");
  });
});

describe("the stage and format filters", () => {
  it("offer early, middle and late stage, and say what the chosen one means", () => {
    const markup = html(h(StageFilter, { value: "late", onChange: () => {}, counts: { early: 3, middle: 4, late: 5 } }));
    for (const label of ["Early stage", "Middle stage", "Late stage"]) expect(markup).toContain(label);
    expect(count(markup, /aria-pressed="true"/g)).toBe(1);
    expect(markup).toContain("Responds to the senses");
    expect(markup).toContain('role="group"');
  });

  it("offer the four formats staff ask for, and the rest of a day", () => {
    const markup = html(h(FormatFilter, { value: undefined, onChange: () => {} }));
    for (const label of ["Reminiscence prompts", "Cognitive games", "Trivia", "Printable sheets", "Movement &amp; music", "Sensory"]) expect(markup).toContain(label);
    expect(count(markup, /aria-pressed="true"/g)).toBe(0);
  });
});

describe("an activity card", () => {
  it("shows what it is, and adapts how to run it to the stage chosen", () => {
    const markup = html(h(ActivityCard, { item: item("Chair yoga"), stage: "late" }));
    expect(markup).toContain("Chair yoga");
    expect(markup).toContain("Gentle seated stretches");
    expect(markup).toContain("<summary");
    expect(markup).toContain("Late stage: Lead with the senses");
    expect(markup).not.toContain("Early stage: Keep it adult");
  });

  it("explains for the stage it is made for when none is chosen, and for all three when it is for any", () => {
    const early = html(h(ActivityCard, { item: item("Large-print word search") }));
    expect(early).toContain("Early stage: Keep it adult");
    expect(early).not.toContain("Late stage: Lead");
    const any = html(h(ActivityCard, { item: item("Chair yoga") }));
    for (const stage of ["Early stage:", "Middle stage:", "Late stage:"]) expect(any).toContain(stage);
  });

  it("gives the trivia answers to read out, and the materials and steps where there are some", () => {
    const trivia = html(h(ActivityCard, { item: item("Up in the air") }));
    expect(trivia).toContain("Answer: The Wright brothers");
    const planting = html(h(ActivityCard, { item: item("Planting herbs") }));
    expect(planting).toContain("Have ready");
    expect(planting).toContain("Steps");
  });

  it("marks a prompt as a reminiscence prompt in its title", () => {
    const prompt = library.find((i) => i.category === "reminiscence")!;
    expect(html(h(ActivityCard, { item: prompt }))).toContain("Reminiscence: ");
  });

  it("hides the how-to on paper, where only the summary is wanted", () => {
    expect(html(h(ActivityCard, { item: item("Chair yoga") }))).toContain('<details class="print:hidden">');
  });
});

describe("the library browser", () => {
  it("draws the whole first page, grouped under category headings, and says how many there are", () => {
    const markup = html(h(LibraryBrowser, { items: library, initial: {} }));
    expect(markup).toContain("Showing 48 of 104 activities");
    expect(count(markup, /<article/g)).toBe(48);
    expect(count(markup, /<h2 /g)).toBeGreaterThanOrEqual(3);
    expect(markup).toContain("Show more activities (56 more)");
  });

  it("starts from the filter in the address, and says so in words", () => {
    const markup = html(h(LibraryBrowser, { items: library, initial: { stage: "late", format: "trivia" } }));
    expect(markup).toMatch(/Showing \d+ of \d+ activities?: Late stage, Trivia/);
    expect(markup).toContain("Clear all filters");
    expect(count(markup, /aria-pressed="true"/g)).toBe(2);
  });

  it("starts from a theme and a search too", () => {
    const markup = html(h(LibraryBrowser, { items: library, initial: { theme: "aviation", query: "sky" } }));
    expect(markup).toContain('matching &quot;sky&quot;');
    expect(markup).toContain('<option value="aviation" selected="">Aviation</option>');
  });

  it("says so, and offers to clear, when nothing matches", () => {
    const markup = html(h(LibraryBrowser, { items: library, initial: { query: "zzzzqq" } }));
    expect(markup).toContain("No activities match.");
    expect(markup).toContain("Nothing matches these choices");
    expect(count(markup, /<article/g)).toBe(0);
  });

  it("announces its count politely, and labels the search and the theme", () => {
    const markup = html(h(LibraryBrowser, { items: library, initial: {} }));
    expect(markup).toMatch(/<p role="status" aria-live="polite"/);
    expect(markup).toMatch(/<label[^>]*>Search<\/label>/);
    expect(markup).toMatch(/<label[^>]*>Theme<\/label>/);
  });

  it("describes a filter in words", () => {
    expect(describeFilter({})).toBe("");
    expect(describeFilter({ stage: "middle", format: "games", theme: "garden", query: " tea " })).toBe('Middle stage, Cognitive games, Gardens & nature, matching "tea"');
  });
});

describe("the reminiscence browser", () => {
  const prompts = library.map(toPrompt).filter((p): p is NonNullable<typeof p> => p !== null);

  it("offers every decade and sense, with counts, and the how-to for a visit and for a circle", () => {
    const markup = html(h(ReminiscenceBrowser, { prompts, initial: {} }));
    for (const label of ["1940s", "1950s", "1960s", "1970s", "Sight", "Sound", "Smell", "Taste", "Touch"]) expect(markup).toContain(label);
    expect(markup).toContain("Showing 40 of 40 prompts");
    expect(markup).toContain("On a one-to-one visit");
    expect(markup).toContain("In a group circle");
    expect(count(markup, /<article/g)).toBe(40);
  });

  it("starts from the filter in the address", () => {
    const markup = html(h(ReminiscenceBrowser, { prompts, initial: { decade: 1950, sense: "sound" } }));
    expect(markup).toMatch(/Showing \d+ of 40 prompts?: 1950s, Sound/);
    expect(count(markup, /<article/g)).toBeGreaterThanOrEqual(2);
  });

  it("has a printed heading that names the filter, and a print button only when there is something to print", () => {
    const some = html(h(ReminiscenceBrowser, { prompts, initial: { decade: 1960 } }));
    expect(some).toContain("Reminiscence prompts: 1960s");
    expect(some).toContain("Print these prompts");
    const none = html(h(ReminiscenceBrowser, { prompts, initial: { query: "zzzzqq" } }));
    expect(none).not.toContain("Print these prompts");
  });

  it("draws a prompt card with a large opening line, what to say next, and no resident's name", () => {
    const prompt = prompts.find((p) => p.topic === "Coffee on the stove")!;
    const markup = html(h(PromptCard, { prompt }));
    expect(markup).toContain("text-xl");
    expect(markup).toContain("If the conversation slows");
    expect(markup).toContain("Have ready");
    expect(markup).toContain("1960s");
    expect(markup).toContain("Smell");
  });
});

describe("the screen calendar grid", () => {
  const grid = html(h(CalendarGrid, { month: "2026-11", slots: data.slots, activities: byId, groupId: "early", caption: "Early stage: November 2026" }));

  it("is a table with the seven weekdays as column headers, and a name", () => {
    expect(count(grid, /<th scope="col"/g)).toBe(7);
    expect(grid).toContain("<caption");
    expect(grid).toContain("Early stage: November 2026");
    for (const day of ["Sunday", "Monday", "Saturday"]) expect(grid).toContain(`title="${day}"`);
  });

  it("has a large button for every day of the month, each beginning with its full date for a screen reader", () => {
    expect(count(grid, /<button/g)).toBe(daysInMonth("2026-11"));
    expect(grid).toContain("Sunday, November 1. ");
    expect(grid).toContain("Monday, November 30. ");
    expect(grid).toContain("min-h-32");
  });

  it("shows each day's sessions with their times, in order", () => {
    const first = data.slots.filter((s) => s.group_id === "early" && s.date === "2026-11-01").sort((a, b) => a.time.localeCompare(b.time));
    expect(first).toHaveLength(3);
    const cell = grid.slice(grid.indexOf("Sunday, November 1. "), grid.indexOf("Monday, November 2. "));
    expect(cell.indexOf("10 am")).toBeGreaterThan(-1);
    expect(cell.indexOf("10 am")).toBeLessThan(cell.indexOf("2 pm"));
    expect(cell.indexOf("2 pm")).toBeLessThan(cell.indexOf("4 pm"));
    for (const slot of first) expect(cell).toContain(byId[slot.content_item_id]!.title.replace(/&/g, "&amp;"));
  });

  it("marks the chosen day as pressed, and says so for no sessions", () => {
    const chosen = html(h(CalendarGrid, { month: "2026-11", slots: data.slots, activities: byId, groupId: "early", selected: "2026-11-03", caption: "x" }));
    expect(count(chosen, /aria-pressed="true"/g)).toBe(1);
    const empty = html(h(CalendarGrid, { month: "2026-11", slots: [], activities: byId, groupId: "early", caption: "x" }));
    expect(count(empty, /Nothing planned/g)).toBe(30);
  });

  it("does not name an activity it cannot find", () => {
    const lost = html(h(CalendarGrid, { month: "2026-11", slots: data.slots, activities: {}, groupId: "early", caption: "x" }));
    expect(lost).toContain("An activity");
  });
});

describe("a day's plan", () => {
  it("lists the sessions in time order for each stage, with a one-line cue and how to run each for that stage", () => {
    const markup = html(h(DayPlan, { date: "2026-11-02", groups: data.groups, slots: data.slots, activities: byId }));
    for (const name of ["Early stage", "Middle stage", "Late stage"]) expect(markup).toContain(name);
    expect(count(markup, /<summary/g)).toBe(9);
    expect(markup).toContain("Late stage: Lead with the senses");
    expect(markup).toContain("Early stage: Keep it adult");
  });

  it("lists a day's sessions in time order, whatever order they were stored in", () => {
    const stored = data.slots.filter((s) => s.group_id === "early" && s.date === "2026-11-02").reverse();
    expect(stored.map((s) => s.time)).toEqual(["16:00", "14:00", "10:00"]);
    const markup = html(h(DayPlan, { date: "2026-11-02", groups: data.groups, slots: stored, activities: byId, only: "early" }));
    expect(markup.indexOf("10:00 am")).toBeLessThan(markup.indexOf("2:00 pm"));
    expect(markup.indexOf("2:00 pm")).toBeLessThan(markup.indexOf("4:00 pm"));
    const grid = html(h(CalendarGrid, { month: "2026-11", slots: stored, activities: byId, groupId: "early", caption: "x" }));
    const cell = grid.slice(grid.indexOf("Monday, November 2. "), grid.indexOf("Tuesday, November 3. "));
    expect(cell.indexOf("10 am")).toBeLessThan(cell.indexOf("2 pm"));
  });

  it("shows one stage without its heading when asked, and says when nothing is planned", () => {
    const one = html(h(DayPlan, { date: "2026-11-02", groups: data.groups, slots: data.slots, activities: byId, only: "late", headingLevel: 4 }));
    expect(count(one, /<summary/g)).toBe(3);
    expect(one).not.toMatch(/<h4 class="m-0 font-display text-xl/); // the group's own heading (the notes inside have smaller ones)
    expect(one).not.toContain("Middle stage");
    const none = html(h(DayPlan, { date: "2026-12-25", groups: data.groups, slots: data.slots, activities: byId, only: "late" }));
    expect(none).toContain("Nothing is planned for this day.");
  });

  it("reads a group named some other way by its acuity tier", () => {
    const groups = [{ id: "garden-room", name: "Garden Room", acuity: 3 as const }];
    const slots = data.slots.filter((s) => s.group_id === "early").map((s) => ({ ...s, group_id: "garden-room" }));
    const markup = html(h(DayPlan, { date: "2026-11-02", groups, slots, activities: byId }));
    expect(markup).toContain("Garden Room");
    expect(markup).toContain("Late stage: Lead with the senses");
  });
});

describe("the printed calendar", () => {
  const sections = (markup: string) => [...markup.matchAll(/<section class="print-calendar[^"]*"/g)].length;
  const print = (extra: object = {}, slots = data.slots) => html(h(PrintCalendar, { month: "2026-11", groupId: "early", groupName: "Early stage", slots, activities: byId, facilityName: "Maple Court", firstOnPaper: true, ...extra }));

  it("is a table with a heading row, the weekdays, and every day of the month once", () => {
    const markup = print();
    expect(count(markup, /<th scope="col"/g)).toBeGreaterThanOrEqual(7);
    expect(markup).toContain("Early stage: November 2026");
    expect(markup).toContain("Maple Court");
    const days = [...markup.matchAll(/text-\[16pt\] font-bold leading-none text-black">(\d+)</g)].map((m) => Number(m[1]));
    expect(days).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it("is plain black on white: no colour, no tint, no background, in the whole printout", () => {
    const markup = print();
    expect(markup).not.toMatch(/\b(bg-|text-ink|text-garden|border-rule|border-ink|text-white)/);
    expect(markup).toContain("border-black");
    expect(markup).toContain("text-black");
  });

  it("uses type of at least 11 pt everywhere, and says each time in a bold weight", () => {
    const markup = print();
    for (const size of markup.matchAll(/font-size:(\d+)pt/g)) expect(Number(size[1])).toBeGreaterThanOrEqual(11);
    for (const size of markup.matchAll(/text-\[(\d+)pt\]/g)) expect(Number(size[1])).toBeGreaterThanOrEqual(11);
    expect(markup).toMatch(/<span class="font-bold">10 am<\/span>/);
  });

  it("starts a new page for every sheet but the very first", () => {
    const classes = (markup: string) => [...markup.matchAll(/<section class="(print-calendar[^"]*)"/g)].map((m) => m[1]!);
    const first = classes(print());
    expect(first.length).toBeGreaterThan(1);
    expect(first[0]).not.toContain("break-before-page");
    for (const rest of first.slice(1)) expect(rest).toContain("break-before-page");
    for (const all of classes(print({ firstOnPaper: false }))) expect(all).toContain("break-before-page");
  });

  it("splits a busy month into sheets and numbers them", () => {
    const markup = print();
    const n = sections(markup);
    expect(n).toBeGreaterThanOrEqual(1);
    if (n > 1) for (let i = 1; i <= n; i++) expect(markup).toContain(`(${i} of ${n})`);
  });

  it("puts a quiet month on one sheet with no sheet numbers", () => {
    const quiet = data.slots.filter((s) => s.group_id === "early" && s.time === "10:00");
    const markup = print({}, quiet);
    expect(sections(markup)).toBe(1);
    expect(markup).not.toMatch(/\(\d of \d\)/);
  });

  it("prints a title without the screen's 'Reminiscence:' tag", () => {
    const slots = data.slots.filter((s) => s.group_id === "early").slice(0, 60);
    const markup = print({}, slots);
    expect(markup).not.toContain("Reminiscence:");
  });

  it("holds a footnote that the activities are suggestions", () => {
    expect(print()).toContain("Activities are suggestions: adapt them to the people in the room.");
  });
});

describe("the calendar view", () => {
  it("shows a stage to choose, the grid and a list of days, and the print buttons for a saved calendar", () => {
    const markup = html(h(CalendarView, { month: "2026-11", data, activities: byId, mode: "saved", facilityName: "Maple Court" }));
    expect(markup).toContain("Show the plan for");
    expect(markup).toContain("Print Early stage");
    expect(markup).toContain("Print all stages");
    expect(markup).toContain("choose Landscape");
    expect(markup).toContain("print-calendar");
    expect(markup).toContain("Choose a day to see how to run its sessions.");
    expect(markup).toContain("hidden md:block"); // the grid is for a wide screen
    expect(markup).toContain("md:hidden"); // and a list of days is for a phone
  });

  it("offers no printing from the generator's preview", () => {
    const markup = html(h(CalendarView, { month: "2026-11", data, activities: byId, mode: "preview" }));
    expect(markup).not.toContain("Print ");
    expect(markup).not.toContain("print-calendar");
  });

  it("hides everything but the printed calendar on paper", () => {
    const markup = html(h(CalendarView, { month: "2026-11", data, activities: byId, mode: "saved" }));
    expect(markup).toMatch(/class="[^"]*print:hidden[^"]*"/);
    expect(markup).toContain('class="hidden print:block"');
  });

  it("says so for a month with nothing planned", () => {
    const markup = html(h(CalendarView, { month: "2026-11", data: { ...data, groups: [], slots: [] }, activities: byId, mode: "saved" }));
    expect(markup).toContain("This month has nothing planned yet.");
  });

  it("with one stage shows its name as the heading rather than a choice", () => {
    const one = { ...data, groups: data.groups.slice(0, 1), slots: data.slots.filter((s) => s.group_id === "early") };
    const markup = html(h(CalendarView, { month: "2026-11", data: one, activities: byId, mode: "saved" }));
    expect(markup).not.toContain("Show the plan for");
    expect(markup).toContain("Print this calendar");
    expect(markup).not.toContain("Print all stages");
  });
});

describe("the theme picker", () => {
  it("is a group of radio buttons, one for each theme and one for none, with the chosen one checked", () => {
    const markup = html(h(ThemePicker, { value: "aviation", onChange: () => {} }));
    expect(count(markup, /type="radio"/g)).toBe(THEMES.length + 1);
    expect(count(markup, /checked=""/g)).toBe(1);
    expect(markup).toContain("<legend");
    expect(markup).toContain("No theme");
    for (const theme of THEMES) expect(markup).toContain(theme.label.replace(/&/g, "&amp;"));
    expect(markup).toContain("✓ ");
  });
});

describe("the dashboard's plan", () => {
  const today = "2026-11-02";
  const slots = data.slots.filter((s) => s.date >= "2026-11-01" && s.date <= "2026-11-12");
  const groups = data.groups;
  const draw = (serverToday = today, planned = ["2026-11"], list = slots) => html(h(DashboardPlan, { serverToday, groups, slots: list, activities: byId, plannedMonths: planned }));

  it("headlines today with the date, and lists today's sessions for every stage", () => {
    const markup = draw();
    expect(markup).toContain("Today: Monday, November 2");
    expect(count(markup, /<summary/g)).toBe(9);
  });

  it("lists the next seven days, starting with today", () => {
    const markup = draw();
    expect(markup).toContain("The week ahead");
    expect(markup).toContain("Today, November 2");
    expect(markup).toContain("Sunday, November 8");
    expect(markup).not.toContain("Monday, November 9");
  });

  it("shows three months, which are planned and which are not, with a way to plan each", () => {
    const markup = draw();
    expect(markup).toContain("November 2026");
    expect(markup).toContain("✓ Planned");
    expect(markup).toContain("Not planned yet");
    expect(markup).toContain('href="/calendar?month=2026-11"');
    expect(markup).toContain('href="/calendar/generate?month=2026-12"');
    expect(markup).toContain('href="/calendar/generate?month=2027-01"');
  });

  it("offers to plan the month when there is no calendar yet", () => {
    const markup = draw(today, [], []);
    expect(markup).toContain("There is no calendar for November 2026 yet.");
    expect(markup).toContain("Plan November 2026");
    expect(markup).toContain("Find an activity");
    expect(markup).toContain("No sessions are planned for the next seven days.");
  });

  it("says nothing is planned for today when the month is planned but today is empty", () => {
    const markup = draw("2026-11-20", ["2026-11"], slots);
    expect(markup).toContain("Nothing is planned for today.");
    expect(markup).toContain("Open November 2026");
  });

  it("crosses into the next month in the week ahead", () => {
    const december = data.slots.map((s) => ({ ...s, date: s.date.replace("2026-11", "2026-12") })).filter((s) => s.date <= "2026-12-03");
    const mixed = [...data.slots.filter((s) => s.date >= "2026-11-28"), ...december];
    const markup = draw("2026-11-29", ["2026-11", "2026-12"], mixed);
    expect(markup).toContain("Today: Sunday, November 29");
    expect(markup).toContain("Tuesday, December 1");
  });
});

describe("the generator", () => {
  const draw = (extra: object = {}) =>
    html(h(CalendarGenerator, { library, months: ["2026-11", "2026-12", "2027-01"], savedMonths: [], initialMonth: "2026-12", initialSeed: "abc12345", facilityName: "Maple Court", ...extra }));

  it("opens on the month asked for, with no theme, all three stages, three sessions a day", () => {
    const markup = draw();
    expect(markup).toContain('<option value="2026-12" selected="">December 2026</option>');
    expect(markup).toContain("No theme");
    expect(count(markup, /Early stage|Middle stage|Late stage/g)).toBeGreaterThanOrEqual(3);
    expect(markup).toContain("Three a day");
    expect(markup).toMatch(/279 sessions across 3 stages, using \d+ different activities\./);
  });

  it("sends the server the choices and the seed, never the calendar", () => {
    const markup = draw();
    for (const name of ["month", "theme", "perDay", "seed"]) expect(markup).toContain(`name="${name}"`);
    expect(count(markup, /name="stages"/g)).toBe(3);
    expect(markup).toContain('name="seed" value="abc12345"');
    expect(markup).not.toContain('name="generated_data"');
  });

  it("offers to save, and says the month already saved is replaced", () => {
    expect(draw()).toContain("Save the calendar for December 2026");
    const again = draw({ savedMonths: ["2026-12"] });
    expect(again).toContain("Replace the saved calendar for December 2026");
    expect(again).toContain("already saved. Saving this one replaces it.");
    expect(again).toContain("December 2026 (already saved)");
  });

  it("makes the same preview for the same choices, and a different one for a different seed", () => {
    const a = draw();
    expect(draw()).toBe(a);
    expect(draw({ initialSeed: "zzzzzzzz" })).not.toBe(a);
  });

  it("says when the library is empty", () => {
    expect(draw({ library: [] })).toContain("The activity library is empty, so there is nothing to plan from.");
  });
});

describe("no component prints template braces or anything that looks like a person", () => {
  it("draws no Liquid-like braces", () => {
    const pages = [
      html(h(LibraryBrowser, { items: library, initial: {} })),
      html(h(ReminiscenceBrowser, { prompts: library.map(toPrompt).filter((p): p is NonNullable<typeof p> => p !== null), initial: {} })),
      html(h(CalendarView, { month: "2026-11", data, activities: byId, mode: "saved" })),
    ];
    for (const page of pages) expect(page).not.toMatch(/\{\{|\{%/);
  });
});
