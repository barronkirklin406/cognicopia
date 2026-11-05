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

Built on the owner's November 5, 2026 direction, **warm clinical, oceanic serenity**: alabaster pages (`#fafafd`), rich slate for dark surfaces and headings (`#0f172a`), oceanic teal (`#0d9488`) and sage (`#355e3b`) as the accents, warm charcoal text (`#28241f`, never pure black and never a cold gray), and the brand gold (`#c5a059`) kept as the one warm accent. This replaced the October 22 flyer palette (deep teal `#0e3c43`, parchment `#f5f1e6`, charcoal `#1a202c`). Every token is `--cg-<name>`.

| Family | Tokens |
|---|---|
| Slate and ocean teal (the old "greens"; the token names still say green so no page had to be renamed) | `green-950` `#070d1c`, `green-900` `#0f172a` (rich slate), `green-800` `#111b30`, `green-700` `#08423f` (deep ocean teal, for text and button fills), `green-600` `#0b5f59`, `green-500` `#0a7c75`; sage tints `100` `#e4f4f1`, `200` `#c9e8e2`, `300` `#94d2c8`; `teal` `#0d9488` (borders, glows, icons and large shapes only), `sage-700` `#355e3b`, `ink-900` `#0f172a` |
| Warm stone | `parchment` `#f4f3ef`, `tan-100` `#ebe9e3`, `tan-200` `#dad7ce`, `tan-300` `#c5c1b5`, `tan-400` `#a5a092`, `tan-600` `#6e6a5e`, `tan-700` `#5b574c`, `tan-800` `#453f37`; gold `500` `#c5a059` (the brand gold), `300` `#e8cc8a`, `200` `#f1dda8` |
| Warm neutrals | `charcoal` `#28241f`, `ink-soft` `#403b35`, `white` |
| Warm accents (the light pages) | `cream` `#fafafd` (the alabaster page), `peach-100` `#fbe9dc` (an icon tile), `peach-200` `#f6cdb4` (the hero's glow, decoration only), `clay-700` `#8a3a20` (one terracotta accent word) |
| Meaning | `danger-800`, `danger-200`, `ok-800`, `ok-200`; the focus ring `focus` `#f5b800` and `focus-dark` `#0f172a` |

### What reaches AAA (7:1)

| Text | On | Contrast |
|---|---|---|
| white | the four dark slates and teals | 11.3 to 19.4 |
| sage 100 | the four dark slates and teals | 9.9 to 17.1 |
| sage 200 | the four dark slates and teals | 8.7 to 14.9 |
| gold 300 (gold you can read on slate or teal) | the four dark slates and teals | 7.2 to 12.4 |
| charcoal | parchment, tan 100, tan 200 | 10.7 to 13.9 |
| ink-soft | parchment, tan 100, tan 200 | 7.7 to 10.0 |
| green 700 | parchment, tan 100, tan 200 | 7.8 to 10.2 |
| white | tan 700 (a page frame), green 600 | 10.4, 7.5 |
| danger 800, ok 800 | parchment | 8.7, 8.0 |
| charcoal, ink-soft, green 700 | cream, white | 14.8 to 15.4, 10.6 to 11.1, 10.8 to 11.3 |
| sage 700, slate (ink 900) | cream, white | 7.2 to 7.5, 17.1 |
| white | sage 700 | 7.5 |
| clay 700 (terracotta) | cream, white | 7.3, 7.8 |

The check fails the build if any pair in that list drops under 7:1; the weakest text pair in the system is **7.1:1**.

Parts that are not text (borders, icons, the ring) need 3:1: gold 500 and tan 400 on a green, green 600 on parchment, and the oceanic teal `#0d9488` on alabaster (3.6) and on slate (4.8). **The oceanic teal is never text and never under button text** (3.6:1 on alabaster, 3.7:1 under white): text and button fills use deep teal `#08423f`, `#0b5f59`, sage `#355e3b` or slate. **Gold 500 and tan 400 are never used for small text on a green: they are AA there, not AAA.** Use gold 300 for that.

These are the system's own pairs. Older page text that predates it is held to AA (4.5:1) by the browser audit (`npm run audit:ux`), which fails the build below that. Moving a page's own colors onto the tokens is how that page can reach AAA, one page at a time.

## Type

Two typefaces, both open-licensed, both files in `/fonts` (no font service, no request, cached for offline use by `sw.js`).

- **Atkinson Hyperlegible** (Braille Institute, SIL OFL) for the interface, as "Cognicopia UI", regular and bold. Its letters are drawn to be told apart, which is the point of a tool for people with low vision.
- **Fraunces** (Undercase Type, SIL OFL), now only for a resident's name where it is set large (`--cg-font-name`: the Shift board, the Session Notes, a printed cover). One variable file, Latin only, weights 400 to 700. Headings are the interface face (`--cg-font-display` is `--cg-font-ui`), bold, with no tracking.

Three `.woff2` files, about 100 KB in all, with `fonts/OFL-Fraunces.txt` beside them (the Atkinson license already ships). A page that opts in gets headings and body text in the interface face, a type scale that grows with the window (body text is 16 px and up; the one smaller step, 15 px, is for labels and short captions such as the value cards' detail lines), a 1.6 line height, and a line length of about 62 characters. Stacked blocks in a page's main are one step (24 px) apart.

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

`scripts/site-nav.mjs` writes the same seven places (the six hubs and Tablet Activities, a plain link beside Activity Packets) into every static page. On a window 1280 px or wider they run across a light top bar: the logo and name on the left, Today, Studio, Activity Packets, Facility, Academy and Resources as drop-downs, and Contact on the right. Under 1100 px the same markup becomes the Menu drawer (a deep green Menu button, the hubs stacked, the one holding the page open). It is one structure at every width (an `<aside>` with the hubs as `<details>`), so the keyboard, a screen reader and the checks meet the same thing.

- **Behavior.** No drop-down is open as a page opens; the hub that holds the page carries a deep green underline. Clicking a hub opens it and closes any other; Enter and Space work; Escape closes it and leaves the keyboard on the hub; a click elsewhere or moving the keyboard on closes it. The bar stays at the top while the page scrolls (76 px tall). The logo is cropped to its drawing (the file is a full page with the drawing small in the middle) and shown at 84 x 60 px.
- **The action bar** (License Key / Promo and the two buy buttons, and on the packet tool Instant Soothe and Night Shift) sits under the bar. It scrolls away on every page except the packet tool, where Instant Soothe has to stay in reach.
- **Resources** opens a wide panel with the library in its three groups.
- **Colors.** Charcoal on white (16.3:1); the current hub in deep green; drop-down links 52 px tall; the two-band focus ring. Night Shift turns the bar, the drop-downs and the action bar dark brown with cream text, on every page, whether or not the page runs the Night Shift script.
- **The Packet Builder keeps its own side menu.** It is a working screen with its own categories and queue; its seven places are the same.

## The front page (index.html)

The packet tool's first screen follows a classic product page: a hero in two columns, a row of what you get, the evidence, then the tool, then a footer. Every word on it was already on the page; only the arrangement and the look are new.

1. **Hero** (redesigned November 2026, the owner's brief): a soft teal and sage wash with a light geometric mesh, no eyebrow tag, the headline "Custom activities built with the individual in mind." (the last words in deep teal), a subtitle about personalized memory care, cognitive engagement and an instant print-ready packet, one primary button **Get Started Free** (it scrolls to the tool) and one quiet line (no sign-up, no card, everything on this computer). The trial count is not in the hero; it lives in the action bar and the packet tool's bar. Beside it, a laptop whose screen shows the packet tool's own "Fit the Words In" page (decoration, `aria-hidden`, left out on a phone).
2. **What Cognicopia gives you:** the four value cards, side by side. On 1366 x 768 all four are on the first screen; on a 390 x 844 phone the first one is (both measured by `scripts/check-design-ui.mjs`).
3. **Informed by the research:** five Research Center summaries as links, and a quote card with the publisher's own statement (credited to Cognicopia, BarronCrafts). No client logos and no testimonials: the template had them; Cognicopia does not invent them.
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

## One warm accent for each studio tool

In the Packet Builder each studio tool wears its own accent, so a person can tell where they are at a glance: the 12-month Life Planner is deep terracotta, the Cognitive Life Journal royal indigo, Reminiscence cards sage, the Memory digest and book muted gold, and Cognicopia Coloring warm slate. The router puts the tool's name on `#view` (`data-tool`), and section 9e of `css/styles.css` re-points the builder's own `--accent` variables inside it, so every button, tab, chip and progress bar follows. It also adds a tinted badge over the page title, a short colored bar under it, a warm card border with a colored top edge, and a hover that tints and lifts (the lift stops for `prefers-reduced-motion`).

- **Tokens.** `--cg-terra-*`, `--cg-indigo-*`, `--cg-moss-*`, `--cg-ochre-*`, `--cg-slate-*`: `-tool` for bars and borders (3:1), `-ink` for text (AAA), `-soft` a tint, `-line` a warm border. The `-dk-` set is for Night Shift.
- **Measured.** `scripts/check-design-system.mjs` re-computes, for every tool, the text on its tint, on cream and on white, white text on the button color, and the Night Shift equivalents; all are 7:1 or better, bars 3:1.
- **Print.** Screen only. A printed page is pure black on white and never sees an accent.
- **Care-team side.** In the planner and journal, the care-team tab, chip and scope card use warm slate, so the two audiences are never confused.

## Small and helper text

Nothing a person reads is small. Section 12 of `css/styles.css` raises labels, chips, notes, captions and hints that a page sets under 16 px: 16 px for a sentence, 15 px for a chip or an upper-case label, in the bold face (the typeface ships a regular and a bold, so 600 and up is the bold), tracking .012em to .03em, leading 1.5. The navigation (`scripts/site-nav.mjs`) sets its links at 16 px, group labels at 15 px, and the breadcrumb and footer at 16 px. A printed sheet (`.qp-sheet`, `.lp-sheet`, `.sheet`, the print roots) keeps its own sizes, which are set in points and checked by `scripts/check-print-type-ui.mjs`. To find what is still small, run a scan in a real browser for text under 15 px, weight under 500 under 18 px, leading under 1.4 under 18 px, and contrast under 7:1 for small text.

## The care tier as a color mode

`js/careTier.js` reads the level a page already shows (the Packet Builder's difficulty, the packet tool's and the tablet's level, the profile's support tier) and sets `data-cg-tier` on `<html>`. It stores and sends nothing. Section 13 of `css/styles.css` turns that into colors: Tier 1 deep sapphire and indigo, Tier 2 warm terracotta with a sage edge, Tier 3 evergreen with a muted gold edge. The generator's header card (`.cg-tierhead`) carries a quiet tartan of the tier's own color, and the selected level button takes it. The tartan is two crossing sets of bands at low strength; the header text stays at 7:1 or better even where the bands cross, and `scripts/check-design-system.mjs` computes that for every tier. Night Shift drops the tartan. In print the card is plain white with a black edge.

## Forms

Fields in the Packet Builder's planner and journal and in the resident profile use floating labels: the real label rests inside the empty field and rises when the field has focus or something to read. In the profile this is CSS only (the label stays beside its field in the page), applies to a field that has a placeholder, and gives a phone a two-line resting label so none is cut off. The planner has a four-step stepper with a progress bar; the journal has the same strip over its three steps (the essentials, the four sections, print), which follows the part of the page being read; the profile has its six-step stepper. Fields, labels and lead lines carry .01em tracking. Controls stay 52 px.

## A page printed straight from the browser

A page that builds no sheets of its own (a price page, a policy, a guide for a binder, the resident profile) gets one print sheet from section 10 of `css/styles.css`: no navigation, sidebar, button or field to fill in (a box that only shows a value, such as a license key, stays); a white page with nothing behind the words; every word, tick and border pure black; US Letter with 0.5 in margins and a 0.75 in binding gutter on the left. A page that makes its own sheets (the Packet Builder's `#printRoot`, the packet tool's `#qpPrintRoot`, `#print-stage`) is left to its own rules, and its own `@page` rule wins because it comes later. `scripts/check-print-pages-ui.mjs` prints thirteen pages and three real PDFs and reads them back with PyMuPDF.

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

## The brand flyer's look (October 22, 2026)

The owner's flyer sets the identity: deep teal, warm gold, parchment. What was done, and what was deliberately kept:

- **Tokens.** The `--cg-green-*` ramp and the sage tints are teal now, the parchment and cream are a little cooler, and a gold `--cg-gold-400` (`#d4af37`) edges buttons and cards. Hard-coded copies of the old greens in pages and scripts were moved to the same teals; the check scripts that name the brand anchors were updated to match.
- **Kept on purpose.** The care-tier colors (Tier 3 stays evergreen, because the color is the tier's meaning), the four seasons' colors, the success and warning colors, and the coloring tools' crayon names ("green" must stay green).
- **Call-to-action.** `--cg-cta` is the teal-to-navy gradient with a gold edge; it also carries a solid `background-color` so every tool that reads colors sees white text on a dark fill (above 10:1).
- **Brain mark and watermark.** `assets/brand/brain-mark.svg` (two hemispheres, teal and blue, with neural nodes) sits beside the top-bar title, headings with `class="cg-brain-h"`, and the Packet Builder's titles. `assets/brand/brain-watermark.svg` is tiled faintly (gold strokes at 18 to 22 percent) down the page margins on windows 1100 px and wider, only on pages that carry the site navigation; a bare dark surface skips it so gold text there keeps its full 7:1. Both are hidden in print and the watermark in Night Shift.
- **Feature badges.** Five rounded-square badges (`assets/brand/badge-*.svg`) head the front page's "What Cognicopia gives you" list: quick personal packets, decades of nostalgia, low vision and toner savings, interactive tablet mode, private on this computer. Names avoid claims that have not been measured ("30-second packets" and "100% privacy" were not used).
- **Cards and banners.** `.cg-card` (white, soft radius, golden inner glow) and `.cg-banner` (teal into deep gold, white lettering) are in `css/styles.css`; print turns both plain black on white.

## Warm clinical, oceanic serenity (November 5, 2026)

The owner's direction for the whole screen. It changes colors, surfaces, controls and spacing; it changes no logic, data, route or export.

- **Palette.** One retint across the pages, `css/styles.css`, the generated navigation and research pages, the scripts that draw interface, the Academy and Packet Builder tokens, the web manifest and the facility service's pages (`platform/app/globals.css`). The two pages that use a Tailwind stylesheet (`batch-scheduler.html`, `family-bridge.html`) take the palette through `scripts/make-pages-css.mjs`, which replaces Tailwind's neutral and emerald scales with the site's own (black stays black, for print).
- **Glass.** Section 14 of `css/styles.css` makes `.container` and the card classes translucent surfaces with a backdrop blur, a translucent border and a long soft shadow, on the screen only. The top bar is solid alabaster on purpose: the logo files are black ink on white, and a translucent bar over a dark section showed a pale square behind the mark.
- **Tactile controls.** A smooth lift and a glowing border on hover (`--cg-ease-out`, a cubic-bezier curve), a pressed state of `scale(.96)`, and the two-band focus ring (a 3 px bright outline, a 6 px dark band of `focus-dark`). The lift and the press stop under `prefers-reduced-motion`.
- **The packet section and the licensing bar** on the front page are slate with a faint teal lattice and a teal rule; the bar keeps the class name `cg-wood-bar` because the scripts find it by that name, and Night Shift keeps its warm walnut and brass.
- **What did not change.** Print is pure black on white. The care-tier colors (sapphire, terracotta with sage, evergreen with muted gold), the ok and danger colors, the studio accents and Night Shift keep their own palettes, because they carry meaning. 52 px touch targets, dignity-first wording, no outside font or script, and the offline promise are as before.

## The top bar and the front page (November 6, 2026)

- **Top bar.** The brain mark beside the name is gone (the headings that carry `cg-brain-h` keep theirs). The two group captions carry the same 16 px, 2 px stroke inline icon each (sparks for Resident tools, two people for Staff & family portal) instead of a colored dot. **Tablet Activities** is a plain link right after Activity Packets (a plain link's arrow points on, a drop-down's points down), so there are seven places. To fit them on one row the bar now starts at **1280 px** (it was 1100); under that the Menu drawer is used, and the closed drawer no longer casts its shadow onto the page. In the bar, Contact reads "Contact" (its accessible name stays "Contact Cognicopia").
- **"What Cognicopia gives you"** is an asymmetric three-column grid: one tall card (Quick, personal packets, with the three steps) beside four, white with a soft shadow and a 4 px lift on hover (the lift stops for `prefers-reduced-motion`), each with one minimal inline icon. Two columns under 1100 px, one under 560 px.

## The Shift board calendar (November 2026)

The Shift board opens on a calendar (Month, Week, Day) instead of the old three-column board; the board is one button away ("Open the board"). Styles live in the `shc-style` block of `builder.html`, scripts in `js/shift-calendar.js` (the rules) and `js/shift-calendar-ui.js` (the screen). Rules the styles follow:

- **Three coverage badges, each a color plus words.** Green "Fully staffed", amber "Open shifts", purple "Memory care need". Each pair is dark text on a pale fill (measured: green 7.8:1, amber 7.9:1, purple 10.0:1, the gray "no plan" tag 9.3:1), and no badge is color alone: the words are always there, and a day with no plan shows no badge at all rather than a gray one that reads as a problem. The purple badge appears only when the board's own records support it (a High weekday pattern, or a High pattern plus a watch note that day).
- **Month, Week and Day share one grid.** The day cells use container queries (`container-type: inline-size` on `.shc-day`), so a badge shortens to its short wording in a narrow cell instead of being cut off. The insight rail sits below the calendar on every window size: beside it the month and week columns shrank to about 80 px.
- **Touch.** Every day cell, view button and navigation arrow is at least 52 px. Under 640 px the toolbar wraps into rows and the page never scrolls sideways.
- **The staffing insight is a count, not a forecast.** It reads the engagement records already on the board (at least 6 records in a shift; 35 percent or more High is High, 18 percent or more is Moderate) and says so on the screen. Staff appear as initials only, and a resident appears by alias or room only, as everywhere on the Shift board.
- **The weekly PDF** is one US Letter page with the 0.75 in binding gutter, built with the bundled jsPDF and the Atkinson Hyperlegible font. It prints pure black on white (the badge colors become words: "OPEN" marks the open shifts).
- **Quick resident lookup** (`js/quick-lookup.js`): Ctrl+K, or "/" when no field has the keyboard, opens a small search dialog on every Packet Builder screen. It reads the saved roster and stores nothing. On the Shift board it shows aliases only.

## The Resident Roster (November 2026)

The roster's resident pane (`rs2-style` in `builder.html`) is a list or a card grid, one choice for the person, remembered with the sort but never with a resident. A resident is a round avatar of initials, the name set in Fraunces, the room and the tier tag. The tints are the care-tier colors from section 13 of `css/styles.css` (sapphire, terracotta, evergreen) as deep ink on a soft tint, measured 11.6:1 to 13.1:1. The filter chips carry a count of what a click would show, and are redrawn on every change, so the keyboard is put back on the chip that was pressed. The search matches every word in any order in the name, the alias or the room with accents ignored, the same rule as the Ctrl+K lookup. An empty roster and a search that finds nobody each say what to do next. Every chip, the two view buttons, the sort and every resident are at least 52 px; under 900 px the pane sits above the print pane in one column.

## The front page's laptop (November 2026)

The hero laptop has no 3D tilt, so nothing on its screen is skewed. The screen is one SVG per example, 1000 x 625 (16:10), written by `scripts/landing-example.mjs` from Cognicopia's own engines: it scales as a picture and keeps its proportions. The page inside is drawn the way it prints: pure black on white, a 0.75 in binding side and 0.5 in margins at 46.5 units to the inch, Fraunces for titles and names, Atkinson Hyperlegible for everything else, and the word search's cells true squares with 3 pt outer lines. The app around the page uses the slate, teal and alabaster tokens. Three tabs under the laptop (52 px, arrow keys, Home and End) choose the example; without script the first example shows and the tabs are hidden. Night Shift recolors the tabs; the laptop is hidden under 760 px so the phone's first screen keeps its first value card.

## The packet's house styles (November 2026)

The front page's packet gives its page titles one of four looks, chosen from the resident and the month (`Doc.setLook` and `Doc.headLook` in `index.html`). The same packet always looks the same, the next month's or another resident's usually looks different, and every page of one packet shares its look, so the packet reads as one piece.

| Look | Title | Rule |
|---|---|---|
| Ledger (the plain look) | sans (Atkinson Hyperlegible), on the left | one heavy rule |
| Editorial | serif (the PDF's built-in Times), centered | a double rule |
| Framed | sans, in a ruled box, a small solid square before it | the box |
| Margin bar | serif, beside a heavy bar in the margin | one rule |

What holds in every look: pure black on white; no line thinner than the stage's rule; and exactly the room the plain look takes (the title's baseline, then 44 pt), so a look never moves a page break (`scripts/check-packet-looks-ui.mjs` makes the same packet in all four and compares the pages). The late stage and a simplified layout always use the plain look, for calm and predictability. The body text stays in Atkinson Hyperlegible for legibility. Fraunces is not used in PDFs: it ships only as a web font, which the PDF library cannot embed.

### The same looks on the Packet Builder's printed sheets

The Packet Builder's packet prints in the same four looks (`style#sheet-looks` and `sheetLook()` in `builder.html`), chosen from the resident and the month when the packet is printed; calm mode keeps the plain look. On its HTML sheets the look restyles the title band (`.sh-head`): the second rule of the editorial look and the frame are drawn with absolutely placed pseudo-elements, so the band keeps its height and nothing below it moves. Sheets the activity engine draws as one picture carry all three decorations around their title, hidden (`src/engine/ClinicalActivities.js`, `toSVG`), and the print area shows the one its look names. Here the serif is Fraunces itself: the browser prints with the site's own font. The late stage (`.lvl-advanced`, `.eng-late`) keeps the plain look. `scripts/check-builder-looks-ui.mjs` prints the same sheets in all four looks and compares every band and body.
