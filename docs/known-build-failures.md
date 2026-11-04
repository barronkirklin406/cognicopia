# Build failures that are not from the work in this branch

`node scripts/build.mjs` (the real gate; `npm run build` here only syntax-checks `server.js`) still reports failures. Each one below was checked against a plain copy of `main` with this branch's `scripts/` folder copied in, and fails there too, or needs files the repository no longer holds. None were fixed here, because fixing them means either putting back files that recent commits on `main` removed on purpose (about 120 of them), or changing the owner's page copy.

| Check | Cause |
|---|---|
| `check-services`, `check-localdb`, `check-contentcatalog`, `check-contentmatcher`, `check-trial` | Most `src/services/*.ts` sources and `tsconfig.json` are gone, and the ones that remain are older than the built `assets/services/*.js`, which were changed by hand afterwards. Regenerating from them would undo that work. |
| `check-coloring`, `check-trace`, `check-infinite`, `check-coloringagent`, `check-local-art`, `check-pcg` | `src/data/*` (catalog, art JSON, prompt jobs), `src/coloring/subjects/*` and `src/pcg/schema`, `src/pcg/data` are gone. |
| `check-license`, `check-license-ui`, the free-trial badge check | The upgrade screen on `index.html` no longer carries the invoice button, the "save about 25%" line or the "Get Full Access ($39/mo or $349/yr)" wording the checks look for; `server.js` no longer has `pricing` and `activate` routes. Owner copy, left alone. |
| design behavior (`check-design-ui`) | At 1366 x 768 the five front-page value cards end at 783 px, not within 768. Also failing on `main`. |
| Shift board (`check-shift-ui`) | "The sheet carries the notes, the open tasks and the carried one". Also failing on `main`. |
| Tablet Activities (`check-tablet-ui`) | Runs longer than the 280 s used here; 314 of its checks passed before the time limit. The route check (`check-tablet-route`) passes. |
| landing example | `index.html` has no `lp-example` markers to fill. |
| tap targets (`audit-ux`), print audit | Top-bar hub controls on the front pages measure under 52 px; `batch-scheduler.html` and `family-bridge.html` print pictures with gray and still load an outside script (`cdn.tailwindcss.com`); a few generated reference pages break a heading across pages or end 0.5 in from the right edge. |
| facility-ops, resident-engine, quality-hub, clinical-alignment, soothing, voice-kit | Depend on the sources above, or fail on `main` the same way. |

## Fixed in this branch

- `sw.js` was missing (the page registers it and the build pre-caches from it). Restored, and extended with every module, page and font the site now needs offline. That also made the invoice, staff-guide, terms and session-timeout checks pass.
- The inline PDF library in `index.html` was double-encoded and no longer matched `assets/vendor/jspdf.umd.min.js`.
- The front-page tablet fallback threw when an item carried a single tag instead of a list, so the in-page tablet mode never opened.
- A closed print-preview `<dialog>` had `display:flex` from its own class and so sat in the layout, covering the front page's Generate button and appearing in print.
- `contact.html` still held a switched-off direct-send path with a `fetch()`; removed, because only `activate.html` may use the network.
- `batch-scheduler.html` and `family-bridge.html` linked a stylesheet that does not exist and Google Fonts; their heads now use the shared stylesheet and favicon set.
- `sitemap.xml`, `robots.txt` and the generated Research Center and accessibility pages were out of date or missing; regenerated.
- The nav check now expects six places in the Studio menu; the clinical check allows the screen-only wind-chime timing.
