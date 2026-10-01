# Clinical Science & Research Center

The Research Center is Cognicopia's evidence library for medical directors, compliance officers, activity directors and boards. Each document states:
- what an approach has been shown to do, in whom, and how strongly;
- what it has not been shown to do.

Every figure is cited, and every document ends with its limits. The **For facility boards** section makes a board packet as a PDF in one click.

It lives at `resources/research/` and opens from:
- the sidebar on every site page (**Resource & Clinical Hub › Clinical & Quality › Clinical Science & Research Center**);
- the first card on the Resource & Clinical Hub page;
- the Packet Builder's sidebar (**Learn › Research Center**);
- links from the Zentangle art page, the resource catalog and the journals page, next to the claims those summaries cover.

| File | What it is |
|---|---|
| `src/services/researchCenter.ts` (built to `assets/services/researchCenter.js`, global `CogniResearch`) | The content and the board packet: the documents, the references, the evidence scale, the content checks, the value worksheet, and the packet's page layout |
| `scripts/research-pages.mjs` (`npm run research`) | Writes the static pages from the content, with the site's sidebar and breadcrumbs from `scripts/site-nav.mjs`. `--check` fails when a page is out of date, and `npm run build` runs it. |
| `assets/research-center.js` | What the pages do in the browser: reading settings, focus mode, collapsible sections, citation previews, copying, the library's filters and the board packet |
| `resources/research/index.html`, `resources/research/<slug>/index.html` | The generated library and one page per document. Never edit these by hand: change the content and run `npm run research`. |

Nothing on these pages contacts another site. The board packet loads only the site's own files: the content, the PDF library and its font.

## The library

Ten documents, every one checked against its sources on September 30, 2026:

| Document | Type | Evidence | Read | Sources |
|---|---|---|---|---|
| Pattern Drawing and the Brain: What EEG Studies of Zentangle Show | Research summary | Emerging | 8 min | 15 |
| Cognitive Stimulation Therapy: The Best-Supported Group Activity in Dementia Care | Research summary | Strong | 4 min | 4 |
| Reminiscence Work in Dementia Care: What the Evidence Shows | Research summary | Moderate | 3 min | 1 |
| Music-Based Activities in Dementia Care: Mood, Behavior and Connection | Research summary | Moderate | 3 min | 1 |
| Print for Macular Degeneration and Low Vision: The Evidence Behind Cognicopia's Print Standard | Whitepaper | Published standard | 5 min | 9 |
| Seeing Clearly in Dementia: Contrast, Clutter and Visual Perception | Whitepaper | Emerging | 3 min | 2 |
| Dignity-First Activity Design: Adult Materials and Respectful Communication | Whitepaper | Moderate | 3 min | 5 |
| Case Scenario: Structuring the Late Afternoon in a Memory Care Neighborhood | Case scenario | Illustrative | 3 min | 4 |
| Case Scenario: Adapting Activities for a Resident Living With Macular Degeneration | Case scenario | Illustrative | 3 min | 5 |
| Regulatory Crosswalk: CMS Requirements for Activities, Dementia Care and Staff Training | Regulatory brief | Federal regulation | 4 min | 7 |

The library page has:
- filters for **type**, **topic** and **evidence** strength, and a **search** over titles, summaries, types, ratings and topics. A count says how many documents show, and **Show everything** clears the filters.
- the board packet section;
- the evidence scale;
- how the summaries are written.

Without JavaScript every card shows and the filters stay hidden.

### The evidence scale

Each document carries one rating: the strength of the research it summarizes. A rating never describes Cognicopia's products, which have not been tested in clinical trials of their own.

| Rating | Means |
|---|---|
| Strong evidence | Systematic reviews of randomized trials agree, or a national clinical guideline recommends it. |
| Moderate evidence | Randomized trials or systematic reviews point the same way, but effects are small or findings vary. |
| Emerging evidence | Small trials, pilot or single-group studies. Promising, not settled. |
| Published standard | Published accessibility and design standards and the research behind them, not trials of outcomes. |
| Federal regulation | The text of federal requirements and the surveyor guidance that interprets them. |
| Illustrative scenario | A composite example of applying the evidence. Not a real facility, and no outcome data. |

## A document page

From top to bottom:
1. **Header:** type and rating, title, subtitle, reading time, number of sources, review date, and who it is written for.
2. **Toolbar:** reading settings, focus mode, expand or collapse all, print, and cite this page.
3. **Illustrative scenario** notice (case scenarios only): the scenario is a composite, describes no real facility or resident, and reports no outcomes.
4. **Key takeaways:** three to six points, each cited.
5. **At a glance:** data citation blocks, each a figure with its label and its source.
6. **In this document:** the contents, with each section's reading time.
7. **Sections:** each has a heading, an "In brief" line that stays visible when the section is closed, and its body. Bodies can hold:
   - paragraphs and lists;
   - **Study at a glance** boxes: design, participants, what was measured, what was found, caveats;
   - tables with captions and row and column headers;
   - notes.
8. **What this means for your community:** practice points.
9. **What this evidence does not show:** the limits, on every document.
10. **References** in AMA style, numbered in order of first citation, with a link to each source (DOI or publisher).
11. **How to cite this page,** with a copy button. The citation fills in today's date as the accessed date.
12. **Related reading,** and a link back to the library.

### Collapsible sections

The sections follow the WAI-ARIA accordion pattern:
- Each heading stays an `h2`, with a button inside it that has `aria-expanded` and `aria-controls`.
- The first section opens. The others close with `hidden="until-found"`, so the browser's find-in-page still finds closed text and opens its section (the `beforematch` event).
- A link to a section, or to anything inside one, opens it. That includes a contents link, a link from another page, and an address with `#s-<section>`.
- **Expand all sections** opens everything, then becomes **Collapse all sections**.
- Printing opens every section, then puts them back as they were. The print styles show closed sections even when a browser prints without the print event.
- Without JavaScript every section is open.

### Citations

A citation is a superscript number that links to its reference. Its accessible name reads "Reference 3: Owsley et al., 2007". Hovering over it or focusing it with the keyboard shows the full reference in a tooltip (`role="tooltip"`, tied to the link with `aria-describedby`). Escape, moving away or scrolling hides it.

### Reading settings and focus mode

| Setting | Choices | Effect |
|---|---|---|
| Text size | Standard (19 px), Large (21 px), Largest (24 px) | All reading text scales together |
| Line spacing | Comfortable (1.65), Wide (1.9) | Line height of reading text |
| Colors | Paper, Dark, Maximum contrast | Every text color, border and chip |

The settings are kept in this browser (`cg_rc_reader`) for every Research Center page. They apply before the page draws, so it never flashes the wrong colors. **Reset** returns to the defaults.

**Focus mode** hides the sidebar, top bar, breadcrumbs and footer, and leaves the document alone in a narrower column. Escape or **Leave focus mode** turns it off and returns focus to the button.

### Typography and contrast

The reading surfaces are tuned for reviewing clinical material. These figures were measured in Chromium:

| | Value |
|---|---|
| Typeface | Atkinson Hyperlegible, served from the site's `fonts/` folder |
| Reading text | 19 px, line height 1.65 |
| Line length | 33em: full lines of about 72 characters, never more than 80 (WCAG 1.4.8) |
| Smallest text | 14 px (chips and tags) |
| Text contrast, Paper | at least 7.85:1; body text 16:1 |
| Text contrast, Dark | at least 8.28:1; body text 15.7:1 |
| Text contrast, Maximum contrast | at least 10.97:1; black on white 21:1 |

Every text color in all three settings meets WCAG AAA (7:1). The evidence chips are white on dark fills, from 8.6:1 to 10.9:1. In maximum contrast they become black text on white with a black border.

Other details:
- Every control is at least 44 px tall.
- Focus outlines are 3 px and use their own color in each setting.
- Tables scroll inside their own region, so a narrow screen never scrolls sideways.
- On phones the toolbar sits in two columns.

## The board packet

**Download the board packet (PDF)** makes an eight-page letter-size packet on this computer. A director can take it to the administrative board. **Personalize the packet** is optional and adds:
- the community's name;
- who prepared the packet, and their role;
- the meeting date;
- the facility's own figures.

| Section | Contents |
|---|---|
| Cover | Community, preparer, meeting date, contents, and a note that every figure is cited and Cognicopia is the vendor |
| 1. The decision in brief | The ask and its cost; why now (how many residents live with dementia, the federal requirements, how often cognitive stimulation works best); what Cognicopia provides; privacy and risk. It says the tool supports the facility's privacy practices but does not by itself make a facility HIPAA compliant. |
| 2. The evidence at a glance | Six approaches, each with what the research shows, its rating and its sources, and what the evidence does not show |
| 3. Regulatory alignment | F550, F583, F656, F679, F744 and F947: what each asks and where Cognicopia can help deliver or document it. A note says F680, a qualified activity professional, is a staffing requirement no tool can meet. |
| 4. The value worksheet | Cost, cost per resident per month, staff hours returned and their value, and value less the annual cost |
| 5. Implementation and measurement | A 90-day plan, and what to measure before and after |
| 6. Questions boards ask | Short answers: whether resident information is sent over the internet (no), whether this is a medical treatment (no), whether it replaces activity staff (no), whether Academy certificates are continuing education credit, cost and stopping, and how the board will know it is working |
| 7. Disclosure and references | The vendor's disclosure, then every reference |

**The worksheet.** The license price is the only figure that comes from Cognicopia: $129.99 a year per building. The tests check it against `PRICE` in `index.html`. Every other figure is the facility's own, typed in or written by hand:

| Line | Calculation |
|---|---|
| Annual cost | $129.99 × buildings |
| Cost per resident per month | annual cost ÷ residents ÷ 12 |
| Hours returned each year | (hours a week now − hours a week with Cognicopia) × 52, never below zero |
| Value of those hours | hours returned × hourly staff cost with benefits |
| Value less the annual cost | value − annual cost |

A field left blank prints as a line to fill in, and the packet never estimates a figure for the facility. The worksheet's note says that returned hours are savings only if the facility chooses to use them that way.

**What a person types** is kept in this browser (`cg_rc_board`) so the next packet starts filled in. It holds the community, the preparer and their role, the date and the numbers, and nothing about a resident. **Clear these details** removes it, for a shared computer.

**The file** is `Cognicopia board packet - <community>.pdf`, with characters that file systems refuse removed. The PDF:
- embeds Atkinson Hyperlegible;
- has the title, subject, author and creator set;
- has no footer on the cover. Every other page has a footer and "Page n of N".

A long community name is shortened with "…" in the footer and printed in full on the cover.

**Layout.** `boardBlocks(input)` writes the packet as blocks: headings, paragraphs, lists, fields, tables, callouts and references. `boardLayout()` places them on pages with the page's own line breaker, `jsPDF.splitTextToSize`, so lines break with the real font's widths. `draw()` paints a page with jsPDF. Rules:
- a heading keeps with what follows;
- a table repeats its header row on a new page;
- a row never splits.

## Changing the content

Everything is in `src/services/researchCenter.ts`:
- **References:** `REFS`. Each has an `id`, authors, year, title, source, and volume, issue, pages, DOI or URL where they exist. `formatRef` prints AMA style: up to six authors, otherwise three and "et al". `shortRef` gives the short form ("Owsley et al., 2007").
- **Documents:** `DOCS`. Each has:
  - a slug, type, rating, title, breadcrumb label, subtitle and summary;
  - its audiences and topics;
  - takeaways, figures and sections;
  - practice points, limits and related documents.

  A section's body is a list of blocks: `p`, `list`, `steps`, `study`, `figure`, `table` or `note`.
- **Markup** inside any text:
  - `[@key]` or `[@key; @key2]` cites references;
  - `[[slug]]` or `[[slug|words]]` links to another document.

After a change:
1. `node scripts/build-services.mjs` rebuilds the service, then `npx tsc -p tsconfig.json` type-checks it.
2. `npm run research` writes the pages.
3. `npm run build` runs every check.

`problems()` lists content errors, and the page generator refuses to write while there are any. It catches:
- an unknown reference or document link;
- a reference no page cites;
- a missing takeaway, practice point, limit or section;
- a case scenario not labeled illustrative;
- a rated document that cites nothing;
- a figure without a source;
- duplicate slugs, reference IDs or section IDs.

When every summary has been re-checked against its sources, update `REVIEWED`. The pages, the citations and the packet's footer all show it.

### Writing rules the tests enforce

- A case scenario says it is a composite with no outcome data, and is rated "Illustrative scenario".
- No "clinically proven", "guaranteed", "miracle", "breakthrough" or "cure".
- "Proven" appears only in a negation ("not proven").
- "Rewires the brain" appears only in quotation marks, as an example of what not to say.
- Every figure has a source.
- Every document lists its limits.
- The EEG summary says the EEG studies recorded adults without dementia. The 2024 study recorded 30 healthy young men with no comparison activity. No EEG study has included people living with dementia.

## Tests

`scripts/check-services.mjs` (group `researchCenter`) checks:
- **Content:** `problems()` is empty. Every type and rating is used.
- **The two requested subjects:** the EEG summary cites both EEG studies. The low-vision whitepaper cites WCAG, APH, Rubin & Legge and Owsley.
- **Honesty rules:** as listed above.
- **Citation format:** AMA format, et al, short forms, DOI and URL shapes, and numbering in order of first citation.
- **The worksheet:** its arithmetic, a blank worksheet that invents nothing, a clamped negative, cleaned input, and the file name.
- **The packet laid out at three font-width scales, blank and with very long input,** checking:
  - 7 to 12 pages;
  - only characters the embedded font draws;
  - text inside the margins and no text overlapping other text, at honest widths;
  - no page ending with a heading;
  - page numbers;
  - the footer fitted beside the page number;
  - the price and the disclosure printed.
- **The generated pages:** unique IDs, one `h1`, every in-page link and ARIA reference has a target, `rel="noopener"` on new-tab links, and every reference and section present.

`npm run build` checks that the pages are current, that `assets/research-center.js` parses, and that every relative link on every page resolves.

These were checked in Chromium for this release:
- **Library:** the filters and the empty state; the one-click and personalized downloads (8 pages, Atkinson embedded, inside the margins, no overlaps); details kept and cleared.
- **Document pages:** the accordion with mouse and keyboard; `beforematch`, hash links and printing; tooltips; focus mode; copying; reading settings carried across pages.
- **Every width from 320 to 1920 px** at standard and largest text: no sideways scrolling.
- **Contrast in all three color settings,** across about 940 text elements.
- **No console errors** and no request to another site.

## Limits

- The Research Center summarizes published research. It does not search the literature live, and it is not a systematic review.
- It is educational material for professionals, not medical advice, and not an accredited course.
- Regulations change. The crosswalk cites the eCFR text and CMS surveyor guidance as accessed on September 30, 2026.
- Ratings describe the research. Cognicopia's own products have not been studied in clinical trials, and the pages and the packet say so.
