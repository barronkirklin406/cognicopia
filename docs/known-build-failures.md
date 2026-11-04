# Known build failures that are not from the work in this branch

`node scripts/build.mjs` (the real gate; `npm run build` here only syntax-checks `server.js`) and `npm test` fail on these. Each was already failing on `main` and each comes from files the repository no longer holds. They were looked at and left alone, because putting the files back would reverse deliberate removals on `main` (its recent commits remove build scripts, services sources and coloring data) and would add about 120 files to this branch.

| Failing check | Cause |
|---|---|
| `check-services.mjs` | Most `src/services/*.ts` sources and `tsconfig.json` are gone, and the ones that remain are older than the built `assets/services/*.js` (the built files were changed by hand afterwards: palette, wording, engagement log). Regenerating from the old sources would undo that work. Fixing it means deciding which side is the source of truth and porting the other side into it with types. |
| `check-coloring.mjs`, `check-trace.mjs`, `check-infinite.mjs` | `src/data/cognicopia_coloring_prompt_jobs.jsonl`, the coloring catalog and art JSON, and `src/coloring/subjects/*` are gone. |
| the pcg and subjects bundle checks, if run | `src/pcg/schema` and `src/pcg/data` are gone. |

Fixed in this branch: `sw.js` was missing (the page registers it and the build pre-caches from it; restored and extended with the new modules), and the inline PDF library in `index.html` had been double-encoded and no longer matched `assets/vendor/jspdf.umd.min.js`.
