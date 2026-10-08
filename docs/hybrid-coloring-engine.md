# The hybrid coloring engine

A Cognicopia coloring page made for one resident, in two layers:

1. **The subject.** One clean, finished vector drawing (a pickup truck, a teapot, a cardinal) is chosen for the resident. The drawing comes from a local folder and fills the middle of the page. Its outlines are set in printed points after it is scaled, so a small drawing and a large one print with the same line weight.
2. **The setting.** Everything around the drawing is made for the resident's stage, from a seed: the border, the title, and the words under the picture. No two pages look the same, and any page can be printed again from its page code.

The engine never draws the subject itself in code. Drawing a car or a bird in code is what produced uneven pictures before (the Packet Builder's old clip art, and the infinite generator's subject families). A finished drawing stays crisp, and only the border and the words vary.

Everything runs in the browser. The subjects ship with the page (`assets/coloring/subjects.bundle.js`), so a coloring page draws with no network at all, even from a folder or offline. Nothing about a resident leaves the computer.

| | |
|---|---|
| Engine | `src/engine/ColoringEngine.js` (global `CognicopiaColoringEngine`) |
| Subject list and search | `src/services/ColoringManifest.js` (global `CognicopiaColoringManifest`) |
| Subject sources (hand-drawn) | `src/coloring/subjects/<folder>/*.svg` |
| Processed subjects | `assets/coloring/{vehicles,nature,objects,animals,nostalgia}/*.svg` |
| Manifest | `assets/coloring/manifest.json` |
| Offline bundle | `assets/coloring/subjects.bundle.js` (the manifest and every subject's paths) |
| Processor | `scripts/process_coloring_assets.mjs` (`npm run subjects`; `npm run subjects:check`) |
| SVG normalizer | `scripts/lib/svg-normalize.mjs` (Node built-ins only) |
| Tests | `scripts/check-hybrid.mjs` (part of `npm test` and `npm run build`) |
| Used by | `index.html` (the packet's coloring page) and `builder.html` (the coloring library's **New pages** tab, and older saved coloring pages) |

## 1. The three stages

| | Early | Middle | Late |
|---|---|---|---|
| Border | Zentangle-style: small patterned cells (rosettes, rings, diamonds, pebbles, stars, quatrefoils), mandala corners | A few large, simple shapes (circles, squares, diamonds) | None, and nothing behind the picture |
| Words | "Prepared especially for …", the title, and an open conversation prompt underneath | The name line and title, then a completion line, for example "Out in the field on the ____" with **"The word to write on the line: tractor"** printed under it | The name line, then a large title banner, for example **TRACTOR** |
| Picture lines | 3 pt (4 px) | 4.5 pt (6 px); detail 3.6 pt | 6 pt (8 px); fine detail left out |
| Floor checked by `validate()` | 3 px (2.25 pt) | 3 px (2.25 pt) | 5 px (3.75 pt) |

The middle stage shows the word to write. The page asks nothing the resident has to get right, in keeping with the site's rule: do not ask questions or test memory.

The prompts are open, present-tense invitations, such as "What would you grow in a field like this one?". None of them asks the resident to recall anything. `check-hybrid.mjs` rejects any subject whose prompt quizzes memory, and any childish word.

### Rules every page is held to

`validate(page)` returns a list of problems, and it is empty for every subject at every stage (`check-hybrid.mjs` composes 306 pages, all 34 subjects in three frames at each stage). It checks that:
- lines never fall under the stage's floor;
- fills are only white, black or none: no gray, shading or hatching;
- everything stays inside the printable area (US Letter, 0.5 in margins) and inside the frame it was given;
- the words are 12 pt or more (only the small staff footer is exempt);
- the late stage has no border.

## 2. The subjects

There are 34 subjects in five folders:

| Folder | Subjects |
|---|---|
| vehicles | 1950s pickup truck, 1957 family sedan, 1967 muscle car, farm tractor, steam locomotive, propeller airliner, biplane, sailboat |
| nature | garden rose, tulip, sunflower, daisy, oak tree, harvest pumpkin |
| objects | teapot, teacup, watering can, rocking chair, oil lantern, birdhouse |
| animals | cardinal, hummingbird, owl, rooster, sitting cat, sitting dog, horse, butterfly |
| nostalgia | grandfather clock, rotary telephone, cathedral radio, typewriter, jukebox, sewing machine |

The drawings were made for Cognicopia as simple, iconic line art. They are not licensed commercial illustrations. Licensed SVG files can be added to the same folders (see below).

### What a source file carries

A source is an ordinary SVG. Metadata on its `<svg>` element (all of it optional):

| Attribute | Meaning |
|---|---|
| `data-title` | the title on the page ("The Farm Tractor") |
| `data-tags` | comma list of tags; the file name and folder add more (`1967_muscle_car` gives `1967`, `1960s`, `muscle`, `car`, `muscle_car`) |
| `data-stages` | the stages it suits (default: all three) |
| `data-angle` | `side_profile`, `three_quarter` or `front` |
| `data-prompt` | the early stage's open prompt |
| `data-completion`, `data-word` | the middle stage's completion line and the word shown for it |
| `data-banner` | the late stage's banner |

On individual shapes:
- `class="detail"` marks fine detail, drawn thinner and left out at the late stage;
- `data-keep="1"` keeps a shape at the late stage even when it is small (an animal's eye);
- a white fill hides what is behind it;
- a small dark fill stays a solid black accent (an eye, a button);
- every other fill becomes white.

### The processor

`node scripts/process_coloring_assets.mjs` (or `npm run subjects`) does six things:
1. **Strips** colors, gradients, patterns, images, text, styles, filters, masks and clips, and turns strokes black.
2. **Flattens** transforms, `<use>`, nested `<svg>` and arcs into absolute M, L, C and Z path points.
3. **Normalizes** the drawing to a 0 0 800 600 box, scaled to fit inside a 40-unit pad and centered, with uniform outlines: 4 px main and 3 px detail.
4. **Simplifies for the late stage.** It lays each subject out on a late-stage page with the engine itself and prints it to a bitmap. The smallest shape around any area under 0.1 sq in becomes detail, so it is left out at that stage. Shapes marked `data-keep="1"` are never left out. At most one small area per subject remains, and the check holds every subject to that.
5. **Writes** each processed file, `manifest.json` and `subjects.bundle.js`.
6. **Checks.** With `--check` it changes nothing and fails if any output is out of date. The build runs it through `check-hybrid.mjs`.

To add a subject, choose one of these:
- Draw a source in `src/coloring/subjects/<folder>/`.
- Drop a licensed SVG straight into `assets/coloring/<folder>/`. It is processed in place once; `--force` reprocesses it.

Then run `npm run subjects` and `npm test`.

### The manifest entry

```json
{ "id": "farm_tractor", "title": "The Farm Tractor", "category": "vehicles",
  "filePath": "assets/coloring/vehicles/farm_tractor.svg",
  "tags": ["1950s", "farm", "farm_machinery", "farming", "harvest", "tractor", "utility_vehicle", "vehicles", "work", "..."],
  "dementiaStageCompatibility": ["early", "middle", "late"], "recommendedAngle": "side_profile", "strokeWidthMin": 3,
  "prompt": "What would you grow in a field like this one?", "word": "tractor",
  "completion": "Out in the field on the", "banner": "TRACTOR", "paths": 14, "detailPaths": 1, "hash": "…" }
```

## 3. Choosing the subject

`CognicopiaColoringManifest.select(profile, options)` turns what is known about the resident into weighted tags:

| Source | Fields read | Weight |
|---|---|---|
| Asked for by name | `tags` or `requested` | 1.5 |
| Their work | `former_profession`, `profession`, `job` or `occupation`, matched to subjects (a dairy farmer gives farm, tractor, pickup truck, rooster) | 1, then 0.8 |
| Their hobbies | `hobbies` (gardening gives garden and flower) | 0.9 |
| Their years | `born`, `birthYear`, `dob` or `DOB`: the decades they turned 10, 20 and 30 | 0.35 to 0.5 |

Each tag is also tried through its broader tags, worth 0.62 times as much at each step. A request no subject carries still finds the nearest one:

```
ford_truck → pickup_truck → truck → utility_vehicle → classic_car → car → vehicle
```

Near-miss words are matched too:
- misspellings, within one or two letters ("tracktor" finds the tractor);
- synonyms ("GTO" is a muscle car, "plane" an airplane);
- plurals.

When nothing matches at all, the subject is a familiar adult object: teapot, rose, grandfather clock, rocking chair, sedan, sunflower or teacup.

Three rules always hold:
- **The avoid list is never crossed.**
  - The profile form's topic codes rule out what they cover: `driving` rules out cars, trucks and tractors; `water` rules out boats; `war` rules out the biplane.
  - A word typed by staff rules out subjects with that word, singular or plural, as a whole word, so "war" never rules out a warm teapot.
  - A host page can add its own rule. The packet tool passes its own whole-word avoid filter as `filter`.
- **Recently used subjects are passed over** while others remain (`exclude`).
- **A batch never repeats a subject** (`selectMany`).

The result names how the choice was made: `fallback` is `"exact"`, `"broader tag"`, `"their years"` or `"default object"`.

## 4. Drawing a page

```js
// one call: choose, compose and draw
CognicopiaColoringEngine.renderHybridPage(
  { name: "Walter", born: 1941, former_profession: "dairy farmer", hobbies: ["fishing"], avoid: ["boats"], stage: "late" },
  canvasOrPdfOrElement,        // a <canvas>, a jsPDF document, an element, or nothing for an SVG string
  { seed: 42 }                 // optional: seed, stage, code, subjectId, frame, header, footer, dpi
).then(({ page, output }) => { /* page.meta.code is the page code */ });
```

| Function | What it does |
|---|---|
| `compose({ asset, paths, stage, seed, name, prompt, frame, header, footer })` | Lays the page out and returns `{ items, texts, meta }`. `frame` lays it out inside a box (the packet tool's space under its own heading, or the library's binding gutter); `header: false` leaves the name and title to the host page. |
| `composeFor(profile, options)` | Chooses the subject and composes the page, synchronously, from the bundle. |
| `toSVG(page)` | Screen and print. |
| `toCanvas(page, canvas, { dpi })` | A preview, or a print-ready image: 300 dpi is 2550 × 3300. At 200 dpi and above the image is made pure black and white, so no smoothing pixel prints gray. |
| `toPDF(page, doc)` | Vector PDF through jsPDF (or `scripts/lib/pdf-lite.mjs` in Node). |
| `validate(page)` | The rules in section 1. |
| `code()`, `parseCode()` | Page codes. |

**Page codes** look like `HM-farm_tractor-1A2B3C`: the stage (E, M or L), the subject and the seed. A code draws exactly the same page again. The library's New pages tab finds a page by its code. Codes from the retired infinite generator (such as `2NV-1XCH86E`) are still found and printed.

## 5. Where the site uses it

- **The packet tool (`index.html`).** The packet's coloring page comes from the resident's form:
  - **Inputs:** their name, birth year, work, hobbies and avoid list. The picture is chosen by resident and month, so a packet rebuilds the same way and next month's is new.
  - **Layout:** the page sits under the packet's own name banner and heading.
  - **What the packet already pictures** is passed over: the holiday pages' own subjects.
  - **If every subject is ruled out by the avoid list,** the page says so plainly instead of printing a picture.
- **The Packet Builder (`builder.html`), coloring library → New pages.**
  - **Who it is for:** a saved resident chosen at the top of the library, or a few details typed into the tab (year born, working life, hobbies, words to leave out).
  - **What to choose:** any of the five groups and how many pages. Every page is checked before it shows.
  - **The cognitive tier** sets the stage: Tier 1 is early, Tier 2 middle, Tier 3 late. A chosen page redraws at another tier from the same seed.
  - **Output:** pages print on US Letter with the library's 0.75 in binding gutter (mirrored for two-sided printing) and go to the packet, the printer or a vector PDF like any library page.
- **Older saved packets.** The Packet Builder's first coloring activity drew clip art line by line in code. That code is gone.
  - Each of its 37 pictures now prints as the hybrid page of the same or nearest subject (`HYBRID_LEGACY` in `builder.html`), so no saved packet breaks.
  - The Cognicopia Coloring activity, used by the Facility Portal's coloring sessions, still prints library pages. If the library cannot load, it falls back to hybrid pages.

## 6. Tests

`node scripts/check-hybrid.mjs` loads the three files the way a page does, in a sandbox with no `fetch`, no `XMLHttpRequest` and no `require`. It runs about 2,600 checks:

- **Current outputs:** the processed files, manifest and bundle are current, every manifest field is present, and every processed file is black outlines of 3 to 5 px in the 800 × 600 box.
- **The processor** strips a deliberately messy SVG clean, fits and centers it, and a second pass changes nothing.
- **Offline:** drawing works offline, and loading with neither the bundle nor a network says so plainly.
- **Subject search:**
  - exact tags, misspellings, the Ford truck fallback chain, work, hobbies and years, and the default object;
  - the avoid list, for topic codes and typed words;
  - the host filter, batches without repeats, recently used subjects and stage compatibility.
- **Every subject at every stage** passes `validate()` and is built as its stage requires. The late stage has no border, a banner and no detail lines.
- **Page codes:** a code redraws the identical page, and different seeds give different borders.
- **Printed:** every subject at every stage is printed to a bitmap at 150 or 300 dpi.
  - The thinnest tenth of the lines measures at or above the stage's floor.
  - Late-stage pages keep at most one area under 0.1 sq in.
  - The PDF draws only black lines and black or white fills, at widths at or above the floor.
- **The pages that print coloring** load the subjects before the engine, the old clip-art drawers are gone, and the offline worker keeps all four files.

`check-services.mjs` also passes every processed subject through the Dynamic Vector Engine's round trip.

## 7. Known limits

- **The subject set is small:** 34 drawings. A resident whose work and hobbies match none of them gets a subject from their years, or a familiar default object. Adding licensed drawings to the folders widens the choice with no code change.
- **Wide subjects print shorter.** Cars, trains and airliners fill the page's width, so at the late stage the picture is shorter than a tall subject.
- **A few small areas remain.** Eight subjects keep one area just under 0.1 sq in at the late stage (for example, inside the horse's ear or under the rose), where removing it would harm the drawing. The library's own Tier 3 rule allows one.
- **The engine does not judge whether a drawing is good.** It cleans and measures drawings; a person still looks at a new drawing at each stage before it ships.
