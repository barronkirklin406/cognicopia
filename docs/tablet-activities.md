# Tablet Activities

`tablet.html` is a main menu of touch-first activities for a tablet, a touch monitor or a phone. Hand the tablet to a resident, or sit side by side. It is on the front page (the **Tablet Activities** button beside Make a packet), in the menu bar under **Today**, and at `cognicopia.org/tablet.html`.

It needs no internet once the page has loaded, asks for no name, and keeps nothing about anyone. The only things the browser remembers are the choices (level, topic, sound, bubble speed, color set and paper) and the free-packet count, the same count the packet tools use. The sounds, the pictures and the puzzles are all made on the tablet itself: nothing is downloaded while it runs.

## The thirteen activities

| Group | Activity | What a finger does |
|---|---|---|
| Words and letters | **Word Search** | Slide along a word, in either direction, or tap its first and then its last letter. The word lights up and is ticked in the list. A hint flashes the first letter of a word still to find. |
| | **Crossword** | Tap a square, then tap letters on the keyboard that appears on the screen (letters in order, A to Z, with Back). One clue at a time. "A letter" fills in one correct letter. The computer's own keyboard works too. |
| | **Spell It** | A clue and empty slots. Tap the letters. At the middle and late stages the first letter is given. |
| | **Finish the Saying** | Choose the word that finishes it. |
| Follow and create | **Trace the Path** | A bee goes to a flower, a train along its track to a station, a dog to its bone: slide a finger along the wide glowing lane. The marker glides after the finger and **always stays on the lane**. A finger that wanders off leaves it waiting; lifting the finger leaves it where it is; going back costs nothing. Nothing is ever sent back to the start. The arrow keys move it for someone who cannot use a finger. Three journeys a round, a different scene each time. |
| | **Color a Picture** | Choose one of more than a hundred pictures from the coloring library (eight at a time, and **More pictures** for others), choose a color set (Soft, Bold, Garden or Vintage, eight named colors each), choose a color, tap a shape. The tap fills the whole shape and **the color can never leave its lines**: the shapes are found on the picture itself, so every picture in the library works, and a tap on a line colors the shape beside it. Undo, Start over, Another picture. **Finish for me** colors what is left. A hint softly glows the next shape. |
| | **Finger Paint** | A big sheet of paper (parchment, wood, canvas or white) and a finger. Four brushes (**Soft**, **Chalk**, **Wash** for watercolor, and **Blend**, which smears what is already there), four sizes, the same four color sets. Undo takes the last stroke back; Clear can itself be undone. A resting palm is not a second brush. A pen's pressure changes the width. |
| | **Bubbles** | Bubbles drift up the screen, bump each other gently and pop with a soft chime and a ripple that nudges the ones nearby. No score, no timer, no count. **Slower** and **Faster** change the float (Very slow to Lively) and are remembered. People who ask their device for less motion get still bubbles that reappear when popped. |
| Think and match | **Sort It** | Two baskets, each with a picture, and a tray of pictures (fruit, farm animals, pets, plants and flowers, things to wear, tea time, around the house, ways to travel, music makers). Drag a picture to its basket, or touch the picture and then the basket. A picture that goes in the other basket floats gently back with a soft note, a plain sentence about where it does go, and that basket glows. |
| | **Put It in Order** | The steps of an everyday job (38 jobs, with a picture on many), mixed up, and numbered places. Touch a step, or drag it: it goes to the next free place when it is the next thing that happens, and floats back, with a soft note, when it comes a little later. |
| | **Match the Clue** | Pictures down the left, clues down the right. Touch a picture and then its clue (or a clue and then its picture), or drag a clue onto its picture. A pair that fits locks with a tick and the clue settles under its picture. |
| | **Odd One Out** | Four pictures; three belong together. Touch the one that does not. A touch on one that belongs sets it aside with a kind word; a second try makes the odd one glow; when it is found, the other three are named. More than fifty different decks (a set against a set of another kind), each drawn freshly every time. |
| | **Sights and Sounds** | A board of pictures (bird song, a train whistle, a guitar, a purring cat, a thunderstorm, church bells, wind chimes, ocean waves, an old telephone). Touch one and its sound plays while a moving wave shows it. Or choose **Which one is it?**: a sound plays and the picture that goes with it is the one to touch. A picture that is not the one plays its own sound, so nothing is lost by trying. The sounds are synthesized in the browser (no recordings). |

**Level** (Early, Middle, Late stage) makes each activity gentler as it goes on: fewer words and smaller grids, a word search that reads straight across, wider paths to trace, two choices instead of three, the first letter given, fewer steps and pairs. **Topic** picks what the words are about (farming, music, cooking and 39 more); "Anything" gives a surprise each time. Every puzzle is new each time: the same engine that makes the printed packets makes them, so a word search never holds a second copy of a word, a crossword never has an accidental word, and every clue passes the same dignity rules.

## The same frame on every activity

| Button | What it does |
|---|---|
| **Home** (and Escape) | Back to the menu, from anywhere. |
| **Finish for me** | Always there, softly glowing. Completes the activity for the person with a gentle celebration: a medal, a chime and a little confetti. It never takes longer than twelve seconds. |
| **Next** | A fresh activity at once, and one that does not repeat what was just on the screen. Nothing is scored, nothing is lost. |
| **Read to Me** | Reads what is on the screen with the device's own voice (no internet needed where the device has a voice installed). |
| a hint | After fifteen seconds with no touch, the right place glows: the next letter, the correct card, the way along the path. Any touch starts the fifteen seconds again. |

The menu also has **Surprise me**, which opens an activity chosen by the tablet, never the same one twice in a row.

## How it behaves

- **Errorless.** A right answer gets a soft chime and a short word such as "Lovely!". A choice that does not fit gets a gentle sentence, a soft rising note (never a buzzer) and, where a card was moved, the card floats back to where it was. There is no red anywhere, no game over, no timer, no score and no "wrong". The screen's words pass the dignity filter (`scripts/check-tablet.mjs` runs every sentence through it, and `scripts/check-tablet-ui.mjs` looks for red on every screen).
- **Big.** On a tablet every control in the frame is at least 72 px tall and wide (56 px on a phone, never under the site's 52 px floor). Every activity meets 72 px throughout, and `scripts/check-tablet-ui.mjs` holds all thirteen to it (the `BIG` list). On a smaller screen the puzzle gets smaller before a control gets smaller. On a landscape and a portrait tablet nothing needs scrolling.
- **Glass, and clear.** The bar and panels are frosted white glass with a firm green edge, so the words on them stay as dark and clear as on paper. All text reaches 7:1 (AAA) against its background, by day and in Night Shift; `scripts/check-tablet-ui.mjs` measures it on every screen.
- **One task at a time.** Each activity fills the screen and the rest of the page is out of reach while it is open.
- **High contrast without relying on blue.** Dark ink on cream, deep green controls, gold and sage highlights. A found word is marked with a tick and a line through it in the list, and an underline in the grid, not only a color.
- **Counts like Tablet Mode.** Starting a session uses one of the free packets (once per visit, however many activities are played), as Tablet Mode in the packet tool does. A licensed computer has no limit. When the free packets are gone, a plain screen with a link to the plans appears instead.

## The packet tool's own Tablet Mode

A tablet session built from one resident's own life (their hometown, work and favorite things) is still in the Personalized Packet Tool: choose **Launch Tablet Interactive Mode**. It opens on its own main menu (Word Search, Finish the Thought, Let’s Talk) so the resident chooses what to do, and the Menu button at the top brings it back at any time. This page is the general menu; that one is personal.

## Files

| File | Role |
|---|---|
| `tablet.html` | The page: menu, setup, the activity screen and the free-packet gate, with its own styles |
| `js/tabletEngine.js` | The puzzle makers, for every activity, from the PCG content and puzzle makers (`src/pcg`). Pure data in, data out; the trace rule (`follow`) lives here so it can be proved without a screen |
| `js/tabletKit.js` | Shared helpers (making elements, a card that glides to its place, dragging with a finger, a glow for hints) and the list the menu is built from |
| `js/tabletArt.js` + `assets/tablet/` | Every picture: a finished Canva illustration (one transparent PNG each), cut from sheets by `scripts/make-tablet-pictures.py` |
| `js/tabletSound.js` | The sounds, synthesized with Web Audio, and the check that renders each one |
| `js/tabletWords.js`, `js/tabletCreate.js`, `js/tabletThink.js` | The activities, each registered with the kit: words and letters; trace, color, paint and bubbles; sort, order, match, odd one out and sounds |
| `js/tabletBanks.js` | The data the activities draw on: word packs, crossword clue sets, sayings, the picture sets that go together (`SETS`), the clues for each picture and the picture for each everyday job |
| `js/tablet.js` | The screen: the menu, the frame every activity runs in (Home, Finish for me, Next, hints) |
| `scripts/check-tablet.mjs` | In `npm test`: every puzzle at every level and topic, the trace rule for every shape, the screen's words, the offline wiring |
| `scripts/check-tablet-ui.mjs` | In `npm run build`: a real browser drives all thirteen activities with mouse and touch input, at three screen sizes |

## It never ends on a 404

`404.html` is the page GitHub Pages shows for any address that is not a file. A tablet address (`tablet.html` in any spelling) sends the visitor to `index.html#tablet-fallback`, which opens Tablet Interactive Mode inside the packet tool, so the Tablet Activities button never ends on an error page. `sw.js` does the same for a visitor whose browser has the site saved: a 404 for a tablet address is answered with that redirect, and a saved copy of a page is kept over a 404. The front page's button is written `./tablet.html`. `scripts/check-tablet-route.mjs` (in `npm run build`) proves the four cases in a real browser: the page opens, the page is missing, the address is mistyped, and some other page is missing.

If the button ever 404s on the live site, the file is missing from the branch that GitHub Pages publishes: check that `tablet.html`, `js/tablet.js` and `js/tabletEngine.js` are on `main`.

## Adding an activity

Write a builder in `js/tabletEngine.js` (data only), a screen function with the signature `function name(root, options, api)` in one of the activity files, and register it with `Kit.register({ id, group, order, title, blurb, icon, start })`. Give it `api.assist(fn)` (what Finish for me does), `api.hint(fn)` (what glows after fifteen quiet seconds) and `api.used(ids)` (so Next does not repeat it); the checks insist on all three. `scripts/check-tablet.mjs` insists on the icon and the screen function; add the builder to its loop and drive the screen in `scripts/check-tablet-ui.mjs`. Keep the sentences calm: the check refuses "wrong", "quiz", "easy", "score" and anything the dignity filter bans.
