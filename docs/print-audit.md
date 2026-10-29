# The print audit

`npm run audit:print` (`scripts/audit-print.mjs`, also a step of `npm run build`) prints every printable thing in a real browser to a real PDF and reads the PDF back with PyMuPDF. It needs Playwright and PyMuPDF; where either is missing it says so and the build skips it.

## What it prints

| Set | What | How |
|---|---|---|
| `pages` | every static page (prices, guides, research, the resident profile...) as Ctrl+P prints it | the page, in print media |
| `builder` | every activity the Packet Builder makes, at every level it is made for (41 activities, three levels) | the activities' own sheets in `#printRoot`, 12 to a PDF |
| `packet` | the front page's Quick-Print packet at the early, middle and late stages | the page's own Generate and Print buttons |

## What it checks

- **Breaks.** One sheet makes one page (a sheet that spills makes a second page); no heading stranded at the foot of a page; a table or card is not cut at the page edge.
- **Ink.** Every word, line and fill in the PDF is black or white; no picture or fill behind the words; no stroke under 2 pt on an activity sheet.
- **Margins.** On a page the audit does not allow to run edge to edge: nothing inside 0.5 in of an edge, and 1.25 in (0.5 in plus the 0.75 in binding gutter) on the left of a web page. The non-medical line sits in the top margin of an activity sheet by design.
- **Bleed.** No menu, button (any element with "btn" in its class), field, banner, dialog or fixed bar on the layout in print, and none of their words in the PDF.

Two findings are accepted and listed under `ACCEPTED` in the script: the gray of a native checkbox the browser draws on the front page, and the anti-aliased edge of the logo image on the license desk page.

## What it found on October 22, 2026 (all fixed)

1. **The Packet Builder's browser print was shifted and cut off.** `css/styles.css` gave every page a `@page` margin of 1.25 in on the left; the Packet Builder's own `@page{margin:0}` comes earlier in its source than the stylesheet's link, so it lost. Its full-page sheets were printed 1.25 in to the right and 0.5 in down, so the foot of every sheet (page number, tip) ran off the paper. The shared margins now belong to a **named page** (`cg-doc`) that only a document with no print root of its own is given, and `scripts/check-design-system.mjs` fails if the stylesheet ever sets a margin on the unnamed page again.
2. **A dark canvas behind the paper.** The Packet Builder's screen theme is dark (`color-scheme: dark`); with "background graphics" on, a printer or PDF kept a dark page behind the sheets. Print now forces a light scheme.
3. **Thin rules.** The front page's packet printed its cover frame and word-list check boxes at 1.5 pt: the browser rounds a border of 2 pt (2.67 px) down to 2 px. Borders there are now whole pixels (4 px, 3 pt; the cover's double frame 12 px, two 3 pt lines).
4. **Web chrome on paper.** Links styled as buttons ("Request Corporate Invoice", "Contact Cognicopia", "Launch Generator Tool"), the resident profile's sticky Back/Next bar and the FAQ mail button printed. The shared print sheet now hides any element whose class contains `btn`, `.rap-nav` and `.fq-mail`.
5. **Color on paper.** Sample illustrations (`svg[role="img"]`) printed in green; list numbers and small icons printed green. Illustrations are left off the page; markers and icon strokes print black.
6. **Cut-off tables and split cards.** The comparison tables on the resource pages sat in a sideways-scrolling box and lost their right-hand columns on paper; feature cards were split across pages. Tables are fitted to the page and the card classes are kept whole.
