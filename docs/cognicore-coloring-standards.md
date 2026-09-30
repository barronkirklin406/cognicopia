# CogniCore coloring standards

What every CogniCore coloring page must be, why, how the library proves it, and how new artwork (hand-drawn or AI-generated) gets in. The rules here are enforced by code, not by review alone:

- `assets/cognicore/lineart.js` draws every page to these rules.
- `src/services/vectorEngine.ts` applies the same line weights to any other drawing.
- `scripts/generate_coloring_manifest.js` measures every printed page and stops if one breaks a rule.
- `npm test` checks the whole library, the prompts and the ingest pipeline.

## 1. What the research supports, and what it does not

The evidence supports a small set of principles. The exact numbers below (line weights, area sizes, allowances) are Cognicopia's engineering choices made to satisfy those principles on paper. No study prescribes them. They are measured on every page, so they can be tuned with evidence later.

| Principle | Evidence | What we do |
|---|---|---|
| **Strong contrast** | Contrast sensitivity drops in Alzheimer's disease and in MCI (Risacher et al. 2013; the "eye frailty" review on MCI). High visual contrast measurably improved food and drink intake in advanced Alzheimer's disease (Dunne et al. 2004). | Pure black (#000000) lines on pure white (#FFFFFF). No gray, shading, gradients, textures or transparency, anywhere in the picture. |
| **Bold, clean shapes with a clear focal point** | Visual-perceptual and object-localization difficulties grow with busy scenes (posterior cortical atrophy and typical AD, 2023). Pictures are remembered better than words even in AD and MCI (Ally et al. 2009). | One subject that fills a 3:4 frame. Heavy lines that get heavier by tier. Nothing in the background at Tier 3. |
| **Structured patterns calm** | Coloring structured designs (mandalas, plaid) lowered anxiety more than free drawing (Curry & Kasser 2005; replication by van der Vennet & Serice 2012; meta-analysis in *Art Therapy* 2021). An RCT in community-dwelling older adults found less anxiety and better mood after coloring (Taiwan, 2020). Mandala-based art reduced anxiety and depressive symptoms in middle-aged and older adults (meta-analysis, 2026). | Bold & Easy Patterns: quilt blocks, rosettes, tiles and stained glass, with closed, regular areas. |
| **Art and reminiscence help, modestly** | Cochrane reviews find low-certainty but positive signals for art therapy (Deshmukh et al. 2018) and small benefits of reminiscence for quality of life, cognition and mood (Woods et al. 2018). Alzheimer's Association and Alzheimer's Society guidance recommends adult, meaningful art activities. | Subjects that invite a story (1950s–1970s cars, kitchenware, tools, farm life, gardens, everyday jobs), each with an open conversation prompt. |
| **Dignity changes outcomes** | Elderspeak (pet names, baby talk) increases resistiveness to care in dementia (Williams et al. 2009; Herman & Williams 2009; Williams et al. 2017). | No juvenile or cartoon art. No memory-quiz phrasing ("do you remember…"). No pet names. The dignity filter enforces this on every title, tag, caption and prompt. |

Sources are listed in section 10. Links point to the published abstracts and records. Some full texts were not reachable from the build environment, so claims are kept to what the abstracts state.

## 2. The print standard

| | |
|---|---|
| Colors | Lines `#000000`, paper `#FFFFFF`. Solid black accents (eyes, knobs, hubs) are allowed. Nothing else is. |
| Page | US Letter, 8.5 × 11 in |
| Margins | 0.5 in outside, top and bottom; **0.75 in binding gutter** on the hole-punch side (mirrored on even pages when printing two-sided) |
| Hole punch | Three holes, 5/16 in diameter, 3/8 in from the edge, centers at 1.25, 5.5 and 9.75 in |
| Picture | A 3:4 portrait box, as large as the page allows after the title, caption and resident header |
| Line caps and joins | Round, so heavy lines never spike at corners |
| Text in the picture | None. Titles, captions and legends sit outside the art box. |

### Tiers and line weights

Line weight follows the Dynamic Vector Engine's tier table. The unit is the CSS pixel at the printed size: 96 px = 1 in and 1 px = 0.75 pt.

| Tier | For | Multiplier | Allowed | Outline | Interior detail | Smallest area to color | Areas under it allowed |
|---|---|---|---|---|---|---|---|
| **Tier 1 - High Detail** | early stage, enjoys detail | 1.0× | 2–3 px | 3 px (2.25 pt) | 3 px | 0.02 sq in | 10 |
| **Tier 2 - Guided Focus** | moderate stage | 2.0–2.5× | 5–7 px | 6 px (4.5 pt) | 5 px (3.75 pt) | 0.05 sq in | 4 |
| **Tier 3 - Single Focal / Sensory** | advanced stage | 3.5–4.0× | 9–12 px | 10.5 px (7.9 pt) | 9 px (6.75 pt) | 0.12 sq in | 1 |

- The base line is a drawing's own main line, brought into Tier 1's 2–3 px range. Each tier multiplies it, and the result is clamped into the tier's range.
- Library pages use a 3 px base, so they print at 3, 6 and 10.5 px. An imported drawing with 2 px lines prints at 2, 5 and 9 px.
- "Areas under it allowed" covers small accents, such as the gap between two petals. The generator refuses a page that has more.
- Staff can raise the line weight without changing the detail, for example a Tier 1 picture with Tier 3 lines for a resident with low vision. The engine keeps the detail tier and the stroke tier separate.
- A Tier 3 drawing loses closed details under 0.05 sq in. Solid black accents stay unless they are specks.

### Cross-reference with clinical staging

This is a guide for choosing a tier, not a diagnosis. Staging is the clinician's call. The same table lives in `src/services/slpClinicalService.ts`.

| Tier | Global Deterioration Scale | FAST |
|---|---|---|
| 1 | GDS 3–4 | FAST 3–4 |
| 2 | GDS 5 | FAST 5 |
| 3 | GDS 6 | FAST 6a–6e |

## 3. Themes and the dignity-first filter

| Category | Examples |
|---|---|
| Classic Vehicles | 1950s sedans, farm pickups, tractors, a steam locomotive, a biplane |
| Botanical & Garden | Tulips, sunflowers, roses, maple leaves, a watering can, a garden gate |
| Nostalgic Heritage | Rotary telephones, radios, percolators, a sewing machine, clocks, a red barn |
| Wildlife & Nature | Songbirds, an owl, a swan, butterflies, koi, a sleeping cat, a loyal dog |
| Bold & Easy Patterns | Quilt blocks, rosettes, stained glass, fans, tiles, a trellis |
| Home & Everyday Tasks | Laundry day, setting the table, baking, knitting, letter writing, fishing |

Animals are drawn with natural proportions: small solid eyes, no smiles, no cartoon faces.

The dignity filter is `CogniCorePrompts.dignityCheck`. It flags three kinds of wording. It never checks the negative prompt, which names these things on purpose to keep them out.

- **Juvenile words:** cute, cartoon, kawaii, baby, kids, teddy, silly, doodle, and more.
- **Memory-test openings:** "do you remember", "can you name", "what year was".
- **Elderspeak:** sweetie, dearie, sweetheart, "good girl", "young lady", and ordinary words used as pet names ("Thank you, honey." is flagged; "sweeten with honey" is not).

Conversation prompts invite rather than test: "Tell me about…", "What would you…", "Who…".

## 4. Measured, not eyeballed

Every page is printed to a 1-bit bitmap at its *smallest* printed size and measured by `scripts/lib/raster.mjs`. The smallest size is the one with the resident header, title and caption all on, measured at 100 dpi. The catalog records these for each page:

| Metric | What it means |
|---|---|
| `regions` | Closed areas there are to color. Areas under 0.003 sq in are ignored: a gap where two lines nearly touch is not an area. |
| `smallest_region_sq_in`, `median_region_sq_in`, `largest_region_sq_in` | Sizes of those areas |
| `tiny_regions` | Areas under the tier's minimum |
| `stroke_pt_median`, `stroke_pt_p10` | Printed line thickness, from ink run lengths in four directions |
| `ink_coverage`, `subject_fill` | How much of the box is ink, and how much of it the subject fills |

Visual complexity bands, used by the library filter:

- **Simple:** up to 12 areas
- **Moderate:** 13–40 areas
- **Detailed:** more than 40 areas

## 5. The library

The library has 118 designs, each drawn at three tiers: **354 printable pages**. They are grouped into **56 packs** by theme, season, decade and therapeutic focus.

| What | Where |
|---|---|
| Designs | `assets/cognicore/designs/*.js` |
| Packs | `assets/cognicore/packs.js` |
| Written out by | `npm run coloring` |

That command writes:

| File | Contents |
|---|---|
| `assets/coloring/<category>/cc-<design>-t<tier>.svg` | One standalone SVG per page, sized in inches so it prints at the right weight at 100% |
| `src/data/cognicore_coloring_catalog.json` | The catalog, checked against `src/data/cognicore_coloring_catalog.schema.json` |
| `src/data/cognicore_prompt_jobs.jsonl` | One AI prompt job per page and per new-subject idea |
| `assets/cognicore/cognicore.js` | The engine, designs, packs, prompts and measured numbers in one file, for the Packet Builder |

### Catalog asset fields

| Field | Value |
|---|---|
| `id` | `cc-<design>-t<tier>`, or `ai-<category>-<subject>-t<tier>` for ingested pictures |
| `title` | The page's title |
| `category` | Classic Vehicles, Botanical & Garden, Nostalgic Heritage, Wildlife & Nature, Bold & Easy Patterns, or Home & Everyday Tasks |
| `cognitive_tier` | "Tier 1 - High Detail", "Tier 2 - Guided Focus" or "Tier 3 - Single Focal / Sensory" |
| `tags` | For example reminiscence, motor-skills, 1950s, bold-lines |
| `line_weight` | thick, ultra-bold or extra-bold-sensory, plus `stroke_px` and `stroke_pt` |
| `aspect_ratio` | 3:4 (the picture), with `page_size` 8.5x11 |
| `svg_path` / `png_path` | The local file |
| `asset_url` | The published address |
| `sha256`, `bytes` | Integrity of the file |
| Also | `era`, `season`, `sensitive_topics` (matched against a resident's avoid-topics), `conversation_prompt`, `packs`, `visual_complexity`, `metrics`, `source`, `review_status` |

### Adding a design

A design is a function of `g`, which collects shapes for one tier, and `h`, the geometry helpers. It draws in a 600 × 800 box. Each shape call takes an optional level `lv`, the least-detailed tier that still shows it: 1 = every tier, 2 = Tiers 1 and 2, 3 = Tier 1 only. Use `g.at(t1, t2, t3)` to pick a value per tier.

| Call | Draws |
|---|---|
| `g.S(d, lv)` | A white shape: an area to color |
| `g.L(d, lv)` | A main line |
| `g.D(d, lv)` | An interior detail line |
| `g.DS(d, lv)` | A detail shape |
| `g.K(d, lv)` | A solid black accent |

Then run `npm run coloring` and `npm test`. The generator refuses a page that breaks its tier's rule and names it. Fix it by making small parts solid (`K`), larger, or Tier 1 only.

## 6. AI artwork: prompts, ingest, review

**1. Prompts.** `scripts/coloring_prompts.mjs` writes batches: one job per subject and tier, each with Midjourney, Stable Diffusion and DALL·E 3 wording. Jobs whose subject fails the dignity filter are left out. The templates are:

- **Positive:** `Ultra-bold black line art coloring page for adults, {SUBJECT}, thick high-contrast clean black outlines, white background, no shading, no gradients, clean vector art style, simple focal point, 3:4 aspect ratio, dignity-first senior coloring book`, plus the tier's wording:
  - Tier 1: 30–60 closed areas
  - Tier 2: 12–30 large closed areas, one clear subject
  - Tier 3: 4–12 very large areas, nothing in the background
- **Negative:** `shading, grayscale, color, realistic photo, thin lines, cluttered background, extra limbs, childish, cartoon faces, tiny details, noise, texture, blur`, plus the tier's extras.

**2. Generate.** This happens outside Cognicopia; nothing here calls a generator. Save each image as `<job_id>.png` in `assets/coloring/_inbox/`. That folder is not published.

**3. Ingest.** Run `node scripts/ingest_coloring_assets.mjs --jobs <batch>.jsonl`. For PNGs it:

- flags color and gray shading;
- thresholds to pure black and white (Otsu) and removes specks;
- crops to the drawing and re-frames it on a 3:4 page;
- thickens lines to the tier's weight;
- measures the page, suggests the simplest tier it meets, tags it and runs the dignity filter;
- writes a 300 DPI 1-bit PNG.

SVGs stay vector when their strokes can be raised to the weight:

- colors become pure black and white;
- `<text>`, gradients and images are flagged, not drawn.

Every picture is recorded as **needs-review** in `src/data/coloring_ingested.json`.

**4. Review.** A person checks each picture. Five checks are measured for them:

- pure black and white;
- line weight;
- area size;
- fills the page;
- dignity wording.

Five are confirmed by eye:

- adult and dignified (no cartoon faces or cute style);
- true to life (no extra limbs, warped hands or impossible machines);
- no letters, numbers, signatures or watermarks;
- nothing frightening or upsetting (check the resident avoid-topics list);
- we have the right to use it.

**5. Approve or reject.**

- Approve: `--approve <id> --reviewer "Name"`. A failed measured check needs `--override "why"`.
- Reject: `--reject <id> --reviewer "Name" --reason "…"`.

Approved pictures join the catalog and the Packet Builder on the next `npm run coloring`.

## 7. The Dynamic Vector Engine

`src/services/vectorEngine.ts` is built into `assets/services/vectorEngine.js` by `npm run services`. It exposes `globalThis.CogniVectorEngine` and runs in the browser, offline:

- `parseSvg` / `serializeSvg`: its own SVG syntax tree. No DOM, and no regular-expression surgery.
- `transformSvg(svg, { tier, strokeTier, printWidthIn })` does the whole job:
  - pure black and white, including group paint and opacity;
  - Tier 3 detail drop under 0.05 sq in;
  - Ramer–Douglas–Peucker simplification of over-detailed (auto-traced) paths;
  - tier line weights with round caps and joins;
  - thickening of line art drawn as filled outlines, whose thickness it estimates as 2 × area ÷ perimeter.

  It also returns a report: base line, multiplier, widths, points before and after, details dropped, and milliseconds. Every library page transforms in under 10 ms; the budget is 150 ms.
- `pageFrame({ pageNumber, duplex, unit })` and `fitArt(...)`: the Letter page, the 0.75 in gutter on the bound edge, the 0.5 in margins, the holes, and the largest 3:4 box.
- `legendSvg` / `drawLegendPdf`: optional color guides at the page foot, outside the picture.
  - **Anxiety Reduction Mode:** calming blues and greens.
  - **High-Contrast Mode:** yellow and navy.

## 8. Commands

| Command | Does |
|---|---|
| `npm run coloring` | Draw, measure and write the library: SVGs, catalog, prompt jobs, browser bundle |
| `npm run coloring:check` | Verify all of the above is current (part of `npm run build`) |
| `npm run coloring:prompts -- --category botanical-garden --tier 3 --out batch-01` | A prompt batch |
| `npm run coloring:ingest` | Bring in the inbox for review |
| `npm run services` | Build the TypeScript services for the browser |
| `npm test` | Every check, including this library's and the services' |

## 9. Changing a number

Change a tier rule in `TIERS` / `WEIGHTS` (`assets/cognicore/lineart.js`) and in `STROKE_POLICY` (`src/services/vectorEngine.ts`) together. `npm test` fails if they disagree. Then run `npm run coloring`: the generator re-measures all 354 pages and names any that no longer pass.

## 10. Sources

- Curry NA, Kasser T. Can coloring mandalas reduce anxiety? *Art Therapy* 2005;22(2). https://www.tandfonline.com/doi/abs/10.1080/07421656.2005.10129441
- van der Vennet R, Serice S. Can coloring mandalas reduce anxiety? A replication study. *Art Therapy* 2012;29(2). https://www.tandfonline.com/doi/abs/10.1080/07421656.2012.680047
- The effect of mandala coloring on state anxiety: a systematic review and meta-analysis. *Art Therapy* 2021. https://www.tandfonline.com/doi/full/10.1080/07421656.2021.2003144
- Coloring activities for anxiety reduction and mood improvement in Taiwanese community-dwelling older adults: a randomized controlled study (2020). https://pubmed.ncbi.nlm.nih.gov/32063986/
- Mandala-based art interventions for anxiety and depressive symptoms in middle-aged and older adults: a systematic review and meta-analysis. *Frontiers in Psychology* 2026. https://pubmed.ncbi.nlm.nih.gov/42459622/
- Dunne TE, Neargarder SA, Cipolloni PB, Cronin-Golomb A. Visual contrast enhances food and liquid intake in advanced Alzheimer's disease. *Clinical Nutrition* 2004. https://pubmed.ncbi.nlm.nih.gov/15297089/
- Risacher SL, et al. Visual contrast sensitivity in Alzheimer's disease, mild cognitive impairment, and older adults with cognitive complaints. *Neurobiology of Aging* 2013. https://www.sciencedirect.com/science/article/abs/pii/S0197458012004290
- Beyond visual acuity: contrast sensitivity as a potential neuro-visual dimension of "eye frailty" in mild cognitive impairment. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12817103/
- Effects of the visual environment on object localization in posterior cortical atrophy and typical Alzheimer's disease (2023). https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10011642/
- Ally BA, Gold CA, Budson AE. The picture superiority effect in patients with Alzheimer's disease and mild cognitive impairment. *Neuropsychologia* 2009. https://pmc.ncbi.nlm.nih.gov/articles/PMC2763351/
- Deshmukh SR, Holmes J, Cardno A. Art therapy for people with dementia. *Cochrane Database of Systematic Reviews* 2018 (CD011073.pub2). https://pubmed.ncbi.nlm.nih.gov/30215847/
- Woods B, O'Philbin L, Farrell EM, Spector AE, Orrell M. Reminiscence therapy for dementia. *Cochrane Database of Systematic Reviews* 2018 (CD001120.pub3). https://pubmed.ncbi.nlm.nih.gov/29493789/
- Williams KN, Herman R, Gajewski B, Wilson K. Elderspeak communication: impact on dementia care. *Am J Alzheimers Dis Other Demen* 2009. https://pubmed.ncbi.nlm.nih.gov/18591210/
- Herman RE, Williams KN. Elderspeak's influence on resistiveness to care: focus on behavioral events. https://pmc.ncbi.nlm.nih.gov/articles/PMC2836897/
- Voicing ageism in nursing home dementia care (2017). https://pubmed.ncbi.nlm.nih.gov/28556867/
- Alzheimer's Association: art and music. https://www.alz.org/help-support/caregiving/daily-care/art-music
- Alzheimer's Society: how colouring can help people living with dementia keep their mind active. https://www.alzheimers.org.uk/blog/coronavirus-colouring-dementia
- Reisberg B, Ferris SH, de Leon MJ, Crook T. The Global Deterioration Scale for assessment of primary degenerative dementia. *Am J Psychiatry* 1982;139(9):1136–1139.
- Reisberg B. Functional Assessment Staging (FAST). *Psychopharmacology Bulletin* 1988;24(4):653–659.
