# Instant Soothe and the shared packet engine

Instant Soothe is for the moment a resident is distressed and staff need something calming in their hands within seconds. It is also the front door every other generator now shares. Everything is drawn on this computer, from a library that ships inside the page. There is no request, no outside library, no API.

## What the caregiver sees

1. Press the yellow **Instant Soothe / Print** button in the top bar (or **Sundowning / Rapid De-escalation** in the Packet Builder). Nothing prints yet.
2. A small, high-contrast dialog (`#instant-soothe-modal`) asks for two things. The last answers are already chosen, and the big button has the focus, so **Enter** is enough.
   - **1. Soothe Intensity / Cognitive Level**: **A** Mild / Early (deeper historical trivia, word association, detailed line art), **B** Moderate / Mid (simple reminiscence cues, thick-line motor paths, bold coloring), **C** Acute / Late (sensory grounding, ultra-bold motifs, rhythmic breathing or tactile paths).
   - **2. Reminiscence Theme**: **A** Calming Nature & Gardens, **B** Classic Home & Heritage (1940s to 1970s), **C** Music, Crafts & Nostalgia, **D** Random / Surprise Mix.
3. **⚡ Generate & Print Instant Packet** makes a fresh one-to-three page packet, prints it, and takes the hidden print stage down again. With a resident active it starts from their level and prints their name, and the prompts lean toward the years they were young (birth year + 10 to + 35, kept inside 1901 to 1989) and away from their topics to steer around.

## The library

| Part | File | Size |
|---|---|---|
| Reminiscence prompts, 1901 to 1989, each with a short cue, the senses it touches, an optional historical fact and its years | `src/engine/SoothingContent.js` | 130 prompts, 53 with a fact, every decade covered |
| Calming puzzles: word searches of calming words, "which do you like" choices, finish-the-familiar-phrase | `src/engine/SoothingContent.js` | 42 (20 + 14 + 8) |
| Procedurally drawn line-art motifs (each at a bold, simple and detailed level) | `src/engine/SoothingArt.js` | 32 |
| Tactile and motor tracing paths (a wide lane with a GO and an END, never folding over itself) | `src/engine/SoothingArt.js` | 18 |
| Grounding and breathing lines, the clinical tips for the person beside the resident | `src/engine/SoothingContent.js` | 12 and 14 |

Every line a resident reads passes the same adult-dignity filter as the rest of the site and the quiz-word ban (nothing that asks them to remember, nothing childish). Nothing is fetched: it is all in the page.

## How a packet is made (`src/engine/SoothingPacketEngine.js`)

Two steps, so a packet can be replayed exactly.

- `choose({ stage, theme, seed, history, era, avoid, count })` decides what goes in. The stage sets the plan: the early stage gets a reminiscence invitation (often with a historical fact), a word search, a picture or a path; the middle stage a simple invitation, a bold picture or wide path, and now and then a guided puzzle; the late stage a path or one bold picture to trace and one large cue, never a puzzle. Then it picks the prompt, picture, puzzle and path.
- `compose(plan, { name, date, wing })` draws the plan: one page model per page, held to the stage's rules in `ClinicalMatrix.js` (the same rulebook as every other page), with the header, the clinical tip and "Page X of Y".

The same plan always draws the same pages; a different seed draws a different packet. The engine itself reads no clock, no storage and no random function.

### Never the same twice

`ProceduralPacketEngine.js` gives each print a new seed from the browser's secure random source, and remembers what was printed in `cognicopia_soothe_history` as a list of library ids for each pool (prompts, motifs, puzzles, paths, grounding lines, tips), oldest first. A list holds as many ids as its pool has items. `choose` takes anything not on the list before anything that is; once a pool is used up it starts again from the one used longest ago. With a mixed theme "anything" reaches across themes before it repeats; with a chosen theme it stays in the theme. `scripts/check-soothing.mjs` runs 60 prints in a row for every stage and theme and checks that nothing repeats until its pool is used up.

## Type, lines and margins

- Resident-facing words are never under 18 pt, and are 24 pt bold at the acute / late level. Staff words (the clinical tip, the header and the foot) are small, as on every Cognicore page.
- Lines never fall below the stage's floor from the rulebook: 2.25 pt (early), 3 pt (middle), 4.5 pt (late); motor lanes are 4.5 to 6 pt. This is deliberately **not** 2.5 pt at the late stage: a thinner line at that stage is harder to see and to follow with a hand that shakes.
- Pure black (`#000`) on white, no grey, no hairlines.
- Letter paper, 8.5 x 11 in. The drawing sits 0.65 in from the left (the clipboard and binder side) and 0.5 in from the other three edges.

## Printing (`src/engine/ProceduralPacketEngine.js`)

1. The pages are drawn as SVG into a hidden `#print-stage`, one `.ps-sheet` per page (8.5 x 11 in, `padding: .5in .5in .5in .65in`).
2. The print waits (up to 3 seconds) for the embedded Atkinson Hyperlegible face, so what prints is what was measured.
3. `body[data-print="soothe"]` hides everything but the stage, an `@page { size: 8.5in 11in; margin: 0 }` rule is added, and `window.print()` is called.
4. On `afterprint` the stage, the `@page` rule and the title change are removed. Starting another print also cleans up first.

The sheets set `text-rendering: geometricPrecision`: without it Chromium rounds glyph widths at small sizes and a bold label can touch the sentence after it.

## One front door for every generator

`window.ProceduralPacketEngine` (also `window.CognicopiaProceduralPacketEngine`):

| Call | What it does |
|---|---|
| `quickStep(cfg)` | the two-choice dialog; resolves `{ stage, theme, action }` or `null` |
| `generate(o)` | a fresh packet (`stage`, `theme`, `name`, `date`, `era`, `avoid`, `count`); records what it used |
| `print(packet, opts)` | the hidden stage, the print window, the clean-up |
| `instantSoothe(o)` | dialog, packet, print; `o.context` lets another generator supply a resident |
| `configure({ context, licence, notify })` | what the page knows: the active resident, the free-packet gate |
| `register(kind, fn)` / `run(kind, o)` | generators registered by name |
| `History`, `Last`, `entropy()`, `eraFromBirthYear()` | the history, the last choice, a new seed, a birth year as an era |

Where each generator uses it:

- **Instant Soothe** (index.html top bar and active-resident card; Packet Builder rapid de-escalation button): the dialog, then print. Same free-packet allowance as before, counted once per print.
- **Packet Builder**: a new activity, **Instant Soothing Set** (Multisensory, Art & Group). The stage is the difficulty already chosen; the theme is an option. When pages are added to the packet their choice is frozen into the packet item, so reopening or reprinting gives the same sheet; printing adds it to the history so the next set differs.
- **Ailment-Specific Activities** (Vascular, Lewy Body, FTD, Late-Stage, Korsakoff): each now asks the two questions first and adds one fresh calming page at that level and theme. The condition's own pages keep the settings made for that condition.
- **12-Month Life Planners**: **Add a fresh calming page for the binder**, with the resident's name, years and topics to steer around. It is separate from the planner pages, so it never changes their count or the book-binding page parity.

The old fixed two-page rapid de-escalation packet remains only as a fallback if the engine script does not load.

## What this does not do, on purpose

- It does not use a 2.5 pt line at the late stage (see above).
- The other generators keep their "same resident, same day, same packet" behavior (a caregiver reprinting this morning's packet gets the same pages). Only the soothing set, Instant Soothe and the ailment calming page are different each time.
- The ailment packets' own pages keep their condition-specific settings; the new choices apply to the calming page that is added.

## Checks

`npm test` runs `scripts/check-soothing.mjs` (about 6,700 checks): the library sizes and years, the dignity filter on every word, every motif and path, 216 packets across every stage and theme that pass the rulebook and read 18 pt or more, replay of a plan, different packets for the same resident twice, no repeats over 60 sequential prints, the ids-only history, the engine files making no request, the print rules and sheet measurements, the dialog's pickers and button, and the wiring in `index.html`, `builder.html` and `sw.js`. `npm run build` runs it too.
