# Memory Digest & Book (Heirloom)

`src/services/heirloomService.ts` (built to `assets/services/heirloomService.js`, global `CogniHeirloom`) keeps a resident's months for their family. Its screen is **Memory Digest & Book** in the Packet Builder (`#/heirloom`), and it has three tabs.

## Keep a memory

Staff record a memory as it happens. There are four kinds:

- **In their own words**: what the resident wrote or said (their journal).
- **A story they shared**: often from a reminiscence card. **Keep what they shared** on a card opens this form with the card already filled in.
- **Something they colored**: which CogniCore page it was, the tier, and a photo of the finished page.
- **A moment to remember.**

Every entry prints exactly as typed. Each can be marked **Share with family** (on by default) or kept for the care team only.

**Where they are kept.** Entries are sealed in the encrypted store under `cognicopia_heirloom_<resident id>`. Photos are handled like this:

- The browser turns each photo upright and shrinks it to at most 1600 px, as a JPEG.
- Each photo is sealed in the store's separate photo store under `cognicopia_heirloom_photo_<id>`.
- Photos are read only when a page needs them, so opening a page never decrypts them all.
- They are re-encrypted when the passphrase changes and cleared by a wipe.
- They are refused, rather than kept in plain storage, in a browser that cannot encrypt.

## Monthly digest

One month's shared memories go on Letter paper with the punch gutter:

- a cover, with the resident's name, the month and a CogniCore picture;
- the memories by kind, their own words first.

Staff can print it or download a PDF for the family. In the PDF, the text is Atkinson Hyperlegible and the line art is vector paths; photos are JPEG. Each page draws in a few milliseconds, well under the 150 ms budget.

## Hardcover book

A run of months becomes a print-on-demand interior and a cover spread.

**Interior**

- **Order:** title page, dedication, then a chapter per month. Each chapter opens on a right-hand page under a soft band that runs into the bleed.
- **Padding:** "Notes and memories" pages bring the book to the printer's minimum page count and an even total.
- **Closing page:** a colophon at the back.

**Page size and margins**

| | |
|---|---|
| Trim sizes | 8.5 × 11, 8.25 × 11, 8.5 × 8.5, 7 × 10, 6 × 9 in, offered per printer |
| Bleed, Amazon KDP | 0.125 in on the outside edge, top and bottom. The PDF page is the trim width + 0.125 in by the trim height + 0.25 in. |
| Bleed, Lulu and others | 0.125 in on all four sides |
| Gutter | 0.75 in on the bound edge. Right-hand pages are bound on their left, left-hand pages on their right. |
| Other margins | 0.5 in safe area on the other edges |
| Minimum pages | 75 for the KDP hardcover profile, 24 for the others |

The gutter is never smaller than 0.75 in. That meets the common minimums (0.375 in up to 150 pages, 0.5 up to 300, 0.625 up to 500, 0.75 up to 700) and grows to 0.875 in beyond 700 pages.

**Cover.** A cover's size depends on the printer's boards and paper, so it is set from the printer's own template. Staff enter four numbers: full width, full height, spine width, and the wrap and bleed. The spread is laid out as back panel (dedication), spine (title, reading top to bottom) and front panel (title, subtitle, picture), with every word inside the safe area and off the spine folds.

A starting estimate is shown (0.0025 in a page plus 0.25 in for boards, and 0.75 in wrap), clearly marked as an estimate. The preview shows the folds and wrap line; the PDF has no guides.

Printers change their specifications, so check the interior and cover against the printer's current guidelines and template before ordering.

## Checks

**`npm test`** (`scripts/check-services.mjs`) covers:

- entries cleaned and never reworded;
- digests holding only shared entries, with every word exact;
- the gutter table and page padding;
- bleed geometry for each printer;
- every plan item inside its page's safe area, for every printer and trim;
- chapters opening on right-hand pages;
- drawing as text, vector art and JPEG, and escaping;
- cover panels and safe area.

**A Chromium run with PyMuPDF** checked real PDFs:

- Letter digest pages;
- a 24-page 8.75 × 8.75 in interior with all text in the safe area on both sides;
- a 19.2 × 10.25 in cover with the spine title centered in the spine;
- Atkinson Hyperlegible embedded throughout;
- the private entry absent.
