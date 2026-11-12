---
name: cognicopia-print-engine
description: "Use whenever touching PDF generation, pagination, or printable templates in Cognicopia: pure black on white, what may print on a resident page, the Staff Companion Sheet, page economy (no near-empty or '(continued)' pages), and how to measure it."
---

# Cognicopia print engine: PDF quality and page economy

The printed page is the product and its strongest asset: pure black on white, large type, bold lines, 0.5 in margins. The playbook found two ways the packet still lets a director down: **staff clutter on the resident's page** and **paper wasted on near-empty pages** (in an early-stage packet, 9 of 33 pages were "(continued)" pages and 7 had an empty band over 40% of the page; fixing that alone saves about a fifth of the paper).

## The standards that do not change

- Pure black (`#000`) on pure white (`#fff`): no gray, no shading, no color, no gradient, in any packet, coloring page, calendar or PDF. (The warm screen palette is not for print.)
- US Letter, **0.5 in margins and a 0.75 in binding gutter**; lines at least the stage's floor (3 pt at the middle stage: `src/engine/ClinicalMatrix.js` holds the stage numbers); type never under the stage's floor (resident text 18 to 32 pt); pictures 3:4 with closed outlines. Numbers and reasons: `docs/cognicopia-coloring-standards.md`.
- Print in the embedded Atkinson Hyperlegible, never a fallback. Make the PDF on the computer; nothing is "exported" and nothing leaves it.

## No clutter on resident pages

- **A resident page carries the resident's content only:** their name, the title, the instruction, the activity. Never print on it a clinical tag (`[Therapy: Spontaneous Recall | GDS 6-7]`), a 12 pt staff tip, an 8 pt footer, an answer key, a framework label or a coaching line.
- **All of that goes on one dedicated Staff Companion Sheet at the front of the packet** (the Packet Builder already keeps such words on its companion; make the packet tool do the same). It holds, in one place: the run order, the stage and the therapy approach per page, one short tip per page, answer keys for closed-answer pages, the "ask the family" note when data is thin, and a "report a problem with this page" line.
- **Refer to pages by their title, never by a hardcoded number** ("hesitates on Word Search", not "Page 3"): a bundle shifts page numbers, and a tip that points at the wrong page is a defect. Page numbers appear only in the foot as "Page X of Y", computed from the real layout.
- Where it lives today: the packet tool's shell (`shellPass()` and the page makers in `index.html`), the activity engine's shell (`withShell()` in `src/engine/ClinicalActivities.js`) and the Packet Builder's print root (`#printRoot.res-clean` hides staff lines on resident pages). Move staff text off the resident page in all three, not in one.
- Staff text that must stay on a page for a good reason is at least 16 pt, because staff are often older readers too.

## Zero near-empty overflow pages

- **Never emit a "(continued)" overflow page, and never a page less than 60% full** (an empty band over 40% of the printable page). Target: **0 pages per packet under 60%**; `0 per packet` is the number to measure and report.
- Get there by composition, not by shrinking type below the stage's floor:
  1. **Measure before you place.** Lay each activity's height out first (`D.measure()`, `D.room()`, `need()` in the packet tool), then decide the page; never discover overflow after drawing.
  2. **Compact spacing** between blocks, within the stage's rules (never the type floor, never a line under the stage's minimum, never a margin).
  3. **Pair a companion activity** into the space: a word search leaves its lower third blank, so put a short companion item (a "Talk about" prompt, a matching pair, a quote to finish) beneath the grid.
  4. **Merge** a short activity with another short one on one page, or move it into the staff sheet if it is staff-only.
  5. As a last resort drop an optional item; never print a mostly blank sheet.
- Late-stage packets are one item per page by design (`cognicopia-clinical-dignity`). A page with one large item at that stage is full by its big type, not empty: measure it on its own terms, do not pad it.
- Two-sided and booklet advice is based on the real page count, and the packet form's "about N pages" estimate is counted from the real layout (the playbook found "about 30" made 33).

## How to measure it (do this, not by eye)

1. Make a packet in a real browser (Playwright) at the early, middle and late stage, with a full profile and with a census-only profile; make a multi-resident bundle too.
2. Read each PDF back with PyMuPDF. For every resident page, take the lowest content block's bottom edge (text, line or drawing) and the printable band (from the header rule to the foot rule); the page is **utilization = used height / band height**. Count pages under 0.60, and any page whose text contains "(continued)".
3. Check the same read-back for: only black text and strokes, margins at least 0.5 in, no text under the floor on a resident page, no `[Therapy:` and no staff-tip text on a resident page, and a Staff Companion Sheet as page 1.
4. Add the counts to `scripts/audit-print.mjs` or the check beside it so `npm run build` fails when a page falls under 60% or a "(continued)" page appears. Never loosen the threshold to pass.

## Verify

`npm run audit:print` (every page, every Packet Builder activity at every level, and the front-page packet, printed to PDF and read back) must stay clean, and `npm run build` must pass. Look at the pages as images too: a count cannot tell you a page is ugly.
