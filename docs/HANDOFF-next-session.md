# Continuation prompt for the next Claude Code session

Copy everything below the line into a new Claude Code session on the
`barronkirklin406/cognicopia` repository.

---

You are continuing work on **Cognicopia** (cognicopia.org), a static,
offline-first memory-care activity site. It deploys to GitHub Pages from
`main` (CNAME cognicopia.org). Act as a senior full-stack engineer and an
accessibility and clinical memory-care UX expert. Finish the remaining
items below, verify each one, and publish to cognicopia.org.

## Start here

1. Run `git fetch origin main`. The owner also commits to `main` directly, and `main` was force-pushed once. Merge `origin/main` into your branch before you change anything, and resolve conflicts by keeping both sides' intent.
2. Run `npm test` and `npm run build`. Both must pass before you start, and again before you ship.
3. Start the preview server: `python3 -m http.server 8765 --bind 127.0.0.1`.

## Where things stand

[barronkirklin406/cognicopia#7](https://github.com/barronkirklin406/cognicopia/pull/7) merged all of the following into `main`.

**Infinite coloring page generator.** Docs: `docs/infinite-coloring-engine.md`.
- `assets/cognicopia-coloring/infinite.js`:
  - seeded theme × subject × setting × composition matrix;
  - reprintable page codes such as `2HB-QIBJMT`;
  - 10 `{subject}/{setting}/{composition_style}` prompt templates;
  - guardrails: dignity and avoid-list screening, closed outlines, no loose line ends, and per-tier limits on open space, ink and region size.
- `assets/cognicopia-coloring/generators/*.js`: 9 subject families (cars, garden, flowers, birds, butterflies, tea, mid-century, homestead, harvest).
- `assets/cognicopia-coloring/quality.js`: the bitmap meter, shared by the browser and Node.
- `scripts/generate_infinite_pages.mjs` (`npm run pages`):
  - writes SVG, 300 DPI 1-bit PNG, a PDF packet (`scripts/lib/pdf-lite.mjs`), prompts.jsonl/csv and manifest.json;
  - `--codes` reprints pages by code;
  - optional `--backend http` sends prompts to an image endpoint and runs the results through the ingest (which traces them, see the line-art pipeline below).
- `scripts/check-infinite.mjs`: 749 checks, part of `npm test` and `npm run build`.
- Packet Builder (`builder.html`, `#/coloring`): a **New pages** tab (theme chips, count, find by code, add all). The PDF footer shows the page code.
- Packet Builder (`#/coloring`): a **Describe a page** tab, the Coloring Agent (`js/coloringAgent.js`, `docs/coloring-agent.md`). Plain words, or a random page from the memory-care categories, give one library picture cleaned on a canvas to pure black and white (brightness 0.34 R + 0.5 G + 0.16 B under 200), 1800 x 2400 (6 x 8 in at 300 dpi), added to the packet or saved as a PNG. No online picture maker is built in: the owner decided (October 2026) to keep every outside picture service out, and new pictures are made on the owner's computer by the local art agent instead (below). Checks: `scripts/check-coloringagent.mjs` (in `npm test`) and `scripts/check-coloringagent-ui.mjs` (in `npm run build`).
- `src/data/coloring_owner_prompts.json`: the owner's 150 picture descriptions, one per library design; `npm run coloring:masters` uses them (`--library-words` for the built-in words).

**Coloring library.**
- Tier 1 lines raised to 3 pt (the clinical floor).
- Three new categories: zentangle-mandalas, vintage-americana and seasons-holidays. The library is now 150 designs, 450 pages and 63 packs.

**index.html (main packet tool).**
- "Coloring page" and "Color the pattern" draw from the vector library at the resident's tier, chosen per resident and month, and honor the avoid list.
- Each ticked holiday adds a full-page holiday coloring picture (`HOLIDAY_ART`).
- The old procedural mandala code is gone.

**Fixes made while merging the owner's commits on `main`:**
- `builder.html`: the rename had turned `CAT_INDEX.cognicore` into `CAT_INDEX.cognicopia-coloring`, which JavaScript reads as a subtraction, so the Packet Builder home page crashed. It now reads `CAT_INDEX["cognicopia-coloring"]`.
- `scripts/check-services.mjs`:
  - a duplicate `const late` became `lateWing`;
  - the Node sandbox now loads only services built from `src/services/*.ts`, so the browser-only `assets/services/nightShift.js` is skipped;
  - two coaching-footer regexes were updated to match the current code.
- `src/services/facilityPlanner.ts`: `PREFER.words.morning` changed from 0 to 5, so 10 AM pacing leads with numbers, letters and movement.
- The builder's coloring PDF footer and metadata use "Cognicopia Coloring".

**Verified at hand-off:**
- `npm test`:
  - life-planner: 74
  - life-journal: 139
  - services: 54,358
  - coloring: 10,082
  - infinite: 749
- `npm run build` passed.
- Browser sweep at 390 px and 1366 px of every builder route and category, index.html, profile.html and the resources hub: 48 page loads with no console errors, no horizontal overflow and no external requests.
- index.html still produces the main packet, staff guide, family form and five condition packets. The coloring, holiday and pattern pages print as vector art.

## Pricing and licensing (built; the owner finishes the Stripe side)

Decision D10 in [blueprint-decisions.md](blueprint-decisions.md); setup in [stripe-setup-guide.md](stripe-setup-guide.md).

- **Plans:** $39 a month, $349 a year, Enterprise by quote, 25 free packets per computer. All numbers are in `src/config/license.js`; the pages, the top bar (generated by `scripts/site-nav.mjs`, so `npm run nav` after a change), the research worksheet and the procurement calculator read or are checked against them.
- **License keys:** `COG1.<payload>.<signature>`, ECDSA P-256, checked by a pure-JavaScript BigInt verifier in `assets/services/licenseManager.js` (about 1 ms, no `crypto.subtle`, works on `file://`). Stored in `localStorage` as `cognicopia_license_v2` and re-verified on every read. Valid until the paid-through date plus `GRACE_DAYS` (90). The earlier access code and the promo code still work.
- **Entry points:** paste in the top-bar window ("License Key / Promo"), the gate, or Settings; `?license_key=` or `#license_key=` on any page (removed from the address after use); `?session_id=` is passed to `activate.html`; a card purchase redirects to `activate.html?session_id={CHECKOUT_SESSION_ID}`.
- **Pages:** `pricing.html` (plans), `activate.html` (the one page that uses the network), `contact.html?subject=Corporate+Invoice+Request` (the invoice request, pre-filled email).
- **Scripts:** `scripts/license-keygen.mjs` (owner, once), `scripts/issue-license.mjs` (make or verify a key). **Service:** `platform/` `POST /api/licenses/redeem`, with tests in `platform/tests/licenses/`.
- **Checks:** `scripts/check-license.mjs` (the key logic in a sandbox, all pages), `scripts/check-license-ui.mjs` (a real browser: gates, keys, activation, months offline, the invoice request, who contacts the network).
- **Owner still has to:** make the signing key and paste the public half, make the product, two prices and two Payment Links, host the license service (or issue keys by hand), decide how long to honor the $129.99 code, and confirm the refund and cancellation wording. Until then the buy buttons ask for an invoice.

## The top bar and the front page (D12, built and measured)

- **Top bar on every static page** (generated by `scripts/site-nav.mjs`, CSS and script in its `cg-nav` block): logo, the six hubs as drop-downs, Contact. Under 1100 px it is the Menu drawer. Same markup at every width; `scripts/check-nav-ui.mjs` proves the behavior (31 checks). The Packet Builder keeps its side menu.
- **Front page (`index.html`)**: hero (tagline, heading with a clay accent, lede, Make a packet, See what you get, a laptop drawn in HTML and CSS), the four value cards in a row, Informed by the research (five Research Center links and the publisher's quote), the tool in its green band under "Make a packet", and a footer with Tools, Facility and Resources. Styles in `<style id="cg-landing">`; warm tokens `--cg-cream`, `--cg-peach-100/200`, `--cg-clay-700` in `css/styles.css`.
- **Measured:** all four value cards on the first screen at 1366 x 768, the first one at 390 x 844; 7 navigation choices on arrival on the static pages; no control under 52 px and no text below AA, day and Night Shift.
- **Note:** the owner's synced `cognicopia-ui` skill still describes a persistent 220 px left sidebar; that is out of date since D12.

## The design system (built and measured; pages move onto it as they are edited)

Decision D11 in [blueprint-decisions.md](blueprint-decisions.md); everything about it in [design-system.md](design-system.md).

- **One stylesheet, `css/styles.css`**, linked into every page by `scripts/site-nav.mjs` (run `npm run nav`; never by hand). Tokens `--cg-*` on the four brand colors (green `#1b382b`, parchment `#f4efe6`, gold `#c5a059`, charcoal `#1a202c`); two local typefaces in `/fonts` (Atkinson Hyperlegible as "Cognicopia UI", Fraunces for headings; both SIL OFL, about 100 KB, cached by `sw.js`); a spacing, radius and shadow scale; a two-band focus ring; a one-pixel press and short transitions; two faint scroll-driven background layers; and `@page cg-coloring` with the 0.5 in and 0.75 in margins and the 3, 4.5 and 7.875 pt tier lines.
- **It sits beneath the pages.** Shared rules use `:where()` (no specificity), so a page's own CSS wins. Stronger on purpose: `html.cg-ds` (the pricing, activation, contact, journal, planner and Zentangle pages opted in), the `.cg-*` components, and the coloring-sheet print rules. The packet tool maps its `--ds-*` tokens to `--cg-*`. Nothing in the Packet Builder's PDFs or the packets changed.
- **Packet tool first screen:** the tagline "Engaging Today" (D9; the older line sits beneath it, one line to revert), the four value cards, a tighter hero. On 1366 x 768 the first two cards are on the first screen; on 390 x 844 the first one is.
- **Checks:** `scripts/check-design-system.mjs` (in `npm test`: every contrast pair re-computed, the rules present, fonts local, pages linked, sw caches it, the SVG script) and `scripts/check-design-ui.mjs` (in `npm run build` with Playwright: ring, motion, reduced motion, layers, type, first screen, `js/coloring.js`, three printed sheets read back with PyMuPDF). The browser check found and fixed a real defect: `.cg-btn`'s own shadow hid the ring's dark band.
- **`js/coloring.js` + `scripts/build_coloring_svgs.py`** are the lighter second line-art route (master PNG to a closed-outline SVG with VTracer; drawn with a tier class). Built and tested, **not wired into any screen, and no masters are committed** (`js/coloring-data.js` is empty). Needs `pip install pillow vtracer`; skips with a notice where they are missing.
- **Owner's calls:** whether the packet tool's own colors should move fully onto the tokens; when the SVG route should feed a screen; whether to keep "Engaging Today" (D9).

## The line-art pipeline (traced art)

Pictures from an image generator or an illustrator become crisp vector coloring pages at all three tiers. Runbook: `docs/line-art-pipeline.md`; standards: `docs/cognicopia-coloring-standards.md` §6.

- **What shipped:** the center-line tracer (`scripts/lib/trace.mjs`), tier derivation (`scripts/lib/tiers.mjs`), master preparation (`scripts/lib/master.mjs`), art files (`scripts/lib/art.mjs`, one JSON per design in `src/data/coloring_art/`), the engine hook `CognicopiaColoring.art.use` (engine 1.1.0), the ingest with human review (`scripts/ingest_coloring_assets.mjs`, `scripts/review_coloring_art.mjs`), master prompts (`npm run coloring:masters`), and the catalog and bundle changes (`source: "traced-art"`, `counts.traced`). `scripts/check-trace.mjs` is part of `npm test` and `npm run build`.
- **State:** no real art is committed. The library is still the 150 hand-coded designs. The pipeline was verified end to end on stand-in masters (library designs drawn like generator output): ingest, review sheets, approve, bundle, the Packet Builder in a browser, vector PDFs at 3, 4.5 and 7.9 pt, offline reload, and `file://`.
- **What only the owner can do:** generate the master pictures with a licensed tool (prompts from `npm run coloring:masters`), put them in `assets/coloring/_inbox/`, then ingest, look at the review sheets, approve or reject, run `npm run coloring` and push. Record the tool, license and prompt in each sidecar.
- **Honest limits:** derived Tiers 2 and 3 are an automatic baseline. Good for subjects made of areas; weaker for skeletal drawings (bicycle spokes) and dense repeating patterns. Use a per-tier drawing (`<design>.t3.png`), sidecar `rules`, or reject the picture. About 20 to 35 KB of bundle per replaced design; the manifest generator stops at 6 MB of art.
- **Traps:** raw masters belong only in the unpublished `assets/coloring/_inbox/` (an underscore folder is not built by Pages) and are not committed by default; `assets/coloring/_review/` is git-ignored. Changing `assets/cognicopia-coloring/*.js`, the prompts or any approved art means running `npm run coloring` again, because `npm run build` compares the bundle and catalog to disk.

## Tablet Activities (a main menu of touch activities)

`tablet.html` (guide `docs/tablet-activities.md`): thirteen activities a finger can do, reached from a **Tablet Activities** button at the top of the front page, the Today menu and `cognicopia.org/tablet.html`. Word search (drag or tap first and last letter), trace the path (a dot follows the finger; slipping off, turning back or lifting sends it to the start), crossword and Spell It with an on-screen A to Z keyboard, finish the saying, color a picture (tap a shape), finger paint, bubbles, sort, put in order, match the clue, odd one out, sights and sounds. Level (early, middle, late) and topic (42) are chosen on the page and kept in the browser; nothing about a person is stored.

- **How it is built:** `js/tabletEngine.js` makes every puzzle from the PCG content and puzzle makers (so it is as sound as a printed packet); `js/tablet.js` is the screen. A session counts as one free packet, once per visit, like Tablet Mode in the packet tool. Cached offline by `sw.js` (v36).
- **Checks:** `scripts/check-tablet.mjs` (in `npm test`: 129 level and topic combinations, the trace rule for every shape, the screen's words through the dignity filter, the offline wiring) and `scripts/check-tablet-ui.mjs` (in `npm run build`: a real browser drives all thirteen with mouse and touch input at three screen sizes). `scripts/audit-ux.mjs` measures the page and four activity screens.
- **A fix found on the way:** "Well done!" is banned by the dignity filter ("praise that sounds like a teacher to a pupil"); the packet tool's own Tablet Mode used it. It now says "Nicely done!" there too.
- **Traps:** the crossword and word-search sizes are chosen from the screen so a control is never under 52 px; if a layout is changed, `check-tablet-ui.mjs` says which activity now scrolls or is too small. The shared stylesheet forces dark text on paper pages with `!important`, so white-on-green controls are listed in one override block at the top of `tablet.html`'s styles.

## The local art agent (pictures made on the owner's computer)

`scripts/local_art_agent.mjs` (`npm run art:doctor`, `art:setup`, `art:make`, `art:library`; guide `docs/local-art-agent.md`) makes coloring masters from words on the owner's own computer, never on the site and never through an outside service.

- **What shipped:** engines `procedural` (the 34 geometric designs, kept as drawn), `comfyui` (ComfyUI at 127.0.0.1 only, standard SDXL graph or `--workflow flux` from `scripts/local_art/workflows/flux1-schnell.json`), `diffusers` (a model downloaded once by `art:setup`, loaded with `local_files_only`), `folder` and `standin` (tests). Each try is cleaned to a 1-bit 1800 x 2400 300 dpi master with 3 pt lines (`scripts/lib/local-art.mjs`), scored with the ingest's own checks in a dry run, refined with hints when a round fails, and the best goes to `assets/coloring/_inbox/` with a sidecar. The Python parts import `scripts/local_art/offline_guard.py` first, which refuses every connection but loopback. `scripts/check-local-art.mjs` (in `npm test` and `npm run build`, about a minute) runs every route with test pictures and a stand-in ComfyUI.
- **State:** no real model has run: the cloud workspace has no graphics card and cannot reach the model download site. The diffusers route was proven with a tiny model made on the spot. The library review (October 15, 2026): 150 designs, 141 meet every measured standard, 9 have a subject under 45% of the page, 34 geometric kept, 116 can be upgraded.
- **What only the owner can do:** run `npm run art:doctor` on their computer, then `art:setup` (or start ComfyUI), then `art:make`, review and approve. Read the model's license before approving pictures for sale.
- **Traps:** the wrapper words must stay identical to `js/coloringAgent.js` (the check compares them). A design whose own drawing has a page-sized edge (quilts, mandalas) keeps it; everything else has a drawn frame removed. `fetch_model.py` is the only networked step and runs only from `setup`.

## Blueprint follow-ups (steering, measuring, wording)

The owner's "Cognicope Engine" blueprint was checked against the repository; `docs/blueprint-decisions.md` has the gap map and every decision (compliance wording, the offline rule's scope, Daily Operations as offline encrypted storage with aliases, one scheduler, optional local AI, 52 px targets, six hubs, taglines).

- **Steering:** `CLAUDE.md` at the root is the short rule file. `docs/dev-setup.md` covers Playwright, pinned MCP servers and what not to commit.
- **Measuring:** `npm run audit:ux` (`scripts/audit-ux.mjs`, skill in `.claude/skills/audit-ux/`) measures tap targets, contrast, click counts, navigation size, print time and page weight in a real browser; `docs/ux-baseline.md` holds the numbers to beat. It is not part of `npm test` (timings vary by machine).
- **Claims:** `scripts/check-claims.mjs` (in `npm test` and `npm run build`) keeps "HIPAA compliant"-style wording out of the pages and tool text. Say "no resident data leaves the device" and "supports".
- **Found by measuring, fixed:** the builder's "Your packet" button was unreadable in Night Shift (1.94 : 1) and a "150" badge was 4.29 : 1; controls on the planner, journal, Academy and elsewhere were under 44 px. Every control is now at least 52 px (`--tap`), measured on each page and state; `npm run build` runs the measurement where Playwright is installed. Two containers are marked `data-tap-exempt` with a reason (the facility month grid, the lesson chapter bar).
- **Navigation:** six hubs on every page (Today, Studio, Activity Packets, Facility, Academy, Resources, plus a Contact footer link), one open, from `HUBS` in `scripts/site-nav.mjs`; `npm run nav` writes every static sidebar and the navigation inside the Packet Builder's sidebar, and `npm run build` proves them (`site-nav.mjs --check`). The Packet Builder went from 21 choices at once to 11 to 14. Details in `docs/blueprint-decisions.md` D8.
- **Voice kit** (`docs/voice-kit.md`): `js/voiceKit.js` (`CogniVoice`) picks a local natural voice, speaks at 0.90 and pitch 1.0 with short pauses, and has a Voice settings panel in the Tablet menu toolbar, Tablet Interactive Mode and the Academy (with a High-Fidelity Voice switch). No recordings ship yet; how voices sound must be heard on a device.
- **One resident across the tools** (`docs/resident-engine.md`): the chosen resident (tab only), the daily record and advisory tier suggestion in the Roster, and the staff companion printed apart from the resident's pages. Logic in `src/services/residentTracker.ts` and `staffCompanion.ts`; checks `check-resident-engine.mjs` and `check-resident-engine-ui.mjs`. **Not done:** Quick Print PDFs still carry clinical foot lines.
- **Daily Operations, the Shift board** (`builder.html#/shift`, Facility hub): handoff notes, staff tasks and a printed handoff sheet for one shared computer. First version, for Activity Directors to react to. Logic in `src/services/dailyOps.ts` (global `CogniDailyOps`), screen in the `ops-ui` script of `builder.html`, spec and limits in `docs/daily-operations.md`. It keeps one sealed record (`cognicopia_dailyops`), residents by alias or room only, with a name check before a note is saved, retention (7, 14, 30 or 90 days; open tasks stay), locked backup files that add and never remove, and a sheet that checks its own layout before printing. `scripts/check-shift-ui.mjs` (real browser, in `npm run build`) proves what is stored, what prints and the unlock; the logic is the `dailyOps` group of `scripts/check-services.mjs`. **Not built:** syncing between stations (needs a vendor that signs a business associate agreement; a separate decision), roles, configurable shift hours. Next: show it to three to five Activity Directors and use the questions at the end of the spec.
- **Local AI:** planned only, in `docs/local-ai-plan.md` (off by default, its own script, the model file chosen by the facility and read from disk, the planner's and journal's `buildAiRequest` and `acceptAiCopy` as the seam, numbers that decide whether it ships). Not built.
- **Found while adding it:** the encrypted store's unlock prompt still had 44 px controls (only a locked store reaches it); the audit now locks the store and measures it.
- **Order of work left:** the Activity Director reaction to the Shift board; the local-AI spike if the owner wants it; the tagline (done: "Engaging Today" with the earlier line beneath it; D9 says how to revert).

## Names after the owner's rename (use these)

| What | Name |
|---|---|
| Engine global | `window.CognicopiaColoring` |
| Prompt engine global | `CognicopiaColoringPrompts` |
| Node loader | `scripts/lib/cognicopia-coloring.mjs` → `loadCognicopiaColoring()` |
| Engine sources | `assets/cognicopia-coloring/` (bundle: `assets/cognicopia-coloring/cognicopia-coloring.js`, generated by `npm run coloring`, never hand-edited) |
| Catalog | `src/data/cognicopia_coloring_catalog.json` |
| Prompt jobs | `src/data/cognicopia_coloring_prompt_jobs.jsonl` |
| Builder category id | `"cognicopia-coloring"` (always use `CAT_INDEX["cognicopia-coloring"]`, never dot access) |
| Builder activity ids | `"cognicopia-coloring"`, `"cognicopia-coloring-library"` |

`builder.html` maps the old ids `cognicore-coloring` and `cognicore-library` to the new ones (`legacyIds`) so saved packets still open. Keep that mapping.

## The facility platform (`platform/`)

A separate Next.js, Supabase and Stripe project for the B2B service, added after everything above. It does not touch the static site, and the root `npm test` and `npm run build` do not cover it. Read `docs/saas-platform-architecture.md` and `platform/README.md` before changing it.

- **What it has:** sign-in with roles (an Activity Director is an admin, everyone else is staff) and invitation links; Stripe Checkout, the billing portal and a signed webhook; the subscription gate, which closes the activity library, the reminiscence prompts and the calendar tools (in the pages, the API and the database) when a facility's subscription is past due, unpaid or ended, and shows a renewal prompt that links to the Stripe portal; and the planning tools an Activity Director opens it for: a dashboard (today's plan, the week ahead), the library sorted by stage and kind of activity, a one-click monthly calendar planner with a printable layout, and a searchable library of reminiscence prompts by decade and sense. They are written in Tailwind CSS 4 under `platform/components/planner/`; the rules are pure functions in `platform/lib/domain/`. See "The planning tools" in `docs/saas-platform-architecture.md`.
- **Check it:** from `platform/`, `npm install`, then `npm test` (about 1,490 tests, no Docker needed), `npm run typecheck` and `npm run build`.
- **Zero PHI:** it never stores resident data. The database refuses a calendar with resident-looking keys, and the architecture notes say what that cannot catch (free text).
- **Not yet verified:** the migrations have never run on a real Supabase stack, and nothing has run against a real Stripe account (the sandbox has no Docker and no keys). The sign-in and billing screens were driven in a real browser against stand-ins for both; `docs/saas-platform-architecture.md` lists what remains under "Not verified here". The first jobs wherever Docker and a Stripe test account exist are `supabase start`, `supabase db reset`, `supabase test db`, and one test-mode checkout end to end.
- **Setup that only you can do:** the Stripe products and two prices, the portal configuration, the webhook endpoint and its five events, and the hosted Supabase settings (site and redirect URLs, 12-character minimum password, your own SMTP). `platform/README.md` has the checklist and `platform/.env.example` the settings.
- **Next, in order:** editing a generated month by hand (swap an activity, lock a session: the calendar schema already has `locked`); emailing invitations; rate limiting and a script Content-Security-Policy; continuous integration for `platform/` and a committed browser test of the sign-in, billing and planning flows; load the production library into `content_items` and move the generation engines into `platform/lib/generation`. Also ask an Activity Director to print a planned month on the facility's printer, which no test here can do.
- **Two traps from the planning tools:** Tailwind has `container` and `grid` classes and the portal's stylesheet used to as well, and Tailwind's won (the portal's are now `page-width` and `tiles`; `platform/tests/ui/class-names.test.ts` guards it). And a printed calendar is planned onto sheets by `platform/lib/domain/print-layout.ts`, which never shrinks the type below 11 pt; if you change the print markup, check the real PDF (page count against the planned sheets, margins, type size), not only the screen.
- **Public claims:** the privacy page and the site's "no server, no account" wording are true of the static site today. Revisit them when the platform serves users.
- **A trap worth knowing:** inside one render, Next.js hands a repeated identical GET (every Supabase query is one) the first answer. A page that writes and then reads the same thing must make a different request for the second read, as the billing page does (`reconcileAndReload`).

## Hard rules (do not break)

- **Branch:** work on `claude/memory-care-life-planner-1gphkr`, or whatever branch the new session's system prompt names. Push with `git push -u origin <branch>`, retrying network errors up to 4 times with backoff of 2, 4, 8 and 16 s.
- **Going live:** when finished, run `npm run build`, commit, push, open a PR to `main`, subscribe to its activity, and merge it once it is green and mergeable. Then unsubscribe and confirm the GitHub Pages workflow run for the merge commit succeeded. The owner wants every change live on cognicopia.org.
- **Attribution:** use the commit trailers and PR footer that the new session's system prompt specifies. Put no model names anywhere else.
- **Privacy:** index.html, builder.html and profile.html make no network requests, and resident data never leaves the browser (only `activate.html` may contact anything: a checkout reference, nothing else). Make no blanket "HIPAA compliant" claims.
- **Secrets:** no private key, Stripe key or live price id in any file. Payment Link addresses are public and live in `src/config/license.js`.
- **Tone:** dignity-first. No "Do you remember…", no childish words, no elderspeak, no infantilizing art.
- **Coloring art:** pure black on white, 3:4 (600×800 viewBox), closed outlines, lines of at least 3 pt.
- **Tests:** never skip or weaken a test to get green. Fix the cause.

## Useful commands

```
npm test            # all six check suites
npm run subjects    # reprocess the hybrid coloring subjects after editing src/coloring/subjects/
npm run build       # checks + nav sync + research pages + link check (37 pages)
npm run coloring    # rebuild the coloring bundle and catalog after editing assets/cognicopia-coloring/*.js or approving traced art
npm run coloring:ingest   # trace the pictures in assets/coloring/_inbox/ for review (see docs/line-art-pipeline.md)
npm run nav         # regenerate the six-hub navigation on every page from scripts/site-nav.mjs
npm run services    # rebuild assets/services/*.js from src/services/*.ts
npm run coloring:svgs   # trace master PNGs to closed-outline SVG and js/coloring-data.js (pip install pillow vtracer)
node scripts/check-design-ui.mjs   # the design system in a real browser (SHOTS=folder keeps screenshots)
npm run research    # regenerate resources/research/* pages
npm run pages -- --count 12 --tier 2   # print infinite coloring pages to out/
```

- **Playwright:** load it with `createRequire('/opt/node22/lib/node_modules/')`. Chromium is preinstalled at `/opt/pw-browsers`; never run `playwright install`.
- **PDF checks:** use PyMuPDF (`import pymupdf`).
- **Generating a packet in a test:**
  1. Fill `#first` and `#born`.
  2. Set the `.act` and `.hol` checkboxes.
  3. Click `#go`.
  4. Wait until `.done` is visible.
  5. Capture the download.
- **Deploy check:** cognicopia.org and github.io are blocked by the sandbox proxy, so verify a deploy through the GitHub Actions run, not by fetching the site.

## Status of the earlier hand-off list

Everything in the previous list was finished and shipped:
- the workbook block and dead cover fields;
- the page estimate, which is back and checked against real builds;
- validation section numbers, dead CSS, the staff-guide button and the dropdown scripts;
- the legacy clip-art coloring activity, which now draws from the vector library;
- the design-system colors (0 contrast failures by day and in Night Shift);
- the six pillar groups;
- the responsive and interaction stress pass at 320–1920 px.

The hybrid coloring engine shipped next (`docs/hybrid-coloring-engine.md`):
- `src/engine/ColoringEngine.js`, `src/services/ColoringManifest.js` and 34 hand-drawn subjects, processed into `assets/coloring/{vehicles,nature,objects,animals,nostalgia}/` with `manifest.json` and `subjects.bundle.js`.
- The processor is `scripts/process_coloring_assets.mjs` (`npm run subjects`); its tests are `scripts/check-hybrid.mjs`.
- index.html's coloring page uses it.
- The Packet Builder's coloring library **New pages** tab makes hybrid pages; codes from the old infinite generator still print.
- The builder's old clip-art drawers (`COLOR_ART`) are gone; their saved pages print as hybrid pages (`HYBRID_LEGACY`).

The pasted "Cognicopia Master Architect" plan was then checked item by item against the site (`docs/master-plan-gap-review.md`). Most of it already existed. Four gaps were built:
1. Instant Soothe works with no resident chosen. It now opens a two-choice dialog (care level and theme) and prints a fresh packet from a hidden stage on the same page; see `docs/soothing-packet-engine.md`. `builder.html?emergency=general` opens the same dialog.
2. The packet tool's profile import reads EHR census spreadsheets: first name or "Last, First", date of birth, room or bed.
3. The Facility Portal has a locked backup and restore (`.cognicopia`, kind `facility`).
4. Every control on the three tools is at least 44 px tall (raised to 52 px later: see `docs/blueprint-decisions.md` D7).

Not built, with reasons, in that file: the four-tab rewrite of index.html, a PDF web worker, and "MDS compliant" logs. A facility logo upload is the one optional candidate left.

## Known limits to state honestly

- The infinite generator draws subjects procedurally in vector code; it does not use AI images. The line-art pipeline can bring AI pictures into the library, but only after a person approves each one. The `--backend http` image path is optional and was tested only against a local stand-in server, never a real provider.
- About 2% of first drafts fail the guardrails; batches re-roll them automatically.
