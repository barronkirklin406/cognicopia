# Studio storage (schema version 1)

The three Studio tools keep their records in the Packet Builder's encrypted browser storage, on this computer only. Each tool has its own key, so one tool can never read or overwrite another's. `js/studio-core.js` normalizes every record on read and write; `migrate()` runs at start, repairs older or damaged records, stamps the version and is safe to run again. A record written by a newer version is left alone.

| Key | Holds |
|---|---|
| `cognicopia_studio_tracking_<resident>` | one entry per month: stage, engagement, frustration and eye fatigue (0 to 4), triggers, a short note. Up to 60 months. |
| `cognicopia_studio_journal_<resident>` | breakthroughs and calming moments, with the keywords found in each. Up to 500 entries. Personal identifiers are removed before saving. |
| `cognicopia_studio_planner_<year>` | the facility's twelve months (era, season, milestone, thematic arc, theme, notes) and the bundle plan made by the bulk pre-map. |
| `cognicopia_resident_insights_<resident>` | keywords (with counts) and short anecdotes fed back from the journal. It sits beside the saved profile, never inside it, so saving the profile again cannot erase it. |
| `cognicopia_studio_meta` | the schema version and when it was last migrated. |

When a journal entry is saved the page announces it, and a background listener adds its keywords and story to the insights record. If the saved profile has a deep section, a short keyword list is also kept there under `lifeNarrative`; nothing else in the profile is touched.

The tracking recommendation reads patterns in what staff recorded over the last 3, 6 and 12 months. It supports staff judgment and is not an assessment.
