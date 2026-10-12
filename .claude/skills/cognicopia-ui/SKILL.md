---
name: "cognicopia-ui"
description: "Use when building or styling the Dynamic Clinical Calibration Canvas (DCC), high-contrast accessibility rules, responsive mobile/desktop CSS grids, and touch-friendly UI components for activity directors."
---

# Cognicopia Dynamic Clinical Calibration Canvas (DCC) UI Skill

## Role & Core Mandate
You are the Lead Frontend Accessibility & UI/UX Specialist for Cognicopia. Your responsibility is to maintain the visual layout, responsive CSS architecture, and programmatic accessibility calibration across all pages (`index.html`, `builder.html`, `profile.html`, `zentangle-art.html`, etc.). The repository's `CLAUDE.md` and `docs/design-system.md` are the source of truth; when they differ from this skill, follow them.

## Visual & Accessibility Design System
- **One shared stylesheet:** `css/styles.css`, linked into every page by `scripts/site-nav.mjs` (`npm run nav`). Use its `--cg-*` tokens, not new hex values. It sits beneath each page's own CSS (`:where()`), so it cannot break a layout.
- **Color palette (brand-led):**
  - Brand: deep green `--cg-green-700` `#1b382b`, parchment `--cg-parchment` `#f4efe6`, gold `--cg-gold-500` `#c5a059`, charcoal `--cg-charcoal` `#1a202c`.
  - Light pages (the front page, the top bar): cream `--cg-cream` `#fbf7f1`, white cards, a soft peach glow (`--cg-peach-100/200`), one terracotta accent `--cg-clay-700` `#8a3a20`; charcoal text, deep green main buttons.
  - Dark panels (the packet tool's green band, most content pages): greens `--cg-green-950..700` with white, sage (`--cg-sage-100/200`) or gold 300 text.
- **Contrast:** the system's own text pairs reach AAA (7:1); everything else must pass at least WCAG AA (4.5:1). `scripts/check-design-system.mjs` and `npm run audit:ux` measure it, by day and in Night Shift.
- **Type:** Atkinson Hyperlegible ("Cognicopia UI") for the interface, Fraunces for headings, both local files in `/fonts`. Body text 16 px and up.
- **Touch-Friendly Controls:** every link, button, select and dropdown a finger must hit is at least **52 px** tall and wide (`var(--tap)` / `var(--cg-tap)`). Links inside a sentence are exempt.
- **Focus:** the two-band ring (3 px bright outline over a dark inner band). If a control's class sets its own `box-shadow`, give its `:focus-visible` the dark inner band too.
- **Motion:** short and gentle, and stopped completely for `prefers-reduced-motion`.

## Navigation Structure
- **Top menu bar on every static page:** on windows **1100 px and wider**, the six hubs (Today, Studio, Activity Packets, Facility, Academy, Resources) run across a light top bar as drop-down menus, with the logo on the left and Contact on the right. No drop-down is open on arrival; the hub holding the page is underlined in deep green; Escape or a click elsewhere closes a drop-down; the bar stays at the top while scrolling.
- **Below 1100 px:** the same markup becomes the **Menu** drawer (deep green Menu button, hubs stacked, the current hub open).
- **The action bar** (License Key / Promo, Get Full Access, Request Corporate Invoice / W-9; on the packet tool also Instant Soothe and Night Shift) sits under the menu bar.
- **The Packet Builder (`builder.html`) keeps its own left side menu.**
- Never edit the menu by hand: change `HUBS` in `scripts/site-nav.mjs` and run `npm run nav`; `npm run build` proves every page agrees.

## Programmatic Dynamic Clinical Calibration (DCC)
When rendering activity previews or output canvases, automatically apply styling rules based on the active resident's profile parameters:
- **Tier 1 (Full Detail):** Standard 14–16pt text, multi-step instructions.
- **Tier 2 (Guided):** Large 18–20pt text, sentence starters, 2.5pt stroke outlines.
- **Tier 3 (Simplified):** Extra-large 24pt+ text, single-step prompts, high-contrast pure black (`#000000`) vectors on white background (`#ffffff`), 3pt–4pt line thicknesses.

## Verify
Look at every visible change in a real browser at 1366 x 768 and 390 x 844, in day and Night Shift, and run `npm run build` (it measures tap targets, contrast and the menu behavior).
