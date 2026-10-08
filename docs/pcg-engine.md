# Today's Packet: the procedural content engine

Cognicopia builds a five-page packet for a resident from what the care team
typed about them. It does not pick from a fixed list of worksheets. It
assembles each page from small modular parts (items, sentence patterns,
puzzle makers) under three rules: the same resident gets the same packet all
day, tomorrow's packet is different, and the layout never moves.

Everything runs in the browser. The engine files make no network request,
read no file, use no browser storage and never call the browser's own random
function. What the care team types never leaves the computer.

## What a person sees

The **Today's Packet** card on the packet tool (`index.html`) reads the
resident form, shows the five pages in a line each, lists the action prompts
for staff, and offers three buttons: download the PDF, copy the prompts, make
another version (a second packet for the same day, one tap back to the
first).

| Page | Always | What changes |
| --- | --- | --- |
| 1 | Word Search | the words, the grid |
| 2 | the conversation page | open talk (early), lines to finish (middle), look-and-feel cards (late) |
| 3 | the puzzle | a crossword (early, middle) or one thing to look at together (late) |
| 4 | Color Page | a bold-line picture or a mandala |
| 5 | For Staff: Today's Packet | why these topics, action prompts, answers |

Every page also carries the clinical shell (name, date and wing, a clinical tip, "Page X of 5") and holds the stage's type and line floors; see `docs/clinical-matrix.md`. The crosswords are small on purpose: a clue number is never under the type floor (14 pt early, 18 pt middle), so a cell is at least 26 or 34 pt and the grid and its clues have to fit one page.

Page titles, page order and the position of everything on a page are fixed.
Only the content moves.

## Files

```
src/pcg/
  data/                    the content, as JSON a person can edit
    topics.json            42 topics (the graph) and 38 tags
    items/*.json           228 items in six packs
    grammar.json           sentence patterns, page titles, staff prompt patterns
    profile-map.json       how typed words become topics, and how eras weigh in
    safety.json            filler letters, word blocklist, banned sentence rules
  schema/*.schema.json     one JSON Schema per data file
  prng.js                  seeded generator, date seed, rotation
  matrix.js                profile -> topics -> tags -> pools -> the day's focus
  grammar.js               slot expansion, articles, plurals, dignity lint
  puzzles.js               word search and crossword makers
  packet.js                the five pages, the staff prompts, the counts
assets/pcg/pcg-data.bundle.js   the data, validated and frozen into one script
scripts/build_pcg.mjs      validates the data against the schemas, writes the bundle
scripts/check-pcg.mjs      the test suite (about 18,800 checks)
src/engine/ColoringEngine.js    page 4 (adds composeMandala)
index.html                 the card and the PDF (search for pcg-ui)
```

Load order in the page: the bundle, then `prng`, `matrix`, `grammar`,
`puzzles`, `packet`. Each file attaches to `window.CognicopiaPCG`. The same
files load in Node through `vm`, which is how the tests run them.

Edit a JSON file, then run `npm run pcg` (writes the bundle) and `npm test`.
`npm run pcg:check` fails if the bundle is out of date.

## The data (JSON schemas)

**topics.json** holds the interest graph and the tag registry.

```
tags:   [{ id, label, decade?: true, generic?: true }]
topics: [{ id, label, keywords[], phrases?[], implies[], neighbors[], general?: true }]
```

`keywords` and `phrases` are how typed words find the topic. `implies` lists
the tags the topic stands for (a farmer is `rural`, `utility`, `outdoors`).
`neighbors` are the topics exactly one step away; the engine treats them as
undirected.

**items/\*.json** holds the things packets are about.

```
{ id, name, aka[], plural, kind,
  topics[], tags[],                 // 1950s Ford pickup: cars | 1950s mechanical rural utility
  subject?,                         // a drawing in the coloring library
  parts[],                          // "big rear tire", "tailgate"
  senses: { color[], sight[], sound[], touch[], smell[] },
  terms[],                          // "TRACTOR|A strong farm machine that pulls a plow"
  completions?[],                   // "Peanut butter and|jelly"
  facts?[] }
```

**grammar.json** holds the sentence matrices.

```
pools:     named lists used to fill slots ({part}, {color}, {they_seem}, ...)
stages:    per stage: templates [{ id, text, kinds?, presume }], intros, bank labels
ui:        page titles and instructions (the anchors)
caregiver: staff prompt templates [{ id, role, text, requires? }]
```

A template such as `Tell me about a time you fixed {a_part} on {the_item}.`
carries `presume: 2`, so it is used only when the profile names the item
outright. `What made {a_item} so dependable?` carries `presume: 0` and can be
used for any item.

**profile-map.json** sets field weights (work 1.0, hobbies 1.0, favorite
things 0.85, pets 0.9, first car 0.55, hometown 0.2), the matching rules
(exact, plural, one-letter misspelling, phrase), the pool sizes and the
reminiscence-bump curve (ages 10 to 30 count fully; an item from outside the
resident's years is dropped).

**safety.json** holds the filler alphabet for word searches, a blocklist of
words that must never appear in a grid, and the sentence rules every
generated string must pass (no memory-quizzing words, no war or death, no
childish words).

## Logic flow

```
form  ->  profile (matrix.readProfile)
            typed words -> topics (own topics, weighted by field)
            birth year  -> years -> era weights per decade
            avoid list  -> removes entries, topics and items before anything else
      ->  three disjoint pools
            own      items from the resident's own topics           (level 1 or 2)
            cross    items sharing an implied tag with an own topic (level 0)
            tangent  items from a topic one step away              (level 0)
      ->  the day's focus (matrix.focusFor)
            one item from each pool, by seeded rotation
      ->  the stage matrix (packet.js) picks page forms and difficulty
      ->  grammar fills sentence patterns, lint checks every string
      ->  puzzles build the word search and crossword from the day's seed
      ->  staff prompts are written from the pages that exist
      ->  pcgPdf() draws the five pages
```

### 1. Procedural tagging

- **Grammar matrices.** `Tell me about a time you fixed {a_part} on {the_item}`
  with 228 items, about 900 parts and the sentence variants makes thousands
  of distinct sentences; the sentence is chosen by the day's seed.
- **Cross-pollination.** A 1950s Ford pickup is tagged `1950s`, `mechanical`,
  `rural`, `utility`. A resident whose profile says "farming" implies `rural`
  and `utility`, and who was a teenager in the 1950s, so the pickup enters the
  cross pool and can show up in the word search, the conversation page or the
  coloring page, even though its own topic is cars.
- **Fuzzy matching.** A resident who lists "dogs" always has dogs in the
  packet, but the cross pool also brings in items that share the `animals`
  and `outdoors` tags (a cozy cat basket, a vet bag, a pet carrier), and the
  tangent pool brings in items from the topics next to dogs in the graph
  (cats, veterinarian, parks, farm animals: a park bench, a bandstand). The
  rotation spreads the days across all three pools, so the packet drifts to
  cats or the park now and then instead of repeating the same dog. A tag
  counts for more when it is rare (inverse document frequency), so a shared
  `pets` tag pulls harder than a shared `outdoors` tag.

### 2. Clinical alignment

The stage is chosen by the caregiver on the form (and the "Good Day / Bad Day"
switch). The engine never infers it. It changes the form of each page, not
only the topic.

| | Early (mild) | Middle (moderate) | Late (advanced) |
| --- | --- | --- | --- |
| Focus | active recall and strategy | guided completion | sensory and visual anchoring |
| Word search | 15 x 15, across, down and diagonal, 14 words | 8 x 8, across and down, 6 words | 6 x 6, across only, 3 words |
| Page 2 | open questions, a fact with a follow-up, lines to write on | 5 familiar lines to finish, with a box of words | 3 large cards of 10 words or fewer |
| Page 3 | crossword of about 5 words (9 square at most), clues, box of words | crossword of about 4 words (8 square), first letters filled in | one picture to look at together |
| Page 4 | bold-line picture or mandala (3 pt lines) | the same (4.5 pt lines) | mandala (6 pt lines), no area smaller than a tenth of a square inch |
| Sentences | may presume what the profile names | familiar completions only | no questions |

The wording avoids testing: instructions say "Circle each word", never "How
many can you find", and there is no scoring.

### 3. Seeded freshness

`prng.js` holds the whole mechanism.

- A string hash (cyrb128) feeds a small fast generator (sfc32). Each page
  draws from its own stream, forked from the day's seed by name, so changing
  one page never moves another.
- The daily seed is `firstname|YYYY-MM-DD`, with `|vN` for a second packet.
  The day comes from the calendar date in the resident's own time zone, not
  from a timestamp, so a clock change or a crossing of midnight UTC cannot
  move it.
- **Stability.** There is no stored state. The same name and date give the
  same bytes at 8 AM, 2 PM and after a reload. The test suite generates
  packets repeatedly and compares them.
- **Freshness.** Each rotating choice walks a shuffled cycle of its pool, one
  step a day, re-shuffled when it runs out. Every item comes up once per
  cycle, and the seam between two cycles is mended so an item never returns
  within a quarter of a cycle of its last use. Day *d* and day *d+1* never
  share the featured item. Yesterday's puzzle words are also left out.

### 4. Anchored variation and caregiver injection

- **Layout as an anchor.** `packet.js` always returns pages of type
  `wordsearch, talk, puzzle, coloring, staff` in that order with fixed titles;
  `pcgPdf()` places every element from the stage's size table and never
  reorders. The checks fail if a title or the order changes.
- **One degree of separation.** The tangent pool contains only items from
  topics adjacent to an own topic in `topics.json`. A teacher gets playground
  games and packed lunches; aviation is not adjacent and cannot be reached.
  The tests verify every surprise item over thousands of packets.
- **Caregiver action prompts.** `grammar.json > caregiver` holds templates by
  role (hook, talk, connect, puzzle, color, comfort, wrap). Each is filled from
  the day's pages and names the page and the item or word actually on it: "Ask
  her about the picnic basket on Page 2 as the evening settles in." A prompt is
  written only if what it points to exists (the resident's name is a word-search
  anchor only when it fits the grid, so the "point to the name" prompt is
  dropped when it does not). The card lists them, and **Copy action prompts**
  puts them on the clipboard as plain text for a note or a message.

## How many packets

The card shows the number of different packets possible for the profile. It
is computed as: choices of featured, companion and surprise items x choices of
word-search words x sentence variants x crossword word sets. It does not count
where letters land on the grids, which would multiply it much further. For
typical profiles the figure is in the billions to quintillions; the test suite
requires at least a million.

## Dignity and privacy rules the tests enforce

- Every generated sentence passes `safety.json` (no "remember", "recall",
  "forget", no war or death content, no childish words, no scoring language).
- Anything on the avoid list is removed from entries, topics, items, word
  lists, clues and sentences.
- Word searches contain only the listed words (no second reading in any of
  eight directions) and nothing from the blocklist.
- The PDF is pure black on white. Coloring lines are at least the stage
  minimum.
- The engine files contain no `fetch`, `XMLHttpRequest`, `sendBeacon`,
  `WebSocket`, `Math.random`, `Date.now` or storage call, and the tests run
  them in a sandbox where those throw.
- The only things the card stores are the free-packet counter and, for the
  day, a hash of the "another version" choice. No name or date is stored.

## Limits worth knowing

- Profile reading is keyword matching with plurals, one-letter misspellings
  and phrases. It is not language understanding. A hobby the topic graph has
  no word for adds nothing; the "How today's packet was chosen" panel shows
  what was matched so a person can add a clearer word. With nothing matched
  the packet uses familiar everyday topics.
- The "Add a topic for today" box is how a caregiver injects an interest that
  is not in the profile.
- War, combat and medical content are deliberately absent from the item packs.
- The stage is the caregiver's judgment. The engine adjusts the form of the
  pages to it and makes no clinical claim.
- Pronouns come from the form's "Words to use for them" menu. Check it.
- Coloring pictures come from the existing coloring library. A late-stage
  "look together" page shows a drawing only when one of the day's items has
  one; otherwise it shows the item's name in large type.
