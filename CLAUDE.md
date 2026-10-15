# Cognicopia: steering file for coding agents

Cognicopia (cognicopia.org) is an offline-first memory-care activity site: printable packets, coloring pages, life planners and journals for Activity Directors and families. This file is short on purpose. The long version, with the current state of every module, is `docs/HANDOFF-next-session.md`; read it before a large change.

## Three codebases, three rules

| Where | What | Network rule |
|---|---|---|
| Repository root (`index.html`, `builder.html`, `profile.html`, `assets/`, `src/`, `scripts/`, `resources/`) | The **static site**, published from `main` by GitHub Pages | **Offline only.** The three tools make no network request of their own. `npm run build` fails if one does. Resident data never leaves the browser. The one exception is `activate.html`, which sends a Stripe checkout reference (nothing else) to the license service to get a license key after a card purchase; no other page may use the network. |
| `platform/` | A separate Next.js, Supabase and Stripe service for facilities (sign-in, billing, shared planning) | Needs the internet by design. **Zero PHI:** it never stores a resident's name or health details. Not covered by the root `npm test`; see `platform/README.md`. |
| `license-service/` | A tiny serverless service, with no dependencies, that turns a Stripe payment into a signed license key and emails it to the buyer (`docs/license-service.md`) | Needs the internet by design, and holds no state. It sees only a buyer's email and business name from Stripe, **never a resident**, and keeps no key: the key goes in one email. Proved by `scripts/check-license-service.mjs` (in `npm test`). Its settings live in the host's environment only. |

Never add a cloud dependency to the static site. Never put resident data in `platform/` or `license-service/`. A tool may load a data file that ships with the site from the same folder (the Packet Builder's `data/content-catalog.json`, kept for offline use by `sw.js`); that is not an outside request. The **local art agent** (`scripts/local_art_agent.mjs`, `docs/local-art-agent.md`) is an owner's tool, not part of the site: it makes coloring masters on the owner's computer, its Python parts refuse every connection but loopback, and only `npm run art:setup` downloads anything (packages and one model, once). No cloud picture service, ever (owner's decision, October 2026).

## Working with the owner

The owner is new to coding and to these tools, and acts on what is written here word for word. A wrong button name or an unexplained term costs them real time and trust.

- **Never name a button, menu, setting or screen you have not seen.** If a step comes from documentation, say so, say the owner's screen may differ, and give one step at a time; ask what they see before the next. Do not give a list of steps for a screen you cannot see.
- **Do it yourself first.** The owner's standing instruction is to finish requested work without handing it back. When something truly cannot be done from here, say in one plain sentence what blocked it (the real error, not a guess), then give the single shortest path, not a menu of options.
- **No jargon.** Write as if to a smart adult who has never opened a terminal. If a term is needed, say what it is in the same sentence. Give exact steps with exact words only after they are checked.
- **Check before you claim a limit.** Before saying "I can't do X from here," confirm the cause (a network rule, a permission, a missing tool) and name it correctly. Do not say a thing was verified unless you did it.
- **Secrets stay with the owner.** A private key or token is made and kept on the owner's own computer. Never move one into a conversation, a file in the repository or a cloud session; if a tool blocks it, stop and explain, do not work around it.

## Privacy and claims

- Zero PHI outside the browser. Test data and fixtures use made-up people only; never a real name, birth date or facility.
- Do not claim to be "HIPAA compliant". Compliance belongs to a facility's program. Say what is true: **"No resident data leaves the device"** and "supports a facility's HIPAA privacy practices". The same goes for regulatory wording (CMS, state rules): "supports", never "ensures".
- The Shift board (`docs/daily-operations.md`) keeps residents by alias or room only. Never add a feature that stores a resident's name there, and keep its name check.
- Do not scope an offline claim wider than it is: "no internet needed" is true of the packet tools, not of sign-in or billing.
- A repository is public: no secrets, tokens or keys in any file. Use placeholders such as `YOUR_KEY_HERE` and keep real values in the environment.

## Tone (dignity first)

Write and review all resident-facing text as if for an adult relative. No "Do you remember...", no quizzing, no childish words, no elderspeak, no infantilizing art. Invite; never test. The dignity and avoid-topic filters in `src/engine` and `assets/cognicopia-coloring/prompts.js` are tests, not suggestions.

## Pricing and licensing

Prices live in one place, `src/config/license.js` (`PRICES`, `FREE_RUNS`, `PAYMENT_LINKS`, `PUBLIC_KEYS`): **$39 a month, $349 a year (saves $119, about 25%), Enterprise by custom quote, 25 free packets**. Never type a price into a page by hand without the check passing (`scripts/check-license.mjs` fails on the old price and on a mismatch). A license is a signed key checked in the browser (`assets/services/licenseManager.js`); the private signing key is never in this repository (`.gitignore` refuses `*.pem`), and no Stripe secret, price id or live key goes in a file. A Payment Link that still holds `REPLACE_ME` or `test_` is treated as not set up. Make or check a key with `scripts/issue-license.mjs`, or in a browser with `license-desk.html` (the owner's page: it makes the signing key and license keys with nothing to install, and `scripts/check-license-desk-ui.mjs` proves it); Stripe setup is in `docs/stripe-setup-guide.md`.

## Navigation

Six hubs, the same on every page: Today, Studio, Activity Packets, Facility, Academy, Resources (and a Contact footer link). They come from `HUBS` in `scripts/site-nav.mjs`; add or move a place there, run `npm run nav`, and `npm run build` proves every page agrees. On a window 1100 px or wider they are drop-downs across a top bar; narrower, the Menu drawer (one markup, restyled by the generated CSS). The Packet Builder keeps its own side menu. Never edit a sidebar or the top bar by hand. The same script links the shared stylesheet `css/styles.css` into every page; never add that link by hand either.

## Design system

`css/styles.css` is the one shared stylesheet: a palette (`--cg-*` tokens built on the four brand colors), two local typefaces (Atkinson Hyperlegible for the interface, Fraunces for headings, in `/fonts`), a spacing rhythm, a two-band focus ring, gentle motion that stops for `prefers-reduced-motion`, two faint scroll-driven background layers, and the coloring sheet's print rules. It sits **beneath** each page's own CSS (`:where()`, no specificity), so it cannot break a layout; a page opts in to the editorial type with `<html class="cg-ds">`. The system's own text pairs must reach AAA (7:1); `scripts/check-design-system.mjs` (in `npm test`) re-computes them, and `scripts/check-design-ui.mjs` (in `npm run build`) proves the behavior in a browser. Use the tokens, not new hex values, in new work. If a control's class sets a `box-shadow`, give its `:focus-visible` the ring's dark inner band too. No outside font, script or CDN. Everything about it: `docs/design-system.md`.

## Touch targets

Every control a finger must hit is at least **52 px** tall and wide (`--tap` in the three tools and the Packet Builder). Size new controls with `var(--tap)`; each page's `touch-floor` style catches the rest. A link inside a sentence is exempt. Anything else needs `data-tap-exempt="reason"` on its container, and a reason that holds (a dense grid whose list view has the same actions at full size). `npm run build` measures this in a real browser wherever Playwright is installed.

## Print standards

Pure black on pure white. Lines at least 3 pt. 0.5 in margins and a 0.75 in binding gutter on US Letter. Type never smaller than the tier's floor. Pictures are 3:4 with closed outlines. Standards and the numbers behind them: `docs/cognicopia-coloring-standards.md`.

## Commands

```
npm test          # every check suite
npm run build     # checks + nav sync + research pages + link check; run before every push
npm run coloring  # regenerate the coloring catalog and bundle after editing assets/cognicopia-coloring/*.js or approving traced art
npm run nav       # regenerate the six-hub navigation on every page from HUBS in scripts/site-nav.mjs (also after npm run coloring: the hub page shows the picture count)
npm run services  # rebuild assets/services/*.js from src/services/*.ts
node scripts/landing-example.mjs  # rewrite the crossword on the front page's laptop from what the engine makes (--check proves it is current; run it after any change to src/pcg)
npm run coloring:svgs  # trace master PNGs to closed-outline SVG and js/coloring-data.js (needs: pip install pillow vtracer; skips with a notice where they are missing)
npm run art:doctor     # local art agent: is this computer ready to make coloring masters (add -- --selftest)
npm run art:make -- --only sunflower   # make a master on this computer (ComfyUI or a local model); it goes to assets/coloring/_inbox/ for review
npm run art:library    # measure the 150 designs against the print standards and list what to upgrade
node scripts/license-keygen.mjs     # owner only: make the license-signing key pair (private half stays outside the repo)
node scripts/issue-license.mjs      # make or verify a signed license key (invoices, enterprise); see docs/stripe-setup-guide.md
node scripts/check-license-service.mjs  # prove the payment-to-email service without a network (also in npm test)
npm run audit:ux  # measure tap targets, contrast, clicks, nav and print time in a real browser (not part of npm test)
```

Never skip, weaken or delete a test to get green. Find the cause.

## Working rules

- **Branch and push:** develop on the branch the session names; `git push -u origin <branch>`; retry network errors only (2, 4, 8, 16 s).
- **Going live:** `npm run build`, commit, push, open a PR to `main`, merge it when it is green, then confirm the GitHub Pages run for the merge commit succeeded. The owner wants every finished change live.
- **Commits and PRs:** use the attribution lines the session specifies. Put no model names or identifiers anywhere else, including code comments.
- **Markdown:** GitHub Pages runs Jekyll. Do not write the two-character Liquid openers (a doubled left brace, or a left brace followed by a percent sign) in any `.md` file, even inside code spans. Search for them before committing.
- **Edits:** match the surrounding code's style and comment density. Do not reformat files you did not change. Do not hand-edit generated files (`assets/cognicopia-coloring/cognicopia-coloring.js`, the catalog, the sidebar block on each page and the navigation inside `builder.html`'s sidebar, `assets/services/*.js`, `js/coloring-data.js`, `assets/svgs/*`); change the source and run its generator.
- **Verify in a real browser** for anything a person sees or prints. Load Playwright with `createRequire('/opt/node22/lib/node_modules/')`; never run `playwright install` (Chromium is already installed). Check PDFs with PyMuPDF, not by eye alone (`scripts/check-design-ui.mjs` shows how). A command line is not enough for a change a person sees: look at a screenshot at 1366 x 768 and 390 x 844 as well.

## Tooling

- Prefer **Playwright** (already used by this repo's checks) to a browser-automation MCP server. If you add an MCP server, **pin its version** (never an unpinned `npx -y`), check that the package is still maintained, keep tokens narrowly scoped and out of the repository, and do not commit an auto-starting `.mcp.json`. See `docs/dev-setup.md`.
- The `cognicopia-ui` skill in this repository (`.claude/skills/cognicopia-ui/`) is the current one: the top menu bar, 52 px controls, the `--cg-*` palette. An older synced copy of the same name (it describes a 220 px left sidebar and 44 px controls) is out of date; follow this file and the repository copy.
- The `audit-ux` skill (`.claude/skills/audit-ux/`) runs `scripts/audit-ux.mjs`, which **measures** tap targets, contrast, click counts, navigation count and print-generation time. Subjective principles are listed for a human to judge; do not answer them from reading code.

## Measured, not promised

A goal such as "three clicks" or "under 400 ms" is a claim only when `scripts/audit-ux.mjs` has measured it on the real app. `docs/ux-baseline.md` holds the measurements to beat. Do not put a number on a public page that has not been measured.
