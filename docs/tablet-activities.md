# Tablet Activities

`tablet.html` is a main menu of touch-first activities for a tablet, a touch monitor or a phone. Hand the tablet to a resident, or sit side by side. It is on the front page (the **Tablet Activities** button beside Make a packet), in the menu bar under **Today**, and at `cognicopia.org/tablet.html`.

It needs no internet once the page has loaded, asks for no name, and keeps nothing about anyone. The only things the browser remembers are the three choices at the top (level, topic and sound) and the free-packet count, the same count the packet tools use.

## The thirteen activities

| Group | Activity | What a finger does |
|---|---|---|
| Words and letters | **Word Search** | Slide along a word, in either direction, or tap its first and then its last letter. The word lights up and is ticked in the list. A hint flashes the first letter of a word still to find. |
| | **Crossword** | Tap a square, then tap letters on the keyboard that appears on the screen (letters in order, A to Z, with Back). One clue at a time. "A letter" fills in one correct letter. The computer's own keyboard works too. |
| | **Spell It** | A clue and empty slots. Tap the letters. At the middle and late stages the first letter is given. |
| | **Finish the Saying** | Choose the word that finishes it. |
| Follow and create | **Trace the Path** | Touch the green dot and slide along the dotted line to the gold circle. A trail shows how far the dot has come. **If the finger slips off the line, turns back, or lifts, the dot goes back to the start.** Four paths a round. |
| | **Color a Picture** | Choose one of six pictures from the coloring library, choose a color, tap a shape. Undo, Start over, Another picture. |
| | **Finger Paint** | Paint freely in ten colors and three brush sizes. Undo and Clear. |
| | **Bubbles** | Tap the drifting bubbles to pop them. No score, no timer. People who ask their device for less motion get still bubbles that reappear when popped. |
| Think and match | **Sort It** | One word at a time and two big buttons: which group does it go with? |
| | **Put It in Order** | Tap the steps of an everyday job in the order they happen. |
| | **Match the Clue** | Tap a word, then the clue that goes with it. |
| | **Odd One Out** | Three go together; tap the one that does not. |
| | **Sights and Sounds** | A card to look at and talk about: what you might see, hear, feel or smell. |

**Level** (Early, Middle, Late stage) makes each activity gentler as it goes on: fewer words and smaller grids, a word search that reads straight across, wider paths to trace, two choices instead of three, the first letter given, fewer steps and pairs. **Topic** picks what the words are about (farming, music, cooking and 39 more); "Anything" gives a surprise each time. Every puzzle is new each time: the same engine that makes the printed packets makes them, so a word search never holds a second copy of a word, a crossword never has an accidental word, and every clue passes the same dignity rules.

Every activity has a **Menu** button (and Escape) to leave, **New one** for another puzzle, and **Read to Me**, which uses the device's own voice (it works with no internet where the device has a voice installed).

## How it behaves

- **Calm.** A right answer gets a soft chime and a short word such as "Lovely!". A wrong one gets a gentle sentence ("Good thought. Here is how it goes.") and the right answer is shown. There is no red, no buzzer, no timer, no score and no "wrong". The screen's words pass the dignity filter (`scripts/check-tablet.mjs` runs every sentence through it).
- **Big.** Every control is at least 52 px tall and wide; the activity buttons are 60 px, keyboard keys 56 by 60 px, word-search squares at least 52 px. On a smaller screen the puzzle gets smaller (a 6 by 6 grid instead of 10 by 10) before a control gets smaller. On a landscape and a portrait tablet nothing needs scrolling.
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
| `js/tablet.js` | The screen: the menu, the shell, and each activity's touch handling |
| `scripts/check-tablet.mjs` | In `npm test`: every puzzle at every level and topic, the trace rule for every shape, the screen's words, the offline wiring |
| `scripts/check-tablet-ui.mjs` | In `npm run build`: a real browser drives all thirteen activities with mouse and touch input, at three screen sizes |

## Adding an activity

Write a builder in `js/tabletEngine.js` (data only), a screen function in `js/tablet.js` with the signature `function name(root, options, api)`, an icon, and one row in `GROUPS`. `scripts/check-tablet.mjs` insists on the icon and the screen function; add the builder to its loop and drive the screen in `scripts/check-tablet-ui.mjs`. Keep the sentences calm: the check refuses "wrong", "quiz", "easy" and anything the dignity filter bans.
