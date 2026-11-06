# Activity Page Studio

`activity-studio.html` (Studio menu). One screen that makes a printable page for a resident from their stage: a settings panel on the left, the page as it will print on the right. Everything is made in the browser. A first name typed there is drawn on the page and kept nowhere; nothing is stored and nothing is requested from outside.

## The three files

| File | Job |
|---|---|
| `js/generators/activity-engine.js` | What goes on a sheet. Stages 1 to 3, three hand settings, the 1940s to 1980s, and four kinds of sheet. Returns plain sheets; draws nothing. |
| `js/generators/coloring-pipeline.js` | Lays a sheet out on a 3:4 page of 1200 by 1600 points and writes it as SVG (preview and print) or canvas (PNG and PDF). Also makes the coloring pages. |
| `components/packet-generator-ui.js` | The screen: controls, live preview, Back and Next, Print, Download PDF, Download PNG. |

## What it makes

- **Reminiscence prompts**: things from the chosen decade (on the road, around the house, music, familiar faces, at the table) offered as invitations ("Let's talk about the diner jukebox"), never as questions with a right answer. A birth year suggests the decade the resident was about twenty. Interests typed in are added; topics to avoid are never used.
- **Thinking exercises**: pairs that go together, sorting into two groups, a winding path to follow. At stage 3 only look-and-enjoy (one finished picture and its word) and the path.
- **Daily living steps**: a familiar task (make tea, water the flowers, feed the birds, fold a towel, set the table, brush your hair) in six, four or three steps, with a library picture where one exists.
- **Coloring pages**: a finished drawing from the library with a thick outline. Six styles (Cozy-Spooky, Vintage Americana, Botanical Gardens, Classic Animals, Simple Architecture, Kitchen and Baking), or a few words, which choose among the library through `src/engine/DescribeCreate.js`.

## The master inventory: nine kinds of activity

The first four kinds above are the studio's own. `js/generators/activity-modules.js` adds the rest of the master clinical inventory to the engine's router (`CognicopiaActivityEngine.register`), and `js/generators/activity-pages.js` draws them. Each is made for a stage and left out of the others, with a plain note.

| # | Kind | Stage | What it is |
|---|---|---|---|
| 1 | Word grids and look-back | 1, 2 | A large-print word search from the resident's decade or former work (ten kinds of work), mixed-up words with the first letter in place, and "a look back": dated facts as conversation starters. The staff panel shows the answer key. |
| 2 | Timeline sorting | 1, 2 | Five (or three) events from the resident's years, or the chapters of a life, to number from earliest to latest. |
| 3 | Memory pairs | 1, 2 | Pairs of library drawings to cut out, in rows and columns, with dashed cut lines. |
| 4 | Guided dialogue | 1, 2, 3 | One theme (Sunday dinner, a first car, the kitchen radio...), a ladder of questions by stage (open questions, then two, then a single sensory line), a line to note each answer and a response log for the care record. |
| 5 | Household matching | 1, 2 | Library pictures of household things to match to their names, and materials to what they make (flour, bread). |
| 6 | Sayings and song lines | 1, 2 | The start of a proverb or an old song line to finish; at stage 2 the endings are in a box to choose from. |
| 7 | Coloring | 1, 2, 3 | The coloring pages (above); the staff panel now carries a question to ask while they color. |
| 8 | Shapes and colors | 2, 3 | Shapes to match face up; one shape and two very different choices to point to; color names with something to find. Plain geometry, printed in black and white. |
| 9 | Rhythm and word tickets | 2, 3 | A word to feel and a short line of verse, for the sideways cards and tickets. |

Every poem and song line is from a work published in 1928 or earlier, so it is free to print; the verse carries its author and year, and `scripts/check-activity-studio.mjs` fails on a later one. The dated facts are ones a facility can check in a minute.

**Suggested packet for this stage** sets the content mix for the stage in one click (stage 1: word grids, timeline, memory pairs, dialogue and coloring; stage 2: dialogue, household, phrases and coloring; stage 3: coloring, shapes and colors, rhythm tickets and dialogue). With the stage and Compile Packet PDF, a packet is three clicks; the browser check makes exactly those three clicks and reads the PDF back.

Pages in a packet are ordered so that neighbors come from different domains (remembering, thinking, a meaningful role, creative expression, sensory and calm), so even a four-page packet is varied.

## What the stage changes

| | Stage 1, mild | Stage 2, moderate | Stage 3, advanced |
|---|---|---|---|
| Body type | 20 pt | 24 pt | 32 pt |
| Smallest type | 18 pt | 20 pt | 24 pt |
| Line | 3 pt | 4.5 pt | 6 pt |
| Ideas on a prompt page | 4 | 3 | 2 |
| Pairs | 5 | 3 | none (look and enjoy) |
| Steps | 6 | 4 | 3 |
| Coloring | border, open question | border, completion line | no border, fine detail left out |

Limited grip adds 1.5 pt to every line and about 15 percent to type, with one item fewer; little control adds 3 pt and 30 percent, with two fewer.

## The page

3:4 is exactly the printable area of US Letter inside 0.5 in margins (7.5 by 10 in, 160 px to the inch). Lines are set in points and converted once, so the thinnest line on any page is about 6.7 px (3 pt). Everything is pure black on white. A binding gutter of 0.75 in alternates sides for two-sided printing.

Layouts: one full page, four cards (2 by 2), six cards (2 by 3), or five wide tickets. Cards and tickets have dashed cut lines. Matching, sorting, the path and the coloring picture are always full pages.

Every page code (for example `ASM-R-4WZG.1`) holds the stage, the kind of sheet and the seed, so the same page can be made again; New variation changes the seed.

## What it does not do

- It never draws a new subject from words. The owner's rule is that no subject is drawn in code and no picture service is called, so words choose among the finished drawings (34 so far) and the note says which words were used and which were not. Simple Architecture and Kitchen and Baking have few drawings until more join through the owner's art tool (`docs/local-art-agent.md`).
- Cozy-Spooky is the gentle half: a friendly pumpkin, owl, lantern and cat. Nothing frightening, as the dignity filters require.
- The PDF holds 300 dpi page pictures, not live text. Print (and Save as PDF from the print window) keeps real text.
- It does not read the saved resident profiles yet; the controls are typed in.

## Checks

`scripts/check-activity-studio.mjs` (in `npm test`) proves the sheets and pages without a browser: every module, stage, hand setting and layout; same seed, same page; stage 3 has less than stage 1; topics to avoid; no quizzing; 3:4; black and white; no line under 6 px; no text under its stage's floor; nothing off the page; offline. `scripts/check-activity-studio-ui.mjs` (in `npm run build`) proves the screen in a real browser, reads the PDF back with PyMuPDF, checks the PNG size, prints, and measures 52 px controls and a phone.

The validator and the print and offline utilities beneath it are described in [facility-validation.md](facility-validation.md).

## Hand-lettered name (the nameplate)

The first name can be lettered three ways, chosen on the page: Plain, Flowing script (Pinyon Script) or Formal script (Marck Script). The choice is the person's; the studio never guesses it from a name, and the profile holds no gender field. Script names sit under the title with the line "Prepared with care for" (on coloring pages, above the page code). Both faces are open-licence files kept in `fonts/` (licences beside them) and in the service worker's list, so they work offline. The name is shrunk to fit a long name and never goes below the stage's type floor. Print stays pure black on white. `scripts/check-activity-studio.mjs` covers every stage, dexterity and style.
