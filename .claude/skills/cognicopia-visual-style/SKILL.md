---
name: cognicopia-visual-style
description: "Use whenever creating or editing HTML, CSS, layouts, buttons, headers, or interactive surfaces on cognicopia.org: the one 'Warm Editorial Clinical' look, calm wording and feedback on controls, 52 px touch targets, AAA contrast in Day and Night Shift, and 200% zoom."
---

# Cognicopia visual style: Warm Editorial Clinical

The playbook's finding: the front page is calm and modern, then the packet tool beneath it switches to dark navy panels, amber buttons and emoji. A director should meet **one look per page, and the same look on every page**. This skill is the screen look; the printed look is `cognicopia-print-engine` (pure black on pure white, always).

**Status:** this is the target. The shipped `css/styles.css` still carries the November 5 oceanic tokens and `scripts/check-design-system.mjs` measures them (see the table in `CLAUDE.md`). When you restyle a page, move it to these tokens; when you change the shared tokens, change the check's expectations in the same pull request, with the reason. Do not mix the two palettes on one page.

## The palette (use tokens, not new hex values)

Define these once as CSS custom properties on `:root` and in the Night Shift scope, and use the tokens everywhere.

**Day**

| Token (suggested name) | Value | Use |
|---|---|---|
| `--cg-paper` | `#FAF8F5` Warm Alabaster Paper | page background |
| `--cg-stone` | `#F2EFE9` Soft Stone | cards, panels |
| `--cg-hairline` | `#DED8CE` | card and panel borders: `1px solid` (decoration only, see "Boundaries") |
| `--cg-shadow` | `0 2px 6px rgba(28, 37, 32, 0.05)`, layered with a longer, fainter one | cards; warm, never gray-blue |
| `--cg-ink` | `#18221D` Deep Forest Charcoal | primary text and headings |
| `--cg-ink-soft` | `#4A5550` Muted Slate | secondary text **on Alabaster**; on Stone cards or white use `#444F4A` |
| `--cg-sage` | `#234E3B` Deep Botanical Sage, hover `#1A3B2C` | primary action fill, with white text |
| `--cg-ivory` | `#FFFFFF` Warm Ivory | secondary action fill, with a `#234E3B` border and `#234E3B` text |
| `--cg-clay` | `#B85435` Warm Terracotta | the "Calm Now" and urgent accent: borders, icons, large shapes |
| `--cg-clay-deep` | `#8F3F25` | a terracotta button fill (white text) or any terracotta text |

**Night Shift**

| Token | Value | Use |
|---|---|---|
| bg | `#121815` Deep Pine Slate | page |
| card | `#1C2420` | cards, panels |
| text | `#EAE6DF` | all text |
| accent | `#488B6C` | borders, icons, large shapes only |
| accent text | `#7BC0A0` | links and accent text |
| primary fill | `#2A634A` with white text | primary action; border `#488B6C` |
| urgent text | `#EE9A7C` | the Calm Now accent as text |

Print is not the screen: the "no pure black on screen" feel above never applies to anything printed or made into a PDF.

## Contrast: AAA, measured, with the honest exceptions

Every text pair a person must read reaches **AAA (7:1)** in Day and in Night Shift; `scripts/check-design-system.mjs` and `npm run audit:ux` measure it. Measured on the values above:

- Pass: `#18221D` on Alabaster 15.4:1 and on Stone 14.2:1; `#4A5550` on Alabaster 7.3:1; `#234E3B` text on white 9.4:1 and on Alabaster 8.9:1; white on `#234E3B` 9.4:1 and on hover `#1A3B2C` 12.3:1; `#EAE6DF` on `#121815` 14.5:1 and on `#1C2420` 12.8:1.
- **Fail AAA as asked for, so not used that way:**
  - `#4A5550` on Stone cards is **6.8:1**: use `#444F4A` there (7.4:1).
  - `#B85435` terracotta is **4.8:1** under white text and 4.6:1 as text on Alabaster: it is for borders, icons and large shapes (3:1), **never for body text or under button text**. A terracotta button is `#8F3F25` with white text (7.2:1).
  - `#488B6C` night sage is **4.4:1** on `#121815` and **3.9:1** on `#1C2420`: borders, icons and large shapes only. Night text and links use `#7BC0A0` (8.5:1 on the page, 7.5:1 on cards); the night primary button is `#2A634A` with white text (7.0:1).
- Text on a glass or translucent surface is measured against the surface and the layer behind it, not the surface alone. Never rely on color alone to carry meaning: add words or an icon.

**Boundaries.** The `#DED8CE` hairline is 1.3:1 against Alabaster: it is a card's soft edge, not a control. A control a person must find (a text field, a select, a checkbox) has a **3:1 boundary**: `#7A857E` by day (3.3 to 3.8:1), `#6B7A72` at night (3.5 to 4.0:1), or the sage border of a secondary button.

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
