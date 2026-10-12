# UX baseline

What the app measured on 12 October 2026 with `npm run audit:ux` (`scripts/audit-ux.mjs`), before the touch-target and navigation changes, and what it measures after the 52 px change. Every later claim of improvement is compared with these numbers. Re-run the script, not your memory. Page weight, clicks and timing are unchanged by the 52 px and navigation work.

**Read these as relative, not absolute.** The timings come from a cloud sandbox with a headless Chromium, not from a facility PC. A slower machine will be slower. Use them to compare one build with another on the same machine.

## Page weight and load

| Page | Size | Load (sandbox) |
|---|---|---|
| `index.html` (packet tool) | 1,658 KB | 305 ms |
| `builder.html` (Packet Builder) | 1,119 KB | 204 ms |
| `profile.html` (resident profile) | 137 KB | 98 ms |

The two large pages carry their fonts and much of their code inline so they work offline from a folder. That is part of why they are large; the budget question is how they load on an older facility PC, which has not been measured.

## Clicks to a finished sheet

Counted by the script as it performs each workflow.

| Workflow | Clicks | Typed fields |
|---|---|---|
| A packet for one resident (name and birth year, Generate) | 1 | 2 |
| A coloring page as a PDF (choose the picture, Download PDF) | 2 | 0 |
| A book for a saved resident (resident, book, Print) | 3 | 0 |

"Three clicks" is true of the roster print flow and only of it. It is not true of every workflow, so public copy should say what it counts.

## Time to a finished sheet (sandbox)

| What | Time |
|---|---|
| Packet for one resident, Generate click to finished | about 270 to 310 ms |
| Coloring PDF, 6 pages, Tier 2 (drawing; the PDF library already loaded) | about 12 ms |
| Roster journal, Print click to the print window | about 90 ms |

The first PDF of a visit also loads the PDF library and the embedded font from the site, which this does not time.

## Navigation

How many choices (links, group headings and buttons in the sidebar) a person sees when a page opens, at laptop width. Measured with the same script before and after the six-hub change.

| Page | Before | After | Hubs after |
|---|---|---|---|
| index.html (packet tool, with its condition packets) | 13 | 14 | 6 |
| profile.html | 8 | 9 | 6 |
| Packet Builder, home | **21** | **14** | 6 |
| Packet Builder, coloring | **21** | **12** | 6 |
| Packet Builder, roster (Facility open) | **21** | **12** | 6 |
| Resource hub page | 19 | 18 | 6 |
| A resource module | 19 | 18 | 6 |
| Contact | 8 | 7 | 6 |

Reading it honestly: the Packet Builder, the page with the longest list, dropped by a third to a half (the Shift board added one link inside Facility, so its roster row reads 12, not 11). The static pages were already short, because the Resource & Clinical Hub started collapsed; they gain one link (the footer Contact) and lose a couple of hub-level links, so they are about the same. What changed everywhere is the shape: the same six hubs in the same order on every page, one open, instead of two different sidebars. Resource pages remain the longest (18) because the reader there wants the ten modules in front of them.

## Tap targets

Controls smaller than the minimum in either direction: buttons, links outside sentences, selects, inputs, summaries, and the labels of checkboxes and radios (a person hits the label). A link stretched over its card counts as the card. Measured on each page and in the states a person reaches by choosing something (a dialog, the packet drawer, a calendar, a lesson), at phone (390 px) and laptop (1366 px) width; the worse of the two is shown.

The standard was 44 px. The decision (see [blueprint-decisions.md](blueprint-decisions.md), D7) is 52 px. The first numbers in this file (taken before the method counted labels and states) understated the gap; these replace them.

| View | Controls | Under 44 px before | Under 52 px before | Under 52 px now |
|---|---|---|---|---|
| index.html | 122 | 0 | 38 | 0 |
| profile.html | 35 | 0 | 14 | 0 |
| Builder home | 44 | 1 | 20 | 0 |
| Builder coloring | 202 | 1 | 43 | 0 |
| Builder roster | 40 | 1 | 29 | 0 |
| Builder facility | 45 | 1 | 37 | 0 |
| Builder planner | 88 | 23 | 65 | 0 |
| Builder journal | 84 | 22 | 65 | 0 |
| Builder academy | 48 | 9 | 34 | 0 |
| Builder reminiscence | 47 | 1 | 39 | 0 |
| Builder digest | 32 | 1 | 24 | 0 |
| Builder session notes | 29 | 1 | 21 | 0 |
| Builder settings | 45 | 3 | 34 | 0 |
| Builder shift board (new; the Facility hub's Shift board) | 52 | n/a | n/a | 0 |
| Shift board with a note, a task and a name found in a note | 59 | n/a | n/a | 0 |
| The encrypted store's unlock prompt (a locked store; added to the audit with the Shift board) | 26 | 0 | 4 | 0 |
| Packet drawer with a page | 215 | 12 | 55 | 0 |
| Coloring packs tab | 107 | 64 | 98 | 0 |
| Facility wing with a calendar | 190 | 146 | 176 | 0 (see below) |
| Academy lesson | 60 | 26 | 47 | 0 (see below) |
| Planner with an example | 153 | 48 | 130 | 0 |
| Journal with an example | 102 | 28 | 83 | 0 |
| Instant Soothe, license form, roster with a resident, team and audit, records, digest tabs and the rest | | 0 to 8 | 20 to 50 | 0 |

How it was done: one token, `--tap: 52px`, in each tool; every component that had its own smaller height now uses it; and a `touch-floor` style at the end of each page gives any control that sets no size of its own the floor, at zero specificity so a component's own (never smaller) size wins. The generated sidebar takes the token on all 27 pages.

What is exempt, marked in the page with `data-tap-exempt` and a reason the audit prints:

- **The facility calendar's month grid** (146 of 190 controls above): a dense overview whose chips and "+" buttons cannot all be 52 px. The List layout beside it has every action at full size, and a device that is touch-only now starts in the list.
- **The lesson chapter bar** (a handful of segments sized by length): the seek slider reaches any point in the lesson.

The unlock prompt (the dialog shown when a passphrase is set and the store is locked) was found under 52 px only when the audit was taught to lock the store: its passphrase field, its keep-unlocked menu and its two buttons were 44 px, and are 52 px now.

Controls that were found under 44 px and are now fixed include the planner's and journal's "Try an example", "Start over" and "Add a ..." buttons (36 px), the checkboxes' labels (20 px tall), the Academy's "Edit" buttons and filter chips (36 px), the Settings passphrase fields (31 px), the Packet Builder's "Settings" link and "Facility view" switch (19 and 42 px), and the Instant Soothe close button (48 px).

## Contrast (WCAG AA)

| | Before | Now |
|---|---|---|
| Day, every view | 1 text element fails: the "150" count badge on the current sidebar item in the Packet Builder (4.29 : 1) | 0 |
| Night Shift, every Packet Builder view | 1 text element fails: "Your packet" (cream text on amber, 1.94 : 1, unreadable) | 0 |
| index.html and profile.html, day and night | 0 | 0 |

Both were real defects, found by measuring. The "Your packet" button now takes the same dark-amber background and light text as the other primary buttons in Night Shift (about 6.7 : 1).

## What a script cannot tell us

These are listed by `npm run audit:ux` for a person to judge, and have not been judged: consistency across pages, the tone of every resident-facing line, whether a screen is calm, how many badges feed alert fatigue, how mistakes are undone, how the type reads on a tablet, and where a real Activity Director hesitates. The last one matters most. Watching three or four of them use the three workflows beats any of these numbers.

## Budgets the script checks (`--strict`)

| Budget | Value |
|---|---|
| Controls under the minimum tap target (52 px) | 0 per view and state |
| Text below WCAG AA | 0 per view |
| Clicks: packet, coloring PDF, roster print | 1, 2, 3 |
| A response a person waits for | 400 ms (Doherty); a whole packet is judged against its own, longer, measured time |
