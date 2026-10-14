# The public content catalog

The catalog is the shared bank of content that the activity tools draw from: word search lists, conversation trivia, reminiscence prompts and packet templates. It is one public JSON file, `data/content-catalog.json`. Nothing in it is about a person. The loader is `loadContentCatalog()` in `src/services/contentCatalog.ts`, built into `assets/services/contentCatalog.js` (`CogniContentCatalog`) by `npm run services`. It is checked by `scripts/check-contentcatalog.mjs` (no browser) and `scripts/check-contentcatalog-ui.mjs` (a real browser, including a cut connection).

**Status:** the file and the loader are finished and tested. The Packet Builder's roster reads the catalog (once, each time the roster opens) to make **Themed Pages**: see "Matching and the themed journal" below. The loader reads only the site's own static file, never another site, and sends nothing. The tools' rule that they make no network request of their own is about their own data and other sites; loading the site's own data file is the same kind of read as loading its scripts, and the offline worker keeps a copy, so it works with no connection once it has been loaded. If the catalog cannot be read, the roster says so and prints from a small built-in catalog.

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

## Matching and the themed journal

`src/services/contentMatcher.ts` (built into `assets/services/contentMatcher.js`, `CogniContentMatcher`) picks catalog items for one resident and bundles them into a short journal. It is checked by `scripts/check-contentmatcher.mjs` (no browser) and `scripts/check-contentmatcher-ui.mjs` (the roster, in a real browser).

### `selectContentForResident(residentProfile, contentCatalog, limit = 5)`

1. **Their level, strictly.** Only items whose `cognitive_tier` is the resident's own. A resident at Tier_3 never receives a Tier_1 page, whatever the interests say. A resident with no known level is given nothing, because a page at the wrong level is worse than none.
2. **Interests against tags.** An exact word is worth 3, the same family of words 2 (gardening and flowers, baking and kitchen, singing and music: the families are `GROUPS` in the source), a shared word stem 2, and a tag for a decade the resident was young in (ages 12 to 25, when a birth year is known, such as `1950s`) 1. Topics the resident asked to steer around remove every item tagged with them (`religion` also rules out hymns).
3. **Ranking.** By score, then by the share of the item's tags that matched, then by the catalog's own order (or by a seed, so equal matches come out differently on another day).
4. **Gentle defaults.** If fewer than `limit` items match, the rest are filled from the resident's level by a short list of well-loved themes (`ENGAGEMENT`: nostalgia, music, sensory, family, summer...). It returns fewer than `limit` when the catalog holds fewer items of that level; it never reaches into another level.

It returns entries `{ item, score, matched: [{ tag, via }], reason: "interest" | "default" }`. It accepts a database resident (`{ firstName, interests, hobbies, cognitiveTier: "Mild" }`) or a saved profile from profile.html, and a list of records or a `loadContentCatalog()` result. It never throws. Templates are structure, not content, so they are not offered.

### `generateThematicJournal(residentId, options)`

Finds the resident (by default in `CognicopiaLocalDB`, or through `options.getResident`), reads the catalog (by default with `loadContentCatalog()`), ranks, and bundles **five pages on one theme**: a memory to share first, then something to talk about, then a word search; any page the catalog cannot fill becomes "My own page" with a gentle starter, so there are always five. It returns `{ ok, source, journal, html, savedPacketId, problems }` and never throws. `options.save` also keeps the finished journal in the database as a packet (with the ids it was made from).

The pages follow the print standard: US Letter, 0.5 in margins and a 0.75 in binding gutter, pure black on white, 16, 20 and 26 point type at the three levels (never under 14, 18 and 24), writing lines 2 pt, the word search's frame and the choice boxes 3 pt. A word search's words are placed with a seeded layout and each one is checked to be really in the grid. Trivia is offered as choices to circle with a question to talk about, and the answer is kept in a note for the person beside the resident. Every line passes the adult-dignity filter before it is used.

### In the Packet Builder

On the **Resident roster** screen, **Themed Pages** is a fourth template beside Life Story Journal, 12-Month Life Planner and This Month's Pages. The roster builds the pages with the same ranking and bundling (at the level it already works out for the resident, with the dignity filter), seeded by the resident and the day, so a resident gets the same pages all day and new ones tomorrow. It prints through the usual path, so the free-packet count, the page numbers and the pure black-and-white setting apply as for the other books.

The roster's residents live in the encrypted profile store (`cognicopia_resident_<id>`), not in `CognicopiaLocalDB`, so the roster reads them there. `generateThematicJournal` is the same logic for a resident kept in the database, ready for when a page keeps residents there.
