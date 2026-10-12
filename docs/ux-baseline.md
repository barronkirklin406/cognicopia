# UX baseline

What the app measures today, taken with `npm run audit:ux` (`scripts/audit-ux.mjs`) on 12 October 2026, before the touch-target and navigation changes. Every later claim of improvement is compared with these numbers. Re-run the script, not your memory.

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

| Sidebar | Links | Groups | Distinct destinations |
|---|---|---|---|
| Packet tool (`index.html`) | 16 | 1 | 16 |
| Packet Builder | 21 | none | 14 |

Every link is visible without opening a group. Sixteen to twenty-one choices at once is above what people hold comfortably (Miller, Hick), which is the argument for the six-hub navigation.

## Tap targets

Controls (buttons, links outside sentences, selects, inputs, summaries) smaller than the minimum in either direction, per page. The current standard is 44 px; 52 px is the target for tablets and unsteady hands.

| View | Phone 390: under 44 px | Phone: under 52 px | Laptop 1366: under 44 px | Laptop: under 52 px |
|---|---|---|---|---|
| index.html | 1 of 98 | 39 | 1 of 97 | 39 |
| profile.html | 0 of 24 | 13 | 0 of 29 | 14 |
| Builder home | 0 of 44 | 20 | 2 of 45 | 20 |
| Builder coloring | 0 of 190 | 32 | 2 of 191 | 31 |
| Builder roster | 0 of 35 | 27 | 2 of 36 | 27 |
| Builder facility | 0 of 45 | 37 | 2 of 46 | 37 |
| Builder planner | 10 of 61 | 41 | 12 of 62 | 43 |
| Builder journal | 9 of 60 | 45 | 11 of 61 | 46 |
| Builder academy | 7 of 41 | 33 | 9 of 42 | 32 |

What is under 44 px today:

- the e-mail address link on the packet tool (17 px tall);
- the "Settings" link in the Packet Builder's top-bar message (19 px) and the "Facility view" switch (42 px);
- the planner and journal's "Try an example" and "Start over" buttons (36 px);
- the Academy's small "Edit" buttons (36 px) and card links (42 px).

What is between 44 and 52 px, so it is at the standard today and below the target: the whole sidebar (every link is 44 px tall), the top-bar buttons, form fields and most buttons. Raising the minimum to 52 px is mostly a sidebar, button and field height change, not a redesign, but the dense Packet Builder views need their layouts checked.

## Contrast (WCAG AA)

| View | Day | Night Shift |
|---|---|---|
| index.html | 0 of 393 text elements fail | 0 of 393 |
| profile.html | 0 of 92 | 0 of 92 |
| Builder home | 0 of 124 | **1 of 124**: "Your packet" |
| Builder coloring | **1 of 538**: the "150" count badge (4.29 : 1) | **1 of 538**: "Your packet" |
| Builder roster | 0 of 94 | **1 of 94**: "Your packet" |

In Night Shift the builder's "Your packet" button shows cream text on amber at 1.94 : 1, which is unreadable. That is a real defect, found by measuring.

## What a script cannot tell us

These are listed by `npm run audit:ux` for a person to judge, and have not been judged: consistency across pages, the tone of every resident-facing line, whether a screen is calm, how many badges feed alert fatigue, how mistakes are undone, how the type reads on a tablet, and where a real Activity Director hesitates. The last one matters most. Watching three or four of them use the three workflows beats any of these numbers.

## Budgets the script checks (`--strict`)

| Budget | Value |
|---|---|
| Controls under the minimum tap target | 0 per view |
| Text below WCAG AA | 0 per view |
| Clicks: packet, coloring PDF, roster print | 1, 2, 3 |
| A response a person waits for | 400 ms (Doherty); a whole packet is judged against its own, longer, measured time |
