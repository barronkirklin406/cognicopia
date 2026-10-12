# Developer setup

How to work on Cognicopia on your own computer, with or without a coding agent. Nothing here is needed to use the site.

## What you need

- **Node 20 or later.** The scripts use Node's built-ins; the root `package.json` has one dependency (`express`, for `server.js`).
- **Python 3 with PyMuPDF** (`pip install pymupdf`), only to inspect generated PDFs. `scripts/check-design-ui.mjs` uses it to read three printed coloring sheets back; without it that part is skipped with a notice.
- **Optional: Pillow and vtracer** (`pip install pillow vtracer`, Python 3.9 or later), only to trace master pictures to SVG with `npm run coloring:svgs` (`scripts/build_coloring_svgs.py`). Without them the script says so and exits 2, and `npm test` and `npm run build` still pass (the tracing test is skipped with a notice). Set `PYTHON=/path/to/python` to run the checks with another interpreter.
- **A browser driver** for anything a person sees or prints: **Playwright**. It is what this repository's own checks and `npm run audit:ux` use.

```
npm install                      # once
npm test                         # every check suite (a few minutes)
npm run build                    # checks + nav sync + research pages + link check; run before every push
python3 -m http.server 8765 --bind 127.0.0.1   # a preview of the static site
```

`platform/` is a separate project with its own `npm install` (see `platform/README.md`).

## Playwright

Playwright is not in `package.json`, because the checks that run in `npm test` need no browser. Install it once where you work:

```
npm install --no-save playwright@<version>
npx playwright install chromium     # on your own computer
```

Pin the version you test with. In the cloud sandbox, Chromium and Playwright are already installed (`/opt/node22/lib/node_modules`, browsers in `/opt/pw-browsers`); load Playwright with `createRequire('/opt/node22/lib/node_modules/')` and **never run `playwright install` there**.

A scripted check is a plain Node file: open the page, do what a person does, read the result. `scripts/audit-ux.mjs` is the pattern to copy. Where Playwright is installed, `npm run build` also runs its tap-target and contrast measurement (about two minutes), so a control under 52 px or text below WCAG AA stops the build; where it is not, the build says that step was skipped.

## Browser-automation and GitHub MCP servers (optional)

A coding agent can drive a browser or GitHub through an MCP server. You do not need one: Playwright covers the browser, and the agent's own GitHub connection covers the repository. If you add one:

1. **Check the package is still maintained.** Several early reference servers (for example the Puppeteer and GitHub ones published under `@modelcontextprotocol`) were archived in favor of newer official servers. Look at the project's page before you install.
2. **Pin the exact version.** Never `npx -y some-server` with no version: it runs whatever was published last, every time you start.
3. **Keep tokens out of the repository** and give them the narrowest scope that works (one repository, the permissions you use). Use your operating system's keychain or an environment variable.
4. **Do not commit a `.mcp.json` that starts servers automatically.** A repository should not make a stranger's computer run a package on opening. Keep your local MCP settings in your own user configuration.
5. Remember MCP servers run **on your computer**, not in the cloud session.

## Working with a coding agent

`CLAUDE.md` at the repository root is the short steering file; `docs/HANDOFF-next-session.md` has the current state of every module. The agent's rules there are the same as yours:

- the static site is offline-only, and `platform/` is a separate zero-PHI service;
- no real names or resident details in any file, ever;
- the privacy wording stays "no resident data leaves the device", never "HIPAA compliant";
- `npm run build` passes before a push, and a failing test is fixed at its cause, not skipped.

## When you change something

| You changed | Run |
|---|---|
| `assets/cognicopia-coloring/*.js`, the prompts, or approved traced art | `npm run coloring` |
| `HUBS` or anything else in `scripts/site-nav.mjs`, or the coloring picture count (the hub page shows it) | `npm run nav` |
| `src/services/*.ts` | `npm run services` |
| The Research Center's content | `npm run research` |
| Layout, controls, colors or the print flow | `npm run audit:ux` before and after, then `npm run build` |
