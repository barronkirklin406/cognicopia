# Local AI: a plan for an optional experiment (not built)

**Status: a plan only.** Nothing in this page is in the product. It is decision D5 in [blueprint-decisions.md](blueprint-decisions.md), written down so the experiment can be run, judged and stopped on purpose. The deterministic engine stays the product: fast, testable, curated and offline. A model, if it ever ships, is an optional drafting helper beside it.

## Why it is not built in this change

- It cannot be proved here. A useful in-browser model needs a computer with WebGPU or plenty of memory, and a model file of hundreds of megabytes to several gigabytes. The cloud sandbox this is developed in has neither a model nor a GPU, and "it runs on my machine" is not evidence for an older facility PC.
- It needs two decisions only the owner can make: which model, under which license (many restrict commercial use or redistribution), and how a facility gets the weights (below).
- The rules of the project make a careless version wrong, not just risky: the static site makes no network request, small models invent facts, and the resident-facing filters are tests, not suggestions.

## What it would be for

Narrow jobs where a draft saves a person time and a person still decides:

1. **More conversation invitations and sensory prompts** for the 12-Month Life Planner and the Cognitive Life Journal, drafted from a resident's profile.
2. **Rewording** a few lines of a family digest into plainer, warmer words.

It would **not** be used for: anything a resident reads without a person reviewing it first; "historical facts" (a model's date or event is never printed without a source a person checked); clinical statements, stages, codes or findings; the Shift board's notes (resident details stay in the encrypted store and out of prompts); anything that scores, quizzes or labels a person.

## What already exists to build on

The Life Planner and the Journal engines already have the seam, designed so that no model is needed to use it:

- `buildAiRequest(profile)` makes the request an AI layer would receive. It sends nothing. The resident's names, family names, dates and milestones are left out or scrubbed to "the resident", and the topics to avoid are included.
- `acceptAiCopy(raw)` takes whatever a provider returns and passes it through `sanitizeAiCopy`, the same dignity and avoid-topic audit the built-in library is held to. Only clean strings survive, with the rejected ones reported.

A local model is one more provider behind that seam. The first experiment changes nothing else.

## The rules it must keep (from D5 and CLAUDE.md)

| Rule | How |
|---|---|
| **Off by default** | A switch in Settings, off, with a plain explanation: slower, needs a capable computer, a model file, drafts only. Nothing loads until it is turned on. |
| **Its own script** | The runtime and glue live in one folder (`assets/ai/`), loaded only when the switch is on, by inserting one script. With it off, no byte of it is fetched or run. |
| **The static site stays offline** | The page makes no request for the model. The facility copies a model file onto the computer (from a USB drive or a download made outside the app) and chooses it with a file picker; the page reads that local file. No CDN, no hosted weights, no telemetry. `npm run build` keeps scanning for network calls, and the scan is extended to `assets/ai/`. |
| **Filters on every output** | Output goes through `acceptAiCopy`, which applies the same dignity and avoid-topic audit as the built-in library, with the resident's own avoid list. Rejected lines are dropped and counted, never edited into something that passes. |
| **A person reviews before it prints** | Drafts appear as a list to accept or discard line by line, marked as drafts. Nothing prints or saves without that step. |
| **The deterministic engine always works** | Turning the switch off, a missing file, an unsupported browser or a slow computer all leave every page and print exactly as they are. |
| **No facts from a model** | No date, event, price or "did you know" from a model. Prompts ask for invitations and sensory language only, and the schema has no field for facts. |
| **No resident data leaves the device** | True by construction: the model runs in the page. The prompt is built by `buildAiRequest`, which already withholds names. |
| **Claims stay true** | The product never says "AI-powered", "clinical AI" or that a model is "safe". It says what it is: an optional drafting helper that runs on this computer, with a person's review. `scripts/check-claims.mjs` gets the phrases added. |

## The experiment, boxed

A spike of a few days, run by the owner or with them, answering one question: *is a small local model good enough to be worth keeping behind a switch?*

1. **Pick candidates.** Two small instruction-tuned models with licenses that allow what the facility needs. Record the license, size and source of each in this page.
2. **Pick a runtime.** A WebGPU or WASM runtime for browsers, vendored (no CDN) at a pinned version, with its license checked and its maintenance confirmed, as CLAUDE.md asks of any new tool.
3. **Wire the seam.** A provider for the planner's and journal's `buildAiRequest`, behind the switch, with the file picker and a progress message (generation takes seconds to a minute, not 400 ms, and the screen says so).
4. **Measure on a fixed set.** Twenty fictional profiles (never a real person) run through each candidate. Record: the share of lines the dignity and avoid-topic filters reject; the share a person judges usable without editing; time to a first draft on the oldest facility computer available; memory use; and what happens on a computer that cannot run it.
5. **Decide.** Ship the switch only if all of these hold, and say so in this page with the numbers:
   - at least 70 percent of lines are usable after the filters, with no filter changes;
   - a first draft arrives in under two minutes on the oldest computer a facility is likely to have, with a clear message while it runs;
   - nothing leaves the device (checked in a browser's network panel and by the build scan);
   - the switch off leaves every existing check unchanged.
   If not, stop and keep the curated library, which was written for each tier by hand and is faster.

## What to expect (and say to a facility)

- Small models repeat themselves, drift to cliché ("a trip down memory lane") and sometimes produce the very wording the filters block. The filters and the review step are the product; the model is only a draft.
- WebGPU is absent or slow on many older facility computers. The switch says so plainly and the rest of the site is unaffected.
- A "bigger, better" cloud model is a different product: it would send a resident's details to a server, break the zero-PHI promise and need a business associate agreement. It is out of scope here.
