# Reference audit: protocol for Claude Code

This is the procedure for finding and fixing broken references (a link to a page that is gone, a script that 404s, a button whose handler looks for an element that does not exist) across every `.html`, `.js` and `.css` file. It uses one read-only tool, `scripts/audit-references.mjs`, and a human-reviewed fix loop. Read `CLAUDE.md` first; this protocol obeys it.

## Ground rules

1. **The scan never changes a file.** Every change is a separate, small, reviewable edit by Claude Code, committed on its own.
2. **No sweeping reformat.** `CLAUDE.md` says "Do not reformat files you did not change". Do not run a formatter or re-indent across the repository. Fix indentation only on lines you are already editing, in the style of the lines around them.
3. **Never hand-edit a generated file.** The top bar and footer on each page, `assets/services/*.js`, `assets/svgs/*`, `js/coloring-data.js` and the coloring catalog are written by scripts. Change the source and run its generator (`npm run nav`, `npm run services`, `npm run coloring`).
4. **Only `console.log(` and `debugger` count as leftover debugging.** `console.warn`, `console.error` and `console.info` are diagnostics the pages use on purpose (for example the boot check in `builder.html`). Leave them.
5. **A missing page may have been removed on purpose.** Before restoring or unlinking, look in the history (step 4) and, if it is not obvious, ask the owner.
6. **No claim without a run.** A clean scan does not prove a button works. Finish with the browser checks in step 7.

## Steps

1. **Start clean.** `git status` shows nothing uncommitted, on the branch the session names.
2. **Prove the scanner.** Run `node scripts/audit-references.mjs --selftest`. It plants 15 known faults in a temporary folder and must find all of them with no false alarm on a clean page. Stop if it fails.
3. **Scan.** Run `node scripts/audit-references.mjs --out docs/audit-report.md` (use `--out -` to print instead, `--json` for machine-readable output). Exit code 1 means at least one error.
4. **Triage, one category at a time**, in this order:

   | Category | What it means | What to do |
   |---|---|---|
   | missing file | A script, stylesheet, image or page is linked but not in the repository (a 404) | `git log --diff-filter=D --oneline -- <path>` shows when it was deleted. If the deletion was a mistake, `git checkout <commit>^ -- <path>`. If it was on purpose, remove the link in the source that writes it (for nav and footer links, edit `HUBS` in `scripts/site-nav.mjs` and run `npm run nav`). |
   | duplicate id | The same id twice in one page | Rename one and update whatever uses it |
   | mismatched or unclosed tag | A closing tag that does not match what is open | Fix the tag by hand; check the page in a browser afterwards |
   | empty link | `href="#"`, `href=""` or `javascript:` | An action becomes `<button type="button">` (keep its class and handler); a destination gets a real address |
   | listener on a missing element | Code attaches a listener to an id nothing creates, with no null check | Find out whether the element was renamed or removed; fix the id or the handler, then prove it in a browser |
   | dead id reference (warning) | Code looks up an id nothing creates | Often harmless (a null-guarded optional element, or an id built at run time). Decide each one; remove the dead handler only when sure |
   | in-page link (warning) | `#name` with nothing to land on | Add the anchor or fix the link |
   | debug leftover (warning) | `console.log(`, `debugger`, TODO or FIXME | Remove `console.log(` and `debugger`. A TODO is the owner's note: report it, do not delete it |
   | unreferenced class (note) | A CSS class no page or script mentions | Information only. Do not delete CSS from this list alone: a class can be chosen by a calculation |

5. **Fix in small commits.** After each category, re-run the scan and confirm its count fell and nothing new appeared.
6. **Run the repository's own checks.** `npm test`, then `npm run build` where it works, then `node scripts/audit-ux.mjs`. Report what actually passed and what failed; do not weaken or skip a check.
7. **Look at it in a real browser** (Playwright, already installed; see `CLAUDE.md`) at 1366 x 768 and 390 x 844, in day and in Night Shift, for every page you changed. Click the controls you touched.
8. **Write the report.** Re-run step 3 so `docs/audit-report.md` shows the final state, then add the "Changes made" section below to the pull request description.

## Changes made (template for the pull request)

```
Files modified:   <path> (<what changed and why>)
Errors resolved:  <category>: <before> -> <after>
Left alone:       <finding> (<reason: intentional, owner decision, generated file>)
Checks run:       <command>: <result, quoted>
Health:           GREEN / AMBER / RED (from the scan)
```

## Validation checklist

- [ ] Working tree was clean before the scan
- [ ] `--selftest` passed
- [ ] Every error was fixed or has a written reason it was left
- [ ] No generated file was edited by hand
- [ ] No file was reformatted that was not otherwise changed
- [ ] Only `console.log(` and `debugger` were removed; no `console.warn`, `console.error` or `console.info`
- [ ] Each restored or removed page was checked against the history
- [ ] The scan was re-run after the last change and its counts are in the report
- [ ] `npm test` and the page checks were run and their real results are quoted
- [ ] Every changed page was loaded in a real browser at both sizes, with no console errors
- [ ] No claim of "fixed" was made for anything that was not run

## What the scan cannot do

It reads text; it does not run the pages. An id built from pieces at run time can look dead, and a handler that exists can still do the wrong thing. That is why only missing files, duplicate ids, mismatched tags, empty links and unguarded dead listeners are errors, and why step 7 is not optional.
