# Cognicopia: master repository contract

Cognicopia (cognicopia.org) is an offline-first memory-care activity site: printable packets, coloring pages, life planners and journals for Activity Directors and families. This file is short on purpose. The current state of every module is `docs/HANDOFF-next-session.md`; read it before a large change. The rules below come from the owner's Cognicopia Critique & Improvement Playbook of November 12, 2026 ("the playbook", Phase 0 of its overhaul). It replaces every older rulebook in this repository.

## Skills: read the one that matches the work before you start

| Skill | Use whenever you touch |
|---|---|
| `.claude/skills/cognicopia-visual-style/` | HTML, CSS, layouts, buttons, headers or any interactive surface: the one look, wording of controls, touch and zoom |
| `.claude/skills/cognicopia-clinical-dignity/` | resident profiles, era tables, prompt generators, stage rules, staff tips or marketing copy: accuracy, honest fallbacks, trauma, faith, pronouns, claims |
| `.claude/skills/cognicopia-print-engine/` | PDF generation, pagination or printable templates: what prints on a resident page, the staff companion sheet, no near-empty pages |
| `.claude/skills/audit-ux/` | measuring tap targets, contrast, clicks and print time in a real browser |

## Build and test gate

- `npm run build` runs `node scripts/build.mjs`, then `node scripts/check-claims.mjs`, then the full test suite (`npm test`). It must never again be only `node --check server.js` (that is `npm run lint`). Run it before every push.
- Never skip, weaken or delete a check to get green. Find the cause. A check may be changed only when the owner's design legitimately changed, with the reason written in the commit.
- Anything a person sees or prints is also verified in a real browser, and a PDF is read back with PyMuPDF: look at a screenshot at 1366 x 768 and 390 x 844. Playwright is already installed (`createRequire('/opt/node22/lib/node_modules/')`); never run `playwright install`.
- GitHub runs the same gate on every push and pull request to `main` (`.github/workflows/site-ci.yml`, about 30 to 60 minutes on GitHub's machines). Run it locally first all the same: it is faster to find a failure here. `platform/` has its own workflow (`platform.yml`).

## Core architecture

- **100% offline-first, in the browser.** Zero requests off the site: no CDN, no cloud font, no cloud picture service, no analytics, no outside script. `npm run build` fails if a tool makes one. Fonts are the two local families in `/fonts`. Resident data never leaves the browser.
- **The one existing exception** is `activate.html`, which sends a Stripe checkout reference (nothing else) to the license service to get a license key after a card purchase. No other page may use the network. Do not widen it.
- **Three codebases, three rules:**

| Where | What | Rule |
|---|---|---|
| Repository root (`index.html`, `builder.html`, `profile.html`, `assets/`, `src/`, `scripts/`, `resources/`) | The static site, published from `main` by GitHub Pages | Offline only, as above |
| `tools/owner/` | The owner's own pages (License Desk makes license keys). **Not published:** `_config.yml` keeps it, and `platform/`, off the site | Opened from a copy on the owner's computer (`tools/owner/README.md`). Never link to it from a page |
| `platform/` | A separate Next.js, Supabase and Stripe service for facilities | **PAUSED** (`platform/PAUSED.md`). Do no work on it until the owner explicitly resumes it (playbook fix 10: until about ten facilities pay for the offline product). Zero PHI if it ever resumes. |
| `license-service/` | A tiny serverless service that turns a Stripe payment into a signed license key and emails it (`docs/license-service.md`) | Needs the internet by design, holds no state, sees only a buyer's email and business name, never a resident. Proved by `scripts/check-license-service.mjs`. |

- A tool may load a data file that ships with the site from the same folder (for example `data/content-catalog.json`, kept for offline use by `sw.js`); that is not an outside request.
- The **local art agent** (`scripts/local_art_agent.mjs`, `docs/local-art-agent.md`) is the owner's tool, not part of the site: it makes coloring masters on the owner's computer, its Python parts refuse every connection but loopback, and only `npm run art:setup` downloads anything. The finished site and its tools never call a picture service (owner's decision, October 2026). While the owner is building the site, any online service may help finish the job; the results are saved into the repository and the site never contacts the service. Keys stay in the environment, never in a file.

## Navigation and scope

- **Target (the playbook's "three doors"):** every page has the same top bar with three doors, **Today**, **Packets** and **Residents**, plus one compact **For directors** menu holding **Facility**, **Academy** and **Resources**. One menu style everywhere: never add a secondary sidebar, a second menu or a new standalone page for a condition or a feature. Conditions (Lewy body, frontotemporal, vascular, Korsakoff, late-stage sensory, errorless learning) are one optional setting on the resident profile that adjusts every page, never a separate suite with its own form.
- **Built today:** seven places (Today, Studio, Activity Packets, Tablet Activities, Facility, Academy, Resources, and a Contact link) from `HUBS` in `scripts/site-nav.mjs`, drop-downs from 1280 px up and the Menu drawer below, and the Packet Builder still has its own side menu. Moving to three doors is a planned phase: change `HUBS`, run `npm run nav`, and retarget the navigation checks (`check-nav-ui`, the hub order in `check-resident-engine-ui`, `check-design-ui`) in the same pull request, with the reason. Until then do not add a place, and never edit a sidebar or the top bar by hand. `scripts/site-nav.mjs` also links the shared stylesheet into every page; never add that link by hand.

## Unit naming and pricing

- The unit we generate is a **packet**. Never "generation", "run", "use" or "credit" on any screen, page, email or document. (Code names such as `FREE_RUNS` may stay until renamed; what a person reads may not.)
- Pricing: **$39 a month or $349 a year per building** (saves $119, about 25%); Enterprise by custom quote. Prices live in one place, `src/config/license.js` (`PRICES`, `FREE_RUNS`, `PAYMENT_LINKS`, `PUBLIC_KEYS`); the free-packet count is read from there.
- **The free tier (owner's decision, November 12, 2026):** the first 50 packets for one resident at a time are free on each computer, **once**. They never reset: no timer, no weekly refill, and nothing may clear the count's backup copies (`assets/services/trialLedger.js`). **Printing for a whole building** (every resident in one bundle; later the Week Builder, the Staff Run Sheet and the Monthly Participation Summary) needs a license or a 30-day pilot key: such a feature calls `CognicopiaLicense.needsFacility("what it is")` before it opens and spends no free packet. A pilot key is the `pilot_facility` tier, made on License Desk, and ends on its date with no grace days. `scripts/check-license.mjs` and `scripts/check-license-ui.mjs` prove all of this; do not change the count or these rules without asking.
- **One chip, not a sales bar.** The bar under the navigation holds one small chip, "49 of 50 free packets left" (`js/trialBadge.js`), which opens the license window (key box, plans, invoice request, pilot). It is gone completely once a computer is licensed; the window stays reachable from every footer ("License on this computer"). Never add a second buy button to a bar.
- Never type a price into a page by hand without `scripts/check-license.mjs` passing. A license is a signed key checked in the browser (`assets/services/licenseManager.js`); the private signing key is never in this repository (`.gitignore` refuses `*.pem`), and no Stripe secret, price id or live key goes in a file. A Payment Link that still holds `REPLACE_ME` or `test_` is treated as not set up. Make or check a key with `scripts/issue-license.mjs` or `tools/owner/license-desk.html` (the owner's page, not on the live site; `scripts/check-license-desk-ui.mjs` proves it). Stripe setup: `docs/stripe-setup-guide.md`.

## What is a rule now, and what is built

The visual look, the three doors, the content rules and the print rules in the skills are the owner's decisions. Several are **not yet in the code**. New work follows the rule; it must not widen a gap. When you build one, update this table in the same pull request.

| Rule | In the code today |
|---|---|
| `npm run build` runs the real gate | Built, and run by GitHub on every push and pull request (`site-ci.yml`) |
| Free packets never reset; whole-building printing needs a license or pilot; one chip in the bar | Built (November 12, 2026) |
| Every file in `assets/services/` has an honest source | Built: built from `src/services/*.ts`, or listed in `HAND_WRITTEN` in `scripts/build-services.mjs` and labeled hand-written; `npm run services` fails otherwise |
| `platform/` paused | In force |
| Three doors, one menu style | Not built (seven places; the Packet Builder has its own side menu) |
| "Warm Editorial Clinical" look (`cognicopia-visual-style`) | Not built: `css/styles.css` still ships the November 5 oceanic palette, and `scripts/check-design-system.mjs` measures it. Restyle by changing the tokens and the check's expectations together |
| No button emojis, no browser pop-ups, no "export" for a local PDF | Not built in the packet tool (the playbook measured them) |
| Era facts from the exact birth year, birth year + 7 to + 28 | Not built: the packet tool's era table was keyed by decade, and the reminiscence engine (`assets/services/reminiscenceEngine.js`) and the pages built on it use ages 10 to 30. Reconcile both to one source |
| Honest thin-data headings; late-stage page list; hand-under-hand; no default pronoun; faith and military rules; claim rewrites | Measured by the playbook at commit `ff7a11d`: re-check each against `main` before relying on it |
| Staff companion sheet at the front; no page under 60% full | Not built |

## Working with the owner

The owner is new to coding and to these tools, and acts on what is written here word for word. A wrong button name or an unexplained term costs them real time and trust.

- **Never name a button, menu, setting or screen you have not seen.** If a step comes from documentation, say so, say the owner's screen may differ, and give one step at a time; ask what they see before the next.
- **The owner's computer runs Windows.** Steps for their own machine use File Explorer and PowerShell (to open one in a folder: click the Explorer address bar, type `powershell`, press Enter), not Mac or Linux commands. A file created by hand must not end up named `.env.local.txt`. Do not ask which system they use again.
- **Do it yourself first.** The owner's standing instruction is to finish requested work without handing it back. When something truly cannot be done from here, say in one plain sentence what blocked it (the real error, not a guess), then give the single shortest path, not a menu of options.
- **No jargon.** Write as if to a smart adult who has never opened a terminal. If a term is needed, say what it is in the same sentence.
- **Check before you claim a limit,** and never say a thing was verified unless you did it.
- **Secrets stay with the owner.** A private key or token is made and kept on the owner's own computer. Never move one into a conversation, a file in the repository or a cloud session.

## Privacy and claims

- Zero PHI outside the browser. Test data and fixtures use made-up people only; never a real name, birth date or facility.
- Do not claim to be "HIPAA compliant". Say what is true: **"No resident data leaves the device"** and "supports a facility's HIPAA privacy practices". Regulatory wording (CMS, state rules) is "supports", never "ensures" or "proves". The phrases the product may not claim are listed in `cognicopia-clinical-dignity`, and `scripts/check-claims.mjs` must learn each one.
- The Shift board (`docs/daily-operations.md`) keeps residents by alias or room only. Never add a feature that stores a resident's name there, and keep its name check.
- The outreach desk (`outreach/`, `docs/marketing-strategy.md`) writes to business contacts only: never commit a real prospect's address (`outreach/data/` is ignored), never put a resident in a lead, and keep the postal address, the advertisement line and the opt-out in every email (`scripts/check-outreach.mjs`). Do not reuse the unmeasured claims in `docs/enterprise-gtm-procurement-playbook.md` (hours saved, percentages, "guaranteeing" survey results).
- Do not scope an offline claim wider than it is: "no internet needed" is true of the packet tools, not of sign-in, billing or license activation.
- A repository is public: no secrets, tokens or keys in any file. Use placeholders such as `YOUR_KEY_HERE`.

## Tone (dignity first)

Write and review all resident-facing text as if for an adult relative. No "Do you remember...", no quizzing, no childish words, no elderspeak, no infantilizing art. Invite; never test. The dignity and avoid-topic filters in `src/engine` and `assets/cognicopia-coloring/prompts.js` are tests, not suggestions. The detail is in `cognicopia-clinical-dignity`.

## Look, touch and print (details in the skills)

- **Touch targets:** every control a finger must hit is at least **52 px** tall and wide (`--tap`). A link inside a sentence is exempt; anything else needs `data-tap-exempt="reason"` on its container, with a reason that holds. `npm run build` measures this in a real browser.
- **Print is not the screen:** anything printed or made into a PDF is pure black on pure white. Lines at least 3 pt, 0.5 in margins and a 0.75 in binding gutter on US Letter, type never under the stage's floor, pictures 3:4 with closed outlines (`docs/cognicopia-coloring-standards.md`). Staff text and clinical labels never sit on a resident page (`cognicopia-print-engine`).
- **Screen palette, wording of controls, zoom and contrast:** `cognicopia-visual-style`. Everything a person reads must reach AAA contrast (7:1) by day and in Night Shift, with the exceptions that skill spells out.

## Commands

```
npm run build     # the real gate: build.mjs, then check-claims, then npm test (long: run it in the background)
npm test          # every check suite
npm run lint      # node --check server.js only
npm run coloring  # regenerate the coloring catalog and bundle after editing assets/cognicopia-coloring/*.js or approving traced art
npm run nav       # regenerate the navigation on every page from HUBS in scripts/site-nav.mjs (also after npm run coloring)
npm run services  # rebuild assets/services/*.js from src/services/*.ts
node scripts/landing-example.mjs  # rewrite the three examples on the front page's laptop from what the engines make (--check proves they are current; run it after any change to src/pcg or the reminiscence engine)
npm run coloring:svgs  # trace master PNGs to closed-outline SVG and js/coloring-data.js (needs: pip install pillow vtracer)
npm run art:doctor     # local art agent: is this computer ready to make coloring masters (add -- --selftest)
npm run art:make -- --only sunflower   # make a master on this computer; it goes to assets/coloring/_inbox/ for review
npm run art:library    # measure the 150 designs against the print standards
node scripts/license-keygen.mjs     # owner only: make the license-signing key pair (the private half stays outside the repo)
node scripts/issue-license.mjs      # make or verify a signed license key; see docs/stripe-setup-guide.md
npm run audit:print  # print every page, every Packet Builder activity and the front-page packet to PDF and read it back; also part of the build
npm run audit:ux     # measure tap targets, contrast, clicks, nav and print time in a real browser (not part of npm test)
npm run outreach -- report   # the outreach desk (docs/outreach-desk.md); sends nothing
```

## Working rules

- **Branch and push:** develop on the branch the session names; `git push -u origin <branch>`; retry network errors only (2, 4, 8, 16 s).
- **Going live:** `npm run build`, commit, push, open a PR to `main`, merge it when it is green, then confirm the GitHub Pages run for the merge commit succeeded. The owner wants every finished change live.
- **Commits and PRs:** use the attribution lines the session specifies. Put no model names or identifiers anywhere else, including code comments.
- **Markdown:** GitHub Pages runs Jekyll. Do not write the two-character Liquid openers (a doubled left brace, or a left brace followed by a percent sign) in any `.md` file, even inside code spans. Search for them before committing.
- **Edits:** match the surrounding code's style and comment density. Do not reformat files you did not change. Do not hand-edit generated files (`assets/cognicopia-coloring/cognicopia-coloring.js`, the catalog, the navigation block on each page and in `builder.html`'s sidebar, the files in `assets/services/` that are built from `src/services/*.ts` (the hand-written ones there say so in their first lines), `js/coloring-data.js`, `assets/svgs/*`); change the source and run its generator.
- **One rulebook.** This file and the skills above are the only instructions for AI coding tools in this repository. `.clinerules` only points here. If you find another file that gives different instructions (a pixel size, a price, an architecture), fix or delete it in the same change.

## Measured, not promised

A goal such as "three clicks", "under 5 minutes" or "under 400 ms" is a claim only when it has been measured on the real app (`scripts/audit-ux.mjs`; `docs/ux-baseline.md` holds the numbers to beat). Do not put a number on a public page that has not been measured. A named clinical reviewer, a customer quote or a case study appears only when it is real.
