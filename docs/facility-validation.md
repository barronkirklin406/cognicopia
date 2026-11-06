# Facility validation and the offline print bundle

Two small utilities that sit under the Activity Page Studio (`activity-studio.html`). Both run in the browser, make no network request and keep no resident data. Written for the owner and for a facility's IT contact.

| File | Job |
|---|---|
| `js/utils/facility-validator.js` | Scores every batch of pages from 0 to 100 (the Clinical Readiness Score) and says what lowered it. |
| `js/utils/print-optimizer.js` | One print style sheet that leaves only the sheets on the paper, and a list and cache of every file the studio needs, so it runs in a wing with no internet. |

## The Clinical Readiness Score

Five parts, weighted (the weights add to 100):

| Part | Weight | What it measures |
|---|---|---|
| Contrast and legibility | 20 | Every color that draws anything is checked against white paper (black is 21:1, the floor is 7:1). No text under its stage's size floor (18, 20 and 24 pt). |
| Stroke weight | 25 | No line under 3 pt (6 px on the 1200 by 1600 page). A coloring page's main outline carries the stage's weight: 3, 4.5 and 6 pt, plus the hand setting. |
| Negative space | 20 | How much of the page is left empty, on a 60 by 80 grid. Text sheets need 50 percent (55 at stage 3); coloring pages 60 percent (70 at stage 3). |
| Variety | 15 | A batch is more than one kind of page (two kinds from two pages, three from four), and no page repeats. |
| Framework alignment | 20 | Five practical checks, below. |

A score of 90 or more with nothing noted reads **Ready**; 75 to 89 reads **Ready with notes**; under 75 reads **Review before printing**. Every batch writes one block to the browser console (open the developer tools to see it) and shows the score under the preview, opening to its parts and the sources.

The negative-space measure counts a line of text as a full box, so it never claims more empty space than a page really has (the browser check compares it with real pixels). The empty-space limits are this module's own design limits, set a little under what the current library and sheets measure; they are in `LIMITS` at the top of the file, in one place, and are not published standards.

## The framework checks and where they come from

These are practical self-checks that **support** a facility's own program. They are not a clinical certification and not a statement that anything meets a regulation.

| Check | What is tested | Where the idea comes from |
|---|---|---|
| Interest | The batch holds a reminiscence page tied to the years chosen, or uses the resident's own interests. | CMS F679 (42 CFR 483.24(c)) asks for activities based on each resident's interests, needs and preferences. Summaries: [AAPACN on F679](https://learner.aapacn.org/AssetListing/F-Tag-Library-On-Demand-Series-4217/F679-Activities-Meet-Interest-Needs-of-Each-Resident-11428), [University of Iowa dementia training](https://igec.uiowa.edu/node/1071). |
| Stage fit | Daily-living steps: six or more at stage 1 (the whole task), five or fewer at stage 2, three or four at stage 3. | Montessori-based dementia programming by Cameron Camp (whole task early, single steps in the middle); stage-based occupational therapy guidance. See [Dementia Australia](https://www.dementia.org.au/about-dementia/dementia-expert-webinars/webinar-montessori-approach-activities-and-dementia) and [the Virginia Tech study](https://vtechworks.lib.vt.edu/items/d1ffaea4-e4b2-4139-8fd0-da040f9c17e4). |
| Errorless | No quiz or test words; no matching or sorting at stage 3. | Montessori-based, failure-free practice; a 2017 study of occupational therapist prescriptions found severe dementia most often matched with sensory, simple physical and sorting activities rather than puzzles ([Gerontologist, via Johns Hopkins](https://pure.johnshopkins.edu/en/publications/characteristics-of-activities-for-persons-with-dementia-at-the-mi/)). |
| Guidance | A staff note rides with every non-coloring page. | CMS guidance on one-to-one and self-directed activities; NCCAP planning models (one-to-one, small group, large group). |
| Variety | More than one domain in a longer batch: remembering, thinking, a meaningful role, creative expression. | Montessori roles (sensory, motor, cognitive); activity-program planning. |

What I could not confirm: the exact text of the CMS State Operations Manual Appendix PP guidance for F679 (the sources above are summaries) and the full list of NCCAP's eight domains of practice. Check both against the originals before quoting either in anything a surveyor sees.

## The print optimizer

`CognicopiaPrintOptimizer.install()` adds one style sheet. In print it hides every element that is not the sheets, is not inside them, and is not on the way down to them, so it works on any page without naming that page's menu or panel. Each sheet prints on its own US Letter page inside 0.5 in margins, pure black on white, with an optional 0.75 in gutter that alternates sides. The sheets live in one element with the id `printRoot`; `fill(host, svgs, { gutter })` writes them.

It needs a browser that understands `:has()` in print (Chrome and Edge 105 and later, Safari 15.4 and later, Firefox 121 and later). Where one does not, Download PDF gives the same pages.

## The offline bundle

The site's service worker already keeps the core files. The optimizer keeps the whole list in a cache of its own, `studio-assets-v1`, which a site update does not clear (its name does not start with `cognicopia-`, the prefix the service worker clears).

- `required()` lists 15 core files and every library drawing (49 files with today's 34 drawings).
- `status()` says how many are on this computer without the network.
- `cache()` saves the missing ones, one at a time, and a missing file does not stop the rest.
- On the screen: the line under the preview says how many are saved, and **Save for offline use** saves them. A facility's IT contact can do this once on each computer that will be used inside a wing with no internet.

A page opened as a file (not from the web address) has no cache; it says so, and the studio still works.

## How to hook it into a page

```html
<script src="js/generators/activity-engine.js"></script>
<script src="js/generators/coloring-pipeline.js"></script>
<script src="js/utils/facility-validator.js"></script>
<script src="js/utils/print-optimizer.js"></script>
<script src="components/packet-generator-ui.js"></script>
```

In the page's own script, after building the pages:

```js
CognicopiaPrintOptimizer.install();                                  // once, at load
var result = CognicopiaFacilityValidator.validateBatch(pages, { stage: 2, interests: "gardening" });
CognicopiaFacilityValidator.report(result);                          // the console block
CognicopiaPrintOptimizer.fill(document.getElementById("printRoot"), pages.map(function (p) { return CognicopiaColoringPipeline.toSVG(p); }), { gutter: false });
```

Then add the four files to `CORE` in `sw.js` (already done for the studio) and the new page to `PAGES` in `scripts/site-nav.mjs`.

## What found a real bug

The first run of the validator over every batch the studio makes found two faults in the engine: a stage 2 sheet with a single idea was overwritten by the resident's interest, so every sheet in the batch was the same page; and a daily-living batch longer than six pages repeated tasks. Both are fixed, and `scripts/check-activity-studio.mjs` now fails if a batch repeats a sheet.

## Checks

`scripts/check-facility-validator.mjs` (in `npm test`, 115 checks): contrast from the colors; every batch at every stage, hand setting and layout scores 90 or more; each fault (a thin line, a gray, a crowded page, small text, a repeat, one kind of page, a late-stage match page, quiz words, a missing staff note, the wrong number of steps) is found and named; every library drawing is black and white; the report; the file list (every file exists, the service worker keeps them); the print sheet; no network. `scripts/check-activity-studio-ui.mjs` (in `npm run build`) proves the score and console report in a real browser, that the empty-space estimate never claims more than the pixels, the offline save (then a new packet with the network off), and that in print nothing is shown but the sheets.
