# Facility integration tools

Four screens in the Packet Builder, all offline: the file, the note or the board is read on this computer and nothing is sent anywhere.

| Screen | Address | Module | Check |
|---|---|---|---|
| EHR Import Wizard | `builder.html#/ehr-import` | `js/ehr-import.js` | `scripts/check-ehr-import.mjs` |
| Therapy Goals (SLP) | `builder.html#/therapy-goals` | `js/slp-goals.js` | `scripts/check-slp-goals.mjs` |
| Shift Highlights | `builder.html#/highlights` | `js/shift-highlights.js` | `scripts/check-shift-highlights.mjs` |
| Distress Scenario Practice | `builder.html#/scenarios` | `js/scenario-trees.js` | `scripts/check-scenario-trees.mjs` |

The screens themselves are `js/facility-tools-ui.js` (proved in a real browser by `scripts/check-facility-tools-ui.mjs`). Like the Studio tools, each is mounted into the view and torn down at the next address change.

## EHR Import Wizard

Four steps: choose the file, match the columns, choose how to keep them, preview and import. It reads a CSV (or JSON) export from PointClickCare, MatrixCare or any spreadsheet. Export column names differ between facilities and versions, so the wizard guesses the system from the column names, matches common spellings, and always shows each match so the director can change it. It does not claim to know any vendor's exact file.

- Kept: first name (or no name at all, as "Resident 204-B"), room, wing or unit, care level or stage, the birth **year**, era, interests, hometown, former occupation.
- Never kept, and named on the screen as not used: last names, full birth dates, Social Security, record, account and insurance numbers, diagnoses and medications, phone numbers, addresses and family contacts, admission and discharge dates.
- A MoCA, MMSE or BIMS total can suggest a **starting** tier when the file has no care level (MoCA 18 or more is Tier 1, 10 to 17 Tier 2, below 10 Tier 3; MMSE 20 or more, 10 to 19, below 10; BIMS 13 to 15, 8 to 12, 0 to 7). Staff confirm the tier on the profile.
- Wings can be renamed to the facility's own names, and a wing can be set for every row without one. A resident already here is updated (or left alone), never duplicated. Profiles are built by the census service (`assets/services/censusImport.js`), so this wizard and the plain census importer agree.

## Therapy Goals (SLP)

A pasted therapy note is read for a MoCA or MMSE total, the sub-scores (domains) it mentions, the minutes and the kind of service. The clinician confirms every number. From those the screen suggests CPT codes to consider (97129 and 97130 for one-on-one cognitive work by the 8-minute rule, 92507 or 92508 for speech-language treatment, 96125 for standardized testing) and the kinds of activity that suit the lowest domains.

- The note's words are never saved. A record holds the date, the instrument, the confirmed numbers, the codes chosen and the goals set (a target score for a domain).
- Progress is arithmetic on the recorded scores: first, latest, change and whether a goal is met. It is not an interpretation.
- Codes are a reference for the treating clinician under current CPT and payer rules, not billing advice. The descriptions are in plain words, not the AMA's text. 97124 is a massage code and is never suggested.
- The summary prints on one US Letter page.

## Shift Highlights

One US Letter page for the team coming on, from the Shift board: **Instant Soothe and calming approaches** with how the resident was recorded afterwards (settled, still unsettled, not recorded), who was fully engaged, who to keep an eye on, what worked and what is still to do. Residents appear by alias or room only. A calming approach is any engagement entry whose activity names Instant Soothe, calming, soothing or de-escalation, so log it on the Shift board with that activity name. Each section has a limit so the page can never run onto a second sheet; what does not fit is counted ("and 3 more on the full handoff sheet").

## Distress Scenario Practice

Four branching scenarios (late-afternoon restlessness, saying no at bath time, a missing purse, asking for someone who has died). Every choice is answered with a plain reason; a less helpful first choice leads to a repair screen. Each choice is worth 2, 1 or 0, and a scenario passes at 75% or more of the points on the path taken. A pass earns a one-page certificate with an ID that can be checked against the records on this computer; passing all four earns a series certificate. The records hold names, ids and numbers, not the scenario text. A certificate is an in-service training record, not accredited continuing education, and the scenarios are not clinical advice.
