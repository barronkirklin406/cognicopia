---
name: cognicopia-visual-style
description: "Use whenever creating or editing HTML, CSS, layouts, buttons, headers, or interactive surfaces on cognicopia.org: the one 'Warm Editorial Clinical' look, calm wording and feedback on controls, 52 px touch targets, AAA contrast in Day and Night Shift, and 200% zoom."
---

# Cognicopia visual style: Warm Editorial Clinical

The playbook's finding: the front page is calm and modern, then the packet tool beneath it switches to dark navy panels, amber buttons and emoji. A director should meet **one look per page, and the same look on every page**. This skill is the screen look; the printed look is `cognicopia-print-engine` (pure black on pure white, always).

**Status:** built on November 19, 2026. `css/styles.css` carries these values (its `--cg-*` tokens keep their older names: `--cg-green-700` is now the sage, `--cg-cream` the alabaster, `--cg-charcoal` the forest ink), the pages' own colors were moved to the same family, and `scripts/check-design-system.mjs` and `npm run audit:ux` measure them. Three groups keep their own hues on purpose, because the hue carries meaning: the three tier colors, the Studio's per-tool accents, and warning ambers and reds. Do not mix the old oceanic palette back in.

## The palette (use tokens, not new hex values)

The owner's values of November 18, 2026. Define them once as CSS custom properties on `:root` and in the Night Shift scope, and use the tokens everywhere.

**Day**

| Role | Value | Use |
|---|---|---|
| Paper (Warm Alabaster) | `#FAF8F5` | page background |
| Stone | `#F2EFE9` | cards, panels |
| Border | `#D6CFC2` | card and panel borders: `1px solid` (decoration only, see "Boundaries"); `--cg-tan-200` is `#DCD5C9`, a touch lighter, so slate text on it stays AAA |
| Ink (Deep Forest) | `#141E19` | primary text and headings |
| Slate | `#36423C` | secondary text |
| Sage | `#1D4433` | primary action fill, with white text |
| Ivory | `#FFFFFF` | secondary action fill, with a sage border and sage text |
| Calm Now clay | `#8F3418` | the "Calm Now" and urgent accent: a terracotta fill with white text, or terracotta text |

**Night Shift**

| Role | Value | Use |
|---|---|---|
| Background | `#101613` | page |
| Card | `#18211C` | cards, panels |
| Text | `#EFECE6` | all text |
| Secondary text | `#B8C9BF` | secondary text |
| Button | `#86C9A7` with `#0D1511` text | primary action; links and accent text use the same sage |

Print is not the screen: the soft ink above never applies to anything printed or made into a PDF (pure black on pure white, always).

## Contrast: AAA, measured

Every text pair a person must read reaches **AAA (7:1)** in Day and in Night Shift (4.5:1 for text of 24 px or bold 18.66 px and up); `scripts/check-design-system.mjs` and `npm run audit:ux` measure it. Measured on the values above:

- Day: ink on paper 16.1:1, on stone 14.9:1; slate on paper 9.9:1, on stone 9.1:1; sage text on white 10.9:1, on paper 10.3:1; white on sage 10.9:1; white on the clay `#8F3418` 7.9:1; clay as text on paper 7.4:1.
- Night: text on the background 15.5:1, on a card 14.0:1; secondary text 10.6:1 and 9.5:1; the button's `#0D1511` on `#86C9A7` 9.6:1; sage on the background 9.5:1, on a card 8.6:1.
- Clay `#8F3418` is **6.8:1 on Stone**: on a stone card use it for a border, icon or large shape, or put it on paper or white.
- Text on a glass or translucent surface is measured against the surface and the layer behind it, not the surface alone. Never rely on color alone to carry meaning: add words or an icon.

**Boundaries.** The `#D6CFC2` hairline is 1.5:1 against paper: it is a card's soft edge, not a control. A control a person must find (a text field, a select, a checkbox) has a **3:1 boundary**: a sage or ink border, or a border darker than `#7A857E` by day and lighter than `#6B7A72` at night.

## Type, shape and motion

- Atkinson Hyperlegible for the interface and the body (body 16 px and up), Fraunces for headings and for a resident's name set large. Both are local files in `/fonts`. **No outside font, script or CDN.** Editorial feel comes from generous space, a clear heading scale, rules and refined card borders, not from decoration.
- Replace dark-navy panels, amber buttons, gold bars and heavy glass with Alabaster and Stone surfaces. Cards have the hairline border and the warm layered shadow above, a radius of about 12 to 16 px, and enough space that a page reads as a few calm blocks, not 286 controls.
- Controls are tactile but quiet: a small lift on hover, a pressed state (`scale(.97)`), a two-band focus ring (3 px outline over a dark inner band; if a control's class sets a `box-shadow`, its `:focus-visible` gets the dark band too). All motion stops for `prefers-reduced-motion`.

## Zero button emojis, calm feedback, honest words

- **No decorative emoji** on any button, heading, tab or label. A real icon is an inline SVG that carries a text label or `aria-label`.
- **No native `alert()`, `confirm()` or `prompt()`.** Use a calm in-page banner (`role="status"`, dismissible, never blocking) or an accessible modal drawer (focus moves in, Escape closes, focus returns to the control). A confirmation names the action plainly and offers a clear way back.
- **Never say "export" for a local PDF.** Nothing leaves the computer. Say "make the PDF", "print" or "save as PDF". Name buttons by the job: "Print packets for everyone", "Add residents from a list", not "Download Month (All Residents)" or "Import Profiles (Restore)". Use "packets" (never "generations", "uses" or "credits"). No jargon on staff screens ("auditory-rhythmic cording", "somatic grounding", "CONSOLIDATED HUB CATALOG").
- The sales bar is one small chip, gone once licensed; it never stacks four buttons on every working screen. The terms notice appears at the first print, not over the first screen.

## Touch, zoom and small screens

- **Every interactive element is at least 52 px tall and wide** (`var(--tap)`), with room between controls. A link inside a sentence is exempt; anything else needs `data-tap-exempt="reason"` on its container, with a reason that holds.
- **200% browser zoom on Windows** (facility computers run Windows) must work with **no horizontal scrolling** and nothing clipped or overlapping; verify at 200% as well as 100%.
- **At 390 px the Cognicopia wordmark and logo are visible** on the first screen beside the Menu button, never a Menu button alone.
- Layout prefers CSS grid and works from a 390 px phone to a station display; nothing scrolls sideways.

## Verify

Look at every visible change in a real browser at 1366 x 768, 390 x 844 and 200% zoom, in Day and in Night Shift, then run `npm run audit:ux` (tap targets, contrast, clicks) and `npm run build`. The subjective items (calm, tone, consistency) are for a person to judge; list them, do not tick them.
