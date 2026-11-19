# UX baseline

What `npm run audit:ux` (`scripts/audit-ux.mjs`) measured on **19 November 2026**, on the branch that holds the five-prompt fix list. It replaces the baseline of 12 October 2026, which measured contrast at WCAG AA and had not been run since. The audit now holds text to **AAA (7:1; 4.5:1 for text of 24 px or bold 18.66 px and up)**, the standard in `CLAUDE.md` and `cognicopia-visual-style`. Every later claim about speed, clicks or contrast should be compared with these numbers.

**Read these as relative, not absolute.** The timings come from a cloud sandbox with a headless Chromium, not from a facility PC. A slower machine will be slower. Use them to compare one build with another, not to promise a time.

The earlier baseline is kept in git history (the version of this file before 19 November 2026).

## Page weight and load

| Page | Size | Load (sandbox) |
|---|---|---|
| `index.html` (packet tool) | 2,282 KB | 401 ms |
| `builder.html` (Packet Builder) | 1,426 KB | 287 ms |
| `profile.html` (resident profile) | 196 KB | 131 ms |

Both large pages carry their fonts and much of their code inline so they work offline from a folder. There is no byte budget in the build; this table is the only record of weight.

## Tap targets (minimum 52 px, both directions)

**0 controls under 52 px in every one of the 60 or so pages and states measured**, on a 390 px phone and a 1366 px laptop: every page, the Packet Builder's thirteen screens, the Studio, Daily engagement, Tablet Activities (Resident Mode and the crossword keyboard included), Start here, the pinned-tools picker, the search window, the license window, the upgrade screens and the packet drawer. The audit's state "index: license form" was removed: it clicked a button (`#hdrlicToggle`) that the one-chip change of 12 November took off the page, so it had been reporting "could not be reached" since.

## Contrast (AAA)

**19 of the audited screens have text under AAA** (7:1, or 4.5:1 for large or bold text). These are real failures, found for the first time by measuring at AAA. They are listed so the "Warm Editorial Clinical" restyle (prompt 5a) fixes each one and the audit proves it.

| Screen | Theme | Text elements below 7:1 | Worst case |
|---|---|---|---|
| `index.html` | day | 2 of 299 | 5.45:1, the "Make the packet" button |
| `index.html` | night | 5 of 299 | 6.95:1, the hero "Get Started Free" link |
| Packet Builder, roster | day | 5 of 83 | 5.93:1, a count badge |
| Packet Builder, shift board | day | 3 | |
| Packet Builder, facility | night | 13 of 126 | 6.95:1 |
| Packet Builder, home, coloring, roster, planner, journal, academy, reminiscence, digest, session notes, shift board, settings | night | 1 each (2 on the roster) | 6.95:1, the "Your packet" label |
| Contact, pilot, referral | night | 2 each | 6.70:1, the envelope glyph |

Every other measured screen, by day and in Night Shift, reaches AAA. `scripts/check-design-system.mjs` separately measures the shared stylesheet's text pairs (worst pair 7.1:1).

## Clicks to a finished sheet

Counted by the script as it performs each workflow.

| Workflow | Clicks | Typed fields | Budget |
|---|---|---|---|
| A packet for one resident (name and birth year, Generate) | 1 | 2 | 1 |
| A coloring page as a PDF (choose the picture, Download PDF) | 2 | 0 | 2 |
| A book for a saved resident (resident, book, Print) | 3 | 0 | 3 |

"Three clicks" is true of the roster print flow and only of it. Public copy should say what it counts.

## Time to a finished sheet (sandbox)

| What | Time |
|---|---|
| Packet for one resident, Generate click to finished PDF | about 3,200 ms |
| Coloring PDF, 6 pages, Tier 2 (drawing; the PDF library already loaded) | about 12 ms |
| Roster journal, Print click to the print window | about 420 ms |

The October baseline measured the packet at about 300 ms because it timed only the first screen; the 3,200 ms is the whole PDF with its staff sheet, built in steps with the cover shown first. The first PDF of a visit also loads the PDF library and the embedded font from the site, which this does not time. A goal such as "under 400 ms" is a claim only for a response a person waits at a button for, not for making a whole packet.

## Navigation (the sidebar as a page opens)

| Page | Hubs | Choices visible at once |
|---|---|---|
| `index.html`, `profile.html`, contact, resource pages | 4 | 6 |
| Packet Builder, home and coloring | 4 | 20 (one group open) |
| Packet Builder, roster | 4 | 10 |

Nothing in the sidebar is under 52 px or below AA.

## What a person must judge

A script cannot decide these. Watch an Activity Director do the three workflows above and write down where they hesitate; read the largest and smallest text on a printed sheet and on a tablet; check that every resident-facing line is dignified and free of quizzing.
