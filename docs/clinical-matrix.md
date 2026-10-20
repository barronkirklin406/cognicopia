# The clinical matrix and the activity engine

Both packet tools, the packet form on `index.html` and the Packet Builder on
`builder.html`, print from one rulebook and one set of page makers:

| File | What it is |
| --- | --- |
| `src/engine/ClinicalMatrix.js` | The rulebook. Stage rules, which activity is made for which stage, the page shell, the dignity filter, the clinical tips, the seeded random stream, the page checker. |
| `src/engine/ClinicalActivities.js` | The page makers. Thirteen kinds of page, each drawn as a page model that every output (PDF, SVG, sheet) reads. |
| `scripts/check-clinical.mjs` | The tests. Part of `npm test` and `npm run build`. |
| `scripts/check-clinical-staging.mjs`, `scripts/check-clinical-staging-ui.mjs` | The tiers, GDS and therapy mapping, anchors, avoidance and calm mode: in Node, and in a real browser. |

Both files run in the browser and in Node. They make no network request, read
no clock, use no browser storage and never call `Math.random`. Nothing a care
team types leaves the computer.

## Vision tiers: the type grows with the person's eyesight

A profile's print needs carry a vision tier, and every printed floor scales with it, on top of the stage:

| Tier | Scale | Early or middle stage floor | Late stage floor |
| --- | --- | --- | --- |
| Standard | 1 | 18 pt | 24 pt |
| Large print | 1.15 | 20.5 pt | 27.5 pt |
| Extra-large | 1.3 | 23.5 pt | 31 pt |

`CognicopiaClinicalMatrix.visionScale(tier)` gives the scale (an unknown tier prints at standard size), `floorFor(stage, role, tier)` the smallest a role may be, and `typeFor(stage, tier)` the whole table. The activity engine takes `vision` as an option; a page that cannot hold the larger print at the biggest tier is drawn again one tier down (extra-large, then large, then standard) rather than refused, and the page model records `meta.visionWanted` and `meta.visionUsed`. On the packet form, Extra-Large Print sets the tier for the main PDF: flowing text and headings grow to the scaled floor (a heading shrinks to fit its line, never under 24 pt), while the hand-laid grids and cards keep the stage's own floor so letters never collide. Staff pages (guides, answer keys, notes) never print under 16 pt, and the header, tip and footer of a page are set at the 12 pt staff floor. All printed ink is pure black on white.

`scripts/check-clinical.mjs` proves the scaling for every activity, stage and tier; `scripts/check-print-type-ui.mjs` (in `npm run build`) proves it on the real printed sheets and on PDFs read back with PyMuPDF.

## Tiers, GDS and FAST, as a person reads them

Every place a level is chosen shows the same words, taken from the matrix's own numbers (`CM.tierLabel(stage)`): **Tier 1 · Mild · GDS 3–4**, **Tier 2 · Moderate · GDS 5**, **Tier 3 · Advanced · GDS 6–7** (FAST 3–4, 5, 6–7). They are the care team's own staging; nothing here assesses anyone. The Packet Builder's difficulty choice, the packet tool's level choice, the profile form's tier choice and the tablet's level choice all carry them. In the Packet Builder, a line under the choice says what the tier changes, read from the rulebook (type floor, thinnest line, word-search size, steps to put in order, choices at a time, how busy the page is), so choosing Advanced visibly changes the grid, the line weight, the words and the size of the targets, and the preview is drawn again.

The thirteen core page makers, each with the GDS and FAST range of the stages it is made for and the therapy it serves (`CM.gdsRange`, `CM.fastRange`, `CM.therapyOf`; `scripts/check-clinical-staging.mjs` re-derives every row):

| Page maker | GDS | FAST | Therapy |
| --- | --- | --- | --- |
| Large word search (`search-large`) | 3–4 | 3–4 | Cognitive Stimulation |
| Guided word search (`search-guided`) | 5–7 | 5–7 | Errorless Learning |
| Word ladder (`ladder`) | 3–4 | 3–4 | Executive Function |
| Anagrams with clues (`anagram`) | 3–5 | 3–5 | Cognitive Stimulation |
| Sort into two groups (`sorting`) | 3–5 | 3–5 | Semantic Memory |
| Odd one out (`oddone`) | 3–5 | 3–5 | Semantic Memory |
| Put it in order (`sequence`) | 3–7 | 3–7 | Montessori / Sequencing |
| Choose the ending (`choose-ending`) | 3–7 | 3–7 | Validation / Spontaneous Recall |
| Match the picture to its name (`matching`) | 3–7 | 3–7 | Errorless Learning |
| Large-print maze (`maze-motor`) | 3–7 | 3–7 | Spatial / Fine Motor |
| Follow the path (`pathtrace`) | 5–7 | 5–7 | Spatial / Fine Motor |
| Today: day, season and weather (`orientation`) | 3–7 | 3–7 | Reality Orientation |
| Shape to look at (`silhouette`) | 5–7 | 5–7 | Sensory Stimulation |

Every other activity in the matrix gets its therapy from its domain (reminiscence, reality orientation, spatial and fine motor, sensory stimulation, spontaneous recall, and so on); staff pages have none. The tablet's thirteen activities have their own table (`MODULES` in `js/tabletEngine.js`); each is made for all three stages (GDS 3–7).

## Therapy anchors

A resident's page carries a short anchor, `[Therapy: Reminiscence | GDS 5]`, with the GDS of the tier the page is drawn for. On paper it is set in bold 12 pt at the right of the foot (the staff text size), with the page number moved up beside the name to make room, so it is out of the resident's work and costs the body no room; on a Packet Builder page of the older kind it is in the header's right corner; in a screen preview it is in the preview's header line. A two-part therapy name is shortened to its first part when the line would be too wide. `CM.anchorFor(id, tool, stage)` makes the text; a page with no activity keeps the foot as it always was.

## Avoidance protocols and triggers

The profile form's **Avoidance Protocols & Triggers** holds topics (war, loss, hospitals, religion, and so on), military conflict eras (World War II, Korea, Vietnam, the Gulf, Iraq and Afghanistan wars, the Cold War), the names of loved ones to leave out, places or regions, and anything else typed in. `CM.avoidTerms({ topics, eras, people, places, other })` turns them into one list of terms; `CM.avoidMatcher(terms)` finds them as whole words (never "war" inside "toward"), in any case, with a plural or a possessive. The same list is held by every generator:

- the thirteen page makers keep the words off the page, and `CM.validatePage(page, stage, { avoid })` fails a page that names one, so it is drawn again (up to twelve seeds) or refused;
- the packet tool takes the list from the active resident and from the "keep off the page" field;
- the Packet Builder has the same field in every activity's form, with a picker that brings in a saved resident's list, name and tier; a page that names a term is drawn again from a fresh draw of the word bank, and if nothing clean can be made the preview says so;
- the tablet has a "keep off the screen" field; an activity that shows a listed word is started again (up to eight times);
- the soothing engine, the coloring pages and the reminiscence cards already filtered by topic codes and now take the same terms.

The terms live where the rest of the resident's profile does: the encrypted store on this computer. Nothing here makes a network request (the checks prove it).

## Sundowning / De-escalation mode

One switch, in the Packet Builder's top bar ("Late-Stage / Sundowning Calm"), the packet tool's level choice and the tablet's setup, that makes everything quieter. `CM.CALM` is the rulebook: the late stage's type and line floors, at most three things on a page, a reminiscence invitation in place of a puzzle, no timed, dense or competing pages (`CM.calmOk(id)` lists the pages that are calm). In the Packet Builder each queued page becomes one calm late-stage page drawn by the soothing engine (a reminiscence cue with one picture or path, the avoid list honored, the anchor in the foot); in the packet tool the level goes to late and is held, the unsuited pages are turned off and the calm ones picked, and the level you had comes back when it is turned off; on the tablet only the slow activities are shown and the late stage's size is used. The print standard does not loosen in this mode: pages stay pure black on white, with lines 3 pt or heavier (4.5 pt at the late stage) and the 0.5 in margin. "Less high-contrast line pattern" is met by fewer lines and one subject, not by thinner or lighter lines, which would be harder to see. The mode is a switch on the screen and is not saved.

## The three stages

| | Early (GDS 3 to 4) | Middle (GDS 5) | Late (GDS 6 to 7) |
| --- | --- | --- | --- |
| Smallest type | 18 pt, always bold | 18 pt, always bold | 24 pt, always bold |
| Thinnest line | 2.25 pt | 3 pt | 4.5 pt (art 6 pt) |
| Word search | 12 or 15 square, across, down and diagonal | 8 square at most, across and down, guided | none |
| Other puzzles | word ladders, anagrams, sorting grids, odd one out, ordering | the same, with more given (the first letter, an example), forced choices | one large thing to look at or do |
| Look of the page | detailed | simplified | one subject, nothing else on the page |

The type floors and line floors are the same on the packet form and in the
Packet Builder (`early / moderate / advanced` there). A page that would break
one is drawn again with a different seed, up to twelve times, and then
refused with a plain reason. A page is never printed that is under the floor.

`CM.allowed(stage, kind, tool)` says whether a kind is made for a stage.
The Packet Builder greys out a stage that is not offered for the chosen
activity and starts on the first one that is. The activities in this table
are the ones the rulebook knows.

| Kind | Early | Middle | Late | Tool |
| --- | :-: | :-: | :-: | --- |
| search-large (12 or 15 square word search) | yes | | | both |
| search-guided (8 square, across and down) | | yes | yes | both |
| ladder (word ladder) | yes | | | both |
| anagram (with a clue) | yes | yes | | both |
| sorting (two groups) | yes | yes | | both |
| oddone (odd one out, words or pictures) | yes | yes | | both |
| sequence (put it in order) | yes | yes | yes | both |
| choose-ending (choose the ending of a phrase or recipe) | yes | yes | yes | both |
| matching (a picture to its name, 1950s and 1960s subjects) | yes | yes | yes | both |
| maze (large-print maze, 6 px at the late stage) | yes | yes | yes | builder |
| pathtrace (follow a wide path) | | yes | yes | both |
| orientation (day, season and weather) | yes | yes | yes | both |
| silhouette (an iconic shape in a mandala frame) | | yes | yes | both |

The older Packet Builder activities are held to the same floors by style
rules in `builder.html` (see below). The older word search is not offered at
the late stage, and its middle stage grid is 8 square.

## The page shell

Every printed page, from either tool, carries the same frame. All of it is
pure black on white and inside the 0.5 in safe area.

* **Header.** The resident's name on the left, the date and the wing on the
  right, then a 3 pt rule. A page with no name prints "Name:" and a line to
  write on.
* **Body.** From 64 pt to 706 pt from the top (the page is 792 pt tall).
* **Clinical tip.** One tip, in at most two lines, for the person sitting
  beside the resident: "Clinical Tip: Offer, never insist." Tips come from
  eight frameworks (motor, Montessori, validation, errorless learning,
  reminiscence, communication, sensory, environment) and are chosen by the
  resident's name, the date and the page, so a page keeps its tip all day and
  the next page has another. The tip is 10 pt, which is for the staff, never
  the resident.
* **No tip of its own.** The staff pages (answer key, notes, for-staff pages) carry the coaching reminder in the tip's place: "Do not ask questions or test memory. Sit beside them, place the marker in their hand, and model slow, calm breathing."
* **Footer.** A 2.25 pt rule, "Cognicopia" on the left, "Page X of Y" in the
  middle, the stage on the right.

Nothing is drawn within 0.5 in of the paper's edge. The 0.75 in binding side
is kept on the side that is bound, so no page is closer than that to its
binding edge.

## Same name, same day, same packet

Everything random in a packet comes from one stream, `CM.dailyRng(name, date,
variant, salt)`. It is seeded from the resident's name and the date (and,
inside an activity, from the activity and its place in the packet). The same
resident gets the same packet all day, tomorrow's packet is different, and
nothing about a page changes between a preview and the print. "Make another
version" adds one to the variant, and the first one is one tap back.

In the Packet Builder the older activities take their seed from the same
place, so a batch is the same for the same name and day too, and a different
"version" number gives different pages.

## Dignity

Every word on a page goes through `CM.dignity.lint`. It stops memory quizzing
("do you remember", "test your memory"), right and wrong scoring ("which
answer is wrong"), pet names and baby talk, child-directed words, and war and
death subjects. Adult subjects are used: tools, gardens, music, the kitchen,
cars, the radio. The page checker also stops any text that carries a stray
token (`undefined`, `null`, `NaN`).

## How the Packet Builder holds its older pages to the same floors

The older activities in `builder.html` are written as HTML sheets. Four
things keep them inside the rules:

1. **A style sheet** (`<style id="clinical-floor">`) sets `--ml` (thinnest
   line) and `--fl` (smallest type) from the stage class on the sheet, and
   every border, rule and small label reads them. At the advanced stage
   every character is bold. Staff lines (answers, the tip, the footer) are
   10 pt and above.
2. **`enforceStrokeFloor`** runs when the sheets are numbered. It measures
   every drawn line at the scale it prints at and thickens any that is under
   the stage's floor.
3. **`fitHtml`** lays each sheet out off screen. A sheet whose activity runs
   past the page is tightened, spacing first and never the type, in up to
   three steps (`fit-1`, `fit-2`, `fit-3`).
4. **`sheetHtml`** wraps the whole thing in an error boundary. An activity
   that cannot be drawn prints a plain page that says so, and the rest of the
   packet prints as usual.

The coloring pages follow the same rules. A library page printed in a packet gives up its conversation line (it moves to the staff line as "Talk about it, if welcomed") to make room for the shell, so the picture keeps the size its tier rules were measured at; a hybrid coloring page is drawn in a frame that stops above the tip. The resident's name line is never under the stage's floor (bold at the late stage).

The other printed products of the packet tool follow the same rules: the ailment packets (vascular, Lewy body, frontotemporal, late-stage and Korsakoff) end every page above the tip and take the stage's floor and the late stage's bold; the monthly bundle's word searches are 12 square at most in the early stage, 8 in the middle stage and 6 in the late stage.

High Contrast (every packet) prints in pure black and white: light fills stay
white, dark ones turn black, and `numberSheets` writes "Page X of Y" on every
sheet.

## Checks

`node scripts/check-clinical.mjs` runs about 42,000 checks:

* the stage rules (floors, strokes, grid sizes, safe area, shell);
* every kind at every stage it is made for, on fourteen different days and
  names: it draws, it passes the page checker, the same name and day make the
  same page, another version makes another, nothing is under the floor,
  nothing fails the dignity filter;
* what each kind promises: grid sizes and directions, words that are really
  in the grid, ladders that change one letter, anagrams that unscramble, mazes
  that run corner to corner, paths that do not cross themselves;
* the two engine files make no request, read no clock, draw no random number;
* `index.html` and `builder.html` load the files in order, make no network
  call, seed the packet, wire every kind in and cache the engine for offline
  use (`sw.js`).

The checks that look at real PDFs (type size, line width, colour, margins,
overlaps, "Page X of Y" on every page) were run on the output of both tools
with a browser and PyMuPDF; they are not part of `npm test` because they need
a browser.
