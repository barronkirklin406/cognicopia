# Design system: one stylesheet, every page

Cognicopia's look comes from one file, `css/styles.css`, that `scripts/site-nav.mjs` links into every page (run `npm run nav`; never add the link by hand). It gives the site one palette, two typefaces, a spacing rhythm, a focus ring, gentle motion and the print standard for a coloring sheet. This page says what is in it, why, and how each claim is measured. The numbers here are not typed from memory: `scripts/check-design-system.mjs` re-computes them from the stylesheet on every `npm test`, and `scripts/check-design-ui.mjs` proves them in a real browser on every `npm run build` where Playwright is installed (it says so and skips where it is not).

It is for Activity Directors and families, often reading on an older screen in a bright room, and for residents who see only the printed pages. So the choices are plain words, large type, a 52 px floor for anything a finger must hit, an AAA (7:1) target for text, a focus ring you cannot miss, and motion that stays out of the way.

## How it fits with the pages

Every page keeps its own inline styles (the site is static HTML on GitHub Pages and works from a folder, with no internet). So the shared file is written to sit **beneath** them:

- Shared rules use `:where()`, which has no specificity, so a page's own rule always wins and nothing here can break a layout.
- Three things are deliberately stronger, and are named in the file: `html.cg-ds` (a page that **opts in** to the editorial type and the spacing rhythm), the `.cg-*` classes that components new in this system use, and the print rules for a coloring sheet (they are the print standard).
- The pricing, activation, contact, journal, planner and Zentangle pages opt in (`<html class="cg-ds">`). The packet tool (`index.html`) maps its own `--ds-*` tokens onto the `--cg-*` tokens, so its colors come from here without a rewrite.
- The Packet Builder's PDFs and the packets themselves are made by their own code and are not touched. The face the packets print in is a separate, embedded copy of Atkinson Hyperlegible; the screen face is named "Cognicopia UI" so the two can never replace each other.

## Color

Built on the four brand colors the Quality Standards Hub already names (green `#1b382b`, parchment `#f4efe6`, gold `#c5a059`, charcoal `#1a202c`), with natural greens, warm tans and crisp neutrals around them. Every token is `--cg-<name>`.

| Family | Tokens |
|---|---|
| Natural greens | `green-950` `#0b1a13`, `green-900` `#10241a`, `green-800` `#162d21`, `green-700` `#1b382b` (the brand green), `green-600` `#2d5a44`, `green-500` `#3f7a5c`; sage `100` `#e3f1e8`, `200` `#c9e4d3`, `300` `#9fcbb0` |
| Warm tans | `parchment` `#f4efe6` (the brand parchment), `tan-100` `#ebe3d3`, `tan-200` `#ddd1ba`, `tan-300` `#cdbe9f`, `tan-400` `#b5a48b`, `tan-600` `#7a6548`, `tan-700` `#66523a`, `tan-800` `#4f4030`; gold `500` `#c5a059` (the brand gold), `300` `#e8cc8a`, `200` `#f1dda8` |
| Crisp neutrals | `charcoal` `#1a202c`, `ink-soft` `#343b49`, `white` |
| Warm accents (the light pages) | `cream` `#fbf7f1` (a page), `peach-100` `#fbe9dc` (an icon tile), `peach-200` `#f6cdb4` (the hero's glow, decoration only), `clay-700` `#8a3a20` (one terracotta accent word) |
| Meaning | `danger-800`, `danger-200`, `ok-800`, `ok-200`; the focus ring `focus` `#f5b800` and `focus-dark` `#10241a` |

### What reaches AAA (7:1)

| Text | On | Contrast |
|---|---|---|
| white | the four dark greens | 12.7 to 17.9 |
| sage 100 | the four dark greens | 10.9 to 15.4 |
| sage 200 | the four dark greens | 9.4 to 13.3 |
| gold 300 (gold you can read on green) | the four dark greens | 8.2 to 11.5 |
| charcoal | parchment, tan 100, tan 200 | 10.8 to 14.2 |
| ink-soft | parchment, tan 100, tan 200 | 7.4 to 9.8 |
| green 700 | parchment, tan 100, tan 200 | 8.4 to 11.1 |
| white | tan 700 (a page frame), green 600 | 7.4, 7.9 |
| danger 800, ok 800 | parchment | 8.7, 8.0 |
| charcoal, ink-soft, green 700 | cream, white | 15.3 to 16.3, 10.5 to 11.2, 11.9 to 12.7 |
| clay 700 (terracotta) | cream, white | 7.3, 7.8 |

The check fails the build if any pair in that list drops under 7:1; the weakest text pair in the system is **7.4:1**.

Parts that are not text (borders, icons, the ring) need 3:1: gold 500 and tan 400 on a green (5.2 to 6.7), green 600 on parchment (6.9). **Gold 500 and tan 400 are never used for small text on a green: they are AA there, not AAA.** Use gold 300 for that.

These are the system's own pairs. Older page text that predates it is held to AA (4.5:1) by the browser audit (`npm run audit:ux`), which fails the build below that. Moving a page's own colors onto the tokens is how that page can reach AAA, one page at a time.

## Type

Two typefaces, both open-licensed, both files in `/fonts` (no font service, no request, cached for offline use by `sw.js`).

- **Atkinson Hyperlegible** (Braille Institute, SIL OFL) for the interface, as "Cognicopia UI", regular and bold. Its letters are drawn to be told apart, which is the point of a tool for people with low vision.
- **Fraunces** (Undercase Type, SIL OFL) for headings: a warm, editorial serif. One variable file, Latin only, weights 400 to 700; headings use 600.

Three `.woff2` files, about 100 KB in all, with `fonts/OFL-Fraunces.txt` beside them (the Atkinson license already ships). A page that opts in gets headings in Fraunces and body text in the interface face, a type scale that grows with the window (body text is 16 px and up; the one smaller step, 15 px, is for labels and short captions such as the value cards' detail lines), a 1.6 line height, and a line length of about 62 characters. Stacked blocks in a page's main are one step (24 px) apart.

## Space, shape and depth

- **Space:** a 4 px rhythm in steps people can feel, `--cg-space-1` (4 px) to `--cg-space-9` (96 px).
- **Shape:** three radii used everywhere, so nothing looks accidental: 6, 12 and 20 px, plus a pill.
- **Depth:** three soft shadows, never theatrical.
- **Touch:** `--cg-tap` is 52 px, the floor in [blueprint-decisions.md](blueprint-decisions.md) D7. `.cg-btn` is never smaller.

## How it feels to use

- **Focus.** A 3 px bright outline set 3 px off the control, with a dark band filling the gap between them. The two bands exist because one of them always meets 3:1 on whatever is behind it: the yellow on a green, the dark band on parchment (the yellow alone is only 1.6:1 on parchment). It shows for the keyboard and for text fields, not for a mouse click on a button, and it is kept in forced-colors mode (the system's Highlight). A control that has a class with its own `box-shadow` must keep the dark band itself, as `.cg-btn` does; a class beats the zero-specificity ring, and the browser check found exactly that.
- **Press and hover.** Buttons ease their color, border and shadow in 0.12 to 0.2 seconds and move **one pixel** when pressed, the way a real key does. A `.cg-btn` lifts its shadow on hover. Disclosures fade open.
- **Reduced motion.** If the person has asked for less motion, nothing slides, fades or drifts: transitions and animations become instant, the press does not move, in-page links jump instead of gliding, and the layers below stand still.
- **Scroll-driven layers.** Two soft pools of light sit behind the page and drift at different speeds as it scrolls (9 and 18 percent of the window height, over the whole page). They are decoration only: behind everything, taking no clicks, painted at most 7 percent strong, so on the system's page background (green 800 or darker) white text stays above 12:1, pale-sage text above 10:1 and gold above 8:1 at the strongest point of a layer (the browser check reads the painted pixels back). A card on green 700 is opaque, so they never reach it. They move only where the browser supports CSS scroll-driven animation (no script runs for them) **and** the person has not asked for less motion; otherwise they stay still. They are off in Night Shift and in print.

## Components new in this system (opt in with the class)

`.cg-btn` and `.cg-btn-quiet` (52 px minimum, parchment or outlined), `.cg-card`, `.cg-eyebrow` (a small uppercase label), and `.cg-values` with `.cg-value` (the four reasons to use the packet tool, with a small outline icon each). The packet tool's first screen carries those four: made from the resident's own life; ready for your printer (pure black on white, binding margin); no resident data leaves this computer; free to begin (the first 25 packets cost nothing, no sign-up). On a 1366 x 768 window the first two are fully on the first screen; on a 390 x 844 phone the first one is. Both are measured.

## The navigation bar (every page but the Packet Builder)

`scripts/site-nav.mjs` writes the same six hubs into every static page. On a window 1100 px or wider they run across a light top bar: the logo and name on the left, Today, Studio, Activity Packets, Facility, Academy and Resources as drop-downs, and Contact on the right. Under 1100 px the same markup becomes the Menu drawer (a deep green Menu button, the hubs stacked, the one holding the page open). It is one structure at every width (an `<aside>` with the hubs as `<details>`), so the keyboard, a screen reader and the checks meet the same thing.

- **Behavior.** No drop-down is open as a page opens; the hub that holds the page carries a deep green underline. Clicking a hub opens it and closes any other; Enter and Space work; Escape closes it and leaves the keyboard on the hub; a click elsewhere or moving the keyboard on closes it. The bar stays at the top while the page scrolls (76 px tall). The logo is cropped to its drawing (the file is a full page with the drawing small in the middle) and shown at 84 x 60 px.
- **The action bar** (License Key / Promo and the two buy buttons, and on the packet tool Instant Soothe and Night Shift) sits under the bar. It scrolls away on every page except the packet tool, where Instant Soothe has to stay in reach.
- **Resources** opens a wide panel with the library in its three groups.
- **Colors.** Charcoal on white (16.3:1); the current hub in deep green; drop-down links 52 px tall; the two-band focus ring. Night Shift turns the bar, the drop-downs and the action bar dark brown with cream text, on every page, whether or not the page runs the Night Shift script.
- **The Packet Builder keeps its own side menu.** It is a working screen with its own categories and queue; its six hubs are the same.

## The front page (index.html)

The packet tool's first screen follows a classic product page: a hero in two columns, a row of what you get, the evidence, then the tool, then a footer. Every word on it was already on the page; only the arrangement and the look are new.

1. **Hero** on cream with a soft peach glow: the tagline "Engaging Today" in clay, the heading with "one resident's own life." in clay, the lede, a deep green **Make a packet** button (it scrolls to the tool) and **See what you get**. Beside it, a laptop (lid, camera, keyboard deck) whose screen shows the packet tool's own "Fit the Words In" page: the crossword the engine makes for a made-up resident (Ruth, born 1938; gardening, big-band music, a river town; middle stage; 1 October 2026), laid out as the printed page is, with numbered cells, the first letters, the clues and the box of words. The screen is one inline SVG written by `node scripts/landing-example.mjs` from the engine's real output, and `--check` (in `npm test` and `npm run build`) fails if the engine ever makes something different, so the picture cannot drift into a drawing of something the tool does not do. The gold cornucopia sits in the blank space between the heading and the laptop (on the laptop's corner where the columns are narrow), and a "Large print, pure black on white" card hangs below the deck. The picture is decoration (`aria-hidden`) and is left out on a phone.
2. **What Cognicopia gives you:** the four value cards, side by side. On 1366 x 768 all four are on the first screen; on a 390 x 844 phone the first one is (both measured by `scripts/check-design-ui.mjs`).
3. **Informed by the research:** five Research Center summaries as links, and a quote card with the publisher's own statement (Kirk Barron, Publisher, BarronCrafts). No client logos and no testimonials: the template had them; Cognicopia does not invent them.
4. **Make a packet:** the privacy promise, then the tool exactly as before, in its deep green band.
5. **Footer:** the brand line, and Tools, Facility and Resources columns (every link 52 px tall), with the contact line.

## Coloring sheets: the print standard as CSS

`@page cg-coloring` is US Letter with no page margin; `.cg-coloring-sheet` draws the margins itself: **0.5 in** on three sides and a **0.75 in binding gutter** on the left, pure black on white. A picture drawn by `js/coloring.js` gets a tier class on its `<svg>` and the stylesheet draws the line weight for it:

| Tier | Line | In px | |
|---|---|---|---|
| tier-1 | 3 pt | 4 | the floor: no line is ever thinner |
| tier-2 | 4.5 pt | 6 | |
| tier-3 | 7.875 pt (7.9) | 10.5 | |

`vector-effect: non-scaling-stroke` keeps a line the same width on the page however the picture is scaled to fit. That was read back from real PDFs: a mounted sheet prints as **one 612 x 792 pt page**, its ink stays inside the margins and the gutter, it is black and white only with no raster image, and every line is exactly 3, 4.5 or 7.875 pt (PyMuPDF, in `scripts/check-design-ui.mjs`; without PyMuPDF that part is skipped with a notice).

The weights are the project's own print standard ([cognicopia-coloring-standards.md](cognicopia-coloring-standards.md), the same numbers the coloring engine uses), not the 2, 4.5 and 8.5 px a first brief named, because 2 px is under the 3 pt floor.

### js/coloring.js

`CognicopiaSvgColoring.mount(element, id, { tier, sheet })` draws a picture from `js/coloring-data.js` into a page. It does not fetch (a fetch fails on `file://` and with the network unplugged), and it cleans what it draws: the SVG is read with `DOMParser` and rebuilt from an allow-list of shapes and attributes, so no script, style, link, event handler or image survives; every shape becomes pure black. It refuses a picture that is not 3:4, has no outline, or has an outline that is not closed (an open outline is a leak for a crayon), with a plain message. `scripts/check-design-ui.mjs` draws a hostile file and proves nothing of it runs or loads.

The data comes from `scripts/build_coloring_svgs.py`; see [line-art-pipeline.md](line-art-pipeline.md). **Nothing on a screen uses `js/coloring.js` yet**, and no master pictures are committed, so `js/coloring-data.js` is empty today. The Packet Builder's coloring still comes from the engine and the approved art described in that runbook.

## The paper look (every inner page)

The front page is cream, with white cards, Fraunces headings and forest-green buttons. Every other page used to be dark green with a pattern. They now share the front page's look, from one place: sections 9b to 9d of `css/styles.css`, switched on by a class that `scripts/site-nav.mjs` writes on the page's `<html>` tag (never by hand).

- **`cg-paper`** on every page except `index.html` (which has its own) and `builder.html`. Cream page, a white frame with a warm tan edge, cream inner cards, charcoal text, serif headings. Buttons: forest green with white text; the quiet button is white with a green edge; amber (`#ffcc66`, text `#241500`) is for the one urgent action. Section 9c lists each older page's own panels by class name, so each becomes a card. A solid dark control (a tag, a number, a colored evidence label) stays a dark control with white text.
- **`cg-paper-app`** on `builder.html`. The Builder reads its colors from variables, so it takes the same palette by changing them (including the Facility and Academy variables and the profile wizard's). Night Shift keeps the Builder's own dim palette. The Academy's lesson player and picture stages stay a dark screen, like a video player.
- **The shared footer**: `scripts/site-nav.mjs` writes the same four-column footer (Tools, Facility, Resources) into every paper page, replacing each page's one-line footer. The breadcrumb bar is parchment.
- **Screen only.** None of these rules touches print, so packets still print pure black on white. Night Shift keeps its dim amber-on-brown palette on every paper page.
- **Measured.** `scripts/check-design-system.mjs` proves each page carries its class, that the new text pairs (amber, green, clay, sage) are 7:1 or better, and that the paper rules have no print rule. A full-site scan of every page's text against its real background found nothing under 4.5:1, and nothing under 7:1 after the last fixes.
- The owner's license desk (`license-desk.html`) uses the same palette in its own small stylesheet.

## How it is measured

| Command | What it proves |
|---|---|
| `node scripts/check-design-system.mjs` (in `npm test`) | Every contrast pair above, re-computed from the stylesheet; the focus ring, reduced-motion, forced-colors and print rules are present; no remote address; the three fonts are local, real `woff2` files and small; every page links the stylesheet and `sw.js` caches it; the page, margin, gutter and tier numbers match the engine; the tracing script and `js/coloring.js` (statically); and, where Pillow and vtracer are installed, the tracing itself on test pictures |
| `node scripts/check-design-ui.mjs` (in `npm run build` where Playwright is installed) | The behavior in Chromium: the stylesheet and fonts load from this site only; the ring on every kind of control; press, hover and fade; reduced motion, print and Night Shift; the scroll layers drift 9 and 18 vh and read back at 7:1 or better; type on seven real pages at two sizes with no sideways scroll; the first screen; `js/coloring.js` at each tier, its refusals and its cleaning; three sheets printed to PDF and read back |
| `npm run audit:ux` | Tap targets, contrast, clicks, navigation and print time on the real pages, including the pages that opted in |
| `node scripts/check-nav-ui.mjs` (in `npm run build`) | The top bar: none open on arrival, the holding hub marked, one open at a time, Escape and a click elsewhere close it, it stays at the top; on a phone, the Menu drawer |

## What was deliberately not done

- **No framework, icon font, or outside font or script.** Plain CSS and vanilla script; nothing is fetched from a CDN, so the packet tools keep their promise of no network request of their own.
- **No rewrite of any page's own styles.** The system sits under them; a page moves onto the tokens when it is next edited.
- **No parallax that moves text, no scroll hijacking.** Only two faint background layers, and only for people who have not asked for less motion.
- **No claim of compliance.** The stylesheet makes AAA text pairs and a clear focus ring easy; whether a page meets an accessibility standard is measured per page by the audit, not promised here.
- **`js/coloring.js` is built and tested but not wired into a screen**, because there are no traced pictures to show yet.

## Changing it

- A color or size: edit the token in `css/styles.css`, then `npm test` (the contrast check will say if a pair slips under 7:1).
- A new page: add it to `PAGES` in `scripts/site-nav.mjs` and run `npm run nav`; add `class="cg-ds"` to `<html>` to opt in to the type and rhythm.
- A new control: size it with `var(--cg-tap)`. If its class sets a `box-shadow`, give its `:focus-visible` the ring's dark inner band too.
- Never edit the stylesheet link or a sidebar by hand.
