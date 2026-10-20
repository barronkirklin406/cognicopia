# Facility operations: census import, wings, handoff and session notes

Where it lives: the Packet Builder (`builder.html`): Settings, Resident roster, Facility Portal, Shift board and Session Notes. The logic is in `src/services/censusImport.ts`, `src/services/privacyExport.ts`, `src/services/dailyOps.ts` and `src/services/slpClinicalService.ts` (built to `assets/services/*.js` by `npm run services`). Everything runs in the browser; nothing is sent anywhere.

## Privacy audit: where resident details are kept, and that none of it leaves

Resident profiles, the Shift board, session notes and the Facility Portal are sealed (AES-256-GCM) in this browser's storage through `CogniSecureStore` (see [privacy-and-storage.md](privacy-and-storage.md)). The service worker's cache holds the site's own files only.

| Check | Proved by |
|---|---|
| Every file of the site that touches `localStorage`, `sessionStorage` or `IndexedDB` (39 at the last count) makes no `fetch`, `XMLHttpRequest`, `sendBeacon`, WebSocket or EventSource call. The two Research pages that mention them only replace them with refusals | `scripts/check-facility-ops.mjs` (in `npm test`) |
| The services that handle resident details contain no outside address | the same check |
| In a real browser, the Settings, roster, Shift board, Session Notes and Facility screens make no request to another site | `scripts/check-facility-ops-ui.mjs` (in `npm run build`) |
| The tools themselves make no network request | `scripts/build.mjs` (the existing check) |

**Settings** shows this live: "No telemetry, no tracking", with the number of requests to other websites the page has made since it opened (it counts the browser's own list of requests; it should read 0). Cognicopia has no analytics, advertising or error reporting to turn off.

## Names in every export

Each export offers the same three choices (`CogniPrivacy.choiceHtml`): **Use aliases instead of names** (the default), **Remove names and personal details**, **Keep names as they are**. The starting choice is set in Settings. It applies to the roster handoff file, the Shift board and SBAR sheets, the Facility Portal spreadsheet and calendar file, the Session Notes text, and the packet tool's summary spreadsheet and backup file.

- Aliases: a resident's preferred name and nickname are replaced by their alias; two residents who share a name become "a resident", never guessed between.
- Remove: also takes out room, hometown, birth year (kept as a decade), family and pet names, free-text notes and, in text, a title followed by a name, e-mail addresses, phone numbers and full dates.
- A backup meant for restoring defaults to **Keep names**: a copy with aliases restores aliases, not names. The summary spreadsheet defaults to aliases.

This is a safety net under careful staff. It cannot catch a nickname on no profile, a surname written without a title or a distinctive story, and it does not make a file "de-identified" in a legal sense.

## Census import

Resident roster and Facility Portal, **Import a census (CSV or JSON)**. Columns are matched by name: alias, preferred name, acuity tier, life era, interests, wing, room (and optionally year of birth, hometown and former occupation). A preview says what would be added, updated or left out before anything is written. Residents already here are matched by alias or preferred name **within the same wing**, never across wings.

- Tier: "Tier 2", Mild/Moderate/Advanced, Early/Middle/Late, or GDS or FAST (3-4 is Tier 1, 5 is Tier 2, 6-7 is Tier 3). An unreadable tier becomes Tier 2 and says so.
- Life era: decades from the 1930s to the 1980s ("1940s", "40s", "1940-1960"), or a birth year. Others are reported, not silently dropped.
- Interests are matched to the profile's own interest list; the rest are kept as a note.
- Last names and full birth dates are never kept. A file over 2 MB, or past 2,000 rows, is refused or read in part and says so.

## Wings

A profile carries its wing (profile form, **Wing or unit group**, or the census). In Settings and in the Facility Portal, **Wing shown on this computer** limits the roster, every resident picker, the Shift board and the sheets to one wing; another wing's residents stay saved and are never mixed in. Residents with no wing are their own choice. **All wings** shows everyone (the starting choice). The wing's name is printed at the top of pages.

## Shift board: activities and mood, and the SBAR sheet

Besides notes and tasks, the board takes **activity and mood records**: the resident (by alias), the activity, how they took part (Chose another time, Watched or listened, Joined in, Fully engaged), an optional mood (Happy, Content, Calm, Tired, Restless, Anxious or upset, Sad or tearful) and a few words. **Generate Shift Handoff Summary (SBAR)** prints one US Letter page: Situation (counts of the records), Background (activities held), Assessment (each resident as recorded, with the moods to keep an eye on) and Recommendation (open tasks, pass-along notes, what worked). Every line is what staff recorded or a count of it; nothing is judged. A heavy shift runs to more pages rather than being cut off. See [daily-operations.md](daily-operations.md).

## Session Notes (SLP): templates and the health-record copy

Three domains (auditory comprehension, expressive language, executive function) offer goal statements, tasks to measure, Cognicopia materials that suit, the codes usually considered, and sentence starters for S, A and P with the blanks in [brackets]. A picked goal or starter is only text put in a box: the clinician edits it, and it is theirs; blanks left unfilled are flagged before signing. **Copy for the health record** gives the note as plain text (straight quotes and hyphens only), whole or one section at a time, for the resident as chosen (alias by default). Group sessions use 92508; the cognitive codes 97129 and 97130 are one-on-one. Medicare ended its functional-reporting G-codes for dates of service from January 1, 2019; the reference says so and defers to the payer. Codes are chosen by the treating clinician. See [slp-clinical-service.md](slp-clinical-service.md).

## The landing page's wood bar

The access and care controls moved from a strip under the top bar into a full-width wood-grain bar that opens the packet tool: Get Full Access, Request Corporate Invoice / W-9, License Key / Promo and Activate Access on the left; Instant Soothe / Sundowning Calm and the Night Shift switch, each with an icon badge, on the right. The top bar keeps the brand and the six hubs. The bar is part of the page, not pinned, so it is below the first screen until the visitor scrolls to the tool.
