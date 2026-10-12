# Blueprint: what exists, and what was decided

The owner's "Cognicope Engine" blueprint asked for six navigation hubs, three offline workflows, a two-tier local engine and developer tooling. It was checked against the repository first. Most of it was already built. The rest needed decisions, and the owner delegated them. They are written here so they can be reversed knowingly. Each decision says why.

## Gap map

| Blueprint item | State |
|---|---|
| Workflow B: profile, category, auto-customize, print | Built (`index.html`, `builder.html`, `src/engine`, `src/pcg`) |
| Workflow C: bingo, packets, queue | Built (the Packet Builder's queue) |
| Hub: studio modules (coloring, journals, life planners, reminiscence) | Built |
| Hub: Facility Portal | Built, except logo upload |
| Hub: Academy | Built |
| Hub: Resource & Clinical Hub | Built (`resources/`) |
| Anti-duplication | Built, with a different design (D6) |
| Workflow A: shift handoff notes, assigned staff tasks, timeline | Built as a first version, the Shift board (D3; [daily-operations.md](daily-operations.md)) |
| Level 2 in-browser AI | Not built; a plan is written (D5; [local-ai-plan.md](local-ai-plan.md)) |
| `CLAUDE.md`, `.claude/skills`, developer setup | Added with this change |
| Measured UX (tap targets, clicks, contrast, timing) | Added: `npm run audit:ux`, baseline in [ux-baseline.md](ux-baseline.md) |
| Six-hub navigation | Done (D8), generated from one list and proved by the build |
| 52 px tap targets | Done (D7), measured by the audit and held by the build |

## Decisions

### D1. What the site may say about compliance

HIPAA compliance belongs to a facility's program, not to software. Cognicopia says what is true and checkable.

| Say | Never say |
|---|---|
| "No resident data leaves the device." | "Inherently HIPAA compliant", "HIPAA compliant by design", "HIPAA certified" |
| "Supports a facility's HIPAA privacy practices." | "Ensures compliance", "guarantees compliance", "satisfies" a regulation |
| "Supports documentation for individualized engagement (CMS F679)." | "CMS compliant", "survey-proof", "audit-proof" |
| "Resident details are encrypted on this computer." | "Military-grade", "unhackable", "100% secure" |

Why: the privacy page already says "supports", and a blanket claim invites a wrong expectation from a facility's compliance officer. The regulatory tag numbers refer to nursing-home rules; assisted living is regulated by each state, so copy says "supports" and names the rule only where it is accurate. `scripts/check-claims.mjs` keeps the banned phrases out of every published page.

### D2. "Offline" is a rule for the static site, not for the whole project

- The **static site** (the root pages, `assets/`, `src/`) is offline-only. The three tools make no network request, and `npm run build` fails if one does.
- **`platform/`** is a separate zero-PHI service (sign-in, billing, shared planning). It needs the internet by design.
- Public copy scopes its claims: "no internet needed" is said of the packet tools, never of sign-in or billing.

Why: the original rule ("no cloud dependencies") would have made the Supabase and Stripe work a violation. Scoping it keeps the strong promise where it is true.

### D3. Daily Operations (handoff notes, assigned tasks): offline, encrypted, on one device, with aliases

**Built as a first version, the Shift board** (`builder.html#/shift`, Facility hub). The spec, the data it keeps, what its checks prove and the questions for Activity Directors are in [daily-operations.md](daily-operations.md). It does what is written below, plus a name check before a note is saved, a retention rule (7, 14, 30 or 90 days; open tasks are never removed), a one-page printed handoff sheet and locked backup files that add and never remove. Syncing between stations is still not built, for the reason below.

Not synced and not in `platform/`. Resident names never enter it.

- **Storage:** the existing encrypted store (`src/services/secureStore.ts`), on the shared facility computer, with locked `.cognicopia` files for backup and handoff between stations.
- **Residents appear only as aliases** (the existing alias model), such as "Room 12" or "Maple 2", chosen by the facility. A free-text note can still contain a name, so the screen says so, and the privacy page lists what is kept.
- **Timeline and tasks** are plain records: when, which alias, which staff initials, what, done or not. Color is never the only signal.
- **Not building yet:** multi-device sync. If a facility wants it, it needs a vendor that signs a business associate agreement, and that is a separate decision.

Why: "Resident Eleanor was restless" is a name tied to behavior, which is protected information. Putting it on a server would break the zero-PHI promise and the offline rule at once. Aliases on one device keep both. **Before building:** a short spec (data model, privacy boundary, screens) and a reaction from three to five Activity Directors, because this is the least validated part of the blueprint.

### D4. One scheduler of record

The offline Facility Portal (wings, groups, month calendars) is the scheduler for the static site. `platform/`'s calendar is for subscribed, signed-in facilities. They do not sync and neither stores a resident. Revisit when the platform serves real users; until then no "daily activity schedule" is built on a third system.

### D5. Local AI is an optional experiment, never a core tier

**Planned, not built.** [local-ai-plan.md](local-ai-plan.md) says why it is not in this change, which seam it would use (the planner's and journal's `buildAiRequest` and `acceptAiCopy`, which already withhold names and filter output), how a facility would get the model without the page going online, the experiment, and the numbers that decide whether it ships.

If it is built:

- off by default, behind a clear switch, in its own script that loads only when turned on;
- every output passes the same dignity and avoid-topic filters as curated content, and a person reviews it before it prints;
- the deterministic engine always works without it;
- no "historical fact" comes from a model without a source a person has checked.

Why: small in-browser models invent facts, can produce the infantilizing or topic-triggering wording the filters block, need large downloads and often WebGPU older facility PCs lack, and generate in seconds, not within a 400 ms response. The deterministic engine is fast, testable and curated. "WASM for Level 1" is unnecessary; plain JavaScript is already fast.

### D6. Keep the anti-duplication design

A secure random seed per print and an ids-only history, guaranteeing no repeats until a pool is used up. The blueprint's `hash(profileId + count + timestamp)` is weaker, a 30-day page-hash log tied to a profile is more stored data, and a timestamp breaks reprinting the same sheet, which the current design supports by freezing packet items.

### D7. Tap targets: 52 px, and measured claims

**Done.** The minimum is **52 px** (from 44 px) for buttons, links outside sentences, fields, switches, summaries and the labels of checkboxes and radios, in the three tools and every Packet Builder view and state.

- **How it is held:** one token, `--tap: 52px`, in each tool. Components size themselves with it. A `touch-floor` style at the end of each page gives any other control the floor, at zero specificity so a component's own (never smaller) size wins. The generated sidebar takes the token on all 27 pages.
- **Exempt, as WCAG 2.2 allows:** a link inside a sentence, and anything inside an element marked `data-tap-exempt="reason"`. Two are marked: the facility calendar's month grid (a dense overview; the List layout has every action at full size, and a touch-only device starts in the list) and the lesson chapter bar (the seek slider reaches any point). Anything new needs a reason that holds.
- **Measured:** `npm run audit:ux` counts controls under the minimum on each page and in the states a person reaches by choosing something, and `npm run build` runs it wherever Playwright is installed, so a regression stops the build. Before and after numbers are in [ux-baseline.md](ux-baseline.md). Adding the encrypted store's unlock prompt (a state only a locked store reaches) found four controls still at 44 px; they are 52 px now.
- A goal such as "three clicks" is public copy only where the script counts it: today that is the roster print flow.
- Badges that mark something unfinished are capped at one or two per screen (the Zeigarnik effect can feed the alert fatigue the research names as a top pain point). That is a design choice a person makes, not a number a script checks.
- The 400 ms response budget (Doherty) applies to a response a person waits for. A whole packet is measured against its own time (about 0.3 s on the sandbox).
- `platform/` (the Next.js service) keeps its own 44 px statement; D7 is about the static site.

### D8. Six hubs for navigation

**Done.** Every page shows the same six hubs, in this order, and one is open: the one holding the current page. A hub with several places is a collapsible group (opening one closes the others); a hub with one place is a plain link.

| Hub | Holds |
|---|---|
| 1. Today | The Personalized Packet Tool, Resident Profiles (and the packet tool's own Ailment-Specific Activities, on that page) |
| 2. Studio | Cognicopia Coloring, 12-Month Life Planner, Cognitive Life Journal, Reminiscence cards, Memory digest & book |
| 3. Activity Packets | The Packet Builder. Inside it: the six activity categories and the packet queue |
| 4. Facility | Facility Portal, Resident roster, Session notes (SLP), Settings & defaults |
| 5. Academy | The Caregiver & Pro Academy (a plain link) |
| 6. Resources | The whole Resource & Clinical Hub: Browse all resources and its ten modules in three groups; in the Packet Builder, the hub and the Research Center |

"Contact Kirk Barron" is a footer link under the six on every page, not part of a hub.

- **One source:** `HUBS` in `scripts/site-nav.mjs`. `npm run nav` writes the sidebar into every static page and the navigation inside the Packet Builder's sidebar (the Packet Builder keeps its own brand, hooks and styles). Do not edit either by hand.
- **Proved:** `npm run build` runs `site-nav.mjs --check`, which fails if any page is stale, shows a different set of hubs, has more or fewer than one open, marks the wrong link as current, or links to a file or Packet Builder route that does not exist. The browser measurement also checks every page type's sidebar for the 52 px floor and for contrast.
- **Measured:** the sidebar as a page opens, before and after, is in [ux-baseline.md](ux-baseline.md). The Packet Builder went from 21 choices at once to 12 to 14 (the Shift board added a link to Facility); the static pages stayed at 7 to 18, with the six hubs now the same everywhere.
- The hub page's picture count is read from the coloring catalog, so it cannot go stale (`npm run coloring` then `npm run nav`).
- The marketing pages for the journal, the planner and Zentangle art open the Studio hub with no link marked, because their sidebar link opens the tool, not the page.

### D9. Taglines

"Engaging Todays" is a typo; use **"Engaging Today"**. The site's hero line today is "Connection, Cognition, Creation"; that stays until the owner chooses to replace it. Any claim in a tagline must be true of what it names ("Zero Internet Required" is true of the packet tools, not of sign-in).

## Order of work

1. Tooling and baseline: `CLAUDE.md`, [dev-setup.md](dev-setup.md), `npm run audit:ux`, [ux-baseline.md](ux-baseline.md), this page.
2. Wording and tap targets (done): the claims check, the Night Shift contrast defect, 52 px.
3. Six-hub navigation (done).
4. Daily Operations: built as a first version (the Shift board), for Activity Directors to react to.
5. The local-AI spike, last and optional: planned in [local-ai-plan.md](local-ai-plan.md), not built.
