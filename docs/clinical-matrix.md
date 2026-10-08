# The clinical matrix and the activity engine

Both packet tools, the packet form on `index.html` and the Packet Builder on
`builder.html`, print from one rulebook and one set of page makers:

| File | What it is |
| --- | --- |
| `src/engine/ClinicalMatrix.js` | The rulebook. Stage rules, which activity is made for which stage, the page shell, the dignity filter, the clinical tips, the seeded random stream, the page checker. |
| `src/engine/ClinicalActivities.js` | The page makers. Thirteen kinds of page, each drawn as a page model that every output (PDF, SVG, sheet) reads. |
| `scripts/check-clinical.mjs` | The tests. Part of `npm test` and `npm run build`. |

Both files run in the browser and in Node. They make no network request, read
no clock, use no browser storage and never call `Math.random`. Nothing a care
team types leaves the computer.

## The three stages

| | Early (GDS 3 to 4) | Middle (GDS 5) | Late (GDS 6 to 7) |
| --- | --- | --- | --- |
| Smallest type | 14 pt | 18 pt | 24 pt, always bold |
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
