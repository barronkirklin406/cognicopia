---
name: audit-ux
description: Measure Cognicopia's UX in a real browser (tap targets, contrast, click counts, navigation size, print-generation time, page weight) and list what a person must judge. Use before and after any change to layout, navigation, controls, colors or print flow, and before putting a number such as "three clicks" or "under 400 ms" in public copy.
---

# audit-ux

A claim about usability is only true once it has been measured on the real app. This skill runs a script that measures what can be measured and lists what cannot.

## Run it

```
npm run audit:ux                              # everything, as a table
npm run audit:ux -- --only targets,nav        # some measurements: targets, contrast, nav, clicks, print, weight
npm run audit:ux -- --min-target 52           # tap-target minimum in CSS px (default 44)
npm run audit:ux -- --json audit.json         # also write the numbers
npm run audit:ux -- --strict                  # exit 1 if a budget is broken
```

It serves the repository on a local port and drives Chromium with Playwright (found in `node_modules` or `/opt/node22/lib/node_modules`; never run `playwright install`). It makes no other network request. It takes about a minute. It is not part of `npm test` because timings vary by machine.

## What to do with the result

1. **Baseline first.** Run it before you change anything and keep the output. Compare with `docs/ux-baseline.md`.
2. **Change, then run it again** and report the difference in numbers: controls under the minimum, text below WCAG AA, clicks per workflow, milliseconds.
3. **Report honestly.** A budget that is broken stays broken in your report. Timings are from this machine, not a facility PC; say so.
4. **Do not answer the subjective items from reading code.** The checklist printed at the end (consistency, tone, calm, progress cues, error recovery, reading, real use) needs a person looking at the screens or watching a user. List it for them; do not tick it.
5. **Never put a measured goal in public copy until it is measured.** "Three clicks" is true of the roster print flow because the script counts it.

## What it measures

| Measurement | How |
|---|---|
| Tap targets | Visible buttons, links (not links inside a sentence), selects, inputs, summaries: width or height under the minimum, at 390 px and 1366 px wide, on the three tools and the main Packet Builder views |
| Contrast | Every visible text node against the background behind it, WCAG AA (4.5, or 3 for large text), by day and in Night Shift |
| Navigation | Sidebar links, group headings and distinct destinations, on the packet tool and the Packet Builder |
| Clicks | The packet, coloring-PDF and roster-print workflows, counted as the script performs them |
| Print time | Click to a finished packet; drawing a 6-page coloring PDF; roster Print click to the print window |
| Weight | Page size in KB and load time |

## Fixing what it finds

Fix one kind of finding at a time, re-run the same measurement, and run `npm run build` before you push. When a minimum changes (for example 44 to 52 px), update `scripts/audit-ux.mjs`'s default, the CSS comment that states the minimum, and `docs/ux-baseline.md` together.
