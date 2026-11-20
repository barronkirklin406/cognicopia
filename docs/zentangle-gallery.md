# Zentangle Gallery

The owner's Zen Tangle coloring books, kept exactly as drawn, on one shelf inside the Packets door (Packet Builder, "Zentangle Gallery", address `builder.html#/zentangle`). Built November 20, 2026.

## What is in it

A book is on the shelf only when its Canva title says **Interior** and also **ZTC** or **Zen Tangle**. Only the coloring designs are kept. Left out, on the owner's instruction:

- every cover (any title that says Cover or Hardcover) and the duplicate hardcover versions of Reptiles and African Rhino;
- the "Color Test Page" pages (a grid of empty ovals);
- the "Zen" and "Zen Tangle Coloring" title pages and the "This Book Belongs To" page;
- the crown pages of the owner's other brand (Baron Crafts, "BarronCraft");
- blank pages, and the "If you enjoyed this book" last page;
- books whose title lacks "Interior" or lacks the series name (for example Cats, Independence Day, Gray Aliens, Jungle Zen and the unfinished Winter book). Tell the owner if one of these should come in: it needs a line in `BOOKS` in `scripts/build-zentangle.mjs` and the same two passes below.

Orcish and Zombie Nation carry a "Preview before offering" note on the screen, because some residents and families will not want those subjects.

## The pictures

Each page is a pure black and white, lossless WebP 1656 pixels wide and about 3:4 (most are 1656 x 2160; Ocean Life was drawn on a slightly taller page, 1656 x 2225, and keeps it) in `assets/zentangle/<book>/NN.webp`, with a small gray picture in `assets/zentangle/<book>/t/NN.webp`. They are not remade, resized to a stage or changed in any way; the library's three-tier rule does not apply to them (the owner's decision), so they are the most detailed kind of page only. The screen says so and points to Cognicopia Coloring for bolder lines and larger areas.

## How a book is made (the owner's computer or a session; nothing here is on the live site)

1. Export the book's PDF from Canva (letter size, pro quality).
2. `python3 scripts/zentangle-pages.py book.pdf <slug>` keeps the pages that are line art, drops blank, dark, colored and test pages and writes the WebP pages and small pictures.
3. `python3 scripts/zentangle-clean.py <slug>` takes out the Color Test Page and the front-matter pages (brand, title, belongs-to) that step 2 cannot tell from a design, and renumbers.
4. Look at a contact sheet of the first and last pages. Add a line for the book to `BOOKS` in `scripts/build-zentangle.mjs`, then `npm run zentangle`.

`scripts/check-zentangle-gallery.mjs` (in `npm test`) checks the files; `scripts/check-zentangle-ui.mjs` (in `npm run build`) opens the gallery in a real browser, reads every small picture and fails on a cover, a blank page, a color test, a brand or a title page.

## Adding to a packet

Every page can be added to the packet queue for the resident chosen in "Working with" (or for no one): "Add the chosen pages to the packet", with "Copies of each" (1 to 6; a page's copies sit together). Pages of different books, and pages of Cognicopia Coloring (which has the same "Copies of each"), share one queue and print together as one packet. Adding spends nothing; printing the packet counts as one packet.

Pages from the Activity Page Studio join the same queue: its "Add all pages to the packet" and "Add this page to the packet" (with "Copies of each") put the finished pages into the Packet Builder's queue for the resident chosen in the Studio (`js/studioQueue.js`, `scripts/check-studio-queue-ui.mjs`). A queued Studio page keeps its own finished picture, and the staff answer page is never added. A Packet Builder tab that is already open keeps its own list until it is reloaded.

## Printing

A chosen page is set alone on US Letter, inside the 0.5 in margins and clear of the 0.75 in binding gutter, through `BookUI.print`. It counts as one packet (a page for a resident or family), never a staff document. The print window opens only after every picture has loaded (it used to open at once and show a blank preview).

## Offline

The script and the book list are in the service worker's list. A page picture is copied the first time someone opens it, so a book is available offline only after it has been viewed on that computer. The whole shelf is not downloaded in advance (about 150 MB).
