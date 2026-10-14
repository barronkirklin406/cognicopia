# The public content catalog

The catalog is the shared bank of content that the activity tools draw from: word search lists, conversation trivia, reminiscence prompts and packet templates. It is one public JSON file, `data/content-catalog.json`. Nothing in it is about a person. The loader is `loadContentCatalog()` in `src/services/contentCatalog.ts`, built into `assets/services/contentCatalog.js` (`CogniContentCatalog`) by `npm run services`. It is checked by `scripts/check-contentcatalog.mjs` (no browser) and `scripts/check-contentcatalog-ui.mjs` (a real browser, including a cut connection).

**Status:** the file and the loader are finished and tested. No page loads the loader yet. The three tools make no network request of their own (CLAUDE.md), and reading this file is a request, so a page that adopts the catalog needs the owner's decision first. The loader reads only the site's own file, and the offline worker keeps a copy, so it works with no connection once it has been loaded.

## The record

| Field | Rule |
|---|---|
| `item_id` | 3 to 64 lowercase letters, digits and underscores, unique, for example `trivia_1950s_music_01` |
| `category` | `Trivia`, `WordSearch`, `ReminiscencePrompt` or `CognitiveTemplate` |
| `cognitive_tier` | `Tier_1_Mild`, `Tier_2_Moderate` or `Tier_3_Advanced` |
| `tags` | 1 to 20 lowercase words, letters, digits and underscores, no repeats |
| `content_payload` | an object shaped for its category (below) |

The tier is the person's level of need, so **Tier_3 is the simplest page**: fewer words, a smaller grid, two choices and the largest print. `TIER_NUMBER` maps the names to 1, 2 and 3, the same numbers a resident profile uses.

Only these five fields are read. The file itself also carries `schema`, `catalog_version`, `updated` and `description`.

### The payload for each category

- **Trivia:** `questions`, each with `prompt`, `answer`, optional `choices` (2 to 6, the answer must be one of them) and optional `follow_up`; optional `framing`. Trivia here is a way into conversation, not a test: write each prompt as an invitation, and give a follow-up that asks about the person's own life.
- **WordSearch:** `theme`, `words` (4 to 40, capital letters, 3 to 12 long, no repeats), `grid_size` (`rows` and `cols`, 5 to 30, big enough for the longest word), optional `directions` (any of `right`, `left`, `down`, `up`, `down_right`, `down_left`, `up_right`, `up_left`) and `print_notes`.
- **ReminiscencePrompt:** `prompts` (text), optional `sensory_cues` and `facilitator_note`.
- **CognitiveTemplate:** `template_name`, `page_count`, `sections` (each a `title` and an `activity_type`) and optional `print` (`min_font_pt`, `margin_in` at least 0.5, `gutter_in` at least 0.75, the print standard).

Text a person reads is 400 characters or fewer and has no angle brackets or control characters. The check runs every line of the shipped file through the adult-dignity filter (`CognicopiaClinicalMatrix.dignity`), so a line that tests, scores or talks down fails the build.

## Using it

```js
const catalog = await CogniContentCatalog.loadContentCatalog();
catalog.items;            // every valid record
catalog.source;           // "network" (the file was read) or "fallback" (the built-in stand-in)
catalog.problems;         // what went wrong, in plain words
const gentle = CogniContentCatalog.selectItems(catalog.items, { category: "WordSearch", tier: 3 });
```

`loadContentCatalog(options)` takes `url` (the site's own file only; default `/data/content-catalog.json`), `timeoutMs` (default 8000), `attempts` (default 2) and `fallback` (your own stand-in, or `[]` for none).

## It never throws

Every outcome is a result, never an exception, so a bad file cannot stop a packet from being made:

| What happened | `source` | `problems[0].code` |
|---|---|---|
| a clean read | `network` | none |
| some records did not match the schema | `network`, `degraded: true` | `rejected` (each one listed in `rejected` with its position and reasons) |
| the connection dropped (tried twice) | `fallback` | `offline` |
| the request took too long | `fallback` | `timeout` |
| the file is not there | `fallback` | `not-found` |
| the site returned an error | `fallback` | `server` or `http` |
| the file is damaged (not JSON) | `fallback` | `parse` |
| the file is not a catalog, or holds no usable records | `fallback` | `shape` or `empty` |
| the file is over 2 MB | `fallback` | `too-large` |
| the address is on another site | `fallback`, no request made | `address` |
| the browser has no `fetch` | `fallback` | `unsupported` |

The built-in stand-in is two small, valid records (one word search, one trivia). It is frozen, so a page cannot change it.

## What the loader does and does not do

- One plain GET for one file on the site's own address, with no cookies and nothing else sent. It uses no storage, makes no identifier and talks to no other site (the check reads the source to prove it).
- A page whose Content Security Policy forbids connections (the license desk's does, on purpose) cannot use it, and gets the stand-in.
- It does not decide which record to use. That is the packet engine's job, and any page that adopts the catalog must keep a resident's details out of the file: it holds public content only.

## Adding to the catalog

Add a record to `data/content-catalog.json` and run `node scripts/check-contentcatalog.mjs`. It names the record and the rule if anything is wrong. Keep `item_id`s stable once a packet may refer to them.
