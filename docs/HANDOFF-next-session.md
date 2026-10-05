# Continuation prompt for the next Claude Code session

Copy everything below the line into a new Claude Code session on the
`barronkirklin406/cognicopia` repository.

---

You are continuing work on **Cognicopia** (cognicopia.org), a static
memory-care activity site. It is deployed to GitHub Pages from `main`, with
the CNAME cognicopia.org. Act as a senior full-stack engineer and an
accessibility and clinical memory-care UX expert.

## Where things stand

**Already live on `main`:**
- Facility Portal.
- Caregiver & Professional Academy.
- Clinical Science & Research Center.
- Infinite coloring page generator (commit 14f5c1a, "Coloring: infinite page generator, 3 pt line floor and three new categories"). It includes:
  - `assets/cognicore/infinite.js`: the seeded theme matrix, page codes, the 10 prompt templates and the guardrails.
  - `assets/cognicore/generators/*.js`: 8 subject families (cars, garden, flowers, birds, butterflies, tea, mid-century, homestead, harvest).
  - `assets/cognicore/quality.js`: the bitmap meter.
  - `scripts/generate_infinite_pages.mjs`: the CLI (`npm run pages`). It writes SVG, 300 DPI 1-bit PNG, a PDF packet, prompts.jsonl/csv and manifest.json, and has an optional `--backend http` image endpoint.
  - `scripts/lib/pdf-lite.mjs`.
  - `scripts/check-infinite.mjs`: 749 checks, wired into `npm test` and `npm run build`.
  - A Packet Builder "New pages" tab in `builder.html`.
  - Tier 1 lines raised to 3 pt.
  - Three new library categories: zentangle-mandalas, vintage-americana and seasons-holidays (150 designs, 450 pages, 63 packs).
  - A fix for the builder coloring layout overflowing on phones.
  - `docs/infinite-coloring-engine.md`: the architecture blueprint.
- index.html (the main packet tool):
  - The coloring page and "Color the pattern" now draw from the Cognicopia vector library (`C.render` + `C.toPDF`, at the tier for the resident's stage, chosen per resident and month, honoring the avoid list).
  - Holidays add a second, full-page holiday coloring picture (`HOLIDAY_ART`).
  - The old procedural mandala code and the unused `mRings/mSeg/mWeight` were removed.

All tests passed at hand-off:
- check-life-planner: 74
- check-life-journal: 138
- check-services: about 54,332
- check-coloring: 10,067
- check-infinite: 749

`npm run build` passed.

## Hard rules (do not break)

- **Branch:** work on `claude/memory-care-life-planner-1gphkr`. Push with `git push -u origin claude/memory-care-life-planner-1gphkr`. On a network error, retry up to 4 times with backoff of 2, 4, 8 and 16 s.
- **Going live:** when everything is finished, run `npm run build`, commit, push, open a PR to `main`, merge it, then confirm that the GitHub Pages workflow run for the merge succeeded. The user wants every change live on cognicopia.org.
- **Commit trailers, exactly:**
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: <this session's URL>`
  (or whatever attribution the new session's system prompt specifies). Put no model names anywhere else.
- **Privacy:** index.html, builder.html and profile.html must make no network requests, and resident data never leaves the browser. Make no blanket "HIPAA compliant" claims.
- **Tone:** dignity-first. No "Do you remember…", no childish words, no elderspeak, no infantilizing art.
- **Coloring art:** pure black on white, 3:4 (600×800 viewBox), closed outlines, lines of at least 3 pt.
- **Names:** keep the internal identifiers unchanged: `window.CogniCore`, the `assets/cognicore/` paths, the category id `"cognicore"`, the activity ids `"cognicore-coloring"` and `"cognicore-library"`, and the `COGNICORE*` variable names. Saved packets depend on them. Only user-visible text changes to "Cognicopia".

## Useful commands

```
npm test            # all five check suites
npm run build       # checks + nav sync + research pages + link check
npm run coloring    # rebuild assets/cognicore/cognicore.js (run after editing any assets/cognicore/*.js)
npm run nav         # regenerate the sidebar/nav on every page from scripts/site-nav.mjs
npm run services    # rebuild assets/services/*.js from src/services/*.ts
npm run research    # regenerate resources/research/* pages
npm run pages -- --count 12 --tier 2   # print infinite coloring pages
python3 -m http.server 8765 --bind 127.0.0.1   # local preview
```

- **Playwright:** load it with `createRequire('/opt/node22/lib/node_modules/')`. Chromium is at `/opt/pw-browsers`; do not run `playwright install`.
- **PDF checks:** PyMuPDF (`fitz`) is available.

## Unfinished work, in order

### 1. Branding: user-facing "Cognicore" → "Cognicopia" (started, nothing changed yet)

Change only visible text, aria labels and comments. Keep all identifiers.

**builder.html**
- About line 7255: `<option value="">Not a CogniCore page</option>` → "Not a Cognicopia coloring page".
- About line 12360: `name: "Cognicore Coloring Page"` → "Cognicopia Coloring Page".
- About line 12378: `aria-label="Always on for every Cognicore page"` → "...every Cognicopia coloring page".
- About line 12508: the multisensory blurb, "...their own category, Cognicore Coloring." → "Cognicopia Coloring".
- About lines 12510–12511: category `name:"Cognicore Coloring"` and blurb "The CogniCore coloring library" → Cognicopia.
- About line 12642: tool card title "CogniCore Coloring" → "Cognicopia Coloring".
- Comments at about lines 490, 1311, 1410, 6280, 6783, 12059, 12164, 12337, 12517, 12604, 12676, 12679, 12772 and 12889: rename to Cognicopia Coloring.

**Other files**
- `scripts/site-nav.mjs`: the sidebar label "Cognicore Coloring" → "Cognicopia Coloring", then run `npm run nav`.
- `resources/caregiver-faq/index.html`: lines about 627, 643, 957 and 968, in both the JSON-LD and the visible FAQ.
- `resources/index.html`: one mention.
- `src/services/researchCenter.ts`: mentions in dementia-visual-perception and case-late-afternoon. Then run `npm run services && npm run research`. This regenerates `assets/services/researchCenter.js` and `resources/research/*/index.html`.
- `src/services/reminiscenceEngine.ts`, `src/services/heirloomService.ts` and `docs/*.md`: user-visible strings only, then `npm run services`.
- `scripts/generate_coloring_manifest.js`, `ingest_coloring_assets.mjs`, `coloring_prompts.mjs` and `generate_infinite_pages.mjs`: printed or user-facing strings only, then `npm run coloring`.

**Finding the mentions**

```
grep -rn -i "cognicor" --include=*.html --include=*.ts --include=*.mjs --include=*.js --include=*.md . | grep -v node_modules | grep -v "window.CogniCore\|assets/cognicore"
```

Leave `assets/cognicore/cognicore.js` alone; it is generated. Tests in check-services and check-coloring may assert on strings, so update their expectations if needed.

### 2. Retire the old COLOR_ART clip-art in the builder's legacy activity

`COGNICORE` (id `cognicore-coloring`, builder.html at about 12337–12420) still draws from the old `COLOR_ART` set through `COLORING.generate`.

**How it is reached today:** the "cognicore" category is `direct:true, route:"coloring"`, so the menu opens the vector library (`CogniLibrary`).

**Still to check:** whether `cognicore-coloring` is reachable anywhere else, for example roster plans, Life Planner recommendations, saved packets or search. Grep for `cognicore-coloring` and `COGNICORE`.

**Options:**
- Point its `plan()` and `generate()` at library designs (`C.designs()` filtered by theme, rendered with `C.render(id, tier)` → `C.toSVG`).
- Or keep it only for rebuilding saved packets, as `COLORING` already is.

Saved packets that reference the old keys must still rebuild.

### 3. index.html audit and dead-code removal

- **Workbook block:** remove `#targetPages`, `.workbook-activity`, the "Workbook: N pages" text in `estimatePages`, the save and load of `packetPreferences`, and `PREF_TO_WORKBOOK`. Keep load compatibility: old saved preferences must not throw.
- **Cover fields:** remove the dead `#institutionalPartner` and `#researchSponsor` fields. Still accept them silently when loading old files.
- **Validation messages:** fix the section numbers they quote. Pages are section 6 and holidays are section 7.
- **Dead CSS:** remove `.navbar`, `.nav-*`, `.dropdown*`, `.dropbtn`, `.resources-dropdown`, `.statusbar` and `.shots figcaption`. Grep the markup and JS first to confirm each is unused.
- **`#staffOnlyBtn`:** replace its inline background with a class.
- **Dead `resourcesDropdownBtn` scripts:** remove them from `cognitive-journals.html`, `life-planners.html`, `contact.html` and `zentangle-art.html`. Check whether these are redirect stubs or real pages under `/resources/`.
- **builder.html:** verify the references to `lpName`, `lj-name` and `fpNewWing` all resolve to existing elements.
- **Responsive test:** use Playwright at 320, 375, 390, 768, 1024, 1366 and 1920 px on index.html, builder.html (every route) and resources pages. Check that `document.documentElement.scrollWidth <= innerWidth`, with no clipping and no console errors.
- **Interaction stress test:** exercise every toggle, dropdown, tab, hover bridge, the Generate button and PDF download. Look for console errors and confirm there are no external network requests.

### 4. index.html design-system alignment and the pillar grouping

**Design tokens:**
- top bar `#e6f4f1` with `#1a2e22` text;
- containers `#1a2e22` with `#b5a48b` borders and `#ffffff` text;
- an on-brand Stripe/upgrade button.

Check WCAG AA contrast for every pair.

**Pillar grouping:** the 34 flat activity toggles go into the 6 pillars as collapsible groups (`<details>`/`<summary>` or ARIA disclosure), each with a count of selected items. The six pillars:
1. Coloring & Art
2. Word & Language
3. Memory & Reminiscence
4. Numbers & Logic
5. Movement
6. Music & Holidays

Confirm the exact pillar list against the site copy. Keep the activity ids and the saved-preference keys unchanged.

Then run `npm run nav`, `npm run research` and `npm run build`.

### 5. Ship

1. Commit, push, open a PR to `main`, subscribe to PR activity, and merge when green.
2. Unsubscribe from the PR.
3. Confirm that the Pages workflow run on `main` succeeded.
4. Tell the user what went live.

## Known limits to mention honestly

- The infinite generator draws subjects procedurally (vector code, no AI images). The `--backend http` image path is optional and untested against a real provider; it was tested only against a local stand-in server.
- About 2% of first drafts fail the guardrails and are re-rolled automatically.
- cognicopia.org and github.io are blocked by the sandbox proxy, so verify a deploy through the GitHub Actions run status, not by fetching the site.
