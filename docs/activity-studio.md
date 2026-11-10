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

## Names and places from a resident's life

The form takes a short list of single words from the resident's own life: family names, a pet, a hometown, a first car, a pastime. With three or more, the first word grid in a packet is "Words from your life": the resident's own words are placed first, then period words fill the rest. A word too long for that stage's grid is left out rather than cut, a word on the avoid list is left out, and anything but letters is dropped. The words are typed for one packet, printed on the sheet and kept nowhere: nothing is stored and nothing leaves the browser. `scripts/check-activity-studio.mjs` covers both stages, every dexterity and five seeds.

## The bigger word search (early stage)

An early-stage reader who wants a real workout can be given a full 20 by 20 grid of 20 words, running in all eight directions, backward ones included. It is offered at stage 1 only, and the box greys out at the other stages. Where a less steady hand has to circle the words, the grid steps down so the cells stay big enough to mark: 18 by 18 with 16 words, or 16 by 16 with 14. The words come from the resident's own list first, then their decade, their former work and the decades either side.

**Why not 25 by 25 or 30 by 30.** Measured, not guessed: the stage's large-print floor is 18 pt, which is 40 px on the 1200 by 1600 page. Inside the 0.5 in margins a 20 by 20 grid leaves a 46 px cell, so a 40 px letter has room. At 25 by 25 the cell falls to 33 px and at 30 by 30 to 28 px, so the letters would have to shrink below the floor or print on top of each other. The word list moved to four columns to buy the height for 20 by 20; past that, the only way to go bigger is to drop the large print, which the print standards do not allow. `scripts/check-activity-studio.mjs` holds the floor and the crowding guard, reads every word back out of the grid along the direction its answer key gives, and proves backward and slanting placements are really used.

## Why the letter grid is set in a monospaced face

Every letter in a word search is centred in its own cell, so the column centres were always exact. But Atkinson Hyperlegible is a proportional face: an "I" is 11 px wide where an "M" is 39 px. Measured in a browser, that left the gap between neighbours swinging between 7 px and 28 px, and a column's letters starting up to 10 px apart from one row to the next, so the grid read as crooked (the owner spotted it on a printed 20 by 20 sheet, November 7, 2026).

The grid is now set in **Atkinson Hyperlegible Mono**, the monospaced cut of the same face from the Braille Institute, instanced at bold and kept locally in `fonts/AtkinsonHyperlegibleMono-Bold.woff2` with its licence beside it. Every capital takes the same width, so the columns line up exactly. Measured again: the gap between neighbours varies by 0.5 px and a column drifts 0.3 px. Only the grid letters use it; titles, word lists and everything else stay in the usual face. `scripts/check-activity-studio-ui.mjs` measures the real glyph boxes in a browser and fails if a gap varies by more than 2 px or a column drifts more than 2 px.

## The staff answer key

A box on the form adds an answer key at the end of the packet: every page that has answers, listed with the word and where it starts ("STUDEBAKER: row 14, column 8, going right"). It is marked "For staff. Keep this page out of the resident's packet," it paginates itself when a packet has many answers, and it is left out of the clinical readiness score, because it is not an activity for the resident.

## The form: three steps up front, the rest tucked away (November 9, 2026)

The form used to be one long panel (28 visible controls, 3,095 px tall, measured on the old page). It is now three numbered steps and three closed sections (5 visible controls, 1,540 px):

1. **Who is this for?** A list of saved residents, a first name, and a Save button.
2. **How much support?** Cognitive stage and motor dexterity.
3. **Make the packet.** "Suggested packet for this stage" and "Try different pages". The preview on the right is live, so there is no separate "generate" button (it was removed as redundant).

Closed by default, opened by a heading: **Their life and interests** (year born, reminiscence years, former work, interests, topics to avoid, words from their life, how the name is lettered), **Choose the pages yourself** (content mix, pages, coloring style, layout) and **Printing and staff options** (the bigger word search, the staff answer key, the binding gutter).

### Saved residents, where the packet is made

The list reads the same sealed store as the roster and the profile form (`cognicopia_resident_<id>`, AES-256-GCM, with the facility's passphrase prompt if one is set), so a person saved anywhere appears here.

- **Pick** a resident and the form fills in: name, year born (and so the reminiscence years), stage, former work, interests, topics to avoid, and words from their life (family and pet first names, and the hometown). The page in the preview carries their name at once.
- **Edit and Save** writes back only what this form shows and leaves the rest of the profile alone (room, hometown, hobbies, the people list, other notes). Interests and words from their life are kept as two labelled lines in the profile's notes, because the full profile form has no field for free-text interests and would otherwise lose them; a topic the person no longer avoids is removed, and one still avoided stays.
- **"A new person"** starts clean: nothing of the last resident carries over (the stage and dexterity stay, because they belong to the packet being made). Saving then makes a new resident.
- **Open the full profile** opens the profile page in a new tab, so the packet keeps its place.
- On arrival the Studio starts on the resident the other tools last chose. After 15 idle minutes the page forgets who was chosen and starts clean (`js/sessionTimeout.js`); nobody saved is deleted.

Proved with seeded made-up residents in a real browser: `scripts/check-activity-studio-ui.mjs` (161 checks), including a round trip through the full profile page.

### A link that was broken

The profile page opens a person from `profile.html?edit=<id>`. The Packet Builder's roster "Edit profile" link used `?resident=<id>`, which that page does not read, so the link opened the profile page without opening the person. It now uses `?edit=`.

## The free trial in the Studio (November 9, 2026)

The Studio used to show "Free Trial: 50 / 50" and then never counted a packet or stopped anyone, so anyone could make unlimited free packets there. It now behaves like the Packet Builder and shares its count (`CogniTrialLedger`, kept in the same sealed store):

- **Counted:** printing, and making the PDF, each use one free packet. The preview, changing a setting and "Try different pages" use none.
- **Not counted but held:** "Save page image" is stopped when the free packets are used up, but does not use one.
- **The line and the badge:** the line beside the buttons ("37 of 50 free packets left. Printing or making a PDF uses one.") and the badge in the action bar read the same count.
- **When all 50 are used:** print, PDF and page image open a window that says so, offers the plans (`pricing.html`) and a place to enter a license key, and make nothing. The preview keeps working.
- **Licensed:** a real signed key means no limit, no counting and no window ("Licensed: unlimited packets.").

Proved in a real browser by `scripts/check-studio-trial-ui.mjs` (24 checks, in `npm run build`), which mints a real signed key from a throwaway key pair.

## Foundations for more personal pages (November 10, 2026)

Step 1 of the plan the owner approved on November 10 (more personal activities, a quick daily screen, sharper PDFs, a residents folder). Nothing a person has to learn changed; the pages got fuller and the rules behind them got stricter.

### One reader of a saved resident

`js/residentContext.js` (`window.CogniResident`) is the one place that turns a saved profile into a plain description of the person: name, the years they were 15 to 25, the decade they turned twenty, stage and GDS range, former work, hometown in parts, family by generation (with "has passed away" kept, so a page a visitor holds can leave someone out), music, pastimes, the optional parts of a life story, and the words to keep off a page. It guesses nothing: a field the profile does not hold comes back empty. It reads from the storage it is handed and never writes. The Studio uses it now; the older tools keep their own readers until they are moved over.

**A fault it fixed.** When a resident had a topic ticked in their profile (for example "War and combat"), the Studio showed the tick's label in "Topics to avoid" and looked for those exact words, so it kept nothing off the page. A ticked topic now shows by a short name ("war", "Korean War") and stands for the topic's whole word list, the same lists `src/engine/ClinicalMatrix.js` holds. Typing a topic's name in the Studio and pressing Save ticks that topic in the profile.

**Whole words.** Avoiding "war" used to remove "warm" and "award" as well. Matching is by whole word now; a plural, a possessive and the -ing, -ed and -er forms still count ("garden" keeps out "gardening").

Proved by `scripts/check-resident-context.mjs` (35 checks) and a browser check with a control (the same pages with the field emptied do mention the word).

### Pages that are full, and calm

Two rules pull against each other, and a page now has to meet both:

- **No large empty band.** `PL.validate` fails a page that leaves more than 420 px (2.6 in) of its height empty. The first run found real faults: a middle-stage reminiscence page for someone with little hand control was one idea and then 889 px of nothing, and at the late stage the word tickets page could filter every line away and print a title over an empty sheet.
- **Calm.** The facility validator wants half of a page of words left empty (55 percent at the late stage). The page engine now measures this itself (`PL.whiteShare`, the validator's own grid, proved identical on every page of words) and grows a page's type only as far as the page stays calm.

What changed on the paper: each idea on a reminiscence page fills its share of the sheet and its type grows to suit (on an early or middle page each idea is a framed card, with a line or two to write on when there is room); the matching page's two columns stand in frames and its words grow with the room; the room under a dialogue question is ruled for the answer.

**Titles.** A page title is never under 32 pt (it could shrink to 28.8 pt). A sheet of cards to cut out carries an instruction, not a title.

### A page of several items

A new kind of sheet, `blocks`, for the pages still to come: a page lists two to five parts (a large prompt, choices to circle, lines to write on, sentence openings, two columns to join, a short list, numbered steps, dated moments down a line, frames for people, and a strip for staff at the foot) and the composer shares the height among them, grows the type as far as stays calm, and says so in words when a page is asked to hold more than fits or more than stays calm at its stage. How much a page holds goes down with the stage: four parts early, two or three in the middle, one or two late.

### One rule for printed song lines

The tools stated four different cut-off years and two lists carried no year. There is one rule now: a song or hymn line is printed only when the work was first published in 1930 or earlier (public domain in the United States since January 1, 2026) or is traditional; anything newer appears by title, artist and year. `scripts/check-public-domain.mjs` (105 checks) reads every list in five tools. The front page's Finish the Line list and the Tablet's sayings now carry the year of each song.
